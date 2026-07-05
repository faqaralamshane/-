/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  PiggyBank,
  Plus,
  Trash2,
  Edit,
  Phone,
  MessageCircle,
  Calendar,
  DollarSign,
  User,
  Users,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  Info,
  Coins,
  ArrowRight,
  UserPlus,
  Activity,
  UserCheck,
  Search,
  Sparkles,
  Award
} from 'lucide-react';
import { Customer, Salaf, SalafMember, SalafPayment } from '../types';
import { getAllFromStore, putInStore, deleteFromStore, uid } from '../db';

export function SalafsView() {
  const [salafs, setSalafs] = useState<Salaf[]>([]);
  const [dbCustomers, setDbCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  // View state management
  const [activeSalafId, setActiveSalafId] = useState<string | null>(null);
  const [activeMemberId, setActiveMemberId] = useState<string | null>(null);

  // Filters
  const [selectedMonthTab, setSelectedMonthTab] = useState<number>(1);
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'unpaid'>('all');

  // Modals state
  const [isAddSalafOpen, setIsAddSalafOpen] = useState(false);
  const [isEditSalafOpen, setIsEditSalafOpen] = useState(false);
  const [editingSalaf, setEditingSalaf] = useState<Salaf | null>(null);

  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [isEditMemberOpen, setIsEditMemberOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<SalafMember | null>(null);

  const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false);
  const [isEditPaymentOpen, setIsEditPaymentOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<SalafPayment | null>(null);

  // Form States - Add/Edit Salaf
  const [salafName, setSalafName] = useState('');
  const [salafTotalAmount, setSalafTotalAmount] = useState('');
  const [salafMonthlyAmount, setSalafMonthlyAmount] = useState('');
  const [salafMonthsCount, setSalafMonthsCount] = useState('20');
  const [salafStartDate, setSalafStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [salafNotes, setSalafNotes] = useState('');

  // Form States - Add/Edit Member
  const [memberSource, setMemberSource] = useState<'new' | 'existing'>('existing');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [memberName, setMemberName] = useState('');
  const [memberPhone, setMemberPhone] = useState('');
  const [memberIsReceiver, setMemberIsReceiver] = useState(false);
  const [memberReceiveMonth, setMemberReceiveMonth] = useState('1');
  const [memberNotes, setMemberNotes] = useState('');

  // Form States - Add/Edit Payment
  const [paymentMonthIndex, setPaymentMonthIndex] = useState(1);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentIsPaidByMe, setPaymentIsPaidByMe] = useState(false);
  const [paymentNotes, setPaymentNotes] = useState('');

  // Search
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');

  // Notifications/Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const handleAddSalaf = () => {
      setSalafName('');
      setSalafTotalAmount('');
      setSalafMonthlyAmount('');
      setSalafMonthsCount('20');
      setSalafStartDate(new Date().toISOString().split('T')[0]);
      setSalafNotes('');
      setIsAddSalafOpen(true);
    };
    window.addEventListener('faqar-trigger-add-salaf', handleAddSalaf);
    return () => {
      window.removeEventListener('faqar-trigger-add-salaf', handleAddSalaf);
    };
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load customers from database to allow quick-linking
      const custs = await getAllFromStore<Customer>('customers').catch(() => []);
      setDbCustomers(custs);

      // Load Salaf arrays from IndexedDB
      const savedSalafs = await getAllFromStore<Salaf>('salafs').catch(() => []);
      if (savedSalafs && savedSalafs.length > 0) {
        setSalafs(savedSalafs);
      } else {
        // Fallback check to localStorage to migrate existing data seamlessly if any
        const fallbackSaved = localStorage.getItem('faqar-salafs-v1');
        if (fallbackSaved) {
          const parsed = JSON.parse(fallbackSaved) as Salaf[];
          setSalafs(parsed);
          // Save them to IndexedDB so they migrate
          for (const s of parsed) {
            await putInStore('salafs', s).catch(() => {});
          }
        } else {
          setSalafs([]);
        }
      }
    } catch (err) {
      console.error('Error loading Salaf data:', err);
      showToast('خطأ في تحميل البيانات', 'error');
    } finally {
      setLoading(false);
    }
  };

  const saveSalafsToStorage = async (updatedList: Salaf[]) => {
    setSalafs(updatedList);
    try {
      // Determine what was deleted vs added/updated
      const existingInDB = await getAllFromStore<Salaf>('salafs').catch(() => []);
      const existingIds = new Set(existingInDB.map(s => s.id));
      const updatedIds = new Set(updatedList.map(s => s.id));

      // 1. Delete removed ones from IndexedDB
      for (const id of existingIds) {
        if (!updatedIds.has(id)) {
          await deleteFromStore('salafs', id).catch(() => {});
        }
      }

      // 2. Write all current ones to IndexedDB
      for (const s of updatedList) {
        await putInStore('salafs', s).catch(() => {});
      }
    } catch (err) {
      console.error('Failed to save salafs to IndexedDB:', err);
    }
  };

  // -------------------------------------------------------------
  // HANDLERS FOR SALAF (سلفة)
  // -------------------------------------------------------------
  const handleCreateSalaf = (e: React.FormEvent) => {
    e.preventDefault();
    if (!salafName.trim()) {
      showToast('يرجى كتابة اسم السلفة', 'error');
      return;
    }

    const total = parseFloat(salafTotalAmount);
    const monthly = parseFloat(salafMonthlyAmount);
    const months = parseInt(salafMonthsCount);

    if (isNaN(total) || total <= 0 || isNaN(monthly) || monthly <= 0 || isNaN(months) || months <= 0) {
      showToast('يرجى إدخال قيم رقمية صحيحة أكبر من الصفر', 'error');
      return;
    }

    const newSalaf: Salaf = {
      id: 'salaf-' + uid(),
      name: salafName.trim(),
      totalAmount: total,
      monthlyAmount: monthly,
      monthsCount: months,
      startDate: salafStartDate,
      notes: salafNotes.trim() || undefined,
      createdAt: new Date().toISOString(),
      members: [],
      payments: []
    };

    const updated = [newSalaf, ...salafs];
    saveSalafsToStorage(updated);
    showToast(`تم إنشاء سلفة "${salafName}" بنجاح`, 'success');
    setIsAddSalafOpen(false);

    // Reset forms
    setSalafName('');
    setSalafTotalAmount('');
    setSalafMonthlyAmount('');
    setSalafMonthsCount('20');
    setSalafNotes('');
  };

  const handleEditSalaf = (salaf: Salaf) => {
    setEditingSalaf(salaf);
    setSalafName(salaf.name);
    setSalafTotalAmount(salaf.totalAmount.toString());
    setSalafMonthlyAmount(salaf.monthlyAmount.toString());
    setSalafMonthsCount(salaf.monthsCount.toString());
    setSalafStartDate(salaf.startDate);
    setSalafNotes(salaf.notes || '');
    setIsEditSalafOpen(true);
  };

  const handleSaveEditedSalaf = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSalaf) return;

    const total = parseFloat(salafTotalAmount);
    const monthly = parseFloat(salafMonthlyAmount);
    const months = parseInt(salafMonthsCount);

    if (isNaN(total) || total <= 0 || isNaN(monthly) || monthly <= 0 || isNaN(months) || months <= 0) {
      showToast('يرجى إدخال قيم صحيحة', 'error');
      return;
    }

    const updated = salafs.map((s) => {
      if (s.id === editingSalaf.id) {
        return {
          ...s,
          name: salafName.trim(),
          totalAmount: total,
          monthlyAmount: monthly,
          monthsCount: months,
          startDate: salafStartDate,
          notes: salafNotes.trim() || undefined
        };
      }
      return s;
    });

    saveSalafsToStorage(updated);
    showToast('تم تعديل بيانات السلفة بنجاح', 'success');
    setIsEditSalafOpen(false);
    setEditingSalaf(null);
  };

  const handleDeleteSalaf = (salafId: string, name: string) => {
    if (window.confirm(`هل أنت متأكد تماماً من حذف سلفة "${name}"؟ سيتم حذف جميع الأعضاء والدفعات المرتبطة بها نهائياً ولن تتمكن من التراجع.`)) {
      const updated = salafs.filter((s) => s.id !== salafId);
      saveSalafsToStorage(updated);
      showToast('تم حذف السلفة بنجاح', 'success');
      if (activeSalafId === salafId) {
        setActiveSalafId(null);
        setActiveMemberId(null);
      }
    }
  };

  // -------------------------------------------------------------
  // HANDLERS FOR MEMBERS (الأعضاء)
  // -------------------------------------------------------------
  const handleOpenAddMember = () => {
    setMemberSource('existing');
    setSelectedCustomerId('');
    setMemberName('');
    setMemberPhone('');
    setMemberIsReceiver(false);
    setMemberReceiveMonth('1');
    setMemberNotes('');
    setIsAddMemberOpen(true);
  };

  const handleCreateMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSalafId) return;

    let finalName = '';
    let finalPhone = '';

    if (memberSource === 'existing') {
      const selected = dbCustomers.find((c) => c.id === selectedCustomerId);
      if (!selected) {
        showToast('يرجى اختيار زبون من القائمة أولاً', 'error');
        return;
      }
      finalName = selected.name;
      finalPhone = selected.phone;
    } else {
      if (!memberName.trim() || !memberPhone.trim()) {
        showToast('يرجى إدخال اسم ورقم هاتف العضو الجديد', 'error');
        return;
      }
      finalName = memberName.trim();
      finalPhone = memberPhone.trim();
    }

    const newMember: SalafMember = {
      id: 'member-' + uid(),
      name: finalName,
      phone: finalPhone,
      isReceiver: memberIsReceiver,
      receiveMonthIndex: memberIsReceiver ? parseInt(memberReceiveMonth) : undefined,
      receiveDate: memberIsReceiver ? new Date().toISOString().split('T')[0] : undefined,
      notes: memberNotes.trim() || undefined,
      createdAt: new Date().toISOString()
    };

    const updated = salafs.map((s) => {
      if (s.id === activeSalafId) {
        // Prevent adding duplicate members if they are already in the Salaf
        if (s.members.some((m) => m.phone === finalPhone)) {
          showToast('هذا العضو (رقم الهاتف) مسجل بالفعل في هذه السلفة', 'error');
          return s;
        }
        return {
          ...s,
          members: [...s.members, newMember]
        };
      }
      return s;
    });

    saveSalafsToStorage(updated);
    showToast(`تمت إضافة العضو "${finalName}" بنجاح`, 'success');
    setIsAddMemberOpen(false);
  };

  const handleEditMember = (m: SalafMember, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingMember(m);
    setMemberName(m.name);
    setMemberPhone(m.phone);
    setMemberIsReceiver(m.isReceiver);
    setMemberReceiveMonth((m.receiveMonthIndex || 1).toString());
    setMemberNotes(m.notes || '');
    setIsEditMemberOpen(true);
  };

  const handleSaveEditedMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSalafId || !editingMember) return;

    const updated = salafs.map((s) => {
      if (s.id === activeSalafId) {
        const updatedMembers = s.members.map((m) => {
          if (m.id === editingMember.id) {
            return {
              ...m,
              name: memberName.trim(),
              phone: memberPhone.trim(),
              isReceiver: memberIsReceiver,
              receiveMonthIndex: memberIsReceiver ? parseInt(memberReceiveMonth) : undefined,
              receiveDate: memberIsReceiver ? (m.receiveDate || new Date().toISOString().split('T')[0]) : undefined,
              notes: memberNotes.trim() || undefined
            };
          }
          return m;
        });
        return { ...s, members: updatedMembers };
      }
      return s;
    });

    saveSalafsToStorage(updated);
    showToast('تم تعديل بيانات المشترك بنجاح', 'success');
    setIsEditMemberOpen(false);
    setEditingMember(null);
  };

  const handleDeleteMember = (memberId: string, name: string) => {
    if (!activeSalafId) return;
    if (window.confirm(`هل أنت متأكد من إزالة المشترك "${name}" من السلفة؟ سيتم حذف جميع دفعاته وسجلاته من السلفة نهائياً.`)) {
      const updated = salafs.map((s) => {
        if (s.id === activeSalafId) {
          return {
            ...s,
            members: s.members.filter((m) => m.id !== memberId),
            payments: s.payments.filter((p) => p.memberId !== memberId)
          };
        }
        return s;
      });
      saveSalafsToStorage(updated);
      showToast('تمت إزالة العضو بنجاح', 'success');
      if (activeMemberId === memberId) {
        setActiveMemberId(null);
      }
    }
  };

  // -------------------------------------------------------------
  // HANDLERS FOR PAYMENTS (الدفعات)
  // -------------------------------------------------------------
  const handleOpenAddPayment = (memberId: string) => {
    const currentSalaf = salafs.find((s) => s.id === activeSalafId);
    if (!currentSalaf) return;

    setActiveMemberId(memberId);
    setPaymentMonthIndex(selectedMonthTab);
    setPaymentAmount(currentSalaf.monthlyAmount.toString());
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentIsPaidByMe(false);
    setPaymentNotes('');
    setIsAddPaymentOpen(true);
  };

  const handleCreatePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSalafId || !activeMemberId) return;

    const amountNum = parseFloat(paymentAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      showToast('يرجى إدخال مبلغ دفع صحيح', 'error');
      return;
    }

    const newPayment: SalafPayment = {
      id: 'sp-' + uid(),
      memberId: activeMemberId,
      monthIndex: paymentMonthIndex,
      date: paymentDate,
      amount: amountNum,
      isPaidByMe: paymentIsPaidByMe,
      notes: paymentNotes.trim() || undefined,
      createdAt: new Date().toISOString()
    };

    const updated = salafs.map((s) => {
      if (s.id === activeSalafId) {
        // Prevent double registering payment for the same member and same month
        if (s.payments.some((p) => p.memberId === activeMemberId && p.monthIndex === paymentMonthIndex)) {
          showToast(`هذا العضو مسدد بالفعل للشهر ${paymentMonthIndex}. قم بتعديل الدفعة السابقة إن دعت الحاجة.`, 'error');
          return s;
        }
        return {
          ...s,
          payments: [...s.payments, newPayment]
        };
      }
      return s;
    });

    saveSalafsToStorage(updated);
    showToast('تم تسجيل الدفعة بنجاح', 'success');
    setIsAddPaymentOpen(false);
  };

  const handleEditPayment = (p: SalafPayment) => {
    setEditingPayment(p);
    setPaymentMonthIndex(p.monthIndex);
    setPaymentAmount(p.amount.toString());
    setPaymentDate(p.date);
    setPaymentIsPaidByMe(p.isPaidByMe);
    setPaymentNotes(p.notes || '');
    setIsEditPaymentOpen(true);
  };

  const handleSaveEditedPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSalafId || !editingPayment) return;

    const amountNum = parseFloat(paymentAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      showToast('يرجى إدخال قيمة صحيحة', 'error');
      return;
    }

    const updated = salafs.map((s) => {
      if (s.id === activeSalafId) {
        const updatedPays = s.payments.map((p) => {
          if (p.id === editingPayment.id) {
            return {
              ...p,
              monthIndex: paymentMonthIndex,
              amount: amountNum,
              date: paymentDate,
              isPaidByMe: paymentIsPaidByMe,
              notes: paymentNotes.trim() || undefined
            };
          }
          return p;
        });
        return { ...s, payments: updatedPays };
      }
      return s;
    });

    saveSalafsToStorage(updated);
    showToast('تم تعديل الدفعة بنجاح', 'success');
    setIsEditPaymentOpen(false);
    setEditingPayment(null);
  };

  const handleDeletePayment = (paymentId: string) => {
    if (!activeSalafId) return;
    if (window.confirm('هل أنت متأكد من حذف دفعة السداد هذه؟')) {
      const updated = salafs.map((s) => {
        if (s.id === activeSalafId) {
          return {
            ...s,
            payments: s.payments.filter((p) => p.id !== paymentId)
          };
        }
        return s;
      });
      saveSalafsToStorage(updated);
      showToast('تم حذف دفعة السداد بنجاح', 'success');
      if (editingPayment?.id === paymentId) {
        setIsEditPaymentOpen(false);
        setEditingPayment(null);
      }
    }
  };

  // Quick Action for current month payment on card face
  const handleQuickPayCurrentMonth = (salaf: Salaf, memberId: string, monthIndex: number) => {
    // Quick register payment without showing full popup if already knows parameters
    const existing = salaf.payments.find((p) => p.memberId === memberId && p.monthIndex === monthIndex);
    if (existing) {
      showToast('هذا المشترك قام بالسداد للشهر المحدد بالفعل', 'error');
      return;
    }

    const newPayment: SalafPayment = {
      id: 'sp-' + uid(),
      memberId,
      monthIndex,
      date: new Date().toISOString().split('T')[0],
      amount: salaf.monthlyAmount,
      isPaidByMe: false,
      notes: 'سداد سريع بنقرة واحدة من لوحة التحكم',
      createdAt: new Date().toISOString()
    };

    const updated = salafs.map((s) => {
      if (s.id === salaf.id) {
        return {
          ...s,
          payments: [...s.payments, newPayment]
        };
      }
      return s;
    });

    saveSalafsToStorage(updated);
    showToast('تم السداد السريع للشهر الحالي بنجاح 🎉', 'success');
  };

  // Toggle receive state of a member quickly
  const handleToggleReceiveState = (salafId: string, memberId: string, currentReceiveState: boolean) => {
    const updated = salafs.map((s) => {
      if (s.id === salafId) {
        const updatedMembers = s.members.map((m) => {
          if (m.id === memberId) {
            const nextState = !currentReceiveState;
            return {
              ...m,
              isReceiver: nextState,
              receiveMonthIndex: nextState ? selectedMonthTab : undefined,
              receiveDate: nextState ? new Date().toISOString().split('T')[0] : undefined
            };
          }
          return m;
        });
        return { ...s, members: updatedMembers };
      }
      return s;
    });

    saveSalafsToStorage(updated);
    showToast('تم تحديث حالة استلام السلفة للمشترك بنجاح', 'success');
  };

  // -------------------------------------------------------------
  // HELPERS & FORMULAS FOR VIEW METRICS
  // -------------------------------------------------------------
  const fmtIQD = (val: number) => {
    return new Intl.NumberFormat('ar-IQ', { style: 'currency', currency: 'IQD', maximumFractionDigits: 0 }).format(val);
  };

  const getMonthsPassed = (startDateStr: string, monthsLimit: number) => {
    const start = new Date(startDateStr);
    const now = new Date();
    const diffMonths = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
    return Math.max(0, Math.min(monthsLimit, diffMonths + 1)); // inclusive of starting month
  };

  const currentSalaf = salafs.find((s) => s.id === activeSalafId);
  const currentMember = currentSalaf?.members.find((m) => m.id === activeMemberId);

  // Global calculations across all Salafs for index statistics
  const totalSalafsCount = salafs.length;
  const totalInvolvedMembers = salafs.reduce((sum, s) => sum + s.members.length, 0);
  const totalPaidByMeGlobal = salafs.reduce((sum, s) => sum + s.payments.filter(p => p.isPaidByMe).length, 0);
  const totalCollectedMoneyGlobal = salafs.reduce((sum, s) => sum + s.payments.reduce((paysum, p) => paysum + p.amount, 0), 0);

  // Filtered customers for adding new members
  const filteredCustomers = dbCustomers.filter((c) => {
    const term = customerSearchQuery.toLowerCase();
    return c.name.toLowerCase().includes(term) || c.phone.includes(term);
  });

  // Share detailed status on WhatsApp
  const handleWhatsAppShare = (salaf: Salaf, member: SalafMember) => {
    if (!member.phone) {
      showToast('لا يوجد هاتف مسجل لهذا العضو', 'error');
      return;
    }

    const memberPayments = salaf.payments.filter((p) => p.memberId === member.id);
    const totalPaid = memberPayments.reduce((sum, p) => sum + p.amount, 0);
    const paidMonthsCount = memberPayments.length;
    const remainingMonthsCount = Math.max(0, salaf.monthsCount - paidMonthsCount);
    const totalRemainingAmount = remainingMonthsCount * salaf.monthlyAmount;

    let paymentDetailsText = '';
    memberPayments.forEach((p) => {
      paymentDetailsText += `\n- الشهر ${p.monthIndex}: تم تسديد ${fmtIQD(p.amount)} بتاريخ ${p.date}${p.isPaidByMe ? ' (دُفع بالنيابة من الإدارة)' : ''}`;
    });

    if (memberPayments.length === 0) {
      paymentDetailsText = '\n- لم يتم تسجيل أي دفعات مسددة حتى الآن.';
    }

    const text = `السلام عليكم ورحمة الله وبركاته، عزيزي العضو المحترم *${member.name}*.\n\nكشف حسابك الخاص بسلفة *"${salaf.name}"* كالتالي:\n- قيمة السهم الشهري: ${fmtIQD(salaf.monthlyAmount)}\n- عدد أشهر السلفة الإجمالي: ${salaf.monthsCount} أشهر\n- مجموع الدفعات المسددة: ${paidMonthsCount} من أصل ${salaf.monthsCount}\n- إجمالي المبلغ الذي سددته: *${fmtIQD(totalPaid)}*\n- المتبقي بذمتك: *${fmtIQD(totalRemainingAmount)}* (${remainingMonthsCount} شهر)\n\n*سجل كشف المدفوعات بالتفصيل:*${paymentDetailsText}\n\n- حالة استلامك لمبلغ السلفة الكلي (${fmtIQD(salaf.totalAmount)}): ${member.isReceiver ? `*مستلم السلفة (الشهر ${member.receiveMonthIndex})*` : '*قيد الانتظار لم يحن دورك بعد*'}\n\nنشكر التزامكم وثقتكم المستمرة بمكتبنا. 🏛️`;
    
    // Clean phone number (add country code if missing and strip characters)
    let cleanPhone = member.phone.replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('07')) {
      cleanPhone = '964' + cleanPhone.substring(1);
    }

    const url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-12" dir="rtl">
      {/* Toast Alert */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3.5 rounded-2xl text-xs font-bold shadow-2xl flex items-center gap-2.5 animate-slide-up border bg-[#0e0e11] border-white/5">
          <span className={`w-2.5 h-2.5 rounded-full ${toast.type === 'success' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
          <span className="text-white">{toast.message}</span>
        </div>
      )}

      {/* HEADER BAR */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shadow-lg shadow-amber-500/5">
            <PiggyBank className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h1 className="text-xs font-bold text-zinc-500">لوحة الإدارة والتحصيل</h1>
            <h2 className="text-base font-black text-white">إدارة نظام السلف والجمعيات</h2>
          </div>
        </div>

        {!activeSalafId && (
          <button
            onClick={() => setIsAddSalafOpen(true)}
            className="h-10 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs flex items-center gap-1.5 transition-all shadow-lg shadow-amber-500/10 active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>سلفة جديدة</span>
          </button>
        )}
      </div>

      {/* CASE 1: MAIN SALAF LIST (Not looking inside a specific Salaf) */}
      {!activeSalafId && (
        <>
          {/* GENERAL CUMULATIVE STATS BAR */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-2xl border border-white/5 bg-[#121214]/60 backdrop-blur-xl flex flex-col gap-1 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
              <div className="flex items-center justify-between text-zinc-500">
                <span className="text-[10px] font-bold">السلف النشطة</span>
                <PiggyBank className="w-4 h-4 text-amber-500/60" />
              </div>
              <p className="text-lg font-black text-white font-mono tracking-tight">{totalSalafsCount}</p>
              <span className="text-[9px] text-zinc-500 font-medium">{totalInvolvedMembers} مشترك مسجل حالياً</span>
            </div>

            <div className="p-4 rounded-2xl border border-white/5 bg-[#121214]/60 backdrop-blur-xl flex flex-col gap-1 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
              <div className="flex items-center justify-between text-zinc-500">
                <span className="text-[10px] font-bold">المقبوضات الكلية</span>
                <Coins className="w-4 h-4 text-emerald-400/60" />
              </div>
              <p className="text-lg font-black text-emerald-400 font-mono tracking-tight">{fmtIQD(totalCollectedMoneyGlobal)}</p>
              <span className="text-[9px] text-zinc-500 font-medium">تم تحصيلها من السلف</span>
            </div>

            <div className="p-4 rounded-2xl border border-white/5 bg-[#121214]/60 backdrop-blur-xl col-span-2 flex items-center justify-between relative overflow-hidden">
              <div className="absolute top-0 left-0 w-24 h-24 bg-rose-500/5 rounded-full blur-2xl pointer-events-none" />
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 font-bold text-xs">
                  {totalPaidByMeGlobal}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">دفعات "دُفعت بدلاً عنه"</h4>
                  <p className="text-[9px] text-zinc-500 mt-0.5">عدد المرات التي دفع المكتب بالنيابة عن الزبائن لضمان استمرار السلفة</p>
                </div>
              </div>
              <span className="text-rose-400/80 text-[10px] font-black font-mono">نشط ومراقب</span>
            </div>
          </div>

          {/* SALAFS COLLECTION LIST */}
          <div className="flex flex-col gap-3.5">
            <h3 className="text-xs font-black text-zinc-400 tracking-wider">قائمة السلف المفتوحة</h3>

            {salafs.length === 0 ? (
              <div className="text-center py-16 bg-[#121214]/30 border border-dashed border-white/5 rounded-3xl text-zinc-500 text-xs flex flex-col items-center gap-3">
                <PiggyBank className="w-10 h-10 text-zinc-600 animate-pulse" />
                <span>لا توجد أي سلف أو جمعيات مسجلة حالياً.</span>
                <button
                  onClick={() => setIsAddSalafOpen(true)}
                  className="mt-2 h-9 px-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 text-amber-500 font-bold text-xs transition-colors"
                >
                  أنشئ أول سلفة الآن
                </button>
              </div>
            ) : (
              salafs.map((s) => {
                const passed = getMonthsPassed(s.startDate, s.monthsCount);
                const remaining = Math.max(0, s.monthsCount - passed);
                const progressPct = s.monthsCount > 0 ? (passed / s.monthsCount) * 100 : 0;
                const paidByMeCount = s.payments.filter((p) => p.isPaidByMe).length;

                return (
                  <div
                    key={s.id}
                    onClick={() => {
                      setActiveSalafId(s.id);
                      setSelectedMonthTab(Math.min(s.monthsCount, passed || 1));
                      setStatusFilter('all');
                      setActiveMemberId(null);
                    }}
                    className="p-5 rounded-3xl border border-white/5 bg-[#121214]/60 hover:bg-[#161619]/80 transition-all cursor-pointer flex flex-col gap-4 relative group"
                  >
                    <div className="absolute top-4 left-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditSalaf(s);
                        }}
                        className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 flex items-center justify-center text-zinc-400 hover:text-white transition-colors cursor-pointer"
                        title="تعديل السلفة"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSalaf(s.id, s.name);
                        }}
                        className="w-8 h-8 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 flex items-center justify-center text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
                        title="حذف السلفة"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-sm font-black text-white group-hover:text-amber-400 transition-colors flex items-center gap-2">
                          <span>{s.name}</span>
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        </h4>
                        <p className="text-[10px] text-zinc-500 mt-1 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-zinc-600" />
                          <span>تاريخ الانطلاق: {s.startDate}</span>
                        </p>
                      </div>
                      <div className="text-left">
                        <span className="text-[10px] text-zinc-500 font-bold block">القيمة الكلية</span>
                        <span className="text-xs font-black text-amber-500 font-mono tracking-tight">{fmtIQD(s.totalAmount)}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 border-t border-b border-white/5 py-3 text-xs">
                      <div>
                        <span className="text-zinc-500 block text-[9px] mb-0.5">القسط الشهري</span>
                        <span className="font-black text-white font-mono">{fmtIQD(s.monthlyAmount)}</span>
                      </div>
                      <div className="border-x border-white/5 px-1.5 text-center">
                        <span className="text-zinc-500 block text-[9px] mb-0.5">عدد الأسهم</span>
                        <span className="font-black text-white font-mono">{s.monthsCount} عضو</span>
                      </div>
                      <div className="text-left">
                        <span className="text-zinc-500 block text-[9px] mb-0.5">المشتركين الحاليين</span>
                        <span className="font-black text-amber-400 font-mono">{s.members.length} / {s.monthsCount}</span>
                      </div>
                    </div>

                    {/* Progress tracking */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-[10px] font-bold text-zinc-400">
                        <span className="flex items-center gap-1">
                          <span>الشهر المنقضي {passed}</span>
                          <span className="text-zinc-600">•</span>
                          <span className="text-zinc-500">المتبقي {remaining} شهر</span>
                        </span>
                        <span className="font-mono text-amber-400">{Math.round(progressPct)}%</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden border border-white/5">
                        <div
                          style={{ width: `${progressPct}%` }}
                          className="h-full bg-gradient-to-l from-amber-500 to-amber-600 rounded-full transition-all duration-500"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-zinc-500 font-semibold bg-[#18181a]/50 px-3 py-2 rounded-xl border border-white/5">
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-zinc-600" />
                        <span>أعضاء مستلمين: {s.members.filter(m => m.isReceiver).length}</span>
                      </span>
                      {paidByMeCount > 0 && (
                        <span className="text-rose-400 bg-rose-500/5 px-2 py-0.5 rounded-md border border-rose-500/10">
                          {paidByMeCount} دفعات مدفوعة بالنيابة
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* CASE 2: SINGLE SALAF DETAILED DASHBOARD VIEW */}
      {activeSalafId && currentSalaf && !activeMemberId && (
        <div className="flex flex-col gap-5">
          {/* Back button */}
          <button
            onClick={() => setActiveSalafId(null)}
            className="w-fit h-9 px-3.5 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 text-zinc-300 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <ArrowRight className="w-4 h-4 stroke-[2.2]" />
            <span>العودة لقائمة السلف</span>
          </button>

          {/* MINI-HEADER ABOUT SALAF */}
          <div className="p-5 rounded-3xl border border-white/5 bg-[#121214]/60 backdrop-blur-2xl relative overflow-hidden flex flex-col gap-4">
            <div className="absolute top-0 left-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex items-start justify-between">
              <div>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/25 mb-1.5">
                  <Sparkles className="w-3 h-3" />
                  <span>سلفة نشطة ومستمرة</span>
                </span>
                <h3 className="text-base font-black text-white">{currentSalaf.name}</h3>
                <p className="text-xs text-zinc-400 mt-1">{currentSalaf.notes || 'لا يوجد ملاحظات عامة مسجلة على هذه السلفة.'}</p>
              </div>

              <div className="flex flex-col items-end">
                <span className="text-[10px] text-zinc-500 font-semibold">القيمة الكلية للجمعية</span>
                <span className="text-sm font-black text-amber-500 font-mono tracking-tight">{fmtIQD(currentSalaf.totalAmount)}</span>
              </div>
            </div>

            {/* PROGRESS STATISTICS */}
            {(() => {
              const passed = getMonthsPassed(currentSalaf.startDate, currentSalaf.monthsCount);
              const remaining = Math.max(0, currentSalaf.monthsCount - passed);
              const expectedEndDate = new Date(currentSalaf.startDate);
              expectedEndDate.setMonth(expectedEndDate.getMonth() + currentSalaf.monthsCount);
              const endDateStr = expectedEndDate.toISOString().split('T')[0];

              const totalPaidByMeThisSalaf = currentSalaf.payments.filter((p) => p.isPaidByMe).length;

              return (
                <>
                  <div className="grid grid-cols-3 gap-2 border-t border-b border-white/5 py-4 text-xs font-semibold">
                    <div>
                      <span className="text-zinc-500 block text-[9px] mb-0.5">تاريخ الانطلاق</span>
                      <span className="text-white font-mono text-[11px]">{currentSalaf.startDate}</span>
                    </div>
                    <div className="border-x border-white/5 px-2 text-center">
                      <span className="text-zinc-500 block text-[9px] mb-0.5">تاريخ الانتهاء المتوقع</span>
                      <span className="text-white font-mono text-[11px]">{endDateStr}</span>
                    </div>
                    <div className="text-left">
                      <span className="text-zinc-500 block text-[9px] mb-0.5">أنا دفعت بالنيابة</span>
                      <span className="text-rose-400 font-mono text-[11px]">{totalPaidByMeThisSalaf} دفعات</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-[#18181b]/40 rounded-2xl border border-white/5 flex flex-col gap-0.5">
                      <span className="text-zinc-500 text-[9px] font-bold">الأشهر المنقضية</span>
                      <span className="text-white font-black font-mono">{passed} شهر</span>
                    </div>
                    <div className="p-3 bg-[#18181b]/40 rounded-2xl border border-white/5 flex flex-col gap-0.5">
                      <span className="text-zinc-500 text-[9px] font-bold">المتبقي للنهاية</span>
                      <span className="text-white font-black font-mono">{remaining} شهر</span>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>

          {/* ACTIVE MEMBERS AND PAYMENTS OF THE CHOSEN MONTH */}
          <div className="flex flex-col gap-4">
            
            {/* MONTH SELECTOR BAR */}
            <div className="flex items-center justify-between px-1">
              <h4 className="text-xs font-bold text-zinc-400">متابعة دفعات الأشهر (اختر الشهر لتحديد كشف سداده)</h4>
            </div>

            <div className="flex items-center gap-2 bg-[#121214]/60 p-2 rounded-2xl border border-white/5">
              <button
                disabled={selectedMonthTab <= 1}
                onClick={() => setSelectedMonthTab(selectedMonthTab - 1)}
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center cursor-pointer transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <div className="flex-1 text-center">
                <span className="text-xs font-bold text-zinc-400">الشهر المستهدف للمتابعة</span>
                <span className="block text-sm font-black text-amber-500 font-mono">الشهر {selectedMonthTab} / {currentSalaf.monthsCount}</span>
              </div>

              <button
                disabled={selectedMonthTab >= currentSalaf.monthsCount}
                onClick={() => setSelectedMonthTab(selectedMonthTab + 1)}
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center cursor-pointer transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>

            {/* BUTTON FILTERS FOR PAID/UNPAID MEMBERS IN THIS MONTH */}
            <div className="grid grid-cols-3 gap-2 bg-[#121214]/40 p-1.5 rounded-2xl border border-white/5">
              <button
                onClick={() => setStatusFilter('all')}
                className={`h-9 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                  statusFilter === 'all'
                    ? 'bg-amber-500/10 border border-amber-500/25 text-amber-400 shadow-md shadow-amber-500/5'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                الكل ({currentSalaf.members.length})
              </button>

              <button
                onClick={() => setStatusFilter('paid')}
                className={`h-9 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                  statusFilter === 'paid'
                    ? 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 shadow-md shadow-emerald-500/5'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                من سدد ({
                  currentSalaf.members.filter((m) =>
                    currentSalaf.payments.some((p) => p.memberId === m.id && p.monthIndex === selectedMonthTab)
                  ).length
                })
              </button>

              <button
                onClick={() => setStatusFilter('unpaid')}
                className={`h-9 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                  statusFilter === 'unpaid'
                    ? 'bg-rose-500/10 border border-rose-500/25 text-rose-400 shadow-md shadow-rose-500/5'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                لم يسدد ({
                  currentSalaf.members.filter((m) =>
                    !currentSalaf.payments.some((p) => p.memberId === m.id && p.monthIndex === selectedMonthTab)
                  ).length
                })
              </button>
            </div>

            {/* ACTIONS BAR INSIDE DETAILED VIEW */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-zinc-500 font-bold px-1">المشتركين المسجلين في هذه السلفة</span>
              <button
                onClick={handleOpenAddMember}
                className="h-8 px-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 text-[10px] text-amber-500 font-bold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>إضافة عضو جديد</span>
              </button>
            </div>

            {/* MEMBER CARDS ACCORDING TO FILTER */}
            <div className="flex flex-col gap-3">
              {(() => {
                const membersToShow = currentSalaf.members.filter((m) => {
                  const paidThisMonth = currentSalaf.payments.some(
                    (p) => p.memberId === m.id && p.monthIndex === selectedMonthTab
                  );
                  if (statusFilter === 'paid') return paidThisMonth;
                  if (statusFilter === 'unpaid') return !paidThisMonth;
                  return true;
                });

                if (membersToShow.length === 0) {
                  return (
                    <div className="text-center py-10 bg-[#121214]/20 border border-dashed border-white/5 rounded-3xl text-zinc-500 text-xs">
                      لا يوجد أعضاء يطابقون تصفية البحث الحالية لهذا الشهر.
                    </div>
                  );
                }

                return membersToShow.map((m) => {
                  const hasPaidThisMonth = currentSalaf.payments.find(
                    (p) => p.memberId === m.id && p.monthIndex === selectedMonthTab
                  );
                  const totalPaidMonths = currentSalaf.payments.filter((p) => p.memberId === m.id).length;
                  const totalPaidAmount = totalPaidMonths * currentSalaf.monthlyAmount;

                  return (
                    <div
                      key={m.id}
                      onClick={() => {
                        setActiveMemberId(m.id);
                      }}
                      className="p-5 rounded-3xl border border-white/5 bg-[#121214]/60 hover:bg-[#161619]/80 transition-all cursor-pointer flex flex-col gap-3 relative group"
                    >
                      {/* Top Row */}
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="text-xs font-black text-white group-hover:text-amber-400 transition-colors flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-zinc-500" />
                            <span>{m.name}</span>
                          </h4>
                          <p className="text-[10px] text-zinc-500 mt-1 flex items-center gap-1 select-all" onClick={e => e.stopPropagation()}>
                            <Phone className="w-3 h-3 text-emerald-500" />
                            <span>{m.phone}</span>
                          </p>
                        </div>

                        {/* Status Badges */}
                        <div className="flex flex-col items-end gap-1">
                          {hasPaidThisMonth ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>تم السداد</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/25">
                              <AlertCircle className="w-3 h-3" />
                              <span>غير مسدد للشهر {selectedMonthTab}</span>
                            </span>
                          )}

                          {m.isReceiver ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/25">
                              <Award className="w-3 h-3" />
                              <span>مستلم (شهر {m.receiveMonthIndex})</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-bold bg-zinc-500/10 text-zinc-400 border border-zinc-500/25">
                              <span>غير مستلم</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Payment History Progress Bar */}
                      <div className="flex flex-col gap-1.5 py-1">
                        <div className="flex items-center justify-between text-[9px] font-bold text-zinc-500">
                          <span>الالتزام الإجمالي: مسدد {totalPaidMonths} من {currentSalaf.monthsCount} شهر</span>
                          <span className="font-mono text-emerald-400">{fmtIQD(totalPaidAmount)}</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden border border-white/5">
                          <div
                            style={{ width: `${(totalPaidMonths / currentSalaf.monthsCount) * 100}%` }}
                            className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                          />
                        </div>
                      </div>

                      {/* QUICK INTERACTIVE ACTION BUTTONS */}
                      <div className="flex items-center gap-2 pt-2.5 border-t border-white/5 mt-1" onClick={(e) => e.stopPropagation()}>
                        
                        {/* PAY FOR CURRENT MONTH QUICKLY */}
                        {!hasPaidThisMonth ? (
                          <button
                            onClick={() => handleQuickPayCurrentMonth(currentSalaf, m.id, selectedMonthTab)}
                            className="flex-1 h-9 bg-emerald-500 hover:bg-emerald-400 text-black font-black rounded-xl text-[10px] flex items-center justify-center gap-1 cursor-pointer transition-colors"
                          >
                            <span>سداد سريع</span>
                          </button>
                        ) : (
                          <div className="flex-1 h-9 bg-emerald-500/5 text-emerald-400 border border-emerald-500/10 rounded-xl text-[10px] flex items-center justify-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>مسدد</span>
                          </div>
                        )}

                        {/* TOGGLE RECEIVER STATE */}
                        <button
                          onClick={() => handleToggleReceiveState(currentSalaf.id, m.id, m.isReceiver)}
                          className={`h-9 px-3 rounded-xl font-bold text-[10px] flex items-center justify-center cursor-pointer transition-colors border ${
                            m.isReceiver
                              ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                              : 'bg-white/5 border-white/5 text-zinc-400 hover:bg-white/10'
                          }`}
                          title={m.isReceiver ? 'تحديد كغير مستلم' : 'تحديد كمستلم'}
                        >
                          <span>{m.isReceiver ? 'تم الاستلام' : 'استلام؟'}</span>
                        </button>

                        {/* CALL PHONE */}
                        <a
                          href={`tel:${m.phone}`}
                          className="w-9 h-9 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 text-zinc-300 flex items-center justify-center transition-colors cursor-pointer"
                          title="اتصال بالعضو"
                        >
                          <Phone className="w-4 h-4" />
                        </a>

                        {/* WHATSAPP SHARE */}
                        <button
                          onClick={() => handleWhatsAppShare(currentSalaf, m)}
                          className="w-9 h-9 rounded-xl bg-[#25D366]/10 border border-[#25D366]/20 hover:bg-[#25D366]/20 text-[#25D366] flex items-center justify-center transition-colors cursor-pointer"
                          title="إرسال كشف الدفعات عبر واتساب"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </button>

                        {/* EDIT MEMBER INFO */}
                        <button
                          onClick={(e) => handleEditMember(m, e)}
                          className="w-9 h-9 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 text-zinc-300 flex items-center justify-center transition-colors cursor-pointer"
                          title="تعديل معلومات العضو"
                        >
                          <Edit className="w-4 h-4" />
                        </button>

                        {/* REMOVE MEMBER */}
                        <button
                          onClick={() => handleDeleteMember(m.id, m.name)}
                          className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/25 hover:bg-rose-500/20 text-rose-400 flex items-center justify-center transition-colors cursor-pointer"
                          title="إزالة العضو"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>

                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}

      {/* CASE 3: CHOSEN MEMBER DETAILED INDIVIDUAL PROFILE VIEW */}
      {activeSalafId && currentSalaf && activeMemberId && currentMember && (
        <div className="flex flex-col gap-5 animate-fade-in">
          {/* Back to Salaf panel */}
          <button
            onClick={() => setActiveMemberId(null)}
            className="w-fit h-9 px-3.5 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 text-zinc-300 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <ArrowRight className="w-4 h-4 stroke-[2.2]" />
            <span>العودة لـ ({currentSalaf.name})</span>
          </button>

          {/* MEMBER PROFILE HEADER STATS */}
          <div className="p-5 rounded-3xl border border-white/5 bg-[#121214]/60 backdrop-blur-2xl relative overflow-hidden flex flex-col gap-4">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-black text-white">{currentMember.name}</h3>
                <p className="text-xs text-zinc-500 mt-1 flex items-center gap-1 select-all">
                  <Phone className="w-3.5 h-3.5 text-emerald-500" />
                  <span>{currentMember.phone}</span>
                </p>
                {currentMember.notes && (
                  <p className="text-xs text-zinc-400 mt-2 bg-white/5 p-3 rounded-xl border border-white/5 leading-relaxed">
                    ملاحظات: {currentMember.notes}
                  </p>
                )}
              </div>

              <div>
                {currentMember.isReceiver ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-amber-500/10 text-amber-400 border border-amber-500/25 shadow-lg shadow-amber-500/5">
                    <Award className="w-4 h-4" />
                    <span>مستلم (شهر {currentMember.receiveMonthIndex})</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-zinc-500/10 text-zinc-400 border border-zinc-500/25">
                    <span>غير مستلم</span>
                  </span>
                )}
              </div>
            </div>

            {/* QUICK INFORMATION BLOCKS (قراءة سريعة) */}
            {(() => {
              const memberPayments = currentSalaf.payments.filter((p) => p.memberId === currentMember.id);
              const paidAmount = memberPayments.reduce((sum, p) => sum + p.amount, 0);
              const paidCount = memberPayments.length;
              const remainingCount = Math.max(0, currentSalaf.monthsCount - paidCount);
              const remainingAmount = remainingCount * currentSalaf.monthlyAmount;
              const paidByMeCount = memberPayments.filter((p) => p.isPaidByMe).length;

              return (
                <div className="flex flex-col gap-3 pt-3 border-t border-white/5">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="bg-[#18181b]/50 p-3 rounded-2xl border border-white/5 flex flex-col gap-1 text-center">
                      <span className="text-zinc-500 text-[10px] font-bold">إجمالي ما سدده</span>
                      <span className="text-xs font-black text-emerald-400 font-mono tracking-tight">{fmtIQD(paidAmount)}</span>
                      <span className="text-[9px] text-zinc-500">({paidCount} دفعات)</span>
                    </div>

                    <div className="bg-[#18181b]/50 p-3 rounded-2xl border border-white/5 flex flex-col gap-1 text-center">
                      <span className="text-zinc-500 text-[10px] font-bold">إجمالي المتبقي عليه</span>
                      <span className="text-xs font-black text-orange-400 font-mono tracking-tight">{fmtIQD(remainingAmount)}</span>
                      <span className="text-[9px] text-zinc-500">({remainingCount} أشهر متبقية)</span>
                    </div>
                  </div>

                  {/* Highlight "I paid on behalf of them" counter */}
                  <div className="bg-rose-500/5 p-3.5 rounded-2xl border border-rose-500/10 flex items-center justify-between text-xs font-bold">
                    <div className="flex items-center gap-2 text-zinc-300">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                      <span>دفعات دفعتها الإدارة بالنيابة عنه:</span>
                    </div>
                    <span className="text-sm font-black text-rose-400 font-mono bg-rose-500/10 px-3 py-1 rounded-lg border border-rose-500/10">{paidByMeCount} دفعات</span>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* LIST OF ALL THE PAYMENTS REGISTERED FOR THIS SPECIFIC MEMBER */}
          <div className="flex flex-col gap-3.5">
            <div className="flex items-center justify-between px-1">
              <h4 className="text-xs font-black text-zinc-400">كشف وسجل دفعات العضو التفصيلية</h4>
              <button
                onClick={() => handleOpenAddPayment(currentMember.id)}
                className="h-8 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-[10px] flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>إضافة دفعة سداد</span>
              </button>
            </div>

            {(() => {
              const memberPayments = currentSalaf.payments.filter((p) => p.memberId === currentMember.id);
              if (memberPayments.length === 0) {
                return (
                  <div className="text-center py-16 bg-[#121214]/20 border border-dashed border-white/5 rounded-3xl text-zinc-500 text-xs">
                    لم يقم العضو بتسجيل أي دفعات سداد سابقة في هذه السلفة.
                  </div>
                );
              }

              return (
                <div className="flex flex-col gap-2.5">
                  {memberPayments
                    .slice()
                    .sort((a, b) => b.monthIndex - a.monthIndex)
                    .map((p) => (
                      <div
                        key={p.id}
                        className="p-4 bg-[#121214]/60 rounded-2xl border border-white/5 flex flex-col gap-2.5 hover:bg-[#161619]/80 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center font-bold text-xs font-mono">
                              {p.monthIndex}
                            </span>
                            <span className="text-xs font-black text-white">الشهر {p.monthIndex}</span>
                          </div>

                          <div className="flex gap-1.5">
                            <button
                              onClick={() => handleEditPayment(p)}
                              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 flex items-center justify-center text-zinc-400 hover:text-white transition-colors cursor-pointer"
                              title="تعديل الدفعة"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeletePayment(p.id)}
                              className="w-8 h-8 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 flex items-center justify-center text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
                              title="حذف الدفعة"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs font-semibold text-zinc-400 bg-black/30 p-2.5 rounded-xl border border-white/5">
                          <span className="font-mono text-[11px]">{p.date}</span>
                          <span className="font-black text-emerald-400 font-mono">{fmtIQD(p.amount)}</span>
                        </div>

                        {/* Status tag and custom notes */}
                        <div className="flex flex-col gap-1.5">
                          {p.isPaidByMe && (
                            <span className="inline-flex w-fit items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/15">
                              <AlertCircle className="w-3.5 h-3.5" />
                              <span>دُفعت بالنيابة عنه بواسطة الإدارة</span>
                            </span>
                          )}

                          {p.notes && (
                            <p className="text-[10px] text-zinc-500 bg-[#161618]/30 px-3 py-2 rounded-xl border border-white/5 leading-relaxed">
                              البيان/الملاحظة: {p.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          MODALS SECTION
          ------------------------------------------------------------- */}

      {/* MODAL 1: ADD SALAF */}
      {isAddSalafOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in" dir="rtl">
          <div className="bg-[#0c0c0e] border border-white/5 rounded-[26px] p-6 w-full max-w-[390px] shadow-2xl relative max-h-[90vh] overflow-y-auto scrollbar-thin">
            <h3 className="text-base font-black text-white mb-1 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-500 animate-pulse" />
              <span>إنشاء سلفة جديدة</span>
            </h3>
            <p className="text-xs text-zinc-400 mb-5 leading-relaxed">أدخل مواصفات الجمعية المالية الجديدة لتأسيسها وتوزيع الأسهم.</p>

            <form onSubmit={handleCreateSalaf} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-400 font-semibold mr-1">اسم السلفة</label>
                <input
                  type="text"
                  value={salafName}
                  onChange={(e) => setSalafName(e.target.value)}
                  placeholder="مثال: سلفة 10 ملايين ديوانية"
                  required
                  className="w-full h-11 px-4 rounded-xl bg-[#161618] border border-white/5 text-white text-xs focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-400 font-semibold mr-1">القيمة الكلية للسلفة (د.ع)</label>
                <input
                  type="number"
                  value={salafTotalAmount}
                  onChange={(e) => setSalafTotalAmount(e.target.value)}
                  placeholder="مثال: 10000000"
                  required
                  className="w-full h-11 px-4 rounded-xl bg-[#161618] border border-white/5 text-white text-xs font-mono text-left focus:outline-none focus:border-amber-500/50"
                  dir="ltr"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-400 font-semibold mr-1">القسط الشهري للعضو الواحد (د.ع)</label>
                <input
                  type="number"
                  value={salafMonthlyAmount}
                  onChange={(e) => setSalafMonthlyAmount(e.target.value)}
                  placeholder="مثال: 500000"
                  required
                  className="w-full h-11 px-4 rounded-xl bg-[#161618] border border-white/5 text-white text-xs font-mono text-left focus:outline-none focus:border-amber-500/50"
                  dir="ltr"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-400 font-semibold mr-1">عدد الأشهر / الأسهم (الأعضاء)</label>
                <input
                  type="number"
                  value={salafMonthsCount}
                  onChange={(e) => setSalafMonthsCount(e.target.value)}
                  placeholder="مثال: 20"
                  required
                  className="w-full h-11 px-4 rounded-xl bg-[#161618] border border-white/5 text-white text-xs font-mono text-left focus:outline-none focus:border-amber-500/50"
                  dir="ltr"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-400 font-semibold mr-1">تاريخ انطلاق السلفة</label>
                <input
                  type="date"
                  value={salafStartDate}
                  onChange={(e) => setSalafStartDate(e.target.value)}
                  required
                  className="w-full h-11 px-4 rounded-xl bg-[#161618] border border-white/5 text-white text-xs font-mono text-left focus:outline-none focus:border-amber-500/50"
                  dir="ltr"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-400 font-semibold mr-1">ملاحظات عامة</label>
                <textarea
                  value={salafNotes}
                  onChange={(e) => setSalafNotes(e.target.value)}
                  placeholder="اكتب ملاحظات اختيارية..."
                  className="w-full p-4 rounded-xl bg-[#161618] border border-white/5 text-white text-xs focus:outline-none focus:border-amber-500/50 h-20 resize-none"
                />
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-white/5 mt-2">
                <button
                  type="submit"
                  className="flex-1 h-11 bg-amber-500 hover:bg-amber-400 text-black font-black rounded-xl text-xs flex items-center justify-center cursor-pointer transition-colors"
                >
                  <span>تأسيس السلفة</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddSalafOpen(false)}
                  className="flex-1 h-11 bg-white/5 border border-white/5 hover:bg-white/10 text-zinc-300 font-bold rounded-xl text-xs flex items-center justify-center cursor-pointer transition-colors"
                >
                  <span>إلغاء</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT SALAF */}
      {isEditSalafOpen && editingSalaf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in" dir="rtl">
          <div className="bg-[#0c0c0e] border border-white/5 rounded-[26px] p-6 w-full max-w-[390px] shadow-2xl relative max-h-[90vh] overflow-y-auto scrollbar-thin">
            <h3 className="text-base font-black text-white mb-1 flex items-center gap-2">
              <Edit className="w-5 h-5 text-amber-500" />
              <span>تعديل السلفة</span>
            </h3>
            <p className="text-xs text-zinc-400 mb-5 leading-relaxed">قم بتحديث إعدادات أو تفاصيل السلفة الحالية.</p>

            <form onSubmit={handleSaveEditedSalaf} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-400 font-semibold mr-1">اسم السلفة</label>
                <input
                  type="text"
                  value={salafName}
                  onChange={(e) => setSalafName(e.target.value)}
                  required
                  className="w-full h-11 px-4 rounded-xl bg-[#161618] border border-white/5 text-white text-xs focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-400 font-semibold mr-1">القيمة الكلية للسلفة (د.ع)</label>
                <input
                  type="number"
                  value={salafTotalAmount}
                  onChange={(e) => setSalafTotalAmount(e.target.value)}
                  required
                  className="w-full h-11 px-4 rounded-xl bg-[#161618] border border-white/5 text-white text-xs font-mono text-left focus:outline-none focus:border-amber-500/50"
                  dir="ltr"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-400 font-semibold mr-1">القسط الشهري للعضو (د.ع)</label>
                <input
                  type="number"
                  value={salafMonthlyAmount}
                  onChange={(e) => setSalafMonthlyAmount(e.target.value)}
                  required
                  className="w-full h-11 px-4 rounded-xl bg-[#161618] border border-white/5 text-white text-xs font-mono text-left focus:outline-none focus:border-amber-500/50"
                  dir="ltr"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-400 font-semibold mr-1">عدد الأشهر / الأسهم</label>
                <input
                  type="number"
                  value={salafMonthsCount}
                  onChange={(e) => setSalafMonthsCount(e.target.value)}
                  required
                  className="w-full h-11 px-4 rounded-xl bg-[#161618] border border-white/5 text-white text-xs font-mono text-left focus:outline-none focus:border-amber-500/50"
                  dir="ltr"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-400 font-semibold mr-1">تاريخ انطلاق السلفة</label>
                <input
                  type="date"
                  value={salafStartDate}
                  onChange={(e) => setSalafStartDate(e.target.value)}
                  required
                  className="w-full h-11 px-4 rounded-xl bg-[#161618] border border-white/5 text-white text-xs font-mono text-left focus:outline-none focus:border-amber-500/50"
                  dir="ltr"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-400 font-semibold mr-1">ملاحظات عامة</label>
                <textarea
                  value={salafNotes}
                  onChange={(e) => setSalafNotes(e.target.value)}
                  className="w-full p-4 rounded-xl bg-[#161618] border border-white/5 text-white text-xs focus:outline-none focus:border-amber-500/50 h-20 resize-none"
                />
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-white/5 mt-2">
                <button
                  type="submit"
                  className="flex-1 h-11 bg-amber-500 hover:bg-amber-400 text-black font-black rounded-xl text-xs flex items-center justify-center cursor-pointer transition-colors"
                >
                  <span>حفظ التعديلات</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditSalafOpen(false);
                    setEditingSalaf(null);
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

      {/* MODAL 3: ADD MEMBER TO SALAF */}
      {isAddMemberOpen && currentSalaf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in" dir="rtl">
          <div className="bg-[#0c0c0e] border border-white/5 rounded-[26px] p-6 w-full max-w-[390px] shadow-2xl relative max-h-[90vh] overflow-y-auto scrollbar-thin">
            <h3 className="text-base font-black text-white mb-1 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-amber-500" />
              <span>إضافة عضو للسلفة</span>
            </h3>
            <p className="text-xs text-zinc-400 mb-4 leading-relaxed">اختر زبوناً مسجلاً بالفعل، أو سجل عضواً جديداً في سلفة "{currentSalaf.name}".</p>

            {/* Selector between existing and new customers */}
            <div className="grid grid-cols-2 gap-2 bg-[#161618] p-1 rounded-xl border border-white/5 mb-4">
              <button
                type="button"
                onClick={() => setMemberSource('existing')}
                className={`h-9 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  memberSource === 'existing' ? 'bg-white/5 text-white' : 'text-zinc-500'
                }`}
              >
                من قاعدة الزبائن
              </button>
              <button
                type="button"
                onClick={() => setMemberSource('new')}
                className={`h-9 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  memberSource === 'new' ? 'bg-white/5 text-white' : 'text-zinc-500'
                }`}
              >
                تسجيل عضو خارجي جديد
              </button>
            </div>

            <form onSubmit={handleCreateMember} className="flex flex-col gap-4">
              {memberSource === 'existing' ? (
                <div className="flex flex-col gap-2">
                  <label className="text-xs text-zinc-400 font-semibold mr-1">ابحث واختر من قاعدة الزبائن</label>
                  
                  {/* Search box */}
                  <div className="relative h-11 rounded-xl bg-[#161618] border border-white/5 flex items-center px-3.5">
                    <Search className="w-4 h-4 text-zinc-500 ml-2" />
                    <input
                      type="text"
                      placeholder="ابحث بالاسم أو رقم الهاتف..."
                      value={customerSearchQuery}
                      onChange={(e) => setCustomerSearchQuery(e.target.value)}
                      className="flex-1 bg-transparent text-xs text-white placeholder-zinc-500 focus:outline-none text-right"
                    />
                  </div>

                  {/* Customer Options List */}
                  <div className="flex flex-col gap-1.5 max-h-[160px] overflow-y-auto mt-1 pr-1 bg-[#161618]/30 rounded-xl p-2 border border-white/5">
                    {filteredCustomers.length === 0 ? (
                      <span className="text-center text-[10px] text-zinc-600 py-6">لم يتم العثور على نتائج للبحث</span>
                    ) : (
                      filteredCustomers.map((cust) => {
                        const isSelected = selectedCustomerId === cust.id;
                        return (
                          <button
                            key={cust.id}
                            type="button"
                            onClick={() => setSelectedCustomerId(cust.id)}
                            className={`w-full text-right p-2.5 rounded-lg border text-xs font-bold flex items-center justify-between transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                                : 'bg-transparent border-transparent text-zinc-400 hover:bg-white/5'
                            }`}
                          >
                            <span>{cust.name}</span>
                            <span className="font-mono text-[10px] text-zinc-500">{cust.phone}</span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-zinc-400 font-semibold mr-1">الاسم الكامل للعضو</label>
                    <input
                      type="text"
                      value={memberName}
                      onChange={(e) => setMemberName(e.target.value)}
                      placeholder="مثال: علي جبار محسن"
                      required
                      className="w-full h-11 px-4 rounded-xl bg-[#161618] border border-white/5 text-white text-xs focus:outline-none focus:border-amber-500/50"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-zinc-400 font-semibold mr-1">رقم الهاتف</label>
                    <input
                      type="text"
                      value={memberPhone}
                      onChange={(e) => setMemberPhone(e.target.value)}
                      placeholder="مثال: 07700000000"
                      required
                      className="w-full h-11 px-4 rounded-xl bg-[#161618] border border-white/5 text-white text-xs text-left font-mono focus:outline-none focus:border-amber-500/50"
                      dir="ltr"
                    />
                  </div>
                </>
              )}

              {/* IS RECEIVER SETTING */}
              <div className="bg-[#161618]/60 p-3.5 rounded-xl border border-white/5 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-300 font-bold">هل استلم السلفة الكلية بالفعل؟</span>
                  <input
                    type="checkbox"
                    checked={memberIsReceiver}
                    onChange={(e) => setMemberIsReceiver(e.target.checked)}
                    className="w-4 h-4 accent-amber-500 cursor-pointer"
                  />
                </div>

                {memberIsReceiver && (
                  <div className="flex flex-col gap-1 mt-1 animate-fade-in">
                    <span className="text-[10px] text-zinc-500 font-bold mr-1">حدد رقم الشهر المستحق الذي استلم فيه السلفة</span>
                    <select
                      value={memberReceiveMonth}
                      onChange={(e) => setMemberReceiveMonth(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl bg-[#0c0c0e] border border-white/5 text-white text-xs font-mono focus:outline-none"
                    >
                      {Array.from({ length: currentSalaf.monthsCount }).map((_, idx) => (
                        <option key={idx} value={idx + 1}>الشهر {idx + 1}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-400 font-semibold mr-1">ملاحظات خاصة بالعضو</label>
                <input
                  type="text"
                  value={memberNotes}
                  onChange={(e) => setMemberNotes(e.target.value)}
                  placeholder="ملاحظات اختيارية..."
                  className="w-full h-11 px-4 rounded-xl bg-[#161618] border border-white/5 text-white text-xs focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-white/5 mt-2">
                <button
                  type="submit"
                  className="flex-1 h-11 bg-amber-500 hover:bg-amber-400 text-black font-black rounded-xl text-xs flex items-center justify-center cursor-pointer transition-colors"
                >
                  <span>إضافة للسلفة</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddMemberOpen(false)}
                  className="flex-1 h-11 bg-white/5 border border-white/5 hover:bg-white/10 text-zinc-300 font-bold rounded-xl text-xs flex items-center justify-center cursor-pointer transition-colors"
                >
                  <span>إلغاء</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: EDIT MEMBER INFO */}
      {isEditMemberOpen && editingMember && currentSalaf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in" dir="rtl">
          <div className="bg-[#0c0c0e] border border-white/5 rounded-[26px] p-6 w-full max-w-[390px] shadow-2xl relative max-h-[90vh] overflow-y-auto scrollbar-thin">
            <h3 className="text-base font-black text-white mb-1 flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-amber-500" />
              <span>تعديل العضو</span>
            </h3>
            <p className="text-xs text-zinc-400 mb-5 leading-relaxed">تعديل بيانات أو تفاصيل دور المشترك {editingMember.name}.</p>

            <form onSubmit={handleSaveEditedMember} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-400 font-semibold mr-1">الاسم الكامل للعضو</label>
                <input
                  type="text"
                  value={memberName}
                  onChange={(e) => setMemberName(e.target.value)}
                  required
                  className="w-full h-11 px-4 rounded-xl bg-[#161618] border border-white/5 text-white text-xs focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-400 font-semibold mr-1">رقم الهاتف</label>
                <input
                  type="text"
                  value={memberPhone}
                  onChange={(e) => setMemberPhone(e.target.value)}
                  required
                  className="w-full h-11 px-4 rounded-xl bg-[#161618] border border-white/5 text-white text-xs text-left font-mono focus:outline-none"
                  dir="ltr"
                />
              </div>

              {/* IS RECEIVER SETTING */}
              <div className="bg-[#161618]/60 p-3.5 rounded-xl border border-white/5 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-300 font-bold">هل استلم السلفة الكلية بالفعل؟</span>
                  <input
                    type="checkbox"
                    checked={memberIsReceiver}
                    onChange={(e) => setMemberIsReceiver(e.target.checked)}
                    className="w-4 h-4 accent-amber-500 cursor-pointer"
                  />
                </div>

                {memberIsReceiver && (
                  <div className="flex flex-col gap-1 mt-1 animate-fade-in">
                    <span className="text-[10px] text-zinc-500 font-bold mr-1">حدد رقم الشهر المستحق الذي استلم فيه السلفة</span>
                    <select
                      value={memberReceiveMonth}
                      onChange={(e) => setMemberReceiveMonth(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl bg-[#0c0c0e] border border-white/5 text-white text-xs font-mono focus:outline-none"
                    >
                      {Array.from({ length: currentSalaf.monthsCount }).map((_, idx) => (
                        <option key={idx} value={idx + 1}>الشهر {idx + 1}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-400 font-semibold mr-1">ملاحظات</label>
                <input
                  type="text"
                  value={memberNotes}
                  onChange={(e) => setMemberNotes(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl bg-[#161618] border border-white/5 text-white text-xs focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-white/5 mt-2">
                <button
                  type="submit"
                  className="flex-1 h-11 bg-amber-500 hover:bg-amber-400 text-black font-black rounded-xl text-xs flex items-center justify-center cursor-pointer transition-colors"
                >
                  <span>حفظ التعديلات</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditMemberOpen(false);
                    setEditingMember(null);
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

      {/* MODAL 5: ADD MONTHLY PAYMENT */}
      {isAddPaymentOpen && currentSalaf && currentMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in" dir="rtl">
          <div className="bg-[#0c0c0e] border border-white/5 rounded-[26px] p-6 w-full max-w-[390px] shadow-2xl relative">
            <h3 className="text-base font-black text-white mb-1 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
              <span>تسجيل قسط / دفعة للسلفة</span>
            </h3>
            <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
              تسجيل دفعة سداد للمشترك <span className="text-amber-400 font-bold">{currentMember.name}</span> في سلفة "{currentSalaf.name}".
            </p>

            <form onSubmit={handleCreatePayment} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-400 font-semibold mr-1">رقم الشهر المستهدف بالسداد</label>
                <select
                  value={paymentMonthIndex}
                  onChange={(e) => setPaymentMonthIndex(parseInt(e.target.value))}
                  className="w-full h-11 px-3 rounded-xl bg-[#161618] border border-white/5 text-white text-xs font-mono focus:outline-none focus:border-emerald-500/50"
                >
                  {Array.from({ length: currentSalaf.monthsCount }).map((_, idx) => {
                    const mIdx = idx + 1;
                    const alreadyPaid = currentSalaf.payments.some(p => p.memberId === currentMember.id && p.monthIndex === mIdx);
                    return (
                      <option key={idx} value={mIdx} disabled={alreadyPaid}>
                        الشهر {mIdx} {alreadyPaid ? '(مسدد سابقاً)' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-400 font-semibold mr-1">قيمة الدفعة (د.ع)</label>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="مثال: 500000"
                  required
                  className="w-full h-11 px-4 rounded-xl bg-[#161618] border border-white/5 text-white text-xs font-mono text-left focus:outline-none focus:border-emerald-500/50"
                  dir="ltr"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-400 font-semibold mr-1">تاريخ السداد</label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  required
                  className="w-full h-11 px-4 rounded-xl bg-[#161618] border border-white/5 text-white text-xs font-mono text-left focus:outline-none focus:border-emerald-500/50"
                  dir="ltr"
                />
              </div>

              {/* PAID BY ME TOGGLE (أنا دفعت بدلاً عنه) */}
              <div className="bg-rose-500/5 border border-rose-500/10 p-3.5 rounded-xl flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-black text-rose-400">
                    <AlertCircle className="w-4 h-4" />
                    <span>أنا دفعت بدلاً عنه</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={paymentIsPaidByMe}
                    onChange={(e) => setPaymentIsPaidByMe(e.target.checked)}
                    className="w-4.5 h-4.5 accent-rose-500 cursor-pointer"
                  />
                </div>
                <p className="text-[9px] text-zinc-500 mt-1 leading-relaxed">
                  فعّل هذا الخيار إذا كان العضو تعذر عن الدفع وقام المكتب بدفع القسط بدلاً عنه لضمان عدم توقف السلفة مع المطالبة لاحقاً.
                </p>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-400 font-semibold mr-1">بيان / ملاحظات الدفعة</label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="مثال: تسديد نقدي في المكتب..."
                  className="w-full h-11 px-4 rounded-xl bg-[#161618] border border-white/5 text-white text-xs focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-white/5 mt-2">
                <button
                  type="submit"
                  className="flex-1 h-11 bg-emerald-500 hover:bg-emerald-400 text-black font-black rounded-xl text-xs flex items-center justify-center cursor-pointer transition-colors"
                >
                  <span>تسجيل الدفعة</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddPaymentOpen(false);
                    setActiveMemberId(null);
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

      {/* MODAL 6: EDIT MONTHLY PAYMENT */}
      {isEditPaymentOpen && editingPayment && currentSalaf && currentMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in" dir="rtl">
          <div className="bg-[#0c0c0e] border border-white/5 rounded-[26px] p-6 w-full max-w-[390px] shadow-2xl relative">
            <h3 className="text-base font-black text-white mb-1 flex items-center gap-2">
              <Edit className="w-5 h-5 text-amber-500" />
              <span>تعديل دفعة السداد</span>
            </h3>
            <p className="text-xs text-zinc-400 mb-4 leading-relaxed">تعديل بيانات القسط للشهر {editingPayment.monthIndex} للعضو {currentMember.name}.</p>

            <form onSubmit={handleSaveEditedPayment} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-400 font-semibold mr-1">رقم الشهر</label>
                <input
                  type="number"
                  value={paymentMonthIndex}
                  onChange={(e) => setPaymentMonthIndex(parseInt(e.target.value))}
                  className="w-full h-11 px-4 rounded-xl bg-[#161618] border border-white/5 text-white text-xs font-mono text-left focus:outline-none"
                  dir="ltr"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-400 font-semibold mr-1">قيمة الدفعة (د.ع)</label>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  required
                  className="w-full h-11 px-4 rounded-xl bg-[#161618] border border-white/5 text-white text-xs font-mono text-left focus:outline-none"
                  dir="ltr"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-400 font-semibold mr-1">تاريخ السداد</label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  required
                  className="w-full h-11 px-4 rounded-xl bg-[#161618] border border-white/5 text-white text-xs font-mono text-left focus:outline-none"
                  dir="ltr"
                />
              </div>

              {/* PAID BY ME TOGGLE (أنا دفعت بدلاً عنه) */}
              <div className="bg-rose-500/5 border border-rose-500/10 p-3.5 rounded-xl flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-black text-rose-400">
                    <AlertCircle className="w-4 h-4" />
                    <span>أنا دفعت بدلاً عنه</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={paymentIsPaidByMe}
                    onChange={(e) => setPaymentIsPaidByMe(e.target.checked)}
                    className="w-4.5 h-4.5 accent-rose-500 cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-400 font-semibold mr-1">البيان / الملاحظة</label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl bg-[#161618] border border-white/5 text-white text-xs focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-white/5 mt-2">
                <button
                  type="submit"
                  className="flex-1 h-11 bg-amber-500 hover:bg-amber-400 text-black font-black rounded-xl text-xs flex items-center justify-center cursor-pointer transition-colors"
                >
                  <span>حفظ التعديلات</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditPaymentOpen(false);
                    setEditingPayment(null);
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
