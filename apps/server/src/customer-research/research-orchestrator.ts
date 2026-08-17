// @ts-nocheck -- 移植自 customer-research-backend 的零依赖纯 JS 模块（v1 保留原样，后续逐步补全类型）
// 研究编排器：构建研究提示 -> 调用模型 -> 解析并约束输出
import { callDeepSeek, getConfig } from './deepseek-client.js';
import { buildClient } from './llm-client.js';
import {
  emptyResearchResult,
  normalizeEvidence,
  normalizeReport,
  EVIDENCE_CLASS,
  SOURCE_TIER,
  MATCH_DIMENSIONS,
  REPORT_TYPES,
  mapResearchType,
  DEFAULT_REPORT_PERSPECTIVE,
  DEFAULT_PRODUCT_CONTEXT
} from './research-schema.js';

// 受控、可配置的报告视角与产品上下文；产品上下文属于出网内容，确认后通过环境变量覆盖
const PERSPECTIVE = process.env.REPORT_PERSPECTIVE || DEFAULT_REPORT_PERSPECTIVE;
const PRODUCT_CONTEXT = process.env.VIGOR_PRODUCT_CONTEXT || DEFAULT_PRODUCT_CONTEXT;
const REPORT_LANG = process.env.REPORT_LANG || 'zh'; // zh | en

const DIMENSION_HINT = MATCH_DIMENSIONS.map((d) => `      { "key": "${d.key}", "label": "${d.label}", "score": 0, "note": "填写 0-10 评分与依据" }`).join(',\n');

// 两种报告原型的专属章节说明，注入到系统提示（详尽版：对齐参考报告版式，要求量化、具名、带来源）
const ARCHETYPE_SECTIONS = {
  [REPORT_TYPES.DUE_DILIGENCE]: `
This is a CUSTOMER DUE-DILIGENCE report (客户背调): the goal is to VERIFY the company's authenticity, ownership and surface risks before any engagement. In addition to the shared fields, populate these report sections IN DEPTH: All structured fields (registry, discrepancies, litigationTable, riskAssessment, operationalMetrics, strengths) MUST be returned as STRUCTURED objects/arrays, never folded into prose.
- "registry": { legalForm, registrationNo, registeredCapital, registeredAddress, legalRepresentative, shareholders (with ownership %), exchange } — fill EVERY field with the exact public-record value; cite the registry source URL.
- "websiteVerification": string (2-4 sentences) — explicitly compare what the official website claims (founders, CFO, addresses, capabilities) against public registries and third-party records.
- "discrepancies": [ { websiteClaim, officialRecord, note } ] — a verification table of EVERY mismatch found; if none, return [].
- "legalCompliance": { litigation, administrativePenalty, sanctions, notes } — detailed narrative with specific cases / authorities / dates where known.
- "litigationTable": [ { caseName, authority, date, summary, source } ] — list concrete litigation, arbitration or penalty records found.
- "reputation": { news, industryReview, customerReview, employeeReview, social } — concrete media / industry / employee sentiment WITH figures (e.g. rating scores) and source URLs.
- "riskAssessment": [ { category, level:"low|medium|high", note } ] — cover at least 信誉 / 合规 / 财务 / 运营 / 制裁与出口管制 / 网络与数据保护, each with specific evidence.
- "strengths": [ string ] — verifiable cooperation strengths (e.g. long-term NOC contracts, certifications, track record, niche capability).
- "riskSummary": string — a 2-4 sentence consolidated risk narrative synthesizing the above dimensions.
- "operationalMetrics": [ { metric, value, note } ] — concrete operating indicators (revenue, net profit, headcount, utilization %, fleet/assets, safety record) with period and source.
- "verificationChecklist": [ string ] — concrete items to confirm before cooperation (ownership, tax/license status, major-customer contracts, detailed financials).`,
  [REPORT_TYPES.COMPANY_ANALYSIS]: `
This is a COMPANY ANALYSIS report (主动开发 / market intelligence) to map the company for proactive VIGOR outreach. In addition to the shared fields, populate these report sections IN DEPTH: All list/table fields (productsServices, customers.contracts, suppliers.table, financials.table, strategyOutlook, operationalMetrics, strengths) MUST be returned as STRUCTURED ARRAYS, never folded into a single narrative string.
- "profile": fill fullName, formerNames, founded (year), hq (full address), ownership (shareholders & %), management, employeeSize, certifications, website, emails — as a detailed corporate snapshot.
- "productsServices": [ { name, detail } ] — list EVERY business segment / product line, grouped by segment, with specifics (capacity, spare capacity %, order status, flagship assets, technology, geography).
- "customers": { overview:string (named key accounts + relationship depth), contracts:[ { project, customer, amount, term, note } ] } — name the ACTUAL customers (e.g. NOC names) and major contracts with values and tenors.
- "suppliers": { overview:string, table:[ { name, category, note } ], subsidiaries:[ { name, relation, detail } ] } — named suppliers, supply-chain layout, and intra-group subsidiaries with transaction values.
- "financials": { narrative:string, table:[ { metric, period1, period2, growth } ] } — concrete financials & operating KPIs (revenue, profit, order book, utilization %, growth guidance, safety record) with periods.
- "strategyOutlook": [ { theme, detail } ] — MULTIPLE strategic themes (PEC expansion, offshore fleet build-out, M&A, new energy, capacity capex, policy tailwinds) each with specifics.
- "strengths": [ string ] — core competitive advantages (business breadth, key accounts, backlog, utilization, safety, vertical integration).
- "riskSummary": string — 2-4 sentence consolidated risk view (customer concentration, M&A integration, capacity bottleneck, event-driven delays, FX/exposure).
- "operationalMetrics": [ { metric, value, note } ] — operating indicators (order book, rig/utilization %, revenue guidance, spare capacity %, safety record, site offices).`
};

