import { q, db } from '../db';
import { analyzeItems } from './ai';
import { verifyWithCache } from './ai';
import { notifyAlert } from './notify';

const BATCH_SIZE = 10;
const MATCH_CONFIDENCE_THRESHOLD = 0.7;

function parseExpandedTerms(raw: unknown): string[] {
  if (typeof raw !== 'string' || !raw.trim()) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((t): t is string => typeof t === 'string' && t.trim().length > 0) : [];
  } catch {
    return [];
  }
}

// 预筛选：内容只要命中关键词本身或任一扩展词即可进入 AI 复核，避免严格子串匹配漏掉语义相关内容
function matchesAnyTerm(content: string, kw: any): boolean {
  const lower = content.toLowerCase();
  const terms = [kw.keyword, ...parseExpandedTerms(kw.expanded_terms)];
  return terms.some((t) => lower.includes(String(t).toLowerCase()));
}

export async function processNewItems(): Promise<number> {
  const unprocessed = q.getUnprocessedItems() as any[];
  if (unprocessed.length === 0) {
    console.log('[Monitor] No new items');
    return 0;
  }

  console.log(`[Monitor] Processing ${unprocessed.length} items...`);

  // AI analysis in batches
  const allResults: Array<{ id: number; score: number; summary: string; category: string; reason: string; authenticity: string }> = [];
  for (let i = 0; i < unprocessed.length; i += BATCH_SIZE) {
    const batch = unprocessed.slice(i, i + BATCH_SIZE);
    try {
      const results = await analyzeItems(
        batch.map((item: any) => ({
          id: item.id,
          title: item.title,
          content: item.content || '',
          source: item.source,
        }))
      );
      allResults.push(...results);
    } catch (e) {
      console.warn('[Monitor] AI batch failed, using fallback:', (e as Error).message);
      batch.forEach((item: any) =>
        allResults.push({ id: item.id, score: 5, summary: item.title.slice(0, 40), category: 'other', reason: '', authenticity: 'unknown' })
      );
    }
  }

  // Save hot topics + mark processed
  const insertedTopics: Array<{ topicId: number; rawItem: any; result: any }> = [];
  for (const result of allResults) {
    const rawItem = unprocessed.find((i: any) => i.id === result.id);
    if (!rawItem) continue;

    try {
      const info = q.insertHotTopic.run(
        rawItem.id,
        rawItem.title,
        rawItem.url,
        rawItem.source,
        result.summary,
        result.score,
        result.category,
        rawItem.published_at,
        '', 0, 0,           // 作者信息：常规抓取管线无结构化数据
        0, 0, 0, 0,         // 互动数据：raw_items 未携带结构化点赞/评论/转发/浏览数
        result.reason,
        result.authenticity
      );
      insertedTopics.push({ topicId: info.lastInsertRowid as number, rawItem, result });
    } catch {
      // duplicate etc.
    }
    q.markProcessed.run(rawItem.id);
  }

  console.log(`[Monitor] Saved ${insertedTopics.length} hot topics`);

  if (insertedTopics.length > 0) {
    await checkKeywordMatches(insertedTopics);
  }

  return insertedTopics.length;
}

/**
 * 对最近 48 小时已入库的热点，重新跑一遍所有激活关键词的匹配检查。
 * 主要用于：用户新增关键词后、手动点击「立即扫描」时。
 * dedup 逻辑保证不会重复告警。
 */
export async function recheckRecentTopics(): Promise<number> {
  const keywords = q.getActiveKeywords() as any[];
  if (keywords.length === 0) return 0;

  // 取最近 48h 的热点，连同原始内容
  const recentTopics = db.prepare(`
    SELECT ht.id as topicId, ht.title, ht.url, ht.summary, ht.score,
           ri.content, ri.title as raw_title
    FROM hot_topics ht
    LEFT JOIN raw_items ri ON ri.id = ht.raw_item_id
    WHERE ht.created_at > datetime('now', '-48 hours', 'localtime')
    ORDER BY ht.score DESC
    LIMIT 200
  `).all() as any[];

  let alertCount = 0;

  for (const topic of recentTopics) {
    const content = `${topic.title}\n${topic.content || ''}`;

    for (const kw of keywords) {
      if (!matchesAnyTerm(content, kw)) continue;
      if (q.checkDuplicateAlert(kw.id, topic.topicId)) continue;

      try {
        const verification = await verifyWithCache(topic.url || '', content, kw.keyword);
        if (verification.matched && verification.confidence >= MATCH_CONFIDENCE_THRESHOLD) {
          q.insertAlert.run(
            kw.id, kw.keyword, topic.topicId,
            topic.title, topic.url || '',
            verification.confidence, verification.reason
          );
          console.log(`[Monitor] 🎯 Recheck Alert! "${kw.keyword}" → ${topic.title}`);
          await notifyAlert({
            keyword: kw.keyword,
            title: topic.title,
            url: topic.url || '',
            summary: topic.summary,
            confidence: verification.confidence,
          });
          alertCount++;
        }
      } catch (e) {
        console.warn(`[Monitor] Recheck failed for "${kw.keyword}":`, (e as Error).message);
      }
    }
  }

  console.log(`[Monitor] Recheck done — ${alertCount} new alert(s)`);
  return alertCount;
}

async function checkKeywordMatches(
  topics: Array<{ topicId: number; rawItem: any; result: any }>
): Promise<void> {
  const keywords = q.getActiveKeywords() as any[];
  if (keywords.length === 0) return;

  for (const { topicId, rawItem, result } of topics) {
    const content = `${rawItem.title}\n${rawItem.content || ''}`;

    for (const kw of keywords) {
      // 预筛选：命中关键词或扩展词才进入 AI 复核，节省调用次数
      if (!matchesAnyTerm(content, kw)) continue;

      // Dedup check
      if (q.checkDuplicateAlert(kw.id, topicId)) continue;

      try {
        const verification = await verifyWithCache(rawItem.url || '', content, kw.keyword);

        if (verification.matched && verification.confidence >= MATCH_CONFIDENCE_THRESHOLD) {
          q.insertAlert.run(
            kw.id,
            kw.keyword,
            topicId,
            rawItem.title,
            rawItem.url || '',
            verification.confidence,
            verification.reason
          );

          console.log(`[Monitor] 🎯 Alert! "${kw.keyword}" matched: ${rawItem.title}`);

          await notifyAlert({
            keyword: kw.keyword,
            title: rawItem.title,
            url: rawItem.url || '',
            summary: result.summary,
            confidence: verification.confidence,
          });
        }
      } catch (e) {
        console.warn(`[Monitor] Keyword check failed for "${kw.keyword}":`, (e as Error).message);
      }
    }
  }
}
