import { prisma } from '../utils/prisma.js';
import { writeFile } from 'fs/promises';

const SESSION_ID = '5fff7688-3dbe-4418-928d-44c3c74d3756';

// Reconstruct evaluation data from the raw AI response we already got
const EVAL_DATA = {
  overallScore: 62,
  dimensions: [
    { dimension: '话术规范性', score: 55, feedback: '开场时主动自我介绍并说明公司业务，符合展会初次接触的基本礼仪。但在客户表达不满后及时道歉并调整语气是亮点。扣分原因：直接负面评价竞争对手（"Your other suppliers are probably overcharging you"），违反专业话术规范；在客户明确表示不用每天都打电话后，仍追问跟进时间，显得不够尊重客户节奏。' },
    { dimension: '业务知识', score: 65, feedback: '能熟练介绍HT-grade OCTG产品，正确提及450°F额定温度、API 5CT认证等行业术语。但在客户提及300°F实际需求时，未主动调整产品推荐策略，缺乏灵活应变的业务能力。对中东地区常见的技术标准有一定了解。' },
    { dimension: '沟通技巧', score: 50, feedback: '沟通主动性较好，能在被客户拒绝后继续推进。但最大问题是出现情绪化表达——攻击竞争对手是B2B销售的大忌。此外，未有效识别客户的"懒惰"特点（客户多次表示不想处理细节），应该提供更精简的信息减轻客户负担，而不是长篇大论。' },
    { dimension: '需求挖掘', score: 60, feedback: '成功挖掘到客户采购OCTG、温度要求300°F、项目规模不大等基本信息。但未能深入挖掘客户的更深层需求——比如为什么选择这个时间点采购、是否有预算限制、客户的长期需求规划等。被客户"5家供应商在竞争"的信息带跑，没有深入研究客户的选择标准。' },
    { dimension: '异议处理', score: 55, feedback: '对于客户"我很忙"的异议，处理方式较简单（仍继续推销）。对于客户拒绝提供技术细节，通过引入第三方（Sergei工程师）的方式有所补救。但对客户的价格敏感问题，未提出有说服力的价值主张，仅简单表示"We can offer competitive pricing"。' },
    { dimension: '流程覆盖', score: 70, feedback: '覆盖了从初次接触到建立联系、了解需求、技术交流、发送报价到约定后续跟进的完整销售流程。尤其在引入第三方角色、时间推进方面表现出对销售节奏的把握。但在客户准备结束对话时，未能主动总结下一步行动并获得客户明确承诺。' },
  ],
  strengths: '1. 开场规范：销售代表能明确自我介绍并说明公司业务，符合初次接触的基本礼仪要求。\n2. 灵活应对：在面对客户"I\'m busy"的拒绝时没有放弃，而是继续引导对话，体现了销售韧性。\n3. 引入资源：当遇到技术问题超出自己能力范围时，主动引入工程师Sergei来回应客户的技术要求，展示了团队协作意识。\n4. 知错能改：在客户对攻击竞争对手的言论表示不满后，能立即道歉并重新聚焦于专业讨论。\n5. 流程覆盖：从开场、需求了解、技术交流、引荐决策人、发送报价到结束，整体销售流程清晰。',
  weaknesses: '1. 情绪控制不足：在对话中负面评价竞争对手（"Your other suppliers are probably overcharging you"），这是B2B销售的大忌，不仅显得不专业，还可能引发客户反感和不信任。\n2. 需求挖掘深度不够：虽然获取了基本需求信息，但未能深入了解客户的决策标准、预算范围、采购优先级、长期规划等关键信息。\n3. 客户类型识别不足：没有识别出Tarek是"懒惰型"非决策人，仍用标准化流程推进，导致客户多次表现出不耐烦。\n4. 跟进节奏不当：在客户明确说"Don\'t call me every day asking for updates"后，仍然追问跟进时间。',
  recommendations: `1. 在回应价格咨询时，不要直接说"We can offer competitive pricing"，而应该具体说明价格优势的来源："Our pricing is competitive because we have a direct factory in Asia with no middleman. For example, our HT-grade OCTG is typically 15-20% below market average for equivalent quality. Would you like me to prepare a detailed comparison?"\n\n2. 当客户说"I'm too busy"时，不要继续追问，而要主动降低客户负担："I understand you're busy. Let me send you a one-page summary instead of the full catalog. If anything catches your interest, we can schedule a 10-minute call at your convenience."\n\n3. 面对"懒惰型"非决策人（如Tarek），应该主动提供"向上汇报工具包"——包括准备好的摘要、对比表、推荐语等，帮助客户轻松向经理汇报："I've prepared a one-page summary you can forward directly to Mr. Khalid. It covers our key differentiators and a price comparison in a format he can review in 2 minutes."\n\n4. 不要直接攻击竞争对手，而是客观对比："I respect that you're evaluating multiple options. Instead of comparing others, let me highlight three specific areas where we deliver measurable value: delivery reliability, HT performance in Middle East conditions, and local technical support response time within 24 hours."\n\n5. 在客户主动表示对话可以结束时（"I think we are done here"），应该给予积极反馈并总结下一步："Thank you for your time today, Tarek. Let me summarize: I'll send the formal quotation to you by tomorrow, and I'll follow up with Mr. Khalid if you think that's appropriate. Does that work for you?"`,
};

