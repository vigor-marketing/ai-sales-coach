import OpenAI from 'openai';
import { prisma } from '../../utils/prisma.js';
import { getInsightsForPrompt } from '../strategy/strategyService.js';
import type { Message } from '@prisma/client';
import { redactSensitiveData } from '../../utils/redactSensitiveData.js';

const openai = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || '',
  baseURL: process.env.DEEPSEEK_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.deepseek.com',
});

export async function generateRoleResponse(
  sessionId: string,
  userMessage: string
): Promise<string> {
  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    include: { role: true, scenario: true, messages: { orderBy: { createdAt: 'asc' } } },
  });

  if (!session) throw new Error('Session not found');

  const systemPrompt = session.role.promptTemplate;
  const roleName = session.role.name || '该客户';
  const safeUserMessage = redactSensitiveData(userMessage);

  const scenarioContext = session.scenario
    ? `当前场景：${session.scenario.title}\n场景描述：${(session.scenario.description||'').replace(/该客户/g,roleName)}\n背景：${(session.scenario.background||'').replace(/该客户/g,roleName)}\n目标：${session.scenario.objectives}`
    : '';

  // 项目简报 — 销售代表在对话开始时看到的信息，你需要知道他们掌握了什么
  const briefingContext = session.scenario
    ? `\n\n### 销售代表已知的项目信息（项目简报）
- 背景：${(session.scenario.background||session.scenario.description).replace(/该客户/g,roleName)}
- 客户需求：该销售代表被告知${roleName}正在寻找能满足项目需求的供应商
- 销售目标：建立信任、了解${roleName}的痛点、展示产品价值，争取获得询价或订单

注意：销售代表掌握的信息是有限且模糊的，他们不知道你的具体需求细节。你需要基于以上的项目信息进行对话。`
    : '';

  // 场景对齐语境 — 告诉AI这个对话是什么场景、销售代表的预期策略是什么，保证双方在同一频道
  const scenarioCat = session.scenario?.category || '';
  const traitText = (session.role.personalityTraits || '').toLowerCase();
  const regionText = session.role.region || '';
  const decisionText = (session.role.decisionStyle || '').toLowerCase();
  const commText = (session.role.communicationStyle || '').toLowerCase();
  const isMidEast = /中东|沙特|阿联酋|伊拉克/.test(regionText);
  const isEurope = /欧洲|挪威|英国|法国/.test(regionText);
  const isSEAsia = /东南亚|印尼|马来西亚/.test(regionText);
  const isRussia = /俄罗斯/.test(regionText);
  const isNorthAm = /北美|美国/.test(regionText);
  const isChina = /中国/.test(regionText);
  const isTech = /技术|工程|严谨|数据/.test(traitText);

  let scenarioAlign = '';
  // 根据场景类别+地区+角色特征生成语境对齐提示
  if (/初次|初次接触|破冰|展会|cold/i.test(scenarioCat)) {
    if (isMidEast) {
      scenarioAlign = '\n\n### 初次接触语境（中东）\n这是双方第一次接触。销售代表会先和你寒暄拉近关系，而不是直接谈业务。你的角色是礼貌但有保留——愿意聊行业趋势和市场，但对具体的采购需求守口如瓶。中东生意讲究先交朋友，你可以在闲聊中感受对方是否靠谱，但不要透露任何具体需求。';
    } else if (isEurope) {
      scenarioAlign = '\n\n### 初次接触语境（欧洲）\n这是双方初次接触。销售代表会表现得专业克制，试图了解你的业务背景。你的态度应该是开放但审慎——可以聊聊你们公司的技术路线和行业看法，但对具体的供应商切换保持模糊。欧洲公司的采购流程严谨，你不会在第一次接触时就谈具体需求。';
    } else if (isSEAsia) {
      scenarioAlign = '\n\n### 初次接触语境（东南亚）\n这是第一次接触。销售代表会试图用温和的方式和你建立关系。你作为东南亚客户，在回答时保持客气但留有余地——对价格有期待但不会直接说预算，对合作有兴趣但不会急于推进。多用委婉的表达，让对方从你的话里读到弦外之音。';
    } else if (isNorthAm) {
      scenarioAlign = '\n\n### 初次接触语境（北美）\n这是初次接触。北美客户效率至上，销售代表会开门见山想快速了解你的需求。你的角色直接但不详细——可以承认"我们在看新供应商"，但别透露具体项目和预算。北美人谈生意不绕弯子，你直接问也是一样直接答。';
    } else {
      scenarioAlign = '\n\n### 初次接触语境\n这是你和销售代表的第一次对话。对方会试图了解你的需求和背景。你的角色是一个真实的潜在客户——有兴趣但不急切，有需求但不详细。给出模糊的方向，让对方通过提问获取更多信息。';
    }
  } else if (/技术|评审|方案/i.test(scenarioCat)) {
    if (isTech) {
      scenarioAlign = '\n\n### 技术评审语境\n这是一次技术审查性质的对话。你是懂技术的内部专家，已经看过初步方案，现在要针对关键技术细节进行质询。你的态度是专业且挑剔的——会追问具体参数、测试条件、现场表现。销售代表的技术回答质量决定你对他专业度的判断。别轻易认可，要让他用数据说话。';
    } else {
      scenarioAlign = '\n\n### 技术评审语境\n这次对话是正式的技术方案评审，你虽然不是纯技术背景，但背后有技术团队帮你把关。你的角色是"把关人"——把你听到的技术声明都记录下，回头给技术团队审核。所以你会追问关键点，但不会陷入极其专业的技术讨论。';
    }
  } else if (/谈判|价格|签约/i.test(scenarioCat)) {
    if (/成本|预算|价格/.test(decisionText)) {
      scenarioAlign = '\n\n### 价格谈判语境（成本敏感型）\n你已经到了比价阶段，手里可能有其他供应商的报价。你的角色是价格谈判者——对成本极其敏感，会逐项追问价格构成。销售代表会试图用价值来锚定价格，而你会专注于总价和折扣。可以在预算范围内适当灵活，但要让对方觉得每一分让步都是有代价的。';
    } else if (/慢|委员会|审批|官僚/.test(decisionText)) {
      scenarioAlign = '\n\n### 价格谈判语境（流程驱动型）\n你基本认可了产品，但要走公司内部审批流程。你的角色是内部推动者——你想和这个供应商合作，但公司的采购流程、预算审批、法务审查层层关卡。你会不断提到"我需要内部确认""这个要走审批"，不是推脱，是真的流程就是这么慢。';
    } else {
      scenarioAlign = '\n\n### 价格谈判语境\n这是商务谈判环节。你已经对产品有一定认可，现在需要敲定价格和条款。你的态度是务实而有技巧的——关注最终成交价、付款条件、交期这几个硬指标。不要一次性接受对方的报价，适当讨价还价是正常的商务流程。';
    }
  } else if (/危机|投诉|故障|紧急/i.test(scenarioCat)) {
    scenarioAlign = '\n\n### 紧急/危机语境\n你遇到了现场设备的紧急问题，现在非常着急。语气直接、甚至有点不耐烦——你不是在"谈生意"，你是在"求救"。销售代表会试图安抚你并给出解决方案。你关注的是：他多久能解决问题？怎么保证不再出同样的问题？对他给出的解决方案表面认可但保持怀疑——你被骗太多次了。';
  } else if (/战略|长期|框架|大客户/i.test(scenarioCat)) {
    if (isMidEast) {
      scenarioAlign = '\n\n### 战略合作语境（中东）\n你考虑的是长期合作关系。作为中东大客户，你关注的是供应商的本地化承诺和长期投入意愿——是否建厂、是否培养本地人才、备件库覆盖。销售代表会展示公司实力和合作框架，你的角色是"期望很高的合作方"：提出高要求，看对方是否认真对待这个市场。';
    } else if (isChina) {
      scenarioAlign = '\n\n### 战略合作语境（中国油服）\n你想签一个覆盖多个海外项目的框架协议。作为中国油服出海企业，你天然对国内供应商有亲近感，但也很清楚低价竞争的套路。你的角色是"期望找到靠谱合作伙伴"的出海企业——你希望对方能提供国内的成本优势和国际的质量标准，同时对长期服务稳定性非常关注。';
    } else {
      scenarioAlign = '\n\n### 战略合作语境\n你考虑的是长期合作。你关心的不只是产品，而是对方的公司实力、服务网络和长期服务承诺。销售代表会展示综合实力，你的角色是"高标准的合作方"——赞赏对方的优势，但同时提出挑战性要求，观察对方如何应对。';
    }
  } else if (/认证|审核|合规|audit/i.test(scenarioCat)) {
    scenarioAlign = '\n\n### 审核/合规语境\n你正在进行正式的供应商审核。你的角色是"审核官"——手里有一份检查清单，逐项核对。你不会被销售话术影响，只关心文件、证书、资质这些硬性指标。对每一项要求都问清楚，不符合就直接指出。这不是针对谁，这是公司制度。';
  } else if (/商务|拜访|一般/i.test(scenarioCat)) {
    scenarioAlign = '\n\n### 商务拜访语境\n这是一次例行商务接触。你是务实高效的业务负责人，关注的是结果——对方能提供什么、价格如何、交期多长。不喜欢冗长的寒暄和无关信息。话题专注在业务本身，对方的效率和专业度决定了你是否愿意继续沟通。';
  } else {
    scenarioAlign = '\n\n### 对话语境\n你和销售代表正在沟通一个潜在的商业机会。你是真实的潜在客户——有采购需求但不会轻易透露全部信息。根据你的角色特征和当前场景，自然地回应对方，不要让对话太快进入详细的技术或价格讨论。';
  }

  // 地区特征附加（混入行为规则中让AI更有地区代入感）
  let regionFlavor = '';
  if (isMidEast) regionFlavor = '\n- 🕌 地区风格提示：中东商务讲究关系先行，可以用阿拉伯问候语（Assalamu Alaikum等）开场，谈生意前先聊聊行业和市场。';
  if (isEurope) regionFlavor = '\n- 🇪🇺 地区风格提示：欧洲客户正式专业，可以偶尔使用挪威语/本地语言表达，展现出技术严谨和环保意识。';
  if (isSEAsia) regionFlavor = '\n- 🌏 地区风格提示：东南亚客户温和礼貌、注重面子，可以偶尔使用本地语言（印尼语/马来语），回复含蓄委婉，避免直接说"不"。';
  if (isRussia) regionFlavor = '\n- 🇷🇺 地区风格提示：俄罗斯客户直接粗犷，话不多但切中要害。可以偶尔使用俄语词，表达对供应商的不信任和对实地验证的重视。';
  if (isNorthAm) regionFlavor = '\n- 🇺🇸 地区风格提示：北美客户直接务实、效率优先，语言简洁明了。关注成本效益和技术价值，不喜欢不必要的客套。';
  if (/印度/.test(regionText)) regionFlavor = '\n- 🇮🇳 地区风格提示：印度客户善于谈判、对价格敏感，沟通灵活。可以展现出对性价比的强烈关注。';
  if (/澳洲/.test(regionText)) regionFlavor = '\n- 🇦🇺 地区风格提示：澳洲客户友好直接、重视安全标准，沟通轻松但要求严格。';
  if (isSEAsia || /中国/.test(regionText)) regionFlavor = (regionFlavor || '') + '\n- 注意：销售代表和你可能是英文沟通，保持自然即可。';

  const pronoun = session.role.gender === 'FEMALE' ? '她/she/her' : '他/he/him';

  const behaviorRule = `

## 行为规则
你扮演的是${session.role.region}的${session.role.position}（${session.role.name}），你是一个真实的潜在客户，不是教练或考官。你的性别：${pronoun}。你的角色类型：${session.role.customerType}。${regionFlavor}${scenarioAlign}

### 🎭 你的性格画像
- 性格：${session.role.personalityTraits || '务实直接'}
- 沟通风格：${session.role.communicationStyle || '直接务实'}
- 决策特点：${session.role.decisionStyle || '自主决策'}
- 心中痛点：${session.role.painPoints || '成本和质量'}
- 话术风格：根据上述性格决定说话方式——技术型就多说数据和认证，价格敏感型就老提预算，关系型就温和委婉。

### 三阶段对话模式

**阶段A — 开场/试探（前5轮）：**
- 单条≤2句话，每句≤10词
- 按你的性格说话。技术总监多说技术质疑，CEO说战略问题，采购经理说价格和交期
- 信息模糊，不透露具体需求

**阶段B — 发出询价（销售≥5轮专业提问后触发）：**
不限字数，必须给出具体参数（产品名称、型号、数量、规格、认证、交期、付款条件）。例：
"We need 50 sets of 8.5-inch PDC bits, API 7-1, FOB Shanghai, 12 weeks. Also 30 sets of 6-inch drill collars Grade S-135. Quote please?"

**阶段C — 报价后谈判：** 销售报价后，你进入务实谈判模式。回复可以适当变长（≤3句话，每句≤25词），关注价格、交期、付款条件。可表达疑虑、要求折扣、或逐步接受。按你的角色特点谈判——预算紧张的砍价，技术型的谈参数，关系型的谈服务。

### 其他规则
- 🚫 中文消息 → 立即结束 "English only." [END_CONVERSATION]
- 🔄 防重复：只对完全相同的复制内容做出反应
- 📋 认证：只要求主流证书（API/ISO/ASME）
- ❄️ 默认冷淡，除非销售证明专业性`;

  // Inject accumulated strategy insights for this role (from past conversations)
  const strategyInsights = getInsightsForPrompt(session.roleId);
  const strategyContext = strategyInsights ? `\n\n${strategyInsights}` : '';

  // Build messages array with context compression for long conversations
  const allMessages = session.messages;
  const MAX_FULL_MESSAGES = 30; // Keep last 30 messages in full
  const SUMMARY_EVERY = 10;     // Summarize chunks of 10 old messages

  let messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: `${systemPrompt}\n\n${scenarioContext}${briefingContext}${behaviorRule}${strategyContext}` },
  ];

  if (allMessages.length > MAX_FULL_MESSAGES) {
    // Compress early messages: take every SUMMARY_EVERY-th message as a summary point
    const recentMessages = allMessages.slice(-MAX_FULL_MESSAGES);
    const earlyMessages = allMessages.slice(0, allMessages.length - MAX_FULL_MESSAGES);

    // Create a condensed summary of early conversation
    const earlySummary = earlyMessages
      .filter(m => m.role !== 'SYSTEM')
      .map(m => `${m.role === 'USER' ? '销售代表' : '客户'}: ${redactSensitiveData(m.content).slice(0, 100)}`)
      .join('\n');

    messages.push({
      role: 'system',
      content: `[早期对话摘要 - 以下${earlyMessages.length}轮对话已压缩]\n${earlySummary}`,
    });

    for (const msg of recentMessages) {
      messages.push({
        role: msg.role === 'USER' ? 'user' : msg.role === 'ASSISTANT' ? 'assistant' : 'system',
        content: redactSensitiveData(msg.content),
      });
    }
  } else {
    for (const msg of allMessages) {
      messages.push({
        role: msg.role === 'USER' ? 'user' : msg.role === 'ASSISTANT' ? 'assistant' : 'system',
        content: redactSensitiveData(msg.content),
      });
    }
  }

  messages.push({ role: 'user', content: safeUserMessage });

  // Dynamic temperature: early rounds more creative, later rounds more consistent
  const roundCount = session.messages.filter(m => m.role === 'USER' || m.role === 'ASSISTANT').length;
  const temperature = roundCount < 10 ? 0.75 : roundCount < 25 ? 0.65 : 0.5;

  const completion = await openai.chat.completions.create({
    model: process.env.DEEPSEEK_MODEL || process.env.OPENAI_MODEL || 'deepseek-v4-flash',
    messages,
    temperature,
    max_tokens: 300,
  }, { timeout: 120000 }); // 对话回复最长等2分钟

  let response = completion.choices[0]?.message?.content || '';
  
  // If the response was cut off mid-sentence, truncate to the last complete sentence
  // so the UI never shows an incomplete sentence.
  const trimmed = response.trim();
  if (trimmed && !/[.!?。！？]$/.test(trimmed.slice(-1))) {
    const terminators: [string, number][] = [
      ['.', trimmed.lastIndexOf('.')],
      ['?', trimmed.lastIndexOf('?')],
      ['!', trimmed.lastIndexOf('!')],
      ['。', trimmed.lastIndexOf('。')],
      ['！', trimmed.lastIndexOf('！')],
      ['？', trimmed.lastIndexOf('？')],
    ];
    const lastTerminator = terminators.filter(([, idx]) => idx > 0).sort((a, b) => b[1] - a[1])[0];
    if (lastTerminator) {
      response = trimmed.slice(0, lastTerminator[1] + 1);
    }
  }
  
  // Convert empty/dots/idle punctuation to [NO_RESPONSE] so the route handles it properly
  if (!response.trim() || /^[.,!?。．\s\-_]{1,8}$/.test(response.trim()) || response.trim() === '...' || response.trim() === '..' || response.trim() === '。' || response.trim() === '。。') {
    response = '[NO_RESPONSE]';
  }
  
  // If [NO_RESPONSE], still do a retry to try to get a real response
  if (response === '[NO_RESPONSE]') {
    const retryCompletion = await openai.chat.completions.create({
      model: process.env.DEEPSEEK_MODEL || process.env.OPENAI_MODEL || 'deepseek-v4-flash',
      messages: [
        ...messages,
        { role: 'system', content: 'I need you to respond as the customer. Write a brief skeptical reply (3-8 words). You MUST respond — silence is not allowed this time.' },
      ],
      temperature: 0.6,
      max_tokens: 150,
    });
    const retryResponse = retryCompletion.choices[0]?.message?.content?.trim() || '[NO_RESPONSE]';
    // Only use retry result if it's not garbage
    if (retryResponse !== '[NO_RESPONSE]' && !/^[.,!?。．\s\-_]{1,8}$/.test(retryResponse)) {
      response = retryResponse;
    }
    // else keep [NO_RESPONSE]
  }
  
  return response;
}

