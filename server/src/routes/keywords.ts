import { Router, Request, Response } from 'express';
import { q, db } from '../db';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  res.json(q.getKeywords());
});

router.post('/', (req: Request, res: Response) => {
  const { keyword, description = '' } = req.body as { keyword?: string; description?: string };
  if (!keyword?.trim()) return res.status(400).json({ error: 'keyword is required' });

  const info = q.insertKeyword.run(keyword.trim(), description.trim());
  const created = db.prepare('SELECT * FROM keywords WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(created);
});

router.put('/:id', (req: Request, res: Response) => {
  const existing = q.getKeywordById(req.params.id) as any;
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const { keyword, description, active } = req.body as any;
  q.updateKeyword.run(
    keyword ?? existing.keyword,
    description ?? existing.description,
    active !== undefined ? (active ? 1 : 0) : existing.active,
    req.params.id
  );

  res.json(db.prepare('SELECT * FROM keywords WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req: Request, res: Response) => {
  q.deleteKeyword.run(req.params.id);
  res.json({ success: true });
});

export default router;
