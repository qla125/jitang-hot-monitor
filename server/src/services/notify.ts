import nodemailer from 'nodemailer';
import { q } from '../db';

export interface AlertPayload {
  keyword: string;
  title: string;
  url: string;
  summary: string;
  confidence: number;
}

// SSE client registry
type SSEClient = { write: (data: string) => void; on: (event: string, fn: () => void) => void };
const sseClients = new Set<SSEClient>();

export function addSSEClient(res: SSEClient) {
  sseClients.add(res);
  res.on('close', () => sseClients.delete(res));
  console.log(`[SSE] Client connected (total: ${sseClients.size})`);
}

export function broadcastSSE(event: string, data: unknown) {
  if (sseClients.size === 0) return;
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach((client) => {
    try {
      client.write(message);
    } catch {
      sseClients.delete(client);
    }
  });
}

export async function notifyAlert(payload: AlertPayload): Promise<void> {
  // Always broadcast via SSE
  broadcastSSE('alert', payload);

  // Email if configured
  const settings = q.getAllSettings();
  if (settings.email_enabled === 'true' && settings.email_to && settings.email_smtp_host) {
    await sendEmail(payload, settings).catch((e) =>
      console.error('[Notify] Email error:', e.message)
    );
  }
}

async function sendEmail(payload: AlertPayload, settings: Record<string, string>): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: settings.email_smtp_host,
    port: parseInt(settings.email_smtp_port) || 587,
    secure: parseInt(settings.email_smtp_port) === 465,
    auth: {
      user: settings.email_smtp_user,
      pass: settings.email_smtp_pass,
    },
  });

  await transporter.sendMail({
    from: `"极客雷达" <${settings.email_smtp_user}>`,
    to: settings.email_to,
    subject: `🚨 极客雷达 | 关键词命中: "${payload.keyword}"`,
    html: `
      <div style="font-family:-apple-system,Arial,sans-serif;max-width:600px;margin:0 auto;background:#050810;color:#e8eaf6;border-radius:12px;overflow:hidden">
        <div style="padding:24px;background:linear-gradient(135deg,#0a1628,#0d1f3c);border-bottom:1px solid #00f5d4">
          <h2 style="margin:0;color:#00f5d4;font-size:20px">🎯 极客雷达 — 关键词命中</h2>
          <p style="margin:8px 0 0;color:#7c8db5;font-size:14px">监控关键词: <strong style="color:#f5a623">${payload.keyword}</strong> · 置信度 ${(payload.confidence * 100).toFixed(0)}%</p>
        </div>
        <div style="padding:24px">
          <h3 style="margin:0 0 12px;color:#e8eaf6;font-size:16px;line-height:1.5">${payload.title}</h3>
          <p style="margin:0 0 20px;color:#7c8db5;font-size:14px;line-height:1.6">${payload.summary}</p>
          <a href="${payload.url}" style="display:inline-block;background:#00f5d4;color:#050810;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:700;font-size:14px">查看原文 →</a>
        </div>
        <div style="padding:16px 24px;background:#0a0e1a;font-size:12px;color:#4a5568;text-align:center">极客雷达 AI 热点监控 · 自动发送，无需回复</div>
      </div>
    `,
  });

  console.log(`[Notify] Email sent for keyword "${payload.keyword}"`);
}
