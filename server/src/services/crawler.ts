import axios from 'axios';
import RSSParser from 'rss-parser';
import { q } from '../db';

const rss = new RSSParser({
  timeout: 15000,
  headers: { 'User-Agent': 'Mozilla/5.0 (compatible; JitangHotMonitor/1.0; +http://localhost)' },
});

// Reddit blocks generic bot UA — use a browser-like UA for Reddit RSS
const rssReddit = new RSSParser({
  timeout: 15000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0',
    'Accept': 'application/rss+xml, application/xml, text/xml, */*',
  },
});

interface RawItem {
  source: string;
  title: string;
  url: string;
  content: string;
  published_at: string;
}

// ── HackerNews ──────────────────────────────────────────────────────────────

async function crawlHackerNews(): Promise<RawItem[]> {
  try {
    const { data: ids } = await axios.get<number[]>(
      'https://hacker-news.firebaseio.com/v0/topstories.json',
      { timeout: 10000 }
    );

    const top30 = ids.slice(0, 30);
    const settled = await Promise.allSettled(
      top30.map((id) =>
        axios.get(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, { timeout: 5000 })
      )
    );

    return settled
      .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
      .map((r) => r.value.data)
      .filter((item) => item?.title && (item.url || item.id))
      .map((item) => ({
        source: 'HackerNews',
        title: item.title,
        url: item.url || `https://news.ycombinator.com/item?id=${item.id}`,
        content: item.text || '',
        published_at: new Date((item.time || 0) * 1000).toISOString(),
      }));
  } catch (e) {
    console.warn('[Crawler] HackerNews failed:', (e as Error).message);
    return [];
  }
}

// ── RSS 通用 ─────────────────────────────────────────────────────────────────

async function crawlRSS(
  url: string,
  source: string,
  limit = 15,
  parser = rss
): Promise<RawItem[]> {
  try {
    const feed = await parser.parseURL(url);
    return (feed.items || []).slice(0, limit).map((item) => ({
      source,
      title: item.title || '',
      url: item.link || '',
      content: item.contentSnippet || item.content || '',
      published_at: item.pubDate || new Date().toISOString(),
    }));
  } catch (e) {
    console.warn(`[Crawler] ${source} failed:`, (e as Error).message);
    return [];
  }
}

// ── OpenRouter 新模型检测 ─────────────────────────────────────────────────────

interface ORModel {
  id: string;
  name: string;
  context_length: number;
  created: number;
  pricing?: { prompt: string; completion: string };
}

export async function crawlOpenRouterModels(): Promise<number> {
  const apiKey = q.getSetting('openrouter_api_key') || process.env.OPENROUTER_API_KEY || '';
  if (!apiKey) {
    console.warn('[Crawler] OpenRouter API key not set, skipping model check');
    return 0;
  }

  try {
    const { data } = await axios.get<{ data: ORModel[] }>(
      'https://openrouter.ai/api/v1/models',
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: 15000,
      }
    );

    const models = data.data || [];
    const isFirstRun = q.getKnownModelCount() === 0;
    let newCount = 0;

    for (const model of models) {
      if (q.isModelKnown(model.id)) continue;

      // Register in known_models
      const provider = model.id.split('/')[0] || '';
      q.insertKnownModel.run(model.id, model.name, provider, model.context_length || 0);

      // Skip creating hot_topic on the very first run (would flood with all 300+ models)
      if (isFirstRun) continue;

      newCount++;

      // Insert as raw_item so it goes through the normal AI analysis pipeline
      const isFreeModel = parseFloat(model.pricing?.prompt || '1') === 0;
      const title = `🆕 OpenRouter 新模型上线: ${model.name}`;
      const content = [
        `模型ID: ${model.id}`,
        `提供商: ${provider}`,
        `上下文长度: ${model.context_length?.toLocaleString() || '未知'} tokens`,
        isFreeModel ? '价格: 免费' : `价格: $${model.pricing?.prompt}/token (输入)`,
      ].join('\n');

      q.insertRawItem.run(
        'OpenRouter',
        title.slice(0, 500),
        `https://openrouter.ai/${model.id}`,
        content,
        model.created ? new Date(model.created * 1000).toISOString() : new Date().toISOString()
      );
    }

    if (isFirstRun) {
      console.log(`[Crawler] OpenRouter: first run, seeded ${models.length} known models`);
    } else if (newCount > 0) {
      console.log(`[Crawler] OpenRouter: ${newCount} new model(s) detected`);
    }

    return newCount;
  } catch (e) {
    console.warn('[Crawler] OpenRouter models failed:', (e as Error).message);
    return 0;
  }
}

