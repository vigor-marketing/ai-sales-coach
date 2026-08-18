// @ts-nocheck -- 移植自 customer-research-backend 的零依赖纯 JS 模块（v1 保留原样，后续逐步补全类型）
// 企业数据库（客户背调 / 主动开发名单的数据底座）
// 内存存储 + 按 enterprise-requirements.json 的准入规则做需求驱动刷新。
// 设计要点：
//  - 准入规则集中在 requirements：全量国家（193 国）/ 行业 / 员工 100+（或未知待复核）/ TTL 30 天 / 仅官方可核验来源。
//  - 刷新（refresh）按规则重新校验全部主体，剔除 <100 员工、标记过期、生成变更日志。
//  - 调度器（setInterval）按 intervalSeconds 定时刷新；真实数据源接入后替换 collectProfiles()。
//  - 生产环境应替换为 PostgreSQL / 自有数据库，并接入审计与来源快照。
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEPLOY_DIR = join(HERE, 'deploy');

const DEFAULT_REQUIREMENTS_PATH = process.env.ENTERPRISE_REQUIREMENTS_PATH ||
  join(DEPLOY_DIR, 'enterprise-requirements.json');
const DEFAULT_SEED_PATH = process.env.ENTERPRISE_SEED_PATH ||
  join(DEPLOY_DIR, 'enterprise-seed.json');
const DEFAULT_INTERVAL_SECONDS = Number(process.env.DB_REFRESH_SECONDS || 0) || null;

const MAX_CHANGELOG = 50;

