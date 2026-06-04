import { Router, Request, Response } from 'express';
import { q } from '../db';
import { runPipeline } from '../scheduler';
import { searchAllKeywords } from '../services/search';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const hours = parseInt(req.query.hours as string) || 48;
  const topics = q.getRecentTopics(hours);
  res.json(topics);
});

// 普通刷新：抓取 RSS 等常规数据源
router.post('/refresh', async (_req: Request, res: Response) => {
  res.json({ message: 'Refresh started' });
  runPipeline().catch(console.error);
});

// 关键词主动搜索：针对用户设置的关键词主动检索最新内容
router.post('/search-keywords', async (_req: Request, res: Response) => {
  const keywords = q.getActiveKeywords() as any[];
  if (keywords.length === 0) {
    return res.json({ results: [], message: '请先添加监控关键词' });
  }

  // 立即返回，搜索异步进行（通过 SSE 推送结果）
  res.json({ message: 'Searching...', keywords: keywords.map((k: any) => k.keyword) });
  searchAllKeywords().catch(console.error);
});

export default router;