// ── Twitter/X ─────────────────────────────────────────────────────────────────

export async function crawlTwitter(): Promise<number> {
  const bearerToken =
    q.getSetting('twitter_bearer_token') || process.env.TWITTER_BEARER_TOKEN || '';
  const enabled = q.getSetting('twitter_enabled') === 'true';

  if (!enabled || !bearerToken) return 0;

  try {
    // Dynamic import to avoid error when package not installed
    const { TwitterApi } = await import('twitter-api-v2');
    const client = new TwitterApi(bearerToken);

    // Build query from active keywords + base AI terms
    const keywords = (q.getActiveKeywords() as any[]).map((k) => k.keyword);
    const aiTerms = ['GPT-5', 'Claude', 'Gemini', 'LLM', 'AI model', 'OpenAI', 'Anthropic'];
    const allTerms = [...new Set([...keywords, ...aiTerms])];

    // Twitter search query: OR join, exclude retweets, lang filter
    const query =
      `(${allTerms.slice(0, 10).map((t) => `"${t}"`).join(' OR ')}) -is:retweet lang:zh OR lang:en`;

    const result = await client.v2.search(query, {
      max_results: 20,
      'tweet.fields': ['created_at', 'text', 'public_metrics'],
      expansions: ['author_id'],
      'user.fields': ['name', 'username', 'verified'],
    });

    let inserted = 0;
    for (const tweet of result.data?.data || []) {
      const author = result.data?.includes?.users?.find((u) => u.id === tweet.author_id);
      const authorName = author ? `@${author.username}` : 'Unknown';
      const url = `https://twitter.com/i/web/status/${tweet.id}`;
      const title = `[Twitter] ${authorName}: ${tweet.text.slice(0, 100)}`;

      const res = q.insertRawItem.run(
        'Twitter/X',
        title.slice(0, 500),
        url,
        tweet.text.slice(0, 2000),
        tweet.created_at || new Date().toISOString()
      );
      if ((res as any).changes > 0) inserted++;
    }

    console.log(`[Crawler] Twitter: ${inserted} new tweets`);
    return inserted;
  } catch (e) {
    console.warn('[Crawler] Twitter failed:', (e as Error).message);
    return 0;
  }
}

// ── 主入口 ───────────────────────────────────────────────────────────────────

export async function crawlAll(): Promise<number> {
  console.log('[Crawler] Starting crawl...');

  const [rssResults, orNew, twNew] = await Promise.all([
    Promise.all([
      crawlHackerNews(),
      // Reddit: use old.reddit.com + browser UA to avoid 403
      crawlRSS('https://old.reddit.com/r/MachineLearning/.rss', 'Reddit/MachineLearning', 15, rssReddit),
      crawlRSS('https://old.reddit.com/r/LocalLLaMA/.rss', 'Reddit/LocalLLaMA', 15, rssReddit),
      crawlRSS('https://old.reddit.com/r/artificial/.rss', 'Reddit/artificial', 15, rssReddit),
      crawlRSS('https://huggingface.co/blog/feed.xml', 'HuggingFace Blog', 10),
      // The Verge AI: updated URL
      crawlRSS('https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', 'The Verge AI', 10),
      crawlRSS('https://feeds.feedburner.com/venturebeat/SZYF', 'VentureBeat AI', 10),
    ]),
    crawlOpenRouterModels(),
    crawlTwitter(),
  ]);

  const allItems = rssResults.flat().filter((item) => item.title && item.url);

  let inserted = 0;
  for (const item of allItems) {
    const result = q.insertRawItem.run(
      item.source,
      item.title.slice(0, 500),
      item.url.slice(0, 1000),
      (item.content || '').slice(0, 2000),
      item.published_at
    );
    if ((result as any).changes > 0) inserted++;
  }

  const total = inserted + orNew + twNew;
  console.log(`[Crawler] Done. RSS: ${inserted} | OpenRouter: ${orNew} | Twitter: ${twNew} new`);
  return total;
}
