/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';
import { Customer, Contract, Payment, Debt, Salaf, FinancialAccount, FinancialTransaction } from './types';
import { fmtIQD, remainingForContract, totalPaidForContract } from './finance';
import { exportAll, importAll } from './db';

// Reuse existing app or initialize
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
// Request Workspace Scopes
provider.addScope('https://www.googleapis.com/auth/drive.file');
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/calendar');
provider.addScope('https://www.googleapis.com/auth/documents');

let isSigningIn = false;
let cachedAccessToken: string | null = null;
const rawToken = localStorage.getItem('faqar-workspace-token');
if (rawToken && rawToken !== 'null' && rawToken !== 'undefined' && rawToken.trim() !== '') {
  cachedAccessToken = rawToken;
}

export const isTokenExpired = (): boolean => {
  const acquiredAtStr = localStorage.getItem('faqar-workspace-token-acquired-at');
  if (!acquiredAtStr) return true;
  const acquiredAt = parseInt(acquiredAtStr, 10);
  // Google access tokens expire in exactly 3600 seconds. We use a 5-minute buffer (3300 seconds).
  return Date.now() - acquiredAt > 3300 * 1000;
};

export const initAuth = (
  onAuthSuccess?: (user: any, token: string) => void,
  onAuthFailure?: () => void
) => {
  const refreshLocalState = () => {
    const raw = localStorage.getItem('faqar-workspace-token');
    if (raw && raw !== 'null' && raw !== 'undefined' && raw.trim() !== '') {
      cachedAccessToken = raw;
    } else {
      cachedAccessToken = null;
    }
  };

  const checkAndNotify = () => {
    refreshLocalState();
    const token = cachedAccessToken;
    const savedUserStr = localStorage.getItem('faqar-workspace-user');
    if (token) {
      let parsedUser: any = { displayName: 'حساب جوجل المعتمد', email: 'faqar@gmail.com', photoURL: '' };
      if (savedUserStr) {
        try {
          parsedUser = JSON.parse(savedUserStr);
        } catch (e) {}
      }
      if (onAuthSuccess) onAuthSuccess(parsedUser, token);
    } else {
      if (onAuthFailure) onAuthFailure();
    }
  };

  // Run initially
  checkAndNotify();

  const handleTokenUpdated = () => {
    checkAndNotify();
  };

  window.addEventListener('faqar-workspace-token-updated', handleTokenUpdated);

  const unsub = onAuthStateChanged(auth, async (user: User | null) => {
    refreshLocalState();
    if (user) {
      const userInfo = {
        displayName: user.displayName || 'حساب جوجل المعتمد',
        email: user.email || '',
        photoURL: user.photoURL || ''
      };
      localStorage.setItem('faqar-workspace-user', JSON.stringify(userInfo));
      checkAndNotify();
    } else {
      // Do NOT delete the token if firebase user is null but we have a token in localStorage.
      // This is crucial to keep the connection persistent across devices and sessions.
      if (!localStorage.getItem('faqar-workspace-token')) {
        if (onAuthFailure) onAuthFailure();
      } else {
        checkAndNotify();
      }
    }
  });

  return () => {
    unsub();
    window.removeEventListener('faqar-workspace-token-updated', handleTokenUpdated);
  };
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('فشل الحصول على رمز الوصول (Access Token) من جوجل');
    }

    cachedAccessToken = credential.accessToken;
    localStorage.setItem('faqar-workspace-token', cachedAccessToken);
    localStorage.setItem('faqar-workspace-token-acquired-at', Date.now().toString());

    const userInfo = {
      displayName: result.user.displayName || 'حساب جوجل المعتمد',
      email: result.user.email || '',
      photoURL: result.user.photoURL || ''
    };
    localStorage.setItem('faqar-workspace-user', JSON.stringify(userInfo));

    // Sync to other components
    window.dispatchEvent(new Event('faqar-workspace-token-updated'));
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Workspace Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (allowExpired = false): Promise<string | null> => {
  if (!allowExpired && isTokenExpired()) {
    return null;
  }
  const token = cachedAccessToken || localStorage.getItem('faqar-workspace-token');
  if (!token || token === 'null' || token === 'undefined' || token.trim() === '') {
    return null;
  }
  return token;
};

export const logoutWorkspace = async () => {
  try {
    await auth.signOut();
  } catch (e) {}
  cachedAccessToken = null;
  localStorage.removeItem('faqar-workspace-token');
  localStorage.removeItem('faqar-workspace-token-acquired-at');
  localStorage.removeItem('faqar-workspace-user');
  window.dispatchEvent(new Event('faqar-workspace-token-updated'));
};

/**
 * Custom fetch wrapper to handle Google API requests, automatic token injection,
 * and elegant handling of expired session errors (401).
 */
export async function googleFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = cachedAccessToken || await getAccessToken();
  if (!token) {
    throw new Error('يرجى تسجيل الدخول باستخدام جوجل أولاً');
  }

  const reqHeaders = (options.headers || {}) as Record<string, string>;
  const headers = {
    ...reqHeaders,
    Authorization: reqHeaders.Authorization || `Bearer ${token}`
  };

  const res = await window.fetch(url, { ...options, headers });

  if (res.status === 401) {
    cachedAccessToken = null;
    // We do NOT remove the token or user from localStorage so that the account remains LINKED.
    // We only set the acquired-at flag to 0 so that isTokenExpired() returns true, and the UI knows it needs activation.
    localStorage.setItem('faqar-workspace-token-acquired-at', '0');
    window.dispatchEvent(new Event('faqar-google-auth-expired'));
    throw new Error('انتهت صلاحية جلسة جوجل (401). يرجى تنشيط الاتصال لإعادة تفويض الخدمة.');
  }

  return res;
}

// Lexically override fetch with googleFetch for all functions below in this module
const fetch = googleFetch;

/**
 * 0. HELPER TO GET OR CREATE WORKSPACE ROOT DIR
 */