const SYSTEM_PROMPT_BASE = `You are a B2B customer research analyst supporting oil & gas sales development.
Your job is to research a target company from PUBLIC, COMPLIANT sources only and produce a sales report from this perspective: ${PERSPECTIVE}.

Hard rules:
1. Separate three kinds of information clearly:
   - fact: a concrete claim backed by a cited public source URL.
   - inference: a reasoned judgment derived from facts; clearly labeled as inference.
   - unknown: anything you cannot confirm; do NOT guess.
2. Never present inference or model knowledge as a verified company fact.
3. Only use sources that are official, authorized databases, company sites, or clearly public web pages. Do NOT use or persist non-permitted sources.
4. Do NOT fabricate URLs, contacts, license numbers, or financial figures.
5. Mark employee size as unknown when not evidenced; do not assume.
6. Return STRICT JSON matching the requested schema.
7. Be THOROUGH and QUANTITATIVE. Populate every applicable section with as much concrete detail as public sources allow. Use real figures wherever available (revenue, contract value, headcount, utilization rate, ownership %, dates, capacity, spare capacity). Name specific products, projects, customers, suppliers, subsidiaries and key people; attach source URLs. Prefer detailed multi-sentence narrative over one-liners. Do NOT leave a field vague or empty when evidence exists. Match the depth of a professional sales due-diligence / company-analysis report — the reader expects specifics, not generalities.
8. ALWAYS populate "matchDimensions" with ALL 5 dimension objects ({ "key", "label", "score":0-10, "note" }). Never omit or empty this array — it drives the match-score panel and is required for every report.

Report context:
- Perspective: ${PERSPECTIVE}
- Our product context (use ONLY for white-space / fit mapping in whiteSpaceGaps and match analysis): ${PRODUCT_CONTEXT}
- Report language: write every narrative field (oneLineSummary, matchSummary, businessModel, recommendedPositioning, differentiation, nextSteps, disclaimer, profile notes, dimension notes, whiteSpaceGaps notes, competitiveLandscape, and all archetype-specific sections) in ${REPORT_LANG}. Keep company legal names, brand/product names and source URLs in their original language.

Output schema (JSON only):
{
  "company": string,
  "country": string|null,
  "industry": string|null,
  "employeeSize": number|null,
  "employeeSizeNote": string|null,
  "facts": [ { "field":string, "value":string, "sourceUrl":string } ],
  "inferences": [ { "field":string, "value":string, "basis":string } ],
  "unknowns": [ { "field":string, "reason":string } ],
  "opportunities": [ { "signal":string, "evidence":string, "strength":"low|medium|high" } ],
  "contacts": [ { "role":string, "channel":string, "value":string, "public":boolean } ],
  "evidence": [ { "url":string, "tier":string, "country":string, "excerpt":string, "excerptLang":string, "summaryEn":string } ],
  "report": {
    "reportType": "due_diligence" | "company_analysis",
    "reportDate": "YYYY-MM-DD",
    "engagementBackground": string|null,
    "dataSources": [string],
    "oneLineSummary": string,
    "matchScore": number(0-10),
    "matchSummary": string,
    "profile": {
      "fullName": string|null, "brandName": string|null, "formerNames": string|null,
      "founded": string|null, "hq": string|null, "ownership": string|null,
      "management": string|null, "employeeSize": number|null, "employeeSizeNote": string|null,
      "certifications": string|null, "website": string|null, "generalEmail": string|null, "technicalContact": string|null
    },
    "matchDimensions": [
${DIMENSION_HINT}
    ],
    "businessModel": string|null,
    "revenueStreams": [string],
    "milestones": [string],
    "businessLines": [string],
    "whiteSpaceGaps": [ { "vigorProduct": string, "fit": string, "note": string } ],
    "recommendedPositioning": string|null,
    "differentiation": string|null,
    "keyPersonnel": [ { "name": string, "title": string, "email": string, "phone": string, "isDecisionMaker": boolean, "source": string } ],
    "nextSteps": [string],
    "strengths": [string],
    "riskSummary": string|null,
    "operationalMetrics": [ { "metric": string, "value": string, "note": string } ],
    "competitiveLandscape": string|null,
    "disclaimer": string
  },
  "confidence": "low|medium|high"
}

REPORT ARCHETYPE-SPECIFIC SECTIONS (include the block that matches reportType):
__ARCHETYPE_SECTIONS__`;

