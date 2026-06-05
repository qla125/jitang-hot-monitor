import { Router, Request, Response } from 'express';
import { q } from '../db';

const router = Router();

const ALLOWED_KEYS = [
  'email_enabled',
  'email_smtp_host',
  'email_smtp_port',
  'email_smtp_user',
  'email_smtp_pass',
  'email_to',
  'check_interval',
  'openrouter_model',
  'openrouter_api_key',
  'twitterapi_io_key',
  'twitterapi_io_enabled',
  'serper_api_key',
];

router.get('/', (_req: Request, res: Response) => {
  const settings = q.getAllSettings();
  // Mask password in response
  if (settings.email_smtp_pass) settings.email_smtp_pass = '••••••••';
  res.json(settings);
});

router.put('/', (req: Request, res: Response) => {
  const body = req.body as Record<string, string>;

  for (const [key, value] of Object.entries(body)) {
    if (ALLOWED_KEYS.includes(key) && value !== '••••••••') {
      q.setSetting.run(key, String(value));
    }
  }

  res.json({ success: true });
});

export default router;
