// @ts-nocheck -- 移植自 customer-research-backend 的零依赖纯 JS 模块（v1 保留原样，后续逐步补全类型）
// 研究运行本地持久化（JSON 文件）
// 模块级单例：同一进程内 server.js（直跑）与 serve.mjs（统一部署）共享同一份内存 Map + 同一磁盘文件。
// 启动/首次访问时从 DATA_DIR/runs.json 重新加载，研究记录与报告在进程重启后不丢失。
//
// 设计取舍：
//  - 内存 Map 为权威索引，落盘为同步 writeFileSync（研究运行写入频率极低，短暂阻塞可接受）。
//  - 状态高频变更时通过 50ms 防抖合并写，避免一次研究运行多次全量落盘。
//  - 生产环境应替换为 PostgreSQL / 自有数据库，此处仅满足原型"重启不丢"的硬性要求。
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { atomicWriteJsonSync, queueWriteJson } from './atomic-json.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || join(HERE, '..', 'data');
const RUNS_FILE = join(DATA_DIR, 'runs.json');

// 内存索引：runId -> run 对象（与磁盘保持一致）
const runs = new Map();
let loaded = false;
let saveTimer = null;

function load() {
  if (loaded) return;
  loaded = true;
  try {
    if (existsSync(RUNS_FILE)) {
      const parsed = JSON.parse(readFileSync(RUNS_FILE, 'utf-8'));
      const arr = Array.isArray(parsed)
        ? parsed
        : parsed && Array.isArray(parsed.runs)
          ? parsed.runs
          : [];
      for (const r of arr) {
        if (r && r.id) runs.set(r.id, r);
      }
    }
  } catch (e) {
    console.error(`[runs-store] 读取 ${RUNS_FILE} 失败：${e.message}`);
  }
}

// 将内存中的全部 run 立即落盘（原子写：tmp + rename）。返回是否成功。
export function flush() {
  try {
    const arr = [...runs.values()];
    atomicWriteJsonSync(RUNS_FILE, arr);
    return true;
  } catch (e) {
    console.error(`[runs-store] 写入 ${RUNS_FILE} 失败：${e.message}`);
    return false;
  }
}

// 防抖落盘：状态高频变更时合并为一次写，降低 I/O 抖动。
// 通过 atomic-json 的串行写队列执行，避免并发写交错。
function scheduleFlush() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const arr = [...runs.values()];
    queueWriteJson(RUNS_FILE, arr).catch((e) =>
      console.error(`[runs-store] 写入 ${RUNS_FILE} 失败：${e.message}`));
  }, 50);
  if (saveTimer.unref) saveTimer.unref();
}

// 获取共享的 run 索引（首次访问自动从磁盘加载）
export function getRuns() {
  load();
  return runs;
}

// 列出全部 run（按创建时间倒序），供前端"报告"页加载历史研究。
export function listRuns() {
  load();
  return [...runs.values()].sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return tb - ta;
  });
}

// 在状态变更后调用：立即落盘一次（防抖），保证重启可恢复。
// 对频繁状态流转（QUEUED->RUNNING->PENDING_REVIEW）合并为一次写。
export function persistRuns() {
  scheduleFlush();
}
