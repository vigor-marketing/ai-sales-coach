import { randomUUID } from 'crypto';
import { prisma } from '../utils/prisma.js';

const APP_ID = 'ai-sales-coach';
const EVENT_TYPE = 'ai.training_completed.v1';

type TrainingCompletedInput = {
  sessionId: string;
  reportId: string;
  overallScore: number;
};

export async function publishTrainingCompleted(input: TrainingCompletedInput) {
  const eventKey = `training-completed:${input.sessionId}:${input.reportId}`;
  return prisma.platformEvent.upsert({
    where: { eventKey },
    update: {},
    create: {
      eventKey,
      eventType: EVENT_TYPE,
      entityType: 'training_session',
      entityId: `trn_${input.sessionId}`,
      // 事件不包含模拟客户姓名、真实客户 ID、对话或报告正文。
      payload: JSON.stringify({
        trainingSessionId: `trn_${input.sessionId}`,
        reportId: input.reportId,
        overallScore: input.overallScore,
        dataClassification: 'TRAINING_ONLY_SIMULATED',
      }),
      traceId: `req_${randomUUID().replace(/-/g, '')}`,
    },
  });
}

export function toPlatformEvent(event: {
  id: string;
  eventType: string;
  entityType: string;
  entityId: string;
  payload: string;
  traceId: string;
  createdAt: Date;
}) {
  return {
    eventId: `evt_${event.id}`,
    eventType: event.eventType,
    occurredAt: event.createdAt.toISOString(),
    sourceApp: APP_ID,
    actorId: 'usr_system',
    entity: { entityType: event.entityType, entityId: event.entityId },
    payload: JSON.parse(event.payload),
    traceId: event.traceId,
  };
}
