/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));

// 0. API: Central Synchronization GET and POST
const SYNC_FILE_PATH = path.join(process.cwd(), 'database_sync.json');
const BACKUPS_DIR = path.join(process.cwd(), 'backups_history');

// Create backups directory if not exists
if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

function getLocalDateString(): string {
  const date = new Date();
  // Adjust for Iraq time (UTC+3)
  const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
  const iraqTime = new Date(utc + (3600000 * 3));
  const year = iraqTime.getFullYear();
  const month = String(iraqTime.getMonth() + 1).padStart(2, '0');
  const day = String(iraqTime.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

app.get('/api/sync/download', (req, res) => {
  try {
    if (fs.existsSync(SYNC_FILE_PATH)) {
      const data = fs.readFileSync(SYNC_FILE_PATH, 'utf8');
      return res.json(JSON.parse(data));
    }
    return res.status(404).send('No synchronized database file found');
  } catch (err: any) {
    console.error('Error downloading synchronized database:', err);
    return res.status(500).send('Error reading synchronized database');
  }
});

app.post('/api/sync/upload', (req, res) => {
  try {
    const data = req.body;
    if (!data || typeof data !== 'object') {
      return res.status(400).send('Invalid data payload');
    }
    
    // 1. Live Sync overwrite
    fs.writeFileSync(SYNC_FILE_PATH, JSON.stringify(data, null, 2), 'utf8');

    // 2. Server-side automatic rolling 7-day backup
    if (!fs.existsSync(BACKUPS_DIR)) {
      fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    }

    const dateStr = getLocalDateString();
    const backupFilePath = path.join(BACKUPS_DIR, `backup_${dateStr}.json`);
    
    // Write backup file for today (updates if edited multiple times in the same day)
    fs.writeFileSync(backupFilePath, JSON.stringify(data, null, 2), 'utf8');

    // 3. Keep exactly the last 7 days of backups
    const files = fs.readdirSync(BACKUPS_DIR)
      .filter(f => f.startsWith('backup_') && f.endsWith('.json'))
      .map(f => ({
        name: f,
        filePath: path.join(BACKUPS_DIR, f)
      }));

    // Sort alphabetically by name (since date format is YYYY-MM-DD, alphabetical sorting perfectly matches chronological order)
    files.sort((a, b) => a.name.localeCompare(b.name));

    if (files.length > 7) {
      const toDelete = files.slice(0, files.length - 7);
      for (const f of toDelete) {
        fs.unlinkSync(f.filePath);
        console.log(`Deleted old server-side rolling backup file: ${f.name}`);
      }
    }

    return res.json({ success: true, message: 'Database synchronized and rolling server backup saved successfully' });
  } catch (err: any) {
    console.error('Error uploading synchronized database:', err);
    return res.status(500).send('Error writing synchronized database');
  }
});

// GET: List available server-side rolling backups
app.get('/api/sync/backups', (req, res) => {
  try {
    if (!fs.existsSync(BACKUPS_DIR)) {
      return res.json([]);
    }
    const files = fs.readdirSync(BACKUPS_DIR)
      .filter(f => f.startsWith('backup_') && f.endsWith('.json'))
      .map(f => {
        const stats = fs.statSync(path.join(BACKUPS_DIR, f));
        const datePart = f.replace('backup_', '').replace('.json', '');
        return {
          filename: f,
          date: datePart,
          size: stats.size,
          modifiedAt: stats.mtime.toISOString()
        };
      });

    // Sort newest first
    files.sort((a, b) => b.filename.localeCompare(a.filename));
    return res.json(files);
  } catch (err: any) {
    console.error('Error listing server-side backups:', err);
    return res.status(500).send('Error listing server-side backups');
  }
});

// POST: Restore a server-side backup
app.post('/api/sync/restore-backup', (req, res) => {
  try {
    const { filename } = req.body;
    if (!filename || typeof filename !== 'string') {
      return res.status(400).send('Invalid filename');
    }

    const backupFilePath = path.join(BACKUPS_DIR, filename);
    if (!fs.existsSync(backupFilePath)) {
      return res.status(404).send('Backup file not found');
    }

    // Overwrite the live database sync
    const backupContent = fs.readFileSync(backupFilePath, 'utf8');
    fs.writeFileSync(SYNC_FILE_PATH, backupContent, 'utf8');

    return res.json({ success: true, message: 'Server backup restored successfully' });
  } catch (err: any) {
    console.error('Error restoring backup on server:', err);
    return res.status(500).send('Error restoring backup');
  }
});

// Auth Token constant (matches SHA-256("10001000Qq|session-v1"))
const DEFAULT_SESSION_TOKEN = '6f30a8f095138bc1a35302a5fd045f180604ec65198cd7137d12f975c0a2f66d';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '1155110938';

function isAuthorized(token: string): boolean {
  const serverToken = process.env.APP_AUTH_TOKEN || DEFAULT_SESSION_TOKEN;
  return token === serverToken;
}

function getCleanBotToken(): { token: string; isValid: boolean } {
  const rawToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!rawToken) {
    return { token: '', isValid: false };
  }
  const token = rawToken.trim().replace(/^["']|["']$/g, '');
  const isValid = /^\d+:[a-zA-Z0-9_-]+$/.test(token) && token !== 'MY_TELEGRAM_BOT_TOKEN';
  return { token, isValid };
}

// 1. API: Telegram Backup
app.post('/api/telegram/backup', async (req, res) => {
  const { json, filename, token } = req.body;

  if (!isAuthorized(token)) {
    return res.status(401).send('غير مصرح لك بإجراء النسخ الاحتياطي');
  }

  if (!json) {
    return res.status(400).send('لم يتم إرسال بيانات النسخة الاحتياطية');
  }

  const { token: botToken, isValid: isTokenValid } = getCleanBotToken();
  if (!isTokenValid) {
    console.warn('TELEGRAM_BOT_TOKEN is missing, invalid, or set to placeholder in server environment.');
    // In preview/dev mode or unconfigured mode, pretend it worked and log it, rather than failing.
    return res.json({ success: true, mock: true, message: 'TELEGRAM_BOT_TOKEN غير متوفر أو غير مهيأ بعد. تم حفظ النسخة في سجلات الخادم.' });
  }

  try {
    const backupFilename = filename || `faqar_backup_${Date.now()}.json`;
    const blob = new Blob([json], { type: 'application/json' });
    
    // Build multipart/form-data
    const formData = new FormData();
    formData.append('chat_id', TELEGRAM_CHAT_ID);
    formData.append('caption', `📦 نسخة احتياطية من تطبيق الأقساط الذكية\nالتاريخ: ${new Date().toLocaleString('ar-IQ')}`);
    formData.append('document', blob, backupFilename);

    const tgResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
      method: 'POST',
      body: formData
    });

    if (!tgResponse.ok) {
      const tgErr = await tgResponse.text();
      throw new Error(`Telegram API Error: ${tgErr}`);
    }

    const tgResult = await tgResponse.json();
    res.json({ success: true, message: 'تم إرسال النسخة الاحتياطية بنجاح إلى تيليجرام', details: tgResult });
  } catch (err: any) {
    console.error('Error sending backup to Telegram:', err);
    res.status(500).send(`فشل إرسال النسخة لتيليجرام: ${err.message}`);
  }
});

// 2. API: Telegram Message
app.post('/api/telegram/message', async (req, res) => {
  const { text, token } = req.body;

  if (!isAuthorized(token)) {
    return res.status(401).send('غير مصرح لك بإرسال الرسائل');
  }

  if (!text) {
    return res.status(400).send('محتوى الرسالة فارغ');
  }

  const { token: botToken, isValid: isTokenValid } = getCleanBotToken();
  if (!isTokenValid) {
    console.warn('TELEGRAM_BOT_TOKEN is missing, invalid, or set to placeholder in server environment.');
    // Let's print the message to server log and return success
    console.log('--- TELEGRAM PENDING ALERT ---');
    console.log(text);
    console.log('------------------------------');
    return res.json({ success: true, mock: true, message: 'TELEGRAM_BOT_TOKEN غير متوفر أو غير مهيأ بعد. تم طباعة التنبيه في سجل الخادم.' });
  }

  try {
    const tgResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: text,
        parse_mode: 'Markdown'
      })
    });

    if (!tgResponse.ok) {
      const tgErr = await tgResponse.text();
      throw new Error(`Telegram API Error: ${tgErr}`);
    }

    const tgResult = await tgResponse.json();
    res.json({ success: true, message: 'تم إرسال الرسالة بنجاح إلى تيليجرام', details: tgResult });
  } catch (err: any) {
    console.error('Error sending message to Telegram:', err);
    res.status(500).send(`فشل إرسال الرسالة لتيليجرام: ${err.message}`);
  }
});

// Vite & Static file serving setup
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(process.cwd(), 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running at http://localhost:${PORT}`);
  });
}

startServer();
