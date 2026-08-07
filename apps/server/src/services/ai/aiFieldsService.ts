import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || '',
  baseURL: process.env.DEEPSEEK_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.deepseek.com',
});

const MODEL = process.env.OPENAI_MODEL || process.env.MODEL || 'deepseek-v4-flash';

/**
 * 根据关键信息 AI 生成角色的痛点、性格特质和提示词
 */
export async function generateRoleFields(input: {
  name: string; gender: string; customerType: string; region: string; position: string;
  annualRevenue: string; coreTags: string; languagePreference: string;
  communicationStyle: string; decisionStyle: string; productFocus: string;
}): Promise<{ painPoints: string; personalityTraits: string; promptTemplate: string }> {
  const prompt = `你是一名资深的石油天然气行业销售培训专家。请根据以下角色关键信息，生成3项内容。

## 角色信息
- 姓名：${input.name}（${input.gender === 'FEMALE' ? '女' : '男'}）
- 客户类型：${input.customerType}
- 地区：${input.region}
- 职位：${input.position}
- 年营收：${input.annualRevenue}
- 核心标签：${input.coreTags}
- 语言偏好：${input.languagePreference}
- 沟通风格：${input.communicationStyle}
- 决策风格：${input.decisionStyle}
- 产品关注：${input.productFocus}

## 生成要求
请生成以下3项内容，用 === 分隔，不要加其他说明文字：

### 1. painPoints（痛点）
生成该角色在采购中可能面临的3-5个痛点，每个痛点一句话，用逗号分隔。要贴合 ${input.region} 地区特点和 ${input.customerType} 行业背景。

### 2. personalityTraits（性格特质）
生成该角色的性格描述，2-4句话。体现 ${input.communicationStyle} 的沟通风格和 ${input.decisionStyle} 的决策风格，融合地区文化特点。

### 3. promptTemplate（AI提示词）
生成一段完整的系统提示词（system prompt），约300-500字，用于 AI 扮演该客户角色。提示词需要包含：
- 角色身份定义（姓名、职位、公司类型、地区）
- 性格特征和行为模式
- 采购关注点和痛点
- 沟通风格和语言习惯
- 对该销售场景的基本态度
- 使用 ${input.languagePreference} 语言
- 注意：提示词中不要包含任何要求AI扮演教练或考官的内容，这是一个真实客户

请严格按照以下格式输出：

===PAIN===
[痛点内容]
===PERSONALITY===
[性格特质内容]
===PROMPT===
[提示词内容]`;

  const completion = await openai.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.8,
    max_tokens: 2000,
  });

  const content = completion.choices[0]?.message?.content || '';

  // Parse the response
  const painMatch = content.match(/===PAIN===\n?([\s\S]*?)(?=\n===PERSONALITY===)/);
  const personalityMatch = content.match(/===PERSONALITY===\n?([\s\S]*?)(?=\n===PROMPT===)/);
  const promptMatch = content.match(/===PROMPT===\n?([\s\S]*)$/);

  return {
    painPoints: (painMatch?.[1] || '').trim(),
    personalityTraits: (personalityMatch?.[1] || '').trim(),
    promptTemplate: (promptMatch?.[1] || '').trim(),
  };
}

/**
 * 根据关键信息 AI 生成场景的描述、背景、目标和评估标准
 */
export async function generateScenarioFields(input: {
  title: string; category: string; difficulty: string; region?: string;
}): Promise<{ description: string; background: string; objectives: string; evaluationCriteria: string }> {
  const diffLabels: Record<string, string> = { EASY: '简单', MEDIUM: '中等', HARD: '困难', EXPERT: '专家' };
  const diffLabel = diffLabels[input.difficulty] || input.difficulty;

  const prompt = `你是一名资深的石油天然气行业销售培训专家。请根据以下场景关键信息，生成4项内容。

## 场景信息
- 标题：${input.title}
- 分类：${input.category}
- 难度：${diffLabel}
${input.region ? `- 地区：${input.region}` : ''}

## 生成要求
请生成以下4项内容，用 === 分隔，不要加其他说明文字：

### 1. description（场景描述）
1-2句话概括场景核心内容，让销售代表快速了解这是什么场景。

### 2. background（背景设定）
3-5句话描述场景的完整背景：客户是谁、正在面临什么问题、为什么需要这次对话、当前局势如何。

### 3. objectives（对话目标）
列出该场景下销售代表需要达成的2-3个具体目标，用逗号分隔。

### 4. evaluationCriteria（评估维度）
列出评估销售代表在该场景下表现的具体维度，每行一个维度，共4-6个。每个维度包含维度名称和简要说明。

难度为${diffLabel}的场景意味着：
- 简单：客户合作意愿高，问题直接
- 中等：客户中立，需要销售代表主动推进
- 困难：客户有较多质疑，需要较好的专业能力
- 专家：客户非常专业，要求极高，需要非常深入的行业知识

请严格按照以下格式输出：

===DESC===
[描述内容]
===BG===
[背景内容]
===OBJ===
[目标内容]
===EVAL===
[评估维度内容]`;

  const completion = await openai.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 2000,
  });

  const content = completion.choices[0]?.message?.content || '';

  const descMatch = content.match(/===DESC===\n?([\s\S]*?)(?=\n===BG===)/);
  const bgMatch = content.match(/===BG===\n?([\s\S]*?)(?=\n===OBJ===)/);
  const objMatch = content.match(/===OBJ===\n?([\s\S]*?)(?=\n===EVAL===)/);
  const evalMatch = content.match(/===EVAL===\n?([\s\S]*)$/);

  return {
    description: (descMatch?.[1] || '').trim(),
    background: (bgMatch?.[1] || '').trim(),
    objectives: (objMatch?.[1] || '').trim(),
    evaluationCriteria: (evalMatch?.[1] || '').trim(),
  };
}

