// @ts-nocheck -- 移植自 customer-research-backend 的零依赖纯 JS 模块（v1 保留原样，后续逐步补全类型）
// 客户背调研究任务的数据契约与校验
// 只描述结构、状态和边界，不依赖任何外部服务。

// 研究任务状态机（与产品规划中的报告版本控制解耦，这是“一次研究运行”的状态）
export const RESEARCH_STATUS = {
  QUEUED: 'QUEUED',
  RUNNING: 'RUNNING',
  PENDING_REVIEW: 'PENDING_REVIEW', // AI 已完成，等待人工审核
  COMPLETED: 'COMPLETED',           // 审核通过
  FAILED: 'FAILED'
};

// 信息分类（KNOWLEDGE / EVIDENCE / INFERENCE 的落地口径）
export const EVIDENCE_CLASS = {
  FACT: 'fact',         // 有明确来源支撑的企业事实
  INFERENCE: 'inference', // AI 基于证据产生的推断
  UNKNOWN: 'unknown'    // 资料不足，不能下结论
};

// 来源等级
export const SOURCE_TIER = {
  OFFICIAL: 'official',         // 政府/监管/交易所等官方来源
  AUTHORIZED_DB: 'authorized_db', // 授权商业数据库
  COMPANY_SITE: 'company_site',   // 企业官网/年报/公告
  PUBLIC_WEB: 'public_web',       // 普通公开网页（默认仅作待核验线索）
  UNVERIFIED: 'unverified'         // 未明确允许的来源
};

// 报告原型：对应平台两大功能
//  - due_diligence：客户背调，验证真伪、看风险（参考 执行摘要.pdf / REVARCO / Jarðboranir）
//  - company_analysis：主动开发，整理产品/客户/供应商/财务/战略（参考 Deep_Industries.docx）
export const REPORT_TYPES = {
  DUE_DILIGENCE: 'due_diligence',
  COMPANY_ANALYSIS: 'company_analysis'
};

// 将前端/外部传入的 researchType 映射到报告原型；默认背调
export function mapResearchType(researchType) {
  const t = String(researchType || '').toLowerCase();
  if (
    t.includes('analysis') || t.includes('主动') || t.includes('market') ||
    t.includes('intel') || t.includes('分析') || t.includes('开发')
  ) {
    return REPORT_TYPES.COMPANY_ANALYSIS;
  }
  return REPORT_TYPES.DUE_DILIGENCE;
}

// 目标行业（首期）
export const TARGET_INDUSTRIES = [
  'oilfield_services',
  'drilling',
  'oil_gas_production',
  'epc_contractor',
  'manufacturer'
];

// 国家白名单（已放开：校验仅作提示，正则接受任意合法国家 / 地区名称，含中文）
export const TARGET_COUNTRIES = ['Norway', 'UK', 'Nigeria', 'Angola', 'Brazil'];

// 综合匹配度评分维度（参考真实背调报告：产品需求匹配 / 行业相关性 / 采购决策层可触达 / 集团战略价值 / 合作意愿强度）
export const MATCH_DIMENSIONS = [
  { key: 'product_fit', label: '产品需求匹配' },
  { key: 'industry_relevance', label: '行业相关性' },
  { key: 'decision_reach', label: '采购决策层可触达' },
  { key: 'group_value', label: '集团战略价值' },
  { key: 'willingness', label: '合作意愿强度' }
];

// 风险等级
export const RISK_LEVELS = ['low', 'medium', 'high'];

// 默认报告视角与产品上下文（用于白空间隙映射；属于受控出网内容，应在确认后通过环境变量覆盖）
export const DEFAULT_REPORT_PERSPECTIVE = 'CHINA VIGOR DRILLING 大客户开发视角';
export const DEFAULT_PRODUCT_CONTEXT =
  '用户公司为油气井下工具与完井设备供应商，核心产品线包括射孔枪、桥塞、封隔器、井下安全阀(SCSSV)、滑套、陀螺/MWD、连续油管、测井与钻具管材(OCTG)。';

