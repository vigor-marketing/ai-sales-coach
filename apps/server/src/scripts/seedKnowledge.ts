import { prisma } from '../utils/prisma.js';

const ENTRIES = [
  {
    question: 'AI机制对话样本 - 全机制演示(Tarek)',
    answer: `# AI 销售陪练全机制演示 - Tarek Al-Mansour

## 角色信息
- 姓名：Tarek Al-Mansour
- 客户类型：国际油田服务公司
- 地区：中东（沙特）
- 职位：采购专员
- 场景：初次接触 - 建立信任关系
- 难度：EASY

## 第一轮 - 销售代表开场
客户回应：
"Yes, I received your email. But to be honest, we receive dozens of supplier inquiries every week. Before we go further, please send me your company profile and API certifications. I need to verify your qualifications first. Our procurement procedure requires all new suppliers to go through pre-qualification.
[虚拟文件: Supplier_Registration_Form.pdf - Please fill out this standard supplier form]"

## 第二轮 - 销售代表回应资质
客户回应：
"We're currently sourcing 5-1/2" and 7" OCTG for a high-temperature gas well project in Ghawar field. The operating temperature is around 350°F. Can your products handle that? I need to see some reference cases first — we had a bad experience last year with a supplier whose tools failed under HT conditions."

## 第三轮 - 销售代表发送案例
客户回应：
"That's helpful. Let me review the case study. But I should be transparent with you — I'm not the final decision maker on this. Our procurement manager, Mr. Khalid, will need to approve any new supplier. I can prepare a shortlist and present it to him if your qualifications check out.
Also, what's your typical lead time for HT-grade OCTG? Our project timeline is tight."

## 第四轮 - 时间推进
客户回应：
"I'll discuss your proposal with Mr. Khalid and get back to you.
[时间推进: 1周后 - Khalid reviewed the documentation and approved pre-qualification. Tarek schedules a technical meeting.]
Good news — Mr. Khalid has reviewed your documentation and approved moving to the next stage. We'd like to schedule a technical meeting with your engineering team next week. Can you confirm availability?"

## 第五轮 - 安排技术会议
客户回应：
"Thursday works. Please include your technical specifications and pricing range in the meeting materials so we can move faster.
One more thing — I need to be clear. We have 3 other suppliers in the shortlist. Your pricing needs to be competitive. I'm not asking for the cheapest, but I need to justify the selection to Mr. Khalid."

## 第六轮 - 不当言辞触发情绪
客户回应（对贬低竞争对手的反应）：
"I don't appreciate the comments about other suppliers. We have a professional procurement process here. Please focus on your own product merits rather than criticizing competitors. If you could stick to the technical discussion, that would be more productive."

## 第七轮 - 主动结束对话
客户回应：
"That sounds good. I think we've covered the main points for now — qualifications checked, technical scope defined, and a meeting scheduled. Please send the meeting invite and I'll confirm on my end. Let's continue on Thursday.
[虚拟文件: Meeting_Agenda_Pre-Qualification.pdf - Technical meeting agenda and expected outcomes]"

## 覆盖的AI机制
1. ✅ 语言要求 - 全程English
2. ✅ 随机心情 - R1谨慎→R2中立
3. ✅ 逐步透露信息 - 需求逐步明确
4. ✅ 回复长度控制 - 2-4句
5. ✅ 真实行业数据 - 5-1/2" OCTG, 350°F
6. ✅ 不主动引导
7. ✅ 发送虚拟文件 - R1,R3,R7
8. ✅ 时间推进 - R4（1周后）
9. ✅ 引入第三人 - Mr.Khalid
10. ✅ 主动结束对话 - R7
11. ✅ 情绪反应 - R6贬低竞争对手
12. ✅ 非决策人 - "need to discuss with Khalid"
13. ✅ 价格敏感 - "pricing needs to be competitive"`,
    category: '对话样本',
    tags: JSON.stringify(['Tarek', '全机制', '演示', '初次接触', '中东', 'English']),
  },
  {
    question: '销售对话中如何处理客户的不满情绪',
    answer: `# 客户情绪处理指南

## 客户表达不满的常见触发场景

### 1. 贬低竞争对手
- 客户反应："I don't appreciate comments about other suppliers."
- 正确处理：道歉并重新聚焦，如"You're right, I apologize. Let me refocus on our own product merits."
- 错误处理：继续争辩或狡辩

### 2. 过于随意的称呼
- 客户反应："I'm not comfortable with this kind of language."
- 正确处理：立即改用正式称呼
- 错误处理：解释"这只是我的习惯"

### 3. 施加压力/急迫催促
- 客户反应："I think we should end this conversation here."
- 正确处理：放缓节奏，尊重客户时间
- 错误处理：继续施加压力

### 4. 夸大承诺
- 客户反应："That's not how we do business."
- 正确处理：用事实和数据说话
- 错误处理：继续空口承诺

## 客户不满信号识别
1. 回复变短 - 1-2句话
2. 语气词变化 - "Look", "Frankly", "To be honest"
3. 直接质疑 - "Are you sure?", "Is that accurate?"
4. 推脱拖延 - "Let me check", "I'll get back to you"
5. 主动结束意图 - "We've covered the main points"

## 修复关系三步法
1. 承认并道歉 - "You're right, I apologize."
2. 重新聚焦 - "Let me refocus on your specific needs."
3. 提供价值 - "I'll make sure our engineer prepares detailed data for your conditions."`,
    category: '销售技巧',
    tags: JSON.stringify(['情绪处理', '客户不满', '修复关系', '投诉处理']),
  },
  {
    question: '如何识别客户是否为决策人',
    answer: `# 识别决策人指南

## 非决策人的典型表述
1. "I need to check with my supervisor"
2. "Let me discuss this with my manager"
3. "I'm not authorized to discuss pricing"
4. "Our procurement manager will need to approve"
5. "I can prepare a shortlist and present it"
6. "Let me transfer you to our purchasing manager"

## 决策人的典型表述
1. "I can make the decision on this"
2. "I'll sign off on the PO"
3. "Let me know the final price and I'll approve it"
4. "I don't need anyone else's approval"
5. "Just send the invoice to me"

## 应对非决策人的策略
1. 尊重流程 - "I understand you need to follow procedure"
2. 提供完整资料 - 让对方容易向上汇报
3. 主动要求接触决策人 - "Would it be helpful if I join the meeting with your manager?"
4. 帮助对方成功 - 提供汇报用的摘要资料
5. 保持耐心 - 不要绕过对方直接找上级（会引起反感）

## 应对策略示例
"Thank you for being transparent. I'll prepare a summary document that you can share directly with Mr. Khalid. And if it would help, I'm happy to join a call with both of you to answer any technical questions."`,
    category: '销售技巧',
    tags: JSON.stringify(['决策人', '非决策人', '采购流程', '应对策略']),
  },
  {
    question: '销售对话中的时间推进和节奏控制',
    answer: `# 时间推进与对话节奏指南

## 什么是时间推进
AI客户会在合适的时机模拟时间的跳跃，让对话自然进入下一阶段，模拟真实的采购周期。

## 典型时间推进场景
1. 技术讨论结束后 → 推进到商务阶段
2. 发送资料后 → 推进到审核阶段
3. 一个话题充分交流后 → 推进到下一个话题
4. 销售代表说"我会发资料给你"之后 → 推进到客户审核阶段

## 时间推进格式
"[时间推进: X天后 - 简短说明]"
例如：
- [时间推进: 2天后 - Reviewed the documents, scheduled follow-up]
- [时间推进: 1周后 - Technical evaluation completed, moving to commercial discussion]
- [时间推进: 3天后 - Internal team approved, ready to discuss pricing]

## 对话节奏控制
1. 初期（1-3轮）：建立信任，了解基本需求
2. 中期（4-6轮）：深入技术讨论，处理异议
3. 后期（7轮以上）：商务谈判，或准备结束

## 关键注意事项
- 整个对话最多1-2次时间推进
- 不要在对话初期就推进时间
- 时间推进后要以新阶段的状态继续对话
- 时间推进通常伴随着话题的转换`,
    category: '对话技巧',
    tags: JSON.stringify(['时间推进', '节奏控制', '销售周期', '话题转换']),
  },
  {
    question: '如何处理客户的引入第三人场景',
    answer: `# 多人对话处理指南

## 什么是引入第三人
AI客户在讨论过程中，如果涉及到自己权限之外的话题，会"引入"相关的同事或上级进入对话。

## 常见引入场景
1. 技术细节 → 引入技术经理/工程师
2. 价格合同 → 引入采购经理/财务负责人
3. 项目执行 → 引入项目经理
4. 需要审批 → 引入上级决策人

## 引入格式
"[引入角色: 姓名 - 职位]"
例如：
- [引入角色: Sarah - Procurement Manager]
- [引入角色: David Chen - Technical Director]
- [引入角色: Mr. Zhang - Finance Department]

## 应对策略
1. 欢迎新角色 - "Glad to meet you, Sarah. Let me walk you through our proposal."
2. 调整沟通内容 - 对不同角色说不同的话
   - 对技术经理 → 讲技术参数、案例
   - 对采购经理 → 讲价格、条款、交货期
   - 对财务 → 讲付款条件、成本分析
3. 不要忽略原始联系人 - 同时保持与原联系人的关系
4. 注意信息一致性 - 对不同角色说一致的信息

## 示例
"Thank you for bringing in Mr. Khalid. I've prepared a summary of our technical discussion. Mr. Khalid, would you like me to walk through the key points, or shall we focus on the commercial aspects directly?"`,
    category: '对话技巧',
    tags: JSON.stringify(['多人对话', '引入角色', '跨部门', '采购流程']),
  },
];

async function seedKnowledge() {
  console.log('开始添加知识库条目...');
  for (const entry of ENTRIES) {
    const existing = await prisma.knowledgeEntry.findFirst({ where: { question: entry.question } });
    if (existing) {
      console.log(`  已存在: ${entry.question}`);
      continue;
    }
    await prisma.knowledgeEntry.create({ data: entry });
    console.log(`  添加: ${entry.question}`);
  }
  console.log('知识库条目添加完成！');
}

seedKnowledge()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
