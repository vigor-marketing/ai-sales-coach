import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Delete all existing knowledge entries
  const deleted = await prisma.knowledgeEntry.deleteMany();
  console.log(`Deleted ${deleted.count} existing entries`);

  // Re-import with clean data
  const entries = [
    {
      question: '客户转化全流程要点是什么？',
      answer: '1. 快速响应：凌晨收到询盘也要快速匹配产品并分发，清晨即发出回复，多通道触达（邮件+电话+WhatsApp）\n2. 专业回复+快速报价：在确认需求后第一时间给出专业报价\n3. 背调和需求分析：调查客户背景信息，分析客户提供的需求信息\n4. 多轮技术支持：提供全流程技术资料，及时答疑，快速建立信任，帮助客户解决痛点\n5. 精准识别客户专业度：识别需求明确的客户，配合积极的客户优先跟进\n6. 临门一脚与订单闭合：在充分建立信任后促成交易',
      category: '销售流程',
      tags: '客户转化,销售流程,询盘处理',
    },
    {
      question: '如何筛选和培育潜在客户？',
      answer: '筛选原则：不在错误客户身上浪费时间，先筛选再行动。明确理想客户画像，果断聚焦。培育方法：通过持续提供价值来建立信任——解决痛点问题、提供系统解决方案、分享成功案例、熟悉产品基础知识和进阶知识、熟悉相关产品案例、明确自身价值点。传播策略：让满意客户成为播种机，引入裂变和转介绍体系，深度挖掘客户需求',
      category: '销售策略',
      tags: '客户筛选,客户培育,转介绍',
    },
    {
      question: '石油钻完井工具外贸的销售理念是什么？',
      answer: '每一次与新客户的对话，不仅是商业机会，更是理解他人、磨练心性、创造价值的珍贵时刻。当你不再仅仅盯着订单，而是专注于如何真正帮到这个人时，转化会以一种更自然、更持久的方式发生。真正的销售艺术，在于将对抗转化为对话，将疑虑转化为信任，将问题转化为共同解决问题。最高的转化率，永远来自于你不再试图征服客户，而是成为他们解决问题途中，最值得信赖的同行者。',
      category: '销售哲学',
      tags: '销售理念,客户关系,长期价值',
    },
    {
      question: '如何高效处理客户的询盘？',
      answer: '案例：11月22日（周六）凌晨1点收到客户询盘，快速进行产品匹配和询盘分发，当天早上5点通过邮件进行询盘回复，后续通过电话和WhatsApp进行多方位触达。关键点：7x24小时快速响应机制、快速产品匹配能力（熟悉产品线）、多渠道触达（邮件+电话+WhatsApp）、专业回复内容、持续跟进直到客户回复',
      category: '询盘处理',
      tags: '询盘,快速响应,外贸沟通',
    },
    {
      question: '和石油行业客户建立信任的关键步骤是什么？',
      answer: '1. 快速响应并专业回复，展示公司实力和专业度\n2. 主动进行客户背景调查（背调），了解客户公司和业务\n3. 多轮技术支持：提供全流程技术资料，解答技术疑问\n4. 全流程跟进：从需求分析->方案提供->技术答疑->售后服务\n5. 通过案例分享建立信任：分享成功的合作案例\n6. 持续的价值输出：不是一次性推销，而是持续帮助客户解决问题',
      category: '客户关系',
      tags: '信任建立,技术交流,客户关系',
    },
  ];

  for (const entry of entries) {
    await prisma.knowledgeEntry.create({ data: entry });
    console.log(`  Created: ${entry.question.slice(0, 30)}...`);
  }

  console.log(`\nRe-imported ${entries.length} entries successfully`);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