// 目标区域 -> 国家集合（覆盖所有大洲与主要区域；global = 全部国家；custom 由用户手动勾选）
const ALL_COUNTRIES = ['China','Japan','South Korea','North Korea','Mongolia','India','Pakistan','Bangladesh','Sri Lanka','Nepal','Bhutan','Maldives','Afghanistan','Kazakhstan','Uzbekistan','Turkmenistan','Kyrgyzstan','Tajikistan','Iran','Iraq','Syria','Lebanon','Israel','Jordan','Turkey','Armenia','Azerbaijan','Georgia','Cyprus','Indonesia','Malaysia','Singapore','Thailand','Vietnam','Philippines','Myanmar','Cambodia','Laos','Brunei','Timor-Leste','Hong Kong','Macau','Taiwan','Norway','Sweden','Finland','Denmark','Iceland','Estonia','Latvia','Lithuania','Poland','Germany','Netherlands','Belgium','Luxembourg','France','United Kingdom','Ireland','Portugal','Spain','Andorra','Monaco','Switzerland','Austria','Liechtenstein','Italy','San Marino','Vatican','Czech Republic','Slovakia','Hungary','Slovenia','Croatia','Bosnia and Herzegovina','Serbia','Montenegro','Kosovo','North Macedonia','Albania','Greece','Romania','Bulgaria','Moldova','Ukraine','Belarus','Russia','Egypt','Libya','Tunisia','Algeria','Morocco','Western Sahara','Mauritania','Senegal','Mali','Guinea','Sierra Leone','Liberia','Côte d\'Ivoire','Burkina Faso','Ghana','Togo','Benin','Nigeria','Niger','Chad','Cameroon','Equatorial Guinea','Gabon','Republic of the Congo','Democratic Republic of the Congo','Central African Republic','Sudan','South Sudan','Ethiopia','Eritrea','Djibouti','Somalia','Kenya','Uganda','Tanzania','Rwanda','Burundi','Angola','Zambia','Malawi','Mozambique','Zimbabwe','Botswana','Namibia','South Africa','Lesotho','Eswatini','Madagascar','Comoros','Seychelles','Mauritius','Cape Verde','São Tomé and Príncipe','Gambia','Guinea-Bissau','Canada','United States','Mexico','Greenland','Belize','Guatemala','Honduras','El Salvador','Nicaragua','Costa Rica','Panama','Cuba','Jamaica','Haiti','Dominican Republic','Puerto Rico','Bahamas','Barbados','Trinidad and Tobago','Saint Lucia','Antigua and Barbuda','Grenada','Bermuda','Brazil','Argentina','Chile','Peru','Colombia','Venezuela','Ecuador','Bolivia','Paraguay','Uruguay','Guyana','Suriname','French Guiana','Australia','New Zealand','Papua New Guinea','Fiji','Solomon Islands','Vanuatu','Samoa','Tonga','Kiribati','Tuvalu','Micronesia','Marshall Islands','Palau','Nauru','New Caledonia'];
const REGION_COUNTRIES = {
  global: ALL_COUNTRIES,
  asia: ['China','Japan','South Korea','North Korea','Mongolia','India','Pakistan','Bangladesh','Sri Lanka','Nepal','Bhutan','Maldives','Afghanistan','Kazakhstan','Uzbekistan','Turkmenistan','Kyrgyzstan','Tajikistan','Iran','Iraq','Syria','Lebanon','Israel','Jordan','Turkey','Armenia','Azerbaijan','Georgia','Cyprus','Indonesia','Malaysia','Singapore','Thailand','Vietnam','Philippines','Myanmar','Cambodia','Laos','Brunei','Timor-Leste','Hong Kong','Macau','Taiwan'],
  europe: ['Norway','Sweden','Finland','Denmark','Iceland','Estonia','Latvia','Lithuania','Poland','Germany','Netherlands','Belgium','Luxembourg','France','United Kingdom','Ireland','Portugal','Spain','Andorra','Monaco','Switzerland','Austria','Liechtenstein','Italy','San Marino','Vatican','Czech Republic','Slovakia','Hungary','Slovenia','Croatia','Bosnia and Herzegovina','Serbia','Montenegro','Kosovo','North Macedonia','Albania','Greece','Romania','Bulgaria','Moldova','Ukraine','Belarus','Russia'],
  africa: ['Egypt','Libya','Tunisia','Algeria','Morocco','Western Sahara','Mauritania','Senegal','Mali','Guinea','Sierra Leone','Liberia','Côte d\'Ivoire','Burkina Faso','Ghana','Togo','Benin','Nigeria','Niger','Chad','Cameroon','Equatorial Guinea','Gabon','Republic of the Congo','Democratic Republic of the Congo','Central African Republic','Sudan','South Sudan','Ethiopia','Eritrea','Djibouti','Somalia','Kenya','Uganda','Tanzania','Rwanda','Burundi','Angola','Zambia','Malawi','Mozambique','Zimbabwe','Botswana','Namibia','South Africa','Lesotho','Eswatini','Madagascar','Comoros','Seychelles','Mauritius','Cape Verde','São Tomé and Príncipe','Gambia','Guinea-Bissau'],
  north_america: ['Canada','United States','Mexico','Greenland','Belize','Guatemala','Honduras','El Salvador','Nicaragua','Costa Rica','Panama','Cuba','Jamaica','Haiti','Dominican Republic','Puerto Rico','Bahamas','Barbados','Trinidad and Tobago','Saint Lucia','Antigua and Barbuda','Grenada','Bermuda'],
  south_america: ['Brazil','Argentina','Chile','Peru','Colombia','Venezuela','Ecuador','Bolivia','Paraguay','Uruguay','Guyana','Suriname','French Guiana'],
  oceania: ['Australia','New Zealand','Papua New Guinea','Fiji','Solomon Islands','Vanuatu','Samoa','Tonga','Kiribati','Tuvalu','Micronesia','Marshall Islands','Palau','Nauru','New Caledonia'],
  middle_east: ['Saudi Arabia','United Arab Emirates','Qatar','Kuwait','Oman','Bahrain','Iraq','Iran','Israel','Jordan','Lebanon','Syria','Yemen','Turkey','Egypt','Palestine'],
  southeast_asia: ['Indonesia','Malaysia','Singapore','Thailand','Vietnam','Philippines','Myanmar','Cambodia','Laos','Brunei','Timor-Leste'],
  custom: []
};

// 自动更新频率 -> 刷新间隔（秒）；manual = 0 表示不自动调度
const FREQUENCY_SECONDS = { daily: 86400, weekly: 604800, monthly: 2592000, manual: 0 };

// 纳入主体排序优先级（用于目标数量上限裁剪）：开发 > 状态 > 信号
function priorityOf(p) {
  const prospectRank = p.prospect ? 200 : 0;
  const statusRank = { verified: 40, researching: 30, needs_review: 20, stale: 10, expired: 0 }[p.status] ?? 10;
  const signalRank = { red: 3, amber: 2, blue: 1, slate: 0 }[p.signalTone] ?? 0;
  return prospectRank + statusRank + signalRank;
}

