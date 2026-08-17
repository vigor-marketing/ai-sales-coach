// @ts-nocheck -- 移植自 customer-research-backend 的零依赖纯 JS 模块（v1 保留原样，后续逐步补全类型）
// 将一次研究运行（run）的归一化结果提取为结构化行。
// 采用 [Section, Field, Value] 三列版式，覆盖 Meta / Facts / Inferences / Unknowns /
// 报告各章节 / 关键人员 / 证据。该核心提取同时供 CSV 与 XLSX 复用，保证两种导出一致。
// CSV 追加 UTF-8 BOM 保证 Excel 中文正确；XLSX 由 src/xlsx-export.js 按 Section 分组为多 Sheet。

// 取嵌套对象的标量字段，安全返回
function pick(obj, ...keys) {
  for (const k of keys) {
    if (obj && typeof obj === 'object' && obj[k] != null) return obj[k];
  }
  return null;
}

// 返回 Array<[section, field, value]>，与 CSV 完全一致的内容顺序。
export function buildReportRows(run) {
  const res = run.result || {};
  const rep = res.report || {};
  const rows = [];

  // —— Meta ——
  rows.push(['Meta', 'runId', run.id]);
  rows.push(['Meta', 'company', res.company]);
  rows.push(['Meta', 'country', res.country]);
  rows.push(['Meta', 'industry', res.industry]);
  rows.push(['Meta', 'employeeSize', res.employeeSize]);
  rows.push(['Meta', 'status', run.status]);
  rows.push(['Meta', 'generatedBy', res.generatedBy]);
  rows.push(['Meta', 'generatedAt', res.generatedAt]);
  rows.push(['Meta', 'confidence', res.confidence]);
  if (res.crossValidation) {
    rows.push(['Meta', 'crossValidation.mode', res.crossValidation.mode]);
    rows.push(['Meta', 'crossValidation.providers', (res.crossValidation.providers || []).join('|')]);
    if (res.crossValidation.agreementRate != null) rows.push(['Meta', 'crossValidation.agreementRate', res.crossValidation.agreementRate]);
  }

  // —— Facts / Inferences / Unknowns ——
  for (const f of res.facts || []) {
    rows.push(['Fact', f.field, `${f.value}${f.sourceUrl ? ` (source: ${f.sourceUrl})` : ''}`]);
  }
  for (const i of res.inferences || []) {
    rows.push(['Inference', i.field, `${i.value}${i.basis ? ` | basis: ${i.basis}` : ''}`]);
  }
  for (const u of res.unknowns || []) {
    rows.push(['Unknown', u.field, u.reason]);
  }
  for (const o of res.opportunities || []) {
    rows.push(['Opportunity', o.signal, `${o.evidence || ''} | strength: ${o.strength || ''}`]);
  }
  for (const c of res.contacts || []) {
    rows.push(['Contact', c.role, `${c.channel}: ${c.value}${c.public ? ' (public)' : ''}`]);
  }

  // —— 报告标量字段 ——
  const scalarFields = [
    ['Summary', 'oneLineSummary', rep.oneLineSummary],
    ['Summary', 'matchScore', rep.matchScore],
    ['Summary', 'matchSummary', rep.matchSummary],
    ['Summary', 'businessModel', rep.businessModel],
    ['Summary', 'recommendedPositioning', rep.recommendedPositioning],
    ['Summary', 'differentiation', rep.differentiation],
    ['Summary', 'riskSummary', rep.riskSummary],
    ['Summary', 'competitiveLandscape', rep.competitiveLandscape],
    ['Summary', 'disclaimer', rep.disclaimer],
    ['Summary', 'engagementBackground', rep.engagementBackground]
  ];
  for (const [sec, f, v] of scalarFields) if (v != null && v !== '') rows.push([sec, f, v]);

  // —— profile / registry ——
  const prof = rep.profile || {};
  for (const f of ['fullName', 'brandName', 'formerNames', 'founded', 'hq', 'ownership', 'management', 'employeeSize', 'employeeSizeNote', 'certifications', 'website', 'generalEmail', 'technicalContact']) {
    if (prof[f] != null && prof[f] !== '') rows.push(['Profile', f, prof[f]]);
  }
  const reg = rep.registry || {};
  for (const f of ['legalForm', 'registrationNo', 'registeredCapital', 'registeredAddress', 'legalRepresentative', 'shareholders', 'exchange']) {
    if (reg[f] != null && reg[f] !== '') rows.push(['Registry', f, reg[f]]);
  }
  if (rep.websiteVerification) rows.push(['Registry', 'websiteVerification', rep.websiteVerification]);

  // legal / reputation
  const lc = rep.legalCompliance || {};
  for (const f of ['litigation', 'administrativePenalty', 'sanctions', 'notes']) if (lc[f]) rows.push(['Legal', f, lc[f]]);
  const rep2 = rep.reputation || {};
  for (const f of ['news', 'industryReview', 'customerReview', 'employeeReview', 'social']) if (rep2[f]) rows.push(['Reputation', f, rep2[f]]);

  // —— 数组型章节 ——
  for (const d of rep.matchDimensions || []) rows.push(['MatchDimension', d.label || d.key, `${d.score ?? ''} | ${d.note || ''}`]);
  (rep.strengths || []).forEach((s, i) => rows.push(['Strength', i + 1, s]));
  (rep.nextSteps || []).forEach((s, i) => rows.push(['NextStep', i + 1, s]));
  (rep.revenueStreams || []).forEach((s, i) => rows.push(['RevenueStream', i + 1, s]));
  (rep.milestones || []).forEach((s, i) => rows.push(['Milestone', i + 1, s]));
  (rep.businessLines || []).forEach((s, i) => rows.push(['BusinessLine', i + 1, s]));
  (rep.verificationChecklist || []).forEach((s, i) => rows.push(['VerificationChecklist', i + 1, s]));
  for (const g of rep.whiteSpaceGaps || []) rows.push(['WhiteSpaceGap', g.vigorProduct || '', `${g.fit || ''} | ${g.note || ''}`]);
  for (const k of rep.keyPersonnel || []) rows.push(['KeyPerson', k.name || '', `${k.title || ''} | ${k.email || ''} | ${k.phone || ''} | decisionMaker=${Boolean(k.isDecisionMaker)}`]);
  for (const p of rep.productsServices || []) rows.push(['Product', p.name || '', p.detail || '']);
  for (const c of (rep.customers?.contracts) || []) rows.push(['CustomerContract', c.project || '', `${c.customer || ''} | ${c.amount || ''} | ${c.term || ''} | ${c.note || ''}`]);
  for (const s of (rep.suppliers?.table) || []) rows.push(['Supplier', s.name || '', `${s.category || ''} | ${s.note || ''}`]);
  (rep.suppliers?.subsidiaries || []).forEach((s) => rows.push(['Subsidiary', s.name || '', `${s.relation || ''} | ${s.detail || ''}`]));
  for (const f of (rep.financials?.table) || []) rows.push(['Financial', f.metric || '', `${f.period1 || ''} | ${f.period2 || ''} | ${f.growth || ''}`]);
  for (const o of rep.strategyOutlook || []) rows.push(['Strategy', o.theme || '', o.detail || '']);
  for (const m of rep.operationalMetrics || []) rows.push(['OperationalMetric', m.metric || '', `${m.value || ''} | ${m.note || ''}`]);
  for (const r of rep.riskAssessment || []) rows.push(['Risk', r.category || '', `${r.level || ''} | ${r.note || ''}`]);
  for (const t of rep.litigationTable || []) rows.push(['Litigation', t.caseName || '', `${t.authority || ''} | ${t.date || ''} | ${t.summary || ''} | ${t.source || ''}`]);
  for (const d of rep.discrepancies || []) rows.push(['Discrepancy', d.websiteClaim || '', `${d.officialRecord || ''} | ${d.note || ''}`]);
  for (const e of res.evidence || []) rows.push(['Evidence', e.url || '', `${e.tier || ''} | ${e.country || ''} | ${e.summaryEn || ''}`]);

  return rows;
}

// CSV 单元格转义：包含逗号/引号/换行时整体双引号包裹，内部引号翻倍。
function csvCell(v) {
  const s = v == null ? '' : String(v);
  if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function row(...cells) {
  return cells.map(csvCell).join(',');
}

// 不带 BOM 的纯 CSV 文本（便于单测与复用）
export function buildReportCsv(run) {
  return buildReportRows(run).map((r) => row(r[0], r[1], r[2])).join('\r\n');
}

// 带 BOM 的完整 CSV 文本（供响应体直接返回）
export function buildReportCsvWithBom(run) {
  return '﻿' + buildReportCsv(run);
}
