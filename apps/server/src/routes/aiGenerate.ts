import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { generateRoleFields, generateScenarioFields, quickCreateScenario, quickCreateRole } from '../services/ai/aiFieldsService.js';

const router: Router = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * POST /api/ai/generate-role-fields
 * 根据角色关键信息 AI 生成痛点、性格特质和提示词
 */
router.post('/generate-role-fields', async (req: AuthRequest, res: Response) => {
  try {
    const { name, gender, customerType, region, position, annualRevenue, coreTags, languagePreference, communicationStyle, decisionStyle, productFocus } = req.body;
    if (!name || !customerType || !region) {
      res.status(400).json({ error: '缺少必要字段: name, customerType, region' });
      return;
    }
    const result = await generateRoleFields({
      name, gender: gender || 'MALE', customerType, region, position: position || '',
      annualRevenue: annualRevenue || '', coreTags: coreTags || '',
      languagePreference: languagePreference || 'English',
      communicationStyle: communicationStyle || '', decisionStyle: decisionStyle || '',
      productFocus: productFocus || '',
    });
    res.json(result);
  } catch (error) {
    console.error('Generate role fields error:', error);
    res.status(500).json({ error: 'AI生成失败' });
  }
});

/**
 * POST /api/ai/generate-scenario-fields
 * 根据场景关键信息 AI 生成描述、背景、目标和评估标准
 */
router.post('/generate-scenario-fields', async (req: AuthRequest, res: Response) => {
  try {
    const { title, category, difficulty, region } = req.body;
    if (!title) {
      res.status(400).json({ error: '缺少必要字段: title' });
      return;
    }
    const result = await generateScenarioFields({
      title, category: category || '', difficulty: difficulty || 'MEDIUM', region,
    });
    res.json(result);
  } catch (error) {
    console.error('Generate scenario fields error:', error);
    res.status(500).json({ error: 'AI生成失败' });
  }
});

/**
 * POST /api/ai/quick-create-scenario
 * 输入一句话描述，AI 快速创建完整场景（所有字段自动生成）
 */
router.post('/quick-create-scenario', async (req: AuthRequest, res: Response) => {
  try {
    const { description } = req.body;
    if (!description) {
      res.status(400).json({ error: '缺少描述' });
      return;
    }
    const result = await quickCreateScenario(description);
    res.json(result);
  } catch (error) {
    console.error('Quick create scenario error:', error);
    res.status(500).json({ error: 'AI快速创建场景失败' });
  }
});

/**
 * POST /api/ai/quick-create-role
 * 输入一句话描述，AI 快速创建完整角色（所有字段自动生成）
 */
router.post('/quick-create-role', async (req: AuthRequest, res: Response) => {
  try {
    const { description } = req.body;
    if (!description) {
      res.status(400).json({ error: '缺少描述' });
      return;
    }
    const result = await quickCreateRole(description);
    res.json(result);
  } catch (error) {
    console.error('Quick create role error:', error);
    res.status(500).json({ error: 'AI快速创建角色失败' });
  }
});

/**
 * POST /api/ai/quick-create-knowledge
 * 输入一句话描述，AI 快速创建知识条目
 */
router.post('/quick-create-knowledge', async (req: AuthRequest, res: Response) => {
  try {
    const { description } = req.body;
    if (!description) {
      res.status(400).json({ error: '缺少描述' });
      return;
    }
    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || '',
      baseURL: process.env.DEEPSEEK_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.deepseek.com',
    });
    const prompt = `你是一个石油天然气行业的销售培训专家。请根据以下一句话描述，生成一份销售知识条目。

描述：${description}

请按照以下JSON格式输出（直接输出JSON，不要markdown代码块）：
{
  "question": "知识条目的标题/问题（简洁明了，20字以内）",
  "answer": "详细的知识内容。要求：结构清晰、有实战价值、包含具体话术示例和步骤。300-500字，markdown格式。",
  "category": "分类（如：销售技巧/销售话术/客户关系/行业知识/对话技巧等）",
  "tags": "标签（逗号分隔，3-5个）"
}

要求：
1. question 要是销售代表真正会问的问题或关心的主题
2. answer 要有具体可执行的内容，不要空泛理论
3. 包含实战话术示例
4. 聚焦石油天然气行业的外贸B2B场景`;
    
    const completion = await openai.chat.completions.create({
      model: process.env.DEEPSEEK_MODEL || process.env.OPENAI_MODEL || 'deepseek-v4-flash',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      max_tokens: 2048,
    }, { timeout: 120000 });
    
    const content = completion.choices[0]?.message?.content || '{}';
    const cleaned = content.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    const jsonStart = cleaned.indexOf('{');
    const jsonEnd = cleaned.lastIndexOf('}');
    const result = jsonStart >= 0 && jsonEnd > jsonStart ? JSON.parse(cleaned.slice(jsonStart, jsonEnd + 1)) : {};
    
    res.json(result);
  } catch (error) {
    console.error('Quick create knowledge error:', error);
    res.status(500).json({ error: 'AI快速创建知识条目失败' });
  }
});

export default router;