export async function getOrCreateWorkspaceFolder(token: string): Promise<string> {
  const folderName = 'شيتات تطبيق فقار المتكامل من كوكل ستوديو اي';
  try {
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='${encodeURIComponent(folderName)}' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id)`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.files && searchData.files.length > 0) {
        return searchData.files[0].id;
      }
    }
  } catch (e) {
    console.warn('Failed searching for workspace folder, creating new one', e);
  }

  // Create folder
  const createFolderRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder'
    })
  });
  if (!createFolderRes.ok) {
    throw new Error('فشل إنشاء مجلد شيتات تطبيق فقار المتكامل على Google Drive');
  }
  const folderData = await createFolderRes.json();
  return folderData.id;
}

/**
 * Ensure all sheets exist inside the spreadsheet ID
 */
export async function ensureSheetsExist(token: string, spreadsheetId: string): Promise<void> {
  const REQUIRED_SHEETS = [
    'الزبائن',
    'عقود الأقساط',
    'الدفعات والمقبوضات',
    'الديون الكلية',
    'السلف والأسهم - القائمة',
    'السلف والأسهم - الأعضاء',
    'السلف والأسهم - الدفعات',
    'الحسابات المالية',
    'المعاملات المالية'
  ];

  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    throw new Error('فشل قراءة تفاصيل ملف Google Sheet المربوط');
  }

  const data = await res.json();
  const existingTitles: string[] = data.sheets ? data.sheets.map((s: any) => s.properties.title) : [];

  const requests: any[] = [];
  for (const title of REQUIRED_SHEETS) {
    if (!existingTitles.includes(title)) {
      requests.push({
        addSheet: {
          properties: { title }
        }
      });
    }
  }

  if (requests.length > 0) {
    const updateRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ requests })
    });
    if (!updateRes.ok) {
      const errText = await updateRes.text();
      throw new Error(`فشل تهيئة الصفحات المطلوبة في الملف: ${errText}`);
    }
  }
}

/**
 * 1. GOOGLE DRIVE BACKUP HELPERS
 */
export async function uploadBackupToDrive(jsonString: string): Promise<string> {
  const token = await getAccessToken();
  if (!token) throw new Error('يرجى تسجيل الدخول باستخدام جوجل أولاً');

  let folderId = '';
  try {
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='النسخ الاحتياطية لنظام الفقار' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id)`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.files && searchData.files.length > 0) {
        folderId = searchData.files[0].id;
      }
    }
  } catch (e) {
    console.warn('Failed searching for backup folder, creating new one', e);
  }

  if (!folderId) {
    try {
      const createFolderRes = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'النسخ الاحتياطية لنظام الفقار',
          mimeType: 'application/vnd.google-apps.folder'
        })
      });
      if (createFolderRes.ok) {
        const folderData = await createFolderRes.json();
        folderId = folderData.id;
      }
    } catch (e) {
      console.error('Failed to create backup folder', e);
    }
  }

  const filename = `faqar_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const metadata: any = {
    name: filename,
    mimeType: 'application/json'
  };
  if (folderId) {
    metadata.parents = [folderId];
  }

  const boundary = 'faqar_gdrive_boundary';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const body = 
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    jsonString +
    closeDelimiter;

  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body: body
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`فشل رفع الملف لجوجل درايف: ${errText || response.statusText}`);
  }

  const result = await response.json();
  return result.id;
}

/**
 * 2. GOOGLE SHEETS EXPORT/IMPORT SYSTEM HELPERS
 */
export async function exportWorkspaceDataToSheet(spreadsheetId: string): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new Error('يرجى تسجيل الدخول باستخدام جوجل أولاً');

  // 1. Ensure sheets exist
  await ensureSheetsExist(token, spreadsheetId);

  // 2. Export local data
  const dbData = await exportAll();

  // 3. Construct Tables
  const customersHeader = ['المعرف', 'الاسم الكامل', 'رقم الهاتف', 'ملاحظات', 'حالة الدخول', 'رمز الدخول', 'تاريخ الإضافة'];
  const customersRows = dbData.customers.map(c => [
    c.id || '',
    c.name || '',
    c.phone || '',
    c.notes || '',
    c.loginDisabled ? 'معطّل' : 'مفعّل',
    c.accessCode || '',
    c.createdAt || ''
  ]);

  const contractsHeader = ['معرف العقد', 'معرف الزبون', 'اسم المادة/السلعة', 'سعر الكاش', 'سعر القسط', 'القسط الشهري', 'يوم الاستحقاق', 'ملاحظات', 'تاريخ الإضافة'];
  const contractsRows = dbData.contracts.map(c => [
    c.id || '',
    c.customerId || '',
    c.itemName || '',
    String(c.cashPrice || 0),
    String(c.installmentPrice || 0),
    String(c.monthlyInstallment || 0),
    String(c.dueDay || 1),
    c.notes || '',
    c.createdAt || ''
  ]);

  const paymentsHeader = ['معرف الدفعة', 'معرف العقد', 'مبلغ الدفعة', 'تاريخ الدفعة', 'ملاحظات'];
  const paymentsRows = dbData.payments.map(p => [
    p.id || '',
    p.contractId || '',
    String(p.amount || 0),
    p.date || '',
    p.notes || ''
  ]);

  const debtsHeader = ['المعرف', 'اسم الشخص', 'رقم الهاتف', 'النوع', 'المبلغ الكلي', 'المبلغ المدفوع', 'تاريخ الاستحقاق', 'الحالة', 'الأولوية', 'الميزانية الشهرية لشراء الديون', 'الهدف الشهري للتسديد', 'ملاحظات', 'تاريخ الإضافة'];
  const debtsRows = (dbData.debts || []).map(d => [
    d.id || '',
    d.personName || '',
    d.phone || '',
    d.type === 'to_me' ? 'أطلبه دين' : 'يطلبني دين',
    String(d.totalAmount || 0),
    String(d.paidAmount || 0),
    d.dueDate || '',
    d.status || 'pending',
    d.priority || 'medium',
    String(d.monthlyPurchaseLimit || 0),
    String(d.targetMonthlyPayment || 0),
    d.notes || '',
    d.createdAt || ''
  ]);

  const salafsHeader = ['معرف السلفة', 'اسم السلفة', 'المبلغ الكلي', 'القسط الشهري', 'عدد الأشهر', 'تاريخ الانطلاق', 'ملاحظات', 'تاريخ الإضافة'];
  const salafsRows = (dbData.salafs || []).map(s => [
    s.id || '',
    s.name || '',
    String(s.totalAmount || 0),
    String(s.monthlyAmount || 0),
    String(s.monthsCount || 0),
    s.startDate || '',
    s.notes || '',
    s.createdAt || ''
  ]);

  const salafMembersHeader = ['معرف السلفة', 'معرف العضو', 'اسم العضو', 'الهاتف', 'هل استلم السلفة', 'رقم شهر الاستلام', 'تاريخ الاستلام', 'ملاحظات'];
  const salafMembersRows: string[][] = [];
  (dbData.salafs || []).forEach(s => {
    (s.members || []).forEach(m => {
      salafMembersRows.push([
        s.id,
        m.id || '',
        m.name || '',
        m.phone || '',
        m.isReceiver ? 'نعم' : 'لا',
        m.receiveMonthIndex ? String(m.receiveMonthIndex) : '',
        m.receiveDate || '',
        m.notes || ''
      ]);
    });
  });

  const salafPaymentsHeader = ['معرف الدفعة', 'معرف السلفة', 'معرف العضو', 'رقم الشهر', 'تاريخ الدفع', 'المبلغ', 'تم الدفع بواسطتي', 'ملاحظات'];
  const salafPaymentsRows: string[][] = [];
  (dbData.salafs || []).forEach(s => {
    (s.payments || []).forEach(p => {
      salafPaymentsRows.push([
        p.id || '',
        s.id,
        p.memberId || '',
        String(p.monthIndex || 1),
        p.date || '',
        String(p.amount || 0),
        p.isPaidByMe ? 'نعم' : 'لا',
        p.notes || ''
      ]);
    });
  });

  const financialAccountsHeader = ['المعرف', 'اسم الحساب', 'الرصيد', 'العملة', 'اللون', 'الأيقونة', 'تاريخ الإضافة'];
  const financialAccountsRows = (dbData.financialAccounts || []).map(fa => [
    fa.id || '',
    fa.name || '',
    String(fa.balance || 0),
    fa.currency || 'IQD',
    fa.color || '',
    fa.icon || '',
    fa.createdAt || ''
  ]);

  const financialTransactionsHeader = ['المعرف', 'معرف الحساب', 'النوع', 'المبلغ', 'الوصف', 'الفئة', 'التاريخ', 'الحساب المحول إليه', 'تاريخ الإضافة'];
  const financialTransactionsRows = (dbData.financialTransactions || []).map(ft => [
    ft.id || '',
    ft.accountId || '',
    ft.type || 'income',
    String(ft.amount || 0),
    ft.description || '',
    ft.category || '',
    ft.date || '',
    ft.transferToAccountId || '',
    ft.createdAt || ''
  ]);

  const REQUIRED_SHEETS = [
    'الزبائن',
    'عقود الأقساط',
    'الدفعات والمقبوضات',
    'الديون الكلية',
    'السلف والأسهم - القائمة',
    'السلف والأسهم - الأعضاء',
    'السلف والأسهم - الدفعات',
    'الحسابات المالية',
    'المعاملات المالية'
  ];

  // Batch clear existing contents to avoid residuals
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchClear`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      ranges: REQUIRED_SHEETS.map(title => `${title}!A1:Z10000`)
    })
  });

  // Batch update with current tables
  const updateRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      valueInputOption: 'USER_ENTERED',
      data: [
        { range: 'الزبائن!A1', values: [customersHeader, ...customersRows] },
        { range: 'عقود الأقساط!A1', values: [contractsHeader, ...contractsRows] },
        { range: 'الدفعات والمقبوضات!A1', values: [paymentsHeader, ...paymentsRows] },
        { range: 'الديون الكلية!A1', values: [debtsHeader, ...debtsRows] },
        { range: 'السلف والأسهم - القائمة!A1', values: [salafsHeader, ...salafsRows] },
        { range: 'السلف والأسهم - الأعضاء!A1', values: [salafMembersHeader, ...salafMembersRows] },
        { range: 'السلف والأسهم - الدفعات!A1', values: [salafPaymentsHeader, ...salafPaymentsRows] },
        { range: 'الحسابات المالية!A1', values: [financialAccountsHeader, ...financialAccountsRows] },
        { range: 'المعاملات المالية!A1', values: [financialTransactionsHeader, ...financialTransactionsRows] }
      ]
    })
  });

  if (!updateRes.ok) {
    const errText = await updateRes.text();
    throw new Error(`فشل تحديث خلايا شيت جوجل: ${errText}`);
  }
}