function buildSystemPrompt(reportType) {
  const sections = ARCHETYPE_SECTIONS[reportType] || ARCHETYPE_SECTIONS[REPORT_TYPES.DUE_DILIGENCE];
  return SYSTEM_PROMPT_BASE.replace('__ARCHETYPE_SECTIONS__', sections);
}

function buildUserPrompt(request) {
  const reportType = mapResearchType(request.researchType);
  const archetypeLabel =
    reportType === REPORT_TYPES.COMPANY_ANALYSIS
      ? 'COMPANY ANALYSIS report (主动开发 / 产品·客户·供应商·财务·战略情报)'
      : 'DUE-DILIGENCE report (客户背调 / 真伪核验·风险·合规)';
  const parts = [];
  parts.push(`Research the company: ${request.companyName}`);
  if (request.country) parts.push(`Country hint: ${request.country}`);
  if (request.industry) parts.push(`Industry hint: ${request.industry}`);
  if (request.domain) parts.push(`Likely domain: ${request.domain}`);
  if (request.product) parts.push(`Sales focus product line: ${request.product}`);
  parts.push(`Entry type: ${request.source}`);
  parts.push(`Report type: ${reportType} (${archetypeLabel})`);
  parts.push(
    'Produce a structured report matching the schema in the system prompt. ' +
    'Set report.reportType to "' + reportType + '". ' +
    'Cover the archetype-specific sections for that reportType, plus the shared fields ' +
    '(profile, matchDimensions, whiteSpaceGaps, keyPersonnel, nextSteps). ' +
    'Separate fact / inference / unknown. Return only the JSON.'
  );
  return parts.join('\n');
}

