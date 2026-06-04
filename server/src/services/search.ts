import axios from 'axios';
import { q } from '../db';
import { verifyKeywordMatch } from './ai';
import { notifyAlert } from './notify';
import { broadcastSSE } from './notify';

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

// 对单个关键词执行主动搜索
export async function searchKeyword(keyword: string): Promise<KeywordSearchResult> {
  console.log(`[Search] Searching for: "${keyword}"`);

  const hits = await searchHackerNews(keyword, 8);
  const result: KeywordSearchResult = { keyword, count: 0, items: [] };

  for (const hit of hits) {
    const url = hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`;
    const content = `${hit.title}\n${hit.story_text || ''}`;

    // AI 验证是否真正相关
    let matched = false;
    let confidence = 0;
    try {
      const verification = await verifyKeywordMatch(content, keyword);
      matched = verification.matched && verification.confidence >= 0.6;
      confidence = verification.confidence;
    } catch {
      // fallback: 标题包含关键词就算
      matched = hit.title.toLowerCase().includes(keyword.toLowerCase());
      confidence = matched ? 0.7 : 0;
    }

    if (matched) {
      result.count++;

      // 写入 raw_items + hot_topics（去重）
      const insertResult = q.insertRawItem.run(
        'HackerNews Search',
        hit.title.slice(0, 500),
        url,
        (hit.story_text || '').slice(0, 2000),
        hit.created_at
      );

      if ((insertResult as any).changes > 0) {
        // 新条目，直接入热点（不走 AI 分析批次，保持即时性）
        try {
          const topicInfo = q.insertHotTopic.run(
            (insertResult as any).lastInsertRowid,
            hit.title,
            url,
            'HackerNews Search',
            '', // summary 先留空，后续 AI 会填
            Math.min(10, Math.round((hit.points || 0) / 20) + 5),
            'discussion',
            hit.created_at
          );
          const topicId = topicInfo.lastInsertRowid as number;

          // 检查是否需要告警
          const kws = q.getActiveKeywords() as any[];
          const kw = kws.find((k: any) => k.keyword === keyword);
          if (kw && !q.checkDuplicateAlert(kw.id, topicId)) {
            q.insertAlert.run(kw.id, keyword, topicId, hit.title, url, confidence, 'keyword search match');
            await notifyAlert({ keyword, title: hit.title, url, summary: '', confidence });
          }
        } catch { /* duplicate */ }
      }
    }

    result.items.push({
      title: hit.title,
      url,
      source: `HackerNews (${hit.points || 0}pts)`,
      points: hit.points || 0,
      matched,
      confidence,
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
