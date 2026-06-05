import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(__dirname, '../../data/monitor.db');

const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS keywords (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    keyword TEXT NOT NULL,
    description TEXT DEFAULT '',
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS raw_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,
    title TEXT NOT NULL,
    url TEXT UNIQUE,
    content TEXT DEFAULT '',
    published_at TEXT,
    crawled_at TEXT DEFAULT (datetime('now', 'localtime')),
    processed INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS hot_topics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    raw_item_id INTEGER,
    title TEXT NOT NULL,
    url TEXT,
    source TEXT NOT NULL,
    summary TEXT DEFAULT '',
    score INTEGER DEFAULT 5,
    category TEXT DEFAULT 'other',
    published_at TEXT,
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    keyword_id INTEGER NOT NULL,
    keyword_text TEXT NOT NULL,
    hot_topic_id INTEGER NOT NULL,
    topic_title TEXT NOT NULL,
    topic_url TEXT DEFAULT '',
    confidence REAL DEFAULT 0,
    reason TEXT DEFAULT '',
    is_read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS known_models (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    provider TEXT DEFAULT '',
    context_length INTEGER DEFAULT 0,
    first_seen TEXT DEFAULT (datetime('now', 'localtime'))
  );
`);

const defaultSettings: Record<string, string> = {
  email_enabled: 'false',
  email_smtp_host: '',
  email_smtp_port: '587',
  email_smtp_user: '',
  email_smtp_pass: '',
  email_to: '',
  check_interval: '30',
  openrouter_model: 'deepseek/deepseek-chat',
  twitterapi_io_key: '',
  twitterapi_io_enabled: 'false',
  serper_api_key: '',
};

for (const [key, value] of Object.entries(defaultSettings)) {
  db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run(key, value);
}

export const q = {
  // Keywords
  getKeywords: () => db.prepare('SELECT * FROM keywords ORDER BY created_at DESC').all(),
  getActiveKeywords: () => db.prepare('SELECT * FROM keywords WHERE active = 1').all(),
  insertKeyword: db.prepare('INSERT INTO keywords (keyword, description) VALUES (?, ?)'),
  updateKeyword: db.prepare('UPDATE keywords SET keyword = ?, description = ?, active = ? WHERE id = ?'),
  deleteKeyword: db.prepare('DELETE FROM keywords WHERE id = ?'),
  getKeywordById: (id: number | string) => db.prepare('SELECT * FROM keywords WHERE id = ?').get(id),

  // Raw items
  insertRawItem: db.prepare(
    'INSERT OR IGNORE INTO raw_items (source, title, url, content, published_at) VALUES (?, ?, ?, ?, ?)'
  ),
  getUnprocessedItems: () =>
    db.prepare('SELECT * FROM raw_items WHERE processed = 0 ORDER BY crawled_at DESC LIMIT 50').all(),
  markProcessed: db.prepare('UPDATE raw_items SET processed = 1 WHERE id = ?'),

  // Hot topics
  insertHotTopic: db.prepare(
    'INSERT INTO hot_topics (raw_item_id, title, url, source, summary, score, category, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ),
  getRecentTopics: (hours = 48) =>
    db
      .prepare(
        `SELECT ht.*,
          (SELECT COUNT(*) FROM alerts a WHERE a.hot_topic_id = ht.id) as alert_count
         FROM hot_topics ht
         WHERE ht.created_at > datetime('now', '-' || ? || ' hours', 'localtime')
         ORDER BY ht.score DESC, ht.created_at DESC
         LIMIT 100`
      )
      .all(hours),

  // Alerts
  insertAlert: db.prepare(
    'INSERT INTO alerts (keyword_id, keyword_text, hot_topic_id, topic_title, topic_url, confidence, reason) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ),
  checkDuplicateAlert: (kwId: number, topicId: number) =>
    db.prepare('SELECT id FROM alerts WHERE keyword_id = ? AND hot_topic_id = ?').get(kwId, topicId),
  getAlerts: (limit = 50) =>
    db.prepare('SELECT * FROM alerts ORDER BY created_at DESC LIMIT ?').all(limit),
  getUnreadAlertCount: () =>
    (db.prepare('SELECT COUNT(*) as cnt FROM alerts WHERE is_read = 0').get() as any).cnt,
  markAlertRead: db.prepare('UPDATE alerts SET is_read = 1 WHERE id = ?'),
  markAllAlertsRead: db.prepare('UPDATE alerts SET is_read = 1'),

  // Settings
  getSetting: (key: string): string =>
    (db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as any)?.value ?? '',
  setSetting: db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)'),
  getAllSettings: (): Record<string, string> => {
    const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  },

  // Known models (OpenRouter model tracking)
  isModelKnown: (id: string) =>
    !!db.prepare('SELECT id FROM known_models WHERE id = ?').get(id),
  insertKnownModel: db.prepare(
    'INSERT OR IGNORE INTO known_models (id, name, provider, context_length) VALUES (?, ?, ?, ?)'
  ),
  getKnownModelCount: () =>
    (db.prepare('SELECT COUNT(*) as cnt FROM known_models').get() as any).cnt as number,
};

export default db;
