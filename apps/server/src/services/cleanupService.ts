/**
 * Clean up stale ACTIVE training sessions (older than 24 hours)
 * Call this from the stats endpoint to keep things tidy
 */
export async function cleanupStaleSessions(): Promise<number> {
  const { prisma } = await import('../utils/prisma.js');
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

  const staleSessions = await prisma.trainingSession.findMany({
    where: { status: 'ACTIVE', startedAt: { lt: cutoff } },
    select: { id: true },
  });

  if (staleSessions.length === 0) return 0;

  const ids = staleSessions.map(s => s.id);
  await prisma.evaluation.deleteMany({ where: { sessionId: { in: ids } } });
  await prisma.message.deleteMany({ where: { sessionId: { in: ids } } });
  await prisma.report.deleteMany({ where: { sessionId: { in: ids } } });
  await prisma.trainingSession.updateMany({
    where: { id: { in: ids } },
    data: { status: 'COMPLETED', endedAt: new Date() },
  });

  return staleSessions.length;
}