export async function importAllFromGoogleSheet(spreadsheetId: string): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new Error('يرجى تسجيل الدخول باستخدام جوجل أولاً');

  const REQUIRED_SHEETS = [
    'الزبائن',
    'عقود الأقساط',
    'الدفعات والمقبوضات',
    'الديون الكلية',
    'السلف والأسهم - القائمة',
    'السلف والأسهم - الأعضاء',
    'السلف والأسهم - الدفعات',
    'الحسابات المالية',
    'المعاملات المالية'
  ];

  const rangesQuery = REQUIRED_SHEETS.map(title => `ranges=${encodeURIComponent(title + '!A1:Z10000')}`).join('&');
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${rangesQuery}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`فشل قراءة البيانات من ملف Google Sheet المربوط: ${errText}`);
  }

  const data = await res.json();
  const valueRanges = data.valueRanges || [];

  const getValuesForRange = (sheetName: string): any[][] => {
    const rangeObj = valueRanges.find((vr: any) => vr.range && vr.range.includes(sheetName));
    return (rangeObj && rangeObj.values) ? rangeObj.values : [];
  };

  // 1. Customers
  const customerRows = getValuesForRange('الزبائن');
  const customers: Customer[] = [];
  if (customerRows.length > 1) {
    for (let i = 1; i < customerRows.length; i++) {
      const row = customerRows[i];
      if (!row[0] || !row[1]) continue;
      customers.push({
        id: row[0],
        name: row[1],
        phone: row[2] || '',
        notes: row[3] || '',
        loginDisabled: row[4] === 'معطّل',
        accessCode: row[5] || '',
        createdAt: row[6] || new Date().toISOString()
      });
    }
  }

  // 2. Contracts
  const contractRows = getValuesForRange('عقود الأقساط');
  const contracts: Contract[] = [];
  if (contractRows.length > 1) {
    for (let i = 1; i < contractRows.length; i++) {
      const row = contractRows[i];
      if (!row[0] || !row[1] || !row[2]) continue;
      contracts.push({
        id: row[0],
        customerId: row[1],
        itemName: row[2],
        cashPrice: Number(row[3]) || 0,
        installmentPrice: Number(row[4]) || 0,
        monthlyInstallment: Number(row[5]) || 0,
        dueDay: Number(row[6]) || 1,
        notes: row[7] || '',
        createdAt: row[8] || new Date().toISOString()
      });
    }
  }

  // 3. Payments
  const paymentRows = getValuesForRange('الدفعات والمقبوضات');
  const payments: Payment[] = [];
  if (paymentRows.length > 1) {
    for (let i = 1; i < paymentRows.length; i++) {
      const row = paymentRows[i];
      if (!row[0] || !row[1]) continue;
      payments.push({
        id: row[0],
        contractId: row[1],
        amount: Number(row[2]) || 0,
        date: row[3] || new Date().toISOString(),
        notes: row[4] || ''
      });
    }
  }

  // 4. Debts
  const debtRows = getValuesForRange('الديون الكلية');
  const debts: Debt[] = [];
  if (debtRows.length > 1) {
    for (let i = 1; i < debtRows.length; i++) {
      const row = debtRows[i];
      if (!row[0] || !row[1]) continue;
      debts.push({
        id: row[0],
        personName: row[1],
        phone: row[2] || '',
        type: row[3] === 'أطلبه دين' ? 'to_me' : 'by_me',
        totalAmount: Number(row[4]) || 0,
        paidAmount: Number(row[5]) || 0,
        dueDate: row[6] || '',
        status: (row[7] || 'pending') as any,
        priority: (row[8] || 'medium') as any,
        monthlyPurchaseLimit: Number(row[9]) || 0,
        targetMonthlyPayment: Number(row[10]) || 0,
        notes: row[11] || '',
        createdAt: row[12] || new Date().toISOString(),
        updatedAt: row[12] || new Date().toISOString(),
        transactions: [],
        notifications: []
      });
    }
  }

  // 5. Salafs List, Members, Payments
  const salafsListRows = getValuesForRange('السلف والأسهم - القائمة');
  const salafMembersRows = getValuesForRange('السلف والأسهم - الأعضاء');
  const salafPaymentsRows = getValuesForRange('السلف والأسهم - الدفعات');

  const salafsMap: Record<string, Salaf> = {};

  if (salafsListRows.length > 1) {
    for (let i = 1; i < salafsListRows.length; i++) {
      const row = salafsListRows[i];
      if (!row[0] || !row[1]) continue;
      salafsMap[row[0]] = {
        id: row[0],
        name: row[1],
        totalAmount: Number(row[2]) || 0,
        monthlyAmount: Number(row[3]) || 0,
        monthsCount: Number(row[4]) || 0,
        startDate: row[5] || '',
        notes: row[6] || '',
        createdAt: row[7] || new Date().toISOString(),
        members: [],
        payments: []
      };
    }
  }

  if (salafMembersRows.length > 1) {
    for (let i = 1; i < salafMembersRows.length; i++) {
      const row = salafMembersRows[i];
      const salafId = row[0];
      if (salafId && salafsMap[salafId]) {
        salafsMap[salafId].members.push({
          id: row[1] || '',
          name: row[2] || '',
          phone: row[3] || '',
          isReceiver: row[4] === 'نعم',
          receiveMonthIndex: row[5] ? Number(row[5]) : undefined,
          receiveDate: row[6] || undefined,
          notes: row[7] || undefined,
          createdAt: new Date().toISOString()
        });
      }
    }
  }

  if (salafPaymentsRows.length > 1) {
    for (let i = 1; i < salafPaymentsRows.length; i++) {
      const row = salafPaymentsRows[i];
      const salafId = row[1];
      if (salafId && salafsMap[salafId]) {
        salafsMap[salafId].payments.push({
          id: row[0] || '',
          memberId: row[2] || '',
          monthIndex: Number(row[3]) || 1,
          date: row[4] || '',
          amount: Number(row[5]) || 0,
          isPaidByMe: row[6] === 'نعم',
          notes: row[7] || undefined,
          createdAt: new Date().toISOString()
        });
      }
    }
  }

  const salafs = Object.values(salafsMap);

  // 6. Financial Accounts
  const finAccountRows = getValuesForRange('الحسابات المالية');
  const financialAccounts: FinancialAccount[] = [];
  if (finAccountRows.length > 1) {
    for (let i = 1; i < finAccountRows.length; i++) {
      const row = finAccountRows[i];
      if (!row[0] || !row[1]) continue;
      financialAccounts.push({
        id: row[0],
        name: row[1],
        balance: Number(row[2]) || 0,
        currency: (row[3] || 'IQD') as any,
        color: row[4] || '',
        icon: row[5] || '',
        createdAt: row[6] || new Date().toISOString()
      });
    }
  }

  // 7. Financial Transactions
  const finTransactionRows = getValuesForRange('المعاملات المالية');
  const financialTransactions: FinancialTransaction[] = [];
  if (finTransactionRows.length > 1) {
    for (let i = 1; i < finTransactionRows.length; i++) {
      const row = finTransactionRows[i];
      if (!row[0] || !row[1]) continue;
      financialTransactions.push({
        id: row[0],
        accountId: row[1],
        type: (row[2] || 'income') as any,
        amount: Number(row[3]) || 0,
        description: row[4] || '',
        category: row[5] || '',
        date: row[6] || '',
        transferToAccountId: row[7] || undefined,
        createdAt: row[8] || new Date().toISOString()
      });
    }
  }

  // Import into local IndexedDB
  await importAll({
    exportedAt: new Date().toISOString(),
    customers,
    contracts,
    payments,
    debts,
    salafs,
    financialAccounts,
    financialTransactions
  });
}

