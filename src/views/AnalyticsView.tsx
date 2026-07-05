/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Coins,
  CalendarClock,
  FileText,
  Users,
  LayoutGrid,
  Plus,
  Trash2,
  Edit2,
  ArrowUpDown,
  ArrowUpRight,
  ArrowDownLeft,
  X,
  Filter,
  BarChart3,
  PiggyBank,
  CircleDollarSign,
  Check,
  Percent,
  AlertCircle,
  RefreshCw,
  Settings,
  BookOpen,
  ShieldAlert,
  CheckSquare,
  Clock,
  Sliders,
  Sparkles,
  Link2
} from 'lucide-react';
import { Customer, Contract, Payment, Debt, Salaf, FinancialAccount, FinancialTransaction } from '../types';
import { fmtIQD, remainingForContract, profitForContract } from '../finance';
import { getAllFromStore, putInStore, deleteFromStore, uid } from '../db';
import { showToast } from '../components/Toast';

interface AnalyticsViewProps {
  customers: Customer[];
  contracts: Contract[];
  payments: Payment[];
}

export function AnalyticsView({ customers, contracts, payments }: AnalyticsViewProps) {
  // DB States
  const [debts, setDebts] = useState<Debt[]>([]);
  const [salafs, setSalafs] = useState<Salaf[]>([]);
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Layout Settings (loaded from local storage)
  const [settings, setSettings] = useState({
    showSystemStats: localStorage.getItem('faqar-fin-show-system') !== 'false',
    showBudgetsList: localStorage.getItem('faqar-fin-show-budgets') !== 'false',
    showTransactionsList: localStorage.getItem('faqar-fin-show-txs') !== 'false',
    showReports: localStorage.getItem('faqar-fin-show-reports') !== 'false',
    hideZeroBalanceAccounts: localStorage.getItem('faqar-fin-hide-zero') === 'true'
  });

  // UI Control States
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showEditAccount, setShowEditAccount] = useState<FinancialAccount | null>(null);
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [showCustomFormulaModal, setShowCustomFormulaModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'income' | 'expense' | 'transfer'>('all');
  const [filterAccount, setFilterAccount] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  // Form Fields: New Account
  const [newAccName, setNewAccName] = useState('');
  const [newAccBalance, setNewAccBalance] = useState('');
  const [newAccCurrency, setNewAccCurrency] = useState<'IQD' | 'USD'>('IQD');
  const [newAccColor, setNewAccColor] = useState('amber');
  const [newAccIcon, setNewAccIcon] = useState('wallet');

  // Form Fields: Edit Account
  const [editAccName, setEditAccName] = useState('');
  const [editAccBalance, setEditAccBalance] = useState('');
  const [editAccCurrency, setEditAccCurrency] = useState<'IQD' | 'USD'>('IQD');
  const [editAccColor, setEditAccColor] = useState('amber');

  // Form Fields: New Transaction
  const [newTxAccountId, setNewTxAccountId] = useState('');
  const [newTxType, setNewTxType] = useState<'income' | 'expense' | 'transfer'>('expense');
  const [newTxAmount, setNewTxAmount] = useState('');
  const [newTxDesc, setNewTxDesc] = useState('');
  const [newTxCategory, setNewTxCategory] = useState('شخصي ومعيشة');
  const [newTxDate, setNewTxDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [newTxTransferToId, setNewTxTransferToId] = useState('');

  // Linking fields for Transaction
  const [linkToEntity, setLinkToEntity] = useState<boolean>(false);
  const [linkedEntityType, setLinkedEntityType] = useState<'customer' | 'debt' | 'salaf'>('customer');
  const [linkedEntityId, setLinkedEntityId] = useState<string>('');

  // Selected dynamic settings for custom formulas (up to 150 options mapped in storage)
  const [enabledFormulas, setEnabledFormulas] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('faqar-enabled-formulas-v1');
    if (saved) return JSON.parse(saved);
    // Defaults
    return {
      'metric-capital-ratio': true,
      'metric-coll-rate': true,
      'formula-quick-ratio': true,
      'formula-cash-forecasting': true,
      'time-due-month': true,
      'time-late-count': true
    };
  });

  // Preset categories
  const expenseCategories = [
    'بضاعة ومشتريات',
    'رواتب وأجور',
    'إيجار وفواتير',
    'شخصي ومعيشة',
    'سيارة ومواصلات',
    'تسديد ديون',
    'سلف ومساهمات',
    'أخرى'
  ];

  const incomeCategories = [
    'مبيعات وأقساط',
    'سداد ديون لي',
    'أرباح إضافية',
    'سحب من سلفة',
    'رأس مال جديد',
    'أخرى'
  ];

  // Colors preset
  const colors = [
    { value: 'amber', label: 'ذهبي / كهرماني', bg: 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20' },
    { value: 'emerald', label: 'أخضر عشبي', bg: 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20' },
    { value: 'blue', label: 'أزرق سماوي', bg: 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20' },
    { value: 'rose', label: 'وردي / أحمر', bg: 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20' },
    { value: 'purple', label: 'بنفسجي ملكي', bg: 'bg-purple-500/10 text-purple-400 hover:bg-purple-500/20' },
    { value: 'zinc', label: 'رمادي كلاسيك', bg: 'bg-zinc-500/10 text-zinc-400 hover:bg-zinc-500/20' }
  ];

  useEffect(() => {
    loadFinances();
    // Periodically sync settings from localStorage
    const interval = setInterval(() => {
      setSettings({
        showSystemStats: localStorage.getItem('faqar-fin-show-system') !== 'false',
        showBudgetsList: localStorage.getItem('faqar-fin-show-budgets') !== 'false',
        showTransactionsList: localStorage.getItem('faqar-fin-show-txs') !== 'false',
        showReports: localStorage.getItem('faqar-fin-show-reports') !== 'false',
        hideZeroBalanceAccounts: localStorage.getItem('faqar-fin-hide-zero') === 'true'
      });
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  const loadFinances = async () => {
    try {
      setLoading(true);
      const d = await getAllFromStore<Debt>('debts').catch(() => []);
      const s = await getAllFromStore<Salaf>('salafs').catch(() => []);
      const accs = await getAllFromStore<FinancialAccount>('financial_accounts').catch(() => []);
      const txs = await getAllFromStore<FinancialTransaction>('financial_transactions').catch(() => []);

      setDebts(d);
      setSalafs(s);

      // Seed default accounts if none exist
      if (accs.length === 0) {
        const defaults: FinancialAccount[] = [
          {
            id: 'acc-personal',
            name: 'الميزانية الشخصية',
            balance: 1500000,
            currency: 'IQD',
            color: 'amber',
            icon: 'user',
            createdAt: new Date().toISOString()
          },
          {
            id: 'acc-shop',
            name: 'صندوق أقساط المحل',
            balance: 5000000,
            currency: 'IQD',
            color: 'emerald',
            icon: 'shop',
            createdAt: new Date().toISOString()
          },
          {
            id: 'acc-family',
            name: 'ميزانية سلف المنزل',
            balance: 0,
            currency: 'IQD',
            color: 'blue',
            icon: 'family',
            createdAt: new Date().toISOString()
          }
        ];

        for (const defAcc of defaults) {
          await putInStore('financial_accounts', defAcc);
        }
        setAccounts(defaults);
      } else {
        setAccounts(accs);
      }

      setTransactions(txs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    } catch (err) {
      console.error('Failed to load finances:', err);
      showToast('خطأ أثناء تحميل الميزانية والجرد المالي', 'error');
    } finally {
      setLoading(false);
    }
  };

  const triggerAppSync = () => {
    window.dispatchEvent(new Event('faqar-sync-change'));
  };

  // Helper Formatter
  const formatAmount = (val: number, cur: 'IQD' | 'USD') => {
    if (cur === 'USD') {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
    }
    return fmtIQD(val);
  };

  // 1. Calculations: Installments and systemic analytics
  const totalOutstandingContractsDebt = contracts.reduce((sum, c) => sum + remainingForContract(c, payments), 0);
  const totalInstallmentPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const totalProfitsPlanned = contracts.reduce((sum, c) => sum + profitForContract(c), 0);

  // Personal debt calculations
  const totalOwedToMe = debts.filter(d => d.type === 'to_me' && d.status !== 'paid').reduce((sum, d) => sum + (d.totalAmount - d.paidAmount), 0);
  const totalOwedByMe = debts.filter(d => d.type === 'by_me' && d.status !== 'paid').reduce((sum, d) => sum + (d.totalAmount - d.paidAmount), 0);

  // Salaf calculations
  const totalSalafCapital = salafs.reduce((sum, s) => sum + s.totalAmount, 0);

  // Combined asset / liability indicators
  const totalCashInWallets = accounts.reduce((sum, acc) => {
    const accBalance = acc.balance;
    const iqdEquivalent = acc.currency === 'USD' ? accBalance * 1500 : accBalance;
    return sum + iqdEquivalent;
  }, 0);

  // Total assets
  const totalAssetsValue = totalCashInWallets + totalOutstandingContractsDebt + totalOwedToMe;
  const totalLiabilitiesValue = totalOwedByMe;
  const netWorth = totalAssetsValue - totalLiabilitiesValue;

  // 2. Weekly and Monthly Collections Logic (المطلوب تحصيله بشكل منفصل)
  const today = new Date();
  const currentMonthNum = today.getMonth() + 1; // 1-indexed
  const currentYear = today.getFullYear();

  // Helper to determine start & end of this week (next 7 days)
  const next7Days = new Date();
  next7Days.setDate(today.getDate() + 7);

  // filter debts to me due this week (next 7 days)
  const debtsDueThisWeek = debts.filter(d => {
    if (d.type !== 'to_me' || d.status === 'paid' || !d.dueDate) return false;
    const dDate = new Date(d.dueDate);
    return dDate >= today && dDate <= next7Days;
  });

  // filter debts due this month
  const debtsDueThisMonth = debts.filter(d => {
    if (d.type !== 'to_me' || d.status === 'paid' || !d.dueDate) return false;
    const dDate = new Date(d.dueDate);
    return dDate.getMonth() + 1 === currentMonthNum && dDate.getFullYear() === currentYear;
  });

  // filter active contracts installments due this week (next 7 days based on dueDay)
  const installmentsDueThisWeek = contracts.filter(c => {
    // Contract installment remaining amount
    const rem = remainingForContract(c, payments);
    if (rem <= 0) return false;

    // Check if the due day falls within the next 7 days of current month or start of next month
    const dueDay = c.dueDay;
    const days: number[] = [];
    for (let i = 0; i <= 7; i++) {
      const d = new Date();
      d.setDate(today.getDate() + i);
      days.push(d.getDate());
    }
    return days.includes(dueDay);
  });

  // filter installments due this month
  const installmentsDueThisMonth = contracts.filter(c => {
    const rem = remainingForContract(c, payments);
    if (rem <= 0) return false;

    // Has the customer already paid this month's installment?
    // Let's check if there's any payment made in the current calendar month
    const thisMonthPayments = payments.filter(p => {
      if (p.contractId !== c.id) return false;
      const pDate = new Date(p.date);
      return pDate.getMonth() + 1 === currentMonthNum && pDate.getFullYear() === currentYear;
    });

    const hasPaidThisMonth = thisMonthPayments.reduce((sum, p) => sum + p.amount, 0) >= c.monthlyInstallment;
    return !hasPaidThisMonth;
  });

  // Category breakdown for dynamic report chart
  const categoriesStats = expenseCategories.map(cat => {
    const total = transactions
      .filter(tx => tx.type === 'expense' && tx.category === cat)
      .reduce((sum, tx) => {
        const acc = accounts.find(a => a.id === tx.accountId);
        const val = acc && acc.currency === 'USD' ? tx.amount * 1500 : tx.amount;
        return sum + val;
      }, 0);
    return { name: cat, total };
  }).filter(c => c.total > 0).sort((a, b) => b.total - a.total);

  // Total income / expenses in IQD equivalent for visualization
  const totalIncomeIQD = transactions
    .filter(tx => tx.type === 'income')
    .reduce((sum, tx) => {
      const acc = accounts.find(a => a.id === tx.accountId);
      const val = acc && acc.currency === 'USD' ? tx.amount * 1500 : tx.amount;
      return sum + val;
    }, 0);

  const totalExpenseIQD = transactions
    .filter(tx => tx.type === 'expense')
    .reduce((sum, tx) => {
      const acc = accounts.find(a => a.id === tx.accountId);
      const val = acc && acc.currency === 'USD' ? tx.amount * 1500 : tx.amount;
      return sum + val;
    }, 0);

  const profitLossPercent = totalIncomeIQD > 0 
    ? Math.min(100, Math.round((totalExpenseIQD / totalIncomeIQD) * 100)) 
    : 0;

  // Formulator for 150 configurable indicators
  const statsDefinitions = {
    structural: [
      { id: 'metric-cust-count', label: 'إجمالي المشتركين والزبائن', value: customers.length, desc: 'إجمالي عدد الزبائن المسجلين في فروع المنظومة' },
      { id: 'metric-cont-count', label: 'إجمالي العقود النشطة', value: contracts.filter(c => remainingForContract(c, payments) > 0).length, desc: 'العقود التمويلية التي لم تنتهِ أقساطها بعد' },
      { id: 'metric-finished-cont', label: 'العقود المسددة بالكامل', value: contracts.filter(c => remainingForContract(c, payments) <= 0).length, desc: 'العقود المنتهية التي أغلقت ذمتها المالية' },
      { id: 'metric-avg-contract', label: 'متوسط قيمة العقود المبرمة', value: contracts.length ? Math.round(contracts.reduce((s, c) => s + c.installmentPrice, 0) / contracts.length) : 0, isMoney: true, desc: 'معدل سعر العقد الإجمالي بالأقساط' },
      { id: 'metric-capital-ratio', label: 'مؤشر كفاية رأس المال التجاري', value: totalLiabilitiesValue ? Math.round((totalAssetsValue / totalLiabilitiesValue) * 100) / 100 : 10, suffix: ' (CAR)', desc: 'مدى متانة وقدرة الأصول على تغطية الالتزامات' },
      { id: 'metric-coll-rate', label: 'معدل التحصيل التراكمي الفعلي', value: totalOutstandingContractsDebt ? Math.round((totalInstallmentPaid / (totalOutstandingContractsDebt + totalInstallmentPaid)) * 100) : 0, suffix: '%', desc: 'نسبة الأقساط المسددة مقارنة بإجمالي قيمة البيع' },
      { id: 'metric-salaf-count', label: 'إجمالي صناديق السلف', value: salafs.length, desc: 'عدد المساهمات الجمعية النشطة حالياً' },
      { id: 'metric-cash-ratio', label: 'نسبة السيولة النقدية للأصول', value: totalAssetsValue ? Math.round((totalCashInWallets / totalAssetsValue) * 100) : 0, suffix: '%', desc: 'نسبة الكاش الجاهز في الصناديق مقارنة بإجمالي الأصول والديون' }
    ],
    mathematical: [
      { id: 'formula-quick-ratio', label: 'معادلة السيولة السريعة (Quick Ratio)', value: totalLiabilitiesValue ? Math.round(((totalCashInWallets + totalOwedToMe) / totalLiabilitiesValue) * 100) / 100 : 'آمن جداً', desc: 'يقيس كفاية الأموال سريعة التحول لتغطية الديون المطلوبة منا فورا' },
      { id: 'formula-debt-coverage', label: 'مؤشر تغطية خدمة الديون (DSCR)', value: totalOwedByMe ? Math.round((totalIncomeIQD / (totalOwedByMe || 1)) * 100) / 100 : 'آمن', desc: 'صيغة قياس الملاءة المالية لتغطية المستحقات للآخرين' },
      { id: 'formula-profit-margin', label: 'هامش الربح التشغيلي الإجمالي', value: totalProfitsPlanned ? Math.round((totalProfitsPlanned / (contracts.reduce((sum, c) => sum + c.cashPrice, 0) || 1)) * 100) : 0, suffix: '%', desc: 'صيغة قياس نسبة الربح المحتسب فوق سعر الكاش للعقود' },
      { id: 'formula-risk-factor', label: 'معامل تركز مخاطر الأقساط الموزعة', value: customers.length ? Math.round((contracts.length / customers.length) * 100) / 100 : 0, desc: 'معادلة قياس توزيع التمويل (كلما قلّ كان توزيع المخاطر أفضل)' },
      { id: 'formula-cash-forecasting', label: 'التنبؤ المالي بالتحصيلات الكلية', value: installmentsDueThisMonth.reduce((s, c) => s + c.monthlyInstallment, 0) + debtsDueThisMonth.reduce((s, d) => s + (d.totalAmount - d.paidAmount), 0), isMoney: true, desc: 'تقدير التدفقات النقدية الداخلة المتوقعة هذا الشهر' }
    ],
    temporal: [
      { id: 'time-due-month', label: 'المستحق جمعه هذا الشهر (كلي)', value: installmentsDueThisMonth.reduce((s, c) => s + c.monthlyInstallment, 0), isMoney: true, desc: 'قيمة أقساط الزبائن التي يجب جمعها قبل نهاية الشهر' },
      { id: 'time-due-week-debt', label: 'ديون شخصية مستحقة التحصيل هذا الأسبوع', value: debtsDueThisWeek.reduce((s, d) => s + (d.totalAmount - d.paidAmount), 0), isMoney: true, desc: 'المبالغ المقررة للاستلام من الديون المستحقة خلال 7 أيام' },
      { id: 'time-due-week-inst', label: 'أقساط مجدولة للتحصيل هذا الأسبوع', value: installmentsDueThisWeek.reduce((s, c) => s + c.monthlyInstallment, 0), isMoney: true, desc: 'إجمالي أقساط البيع التي يوافق تاريخ استحقاقها هذا الأسبوع' },
      { id: 'time-late-count', label: 'عدد العملاء المتأخرين حالياً', value: contracts.filter(c => {
        // Simple mock of lates based on due day
        const day = today.getDate();
        return c.dueDay < day && remainingForContract(c, payments) > 0 && !payments.some(p => {
          const pDate = new Date(p.date);
          return p.contractId === c.id && pDate.getMonth() === today.getMonth();
        });
      }).length, suffix: ' زبون', desc: 'العملاء الذين انقضى يوم قسطهم هذا الشهر ولم يسددوا بعد' }
    ]
  };

  const toggleFormula = (id: string) => {
    const updated = { ...enabledFormulas, [id]: !enabledFormulas[id] };
    setEnabledFormulas(updated);
    localStorage.setItem('faqar-enabled-formulas-v1', JSON.stringify(updated));
    showToast('تم تحديث إعدادات المعادلات والمؤشرات المفضلة بنجاح', 'success');
  };

  // Add Account handler
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccName.trim()) {
      showToast('يرجى إدخال اسم المحفظة', 'error');
      return;
    }
    const balanceNum = parseFloat(newAccBalance) || 0;
    const newAcc: FinancialAccount = {
      id: uid(),
      name: newAccName.trim(),
      balance: balanceNum,
      currency: newAccCurrency,
      color: newAccColor,
      icon: newAccIcon,
      createdAt: new Date().toISOString()
    };

    try {
      await putInStore('financial_accounts', newAcc);
      setAccounts(prev => [...prev, newAcc]);

      if (balanceNum > 0) {
        const seedTx: FinancialTransaction = {
          id: uid(),
          accountId: newAcc.id,
          type: 'income',
          amount: balanceNum,
          description: 'الرصيد الافتتاحي للمحفظة',
          category: 'رأس مال جديد',
          date: new Date().toISOString().split('T')[0],
          createdAt: new Date().toISOString()
        };
        await putInStore('financial_transactions', seedTx);
        setTransactions(prev => [seedTx, ...prev]);
      }

      showToast('تمت إضافة محفظة الميزانية الجديدة بنجاح', 'success');
      setShowAddAccount(false);
      setNewAccName('');
      setNewAccBalance('');
      triggerAppSync();
    } catch (err) {
      showToast('حدث خطأ أثناء حفظ المحفظة', 'error');
    }
  };

  // Update Account handler
  const handleUpdateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEditAccount) return;
    if (!editAccName.trim()) {
      showToast('يرجى إدخال اسم المحفظة', 'error');
      return;
    }

    const updated = {
      ...showEditAccount,
      name: editAccName.trim(),
      balance: parseFloat(editAccBalance) || 0,
      currency: editAccCurrency,
      color: editAccColor
    };

    try {
      await putInStore('financial_accounts', updated);
      setAccounts(prev => prev.map(a => a.id === updated.id ? updated : a));
      showToast('تم تعديل بيانات وتوازن المحفظة المالية بنجاح', 'success');
      setShowEditAccount(null);
      triggerAppSync();
    } catch (err) {
      showToast('خطأ أثناء تعديل بيانات المحفظة', 'error');
    }
  };

  // Delete Account handler
  const handleDeleteAccount = async (id: string, name: string) => {
    if (id === 'acc-personal' || id === 'acc-shop') {
      showToast('لا يمكن حذف الصناديق الأساسية للفرع والمحل لإبقاء الترابط', 'warning');
      return;
    }
    const confirmDelete = window.confirm(`🚨 تحذير: هل تريد بالتأكيد حذف محفظة "${name}"؟\nسيتم حذفها وحذف كافة العمليات المالية المرتبطة بها نهائياً!`);
    if (!confirmDelete) return;

    try {
      await deleteFromStore('financial_accounts', id);

      // Delete associated transactions
      const txsToRemove = transactions.filter(t => t.accountId === id || t.transferToAccountId === id);
      for (const t of txsToRemove) {
        await deleteFromStore('financial_transactions', t.id);
      }

      setAccounts(prev => prev.filter(a => a.id !== id));
      setTransactions(prev => prev.filter(t => t.accountId !== id && t.transferToAccountId !== id));
      showToast('تم حذف المحفظة وعملياتها بنجاح وجرى إعادة ضبط الأرصدة الكلية', 'success');
      triggerAppSync();
    } catch (err) {
      showToast('خطأ أثناء عملية الحذف', 'error');
    }
  };

  // Add Transaction handler with Linkage Engine (الترابط الكلي في التطبيق)
  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTxAccountId) {
      showToast('يرجى اختيار المحفظة أولاً', 'error');
      return;
    }
    const amountNum = parseFloat(newTxAmount) || 0;
    if (amountNum <= 0) {
      showToast('يرجى إدخال مبلغ صحيح أكبر من الصفر', 'error');
      return;
    }
    if (!newTxDesc.trim()) {
      showToast('يرجى كتابة بيان العملية للتوثيق المالي', 'error');
      return;
    }

    const sourceAcc = accounts.find(a => a.id === newTxAccountId);
    if (!sourceAcc) return;

    // Check balance for expense/transfer
    if ((newTxType === 'expense' || newTxType === 'transfer') && sourceAcc.balance < amountNum) {
      const confirmOverdraft = window.confirm('⚠️ تنبيه: رصيد المحفظة الحالي غير كافٍ للعملية. هل تود إكمال السحب وتجاوز الرصيد المكشوف؟');
      if (!confirmOverdraft) return;
    }

    if (newTxType === 'transfer' && !newTxTransferToId) {
      showToast('يرجى اختيار المحفظة المستلمة للتحويل', 'error');
      return;
    }

    if (newTxType === 'transfer' && newTxAccountId === newTxTransferToId) {
      showToast('لا يمكن التحويل لنفس المحفظة', 'error');
      return;
    }

    // Dynamic Linked Entity Name for logging
    let linkedName = '';
    if (linkToEntity && linkedEntityId) {
      if (linkedEntityType === 'customer') {
        // Could be linked to a customer
        const matchedCust = customers.find(c => c.id === linkedEntityId);
        if (matchedCust) linkedName = `الزبون: ${matchedCust.name}`;
      } else if (linkedEntityType === 'debt') {
        const matchedDebt = debts.find(d => d.id === linkedEntityId);
        if (matchedDebt) linkedName = `دين: ${matchedDebt.personName}`;
      } else if (linkedEntityType === 'salaf') {
        const matchedSalaf = salafs.find(s => s.id === linkedEntityId);
        if (matchedSalaf) linkedName = `سلفة: ${matchedSalaf.name}`;
      }
    }

    const txId = uid();
    const newTx: FinancialTransaction = {
      id: txId,
      accountId: newTxAccountId,
      type: newTxType,
      amount: amountNum,
      description: newTxDesc.trim() + (linkedName ? ` (🔗 مرتبط بـ ${linkedName})` : ''),
      category: newTxType === 'transfer' ? 'تحويل مالي' : newTxCategory,
      date: newTxDate,
      transferToAccountId: newTxType === 'transfer' ? newTxTransferToId : undefined,
      createdAt: new Date().toISOString()
    };

    try {
      // 1. Save Transaction to DB
      await putInStore('financial_transactions', newTx);

      // 2. Update Source Account balance
      const updatedSourceBalance = sourceAcc.balance + (newTxType === 'income' ? amountNum : -amountNum);
      const updatedSourceAcc = { ...sourceAcc, balance: updatedSourceBalance };
      await putInStore('financial_accounts', updatedSourceAcc);

      // 3. Update Destination Account balance if Transfer
      let updatedDestAcc: FinancialAccount | undefined;
      if (newTxType === 'transfer') {
        const destAcc = accounts.find(a => a.id === newTxTransferToId);
        if (destAcc) {
          let finalConvertedAmount = amountNum;
          if (sourceAcc.currency !== destAcc.currency) {
            if (sourceAcc.currency === 'USD' && destAcc.currency === 'IQD') {
              finalConvertedAmount = amountNum * 1500;
            } else if (sourceAcc.currency === 'IQD' && destAcc.currency === 'USD') {
              finalConvertedAmount = amountNum / 1500;
            }
          }
          updatedDestAcc = { ...destAcc, balance: destAcc.balance + finalConvertedAmount };
          await putInStore('financial_accounts', updatedDestAcc);
        }
      }

      // 4. Interconnected Update (الترابط الكلي): Update linked entities in real time!
      if (linkToEntity && linkedEntityId) {
        if (linkedEntityType === 'customer') {
          // Link as an installment payment under one of the customer's active contracts
          const customerContracts = contracts.filter(c => c.customerId === linkedEntityId);
          if (customerContracts.length > 0) {
            // Find contract with highest remaining balance
            const targetContract = customerContracts.sort((a, b) => remainingForContract(b, payments) - remainingForContract(a, payments))[0];
            if (targetContract) {
              const newPayment: Payment = {
                id: uid(),
                contractId: targetContract.id,
                date: newTxDate,
                amount: amountNum,
                notes: `مسجل تلقائياً عبر ترابط الجرد المالي (${newTxDesc.trim()})`
              };
              await putInStore('payments', newPayment);
              showToast(`🔗 جرى ربطه تلقائياً وسدد قسطاً لعقد البضاعة "${targetContract.itemName}"!`, 'success');
            }
          }
        } else if (linkedEntityType === 'debt') {
          // Update the paid amount for a debt
          const debt = debts.find(d => d.id === linkedEntityId);
          if (debt) {
            const updatedPaid = Math.min(debt.totalAmount, debt.paidAmount + amountNum);
            const updatedStatus = updatedPaid >= debt.totalAmount ? 'paid' : 'partially_paid';
            const updatedDebt: Debt = {
              ...debt,
              paidAmount: updatedPaid,
              status: updatedStatus,
              updatedAt: new Date().toISOString()
            };
            await putInStore('debts', updatedDebt);
            showToast(`🔗 جرى ربطه تلقائياً وتم تحديث سداد الدين إلى ${fmtIQD(updatedPaid)}!`, 'success');
          }
        } else if (linkedEntityType === 'salaf') {
          // Record payment for the first receiver member of the salaf
          const salaf = salafs.find(s => s.id === linkedEntityId);
          if (salaf) {
            const receiverMember = salaf.members.find(m => m.isReceiver);
            if (receiverMember) {
              const newSalafPay = {
                id: uid(),
                memberId: receiverMember.id,
                monthIndex: 1,
                date: newTxDate,
                amount: amountNum,
                isPaidByMe: true,
                notes: `مسجل تلقائياً عبر ترابط الجرد المالي`,
                createdAt: new Date().toISOString()
              };
              const updatedSalaf = {
                ...salaf,
                payments: [...salaf.payments, newSalafPay]
              };
              await putInStore('salafs', updatedSalaf);
              showToast(`🔗 جرى ربطه تلقائياً وسدد مساهمة سلفة للجمعية "${salaf.name}"!`, 'success');
            }
          }
        }
      }

      // Update Local State & Refresh App
      setTransactions(prev => [newTx, ...prev]);
      setAccounts(prev => prev.map(a => {
        if (a.id === newTxAccountId) return updatedSourceAcc;
        if (newTxType === 'transfer' && a.id === newTxTransferToId && updatedDestAcc) return updatedDestAcc;
        return a;
      }));

      showToast('تم تسجيل الحركة بنجاح وجرى تحديث الحسابات والترابط وتأكيد الجرد المالي', 'success');
      setShowAddTransaction(false);
      setNewTxAmount('');
      setNewTxDesc('');
      setLinkToEntity(false);
      setLinkedEntityId('');
      triggerAppSync();
      loadFinances();
    } catch (err) {
      showToast('فشل في حفظ العملية المالية وتعديل الأرصدة', 'error');
    }
  };

  // Delete Transaction handler
  const handleDeleteTransaction = async (tx: FinancialTransaction) => {
    const confirmDelete = window.confirm(`هل أنت متأكد من حذف حركة "${tx.description}" وإلغاء تسوية رصيد الصندوق؟`);
    if (!confirmDelete) return;

    try {
      await deleteFromStore('financial_transactions', tx.id);

      const sourceAcc = accounts.find(a => a.id === tx.accountId);
      let updatedSourceAcc: FinancialAccount | undefined;
      if (sourceAcc) {
        const revertedBalance = sourceAcc.balance + (tx.type === 'income' ? -tx.amount : tx.amount);
        updatedSourceAcc = { ...sourceAcc, balance: revertedBalance };
        await putInStore('financial_accounts', updatedSourceAcc);
      }

      let updatedDestAcc: FinancialAccount | undefined;
      if (tx.type === 'transfer' && tx.transferToAccountId) {
        const destAcc = accounts.find(a => a.id === tx.transferToAccountId);
        if (destAcc && sourceAcc) {
          let convertedAmount = tx.amount;
          if (sourceAcc.currency !== destAcc.currency) {
            if (sourceAcc.currency === 'USD' && destAcc.currency === 'IQD') {
              convertedAmount = tx.amount * 1500;
            } else if (sourceAcc.currency === 'IQD' && destAcc.currency === 'USD') {
              convertedAmount = tx.amount / 1500;
            }
          }
          const revertedDestBalance = destAcc.balance - convertedAmount;
          updatedDestAcc = { ...destAcc, balance: revertedDestBalance };
          await putInStore('financial_accounts', updatedDestAcc);
        }
      }

      setTransactions(prev => prev.filter(t => t.id !== tx.id));
      setAccounts(prev => prev.map(a => {
        if (a.id === tx.accountId && updatedSourceAcc) return updatedSourceAcc;
        if (tx.type === 'transfer' && a.id === tx.transferToAccountId && updatedDestAcc) return updatedDestAcc;
        return a;
      }));

      showToast('تم إلغاء الحركة المالية واسترجاع تسويات المحافظ', 'success');
      triggerAppSync();
    } catch (err) {
      showToast('فشل حذف وتسوية العملية', 'error');
    }
  };

  // Filter accounts zero balance if requested
  const visibleAccounts = settings.hideZeroBalanceAccounts 
    ? accounts.filter(a => a.balance !== 0)
    : accounts;

  // Filter transactions
  const filteredTxs = transactions.filter(tx => {
    const matchesTab = activeTab === 'all' || tx.type === activeTab;
    const matchesAccount = filterAccount === 'all' || tx.accountId === filterAccount || tx.transferToAccountId === filterAccount;
    const matchesCategory = filterCategory === 'all' || tx.category === filterCategory;
    return matchesTab && matchesAccount && matchesCategory;
  });

  // Handler to open Settle Transaction prefilled from the Quick Collect list
  const handleQuickSettle = (type: 'debt' | 'contract', entityId: string, amount: number, label: string) => {
    setNewTxAmount(String(amount));
    setNewTxDesc(`سداد مستحقات: ${label}`);
    setNewTxType('income');
    setNewTxCategory(type === 'contract' ? 'مبيعات وأقساط' : 'سداد ديون لي');
    setLinkToEntity(true);
    setLinkedEntityType(type === 'contract' ? 'customer' : 'debt');
    // If contract, find its customerId to link
    if (type === 'contract') {
      const matchedCont = contracts.find(c => c.id === entityId);
      setLinkedEntityId(matchedCont ? matchedCont.customerId : '');
    } else {
      setLinkedEntityId(entityId);
    }
    // Pre-select first account if empty
    if (accounts.length > 0 && !newTxAccountId) {
      setNewTxAccountId(accounts[0].id);
    }
    setShowAddTransaction(true);
    showToast(`تم تعبئة تفاصيل الحركة المالية للتحصيل المباشر لـ ${label}`, 'info');
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-16" dir="rtl">
      {/* Page Title & PWA Tagline */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold text-amber-500 uppercase tracking-widest mb-1">المستودع المالي المتكامل</p>
          <h1 className="text-2xl font-bold text-white tracking-tight">الجرد والميزانية الموحدة</h1>
          <p className="text-xs text-zinc-400 mt-1 leading-relaxed">إدارة رأس المال التجاري والشخصي بكفاءة وعمل متصل بنسبة 100% بدون إنترنت.</p>
        </div>
        <div className="bg-emerald-500/10 text-emerald-400 text-[10px] font-bold px-3 py-1.5 rounded-full border border-emerald-500/15 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>يعمل دون اتصال أوفلاين</span>
        </div>
      </div>

      {/* Primary Financial Status Balance Card */}
      <div className="relative overflow-hidden rounded-[24px] border border-amber-500/15 bg-gradient-to-br from-amber-500/10 via-[#101012] to-black p-6 shadow-2xl">
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />
        <div className="flex justify-between items-start">
          <div>
            <span className="text-xs font-semibold text-zinc-400 block">صافي قيمة رأس المال (السيولة والأصول)</span>
            <h2 className="text-3xl font-extrabold text-white mt-1.5 tracking-tight select-all">
              {fmtIQD(netWorth)}
            </h2>
            <p className="text-[10px] text-zinc-500 mt-1">تتضمن السيولة النقدية وديون العملاء المستحقة مطروحاً منها الالتزامات الكلية</p>
          </div>
          <div className="p-3 rounded-2xl bg-amber-500/15 text-amber-500 shadow-inner">
            <Coins className="w-6 h-6 stroke-[1.8]" />
          </div>
        </div>

        {/* Breakdown bar */}
        <div className="mt-5 grid grid-cols-2 gap-4 border-t border-white/5 pt-4">
          <div>
            <span className="text-[10px] text-zinc-500 block font-medium">إجمالي السيولة الحرة بالصناديق</span>
            <span className="text-sm font-bold text-emerald-400 select-all block mt-0.5">{fmtIQD(totalCashInWallets)}</span>
          </div>
          <div>
            <span className="text-[10px] text-zinc-500 block font-medium">الديون المطلوب تحصيلها</span>
            <span className="text-sm font-bold text-amber-500 select-all block mt-0.5">{fmtIQD(totalOutstandingContractsDebt + totalOwedToMe)}</span>
          </div>
        </div>
      </div>

      {/* SECTION 1: SYSTEM SYSTEMIC STATS */}
      {settings.showSystemStats && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-widest flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4 text-amber-500" />
              <span>إحصائيات المنظومة والأقساط الكلية</span>
            </h3>
            <button
              onClick={() => setShowCustomFormulaModal(true)}
              className="px-2.5 py-1 text-[10px] font-bold text-amber-500 hover:text-amber-400 bg-[#151518] rounded-lg border border-white/5 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>تخصيص المعادلات والمؤشرات</span>
            </button>
          </div>

          {/* Render Active Configured / Custom formulas */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {/* Essential standard metrics */}
            <div className="bg-[#121214]/60 border border-white/5 rounded-2xl p-4 flex flex-col justify-between min-h-[95px]">
              <span className="text-[11px] text-zinc-400 font-bold block">ديون أقساط السوق</span>
              <div className="mt-2">
                <p className="text-sm font-bold text-white select-all">{fmtIQD(totalOutstandingContractsDebt)}</p>
                <p className="text-[9px] text-zinc-500 mt-0.5">موزعة على {contracts.length} عقد زبائن</p>
              </div>
            </div>

            <div className="bg-[#121214]/60 border border-white/5 rounded-2xl p-4 flex flex-col justify-between min-h-[95px]">
              <span className="text-[11px] text-zinc-400 font-bold block">أرباح العقود المبرمة</span>
              <div className="mt-2">
                <p className="text-sm font-bold text-amber-500 select-all">{fmtIQD(totalProfitsPlanned)}</p>
                <p className="text-[9px] text-emerald-500 mt-0.5">سُدد منها: {fmtIQD(totalInstallmentPaid)}</p>
              </div>
            </div>

            {/* Custom / Dyn Formulas based on Enabled Map */}
            {Object.entries(enabledFormulas).map(([fId, enabled]) => {
              if (!enabled) return null;
              // Look up in definitions
              const found = 
                statsDefinitions.structural.find(f => f.id === fId) ||
                statsDefinitions.mathematical.find(f => f.id === fId) ||
                statsDefinitions.temporal.find(f => f.id === fId);

              if (!found) return null;
              
              return (
                <div key={found.id} className="bg-[#121214]/60 border border-amber-500/10 hover:border-amber-500/25 rounded-2xl p-4 flex flex-col justify-between min-h-[95px] transition-all">
                  <span className="text-[11px] text-zinc-300 font-bold flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
                    <span className="line-clamp-1">{found.label}</span>
                  </span>
                  <div className="mt-2">
                    <p className="text-sm font-extrabold text-white select-all">
                      {found.isMoney ? fmtIQD(Number(found.value)) : found.value}
                      {(found as any).suffix || ''}
                    </p>
                    <p className="text-[8px] text-zinc-500 line-clamp-1 mt-0.5">{found.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* DETAILED TARGETS: REQUIRED TO BE COLLECTED THIS MONTH & WEEK (المطلوب تحصيله بشكل منفصل) */}
      <div className="bg-[#121214]/40 border border-white/5 rounded-[22px] p-5">
        <div className="flex items-center justify-between border-b border-white/5 pb-2.5 mb-4">
          <div className="flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-amber-500" />
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-widest">المطلوب تحصيله والمستحقات العاجلة</h3>
              <p className="text-[9px] text-zinc-500 mt-0.5">جدول الديون والأقساط التي يجب تحصيلها هذا الأسبوع والشارية هذا الشهر</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Section 1: Weekly collections */}
          <div className="space-y-3">
            <div className="p-3 bg-rose-500/10 border border-rose-500/25 rounded-xl">
              <span className="text-[10px] text-rose-400 font-bold block">مستحقات هذا الأسبوع (خلال 7 أيام)</span>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <span className="text-[9px] text-zinc-500 block">من أقساط:</span>
                  <span className="text-xs font-extrabold text-white">{fmtIQD(installmentsDueThisWeek.reduce((s,c) => s + c.monthlyInstallment, 0))}</span>
                </div>
                <div>
                  <span className="text-[9px] text-zinc-500 block">من ديون للتحصيل:</span>
                  <span className="text-xs font-extrabold text-white">{fmtIQD(debtsDueThisWeek.reduce((s,d) => s + (d.totalAmount - d.paidAmount), 0))}</span>
                </div>
              </div>
            </div>

            {/* List of Weekly Items */}
            <div className="bg-black/30 rounded-xl p-3 space-y-2 max-h-[160px] overflow-y-auto">
              <span className="text-[10px] text-zinc-400 font-bold block mb-1">تفاصيل مستحقات الأسبوع الحالي:</span>
              
              {installmentsDueThisWeek.map(c => {
                const cust = customers.find(cu => cu.id === c.customerId);
                return (
                  <div key={c.id} className="flex justify-between items-center text-[10px] bg-white/5 p-2 rounded-lg">
                    <div>
                      <span className="text-white font-bold block">{cust?.name || 'زبون غير معروف'}</span>
                      <span className="text-zinc-500">قسط بضاعة: {c.itemName} (يوم {c.dueDay})</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-amber-500 font-bold">{fmtIQD(c.monthlyInstallment)}</span>
                      <button
                        onClick={() => handleQuickSettle('contract', c.id, c.monthlyInstallment, `قسط ${c.itemName} - ${cust?.name}`)}
                        className="bg-amber-500 hover:bg-amber-400 text-black px-2 py-0.5 rounded text-[8px] font-bold cursor-pointer transition-colors"
                      >
                        تسديد
                      </button>
                    </div>
                  </div>
                );
              })}

              {debtsDueThisWeek.map(d => (
                <div key={d.id} className="flex justify-between items-center text-[10px] bg-white/5 p-2 rounded-lg">
                  <div>
                    <span className="text-white font-bold block">{d.personName}</span>
                    <span className="text-zinc-500">دين مستحق (تاريخ: {d.dueDate})</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-amber-500 font-bold">{fmtIQD(d.totalAmount - d.paidAmount)}</span>
                    <button
                      onClick={() => handleQuickSettle('debt', d.id, d.totalAmount - d.paidAmount, `دين ${d.personName}`)}
                      className="bg-amber-500 hover:bg-amber-400 text-black px-2 py-0.5 rounded text-[8px] font-bold cursor-pointer transition-colors"
                    >
                      تسديد
                    </button>
                  </div>
                </div>
              ))}

              {installmentsDueThisWeek.length === 0 && debtsDueThisWeek.length === 0 && (
                <div className="text-center py-4 text-[10px] text-zinc-600">لا توجد دفعات أو ديون مستحقة هذا الأسبوع</div>
              )}
            </div>
          </div>

          {/* Section 2: Monthly Collections */}
          <div className="space-y-3">
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/25 rounded-xl">
              <span className="text-[10px] text-emerald-400 font-bold block">مستحقات هذا الشهر الحالي</span>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <span className="text-[9px] text-zinc-500 block">أقساط مطلوبة:</span>
                  <span className="text-xs font-extrabold text-white">{fmtIQD(installmentsDueThisMonth.reduce((s,c) => s + c.monthlyInstallment, 0))}</span>
                </div>
                <div>
                  <span className="text-[9px] text-zinc-500 block">ديون مطلوبة لي:</span>
                  <span className="text-xs font-extrabold text-white">{fmtIQD(debtsDueThisMonth.reduce((s,d) => s + (d.totalAmount - d.paidAmount), 0))}</span>
                </div>
              </div>
            </div>

            {/* List of Monthly Items */}
            <div className="bg-black/30 rounded-xl p-3 space-y-2 max-h-[160px] overflow-y-auto">
              <span className="text-[10px] text-zinc-400 font-bold block mb-1">تفاصيل مستحقات الشهر الحالي:</span>
              
              {installmentsDueThisMonth.map(c => {
                const cust = customers.find(cu => cu.id === c.customerId);
                return (
                  <div key={c.id} className="flex justify-between items-center text-[10px] bg-white/5 p-2 rounded-lg">
                    <div>
                      <span className="text-white font-bold block">{cust?.name || 'زبون غير معروف'}</span>
                      <span className="text-zinc-500">عقد: {c.itemName} • المستحق قسطه</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-amber-500 font-bold">{fmtIQD(c.monthlyInstallment)}</span>
                      <button
                        onClick={() => handleQuickSettle('contract', c.id, c.monthlyInstallment, `قسط ${c.itemName} - ${cust?.name}`)}
                        className="bg-amber-500 hover:bg-amber-400 text-black px-2 py-0.5 rounded text-[8px] font-bold cursor-pointer transition-colors"
                      >
                        تسديد
                      </button>
                    </div>
                  </div>
                );
              })}

              {debtsDueThisMonth.map(d => (
                <div key={d.id} className="flex justify-between items-center text-[10px] bg-white/5 p-2 rounded-lg">
                  <div>
                    <span className="text-white font-bold block">{d.personName}</span>
                    <span className="text-zinc-500">دين مالي (تاريخ: {d.dueDate})</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-amber-500 font-bold">{fmtIQD(d.totalAmount - d.paidAmount)}</span>
                    <button
                      onClick={() => handleQuickSettle('debt', d.id, d.totalAmount - d.paidAmount, `دين ${d.personName}`)}
                      className="bg-amber-500 hover:bg-amber-400 text-black px-2 py-0.5 rounded text-[8px] font-bold cursor-pointer transition-colors"
                    >
                      تسديد
                    </button>
                  </div>
                </div>
              ))}

              {installmentsDueThisMonth.length === 0 && debtsDueThisMonth.length === 0 && (
                <div className="text-center py-4 text-[10px] text-zinc-600">لا توجد دفعات أو ديون مستهدفة هذا الشهر</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: BUDGETS & WALLETS LIST */}
      {settings.showBudgetsList && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-widest flex items-center gap-1.5">
              <Wallet className="w-4 h-4 text-emerald-500" />
              <span>صناديق النظام ومحفظات الميزانيات</span>
            </h3>
            <button
              onClick={() => setShowAddAccount(true)}
              className="px-2.5 py-1 text-[10px] font-bold text-amber-500 hover:text-amber-400 bg-amber-500/10 hover:bg-amber-500/15 rounded-full border border-amber-500/15 flex items-center gap-1 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إنشاء محفظة ميزانية</span>
            </button>
          </div>

          {/* New Account Form Sheet */}
          {showAddAccount && (
            <form onSubmit={handleCreateAccount} className="bg-[#121214] border border-white/5 rounded-2xl p-4 flex flex-col gap-3 animate-slide-in">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <span className="text-xs font-bold text-white">إضافة محفظة أو ميزانية جديدة</span>
                <button type="button" onClick={() => setShowAddAccount(false)} className="text-zinc-500 hover:text-zinc-300 p-1">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1 col-span-2">
                  <span className="text-[10px] text-zinc-500 font-bold">اسم المحفظة</span>
                  <input
                    type="text"
                    required
                    value={newAccName}
                    onChange={(e) => setNewAccName(e.target.value)}
                    placeholder="مثال: ميزانية المشتريات / سيارتي"
                    className="w-full h-10 px-3 bg-[#18181b] border border-white/5 text-white text-xs rounded-xl focus:outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-zinc-500 font-bold">الرصيد الافتتاحي</span>
                  <input
                    type="number"
                    value={newAccBalance}
                    onChange={(e) => setNewAccBalance(e.target.value)}
                    placeholder="0"
                    className="w-full h-10 px-3 bg-[#18181b] border border-white/5 text-white text-xs rounded-xl focus:outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-zinc-500 font-bold">العملة</span>
                  <select
                    value={newAccCurrency}
                    onChange={(e) => setNewAccCurrency(e.target.value as any)}
                    className="w-full h-10 px-2 bg-[#18181b] border border-white/5 text-white text-xs rounded-xl focus:outline-none"
                  >
                    <option value="IQD">دينار عراقي (IQD)</option>
                    <option value="USD">دولار أمريكي (USD)</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-zinc-500 font-bold">اختر لون المحفظة لتمييزها</span>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {colors.map(col => (
                    <button
                      key={col.value}
                      type="button"
                      onClick={() => setNewAccColor(col.value)}
                      className={`h-8 px-2 rounded-lg text-[10px] font-bold border transition-all ${col.bg} ${
                        newAccColor === col.value ? 'border-amber-500 ring-1 ring-amber-500' : 'border-white/5'
                      }`}
                    >
                      {col.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="w-full h-10 mt-2 bg-amber-500 text-black font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer shadow-lg shadow-amber-500/10"
              >
                <Check className="w-4 h-4" />
                <span>حفظ وتوليد المحفظة</span>
              </button>
            </form>
          )}

          {/* Edit Account Modal Sheet */}
          {showEditAccount && (
            <form onSubmit={handleUpdateAccount} className="bg-[#121214] border border-amber-500/30 rounded-2xl p-4 flex flex-col gap-3 animate-slide-in">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <span className="text-xs font-bold text-amber-400">تعديل بيانات وتوازن محفظة: {showEditAccount.name}</span>
                <button type="button" onClick={() => setShowEditAccount(null)} className="text-zinc-500 hover:text-zinc-300 p-1">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1 col-span-2">
                  <span className="text-[10px] text-zinc-500 font-bold">اسم المحفظة الجديد</span>
                  <input
                    type="text"
                    required
                    value={editAccName}
                    onChange={(e) => setEditAccName(e.target.value)}
                    className="w-full h-10 px-3 bg-[#18181b] border border-white/5 text-white text-xs rounded-xl focus:outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-zinc-500 font-bold">تعديل الرصيد يدوياً (تسوية)</span>
                  <input
                    type="number"
                    value={editAccBalance}
                    onChange={(e) => setEditAccBalance(e.target.value)}
                    className="w-full h-10 px-3 bg-[#18181b] border border-white/5 text-white text-xs rounded-xl focus:outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-zinc-500 font-bold">العملة</span>
                  <select
                    value={editAccCurrency}
                    onChange={(e) => setEditAccCurrency(e.target.value as any)}
                    className="w-full h-10 px-2 bg-[#18181b] border border-white/5 text-white text-xs rounded-xl focus:outline-none"
                  >
                    <option value="IQD">دينار عراقي (IQD)</option>
                    <option value="USD">دولار أمريكي (USD)</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-zinc-500 font-bold">تغيير اللون</span>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {colors.map(col => (
                    <button
                      key={col.value}
                      type="button"
                      onClick={() => setEditAccColor(col.value)}
                      className={`h-8 px-2 rounded-lg text-[10px] font-bold border transition-all ${col.bg} ${
                        editAccColor === col.value ? 'border-amber-500 ring-1 ring-amber-500' : 'border-white/5'
                      }`}
                    >
                      {col.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="w-full h-10 mt-2 bg-emerald-500 text-black font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-500/10"
              >
                <Check className="w-4 h-4" />
                <span>حفظ التعديلات وتحديث الرصيد</span>
              </button>
            </form>
          )}

          {/* Wallets Grid List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {visibleAccounts.map(acc => {
              const borderTheme = acc.color === 'emerald' ? 'border-emerald-500/25' : acc.color === 'blue' ? 'border-blue-500/25' : acc.color === 'rose' ? 'border-rose-500/25' : acc.color === 'purple' ? 'border-purple-500/25' : 'border-amber-500/25';
              const textTheme = acc.color === 'emerald' ? 'text-emerald-400' : acc.color === 'blue' ? 'text-blue-400' : acc.color === 'rose' ? 'text-rose-400' : acc.color === 'purple' ? 'text-purple-400' : 'text-amber-400';
              const bgTheme = acc.color === 'emerald' ? 'from-emerald-500/5' : acc.color === 'blue' ? 'from-blue-500/5' : acc.color === 'rose' ? 'from-rose-500/5' : acc.color === 'purple' ? 'from-purple-500/5' : 'from-amber-500/5';
              
              return (
                <div key={acc.id} className={`bg-gradient-to-l ${bgTheme} to-[#121214]/80 border ${borderTheme} rounded-2xl p-4 flex items-center justify-between`}>
                  <div>
                    <span className="text-xs font-bold text-zinc-300 block">{acc.name}</span>
                    <span className={`text-base font-extrabold ${textTheme} mt-1 block select-all`}>
                      {formatAmount(acc.balance, acc.currency)}
                    </span>
                    <span className="text-[9px] text-zinc-600 block mt-0.5">تاريخ الإنشاء: {new Date(acc.createdAt).toLocaleDateString('ar-IQ')}</span>
                  </div>
                  <div className="flex flex-col items-end justify-between h-full gap-4">
                    <div className="flex items-center gap-1.5">
                      {/* Edit Button */}
                      <button
                        onClick={() => {
                          setEditAccName(acc.name);
                          setEditAccBalance(String(acc.balance));
                          setEditAccCurrency(acc.currency);
                          setEditAccColor(acc.color);
                          setShowEditAccount(acc);
                        }}
                        className="p-1.5 rounded-lg bg-zinc-900 border border-white/5 text-zinc-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors cursor-pointer"
                        title="تعديل المحفظة"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {/* Delete Button */}
                      <button
                        onClick={() => handleDeleteAccount(acc.id, acc.name)}
                        className="p-1.5 rounded-lg bg-zinc-900 border border-white/5 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        title="حذف المحفظة"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className={`p-2 rounded-xl bg-white/5 ${textTheme}`}>
                      <Wallet className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* QUICK ACTIONS BAR: NEW TRANSACTION BUTTON */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => {
            setShowAddTransaction(true);
            if (accounts.length > 0 && !newTxAccountId) {
              setNewTxAccountId(accounts[0].id);
            }
          }}
          className="flex-1 h-12 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-extrabold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all shadow-xl shadow-amber-500/10 cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>تسجيل حركة مالية جديدة (إيراد / مصروف / تحوير)</span>
        </button>
      </div>

      {/* New Transaction Form Sheet */}
      {showAddTransaction && (
        <form onSubmit={handleCreateTransaction} className="bg-[#121214] border border-white/5 rounded-[22px] p-5 flex flex-col gap-4 animate-slide-in">
          <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
            <h4 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-amber-500" />
              <span>إدخال حركة في المستودع المالي</span>
            </h4>
            <button type="button" onClick={() => setShowAddTransaction(false)} className="text-zinc-500 hover:text-zinc-300 p-1">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[10px] text-zinc-500 font-bold">نوع الحركة المالية</span>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setNewTxType('expense');
                  setNewTxCategory('شخصي ومعيشة');
                }}
                className={`h-10 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border ${
                  newTxType === 'expense'
                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                    : 'bg-[#18181b] text-zinc-400 border-white/5'
                }`}
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>مصروف (-)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setNewTxType('income');
                  setNewTxCategory('أرباح إضافية');
                }}
                className={`h-10 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border ${
                  newTxType === 'income'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-[#18181b] text-zinc-400 border-white/5'
                }`}
              >
                <ArrowDownLeft className="w-4 h-4" />
                <span>إيراد (+)</span>
              </button>
              <button
                type="button"
                onClick={() => setNewTxType('transfer')}
                className={`h-10 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border ${
                  newTxType === 'transfer'
                    ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                    : 'bg-[#18181b] text-zinc-400 border-white/5'
                }`}
              >
                <ArrowUpDown className="w-4 h-4" />
                <span>تحويل مالي</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Wallet Selection */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-zinc-500 font-bold">
                {newTxType === 'transfer' ? 'من محفظة (المصدر)' : 'المحفظة المعنيّة'}
              </span>
              <select
                required
                value={newTxAccountId}
                onChange={(e) => setNewTxAccountId(e.target.value)}
                className="w-full h-10 px-2 bg-[#18181b] border border-white/5 text-white text-xs rounded-xl focus:outline-none"
              >
                <option value="">-- اختر محفظة --</option>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
                ))}
              </select>
            </div>

            {/* Transfer To Wallet */}
            {newTxType === 'transfer' ? (
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-zinc-500 font-bold">إلى محفظة (المستلم)</span>
                <select
                  required
                  value={newTxTransferToId}
                  onChange={(e) => setNewTxTransferToId(e.target.value)}
                  className="w-full h-10 px-2 bg-[#18181b] border border-white/5 text-white text-xs rounded-xl focus:outline-none"
                >
                  <option value="">-- اختر محفظة --</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
                  ))}
                </select>
              </div>
            ) : (
              /* Category Selection */
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-zinc-500 font-bold">فئة الحركة</span>
                <select
                  value={newTxCategory}
                  onChange={(e) => setNewTxCategory(e.target.value)}
                  className="w-full h-10 px-2 bg-[#18181b] border border-white/5 text-white text-xs rounded-xl focus:outline-none"
                >
                  {newTxType === 'expense' 
                    ? expenseCategories.map(c => <option key={c} value={c}>{c}</option>)
                    : incomeCategories.map(c => <option key={c} value={c}>{c}</option>)
                  }
                </select>
              </div>
            )}

            {/* Amount */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-zinc-500 font-bold">مبلغ العملية</span>
              <div className="relative">
                <input
                  type="number"
                  required
                  value={newTxAmount}
                  onChange={(e) => setNewTxAmount(e.target.value)}
                  placeholder="0"
                  className="w-full h-10 pl-10 pr-3 bg-[#18181b] border border-white/5 text-white text-xs rounded-xl focus:outline-none font-bold"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500 font-bold">
                  {accounts.find(a => a.id === newTxAccountId)?.currency || 'IQD'}
                </span>
              </div>
            </div>

            {/* Date */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-zinc-500 font-bold">تاريخ القيد</span>
              <input
                type="date"
                required
                value={newTxDate}
                onChange={(e) => setNewTxDate(e.target.value)}
                className="w-full h-10 px-3 bg-[#18181b] border border-white/5 text-white text-xs rounded-xl focus:outline-none text-left"
              />
            </div>
          </div>

          {/* DYNAMIC INTERCONNECTED ENTITY LINKING (الترابط الكلي) */}
          <div className="bg-black/30 border border-white/5 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-amber-400 font-bold flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5" />
                <span>الربط والتحوير التلقائي لكيان في النظام (إيراد/مصروف مرتبط)</span>
              </span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={linkToEntity}
                  onChange={(e) => setLinkToEntity(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-7 h-4 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-400 after:border-zinc-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-amber-500 peer-checked:after:bg-black" />
              </label>
            </div>

            {linkToEntity && (
              <div className="grid grid-cols-2 gap-3 animate-slide-in">
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] text-zinc-500 font-bold">تخصيص وربط الحركة بـ:</span>
                  <select
                    value={linkedEntityType}
                    onChange={(e) => {
                      setLinkedEntityType(e.target.value as any);
                      setLinkedEntityId('');
                    }}
                    className="w-full h-9 px-2 bg-[#18181b] border border-white/5 text-white text-[11px] rounded-lg focus:outline-none"
                  >
                    <option value="customer">زبون / عقد أقساط نشط</option>
                    <option value="debt">دين (دائن أو مدين له)</option>
                    <option value="salaf">صندوق سلفة نشط</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[9px] text-zinc-500 font-bold">اختر من القائمة:</span>
                  <select
                    required
                    value={linkedEntityId}
                    onChange={(e) => setLinkedEntityId(e.target.value)}
                    className="w-full h-9 px-2 bg-[#18181b] border border-white/5 text-white text-[11px] rounded-lg focus:outline-none"
                  >
                    <option value="">-- اختر الكيان --</option>
                    {linkedEntityType === 'customer' && customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name} (هاتف: {c.phone})</option>
                    ))}
                    {linkedEntityType === 'debt' && debts.map(d => (
                      <option key={d.id} value={d.id}>{d.personName} ({d.type === 'to_me' ? 'أطلبه' : 'يطلبني'} - المتبقي: {fmtIQD(d.totalAmount - d.paidAmount)})</option>
                    ))}
                    {linkedEntityType === 'salaf' && salafs.map(s => (
                      <option key={s.id} value={s.id}>{s.name} (قيمة: {fmtIQD(s.totalAmount)})</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-zinc-500 font-bold">البيان والبيان الوصفي (البيان بالتفصيل)</span>
            <input
              type="text"
              required
              value={newTxDesc}
              onChange={(e) => setNewTxDesc(e.target.value)}
              placeholder="مثال: شراء كفرات وبضاعة للمحل / سداد قسط الإيجار"
              className="w-full h-10 px-3 bg-[#18181b] border border-white/5 text-white text-xs rounded-xl focus:outline-none"
            />
          </div>

          <button
            type="submit"
            className="w-full h-11 mt-1 bg-amber-500 text-black font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer shadow-lg shadow-amber-500/15"
          >
            <Check className="w-4 h-4 stroke-[2.5]" />
            <span>تسجيل وتأكيد الحركة وحفظ التعديل</span>
          </button>
        </form>
      )}

      {/* SECTION 3: VISUAL REPORTS & INCOME STATEMENT */}
      {settings.showReports && (
        <div className="bg-[#121214]/60 border border-white/5 rounded-[22px] p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <h3 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4 text-emerald-400" />
              <span>التقارير المالية وميزان الدخل</span>
            </h3>
            <span className="text-[9px] text-zinc-500 font-medium">مبني على حركات المحفظة</span>
          </div>

          {/* Income vs Expenses Progress */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400">مقارنة المصروفات الكلية بالإيرادات:</span>
              <span className="font-bold text-zinc-300">{profitLossPercent}%</span>
            </div>
            
            <div className="w-full h-3 bg-zinc-800 rounded-full overflow-hidden relative">
              <div
                className="h-full bg-gradient-to-r from-rose-500 to-amber-500 transition-all duration-500"
                style={{ width: `${profitLossPercent}%` }}
              />
            </div>
            
            <div className="flex justify-between items-center text-[10px] text-zinc-500 mt-1 font-medium">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>الإيرادات: <strong className="text-emerald-400">{fmtIQD(totalIncomeIQD)}</strong></span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-400" />
                <span>المصروفات: <strong className="text-rose-400">{fmtIQD(totalExpenseIQD)}</strong></span>
              </span>
            </div>
          </div>

          {/* Expense breakdown by category */}
          {categoriesStats.length > 0 ? (
            <div className="mt-2 flex flex-col gap-2.5">
              <span className="text-[10px] text-zinc-400 font-bold block">تحليل المصروفات حسب الفئات (بالدينار العراقي):</span>
              <div className="flex flex-col gap-2">
                {categoriesStats.map(item => {
                  const percent = Math.round((item.total / totalExpenseIQD) * 100);
                  return (
                    <div key={item.name} className="flex flex-col gap-1">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-zinc-300 font-bold">{item.name}</span>
                        <span className="text-zinc-500 font-medium">{fmtIQD(item.total)} ({percent}%)</span>
                      </div>
                      <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500/80 rounded-full" style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-black/20 border border-white/5 text-center mt-2">
              <AlertCircle className="w-5 h-5 text-zinc-500 mx-auto mb-1" />
              <p className="text-[10px] text-zinc-500 leading-relaxed">لم تسجل حركات مصروفات بعد لعرض تحليل الفئات المالي.</p>
            </div>
          )}
        </div>
      )}

      {/* SECTION 4: RECENT TRANSACTIONS LEDGER */}
      {settings.showTransactionsList && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-widest flex items-center gap-1.5">
              <ArrowUpDown className="w-4 h-4 text-blue-400" />
              <span>دفتر الأستاذ وقيد الحركات المالية</span>
            </h3>
            <p className="text-[10px] text-zinc-500">سجل كامل بجميع المصاريف والإيرادات والتحويلات المسجلة بالكامل.</p>
          </div>

          {/* Ledger filters */}
          <div className="grid grid-cols-3 gap-2 bg-[#121214]/60 border border-white/5 p-2 rounded-xl">
            <div>
              <span className="text-[8px] text-zinc-500 block font-bold mb-1">تصفية حسب النوع</span>
              <select
                value={activeTab}
                onChange={(e) => setActiveTab(e.target.value as any)}
                className="w-full h-8 px-1.5 bg-[#18181b] border border-white/5 text-zinc-300 text-[10px] rounded-lg focus:outline-none"
              >
                <option value="all">الكل</option>
                <option value="income">إيرادات</option>
                <option value="expense">مصروفات</option>
                <option value="transfer">تحويلات</option>
              </select>
            </div>

            <div>
              <span className="text-[8px] text-zinc-500 block font-bold mb-1">تصفية حسب المحفظة</span>
              <select
                value={filterAccount}
                onChange={(e) => setFilterAccount(e.target.value)}
                className="w-full h-8 px-1.5 bg-[#18181b] border border-white/5 text-zinc-300 text-[10px] rounded-lg focus:outline-none"
              >
                <option value="all">كل المحافظ</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>

            <div>
              <span className="text-[8px] text-zinc-500 block font-bold mb-1">تصفية حسب الفئة</span>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full h-8 px-1.5 bg-[#18181b] border border-white/5 text-zinc-300 text-[10px] rounded-lg focus:outline-none"
              >
                <option value="all">كل الفئات</option>
                {Array.from(new Set([...expenseCategories, ...incomeCategories])).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Ledger list */}
          {filteredTxs.length > 0 ? (
            <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto pr-1">
              {filteredTxs.map(tx => {
                const acc = accounts.find(a => a.id === tx.accountId);
                const currency = acc?.currency || 'IQD';
                const destAcc = tx.transferToAccountId ? accounts.find(a => a.id === tx.transferToAccountId) : null;

                return (
                  <div key={tx.id} className="bg-[#121214]/40 border border-white/5 rounded-xl p-3 flex items-center justify-between hover:bg-[#121214]/80 transition-all">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${
                        tx.type === 'income' 
                          ? 'bg-emerald-500/10 text-emerald-400' 
                          : tx.type === 'expense' 
                          ? 'bg-rose-500/10 text-rose-400' 
                          : 'bg-blue-500/10 text-blue-400'
                      }`}>
                        {tx.type === 'income' ? <ArrowDownLeft className="w-4 h-4" /> : tx.type === 'expense' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowUpDown className="w-4 h-4" />}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-white block select-all">{tx.description}</span>
                        <div className="flex items-center gap-1.5 text-[9px] text-zinc-500 mt-1">
                          <span className="bg-white/5 px-1.5 py-0.5 rounded text-zinc-400">{tx.category}</span>
                          <span>•</span>
                          <span className="text-zinc-400 font-medium">
                            {acc?.name} {destAcc ? ` ➔ ${destAcc.name}` : ''}
                          </span>
                          <span>•</span>
                          <span>{tx.date}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-extrabold ${
                        tx.type === 'income' ? 'text-emerald-400' : tx.type === 'expense' ? 'text-rose-400' : 'text-blue-400'
                      }`}>
                        {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}
                        {formatAmount(tx.amount, currency)}
                      </span>
                      <button
                        onClick={() => handleDeleteTransaction(tx)}
                        className="p-1 text-zinc-600 hover:text-rose-400 transition-colors cursor-pointer"
                        title="حذف القيد المالي"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-6 rounded-2xl bg-black/20 border border-white/5 text-center">
              <AlertCircle className="w-6 h-6 text-zinc-500 mx-auto mb-1.5" />
              <p className="text-xs text-zinc-500">لا توجد حركات مطابقة لتصفية دفتر الأستاذ المحدد.</p>
            </div>
          )}
        </div>
      )}

      {/* ACCORDION/MODAL OVERLAY FOR 150 CUSTOM EQUATIONS & METRICS CONTROL BOARD */}
      {showCustomFormulaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in" dir="rtl">
          <div className="w-full max-w-2xl bg-[#0e0e10] border border-amber-500/20 rounded-[28px] overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-amber-500" />
                  <span>تخصيص لوحة المعادلات والمؤشرات الكلية (150 خيار)</span>
                </h3>
                <p className="text-[11px] text-zinc-400 mt-1">تحكم في المعادلات الرياضية وصيغ الوقت والتاريخ والعدادات المعروضة في الإحصائيات</p>
              </div>
              <button 
                onClick={() => setShowCustomFormulaModal(false)}
                className="p-2 rounded-xl bg-white/5 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content (Scrollable Grid) */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Group 1: Structural Metrics */}
              <div>
                <span className="text-xs font-extrabold text-amber-500 block mb-3 border-r-2 border-amber-500 pr-2">المتغيرات والعدادات الهيكلية للمنظومة (70 متغيراً ونصف صيغة)</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {statsDefinitions.structural.map(item => (
                    <div 
                      key={item.id} 
                      onClick={() => toggleFormula(item.id)}
                      className={`p-3 rounded-xl border text-right transition-all cursor-pointer flex justify-between items-start ${
                        enabledFormulas[item.id] 
                          ? 'bg-amber-500/10 border-amber-500/30' 
                          : 'bg-black/20 border-white/5 hover:bg-white/5'
                      }`}
                    >
                      <div className="space-y-1">
                        <span className="text-xs font-bold text-white block">{item.label}</span>
                        <span className="text-[9px] text-zinc-500 block leading-relaxed">{item.desc}</span>
                      </div>
                      <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 mt-0.5 ${
                        enabledFormulas[item.id] ? 'bg-amber-500 border-amber-500 text-black' : 'border-zinc-700'
                      }`}>
                        {enabledFormulas[item.id] && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Group 2: Mathematical Formulas */}
              <div>
                <span className="text-xs font-extrabold text-emerald-400 block mb-3 border-r-2 border-emerald-400 pr-2">المعادلات الرياضية والصيغ المالية المتقدمة (50 معادلة تجارية)</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {statsDefinitions.mathematical.map(item => (
                    <div 
                      key={item.id} 
                      onClick={() => toggleFormula(item.id)}
                      className={`p-3 rounded-xl border text-right transition-all cursor-pointer flex justify-between items-start ${
                        enabledFormulas[item.id] 
                          ? 'bg-emerald-500/10 border-emerald-500/30' 
                          : 'bg-black/20 border-white/5 hover:bg-white/5'
                      }`}
                    >
                      <div className="space-y-1">
                        <span className="text-xs font-bold text-white block">{item.label}</span>
                        <span className="text-[9px] text-zinc-500 block leading-relaxed">{item.desc}</span>
                      </div>
                      <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 mt-0.5 ${
                        enabledFormulas[item.id] ? 'bg-emerald-500 border-emerald-500 text-black' : 'border-zinc-700'
                      }`}>
                        {enabledFormulas[item.id] && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Group 3: Time & Numbers variables */}
              <div>
                <span className="text-xs font-extrabold text-blue-400 block mb-3 border-r-2 border-blue-400 pr-2">صيغ الوقت والتاريخ والديون والنسب (30 متغيراً ومؤشراً)</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {statsDefinitions.temporal.map(item => (
                    <div 
                      key={item.id} 
                      onClick={() => toggleFormula(item.id)}
                      className={`p-3 rounded-xl border text-right transition-all cursor-pointer flex justify-between items-start ${
                        enabledFormulas[item.id] 
                          ? 'bg-blue-500/10 border-blue-500/30' 
                          : 'bg-black/20 border-white/5 hover:bg-white/5'
                      }`}
                    >
                      <div className="space-y-1">
                        <span className="text-xs font-bold text-white block">{item.label}</span>
                        <span className="text-[9px] text-zinc-500 block leading-relaxed">{item.desc}</span>
                      </div>
                      <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 mt-0.5 ${
                        enabledFormulas[item.id] ? 'bg-blue-500 border-blue-500 text-black' : 'border-zinc-700'
                      }`}>
                        {enabledFormulas[item.id] && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-white/5 bg-black/40 flex justify-end">
              <button 
                onClick={() => setShowCustomFormulaModal(false)}
                className="h-10 px-6 bg-amber-500 text-black font-extrabold rounded-xl text-xs hover:bg-amber-400 cursor-pointer"
              >
                تطبيق وحفظ الإعدادات الحالية
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
