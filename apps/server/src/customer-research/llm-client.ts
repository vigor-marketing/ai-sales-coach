// @ts-nocheck -- 移植自 customer-research-backend 的零依赖纯 JS 模块（v1 保留原样，后续逐步补全类型）
// 通用 OpenAI 兼容 LLM 客户端 + 多 provider 配置加载
// 安全约束：
//   1. API Key 仅来自环境变量或项目外 .runtime-secrets/<provider>.env（已 gitignore，权限 0600），绝不写入源码或前端。
//   2. 本文件不发送任何测试请求，调用由编排器显式触发。
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 各 provider 的默认值（仅 deepseek 有官方默认；openai/gpt 必须显式配置 baseUrl+model）
const DEFAULTS = {
  deepseek: { baseUrl: 'https://api.deepseek.com', model: 'deepseek-v4-flash' },
  openai: { baseUrl: '', model: '' }
};

// 工厂：给定配置返回一个 OpenAI 兼容的 complete() 客户端
export function createOpenAIClient(cfg) {
  return {
    label: cfg.label || cfg.model,
    model: cfg.model,
    async complete(messages, opts = {}) {
      if (!cfg.apiKey || !cfg.baseUrl || !cfg.model) {
        throw new Error(`[llm-client] provider "${cfg.label}" 未完整配置（缺少 apiKey/baseUrl/model）`);
      }
      const payload = {
        model: cfg.model,
        messages,
        temperature: opts.temperature ?? 0.2,
        stream: false
      };
      if (opts.json) payload.response_format = { type: 'json_object' };

      const res = await fetch(`${cfg.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cfg.apiKey}`
        },
        body: JSON.stringify(payload),
        signal: opts.signal
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`${cfg.label} API ${res.status}: ${text.slice(0, 240)}`);
      }

      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content;
      if (typeof content !== 'string') {
        throw new Error(`${cfg.label} 返回结构异常：缺少 choices[0].message.content`);
      }
      return content;
    }
  };
}

// 从环境变量或 .runtime-secrets/<name>.env(0600) 读取 provider 配置
export function loadProviderConfig(name) {
  const U = name.toUpperCase();
  const config = {
    label: name,
    apiKey: process.env[`${U}_API_KEY`] || '',
    baseUrl: process.env[`${U}_BASE_URL`] || '',
    model: process.env[`${U}_MODEL`] || ''
  };

  // 后备：从项目根 .runtime-secrets/<name>.env(0600) 读取
  // 解析基准：src/llm-client.js 上溯一层即到包根（customer-research-backend/.runtime-secrets）。
  // 可用环境变量 RUNTIME_SECRETS_DIR 指定绝对目录以覆盖默认解析。
  if (!config.apiKey || !config.baseUrl || !config.model) {
    try {
      const baseDir = process.env.RUNTIME_SECRETS_DIR
        ? process.env.RUNTIME_SECRETS_DIR
        : join(__dirname, '..', '.runtime-secrets');
      const envPath = join(baseDir, `${name}.env`);
      const raw = readFileSync(envPath, 'utf8');
      for (const line of raw.split('\n')) {
        // 键名大小写不敏感（兼容 DEEPSEEK_API_KEY 与 deepseek_api_key 两种写法）
        const m = line.match(/^\s*([A-Za-z_]+)\s*=\s*(.*)\s*$/);
        if (m) {
          const key = m[1].toLowerCase();
          const val = m[2].replace(/^["']|["']$/g, '');
          if (key === `${name}_api_key`) config.apiKey = val;
          if (key === `${name}_base_url`) config.baseUrl = val;
          if (key === `${name}_model`) config.model = val;
        }
      }
    } catch {
      // 忽略：回退到环境变量 / 默认值
    }
  }

  // 应用默认值（仅 deepseek）
  const def = DEFAULTS[name];
  if (def) {
    if (!config.baseUrl) config.baseUrl = def.baseUrl;
    if (!config.model) config.model = def.model;
  }

  config.hasKey = Boolean(config.apiKey && config.baseUrl && config.model);
  return config;
}

// 构建可用客户端；未配置则返回 null（供调用方决定回退）
export function buildClient(name) {
  const cfg = loadProviderConfig(name);
  if (!cfg.hasKey) return null;
  return createOpenAIClient(cfg);
}