/**
 * Creates a brand new Spreadsheet in "شيتات تطبيق فقار المتكامل من كوكل ستوديو اي" 
 * as a historical backup, and enforces the 7-day backup retention sliding window.
 */
export async function createHistoricalBackupSheet(): Promise<string> {
  const token = await getAccessToken();
  if (!token) throw new Error('يرجى تسجيل الدخول باستخدام جوجل أولاً');

  // 1. Get or create folder
  const folderId = await getOrCreateWorkspaceFolder(token);

  // 2. Format name with current local date/time
  const today = new Date();
  const dateStr = today.toLocaleDateString('ar-IQ').replace(/\//g, '-');
  const timeStr = today.toLocaleTimeString('ar-IQ').replace(/:/g, '-');
  const filename = `نسخة احتياطية - نظام الفقار المتكامل - يوم ${dateStr} وقت ${timeStr}`;

  // 3. Create file directly inside folder
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: filename,
      mimeType: 'application/vnd.google-apps.spreadsheet',
      parents: [folderId]
    })
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`فشل إنشاء النسخة الاحتياطية السحابية: ${errText}`);
  }

  const fileData = await createRes.json();
  const spreadsheetId = fileData.id;

  // 4. Overwrite newly created sheet with full application data
  await exportWorkspaceDataToSheet(spreadsheetId);

  // 5. Apply the 7-day retention sliding window
  try {
    const listRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=parents in '${folderId}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false&fields=files(id, name, createdTime)&orderBy=createdTime asc`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    if (listRes.ok) {
      const listData = await listRes.json();
      const files = listData.files || [];
      
      // If there are more than 7, delete the oldest files (from Day 1, etc.)
      if (files.length > 7) {
        const toDeleteCount = files.length - 7;
        for (let i = 0; i < toDeleteCount; i++) {
          const fileId = files[i].id;
          await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
          });
        }
      }
    }
  } catch (err) {
    console.error('Failed to run daily backup rotation cleanup:', err);
  }

  return spreadsheetId;
}

/**
 * Lists all Spreadsheet backups saved in the target Google Drive Folder
 */
export async function listBackupSheets(): Promise<{ id: string; name: string; createdTime: string }[]> {
  const token = await getAccessToken();
  if (!token) throw new Error('يرجى تسجيل الدخول باستخدام جوجل أولاً');

  const folderId = await getOrCreateWorkspaceFolder(token);

  const listRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=parents in '${folderId}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false&fields=files(id, name, createdTime)&orderBy=createdTime desc`,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );

  if (!listRes.ok) {
    const errText = await listRes.text();
    throw new Error(`فشل استرجاع قائمة النسخ الاحتياطية: ${errText}`);
  }

  const data = await listRes.json();
  return data.files || [];
}

/**
 * Main legacy helper to maintain backward compatibility
 */
export async function exportToGoogleSheets(
  customers: Customer[],
  contracts: Contract[],
  payments: Payment[]
): Promise<string> {
  const token = await getAccessToken();
  if (!token) throw new Error('يرجى تسجيل الدخول باستخدام جوجل أولاً');

  const folderId = await getOrCreateWorkspaceFolder(token);
  const dateStr = new Date().toLocaleDateString('ar-IQ');
  const title = `سجلات نظام الفقار للديون والأقساط - ${dateStr}`;

  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: title,
      mimeType: 'application/vnd.google-apps.spreadsheet',
      parents: [folderId]
    })
  });

  if (!createRes.ok) {
    throw new Error('فشل إنشاء جدول بيانات Google Sheets جديد');
  }

  const fileData = await createRes.json();
  const spreadsheetId = fileData.id;

  await exportWorkspaceDataToSheet(spreadsheetId);
  return spreadsheetId;
}

/**
 * 3. GOOGLE CALENDAR SYNC HELPERS
 */
export async function syncToGoogleCalendar(contracts: Contract[], customers: Customer[], payments: Payment[]): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new Error('يرجى تسجيل الدخول باستخدام جوجل أولاً');

  // Find or create Faqar Installments Calendar
  let calendarId = 'primary';
  try {
    const listRes = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (listRes.ok) {
      const data = await listRes.json();
      if (data && data.items) {
        const existing = data.items.find((cal: any) => cal.summary === 'مواعيد أقساط نظام الفقار');
        if (existing) {
          calendarId = existing.id;
        }
      }
    }
  } catch (e) {
    console.warn('Could not read calendar list, fallback to primary calendar', e);
  }

  if (calendarId === 'primary') {
    try {
      const createCalRes = await fetch('https://www.googleapis.com/calendar/v3/calendars', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          summary: 'مواعيد أقساط نظام الفقار',
          timeZone: 'Asia/Baghdad'
        })
      });
      if (createCalRes.ok) {
        const calData = await createCalRes.json();
        calendarId = calData.id;
      }
    } catch (e) {
      console.error('Failed to create custom calendar', e);
    }
  }

  // Filter active contracts
  const activeContracts = contracts.filter(c => remainingForContract(c, payments) > 0);
  if (activeContracts.length === 0) {
    throw new Error('لا توجد عقود أقساط نشطة لجدولتها في التقويم');
  }

  // Create calendar events
  for (const contract of activeContracts) {
    const cust = customers.find(c => c.id === contract.customerId);
    if (!cust) continue;

    // Use contract start date or installment date
    const eventDate = contract.createdAt ? contract.createdAt.split('T')[0] : new Date().toISOString().split('T')[0];
    
    const event = {
      summary: `قسط مستحق: ${cust.name}`,
      description: `مستحقات قسط شهري بقيمة: ${fmtIQD(contract.monthlyInstallment)}\nاسم المادة/السلعة: ${contract.itemName}\nرقم العقد: ${contract.id}`,
      start: { date: eventDate },
      end: { date: eventDate },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 24 * 60 }, // 1 day before
          { method: 'popup', minutes: 9 * 60 }   // morning of event
        ]
      }
    };

    try {
      await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(event)
      });
    } catch (e) {
      console.error(`Failed to schedule event for customer ${cust.name}`, e);
    }
  }
}

