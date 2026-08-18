// @ts-nocheck -- 移植自 customer-research-backend 的零依赖纯 JS 模块（v1 保留原样，后续逐步补全类型）
// 原子 JSON 落盘 + 串行写队列（runs-store / exports-store / enterprise-database 共用）
// 设计：
//  - 原子写：先写临时文件（同目录 .<name>.tmp-<pid>），再 rename 替换目标文件。
//    rename 在同一文件系统内是原子操作，进程崩溃/断电时不会留下半截 JSON。
//  - 写队列：模块级 promise 链，所有落盘串行执行，避免并发写交错导致文件损坏。
//  - 目录自动创建（mkdirSync recursive）。
import { writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

// 串行写队列：链式 promise，保证同一进程内落盘按序执行
let writeChain = Promise.resolve();

function enqueue(task) {
  const run = writeChain.then(task, task);
  // 队列自身吞掉错误，避免后续任务因前一个失败而不执行
  writeChain = run.catch(() => {});
  return run;
}

// 原子写入 JSON 文件：tmp + rename
export function atomicWriteJsonSync(filePath, data) {
  const dir = dirname(filePath);
  mkdirSync(dir, { recursive: true });
  const tmp = join(dir, `.${filePath.split('/').pop()}.tmp-${process.pid}`);
  const payload = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  writeFileSync(tmp, payload, 'utf-8');
  renameSync(tmp, filePath);
}

// 原子写入（同步）+ 排队（异步返回 Promise，便于 await 全部落盘）
export function queueWriteJson(filePath, data) {
  return enqueue(() => {
    atomicWriteJsonSync(filePath, data);
  });
}

// 立即执行原子写（不等队列；供进程退出前 flush 使用）
export function flushWriteJson(filePath, data) {
  atomicWriteJsonSync(filePath, data);
}
