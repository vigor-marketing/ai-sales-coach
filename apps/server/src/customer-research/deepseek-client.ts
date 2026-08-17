// @ts-nocheck -- 移植自 customer-research-backend 的零依赖纯 JS 模块（v1 保留原样，后续逐步补全类型）
// DeepSeek API 客户端（OpenAI 兼容 /chat/completions）
// 现已基于通用 llm-client.js 实现；保留 callDeepSeek / getConfig 导出以兼容编排器与其他调用方。
// 安全约束：API Key 仅来自环境变量或项目外 .runtime-secrets/deepseek.env（0600），绝不写入源码或前端。
import { buildClient, loadProviderConfig, createOpenAIClient } from './llm-client.js';

export function getConfig() {
  const c = loadProviderConfig('deepseek');
  return { baseUrl: c.baseUrl, model: c.model, hasKey: c.hasKey };
}

// 向 DeepSeek 发起一次对话补全（向后兼容封装）
export async function callDeepSeek(messages, opts = {}) {
  let client = buildClient('deepseek');
  if (!client) {
    // 兜底：即使 baseUrl/model 取默认值也要能构造（仅缺 key 时报错）
    const cfg = loadProviderConfig('deepseek');
    client = createOpenAIClient(cfg);
  }
  return client.complete(messages, opts);
}