/**
 * 4. GOOGLE DOCS GENERATOR HELPERS
 */
export async function createSummaryDocument(
  customers: Customer[],
  contracts: Contract[],
  payments: Payment[],
  stats: {
    totalCapital: number;
    totalExpected: number;
    totalPaid: number;
    totalRemaining: number;
    activeContractsCount: number;
  }
): Promise<string> {
  const token = await getAccessToken();
  if (!token) throw new Error('يرجى تسجيل الدخول باستخدام جوجل أولاً');

  const dateStr = new Date().toLocaleDateString('ar-IQ');
  const title = `تقرير الجرد المالي العام - نظام الفقار - ${dateStr}`;

  // 1. Create document
  const createRes = await fetch('https://docs.googleapis.com/v1/documents', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ title })
  });

  if (!createRes.ok) {
    throw new Error('فشل إنشاء مستند Google Docs جديد');
  }

  const docData = await createRes.json();
  const documentId = docData.documentId;

  // 2. Formulate Arabic executive summary text
  const textContent = 
    `تقرير الجرد المالي العام والديون\n` +
    `تاريخ التقرير: ${dateStr}\n` +
    `-----------------------------------------\n\n` +
    `أولاً: إحصائيات النظام الكلية:\n` +
    `• رأس المال التشغيلي المقدر: ${fmtIQD(stats.totalCapital)}\n` +
    `• إجمالي الديون المستحقة الكلية (العقود): ${fmtIQD(stats.totalExpected)}\n` +
    `• إجمالي المبالغ المستلمة (المسددة): ${fmtIQD(stats.totalPaid)}\n` +
    `• إجمالي المبالغ المتبقية بذمة الزبائن: ${fmtIQD(stats.totalRemaining)}\n` +
    `• عدد عقود الأقساط والتمويل النشطة: ${stats.activeContractsCount} عقد\n\n` +
    `-----------------------------------------\n` +
    `ثانياً: ملخص سجل الزبائن النشطين:\n` +
    customers.slice(0, 15).map((c, i) => {
      const activeContracts = contracts.filter(ctr => ctr.customerId === c.id);
      return `${i + 1}. ${c.name} (${c.phone}) - عدد العقود: ${activeContracts.length}`;
    }).join('\n') +
    `\n\n-----------------------------------------\n` +
    `تم توليد هذا التقرير تلقائياً بواسطة نظام الفقار للأقساط الذكي.`;

  // 3. Write text to document via batchUpdate
  const writeRes = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      requests: [
        {
          insertText: {
            endOfSegmentLocation: {},
            text: textContent
          }
        }
      ]
    })
  });

  if (!writeRes.ok) {
    throw new Error('فشل تحديث وتعبئة محتويات المستند');
  }

  return documentId;
}

export async function createCustomerAgreementDoc(
  customer: Customer,
  contract: Contract,
  payments: Payment[]
): Promise<string> {
  const token = await getAccessToken();
  if (!token) throw new Error('يرجى تسجيل الدخول باستخدام جوجل أولاً');

  const title = `اتفاقية أقساط - الزبون ${customer.name}`;

  // Create doc
  const createRes = await fetch('https://docs.googleapis.com/v1/documents', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ title })
  });

  if (!createRes.ok) {
    throw new Error('فشل إنشاء مستند العقد للزبون');
  }

  const docData = await createRes.json();
  const documentId = docData.id || docData.documentId;

  // Agreement Content
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = Math.max(0, contract.installmentPrice - totalPaid);

  const textContent = 
    `عقد واتفاقية بيع بالأقساط والتمويل الشخصي\n` +
    `-----------------------------------------\n\n` +
    `الطرف الأول: إدارة مبيعات نظام الفقار للأقساط\n` +
    `الطرف الثاني (الزبون): ${customer.name}\n` +
    `رقم هاتف الزبون: ${customer.phone}\n` +
    `معرف العقد الخاص: ${contract.id}\n\n` +
    `تفاصيل الاتفاقية والمبيع:\n` +
    `• المادة المبيعة/الخدمة: ${contract.itemName}\n` +
    `• القيمة الإجمالية للعقد: ${fmtIQD(contract.installmentPrice)}\n` +
    `• القسط الشهري المتفق عليه: ${fmtIQD(contract.monthlyInstallment)}\n` +
    `• تاريخ بدء التمويل والاستحقاق: ${contract.createdAt ? new Date(contract.createdAt).toLocaleDateString('ar-IQ') : '—'}\n` +
    `• المبالغ التي تم تسديدها حتى الآن: ${fmtIQD(totalPaid)}\n` +
    `• المبلغ المتبقي المستحق بذمة الزبون: ${fmtIQD(remaining)}\n` +
    `• حالة العقد الحالية: ${remaining <= 0 ? 'مكتمل ومسدد بالكامل' : 'نشط وجاري التسديد'}\n\n` +
    `شروط وأحكام العقد:\n` +
    `1. يلتزم الطرف الثاني (الزبون) بتسديد الأقساط الشهرية المتفق عليها في تاريخ استحقاقها المحدد دون تأخير.\n` +
    `2. في حال التأخر عن السداد، يحق للطرف الأول اتخاذ الإجراءات القانونية المتبعة والتنبيه الذاتي عبر المنصة.\n` +
    `3. يعتبر هذا المستند إقراراً رسمياً بالدين والالتزام بالسداد الكامل لجميع المستحقات.\n\n` +
    `توقيع الطرف الأول: __________________\n\n` +
    `توقيع الطرف الثاني (الزبون): __________________\n\n` +
    `تاريخ تحرير العقد الإلكتروني: ${new Date().toLocaleDateString('ar-IQ')}`;

  const writeRes = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      requests: [
        {
          insertText: {
            endOfSegmentLocation: {},
            text: textContent
          }
        }
      ]
    })
  });

  if (!writeRes.ok) {
    throw new Error('فشل كتابة بيانات الاتفاقية للمستند');
  }

  return documentId;
}

/**
 * Extracts the Google Drive Folder or Spreadsheet ID from any valid Google Drive URL.
 */
export function extractFolderIdFromUrl(url: string): string | null {
  if (!url) return null;
  // Match folder URL
  const folderMatch = url.match(/\/folders\/([a-zA-Z0-9-_]+)/) || url.match(/[?&]id=([a-zA-Z0-9-_]+)/);
  if (folderMatch) return folderMatch[1];
  // Match spreadsheet URL
  const sheetMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (sheetMatch) return sheetMatch[1];
  return null;
}

/**
 * Gets or creates the main 7-day backup folder on Google Drive.
 * Respects custom folder URL stored in localStorage if provided and accessible.
 */
