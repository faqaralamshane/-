/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { exportAll } from './db';
import { sendTelegramBackup } from './telegram';

let isSyncing = false;

export function getPendingSyncCount(): number {
  return parseInt(localStorage.getItem('faqar-pending-sync') || '0', 10);
}

export function incrementPendingSync(): void {
  const count = getPendingSyncCount() + 1;
  localStorage.setItem('faqar-pending-sync', String(count));
  triggerSyncChangeEvent();
}

export function decrementPendingSync(snapshot: number): void {
  const count = Math.max(0, getPendingSyncCount() - snapshot);
  localStorage.setItem('faqar-pending-sync', String(count));
  triggerSyncChangeEvent();
}

export function resetPendingSync(): void {
  localStorage.setItem('faqar-pending-sync', '0');
  triggerSyncChangeEvent();
}

export function getLastSyncTime(): string {
  return localStorage.getItem('faqar-last-sync') || 'لم يتم المزامنة بعد';
}

function triggerSyncChangeEvent() {
  const event = new CustomEvent('faqar-sync-change', {
    detail: {
      pending: getPendingSyncCount(),
      online: navigator.onLine,
      syncing: isSyncing,
      lastSync: getLastSyncTime()
    }
  });
  window.dispatchEvent(event);
}

export async function syncNow(): Promise<boolean> {
  if (isSyncing) return false;
  if (!navigator.onLine) {
    triggerSyncChangeEvent();
    return false;
  }

  const pendingCount = getPendingSyncCount();
  // Even if pending count is 0, we can still backup if the user clicks force sync
  isSyncing = true;
  triggerSyncChangeEvent();

  try {
    const data = await exportAll();
    const jsonString = JSON.stringify(data, null, 2);
    
    await sendTelegramBackup(jsonString);
    
    // Success
    decrementPendingSync(pendingCount);
    localStorage.setItem('faqar-last-sync', new Date().toLocaleString('ar-IQ'));
    isSyncing = false;
    triggerSyncChangeEvent();
    return true;
  } catch (err) {
    console.error('Sync failed', err);
    isSyncing = false;
    triggerSyncChangeEvent();
    throw err;
  }
}

// Automatically register listeners
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    syncNow().catch((err) => console.error('Auto-sync on online failed', err));
  });
  window.addEventListener('offline', () => {
    triggerSyncChangeEvent();
  });

  // Check every 120 seconds to retry sync
  setInterval(() => {
    if (getPendingSyncCount() > 0 && navigator.onLine && !isSyncing) {
      syncNow().catch((err) => console.log('Periodic auto-sync failed', err));
    }
  }, 120000);
}