/**
 * 根据一句话描述，AI 快速生成完整场景的所有字段
 */
export async function quickCreateScenario(description: string): Promise<{
  title: string; description: string; category: string; difficulty: string;
  background: string; objectives: string; evaluationCriteria: string; region: string;
}> {
  const prompt = `你是一名资深的石油天然气行业销售培训专家。用户输入了一段简单的描述，请根据这段描述生成一个完整的培训场景。

用户描述：${description}

请严格按照以下JSON格式输出（不要加其他文字）：
{
  "title": "场景标题（格式：核心内容 - 客户描述）",
  "description": "场景描述（1-2句话）",
  "category": "分类（如：初次接触、需求挖掘、方案呈现、异议处理、谈判签约、技术沟通、商务拓展等）",
  "difficulty": "EASY或MEDIUM或HARD或EXPERT",
  "background": "背景设定（3-5句话描述完整背景）",
  "objectives": "对话目标（2-3个，用逗号分隔）",
  "evaluationCriteria": "评估维度（4-6个，用逗号分隔）",
  "region": "适用地区（如：中东、欧洲、北美、俄罗斯、南美、澳洲、东南亚、中国、印度、日本、中亚。如果不确定填"通用"）"
}`;

  const completion = await openai.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 2000,
  });

  const content = completion.choices[0]?.message?.content || '';
  try {
    return JSON.parse(content);
  } catch {
    // Fallback: try to extract JSON from markdown code block
    const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) return JSON.parse(match[1]);
    return {
      title: description.slice(0, 30),
      description: '', category: '', difficulty: 'MEDIUM',
      background: '', objectives: '', evaluationCriteria: '', region: '通用',
    };
  }
}

/**
 * 根据一句话描述，AI 快速生成完整角色的所有字段
 */
export async function quickCreateRole(description: string): Promise<{
  name: string; gender: string; customerType: string; region: string; position: string;
  annualRevenue: string; coreTags: string; languagePreference: string;
  communicationStyle: string; decisionStyle: string; painPoints: string;
  productFocus: string; personalityTraits: string; promptTemplate: string;
}> {
  const prompt = `你是一名资深的石油天然气行业销售培训专家。用户输入了一段简单的描述，请根据这段描述生成一个完整的AI陪练客户角色。

用户描述：${description}

请严格按照以下JSON格式输出（不要加其他文字）：
{
  "name": "英文姓名（如：John Smith）",
  "gender": "MALE或FEMALE",
  "customerType": "客户类型（如：国际油田服务公司、国家石油公司、独立油公司、贸易商等）",
  "region": "地区（如：中东（沙特）、欧洲（挪威）、北美（美国）、俄罗斯、南美（巴西）、澳洲、东南亚（印尼）、中国（北京）等）",
  "position": "职位",
  "annualRevenue": "年营收",
  "coreTags": "核心标签（用·分隔，如：价格敏感·决策人·技术导向）",
  "languagePreference": "语言偏好（如：English、Spanish/English）",
  "communicationStyle": "沟通风格（一句话描述）",
  "decisionStyle": "决策风格（一句话描述）",
  "painPoints": "痛点（3-5个，用逗号分隔）",
  "productFocus": "产品关注（列出其主要关注的产品类型）",
  "personalityTraits": "性格特质（2-4句话）",
  "promptTemplate": "AI提示词（一段完整的system prompt，约300-500字，用于AI扮演该角色。包含身份定义、性格特征、沟通风格、采购关注点等。使用该角色的语言偏好）"
}`;

  const completion = await openai.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 2000,
  });

  const content = completion.choices[0]?.message?.content || '';
  try {
    return JSON.parse(content);
  } catch {
    const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) return JSON.parse(match[1]);
    return {
      name: description.slice(0, 20), gender: 'MALE', customerType: '',
      region: '', position: '', annualRevenue: '', coreTags: '',
      languagePreference: 'English', communicationStyle: '', decisionStyle: '',
      painPoints: '', productFocus: '', personalityTraits: '', promptTemplate: '',
    };
  }
}