export async function getOrCreate7DayBackupFolder(token: string): Promise<{ id: string; url: string; isAutoGenerated: boolean }> {
  const customUrl = localStorage.getItem('faqar-gdrive-folder-url');
  if (customUrl) {
    const extractedId = extractFolderIdFromUrl(customUrl);
    if (extractedId) {
      // Validate folder accessibility on Google Drive
      try {
        const verifyRes = await fetch(`https://www.googleapis.com/drive/v3/files/${extractedId}?fields=id,name,webViewLink,trashed`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (verifyRes.ok) {
          const folderInfo = await verifyRes.json();
          if (!folderInfo.trashed) {
            localStorage.setItem('faqar-gdrive-folder-id', extractedId);
            localStorage.setItem('faqar-gdrive-folder-is-autogenerated', 'false');
            return {
              id: extractedId,
              url: folderInfo.webViewLink || `https://drive.google.com/drive/folders/${extractedId}`,
              isAutoGenerated: false
            };
          }
        }
      } catch (err) {
        console.warn('Custom folder is not accessible, falling back to auto-generated folder', err);
      }
    }
  }

  // Fallback to auto-generated folder
  const folderName = 'ملف النسخة الاحتياطية لـ 7 أيام بالكامل المعتمد في التطبيق';
  try {
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='${encodeURIComponent(folderName)}' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,webViewLink)&orderBy=createdTime desc`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.files && searchData.files.length > 0) {
        const folder = searchData.files[0];
        const folderUrl = folder.webViewLink || `https://drive.google.com/drive/folders/${folder.id}`;
        localStorage.setItem('faqar-gdrive-folder-id', folder.id);
        localStorage.setItem('faqar-gdrive-folder-url', folderUrl);
        localStorage.setItem('faqar-gdrive-folder-is-autogenerated', 'true');
        return { id: folder.id, url: folderUrl, isAutoGenerated: true };
      }
    }
  } catch (err) {
    console.warn('Error searching for backup folder:', err);
  }

  // Not found, create it
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,webViewLink', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder'
    })
  });

  if (!createRes.ok) {
    throw new Error('فشل إنشاء مجلد النسخة الاحتياطية لـ 7 أيام بالكامل المعتمد في التطبيق على Google Drive');
  }

  const folderData = await createRes.json();
  const folderUrl = folderData.webViewLink || `https://drive.google.com/drive/folders/${folderData.id}`;
  localStorage.setItem('faqar-gdrive-folder-id', folderData.id);
  localStorage.setItem('faqar-gdrive-folder-url', folderUrl);
  localStorage.setItem('faqar-gdrive-folder-is-autogenerated', 'true');

  return { id: folderData.id, url: folderUrl, isAutoGenerated: true };
}

/**
 * Uploads a JSON string to a specific Google Drive folder.
 */
export async function uploadJsonToDriveFolder(
  jsonString: string,
  parentId: string,
  filename: string
): Promise<string> {
  const token = await getAccessToken();
  if (!token) throw new Error('يرجى تسجيل الدخول باستخدام جوجل أولاً');

  const metadata = {
    name: filename,
    mimeType: 'application/json',
    parents: [parentId]
  };

  const boundary = 'faqar_gdrive_boundary';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const body =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    jsonString +
    closeDelimiter;

  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body: body
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`فشل رفع ملف JSON: ${errText || response.statusText}`);
  }

  const result = await response.json();
  return result.id;
}

/**
 * Creates a brand new 7-day automatic backup in its own subfolder.
 */
export async function create7DayBackup(): Promise<{ folderId: string; subfolderId: string }> {
  const token = await getAccessToken();
  if (!token) throw new Error('يرجى تسجيل الدخول باستخدام جوجل أولاً');

  // 1. Get or create parent folder
  const primaryFolder = await getOrCreate7DayBackupFolder(token);
  const parentFolderId = primaryFolder.id;

  // 2. Format subfolder name with local date and time
  const today = new Date();
  const dateStr = today.toLocaleDateString('ar-IQ').replace(/\//g, '-');
  const timeStr = today.toLocaleTimeString('ar-IQ').replace(/:/g, '-');
  const subfolderName = `نسخة احتياطية بتاريخ ${dateStr} وقت ${timeStr}`;

  // 3. Create subfolder inside parent folder
  const createSubFolderRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: subfolderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentFolderId]
    })
  });

  if (!createSubFolderRes.ok) {
    const errText = await createSubFolderRes.text();
    throw new Error(`فشل إنشاء مجلد النسخة الاحتياطية الفرعي: ${errText}`);
  }

  const subFolderData = await createSubFolderRes.json();
  const subfolderId = subFolderData.id;

  // 4. Create backup files inside this subfolder
  const baseFilename = 'ملف النسخه الاحتياطيه ل ٧ ايام بالكامل المعتمد في التطبيق';

  // 4a. Create Google Sheet Spreadsheet inside subfolder
  const createSheetRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: baseFilename,
      mimeType: 'application/vnd.google-apps.spreadsheet',
      parents: [subfolderId]
    })
  });

  if (!createSheetRes.ok) {
    const errText = await createSheetRes.text();
    throw new Error(`فشل إنشاء شيت النسخة الاحتياطية: ${errText}`);
  }

  const sheetData = await createSheetRes.json();
  const spreadsheetId = sheetData.id;

  // Export current data into this Sheet
  await exportWorkspaceDataToSheet(spreadsheetId);

  // 4b. Create JSON Backup inside subfolder
  const dbData = await exportAll();
  const jsonString = JSON.stringify(dbData);
  await uploadJsonToDriveFolder(jsonString, subfolderId, `${baseFilename}.json`);

  // 5. Apply the 7-day retention sliding window
  try {
    const listRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=parents in '${parentFolderId}' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id, name, createdTime)&orderBy=createdTime asc`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (listRes.ok) {
      const listData = await listRes.json();
      const subfolders = listData.files || [];
      if (subfolders.length > 7) {
        const toDeleteCount = subfolders.length - 7;
        for (let i = 0; i < toDeleteCount; i++) {
          const folderIdToDelete = subfolders[i].id;
          await fetch(`https://www.googleapis.com/drive/v3/files/${folderIdToDelete}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
          });
        }
      }
    }
  } catch (err) {
    console.error('Failed to run 7-day automatic backup rotation cleanup:', err);
  }

  // Record last backup time
  localStorage.setItem('faqar-auto-backup-last', new Date().toLocaleString('ar-IQ'));
  localStorage.setItem('faqar-auto-backup-last-timestamp', Date.now().toString());

  return { folderId: parentFolderId, subfolderId };
}

/**
 * Lists all 7-day backups stored in the parent folder, including JSON and spreadsheet info.
 */