export async function generateEvaluation(sessionId: string): Promise<{
  overallScore: number;
  dimensions: { dimension: string; score: number; feedback: string; positivePoints: string[]; negativePoints: string[] }[];
  strengths: string;
  weaknesses: string;
  recommendations: string;
  orderDecision: { awarded: boolean; reason: string; type: string };
}> {
  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    include: { role: true, scenario: true, messages: { orderBy: { createdAt: 'asc' } } },
  });

  if (!session) throw new Error('Session not found');

  // 过滤掉SYSTEM消息——系统提供的信息不计入评分
  const filteredMessages = session.messages.filter(m => m.role !== 'SYSTEM');
  
  // 对话太短（少于2条有效对话）不生成评估
  const salesMsgCount = filteredMessages.filter(m => m.role === 'USER').length;
  if (salesMsgCount < 2) {
    return {
      overallScore: 5,
      dimensions: [],
      strengths: '对话轮次太少，无法进行有效评估',
      weaknesses: '建议完成至少2轮完整对话后再生成报告',
      recommendations: '继续进行陪练训练，积累足够的对话内容后再生成评估报告',
      orderDecision: { awarded: false, reason: '对话内容不足无法评估', type: '无' },
    };
  }

  const transcript = filteredMessages
    .map((m: Message) => `${m.role === 'USER' ? '[销售代表]' : '[客户]'}: ${m.content}`)
    .join('\n\n');

  const prompt = `你是一名石油天然气行业B2B销售评估员。请根据对话记录，评估销售代表的表现。

## 客户角色
${session.role.name} - ${session.role.position} - ${session.role.customerType} (${session.role.region})
## 场景
${session.scenario?.title || '未知场景'}
## 对话记录
${transcript}

## 你的任务
做两件事：
一、逐条判断以下24项行为标准是否展现（2=充分 1=部分 0=未展现）
二、为每个维度写评语+具体行为分析

### 话术规范
- greeting: 开场专业自我介绍
- structure: 提问逻辑清晰
- conciseness: 表达简洁
- adapt: 用语贴合客户

### 业务知识
- terminology: 使用行业术语
- specs: 提供具体参数/数据
- context: 理解客户业务
- certification: 提及认证资质

### 沟通技巧
- followUp: 根据回答追问
- listen: 倾听多于推销
- professional: 专业克制
- respond: 回应客户关切

### 需求挖掘
- openEnded: 使用开放式问题
- painPoints: 挖掘到痛点
- quantify: 问出具体需求
- decision: 了解决策流程

### 异议处理
- acknowledge: 承认顾虑
- evidence: 用证据回应
- calm: 不防卫
- convert: 化异议为机会

### 流程覆盖
- nextStep: 提出下一步
- commitment: 获得承诺
- advance: 推动进程
- close: 明确结论

## 输出格式
{
  "criteria": { "greeting": 2, "structure": 1, ... },
  "dimensions": [
    {
      "dimension": "话术规范",
      "feedback": "1-2句话评语，先说做得好的具体行为，再说需要改进的具体行为",
      "positivePoints": ["具体好的行为+N字原文引用+为什么好"],
      "negativePoints": ["具体不好行为+N字原文引用+应该怎么做"]
    },
    ... // 6个维度
  ],
  "orderDecision": { "awarded": true/false, "type": "预订单/正式订单/丢单", "reason": "..." },
  "strengths": "**必须**按以下格式写2-3条：每条先说"在[具体轮次/场景]中，你[做了什么具体行为]，这体现了[什么能力]。建议保持：[具体做法]。例：『在客户质疑公司知名度时，你主动提供了API Q1证书编号并引用了北海项目案例，成功化解了客户顾虑。建议保持这种"用证据说话"的回应方式。』",
  "weaknesses": "**必须**按以下格式写2-3条：每条先说"在[具体轮次/场景]中，你[做了什么具体行为]，这导致了[什么负面结果]。根本原因：[分析]。改进方法：[具体话术或动作]。例：『客户两次追问'你们有没有本地库存'时，你都回答'可以从国内发货'而没有提本地仓库方案，导致客户担心交货期。根本原因是你对客户所在地区的物流痛点理解不够。改进方法：提前准备客户地区的库存分布图和紧急配送方案，遇到交期问题时主动说"We have a warehouse in Rotterdam, can deliver within 48 hours"』",
  "recommendations": "**必须**按以下格式写2-3条：每条包含(1)[对话中的具体问题] (2)[为什么是问题] (3)[可执行的话术替换方案。例：『当客户说'price is too high'时你回答'our quality is better'，这没有解决客户对成本的关切。正确的回应应该是"I understand. Let me break down the cost per well — our bits last 40% longer, which saves you about $50,000 per well in trip time alone"——用数据把价格转化为投资回报，而不是空口说质量好。』"
}`;

  const completion = await openai.chat.completions.create({
    model: process.env.DEEPSEEK_MODEL || process.env.OPENAI_MODEL || 'deepseek-v4-flash',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.6,
    max_tokens: 4096,
  }, { timeout: 300000 }); // 评估报告最长等5分钟

  const content = completion.choices[0]?.message?.content || '{}';
  // Clean up JSON: remove markdown formatting, fix common issues
  const cleaned = content
    .replace(/```json?\n?/g, '')
    .replace(/```/g, '')
    .trim();
  
  // Try to find the JSON object in the response
  let jsonStr = cleaned;
  const jsonStart = cleaned.indexOf('{');
  const jsonEnd = cleaned.lastIndexOf('}');
  if (jsonStart >= 0 && jsonEnd > jsonStart) {
    jsonStr = cleaned.slice(jsonStart, jsonEnd + 1);
  }

  try {
    // Try to extract JSON object with lenient parsing (3 attempts)
    let result: any = {};

    // Attempt 1: Standard JSON.parse
    try {
      result = JSON.parse(jsonStr);
    } catch {
      // Attempt 2: Fix common JSON issues (trailing commas, unescaped quotes, unquoted keys)
      try {
        const fixed = jsonStr
          .replace(/,\s*\]/g, ']')
          .replace(/,\s*\}/g, '}')
          .replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":');
        result = JSON.parse(fixed);
        } catch {
          // Attempt 3: Aggressive fallback — fix single quotes, extra whitespace, control chars
          try {
            const aggressive = jsonStr
              .replace(/,\s*\]/g, ']')
              .replace(/,\s*\}/g, '}')
              .replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":')
              .replace(/'/g, '"')
              .replace(/\\(?!["\\/bfnrtu])/g, '\\\\')
              // Remove any non-printable control characters except newlines/tabs
              .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
          result = JSON.parse(aggressive);
          } catch {
            // Attempt 4: Super clean — handle smart/curly quotes and strip control chars
            try {
              const superClean = jsonStr
                .replace(/[\u2018\u2019]/g, "'")     // smart single quotes → ASCII '
                .replace(/[\u201C\u201D]/g, '"')     // smart double quotes → ASCII "
                .replace(/[\u2013\u2014]/g, '-')     // en-dash, em-dash → -
                .replace(/[^\x20-\x7E\n\r\t]/g, '')  // strip remaining non-printable
                .replace(/,\s*\]/g, ']')
                .replace(/,\s*\}/g, '}')
                .replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":')
                .replace(/'/g, '"');
              result = JSON.parse(superClean);
            } catch {
              // All 4 attempts failed — auto-retry with lower temperature
              console.warn('Evaluation JSON parsing failed after 4 attempts. Retrying with lower temperature...');
              try {
                const retryCompletion = await openai.chat.completions.create({
                  model: process.env.DEEPSEEK_MODEL || process.env.OPENAI_MODEL || 'deepseek-v4-flash',
                  messages: [{ role: 'user', content: prompt }],
                  temperature: 0.3,  // lower temperature for more consistent output
                  max_tokens: 4096,
                }, { timeout: 300000 });
                const retryContent = retryCompletion.choices[0]?.message?.content || '';
                const retryCleaned = retryContent.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
                const retryStart = retryCleaned.indexOf('{');
                const retryEnd = retryCleaned.lastIndexOf('}');
                const retryStr = (retryStart >= 0 && retryEnd > retryStart)
                  ? retryCleaned.slice(retryStart, retryEnd + 1)
                  : retryCleaned;
                // Try parsing with all 4 methods
                let retryResult: any = {};
                try { retryResult = JSON.parse(retryStr); } catch {
                  const f = retryStr.replace(/,\s*\]/g,']').replace(/,\s*\}/g,'}').replace(/([{,]\s*)(\w+)\s*:/g,'$1"$2":');
                  try { retryResult = JSON.parse(f); } catch {
                    const a = f.replace(/'/g,'"').replace(/\\(?!["\\/bfnrtu])/g,'\\\\').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g,'');
                    try { retryResult = JSON.parse(a); } catch {
                      const s = a.replace(/[\u2018\u2019]/g,"'").replace(/[\u201C\u201D]/g,'"').replace(/[\u2013\u2014]/g,'-').replace(/[^\x20-\x7E\n\r\t]/g,'');
                      try { retryResult = JSON.parse(s); } catch {}
                    }
                  }
                }
                result = retryResult;
                if (!result.dimensions || !Array.isArray(result.dimensions) || result.dimensions.length === 0) {
                  console.error('Retry also produced invalid result');
                }
              } catch (retryErr) {
                console.error('Retry also failed:', retryErr);
              }
            }
          }
      }
    }

    // Algorithmic scoring from criteria + AI analysis text
    const DIMENSIONS_CONFIG: { label: string; criteria: string[] }[] = [
      { label: '话术规范', criteria: ['greeting','structure','conciseness','adapt'] },
      { label: '业务知识', criteria: ['terminology','specs','context','certification'] },
      { label: '沟通技巧', criteria: ['followUp','listen','professional','respond'] },
      { label: '需求挖掘', criteria: ['openEnded','painPoints','quantify','decision'] },
      { label: '异议处理', criteria: ['acknowledge','evidence','calm','convert'] },
      { label: '流程覆盖', criteria: ['nextStep','commitment','advance','close'] },
    ];
    const criteriaData = result.criteria || {};
    const aiDims = new Map((result.dimensions || []).map((d: any) => [d.dimension, d]));

    const dims = DIMENSIONS_CONFIG.map(cfg => {
      // Algorithmic score from criteria
      const scores = cfg.criteria.map(k => (criteriaData[k] === 2 || criteriaData[k] === 1 || criteriaData[k] === 0) ? criteriaData[k] : 0);
      const maxScore = cfg.criteria.length * 2;
      const rawScore = scores.reduce((a: number, b: number) => a + b, 0);
      const hasConv = filteredMessages.length > 2;
      let computed = Math.round((rawScore / maxScore) * 100);
      if (hasConv && computed < 15) computed = 15;

      // AI analysis text
      const aiDim: any = aiDims.get(cfg.label);
      return {
        dimension: cfg.label,
        score: Math.min(100, Math.max(0, computed)),
        feedback: aiDim?.feedback ?? '',
        positivePoints: Array.isArray(aiDim?.positivePoints) ? aiDim.positivePoints : [],
        negativePoints: Array.isArray(aiDim?.negativePoints) ? aiDim.negativePoints : [],
      };
    });

    // Compute overallScore from weighted dimension scores
    // Weight table: [话术规范, 业务知识, 沟通技巧, 需求挖掘, 异议处理, 流程覆盖]
    const scenarioCategory = session.scenario?.category || '';
    const isTech = /技术|评审|方案|产品|工程|研发/i.test(scenarioCategory);
    const isBiz = /商务|谈判|价格|合同|报价|采购/i.test(scenarioCategory);
    const isRelation = /破冰|关系|初次|拜访|建立|信任/i.test(scenarioCategory);
    const isCrisis = /危机|投诉|故障|事故|紧急|安全/i.test(scenarioCategory);
    
    const weightMap: Record<string, number> = {};
    dims.forEach((d: any) => {
      const dimName = d.dimension || '';
      if (isTech) {
        if (/话术/.test(dimName)) weightMap[dimName] = 0.15;
        else if (/业务|知识/.test(dimName)) weightMap[dimName] = 0.25;
        else if (/沟通/.test(dimName)) weightMap[dimName] = 0.10;
        else if (/需求|挖掘/.test(dimName)) weightMap[dimName] = 0.15;
        else if (/异议|处理/.test(dimName)) weightMap[dimName] = 0.20;
        else if (/流程|覆盖/.test(dimName)) weightMap[dimName] = 0.15;
        else weightMap[dimName] = 1 / dims.length;
      } else if (isBiz) {
        if (/话术/.test(dimName)) weightMap[dimName] = 0.15;
        else if (/业务|知识/.test(dimName)) weightMap[dimName] = 0.10;
        else if (/沟通/.test(dimName)) weightMap[dimName] = 0.15;
        else if (/需求|挖掘/.test(dimName)) weightMap[dimName] = 0.20;
        else if (/异议|处理/.test(dimName)) weightMap[dimName] = 0.25;
        else if (/流程|覆盖/.test(dimName)) weightMap[dimName] = 0.15;
        else weightMap[dimName] = 1 / dims.length;
      } else if (isRelation) {
        if (/话术/.test(dimName)) weightMap[dimName] = 0.20;
        else if (/业务|知识/.test(dimName)) weightMap[dimName] = 0.15;
        else if (/沟通/.test(dimName)) weightMap[dimName] = 0.25;
        else if (/需求|挖掘/.test(dimName)) weightMap[dimName] = 0.20;
        else if (/异议|处理/.test(dimName)) weightMap[dimName] = 0.10;
        else if (/流程|覆盖/.test(dimName)) weightMap[dimName] = 0.10;
        else weightMap[dimName] = 1 / dims.length;
      } else if (isCrisis) {
        if (/话术/.test(dimName)) weightMap[dimName] = 0.15;
        else if (/业务|知识/.test(dimName)) weightMap[dimName] = 0.20;
        else if (/沟通/.test(dimName)) weightMap[dimName] = 0.20;
        else if (/需求|挖掘/.test(dimName)) weightMap[dimName] = 0.10;
        else if (/异议|处理/.test(dimName)) weightMap[dimName] = 0.25;
        else if (/流程|覆盖/.test(dimName)) weightMap[dimName] = 0.10;
        else weightMap[dimName] = 1 / dims.length;
      } else {
        // Default equal weights
        weightMap[dimName] = 1 / dims.length;
      }
    });

    const computedOverallScore = dims.length > 0
      ? Math.round(dims.reduce((sum: number, d: any) => sum + d.score * (weightMap[d.dimension || ''] || 1 / dims.length), 0))
      : Math.max(5, result.overallScore ?? 0);  // minimum floor of 5

    const od = result.orderDecision || {};
    return {
      overallScore: computedOverallScore,
      dimensions: dims,
      strengths: result.strengths ?? '',
      weaknesses: result.weaknesses ?? '',
      recommendations: result.recommendations ?? '',
      orderDecision: {
        awarded: od.awarded === true,
        reason: od.reason ?? '',
        type: od.type ?? '',
      },
    };
  } catch (e) {
    console.error('Failed to parse evaluation JSON (outer catch):', e, '\nRaw:', jsonStr.slice(0, 500));
    // Last resort: minimum floor of 5 instead of 0
    const rawText = jsonStr
      .replace(/[{}\[\]"]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 1000);
    return {
      overallScore: 5,  // minimum score floor, not 0
      dimensions: [],
      strengths: rawText || '评估数据解析失败',
      weaknesses: '请重新生成评估报告',
      recommendations: `建议减少对话轮次后重试。原始响应：${rawText.slice(0, 200)}`,
      orderDecision: { awarded: false, reason: '评估系统异常', type: '无' },
    };
  }
}
