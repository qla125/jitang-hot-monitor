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

interface BilibiliHit {
  title: string;
  url: string;
  content: string;
  source: string;
  play: number;
  isAccountMatch: boolean;
  publishedAt: string;
}

interface WeiboHit {
  title: string;
  url: string;
  content: string;
  source: string;
  likesCount: number;
  isAccountMatch: boolean;
  publishedAt: string;
}

// 48 小时新鲜度硬过滤：有发布时间且超过 48h 的结果直接丢弃
function isWithin48h(dateStr?: string): boolean {
  if (!dateStr) return true;
  try {
    const d = new Date(dateStr);
    return !isNaN(d.getTime()) && d.getTime() > Date.now() - 48 * 60 * 60 * 1000;
  } catch { return true; }
}

// 各搜索源 24 小时窗口辅助
function daysAgoStr(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0]; // YYYY-MM-DD
}
function unixDaysAgo(days: number) {
  return Math.floor(Date.now() / 1000) - days * 24 * 3600;
}

const BILI_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Referer: 'https://www.bilibili.com',
};

const stripHtml = (s: string) => s.replace(/<[^>]*>/g, '');

function isAccountName(keyword: string, name: string): boolean {
  const kw = keyword.toLowerCase().trim();
  const n = name.toLowerCase().trim();
  return n === kw || (n.includes(kw) && kw.length >= 2) || (kw.includes(n) && n.length >= 2);
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

// Twitter 关键词搜索（最高优先级，24h 窗口，配额最多）
async function searchTwitterByKeyword(keyword: string, limit = 12): Promise<TwitterHit[]> {
  const apiKey = q.getSetting('twitterapi_io_key') || process.env.TWITTERAPI_IO_KEY || '';
  if (!apiKey) return [];
  try {
    const { data } = await axios.get('https://api.twitterapi.io/twitter/tweet/advanced_search', {
      params: { query: `"${keyword}" min_faves:50 since:${daysAgoStr(1)}`, queryType: 'Top' },
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

// ── Bilibili B站搜索（视频 + 博主账号识别）──────────────────────────────────────
async function searchBilibiliHits(keyword: string, limit = 6): Promise<BilibiliHit[]> {
  const hits: BilibiliHit[] = [];
  try {
    // 先做用户搜索，判断关键词是否是一个博主/账号名
    const userRes = await axios.get('https://api.bilibili.com/x/web-interface/search/type', {
      params: { search_type: 'bili_user', keyword, page: 1, page_size: 3 },
      headers: BILI_HEADERS,
      timeout: 10000,
    });
    const users: any[] = userRes.data?.data?.result || [];
    const matchedUser = users.find((u) => isAccountName(keyword, u.uname || ''));

    if (matchedUser?.mid) {
      // 关键词是账号名 → 直接拉取该用户最新视频
      const spaceRes = await axios.get('https://api.bilibili.com/x/space/arc/search', {
        params: { mid: matchedUser.mid, pn: 1, ps: limit, order: 'pubdate' },
        headers: BILI_HEADERS,
        timeout: 10000,
      });
      const vlist: any[] = spaceRes.data?.data?.list?.vlist || [];
      const fansLabel = matchedUser.fans >= 10000
        ? `${(matchedUser.fans / 10000).toFixed(1)}万粉`
        : `${matchedUser.fans || 0}粉`;
      for (const v of vlist.slice(0, limit)) {
        hits.push({
          title: stripHtml(v.title || ''),
          url: `https://www.bilibili.com/video/${v.bvid}`,
          content: v.description || '',
          source: `Bilibili @${matchedUser.uname}（${fansLabel}）`,
          play: v.play || 0,
          isAccountMatch: true,
          publishedAt: new Date((v.created || 0) * 1000).toISOString(),
        });
      }
      return hits; // 账号模式：直接返回，不再做内容搜索
    }
  } catch { /* fall through */ }

  // 关键词不是账号 → 普通视频内容搜索
  try {
    const res = await axios.get('https://api.bilibili.com/x/web-interface/search/type', {
      params: { search_type: 'video', keyword, page: 1, page_size: limit, order: 'pubdate' },
      headers: BILI_HEADERS,
      timeout: 10000,
    });
    const videos: any[] = res.data?.data?.result || [];
    for (const v of videos.slice(0, limit)) {
      if ((v.pubdate || 0) < unixDaysAgo(1)) continue; // 只要 24h 内
      hits.push({
        title: stripHtml(v.title || ''),
        url: `https://www.bilibili.com/video/${v.bvid || ''}`,
        content: v.description || '',
        source: `Bilibili（${(v.play || 0).toLocaleString()}播放）`,
        play: v.play || 0,
        isAccountMatch: false,
        publishedAt: new Date((v.pubdate || 0) * 1000).toISOString(),
      });
    }
  } catch (e) {
    console.warn(`[Search] Bilibili search failed for "${keyword}":`, (e as Error).message);
  }
  return hits;
}

// ── 新浪微博搜索（移动端 API + 账号识别）────────────────────────────────────
const WEIBO_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0',
  Referer: 'https://m.weibo.cn',
};

async function searchWeiboHits(keyword: string, limit = 6): Promise<WeiboHit[]> {
  const hits: WeiboHit[] = [];
  try {
    // Step 1: 判断关键词是否是微博用户
    const userRes = await axios.get('https://m.weibo.cn/api/container/getIndex', {
      params: { containerid: `100103type=3&q=${keyword}`, page_type: 'searchall', page: 1 },
      headers: WEIBO_HEADERS,
      timeout: 10000,
    });
    const userCards: any[] = userRes.data?.data?.cards || [];
    const userCard = userCards.find(
      (c: any) => c.card_type === 10 && isAccountName(keyword, c.user?.screen_name || '')
    );

    if (userCard?.user?.id) {
      // 是微博账号 → 拉取其最新微博
      const uid = userCard.user.id;
      const timelineRes = await axios.get('https://m.weibo.cn/api/container/getIndex', {
        params: { uid, type: 'uid', containerid: `107603${uid}`, page: 1 },
        headers: WEIBO_HEADERS,
        timeout: 10000,
      });
      const cards: any[] = timelineRes.data?.data?.cards || [];
      const u = userCard.user;
      const fansLabel = u.followers_count >= 10000
        ? `${(u.followers_count / 10000).toFixed(1)}万粉`
        : `${u.followers_count || 0}粉`;

      for (const c of cards.filter((c: any) => c.mblog).slice(0, limit)) {
        const mb = c.mblog;
        const text = (mb.text || '').replace(/<[^>]*>/g, '').slice(0, 200);
        hits.push({
          title: `@${u.screen_name}: ${text}`,
          url: `https://weibo.com/${u.id}/${mb.bid || mb.id}`,
          content: text,
          source: `微博 @${u.screen_name}（${fansLabel}）`,
          likesCount: mb.attitudes_count || 0,
          isAccountMatch: true,
          publishedAt: new Date(mb.created_at || Date.now()).toISOString(),
        });
      }
      return hits;
    }
  } catch { /* fall through */ }

  // Step 2: 普通微博内容搜索
  try {
    const { data } = await axios.get('https://m.weibo.cn/api/container/getIndex', {
      params: { containerid: `100103type=1&q=${keyword}`, page_type: 'searchall', page: 1 },
      headers: WEIBO_HEADERS,
      timeout: 10000,
    });
    const cards: any[] = data?.data?.cards || [];
    for (const c of cards.filter((c: any) => c.card_type === 9 && c.mblog).slice(0, limit)) {
      const mb = c.mblog;
      const user = mb.user || {};
      // 质量过滤：点赞 ≥ 20 或 转发 ≥ 5 或 粉丝 ≥ 1000
      if (
        (mb.attitudes_count || 0) < 20 &&
        (mb.reposts_count || 0) < 5 &&
        (user.followers_count || 0) < 1000
      ) continue;
      const text = (mb.text || '').replace(/<[^>]*>/g, '').slice(0, 200);
      hits.push({
        title: `@${user.screen_name || 'Unknown'}: ${text}`,
        url: `https://weibo.com/${user.id}/${mb.bid || mb.id}`,
        content: text,
        source: `微博（${mb.attitudes_count || 0}❤）`,
        likesCount: mb.attitudes_count || 0,
        isAccountMatch: false,
        publishedAt: new Date(mb.created_at || Date.now()).toISOString(),
      });
    }
  } catch (e) {
    console.warn(`[Search] Weibo search failed for "${keyword}":`, (e as Error).message);
  }
  return hits;
}

// ── 百度中文新闻搜索（复用 Serper，切换至中文区域）────────────────────────────
async function searchBaiduCNNews(keyword: string, limit = 6): Promise<SerperHit[]> {
  const apiKey = q.getSetting('serper_api_key') || process.env.SERPER_API_KEY || '';
  if (!apiKey) return [];
  try {
    const { data } = await axios.post(
      'https://google.serper.dev/news',
      { q: keyword, gl: 'cn', hl: 'zh-cn', num: limit },
      { headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' }, timeout: 10000 }
    );
    return data.news || [];
  } catch (e) {
    console.warn(`[Search] Baidu CN News failed for "${keyword}":`, (e as Error).message);
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
        numericFilters: `created_at_i>${unixDaysAgo(1)}`,
      },
      timeout: 10000,
    });
    return data.hits || [];
  } catch (e) {
    console.warn(`[Search] HN search failed for "${keyword}":`, (e as Error).message);
    return [];
  }
}

// 通用：插入一条匹配结果到 DB 并触发告警
async function insertMatchedItem(
  source: string, title: string, url: string, content: string,
  publishedAt: string, score: number, category: string,
  keyword: string, kw: any, confidence: number, reason: string
) {
  const insertResult = q.insertRawItem.run(source, title.slice(0, 500), url, content.slice(0, 2000), publishedAt);
  if ((insertResult as any).changes > 0) {
    try {
      const topicInfo = q.insertHotTopic.run(
        (insertResult as any).lastInsertRowid, title, url, source, '', score, category, publishedAt
      );
      const topicId = topicInfo.lastInsertRowid as number;
      if (kw && !q.checkDuplicateAlert(kw.id, topicId)) {
        q.insertAlert.run(kw.id, keyword, topicId, title, url, confidence, reason);
        await notifyAlert({ keyword, title, url, summary: '', confidence });
      }
    } catch { /* duplicate */ }
  }
}

// 对单个关键词执行主动搜索
// 配额分配：Twitter(12) > HN(5) > Serper(4) = Bilibili(4) = Weibo(4) > Baidu(3)
export async function searchKeyword(keyword: string): Promise<KeywordSearchResult> {
  console.log(`[Search] Searching for: "${keyword}"`);

  const [twHits, hnHits, serperHits, biliHits, weiboHits, baiduHits] = await Promise.all([
    searchTwitterByKeyword(keyword, 12),  // 最高优先级，配额最多
    searchHackerNews(keyword, 5),
    searchSerperByKeyword(keyword, 4),
    searchBilibiliHits(keyword, 4),
    searchWeiboHits(keyword, 4),
    searchBaiduCNNews(keyword, 3),
  ]);

  const result: KeywordSearchResult = { keyword, count: 0, items: [] };
  const kws = q.getActiveKeywords() as any[];
  const kw = kws.find((k: any) => k.keyword === keyword);

  // ── Twitter（最高优先级）──
  for (const tweet of twHits) {
    if (!isWithin48h(tweet.createdAt)) continue;
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

  // ── HackerNews ──
  for (const hit of hnHits) {
    if (!isWithin48h(hit.created_at)) continue;
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

  // ── Google News (Serper) ──
  for (const item of serperHits) {
    if (!item.title || !item.link) continue;
    let publishedAt = new Date().toISOString();
    try { if (item.date) publishedAt = new Date(item.date).toISOString(); } catch { /* fallback */ }
    if (!isWithin48h(publishedAt)) continue;
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

  // ── Bilibili ──
  for (const hit of biliHits) {
    if (!hit.title || !hit.url) continue;
    if (!isWithin48h(hit.publishedAt)) continue;
    const matched = hit.isAccountMatch ? true
      : hit.title.toLowerCase().includes(keyword.toLowerCase()) ||
        hit.content.toLowerCase().includes(keyword.toLowerCase());
    const confidence = hit.isAccountMatch ? 0.95 : (matched ? 0.75 : 0);
    if (matched) {
      result.count++;
      await insertMatchedItem(
        hit.source, hit.title, hit.url, hit.content, hit.publishedAt,
        Math.min(10, Math.round((hit.play || 0) / 5000) + 5),
        'tool-update', keyword, kw, confidence, 'bilibili match'
      );
    }
    result.items.push({ title: hit.title, url: hit.url, source: hit.source, points: hit.play, matched, confidence });
  }

  // ── 微博 ──
  for (const hit of weiboHits) {
    if (!hit.title || !hit.url) continue;
    if (!isWithin48h(hit.publishedAt)) continue;
    const matched = hit.isAccountMatch ? true
      : hit.content.toLowerCase().includes(keyword.toLowerCase());
    const confidence = hit.isAccountMatch ? 0.95 : (matched ? 0.7 : 0);
    if (matched) {
      result.count++;
      await insertMatchedItem(
        hit.source, hit.title, hit.url, hit.content, hit.publishedAt,
        Math.min(10, Math.round((hit.likesCount || 0) / 100) + 5),
        'discussion', keyword, kw, confidence, 'weibo match'
      );
    }
    result.items.push({ title: hit.title, url: hit.url, source: hit.source, points: hit.likesCount, matched, confidence });
  }

  // ── 百度中文新闻 ──
  for (const item of baiduHits) {
    if (!item.title || !item.link) continue;
    let publishedAt = new Date().toISOString();
    try { if (item.date) publishedAt = new Date(item.date).toISOString(); } catch { /* */ }
    if (!isWithin48h(publishedAt)) continue;
    const content = `${item.title}\n${item.snippet || ''}`;
    let matched = false;
    let confidence = 0;
    try {
      const v = await verifyKeywordMatch(content, keyword);
      matched = v.matched && v.confidence >= 0.6;
      confidence = v.confidence;
    } catch {
      matched = item.title.toLowerCase().includes(keyword.toLowerCase());
      confidence = matched ? 0.7 : 0;
    }
    if (matched) {
      result.count++;
      await insertMatchedItem(
        `百度新闻${item.source ? ' · ' + item.source : ''}`,
        item.title, item.link, item.snippet || '', publishedAt,
        7, 'other', keyword, kw, confidence, 'baidu news match'
      );
    }
    result.items.push({
      title: item.title, url: item.link,
      source: `百度新闻${item.source ? ' · ' + item.source : ''}`,
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