export async function list7DayBackups(): Promise<{
  id: string;
  name: string;
  createdTime: string;
  folderId: string;
  hasJson: boolean;
  hasSheet: boolean;
  jsonFileId?: string;
  sheetFileId?: string;
}[]> {
  const token = await getAccessToken();
  if (!token) return [];

  const primaryFolder = await getOrCreate7DayBackupFolder(token);
  const parentFolderId = primaryFolder.id;

  const listRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=parents in '${parentFolderId}' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id, name, createdTime)&orderBy=createdTime desc`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!listRes.ok) {
    const errText = await listRes.text();
    throw new Error(`فشل استرجاع قائمة النسخ من درايف: ${errText}`);
  }

  const data = await listRes.json();
  const subfolders = data.files || [];

  const backups: any[] = [];

  if (subfolders.length > 0) {
    const parentsQuery = subfolders.map((sf: any) => `'${sf.id}' in parents`).join(' or ');
    try {
      const filesRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=(${parentsQuery}) and trashed=false&fields=files(id, name, mimeType, parents)&pageSize=1000`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (filesRes.ok) {
        const filesData = await filesRes.json();
        const allFiles = filesData.files || [];

        subfolders.forEach((sf: any) => {
          const subfiles = allFiles.filter((f: any) => f.parents && f.parents.includes(sf.id));
          const jsonFile = subfiles.find((f: any) => f.mimeType === 'application/json' || f.name.endsWith('.json'));
          const sheetFile = subfiles.find((f: any) => f.mimeType === 'application/vnd.google-apps.spreadsheet');

          backups.push({
            id: sf.id,
            name: sf.name,
            createdTime: sf.createdTime,
            folderId: parentFolderId,
            hasJson: !!jsonFile,
            hasSheet: !!sheetFile,
            jsonFileId: jsonFile?.id,
            sheetFileId: sheetFile?.id
          });
        });
      } else {
        throw new Error('Fallback listing');
      }
    } catch {
      subfolders.forEach((sf: any) => {
        backups.push({
          id: sf.id,
          name: sf.name,
          createdTime: sf.createdTime,
          folderId: parentFolderId,
          hasJson: true,
          hasSheet: true
        });
      });
    }
  }

  return backups;
}

/**
 * Restores the complete application state from a specific 7-day backup subfolder.
 * Prefers native full JSON backup, falls back to Google Sheets.
 */
export async function restore7DayBackup(subfolderId: string): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new Error('يرجى تسجيل الدخول باستخدام جوجل أولاً');

  const filesRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q='${subfolderId}' in parents and trashed=false&fields=files(id, name, mimeType)`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!filesRes.ok) {
    const errText = await filesRes.text();
    throw new Error(`فشل قراءة ملفات المجلد الفرعي للنسخة الاحتياطية: ${errText}`);
  }

  const filesData = await filesRes.json();
  const files = filesData.files || [];

  const jsonFile = files.find((f: any) => f.mimeType === 'application/json' || f.name.endsWith('.json'));
  const sheetFile = files.find((f: any) => f.mimeType === 'application/vnd.google-apps.spreadsheet');

  if (jsonFile) {
    const downloadRes = await fetch(`https://www.googleapis.com/drive/v3/files/${jsonFile.id}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!downloadRes.ok) {
      throw new Error(`فشل تحميل ملف النسخة الاحتياطية JSON: ${downloadRes.statusText}`);
    }
    const dbData = await downloadRes.json();
    await importAll(dbData);
  } else if (sheetFile) {
    await importAllFromGoogleSheet(sheetFile.id);
  } else {
    throw new Error('لم يتم العثور على ملفات نسخة احتياطية صالحة (JSON أو شيتس) داخل المجلد المختار');
  }
}

/**
 * Handles manual backup exports.
 * If URL is a Google Sheet spreadsheet, updates it directly.
 * If URL is a Google Drive Folder, creates a Spreadsheet inside it.
 */
export async function exportManualBackup(url: string): Promise<'sheet' | 'folder'> {
  const token = await getAccessToken();
  if (!token) throw new Error('يرجى تسجيل الدخول باستخدام جوجل أولاً');

  const sheetMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  const folderMatch = url.match(/\/folders\/([a-zA-Z0-9-_]+)/) || url.match(/[?&]id=([a-zA-Z0-9-_]+)/);

  if (sheetMatch) {
    const spreadsheetId = sheetMatch[1];
    await exportWorkspaceDataToSheet(spreadsheetId);
    return 'sheet';
  } else if (folderMatch) {
    const folderId = folderMatch[1];
    const today = new Date();
    const dateStr = today.toLocaleDateString('ar-IQ').replace(/\//g, '-');
    const timeStr = today.toLocaleTimeString('ar-IQ').replace(/:/g, '-');
    const filename = `نسخة احتياطية يدوية - يوم ${dateStr} وقت ${timeStr}`;

    const createSheetRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: filename,
        mimeType: 'application/vnd.google-apps.spreadsheet',
        parents: [folderId]
      })
    });

    if (!createSheetRes.ok) {
      const errText = await createSheetRes.text();
      throw new Error(`فشل إنشاء شيت النسخة اليدوية داخل مجلد درايف: ${errText}`);
    }

    const sheetData = await createSheetRes.json();
    await exportWorkspaceDataToSheet(sheetData.id);
    return 'folder';
  } else {
    throw new Error('رابط النسخ الاحتياطي اليدوي غير صالح! يرجى وضع رابط Google Sheet أو مجلد Google Drive صحيح.');
  }
}

/**
 * Handles manual backup imports.
 * Downloads and restores from a spreadsheet ID extracted from the Google Sheet URL.
 */
export async function importManualBackup(url: string): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new Error('يرجى تسجيل الدخول باستخدام جوجل أولاً');

  const sheetMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!sheetMatch) {
    throw new Error('رابط استيراد النسخة اليدوية غير صالح! يرجى إدخال رابط Google Sheet صالح لقراءة البيانات واسترجاعها.');
  }

  const spreadsheetId = sheetMatch[1];
  await importAllFromGoogleSheet(spreadsheetId);
}

/**
 * Performs a complete dual backup by creating two files:
 * 1. A Google Sheet Spreadsheet
 * 2. A JSON database file on Google Drive
 */
