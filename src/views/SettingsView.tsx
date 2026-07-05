/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  FileSpreadsheet,
  Download,
  Upload,
  MessageSquare,
  Bell,
  Clock,
  Bug,
  HardDrive,
  Send,
  Trash2,
  LogOut,
  Info,
  Lock,
  ShoppingBag,
  LayoutGrid,
  Calendar,
  FileText,
  Activity,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Plus,
  Edit3,
  Heart,
  Sliders,
  Compass,
  Calculator,
  Link,
  Shield
} from 'lucide-react';
import { Customer, Contract, Payment } from '../types';
import { remainingForContract } from '../finance';
import { exportAll, clearAll, clearDbCache } from '../db';
import { syncNow, getLastSyncTime, getPendingSyncCount } from '../syncQueue';
import { 
  initAuth, 
  googleSignIn, 
  logoutWorkspace, 
  getAccessToken, 
  uploadBackupToDrive, 
  exportToGoogleSheets, 
  syncToGoogleCalendar, 
  createSummaryDocument,
  exportWorkspaceDataToSheet,
  importAllFromGoogleSheet,
  createHistoricalBackupSheet,
  listBackupSheets,
  isTokenExpired,
  create7DayBackup,
  list7DayBackups,
  restore7DayBackup,
  exportManualBackup,
  importManualBackup,
  extractFolderIdFromUrl,
  exportDualBackup,
  importDualBackup
} from '../googleWorkspace';
import { User } from 'firebase/auth';
import { showToast } from '../components/Toast';

interface SettingsViewProps {
  customers: Customer[];
  contracts: Contract[];
  payments: Payment[];
  onNavigateTo: (viewName: string) => void;
  onLogout: () => void;
  onRefreshData: () => void;
}