async function generatePDFReport() {
  const session = await prisma.trainingSession.findUnique({
    where: { id: SESSION_ID },
    include: { role: true, scenario: true, messages: { orderBy: { createdAt: 'asc' } } },
  });
  if (!session) { console.error('Session not found'); process.exit(1); }

  const dims = EVAL_DATA.dimensions;
  const scoreColor = (s: number) => s >= 80 ? '#16a34a' : s >= 60 ? '#d97706' : '#dc2626';
  const scoreBg = (s: number) => s >= 80 ? '#dcfce7' : s >= 60 ? '#fef3c7' : '#fee2e2';
  const scoreLabel = (s: number) => s >= 80 ? '优秀' : s >= 60 ? '良好' : '需提升';

  const messageHtml = session.messages.map((m, i) => {
    const isUser = m.role === 'USER';
    const roleLabel = isUser ? '销售代表' : '客户';
    const color = isUser ? '#1e40af' : '#166534';
    const bg = isUser ? '#eff6ff' : '#f0fdf4';
    const border = isUser ? '#bfdbfe' : '#bbf7d0';
    const name = isUser ? '销售代表 Mike' : session.role.name;

    // Format special tags
    let content = m.content
      .replace(/\[时间推进: (.*?)\]/g, '<span style="display:inline-block;background:#fef3c7;border:1px solid #fde68a;border-radius:6px;padding:2px 8px;font-size:12px;color:#92400e">⏱ $1</span>')
      .replace(/\[虚拟文件: (.*?)\]/g, '<span style="display:inline-block;background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:2px 8px;font-size:12px;color:#1e40af">📄 $1</span>')
      .replace(/\[引入角色: (.*?)\]/g, '<span style="display:inline-block;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:2px 8px;font-size:12px;color:#166534">👤 引入: $1</span>');

    return `<div style="display:flex;margin-bottom:16px;${isUser ? '' : 'flex-direction:row-reverse'}">
      <div style="flex:1;max-width:80%;background:${bg};border:1px solid ${border};border-radius:12px;padding:12px 16px;">
        <div style="font-size:12px;font-weight:600;color:${color};margin-bottom:4px;">${name}</div>
        <div style="font-size:13px;line-height:1.6;color:#334155;">${content}</div>
      </div>
    </div>`;
  }).join('\n');

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><title>AI销售陪练评估报告 - Tarek Al-Mansour</title>
<style>
  @page { margin: 20mm; }
  body { font-family: -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif; max-width: 800px; margin: 0 auto; padding: 0; color: #1e293b; }
  .header { text-align: center; padding: 32px 0 24px; border-bottom: 2px solid #e2e8f0; margin-bottom: 28px; }
  .header h1 { font-size: 22px; margin: 0 0 6px; }
  .header .meta { color: #64748b; font-size: 13px; }
  .score-hero { background: linear-gradient(135deg, #3b82f6, #6366f1); color: white; border-radius: 16px; padding: 32px; text-align: center; margin-bottom: 28px; }
  .score-hero .num { font-size: 64px; font-weight: 800; line-height: 1; }
  .score-hero .lbl { font-size: 14px; opacity: 0.85; margin-top: 6px; }
  .score-hero .sub { font-size: 12px; opacity: 0.6; margin-top: 4px; }
  h2 { font-size: 16px; margin: 24px 0 14px; display: flex; align-items: center; gap: 8px; }
  h2::before { content: ''; display: inline-block; width: 3px; height: 16px; background: #3b82f6; border-radius: 2px; }
  .dim-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 10px; }
  .dim-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
  .dim-name { font-weight: 600; font-size: 14px; }
  .dim-score { font-weight: 700; font-size: 16px; padding: 2px 10px; border-radius: 99px; }
  .dim-bar { background: #e2e8f0; border-radius: 99px; height: 6px; overflow: hidden; }
  .dim-fill { height: 6px; border-radius: 99px; }
  .dim-fb { color: #475569; font-size: 12.5px; line-height: 1.6; margin-top: 10px; }
  .section { margin-top: 24px; }
  .strength-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 14px; font-size: 12.5px; line-height: 1.7; color: #166534; }
  .weakness-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 14px; font-size: 12.5px; line-height: 1.7; color: #991b1b; }
  .rec-item { background: #f8fafc; border: 1px solid #e2e8f0; border-left: 3px solid #3b82f6; border-radius: 8px; padding: 12px 14px; margin-bottom: 8px; font-size: 12.5px; line-height: 1.6; color: #1e293b; }
  .conv { background: #fafafa; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; }
  .tag { display: inline; }
</style></head>
<body>
  <div class="header">
    <h1>AI销售陪练评估报告</h1>
    <div class="meta">${session.role.name} · ${session.role.position} · ${session.role.region}</div>
    <div class="meta" style="margin-top:2px;">${session.scenario?.title || '通用场景'} · ${new Date().toLocaleDateString('zh-CN')}</div>
  </div>

  <div class="score-hero">
    <div class="num">${EVAL_DATA.overallScore}</div>
    <div class="lbl">总体评分</div>
    <div class="sub">满分100分 · ${EVAL_DATA.overallScore >= 80 ? '表现优秀' : EVAL_DATA.overallScore >= 60 ? '基本合格，有提升空间' : '需要重点改进'}</div>
  </div>

  <h2>维度评分</h2>
  ${dims.map(d => {
    const sc = scoreColor(d.score);
    const sb = scoreBg(d.score);
    return `<div class="dim-card">
      <div class="dim-top">
        <span class="dim-name">${d.dimension}</span>
        <span class="dim-score" style="color:${sc};background:${sb}">${d.score} ${scoreLabel(d.score)}</span>
      </div>
      <div class="dim-bar"><div class="dim-fill" style="width:${d.score}%;background:${sc}"></div></div>
      <div class="dim-fb">${d.feedback}</div>
    </div>`;
  }).join('\n')}

  <div class="section">
    <h2>优点</h2>
    <div class="strength-box">${EVAL_DATA.strengths}</div>
  </div>

  <div class="section">
    <h2>不足</h2>
    <div class="weakness-box">${EVAL_DATA.weaknesses}</div>
  </div>

  <div class="section">
    <h2>改进建议</h2>
    ${EVAL_DATA.recommendations.split('\n').filter(Boolean).map(r => `<div class="rec-item">${r}</div>`).join('')}
  </div>

  <div class="section">
    <h2>完整对话记录</h2>
    <div class="conv">${messageHtml}</div>
  </div>

  <div style="text-align:center;margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;">
    AI销售陪练系统 · 自动生成 · ${new Date().toLocaleString('zh-CN')}
  </div>
</body></html>`;

  const outputPath = '/tmp/report-Tarek-Al-Mansour.html';
  await writeFile(outputPath, html);
  console.log(`✅ 报告已生成: ${outputPath}`);
  console.log(`\n请在浏览器中打开此文件，然后按 Ctrl+P / Cmd+P 打印为PDF：`);
  console.log(`\n  file://${outputPath.replace(/\\/g, '/').replace('/tmp/', 'C:/Users/Monk Chen/WorkBuddy/2026-07-03-15-41-15/tmp/')}`);
  
  // Also copy to project dir
  const projectPath = 'C:/Users/Monk Chen/WorkBuddy/2026-07-03-15-41-15/report-Tarek-Al-Mansour.html';
  await writeFile(projectPath, html);
  console.log(`\n✅ 已复制到项目目录: ${projectPath}`);

  await prisma.$disconnect();
}

generatePDFReport().catch(console.error);
