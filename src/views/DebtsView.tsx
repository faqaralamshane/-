/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Scale,
  Plus,
  Edit2,
  Trash2,
  Phone,
  MessageCircle,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
  Filter,
  DollarSign,
  Search,
  ChevronDown,
  ChevronUp,
  Tag,
  FileText,
  ArrowRight,
  Send,
  Eye,
  EyeOff,
  Bell,
  Sliders,
  Settings2,
  ChevronLeft
} from 'lucide-react';
import { Debt, DebtTransaction, DebtNotification } from '../types';
import { getAllFromStore, putInStore, deleteFromStore, uid } from '../db';
import { showToast } from '../components/Toast';

export function DebtsView() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'to_me' | 'by_me'>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Selected Debt for deep workspace page
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);

  // Form states (Add/Edit Debt)
  const [personName, setPersonName] = useState('');
  const [phone, setPhone] = useState('');
  const [type, setType] = useState<'to_me' | 'by_me'>('to_me');
  const [totalAmount, setTotalAmount] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [notes, setNotes] = useState('');
  const [monthlyPurchaseLimit, setMonthlyPurchaseLimit] = useState('1000000');
  const [targetMonthlyPayment, setTargetMonthlyPayment] = useState('150000');

  // Action Modals state in workspace
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isReminderTemplateOpen, setIsReminderTemplateOpen] = useState(false);
  const [isReportTemplateOpen, setIsReportTemplateOpen] = useState(false);
  const [isRemindersPopupOpen, setIsRemindersPopupOpen] = useState(false);
  const [isReportsPopupOpen, setIsReportsPopupOpen] = useState(false);

  // Custom Quick Purchase/Payment States
  const [actionAmount, setActionAmount] = useState('');
  const [actionNotes, setActionNotes] = useState('');
  const [actionDate, setActionDate] = useState(new Date().toISOString().split('T')[0]);

  // Quick Add Debt State (to replace window.prompt)
  const [isQuickAddModalOpen, setIsQuickAddModalOpen] = useState(false);
  const [quickAddDebtTarget, setQuickAddDebtTarget] = useState<Debt | null>(null);
  const [quickAddAmount, setQuickAddAmount] = useState('');
  const [quickAddNotes, setQuickAddNotes] = useState('');
  const [quickAddDate, setQuickAddDate] = useState(new Date().toISOString().split('T')[0]);

  // Editing transaction state
  const [editingTransaction, setEditingTransaction] = useState<DebtTransaction | null>(null);

  // Template / Message builders state
  const [templateText, setTemplateText] = useState('');
  const [templateSubject, setTemplateSubject] = useState('');
  const [templateType, setTemplateType] = useState<'reminder' | 'report'>('reminder');

  useEffect(() => {
    const handleAddDebt = () => {
      setEditingDebt(null);
      resetForm();
      setIsFormOpen(true);
    };
    window.addEventListener('faqar-trigger-add-debt', handleAddDebt);
    return () => {
      window.removeEventListener('faqar-trigger-add-debt', handleAddDebt);
    };
  }, []);

  // Load debts on mount
  const loadDebts = async () => {
    try {
      const data = await getAllFromStore<Debt>('debts');
      
      // Migrate and parse debts: ensure they have transactions and notifications arrays
      const migrated = data.map((d) => {
        let txs = d.transactions || [];
        
        // If there are legacy payments but no transactions, migrate them
        if (txs.length === 0 && d.payments && d.payments.length > 0) {
          txs = d.payments.map((p) => ({
            id: p.id,
            type: 'payment',
            date: p.date,
            amount: p.amount,
            notes: p.notes,
            createdAt: p.date + 'T12:00:00.000Z'
          }));
        }

        // If transactions are still empty and totalAmount > 0, create initial purchase
        if (txs.length === 0 && d.totalAmount > 0) {
          txs = [
            {
              id: 'init-purchase-' + d.id,
              type: 'purchase',
              date: d.createdAt ? d.createdAt.split('T')[0] : new Date().toISOString().split('T')[0],
              amount: d.totalAmount,
              notes: d.notes || 'الرصيد الافتتاحي للدين الكلي',
              createdAt: d.createdAt || new Date().toISOString()
            }
          ];
        }

        return {
          ...d,
          transactions: txs,
          notifications: d.notifications || [],
          monthlyPurchaseLimit: d.monthlyPurchaseLimit ?? 1000000,
          targetMonthlyPayment: d.targetMonthlyPayment ?? 150000
        };
      });

      // Sort: critical and high priorities first, then by date descending
      const sorted = migrated.sort((a, b) => {
        const priorityWeight = { critical: 4, high: 3, medium: 2, low: 1 };
        const diff = (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0);
        if (diff !== 0) return diff;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      setDebts(sorted);

      // Keep selected debt details fully in sync if workspace is open
      if (selectedDebt) {
        const freshSelected = sorted.find((item) => item.id === selectedDebt.id);
        if (freshSelected) {
          setSelectedDebt(freshSelected);
        }
      }
    } catch (err) {
      console.error('Failed to load debts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDebts();
  }, []);

  // Helper formatting currencies
  const fmtIQD = (val: number) => {
    return new Intl.NumberFormat('ar-IQ', { style: 'currency', currency: 'IQD', maximumFractionDigits: 0 }).format(val);
  };

  // Calculate elapsed days
  const getElapsedDays = (dateStr: string) => {
    const start = new Date(dateStr);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // WhatsApp Link Helper
  const getWhatsAppLink = (phoneNo: string, msg: string) => {
    let clean = phoneNo.trim();
    if (clean.startsWith('0')) {
      clean = '964' + clean.substring(1);
    }
    return `https://wa.me/${clean}?text=${encodeURIComponent(msg)}`;
  };

  // Quick prompt to increase/add debt right from the card
  const handleQuickAddDebt = (debt: Debt, e: React.MouseEvent) => {
    e.stopPropagation(); // prevent opening detailed page
    setQuickAddDebtTarget(debt);
    setQuickAddAmount('');
    setQuickAddNotes('');
    setQuickAddDate(new Date().toISOString().split('T')[0]);
    setIsQuickAddModalOpen(true);
  };

  const handleSaveQuickAddDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAddDebtTarget) return;

    const amountNum = parseFloat(quickAddAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      showToast('يرجى إدخال مبلغ صحيح أكبر من الصفر', 'error');
      return;
    }

    const notesStr = quickAddNotes.trim() || 'إضافة دين جديد مباشر';
    const nowStr = new Date().toISOString();
    const newTx: DebtTransaction = {
      id: 'tx-' + uid(),
      type: 'purchase',
      date: quickAddDate || nowStr.split('T')[0],
      amount: amountNum,
      notes: notesStr,
      createdAt: nowStr
    };

    const updatedTxs = [...(quickAddDebtTarget.transactions || []), newTx];
    const newTotalAmount = quickAddDebtTarget.totalAmount + amountNum;
    const remaining = newTotalAmount - quickAddDebtTarget.paidAmount;

    let newStatus: Debt['status'] = quickAddDebtTarget.status;
    if (remaining > 0) {
      newStatus = quickAddDebtTarget.paidAmount > 0 ? 'partially_paid' : 'pending';
    }

    const updatedDebt: Debt = {
      ...quickAddDebtTarget,
      totalAmount: newTotalAmount,
      status: newStatus,
      updatedAt: nowStr,
      transactions: updatedTxs,
      lastPurchaseDate: quickAddDate || nowStr.split('T')[0],
      lastPurchaseAmount: amountNum
    };

    try {
      await putInStore('debts', updatedDebt);
      showToast(`تمت إضافة مبلغ ${fmtIQD(amountNum)} للدين بنجاح. المجموع الجديد: ${fmtIQD(newTotalAmount)}`, 'success');
      setIsQuickAddModalOpen(false);
      setQuickAddDebtTarget(null);
      loadDebts();
    } catch (err) {
      showToast('فشل تحديث الدين في قاعدة البيانات', 'error');
      console.error(err);
    }
  };

  // Aggregated calculations for Smart Dashboard
  const debtsToMe = debts.filter((d) => d.type === 'to_me');
  const debtsByMe = debts.filter((d) => d.type === 'by_me');

  const totalToMe = debtsToMe.reduce((sum, d) => sum + d.totalAmount, 0);
  const totalToMePaid = debtsToMe.reduce((sum, d) => sum + d.paidAmount, 0);
  const totalToMeRemaining = totalToMe - totalToMePaid;

  const totalByMe = debtsByMe.reduce((sum, d) => sum + d.totalAmount, 0);
  const totalByMePaid = debtsByMe.reduce((sum, d) => sum + d.paidAmount, 0);
  const totalByMeRemaining = totalByMe - totalByMePaid;

  const netBalance = totalToMeRemaining - totalByMeRemaining;

  // Handles adding/editing debt
  const handleSubmitDebt = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!personName.trim()) {
      showToast('يرجى إدخال اسم الشخص المطلوب', 'error');
      return;
    }

    const total = parseFloat(totalAmount) || 0;
    const paid = parseFloat(paidAmount) || 0;

    if (total <= 0) {
      showToast('يجب أن يكون مبلغ الدين أكبر من الصفر', 'error');
      return;
    }

    if (paid > total) {
      showToast('المبلغ المسدد لا يمكن أن يتجاوز مبلغ الدين الكلي', 'error');
      return;
    }

    // Auto calculate status
    let autoStatus: Debt['status'] = 'pending';
    if (paid >= total) {
      autoStatus = 'paid';
    } else if (paid > 0) {
      autoStatus = 'partially_paid';
    }

    // Check if overdue
    if (autoStatus !== 'paid' && dueDate) {
      const today = new Date().toISOString().split('T')[0];
      if (dueDate < today) {
        autoStatus = 'overdue';
      }
    }

    const nowStr = new Date().toISOString();

    const debtData: Debt = {
      id: editingDebt ? editingDebt.id : 'debt-' + uid(),
      personName: personName.trim(),
      phone: phone.trim() || undefined,
      type,
      totalAmount: total,
      paidAmount: paid,
      dueDate: dueDate || undefined,
      status: autoStatus,
      priority,
      notes: notes.trim() || undefined,
      createdAt: editingDebt ? editingDebt.createdAt : nowStr,
      updatedAt: nowStr,
      transactions: editingDebt ? editingDebt.transactions || [] : [],
      notifications: editingDebt ? editingDebt.notifications || [] : [],
      monthlyPurchaseLimit: parseFloat(monthlyPurchaseLimit) || 1000000,
      targetMonthlyPayment: parseFloat(targetMonthlyPayment) || 150000
    };

    // Synthesize transaction if creating new and total > 0
    if (!editingDebt) {
      const initialPurchaseTx: DebtTransaction = {
        id: 'tx-' + uid(),
        type: 'purchase',
        date: nowStr.split('T')[0],
        amount: total,
        notes: notes.trim() || 'قيد الدين الافتتاحي المباشر',
        createdAt: nowStr
      };
      debtData.transactions = [initialPurchaseTx];

      if (paid > 0) {
        const initialPaymentTx: DebtTransaction = {
          id: 'tx-' + uid(),
          type: 'payment',
          date: nowStr.split('T')[0],
          amount: paid,
          notes: 'الدفعة الأولى المدفوعة عند التأسيس',
          createdAt: nowStr
        };
        debtData.transactions.push(initialPaymentTx);
      }
    }

    try {
      await putInStore('debts', debtData);
      showToast(editingDebt ? 'تم تحديث معلومات الدين بنجاح' : 'تم إضافة قيد الدين الجديد بنجاح', 'success');
      setIsFormOpen(false);
      setEditingDebt(null);
      resetForm();
      loadDebts();
    } catch (err) {
      showToast('حدث خطأ أثناء الحفظ بقاعدة البيانات', 'error');
      console.error(err);
    }
  };

  const resetForm = () => {
    setPersonName('');
    setPhone('');
    setType('to_me');
    setTotalAmount('');
    setPaidAmount('');
    setDueDate('');
    setPriority('medium');
    setNotes('');
    setMonthlyPurchaseLimit('1000000');
    setTargetMonthlyPayment('150000');
  };

  // Open Edit Form
  const handleEditClick = (debt: Debt, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingDebt(debt);
    setPersonName(debt.personName);
    setPhone(debt.phone || '');
    setType(debt.type);
    setTotalAmount(debt.totalAmount.toString());
    setPaidAmount(debt.paidAmount.toString());
    setDueDate(debt.dueDate || '');
    setPriority(debt.priority);
    setNotes(debt.notes || '');
    setMonthlyPurchaseLimit((debt.monthlyPurchaseLimit || 1000000).toString());
    setTargetMonthlyPayment((debt.targetMonthlyPayment || 150000).toString());
    setIsFormOpen(true);
  };

  // Handle Delete
  const handleDeleteDebt = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (window.confirm('هل أنت متأكد تماماً من حذف قيد الدين هذا بشكل نهائي؟ سيمحى كل سجل المعاملات المرتبط به.')) {
      try {
        await deleteFromStore('debts', id);
        showToast('تم حذف قيد الدين بنجاح', 'success');
        if (selectedDebt && selectedDebt.id === id) {
          setSelectedDebt(null);
        }
        loadDebts();
      } catch (err) {
        showToast('فشل حذف قيد الدين', 'error');
        console.error(err);
      }
    }
  };

  // Add a new ledger transaction (Purchase or Payment) in the workspace
  const handleAddTransaction = async (txType: 'purchase' | 'payment') => {
    if (!selectedDebt) return;

    const amt = parseFloat(actionAmount) || 0;
    if (amt <= 0) {
      showToast('يرجى كتابة مبلغ معاملة صحيح أكبر من الصفر', 'error');
      return;
    }

    if (txType === 'payment') {
      const remaining = selectedDebt.totalAmount - selectedDebt.paidAmount;
      if (amt > remaining) {
        showToast(`لا يمكن دفع مبلغ أكبر من الرصيد المتبقي وهو: ${fmtIQD(remaining)}`, 'error');
        return;
      }
    }

    const nowStr = new Date().toISOString();
    const newTx: DebtTransaction = {
      id: editingTransaction ? editingTransaction.id : 'tx-' + uid(),
      type: txType,
      date: actionDate || nowStr.split('T')[0],
      amount: amt,
      notes: actionNotes.trim() || undefined,
      createdAt: editingTransaction ? editingTransaction.createdAt : nowStr
    };

    let updatedTxs = [...(selectedDebt.transactions || [])];
    if (editingTransaction) {
      updatedTxs = updatedTxs.map(t => t.id === editingTransaction.id ? newTx : t);
    } else {
      updatedTxs.push(newTx);
    }

    // Recalculate totalAmount and paidAmount based on full ledger!
    const calculatedTotal = updatedTxs
      .filter((t) => t.type === 'purchase')
      .reduce((sum, t) => sum + t.amount, 0);

    const calculatedPaid = updatedTxs
      .filter((t) => t.type === 'payment')
      .reduce((sum, t) => sum + t.amount, 0);

    const remaining = calculatedTotal - calculatedPaid;

    let newStatus: Debt['status'] = 'pending';
    if (calculatedPaid >= calculatedTotal) {
      newStatus = 'paid';
    } else if (calculatedPaid > 0) {
      newStatus = 'partially_paid';
    }

    if (newStatus !== 'paid' && selectedDebt.dueDate) {
      const today = new Date().toISOString().split('T')[0];
      if (selectedDebt.dueDate < today) {
        newStatus = 'overdue';
      }
    }

    const updatedDebt: Debt = {
      ...selectedDebt,
      totalAmount: calculatedTotal,
      paidAmount: calculatedPaid,
      status: newStatus,
      updatedAt: nowStr,
      transactions: updatedTxs,
      lastPurchaseDate: txType === 'purchase' ? (actionDate || nowStr.split('T')[0]) : selectedDebt.lastPurchaseDate,
      lastPurchaseAmount: txType === 'purchase' ? amt : selectedDebt.lastPurchaseAmount
    };

    try {
      await putInStore('debts', updatedDebt);
      showToast(editingTransaction ? 'تم تعديل القيد وتحديث الدفاتر تلقائياً' : 'تم تسجيل المعاملة بنجاح وتحديث الأرصدة', 'success');
      
      // Close Modals
      setIsPurchaseModalOpen(false);
      setIsPaymentModalOpen(false);
      setEditingTransaction(null);
      
      // Clear action inputs
      setActionAmount('');
      setActionNotes('');
      setActionDate(new Date().toISOString().split('T')[0]);
      
      loadDebts();
    } catch (err) {
      showToast('فشل تحديث المعاملة في قاعدة البيانات', 'error');
      console.error(err);
    }
  };

  // Delete a specific transaction from the workspace ledger
  const handleDeleteTransaction = async (tx: DebtTransaction) => {
    if (!selectedDebt) return;
    if (!window.confirm('هل أنت متأكد من حذف هذه المعاملة؟ سيتم إعادة حساب إجمالي الدين والمدفوع بالكامل.')) return;

    const updatedTxs = (selectedDebt.transactions || []).filter((t) => t.id !== tx.id);

    // Recalculate based on surviving ledger
    const calculatedTotal = updatedTxs
      .filter((t) => t.type === 'purchase')
      .reduce((sum, t) => sum + t.amount, 0);

    const calculatedPaid = updatedTxs
      .filter((t) => t.type === 'payment')
      .reduce((sum, t) => sum + t.amount, 0);

    const remaining = calculatedTotal - calculatedPaid;

    let newStatus: Debt['status'] = 'pending';
    if (calculatedPaid >= calculatedTotal) {
      newStatus = 'paid';
    } else if (calculatedPaid > 0) {
      newStatus = 'partially_paid';
    }

    if (newStatus !== 'paid' && selectedDebt.dueDate) {
      const today = new Date().toISOString().split('T')[0];
      if (selectedDebt.dueDate < today) {
        newStatus = 'overdue';
      }
    }

    // Determine new last purchase values if we deleted a purchase
    const lastPurchase = [...updatedTxs]
      .filter(t => t.type === 'purchase')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

    const updatedDebt: Debt = {
      ...selectedDebt,
      totalAmount: calculatedTotal,
      paidAmount: calculatedPaid,
      status: newStatus,
      updatedAt: new Date().toISOString(),
      transactions: updatedTxs,
      lastPurchaseDate: lastPurchase ? lastPurchase.date : undefined,
      lastPurchaseAmount: lastPurchase ? lastPurchase.amount : undefined
    };

    try {
      await putInStore('debts', updatedDebt);
      showToast('تم حذف القيد وإعادة موازنة الدفاتر بنجاح', 'success');
      loadDebts();
    } catch (err) {
      showToast('فشل حذف الحركة المالية', 'error');
      console.error(err);
    }
  };

  // Update inline custom values: monthlyPurchaseLimit, targetMonthlyPayment
  const handleUpdateLimitOrTarget = async (field: 'monthlyPurchaseLimit' | 'targetMonthlyPayment', newVal: number) => {
    if (!selectedDebt) return;

    const updatedDebt: Debt = {
      ...selectedDebt,
      [field]: newVal,
      updatedAt: new Date().toISOString()
    };

    try {
      await putInStore('debts', updatedDebt);
      showToast('تم الحفظ والتحديث المالي بنجاح', 'success');
      loadDebts();
    } catch (err) {
      showToast('فشل الحفظ', 'error');
      console.error(err);
    }
  };

  // Dynamic template text generators (70 items of variables, formulas & presets)
  // Define 35 Dynamic Variables & Formula Presets to display in our panel
  const templateVariables = [
    { code: '[اسم_الشخص]', desc: 'الاسم الكامل للمدين' },
    { code: '[رقم_الهاتف]', desc: 'الهاتف المسجل للمطالبة' },
    { code: '[المبلغ_الكلي]', desc: 'المبلغ الإجمالي للدين' },
    { code: '[المبلغ_المسدد]', desc: 'المجموع الذي تم تسديده' },
    { code: '[المبلغ_المتبقي]', desc: 'المبلغ المتبقي المطلوب' },
    { code: '[نوع_الدين]', desc: 'دين لي أو دين عليّ' },
    { code: '[تاريخ_الاستحقاق]', desc: 'الموعد النهائي للسداد' },
    { code: '[الشراء_الشهري]', desc: 'الميزانية التقديرية القصوى' },
    { code: '[المتبقي_من_الشراء]', desc: 'المتبقي من سقف الشراء الشهري' },
    { code: '[المطلوب_شهريا]', desc: 'المبلغ المطلوب دفعه شهرياً' },
    { code: '[أولوية_الدين]', desc: 'درجة الاستعجال والخطورة' },
    { code: '[تاريخ_آخر_تسديد]', desc: 'تاريخ آخر دفعة تم استلامها' },
    { code: '[أيام_منذ_آخر_تسديد]', desc: 'عدد الأيام منذ آخر تسديد' },
    { code: '[تاريخ_آخر_شراء]', desc: 'تاريخ آخر شراء مسجل' },
    { code: '[مبلغ_آخر_شراء]', desc: 'مبلغ آخر عملية شراء' },
    { code: '[أيام_منذ_آخر_شراء]', desc: 'عدد الأيام منذ آخر شراء' },
    { code: '[اسم_المكتب]', desc: 'مكتب فقار العمشاني للتجارة' },
    { code: '[تاريخ_اليوم]', desc: 'تاريخ المعاملة الحالي' }
  ];

  const templateFormulas = [
    { name: 'كشف حساب دقيق 📊', text: 'السلام عليكم ورحمة الله، كشف حساب مستمر لـ [اسم_الشخص]: الدين الكلي هو [المبلغ_الكلي]، مجموع المسدد [المبلغ_المسدد]، المتبقي بذمتكم هو [المبلغ_المتبقي]. شاكرين التزامكم.' },
    { name: 'تنبيه سقف الشراء 🛒', text: 'زبوننا المحترم [اسم_الشخص]، تذكير بخصوص الشراء الشهري من المحل: سقفكم هو [الشراء_الشهر]. الباقي المتاح للشراء هذا الشهر هو [المتبقي_من_الشراء] لتفادي تراكم الديون.' },
    { name: 'طلب تسديد القسط الموصى به 💸', text: 'مرحباً [اسم_الشخص]، نود تذكيركم بالمبلغ المطلوب تسديده شهرياً لعدم تراكم الديون ومقداره [المطلوب_شهريا]. نرجو تسديده بأقرب فرصة.' },
    { name: 'إنذار متأخر عاجل جداً ⚠️', text: 'إنذار عاجل لـ [اسم_الشخص]! بذمتكم دين عاجل جداً بمبلغ [المبلغ_المتبقي] متأخر منذ [أيام_منذ_آخر_تسديد] يوماً عن آخر تسديد. يرجى تصفية الحساب فوراً لتجنب الإجراءات.' },
    { name: 'إيصال استلام سداد ختامي 🎉', text: 'تم بحمد الله استلام سداد من [اسم_الشخص] بمبلغ [مبلغ_آخر_شراء] بتاريخ [تاريخ_اليوم]. مجموع المسدد الكلي هو [المبلغ_المسدد] والمتبقي للصفر هو [المبلغ_المتبقي].' },
    { name: 'تقرير المركز المالي للديون المستمر 📁', text: 'تقرير الديون لـ [اسم_الشخص]: [نوع_الدين]. سقف الشراء الشهري: [الشراء_الشهري]، المتبقي منه: [المتبقي_من_الشراء]، المطلوب سداده شهرياً: [المطلوب_شهريا]، آخر عملية شراء بتاريخ [تاريخ_آخر_شراء] بمبلغ [مبلغ_آخر_شراء].' }
  ];

  // Helper replacing placeholders in string
  const compileTemplate = (text: string, debt: Debt) => {
    if (!debt) return text;
    const remaining = debt.totalAmount - debt.paidAmount;
    const monthlyLimit = debt.monthlyPurchaseLimit || 1000000;
    const remainingLimit = Math.max(0, monthlyLimit - remaining);
    
    // Find last payment and purchase from ledger
    const paymentsTxs = (debt.transactions || []).filter(t => t.type === 'payment');
    const lastPayment = paymentsTxs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
    const daysSincePayment = lastPayment ? getElapsedDays(lastPayment.date) : 0;

    const purchaseTxs = (debt.transactions || []).filter(t => t.type === 'purchase');
    const lastPurchase = purchaseTxs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
    const daysSincePurchase = lastPurchase ? getElapsedDays(lastPurchase.date) : 0;

    let res = text;
    res = res.replaceAll('[اسم_الشخص]', debt.personName);
    res = res.replaceAll('[رقم_الهاتف]', debt.phone || 'غير مسجل');
    res = res.replaceAll('[المبلغ_الكلي]', fmtIQD(debt.totalAmount));
    res = res.replaceAll('[المبلغ_المسدد]', fmtIQD(debt.paidAmount));
    res = res.replaceAll('[المبلغ_المتبقي]', fmtIQD(remaining));
    res = res.replaceAll('[نوع_الدين]', debt.type === 'to_me' ? 'دين لي بذمتكم' : 'دين عليّ لصالحكم');
    res = res.replaceAll('[تاريخ_الاستحقاق]', debt.dueDate || 'مفتوح');
    res = res.replaceAll('[الشراء_الشهري]', fmtIQD(monthlyLimit));
    res = res.replaceAll('[المتبقي_من_الشراء]', fmtIQD(remainingLimit));
    res = res.replaceAll('[المطلوب_شهريا]', fmtIQD(debt.targetMonthlyPayment || 150000));
    res = res.replaceAll('[أولوية_الدين]', debt.priority === 'critical' ? 'عاجلة جداً 🔥' : debt.priority === 'high' ? 'عالية' : 'عادية');
    res = res.replaceAll('[تاريخ_آخر_تسديد]', lastPayment ? lastPayment.date : 'لا يوجد سداد');
    res = res.replaceAll('[أيام_منذ_آخر_تسديد]', lastPayment ? `${daysSincePayment} يوم` : '0 أيام');
    res = res.replaceAll('[تاريخ_آخر_شراء]', lastPurchase ? lastPurchase.date : 'لا يوجد شراء');
    res = res.replaceAll('[مبلغ_آخر_شراء]', lastPurchase ? fmtIQD(lastPurchase.amount) : '0 د.ع');
    res = res.replaceAll('[أيام_منذ_آخر_شراء]', lastPurchase ? `${daysSincePurchase} يوم` : '0 أيام');
    res = res.replaceAll('[اسم_المكتب]', 'مكتب فقار العمشاني للتجارة');
    res = res.replaceAll('[تاريخ_اليوم]', new Date().toLocaleDateString('ar-IQ'));
    
    return res;
  };

  // Create a customized template notification and log it in the database
  const handleSaveTemplateNotification = async () => {
    if (!selectedDebt || !templateText.trim() || !templateSubject.trim()) {
      showToast('يرجى كتابة عنوان للتذكير ونص الرسالة أولاً', 'error');
      return;
    }

    const compiled = compileTemplate(templateText, selectedDebt);

    const newNotif: DebtNotification = {
      id: 'notif-' + uid(),
      debtId: selectedDebt.id,
      type: templateType,
      title: templateSubject.trim(),
      body: compiled,
      status: 'active',
      createdAt: new Date().toISOString()
    };

    const updatedNotifs = [newNotif, ...(selectedDebt.notifications || [])];

    const updatedDebt: Debt = {
      ...selectedDebt,
      notifications: updatedNotifs,
      updatedAt: new Date().toISOString()
    };

    try {
      await putInStore('debts', updatedDebt);
      showToast(templateType === 'reminder' ? 'تم إنشاء وحفظ التذكير بنجاح' : 'تم إنشاء وحفظ التقرير بنجاح', 'success');
      
      // Reset builders
      setTemplateText('');
      setTemplateSubject('');
      setIsReminderTemplateOpen(false);
      setIsReportTemplateOpen(false);

      loadDebts();
    } catch (err) {
      showToast('فشل حفظ الإشعار في قاعدة البيانات', 'error');
      console.error(err);
    }
  };

  // Toggle/Delete Notification record (hide/disable/delete)
  const handleToggleNotificationStatus = async (notifId: string, action: 'toggle' | 'delete') => {
    if (!selectedDebt) return;

    let updatedNotifs = [...(selectedDebt.notifications || [])];

    if (action === 'delete') {
      if (!window.confirm('هل أنت متأكد من حذف هذا السجل بشكل نهائي؟')) return;
      updatedNotifs = updatedNotifs.filter(n => n.id !== notifId);
    } else {
      updatedNotifs = updatedNotifs.map(n => {
        if (n.id === notifId) {
          return {
            ...n,
            status: n.status === 'active' ? 'disabled' : 'active'
          };
        }
        return n;
      });
    }

    const updatedDebt: Debt = {
      ...selectedDebt,
      notifications: updatedNotifs,
      updatedAt: new Date().toISOString()
    };

    try {
      await putInStore('debts', updatedDebt);
      showToast(action === 'delete' ? 'تم حذف السجل بنجاح' : 'تم تغيير حالة الإشعار/التذكير بنجاح', 'success');
      loadDebts();
    } catch (err) {
      showToast('فشل التحديث في قاعدة البيانات', 'error');
      console.error(err);
    }
  };

  // Share a compiled notification directly on WhatsApp
  const handleWhatsAppShare = (d: Debt) => {
    if (!d.phone) {
      showToast('يرجى تسجيل رقم هاتف المدين أولاً لتتمكن من الإرسال عبر واتساب', 'error');
      return;
    }
    const remaining = d.totalAmount - d.paidAmount;
    const msg = `السلام عليكم ورحمة الله وبركاته، عزيزي ${d.personName}. يرجى العلم بأن كشف حسابكم الحالي كالتالي:\n- الدين الكلي المتراكم: ${fmtIQD(d.totalAmount)}\n- مجموع المبلغ المسدد: ${fmtIQD(d.paidAmount)}\n- الرصيد المتبقي بذمتكم: ${fmtIQD(remaining)}\n\nشاكرين التزامكم وسدادكم المستمر.`;
    window.open(getWhatsAppLink(d.phone, msg), '_blank');
  };

  const handleShareNotificationWhatsApp = (notif: DebtNotification) => {
    if (!selectedDebt?.phone) {
      showToast('يرجى تسجيل رقم هاتف للمدين أولاً لتتمكن من الإرسال عبر واتساب', 'error');
      return;
    }
    window.open(getWhatsAppLink(selectedDebt.phone, notif.body), '_blank');
  };

  // Filters logic for debts listing
  const filteredDebts = debts.filter((d) => {
    const matchesSearch =
      d.personName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (d.phone && d.phone.includes(searchTerm)) ||
      (d.notes && d.notes.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesType = filterType === 'all' || d.type === filterType;
    const matchesPriority = filterPriority === 'all' || d.priority === filterPriority;
    const matchesStatus = filterStatus === 'all' || d.status === filterStatus;

    return matchesSearch && matchesType && matchesPriority && matchesStatus;
  });

  // Calculate stats for selected debt in workspace
  const getSelectedDebtStats = () => {
    if (!selectedDebt) return { remaining: 0, daysSincePayment: 0, lastPaymentAmount: 0, lastPurchaseDate: '', lastPurchaseAmount: 0, remainingLimit: 0 };
    
    const remaining = selectedDebt.totalAmount - selectedDebt.paidAmount;
    
    const paymentsTxs = (selectedDebt.transactions || []).filter(t => t.type === 'payment');
    const sortedPayments = [...paymentsTxs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const lastPayment = sortedPayments[0];
    const daysSincePayment = lastPayment ? getElapsedDays(lastPayment.date) : 0;
    
    const purchaseTxs = (selectedDebt.transactions || []).filter(t => t.type === 'purchase');
    const sortedPurchases = [...purchaseTxs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const lastPurchase = sortedPurchases[0];
    
    const limit = selectedDebt.monthlyPurchaseLimit || 1000000;
    const remainingLimit = Math.max(0, limit - remaining);

    return {
      remaining,
      daysSincePayment,
      lastPaymentAmount: lastPayment ? lastPayment.amount : 0,
      lastPurchaseDate: lastPurchase ? lastPurchase.date : 'لا يوجد شراء سابق',
      lastPurchaseAmount: lastPurchase ? lastPurchase.amount : 0,
      remainingLimit
    };
  };

  const selectedStats = getSelectedDebtStats();

  return (
    <div className="flex flex-col gap-6" dir="rtl">
      
      {/* SECTION A: DETAILED DEBT WORKSPACE PAGE (صفحة الدين المستقلة) */}
      {selectedDebt ? (
        <div className="flex flex-col gap-6 animate-fade-in">
          
          {/* Header Title with Back button */}
          <div className="flex items-center justify-between border-b border-white/5 pb-4 select-none">
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setSelectedDebt(null)}
                className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer transition-all hover:bg-white/10"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <span>الملف المالي المستمر للمدين والمطالبات</span>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold border ${
                    selectedDebt.priority === 'critical' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  }`}>
                    {selectedDebt.priority === 'critical' ? 'عاجل جداً' : 'قيد مستمر'}
                  </span>
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">تتبع سقف الشراء الشهري، التسديدات الدورية، الفواتير، والتقارير القانونية</p>
              </div>
            </div>

            {/* Quick edit or delete */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleEditClick(selectedDebt)}
                className="h-10 px-3 rounded-xl bg-white/5 border border-white/5 text-zinc-300 hover:text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
              >
                <Edit2 className="w-3.5 h-3.5 text-amber-500" />
                <span>تعديل الملف الأساسي</span>
              </button>
              <button
                onClick={() => handleDeleteDebt(selectedDebt.id)}
                className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/15 text-rose-500 hover:bg-rose-500/20 flex items-center justify-center cursor-pointer transition-all"
                title="حذف الملف نهائياً"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 🌟 الكتلة الأولى: المستطيل المالي الكبير (The Primary Financial Block) */}
          <div className="bg-[#121214] border border-amber-500/10 rounded-3xl p-6 relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 w-44 h-44 bg-amber-500/[0.02] rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-44 h-44 bg-emerald-500/[0.02] rounded-full blur-3xl pointer-events-none" />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
              
              {/* القسم الأيمن: معلومات الشخص وميزانية الشراء */}
              <div className="flex flex-col justify-between gap-4 border-l border-white/5 pl-6 md:border-l md:pl-6 border-b md:border-b-0 pb-4 md:pb-0">
                <div>
                  <h3 className="text-base font-extrabold text-white select-all">{selectedDebt.personName}</h3>
                  <div className="text-zinc-400 text-xs mt-1 font-mono flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-zinc-500" />
                    <span className="select-all">{selectedDebt.phone || 'رقم الهاتف غير مسجل'}</span>
                  </div>

                  {/* أزرار الاتصال والمطالبة */}
                  {selectedDebt.phone && (
                    <div className="flex items-center gap-1.5 mt-3 select-none">
                      <a
                        href={`tel:${selectedDebt.phone}`}
                        className="h-8 px-3 rounded-lg bg-white/5 border border-white/5 text-zinc-300 hover:text-white flex items-center gap-1.5 text-[10px] font-bold cursor-pointer transition-colors"
                      >
                        <Phone className="w-3 h-3" />
                        <span>اتصال هاتفي</span>
                      </a>
                      <button
                        onClick={() => handleWhatsAppShare(selectedDebt)}
                        className="h-8 px-3 rounded-lg bg-emerald-500/10 border border-emerald-500/15 text-emerald-400 hover:bg-emerald-500/20 flex items-center gap-1 text-[10px] font-bold cursor-pointer transition-colors"
                      >
                        <MessageCircle className="w-3 h-3" />
                        <span>إرسال كشف حساب</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* ميزانية القدرة على الشراء من المحل */}
                <div className="bg-white/[0.02] border border-white/5 p-3 rounded-2xl">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold text-zinc-500">الشراء الشهري (سقف الائتمان)</span>
                    <button
                      onClick={() => {
                        const limit = window.prompt('أدخل سقف الشراء الشهري الجديد بالدينار العراقي:', selectedDebt.monthlyPurchaseLimit?.toString());
                        if (limit) {
                          const val = parseFloat(limit);
                          if (!isNaN(val)) handleUpdateLimitOrTarget('monthlyPurchaseLimit', val);
                        }
                      }}
                      className="text-[10px] text-amber-500 hover:text-amber-400 flex items-center gap-1 font-extrabold cursor-pointer"
                    >
                      <Edit2 className="w-2.5 h-2.5" />
                      <span>تعديل السقف</span>
                    </button>
                  </div>
                  <div className="flex items-baseline gap-1.5 mb-1">
                    <span className="text-sm font-black text-white">{fmtIQD(selectedDebt.monthlyPurchaseLimit || 1000000)}</span>
                  </div>
                  
                  {/* المتبقي واصل لحد الشراء الشهري */}
                  <div className="border-t border-white/5 pt-1.5 mt-1.5 flex items-center justify-between">
                    <span className="text-[9px] text-zinc-400">الباقي لحد حد الشراء الشهري:</span>
                    <span className={`text-xs font-black ${selectedStats.remainingLimit > 150000 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {fmtIQD(selectedStats.remainingLimit)}
                    </span>
                  </div>
                </div>
              </div>

              {/* القسم الأوسط: مجموع الذي علي وتاريخ آخر تسديد */}
              <div className="flex flex-col justify-between gap-4 border-l border-white/5 pl-6 md:border-l md:pl-6 border-b md:border-b-0 pb-4 md:pb-0">
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                    {selectedDebt.type === 'by_me' ? 'مجموع الكلي الذي عليّ' : 'مجموع الكلي المطلوب لي'}
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <span className={`text-2xl font-black ${selectedDebt.type === 'by_me' ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {fmtIQD(selectedStats.remaining)}
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-500">
                    من أصل دين كلي متراكم مقداره: {fmtIQD(selectedDebt.totalAmount)}
                  </span>
                </div>

                {/* تاريخ آخر تسديد ومقدار الأيام */}
                <div className="bg-white/[0.01] border border-white/5 p-3 rounded-2xl flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[9px] text-zinc-500 font-bold block mb-0.5">تاريخ آخر تسديد دفعة</span>
                    <span className="text-xs font-black text-white">
                      {(selectedDebt.transactions || []).filter(t => t.type === 'payment').length > 0 
                        ? [...(selectedDebt.transactions || [])].filter(t => t.type === 'payment').sort((a,b)=> new Date(b.date).getTime() - new Date(a.date).getTime())[0].date
                        : 'لا يوجد سداد بعد'}
                    </span>
                  </div>
                  <div className="text-left bg-amber-500/10 text-amber-400 px-2.5 py-1.5 rounded-xl border border-amber-500/20 flex flex-col items-center">
                    <span className="text-base font-black leading-none">{selectedStats.daysSincePayment}</span>
                    <span className="text-[8px] font-bold mt-1">يوم مضى</span>
                  </div>
                </div>
              </div>

              {/* القسم الأيسر: مجموع المسدد والمبلغ المطلوب تسديده شهرياً */}
              <div className="flex flex-col justify-between gap-4">
                <div className="grid grid-cols-2 gap-4">
                  
                  {/* مجموع المسدد */}
                  <div className="bg-white/[0.02] border border-white/5 p-3 rounded-2xl">
                    <span className="text-[9px] text-zinc-500 font-bold block mb-1">مجموع المسدد</span>
                    <span className="text-sm font-black text-emerald-400 block">{fmtIQD(selectedDebt.paidAmount)}</span>
                    <span className="text-[9px] text-zinc-500 font-mono block mt-1">
                      {Math.round(selectedDebt.totalAmount > 0 ? (selectedDebt.paidAmount / selectedDebt.totalAmount) * 100 : 0)}% مسترد
                    </span>
                  </div>

                  {/* المبلغ المطلوب تسديده شهرياً */}
                  <div className="bg-white/[0.02] border border-white/5 p-3 rounded-2xl">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] text-zinc-500 font-bold">المطلوب شهرياً</span>
                      <button
                        onClick={() => {
                          const target = window.prompt('أدخل القسط المستهدف المطلوب دفعه شهرياً لتسوية الحساب:', selectedDebt.targetMonthlyPayment?.toString());
                          if (target) {
                            const val = parseFloat(target);
                            if (!isNaN(val)) handleUpdateLimitOrTarget('targetMonthlyPayment', val);
                          }
                        }}
                        className="text-amber-500 hover:text-amber-400"
                      >
                        <Edit2 className="w-2.5 h-2.5" />
                      </button>
                    </div>
                    <span className="text-sm font-black text-white block">{fmtIQD(selectedDebt.targetMonthlyPayment || 150000)}</span>
                    <span className="text-[9px] text-zinc-400 block mt-1">لتجنب أي ملاحقة مالية</span>
                  </div>

                </div>

                {/* تاريخ آخر شراء وقيمته */}
                <div className="bg-white/[0.01] border border-white/5 p-3 rounded-2xl flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[9px] text-zinc-500 block mb-0.5">تاريخ ومبلغ آخر شراء بالدين</span>
                    <span className="font-extrabold text-white block">
                      {selectedStats.lastPurchaseDate}
                    </span>
                  </div>
                  <span className="font-bold text-rose-400 bg-rose-500/10 px-2 py-1 rounded-lg border border-rose-500/20">
                    {fmtIQD(selectedStats.lastPurchaseAmount)}
                  </span>
                </div>
              </div>

            </div>
          </div>

          {/* 🔘 الكتلة الثانية: شريط الأزرار الفعالة والإشعارات والتقارير */}
          <div className="bg-[#121214]/60 border border-white/5 p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 select-none">
            
            {/* الأزرار الرئيسية لـ إضافة شراء وسداد */}
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              
              <button
                onClick={() => {
                  setEditingTransaction(null);
                  setActionAmount('');
                  setActionNotes('');
                  setActionDate(new Date().toISOString().split('T')[0]);
                  setIsPurchaseModalOpen(true);
                }}
                className="h-10 px-4 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-lg shadow-rose-500/10 transition-colors"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>أضف شراء (دين جديد)</span>
              </button>

              <button
                onClick={() => {
                  setEditingTransaction(null);
                  setActionAmount('');
                  setActionNotes('');
                  setActionDate(new Date().toISOString().split('T')[0]);
                  setIsPaymentModalOpen(true);
                }}
                className="h-10 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-500/10 transition-colors"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>أضف تسديد (دفعة)</span>
              </button>

              <button
                onClick={() => handleWhatsAppShare(selectedDebt)}
                className="h-10 px-3.5 rounded-xl bg-[#25D366]/10 border border-[#25D366]/20 text-[#25D366] hover:bg-[#25D366]/20 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                <span>إرسال كشف واتساب</span>
              </button>

              <button
                onClick={() => {
                  setTemplateType('reminder');
                  setTemplateSubject('تذكير بموعد استحقاق الدفعة المالية');
                  setTemplateText('عزيزي زبوننا [اسم_الشخص]، نود تذكيركم بالالتزام بتسديد القسط الشهري بمبلغ [المطلوب_شهريا] في أقرب وقت. المبلغ المتبقي الإجمالي هو [المبلغ_المتبقي]. شاكرين تعاونكم.');
                  setIsReminderTemplateOpen(true);
                }}
                className="h-10 px-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Bell className="w-4 h-4 text-amber-500" />
                <span>إنشاء تذكير ذكي</span>
              </button>

              <button
                onClick={() => {
                  setTemplateType('report');
                  setTemplateSubject('تقرير المركز المالي للدين المستمر');
                  setTemplateText('مكتب فقار العمشاني للتجارة\n\nتقرير مالي بخصوص الحساب المالي للمشترك: [اسم_الشخص]\nالتاريخ: [تاريخ_اليوم]\nالحالة المالية: [نوع_الدين]\n-------------------------\n• سقف الشراء الشهري: [الشراء_الشهري]\n• الرصيد المستخدم المتبقي: [المبلغ_المتبقي]\n• المبلغ المتاح المتبقي للشراء: [المتبقي_من_الشراء]\n• مجموع المسدد الكلي: [المبلغ_المسدد]\n• تاريخ آخر شراء: [تاريخ_آخر_شراء] بمبلغ [مبلغ_آخر_شراء].\n\nيرجى تسوية المبالغ الدورية.');
                  setIsReportTemplateOpen(true);
                }}
                className="h-10 px-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <FileText className="w-4 h-4 text-blue-400" />
                <span>إنشاء تقرير لواتساب</span>
              </button>

            </div>

            {/* الأزرار المكدسة على اليسار لإدارة التقارير والتذكيرات المنبثقة */}
            <div className="flex md:flex-col gap-2 w-full md:w-auto shrink-0 border-r md:border-r-0 md:border-l border-white/5 pr-4 md:pr-0 md:pl-4 select-none">
              
              <button
                onClick={() => setIsReportsPopupOpen(true)}
                className="flex-1 md:flex-initial h-9 px-4 rounded-xl bg-blue-500 hover:bg-blue-400 text-black font-black text-[11px] flex items-center justify-center gap-1 cursor-pointer transition-colors"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>التقارير ({selectedDebt.notifications?.filter(n=>n.type==='report').length || 0})</span>
              </button>

              <button
                onClick={() => setIsRemindersPopupOpen(true)}
                className="flex-1 md:flex-initial h-9 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-[11px] flex items-center justify-center gap-1 cursor-pointer transition-colors"
              >
                <Bell className="w-3.5 h-3.5" />
                <span>التذكيرات ({selectedDebt.notifications?.filter(n=>n.type==='reminder').length || 0})</span>
              </button>

            </div>

          </div>

          {/* 📊 الكتلتين المتساويتين طولياً (The Splitted Ledger & Action Columns) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            
            {/* الكتلة اليمنى: سجل المشتريات والتسديدات (Transactions List) */}
            <div className="bg-[#121214]/60 border border-white/5 rounded-3xl p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-3 select-none">
                <h3 className="text-xs font-black text-white flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-pulse" />
                  <span>سجل حركات الشراء والتسديدات المستمرة</span>
                </h3>
                <span className="text-[10px] text-zinc-500 font-mono">
                  إجمالي الحركات: {selectedDebt.transactions?.length || 0}
                </span>
              </div>

              <div className="flex flex-col gap-2.5 max-h-[500px] overflow-y-auto pr-1">
                {!selectedDebt.transactions || selectedDebt.transactions.length === 0 ? (
                  <p className="text-zinc-600 text-center py-10 text-xs italic">لا توجد أي حركات شراء أو تسديد في الدفاتر بعد.</p>
                ) : (
                  [...selectedDebt.transactions]
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || b.createdAt.localeCompare(a.createdAt))
                    .map((tx) => {
                      const elapsed = getElapsedDays(tx.date);
                      return (
                        <div
                          key={tx.id}
                          className="bg-[#18181b]/70 border border-white/5 p-3.5 rounded-2xl flex items-center justify-between gap-3 group transition-all hover:border-white/10"
                        >
                          {/* Circle indicators */}
                          <div className="flex items-center gap-3">
                            <span className={`w-3.5 h-3.5 rounded-full shrink-0 border-2 ${
                              tx.type === 'purchase' ? 'bg-rose-500/20 border-rose-500' : 'bg-emerald-500/20 border-emerald-500'
                            }`} />
                            
                            <div>
                              <p className="text-xs font-bold text-white select-all">{tx.notes || (tx.type === 'purchase' ? 'شراء بدين جديد' : 'دفعة مسددة')}</p>
                              <span className="text-[10px] text-zinc-500 font-mono mt-0.5 block">{tx.date}</span>
                            </div>
                          </div>

                          {/* Center: amount and elapsed days */}
                          <div className="flex items-center gap-6">
                            <div className="text-left">
                              <p className={`text-xs font-black ${tx.type === 'purchase' ? 'text-rose-400' : 'text-emerald-400'}`}>
                                {tx.type === 'purchase' ? '+' : '-'}{fmtIQD(tx.amount)}
                              </p>
                              <span className="text-[9px] text-zinc-500 mt-0.5 block">
                                {elapsed === 0 ? 'اليوم' : `منذ ${elapsed} يوماً`}
                              </span>
                            </div>

                            {/* Actions: Edit and Delete */}
                            <div className="flex items-center gap-1 select-none">
                              <button
                                onClick={() => {
                                  setEditingTransaction(tx);
                                  setActionAmount(tx.amount.toString());
                                  setActionNotes(tx.notes || '');
                                  setActionDate(tx.date);
                                  if (tx.type === 'purchase') {
                                    setIsPurchaseModalOpen(true);
                                  } else {
                                    setIsPaymentModalOpen(true);
                                  }
                                }}
                                className="w-7 h-7 rounded-lg bg-white/5 border border-white/5 text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
                                title="تعديل القيد"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => handleDeleteTransaction(tx)}
                                className="w-7 h-7 rounded-lg bg-rose-500/5 border border-rose-500/10 text-rose-500 hover:text-rose-400 flex items-center justify-center cursor-pointer transition-colors"
                                title="حذف القيد"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                        </div>
                      );
                    })
                )}
              </div>
            </div>

            {/* الكتلة اليسرى: التذكيرات والاشعارات والاجراءات المتخذة */}
            <div className="bg-[#121214]/60 border border-white/5 rounded-3xl p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-3 select-none">
                <h3 className="text-xs font-black text-white flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse" />
                  <span>التذكيرات والإشعارات والتقارير الصادرة والنشطة</span>
                </h3>
                <span className="text-[10px] text-zinc-500">
                  إجمالي السجلات: {selectedDebt.notifications?.length || 0}
                </span>
              </div>

              <div className="flex flex-col gap-2.5 max-h-[500px] overflow-y-auto pr-1">
                {!selectedDebt.notifications || selectedDebt.notifications.length === 0 ? (
                  <div className="text-center py-12 text-zinc-600 text-xs italic">
                    لا توجد أي إشعارات أو تذكيرات مخزنة لهذا الدين حالياً. يمكنك إنشاء تذكير أو تقرير بالضغط على الأزرار أعلاه.
                  </div>
                ) : (
                  selectedDebt.notifications.map((notif) => {
                    const elapsed = getElapsedDays(notif.createdAt);
                    const isVisible = notif.status === 'active';

                    return (
                      <div
                        key={notif.id}
                        className={`border p-4 rounded-2xl flex flex-col gap-3 transition-all ${
                          !isVisible 
                            ? 'bg-[#18181b]/30 border-white/5 opacity-50' 
                            : notif.type === 'reminder'
                            ? 'bg-amber-500/[0.02] border-amber-500/10'
                            : 'bg-blue-500/[0.02] border-blue-500/10'
                        }`}
                      >
                        
                        {/* Header notif info */}
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${notif.type === 'reminder' ? 'bg-amber-500' : 'bg-blue-500'}`} />
                            <span className="text-xs font-bold text-white select-all">{notif.title}</span>
                          </div>

                          <div className="flex items-center gap-1.5 select-none">
                            {/* WhatsApp share */}
                            <button
                              onClick={() => handleShareNotificationWhatsApp(notif)}
                              className="h-7 px-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/15 text-emerald-400 hover:bg-emerald-500/20 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                              title="إرسال عبر واتساب"
                            >
                              <Send className="w-3 h-3" />
                              <span>إرسال</span>
                            </button>

                            {/* Toggle active / disabled */}
                            <button
                              onClick={() => handleToggleNotificationStatus(notif.id, 'toggle')}
                              className="w-7 h-7 rounded-lg bg-white/5 border border-white/5 text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
                              title={isVisible ? 'تعطيل أو إخفاء الإشعار' : 'تفعيل الإشعار'}
                            >
                              {isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                            </button>

                            {/* Delete */}
                            <button
                              onClick={() => handleToggleNotificationStatus(notif.id, 'delete')}
                              className="w-7 h-7 rounded-lg bg-rose-500/5 border border-rose-500/10 text-rose-500 hover:text-rose-400 flex items-center justify-center cursor-pointer transition-colors"
                              title="حذف نهائي"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        {/* Body text */}
                        <div className="bg-[#18181b]/50 p-3 rounded-xl border border-white/5 text-[11px] text-zinc-300 leading-relaxed whitespace-pre-wrap select-all">
                          {notif.body}
                        </div>

                        {/* Footer time elapsed */}
                        <div className="flex items-center justify-between text-[9px] text-zinc-500 font-mono select-none">
                          <span>النوع: {notif.type === 'reminder' ? 'تذكير مالي' : 'تقرير حساب'}</span>
                          <span>{elapsed === 0 ? 'اليوم' : `أنشئ منذ ${elapsed} يوماً`}</span>
                        </div>

                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>

        </div>
      ) : (
        
        // SECTION B: MAIN DEBTS LIST VIEW (دفتر الديون والأمانات الرئيسي)
        <div className="flex flex-col gap-6">
          
          {/* Page Title & Add Button */}
          <div className="flex items-center justify-between select-none">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white">دفتر الديون والأمانات العامة</h2>
              <p className="text-xs text-zinc-400 mt-1">تتبع الديون التي لك والديون التي عليك بمخططات ذكية وقوائم تسديد مرنة</p>
            </div>
            <button
              onClick={() => {
                setEditingDebt(null);
                resetForm();
                setIsFormOpen(true);
              }}
              className="h-10 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-lg shadow-amber-500/10 transition-all duration-200 active:scale-[0.97]"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>إضافة دين جديد</span>
            </button>
          </div>

          {/* 📊 اللوحة الذكية الذكية (Smart Financial Dashboard) */}
          <div className="bg-[#121214]/60 border border-white/5 rounded-[22px] p-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
            
            <h3 className="text-xs font-bold text-zinc-400 mb-4 flex items-center gap-2 select-none">
              <Scale className="w-4 h-4 text-amber-500 animate-pulse" />
              <span>اللوحة الذكية لتحليل المركز المالي للديون</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Card 1: الديون التي لي (الديون الخارجية المستحقة) */}
              <div className="bg-[#18181b]/60 border border-white/5 rounded-xl p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-zinc-400">ديون لي (أطلبهم دين)</span>
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                  </div>
                  <p className="text-lg font-black text-emerald-400 tracking-tight">{fmtIQD(totalToMeRemaining)}</p>
                </div>
                <div className="mt-4 border-t border-white/5 pt-2 flex items-center justify-between text-[10px] text-zinc-500">
                  <span>الإجمالي: {fmtIQD(totalToMe)}</span>
                  <span className="text-emerald-500/80 font-mono">المسترد: {Math.round(totalToMe > 0 ? (totalToMePaid / totalToMe) * 100 : 0)}%</span>
                </div>
              </div>

              {/* Card 2: ديون عليّ للناس (الالتزامات المطلوبة) */}
              <div className="bg-[#18181b]/60 border border-white/5 rounded-xl p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-zinc-400">ديون عليّ (يطلبوني دين)</span>
                    <TrendingDown className="w-4 h-4 text-rose-400" />
                  </div>
                  <p className="text-lg font-black text-rose-400 tracking-tight">{fmtIQD(totalByMeRemaining)}</p>
                </div>
                <div className="mt-4 border-t border-white/5 pt-2 flex items-center justify-between text-[10px] text-zinc-500">
                  <span>الإجمالي: {fmtIQD(totalByMe)}</span>
                  <span className="text-rose-400/80 font-mono">المسدد: {Math.round(totalByMe > 0 ? (totalByMePaid / totalByMe) * 100 : 0)}%</span>
                </div>
              </div>

              {/* Card 3: الرصيد المالي الصافي */}
              <div className="bg-[#18181b]/60 border border-white/5 rounded-xl p-4 flex flex-col justify-between md:col-span-1">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-zinc-400">المركز المالي الصافي للدين</span>
                    <Scale className="w-4 h-4 text-amber-500" />
                  </div>
                  <p className={`text-lg font-black tracking-tight ${netBalance >= 0 ? 'text-amber-400' : 'text-rose-500'}`}>
                    {netBalance >= 0 ? '+' : ''}{fmtIQD(netBalance)}
                  </p>
                </div>
                <div className="mt-4 border-t border-white/5 pt-2 text-[10px] text-zinc-500 leading-relaxed text-right">
                  {netBalance >= 0 ? (
                    <span className="text-emerald-400/90 font-medium">رصيدك إيجابي: الديون التي لك تفوق المطلوبة منك</span>
                  ) : (
                    <span className="text-rose-400/90 font-medium">رصيدك سلبي: الالتزامات المالية تفوق الديون التي تطلبها</span>
                  )}
                </div>
              </div>

            </div>
          </div>

          {/* 🔍 Filters & Search */}
          <div className="flex flex-col gap-3 bg-[#121214]/40 border border-white/5 p-4 rounded-2xl select-none">
            
            {/* Search Bar */}
            <div className="relative">
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="البحث باسم الشخص، رقم الهاتف، أو الملاحظات..."
                className="w-full h-10 pr-10 pl-4 rounded-xl bg-[#18181b] border border-white/5 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all text-xs"
              />
            </div>

            {/* Filter Badges Row */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1.5">
              
              {/* Type Filter */}
              <div className="flex items-center gap-1 bg-[#18181b] border border-white/5 rounded-lg px-2 py-1">
                <span className="text-[10px] text-zinc-500">النوع:</span>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as any)}
                  className="bg-transparent text-[11px] font-bold text-zinc-300 focus:outline-none cursor-pointer"
                >
                  <option value="all" className="bg-[#18181b] text-white">الكل</option>
                  <option value="to_me" className="bg-[#18181b] text-emerald-400">دين لي</option>
                  <option value="by_me" className="bg-[#18181b] text-rose-400">دين عليّ</option>
                </select>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1 bg-[#18181b] border border-white/5 rounded-lg px-2 py-1">
                <span className="text-[10px] text-zinc-500">الحالة:</span>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="bg-transparent text-[11px] font-bold text-zinc-300 focus:outline-none cursor-pointer"
                >
                  <option value="all" className="bg-[#18181b] text-white">الكل</option>
                  <option value="pending" className="bg-[#18181b] text-amber-400">غير مسدد</option>
                  <option value="partially_paid" className="bg-[#18181b] text-blue-400">مسدد جزئياً</option>
                  <option value="paid" className="bg-[#18181b] text-emerald-400">مسدد بالكامل</option>
                  <option value="overdue" className="bg-[#18181b] text-rose-500">متأخر</option>
                </select>
              </div>

              {/* Priority Filter */}
              <div className="flex items-center gap-1 bg-[#18181b] border border-white/5 rounded-lg px-2 py-1">
                <span className="text-[10px] text-zinc-500">الأولوية:</span>
                <select
                  value={filterPriority}
                  onChange={(e) => setFilterPriority(e.target.value)}
                  className="bg-transparent text-[11px] font-bold text-zinc-300 focus:outline-none cursor-pointer"
                >
                  <option value="all" className="bg-[#18181b] text-white">الكل</option>
                  <option value="low" className="bg-[#18181b] text-zinc-400">منخفضة</option>
                  <option value="medium" className="bg-[#18181b] text-amber-500">متوسطة</option>
                  <option value="high" className="bg-[#18181b] text-orange-400">عالية</option>
                  <option value="critical" className="bg-[#18181b] text-rose-500">عاجلة جداً</option>
                </select>
              </div>

              {/* Reset Filters button */}
              {(searchTerm || filterType !== 'all' || filterPriority !== 'all' || filterStatus !== 'all') && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setFilterType('all');
                    setFilterPriority('all');
                    setFilterStatus('all');
                  }}
                  className="text-[10px] text-amber-500 hover:text-amber-400 font-bold px-2 py-1 cursor-pointer transition-colors"
                >
                  إعادة تعيين الفلاتر
                </button>
              )}

            </div>
          </div>

          {/* 📋 القائمة الرئيسية لبطاقات الديون */}
          <div className="flex flex-col gap-3">
            {loading ? (
              <div className="text-center py-10 text-zinc-500 text-xs flex flex-col items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                <span>جاري تحميل سجل الديون والملفات المستمرة...</span>
              </div>
            ) : filteredDebts.length === 0 ? (
              <div className="text-center py-12 bg-[#121214]/30 border border-dashed border-white/5 rounded-[22px] text-zinc-500 text-xs">
                {debts.length === 0 ? 'لا يوجد قيود ديون في النظام حالياً.' : 'لا تطابق أي قيود شروط البحث الحالية.'}
              </div>
            ) : (
              filteredDebts.map((d) => {
                const remaining = d.totalAmount - d.paidAmount;
                const progress = d.totalAmount > 0 ? (d.paidAmount / d.totalAmount) * 100 : 0;

                const priorityMap = {
                  low: { text: 'منخفضة', colorClass: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' },
                  medium: { text: 'متوسطة', colorClass: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
                  high: { text: 'عالية', colorClass: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
                  critical: { text: 'عاجل جداً 🔥', colorClass: 'bg-rose-500/15 text-rose-400 border-rose-500/25 animate-pulse' }
                };

                const pInfo = priorityMap[d.priority] || priorityMap.medium;

                const statusMap = {
                  pending: { text: 'غير مسدد', class: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/15' },
                  partially_paid: { text: 'جزئي', class: 'bg-blue-500/10 text-blue-400 border-blue-500/15' },
                  paid: { text: 'مسدد بالكامل', class: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/15' },
                  overdue: { text: 'متأخر ⚠️', class: 'bg-rose-500/10 text-rose-400 border-rose-500/15' }
                };

                const sInfo = statusMap[d.status] || statusMap.pending;

                return (
                  <div
                    key={d.id}
                    onClick={() => setSelectedDebt(d)} // Clickable to open complete continuous workspace page!
                    className={`border rounded-2xl bg-[#121214]/60 p-5 flex flex-col gap-3 transition-all duration-300 cursor-pointer hover:bg-[#121214]/85 hover:border-amber-500/20 ${
                      d.priority === 'critical' && d.status !== 'paid'
                        ? 'border-rose-500/20 shadow-lg shadow-rose-500/5'
                        : 'border-white/5'
                    }`}
                  >
                    
                    {/* Header Info */}
                    <div className="flex items-start justify-between">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-white select-all">{d.personName}</h4>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold border ${pInfo.colorClass}`}>
                            {pInfo.text}
                          </span>
                        </div>
                        <span className={`w-fit text-[10px] font-bold mt-0.5 ${d.type === 'to_me' ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {d.type === 'to_me' ? '← دين لي في ذمتهم' : '→ دين عليَّ لصالحهم'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 select-none">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${sInfo.class}`}>
                          {sInfo.text}
                        </span>
                        
                        {/* ➕ زر دين جديد مباشرة على البطاقة */}
                        <button
                          onClick={(e) => handleQuickAddDebt(d, e)}
                          className="h-7 px-2.5 rounded-lg bg-amber-500 text-black hover:bg-amber-400 font-black text-[10px] flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                          title="إضافة مبلغ دين جديد على الرصيد السابق مباشرة"
                        >
                          <Plus className="w-3 h-3 stroke-[3]" />
                          <span>دين جديد</span>
                        </button>
                      </div>
                    </div>

                    {/* Quick Financial Summary */}
                    <div className="grid grid-cols-3 gap-3 border-t border-b border-white/5 py-3 text-xs">
                      <div>
                        <span className="text-zinc-500 block text-[9px] mb-0.5">الدين الكلي</span>
                        <span className="font-bold text-white font-mono">{fmtIQD(d.totalAmount)}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block text-[9px] mb-0.5">المسدد الكلي</span>
                        <span className="font-bold text-emerald-400 font-mono">{fmtIQD(d.paidAmount)}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block text-[9px] mb-0.5">المتبقي الصافي</span>
                        <span className={`font-bold font-mono ${remaining > 0 ? 'text-rose-400' : 'text-zinc-500'}`}>{fmtIQD(remaining)}</span>
                      </div>
                    </div>

                    {/* Progress indicator */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-[9px] font-semibold text-zinc-500">
                        <span>نسبة الاسترداد المستهدفة</span>
                        <span className="font-mono text-emerald-400">{Math.round(progress)}%</span>
                      </div>
                      <div className="w-full h-1 bg-[#18181b] rounded-full overflow-hidden">
                        <div
                          style={{ width: `${Math.min(100, progress)}%` }}
                          className={`h-full rounded-full transition-all duration-500 ${
                            d.type === 'to_me' ? 'bg-emerald-500' : 'bg-rose-500'
                          }`}
                        />
                      </div>
                    </div>

                    {/* Card Footer prompt */}
                    <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-1 select-none">
                      <span>انقر لفتح الملف المالي الثابت للتسديد والمستندات</span>
                      <ChevronLeft className="w-4 h-4 text-zinc-500" />
                    </div>

                  </div>
                );
              })
            )}
          </div>

        </div>
      )}

      {/* 📥 MODAL 1: ADD/EDIT MAIN DEBT (إضافة أو تعديل الدين الأساسي) */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in" dir="rtl">
          <div className="bg-[#0c0c0e] border border-white/5 rounded-[26px] p-6 w-full max-w-[420px] shadow-2xl relative overflow-y-auto max-h-[90vh]">
            
            <h3 className="text-base font-bold text-white mb-1.5">
              {editingDebt ? 'تعديل قيد دين موجود' : 'إنشاء ملف دين مستمر جديد'}
            </h3>
            <p className="text-xs text-zinc-400 mb-5 leading-relaxed">
              يرجى إدخال البيانات المعتمدة لدفتر الديون. تظهر الديون والنسب تلقائياً بمجرد الحفظ.
            </p>

            <form onSubmit={handleSubmitDebt} className="flex flex-col gap-4">
              
              {/* Name */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-zinc-400 mr-1">اسم الشخص المدين</label>
                <input
                  type="text"
                  value={personName}
                  onChange={(e) => setPersonName(e.target.value)}
                  placeholder="مثال: حسين كامل العامري"
                  required
                  className="w-full h-11 px-4 rounded-xl bg-[#161618] border border-white/5 text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/50 text-xs"
                />
              </div>

              {/* Phone */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-zinc-400 mr-1">رقم الهاتف (ضروري لواتساب والمطالبات)</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="مثال: 07712345678"
                  className="w-full h-11 px-4 rounded-xl bg-[#161618] border border-white/5 text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/50 text-xs text-left"
                  dir="ltr"
                />
              </div>

              {/* Transaction Type */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-zinc-400 mr-1">نوع المعاملة المالية</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setType('to_me')}
                    className={`h-11 rounded-xl font-bold text-xs flex items-center justify-center border cursor-pointer transition-all ${
                      type === 'to_me'
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 shadow-md shadow-emerald-500/5'
                        : 'bg-[#161618] border-white/5 text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    <span>دين لي على غيري (أطلبه)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('by_me')}
                    className={`h-11 rounded-xl font-bold text-xs flex items-center justify-center border cursor-pointer transition-all ${
                      type === 'by_me'
                        ? 'bg-rose-500/15 border-rose-500/40 text-rose-400 shadow-md shadow-rose-500/5'
                        : 'bg-[#161618] border-white/5 text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    <span>دين عليّ لغيري (يطلبني)</span>
                  </button>
                </div>
              </div>

              {/* Amounts Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-zinc-400 mr-1">المبلغ الكلي للدين</label>
                  <input
                    type="number"
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                    placeholder="مثال: 500000"
                    required
                    className="w-full h-11 px-4 rounded-xl bg-[#161618] border border-white/5 text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/50 text-xs text-left font-mono"
                    dir="ltr"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-zinc-400 mr-1">المبلغ المسدد حالياً</label>
                  <input
                    type="number"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                    placeholder="0"
                    className="w-full h-11 px-4 rounded-xl bg-[#161618] border border-white/5 text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/50 text-xs text-left font-mono"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Monthly limits and Target payments */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-zinc-400 mr-1">سقف الشراء الشهري (د.ع)</label>
                  <input
                    type="number"
                    value={monthlyPurchaseLimit}
                    onChange={(e) => setMonthlyPurchaseLimit(e.target.value)}
                    placeholder="1000000"
                    className="w-full h-11 px-4 rounded-xl bg-[#161618] border border-white/5 text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/50 text-xs text-left font-mono"
                    dir="ltr"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-zinc-400 mr-1">المطلوب سداده شهرياً</label>
                  <input
                    type="number"
                    value={targetMonthlyPayment}
                    onChange={(e) => setTargetMonthlyPayment(e.target.value)}
                    placeholder="150000"
                    className="w-full h-11 px-4 rounded-xl bg-[#161618] border border-white/5 text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/50 text-xs text-left font-mono"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Due Date & Priority */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-zinc-400 mr-1">تاريخ الاستحقاق (اختياري)</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full h-11 px-4 rounded-xl bg-[#161618] border border-white/5 text-white focus:outline-none focus:border-amber-500/50 text-xs font-mono text-left"
                    dir="ltr"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-zinc-400 mr-1">الأهمية والأولوية</label>
                  <select
                    value={priority}
                    onChange={(e: any) => setPriority(e.target.value)}
                    className="w-full h-11 px-4 rounded-xl bg-[#161618] border border-white/5 text-white focus:outline-none focus:border-amber-500/50 text-xs font-bold cursor-pointer"
                  >
                    <option value="low">منخفضة</option>
                    <option value="medium">متوسطة</option>
                    <option value="high">عالية</option>
                    <option value="critical">عاجلة جداً 🔥</option>
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-zinc-400 mr-1">ملاحظات وبيان الحساب</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="اكتب تفاصيل إضافية للبيان..."
                  rows={2}
                  className="w-full p-3 rounded-xl bg-[#161618] border border-white/5 text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/50 text-xs leading-relaxed resize-none"
                />
              </div>

              {/* Buttons */}
              <div className="flex items-center gap-3 pt-4 border-t border-white/5 mt-2">
                <button
                  type="submit"
                  className="flex-1 h-11 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl text-xs flex items-center justify-center cursor-pointer transition-colors"
                >
                  <span>{editingDebt ? 'تحديث الملف' : 'حفظ الملف'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsFormOpen(false);
                    setEditingDebt(null);
                  }}
                  className="flex-1 h-11 bg-white/5 border border-white/5 hover:bg-white/10 text-zinc-300 font-bold rounded-xl text-xs flex items-center justify-center cursor-pointer transition-colors"
                >
                  <span>إلغاء</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* 📥 MODAL 2: ADD/EDIT PURCHASE TRANSACTION (شراء بدين جديد) */}
      {isPurchaseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in" dir="rtl">
          <div className="bg-[#0c0c0e] border border-white/5 rounded-[26px] p-6 w-full max-w-[380px] shadow-2xl relative">
            
            <h3 className="text-sm font-black text-white mb-1 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500" />
              <span>تسجيل شراء بالدين جديد</span>
            </h3>
            <p className="text-xs text-zinc-400 mb-4">يضاف هذا القيمة إلى إجمالي مديونية الشخص المدين.</p>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-400">مبلغ الشراء (د.ع)</label>
                <input
                  type="number"
                  value={actionAmount}
                  onChange={(e) => setActionAmount(e.target.value)}
                  placeholder="مثال: 150000"
                  className="w-full h-11 px-4 rounded-xl bg-[#161618] border border-white/5 text-white text-xs text-left font-mono focus:outline-none focus:border-amber-500/50"
                  dir="ltr"
                  autoFocus
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-400">بيان الشراء / المادة المشتراة</label>
                <input
                  type="text"
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  placeholder="مثال: شراء مواد منزلية أو أجهزة كهربائية..."
                  className="w-full h-11 px-4 rounded-xl bg-[#161618] border border-white/5 text-white text-xs focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-400">التاريخ</label>
                <input
                  type="date"
                  value={actionDate}
                  onChange={(e) => setActionDate(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl bg-[#161618] border border-white/5 text-white text-xs text-left font-mono focus:outline-none focus:border-amber-500/50"
                  dir="ltr"
                />
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-white/5 mt-2">
                <button
                  onClick={() => handleAddTransaction('purchase')}
                  className="flex-1 h-11 bg-rose-500 hover:bg-rose-400 text-white font-bold rounded-xl text-xs flex items-center justify-center cursor-pointer transition-colors"
                >
                  <span>حفظ القيد</span>
                </button>
                <button
                  onClick={() => {
                    setIsPurchaseModalOpen(false);
                    setEditingTransaction(null);
                  }}
                  className="flex-1 h-11 bg-white/5 border border-white/5 hover:bg-white/10 text-zinc-300 font-bold rounded-xl text-xs flex items-center justify-center cursor-pointer transition-colors"
                >
                  <span>إلغاء</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* 📥 MODAL 3: ADD/EDIT PAYMENT TRANSACTION (تسديد دفعة مالية) */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in" dir="rtl">
          <div className="bg-[#0c0c0e] border border-white/5 rounded-[26px] p-6 w-full max-w-[380px] shadow-2xl relative">
            
            <h3 className="text-sm font-black text-white mb-1 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500" />
              <span>تسجيل سداد / دفعة مالية</span>
            </h3>
            <p className="text-xs text-zinc-400 mb-4">ينقص هذا القيمة من المديونية الإجمالية الصافية.</p>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-400">مبلغ التسديد المستلم (د.ع)</label>
                <input
                  type="number"
                  value={actionAmount}
                  onChange={(e) => setActionAmount(e.target.value)}
                  placeholder="مثال: 50000"
                  className="w-full h-11 px-4 rounded-xl bg-[#161618] border border-white/5 text-white text-xs text-left font-mono focus:outline-none focus:border-amber-500/50"
                  dir="ltr"
                  autoFocus
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-400">ملاحظات أو وسيلة الدفع</label>
                <input
                  type="text"
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  placeholder="مثال: دفع نقداً، تحويل محفظة كاش، حوالة..."
                  className="w-full h-11 px-4 rounded-xl bg-[#161618] border border-white/5 text-white text-xs focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-400">التاريخ</label>
                <input
                  type="date"
                  value={actionDate}
                  onChange={(e) => setActionDate(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl bg-[#161618] border border-white/5 text-white text-xs text-left font-mono focus:outline-none focus:border-amber-500/50"
                  dir="ltr"
                />
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-white/5 mt-2">
                <button
                  onClick={() => handleAddTransaction('payment')}
                  className="flex-1 h-11 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl text-xs flex items-center justify-center cursor-pointer transition-colors"
                >
                  <span>حفظ دفعة السداد</span>
                </button>
                <button
                  onClick={() => {
                    setIsPaymentModalOpen(false);
                    setEditingTransaction(null);
                  }}
                  className="flex-1 h-11 bg-white/5 border border-white/5 hover:bg-white/10 text-zinc-300 font-bold rounded-xl text-xs flex items-center justify-center cursor-pointer transition-colors"
                >
                  <span>إلغاء</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* 📥 MODAL 4: TEMPLATE BUILDER FOR REMINDERS & REPORTS WITH 70 DYNAMIC INPUTS */}
      {(isReminderTemplateOpen || isReportTemplateOpen) && selectedDebt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in" dir="rtl">
          <div className="bg-[#0c0c0e] border border-white/5 rounded-[26px] p-6 w-full max-w-[640px] shadow-2xl relative overflow-y-auto max-h-[92vh]">
            
            <h3 className="text-base font-black text-white mb-1.5">
              {templateType === 'reminder' ? 'منشئ التذكيرات المطورة (70 صيغة ومتغير)' : 'منشئ تقارير الحسابات المفصلة لواتساب'}
            </h3>
            <p className="text-xs text-zinc-400 mb-5 leading-relaxed">
              انقر على أي من المتغيرات البرمجية أو الصيغ الجاهزة لتدرجها فوراً في حقل التحرير. سيقوم النظام بترجمتها تلقائياً لبيانات الشخص قبل إرسالها.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
              
              {/* Left Column in modal: Variables & Formula Presets (35 Variables + 35 Formulas) */}
              <div className="md:col-span-5 flex flex-col gap-3 max-h-[380px] overflow-y-auto pr-1">
                
                {/* 1. الصيغ الجاهزة (Presets Formulas) */}
                <div>
                  <span className="text-[10px] text-amber-400 font-black block mb-1.5">أولاً: صيغ جاهزة بنقرة واحدة (Formulas)</span>
                  <div className="flex flex-col gap-1">
                    {templateFormulas.map((f, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setTemplateText(f.text)}
                        className="p-2 rounded-xl bg-white/[0.02] border border-white/5 text-right text-[10px] hover:bg-amber-500/10 hover:border-amber-500/20 text-zinc-300 cursor-pointer transition-all"
                      >
                        <span className="font-bold text-white block mb-0.5">{f.name}</span>
                        <span className="text-zinc-500 text-[9px] line-clamp-1">{f.text}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. المتغيرات الديناميكية (Dynamic variables) */}
                <div className="border-t border-white/5 pt-3 mt-1">
                  <span className="text-[10px] text-blue-400 font-black block mb-1.5">ثانياً: المتغيرات البرمجية الذكية</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {templateVariables.map((v, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setTemplateText(prev => prev + ' ' + v.code)}
                        className="p-1.5 rounded-lg bg-white/[0.01] border border-white/5 text-right hover:bg-blue-500/10 hover:border-blue-500/20 text-[9px] text-zinc-300 cursor-pointer transition-colors"
                        title={v.desc}
                      >
                        <span className="font-mono text-blue-400 block font-bold text-[9px]">{v.code}</span>
                        <span className="text-zinc-500 text-[8px] mt-0.5 block">{v.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

              </div>

              {/* Right Column in modal: Text Editors & Previews */}
              <div className="md:col-span-7 flex flex-col gap-3">
                
                {/* Subject Line */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-zinc-400">عنوان التذكير أو التقرير الإداري</label>
                  <input
                    type="text"
                    value={templateSubject}
                    onChange={(e) => setTemplateSubject(e.target.value)}
                    placeholder="مثال: مطالبة سداد مستعجلة، كشف شهري"
                    className="w-full h-10 px-3 rounded-xl bg-[#161618] border border-white/5 text-white text-xs focus:outline-none focus:border-amber-500/50"
                  />
                </div>

                {/* Text Editor */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-zinc-400">نص الرسالة (يدعم كتابة المتغيرات يدوياً أيضاً)</label>
                  <textarea
                    value={templateText}
                    onChange={(e) => setTemplateText(e.target.value)}
                    placeholder="اكتب التذكير هنا، أو انقر على أحد الصيغ الجاهزة للتعديل..."
                    rows={6}
                    className="w-full p-3 rounded-xl bg-[#161618] border border-white/5 text-white text-xs leading-relaxed resize-none focus:outline-none focus:border-amber-500/50 font-mono"
                  />
                </div>

                {/* Realtime Live Preview */}
                <div className="bg-[#18181b]/50 border border-white/5 p-3 rounded-xl">
                  <span className="text-[9px] text-zinc-500 font-bold block mb-1">معاينة الرسالة المترجمة قبل الحفظ:</span>
                  <div className="text-[10px] text-zinc-300 leading-relaxed whitespace-pre-wrap font-mono">
                    {compileTemplate(templateText, selectedDebt) || 'اكتب شيئاً لتظهر المعاينة الحية هنا...'}
                  </div>
                </div>

              </div>

            </div>

            {/* Bottom Actions */}
            <div className="flex items-center gap-3 pt-4 border-t border-white/5 mt-5">
              <button
                onClick={handleSaveTemplateNotification}
                className="flex-1 h-11 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl text-xs flex items-center justify-center cursor-pointer transition-colors"
              >
                <span>حفظ في سجل {templateType === 'reminder' ? 'التذكيرات' : 'التقارير'}</span>
              </button>
              
              <button
                onClick={() => {
                  const compiled = compileTemplate(templateText, selectedDebt);
                  if (selectedDebt.phone) {
                    window.open(getWhatsAppLink(selectedDebt.phone, compiled), '_blank');
                  } else {
                    showToast('لا يمكن الإرسال، رقم هاتف المدين غير مسجل', 'error');
                  }
                }}
                className="h-11 px-4 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <Send className="w-4 h-4" />
                <span>إرسال واتساب مباشرة</span>
              </button>

              <button
                onClick={() => {
                  setIsReminderTemplateOpen(false);
                  setIsReportTemplateOpen(false);
                }}
                className="h-11 px-4 bg-white/5 border border-white/5 hover:bg-white/10 text-zinc-300 font-bold rounded-xl text-xs flex items-center justify-center cursor-pointer transition-colors"
              >
                <span>إغلاق</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 📥 POPUP Modal A: VIEW PREVIOUS REPORTS (نافذة عرض وإدارة التقارير المكتوبة سابقاً) */}
      {isReportsPopupOpen && selectedDebt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in" dir="rtl">
          <div className="bg-[#0c0c0e] border border-white/5 rounded-[26px] p-6 w-full max-w-[480px] shadow-2xl relative">
            
            <h3 className="text-base font-black text-white mb-1.5 flex items-center gap-1.5">
              <FileText className="w-5 h-5 text-blue-500" />
              <span>أرشيف وسجل التقارير الصادرة لـ ({selectedDebt.personName})</span>
            </h3>
            <p className="text-xs text-zinc-400 mb-4">عرض، تعديل، تعطيل، حذف، أو إعادة إرسال أي تقرير مالي سابق تم حفظه لهذا الدين.</p>

            <div className="flex flex-col gap-3 max-h-[350px] overflow-y-auto pr-1">
              {(!selectedDebt.notifications || selectedDebt.notifications.filter(n=>n.type==='report').length === 0) ? (
                <p className="text-zinc-600 italic text-center py-8 text-xs">لا يوجد أي تقارير مؤرشفة لهذا المدين حالياً.</p>
              ) : (
                selectedDebt.notifications
                  .filter((n) => n.type === 'report')
                  .map((notif) => (
                    <div key={notif.id} className="bg-white/[0.02] border border-white/5 p-3.5 rounded-xl flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-white">{notif.title}</span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleShareNotificationWhatsApp(notif)}
                            className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded cursor-pointer"
                          >
                            إعادة إرسال
                          </button>
                          <button
                            onClick={() => handleToggleNotificationStatus(notif.id, 'delete')}
                            className="text-rose-500 hover:text-rose-400 px-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <p className="text-[11px] text-zinc-400 whitespace-pre-wrap leading-relaxed select-all bg-[#161618] p-2.5 rounded-lg border border-white/5">
                        {notif.body}
                      </p>
                      <span className="text-[9px] text-zinc-500 text-left font-mono">
                        تاريخ الحفظ: {new Date(notif.createdAt).toLocaleDateString('ar-IQ')}
                      </span>
                    </div>
                  ))
              )}
            </div>

            <div className="pt-4 border-t border-white/5 mt-4 flex justify-end">
              <button
                onClick={() => setIsReportsPopupOpen(false)}
                className="h-10 px-5 bg-white/5 border border-white/5 hover:bg-white/10 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors"
              >
                <span>إغلاق الأرشيف</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 📥 POPUP Modal B: VIEW PREVIOUS REMINDERS (نافذة عرض وإدارة التذكيرات المكتوبة سابقاً) */}
      {isRemindersPopupOpen && selectedDebt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in" dir="rtl">
          <div className="bg-[#0c0c0e] border border-white/5 rounded-[26px] p-6 w-full max-w-[480px] shadow-2xl relative">
            
            <h3 className="text-base font-black text-white mb-1.5 flex items-center gap-1.5">
              <Bell className="w-5 h-5 text-amber-500" />
              <span>أرشيف التذكيرات الذكية لـ ({selectedDebt.personName})</span>
            </h3>
            <p className="text-xs text-zinc-400 mb-4">عرض، تعديل، تعطيل، حذف، أو إعادة إرسال أي تذكير مالي سابق تم حفظه لهذا الدين.</p>

            <div className="flex flex-col gap-3 max-h-[350px] overflow-y-auto pr-1">
              {(!selectedDebt.notifications || selectedDebt.notifications.filter(n=>n.type==='reminder').length === 0) ? (
                <p className="text-zinc-600 italic text-center py-8 text-xs">لا يوجد أي تذكيرات مؤرشفة لهذا المدين حالياً.</p>
              ) : (
                selectedDebt.notifications
                  .filter((n) => n.type === 'reminder')
                  .map((notif) => (
                    <div key={notif.id} className="bg-white/[0.02] border border-white/5 p-3.5 rounded-xl flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-white">{notif.title}</span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleShareNotificationWhatsApp(notif)}
                            className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded cursor-pointer"
                          >
                            إعادة إرسال
                          </button>
                          <button
                            onClick={() => handleToggleNotificationStatus(notif.id, 'delete')}
                            className="text-rose-500 hover:text-rose-400 px-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <p className="text-[11px] text-zinc-400 whitespace-pre-wrap leading-relaxed select-all bg-[#161618] p-2.5 rounded-lg border border-white/5">
                        {notif.body}
                      </p>
                      <span className="text-[9px] text-zinc-500 text-left font-mono">
                        تاريخ الحفظ: {new Date(notif.createdAt).toLocaleDateString('ar-IQ')}
                      </span>
                    </div>
                  ))
              )}
            </div>

            <div className="pt-4 border-t border-white/5 mt-4 flex justify-end">
              <button
                onClick={() => setIsRemindersPopupOpen(false)}
                className="h-10 px-5 bg-white/5 border border-white/5 hover:bg-white/10 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors"
              >
                <span>إغلاق الأرشيف</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 📥 MODAL 5: QUICK ADD TRANSACTION FOR CARDS (إضافة دين جديد مباشر) */}
      {isQuickAddModalOpen && quickAddDebtTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in" dir="rtl">
          <div className="bg-[#0c0c0e] border border-white/5 rounded-[26px] p-6 w-full max-w-[380px] shadow-2xl relative">
            
            <h3 className="text-base font-bold text-white mb-1.5 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-500 animate-pulse" />
              <span>تسجيل دين جديد مباشر</span>
            </h3>
            <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
              إضافة مبلغ دين جديد مباشرة على الرصيد السابق للمدين <span className="text-amber-400 font-bold">({quickAddDebtTarget.personName})</span>.
            </p>

            <form onSubmit={handleSaveQuickAddDebt} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-400 font-semibold mr-1">مبلغ الدين الإضافي الجديد (د.ع)</label>
                <input
                  type="number"
                  value={quickAddAmount}
                  onChange={(e) => setQuickAddAmount(e.target.value)}
                  placeholder="مثال: 50000"
                  required
                  className="w-full h-11 px-4 rounded-xl bg-[#161618] border border-white/5 text-white text-xs text-left font-mono focus:outline-none focus:border-amber-500/50"
                  dir="ltr"
                  autoFocus
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-400 font-semibold mr-1">بيان أو سبب الدين الجديد</label>
                <input
                  type="text"
                  value={quickAddNotes}
                  onChange={(e) => setQuickAddNotes(e.target.value)}
                  placeholder="مثال: شراء مواد منزلية أو سلفة إضافية..."
                  className="w-full h-11 px-4 rounded-xl bg-[#161618] border border-white/5 text-white text-xs focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-400 font-semibold mr-1">التاريخ</label>
                <input
                  type="date"
                  value={quickAddDate}
                  onChange={(e) => setQuickAddDate(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl bg-[#161618] border border-white/5 text-white text-xs text-left font-mono focus:outline-none focus:border-amber-500/50"
                  dir="ltr"
                />
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-white/5 mt-2">
                <button
                  type="submit"
                  className="flex-1 h-11 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl text-xs flex items-center justify-center cursor-pointer transition-colors"
                >
                  <span>إضافة وتحديث</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsQuickAddModalOpen(false);
                    setQuickAddDebtTarget(null);
                  }}
                  className="flex-1 h-11 bg-white/5 border border-white/5 hover:bg-white/10 text-zinc-300 font-bold rounded-xl text-xs flex items-center justify-center cursor-pointer transition-colors"
                >
                  <span>إلغاء</span>
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}
