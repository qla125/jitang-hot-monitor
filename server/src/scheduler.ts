import cron from 'node-cron';
import { crawlAll } from './services/crawler';
import { processNewItems } from './services/monitor';
import { broadcastSSE } from './services/notify';
import { q } from './db';

let isRunning = false;
let cronTask: cron.ScheduledTask | null = null;

export async function runPipeline(): Promise<void> {
  if (isRunning) {
    console.log('[Scheduler] Already running, skipping');
    return;
  }
  isRunning = true;
  console.log('[Scheduler] Pipeline started');

  try {
    const newCount = await crawlAll();
    if (newCount > 0) {
      await processNewItems();
    }
    broadcastSSE('refresh', { newItems: newCount });
  } catch (e) {
    console.error('[Scheduler] Pipeline error:', (e as Error).message);
  } finally {
    isRunning = false;
    console.log('[Scheduler] Pipeline done');
  }
}

export function startScheduler(): void {
  const intervalMins = parseInt(q.getSetting('check_interval') || '30') || 30;
  console.log(`[Scheduler] Starting — interval: ${intervalMins}m`);

  // Run immediately on startup
  setTimeout(runPipeline, 2000);

  // Schedule recurring
  cronTask = cron.schedule(`*/${intervalMins} * * * *`, runPipeline);
}

export function stopScheduler(): void {
  cronTask?.stop();
}
