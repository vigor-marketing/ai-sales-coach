/**
 * 重新评估所有现有报告（按最新标准）
 * 运行：node dist/scripts/re-evaluate-all.js
 */
import { prisma } from '../utils/prisma.js';
import { generateEvaluation } from '../services/ai/chatService.js';

// recommendations 可能是数组（AI返回的JSON格式），需要转为字符串
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
  console.log('========== 开始批量重新评估 ==========');
  
  // 获取所有报告（含关联的会话和消息）
  const reports = await prisma.report.findMany({
    include: {
      session: {
        include: {
          role: true,
          scenario: true,
          messages: { orderBy: { createdAt: 'asc' } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`共找到 ${reports.length} 份报告\n`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < reports.length; i++) {
    const report = reports[i];
    const session = report.session;
    const msgCount = session.messages.length;

    console.log(`[${i + 1}/${reports.length}] 报告 ${report.id.slice(0, 8)}...`);
    console.log(`  会话: ${session.id.slice(0, 8)}... | 消息数: ${msgCount}`);
    console.log(`  当前: 分数=${report.overallScore} | 下单=${report.orderAwarded} | 类型=${report.orderType}`);

    // 跳过没有消息的会话
    if (msgCount < 2) {
      console.log('  ⏭️ 跳过（消息太少）');
      continue;
    }

    try {
      // 调用 AI 重新评估
      console.log('  🤖 正在调用 AI 重新评估...');
      const evaluation = await generateEvaluation(session.id);

      // 更新报告
      await prisma.report.update({
        where: { id: report.id },
        data: {
          overallScore: evaluation.overallScore,
          radarData: JSON.stringify(evaluation.dimensions),
          strengths: evaluation.strengths,
          weaknesses: evaluation.weaknesses,
          recommendations: formatRecs(evaluation.recommendations),
          orderAwarded: evaluation.orderDecision.awarded,
          orderReason: evaluation.orderDecision.reason,
          orderType: evaluation.orderDecision.type,
        },
      });

      console.log(`  ✅ 更新完成: 分数=${evaluation.overallScore} | 下单=${evaluation.orderDecision.awarded} | 类型=${evaluation.orderDecision.type}`);
      console.log(`  原因: ${evaluation.orderDecision.reason.slice(0, 100)}...`);
      success++;
    } catch (e: any) {
      console.error(`  ❌ 评估失败: ${e.message}`);
      // 即使评估也保留原来的数据
      failed++;
    }

    // 每份报告之间间隔 2 秒，避免 API 限流
    if (i < reports.length - 1) {
      await new Promise(r => setTimeout(r, 2000));
    }
    console.log('');
  }

  console.log('========== 批量评估完成 ==========');
  console.log(`成功: ${success} | 失败: ${failed}`);
  
  await prisma.$disconnect();
}

main().catch(e => {
  console.error('脚本异常:', e);
  process.exit(1);
});
