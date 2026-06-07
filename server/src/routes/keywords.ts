import { Router, Request, Response } from 'express';
import { q, db } from '../db';
import { expandKeywordTerms } from '../services/ai';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  res.json(q.getKeywords());
});

router.post('/', (req: Request, res: Response) => {
  const { keyword, description = '' } = req.body as { keyword?: string; description?: string };
  if (!keyword?.trim()) return res.status(400).json({ error: 'keyword is required' });

  const trimmed = keyword.trim();
  const info = q.insertKeyword.run(trimmed, description.trim(), '[]');
  const id = info.lastInsertRowid;

  // 扩展词生成依赖 AI，异步进行，不阻塞关键词创建
  expandKeywordTerms(trimmed)
    .then((terms) => q.updateKeywordExpansion.run(JSON.stringify(terms), id))
    .catch((e) => console.warn('[Keywords] expandKeywordTerms failed for', trimmed, (e as Error).message));

  const created = db.prepare('SELECT * FROM keywords WHERE id = ?').get(id);
  res.status(201).json(created);
});

router.put('/:id', (req: Request, res: Response) => {
  const existing = q.getKeywordById(req.params.id) as any;
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const { keyword, description, active, expanded_terms } = req.body as any;
  const nextKeyword = keyword ?? existing.keyword;
  const keywordChanged = typeof keyword === 'string' && keyword.trim() !== existing.keyword;

  // 手动编辑扩展词：直接采用传入数组；关键词文本变化：重新生成；否则保留原值
  let nextExpandedTerms = existing.expanded_terms ?? '[]';
  if (Array.isArray(expanded_terms)) {
    nextExpandedTerms = JSON.stringify(expanded_terms.filter((t: unknown) => typeof t === 'string' && t.trim()));
  }

  q.updateKeyword.run(
    nextKeyword,
    description ?? existing.description,
    active !== undefined ? (active ? 1 : 0) : existing.active,
    nextExpandedTerms,
    req.params.id
  );

  if (keywordChanged && !Array.isArray(expanded_terms)) {
    expandKeywordTerms(nextKeyword.trim())
      .then((terms) => q.updateKeywordExpansion.run(JSON.stringify(terms), req.params.id))
      .catch((e) => console.warn('[Keywords] expandKeywordTerms failed for', nextKeyword, (e as Error).message));
  }

  res.json(db.prepare('SELECT * FROM keywords WHERE id = ?').get(req.params.id));
});

// 按需重新生成扩展词（用户在管理界面点击「重新生成」）
router.post('/:id/expand', async (req: Request, res: Response) => {
  const existing = q.getKeywordById(req.params.id) as any;
  if (!existing) return res.status(404).json({ error: 'Not found' });

  try {
    const terms = await expandKeywordTerms(existing.keyword);
    q.updateKeywordExpansion.run(JSON.stringify(terms), req.params.id);
    res.json(db.prepare('SELECT * FROM keywords WHERE id = ?').get(req.params.id));
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.delete('/:id', (req: Request, res: Response) => {
  q.deleteKeyword.run(req.params.id);
  res.json({ success: true });
});

export default router;
