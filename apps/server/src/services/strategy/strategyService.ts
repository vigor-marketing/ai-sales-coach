import fs from 'fs';
import path from 'path';
import { prisma } from '../../utils/prisma.js';

const DATA_DIR = path.resolve(process.cwd(), 'data/strategy-insights');

interface StrategyInsight {
  id: string;
  roleId: string;
  category: 'sales_tactic' | 'weakness' | 'success_pattern' | 'response_pattern' | 'daily_summary';
  content: string;
  sourceSessionId: string;
  createdAt: string;
}

interface DailySessionInfo {
  id: string;
  score?: number;
  completedAt: string;
}

interface DailySummary {
  date: string;
  summary: string;
  sessionCount: number;
  sessions: DailySessionInfo[];
}

interface RoleStrategy {
  roleId: string;
  totalSessions: number;
  lastUpdated: string;
  insights: StrategyInsight[];
  dailySummaries: DailySummary[];
}

function ensureDataDir() {
  const dir = DATA_DIR;
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getFilePath(roleId: string): string {
  return path.join(DATA_DIR, `${roleId}.json`);
}

function loadStrategy(roleId: string): RoleStrategy {
  const filePath = getFilePath(roleId);
  if (!fs.existsSync(filePath)) {
    return {
      roleId,
      totalSessions: 0,
      lastUpdated: new Date().toISOString(),
      insights: [],
      dailySummaries: [],
    };
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return {
      roleId,
      totalSessions: 0,
      lastUpdated: new Date().toISOString(),
      insights: [],
      dailySummaries: [],
    };
  }
}

function saveStrategy(data: RoleStrategy) {
  ensureDataDir();
  fs.writeFileSync(getFilePath(data.roleId), JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Generate strategy insights after a conversation is evaluated.
 * Called from the evaluation route when a report is created.
 */
export async function generateInsights(sessionId: string): Promise<void> {
  try {
    const session = await prisma.trainingSession.findUnique({
      where: { id: sessionId },
      include: {
        role: true,
        messages: { orderBy: { createdAt: 'asc' } },
        report: true,
      },
    });

    if (!session || !session.report) return;

    const transcript = session.messages
      .filter(m => m.role !== 'SYSTEM')
      .map(m => `${m.role === 'USER' ? '销售代表' : '客户'}: ${m.content}`)
      .join('\n');

    // Build insight prompt
    const insightPrompt = `你是一个AI销售陪练的策略分析师。请分析以下对话，提取可用于优化AI客户应对策略的洞察。

## 角色信息
${session.role.name} (${session.role.position}, ${session.role.region})

## 对话记录
${transcript}

## 评估结果
- 总分：${session.report.overallScore}
- 优点：${session.report.strengths}
- 不足：${session.report.weaknesses}

请提取以下四个维度的洞察（每条1-2句话）：

1. **sales_tactic**：销售代表使用了哪些有效的销售技巧？（例如SPIN提问、FAB利益陈述等）
2. **weakness**：销售代表暴露出了哪些弱点或常见错误？（例如未主动挖掘需求、回答笼统）
3. **success_pattern**：AI客户哪些回应方式有效迫使了销售代表改进？
4. **response_pattern**：AI客户哪些回应方式效果不佳或可以被改进？

按照以下JSON格式输出（不要markdown代码块，直接输出JSON）：
{
  "sales_tactic": "洞察内容",
  "weakness": "洞察内容",
  "success_pattern": "洞察内容",
  "response_pattern": "洞察内容"
}`;

    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({ 
      apiKey: process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || '',
      baseURL: process.env.DEEPSEEK_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.deepseek.com',
    });
    
    const completion = await openai.chat.completions.create({
      model: process.env.DEEPSEEK_MODEL || process.env.OPENAI_MODEL || 'deepseek-v4-flash',
      messages: [{ role: 'user', content: insightPrompt }],
      temperature: 0.4,
      max_tokens: 800,
    });

    const content = completion.choices[0]?.message?.content || '';
    let parsed: Record<string, string> = {};
    try {
      const cleaned = content.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      const jsonStart = cleaned.indexOf('{');
      const jsonEnd = cleaned.lastIndexOf('}');
      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        parsed = JSON.parse(cleaned.slice(jsonStart, jsonEnd + 1));
      }
    } catch { /* skip parse errors */ }

    if (!parsed.sales_tactic && !parsed.weakness && !parsed.success_pattern && !parsed.response_pattern) {
      return; // No useful insights generated
    }

    // Load existing strategy
    const strategy = loadStrategy(session.roleId);
    strategy.totalSessions++;
    strategy.lastUpdated = new Date().toISOString();

    const now = new Date();
    const todayKey = now.toISOString().slice(0, 10);

    // Look up session score from the report
    let sessionScore: number | undefined;
    try {
      const report = await prisma.report.findUnique({ where: { sessionId }, select: { overallScore: true } });
      if (report) sessionScore = report.overallScore;
    } catch {}

    // Add daily summary
    const existingSummary = strategy.dailySummaries.find(s => s.date === todayKey);
    if (!existingSummary) {
      // Generate daily summary on first session of the day
      strategy.dailySummaries.unshift({
        date: todayKey,
        summary: `共 ${1} 次陪练会话`,
        sessionCount: 1,
        sessions: [{ id: sessionId, score: sessionScore, completedAt: now.toISOString() }],
      });
      // Keep only last 30 days
      if (strategy.dailySummaries.length > 30) {
        strategy.dailySummaries = strategy.dailySummaries.slice(0, 30);
      }
    } else {
      existingSummary.sessionCount++;
      existingSummary.summary = `共 ${existingSummary.sessionCount} 次陪练会话`;
      existingSummary.sessions.unshift({ id: sessionId, score: sessionScore, completedAt: now.toISOString() });
    }

    // Add insights (max 100 per role, keep newest)
    for (const [cat, insight] of Object.entries(parsed)) {
      if (!insight || insight.trim().length < 10) continue;
      strategy.insights.push({
        id: `${sessionId}-${cat}`,
        roleId: session.roleId,
        category: cat as StrategyInsight['category'],
        content: insight.trim(),
        sourceSessionId: sessionId,
        createdAt: now.toISOString(),
      });
    }

    // Keep only latest 100 insights
    if (strategy.insights.length > 100) {
      strategy.insights = strategy.insights.slice(-100);
    }

    saveStrategy(strategy);
    console.log(`[Strategy] Insights saved for role ${session.role.name} (${session.roleId.slice(0,8)})`);
  } catch (error) {
    console.error('[Strategy] Failed to generate insights:', error);
  }
}

/**
 * Get accumulated strategy insights for a role, formatted as a string
 * to inject into the behavior prompt.
 */
export function getInsightsForPrompt(roleId: string): string {
  const strategy = loadStrategy(roleId);
  if (strategy.insights.length === 0) return '';

  // Take only the most relevant insights (last 5 of each category)
  const categories = ['sales_tactic', 'weakness', 'success_pattern', 'response_pattern'] as const;
  const parts: string[] = [];

  for (const cat of categories) {
    const items = strategy.insights.filter(i => i.category === cat).slice(-5);
    if (items.length === 0) continue;

    const labelMap: Record<string, string> = {
      sales_tactic: '销售代表常用技巧（注意识别）',
      weakness: '销售代表常见弱点（可针对性施压）',
      success_pattern: '你之前有效的应对策略（继续保持）',
      response_pattern: '你之前效果不佳的应对策略（需改进）',
    };

    parts.push(`【${labelMap[cat] || cat}】`);
    items.forEach((item, i) => {
      parts.push(`${i + 1}. ${item.content}`);
    });
  }

  if (parts.length === 0) return '';

  const header = `## 策略优化记录（基于${strategy.totalSessions}次对话积累）\n以下是从以往对话中学习到的经验，应该被你用来优化本次应对策略：\n`;
  return header + parts.join('\n');
}

/**
 * Get daily conversation log summary for display.
 */
export function getDailyLog(roleId: string, days: number = 7): string {
  const strategy = loadStrategy(roleId);
  if (strategy.dailySummaries.length === 0) return '暂无对话记录';

  const recent = strategy.dailySummaries.slice(0, days);
  const lines = recent.map(s => `  ${s.date}: ${s.summary}`);
  return `最近 ${days} 天对话记录（共 ${strategy.totalSessions} 次):\n${lines.join('\n')}`;
}
