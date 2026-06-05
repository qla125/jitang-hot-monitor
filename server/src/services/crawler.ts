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

// ── Twitter/X (via twitterapi.io) ────────────────────────────────────────────

export async function crawlTwitter(): Promise<number> {
  const apiKey = q.getSetting('twitterapi_io_key') || process.env.TWITTERAPI_IO_KEY || '';
  const enabled = q.getSetting('twitterapi_io_enabled') === 'true' || !!process.env.TWITTERAPI_IO_KEY;
  if (!enabled || !apiKey) return 0;

  try {
    const keywords = (q.getActiveKeywords() as any[]).map((k: any) => k.keyword);
    const aiTerms = ['GPT-5', 'Claude', 'Gemini', 'LLM', 'OpenAI', 'Anthropic', 'AI model'];
    const allTerms = [...new Set([...keywords, ...aiTerms])];

    const query = allTerms.slice(0, 8).map((t) => `"${t}"`).join(' OR ');

    const { data } = await axios.get(
      'https://api.twitterapi.io/twitter/tweet/advanced_search',
      {
        params: { query, queryType: 'Top' },
        headers: { 'x-api-key': apiKey },
        timeout: 15000,
      }
    );

    let inserted = 0;
    for (const tweet of (data.tweets || []) as any[]) {
      // 严格质量过滤
      if ((tweet.likeCount || 0) < 50) continue;
      if ((tweet.retweetCount || 0) < 20) continue;
      if ((tweet.viewCount || 0) < 2000) continue;
      // 只保留原创推文，过滤回复 / 引用 / 转推
      if (tweet.isReply === true) continue;
      if (tweet.retweeted_tweet != null) continue;
      if (tweet.quoted_tweet != null) continue;
      // 作者粉丝数过滤
      if ((tweet.author?.followers || 0) < 500) continue;

      const authorName = tweet.author?.userName ? `@${tweet.author.userName}` : 'Unknown';
      const url = tweet.url || `https://twitter.com/i/web/status/${tweet.id}`;
      const title = `[Twitter] ${authorName}: ${(tweet.text || '').slice(0, 100)}`;

      const res = q.insertRawItem.run(
        'Twitter/X',
        title.slice(0, 500),
        url.slice(0, 1000),
        (tweet.text || '').slice(0, 2000),
        tweet.createdAt || new Date().toISOString()
      );
      if ((res as any).changes > 0) inserted++;
    }

    console.log(`[Crawler] Twitter: ${inserted} new tweets (quality filtered)`);
    return inserted;
  } catch (e) {
    console.warn('[Crawler] Twitter failed:', (e as Error).message);
    return 0;
  }
}

// ── Serper.dev Google 新闻 ────────────────────────────────────────────────────

export async function crawlSerperNews(): Promise<number> {
  const apiKey = q.getSetting('serper_api_key') || process.env.SERPER_API_KEY || '';
  if (!apiKey) return 0;

  try {
    const { data } = await axios.post(
      'https://google.serper.dev/news',
      { q: 'AI artificial intelligence LLM large language model', gl: 'us', hl: 'en', num: 10 },
      {
        headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
        timeout: 15000,
      }
    );

    let inserted = 0;
    for (const item of (data.news || []) as any[]) {
      if (!item.title || !item.link) continue;
      let publishedAt = new Date().toISOString();
      try { if (item.date) publishedAt = new Date(item.date).toISOString(); } catch { /* fallback */ }

      const res = q.insertRawItem.run(
        'Google News',
        item.title.slice(0, 500),
        item.link.slice(0, 1000),
        (item.snippet || '').slice(0, 2000),
        publishedAt
      );
      if ((res as any).changes > 0) inserted++;
    }

    console.log(`[Crawler] Google News (Serper): ${inserted} new items`);
    return inserted;
  } catch (e) {
    console.warn('[Crawler] Serper News failed:', (e as Error).message);
    return 0;
  }
}

// ── GitHub Trending ───────────────────────────────────────────────────────────

export async function crawlGithubTrending(): Promise<number> {
  try {
    const since = new Date();
    since.setDate(since.getDate() - 7);
    const sinceDate = since.toISOString().split('T')[0];

    const { data } = await axios.get(
      'https://api.github.com/search/repositories',
      {
        params: {
          q: `topic:llm OR topic:ai-agent OR topic:large-language-model OR topic:generative-ai pushed:>${sinceDate} stars:>50`,
          sort: 'stars',
          order: 'desc',
          per_page: 10,
        },
        headers: {
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'JitangHotMonitor/1.0',
        },
        timeout: 15000,
      }
    );

    let inserted = 0;
    for (const repo of (data.items || []) as any[]) {
      const stars = (repo.stargazers_count || 0).toLocaleString();
      const desc = (repo.description || '').slice(0, 80);
      const title = `[GitHub] ${repo.full_name} ⭐${stars}${desc ? ' — ' + desc : ''}`;
      const content = [
        repo.description || '',
        `语言: ${repo.language || 'N/A'}`,
        `Stars: ${repo.stargazers_count}`,
        `Topics: ${(repo.topics || []).join(', ')}`,
      ].join('\n');

      const res = q.insertRawItem.run(
        'GitHub Trending',
        title.slice(0, 500),
        repo.html_url,
        content.slice(0, 2000),
        repo.pushed_at || new Date().toISOString()
      );
      if ((res as any).changes > 0) inserted++;
    }

    console.log(`[Crawler] GitHub Trending: ${inserted} new repos`);
    return inserted;
  } catch (e) {
    console.warn('[Crawler] GitHub Trending failed:', (e as Error).message);
    return 0;
  }
}

// ── 主入口 ───────────────────────────────────────────────────────────────────

export async function crawlAll(): Promise<number> {
  console.log('[Crawler] Starting crawl...');

  const [rssResults, orNew, twNew, serperNew, ghNew] = await Promise.all([
    Promise.all([
      crawlHackerNews(),
      crawlRSS('https://old.reddit.com/r/MachineLearning/.rss', 'Reddit/MachineLearning', 15, rssReddit),
      crawlRSS('https://old.reddit.com/r/LocalLLaMA/.rss', 'Reddit/LocalLLaMA', 15, rssReddit),
      crawlRSS('https://old.reddit.com/r/artificial/.rss', 'Reddit/artificial', 15, rssReddit),
      crawlRSS('https://huggingface.co/blog/feed.xml', 'HuggingFace Blog', 10),
      crawlRSS('https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', 'The Verge AI', 10),
      crawlRSS('https://feeds.feedburner.com/venturebeat/SZYF', 'VentureBeat AI', 10),
    ]),
    crawlOpenRouterModels(),
    crawlTwitter(),
    crawlSerperNews(),
    crawlGithubTrending(),
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

  const total = inserted + orNew + twNew + serperNew + ghNew;
  console.log(
    `[Crawler] Done. RSS: ${inserted} | OpenRouter: ${orNew} | Twitter: ${twNew} | Google: ${serperNew} | GitHub: ${ghNew} new`
  );
  return total;
}
