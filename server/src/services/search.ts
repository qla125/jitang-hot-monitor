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
  replyCount?: number;
  quoteCount?: number;
  viewCount?: number;
  isReply?: boolean;
  retweeted_tweet?: unknown;
  quoted_tweet?: unknown;
  author?: { userName?: string; followers?: number; isBlueVerified?: boolean; isVerified?: boolean };
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
  danmaku?: number;
  review?: number;
  isAccountMatch: boolean;
  publishedAt: string;
  authorName?: string;
  authorFollowers?: number;
  authorVerified?: boolean;
}

interface WeiboHit {
  title: string;
  url: string;
  content: string;
  source: string;
  likesCount: number;
  repostsCount?: number;
  commentsCount?: number;
  isAccountMatch: boolean;
  publishedAt: string;
  authorName?: string;
  authorFollowers?: number;
  authorVerified?: boolean;
}

// 7 天新鲜度过滤：有发布时间且超过 7 天的结果直接丢弃
function isWithin7Days(dateStr?: string): boolean {
  if (!dateStr) return true;
  try {
    const d = new Date(dateStr);
    return !isNaN(d.getTime()) && d.getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000;
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

// Twitter 关键词搜索（最高优先级，3d 窗口）
// 注意：twitterapi.io 不支持 since:/until: 日期格式，需用 since_time:/until_time: Unix 时间戳
async function searchTwitterByKeyword(keyword: string, limit = 12): Promise<TwitterHit[]> {
  const apiKey = q.getSetting('twitterapi_io_key') || process.env.TWITTERAPI_IO_KEY || '';
  if (!apiKey) return [];
  try {
    const sinceTs = unixDaysAgo(3);
    const { data } = await axios.get('https://api.twitterapi.io/twitter/tweet/advanced_search', {
      params: { query: `${keyword} since_time:${sinceTs}`, queryType: 'Top' },
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
    const status = (e as any)?.response?.status;
    if (status === 402) {
      console.warn(`[Search] Twitter API credits exhausted (402). Please recharge twitterapi.io account.`);
    } else {
      console.warn(`[Search] Twitter search failed for "${keyword}":`, (e as Error).message);
    }
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

// Bilibili 搜索专用请求头（all/v2 接口需要 Cookie 绕过风控）
const BILI_SEARCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'zh-CN,zh;q=0.9',
  'Referer': 'https://www.bilibili.com',
  'Cookie': 'buvid3=B4B7F5E8-6A1C-4D3F-A291-82C3D4E5F6A7infoc; buvid4=rand-seed-123456',
};

// ── Bilibili B站搜索（视频 + 博主账号识别）──────────────────────────────────────
async function searchBilibiliHits(keyword: string, limit = 6): Promise<BilibiliHit[]> {
  const hits: BilibiliHit[] = [];
  try {
    // 使用 all/v2 接口一次性获取用户和视频结果
    const res = await axios.get('https://api.bilibili.com/x/web-interface/search/all/v2', {
      params: { keyword, page: 1 },
      headers: BILI_SEARCH_HEADERS,
      timeout: 10000,
    });

    const results: any[] = res.data?.data?.result || [];
    const userResults: any[] = results.find((r) => r.result_type === 'bili_user')?.data || [];
    const videoResults: any[] = results.find((r) => r.result_type === 'video')?.data || [];

    // 判断是否命中账号名
    const matchedUser = userResults.find((u: any) => isAccountName(keyword, u.uname || ''));

    if (matchedUser?.mid) {
      const fansLabel = (matchedUser.fans || 0) >= 10000
        ? `${((matchedUser.fans || 0) / 10000).toFixed(1)}万粉`
        : `${matchedUser.fans || 0}粉`;
      const authorName = matchedUser.uname || '';
      const authorFollowers = matchedUser.fans || 0;
      const authorVerified = !!matchedUser.official_verify && matchedUser.official_verify.type !== -1;

      // 尝试拉取该用户的最新视频
      try {
        const spaceRes = await axios.get('https://api.bilibili.com/x/space/arc/search', {
          params: { mid: matchedUser.mid, pn: 1, ps: limit, order: 'pubdate' },
          headers: BILI_SEARCH_HEADERS,
          timeout: 10000,
        });
        const vlist: any[] = spaceRes.data?.data?.list?.vlist || [];
        for (const v of vlist.slice(0, limit)) {
          hits.push({
            title: stripHtml(v.title || ''),
            url: `https://www.bilibili.com/video/${v.bvid}`,
            content: v.description || '',
            source: `Bilibili @${matchedUser.uname}（${fansLabel}）`,
            play: v.play || 0,
            danmaku: v.danmaku || 0,
            review: v.comment || v.review || 0,
            isAccountMatch: true,
            publishedAt: new Date((v.created || 0) * 1000).toISOString(),
            authorName, authorFollowers, authorVerified,
          });
        }
      } catch {
        // space/arc/search 频率限制时，从 all/v2 的视频结果中筛选该用户的视频
        for (const v of videoResults.filter((v: any) => v.author === matchedUser.uname).slice(0, limit)) {
          hits.push({
            title: stripHtml(v.title || ''),
            url: v.arcurl || `https://www.bilibili.com/video/${v.bvid}`,
            content: v.description || '',
            source: `Bilibili @${matchedUser.uname}（${fansLabel}）`,
            play: v.play || 0,
            danmaku: v.danmaku || 0,
            review: v.review || 0,
            isAccountMatch: true,
            publishedAt: new Date((v.pubdate || 0) * 1000).toISOString(),
            authorName, authorFollowers, authorVerified,
          });
        }
      }
      if (hits.length > 0) return hits;
    }

    // 普通关键词视频搜索（不在这里做时间过滤，交给外层 isWithin7Days 统一处理）
    for (const v of videoResults.slice(0, limit)) {
      hits.push({
        title: stripHtml(v.title || ''),
        url: v.arcurl || `https://www.bilibili.com/video/${v.bvid}`,
        content: v.description || '',
        source: `Bilibili（${(v.play || 0).toLocaleString()}播放）`,
        play: v.play || 0,
        danmaku: v.danmaku || 0,
        review: v.review || 0,
        isAccountMatch: false,
        publishedAt: new Date((v.pubdate || 0) * 1000).toISOString(),
        authorName: v.author || '',
      });
    }
  } catch (e) {
    console.warn(`[Search] Bilibili search failed for "${keyword}":`, (e as Error).message);
  }
  return hits;
}

// ── 新浪微博搜索（移动端 API + 账号识别）────────────────────────────────────
const WEIBO_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'zh-CN,zh;q=0.9',
  'Referer': 'https://m.weibo.cn',
  'MWeibo-Pwa': '1',
  'X-Requested-With': 'XMLHttpRequest',
};

async function searchWeiboHits(keyword: string, limit = 6): Promise<WeiboHit[]> {
  const hits: WeiboHit[] = [];

  // Step 1: 判断关键词是否是微博用户
  try {
    const userRes = await axios.get('https://m.weibo.cn/api/container/getIndex', {
      params: { containerid: `100103type=3&q=${encodeURIComponent(keyword)}`, page_type: 'searchall', page: 1 },
      headers: WEIBO_HEADERS,
      timeout: 10000,
    });
    if (userRes.data?.ok === -100) {
      console.warn(`[Search] Weibo API requires login (ok=-100). Skipping Weibo for "${keyword}".`);
      return hits;
    }
    const userCards: any[] = userRes.data?.data?.cards || [];
    const userCard = userCards.find(
      (c: any) => c.card_type === 10 && isAccountName(keyword, c.user?.screen_name || '')
    );

    if (userCard?.user?.id) {
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
      const authorName = u.screen_name || '';
      const authorFollowers = u.followers_count || 0;
      const authorVerified = !!u.verified;

      for (const c of cards.filter((c: any) => c.mblog).slice(0, limit)) {
        const mb = c.mblog;
        const text = (mb.text || '').replace(/<[^>]*>/g, '').slice(0, 200);
        hits.push({
          title: `@${u.screen_name}: ${text}`,
          url: `https://weibo.com/${u.id}/${mb.bid || mb.id}`,
          content: text,
          source: `微博 @${u.screen_name}（${fansLabel}）`,
          likesCount: mb.attitudes_count || 0,
          repostsCount: mb.reposts_count || 0,
          commentsCount: mb.comments_count || 0,
          isAccountMatch: true,
          publishedAt: new Date(mb.created_at || Date.now()).toISOString(),
          authorName, authorFollowers, authorVerified,
        });
      }
      return hits;
    }
  } catch { /* fall through to content search */ }

  // Step 2: 普通微博内容搜索
  try {
    const { data } = await axios.get('https://m.weibo.cn/api/container/getIndex', {
      params: { containerid: `100103type=1&q=${encodeURIComponent(keyword)}`, page_type: 'searchall', page: 1 },
      headers: WEIBO_HEADERS,
      timeout: 10000,
    });
    if (data?.ok === -100) {
      console.warn(`[Search] Weibo search requires login (ok=-100). Skipping Weibo for "${keyword}".`);
      return hits;
    }
    const cards: any[] = data?.data?.cards || [];
    for (const c of cards.filter((c: any) => c.card_type === 9 && c.mblog).slice(0, limit)) {
      const mb = c.mblog;
      const user = mb.user || {};
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
        repostsCount: mb.reposts_count || 0,
        commentsCount: mb.comments_count || 0,
        isAccountMatch: false,
        publishedAt: new Date(mb.created_at || Date.now()).toISOString(),
        authorName: user.screen_name || '',
        authorFollowers: user.followers_count || 0,
        authorVerified: !!user.verified,
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
  keyword: string, kw: any, confidence: number, reason: string,
  authorName = '', authorFollowers = 0, authorVerified = false,
  likeCount = 0, commentCount = 0, shareCount = 0, viewCount = 0
) {
  const insertResult = q.insertRawItem.run(source, title.slice(0, 500), url, content.slice(0, 2000), publishedAt);
  if ((insertResult as any).changes > 0) {
    try {
      const topicInfo = q.insertHotTopic.run(
        (insertResult as any).lastInsertRowid, title, url, source, '', score, category, publishedAt,
        authorName, authorFollowers, authorVerified ? 1 : 0,
        likeCount, commentCount, shareCount, viewCount,
        '', 'unknown'
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
    if (!isWithin7Days(tweet.createdAt)) continue;
    const url = tweet.url || `https://twitter.com/i/web/status/${tweet.id}`;
    const authorName = tweet.author?.userName ? `@${tweet.author.userName}` : '';
    const title = `${authorName ? authorName + ': ' : ''}${tweet.text.slice(0, 120)}`;
    const content = tweet.text;

    let matched = false;
    let confidence = 0;
    let reason = 'twitter keyword match';
    try {
      const verification = await verifyKeywordMatch(content, keyword);
      matched = verification.matched && verification.confidence >= 0.6;
      confidence = verification.confidence;
      reason = verification.reason || reason;
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
            Math.min(10, Math.round((tweet.likeCount || 0) / 50) + 4),
            'discussion', tweet.createdAt || new Date().toISOString(),
            tweet.author?.userName || '',
            tweet.author?.followers || 0,
            (tweet.author?.isBlueVerified || tweet.author?.isVerified) ? 1 : 0,
            tweet.likeCount || 0,
            tweet.replyCount || 0,
            (tweet.retweetCount || 0) + (tweet.quoteCount || 0),
            tweet.viewCount || 0,
            '', 'unknown'
          );
          const topicId = topicInfo.lastInsertRowid as number;
          if (kw && !q.checkDuplicateAlert(kw.id, topicId)) {
            q.insertAlert.run(kw.id, keyword, topicId, title, url, confidence, reason);
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
    if (!isWithin7Days(hit.created_at)) continue;
    const url = hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`;
    const content = `${hit.title}\n${hit.story_text || ''}`;

    let matched = false;
    let confidence = 0;
    let reason = 'keyword search match';
    try {
      const verification = await verifyKeywordMatch(content, keyword);
      matched = verification.matched && verification.confidence >= 0.6;
      confidence = verification.confidence;
      reason = verification.reason || reason;
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
            Math.min(10, Math.round((hit.points || 0) / 20) + 4),
            'discussion', hit.created_at,
            hit.author || '', 0, 0,
            hit.points || 0, hit.num_comments || 0, 0, 0,
            '', 'unknown'
          );
          const topicId = topicInfo.lastInsertRowid as number;
          if (kw && !q.checkDuplicateAlert(kw.id, topicId)) {
            q.insertAlert.run(kw.id, keyword, topicId, hit.title, url, confidence, reason);
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
    if (!isWithin7Days(publishedAt)) continue;
    const url = item.link;
    const content = `${item.title}\n${item.snippet || ''}`;

    let matched = false;
    let confidence = 0;
    let reason = 'google news keyword match';
    try {
      const verification = await verifyKeywordMatch(content, keyword);
      matched = verification.matched && verification.confidence >= 0.6;
      confidence = verification.confidence;
      reason = verification.reason || reason;
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
            6, 'other', publishedAt,
            '', 0, 0,
            0, 0, 0, 0,
            '', 'unknown'
          );
          const topicId = topicInfo.lastInsertRowid as number;
          if (kw && !q.checkDuplicateAlert(kw.id, topicId)) {
            q.insertAlert.run(kw.id, keyword, topicId, item.title, url, confidence, reason);
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
    if (!isWithin7Days(hit.publishedAt)) continue;
    const matched = hit.isAccountMatch ? true
      : hit.title.toLowerCase().includes(keyword.toLowerCase()) ||
        hit.content.toLowerCase().includes(keyword.toLowerCase());
    const confidence = hit.isAccountMatch ? 0.95 : (matched ? 0.75 : 0);
    if (matched) {
      result.count++;
      await insertMatchedItem(
        hit.source, hit.title, hit.url, hit.content, hit.publishedAt,
        Math.min(10, Math.round((hit.play || 0) / 5000) + 4),
        'tool-update', keyword, kw, confidence, 'bilibili match',
        hit.authorName, hit.authorFollowers, hit.authorVerified,
        0, (hit.danmaku || 0) + (hit.review || 0), 0, hit.play || 0
      );
    }
    result.items.push({ title: hit.title, url: hit.url, source: hit.source, points: hit.play, matched, confidence });
  }

  // ── 微博 ──
  for (const hit of weiboHits) {
    if (!hit.title || !hit.url) continue;
    if (!isWithin7Days(hit.publishedAt)) continue;
    const matched = hit.isAccountMatch ? true
      : hit.content.toLowerCase().includes(keyword.toLowerCase());
    const confidence = hit.isAccountMatch ? 0.95 : (matched ? 0.7 : 0);
    if (matched) {
      result.count++;
      await insertMatchedItem(
        hit.source, hit.title, hit.url, hit.content, hit.publishedAt,
        Math.min(10, Math.round((hit.likesCount || 0) / 100) + 4),
        'discussion', keyword, kw, confidence, 'weibo match',
        hit.authorName, hit.authorFollowers, hit.authorVerified,
        hit.likesCount || 0, hit.commentsCount || 0, hit.repostsCount || 0, 0
      );
    }
    result.items.push({ title: hit.title, url: hit.url, source: hit.source, points: hit.likesCount, matched, confidence });
  }

  // ── 百度中文新闻 ──
  for (const item of baiduHits) {
    if (!item.title || !item.link) continue;
    let publishedAt = new Date().toISOString();
    try { if (item.date) publishedAt = new Date(item.date).toISOString(); } catch { /* */ }
    if (!isWithin7Days(publishedAt)) continue;
    const content = `${item.title}\n${item.snippet || ''}`;
    let matched = false;
    let confidence = 0;
    let reason = 'baidu news match';
    try {
      const v = await verifyKeywordMatch(content, keyword);
      matched = v.matched && v.confidence >= 0.6;
      confidence = v.confidence;
      reason = v.reason || reason;
    } catch {
      matched = item.title.toLowerCase().includes(keyword.toLowerCase());
      confidence = matched ? 0.7 : 0;
    }
    if (matched) {
      result.count++;
      await insertMatchedItem(
        `百度新闻${item.source ? ' · ' + item.source : ''}`,
        item.title, item.link, item.snippet || '', publishedAt,
        6, 'other', keyword, kw, confidence, reason
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