// 校验外部提交的研究请求
export function validateResearchRequest(body) {
  const errors = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { valid: false, errors: ['请求体必须是 JSON 对象'] };
  }

  const companyName = typeof body.companyName === 'string' ? body.companyName.trim() : '';
  if (companyName.length < 2) {
    errors.push('companyName 必填且至少 2 个字符');
  }

  const country = typeof body.country === 'string' ? body.country.trim() : '';
  if (country && !TARGET_COUNTRIES.includes(country) && !/^[\p{L}\s.'-]{2,}$/u.test(country)) {
    errors.push('country 必须是有效的国家 / 地区名称');
  }

  const industry = typeof body.industry === 'string' ? body.industry.trim() : '';
  if (industry && !TARGET_INDUSTRIES.includes(industry) && !/^[a-z_]{2,}$/.test(industry)) {
    errors.push('industry 必须是有效的行业标识');
  }

  const source = body.source || 'single';
  if (!['single', 'list', 'search'].includes(source)) {
    errors.push('source 必须是 single / list / search 之一');
  }

  const domain = typeof body.domain === 'string' ? body.domain.trim() : '';
  const product = typeof body.product === 'string' ? body.product.trim() : '';
  const researchType = typeof body.researchType === 'string' ? body.researchType.trim() : '';

  if (errors.length) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    value: {
      companyName,
      country: country || null,
      industry: industry || null,
      source,
      domain: domain || null,
      product: product || null,
      researchType: researchType || null
    }
  };
}

// 标准化的 AI 研究输出骨架
export function emptyResearchResult() {
  return {
    company: null,
    country: null,
    industry: null,
    employeeSize: null,
    employeeSizeNote: null, // 未知规模时进入人工复核
    facts: [],         // 有来源事实
    inferences: [],    // AI 推断
    unknowns: [],      // 资料不足
    opportunities: [], // 机会信号
    contacts: [],      // 公开职业联系入口
    evidence: [],      // 来源证据
    report: emptyReport(), // 结构化背调报告（BD 视角）
    confidence: null, // 总体置信度
    generatedBy: null, // AI 模型版本
    generatedAt: null,
    crossValidation: null // 多模型交叉验证结果：{ mode, providers, agreementRate, conflicts, singleSource, confidenceScore }
  };
}

// 结构化报告（对齐真实销售背调 / 公司分析参考版式）
// 两种原型共享 BD 匹配层（profile / matchDimensions / whiteSpaceGaps / keyPersonnel / nextSteps ...），
// 并按 reportType 填充各自专有的章节。
export function emptyReport() {
  return {
    reportType: REPORT_TYPES.DUE_DILIGENCE,
    reportDate: null,
    perspective: DEFAULT_REPORT_PERSPECTIVE,
    engagementBackground: null, // 委托背景
    dataSources: [],            // 数据来源列表
    oneLineSummary: null,       // 一句话定性
    matchScore: null,           // 综合匹配度 0-10
    matchSummary: null,         // 匹配度结论速读

    // —— 通用画像（BD 速读层，两种原型共用）——
    profile: {
      fullName: null,
      brandName: null,
      formerNames: null,
      founded: null,
      hq: null,
      ownership: null,          // 实控人 / 股权结构概述
      management: null,
      employeeSize: null,
      employeeSizeNote: null,
      certifications: null,
      website: null,
      generalEmail: null,
      technicalContact: null
    },

    // —— 背调专用：工商登记核验（参考 执行摘要.pdf）——
    registry: {
      legalForm: null,          // 公司类型 / 法律形式（如 ООО、Limited、PLC）
      registrationNo: null,      // 注册号（OGRN / INN / CIN / 公司编号）
      registeredCapital: null,   // 注册资本
      registeredAddress: null,   // 注册地址
      legalRepresentative: null, // 法定代表人 / CEO
      shareholders: null,        // 股权结构（股东与持股比例）
      exchange: null             // 上市交易所 / 代码（如有）
    },
    websiteVerification: null,   // 官网内容核验（叙事）
    discrepancies: [],           // 差异说明表：[{ websiteClaim, officialRecord, note }]
    legalCompliance: {           // 法律与合规
      litigation: null,          // 诉讼情况
      administrativePenalty: null, // 行政处罚 / 检查
      sanctions: null,           // 制裁 / 黑名单
      notes: null
    },
    litigationTable: [],         // 诉讼/处罚/制裁记录表：[{ caseName, authority, date, summary, source }]
    reputation: {               // 媒体与口碑
      news: null,                // 新闻报道
      industryReview: null,      // 行业评价
      customerReview: null,      // 客户评价
      employeeReview: null,      // 员工评价
      social: null               // 社交媒体 / 论坛
    },
    riskAssessment: [],          // 多维风险评估：[{ category, level, note }]
    verificationChecklist: [],   // 结论与建议中的核实清单：["确认实际控制人...", ...]

    // —— 主动开发专用：产品 / 客户 / 供应商 / 财务 / 战略（参考 Deep_Industries.docx）——
    productsServices: [],        // 主要产品与服务：[{ name, detail }]
    customers: {                 // 主要客户分析
      overview: null,            // 核心客户概览（叙事）
      contracts: []              // 重大合同与项目：[{ project, customer, amount, term, note }]
    },
    suppliers: {                 // 供应商与供应链分析
      overview: null,            // 供应链布局（叙事）
      table: [],                 // 主要供应商：[{ name, category, note }]
      subsidiaries: []           // 子公司内部供应链：[{ name, relation, detail }]
    },
    financials: {                // 财务与运营概况
      narrative: null,
      table: []                  // 财务指标：[{ metric, period1, period2, growth }]
    },
    strategyOutlook: [],         // 战略方向与发展前景：[{ theme, detail }]

    // —— BD 匹配层（我们自用，两种原型都填）——
    matchDimensions: [],         // [{ key, label, score, note }]
    businessModel: null,
    revenueStreams: [],          // [string]
    milestones: [],              // [string]
    businessLines: [],           // [string]
    whiteSpaceGaps: [],          // [{ vigorProduct, fit, note }]
    recommendedPositioning: null, // 渠道伙伴 / 直接客户 等
    differentiation: null,
    keyPersonnel: [],            // [{ name, title, email, phone, isDecisionMaker, source }]
    nextSteps: [],               // [string]

    // —— 详尽可能性汇总层（让核心优势 / 风险 / 运营指标一目了然，对齐参考报告版式）——
    strengths: [],              // 核心优势 / 竞争力要点 [string]
    riskSummary: null,          // 潜在风险汇总（自然语言；背调与主动开发共用，呼应 riskAssessment 多维表）
    operationalMetrics: [],     // 关键运营指标 [{ metric, value, note }]，如订单簿 / 利用率 / 安全记录 / 备用产能
    competitiveLandscape: null,
    disclaimer: null
  };
}

