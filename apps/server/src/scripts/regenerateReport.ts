import { prisma } from '../utils/prisma.js';

const SESSION_ID = '5fff7688-3dbe-4418-928d-44c3c74d3756';

async function regenerateReport() {
  // Delete old report
  await prisma.report.deleteMany({ where: { sessionId: SESSION_ID } });
  await prisma.evaluation.deleteMany({ where: { sessionId: SESSION_ID } });
  console.log('已清除旧评估数据');

  // Regenerate
  const { generateEvaluation } = await import('../services/ai/chatService.js');
  const evaluation = await generateEvaluation(SESSION_ID);

  console.log(`\n总体评分: ${evaluation.overallScore}/100`);
  console.log(`\n维度评分:`);
  for (const dim of evaluation.dimensions) {
    console.log(`  ${dim.dimension}: ${dim.score}/100`);
    console.log(`    反馈: ${dim.feedback.slice(0, 120)}`);
  }

  const session = await prisma.trainingSession.findUnique({
    where: { id: SESSION_ID },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  });

  await prisma.report.create({
    data: {
      sessionId: SESSION_ID,
      userId: session!.userId,
      overallScore: evaluation.overallScore,
      radarData: JSON.stringify(evaluation.dimensions),
      strengths: evaluation.strengths,
      weaknesses: evaluation.weaknesses,
      recommendations: evaluation.recommendations,
      transcript: session!.messages.map(m => `${m.role === 'USER' ? '[销售代表]' : '[客户]'}: ${m.content}`).join('\n\n'),
    },
  });

  console.log(`\n✅ 报告已保存！`);

  // Generate HTML for PDF export
  const dims = evaluation.dimensions.map(d => ({
    label: d.dimension,
    score: d.score,
    feedback: d.feedback,
  }));

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><title>销售陪练评估报告</title>
<style>
  body { font-family: -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #1e293b; }
  h1 { font-size: 24px; margin-bottom: 4px; }
  .subtitle { color: #64748b; font-size: 14px; margin-bottom: 30px; }
  .score-box { background: linear-gradient(135deg, #3b82f6, #6366f1); color: white; border-radius: 16px; padding: 30px; text-align: center; margin-bottom: 30px; }
  .score-box .score { font-size: 56px; font-weight: bold; }
  .score-box .label { font-size: 14px; opacity: 0.8; margin-top: 4px; }
  .dimension { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 12px; }
  .dim-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
  .dim-name { font-weight: 600; font-size: 15px; }
  .dim-score { font-weight: 700; font-size: 18px; }
  .bar-bg { background: #e2e8f0; border-radius: 99px; height: 8px; overflow: hidden; }
  .bar-fill { height: 8px; border-radius: 99px; transition: width 0.5s; }
  .feedback { color: #475569; font-size: 13px; margin-top: 8px; line-height: 1.5; }
  .section { margin-top: 28px; }
  .section h2 { font-size: 16px; margin-bottom: 12px; border-left: 3px solid #3b82f6; padding-left: 10px; }
  .rec-item { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; margin-bottom: 10px; font-size: 13px; line-height: 1.6; }
  .transcript { background: #f1f5f9; border-radius: 10px; padding: 16px; font-size: 12px; line-height: 1.8; white-space: pre-wrap; }
  .msg-user { color: #1e40af; }
  .msg-ai { color: #166534; }
  .tag { display: inline-block; background: #e0e7ff; color: #4338ca; padding: 2px 8px; border-radius: 99px; font-size: 11px; margin-right: 4px; }
</style></head>
<body>
  <h1>AI销售陪练评估报告</h1>
  <p class="subtitle">客户角色: Tarek Al-Mansour · 场景: 展会初次接触</p>

  <div class="score-box">
    <div class="score">${evaluation.overallScore}</div>
    <div class="label">总体评分</div>
  </div>

  <div class="section">
    <h2>维度评分</h2>
    ${dims.map(d => `
    <div class="dimension">
      <div class="dim-header">
        <span class="dim-name">${d.label}</span>
        <span class="dim-score" style="color:${d.score >= 80 ? '#16a34a' : d.score >= 60 ? '#d97706' : '#dc2626'}">${d.score}</span>
      </div>
      <div class="bar-bg"><div class="bar-fill" style="width:${d.score}%;background:${d.score >= 80 ? '#16a34a' : d.score >= 60 ? '#d97706' : '#dc2626'}"></div></div>
      <div class="feedback">${d.feedback}</div>
    </div>`).join('')}
  </div>

  <div class="section">
    <h2>优点</h2>
    <p style="font-size:13px;line-height:1.6;color:#475569">${evaluation.strengths}</p>
  </div>

  <div class="section">
    <h2>不足</h2>
    <p style="font-size:13px;line-height:1.6;color:#475569">${evaluation.weaknesses}</p>
  </div>

  <div class="section">
    <h2>改进建议</h2>
    ${evaluation.recommendations.split('\n').filter(Boolean).map(r => `<div class="rec-item">${r}</div>`).join('')}
  </div>

  <div class="section">
    <h2>对话记录</h2>
    <div class="transcript">
      ${session!.messages.map(m => `<span class="${m.role === 'USER' ? 'msg-user' : 'msg-ai'}">${m.role === 'USER' ? '[销售]' : '[客户]'}: ${m.content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>\n\n`).join('')}
    </div>
  </div>
</body></html>`;

  const fs = await import('fs/promises');
  await fs.writeFile('/tmp/report.html', html);
  console.log(`\n✅ HTML报告已生成: /tmp/report.html`);
  console.log(`在浏览器中打开并打印为PDF即可导出。`);

  await prisma.$disconnect();
}

regenerateReport().catch(console.error);