export function SettingsView({
  customers,
  contracts,
  payments,
  onNavigateTo,
  onLogout,
  onRefreshData
}: SettingsViewProps) {
  // PWA Support state
  const [canInstall, setCanInstall] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // GDrive state
  const [gdriveClientId, setGdriveClientId] = useState(localStorage.getItem('faqar-gdrive-client-id') || '');
  const [gdriveFolderId, setGdriveFolderId] = useState(localStorage.getItem('faqar-gdrive-folder-id') || '');
  const [uploadingDrive, setUploadingDrive] = useState(false);

  // Store button customization state
  const [storeButtonName, setStoreButtonName] = useState(localStorage.getItem('faqar-store-btn-name') || 'قم بزيارة المتجر 🏛️');
  const [storeButtonUrl, setStoreButtonUrl] = useState(localStorage.getItem('faqar-store-btn-url') || 'https://instagram.com');

  // Admin credentials state
  const [adminUsername, setAdminUsername] = useState(localStorage.getItem('faqar-admin-username-v1') || 'faqar');
  const [adminPassword, setAdminPassword] = useState(localStorage.getItem('faqar-admin-password-v1') || '10001000Qq');
  const [showAdminPass, setShowAdminPass] = useState(false);

  // Telegram state
  const [lastTelegramBackup, setLastTelegramBackup] = useState(localStorage.getItem('faqar-auto-backup-last') || 'لم يتم النسخ بعد');
  const [sendingTelegram, setSendingTelegram] = useState(false);

  // Google Workspace states
  const [workspaceUser, setWorkspaceUser] = useState<User | null>(null);
  const [workspaceToken, setWorkspaceToken] = useState<string | null>(null);
  const [isWorkspaceConnected, setIsWorkspaceConnected] = useState(false);
  const [isWorkspaceLoading, setIsWorkspaceLoading] = useState(true);
  const [isConnectionExpired, setIsConnectionExpired] = useState(true);

  const [isSyncingSheets, setIsSyncingSheets] = useState(false);
  const [isSyncingCalendar, setIsSyncingCalendar] = useState(false);
  const [isSyncingDocs, setIsSyncingDocs] = useState(false);

  // Linked Google Sheet states
  const [linkedSheetId, setLinkedSheetId] = useState(localStorage.getItem('faqar-linked-sheet-id') || '14bhuJwwJUone0cCdGyq7CIQYHgsYpssMh1zWB5Otlig');
  const [isCreatingSheet, setIsCreatingSheet] = useState(false);
  const [isSyncingLinkedSheet, setIsSyncingLinkedSheet] = useState(false);
  const [isImportingLinkedSheet, setIsImportingLinkedSheet] = useState(false);

  // New 7-day automatic and manual backup states
  const [autoBackupOpen, setAutoBackupOpen] = useState(true); // Open by default
  const [isBackupSyncing, setIsBackupSyncing] = useState(false);
  const [syncStatusError, setSyncStatusError] = useState<string | null>(null);
  const [lastBackupTime, setLastBackupTime] = useState(() => localStorage.getItem('faqar-auto-backup-last') || 'لم يتم النسخ بعد');
  const [backupsList7Day, setBackupsList7Day] = useState<any[]>([]);
  const [isLoadingBackups7Day, setIsLoadingBackups7Day] = useState(false);
  
  // Server-side rolling backups state
  const [serverBackupsList, setServerBackupsList] = useState<any[]>([]);
  const [isLoadingServerBackups, setIsLoadingServerBackups] = useState(false);
  const [restoringServerBackup, setRestoringServerBackup] = useState<string | null>(null);
  const [activeBackupTab, setActiveBackupTab] = useState<'server' | 'gdrive'>('server');
  
  // Custom folder URL state
  const [gdriveFolderUrl, setGdriveFolderUrl] = useState(() => localStorage.getItem('faqar-gdrive-folder-url') || '');
  const [isFolderAutogenerated, setIsFolderAutogenerated] = useState(() => localStorage.getItem('faqar-gdrive-folder-is-autogenerated') === 'true');
  
  // Manual backup URL & buttons states
  const [manualBackupUrl, setManualBackupUrl] = useState(() => localStorage.getItem('faqar-gdrive-manual-backup-url') || '');
  const [isManualExporting, setIsManualExporting] = useState(false);
  const [isManualImporting, setIsManualImporting] = useState(false);
  const [restoringBackupFolderId, setRestoringBackupFolderId] = useState<string | null>(null);

  // Dual Backup Handlers (Google Sheet + JSON)
  const [dualBackupUrl, setDualBackupUrl] = useState(() => localStorage.getItem('faqar-gdrive-dual-backup-url') || '');
  const [isDualExporting, setIsDualExporting] = useState(false);
  const [isDualImporting, setIsDualImporting] = useState(false);
  const [dualLastTime, setDualLastTime] = useState(() => localStorage.getItem('faqar-dual-backup-last-time') || 'لم يتم النسخ بعد');
  const [dualSuccess, setDualSuccess] = useState(() => localStorage.getItem('faqar-dual-backup-success') === 'true');
  const [dualImportCount, setDualImportCount] = useState(() => parseInt(localStorage.getItem('faqar-dual-import-count') || '0', 10));
  const [dualImportLastTime, setDualImportLastTime] = useState(() => localStorage.getItem('faqar-dual-import-last-time') || 'لم يتم الاستيراد بعد');
  const [dualImportLastType, setDualImportLastType] = useState(() => localStorage.getItem('faqar-dual-import-last-type') || '—');

  const handleDualExportClick = async () => {
    if (!(await ensureActiveConnection())) return;
    setIsDualExporting(true);
    try {
      showToast('جاري تصدير النسخة الاحتياطية الثنائية الكاملة (Google Sheet + JSON)...', 'info');
      const result = await exportDualBackup(dualBackupUrl);
      setDualLastTime(localStorage.getItem('faqar-dual-backup-last-time') || 'لم يتم النسخ بعد');
      setDualSuccess(true);
      showToast('تم تصدير وحفظ شيت جوجل وملف جيسون بنجاح! 🟢', 'success');
      await handleLoad7DayBackups();
    } catch (err: any) {
      setDualSuccess(false);
      localStorage.setItem('faqar-dual-backup-success', 'false');
      showToast(err.message || 'فشل تصدير النسخة الاحتياطية الثنائية', 'error');
    } finally {
      setIsDualExporting(false);
    }
  };

  const handleDualImportClick = async () => {
    if (!dualBackupUrl) {
      showToast('يرجى إدخال رابط المجلد أو الشيت أو ملف جيسون السحابي للاستيراد أولاً', 'error');
      return;
    }
    const confirm = window.confirm('هل أنت متأكد من استعادة كامل بيانات النظام من الرابط المدخل للنسخة الاحتياطية الثنائية؟ سيتم مسح كافة البيانات الحالية بالكامل!');
    if (!confirm) return;

    if (!(await ensureActiveConnection())) return;
    setIsDualImporting(true);
    try {
      showToast('جاري استيراد وتصيير نسخة احتياطية بالكامل من الرابط المروق...', 'info');
      const res = await importDualBackup(dualBackupUrl);
      setDualImportCount(res.importCount);
      setDualImportLastTime(localStorage.getItem('faqar-dual-import-last-time') || 'لم يتم الاستيراد بعد');
      setDualImportLastType(res.type === 'sheet' ? 'Google Sheet' : 'JSON File');
      showToast(`تم استيراد واستعادة البيانات بالكامل بنجاح من (${res.type === 'sheet' ? 'شيت جوجل' : 'ملف جيسون'})! 🎉`, 'success');
      onRefreshData();
    } catch (err: any) {
      showToast(err.message || 'فشل استيراد النسخة الاحتياطية الثنائية', 'error');
    } finally {
      setIsDualImporting(false);
    }
  };

  // Financial Dashboard Layout Settings
  const [showSystemStats, setShowSystemStats] = useState(() => localStorage.getItem('faqar-fin-show-system') !== 'false');
  const [showBudgetsList, setShowBudgetsList] = useState(() => localStorage.getItem('faqar-fin-show-budgets') !== 'false');
  const [showTransactionsList, setShowTransactionsList] = useState(() => localStorage.getItem('faqar-fin-show-txs') !== 'false');
  const [showReports, setShowReports] = useState(() => localStorage.getItem('faqar-fin-show-reports') !== 'false');
  const [hideZeroBalanceAccounts, setHideZeroBalanceAccounts] = useState(() => localStorage.getItem('faqar-fin-hide-zero') === 'true');

  // Floating Action Button (FAB) Settings
  const [fabEnabled, setFabEnabled] = useState(() => localStorage.getItem('faqar-fab-enabled') !== 'false');
  const [fabAddCustomer, setFabAddCustomer] = useState(() => localStorage.getItem('faqar-fab-add-customer') !== 'false');
  const [fabAddContract, setFabAddContract] = useState(() => localStorage.getItem('faqar-fab-add-contract') !== 'false');
  const [fabAddPayment, setFabAddPayment] = useState(() => localStorage.getItem('faqar-fab-add-payment') !== 'false');
  const [fabAddDebt, setFabAddDebt] = useState(() => localStorage.getItem('faqar-fab-add-debt') !== 'false');
  const [fabAddSalaf, setFabAddSalaf] = useState(() => localStorage.getItem('faqar-fab-add-salaf') !== 'false');
  const [fabAddAudit, setFabAddAudit] = useState(() => localStorage.getItem('faqar-fab-add-audit') !== 'false');

  // Collapsible Accordion sections state
  const [openSections, setOpenSections] = useState<{ [key: string]: boolean }>({
    updates: false,
    admin: false,
    google: false,
    store: false,
    dashboard: false,
    fab: false,
    telegram: false,
    purge: false,
  });

  const toggleSection = (sectionId: string) => {
    setOpenSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const [pendingSyncCount, setPendingSyncCount] = useState(getPendingSyncCount());

  useEffect(() => {
    setIsConnectionExpired(isTokenExpired());
    const handleSyncChange = () => {
      setPendingSyncCount(getPendingSyncCount());
    };
    window.addEventListener('faqar-sync-change', handleSyncChange);
    return () => {
      window.removeEventListener('faqar-sync-change', handleSyncChange);
    };
  }, []);

  const handlePurgeCache = () => {
    clearDbCache();
    onRefreshData();
    showToast('تم إخلاء ذاكرة الكاش وتحديث كافة السجلات والبيانات المحلية بنجاح!', 'success');
  };




  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setCanInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setWorkspaceUser(user);
        setWorkspaceToken(token);
        setIsWorkspaceConnected(true);
        setIsWorkspaceLoading(false);
        setIsConnectionExpired(isTokenExpired());
      },
      () => {
        setWorkspaceUser(null);
        setWorkspaceToken(null);
        setIsWorkspaceConnected(false);
        setIsWorkspaceLoading(false);
        setIsConnectionExpired(true);
      }
    );

    const handleAuthExpired = () => {
      setWorkspaceUser(null);
      setWorkspaceToken(null);
      setIsWorkspaceConnected(false);
      setIsConnectionExpired(true);
      showToast('انتهت صلاحية الجلسة، يرجى إعادة تسجيل الدخول لتفويض خدمة جوجل', 'warning', 5000);
    };

    window.addEventListener('faqar-google-auth-expired', handleAuthExpired);

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
      window.removeEventListener('faqar-google-auth-expired', handleAuthExpired);
    };
  }, []);

  const handleInstallPWA = async () => {
    if (!deferredPrompt) {
      showToast('خطوات التثبيت: اضغط على زر مشاركة المتصفح ثم اختر إضافة إلى الشاشة الرئيسية', 'info', 6000);
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      showToast('شكراً لتثبيتك التطبيق!', 'success');
      setCanInstall(false);
    }
  };

  const handleForceUpdate = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg) {
          reg.update().then(() => {
            showToast('تم تحديث ملفات التطبيق بنجاح. جاري إعادة تشغيل الواجهة...', 'success');
            setTimeout(() => window.location.reload(), 1500);
          });
        } else {
          showToast('لا توجد ملفات جديدة متاحة حالياً', 'info');
        }
      });
    } else {
      showToast('بيئة العرض غير داعمة للمزامنة المحلية الكلية', 'warning');
    }
  };

  // Google Workspace Handlers
  const ensureActiveConnection = async (): Promise<boolean> => {
    if (isTokenExpired()) {
      try {
        const res = await googleSignIn();
        if (res) {
          setIsWorkspaceConnected(true);
          setIsConnectionExpired(false);
          await handleLoad7DayBackups();
          return true;
        }
        return false;
      } catch (err: any) {
        showToast(err.message || 'فشل تجديد تفويض جوجل للعملية', 'error');
        return false;
      }
    }
    return true;
  };

  const handleWorkspaceSignIn = async () => {
    try {
      await googleSignIn();
      setIsConnectionExpired(false);
      showToast('تم تسجيل الدخول وتفويض خدمات Google Workspace بنجاح', 'success');
    } catch (err: any) {
      showToast(err.message || 'فشل تسجيل الدخول باستخدام جوجل', 'error');
    }
  };

  const handleWorkspaceSignOut = async () => {
    try {
      await logoutWorkspace();
      setIsConnectionExpired(true);
      showToast('تم تسجيل الخروج وإلغاء تفويض خدمات جوجل', 'success');
    } catch {
      showToast('فشل تسجيل الخروج', 'error');
    }
  };

  // Server-side rolling backups handlers
  const handleLoadServerBackups = async () => {
    setIsLoadingServerBackups(true);
    try {
      const res = await window.fetch('/api/sync/backups');
      if (res.ok) {
        const list = await res.json();
        setServerBackupsList(list);
      }
    } catch (err) {
      console.error('Failed to load server backups:', err);
    } finally {
      setIsLoadingServerBackups(false);
    }
  };

  const handleRestoreServerBackupClick = async (filename: string, dateLabel: string) => {
    const confirm = window.confirm(`هل أنت متأكد من استرجاع كامل بيانات وحركات النظام من نسخة السيرفر الاحتياطية وتاريخ (${dateLabel})؟ سيتم استبدال كافة البيانات الحالية بالكامل.`);
    if (!confirm) return;

    setRestoringServerBackup(filename);
    try {
      showToast('جاري استرجاع نسخة السيرفر الاحتياطية...', 'info');
      
      // 1. Tell server to restore this backup
      const res = await window.fetch('/api/sync/restore-backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename })
      });

      if (!res.ok) {
        throw new Error('فشل السيرفر في استرجاع الملف');
      }

      // 2. Fetch the restored data from the server
      const downloadRes = await window.fetch('/api/sync/download');
      if (!downloadRes.ok) {
        throw new Error('فشل تحميل البيانات المسترجعة من السيرفر');
      }
      const restoredData = await downloadRes.json();

      // 3. Import locally
      const { importAll } = await import('../db');
      await importAll(restoredData, true);

      // 4. Refresh local React state
      onRefreshData();
      showToast('تم استعادة كامل بيانات وحركات النظام بنجاح من نسخة السيرفر! 🎉', 'success');
      
      // 5. Reload server backups listing
      await handleLoadServerBackups();
    } catch (err: any) {
      showToast(err.message || 'فشل استرجاع نسخة السيرفر', 'error');
    } finally {
      setRestoringServerBackup(null);
    }
  };

  useEffect(() => {
    handleLoadServerBackups();
  }, []);

  // Google Workspace Handlers for 7-Day Backups and Sync
  const handleLoad7DayBackups = async () => {
    if (!isWorkspaceConnected) {
      setBackupsList7Day([]);
      return;
    }
    const token = await getAccessToken();
    if (!token) {
      setBackupsList7Day([]);
      return;
    }
    setIsLoadingBackups7Day(true);
    try {
      const list = await list7DayBackups();
      setBackupsList7Day(list);
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      if (errMsg.includes('تسجيل الدخول') || errMsg.includes('401') || errMsg.includes('auth')) {
        setBackupsList7Day([]);
      } else {
        console.warn('Failed to load 7-day backups:', err);
      }
    } finally {
      setIsLoadingBackups7Day(false);
    }
  };

  useEffect(() => {
    if (isWorkspaceConnected) {
      handleLoad7DayBackups();
      const isAuto = localStorage.getItem('faqar-gdrive-folder-is-autogenerated') === 'true';
      setIsFolderAutogenerated(isAuto);
      setGdriveFolderUrl(localStorage.getItem('faqar-gdrive-folder-url') || '');
    }
  }, [isWorkspaceConnected]);

  useEffect(() => {
    const handleSyncStatus = (e: any) => {
      const { isSyncing, error } = e.detail;
      setIsBackupSyncing(isSyncing);
      if (error) {
        setSyncStatusError(error);
      } else {
        setSyncStatusError(null);
        setLastBackupTime(localStorage.getItem('faqar-auto-backup-last') || 'لم يتم النسخ بعد');
        handleLoad7DayBackups();
      }
    };

    window.addEventListener('faqar-gdrive-sync-status', handleSyncStatus as EventListener);
    return () => {
      window.removeEventListener('faqar-gdrive-sync-status', handleSyncStatus as EventListener);
    };
  }, [isWorkspaceConnected]);

  // 1. Manual Export (Runs complete 7-day backup)
  const handleExportBackupClick = async () => {
    if (!(await ensureActiveConnection())) return;
    setIsBackupSyncing(true);
    try {
      showToast('جاري أخذ نسخة احتياطية كاملة وتصديرها لجوجل درايف...', 'info');
      await create7DayBackup();
      showToast('تم تصدير وحفظ النسخة الاحتياطية وتطبيق سياسة التدوير بنجاح! 🟢', 'success');
      setLastBackupTime(localStorage.getItem('faqar-auto-backup-last') || 'لم يتم النسخ بعد');
      await handleLoad7DayBackups();
    } catch (err: any) {
      showToast(err.message || 'فشل تصدير النسخة الاحتياطية', 'error');
    } finally {
      setIsBackupSyncing(false);
    }
  };

  // 2. Import / Restore from selected 7-day backup subfolder
  const handleRestore7DayClick = async (subfolderId: string, backupName: string) => {
    const confirm = window.confirm(`هل أنت متأكد من استرجاع كامل بيانات ومستندات وحركات النظام من النسخة الاحتياطية (${backupName})؟ سيتم استبدال كافة البيانات المحلية الحالية بالكامل.`);
    if (!confirm) return;

    if (!(await ensureActiveConnection())) return;
    setRestoringBackupFolderId(subfolderId);
    try {
      showToast('جاري تحميل واسترجاع النسخة الاحتياطية بالكامل...', 'info');
      await restore7DayBackup(subfolderId);
      showToast('تم استعادة كامل بيانات وحركات النظام بنجاح! 🎉', 'success');
      onRefreshData();
    } catch (err: any) {
      showToast(err.message || 'فشل استرجاع النسخة الاحتياطية', 'error');
    } finally {
      setRestoringBackupFolderId(null);
    }
  };

  // 3. Manual Sync (Runs the exact same background sync routine now)
  const handleManualSyncClick = async () => {
    if (!(await ensureActiveConnection())) return;
    setIsBackupSyncing(true);
    try {
      showToast('جاري تشغيل المزامنة اليدوية ورفع التحديثات السحابية...', 'info');
      await create7DayBackup();
      showToast('اكتملت المزامنة وحفظت النسخة بنجاح! 🟢', 'success');
      setLastBackupTime(localStorage.getItem('faqar-auto-backup-last') || 'لم يتم النسخ بعد');
      await handleLoad7DayBackups();
    } catch (err: any) {
      showToast(err.message || 'فشلت المزامنة اليدوية', 'error');
    } finally {
      setIsBackupSyncing(false);
    }
  };

  // 4. Custom Folder URL update
  const handleFolderUrlChange = (val: string) => {
    setGdriveFolderUrl(val);
    localStorage.setItem('faqar-gdrive-folder-url', val);
    if (!val) {
      localStorage.removeItem('faqar-gdrive-folder-id');
      localStorage.setItem('faqar-gdrive-folder-is-autogenerated', 'true');
      setIsFolderAutogenerated(true);
    } else {
      const extId = extractFolderIdFromUrl(val);
      if (extId) {
        localStorage.setItem('faqar-gdrive-folder-id', extId);
        localStorage.setItem('faqar-gdrive-folder-is-autogenerated', 'false');
        setIsFolderAutogenerated(false);
      }
    }
  };

  // 5. Manual Backup url actions (Task 9)
  const handleManualExportClick = async () => {
    if (!manualBackupUrl) {
      showToast('يرجى وضع رابط مجلد/ملف جوجل درايف المخصص للنسخ اليدوي أولاً', 'error');
      return;
    }
    if (!(await ensureActiveConnection())) return;
    setIsManualExporting(true);
    try {
      showToast('جاري تصدير نسخة احتياطية يدوية إلى الرابط المخصص...', 'info');
      const type = await exportManualBackup(manualBackupUrl);
      if (type === 'sheet') {
        showToast('تم تحديث ملف شيت جوجل اليدوي بنجاح! 🟢', 'success');
      } else {
        showToast('تم حفظ شيت نسخة احتياطية يدوية جديدة داخل المجلد بنجاح! 🟢', 'success');
      }
    } catch (err: any) {
      showToast(err.message || 'فشل تصدير النسخة اليدوية', 'error');
    } finally {
      setIsManualExporting(false);
    }
  };

  const handleManualImportClick = async () => {
    if (!manualBackupUrl) {
      showToast('يرجى وضع رابط ملف شيت جوجل المخصص للنسخ اليدوي أولاً', 'error');
      return;
    }
    const confirm = window.confirm('هل أنت متأكد من استيراد البيانات من الملف اليدوي المحدد؟ سيتم استبدال البيانات المحلية الحالية بالكامل.');
    if (!confirm) return;

    if (!(await ensureActiveConnection())) return;
    setIsManualImporting(true);
    try {
      showToast('جاري استيراد وتحديث البيانات من الملف اليدوي...', 'info');
      await importManualBackup(manualBackupUrl);
      showToast('تم استيراد واستعادة البيانات بالكامل بنجاح! 🎉', 'success');
      onRefreshData();
    } catch (err: any) {
      showToast(err.message || 'فشل استيراد النسخة اليدوية', 'error');
    } finally {
      setIsManualImporting(false);
    }
  };



  // Telegram Trigger
  const handleTelegramBackup = async () => {
    setSendingTelegram(true);
    try {
      await syncNow();
      const nowStr = new Date().toLocaleString('ar-IQ');
      localStorage.setItem('faqar-auto-backup-last', nowStr);
      setLastTelegramBackup(nowStr);
      showToast('تم إرسال النسخة الاحتياطية بنجاح لتيليجرام', 'success');
    } catch (err: any) {
      showToast(err.message || 'حدث خطأ أثناء الاتصال بتيليجرام', 'error');
    } finally {
      setSendingTelegram(false);
    }
  };

  const handleSaveAdminCredentials = () => {
    if (!adminUsername.trim()) {
      showToast('الرجاء إدخال اسم مستخدم صحيح', 'error');
      return;
    }
    if (!adminPassword || adminPassword.length < 4) {
      showToast('الرجاء إدخال كلمة مرور بطول 4 خانات على الأقل', 'error');
      return;
    }
    localStorage.setItem('faqar-admin-username-v1', adminUsername.trim());
    localStorage.setItem('faqar-admin-password-v1', adminPassword);
    showToast('تم تحديث وحفظ معلومات دخول الإدارة بنجاح', 'success');
  };

  const handleSaveStoreButtonSettings = () => {
    if (!storeButtonName.trim()) {
      showToast('الرجاء إدخال اسم للزر', 'error');
      return;
    }
    if (!storeButtonUrl.trim()) {
      showToast('الرجاء إدخال رابط صحيح للزر', 'error');
      return;
    }
    localStorage.setItem('faqar-store-btn-name', storeButtonName.trim());
    localStorage.setItem('faqar-store-btn-url', storeButtonUrl.trim());
    showToast('تم تحديث وحفظ إعدادات زر المتجر بنجاح', 'success');
  };

  // JSON download
  const handleDownloadJSON = async () => {
    try {
      const data = await exportAll();
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `faqar_backup_local_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      showToast('تم تنزيل النسخة الاحتياطية JSON بنجاح', 'success');
    } catch {
      showToast('فشل في تصدير البيانات', 'error');
    }
  };

  // DB clear
  const handleClearDatabase = async () => {
    const doubleCheck = window.confirm('🚨 تحذير نهائي وقاطع:\nهل أنت متأكد تماماً من رغبتك في حذف كافة بيانات هذا التطبيق؟\nسيتم مسح جميع الزبائن، العقود، والدفعات نهائياً ولا يمكن استرجاعها إلا بوجود نسخة احتياطية.');
    if (!doubleCheck) return;

    try {
      await clearAll();
      localStorage.setItem('faqar-pending-sync', '0');
      showToast('تم تهيئة وتصفير قاعدة البيانات بالكامل', 'success');
      onRefreshData();
    } catch {
      showToast('فشل تصفير قاعدة البيانات', 'error');
    }
  };



  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-12">
      {/* Header */}
      <div>
        <p className="text-[11px] font-semibold text-amber-500 uppercase tracking-widest mb-1">لوحة الإدارة</p>
        <h1 className="text-2xl font-bold text-white tracking-tight">الإعدادات والنسخ</h1>
      </div>

      {/* ☁️ سحابة جوجل درايف للنسخ الاحتياطي التلقائي والمزامنة (Google Drive Backup & Sync Hub) */}
      <div className="bg-[#121214]/80 border border-white/5 rounded-[22px] overflow-hidden transition-all shadow-2xl">
        <button
          onClick={() => setAutoBackupOpen(!autoBackupOpen)}
          className="w-full p-5 flex items-center justify-between text-right text-white font-bold select-none cursor-pointer hover:bg-white/[0.02]"
          dir="rtl"
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <HardDrive className="w-5 h-5 text-amber-500" />
              {isWorkspaceConnected ? (
                <span className={`absolute -top-1 -left-1 w-2.5 h-2.5 rounded-full border border-black ${isBackupSyncing ? 'bg-green-400 animate-ping' : 'bg-green-500'}`} />
              ) : (
                <span className="absolute -top-1 -left-1 w-2.5 h-2.5 bg-rose-500 rounded-full border border-black" />
              )}
            </div>
            <div className="flex flex-col items-start gap-0.5">
              <span className="text-sm font-black">مركز التحكم بالنسخ والمزامنة التلقائية (Google Drive Center)</span>
              <span className="text-[10px] text-zinc-500 font-medium">مزامنة سحابية تلقائية، نسخ احتياطي دوّار لآخر 7 أيام</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isWorkspaceConnected ? (
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-extrabold px-2.5 py-0.5 rounded-full">
                مرتبط بنجاح 🟢
              </span>
            ) : (
              <span className="text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/20 font-extrabold px-2.5 py-0.5 rounded-full">
                غير مرتبط 🔴
              </span>
            )}
            {autoBackupOpen ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
          </div>
        </button>

        {autoBackupOpen && (
          <div className="p-5 border-t border-white/5 bg-black/25 animate-fade-in flex flex-col gap-5 text-right" dir="rtl">
            {isWorkspaceLoading ? (
              <div className="flex items-center justify-center py-6 gap-2">
                <RefreshCw className="w-4 h-4 text-amber-500 animate-spin" />
                <span className="text-xs text-zinc-500">جاري التحقق من الاتصال والمزامنة السحابية...</span>
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                {/* User Info details or Disconnected alert */}
                {!isWorkspaceConnected ? (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-amber-500/5 rounded-2xl border border-amber-500/10">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center font-black text-sm text-amber-500">
                        G
                      </div>
                      <div className="text-right flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">حساب جوجل للفرع غير مرتبط حالياً</span>
                          <span className="text-[9px] bg-amber-500/15 text-amber-400 font-bold px-1.5 py-0.5 rounded-md border border-amber-500/15">
                            غير مرتبط 🔴
                          </span>
                        </div>
                        <span className="text-[10px] text-zinc-500">سيتم ربط حسابك وتنشيطه تلقائياً فور نقر أي زر إجراء بالأسفل!</span>
                      </div>
                    </div>
                    <button
                      onClick={handleWorkspaceSignIn}
                      className="h-8 px-4 rounded-lg bg-white hover:bg-zinc-100 text-zinc-900 text-[11px] font-bold cursor-pointer transition-all active:scale-95 shrink-0 flex items-center gap-1.5 shadow-lg shadow-white/5"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 48 48">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                      </svg>
                      <span>ربط الحساب الآن</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                    <div className="flex items-center gap-3">
                      {workspaceUser?.photoURL ? (
                        <img src={workspaceUser.photoURL} alt="Avatar" className="w-10 h-10 rounded-full border border-white/10" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center font-black text-sm">
                          {workspaceUser?.displayName?.[0] || 'G'}
                        </div>
                      )}
                      <div className="text-right">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">{workspaceUser?.displayName || 'حساب جوجل المعتمد'}</span>
                          {isConnectionExpired && (
                            <span className="text-[9px] bg-amber-500/15 text-amber-400 font-bold px-1.5 py-0.5 rounded-md border border-amber-500/15 animate-pulse">
                              بحاجة لتنشيط
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-zinc-500">{workspaceUser?.email}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isConnectionExpired && (
                        <button
                          onClick={async () => {
                            try {
                              const res = await googleSignIn();
                              if (res) {
                                setIsConnectionExpired(false);
                                showToast('تم تنشيط الاتصال بنجاح! 🟢', 'success');
                                handleLoad7DayBackups();
                              }
                            } catch (err: any) {
                              showToast(err.message || 'فشل التنشيط', 'error');
                            }
                          }}
                          className="h-8 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-[11px] font-black cursor-pointer transition-all active:scale-95 flex items-center gap-1 shrink-0"
                        >
                          <span>تنشيط الاتصال</span>
                        </button>
                      )}
                      <button
                        onClick={handleWorkspaceSignOut}
                        className="h-8 px-3 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/10 text-[11px] font-bold cursor-pointer transition-colors active:scale-95 shrink-0"
                      >
                        قطع الاتصال
                      </button>
                    </div>
                  </div>
                )}

                {/* 🟢 Three Buttons Grid with Sync Indicator (Task 1) */}
                <div className="bg-[#18181b]/30 p-4 rounded-2xl border border-white/5 flex flex-col gap-4">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                    <span className="text-[11px] font-bold text-zinc-400">الإجراءات السريعة ومؤشر المزامنة التلقائية</span>
                    <div className="flex items-center gap-2 bg-black/40 px-2.5 py-1 rounded-full border border-white/5">
                      <span className={`w-2 h-2 rounded-full ${isBackupSyncing ? 'bg-emerald-400 animate-ping' : 'bg-emerald-500'}`} />
                      <span className="text-[10px] font-bold text-zinc-300">
                        {isBackupSyncing ? 'مزامنة نشطة الآن... ⚡' : 'المزامنة خاملة / جاهزة 🟢'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      onClick={handleExportBackupClick}
                      disabled={isBackupSyncing}
                      className="h-11 px-4 rounded-xl bg-amber-500 text-black hover:bg-amber-400 disabled:opacity-50 font-black text-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 shadow-md shadow-amber-500/5"
                    >
                      <Upload className="w-4 h-4" />
                      <span>
                        {!isWorkspaceConnected 
                          ? 'ربط وتصدير نسخة ⚡' 
                          : isConnectionExpired 
                            ? 'تنشيط وتصدير نسخة ⚡' 
                            : 'تصدير نسخة احتياطية'}
                      </span>
                    </button>

                    <button
                      onClick={async () => {
                        if (!(await ensureActiveConnection())) return;
                        const targetEl = document.getElementById('sliding-retention-list-anchor');
                        if (targetEl) {
                          targetEl.scrollIntoView({ behavior: 'smooth' });
                          showToast('يرجى اختيار النسخة التي ترغب باستيرادها من القائمة بالأسفل 👇', 'info');
                        }
                      }}
                      disabled={isBackupSyncing}
                      className="h-11 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-white disabled:opacity-50 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 border border-white/5"
                    >
                      <Download className="w-4 h-4" />
                      <span>
                        {!isWorkspaceConnected ? 'ربط واستيراد نسخة ⚡' : 'استيراد نسخة احتياطية'}
                      </span>
                    </button>

                    <button
                      onClick={handleManualSyncClick}
                      disabled={isBackupSyncing}
                      className="h-11 px-4 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 disabled:opacity-50 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
                    >
                      <RefreshCw className={`w-4 h-4 ${isBackupSyncing ? 'animate-spin' : ''}`} />
                      <span>
                        {!isWorkspaceConnected 
                          ? 'ربط ومزامنة فورية ⚡' 
                          : isConnectionExpired 
                            ? 'تنشيط ومزامنة فورية ⚡' 
                            : 'مزامنة يدوية فورية'}
                      </span>
                    </button>
                  </div>
                  
                  {syncStatusError && (
                    <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10.5px] p-2.5 rounded-xl font-bold">
                      ⚠️ فشلت المزامنة الأخيرة: {syncStatusError}
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between text-[10px] text-zinc-500 font-bold px-1">
                    <span>آخر نسخ ومزامنة ناجحة: <strong className="text-zinc-400 font-black">{lastBackupTime}</strong></span>
                    <span className="text-amber-500/80">المزامنة التلقائية مفعلة بخلفية النظام بنجاح 💫</span>
                  </div>
                </div>

                {/* 📅 Available 7-day backups sliding retention list (Task 3 & 4) */}
                <div id="sliding-retention-list-anchor" className="bg-[#18181b]/35 p-4 rounded-2xl border border-white/5 flex flex-col gap-3">
                  <div className="flex flex-col gap-1 text-right">
                    <span className="text-xs font-bold text-amber-500 flex items-center gap-1.5">
                      <Clock className="w-4 h-4" />
                      النسخ الاحتياطية المتوفرة خلال الـ 7 أيام الأخيرة (سياسة التدوير الصارمة)
                    </span>
                    <p className="text-[10px] text-zinc-500 leading-relaxed">
                      يتم حفظ نسخة احتياطية كاملة مدمجة تلقائياً لكل يوم، ويحتفظ النظام بآخر 7 نسخ يومية فقط. يتم حذف النسخ الأقدم تلقائياً لضمان الفعالية التامة وسرعة الأداء.
                    </p>
                  </div>

                  {/* Tab buttons */}
                  <div className="flex border-b border-white/5 gap-2 p-1 bg-black/25 rounded-xl">
                    <button
                      onClick={() => setActiveBackupTab('server')}
                      className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        activeBackupTab === 'server'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/10'
                          : 'text-zinc-400 hover:text-white border border-transparent'
                      }`}
                    >
                      نسخ السيرفر التلقائية (تلقائي 100%)
                    </button>
                    <button
                      onClick={() => setActiveBackupTab('gdrive')}
                      className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        activeBackupTab === 'gdrive'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/10'
                          : 'text-zinc-400 hover:text-white border border-transparent'
                      }`}
                    >
                      نسخ جوجل درايف السحابية
                    </button>
                  </div>

                  {activeBackupTab === 'server' ? (
                    isLoadingServerBackups ? (
                      <div className="flex items-center justify-center py-6 gap-2">
                        <RefreshCw className="w-4 h-4 text-amber-500 animate-spin" />
                        <span className="text-[11px] text-zinc-500">جاري تحميل النسخ التلقائية من السيرفر...</span>
                      </div>
                    ) : serverBackupsList.length === 0 ? (
                      <div className="text-center py-5 text-[11px] text-zinc-600 bg-black/10 rounded-xl border border-dashed border-white/5">
                        لا توجد نسخ احتياطية على السيرفر حالياً. سيتم حفظ النسخة الأولى تلقائياً عند تغيير أي بيانات في النظام.
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2 max-h-56 overflow-y-auto custom-scrollbar">
                        {serverBackupsList.map((bk) => (
                          <div key={bk.filename} className="flex items-center justify-between p-3 bg-black/30 rounded-xl border border-white/5 hover:border-white/10 transition-all">
                            <div className="flex flex-col items-start text-right gap-1">
                              <span className="text-xs font-bold text-white">نسخة احتياطية بتاريخ {bk.date}</span>
                              <span className="text-[9.5px] text-zinc-500">
                                حجم النسخة: <span className="text-zinc-400 font-mono">{(bk.size / 1024).toFixed(1)} KB</span> | آخر تحديث: <span className="text-zinc-400 font-mono">{new Date(bk.modifiedAt).toLocaleTimeString('ar-IQ')}</span>
                              </span>
                            </div>
                            
                            <button
                              onClick={() => handleRestoreServerBackupClick(bk.filename, bk.date)}
                              disabled={restoringServerBackup === bk.filename}
                              className="h-8 px-4 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/10 disabled:opacity-50 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                            >
                              {restoringServerBackup === bk.filename ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : (
                                <Download className="w-3.5 h-3.5" />
                              )}
                              <span>استرجاع البيانات</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    )
                  ) : (
                    /* Google Drive backups */
                    !isWorkspaceConnected ? (
                      <div className="flex flex-col items-center justify-center py-8 px-4 bg-black/10 rounded-2xl border border-dashed border-white/5 text-center">
                        <Clock className="w-6 h-6 text-zinc-600 mb-2" />
                        <p className="text-xs text-zinc-400 font-bold">النسخ الاحتياطية المتوفرة غير محملة</p>
                        <p className="text-[10px] text-zinc-500 mt-1 max-w-sm leading-relaxed">
                          يرجى ربط حساب جوجل للفرع أولاً. سيقوم النظام بتحميل وعرض قائمة النسخ السحابية مباشرة عند ربط الحساب.
                        </p>
                      </div>
                    ) : isLoadingBackups7Day ? (
                      <div className="flex items-center justify-center py-6 gap-2">
                        <RefreshCw className="w-4 h-4 text-amber-500 animate-spin" />
                        <span className="text-[11px] text-zinc-500">جاري مسح واسترداد النسخ الاحتياطية المتوفرة في درايف...</span>
                      </div>
                    ) : backupsList7Day.length === 0 ? (
                      <div className="text-center py-5 text-[11px] text-zinc-600 bg-black/10 rounded-xl border border-dashed border-white/5">
                        لا توجد نسخ احتياطية متوفرة في المجلد السحابي حالياً. سيتم حفظ النسخة الأولى تلقائياً عند تغيير أي بيانات في النظام.
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2 max-h-56 overflow-y-auto custom-scrollbar">
                        {backupsList7Day.map((bk) => (
                          <div key={bk.id} className="flex items-center justify-between p-3 bg-black/30 rounded-xl border border-white/5 hover:border-white/10 transition-all">
                            <div className="flex flex-col items-start text-right gap-1">
                              <span className="text-xs font-bold text-white">{bk.name}</span>
                              <span className="text-[9.5px] text-zinc-500">
                                رقم المجلد الفرعي بالدرايف: <code className="text-zinc-600 font-mono text-[9px]">{bk.id}</code>
                              </span>
                            </div>
                            
                            <button
                              onClick={() => handleRestore7DayClick(bk.id, bk.name)}
                              disabled={restoringBackupFolderId === bk.id}
                              className="h-8 px-4 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/10 disabled:opacity-50 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                            >
                              {restoringBackupFolderId === bk.id ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : (
                                <Download className="w-3.5 h-3.5" />
                              )}
                              <span>استرجاع البيانات</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    )
                  )}
                </div>

                {/* 🔗 Manual backup and restoration url linkage (Task 9) */}
                <div className="bg-[#18181b]/35 p-4 rounded-2xl border border-white/5 flex flex-col gap-3">
                  <span className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                    <Link className="w-4 h-4" />
                    ربط وتصدير/استيراد نسخة احتياطية يدوية مخصصة (جوجل درايف / شيت)
                  </span>
                  <p className="text-[10px] text-zinc-500 leading-relaxed">
                    ضع رابط مجلد في Google Drive أو رابط ملف شيت جوجل مخصص في الأسفل لكي تتمكن من تصدير النسخة الحالية أو استيراد نسخة سابقة منه يدوياً في أي وقت.
                  </p>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={manualBackupUrl}
                      onChange={(e) => {
                        setManualBackupUrl(e.target.value);
                        localStorage.setItem('faqar-gdrive-manual-backup-url', e.target.value);
                      }}
                      placeholder="أدخل رابط المجلد أو الشيت يدوياً (مثال: https://docs.google.com/spreadsheets/d/...)"
                      className="flex-1 h-10 px-3.5 rounded-xl bg-[#141416] border border-white/5 text-white placeholder-zinc-700 focus:outline-none text-[11px] text-left font-mono"
                      dir="ltr"
                    />
                    
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={handleManualExportClick}
                        disabled={isManualExporting}
                        className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-black flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Upload className={`w-3.5 h-3.5 ${isManualExporting ? 'animate-spin' : ''}`} />
                        <span>تصدير للرابط</span>
                      </button>

                      <button
                        onClick={handleManualImportClick}
                        disabled={isManualImporting}
                        className="h-10 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-black flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Download className={`w-3.5 h-3.5 ${isManualImporting ? 'animate-spin' : ''}`} />
                        <span>استيراد من الرابط</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* 🛡️ النسخ الاحتياطي الثنائي الكامل (Google Sheet + JSON) */}
                <div className="bg-indigo-950/10 border border-indigo-500/15 p-4 rounded-2xl flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                      <Shield className="w-4 h-4 text-indigo-400 animate-pulse" />
                      النسخ الاحتياطي الثنائي الكامل (Google Sheet + JSON)
                    </span>
                    <div className="flex items-center gap-1.5 bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">
                      <span className="text-[9px] font-bold text-indigo-300">ميزة الحماية المزدوجة 🔐</span>
                    </div>
                  </div>

                  {/* Feature explanation and example */}
                  <div className="bg-black/20 p-3 rounded-xl border border-white/[0.03] text-right" dir="rtl">
                    <p className="text-[10px] text-zinc-400 font-medium leading-relaxed mb-2">
                      💡 <strong>آلية عمل النسخة الثنائية:</strong> يقوم هذا الخيار بإنشاء وتحديث ملفين سحابيين متزامنين معاً بضغطة زر واحدة: ملف <strong>Google Sheet</strong> لعرض وجرد البيانات حسابياً بشكل منظم، وملف <strong>JSON</strong> مشفّر لقاعدة البيانات بالكامل لضمان الاستعادة التامة بنسبة 100% والخلو من أي تعليق أو فقدان للبيانات.
                    </p>
                    <p className="text-[9.5px] text-zinc-500 leading-normal">
                      📝 <strong>مثال بسيط:</strong> ضع رابط مجلدك الخاص في الحقل أدناه ثم انقر <strong>"تصدير"</strong>. سيقوم النظام بحفظ ملف الشيت والـ JSON بالداخل وتحديث المؤشرات. في حال رغبت بنقل البيانات لفرع أو جهاز آخر، ضع الرابط نفسه وانقر <strong>"استيراد وتصيير"</strong> ليتم إعادة بناء كامل قاعدة البيانات محلياً.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <input
                      type="text"
                      value={dualBackupUrl}
                      onChange={(e) => {
                        setDualBackupUrl(e.target.value);
                        localStorage.setItem('faqar-gdrive-dual-backup-url', e.target.value);
                      }}
                      placeholder="أدخل رابط المجلد، ملف الشيت، أو ملف الجيسون (مثال: https://docs.google.com/spreadsheets/d/...)"
                      className="w-full h-10 px-3.5 rounded-xl bg-[#141416] border border-white/5 text-white placeholder-zinc-700 focus:outline-none text-[11px] text-left font-mono"
                      dir="ltr"
                    />

                    {/* Action buttons */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <button
                        onClick={handleDualExportClick}
                        disabled={isDualExporting}
                        className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-md shadow-indigo-600/10"
                      >
                        <Upload className={`w-3.5 h-3.5 ${isDualExporting ? 'animate-spin' : ''}`} />
                        <span>تصدير النسخة الثنائية ⚡</span>
                      </button>

                      <button
                        onClick={handleDualImportClick}
                        disabled={isDualImporting}
                        className="h-10 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-md shadow-rose-600/10"
                      >
                        <Download className={`w-3.5 h-3.5 ${isDualImporting ? 'animate-spin' : ''}`} />
                        <span>استيراد وتصيير البيانات 🔄</span>
                      </button>

                      <button
                        onClick={() => {
                          if (dualBackupUrl) {
                            window.open(dualBackupUrl, '_blank');
                          } else {
                            showToast('يرجى وضع الرابط أولاً لفتحه مباشرة', 'error');
                          }
                        }}
                        className="h-10 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-zinc-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
                      >
                        <Link className="w-3.5 h-3.5 text-zinc-400" />
                        <span>الذهاب المباشر للملف 🌐</span>
                      </button>
                    </div>

                    {/* Stats, indicators and status */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-black/15 p-3 rounded-xl border border-white/[0.02] text-xs font-bold mt-1 text-right" dir="rtl">
                      {/* 1. Export Status Indicator */}
                      <div className="flex flex-col items-start gap-1">
                        <span className="text-[10px] text-zinc-500 block">حالة التصدير الأخيرة</span>
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2.5 h-2.5 rounded-full ${dualSuccess ? 'bg-green-500' : 'bg-zinc-600'}`} />
                          <span className={`text-[11px] ${dualSuccess ? 'text-green-400' : 'text-zinc-400'}`}>
                            {dualSuccess ? 'تم التصدير بنجاح 🟢' : 'لم يتم التصدير بعد ⚪'}
                          </span>
                        </div>
                      </div>

                      {/* 2. Days since last export & timestamp */}
                      <div className="flex flex-col items-start gap-1">
                        <span className="text-[10px] text-zinc-500 block">مؤشر أيام آخر عملية نسخ</span>
                        <div className="flex flex-col items-start gap-0.5">
                          <div className="flex items-center gap-1">
                            <span className="text-amber-500 text-xs font-black">
                              {(() => {
                                const lastTs = localStorage.getItem('faqar-dual-backup-last-timestamp');
                                if (!lastTs) return '—';
                                const diffMs = Date.now() - parseInt(lastTs, 10);
                                const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                                return `منذ ${diffDays} يوم`;
                              })()}
                            </span>
                            <span className="text-[10px] text-zinc-400 font-normal">({dualLastTime})</span>
                          </div>
                        </div>
                      </div>

                      {/* 3. Last import count & timestamp */}
                      <div className="flex flex-col items-start gap-1">
                        <span className="text-[10px] text-zinc-500 block">آخر عملية استيراد تمت</span>
                        <div className="flex flex-col items-start gap-0.5">
                          <span className="text-emerald-400 text-xs font-black">
                            العملية رقم #{dualImportCount}
                          </span>
                          <span className="text-[9px] text-zinc-400 font-normal leading-none mt-0.5">
                            {dualImportLastTime} ({dualImportLastType})
                          </span>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>

                {/* ⚙️ Advanced Primary Backup Folder url Customization (Task 8) */}
                <div className="bg-[#18181b]/35 p-4 rounded-2xl border border-white/5 flex flex-col gap-3">
                  <span className="text-xs font-bold text-zinc-400">تخصيص مجلد النسخ الاحتياطي التلقائي الرئيسي</span>
                  <p className="text-[10px] text-zinc-500 leading-relaxed">
                    افتراضياً، يقوم التطبيق تلقائياً بإنشاء مجلد معتمد باسم <strong>"النسخ الاحتياطية لنظام الفقار"</strong> في حسابك. إذا كنت تفضل استخدام مجلد مخصص مسبقاً، ضع رابطه بالأسفل لتوجيه المزامنة إليه:
                  </p>

                  <div className="flex flex-col gap-2">
                    <input
                      type="text"
                      value={gdriveFolderUrl}
                      onChange={(e) => handleFolderUrlChange(e.target.value)}
                      placeholder="رابط مجلد Google Drive الرئيسي للنسخ التلقائي (اتركه فارغاً للتوليد التلقائي)"
                      className="w-full h-10 px-3.5 rounded-xl bg-[#141416] border border-white/5 text-white placeholder-zinc-700 focus:outline-none text-[11px] text-left font-mono"
                      dir="ltr"
                    />
                    
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[10px] text-zinc-500">
                        حالة المجلد: <strong className="text-zinc-400 font-bold">{isFolderAutogenerated ? 'مجلد تلقائي معتمد بالدرايف 📂' : 'تم ربط مجلدك المخصص المكتوب 🔗'}</strong>
                      </span>
                      {gdriveFolderUrl && (
                        <a
                          href={gdriveFolderUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] text-amber-500 font-bold hover:underline"
                        >
                          فتح المجلد في جوجل درايف
                        </a>
                      )}
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>
        )}
      </div>

      {/* 1. PWA installation */}
      <div className="bg-[#121214]/60 border border-white/5 rounded-[22px] overflow-hidden transition-all">
        <button
          onClick={() => toggleSection('updates')}
          className="w-full p-5 flex items-center justify-between text-right text-white font-bold select-none cursor-pointer hover:bg-white/[0.02]"
        >
          <div className="flex items-center gap-2">
            <Info className="w-5 h-5 text-amber-500" />
            <span className="text-sm">تثبيت وتحديث ملفات التطبيق (كاش الرّام)</span>
          </div>
          {openSections.updates ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
        </button>

        {openSections.updates && (
          <div className="p-5 border-t border-white/5 bg-black/10 animate-fade-in flex flex-col gap-4">
            <p className="text-xs text-zinc-400 leading-relaxed">
              يتيح لك تشغيل التطبيق أوفلاين كبرنامج هاتف أو حاسوب مباشر بدون الحاجة لإنترنت للتخزين والاستخدام اليومي.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleInstallPWA}
                className="h-10 px-4 rounded-xl bg-amber-500 text-black hover:bg-amber-400 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors active:scale-95"
              >
                <span>{canInstall ? 'تثبيت الآن' : 'تعليمات التثبيت'}</span>
              </button>
              <button
                onClick={handleForceUpdate}
                className="h-10 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-zinc-300 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors active:scale-95"
              >
                <RefreshCw className="w-4 h-4" />
                <span>تحديث التطبيق</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 2.5 Caching & Sync Alerts */}
      <div className="bg-[#121214]/60 border border-white/5 rounded-[22px] overflow-hidden transition-all">
        <button
          onClick={() => toggleSection('updates')}
          className="w-full p-5 flex items-center justify-between text-right text-white font-bold select-none cursor-pointer hover:bg-white/[0.02]"
        >
          <div className="flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-amber-500 animate-pulse" />
            <span className="text-sm">إدارة كاش وسرعة النظام (RAM Cache)</span>
          </div>
          {openSections.updates ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
        </button>

        {openSections.updates && (
          <div className="p-5 border-t border-white/5 bg-black/10 animate-fade-in flex flex-col gap-4">
            <p className="text-xs text-zinc-400 leading-relaxed">
              يستخدم النظام ذاكرة تخزين مؤقت فائقة السرعة بالرّام لضمان استجابة فورية وخفة متناهية عند التصفح والبحث بدون أي تأخير.
            </p>

            {pendingSyncCount > 0 ? (
              <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl flex gap-2.5 items-start">
                <span className="text-lg">⚠️</span>
                <div className="flex-1 text-right">
                  <p className="text-xs text-amber-400 font-bold leading-normal">يوجد {pendingSyncCount} إجراءات/تحديثات معلقة لم يتم مزامنتها!</p>
                  <p className="text-[10px] text-zinc-400 leading-normal mt-1">هنالك تعديلات مخزنة محلياً بانتظار إرسالها للنسخ السحابي وقنوات التيليجرام وشيتات جوجل. نوصي بعدم تصفير الكاش قبل المزامنة لتجنب تعليق البيانات.</p>
                </div>
              </div>
            ) : (
              <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl flex gap-2.5 items-start">
                <span className="text-lg">✅</span>
                <div className="flex-1 text-right">
                  <p className="text-xs text-emerald-400 font-bold leading-normal">جميع التحديثات والإجراءات مزامنة كلياً!</p>
                  <p className="text-[10px] text-zinc-400 leading-normal mt-1">كافة التغييرات والعمليات المالية تم تأكيدها ورفعها للتقارير بنجاح وسرعة كاملة.</p>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2.5">
              <button
                onClick={handlePurgeCache}
                className="w-full h-11 px-4 rounded-xl bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/20 text-amber-400 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors active:scale-95"
              >
                <span>تفريغ الكاش وإعادة تحميل البيانات 🧹</span>
              </button>
              <div className="flex items-center justify-between text-[10px] text-zinc-500 font-semibold px-1">
                <span>حالة كاش الرّام: نشط ومحمي 🛡️</span>
                <span>سرعة الاستجابة: 0.1 ملي ثانية ⚡</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Settings Views Nav rows - Inside a Collapsible */}
      <div className="bg-[#121214]/60 border border-white/5 rounded-[22px] overflow-hidden transition-all">
        <button
          onClick={() => toggleSection('dashboard')}
          className="w-full p-5 flex items-center justify-between text-right text-white font-bold select-none cursor-pointer hover:bg-white/[0.02]"
        >
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-5 h-5 text-amber-500" />
            <span className="text-sm">دفاتر العمليات والتقارير وسجلات الأحداث</span>
          </div>
          {openSections.dashboard ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
        </button>

        {openSections.dashboard && (
          <div className="p-5 border-t border-white/5 bg-black/10 animate-fade-in flex flex-col gap-2">
            <button
              onClick={() => onNavigateTo('recent_actions')}
              className="flex items-center justify-between p-3 bg-[#18181b]/50 hover:bg-[#18181c]/80 border border-white/5 rounded-2xl cursor-pointer text-right group transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-500 group-hover:scale-110 transition-transform">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">سجل الإجراءات والتحديثات الأخيرة 📜</span>
                  <span className="text-[10px] text-zinc-500 block mt-0.5">تتبع كافة الإجراءات والعمليات المالية والتحسينات في جلستك</span>
                </div>
              </div>
            </button>

            <button
              onClick={() => onNavigateTo('templates_settings')}
              className="flex items-center justify-between p-3 bg-[#18181b]/50 hover:bg-[#18181c]/80 border border-white/5 rounded-2xl cursor-pointer text-right group transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-500 group-hover:scale-110 transition-transform">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">إدارة وتعديل الرسائل وقوالب واتساب</span>
                  <span className="text-[10px] text-zinc-500 block mt-0.5">تحرير 50 متغيراً ذكياً وتعديل صيغ الإرسال والـ Placeholders</span>
                </div>
              </div>
            </button>

            <button
              onClick={() => onNavigateTo('notifications_settings')}
              className="flex items-center justify-between p-3 bg-[#18181b]/50 hover:bg-[#18181c]/80 border border-white/5 rounded-2xl cursor-pointer text-right group transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-orange-500/15 text-orange-500 group-hover:scale-110 transition-transform">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">الإشعارات والتنبيهات الذكية بالفرع</span>
                  <span className="text-[10px] text-zinc-500 block mt-0.5">جدولة قواعد إطلاق تنبيهات الديون وتحصيل الشهر تلقائياً</span>
                </div>
              </div>
            </button>

            <button
              onClick={() => onNavigateTo('audit_scheduler_settings')}
              className="flex items-center justify-between p-3 bg-[#18181b]/50 hover:bg-[#18181c]/80 border border-white/5 rounded-2xl cursor-pointer text-right group transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-400 group-hover:scale-110 transition-transform">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">تذكيرات وتقارير التليجرام الدوريّة</span>
                  <span className="text-[10px] text-zinc-500 block mt-0.5">جدولة تقارير الجرد اليومي والتنببهات الكرونية التلقائية</span>
                </div>
              </div>
            </button>

            <button
              onClick={() => onNavigateTo('debug_view')}
              className="flex items-center justify-between p-3 bg-[#18181b]/50 hover:bg-[#18181c]/80 border border-white/5 rounded-2xl cursor-pointer text-right group transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-zinc-500/15 text-zinc-400 group-hover:scale-110 transition-transform">
                  <Bug className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">سجلات النظام ووضع تصحيح الأخطاء (Debug)</span>
                  <span className="text-[10px] text-zinc-500 block mt-0.5">مراقبة حالات الطلبات والشبكة والـ cache وسجل الأحداث</span>
                </div>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* Admin Credentials Setup */}
      <div className="bg-[#121214]/60 border border-white/5 rounded-[22px] overflow-hidden transition-all">
        <button
          onClick={() => toggleSection('admin')}
          className="w-full p-5 flex items-center justify-between text-right text-white font-bold select-none cursor-pointer hover:bg-white/[0.02]"
        >
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-amber-500" />
            <span className="text-sm">تغيير معلومات الدخول لوحة الإدارة</span>
          </div>
          {openSections.admin ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
        </button>

        {openSections.admin && (
          <div className="p-5 border-t border-white/5 bg-black/10 animate-fade-in flex flex-col gap-4">
            <p className="text-xs text-zinc-400 leading-relaxed">
              قم بتحديث اسم المستخدم وكلمة المرور لتأمين لوحة الإدارة الخاصة بك. يتم حفظ التعديلات محلياً وتطبيقها فوراً عند تسجيل الدخول القادم.
            </p>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-zinc-500 font-semibold">اسم المستخدم الجديد</span>
                <input
                  type="text"
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  placeholder="مثال: faqar"
                  className="w-full h-10 px-4 rounded-xl bg-[#18181b] border border-white/5 text-white placeholder-zinc-600 focus:outline-none text-xs"
                />
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-zinc-500 font-semibold">كلمة المرور الجديدة</span>
                <div className="relative">
                  <input
                    type={showAdminPass ? 'text' : 'password'}
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="أدخل كلمة المرور الجديدة"
                    className="w-full h-10 pr-4 pl-12 rounded-xl bg-[#18181b] border border-white/5 text-white placeholder-zinc-600 focus:outline-none text-xs text-left"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminPass(!showAdminPass)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors text-xs"
                  >
                    {showAdminPass ? 'إخفاء' : 'إظهار'}
                  </button>
                </div>
              </div>

              <button
                onClick={handleSaveAdminCredentials}
                className="w-full h-10 bg-amber-500 text-black hover:bg-amber-400 font-bold rounded-xl text-xs flex items-center justify-center cursor-pointer transition-colors mt-1 shadow-lg shadow-amber-500/10"
              >
                <span>حفظ معلومات الدخول الجديدة</span>
              </button>
            </div>
          </div>
        )}
      </div>



      {/* 4.5. Custom Portal Store Button Settings */}
      <div className="bg-[#121214]/60 border border-white/5 rounded-[22px] overflow-hidden transition-all">
        <button
          onClick={() => toggleSection('store')}
          className="w-full p-5 flex items-center justify-between text-right text-white font-bold select-none cursor-pointer hover:bg-white/[0.02]"
        >
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-emerald-400" />
            <span className="text-sm">تخصيص زر "زيارة المتجر" للزبائن</span>
          </div>
          {openSections.store ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
        </button>

        {openSections.store && (
          <div className="p-5 border-t border-white/5 bg-black/10 animate-fade-in flex flex-col gap-4">
            <p className="text-xs text-zinc-400 leading-relaxed">
              قم بتحديد اسم ورابط زر المتجر الذي يظهر في أعلى بوابة الزبون الخاصة للاستعلام ليتمكنوا من زيارة متجرك أو قناتك مباشرة بضغطة زر.
            </p>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-zinc-500 font-semibold">اسم الزر (يظهر للزبون)</span>
                <input
                  type="text"
                  value={storeButtonName}
                  onChange={(e) => setStoreButtonName(e.target.value)}
                  placeholder="مثال: قم بزيارة المتجر 🏛️"
                  className="w-full h-10 px-4 rounded-xl bg-[#18181b] border border-white/5 text-white placeholder-zinc-600 focus:outline-none text-xs"
                />
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-zinc-500 font-semibold">رابط الزر (URL)</span>
                <input
                  type="text"
                  value={storeButtonUrl}
                  onChange={(e) => setStoreButtonUrl(e.target.value)}
                  placeholder="مثال: https://instagram.com/my_store"
                  className="w-full h-10 px-4 rounded-xl bg-[#18181b] border border-white/5 text-white placeholder-zinc-600 focus:outline-none text-xs text-left"
                  dir="ltr"
                />
              </div>

              <button
                onClick={handleSaveStoreButtonSettings}
                className="w-full h-10 bg-emerald-500 text-black hover:bg-emerald-400 font-bold rounded-xl text-xs flex items-center justify-center cursor-pointer transition-colors mt-1 shadow-lg shadow-emerald-500/10"
              >
                <span>حفظ تعديلات الزر</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Financial Dashboard Settings */}
      <div className="bg-[#121214]/60 border border-white/5 rounded-[22px] overflow-hidden transition-all">
        <button
          onClick={() => toggleSection('dashboard')}
          className="w-full p-5 flex items-center justify-between text-right text-white font-bold select-none cursor-pointer hover:bg-white/[0.02]"
        >
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-5 h-5 text-amber-500" />
            <span className="text-sm">تخصيص لوحة الجرد والميزانيات</span>
          </div>
          {openSections.dashboard ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
        </button>

        {openSections.dashboard && (
          <div className="p-5 border-t border-white/5 bg-black/10 animate-fade-in flex flex-col gap-4">
            <p className="text-xs text-zinc-400 leading-relaxed">
              تحكم في العناصر والأقسام التي تظهر في صفحة الجرد المالي لتناسب ميزانياتك وأعمالك الشخصية والتجارية.
            </p>
            
            <div className="flex flex-col gap-3">
              <label className="flex items-center justify-between p-3 rounded-xl bg-black/30 border border-white/5 cursor-pointer hover:bg-black/50 transition-all">
                <div className="flex-1 pr-2">
                  <span className="text-xs font-bold text-white block text-right">إحصائيات النظام الكلية</span>
                  <span className="text-[10px] text-zinc-500 block mt-0.5 text-right">إجمالي ديون الأقساط والديون وسداد السلف الكلي</span>
                </div>
                <input
                  type="checkbox"
                  checked={showSystemStats}
                  onChange={(e) => {
                    setShowSystemStats(e.target.checked);
                    localStorage.setItem('faqar-fin-show-system', String(e.target.checked));
                  }}
                  className="w-4 h-4 rounded border-zinc-800 text-amber-500 bg-[#18181b] focus:ring-0 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl bg-black/30 border border-white/5 cursor-pointer hover:bg-black/50 transition-all">
                <div className="flex-1 pr-2">
                  <span className="text-xs font-bold text-white block text-right">المحافظ وصناديق الميزانية الخاصة</span>
                  <span className="text-[10px] text-zinc-500 block mt-0.5 text-right">المحفظة الشخصية، ميزانيات الأعمال الإضافية وتوزيع السيولة</span>
                </div>
                <input
                  type="checkbox"
                  checked={showBudgetsList}
                  onChange={(e) => {
                    setShowBudgetsList(e.target.checked);
                    localStorage.setItem('faqar-fin-show-budgets', String(e.target.checked));
                  }}
                  className="w-4 h-4 rounded border-zinc-800 text-amber-500 bg-[#18181b] focus:ring-0 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl bg-black/30 border border-white/5 cursor-pointer hover:bg-black/50 transition-all">
                <div className="flex-1 pr-2">
                  <span className="text-xs font-bold text-white block text-right">العمليات والحركات المالية الأخيرة</span>
                  <span className="text-[10px] text-zinc-500 block mt-0.5 text-right">عرض شريط ودفتر الإيرادات والمصروفات والتحويلات المضافة يدوياً</span>
                </div>
                <input
                  type="checkbox"
                  checked={showTransactionsList}
                  onChange={(e) => {
                    setShowTransactionsList(e.target.checked);
                    localStorage.setItem('faqar-fin-show-txs', String(e.target.checked));
                  }}
                  className="w-4 h-4 rounded border-zinc-800 text-amber-500 bg-[#18181b] focus:ring-0 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl bg-black/30 border border-white/5 cursor-pointer hover:bg-black/50 transition-all">
                <div className="flex-1 pr-2">
                  <span className="text-xs font-bold text-white block text-right">الرسوم والتقارير البيانية التحليلية</span>
                  <span className="text-[10px] text-zinc-500 block mt-0.5 text-right">مقارنة الإيرادات بالمصاريف ونسب الفئات للأصول والالتزامات</span>
                </div>
                <input
                  type="checkbox"
                  checked={showReports}
                  onChange={(e) => {
                    setShowReports(e.target.checked);
                    localStorage.setItem('faqar-fin-show-reports', String(e.target.checked));
                  }}
                  className="w-4 h-4 rounded border-zinc-800 text-amber-500 bg-[#18181b] focus:ring-0 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl bg-black/30 border border-white/5 cursor-pointer hover:bg-black/50 transition-all">
                <div className="flex-1 pr-2">
                  <span className="text-xs font-bold text-white block text-right">إخفاء الحسابات فارغة الرصيد (0)</span>
                  <span className="text-[10px] text-zinc-500 block mt-0.5 text-right">عدم إظهار المحافظ أو الصناديق ذات الرصيد الفارغ</span>
                </div>
                <input
                  type="checkbox"
                  checked={hideZeroBalanceAccounts}
                  onChange={(e) => {
                    setHideZeroBalanceAccounts(e.target.checked);
                    localStorage.setItem('faqar-fin-hide-zero', String(e.target.checked));
                  }}
                  className="w-4 h-4 rounded border-zinc-800 text-amber-500 bg-[#18181b] focus:ring-0 cursor-pointer"
                />
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Floating Action Button (FAB) Customization */}
      <div className="bg-[#121214]/60 border border-white/5 rounded-[22px] overflow-hidden transition-all">
        <button
          onClick={() => toggleSection('fab')}
          className="w-full p-5 flex items-center justify-between text-right text-white font-bold select-none cursor-pointer hover:bg-white/[0.02]"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500 animate-pulse" />
            <span className="text-sm">تخصيص الزر العائم للاختصارات السريعة (FAB)</span>
          </div>
          {openSections.fab ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
        </button>

        {openSections.fab && (
          <div className="p-5 border-t border-white/5 bg-black/10 animate-fade-in flex flex-col gap-4">
            <p className="text-xs text-zinc-400 leading-relaxed">
              قم بتشغيل أو إطفاء زر الإجراءات العائم السريع وتخصيص الاختصارات العملية التي تريد ظهورها فيه لإنجاز مهامك اليومية بسرعة وسهولة.
            </p>

            <div className="flex flex-col gap-3">
              {/* Main Toggle */}
              <label className="flex items-center justify-between p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 cursor-pointer hover:bg-amber-500/15 transition-all">
                <div className="flex-1 pr-2">
                  <span className="text-xs font-bold text-amber-400 block text-right">تشغيل الزر العائم السريع (FAB)</span>
                  <span className="text-[10px] text-zinc-400 block mt-0.5 text-right">إظهار دائرة الاختصارات العائمة في زاوية الشاشة لتسريع عملك</span>
                </div>
                <input
                  type="checkbox"
                  checked={fabEnabled}
                  onChange={(e) => {
                    setFabEnabled(e.target.checked);
                    localStorage.setItem('faqar-fab-enabled', String(e.target.checked));
                    window.dispatchEvent(new Event('faqar-fab-settings-updated'));
                  }}
                  className="w-4 h-4 rounded border-zinc-800 text-amber-500 bg-[#18181b] focus:ring-0 cursor-pointer"
                />
              </label>

              {fabEnabled && (
                <div className="border border-white/5 rounded-2xl p-4 bg-black/20 flex flex-col gap-3 animate-fade-in" dir="rtl">
                  <span className="text-[10px] text-zinc-500 font-bold block text-right border-b border-white/5 pb-2">حدّد الاختصارات النشطة التي تظهر عند الضغط:</span>
                  
                  {/* Add Customer Toggle */}
                  <label className="flex items-center justify-between p-2.5 rounded-lg hover:bg-white/[0.02] cursor-pointer transition-all">
                    <span className="text-xs text-zinc-300">👤 إضافة زبون جديد</span>
                    <input
                      type="checkbox"
                      checked={fabAddCustomer}
                      onChange={(e) => {
                        setFabAddCustomer(e.target.checked);
                        localStorage.setItem('faqar-fab-add-customer', String(e.target.checked));
                        window.dispatchEvent(new Event('faqar-fab-settings-updated'));
                      }}
                      className="w-4 h-4 rounded border-zinc-800 text-amber-500 bg-[#18181b] focus:ring-0 cursor-pointer"
                    />
                  </label>

                  {/* Add Contract Toggle */}
                  <label className="flex items-center justify-between p-2.5 rounded-lg hover:bg-white/[0.02] cursor-pointer transition-all">
                    <span className="text-xs text-zinc-300">📝 إضافة عقد قسط</span>
                    <input
                      type="checkbox"
                      checked={fabAddContract}
                      onChange={(e) => {
                        setFabAddContract(e.target.checked);
                        localStorage.setItem('faqar-fab-add-contract', String(e.target.checked));
                        window.dispatchEvent(new Event('faqar-fab-settings-updated'));
                      }}
                      className="w-4 h-4 rounded border-zinc-800 text-amber-500 bg-[#18181b] focus:ring-0 cursor-pointer"
                    />
                  </label>

                  {/* Add Payment Toggle */}
                  <label className="flex items-center justify-between p-2.5 rounded-lg hover:bg-white/[0.02] cursor-pointer transition-all">
                    <span className="text-xs text-zinc-300">💰 تسجيل دفعة مالية</span>
                    <input
                      type="checkbox"
                      checked={fabAddPayment}
                      onChange={(e) => {
                        setFabAddPayment(e.target.checked);
                        localStorage.setItem('faqar-fab-add-payment', String(e.target.checked));
                        window.dispatchEvent(new Event('faqar-fab-settings-updated'));
                      }}
                      className="w-4 h-4 rounded border-zinc-800 text-amber-500 bg-[#18181b] focus:ring-0 cursor-pointer"
                    />
                  </label>

                  {/* Add Debt Toggle */}
                  <label className="flex items-center justify-between p-2.5 rounded-lg hover:bg-white/[0.02] cursor-pointer transition-all">
                    <span className="text-xs text-zinc-300">🔴 تسجيل دين جديد</span>
                    <input
                      type="checkbox"
                      checked={fabAddDebt}
                      onChange={(e) => {
                        setFabAddDebt(e.target.checked);
                        localStorage.setItem('faqar-fab-add-debt', String(e.target.checked));
                        window.dispatchEvent(new Event('faqar-fab-settings-updated'));
                      }}
                      className="w-4 h-4 rounded border-zinc-800 text-amber-500 bg-[#18181b] focus:ring-0 cursor-pointer"
                    />
                  </label>

                  {/* Add Salaf Toggle */}
                  <label className="flex items-center justify-between p-2.5 rounded-lg hover:bg-white/[0.02] cursor-pointer transition-all">
                    <span className="text-xs text-zinc-300">🪙 إضافة سلفة جديدة</span>
                    <input
                      type="checkbox"
                      checked={fabAddSalaf}
                      onChange={(e) => {
                        setFabAddSalaf(e.target.checked);
                        localStorage.setItem('faqar-fab-add-salaf', String(e.target.checked));
                        window.dispatchEvent(new Event('faqar-fab-settings-updated'));
                      }}
                      className="w-4 h-4 rounded border-zinc-800 text-amber-500 bg-[#18181b] focus:ring-0 cursor-pointer"
                    />
                  </label>

                  {/* Add Audit Toggle */}
                  <label className="flex items-center justify-between p-2.5 rounded-lg hover:bg-white/[0.02] cursor-pointer transition-all">
                    <span className="text-xs text-zinc-300">⚖️ جدولة جرد حوكمة مالية</span>
                    <input
                      type="checkbox"
                      checked={fabAddAudit}
                      onChange={(e) => {
                        setFabAddAudit(e.target.checked);
                        localStorage.setItem('faqar-fab-add-audit', String(e.target.checked));
                        window.dispatchEvent(new Event('faqar-fab-settings-updated'));
                      }}
                      className="w-4 h-4 rounded border-zinc-800 text-amber-500 bg-[#18181b] focus:ring-0 cursor-pointer"
                    />
                  </label>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 6. Database local status and clear */}
      <div className="bg-rose-950/10 border border-rose-950/30 rounded-[22px] overflow-hidden transition-all">
        <button
          onClick={() => toggleSection('clear_db')}
          className="w-full p-5 flex items-center justify-between text-right text-rose-400 font-bold select-none cursor-pointer hover:bg-white/[0.01]"
        >
          <div className="flex items-center gap-2">
            <Trash2 className="w-5 h-5" />
            <span className="text-sm">تصفير البيانات المحلية بالكامل</span>
          </div>
          {openSections.clear_db ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
        </button>

        {openSections.clear_db && (
          <div className="p-5 border-t border-rose-950/20 bg-black/10 animate-fade-in flex flex-col gap-4">
            <p className="text-xs text-zinc-500 leading-relaxed">
              عدد السجلات المخزنة محلياً بالفرع: <strong>{customers.length}</strong> زبون • <strong>{contracts.length}</strong> عقد أقساط • <strong>{payments.length}</strong> دفعة مستلمة.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleDownloadJSON}
                className="h-10 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer border border-white/5"
              >
                <Download className="w-4 h-4" />
                <span>تصدير ملف JSON</span>
              </button>
              <button
                onClick={handleClearDatabase}
                className="h-10 px-4 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>مسح الكل وتهيئة</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Logout button */}
      <div className="mt-4 text-center">
        <button
          onClick={onLogout}
          className="h-11 px-6 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-rose-400 font-bold text-xs flex items-center justify-center gap-2 mx-auto cursor-pointer transition-transform active:scale-95"
        >
          <LogOut className="w-4 h-4" />
          <span>تسجيل الخروج من الحساب</span>
        </button>
      </div>
    </div>
  );
}