// 将 AI 原始输出收敛到 schema，并强制分类约束
function mergeParsed(result, parsed, request, model) {
  result.company = typeof parsed.company === 'string' ? parsed.company : request.companyName;
  result.country = parsed.country ?? request.country;
  result.industry = parsed.industry ?? request.industry;
  result.employeeSize = typeof parsed.employeeSize === 'number' ? parsed.employeeSize : null;
  result.employeeSizeNote =
    typeof parsed.employeeSizeNote === 'string' ? parsed.employeeSizeNote : null;

  const facts = Array.isArray(parsed.facts) ? parsed.facts : [];
  result.facts = facts
    .filter((f) => f && f.value)
    .map((f) => ({
      class: EVIDENCE_CLASS.FACT,
      field: String(f.field || 'general'),
      value: String(f.value).slice(0, 1000),
      sourceUrl: typeof f.sourceUrl === 'string' ? f.sourceUrl : ''
    }));

  const inferences = Array.isArray(parsed.inferences) ? parsed.inferences : [];
  result.inferences = inferences
    .filter((i) => i && i.value)
    .map((i) => ({
      class: EVIDENCE_CLASS.INFERENCE,
      field: String(i.field || 'general'),
      value: String(i.value).slice(0, 1000),
      basis: typeof i.basis === 'string' ? i.basis.slice(0, 500) : ''
    }));

  const unknowns = Array.isArray(parsed.unknowns) ? parsed.unknowns : [];
  result.unknowns = unknowns
    .filter((u) => u && u.field)
    .map((u) => ({
      class: EVIDENCE_CLASS.UNKNOWN,
      field: String(u.field),
      reason: typeof u.reason === 'string' ? u.reason.slice(0, 500) : '未提供来源'
    }));

  const opps = Array.isArray(parsed.opportunities) ? parsed.opportunities : [];
  result.opportunities = opps
    .filter((o) => o && o.signal)
    .map((o) => ({
      signal: String(o.signal).slice(0, 500),
      evidence: typeof o.evidence === 'string' ? o.evidence.slice(0, 500) : '',
      strength: ['low', 'medium', 'high'].includes(o.strength) ? o.strength : 'low'
    }));

  const contacts = Array.isArray(parsed.contacts) ? parsed.contacts : [];
  result.contacts = contacts
    .filter((c) => c && c.value)
    .map((c) => ({
      role: typeof c.role === 'string' ? c.role.slice(0, 200) : '',
      channel: typeof c.channel === 'string' ? c.channel.slice(0, 100) : '',
      value: String(c.value).slice(0, 300),
      public: Boolean(c.public)
    }));

  const evidence = Array.isArray(parsed.evidence) ? parsed.evidence : [];
  result.evidence = evidence
    .map(normalizeEvidence)
    .filter(Boolean)
    .slice(0, 50);

  result.report = normalizeReport(parsed.report);
  result.report.reportType = mapResearchType(request.researchType);
  // 将顶层公开职业联系人镜像进 report，使前端"联系信息"模块对真实 AI 报告同样生效
  result.report.contacts = result.contacts;
  result.confidence = ['low', 'medium', 'high'].includes(parsed.confidence)
    ? parsed.confidence
    : 'low';
  result.generatedBy = model;
  result.generatedAt = new Date().toISOString();
  return result;
}

