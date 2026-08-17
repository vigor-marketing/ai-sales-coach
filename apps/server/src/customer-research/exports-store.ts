// @ts-nocheck -- 移植自 customer-research-backend 的零依赖纯 JS 模块（v1 保留原样，后续逐步补全类型）
// 导出审计日志（本地 JSON 文件）
// 与 runs-store 同一 DATA_DIR，记录每次导出的时间 / runId / 主体 / 格式 / 行数，
// 供前端"导出"页展示审计轨迹，也满足"导出需可审计"的合规要求。
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || join(HERE, '..', 'data');
const EXPORTS_FILE = join(DATA_DIR, 'exports.json');

const audits = [];
let loaded = false;

function load() {
  if (loaded) return;
  loaded = true;
  try {
    if (existsSync(EXPORTS_FILE)) {
      const parsed = JSON.parse(readFileSync(EXPORTS_FILE, 'utf-8'));
      if (Array.isArray(parsed)) for (const a of parsed) audits.push(a);
    }
  } catch (e) {
    console.error(`[exports-store] 读取 ${EXPORTS_FILE} 失败：${e.message}`);
  }
}

function flush() {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(EXPORTS_FILE, JSON.stringify(audits, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error(`[exports-store] 写入 ${EXPORTS_FILE} 失败：${e.message}`);
    return false;
  }
}

// 记录一次导出，返回完整审计条目；立即落盘。
export function recordExport(params: {
  runId?: string | null;
  company?: string | null;
  format?: string;
  rowCount?: number;
  byteSize?: number;
  status?: string;
  createdBy?: string | null;
  note?: string | null;
}) {
  const { runId, company, format, rowCount, byteSize, status = 'ok', createdBy = null, note = null } = params;
  load();
  const entry = {
    id: randomUUID(),
    exportedAt: new Date().toISOString(),
    runId: runId || null,
    company: company || null,
    format: format || 'csv',
    rowCount: Number(rowCount) || 0,
    byteSize: Number(byteSize) || 0,
    status,
    createdBy: createdBy || null,
    note: note || null
  };
  audits.push(entry);
  if (audits.length > 200) audits.splice(0, audits.length - 200);
  flush();
  return entry;
}

// 列出导出审计（按时间倒序）
export function listExports() {
  load();
  return [...audits].sort((a, b) => {
    const ta = a.exportedAt ? new Date(a.exportedAt).getTime() : 0;
    const tb = b.exportedAt ? new Date(b.exportedAt).getTime() : 0;
    return tb - ta;
  });
}
