import axios from 'axios';
import { q } from '../db';

export interface RawItemForAnalysis {
  id: number;
  title: string;
  content: string;
  source: string;
}

export interface AnalysisResult {
  id: number;
  score: number;
  summary: string;
  category: 'model-release' | 'tool-update' | 'research' | 'funding' | 'discussion' | 'other';
}

export interface KeywordVerifyResult {
  matched: boolean;
  confidence: number;
  reason: string;
}

function getApiKey(): string {
  return q.getSetting('openrouter_api_key') || process.env.OPENROUTER_API_KEY || '';
}

function getModel(): string {
  return q.getSetting('openrouter_model') || process.env.OPENROUTER_MODEL || 'deepseek/deepseek-chat';
}

async function chat(userPrompt: string): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('OpenRouter API key not configured');

  const response = await axios.post(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      model: getModel(),
      messages: [{ role: 'user', content: userPrompt }],
      temperature: 0.1,
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'http://localhost:3001',
        'X-OpenRouter-Title': 'Jitang Hot Monitor',
        'Content-Type': 'application/json',
      },
      timeout: 45000,
    }
  );

  return response.data.choices[0].message.content as string;
}

function safeParseJSON<T>(text: string, fallback: T): T {
  try {
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return fallback;
  }
}

export async function analyzeItems(items: RawItemForAnalysis[]): Promise<AnalysisResult[]> {
  if (items.length === 0) return [];

  const itemsText = items
    .map((item, i) => `${i + 1}. [${item.source}] ${item.title}\n${(item.content || '').slice(0, 300)}`)
    .join('\n\n');

  const prompt = `你是科技/AI领域热点分析专家，服务对象是AI编程博主。分析以下新闻条目并评估热度。

${itemsText}

对每个条目返回JSON数组，字段：
- index: 条目编号(从1开始)
- score: 热度分数 1-10（10=必看重磅新闻如GPT-5发布、Claude 4等；7-9=重要更新；4-6=一般资讯；1-3=无关紧要）
- summary: 一句话中文摘要（不超过30字，突出核心价值）
- category: 必须是以下之一：model-release(模型发布/更新)、tool-update(工具/产品更新)、research(研究/论文)、funding(融资/商业)、discussion(社区讨论)、other(其他)

只返回合法JSON数组，不要其他任何文字：`;

  const response = await chat(prompt);
  const results = safeParseJSON<Array<{ index: number; score: number; summary: string; category: string }>>(
    response,
    []
  );

  if (results.length === 0) {
    return items.map((item) => ({
      id: item.id,
      score: 5,
      summary: item.title.slice(0, 40),
      category: 'other' as const,
    }));
  }

  return results
    .map((r) => ({
      id: items[r.index - 1]?.id,
      score: Math.min(10, Math.max(1, r.score || 5)),
      summary: r.summary || '',
      category: (r.category as AnalysisResult['category']) || 'other',
    }))
    .filter((r) => r.id !== undefined) as AnalysisResult[];
}

export async function verifyKeywordMatch(
  content: string,
  keyword: string
): Promise<KeywordVerifyResult> {
  const prompt = `判断以下内容是否真正在讨论关键词："${keyword}"

内容：${content.slice(0, 800)}

判断标准：
- matched=true：内容实质性讨论了这个具体的事件/产品/话题，不是泛泛提及
- matched=false：标题党、无关提及、或内容与关键词没有实质联系
- confidence：0.0-1.0，你的判断确信程度

只返回JSON，不要其他文字：{"matched":true,"confidence":0.85,"reason":"简短理由"}`;

  try {
    const response = await chat(prompt);
    const result = safeParseJSON<KeywordVerifyResult>(response, {
      matched: false,
      confidence: 0,
      reason: 'parse error',
    });
    return result;
  } catch {
    const matched = content.toLowerCase().includes(keyword.toLowerCase());
    return { matched, confidence: 0.5, reason: 'AI unavailable, text match fallback' };
  }
}
