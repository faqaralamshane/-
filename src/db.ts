/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Customer, Contract, Payment, Debt, Salaf, FinancialAccount, FinancialTransaction } from './types';

const DB_NAME = 'faqar-installments';
const DB_VERSION = 4;

export function uid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'id-' + Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
}

export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = request.result;

      if (!db.objectStoreNames.contains('customers')) {
        db.createObjectStore('customers', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('contracts')) {
        const contractStore = db.createObjectStore('contracts', { keyPath: 'id' });
        contractStore.createIndex('byCustomer', 'customerId', { unique: false });
      }

      if (!db.objectStoreNames.contains('payments')) {
        const paymentStore = db.createObjectStore('payments', { keyPath: 'id' });
        paymentStore.createIndex('byContract', 'contractId', { unique: false });
      }

      if (!db.objectStoreNames.contains('debts')) {
        db.createObjectStore('debts', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }

      if (!db.objectStoreNames.contains('salafs')) {
        db.createObjectStore('salafs', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('financial_accounts')) {
        db.createObjectStore('financial_accounts', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('financial_transactions')) {
        db.createObjectStore('financial_transactions', { keyPath: 'id' });
      }
    };
  });
}

let dbCache: Record<string, any> = {};

export function clearDbCache(): void {
  dbCache = {};
}

export function getAllFromStore<T>(storeName: 'customers' | 'contracts' | 'payments' | 'meta' | 'debts' | 'salafs' | 'financial_accounts' | 'financial_transactions'): Promise<T[]> {
  if (dbCache[storeName]) {
    return Promise.resolve(dbCache[storeName] as T[]);
  }
  return openDB().then((db) => {
    return new Promise<T[]>((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        dbCache[storeName] = request.result;
        resolve(request.result as T[]);
      };
      request.onerror = () => reject(request.error);
    });
  });
}

export function triggerBackgroundSync(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('faqar-db-changed'));
    if (navigator.onLine) {
      exportAll().then((data) => {
        fetch('/api/sync/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        }).catch((err) => console.warn('Background sync upload failed:', err));
      }).catch((err) => console.warn('Background sync export failed:', err));
    }
  }
}

export function putInStore<T>(storeName: 'customers' | 'contracts' | 'payments' | 'meta' | 'debts' | 'salafs' | 'financial_accounts' | 'financial_transactions', item: T): Promise<void> {
  delete dbCache[storeName]; // invalidate cache
  return openDB().then((db) => {
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(item);

      request.onsuccess = () => {
        resolve();
        triggerBackgroundSync();
      };
      request.onerror = () => reject(request.error);
    });
  });
}

export function deleteFromStore(storeName: 'customers' | 'contracts' | 'payments' | 'meta' | 'debts' | 'salafs' | 'financial_accounts' | 'financial_transactions', id: string): Promise<void> {
  delete dbCache[storeName]; // invalidate cache
  return openDB().then((db) => {
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(id);

      request.onsuccess = () => {
        resolve();
        triggerBackgroundSync();
      };
      request.onerror = () => reject(request.error);
    });
  });
}

export interface ExportData {
  exportedAt: string;
  customers: Customer[];
  contracts: Contract[];
  payments: Payment[];
  debts?: Debt[];
  salafs?: Salaf[];
  financialAccounts?: FinancialAccount[];
  financialTransactions?: FinancialTransaction[];
  workspaceConfig?: {
    linkedSheetId?: string;
    workspaceToken?: string;
    workspaceTokenAcquiredAt?: string;
    googleUser?: any;
    gdriveFolderIsAutogenerated?: string;
    gdriveFolderUrl?: string;
    gdriveFolderId?: string;
    gdrive7dayFolderId?: string;
    autoBackupLast?: string;
    autoBackupLastTimestamp?: string;
  };
}

export function exportAll(): Promise<ExportData> {
  return Promise.all([
    getAllFromStore<Customer>('customers'),
    getAllFromStore<Contract>('contracts'),
    getAllFromStore<Payment>('payments'),
    getAllFromStore<Debt>('debts').catch(() => []),
    getAllFromStore<Salaf>('salafs').catch(() => []),
    getAllFromStore<FinancialAccount>('financial_accounts').catch(() => []),
    getAllFromStore<FinancialTransaction>('financial_transactions').catch(() => [])
  ]).then(([customers, contracts, payments, debts, salafs, financialAccounts, financialTransactions]) => {
    let googleUser: any = null;
    const userStr = localStorage.getItem('faqar-workspace-user');
    if (userStr) {
      try {
        googleUser = JSON.parse(userStr);
      } catch (e) {}
    }

    return {
      exportedAt: new Date().toISOString(),
      customers,
      contracts,
      payments,
      debts,
      salafs,
      financialAccounts,
      financialTransactions,
      workspaceConfig: {
        linkedSheetId: localStorage.getItem('faqar-linked-sheet-id') || undefined,
        workspaceToken: localStorage.getItem('faqar-workspace-token') || undefined,
        workspaceTokenAcquiredAt: localStorage.getItem('faqar-workspace-token-acquired-at') || undefined,
        googleUser: googleUser || undefined,
        gdriveFolderIsAutogenerated: localStorage.getItem('faqar-gdrive-folder-is-autogenerated') || undefined,
        gdriveFolderUrl: localStorage.getItem('faqar-gdrive-folder-url') || undefined,
        gdriveFolderId: localStorage.getItem('faqar-gdrive-folder-id') || undefined,
        gdrive7dayFolderId: localStorage.getItem('faqar-gdrive-7day-folder-id') || undefined,
        autoBackupLast: localStorage.getItem('faqar-auto-backup-last') || undefined,
        autoBackupLastTimestamp: localStorage.getItem('faqar-auto-backup-last-timestamp') || undefined
      }
    };
  });
}

