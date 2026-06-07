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
  reason: string;
  authenticity: 'real' | 'suspicious' | 'unknown';
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
- reason: 一句话说明为什么值得关注/给出这个分数（不超过20字，例如"性能超越GPT-4"、"首个开源多模态模型"、"行业影响有限"）
- authenticity: 对信息可信度的判断，必须是以下之一：real(信息源可靠、有实质内容)、suspicious(疑似营销软文/标题党/未经证实的传闻)、unknown(信息不足以判断)

只返回合法JSON数组，不要其他任何文字：`;

  const response = await chat(prompt);
  const results = safeParseJSON<Array<{ index: number; score: number; summary: string; category: string; reason: string; authenticity: string }>>(
    response,
    []
  );

  if (results.length === 0) {
    return items.map((item) => ({
      id: item.id,
      score: 5,
      summary: item.title.slice(0, 40),
      category: 'other' as const,
      reason: '',
      authenticity: 'unknown' as const,
    }));
  }

  return results
    .map((r) => ({
      id: items[r.index - 1]?.id,
      score: Math.min(10, Math.max(1, r.score || 5)),
      summary: r.summary || '',
      category: (r.category as AnalysisResult['category']) || 'other',
      reason: r.reason || '',
      authenticity: (['real', 'suspicious', 'unknown'].includes(r.authenticity) ? r.authenticity : 'unknown') as AnalysisResult['authenticity'],
    }))
    .filter((r) => r.id !== undefined) as AnalysisResult[];
}

export async function verifyKeywordMatch(
  content: string,
  keyword: string
): Promise<KeywordVerifyResult> {
  const prompt = `你是信息相关性审核专家。判断下面这条内容，是否「实质性地围绕」关键词："${keyword}" 展开。

内容：${content.slice(0, 800)}

请严格按以下标准判断（宁缺毋滥，不确定时倾向 matched=false）：

✅ matched=true 的情形：
- 内容的主题/核心讨论对象就是这个关键词所指代的具体事件、产品、人物或话题
- 即使没有逐字出现关键词，但明显在讨论同一件事（例如关键词"Claude Sonnet 4.6"，内容详细介绍了该模型的性能、发布信息等）

❌ matched=false 的情形（重点警惕的假阳性陷阱）：
- 内容只是在列表/对比/盘点中"顺带提到"关键词，但实际通篇讨论的是别的主体（例如关键词是"Claude Sonnet 4.6"，但内容实际是在介绍 OpenAI 新模型，只在开头一句"相比 Claude 4.6..."中提及）
- 标题包含关键词，但正文跑题、文不对题（标题党）
- 关键词只是作为背景信息/同类产品举例出现，不是内容的核心
- 内容讨论的是同一公司/同一系列的其他产品或版本，而非关键词指代的具体对象

返回字段：
- matched: 是否实质性匹配
- confidence: 0.0-1.0，你的确信程度
- reason: 简短说明判断依据（如"通篇围绕该模型的发布与性能展开"或"仅在对比表格中提及一次，正文讨论的是另一款产品"），这段话会直接展示给用户帮助理解匹配原因

只返回JSON，不要其他文字：{"matched":true,"confidence":0.85,"reason":"简短理由"}`;

  const response = await chat(prompt);
  const parsed = safeParseJSON<KeywordVerifyResult | null>(response, null);
  if (!parsed || typeof parsed.matched !== 'boolean') {
    throw new Error('AI 返回内容解析失败');
  }
  return parsed;
}

/**
 * 带缓存的关键词相关性验证：以 (url, keyword) 为键缓存 AI 判断结果，
 * 避免对同一条内容在重复扫描中反复调用 AI（同一 URL 的内容基本不会变化，可放心长期复用）。
 * - 命中缓存：直接返回，不调用 AI
 * - 未命中：调用 verifyKeywordMatch，仅在 AI 给出有效判断时写入缓存
 * - AI 调用失败（网络/解析错误）：按"未匹配"处理（宁缺毋滥），但不写入缓存，留待下次重试
 * - url 为空时不缓存（避免不同内容在空 key 下相互覆盖）
 */
export async function verifyWithCache(
  url: string,
  content: string,
  keyword: string
): Promise<KeywordVerifyResult> {
  if (url) {
    const cached = q.getCachedVerification(url, keyword);
    if (cached) {
      return { matched: !!cached.matched, confidence: cached.confidence, reason: cached.reason };
    }
  }

  try {
    const result = await verifyKeywordMatch(content, keyword);
    if (url) {
      q.upsertVerificationCache.run(url, keyword, result.matched ? 1 : 0, result.confidence, result.reason);
    }
    return result;
  } catch (e) {
    return { matched: false, confidence: 0, reason: `AI 验证失败（${(e as Error).message}），按未匹配处理` };
  }
}

/**
 * 基于关键词生成语义相近的扩展词（同义改写/别名/常见说法变体），
 * 用于扩大检索召回范围与预筛选匹配范围，避免因严格子串匹配漏掉语义相关内容。
 * 仅在关键词创建/编辑时调用一次，结果缓存于 keywords.expanded_terms。
 */
export async function expandKeywordTerms(keyword: string): Promise<string[]> {
  const prompt = `给定一个监控关键词，生成 4-6 个与它语义等价或高度相关的常见说法/别名/变体写法，用于扩大搜索召回范围。

关键词："${keyword}"

要求：
- 包含同义改写、常见简称/全称互换、中英文变体、相关常见搭配等
- 每个扩展词都应该足够具体，仍然指向同一个事件/产品/话题，不要泛化到无关主题
- 不要包含和原关键词完全相同的词
- 重要：如果关键词中包含产品名/型号/代号（如"Sonnet"、"Opus"、"导航"中的专有名词部分），把它当作固定标识符保留原样，不要按字面意思翻译或意译（例如不要把"Sonnet"翻译成"十四行诗/Poem"）——只对其中的描述性词语做同义改写

例如关键词"鱼皮的 AI 导航"，可以生成：["程序员鱼皮的AI导航","AI导航鱼皮","鱼皮AI编程教程","鱼皮AI网站导航"]
例如关键词"Claude Sonnet 4.6"，可以生成：["Claude 4.6 Sonnet","Anthropic Claude Sonnet 4.6","Claude-Sonnet-4.6","新版 Claude Sonnet"]（保留"Sonnet"作为型号标识符不翻译）

只返回JSON字符串数组，不要其他文字：["扩展词1","扩展词2","扩展词3"]`;

  try {
    const response = await chat(prompt);
    const result = safeParseJSON<string[]>(response, []);
    if (!Array.isArray(result)) return [];
    return result
      .filter((t): t is string => typeof t === 'string' && t.trim().length > 0 && t.trim() !== keyword.trim())
      .slice(0, 6);
  } catch (e) {
    console.warn('[AI] expandKeywordTerms failed:', (e as Error).message);
    return [];
  }
}
