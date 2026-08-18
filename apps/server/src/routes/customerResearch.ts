// 客户背调路由组（并入 ai-sales-coach 单体）
// 复用工作台的 authMiddleware（HS256 / JWT_SECRET）与 AuthRequest；不引入独立鉴权。
// 业务逻辑模块位于 ./customer-research/*（零依赖纯 JS，从 customer-research-backend 移植）。
// 数据层 v1：沿用本地 JSON 存储（runs-store / exports-store），DATA_DIR 指向服务可写目录。
import { Router, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { authMiddleware } from '../middleware/auth.js';
import type { AuthRequest } from '../middleware/auth.js';
import {
  validateResearchRequest,
  RESEARCH_STATUS,
} from '../customer-research/research-schema.js';
import { runResearchCrossValidated } from '../customer-research/research-orchestrator.js';
import { getRuns, persistRuns, listRuns } from '../customer-research/runs-store.js';
import { recordExport, listExports } from '../customer-research/exports-store.js';
import { buildReportCsvWithBom } from '../customer-research/report-export.js';
import { buildReportXlsx } from '../customer-research/xlsx-export.js';
import {
  getList,
  getStatus,
  refresh,
  setRequirements,
  markProspect,
} from '../customer-research/enterprise-database.js';

const router: Router = Router();
router.use(authMiddleware); // 复用工作台鉴权：req.user = { id, email, name, role }

const runs = getRuns();

// 创建研究请求（异步：后台跑 AI，立即返回 202 + runId）
router.post('/research-requests', async (req: AuthRequest, res: Response) => {
  const { valid, errors, value } = validateResearchRequest(req.body || {});
  if (!valid) return res.status(422).json({ error: 'validation_failed', details: errors });

  const runId = randomUUID();
  runs.set(runId, {
    id: runId,
    request: value,
    status: RESEARCH_STATUS.QUEUED,
    createdAt: new Date().toISOString(),
    createdBy: req.user!.id,
    result: null,
    error: null,
  });
  persistRuns();

  // 不阻塞响应：后台执行交叉验证研究，结束后落盘
  process.nextTick(async () => {
    const run = runs.get(runId);
    if (!run) return;
    run.status = RESEARCH_STATUS.RUNNING;
    persistRuns();
    try {
      run.result = await runResearchCrossValidated(value);
      run.status = RESEARCH_STATUS.PENDING_REVIEW; // AI 完成，待人工审核，不直接发布
    } catch (e: any) {
      run.status = RESEARCH_STATUS.FAILED;
      run.error = e?.message;
    }
    run.completedAt = new Date().toISOString();
    persistRuns();
  });

  return res.status(202).json({ runId, status: RESEARCH_STATUS.QUEUED });
});

// 轮询单个研究运行
router.get('/research-runs/:id', (req: AuthRequest, res: Response) => {
  const run = runs.get(req.params.id);
  if (!run) return res.status(404).json({ error: 'not_found' });
  return res.json(run);
});

// 审核通过并发布（PENDING_REVIEW → COMPLETED，落审计）
router.post('/research-runs/:id/approve', (req: AuthRequest, res: Response) => {
  const run = runs.get(req.params.id);
  if (!run) return res.status(404).json({ error: 'not_found' });
  if (run.status !== RESEARCH_STATUS.PENDING_REVIEW) {
    return res.status(409).json({ error: 'invalid_status', status: run.status, message: '仅「待审核」状态可被审核发布' });
  }
  const body = (req.body || {}) as any;
  const approver = (body.approver && String(body.approver).trim()) || req.user?.name || req.user?.id || 'sales-lead';
  run.status = RESEARCH_STATUS.COMPLETED;
  run.approvedBy = approver;
  run.approvedAt = new Date().toISOString();
  run.version = (run.version || 0) + 1;
  run.audit = Array.isArray(run.audit) ? run.audit : [];
  run.audit.push({ event: 'approved', by: approver, at: run.approvedAt, version: run.version });
  persistRuns();
  return res.json(run);
});

// 历史运行列表（倒序）
router.get('/research-runs', (_req: AuthRequest, res: Response) => {
  return res.json({ runs: listRuns() });
});

// 导出 CSV（审计 + 下载）
router.post('/exports/csv', (req: AuthRequest, res: Response) => {
  const runId = typeof req.body?.runId === 'string' ? req.body.runId.trim() : '';
  if (!runId) return res.status(400).json({ error: 'missing_runId' });
  const run = runs.get(runId);
  if (!run) return res.status(404).json({ error: 'not_found' });
  if (run.status !== RESEARCH_STATUS.PENDING_REVIEW && run.status !== RESEARCH_STATUS.COMPLETED) {
    return res.status(409).json({ error: 'not_ready', status: run.status });
  }
  const csv = buildReportCsvWithBom(run);
  const lines = csv.split(/\r\n/).length;
  recordExport({
    runId,
    company: run.result?.company ?? null,
    format: 'csv',
    rowCount: lines,
    byteSize: Buffer.byteLength(csv, 'utf-8'),
    createdBy: req.user!.id,
  });
  const safeName = (run.result?.company || 'report').replace(/[^a-z0-9]+/gi, '_').slice(0, 60);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="customer-research_${safeName}_${runId.slice(0, 8)}.csv"`);
  return res.send(csv);
});

// 导出 Excel（审计 + 下载）
router.post('/exports/xlsx', (req: AuthRequest, res: Response) => {
  const runId = typeof req.body?.runId === 'string' ? req.body.runId.trim() : '';
  if (!runId) return res.status(400).json({ error: 'missing_runId' });
  const run = runs.get(runId);
  if (!run) return res.status(404).json({ error: 'not_found' });
  if (run.status !== RESEARCH_STATUS.PENDING_REVIEW && run.status !== RESEARCH_STATUS.COMPLETED) {
    return res.status(409).json({ error: 'not_ready', status: run.status });
  }
  const buf = buildReportXlsx(run);
  const sheetCount = run.result?.report ? 6 : 1;
  recordExport({
    runId,
    company: run.result?.company ?? null,
    format: 'xlsx',
    rowCount: (run.result?.facts || []).length,
    byteSize: buf.length,
    note: `sheets=${sheetCount}`,
    createdBy: req.user!.id,
  });
  const safeName = (run.result?.company || 'report').replace(/[^a-z0-9]+/gi, '_').slice(0, 60);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="customer-research_${safeName}_${runId.slice(0, 8)}.xlsx"`);
  return res.send(buf);
});