// 执行一次研究运行（异步）
export async function runResearch(request) {
  const config = getConfig();
  const result = emptyResearchResult();
  const reportType = mapResearchType(request.researchType);

  const messages = [
    { role: 'system', content: buildSystemPrompt(reportType) },
    { role: 'user', content: buildUserPrompt(request) }
  ];

  const raw = await callDeepSeek(messages, { json: true, temperature: 0.2 });

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // 容错：模型未严格返回 JSON 时记录未知项，不伪造事实
    result.unknowns.push({
      class: EVIDENCE_CLASS.UNKNOWN,
      field: 'ai_output',
      reason: 'AI 返回无法解析为 JSON，需人工复核原始输出'
    });
    result.generatedBy = config.model;
    result.generatedAt = new Date().toISOString();
    return result;
  }

  return mergeParsed(result, parsed, request, config.model);
}

// ————————————————————————————————————————————————
// 多模型交叉验证（cross-validation）
// 主模型固定为 DeepSeek；第二模型为任意 OpenAI 兼容 provider（如 GPT，经 .runtime-secrets/openai.env 配置）。
// 两条独立调用各自产出归一化报告，再由规则层逐字段比对，给出一致率 / 冲突 / 单源待核 / 置信评分。
// ————————————————————————————————————————————————

// 用指定客户端跑一次研究，返回归一化结果（与 runResearch 同口径）
async function runWithClient(client, request) {
  const reportType = mapResearchType(request.researchType);
  const messages = [
    { role: 'system', content: buildSystemPrompt(reportType) },
    { role: 'user', content: buildUserPrompt(request) }
  ];
  const raw = await client.complete(messages, { json: true, temperature: 0.2 });
  const parsed = safeParse(raw);
  const result = emptyResearchResult();
  mergeParsed(result, parsed, request, client.model);
  return result;
}

function safeParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return {
      facts: [],
      unknowns: [{ field: 'ai_output', reason: 'AI 返回无法解析为 JSON，需人工复核原始输出' }]
    };
  }
}

function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

// 去除空格/标点后小写，用于宽松比对
function norm(v) {
  if (v == null) return '';
  return String(v).trim().toLowerCase().replace(/[\s,.\-—_()]/g, '');
}

// 参与比对的字段（覆盖公司身份、画像、工商、匹配度、运营指标）
const CV_FIELDS = [
  ['company', (r) => r.company],
  ['country', (r) => r.country],
  ['industry', (r) => r.industry],
  ['employeeSize', (r) => r.employeeSize],
  ['report.profile.fullName', (r) => getPath(r, 'report.profile.fullName')],
  ['report.profile.founded', (r) => getPath(r, 'report.profile.founded')],
  ['report.profile.hq', (r) => getPath(r, 'report.profile.hq')],
  ['report.profile.ownership', (r) => getPath(r, 'report.profile.ownership')],
  ['report.matchScore', (r) => getPath(r, 'report.matchScore')],
  ['report.registry.registrationNo', (r) => getPath(r, 'report.registry.registrationNo')],
  ['report.registry.legalRepresentative', (r) => getPath(r, 'report.registry.legalRepresentative')],
  ['report.registry.registeredCapital', (r) => getPath(r, 'report.registry.registeredCapital')]
];

