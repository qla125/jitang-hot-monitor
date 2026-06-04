import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';

import keywordsRouter from './routes/keywords';
import hotTopicsRouter from './routes/hotTopics';
import alertsRouter from './routes/alerts';
import settingsRouter from './routes/settings';
import sseRouter from './routes/sse';
import { startScheduler } from './scheduler';

const app = express();
const PORT = parseInt(process.env.PORT || '3001');

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:3001'] }));
app.use(express.json());

// API routes
app.use('/api/keywords', keywordsRouter);
app.use('/api/hot-topics', hotTopicsRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/settings', settingsRouter);
app.use('/events', sseRouter);

// Serve built client in production
const clientDist = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  startScheduler();
});

export default app;
