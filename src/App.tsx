/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  LayoutGrid,
  Users,
  AlertTriangle,
  Settings,
  RefreshCw,
  CircleDollarSign,
  PiggyBank,
  ArrowRight,
  Sparkles,
  Search,
  Scale,
  Plus,
  Phone,
  MessageCircle,
  Zap,
  ShieldCheck,
  UserPlus,
  Coins,
  X,
  Compass,
  Sliders
} from 'lucide-react';
import { Customer, Contract, Payment, Template, NotificationRule, AuditSchedule } from './types';
import { getAllFromStore, exportAll, importAll } from './db';
import { seedDatabaseIfEmpty } from './seed';
import { initializeDefaultsIfEmpty } from './defaults';
import { getPendingSyncCount } from './syncQueue';
import { initAuth, googleSignIn, create7DayBackup, isTokenExpired } from './googleWorkspace';

// Toast Container
import { ToastContainer, showToast } from './components/Toast';

// Views
import { LoginView } from './views/LoginView';
import { AnalyticsView } from './views/AnalyticsView';
import { CustomersView } from './views/CustomersView';
import { CustomerProfileView } from './views/CustomerProfileView';
import { DefaultersView } from './views/DefaultersView';
import { SettingsView } from './views/SettingsView';
import { TemplatesSettingsView } from './views/TemplatesSettingsView';
import { NotificationsSettingsView } from './views/NotificationsSettingsView';
import { AuditScheduleView } from './views/AuditScheduleView';
import { DebugView } from './views/DebugView';
import { CustomerPortalView } from './views/CustomerPortalView';
import { CustomerPortalLogin } from './views/CustomerPortalLogin';
import { DebtsView } from './views/DebtsView';
import { SalafsView } from './views/SalafsView';
import { ActionDetailView } from './views/ActionDetailView';
import { RecentActionsView } from './views/RecentActionsView';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<'admin' | 'customer' | 'customer_portal_login' | null>(null);
  const [loggedCustomerId, setLoggedCustomerId] = useState<string | null>(null);

  // DB Data States
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  // Settings & Templates States
  const [templates, setTemplates] = useState<Template[]>([]);
  const [notificationRules, setNotificationRules] = useState<NotificationRule[]>([]);
  const [auditSchedules, setAuditSchedules] = useState<AuditSchedule[]>([]);

  // Navigation States
  const [currentTab, setCurrentTab] = useState<'analytics' | 'customers' | 'defaulters' | 'debts' | 'salafs' | 'settings'>('analytics');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [settingsSubView, setSettingsSubView] = useState<string>('none');
  const [actionsLog, setActionsLog] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('faqar-actions-log');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [selectedActionForDetail, setSelectedActionForDetail] = useState<any | null>(null);

  const [history, setHistory] = useState<Array<{
    currentTab: 'analytics' | 'customers' | 'defaulters' | 'debts' | 'salafs' | 'settings';
    selectedCustomer: Customer | null;
    settingsSubView: string;
  }>>([]);
  const [isGoingBack, setIsGoingBack] = useState(false);

  // Sync state
  const [pendingSync, setPendingSync] = useState(0);

  // Floating Action Button (FAB) Reactive Settings
  const [fabConfig, setFabConfig] = useState({
    enabled: localStorage.getItem('faqar-fab-enabled') !== 'false',
    addCustomer: localStorage.getItem('faqar-fab-add-customer') !== 'false',
    addContract: localStorage.getItem('faqar-fab-add-contract') !== 'false',
    addPayment: localStorage.getItem('faqar-fab-add-payment') !== 'false',
    addDebt: localStorage.getItem('faqar-fab-add-debt') !== 'false',
    addSalaf: localStorage.getItem('faqar-fab-add-salaf') !== 'false',
    addAudit: localStorage.getItem('faqar-fab-add-audit') !== 'false',
  });

  useEffect(() => {
    const handleUpdateFabSettings = () => {
      setFabConfig({
        enabled: localStorage.getItem('faqar-fab-enabled') !== 'false',
        addCustomer: localStorage.getItem('faqar-fab-add-customer') !== 'false',
        addContract: localStorage.getItem('faqar-fab-add-contract') !== 'false',
        addPayment: localStorage.getItem('faqar-fab-add-payment') !== 'false',
        addDebt: localStorage.getItem('faqar-fab-add-debt') !== 'false',
        addSalaf: localStorage.getItem('faqar-fab-add-salaf') !== 'false',
        addAudit: localStorage.getItem('faqar-fab-add-audit') !== 'false',
      });
    };
    window.addEventListener('faqar-fab-settings-updated', handleUpdateFabSettings);
    return () => {
      window.removeEventListener('faqar-fab-settings-updated', handleUpdateFabSettings);
    };
  }, []);

  // Google Sheets Workspace Connection state in App.tsx
  const [isWorkspaceConnected, setIsWorkspaceConnected] = useState(false);
  const [linkedSheetId, setLinkedSheetId] = useState(() => localStorage.getItem('faqar-linked-sheet-id') || '14bhuJwwJUone0cCdGyq7CIQYHgsYpssMh1zWB5Otlig');

  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setIsWorkspaceConnected(true);
      },
      () => {
        setIsWorkspaceConnected(false);
      }
    );

    const handleSheetIdUpdated = () => {
      setLinkedSheetId(localStorage.getItem('faqar-linked-sheet-id') || '14bhuJwwJUone0cCdGyq7CIQYHgsYpssMh1zWB5Otlig');
    };
    window.addEventListener('faqar-linked-sheet-id-updated', handleSheetIdUpdated);

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
      window.removeEventListener('faqar-linked-sheet-id-updated', handleSheetIdUpdated);
    };
  }, []);

  useEffect(() => {
    localStorage.removeItem('faqar-app-theme');
    document.documentElement.className = '';
  }, []);





  // Search overlay & FAB open states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchActive, setSearchActive] = useState(false);
  const [isFabOpen, setIsFabOpen] = useState(false);

  // Governance / Audit Modal State
  const [isGovernanceModalOpen, setIsGovernanceModalOpen] = useState(false);
  const [govName, setGovName] = useState('إجراء جرد وحوكمة وقائية تلقائية');
  const [govCron, setGovCron] = useState('0 20 * * *');
  const [govTokens, setGovTokens] = useState<string[]>([
    'total_debts',
    'total_paid',
    'outstanding_amount',
    'defaulters_count',
    'avg_lateness'
  ]);

  // Check Auth on Mount
  useEffect(() => {
    const initializeApp = async () => {
      // 1. Always load and synchronize data first
      await loadAllData();

      // 2. Check session token
      const session = localStorage.getItem('faqar-session-v1');
      if (session) {
        if (session === 'admin-logged-in') {
          setUserRole('admin');
          setIsAuthenticated(true);
        } else if (session.startsWith('customer-logged-in-')) {
          const custId = session.replace('customer-logged-in-', '');
          setUserRole('customer');
          setLoggedCustomerId(custId);
          setIsAuthenticated(true);
        } else {
          setUserRole('customer_portal_login');
          setIsAuthenticated(false);
        }
      } else {
        // Fallback to the secure, deceptive portal login for all users (Admin & Customer)
        setUserRole('customer_portal_login');
        setIsAuthenticated(false);
      }
    };

    initializeApp();
  }, []);

  // Listen to Local Changes / Sync events
  useEffect(() => {
    const handleSyncChange = () => {
      setPendingSync(getPendingSyncCount());
    };
    window.addEventListener('faqar-sync-change', handleSyncChange);
    return () => {
      window.removeEventListener('faqar-sync-change', handleSyncChange);
    };
  }, []);

  // Listen to Global Action Details Event and record in logs
  useEffect(() => {
    const handleActionDetails = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setActionsLog((prev) => {
          if (prev.some(act => act.id === customEvent.detail.id)) {
            return prev;
          }
          const updated = [customEvent.detail, ...prev].slice(0, 100);
          localStorage.setItem('faqar-actions-log', JSON.stringify(updated));
          return updated;
        });
      }
    };
    window.addEventListener('faqar-action-details', handleActionDetails);
    return () => {
      window.removeEventListener('faqar-action-details', handleActionDetails);
    };
  }, []);

  // Automated History Tracker
  useEffect(() => {
    if (isGoingBack) {
      setIsGoingBack(false);
      return;
    }

    const stateToSave = {
      currentTab,
      selectedCustomer: selectedCustomer ? { ...selectedCustomer } : null,
      settingsSubView
    };

    setHistory((prev) => {
      const last = prev[prev.length - 1];
      if (last &&
          last.currentTab === stateToSave.currentTab &&
          last.selectedCustomer?.id === stateToSave.selectedCustomer?.id &&
          last.settingsSubView === stateToSave.settingsSubView) {
        return prev;
      }
      return [...prev, stateToSave].slice(-50);
    });
  }, [currentTab, selectedCustomer, settingsSubView]);

  const handleGlobalBack = () => {
    if (history.length <= 1) return;
    setIsGoingBack(true);

    const updatedHistory = history.slice(0, -1);
    const targetState = updatedHistory[updatedHistory.length - 1];

    setHistory(updatedHistory);
    setCurrentTab(targetState.currentTab);
    setSelectedCustomer(targetState.selectedCustomer);
    setSettingsSubView(targetState.settingsSubView);
    setSelectedActionForDetail(null);
  };

  const handleSaveGovernanceAction = () => {
    if (!govName.trim() || !govCron.trim()) {
      showToast('يرجى كتابة اسم الإجراء والجدولة الزمنية الكرونية بشكل صحيح', 'warning');
      return;
    }
    
    const newSchedule: AuditSchedule = {
      id: 'audit-' + Math.random().toString(36).substring(2, 9),
      name: govName.trim(),
      cronExpression: govCron.trim(),
      reportVariables: govTokens,
      isActive: true,
      createdAt: new Date().toISOString()
    };

    const saved = localStorage.getItem('faqar-audit-schedules-v1');
    const list: AuditSchedule[] = saved ? JSON.parse(saved) : [];
    list.push(newSchedule);

    localStorage.setItem('faqar-audit-schedules-v1', JSON.stringify(list));
    
    loadAllData();
    showToast('⚖️ تم إدراج وجدولة إجراء الحوكمة والرقابة المالية للمنظومة بنجاح!', 'success');
    setIsGovernanceModalOpen(false);
  };

  const loadAllData = async () => {
    try {
      // 1. Seed if DB empty
      await seedDatabaseIfEmpty();

      // 2. Initialize defaults
      initializeDefaultsIfEmpty();

      // 3. Synchronize with the central server if online
      if (navigator.onLine) {
        try {
          const syncRes = await fetch('/api/sync/download');
          if (syncRes.ok) {
            const serverData = await syncRes.json();
            const localData = await exportAll();
            
            const serverTime = serverData.exportedAt ? new Date(serverData.exportedAt).getTime() : 0;
            const localTime = localData.exportedAt ? new Date(localData.exportedAt).getTime() : 0;
            
            // Check if local data is just the default seed (which only has the SEED_PHONE '07827744096' or is very small)
            const isJustSeed = localData.customers.length <= 5 && localData.customers.every(c => c.phone === '07827744096');
            
            if (isJustSeed && serverData.customers && serverData.customers.length > 0) {
              await importAll(serverData, true);
              console.log('Force synchronized seed with server data');
            } else if (serverTime > localTime) {
              await importAll(serverData, true);
              console.log('Synchronized local database with newer server data');
            } else if (localTime > serverTime && !isJustSeed) {
              // Upload our newer local database to the server
              await fetch('/api/sync/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(localData)
              });
              console.log('Uploaded newer local database to the server');
            }
          } else if (syncRes.status === 404) {
            // Server has no sync file yet, upload our local data if it's not just the seed data
            const localData = await exportAll();
            const isJustSeed = localData.customers.length <= 5 && localData.customers.every(c => c.phone === '07827744096');
            if (!isJustSeed) {
              await fetch('/api/sync/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(localData)
              });
              console.log('Uploaded initial database to the server');
            }
          }
        } catch (syncErr) {
          console.error('Startup server synchronization failed:', syncErr);
        }
      }

      // 4. Get IndexedDB values
      const dbCusts = await getAllFromStore('customers');
      const dbConts = await getAllFromStore('contracts');
      const dbPays = await getAllFromStore('payments');

      setCustomers(dbCusts);
      setContracts(dbConts);
      setPayments(dbPays);

      // 5. Get LocalStorage configurations
      const savedTemplates = localStorage.getItem('faqar-message-templates-v1');
      if (savedTemplates) {
        setTemplates(JSON.parse(savedTemplates));
      }

      const savedRules = localStorage.getItem('faqar-notification-rules-v1');
      if (savedRules) {
        setNotificationRules(JSON.parse(savedRules));
      }

      const savedSchedules = localStorage.getItem('faqar-audit-schedules-v1');
      if (savedSchedules) {
        setAuditSchedules(JSON.parse(savedSchedules));
      }

      setPendingSync(getPendingSyncCount());
    } catch (err) {
      console.error('Failed to load application data', err);
    } finally {
      setLoading(false);
    }
  };

  // React to data changes and automatically trigger rolling 7-day backup in Google Drive
  useEffect(() => {
    let backupTimeout: any = null;
    let isCurrentlyBackingUp = false;

    const runBackgroundBackup = async (force = false) => {
      const token = localStorage.getItem('faqar-workspace-token');
      if (!token || isCurrentlyBackingUp) return;

      if (isTokenExpired()) {
        console.log('Google Workspace session expired. Skipping background auto-backup silently.');
        return;
      }

      const lastBackupStr = localStorage.getItem('faqar-auto-backup-last-timestamp');
      const lastBackupTime = lastBackupStr ? parseInt(lastBackupStr, 10) : 0;
      const now = Date.now();
      const twoHoursInMs = 2 * 60 * 60 * 1000; // 2 hours

      // If not forced and 2 hours have NOT passed, do not perform the backup
      if (!force && (now - lastBackupTime < twoHoursInMs)) {
        console.log('Skipping automatic backup. Less than 2 hours elapsed since last backup.');
        return;
      }

      isCurrentlyBackingUp = true;
      // Dispatch status event so SettingsView or other views can show the pulsing green sync indicator
      window.dispatchEvent(new CustomEvent('faqar-gdrive-sync-status', { detail: { isSyncing: true } }));

      try {
        await create7DayBackup();
        console.log('Automatic rolling 7-day backup completed in the background!');
        window.dispatchEvent(new CustomEvent('faqar-gdrive-sync-status', { detail: { isSyncing: false, error: null } }));
      } catch (err: any) {
        const errMsg = err?.message || String(err);
        const isAuthError = errMsg.includes('تسجيل الدخول') || errMsg.includes('401') || errMsg.includes('Expired') || errMsg.includes('auth');
        if (isAuthError) {
          console.warn('Automatic rolling 7-day backup skipped because Google account is not connected or token has expired.');
        } else {
          console.error('Automatic rolling 7-day backup failed:', err);
        }
        window.dispatchEvent(new CustomEvent('faqar-gdrive-sync-status', { detail: { isSyncing: false, error: errMsg } }));
      } finally {
        isCurrentlyBackingUp = false;
      }
    };

    const handleDbChange = () => {
      if (backupTimeout) clearTimeout(backupTimeout);
      // Wait for 20 seconds of inactivity after any database change before running backup (with 2-hour throttling check)
      backupTimeout = setTimeout(() => {
        runBackgroundBackup(false);
      }, 20000);
    };

    window.addEventListener('faqar-db-changed', handleDbChange);

    // Run once on application load (after 10 seconds to allow initial load to settle, subject to 2-hour throttling check)
    const initialTimeout = setTimeout(() => {
      runBackgroundBackup(false);
    }, 10000);

    // Periodic check every 5 minutes
    const periodicInterval = setInterval(() => {
      runBackgroundBackup(false);
    }, 5 * 60 * 1000);

    return () => {
      window.removeEventListener('faqar-db-changed', handleDbChange);
      if (backupTimeout) clearTimeout(backupTimeout);
      clearTimeout(initialTimeout);
      clearInterval(periodicInterval);
    };
  }, []);

  const handleLoginSuccess = (role: 'admin' | 'customer', customerId?: string) => {
    setUserRole(role);
    if (role === 'customer' && customerId) {
      setLoggedCustomerId(customerId);
    } else {
      setLoggedCustomerId(null);
    }
    setIsAuthenticated(true);
    setLoading(true);
    loadAllData();
  };

  const handleLogout = () => {
    localStorage.removeItem('faqar-session-v1');
    setLoggedCustomerId(null);
    setCustomers([]);
    setContracts([]);
    setPayments([]);

    // Check if we are in customer portal mode
    const params = new URLSearchParams(window.location.search);
    const isPortal = params.get('view') === 'portal' || params.has('phone') || params.has('code');
    if (isPortal) {
      setUserRole('customer_portal_login');
      setIsAuthenticated(false);
    } else {
      setUserRole(null);
      setIsAuthenticated(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070708] flex flex-col items-center justify-center text-zinc-400 gap-4">
        <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
        <span className="text-sm font-medium tracking-wide">جاري الاتصال بقاعدة البيانات الآمنة للفرع...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <ToastContainer />
        <CustomerPortalLogin onLoginSuccess={handleLoginSuccess} />
      </>
    );
  }

  // Router logic for Rendering correct page inside main frame container
  const renderContent = () => {
    if (userRole === 'customer') {
      return (
        <CustomerPortalView
          customerId={loggedCustomerId || ''}
          onLogout={handleLogout}
        />
      );
    }

    // If a customer is selected, show their full interactive profile
    if (selectedCustomer) {
      const activeCustomer = customers.find((c) => c.id === selectedCustomer.id) || selectedCustomer;
      return (
        <CustomerProfileView
          customer={activeCustomer}
          contracts={contracts}
          payments={payments}
          templates={templates}
          onBack={() => {
            setSelectedCustomer(null);
          }}
          onRefreshData={loadAllData}
        />
      );
    }

    // Settings subviews
    if (currentTab === 'settings' && settingsSubView !== 'none') {
      if (settingsSubView === 'recent_actions') {
        if (selectedActionForDetail) {
          return (
            <ActionDetailView
              action={selectedActionForDetail}
              onBack={() => setSelectedActionForDetail(null)}
            />
          );
        }
        return (
          <RecentActionsView
            actions={actionsLog}
            onSelectAction={(act) => setSelectedActionForDetail(act)}
            onClearLogs={() => {
              setActionsLog([]);
              localStorage.removeItem('faqar-actions-log');
            }}
            onBack={() => setSettingsSubView('none')}
          />
        );
      }
      if (settingsSubView === 'templates_settings') {
        return (
          <TemplatesSettingsView
            templates={templates}
            onBack={() => setSettingsSubView('none')}
            onRefreshData={loadAllData}
          />
        );
      }
      if (settingsSubView === 'notifications_settings') {
        return (
          <NotificationsSettingsView
            notificationRules={notificationRules}
            templates={templates}
            onBack={() => setSettingsSubView('none')}
            onRefreshData={loadAllData}
          />
        );
      }
      if (settingsSubView === 'audit_scheduler_settings') {
        return (
          <AuditScheduleView
            auditSchedules={auditSchedules}
            onBack={() => setSettingsSubView('none')}
            onRefreshData={loadAllData}
          />
        );
      }
      if (settingsSubView === 'debug_view') {
        return (
          <DebugView
            onBack={() => setSettingsSubView('none')}
            onRefreshData={loadAllData}
          />
        );
      }
    }

    // Main tabs
    switch (currentTab) {
      case 'analytics':
        return (
          <AnalyticsView
            customers={customers}
            contracts={contracts}
            payments={payments}
          />
        );
      case 'customers':
        return (
          <CustomersView
            customers={customers}
            contracts={contracts}
            payments={payments}
            onSelectCustomer={(cust) => setSelectedCustomer(cust)}
            onRefreshData={loadAllData}
          />
        );
      case 'defaulters':
        return (
          <DefaultersView
            customers={customers}
            contracts={contracts}
            payments={payments}
            templates={templates}
            onSelectCustomer={(cust) => setSelectedCustomer(cust)}
          />
        );
      case 'debts':
        return (
          <DebtsView />
        );
      case 'salafs':
        return (
          <SalafsView />
        );
      case 'settings':
        return (
          <SettingsView
            customers={customers}
            contracts={contracts}
            payments={payments}
            onNavigateTo={(view) => setSettingsSubView(view)}
            onLogout={handleLogout}
            onRefreshData={loadAllData}
          />
        );
    }
  };

  const isSheetLinked = isWorkspaceConnected && linkedSheetId === '14bhuJwwJUone0cCdGyq7CIQYHgsYpssMh1zWB5Otlig';
  const showWarning = userRole === 'admin' && isAuthenticated && !isSheetLinked;

  return (
    <div className="min-h-screen bg-[#070708] text-zinc-100 flex flex-col justify-between selection:bg-amber-500 selection:text-black">
      <ToastContainer />

      {/* 0. Persistent Google Sheet Warning Banner */}
      {showWarning && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-rose-950/95 backdrop-blur-md border-b border-rose-500/30 text-rose-200 px-4 py-2 text-xs font-bold flex flex-wrap items-center justify-between gap-2 text-right" dir="rtl">
          <div className="flex items-center gap-2">
            <span className="text-sm">⚠️</span>
            <span>تنبيه: تطبيق فقار غير متصل بملف جوجل شيتس المعتمد! اربط الحساب لتفادي فقدان البيانات.</span>
          </div>
          <button
            onClick={async () => {
              try {
                const res = await googleSignIn();
                if (res) {
                  localStorage.setItem('faqar-linked-sheet-id', '14bhuJwwJUone0cCdGyq7CIQYHgsYpssMh1zWB5Otlig');
                  setLinkedSheetId('14bhuJwwJUone0cCdGyq7CIQYHgsYpssMh1zWB5Otlig');
                  setIsWorkspaceConnected(true);
                  window.dispatchEvent(new Event('faqar-linked-sheet-id-updated'));
                  showToast('تم ربط الشيت المعتمد وتنشيط الاتصال بنجاح! 🟢', 'success');
                }
              } catch (err: any) {
                showToast(err.message || 'فشل الاتصال بجوجل', 'error');
              }
            }}
            className="h-7 px-3 bg-emerald-500 hover:bg-emerald-400 text-black rounded-lg font-black text-[10px] transition-all cursor-pointer flex items-center gap-1 shrink-0"
          >
            <span>ربط الشيت المعتمد</span>
          </button>
        </div>
      )}

      {/* 1. Fixed Top Header */}
      {userRole === 'admin' && isAuthenticated && (
        <div className={`fixed left-1/2 -translate-x-1/2 z-45 w-full max-w-[480px] md:max-w-[768px] lg:max-w-[1024px] xl:max-w-[1200px] px-5 select-none transition-all duration-300 ${showWarning ? 'top-8 pt-2' : 'top-0 pt-4'}`}>
          <div className="h-14 rounded-2xl border border-white/5 bg-black/70 backdrop-blur-xl px-4 flex items-center justify-between shadow-xl relative">
            
            {/* Left side: Financial Governance action button, Connection status & Pages Dropdown */}
            <div className="flex items-center gap-1.5">
              <button
                id="gov-action-btn"
                onClick={() => setIsGovernanceModalOpen(true)}
                title="تسجيل إجراء حوكمة مالية"
                className="w-9 h-9 flex items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 active:scale-95 transition-all cursor-pointer shadow-md"
              >
                <Scale className="w-5 h-5" />
              </button>


              {isSheetLinked && (
                <div className="flex items-center gap-1 px-2.5 h-9 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 text-[10px] font-black select-none shadow-sm animate-fade-in shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>تم الربط</span>
                </div>
              )}
            </div>

            {/* Right side: Dynamic Search Bar */}
            <div className="flex-1 max-w-[280px] relative">
              <div className="relative">
                <input
                  type="text"
                  placeholder="بحث سريع عن زبون..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSearchActive(e.target.value.trim().length > 0);
                  }}
                  onFocus={() => {
                    if (searchQuery.trim().length > 0) setSearchActive(true);
                  }}
                  className="w-full h-9 pr-9 pl-4 text-xs bg-white/[0.04] hover:bg-white/[0.06] focus:bg-white/[0.08] border border-white/5 focus:border-amber-500/30 rounded-xl text-zinc-200 placeholder-zinc-500 text-right focus:outline-none transition-all focus:ring-0"
                  dir="rtl"
                />
                <Search className="w-4 h-4 text-zinc-500 absolute right-3 top-2.5" />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSearchActive(false);
                    }}
                    className="absolute left-2.5 top-2 h-5 w-5 flex items-center justify-center rounded-md hover:bg-white/10 text-zinc-400"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Real-time Dynamic Dropdown Results */}
              {searchActive && (
                <div className="absolute top-11 right-0 w-[280px] max-h-[320px] overflow-y-auto rounded-2xl border border-white/10 bg-[#0d0d0f]/95 backdrop-blur-2xl shadow-2xl p-2 z-50 flex flex-col gap-1.5 animate-fade-in custom-scrollbar">
                  <div className="text-[10px] text-zinc-500 font-bold px-2.5 py-1 border-b border-white/5 text-right">
                    نتائج البحث السريع ({customers.filter(c => c.name.includes(searchQuery) || c.phone.includes(searchQuery)).length})
                  </div>
                  {customers.filter(c => c.name.includes(searchQuery) || c.phone.includes(searchQuery)).length === 0 ? (
                    <div className="text-xs text-zinc-600 text-center py-6">
                      لا يوجد نتائج مطابقة للبحث
                    </div>
                  ) : (
                    customers
                      .filter(c => c.name.includes(searchQuery) || c.phone.includes(searchQuery))
                      .slice(0, 10)
                      .map((cust) => {
                        return (
                          <div key={cust.id} className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-zinc-500 font-mono" dir="ltr">{cust.phone}</span>
                              <span className="text-xs font-bold text-zinc-200 text-right">{cust.name}</span>
                            </div>
                            
                            {/* Fast Actions inside each card block */}
                            <div className="flex items-center justify-end gap-1 flex-wrap" dir="rtl">
                              <button
                                onClick={() => {
                                  setSelectedCustomer(cust);
                                  setCurrentTab('customers');
                                  setSearchQuery('');
                                  setSearchActive(false);
                                }}
                                className="px-2 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-[10px] font-bold transition-all"
                              >
                                👤 الملف
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedCustomer(cust);
                                  setCurrentTab('customers');
                                  setSearchQuery('');
                                  setSearchActive(false);
                                  setTimeout(() => {
                                    window.dispatchEvent(new Event('faqar-trigger-add-contract'));
                                  }, 100);
                                }}
                                className="px-2 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[10px] font-bold transition-all"
                              >
                                📝 عقد
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedCustomer(cust);
                                  setCurrentTab('customers');
                                  setSearchQuery('');
                                  setSearchActive(false);
                                  setTimeout(() => {
                                    window.dispatchEvent(new Event('faqar-trigger-add-payment'));
                                  }, 100);
                                }}
                                className="px-2 py-1 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-[10px] font-bold transition-all"
                              >
                                💰 دفعة
                              </button>
                              <a
                                href={`https://wa.me/964${cust.phone.startsWith('0') ? cust.phone.substring(1) : cust.phone}`}
                                target="_blank"
                                rel="noreferrer"
                                className="px-2 py-1 rounded bg-zinc-500/10 hover:bg-zinc-500/20 text-zinc-400 text-[10px] font-bold transition-all flex items-center"
                              >
                                💬 واتس
                              </a>
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Main Core View Area */}
      <main className={`w-full max-w-[480px] md:max-w-[768px] lg:max-w-[1024px] xl:max-w-[1200px] mx-auto px-5 ${userRole === 'admin' && isAuthenticated ? (showWarning ? 'pt-32' : 'pt-24') : 'pt-6'} pb-28 flex-1 transition-all duration-300`}>
        {history.length > 1 && (
          <div className="flex items-center justify-between mb-5 bg-white/[0.02] border border-white/5 rounded-2xl p-2.5 animate-fade-in backdrop-blur-md">
            <button
              onClick={handleGlobalBack}
              className="flex items-center gap-2 px-3 h-9 rounded-xl bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/20 text-amber-400 text-xs font-bold transition-all active:scale-95 cursor-pointer"
            >
              <ArrowRight className="w-4 h-4" />
              <span>رجوع خطوة للوراء</span>
            </button>
            <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-bold px-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500/60 animate-pulse" />
              <span>مسار التصفح الآمن</span>
            </div>
          </div>
        )}
        {renderContent()}
      </main>

      {/* 2. Floating Action Button (FAB) */}
      {userRole === 'admin' && isAuthenticated && fabConfig.enabled && (
        <div className="fixed bottom-24 right-5 md:right-10 lg:right-[calc(50%-512px+24px)] xl:right-[calc(50%-600px+24px)] z-40 select-none transition-all duration-300">
          <div className="relative">
            {/* FAB Trigger Button */}
            <button
              onClick={() => setIsFabOpen(!isFabOpen)}
              className={`w-12 h-12 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 transform cursor-pointer ${
                isFabOpen 
                  ? 'bg-zinc-800 text-amber-400 rotate-45 border border-amber-500/30 scale-105' 
                  : 'bg-amber-500 hover:bg-amber-600 text-black hover:scale-105 active:scale-95'
              }`}
            >
              <Plus className="w-6 h-6 stroke-[2.5]" />
            </button>

            {/* Quick Actions popover list */}
            {isFabOpen && (
              <div className="absolute bottom-16 right-0 w-48 bg-[#0d0d0f]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-2 shadow-2xl flex flex-col gap-1.5 animate-fade-in" dir="rtl">
                <div className="text-[9px] text-zinc-500 font-bold px-2 py-0.5 border-b border-white/5 text-right">
                  إجراءات سريعة عملية
                </div>

                {/* Add Customer */}
                {fabConfig.addCustomer && (
                  <button
                    onClick={() => {
                      setCurrentTab('customers');
                      setSelectedCustomer(null);
                      setIsFabOpen(false);
                      setTimeout(() => {
                        window.dispatchEvent(new Event('faqar-trigger-add-customer'));
                      }, 100);
                    }}
                    className="w-full p-2.5 rounded-xl hover:bg-white/[0.04] text-right flex items-center gap-2.5 text-xs text-zinc-200 transition-all active:scale-[0.98]"
                  >
                    <div className="w-6 h-6 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
                      <UserPlus className="w-3.5 h-3.5" />
                    </div>
                    <span>إضافة زبون جديد</span>
                  </button>
                )}

                {/* Add Contract */}
                {fabConfig.addContract && (
                  <button
                    onClick={() => {
                      if (!selectedCustomer) {
                        showToast('الرجاء الانتقال لملف الزبون أولاً لإضافة عقد قسط له!', 'warning');
                        setCurrentTab('customers');
                      } else {
                        window.dispatchEvent(new Event('faqar-trigger-add-contract'));
                      }
                      setIsFabOpen(false);
                    }}
                    className="w-full p-2.5 rounded-xl hover:bg-white/[0.04] text-right flex items-center gap-2.5 text-xs text-zinc-200 transition-all active:scale-[0.98]"
                  >
                    <div className="w-6 h-6 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                      <Zap className="w-3.5 h-3.5" />
                    </div>
                    <span>إنشاء عقد قسط</span>
                  </button>
                )}

                {/* Add Payment */}
                {fabConfig.addPayment && (
                  <button
                    onClick={() => {
                      if (!selectedCustomer) {
                        showToast('الرجاء الانتقال لملف الزبون أولاً لتسجيل دفعة مالية له!', 'warning');
                        setCurrentTab('customers');
                      } else {
                        window.dispatchEvent(new Event('faqar-trigger-add-payment'));
                      }
                      setIsFabOpen(false);
                    }}
                    className="w-full p-2.5 rounded-xl hover:bg-white/[0.04] text-right flex items-center gap-2.5 text-xs text-zinc-200 transition-all active:scale-[0.98]"
                  >
                    <div className="w-6 h-6 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
                      <Coins className="w-3.5 h-3.5" />
                    </div>
                    <span>تسجيل دفعة مالية</span>
                  </button>
                )}

                {/* Add Debt */}
                {fabConfig.addDebt && (
                  <button
                    onClick={() => {
                      setCurrentTab('debts');
                      setIsFabOpen(false);
                      setTimeout(() => {
                        window.dispatchEvent(new Event('faqar-trigger-add-debt'));
                      }, 100);
                    }}
                    className="w-full p-2.5 rounded-xl hover:bg-white/[0.04] text-right flex items-center gap-2.5 text-xs text-zinc-200 transition-all active:scale-[0.98]"
                  >
                    <div className="w-6 h-6 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-400">
                      <AlertTriangle className="w-3.5 h-3.5" />
                    </div>
                    <span>تسجيل دين جديد</span>
                  </button>
                )}

                {/* Add Salaf */}
                {fabConfig.addSalaf && (
                  <button
                    onClick={() => {
                      setCurrentTab('salafs');
                      setIsFabOpen(false);
                      setTimeout(() => {
                        window.dispatchEvent(new Event('faqar-trigger-add-salaf'));
                      }, 100);
                    }}
                    className="w-full p-2.5 rounded-xl hover:bg-white/[0.04] text-right flex items-center gap-2.5 text-xs text-zinc-200 transition-all active:scale-[0.98]"
                  >
                    <div className="w-6 h-6 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400">
                      <PiggyBank className="w-3.5 h-3.5" />
                    </div>
                    <span>إضافة سلفة جديدة</span>
                  </button>
                )}

                {/* Add Audit */}
                {fabConfig.addAudit && (
                  <button
                    onClick={() => {
                      setIsGovernanceModalOpen(true);
                      setIsFabOpen(false);
                    }}
                    className="w-full p-2.5 rounded-xl hover:bg-white/[0.04] text-right flex items-center gap-2.5 text-xs text-zinc-200 transition-all active:scale-[0.98]"
                  >
                    <div className="w-6 h-6 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400">
                      <Scale className="w-3.5 h-3.5" />
                    </div>
                    <span>جدولة جرد ورقابة</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. Smart Financial Governance Pop-up Modal */}
      {isGovernanceModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-xl z-55 flex items-center justify-center p-4">
          <div className="bg-[#0c0c0e] border border-white/10 rounded-[32px] w-full max-w-[420px] max-h-[90vh] overflow-y-auto p-6 shadow-2xl flex flex-col gap-5 animate-scale-up" dir="rtl">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <button
                onClick={() => setIsGovernanceModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-zinc-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Scale className="w-5 h-5 text-amber-500" />
                <span>تسجيل إجراء حوكمة مالية ذكي ⚖️</span>
              </h2>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className="text-[10px] font-bold text-zinc-400 block mb-1.5 text-right">اسم إجراء الرقابة / الجرد المالي</label>
                <input
                  type="text"
                  value={govName}
                  onChange={(e) => setGovName(e.target.value)}
                  placeholder="مثال: جرد صندوق الفرع اليومي"
                  className="w-full h-11 px-4 text-xs bg-white/[0.02] border border-white/5 rounded-xl text-zinc-200 text-right focus:outline-none focus:border-amber-500/30 transition-all"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-400 block mb-1.5 text-right">تعبير الجدولة الزمنية (Cron Expression)</label>
                <input
                  type="text"
                  value={govCron}
                  onChange={(e) => setGovCron(e.target.value)}
                  placeholder="0 20 * * *"
                  className="w-full h-11 px-4 text-xs bg-white/[0.02] border border-white/5 rounded-xl text-zinc-200 text-right focus:outline-none focus:border-amber-500/30 transition-all font-mono"
                  dir="ltr"
                />
                <span className="text-[9px] text-zinc-500 block mt-1 text-right text-right">0 20 * * * تعني الجرد التلقائي يومياً الساعة 8 مساءً</span>
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-400 block mb-2 text-right">المتغيرات الذكية المدرجة في التقارير (اختر منها):</label>
                <div className="border border-white/5 rounded-2xl bg-black/20 p-3 max-h-[180px] overflow-y-auto flex flex-col gap-2 custom-scrollbar">
                  {[
                    { token: 'branch_name', label: '🏪 اسم الفرع واللوحة' },
                    { token: 'total_customers', label: '👥 إجمالي عدد الزبائن' },
                    { token: 'total_contracts', label: '📝 إجمالي العقود المسجلة' },
                    { token: 'total_debts', label: '🔴 إجمالي المبالغ المستحقة بالصندوق' },
                    { token: 'total_paid', label: '💰 إجمالي المقبوضات النقدية' },
                    { token: 'outstanding_amount', label: '⚠️ إجمالي الأقساط المتأخرة حالياً' },
                    { token: 'defaulters_count', label: '📉 عدد الزبائن المتلكئين بالدفع' },
                    { token: 'avg_lateness', label: '📅 متوسط أيام التأخير للزبائن' },
                    { token: 'total_profit_expected', label: '📈 إجمالي الأرباح المتوقعة' },
                    { token: 'active_contracts_count', label: '⚡ عدد العقود النشطة والجارية' },
                    { token: 'completed_contracts_count', label: '✅ عدد العقود المغلقة والمكتملة' },
                    { token: 'system_status', label: '🛡️ الحالة التشغيلية والأمان' }
                  ].map((item) => (
                    <label key={item.token} className="flex items-center justify-between p-2 rounded-lg hover:bg-white/[0.02] cursor-pointer transition-all">
                      <input
                        type="checkbox"
                        checked={govTokens.includes(item.token)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setGovTokens([...govTokens, item.token]);
                          } else {
                            setGovTokens(govTokens.filter(t => t !== item.token));
                          }
                        }}
                        className="w-4 h-4 rounded border-zinc-800 text-amber-500 bg-[#18181b] focus:ring-0 cursor-pointer"
                      />
                      <span className="text-xs text-zinc-300">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={handleSaveGovernanceAction}
              className="w-full h-11 mt-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98] cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>حفظ وجدولة إجراء الرقابة المالية ⚖️</span>
            </button>
          </div>
        </div>
      )}

      {/* Modern Fixed Floating Navigation Bar */}
      {userRole === 'admin' && (
        <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-full max-w-[420px] md:max-w-[600px] lg:max-w-[720px] px-4 select-none transition-all duration-300">
        <div className="h-16 rounded-[28px] border border-white/5 bg-black/60 backdrop-blur-2xl px-6 flex items-center justify-between shadow-2xl relative">
          
          {/* Glass overlay highlight glow */}
          <div className="absolute inset-0 bg-gradient-to-t from-white/[0.02] to-transparent pointer-events-none rounded-[28px]" />

          {/* Tab 1: Analytics */}
          <button
            onClick={() => {
              setSelectedCustomer(null);
              setSettingsSubView('none');
              setCurrentTab('analytics');
            }}
            className={`flex flex-col items-center gap-1 transition-all cursor-pointer ${
              currentTab === 'analytics' && !selectedCustomer
                ? 'text-amber-500 scale-105'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <LayoutGrid className="w-5 h-5 stroke-[2.2]" />
            <span className="text-[10px] font-bold">الجرد</span>
          </button>

          {/* Tab 2: Customers */}
          <button
            onClick={() => {
              setSelectedCustomer(null);
              setSettingsSubView('none');
              setCurrentTab('customers');
            }}
            className={`flex flex-col items-center gap-1 transition-all cursor-pointer ${
              currentTab === 'customers' || selectedCustomer
                ? 'text-amber-500 scale-105'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Users className="w-5 h-5 stroke-[2.2]" />
            <span className="text-[10px] font-bold">الزبائن</span>
          </button>

          {/* Tab 3: Defaulters */}
          <button
            onClick={() => {
              setSelectedCustomer(null);
              setSettingsSubView('none');
              setCurrentTab('defaulters');
            }}
            className={`flex flex-col items-center gap-1 transition-all cursor-pointer ${
              currentTab === 'defaulters' && !selectedCustomer
                ? 'text-amber-500 scale-105'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <div className="relative">
              <AlertTriangle className="w-5 h-5 stroke-[2.2]" />
              {customers.some((c) => {
                const custContracts = contracts.filter((co) => co.customerId === c.id);
                return custContracts.some((co) => {
                  const now = new Date();
                  const dueDay = co.dueDay;
                  const monthDay = now.getDate();
                  return monthDay > dueDay; // naive late check for badge
                });
              })}
            </div>
            <span className="text-[10px] font-bold">المتأخرين</span>
          </button>

          {/* Tab 4: Debts */}
          <button
            onClick={() => {
              setSelectedCustomer(null);
              setSettingsSubView('none');
              setCurrentTab('debts');
            }}
            className={`flex flex-col items-center gap-1 transition-all cursor-pointer ${
              currentTab === 'debts' && !selectedCustomer
                ? 'text-amber-500 scale-105'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <CircleDollarSign className="w-5 h-5 stroke-[2.2]" />
            <span className="text-[10px] font-bold">الديون</span>
          </button>

          {/* Tab 5: Salafs */}
          <button
            onClick={() => {
              setSelectedCustomer(null);
              setSettingsSubView('none');
              setCurrentTab('salafs');
            }}
            className={`flex flex-col items-center gap-1 transition-all cursor-pointer ${
              currentTab === 'salafs' && !selectedCustomer
                ? 'text-amber-500 scale-105'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <PiggyBank className="w-5 h-5 stroke-[2.2]" />
            <span className="text-[10px] font-bold">السلف</span>
          </button>

          {/* Tab 5: Settings */}
          <button
            onClick={() => {
              setSelectedCustomer(null);
              setSettingsSubView('none');
              setCurrentTab('settings');
            }}
            className={`flex flex-col items-center gap-1 transition-all cursor-pointer relative ${
              currentTab === 'settings' && !selectedCustomer
                ? 'text-amber-500 scale-105'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Settings className="w-5 h-5 stroke-[2.2]" />
            {pendingSync > 0 && (
              <span className="absolute -top-1 -right-2 bg-amber-500 text-black text-[9px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center animate-pulse border border-black">
                {pendingSync}
              </span>
            )}
            <span className="text-[10px] font-bold">الإعدادات</span>
          </button>

        </div>
      </nav>
      )}
    </div>
  );
}
