import crypto from 'crypto';

export type AuditAction =
  | 'coaching.session.completed'
  | 'coaching.session.viewed'
  | 'coaching.summary.viewed'
  | 'ai.invoked'
  | 'file.uploaded'
  | 'file.downloaded'
  | 'coaching.deleted';

export interface AuditEntry {
  action: AuditAction;
  traceId: string;
  actorId?: string;
  objectId?: string;
  purpose?: string;
  result: 'success' | 'failure';
  metadata?: Record<string, unknown>;
}

export function createTraceId(): string {
  return crypto.randomUUID();
}

export function writeAuditLog(entry: AuditEntry): void {
  const safeEntry = {
    type: 'audit',
    time: new Date().toISOString(),
    ...entry,
  };
  console.info(JSON.stringify(safeEntry));
}

export async function publishCoachingCompletedEvent(payload: {
  traceId: string;
  sessionId: string;
  userId: string;
  teamId?: string | null;
  score: number;
  completedAt: Date;
}): Promise<void> {
  const event = {
    event: 'coaching.session.completed.v1',
    trace_id: payload.traceId,
    session_id: payload.sessionId,
    user_id: payload.userId,
    team_id: payload.teamId || null,
    score: payload.score,
    completed_at: payload.completedAt.toISOString(),
  };

  writeAuditLog({
    action: 'coaching.session.completed',
    traceId: payload.traceId,
    actorId: payload.userId,
    objectId: payload.sessionId,
    purpose: 'workbench-event',
    result: 'success',
    metadata: { event: event.event, score: event.score },
  });

  const webhookUrl = process.env.WORKBENCH_EVENT_WEBHOOK_URL?.trim();
  if (!webhookUrl) return;

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Trace-Id': payload.traceId,
      },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`Webhook status ${response.status}`);
  } catch (error) {
    writeAuditLog({
      action: 'coaching.session.completed',
      traceId: payload.traceId,
      actorId: payload.userId,
      objectId: payload.sessionId,
      purpose: 'workbench-event-delivery',
      result: 'failure',
      metadata: { reason: error instanceof Error ? error.message : 'unknown' },
    });
  }
}