export function importAll(data: Partial<ExportData>, skipUpload = false): Promise<void> {
  clearDbCache();

  // Smartly restore Google Workspace connection state from the server database
  if (data.workspaceConfig) {
    let changed = false;
    if (data.workspaceConfig.linkedSheetId) {
      localStorage.setItem('faqar-linked-sheet-id', data.workspaceConfig.linkedSheetId);
      changed = true;
    }
    if (data.workspaceConfig.workspaceToken) {
      localStorage.setItem('faqar-workspace-token', data.workspaceConfig.workspaceToken);
      changed = true;
    }
    if (data.workspaceConfig.workspaceTokenAcquiredAt) {
      localStorage.setItem('faqar-workspace-token-acquired-at', data.workspaceConfig.workspaceTokenAcquiredAt);
      changed = true;
    }
    if (data.workspaceConfig.googleUser) {
      localStorage.setItem('faqar-workspace-user', JSON.stringify(data.workspaceConfig.googleUser));
      changed = true;
    }
    if (data.workspaceConfig.gdriveFolderIsAutogenerated) {
      localStorage.setItem('faqar-gdrive-folder-is-autogenerated', data.workspaceConfig.gdriveFolderIsAutogenerated);
    }
    if (data.workspaceConfig.gdriveFolderUrl) {
      localStorage.setItem('faqar-gdrive-folder-url', data.workspaceConfig.gdriveFolderUrl);
    }
    if (data.workspaceConfig.gdriveFolderId) {
      localStorage.setItem('faqar-gdrive-folder-id', data.workspaceConfig.gdriveFolderId);
    }
    if (data.workspaceConfig.gdrive7dayFolderId) {
      localStorage.setItem('faqar-gdrive-7day-folder-id', data.workspaceConfig.gdrive7dayFolderId);
    }
    if (data.workspaceConfig.autoBackupLast) {
      localStorage.setItem('faqar-auto-backup-last', data.workspaceConfig.autoBackupLast);
    }
    if (data.workspaceConfig.autoBackupLastTimestamp) {
      localStorage.setItem('faqar-auto-backup-last-timestamp', data.workspaceConfig.autoBackupLastTimestamp);
    }
    if (changed) {
      setTimeout(() => {
        window.dispatchEvent(new Event('faqar-linked-sheet-id-updated'));
        window.dispatchEvent(new Event('faqar-workspace-token-updated'));
      }, 100);
    }
  }

  return openDB().then((db) => {
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(['customers', 'contracts', 'payments', 'debts', 'salafs', 'financial_accounts', 'financial_transactions'], 'readwrite');

      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => resolve();

      const customerStore = transaction.objectStore('customers');
      const contractStore = transaction.objectStore('contracts');
      const paymentStore = transaction.objectStore('payments');
      const debtStore = transaction.objectStore('debts');
      const salafStore = transaction.objectStore('salafs');
      const financialAccountsStore = transaction.objectStore('financial_accounts');
      const financialTransactionsStore = transaction.objectStore('financial_transactions');

      // Clear existing
      customerStore.clear();
      contractStore.clear();
      paymentStore.clear();
      debtStore.clear();
      salafStore.clear();
      financialAccountsStore.clear();
      financialTransactionsStore.clear();

      if (data.customers) {
        data.customers.forEach((c) => customerStore.put(c));
      }
      if (data.contracts) {
        data.contracts.forEach((c) => contractStore.put(c));
      }
      if (data.payments) {
        data.payments.forEach((p) => paymentStore.put(p));
      }
      if (data.debts) {
        data.debts.forEach((d) => debtStore.put(d));
      }
      if (data.salafs) {
        data.salafs.forEach((s) => salafStore.put(s));
      }
      if (data.financialAccounts) {
        data.financialAccounts.forEach((fa) => financialAccountsStore.put(fa));
      }
      if (data.financialTransactions) {
        data.financialTransactions.forEach((ft) => financialTransactionsStore.put(ft));
      }
    });
  }).then(() => {
    if (!skipUpload) {
      triggerBackgroundSync();
    }
  });
}

export function clearAll(): Promise<void> {
  clearDbCache();
  return openDB().then((db) => {
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(['customers', 'contracts', 'payments', 'debts', 'salafs', 'financial_accounts', 'financial_transactions'], 'readwrite');
      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => resolve();

      transaction.objectStore('customers').clear();
      transaction.objectStore('contracts').clear();
      transaction.objectStore('payments').clear();
      transaction.objectStore('debts').clear();
      transaction.objectStore('salafs').clear();
      transaction.objectStore('financial_accounts').clear();
      transaction.objectStore('financial_transactions').clear();
    });
  });
}

