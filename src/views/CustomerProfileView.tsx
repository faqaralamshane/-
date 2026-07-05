/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  ArrowRight,
  Phone,
  Pencil,
  Trash2,
  MessageCircle,
  FileText,
  Zap,
  FileSignature,
  Plus,
  ChevronDown,
  Receipt,
  X,
  Trash,
  Lock,
  Unlock
} from 'lucide-react';
import { Customer, Contract, Payment, Template } from '../types';
import {
  fmtIQD,
  remainingForContract,
  totalPaidForContract,
  daysLate,
  latenessTier,
  profitForContract
} from '../finance';
import { showToast } from '../components/Toast';
import { deleteFromStore, putInStore, uid } from '../db';
import { incrementPendingSync } from '../syncQueue';
import { waLink } from '../messages';
import { evaluateCustomerSpecificTokens } from '../auditCustomerTokens';
import { createCustomerAgreementDoc, getAccessToken, isTokenExpired, googleSignIn } from '../googleWorkspace';

interface CustomerProfileViewProps {
  customer: Customer;
  contracts: Contract[];
  payments: Payment[];
  templates: Template[];
  onBack: () => void;
  onRefreshData: () => void;
}

export function CustomerProfileView({
  customer,
  contracts,
  payments,
  templates,
  onBack,
  onRefreshData
}: CustomerProfileViewProps) {
  const [expandedContractId, setExpandedContractId] = useState<string | null>(null);
  const [exportingDocContractId, setExportingDocContractId] = useState<string | null>(null);

  const handleExportAgreementToDocs = async (c: Contract) => {
    let token = await getAccessToken();
    if (!token || isTokenExpired()) {
      try {
        const res = await googleSignIn();
        if (res) {
          token = res.accessToken;
        } else {
          showToast('يرجى تفويض وتفعيل حساب جوجل لتصدير وصياغة العقود', 'warning');
          return;
        }
      } catch (err: any) {
        showToast(err.message || 'فشل تفويض جوجل للعملية', 'error');
        return;
      }
    }

    setExportingDocContractId(c.id);
    try {
      const contractPayments = payments.filter(p => p.contractId === c.id);
      const docId = await createCustomerAgreementDoc(customer, c, contractPayments);
      showToast('تم تصدير اتفاقية العقد وصياغتها بنجاح في مستند Google Docs المعتمد للفرع', 'success');
      window.open(`https://docs.google.com/document/d/${docId}/edit`, '_blank');
    } catch (err: any) {
      showToast(err.message || 'فشل صياغة وتصدير العقد لمستندات جوجل', 'error');
    } finally {
      setExportingDocContractId(null);
    }
  };

  // Modals state
  const [isEditCustomerOpen, setIsEditCustomerOpen] = useState(false);
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  // Edit Customer State
  const [custName, setCustName] = useState(customer.name);
  const [custPhone, setCustPhone] = useState(customer.phone);
  const [custNotes, setCustNotes] = useState(customer.notes || '');
  const [custAccessCode, setCustAccessCode] = useState(customer.accessCode || '');

  // Contract Modal State
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [itemName, setItemName] = useState('');
  const [dueDay, setDueDay] = useState(5);
  const [monthlyInstallment, setMonthlyInstallment] = useState('');
  const [cashPrice, setCashPrice] = useState('');
  const [installmentPrice, setInstallmentPrice] = useState('');
  const [contractNotes, setContractNotes] = useState('');

  // Payment Modal State
  const [paymentContractId, setPaymentContractId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentNotes, setPaymentNotes] = useState('');

  // Get active contracts and statistics
  const custContracts = contracts.filter((c) => c.customerId === customer.id);
  const totalPaid = custContracts.reduce((sum, c) => sum + totalPaidForContract(c, payments), 0);
  const totalRemaining = custContracts.reduce((sum, c) => sum + remainingForContract(c, payments), 0);
  const totalMonthly = custContracts.reduce((sum, c) => {
    const rem = remainingForContract(c, payments);
    return sum + (rem > 0 ? c.monthlyInstallment : 0);
  }, 0);

  // Custom event listeners for external integration (dynamic search, FAB)
  React.useEffect(() => {
    const handleAddContractEvent = () => {
      handleOpenContractModal();
    };
    window.addEventListener('faqar-trigger-add-contract', handleAddContractEvent);
    return () => {
      window.removeEventListener('faqar-trigger-add-contract', handleAddContractEvent);
    };
  }, [customer.id]);

  React.useEffect(() => {
    const handleAddPaymentEvent = () => {
      const activeContract = custContracts.find(c => remainingForContract(c, payments) > 0) || custContracts[0];
      if (activeContract) {
        handleOpenPaymentModal(activeContract.id);
      } else {
        showToast('هذا الزبون ليس لديه أي عقود نشطة لتسجيل دفعة. الرجاء إنشاء عقد أولاً!', 'warning');
      }
    };
    window.addEventListener('faqar-trigger-add-payment', handleAddPaymentEvent);
    return () => {
      window.removeEventListener('faqar-trigger-add-payment', handleAddPaymentEvent);
    };
  }, [customer.id, custContracts, payments]);

  // Load branch settings
  const getBranchSettings = () => {
    try {
      const data = localStorage.getItem('faqar-branch-settings-v1');
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  };
  const branchSettings = getBranchSettings();

  // Handlers for edit customer
  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName.trim()) return;

    const updated: Customer = {
      ...customer,
      name: custName.trim(),
      phone: custPhone.trim(),
      notes: custNotes.trim() || undefined,
      accessCode: custAccessCode.trim() || undefined
    };

    try {
      await putInStore('customers', updated);
      incrementPendingSync();
      showToast('تم تحديث بيانات الزبون بنجاح', 'success');
      setIsEditCustomerOpen(false);
      onRefreshData();
    } catch {
      showToast('فشل تحديث البيانات', 'error');
    }
  };

  const handleToggleLogin = async () => {
    const updated: Customer = {
      ...customer,
      loginDisabled: !customer.loginDisabled
    };

    try {
      await putInStore('customers', updated);
      incrementPendingSync();
      showToast(updated.loginDisabled ? 'تم إيقاف دخول الزبون' : 'تم تفعيل دخول الزبون بنجاح', 'success');
      onRefreshData();
    } catch {
      showToast('فشل تحديث حالة الدخول', 'error');
    }
  };

  const handleDeleteCustomer = async () => {
    const confirmDelete = window.confirm(`⚠️ تحذير: هل أنت متأكد من حذف الزبون "${customer.name}"؟\nسيؤدي هذا إلى حذف جميع العقود والدفعات المرتبطة به نهائياً.`);
    if (!confirmDelete) return;

    try {
      // Delete all customer contracts and payments
      for (const c of custContracts) {
        const contractPayments = payments.filter((p) => p.contractId === c.id);
        for (const p of contractPayments) {
          await deleteFromStore('payments', p.id);
        }
        await deleteFromStore('contracts', c.id);
      }
      await deleteFromStore('customers', customer.id);
      incrementPendingSync();
      showToast('تم حذف الزبون وكافة بياناته بنجاح', 'success');
      onBack();
      onRefreshData();
    } catch {
      showToast('فشل حذف بيانات الزبون', 'error');
    }
  };

  // Handlers for Contract
  const handleOpenContractModal = (contract?: Contract) => {
    if (contract) {
      setEditingContract(contract);
      setItemName(contract.itemName);
      setDueDay(contract.dueDay);
      setMonthlyInstallment(String(contract.monthlyInstallment));
      setCashPrice(String(contract.cashPrice));
      setInstallmentPrice(String(contract.installmentPrice));
      setContractNotes(contract.notes || '');
    } else {
      setEditingContract(null);
      setItemName('');
      setDueDay(5);
      setMonthlyInstallment('');
      setCashPrice('');
      setInstallmentPrice('');
      setContractNotes('');
    }
    setIsContractModalOpen(true);
  };

  const handleSaveContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim() || !installmentPrice || !monthlyInstallment) {
      showToast('يرجى ملء الحقول المطلوبة', 'error');
      return;
    }

    const cid = editingContract ? editingContract.id : 'cont-' + uid();
    const newContract: Contract = {
      id: cid,
      customerId: customer.id,
      itemName: itemName.trim(),
      dueDay: Number(dueDay),
      cashPrice: Number(cashPrice) || 0,
      installmentPrice: Number(installmentPrice),
      monthlyInstallment: Number(monthlyInstallment),
      notes: contractNotes.trim() || undefined,
      createdAt: editingContract ? editingContract.createdAt : new Date().toISOString()
    };

    try {
      await putInStore('contracts', newContract);
      incrementPendingSync();
      showToast(editingContract ? 'تم تعديل العقد بنجاح' : 'تم إنشاء العقد بنجاح', 'success');
      setIsContractModalOpen(false);
      onRefreshData();
    } catch {
      showToast('فشل حفظ العقد', 'error');
    }
  };

  const handleDeleteContract = async (contract: Contract, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmDelete = window.confirm(`هل أنت متأكد من حذف العقد "${contract.itemName}"؟\nسيتم حذف جميع الدفعات المرتبطة به.`);
    if (!confirmDelete) return;

    try {
      const contractPayments = payments.filter((p) => p.contractId === contract.id);
      for (const p of contractPayments) {
        await deleteFromStore('payments', p.id);
      }
      await deleteFromStore('contracts', contract.id);
      incrementPendingSync();
      showToast('تم حذف العقد بنجاح', 'success');
      onRefreshData();
    } catch {
      showToast('فشل حذف العقد', 'error');
    }
  };

  // Handlers for Payment
  const handleOpenPaymentModal = (contractId: string) => {
    const contract = contracts.find((c) => c.id === contractId);
    setPaymentContractId(contractId);
    setPaymentAmount(contract ? String(contract.monthlyInstallment) : '');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentNotes('');
    setIsPaymentModalOpen(true);
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentAmount) {
      showToast('يرجى إدخال مبلغ الدفعة', 'error');
      return;
    }

    const pid = 'pay-' + uid();
    const newPayment: Payment = {
      id: pid,
      contractId: paymentContractId,
      amount: Number(paymentAmount),
      date: paymentDate,
      notes: paymentNotes.trim() || undefined
    };

    try {
      await putInStore('payments', newPayment);
      incrementPendingSync();
      showToast('تم تسجيل الدفعة بنجاح', 'success');
      setIsPaymentModalOpen(false);
      
      // Trigger payment_success templates automatically if configured
      const successTpl = templates.find((t) => t.placement === 'payment_success');
      if (successTpl) {
        const contract = contracts.find((c) => c.id === paymentContractId);
        const text = evaluateCustomerSpecificTokens(successTpl.body, customer, contracts, [...payments, newPayment], contract, branchSettings);
        window.open(waLink(customer.phone, text), '_blank');
      }

      onRefreshData();
    } catch {
      showToast('فشل تسجيل الدفعة', 'error');
    }
  };

  const handleDeletePayment = async (payId: string) => {
    const confirmDelete = window.confirm('هل أنت متأكد من حذف هذه الدفعة؟');
    if (!confirmDelete) return;

    try {
      await deleteFromStore('payments', payId);
      incrementPendingSync();
      showToast('تم حذف الدفعة بنجاح', 'success');
      onRefreshData();
    } catch {
      showToast('فشل حذف الدفعة', 'error');
    }
  };

  // Render quick WhatsApp action link
  const openWhatsApp = (placement: Template['placement'], customTemplate?: Template) => {
    let text = '';
    if (customTemplate) {
      text = evaluateCustomerSpecificTokens(customTemplate.body, customer, contracts, payments, undefined, branchSettings);
    } else if (placement === 'floating') {
      // Default friendly reminder
      const defaultFriendly = templates.find((t) => t.id === 'tpl-friendly')?.body || '';
      text = evaluateCustomerSpecificTokens(defaultFriendly, customer, contracts, payments, undefined, branchSettings);
    } else if (placement === 'profile_top') {
      // Default statement message
      const defaultStatement = templates.find((t) => t.id === 'tpl-statement')?.body || '';
      text = evaluateCustomerSpecificTokens(defaultStatement, customer, contracts, payments, undefined, branchSettings);
    }
    window.open(waLink(customer.phone, text), '_blank');
  };

  const sendAccessInfoViaWhatsApp = () => {
    const portalUrl = `${window.location.origin}/?view=portal&phone=${customer.phone}&code=${customer.accessCode || ''}`;
    const msg = `أهلاً وسهلاً بك عزيزي ${customer.name} 🌹\n\nلمتابعة كافة أقساطك وعقودك ومشترياتك وتفاصيل حسابك المالي أولاً بأول، يمكنك استخدام رابط الدخول المباشر التالي:\n\n🔗 رابط صفحة الدخول:\n${portalUrl}\n\n📞 رقم الهاتف:\n${customer.phone}\n🔑 رمز الدخول السري:\n${customer.accessCode || 'لا يوجد'}\n\nبوابة الاستعلام الإلكتروني - مكتب فقار العمشاني للأقساط والجرد المالي.`;
    window.open(waLink(customer.phone, msg), '_blank');
  };

  // Get filtered templates based on conditions and placement
  const getFilteredTemplates = (placement: Template['placement'], contract?: Contract): Template[] => {
    return templates.filter((t) => {
      if (t.placement !== placement) return false;

      // Check conditions
      const now = new Date();
      const hour = now.getHours();
      const dayOfWeek = now.getDay();

      if (t.days && t.days.length > 0 && !t.days.includes(dayOfWeek)) return false;
      
      if (t.hoursFrom !== undefined && t.hoursTo !== undefined) {
        if (t.hoursFrom <= t.hoursTo) {
          if (hour < t.hoursFrom || hour > t.hoursTo) return false;
        } else {
          // Wrapped around midnight (e.g., 22:00 to 05:00)
          if (hour < t.hoursFrom && hour > t.hoursTo) return false;
        }
      }

      const activeConts = contract ? [contract] : custContracts;
      
      // Calculate max days late and total remaining for conditions
      let maxLate = 0;
      let sumRemaining = 0;
      activeConts.forEach((c) => {
        maxLate = Math.max(maxLate, daysLate(c, payments));
        sumRemaining += remainingForContract(c, payments);
      });

      if (t.minDaysLate !== undefined && maxLate < t.minDaysLate) return false;
      if (t.maxDaysLate !== undefined && maxLate > t.maxDaysLate) return false;
      if (t.minRemaining !== undefined && sumRemaining < t.minRemaining) return false;

      return true;
    });
  };

  const profileTopTemplates = getFilteredTemplates('profile_top');
  const profileBottomTemplates = getFilteredTemplates('profile_bottom');
  const floatingTemplates = getFilteredTemplates('floating');

  // Colors map helper
  const getColorClass = (color: Template['color'], style: Template['style']) => {
    let base = 'amber';
    if (color === 'success') base = 'emerald';
    if (color === 'warning') base = 'orange';
    if (color === 'danger') base = 'rose';

    if (style === 'solid') return `bg-${base}-500 text-black rounded-2xl`;
    if (style === 'outline') return `border-2 border-${base}-500 text-${base}-400 rounded-2xl bg-transparent`;
    if (style === 'gradient') return `bg-gradient-to-br from-${base}-500/20 to-transparent border border-${base}-500/30 text-${base}-400 rounded-2xl`;
    if (style === 'glass') return `backdrop-blur-xl bg-white/5 border border-${base}-500/20 text-${base}-300 rounded-2xl`;
    if (style === 'pill') return `bg-${base}-500/10 text-${base}-400 border border-current rounded-full`;
    if (style === 'icon_only') return `w-10 h-10 rounded-full flex items-center justify-center bg-${base}-500/15 border border-${base}-500/20 text-${base}-400`;
    
    // Tint (default)
    return `bg-${base}-500/10 text-${base}-400 border border-${base}-500/25 hover:bg-${base}-500/20 rounded-2xl`;
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in relative pb-16">
      {/* Back button */}
      <div>
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-amber-500 hover:text-amber-400 font-bold text-sm cursor-pointer"
        >
          <ArrowRight className="w-5 h-5" />
          <span>رجوع للقائمة</span>
        </button>
      </div>

      {/* Main GlassCard */}
      <div className="p-6 rounded-[24px] border border-white/5 bg-[#121214]/60 backdrop-blur-2xl shadow-xl">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-xl font-bold text-white select-all">{customer.name}</h1>
            <p className="text-sm text-zinc-400 flex items-center gap-2 select-all">
              <Phone className="w-4 h-4 text-amber-500" />
              <span>{customer.phone}</span>
            </p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <p id="customer-passcode-p" className="text-xs text-zinc-400 flex items-center gap-2 bg-amber-500/5 px-2.5 py-1 rounded-lg border border-amber-500/10 w-fit select-all">
                <span id="customer-passcode-label" className="text-zinc-500 font-medium">رمز الدخول للزبون:</span>
                <span id="customer-passcode-value" className="text-amber-400 font-mono font-bold tracking-wider">{customer.accessCode || '—'}</span>
              </p>

              <button
                onClick={handleToggleLogin}
                className={`h-7 px-2.5 rounded-lg border flex items-center gap-1.5 text-[11px] font-bold transition-all active:scale-95 cursor-pointer ${
                  customer.loginDisabled
                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20'
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                }`}
                title={customer.loginDisabled ? 'تفعيل الدخول للزبون' : 'تعطيل الدخول للزبون'}
              >
                {customer.loginDisabled ? (
                  <>
                    <Lock className="w-3 h-3 text-rose-400" />
                    <span>الدخول معطّل</span>
                  </>
                ) : (
                  <>
                    <Unlock className="w-3 h-3 text-emerald-400" />
                    <span>الدخول مفعّل</span>
                  </>
                )}
              </button>
            </div>
            {customer.notes && (
              <p className="text-xs text-zinc-500 mt-2 bg-white/5 p-3 rounded-xl border border-white/5 select-all leading-relaxed">
                {customer.notes}
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => {
                setCustName(customer.name);
                setCustPhone(customer.phone);
                setCustNotes(customer.notes || '');
                setCustAccessCode(customer.accessCode || '');
                setIsEditCustomerOpen(true);
              }}
              className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 flex items-center justify-center text-zinc-300 transition-colors cursor-pointer"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={handleDeleteCustomer}
              className="w-10 h-10 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 flex items-center justify-center text-rose-400 transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Action WhatsApp Reminders */}
        <div className="grid grid-cols-2 gap-3 mt-6">
          <button
            onClick={() => openWhatsApp('floating')}
            className="h-10 px-4 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98]"
          >
            <MessageCircle className="w-4 h-4" />
            <span>تذكير ودّي بالقسط</span>
          </button>
          <button
            onClick={() => openWhatsApp('profile_top')}
            className="h-10 px-4 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98]"
          >
            <FileText className="w-4 h-4" />
            <span>كشف حساب كامل</span>
          </button>
        </div>

        {/* Send Login Details */}
        <button
          onClick={sendAccessInfoViaWhatsApp}
          className="w-full h-11 bg-emerald-500 text-black hover:bg-emerald-400 font-bold rounded-xl text-xs flex items-center justify-center gap-2 mt-3 cursor-pointer transition-all active:scale-[0.98] shadow-lg shadow-emerald-500/15"
        >
          <MessageCircle className="w-4 h-4" />
          <span>ارسال رابط صفحة الدخول</span>
        </button>

        {/* Dynamic Profile Top Custom Templates */}
        {profileTopTemplates.length > 0 && (
          <div className="mt-4 flex flex-col gap-2 border-t border-white/5 pt-4">
            <p className="text-[10px] font-semibold text-zinc-500">إجراءات مخصصة علوية</p>
            <div className="grid grid-cols-2 gap-2">
              {profileTopTemplates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => openWhatsApp('profile_top', t)}
                  className={`h-9 px-3 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-[0.98] ${getColorClass(
                    t.color,
                    t.style
                  )}`}
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>{t.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Financial Summary Card */}
      <div className="grid grid-cols-3 gap-3 bg-[#121214]/40 border border-white/5 p-4 rounded-2xl">
        <div className="text-center">
          <p className="text-[10px] font-semibold text-zinc-500 mb-1">المدفوع الكلي</p>
          <p className="text-xs font-bold text-emerald-400 select-all">{fmtIQD(totalPaid)}</p>
        </div>
        <div className="text-center border-x border-white/5 px-2">
          <p className="text-[10px] font-semibold text-zinc-500 mb-1">المتبقي الكلي</p>
          <p className="text-xs font-bold text-orange-400 select-all">{fmtIQD(totalRemaining)}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] font-semibold text-zinc-500 mb-1">الاستحقاق الشهري</p>
          <p className="text-xs font-bold text-amber-500 select-all">{fmtIQD(totalMonthly)}</p>
        </div>
      </div>

      {/* Contracts Section Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-2">
        <div className="flex items-center gap-2">
          <FileSignature className="w-5 h-5 text-amber-500" />
          <h2 className="text-base font-bold text-white">العقود والسلع ({custContracts.length})</h2>
        </div>
        <button
          onClick={() => handleOpenContractModal()}
          className="h-8 px-3 rounded-lg bg-amber-500 text-black hover:bg-amber-400 font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>عقد جديد</span>
        </button>
      </div>

      {/* Contracts Accordion */}
      <div className="flex flex-col gap-3">
        {custContracts.length === 0 ? (
          <div className="text-center py-8 bg-[#121214]/20 rounded-2xl border border-dashed border-white/5 text-zinc-500 text-xs">
            لا يوجد عقود مسجلة لهذا الزبون حالياً.
          </div>
        ) : (
          custContracts.map((c) => {
            const isExpanded = expandedContractId === c.id;
            const cPaid = totalPaidForContract(c, payments);
            const cRem = remainingForContract(c, payments);
            const cLate = daysLate(c, payments);
            const progress = c.installmentPrice > 0 ? (cPaid / c.installmentPrice) * 100 : 0;
            const tier = latenessTier(cLate);

            // Tier styling
            let dotColor = 'bg-emerald-500';
            if (tier === 'soft') dotColor = 'bg-amber-400';
            if (tier === 'orange') dotColor = 'bg-orange-500';
            if (tier === 'red') dotColor = 'bg-rose-500';

            return (
              <div
                key={c.id}
                className={`bg-[#121214]/60 border rounded-2xl overflow-hidden transition-all duration-200 ${
                  isExpanded ? 'border-amber-500/20 shadow-lg' : 'border-white/5'
                }`}
              >
                {/* Accordion Trigger */}
                <div
                  onClick={() => setExpandedContractId(isExpanded ? null : c.id)}
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/[0.01]"
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-3 h-3 rounded-full ${dotColor} animate-pulse`} />
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-white select-all">{c.itemName}</span>
                        {cLate > 0 && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            {cLate} يوم متأخر
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-zinc-400">
                        قسط: {fmtIQD(c.monthlyInstallment)} • استحقاق: يوم {c.dueDay} • دفع: {fmtIQD(cPaid)}
                      </span>
                    </div>
                  </div>
                  <ChevronDown
                    className={`w-5 h-5 text-zinc-500 transition-transform duration-200 ${
                      isExpanded ? 'rotate-180 text-amber-500' : ''
                    }`}
                  />
                </div>

                {/* Progress Bar (Visible always when folded/unfolded) */}
                <div className="w-full h-1 bg-zinc-950">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 rounded-r"
                    style={{ width: `${Math.min(100, progress)}%` }}
                  />
                </div>

                {/* Accordion Body */}
                {isExpanded && (
                  <div className="p-4 bg-zinc-950/40 border-t border-white/5 flex flex-col gap-4">
                    {/* Compact stats */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl text-center">
                        <span className="text-[10px] text-zinc-500 block">حاضر</span>
                        <span className="text-xs font-bold text-zinc-300 select-all">{fmtIQD(c.cashPrice)}</span>
                      </div>
                      <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl text-center">
                        <span className="text-[10px] text-zinc-500 block">بالقسط</span>
                        <span className="text-xs font-bold text-zinc-300 select-all">{fmtIQD(c.installmentPrice)}</span>
                      </div>
                      <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl text-center">
                        <span className="text-[10px] text-zinc-500 block">متبقي</span>
                        <span className="text-xs font-bold text-orange-400 select-all">{fmtIQD(cRem)}</span>
                      </div>
                    </div>

                    {c.notes && (
                      <div className="p-3 bg-white/5 rounded-xl border border-white/5 text-xs text-zinc-400 select-all leading-relaxed">
                        {c.notes}
                      </div>
                    )}

                    {/* Contract Card Placement Custom Templates */}
                    {getFilteredTemplates('contract_card', c).length > 0 && (
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[9px] font-semibold text-zinc-500">إجراءات مخصصة للعقد</span>
                        <div className="flex flex-wrap gap-2">
                          {getFilteredTemplates('contract_card', c).map((t) => (
                            <button
                              key={t.id}
                              onClick={() => {
                                const text = evaluateCustomerSpecificTokens(t.body, customer, contracts, payments, c, branchSettings);
                                window.open(waLink(customer.phone, text), '_blank');
                              }}
                              className={`h-8 px-3 text-xs font-medium flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-[0.98] ${getColorClass(
                                t.color,
                                t.style
                              )}`}
                            >
                              <Zap className="w-3.5 h-3.5" />
                              <span>{t.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 flex-wrap border-t border-white/5 pt-3">
                      <button
                        onClick={() => handleOpenContractModal(c)}
                        className="h-9 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-xs text-zinc-300 flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>تعديل</span>
                      </button>
                      <button
                        onClick={() => handleExportAgreementToDocs(c)}
                        disabled={exportingDocContractId === c.id}
                        className="h-9 px-3 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-xs text-blue-400 flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
                      >
                        <FileText className={`w-3.5 h-3.5 ${exportingDocContractId === c.id ? 'animate-spin' : ''}`} />
                        <span>{exportingDocContractId === c.id ? 'جاري الصياغة سحابياً...' : 'تصدير اتفاقية العقد لـ Google Docs'}</span>
                      </button>
                      <button
                        onClick={(e) => handleDeleteContract(c, e)}
                        className="h-9 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/10 text-xs text-rose-400 flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>حذف العقد</span>
                      </button>
                      {cRem > 0 && (
                        <button
                          onClick={() => handleOpenPaymentModal(c.id)}
                          className="h-9 px-4 rounded-xl bg-emerald-500 text-black hover:bg-emerald-400 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors mr-auto"
                        >
                          <Plus className="w-4 h-4" />
                          <span>تسجيل دفعة</span>
                        </button>
                      )}
                    </div>

                    {/* Payments History section */}
                    <div className="mt-2 border-t border-white/5 pt-3">
                      <div className="flex items-center gap-1.5 mb-3 text-zinc-400 text-xs font-semibold">
                        <Receipt className="w-4 h-4" />
                        <span>تاريخ الدفعات ({payments.filter((p) => p.contractId === c.id).length})</span>
                      </div>

                      <div className="flex flex-col gap-2">
                        {payments.filter((p) => p.contractId === c.id).length === 0 ? (
                          <p className="text-center py-4 text-[11px] text-zinc-600">لا توجد دفعات مسجلة لهذا العقد بعد.</p>
                        ) : (
                          payments
                            .filter((p) => p.contractId === c.id)
                            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                            .map((p) => (
                              <div
                                key={p.id}
                                className="flex items-center justify-between p-3 bg-white/[0.01] border border-white/5 rounded-xl hover:bg-white/[0.03] transition-colors"
                              >
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-xs font-bold text-emerald-400 select-all">{fmtIQD(p.amount)}</span>
                                  <span className="text-[10px] text-zinc-500">
                                    {new Date(p.date).toLocaleDateString('ar-IQ')} {p.notes ? `• ${p.notes}` : ''}
                                  </span>
                                </div>
                                <button
                                  onClick={() => handleDeletePayment(p.id)}
                                  className="w-8 h-8 rounded-lg hover:bg-rose-500/10 text-zinc-500 hover:text-rose-400 flex items-center justify-center transition-colors cursor-pointer"
                                >
                                  <Trash className="w-4 h-4" />
                                </button>
                              </div>
                            ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Dynamic Profile Bottom templates */}
      {profileBottomTemplates.length > 0 && (
        <div className="mt-4 flex flex-col gap-2 border-t border-white/5 pt-4">
          <p className="text-[10px] font-semibold text-zinc-500">إجراءات مخصصة سفلية</p>
          <div className="grid grid-cols-2 gap-2">
            {profileBottomTemplates.map((t) => (
              <button
                key={t.id}
                onClick={() => openWhatsApp('profile_bottom', t)}
                className={`h-10 px-4 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-[0.98] ${getColorClass(
                  t.color,
                  t.style
                )}`}
              >
                <Zap className="w-4 h-4" />
                <span>{t.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Floating templates - Fixed Bottom Left */}
      {floatingTemplates.length > 0 && (
        <div className="fixed bottom-24 left-4 z-40 flex flex-col gap-2">
          {floatingTemplates.map((t) => (
            <button
              key={t.id}
              onClick={() => openWhatsApp('floating', t)}
              className={`w-12 h-12 rounded-full shadow-2xl flex items-center justify-center cursor-pointer transition-all duration-200 active:scale-90 ${getColorClass(
                t.color,
                t.style === 'icon_only' ? 'icon_only' : 'solid'
              )}`}
              title={t.name}
            >
              <Zap className="w-5 h-5" />
            </button>
          ))}
        </div>
      )}

      {/* Edit Customer Modal */}
      {isEditCustomerOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-[448px] bg-[#121214] border-t border-white/10 rounded-t-[24px] p-6 shadow-2xl animate-slide-up">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white">تعديل بيانات الزبون</h3>
              <button
                onClick={() => setIsEditCustomerOpen(false)}
                className="w-8 h-8 rounded-full bg-white/5 border border-white/5 flex items-center justify-center text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-zinc-400">الاسم الكامل *</label>
                <input
                  type="text"
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  required
                  className="w-full h-11 px-4 rounded-xl bg-[#18181b] border border-white/5 text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/50 text-sm"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-zinc-400">رقم الهاتف</label>
                <input
                  type="text"
                  value={custPhone}
                  onChange={(e) => setCustPhone(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl bg-[#18181b] border border-white/5 text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/50 text-sm"
                  dir="ltr"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-400">رمز الدخول للزبون (رقم سري من 4 أرقام) *</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={custAccessCode}
                      readOnly
                      placeholder="جاري التوليد تلقائياً..."
                      required
                      className="w-full h-11 pl-10 pr-4 rounded-xl bg-[#18181b] border border-white/5 text-amber-400 placeholder-zinc-500 focus:outline-none text-sm font-mono font-bold tracking-widest text-center select-all"
                      dir="ltr"
                    />
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-zinc-500">
                      <Lock className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCustAccessCode(Math.floor(1000 + Math.random() * 9000).toString())}
                    className="h-11 px-4 rounded-xl bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 text-amber-400 font-bold text-xs transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 active:scale-95"
                  >
                    <span>تحديث الرمز 🔑</span>
                  </button>
                </div>
                <p className="text-[10px] text-zinc-500 leading-normal">
                  هذا الرمز ثابت وتلقائي لضمان الحماية والسرية. لا يمكن تعديله يدوياً بالكتابة لتجنب الأخطاء، ويمكنك فقط تحديثه وتوليد رمز عشوائي جديد عبر الضغط على الزر بجانبه.
                </p>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-zinc-400">ملاحظات إضافية</label>
                <textarea
                  value={custNotes}
                  onChange={(e) => setCustNotes(e.target.value)}
                  rows={3}
                  className="w-full p-4 rounded-xl bg-[#18181b] border border-white/5 text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/50 text-sm resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full h-12 bg-amber-500 text-black hover:bg-amber-400 font-bold rounded-xl flex items-center justify-center transition-colors mt-2 cursor-pointer"
              >
                حفظ التعديلات
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Contract Add/Edit Modal */}
      {isContractModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-[448px] bg-[#121214] border-t border-white/10 rounded-t-[24px] p-6 shadow-2xl animate-slide-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">
                {editingContract ? 'تعديل بيانات العقد' : 'إنشاء عقد أقساط جديد'}
              </h3>
              <button
                onClick={() => setIsContractModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/5 border border-white/5 flex items-center justify-center text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveContract} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-zinc-400">اسم السلعة / المنتج *</label>
                <input
                  type="text"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="مثال: تلفزيون LG ذكي"
                  required
                  className="w-full h-10 px-4 rounded-xl bg-[#18181b] border border-white/5 text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/50 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-zinc-400">يوم الاستحقاق (1-28) *</label>
                  <input
                    type="number"
                    min={1}
                    max={28}
                    value={dueDay}
                    onChange={(e) => setDueDay(Number(e.target.value))}
                    required
                    className="w-full h-10 px-4 rounded-xl bg-[#18181b] border border-white/5 text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/50 text-xs"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-zinc-400">القسط الشهري *</label>
                  <input
                    type="number"
                    value={monthlyInstallment}
                    onChange={(e) => setMonthlyInstallment(e.target.value)}
                    placeholder="د.ع"
                    required
                    className="w-full h-10 px-4 rounded-xl bg-[#18181b] border border-white/5 text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/50 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-zinc-400">السعر كاش (حاضر)</label>
                  <input
                    type="number"
                    value={cashPrice}
                    onChange={(e) => setCashPrice(e.target.value)}
                    placeholder="د.ع"
                    className="w-full h-10 px-4 rounded-xl bg-[#18181b] border border-white/5 text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/50 text-xs"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-zinc-400">السعر الكلي بالقسط *</label>
                  <input
                    type="number"
                    value={installmentPrice}
                    onChange={(e) => setInstallmentPrice(e.target.value)}
                    placeholder="د.ع"
                    required
                    className="w-full h-10 px-4 rounded-xl bg-[#18181b] border border-white/5 text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/50 text-xs"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-zinc-400">ملاحظات العقد الضمان والكفيل</label>
                <textarea
                  value={contractNotes}
                  onChange={(e) => setContractNotes(e.target.value)}
                  rows={2}
                  placeholder="اكتب أي ملاحظات كفيل أو شروط هنا..."
                  className="w-full p-3 rounded-xl bg-[#18181b] border border-white/5 text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/50 text-xs resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full h-11 bg-amber-500 text-black hover:bg-amber-400 font-bold rounded-xl flex items-center justify-center transition-colors mt-2 cursor-pointer text-xs"
              >
                {editingContract ? 'حفظ التعديلات' : 'إنشاء العقد الجديد'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Payment Add Modal */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-[448px] bg-[#121214] border-t border-white/10 rounded-t-[24px] p-6 shadow-2xl animate-slide-up">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white">تسجيل دفعة جديدة</h3>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/5 border border-white/5 flex items-center justify-center text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePayment} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-zinc-400">مبلغ الدفعة *</label>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="د.ع"
                  required
                  className="w-full h-11 px-4 rounded-xl bg-[#18181b] border border-white/5 text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/50 text-sm"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-zinc-400">تاريخ الدفعة *</label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  required
                  className="w-full h-11 px-4 rounded-xl bg-[#18181b] border border-white/5 text-white focus:outline-none focus:border-amber-500/50 text-sm text-right"
                  dir="ltr"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-zinc-400">ملاحظات الدفعة</label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="مثال: دفع بالفرع نقداً"
                  className="w-full h-11 px-4 rounded-xl bg-[#18181b] border border-white/5 text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/50 text-sm"
                />
              </div>

              <button
                type="submit"
                className="w-full h-12 bg-emerald-500 text-black hover:bg-emerald-400 font-bold rounded-xl flex items-center justify-center transition-colors mt-2 cursor-pointer"
              >
                تسجيل الدفعة
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