// 状态 -> 前端展示标签 / 色系
const PROFILE_LABEL = {
  verified: { profile: '已验证', profileTone: 'green' },
  needs_review: { profile: '待复核', profileTone: 'amber' },
  researching: { profile: '研究中', profileTone: 'blue' },
  stale: { profile: '需要更新', profileTone: 'amber' },
  expired: { profile: '已过期', profileTone: 'red' },
  excluded: { profile: '已剔除', profileTone: 'slate' }
};

function nowIso() {
  return new Date().toISOString();
}

function loadJson(path, fallback) {
  try {
    if (!existsSync(path)) return fallback;
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch (e) {
    console.error(`[enterprise-database] 读取 ${path} 失败：${e.message}`);
    return fallback;
  }
}

// 将原始主体 + 准入规则收敛为规范化记录
function normalizeProfile(raw, reqs, retrievedAt) {
  const country = raw.country || '';
  const industry = raw.industry || '';
  const employeeSize = typeof raw.employeeSize === 'number' ? raw.employeeSize : null;

  const countryOk = reqs.requiredCountries.includes(country);
  const industryOk = reqs.requiredIndustries.includes(industry);

  // 员工规模门槛：<100 自动剔除；null 视为未知（待人工复核，不自动剔除）
  let included = true;
  let exclusionReason = null;
  if (!countryOk) {
    included = false;
    exclusionReason = `国家不在白名单（${country}）`;
  } else if (!industryOk) {
    included = false;
    exclusionReason = `行业不在白名单（${industry}）`;
  } else if (employeeSize !== null && employeeSize < 100) {
    included = false;
    exclusionReason = `员工规模 ${employeeSize} < 100，自动剔除`;
  }

  // 资料状态（仅对纳入主体计算）
  let status = 'needs_review';
  if (raw.profile === '已验证') status = 'verified';
  else if (raw.profile === '研究中') status = 'researching';
  else if (raw.profile === '需要更新') status = 'stale';
  else if (raw.profile === '待复核') status = 'needs_review';

  // TTL 过期判定
  const ttlDays = reqs.ttlDays || 30;
  if (included && retrievedAt) {
    const ageDays = (Date.now() - new Date(retrievedAt).getTime()) / 86400000;
    if (ageDays > ttlDays) {
      status = 'expired';
    }
  }

  const label = PROFILE_LABEL[status] || PROFILE_LABEL.needs_review;
  const prospect = Boolean(raw.prospect);

  return {
    id: raw.id || slug(raw.company),
    company: raw.company || '(未命名)',
    country,
    industry,
    employeeSize,
    employeeSizeNote: raw.employeeSizeNote || null,
    size: raw.size || (employeeSize === null ? '规模未知' : String(employeeSize)),
    domain: raw.domain || null,
    sourceCountry: raw.sourceCountry || country,
    sourceName: raw.sourceName || '',
    sourceUrl: raw.sourceUrl || '',
    signal: raw.signal || '暂无信号',
    signalTone: raw.signalTone || 'slate',
    retrievedAt: retrievedAt || nowIso(),
    ttlDays,
    included,
    exclusionReason,
    status,
    profile: included ? label.profile : PROFILE_LABEL.excluded.profile,
    profileTone: included ? label.profileTone : PROFILE_LABEL.excluded.profileTone,
    prospect,
    prospectTone: prospect ? 'amber' : 'slate'
  };
}

function slug(s) {
  return String(s || 'entity')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'entity';
}

// 数据库单例（模块级状态）
const db = {
  requirements: null,
  profiles: new Map(),
  changelog: [],
  lastUpdatedAt: null,
  nextScheduledAt: null,
  intervalSeconds: 86400,
  timer: null,
  started: false,
  collect: null // 可注入的真实数据收集器（异步函数 -> 原始主体数组）
};

function computeNext(s) {
  return new Date(Date.now() + s * 1000).toISOString();
}

function pushChangelog(entry) {
  db.changelog.unshift({ ts: nowIso(), ...entry });
  if (db.changelog.length > MAX_CHANGELOG) db.changelog.length = MAX_CHANGELOG;
}

// 持久化需求配置（含目标区域/国家/客户类型/数量/频率），使修改在重启后保留
function saveRequirementsFile(req) {
  try {
    writeFileSync(DEFAULT_REQUIREMENTS_PATH, JSON.stringify(req, null, 2), 'utf-8');
  } catch (e) {
    console.error(`[enterprise-database] 写入需求配置失败：${e.message}`);
  }
}

// 需求驱动刷新：重新校验全部主体、剔除不合规项、标记过期、生成变更日志
export async function refresh() {
  const reqs = db.requirements || { requiredCountries: [], requiredIndustries: [], ttlDays: 30 };
  const retrievedAt = nowIso();

  let rawList = [];
  try {
    rawList = db.collect ? await db.collect() : loadJson(DEFAULT_SEED_PATH, { profiles: [] }).profiles || [];
  } catch (e) {
    console.error(`[enterprise-database] collect 失败：${e.message}`);
    rawList = [];
  }

  const prevById = new Map([...db.profiles.entries()]);
  const next = new Map();

  for (const raw of rawList) {
    const p = normalizeProfile(raw, reqs, retrievedAt);
    const prev = prevById.get(p.id);
    if (prev) {
      if (prev.included && !p.included) {
        pushChangelog({ id: p.id, company: p.company, change: 'excluded', detail: p.exclusionReason });
      } else if (prev.status !== p.status) {
        pushChangelog({ id: p.id, company: p.company, change: 'status_change', detail: `${prev.status} -> ${p.status}` });
      } else if (prev.prospect !== p.prospect) {
        pushChangelog({ id: p.id, company: p.company, change: 'prospect', detail: p.prospect ? '加入开发' : '移出开发' });
      }
    } else {
      pushChangelog({ id: p.id, company: p.company, change: 'added', detail: p.included ? '新增纳入' : `新增但${p.exclusionReason}` });
    }
    next.set(p.id, p);
  }

  // 检测被移除的主体
  for (const [id, prev] of prevById) {
    if (!next.has(id)) {
      pushChangelog({ id, company: prev.company, change: 'removed', detail: '数据源不再返回该主体' });
    }
  }

  // 目标数量上限：纳入主体超过 targetCount 时，按优先级保留前 N，其余标为超出目标数量
  const targetCount = db.requirements?.targetCount;
  if (targetCount && Number.isFinite(targetCount) && targetCount > 0) {
    const included = [...next.values()].filter((p) => p.included);
    if (included.length > targetCount) {
      included.sort((a, b) => priorityOf(b) - priorityOf(a));
      for (let i = targetCount; i < included.length; i++) {
        const p = included[i];
        p.included = false;
        p.exclusionReason = `超出目标数量 ${targetCount}`;
        p.status = 'excluded';
        p.profile = PROFILE_LABEL.excluded.profile;
        p.profileTone = PROFILE_LABEL.excluded.profileTone;
        pushChangelog({ id: p.id, company: p.company, change: 'excluded', detail: p.exclusionReason });
      }
    }
  }

  db.profiles = next;
  db.lastUpdatedAt = retrievedAt;
  db.nextScheduledAt = db.intervalSeconds > 0 ? computeNext(db.intervalSeconds) : null;
  return getStatus();
}

export function getList() {
  return [...db.profiles.values()];
}

export function getById(id) {
  return db.profiles.get(id) || null;
}

export function getStatus() {
  const list = getList();
  const counts = {
    total: list.length,
    included: list.filter((p) => p.included).length,
    excluded: list.filter((p) => !p.included).length,
    needsReview: list.filter((p) => p.status === 'needs_review').length,
    expired: list.filter((p) => p.status === 'expired' || p.status === 'stale').length,
    prospects: list.filter((p) => p.prospect).length
  };
  return {
    lastUpdatedAt: db.lastUpdatedAt,
    nextScheduledAt: db.nextScheduledAt,
    intervalSeconds: db.intervalSeconds,
    ttlDays: db.requirements?.ttlDays || 30,
    requirements: db.requirements
      ? {
          region: db.requirements.region,
          requiredCountries: db.requirements.requiredCountries,
          requiredIndustries: db.requirements.requiredIndustries,
          targetCount: db.requirements.targetCount,
          ttlDays: db.requirements.ttlDays,
          refreshFrequency: db.requirements.refreshFrequency,
          intervalSeconds: db.requirements.intervalSeconds,
          allowedSources: db.requirements.allowedSources
        }
      : null,
    counts,
    changelog: db.changelog.slice(0, 10)
  };
}

// 加入 / 移出主动开发名单
export function markProspect(id, added) {
  const p = db.profiles.get(id);
  if (!p) return null;
  p.prospect = Boolean(added);
  p.prospectTone = p.prospect ? 'amber' : 'slate';
  pushChangelog({ id, company: p.company, change: 'prospect', detail: p.prospect ? '加入主动开发' : '移出主动开发' });
  return p;
}

// 重新调度定时器：按新的 intervalSeconds 启停；manual(0) 不调度
function reschedule() {
  if (db.timer) { clearInterval(db.timer); db.timer = null; }
  if (!db.intervalSeconds || db.intervalSeconds <= 0) { db.nextScheduledAt = null; return; }
  db.timer = setInterval(() => {
    refresh().catch((e) => console.error(`[enterprise-database] 定时刷新失败：${e.message}`));
  }, db.intervalSeconds * 1000);
  if (db.timer.unref) db.timer.unref();
  db.nextScheduledAt = computeNext(db.intervalSeconds);
}

// 更新目标配置（区域 / 国家 / 客户类型 / 目标数量 / 自动更新频率），持久化并立即按新规则刷新
export async function setRequirements(partial = {}) {
  const prev = db.requirements || {};
  const next = { ...prev, ...partial };
  if (!next.region) next.region = 'global';
  // 国家：只有显式传入才覆盖；否则由区域预设驱动（保证"选区域即换国家"）
  if (Array.isArray(partial.requiredCountries) && partial.requiredCountries.length) {
    next.requiredCountries = partial.requiredCountries;
  } else {
    next.requiredCountries = REGION_COUNTRIES[next.region] || prev.requiredCountries || REGION_COUNTRIES.global;
  }
  // 客户类型（行业）：同理，显式传入优先，否则沿用上一次
  if (Array.isArray(partial.requiredIndustries) && partial.requiredIndustries.length) {
    next.requiredIndustries = partial.requiredIndustries;
  } else {
    next.requiredIndustries = prev.requiredIndustries || ['Oilfield service', 'Drilling', 'Manufacturer', 'Project contractor', 'EPC'];
  }
  if (!next.targetCount || !Number.isFinite(Number(next.targetCount))) next.targetCount = 50;
  next.targetCount = Number(next.targetCount);
  next.refreshFrequency = next.refreshFrequency || 'daily';
  next.intervalSeconds = FREQUENCY_SECONDS[next.refreshFrequency] ?? 86400;
  if (!next.ttlDays) next.ttlDays = 30;
  if (!next.allowedSources) next.allowedSources = prev.allowedSources || [];
  db.requirements = next;
  db.intervalSeconds = next.intervalSeconds;
  saveRequirementsFile(next);
  reschedule();
  await refresh();
  return getStatus();
}

// 初始化数据库（载入规则、首次刷新），返回单例
export function initEnterpriseDatabase(opts = {}) {
  const loaded = loadJson(DEFAULT_REQUIREMENTS_PATH, null);
  const base = loaded || {
    requiredCountries: ALL_COUNTRIES,
    requiredIndustries: ['Oilfield service', 'Drilling', 'Manufacturer', 'Project contractor', 'EPC'],
    ttlDays: 30
  };
  db.requirements = {
    region: 'global',
    targetCount: 50,
    refreshFrequency: 'daily',
    ...base,
    intervalSeconds: FREQUENCY_SECONDS[base.refreshFrequency || 'daily'] ?? (base.intervalSeconds || 86400)
  };
  if (typeof opts.collect === 'function') db.collect = opts.collect;
  // 首次或文件缺新字段时，持久化完整 schema
  const complete = base.region && base.targetCount && base.refreshFrequency;
  if (!loaded || !complete) saveRequirementsFile(db.requirements);
  return db;
}

// 启动调度器（幂等）：立即刷新一次，然后按 interval 定时刷新
export async function startDatabase(opts = {}) {
  if (db.started) return getStatus();
  initEnterpriseDatabase(opts);
  await refresh();
  db.timer = setInterval(() => {
    refresh().catch((e) => console.error(`[enterprise-database] 定时刷新失败：${e.message}`));
  }, db.intervalSeconds * 1000);
  // 不阻止进程退出：定时器不保持事件循环存活（测试/短生命周期安全）
  if (db.timer.unref) db.timer.unref();
  db.started = true;
  return getStatus();
}

export function stopDatabase() {
  if (db.timer) clearInterval(db.timer);
  db.timer = null;
  db.started = false;
}

export function _resetForTest() {
  db.profiles = new Map();
  db.changelog = [];
  db.lastUpdatedAt = null;
  db.nextScheduledAt = null;
}
