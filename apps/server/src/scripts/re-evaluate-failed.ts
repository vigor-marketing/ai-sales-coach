/**
 * 重新评估指定ID的报告，跳过无效结果
 */
import { prisma } from '../utils/prisma.js';
import { generateEvaluation } from '../services/ai/chatService.js';

function formatRecs(recs: unknown): string {
  if (typeof recs === 'string') return recs;
  if (Array.isArray(recs)) {
    return recs.map((r: any, i: number) => {
      const content = r.advice || r.建议内容 || r.recommendation || r.content || String(r);
      return `${i + 1}. ${content}`;
    }).join('\n\n');
  }
  return String(recs || '');
}

async function main() {
  // 需要重跑的报告（JSON解析失败的）
  const ids = [
    '29f631ec-82fb-4eb8-87d9-dd41ba069208',
    '7244e05d-8307-42d3-8e94-02f4e768b5c2',
    'd1e494f1-f9b1-4b0f-8a85-6ee84d9fc38c',
    'ade60f15-0edb-4888-98bc-6c06a85a56cf',
  ];

  console.log(`需要重跑 ${ids.length} 份报告\n`);

  let success = 0;
  let skip = 0;
  let failed = 0;

  for (let i = 0; i < ids.length; i++) {
    const report = await prisma.report.findUnique({ where: { id: ids[i] }, include: { session: true } });
    if (!report) { console.log(`[${i+1}] 报告 ${ids[i].slice(0,8)} 不存在`); continue; }
    
    const msgCount = await prisma.message.count({ where: { sessionId: report.sessionId } });
    console.log(`[${i+1}/${ids.length}] 报告 ${ids[i].slice(0,8)}... | 消息数: ${msgCount}`);
    console.log(`  当前: 分数=${report.overallScore}`);

    if (msgCount < 2) { console.log('  ⏭️ 跳过（消息太少）\n'); continue; }

    try {
      console.log('  🤖 调用 AI...');
      const evaluation = await generateEvaluation(report.sessionId);

      // 检查评估结果是否有效
      const dims = evaluation.dimensions || [];
      if (evaluation.overallScore <= 0 && dims.length === 0) {
        console.log('  ⚠️ 评估结果无效（分数=0，维度=0），跳过更新');
        skip++;
        continue;
      }

      await prisma.report.update({
        where: { id: report.id },
        data: {
          overallScore: evaluation.overallScore,
          radarData: JSON.stringify(dims),
          strengths: evaluation.strengths,
          weaknesses: evaluation.weaknesses,
          recommendations: formatRecs(evaluation.recommendations),
          orderAwarded: evaluation.orderDecision.awarded,
          orderReason: evaluation.orderDecision.reason,
          orderType: evaluation.orderDecision.type,
        },
      });

      console.log(`  ✅ 更新: 分数=${evaluation.overallScore} | 类型=${evaluation.orderDecision.type}`);
      success++;
    } catch (e: any) {
      console.error(`  ❌ 失败: ${e.message}`);
      failed++;
    }

    await new Promise(r => setTimeout(r, 2000));
    console.log('');
  }

  console.log(`成功: ${success} | 跳过: ${skip} | 失败: ${failed}`);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