export async function exportDualBackup(url: string): Promise<{ sheetUrl: string; jsonUrl: string; sheetId: string; jsonId: string }> {
  const token = await getAccessToken();
  if (!token) throw new Error('يرجى تسجيل الدخول باستخدام جوجل أولاً');

  // Resolve target folder from input url or use/create default
  let parentId = 'root';
  if (url) {
    const folderMatch = url.match(/\/folders\/([a-zA-Z0-9-_]+)/) || url.match(/[?&]id=([a-zA-Z0-9-_]+)/);
    if (folderMatch) {
      parentId = folderMatch[1];
    }
  }

  if (parentId === 'root') {
    // Find or create "النسخة الاحتياطية الثنائية الكاملة (نظام الفقار)"
    const folderName = 'النسخة الاحتياطية الثنائية الكاملة (نظام الفقار)';
    try {
      const searchRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=name='${encodeURIComponent(folderName)}' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,webViewLink)&orderBy=createdTime desc`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData.files && searchData.files.length > 0) {
          parentId = searchData.files[0].id;
        } else {
          // Create folder
          const createRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              name: folderName,
              mimeType: 'application/vnd.google-apps.folder'
            })
          });
          if (createRes.ok) {
            const folderData = await createRes.json();
            parentId = folderData.id;
          }
        }
      }
    } catch (e) {
      console.error('Error finding/creating dual backup folder', e);
    }
  }

  const today = new Date();
  const dateStr = today.toLocaleDateString('ar-IQ').replace(/\//g, '-');
  const timeStr = today.toLocaleTimeString('ar-IQ').replace(/:/g, '-');
  const baseName = `نسخة احتياطية ثنائية كاملة - ${dateStr} - ${timeStr}`;

  // 1. Create Google Sheet Spreadsheet inside parent folder
  const createSheetRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,webViewLink', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: `${baseName} (شيت)`,
      mimeType: 'application/vnd.google-apps.spreadsheet',
      parents: [parentId]
    })
  });

  if (!createSheetRes.ok) {
    const errText = await createSheetRes.text();
    throw new Error(`فشل إنشاء شيت النسخة الاحتياطية الثنائية: ${errText}`);
  }

  const sheetData = await createSheetRes.json();
  const spreadsheetId = sheetData.id;
  const sheetUrl = sheetData.webViewLink || `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

  // Export current tables to the created Google Sheet
  await exportWorkspaceDataToSheet(spreadsheetId);

  // 2. Create JSON File inside parent folder
  const dbData = await exportAll();
  const jsonString = JSON.stringify(dbData, null, 2);
  const jsonId = await uploadJsonToDriveFolder(jsonString, parentId, `${baseName} (جيسون).json`);
  const jsonUrl = `https://drive.google.com/open?id=${jsonId}`;

  // Store metadata
  localStorage.setItem('faqar-dual-backup-last-sheet-url', sheetUrl);
  localStorage.setItem('faqar-dual-backup-last-json-url', jsonUrl);
  localStorage.setItem('faqar-dual-backup-last-sheet-id', spreadsheetId);
  localStorage.setItem('faqar-dual-backup-last-json-id', jsonId);
  localStorage.setItem('faqar-dual-backup-last-timestamp', Date.now().toString());
  localStorage.setItem('faqar-dual-backup-last-time', today.toLocaleString('ar-IQ'));
  localStorage.setItem('faqar-dual-backup-success', 'true');

  return { sheetUrl, jsonUrl, sheetId: spreadsheetId, jsonId };
}

/**
 * Imports system data from a dual backup URL (which could be a Sheet, a JSON file, or a Folder URL)
 */
export async function importDualBackup(url: string): Promise<{ type: 'sheet' | 'json' | 'folder' | 'none'; importCount: number }> {
  const token = await getAccessToken();
  if (!token) throw new Error('يرجى تسجيل الدخول باستخدام جوجل أولاً');

  if (!url) throw new Error('يرجى إدخال الرابط أولاً');

  const sheetMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  const fileIdMatch = url.match(/[?&]id=([a-zA-Z0-9-_]+)/);

  if (sheetMatch) {
    const spreadsheetId = sheetMatch[1];
    await importAllFromGoogleSheet(spreadsheetId);
    
    const currentCount = parseInt(localStorage.getItem('faqar-dual-import-count') || '0', 10) + 1;
    localStorage.setItem('faqar-dual-import-count', currentCount.toString());
    localStorage.setItem('faqar-dual-import-last-time', new Date().toLocaleString('ar-IQ'));
    localStorage.setItem('faqar-dual-import-last-type', 'Google Sheet');
    
    return { type: 'sheet', importCount: currentCount };
  }

  let fileId = fileIdMatch ? fileIdMatch[1] : null;
  if (!fileId) {
    const parts = url.split('/');
    const foldersIndex = parts.indexOf('folders');
    if (foldersIndex !== -1 && parts[foldersIndex + 1]) {
      fileId = parts[foldersIndex + 1];
    } else {
      const openIndex = parts.indexOf('open');
      if (openIndex !== -1) {
        const queryParams = parts[parts.length - 1].split('?')[1];
        if (queryParams) {
          const match = queryParams.match(/id=([a-zA-Z0-9-_]+)/);
          if (match) fileId = match[1];
        }
      }
    }
  }

  if (!fileId) {
    const rawIdMatch = url.trim().match(/^[a-zA-Z0-9-_]{25,50}$/);
    if (rawIdMatch) {
      fileId = rawIdMatch[0];
    }
  }

  if (!fileId) {
    throw new Error('لم نتمكن من استخراج معرف ملف أو مجلد صالح من الرابط المدخل. يرجى التأكد من صحة الرابط.');
  }

  const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!fileRes.ok) {
    throw new Error('فشل التحقق من ملف الرابط في جوجل درايف. تأكد من أن الرابط صالح وأن الحساب لديه صلاحية الوصول إليه.');
  }

  const fileInfo = await fileRes.json();
  const { mimeType, name } = fileInfo;

  if (mimeType === 'application/vnd.google-apps.spreadsheet') {
    await importAllFromGoogleSheet(fileId);
    
    const currentCount = parseInt(localStorage.getItem('faqar-dual-import-count') || '0', 10) + 1;
    localStorage.setItem('faqar-dual-import-count', currentCount.toString());
    localStorage.setItem('faqar-dual-import-last-time', new Date().toLocaleString('ar-IQ'));
    localStorage.setItem('faqar-dual-import-last-type', 'Google Sheet');
    
    return { type: 'sheet', importCount: currentCount };
  } else if (mimeType === 'application/json' || name.endsWith('.json')) {
    const downloadRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!downloadRes.ok) {
      throw new Error(`فشل تحميل محتويات ملف JSON: ${downloadRes.statusText}`);
    }
    const dbData = await downloadRes.json();
    await importAll(dbData);

    const currentCount = parseInt(localStorage.getItem('faqar-dual-import-count') || '0', 10) + 1;
    localStorage.setItem('faqar-dual-import-count', currentCount.toString());
    localStorage.setItem('faqar-dual-import-last-time', new Date().toLocaleString('ar-IQ'));
    localStorage.setItem('faqar-dual-import-last-type', 'JSON File');

    return { type: 'json', importCount: currentCount };
  } else if (mimeType === 'application/vnd.google-apps.folder') {
    const listRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q='${fileId}' in parents and trashed=false&fields=files(id,name,mimeType,createdTime)&orderBy=createdTime desc`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!listRes.ok) {
      throw new Error('فشل قراءة محتويات مجلد النسخة الاحتياطية المختار.');
    }
    const listData = await listRes.json();
    const files = listData.files || [];
    
    const jsonFile = files.find((f: any) => f.mimeType === 'application/json' || f.name.endsWith('.json'));
    const sheetFile = files.find((f: any) => f.mimeType === 'application/vnd.google-apps.spreadsheet');

    if (jsonFile) {
      const downloadRes = await fetch(`https://www.googleapis.com/drive/v3/files/${jsonFile.id}?alt=media`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!downloadRes.ok) {
        throw new Error('فشل تحميل ملف JSON من المجلد.');
      }
      const dbData = await downloadRes.json();
      await importAll(dbData);

      const currentCount = parseInt(localStorage.getItem('faqar-dual-import-count') || '0', 10) + 1;
      localStorage.setItem('faqar-dual-import-count', currentCount.toString());
      localStorage.setItem('faqar-dual-import-last-time', new Date().toLocaleString('ar-IQ'));
      localStorage.setItem('faqar-dual-import-last-type', 'JSON (من مجلد)');

      return { type: 'json', importCount: currentCount };
    } else if (sheetFile) {
      await importAllFromGoogleSheet(sheetFile.id);

      const currentCount = parseInt(localStorage.getItem('faqar-dual-import-count') || '0', 10) + 1;
      localStorage.setItem('faqar-dual-import-count', currentCount.toString());
      localStorage.setItem('faqar-dual-import-last-time', new Date().toLocaleString('ar-IQ'));
      localStorage.setItem('faqar-dual-import-last-type', 'Google Sheet (من مجلد)');

      return { type: 'sheet', importCount: currentCount };
    } else {
      throw new Error('مجلد الرابط المربوط لا يحتوي على أي ملفات شيت أو جيسون صالحة لاسترجاع النسخة.');
    }
  } else {
    throw new Error('نوع ملف الرابط المربوط غير مدعوم للنسخ الثنائي. يرجى إدخال رابط شيت أو ملف جيسون أو مجلد على درايف.');
  }
}
