/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SESSION_TOKEN, isUserAuthenticated } from './auth';

export function getAuthToken(): string | null {
  if (isUserAuthenticated()) {
    return SESSION_TOKEN;
  }
  return localStorage.getItem('faqar-auth-v2') || SESSION_TOKEN;
}

export async function sendTelegramBackup(jsonString: string): Promise<void> {
  const token = getAuthToken() || '';
  const response = await fetch('/api/telegram/backup', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      json: jsonString,
      filename: `faqar_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
      token
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(errText || 'فشل في إرسال النسخة الاحتياطية إلى تيليجرام');
  }
}

export async function sendTelegramMessage(text: string): Promise<void> {
  const token = getAuthToken() || '';
  const response = await fetch('/api/telegram/message', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text,
      token
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(errText || 'فشل في إرسال الرسالة إلى تيليجرام');
  }
}