function clampScore(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(10, Math.round(n * 10) / 10));
}

function clampLevel(v) {
  return RISK_LEVELS.includes(v) ? v : 'low';
}

function asString(v, max) {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
}

function asStringArray(arr, max) {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((x) => x != null && String(x).trim() !== '')
    .map((x) => String(x).slice(0, max))
    .slice(0, 30);
}

// 将 AI 输出的 report 对象收敛到 schema，遗漏字段归位为未知/空，不伪造
export function normalizeReport(parsed) {
  const r = emptyReport();
  if (!parsed || typeof parsed !== 'object') return r;

  if (parsed.reportType === REPORT_TYPES.COMPANY_ANALYSIS) {
    r.reportType = REPORT_TYPES.COMPANY_ANALYSIS;
  }
  if (typeof parsed.reportDate === 'string') r.reportDate = parsed.reportDate.slice(0, 40);
  if (typeof parsed.perspective === 'string') r.perspective = parsed.perspective.slice(0, 200);
  if (typeof parsed.engagementBackground === 'string') r.engagementBackground = parsed.engagementBackground.slice(0, 1000);
  r.dataSources = asStringArray(parsed.dataSources, 300);

  if (typeof parsed.oneLineSummary === 'string') r.oneLineSummary = parsed.oneLineSummary.slice(0, 600);
  r.matchScore = clampScore(parsed.matchScore);
  if (typeof parsed.matchSummary === 'string') r.matchSummary = parsed.matchSummary.slice(0, 1000);

  const p = parsed.profile && typeof parsed.profile === 'object' ? parsed.profile : {};
  const profileFields = ['fullName', 'brandName', 'formerNames', 'founded', 'hq', 'ownership', 'management', 'employeeSizeNote', 'certifications', 'website', 'generalEmail', 'technicalContact'];
  for (const f of profileFields) {
    if (typeof p[f] === 'string') r.profile[f] = p[f].slice(0, 400);
  }
  r.profile.employeeSize = typeof p.employeeSize === 'number' ? p.employeeSize : null;

  // —— 背调专用章节 ——
  const reg = parsed.registry && typeof parsed.registry === 'object' ? parsed.registry : {};
  const regFields = ['legalForm', 'registrationNo', 'registeredCapital', 'registeredAddress', 'legalRepresentative', 'shareholders', 'exchange'];
  for (const f of regFields) {
    if (typeof reg[f] === 'string') r.registry[f] = reg[f].slice(0, 400);
  }
  if (typeof parsed.websiteVerification === 'string') r.websiteVerification = parsed.websiteVerification.slice(0, 1500);
  if (Array.isArray(parsed.discrepancies)) {
    r.discrepancies = parsed.discrepancies
      .filter((d) => d && (d.websiteClaim || d.officialRecord || d.note))
      .map((d) => ({
        websiteClaim: asString(d.websiteClaim, 500),
        officialRecord: asString(d.officialRecord, 500),
        note: asString(d.note, 600)
      }))
      .slice(0, 20);
  }
  const lc = parsed.legalCompliance && typeof parsed.legalCompliance === 'object' ? parsed.legalCompliance : {};
  r.legalCompliance = {
    litigation: asString(lc.litigation, 1200),
    administrativePenalty: asString(lc.administrativePenalty, 1200),
    sanctions: asString(lc.sanctions, 1200),
    notes: asString(lc.notes, 800)
  };
  if (Array.isArray(parsed.litigationTable)) {
    r.litigationTable = parsed.litigationTable
      .filter((t) => t && (t.caseName || t.authority || t.summary))
      .map((t) => ({
        caseName: asString(t.caseName, 400),
        authority: asString(t.authority, 300),
        date: asString(t.date, 60),
        summary: asString(t.summary, 1200),
        source: asString(t.source, 600)
      }))
      .slice(0, 30);
  }
  const rep = parsed.reputation && typeof parsed.reputation === 'object' ? parsed.reputation : {};
  r.reputation = {
    news: asString(rep.news, 1000),
    industryReview: asString(rep.industryReview, 1000),
    customerReview: asString(rep.customerReview, 1000),
    employeeReview: asString(rep.employeeReview, 1000),
    social: asString(rep.social, 1000)
  };
  if (Array.isArray(parsed.riskAssessment)) {
    r.riskAssessment = parsed.riskAssessment
      .filter((x) => x && x.category)
      .map((x) => ({
        category: asString(x.category, 200),
        level: clampLevel(x.level),
        note: asString(x.note, 800)
      }))
      .slice(0, 12);
  }
  r.verificationChecklist = asStringArray(parsed.verificationChecklist, 500);

  // —— 主动开发专用章节 ——
  if (Array.isArray(parsed.productsServices)) {
    r.productsServices = parsed.productsServices
      .filter((x) => x && (x.name || x.detail))
      .map((x) => ({ name: asString(x.name, 200), detail: asString(x.detail, 800) }))
      .slice(0, 30);
  }
  const cust = parsed.customers && typeof parsed.customers === 'object' ? parsed.customers : {};
  r.customers.overview = asString(cust.overview, 1500);
  if (Array.isArray(cust.contracts)) {
    r.customers.contracts = cust.contracts
      .filter((c) => c && (c.project || c.customer || c.amount))
      .map((c) => ({
        project: asString(c.project, 400),
        customer: asString(c.customer, 300),
        amount: asString(c.amount, 200),
        term: asString(c.term, 200),
        note: asString(c.note, 600)
      }))
      .slice(0, 30);
  }
  const sup = parsed.suppliers && typeof parsed.suppliers === 'object' ? parsed.suppliers : {};
  r.suppliers.overview = asString(sup.overview, 1500);
  if (Array.isArray(sup.table)) {
    r.suppliers.table = sup.table
      .filter((s) => s && (s.name || s.category))
      .map((s) => ({ name: asString(s.name, 300), category: asString(s.category, 200), note: asString(s.note, 600) }))
      .slice(0, 30);
  }
  if (Array.isArray(sup.subsidiaries)) {
    r.suppliers.subsidiaries = sup.subsidiaries
      .filter((s) => s && (s.name || s.relation))
      .map((s) => ({ name: asString(s.name, 300), relation: asString(s.relation, 200), detail: asString(s.detail, 600) }))
      .slice(0, 30);
  }
  const fin = parsed.financials && typeof parsed.financials === 'object' ? parsed.financials : {};
  r.financials.narrative = asString(fin.narrative, 1500);
  if (Array.isArray(fin.table)) {
    r.financials.table = fin.table
      .filter((f) => f && f.metric)
      .map((f) => ({
        metric: asString(f.metric, 200),
        period1: asString(f.period1, 200),
        period2: asString(f.period2, 200),
        growth: asString(f.growth, 200)
      }))
      .slice(0, 30);
  }
  if (Array.isArray(parsed.strategyOutlook)) {
    r.strategyOutlook = parsed.strategyOutlook
      .filter((x) => x && (x.theme || x.detail))
      .map((x) => ({ theme: asString(x.theme, 200), detail: asString(x.detail, 800) }))
      .slice(0, 20);
  }

  // —— BD 匹配层 ——
  const dimMap = Object.fromEntries(MATCH_DIMENSIONS.map((d) => [d.key, d.label]));
  if (Array.isArray(parsed.matchDimensions)) {
    r.matchDimensions = parsed.matchDimensions
      .filter((d) => d && (d.key || d.label))
      .map((d) => {
        const key = String(d.key || '');
        const known = dimMap[key];
        return {
          key: known ? key : String(d.label || key).slice(0, 40),
          label: known ? dimMap[key] : String(d.label || key).slice(0, 40),
          score: clampScore(d.score),
          note: typeof d.note === 'string' ? d.note.slice(0, 400) : ''
        };
      })
      .slice(0, 8);
  }

  if (typeof parsed.businessModel === 'string') r.businessModel = parsed.businessModel.slice(0, 1500);
  r.revenueStreams = asStringArray(parsed.revenueStreams, 500);
  r.milestones = asStringArray(parsed.milestones, 500);
  r.businessLines = asStringArray(parsed.businessLines, 400);

  if (Array.isArray(parsed.whiteSpaceGaps)) {
    r.whiteSpaceGaps = parsed.whiteSpaceGaps
      .filter((g) => g && (g.vigorProduct || g.fit || g.note))
      .map((g) => ({
        vigorProduct: typeof g.vigorProduct === 'string' ? g.vigorProduct.slice(0, 200) : '',
        fit: typeof g.fit === 'string' ? g.fit.slice(0, 200) : '',
        note: typeof g.note === 'string' ? g.note.slice(0, 400) : ''
      }))
      .slice(0, 20);
  }

  if (typeof parsed.recommendedPositioning === 'string') r.recommendedPositioning = parsed.recommendedPositioning.slice(0, 600);
  if (typeof parsed.differentiation === 'string') r.differentiation = parsed.differentiation.slice(0, 600);

  if (Array.isArray(parsed.keyPersonnel)) {
    r.keyPersonnel = parsed.keyPersonnel
      .filter((c) => c && (c.name || c.title || c.value))
      .map((c) => ({
        name: typeof c.name === 'string' ? c.name.slice(0, 200) : '',
        title: typeof c.title === 'string' ? c.title.slice(0, 200) : '',
        email: typeof c.email === 'string' ? c.email.slice(0, 200) : '',
        phone: typeof c.phone === 'string' ? c.phone.slice(0, 100) : '',
        isDecisionMaker: Boolean(c.isDecisionMaker),
        source: typeof c.source === 'string' ? c.source.slice(0, 200) : ''
      }))
      .slice(0, 30);
  }

  r.nextSteps = asStringArray(parsed.nextSteps, 500);

  // —— 详尽可能性汇总层 ——
  r.strengths = asStringArray(parsed.strengths, 500);
  if (typeof parsed.riskSummary === 'string') r.riskSummary = parsed.riskSummary.slice(0, 1500);
  if (Array.isArray(parsed.operationalMetrics)) {
    r.operationalMetrics = parsed.operationalMetrics
      .filter((m) => m && (m.metric || m.value))
      .map((m) => ({
        metric: typeof m.metric === 'string' ? m.metric.slice(0, 200) : '',
        value: typeof m.value === 'string' ? m.value.slice(0, 300) : '',
        note: typeof m.note === 'string' ? m.note.slice(0, 600) : ''
      }))
      .slice(0, 30);
  }

  if (typeof parsed.competitiveLandscape === 'string') r.competitiveLandscape = parsed.competitiveLandscape.slice(0, 1500);
  if (typeof parsed.disclaimer === 'string') r.disclaimer = parsed.disclaimer.slice(0, 800);
  return r;
}

// 校验一条证据的最小结构
export function normalizeEvidence(item) {
  if (!item || typeof item !== 'object') return null;
  const allowedTiers = Object.values(SOURCE_TIER);
  return {
    url: typeof item.url === 'string' ? item.url : '',
    tier: allowedTiers.includes(item.tier) ? item.tier : SOURCE_TIER.UNVERIFIED,
    country: typeof item.country === 'string' ? item.country : '',
    excerpt: typeof item.excerpt === 'string' ? item.excerpt.slice(0, 2000) : '',
    excerptLang: typeof item.excerptLang === 'string' ? item.excerptLang : 'en',
    summaryEn: typeof item.summaryEn === 'string' ? item.summaryEn.slice(0, 1000) : '',
    retrievedAt: typeof item.retrievedAt === 'string' ? item.retrievedAt : new Date().toISOString(),
    status: 'unverified' // 证据默认未审核
  };
}