// 导出审计列表
router.get('/exports', (_req: AuthRequest, res: Response) => {
  return res.json({ exports: listExports() });
});

// 前端 PDF 打印前记录审计（字节=0, status='printed'）
router.post('/exports/record', (req: AuthRequest, res: Response) => {
  const runId = typeof req.body?.runId === 'string' ? req.body.runId.trim() : '';
  if (!runId) return res.status(400).json({ error: 'missing_runId' });
  const run = runs.get(runId);
  if (!run) return res.status(404).json({ error: 'not_found' });
  recordExport({
    runId,
    company: run.result?.company ?? null,
    format: 'pdf',
    rowCount: 0,
    byteSize: 0,
    status: 'printed',
    note: req.body?.note || 'browser-print',
    createdBy: req.user!.id,
  });
  return res.json({ ok: true });
});

// 企业数据库：列表 / 状态 / 刷新 / 配置 / 加入开发名单
router.get('/database', (_req: AuthRequest, res: Response) => {
  return res.json({ profiles: getList(), status: getStatus() });
});

router.get('/database/status', (_req: AuthRequest, res: Response) => res.json(getStatus()));

router.post('/database/refresh', async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'forbidden', detail: '仅管理员可执行数据库刷新' });
  try {
    const status = await refresh();
    return res.json({ ok: true, status });
  } catch (e: any) {
    return res.status(500).json({ error: String(e?.message) });
  }
});

router.post('/database/config', async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'forbidden', detail: '仅管理员可修改数据库目标配置' });
  try {
    const status = await setRequirements(req.body || {});
    return res.json({ ok: true, status });
  } catch (e: any) {
    return res.status(400).json({ error: String(e?.message) });
  }
});

router.post('/database/:id/prospect', (req: AuthRequest, res: Response) => {
  const updated = markProspect(req.params.id, req.body?.added !== false);
  if (!updated) return res.status(404).json({ error: 'not_found' });
  return res.json({ ok: true, profile: updated });
});

export default router;
