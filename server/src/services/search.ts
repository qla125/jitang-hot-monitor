import axios from 'axios';
import { q } from '../db';
import { verifyKeywordMatch } from './ai';
import { notifyAlert } from './notify';
import { broadcastSSE } from './notify';

interface TwitterHit {
  id: string;
  text: string;
  url: string;
  createdAt: string;
  likeCount?: number;
  retweetCount?: number;
  viewCount?: number;
  isReply?: boolean;
  retweeted_tweet?: unknown;
  quoted_tweet?: unknown;
  author?: { userName?: string; followers?: number };
}

interface SerperHit {
  title: string;
  link: string;
  snippet?: string;
  source?: string;
  date?: string;
}

interface SearchHit {
  objectID: string;
  title: string;
  url?: string;
  story_text?: string;
  points: number;
  num_comments: number;
  created_at: string;
  author: string;
}

interface KeywordSearchResult {
  keyword: string;
  count: number;
  items: Array<{
    title: string;
    url: string;
    source: string;
    points: number;
    summary?: string;
    matched: boolean;
    confidence: number;
  }>;
}

// Twitter 关键词搜索（twitterapi.io — Top 模式 + 严格质量过滤）
async function searchTwitterByKeyword(keyword: string, limit = 6): Promise<TwitterHit[]> {
  const apiKey = q.getSetting('twitterapi_io_key') || process.env.TWITTERAPI_IO_KEY || '';
  if (!apiKey) return [];
  try {
    const { data } = await axios.get('https://api.twitterapi.io/twitter/tweet/advanced_search', {
      params: { query: `"${keyword}" min_faves:50`, queryType: 'Top' },
      headers: { 'x-api-key': apiKey },
      timeout: 10000,
    });
    return ((data.tweets || []) as TwitterHit[])
      .filter((t) =>
        (t.likeCount || 0) >= 50 &&
        (t.retweetCount || 0) >= 20 &&
        (t.viewCount || 0) >= 2000 &&
        t.isReply !== true &&
        t.retweeted_tweet == null &&
        t.quoted_tweet == null &&
        (t.author?.followers || 0) >= 500
      )
      .slice(0, limit);
  } catch (e) {
    console.warn(`[Search] Twitter search failed for "${keyword}":`, (e as Error).message);
    return [];
  }
}

// Serper.dev Google 新闻关键词搜索
async function searchSerperByKeyword(keyword: string, limit = 6): Promise<SerperHit[]> {
  const apiKey = q.getSetting('serper_api_key') || process.env.SERPER_API_KEY || '';
  if (!apiKey) return [];
  try {
    const { data } = await axios.post(
      'https://google.serper.dev/news',
      { q: keyword, gl: 'us', hl: 'en', num: limit },
      {
        headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
        timeout: 10000,
      }
    );
    return data.news || [];
  } catch (e) {
    console.warn(`[Search] Serper search failed for "${keyword}":`, (e as Error).message);
    return [];
  }
}

// HackerNews Algolia 搜索 API（免费、无需 Key）
async function searchHackerNews(keyword: string, limit = 5): Promise<SearchHit[]> {
  try {
    const { data } = await axios.get('https://hn.algolia.com/api/v1/search', {
      params: {
        query: keyword,
        tags: 'story',
        hitsPerPage: limit,
        numericFilters: 'created_at_i>1700000000', // 近期内容
      },
      timeout: 10000,
    });
    return data.hits || [];
  } catch (e) {
    console.warn(`[Search] HN search failed for "${keyword}":`, (e as Error).message);
    return [];
  }
}