function buildCrossValidation(reports) {
  if (!reports || reports.length < 2) {
    const only = reports[0];
    return {
      mode: 'single',
      providers: reports.map((r) => r.model),
      note: '仅单模型产出，未启用交叉验证'
    };
  }
  const [a, b] = reports;
  const agreed = [];
  const conflicts = [];
  const singleSource = [];

  for (const [field, get] of CV_FIELDS) {
    const va = get(a.result);
    const vb = get(b.result);
    const na = norm(va);
    const nb = norm(vb);
    const hasA = na !== '';
    const hasB = nb !== '';
    if (!hasA && !hasB) continue;
    if (hasA && hasB) {
      if (na === nb) agreed.push({ field, value: String(va) });
      else conflicts.push({ field, valueA: String(va), valueB: String(vb) });
    } else {
      singleSource.push({
        field,
        value: String(hasA ? va : vb),
        provider: hasA ? a.model : b.model
      });
    }
  }

  // operationalMetrics 按指标名比对
  const mapA = new Map(
    (a.result.report?.operationalMetrics || []).map((m) => [norm(m.metric), m.value])
  );
  const mapB = new Map(
    (b.result.report?.operationalMetrics || []).map((m) => [norm(m.metric), m.value])
  );
  for (const [mk, vA] of mapA) {
    if (mapB.has(mk)) {
      if (norm(mapB.get(mk)) === norm(vA)) agreed.push({ field: `operationalMetrics.${mk}`, value: String(vA) });
      else conflicts.push({ field: `operationalMetrics.${mk}`, valueA: String(vA), valueB: String(mapB.get(mk)) });
    } else {
      singleSource.push({ field: `operationalMetrics.${mk}`, value: String(vA), provider: a.model });
    }
  }
  for (const [mk, vB] of mapB) {
    if (!mapA.has(mk)) singleSource.push({ field: `operationalMetrics.${mk}`, value: String(vB), provider: b.model });
  }

  const compared = agreed.length + conflicts.length + singleSource.length;
  const agreementRate = compared ? Number((agreed.length / compared).toFixed(2)) : 1;

  // 置信评分：以两模型较低者为基础，一致率高且无冲突则上调
  const rank = { low: 0, medium: 1, high: 2 };
  const base = rank[a.result.confidence] <= rank[b.result.confidence] ? a.result.confidence : b.result.confidence;
  let confidenceScore = base;
  if (agreementRate >= 0.8 && conflicts.length === 0) confidenceScore = 'high';
  else if (agreementRate >= 0.5) confidenceScore = base === 'low' ? 'low' : 'medium';

  return {
    mode: 'dual',
    providers: [a.model, b.model],
    agreementRate,
    agreedCount: agreed.length,
    conflictCount: conflicts.length,
    singleSourceCount: singleSource.length,
    agreedFields: agreed.map((x) => x.field),
    conflicts,
    singleSource,
    confidenceScore,
    generatedAt: new Date().toISOString()
  };
}

// 对外：交叉验证版研究运行（server 使用此入口）
// - 主模型(DeepSeek)失败：退而用第二模型作为唯一来源，不使整任务失败。
// - 第二模型未配置：回退单模型，crossValidation.mode='single'。
// - 第二模型调用失败：保留主模型结果，crossValidation 标注失败原因，不阻塞主流程。
export async function runResearchCrossValidated(request) {
  let primary;
  let primaryModel;
  try {
    primary = await runResearch(request); // 沿用既有单模型路径（含容错）
    primaryModel = primary.generatedBy;
  } catch (e) {
    // 主模型失败：若配置了第二模型，用它兜底作为唯一来源
    const fallback = buildClient('openai');
    if (!fallback) throw e;
    primary = await runWithClient(fallback, request);
    primaryModel = fallback.model;
    primary.crossValidation = {
      mode: 'single',
      providers: [primaryModel],
      note: `主模型(DeepSeek)调用失败，仅以 ${primaryModel} 产出：${e.message}`
    };
    return primary;
  }

  const secondaryClient = buildClient('openai'); // 第二模型（GPT 等 OpenAI 兼容）

  if (!secondaryClient) {
    primary.crossValidation = {
      mode: 'single',
      providers: [primaryModel],
      note: '未配置第二模型（.runtime-secrets/openai.env），未启用交叉验证'
    };
    return primary;
  }

  try {
    const secResult = await runWithClient(secondaryClient, request);
    primary.crossValidation = buildCrossValidation([
      { model: primaryModel, result: primary },
      { model: secondaryClient.model, result: secResult }
    ]);
  } catch (e) {
    primary.crossValidation = {
      mode: 'single',
      providers: [primaryModel],
      note: `第二模型（${secondaryClient.model}）调用失败，仅以主模型产出：${e.message}`
    };
  }
  return primary;
}
