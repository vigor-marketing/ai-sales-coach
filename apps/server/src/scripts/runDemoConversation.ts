import { prisma } from '../utils/prisma.js';

const messagesData = [
  ['USER', `Hello Tarek, this is Mike from ABC Drilling Tools. We specialize in downhole equipment for oil & gas. Would you have a moment to discuss your needs?`],
  ['ASSISTANT', `Yeah, I got your email. Look, I'm pretty busy today. Just send me your product catalog and I'll take a look when I have time. I can't make any decisions anyway — I just collect information for our purchasing manager Mr. Khalid.

[虚拟文件: Supplier_Info_Request.pdf - Standard information request form]`],
  ['USER', `Sure, I can send that over. But before I do, could you tell me a bit about what you are currently sourcing? We might have exactly what you need.`],
  ['ASSISTANT', `Fine. We are looking for some OCTG for a small gas project. Nothing huge. But honestly, we have 5 suppliers already chasing this. If you want to be considered, your price needs to be competitive. I am not going to push for a premium product when the boss just wants the cheapest option that passes inspection.`],
  ['USER', `I understand. We can offer competitive pricing. Can you tell me more about the technical requirements? What specifications do you need?`],
  ['ASSISTANT', `Look, I do not really know the technical details. That's not my job. Let me bring in our field engineer — he handles that stuff.

[引入角色: Sergei - Field Engineer] Sergei, can you take this? The supplier wants to know specs. I've got other emails to deal with.`],
  ['USER', `Hello Sergei, nice to meet you. We supply HT-grade OCTG rated up to 450°F. What temperatures are you dealing with in your gas project?`],
  ['ASSISTANT', `[引入角色: Sergei - Field Engineer speaking now]
We are looking at about 300°F for this well, nothing extreme. But I need to see your API 5CT certification and a reference list from similar projects in the region. We had issues before with suppliers who claimed high-temperature rating but could not deliver.

[虚拟文件: Technical_Spec_Request.pdf - Please provide API 5CT certs and references]`],
  ['USER', `I have all those documents ready. Let me send them over. Our HT series has been used successfully in similar conditions across the Middle East.`],
  ['ASSISTANT', `[时间推进: 3天后 - Tarek reviewed the documents but has not forwarded them to Khalid yet]

Hey, yeah I got your documents. Have not had a chance to look at them properly. Been busy with other stuff. I will try to get to it by end of week. No promises though.`],
  ['USER', `Come on, this is a great deal. Your other suppliers are probably overcharging you. We can beat any price they give you — just give us a chance here.`],
  ['ASSISTANT', `Whoa, hold on. I do not appreciate you bad-mouthing other suppliers without knowing their offers. That is not professional. If you want to do business, keep it professional. Otherwise I am hanging up here.`],
  ['USER', `You are right, I apologize. Let me refocus. I will send a formal quotation with our best pricing and the technical documentation you requested. When would be a good time to follow up with you and Mr. Khalid?`],
  ['ASSISTANT', `OK. Send the quotation to me, I will pass it to Khalid when I get to it. He makes all the purchasing decisions anyway. I am just the middleman here.

[虚拟文件: Quotation_OCTG_HT_2026.pdf - Preliminary pricing for HT-grade OCTG]

Do not expect an answer fast though. We move slow here.`],
  ['USER', `Understood. I will send everything today. When do you think I should follow up?`],
  ['ASSISTANT', `Send it over. I think we are done here — you know what we need, I have got your info. I will let you know if Khalid has questions. Do not call me every day asking for updates. I will reach out when there is news.

[时间推进: 2周后 - Tarek finally forwarded the quotation to Mr. Khalid for review]

Look, I passed your quote to Khalid. He said it is in the pile with the others. We will let you know if we are interested. That is all I have got for now.`],
];

async function runDemoConversation() {
  const tarek = await prisma.aiRole.findFirst({ where: { name: 'Tarek Al-Mansour' } });
  const scenario = await prisma.scenario.findFirst({ where: { difficulty: 'EASY' } });
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!tarek || !scenario || !admin) { console.error('Missing data'); process.exit(1); }

  console.log(`使用角色: ${tarek.name} | 场景: ${scenario.title} | 用户: ${admin.email}\n`);

  const session = await prisma.trainingSession.create({
    data: { userId: admin.id, roleId: tarek.id, scenarioId: scenario.id, status: 'COMPLETED', endedAt: new Date() },
  });
  console.log(`会话已创建: ${session.id}\n`);

  for (let i = 0; i < messagesData.length; i++) {
    const [role, content] = messagesData[i];
    await prisma.message.create({
      data: {
        sessionId: session.id,
        role: role as 'USER' | 'ASSISTANT',
        content: content as string,
        createdAt: new Date(Date.now() - (messagesData.length - i) * 60000),
      },
    });
    const prefix = role === 'USER' ? '销售代表' : '客户';
    const preview = (content as string).replace(/\n/g, ' ').slice(0, 70);
    console.log(`  [${prefix}] ${preview}...`);
  }
  console.log('\n对话写入完成！');

  console.log('\n正在调用AI生成评估报告...');
  const { generateEvaluation } = await import('../services/ai/chatService.js');
  const evaluation = await generateEvaluation(session.id);

  console.log('\n========== 评估报告 ==========');
  console.log(`总体评分: ${evaluation.overallScore}/100`);
  console.log(`\n维度评分:`);
  for (const dim of evaluation.dimensions) {
    console.log(`  ${dim.dimension}: ${dim.score}/100`);
    console.log(`    反馈: ${dim.feedback.slice(0, 100)}`);
  }
  console.log(`\n优点:`);
  console.log(`  ${evaluation.strengths.slice(0, 300)}`);
  console.log(`\n不足:`);
  console.log(`  ${evaluation.weaknesses.slice(0, 300)}`);
  console.log(`\n改进建议 (前3条):`);
  const recs = evaluation.recommendations.split('\n').filter(Boolean);
  for (const rec of recs.slice(0, 3)) {
    console.log(`  ${rec.slice(0, 150)}`);
  }

  await prisma.report.upsert({
    where: { sessionId: session.id },
    update: {
      overallScore: evaluation.overallScore,
      radarData: JSON.stringify(evaluation.dimensions),
      strengths: evaluation.strengths,
      weaknesses: evaluation.weaknesses,
      recommendations: evaluation.recommendations,
      transcript: messagesData.map(m => `${m[0] === 'USER' ? '[销售代表]' : '[客户]'}: ${m[1]}`).join('\n\n'),
    },
    create: {
      sessionId: session.id,
      userId: admin.id,
      overallScore: evaluation.overallScore,
      radarData: JSON.stringify(evaluation.dimensions),
      strengths: evaluation.strengths,
      weaknesses: evaluation.weaknesses,
      recommendations: evaluation.recommendations,
      transcript: messagesData.map(m => `${m[0] === 'USER' ? '[销售代表]' : '[客户]'}: ${m[1]}`).join('\n\n'),
    },
  });

  console.log(`\n评估报告已保存！报告ID: ${session.id}`);
  console.log(`\n在系统中查看完整报告:`);
  console.log(`  http://localhost:5174/reports/${session.id}`);

  await prisma.$disconnect();
}

runDemoConversation().catch(console.error);