// 对单个关键词执行主动搜索（HackerNews + Twitter + Google News 并发）
export async function searchKeyword(keyword: string): Promise<KeywordSearchResult> {
  console.log(`[Search] Searching for: "${keyword}"`);

  const [hnHits, twHits, serperHits] = await Promise.all([
    searchHackerNews(keyword, 8),
    searchTwitterByKeyword(keyword, 6),
    searchSerperByKeyword(keyword, 6),
  ]);

  const result: KeywordSearchResult = { keyword, count: 0, items: [] };
  const kws = q.getActiveKeywords() as any[];
  const kw = kws.find((k: any) => k.keyword === keyword);

  // ── HackerNews ──
  for (const hit of hnHits) {
    const url = hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`;
    const content = `${hit.title}\n${hit.story_text || ''}`;

    let matched = false;
    let confidence = 0;
    try {
      const verification = await verifyKeywordMatch(content, keyword);
      matched = verification.matched && verification.confidence >= 0.6;
      confidence = verification.confidence;
    } catch {
      matched = hit.title.toLowerCase().includes(keyword.toLowerCase());
      confidence = matched ? 0.7 : 0;
    }

    if (matched) {
      result.count++;
      const insertResult = q.insertRawItem.run(
        'HackerNews Search', hit.title.slice(0, 500), url,
        (hit.story_text || '').slice(0, 2000), hit.created_at
      );
      if ((insertResult as any).changes > 0) {
        try {
          const topicInfo = q.insertHotTopic.run(
            (insertResult as any).lastInsertRowid, hit.title, url,
            'HackerNews Search', '',
            Math.min(10, Math.round((hit.points || 0) / 20) + 5),
            'discussion', hit.created_at
          );
          const topicId = topicInfo.lastInsertRowid as number;
          if (kw && !q.checkDuplicateAlert(kw.id, topicId)) {
            q.insertAlert.run(kw.id, keyword, topicId, hit.title, url, confidence, 'keyword search match');
            await notifyAlert({ keyword, title: hit.title, url, summary: '', confidence });
          }
        } catch { /* duplicate */ }
      }
    }

    result.items.push({
      title: hit.title, url,
      source: `HackerNews (${hit.points || 0}pts)`,
      points: hit.points || 0, matched, confidence,
    });
  }

  // ── Twitter ──
  for (const tweet of twHits) {
    const url = tweet.url || `https://twitter.com/i/web/status/${tweet.id}`;
    const authorName = tweet.author?.userName ? `@${tweet.author.userName}` : '';
    const title = `${authorName ? authorName + ': ' : ''}${tweet.text.slice(0, 120)}`;
    const content = tweet.text;

    let matched = false;
    let confidence = 0;
    try {
      const verification = await verifyKeywordMatch(content, keyword);
      matched = verification.matched && verification.confidence >= 0.6;
      confidence = verification.confidence;
    } catch {
      matched = tweet.text.toLowerCase().includes(keyword.toLowerCase());
      confidence = matched ? 0.7 : 0;
    }

    if (matched) {
      result.count++;
      const insertResult = q.insertRawItem.run(
        'Twitter/X Search', title.slice(0, 500), url,
        tweet.text.slice(0, 2000), tweet.createdAt || new Date().toISOString()
      );
      if ((insertResult as any).changes > 0) {
        try {
          const topicInfo = q.insertHotTopic.run(
            (insertResult as any).lastInsertRowid, title, url,
            'Twitter/X Search', '',
            Math.min(10, Math.round((tweet.likeCount || 0) / 50) + 5),
            'discussion', tweet.createdAt || new Date().toISOString()
          );
          const topicId = topicInfo.lastInsertRowid as number;
          if (kw && !q.checkDuplicateAlert(kw.id, topicId)) {
            q.insertAlert.run(kw.id, keyword, topicId, title, url, confidence, 'twitter keyword match');
            await notifyAlert({ keyword, title, url, summary: '', confidence });
          }
        } catch { /* duplicate */ }
      }
    }

    result.items.push({
      title, url,
      source: `Twitter (${tweet.likeCount || 0}❤)`,
      points: tweet.likeCount || 0, matched, confidence,
    });
  }

  // ── Google News (Serper) ──
  for (const item of serperHits) {
    if (!item.title || !item.link) continue;
    const url = item.link;
    const content = `${item.title}\n${item.snippet || ''}`;

    let matched = false;
    let confidence = 0;
    try {
      const verification = await verifyKeywordMatch(content, keyword);
      matched = verification.matched && verification.confidence >= 0.6;
      confidence = verification.confidence;
    } catch {
      matched = item.title.toLowerCase().includes(keyword.toLowerCase());
      confidence = matched ? 0.7 : 0;
    }

    if (matched) {
      result.count++;
      let publishedAt = new Date().toISOString();
      try { if (item.date) publishedAt = new Date(item.date).toISOString(); } catch { /* fallback */ }

      const insertResult = q.insertRawItem.run(
        'Google News', item.title.slice(0, 500), url,
        (item.snippet || '').slice(0, 2000), publishedAt
      );
      if ((insertResult as any).changes > 0) {
        try {
          const topicInfo = q.insertHotTopic.run(
            (insertResult as any).lastInsertRowid, item.title, url,
            `Google News${item.source ? ' · ' + item.source : ''}`, '',
            7, 'other', publishedAt
          );
          const topicId = topicInfo.lastInsertRowid as number;
          if (kw && !q.checkDuplicateAlert(kw.id, topicId)) {
            q.insertAlert.run(kw.id, keyword, topicId, item.title, url, confidence, 'google news keyword match');
            await notifyAlert({ keyword, title: item.title, url, summary: item.snippet || '', confidence });
          }
        } catch { /* duplicate */ }
      }
    }

    result.items.push({
      title: item.title, url,
      source: `Google News${item.source ? ' · ' + item.source : ''}`,
      points: 0, matched, confidence,
    });
  }

  return result;
}

// 对所有激活关键词批量搜索
export async function searchAllKeywords(): Promise<KeywordSearchResult[]> {
  const keywords = q.getActiveKeywords() as any[];
  if (keywords.length === 0) return [];

  const results: KeywordSearchResult[] = [];
  for (const kw of keywords) {
    const result = await searchKeyword(kw.keyword);
    results.push(result);
  }

  // 广播更新
  const totalFound = results.reduce((sum, r) => sum + r.count, 0);
  broadcastSSE('search-complete', { results, totalFound });

  return results;
}
