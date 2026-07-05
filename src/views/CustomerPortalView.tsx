/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Phone,
  LogOut,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  DollarSign,
  Building2,
  Calendar,
  RefreshCw,
  Award,
  ShoppingBag,
  Coins,
  ChevronDown,
  ChevronUp,
  User,
  TrendingUp,
  Activity,
  ArrowUpRight,
  Sparkles,
  Percent,
  Wallet,
  Briefcase,
  Layers,
  Check,
  TrendingDown,
  Info
} from 'lucide-react';
import { Customer, Contract, Payment, Debt, DebtTransaction, Salaf, SalafMember, SalafPayment } from '../types';
import { getAllFromStore } from '../db';
import { showToast } from '../components/Toast';

interface CustomerPortalViewProps {
  customerId: string;
  onLogout: () => void;
}

export function CustomerPortalView({ customerId, onLogout }: CustomerPortalViewProps) {
  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [allProfiles, setAllProfiles] = useState<Customer[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  
  const [allContracts, setAllContracts] = useState<Contract[]>([]);
  const [allPayments, setAllPayments] = useState<Payment[]>([]);
  const [associatedDebts, setAssociatedDebts] = useState<Debt[]>([]);
  const [associatedSalafs, setAssociatedSalafs] = useState<Salaf[]>([]);
  const [expandedDebtId, setExpandedDebtId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'contracts' | 'salafs' | 'debts'>('all');

  const [branchSettings, setBranchSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('faqar-branch-settings-v1');
      return saved ? JSON.parse(saved) : { name: 'المكتب الرئيسي', phone: '07700000000' };
    } catch {
      return { name: 'المكتب الرئيسي', phone: '07700000000' };
    }
  });

  // Get Store Custom Button from local storage
  const storeBtnName = localStorage.getItem('faqar-store-btn-name') || 'قم بزيارة المتجر 🏛️';
  const storeBtnUrl = localStorage.getItem('faqar-store-btn-url') || 'https://instagram.com';

  useEffect(() => {
    async function loadPortalData() {
      try {
        const dbCusts = await getAllFromStore<Customer>('customers');
        const dbConts = await getAllFromStore<Contract>('contracts');
        const dbPays = await getAllFromStore<Payment>('payments');
        const dbDebts = await getAllFromStore<Debt>('debts').catch(() => []);
        const dbSalafs = await getAllFromStore<Salaf>('salafs').catch(() => []);

        const activeCust = dbCusts.find((c) => c.id === customerId);
        if (activeCust) {
          setCustomer(activeCust);
          setSelectedProfileId(activeCust.id);

          const matchedPhone = (activeCust.phone || '').trim();
          if (matchedPhone && matchedPhone !== '—') {
            // Find all profiles with the same phone number to allow account switching
            const profiles = dbCusts.filter(
              (c) => c.phone && c.phone.trim() === matchedPhone
            );
            setAllProfiles(profiles);

            // Get all contracts and payments for ALL matched profiles
            const profileIds = profiles.map((p) => p.id);
            const allConts = dbConts.filter((co) => profileIds.includes(co.customerId));
            setAllContracts(allConts);

            const contractIds = allConts.map((c) => c.id);
            const allPays = dbPays.filter((p) => contractIds.includes(p.contractId));
            setAllPayments(allPays);

            // Get associated debts matching the phone number
            const matchedDebts = dbDebts.filter(
              (d) => d.phone && d.phone.trim() === matchedPhone
            );
            setAssociatedDebts(matchedDebts);

            // Get associated salafs where this customer (phone) is a member
            const matchedSalafs = dbSalafs.filter((s) =>
              s.members && s.members.some((m) => m.phone && m.phone.trim() === matchedPhone)
            );
            setAssociatedSalafs(matchedSalafs);
          } else {
            setAllProfiles([activeCust]);
            
            const custContracts = dbConts.filter((co) => co.customerId === customerId);
            setAllContracts(custContracts);

            const contractIds = custContracts.map((c) => c.id);
            const custPayments = dbPays.filter((p) => contractIds.includes(p.contractId));
            setAllPayments(custPayments);

            // Debts and Salafs rely heavily on phone numbers
            setAssociatedDebts([]);
            setAssociatedSalafs([]);
          }
        }
      } catch (err) {
        console.error('Failed to load customer portal data', err);
      } finally {
        setLoading(false);
      }
    }

    loadPortalData();
  }, [customerId]);

  // Utility to format currency
  const fmtIQD = (val: number) => {
    return new Intl.NumberFormat('ar-IQ', { style: 'currency', currency: 'IQD', maximumFractionDigits: 0 }).format(val);
  };

  // Calculations for specific contracts
  const getContractPaidAmount = (contractId: string) => {
    return allPayments
      .filter((p) => p.contractId === contractId)
      .reduce((sum, p) => sum + p.amount, 0);
  };

  const getContractRemainingAmount = (contract: Contract) => {
    const paid = getContractPaidAmount(contract.id);
    return Math.max(0, contract.installmentPrice - paid);
  };

  // 1. Installments calculations
  const totalPaidContracts = allContracts.reduce((sum, c) => sum + getContractPaidAmount(c.id), 0);
  const totalRemainingContracts = allContracts.reduce((sum, c) => sum + getContractRemainingAmount(c), 0);
  const totalMonthlyInstallments = allContracts.reduce((sum, c) => {
    const rem = getContractRemainingAmount(c);
    return rem > 0 ? sum + c.monthlyInstallment : sum;
  }, 0);

  // 2. Salafs calculations
  const matchedPhone = customer ? (customer.phone || '').trim() : '';

  const totalSalafsPaid = associatedSalafs.reduce((sum, s) => {
    const m = s.members?.find((mem) => mem.phone && mem.phone.trim() === matchedPhone);
    if (!m) return sum;
    const paidMonths = s.payments?.filter((p) => p.memberId === m.id).length || 0;
    return sum + (paidMonths * s.monthlyAmount);
  }, 0);

  const totalSalafsRemaining = associatedSalafs.reduce((sum, s) => {
    const m = s.members?.find((mem) => mem.phone && mem.phone.trim() === matchedPhone);
    if (!m) return sum;
    const paidMonths = s.payments?.filter((p) => p.memberId === m.id).length || 0;
    const remainingMonths = Math.max(0, s.monthsCount - paidMonths);
    return sum + (remainingMonths * s.monthlyAmount);
  }, 0);

  const totalSalafsMonthly = associatedSalafs.reduce((sum, s) => {
    const m = s.members?.find((mem) => mem.phone && mem.phone.trim() === matchedPhone);
    if (!m) return sum;
    const paidMonths = s.payments?.filter((p) => p.memberId === m.id).length || 0;
    return paidMonths < s.monthsCount ? sum + s.monthlyAmount : sum;
  }, 0);

  // 3. Debts calculations (to_me = customer owes the office, by_me = office owes customer/supplier or customer purchases on credit)
  // Let's analyze d.type:
  // 'to_me': I am owed by the person (person must pay me). From customer portal perspective, this means the customer owes the office!
  // 'by_me': I owe the person. From customer portal perspective, the office owes the customer.
  const customerDebtsToPay = associatedDebts
    .filter((d) => d.type === 'to_me')
    .reduce((sum, d) => sum + Math.max(0, d.totalAmount - d.paidAmount), 0);

  const customerDebtsToReceive = associatedDebts
    .filter((d) => d.type === 'by_me')
    .reduce((sum, d) => sum + Math.max(0, d.totalAmount - d.paidAmount), 0);

  // 4. Combined Grand Totals
  const grandTotalPaid = totalPaidContracts + totalSalafsPaid + associatedDebts.reduce((sum, d) => sum + d.paidAmount, 0);
  const grandTotalRemaining = totalRemainingContracts + totalSalafsRemaining + customerDebtsToPay;
  const grandTotalMonthlyCommitment = totalMonthlyInstallments + totalSalafsMonthly;

  // Helper to calculate days late
  const daysLate = (contract: Contract) => {
    const rem = getContractRemainingAmount(contract);
    if (rem <= 0) return 0;

    const now = new Date();
    const currentDay = now.getDate();
    const dueDay = contract.dueDay;

    if (currentDay > dueDay) {
      return currentDay - dueDay;
    }
    return 0;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070708] flex flex-col items-center justify-center text-zinc-400 gap-4" dir="rtl">
        <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
        <span className="text-sm font-medium tracking-wide">جاري تحميل كشف حسابك الشامل...</span>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-screen bg-[#070708] flex flex-col items-center justify-center text-zinc-400 p-6 text-center" dir="rtl">
        <AlertCircle className="w-12 h-12 text-rose-500 mb-4" />
        <p className="text-sm font-semibold mb-6">لم يتم العثور على معلومات العميل المطلوبة.</p>
        <button
          onClick={onLogout}
          className="px-6 h-11 bg-white/5 border border-white/5 rounded-2xl text-zinc-300 text-xs hover:bg-white/10"
        >
          العودة لتسجيل الدخول
        </button>
      </div>
    );
  }

  // Get active contracts for the currently selected customer profile
  const selectedProfileContracts = allContracts.filter((c) => c.customerId === selectedProfileId);
  const selectedProfileObject = allProfiles.find((p) => p.id === selectedProfileId) || customer;

  return (
    <div className="min-h-screen bg-[#070708] text-zinc-100 flex flex-col select-none" dir="rtl">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-white/5 bg-black/60 backdrop-blur-xl px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/20 flex items-center justify-center shadow-lg shadow-amber-500/5">
            <Award className="w-5 h-5 text-amber-400 animate-pulse" />
          </div>
          <div>
            <h1 className="text-[10px] font-bold text-zinc-500 tracking-wider">البوابة الموحدة للمشتركين</h1>
            <h2 className="text-sm font-black text-white">{customer.name}</h2>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="h-9 px-3.5 rounded-xl bg-white/5 hover:bg-rose-500/10 hover:text-rose-400 border border-white/5 text-zinc-300 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
        >
          <LogOut className="w-4 h-4" />
          <span>خروج</span>
        </button>
      </header>

      {/* Main Container */}
      <main className="w-full max-w-[480px] mx-auto px-4 pt-5 pb-24 flex-1 flex flex-col gap-6">
        
        {/* PREMIUM VISITING STORE GREEN BUTTON */}
        <div className="relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-amber-500 rounded-2xl blur opacity-30 group-hover:opacity-60 transition duration-1000 group-hover:duration-200 animate-pulse" />
          <a
            href={storeBtnUrl}
            target="_blank"
            rel="noopener noreferrer"
            referrerPolicy="no-referrer"
            className="relative w-full h-14 rounded-2xl bg-gradient-to-r from-[#10b981] to-[#059669] text-white font-black text-sm flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:from-emerald-400 hover:to-teal-500 transition-all duration-300 transform active:scale-[0.98]"
          >
            <ShoppingBag className="w-5 h-5 stroke-[2.5]" />
            <span>{storeBtnName}</span>
            <ArrowUpRight className="w-4 h-4 stroke-[2.5] opacity-75 animate-bounce" />
          </a>
        </div>

        {/* Welcome Card Banner */}
        <div className="p-5 rounded-3xl border border-white/5 bg-[#121214]/60 backdrop-blur-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-black text-amber-400 uppercase tracking-widest">مكتب فقار العمشاني للخدمات المالية والأقساط</h3>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            أهلاً بك في منصتك المالية الشاملة. نضع بين يديك تقريراً ذكياً وفورياً يعرض كل ما يرتبط بهاتفك <strong className="text-white font-semibold">{customer.phone}</strong> من عقود تقسيط سارية، أو سلف وجمعيات نشطة، أو ديون ومستحقات متبادلة بدقة متناهية وسرية تامة.
          </p>
        </div>

        {/* MULTI-ACCOUNT SELECTOR (If there is more than 1 profile with the same phone number) */}
        {allProfiles.length > 1 && (
          <div className="flex flex-col gap-2">
            <span className="text-[10px] text-zinc-400 font-bold px-1 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-amber-400" />
              <span>لديك {allProfiles.length} حسابات فرعية مرتبطة برقم هاتفك:</span>
            </span>
            <div className="flex gap-2 overflow-x-auto pb-1.5 custom-scrollbar">
              {allProfiles.map((p) => {
                const isActive = p.id === selectedProfileId;
                const profileContractsCount = allContracts.filter(c => c.customerId === p.id).length;
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProfileId(p.id)}
                    className={`px-4 py-3 rounded-2xl border text-xs font-bold transition-all flex flex-col gap-1 items-start whitespace-nowrap min-w-[140px] cursor-pointer ${
                      isActive
                        ? 'bg-amber-500/15 border-amber-500/30 text-amber-400 shadow-lg shadow-amber-500/5'
                        : 'bg-white/5 border-white/5 text-zinc-400 hover:bg-white/10'
                    }`}
                  >
                    <span className="text-xs block max-w-[125px] truncate">{p.name}</span>
                    <span className="text-[10px] text-zinc-500 block font-normal">
                      ({profileContractsCount} سلع نشطة)
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* GRAND UNIFIED FINANCIAL DASHBOARD (المركز المالي الكلي الموحد) */}
        <div className="bg-gradient-to-b from-[#161618] to-[#121214] border border-white/5 p-5 rounded-3xl flex flex-col gap-4 relative overflow-hidden shadow-2xl">
          <div className="absolute -top-12 -left-12 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center border border-amber-500/15">
                <Wallet className="w-4 h-4 text-amber-400" />
              </div>
              <h4 className="text-xs font-bold text-white">الملخص المالي الكلي الموحد</h4>
            </div>
            <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-bold">
              محدث الآن
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <div className="bg-[#1a1a1e]/80 border border-white/5 p-3.5 rounded-2xl flex flex-col gap-0.5">
              <span className="text-[10px] text-zinc-400 font-medium">المتبقي الكلي بذمتك</span>
              <span className="text-base font-black text-orange-400 font-mono tracking-tight">{fmtIQD(grandTotalRemaining)}</span>
              <span className="text-[8.5px] text-zinc-500">أقساط + ديون + سلف</span>
            </div>

            <div className="bg-[#1a1a1e]/80 border border-white/5 p-3.5 rounded-2xl flex flex-col gap-0.5">
              <span className="text-[10px] text-zinc-400 font-medium">المدفوع الكلي التراكمي</span>
              <span className="text-base font-black text-emerald-400 font-mono tracking-tight">{fmtIQD(grandTotalPaid)}</span>
              <span className="text-[8.5px] text-zinc-500">مجموع تسديداتك الكلية</span>
            </div>
          </div>

          <div className="bg-[#1a1a1e]/40 border border-white/5 p-3 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-400" />
              <div className="flex flex-col">
                <span className="text-[10px] text-zinc-400">القسط الشهري الموحد المطلوب</span>
                <span className="text-[9px] text-zinc-500">أقساط السلع + أقساط السلف الجارية</span>
              </div>
            </div>
            <span className="text-sm font-black text-amber-400 font-mono">{fmtIQD(grandTotalMonthlyCommitment)}</span>
          </div>
        </div>

        {/* PILLARS FILTER BUTTONS */}
        <div className="flex gap-1.5 p-1 bg-white/5 rounded-2xl border border-white/5">
          <button
            onClick={() => setActiveTab('all')}
            className={`flex-1 h-9 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
              activeTab === 'all' ? 'bg-amber-500 text-black' : 'text-zinc-400 hover:text-white'
            }`}
          >
            الكل
          </button>
          <button
            onClick={() => setActiveTab('contracts')}
            className={`flex-1 h-9 rounded-xl text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
              activeTab === 'contracts' ? 'bg-amber-500 text-black' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>الأقساط ({allContracts.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('salafs')}
            className={`flex-1 h-9 rounded-xl text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
              activeTab === 'salafs' ? 'bg-amber-500 text-black' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>السلف ({associatedSalafs.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('debts')}
            className={`flex-1 h-9 rounded-xl text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
              activeTab === 'debts' ? 'bg-amber-500 text-black' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Coins className="w-3.5 h-3.5" />
            <span>الديون ({associatedDebts.length})</span>
          </button>
        </div>

        {/* PILLAR 1: INSTALLMENTS AND CONTRACTS */}
        {(activeTab === 'all' || activeTab === 'contracts') && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <h4 className="text-xs font-bold text-zinc-400 flex items-center gap-1.5 px-1">
                <FileText className="w-4 h-4 text-emerald-400" />
                <span>عقود الأقساط النشطة ({selectedProfileContracts.length})</span>
              </h4>
              <span className="text-[9.5px] text-zinc-500">حساب: {selectedProfileObject.name}</span>
            </div>

            {selectedProfileContracts.length === 0 ? (
              <div className="text-center py-10 bg-[#121214]/30 border border-dashed border-white/5 rounded-3xl text-zinc-500 text-xs">
                لا توجد سلع أو عقود تقسيط مسجلة لهذا الحساب حالياً.
              </div>
            ) : (
              selectedProfileContracts.map((c) => {
                const paid = getContractPaidAmount(c.id);
                const remaining = getContractRemainingAmount(c);
                const progress = c.installmentPrice > 0 ? (paid / c.installmentPrice) * 100 : 0;
                const lateDays = daysLate(c);
                const isFullyPaid = remaining <= 0;

                return (
                  <div key={c.id} className="p-5 rounded-3xl border border-white/5 bg-[#121214]/60 flex flex-col gap-4 relative overflow-hidden group hover:border-white/10 transition-colors">
                    {/* Background glow on hover */}
                    <div className="absolute top-0 left-0 w-20 h-20 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
                    
                    {/* Item Title and Badges */}
                    <div className="flex items-center justify-between">
                      <div>
                        <h5 className="text-sm font-black text-white group-hover:text-amber-400 transition-colors">{c.itemName}</h5>
                        <p className="text-[10px] text-zinc-500 mt-1">يوم استحقاق القسط: {c.dueDay} من كل شهر</p>
                      </div>

                      <div>
                        {isFullyPaid ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>مسدد بالكامل</span>
                          </span>
                        ) : lateDays > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 animate-pulse">
                            <AlertCircle className="w-3 h-3" />
                            <span>متأخر {lateDays} يوم</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <Clock className="w-3 h-3" />
                            <span>قيد السداد</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Financial Metrics */}
                    <div className="grid grid-cols-2 gap-y-3.5 gap-x-4 border-t border-b border-white/5 py-4 text-xs bg-black/10 rounded-2xl px-3">
                      <div>
                        <span className="text-zinc-500 block text-[10px] mb-0.5">سعر التقسيط</span>
                        <span className="font-black text-white font-mono">{fmtIQD(c.installmentPrice)}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block text-[10px] mb-0.5">القسط الشهري</span>
                        <span className="font-black text-amber-400 font-mono">{fmtIQD(c.monthlyInstallment)}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block text-[10px] mb-0.5">المدفوع للسلعة</span>
                        <span className="font-black text-emerald-400 font-mono">{fmtIQD(paid)}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block text-[10px] mb-0.5">المتبقي المطلوب</span>
                        <span className="font-black text-orange-400 font-mono">{fmtIQD(remaining)}</span>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-[10px] font-semibold text-zinc-500">
                        <span>نسبة سداد السلعة</span>
                        <span className="font-mono text-emerald-400">{Math.round(progress)}%</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-[#18181b] overflow-hidden border border-white/5">
                        <div
                          style={{ width: `${Math.min(100, progress)}%` }}
                          className="h-full bg-gradient-to-r from-emerald-500 to-amber-500 rounded-full transition-all duration-500"
                        />
                      </div>
                    </div>

                    {/* Payments received list */}
                    {allPayments.filter((p) => p.contractId === c.id).length > 0 && (
                      <div className="flex flex-col gap-2 border-t border-white/5 pt-3 mt-1">
                        <p className="text-[10px] font-bold text-zinc-500 flex items-center gap-1">
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span>سجل الدفعات والمقبوضات المستلمة للسلعة:</span>
                        </p>
                        <div className="flex flex-col gap-1.5 max-h-[160px] overflow-y-auto pr-1">
                          {allPayments
                            .filter((p) => p.contractId === c.id)
                            .map((p) => (
                              <div
                                key={p.id}
                                className="flex items-center justify-between p-2.5 bg-[#18181b]/50 rounded-xl border border-white/5 text-xs font-semibold"
                              >
                                <div className="flex items-center gap-1.5 text-zinc-400">
                                  <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                                  <span>{p.date}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-black text-emerald-400 font-mono">{fmtIQD(p.amount)}</span>
                                  {p.notes && (
                                    <span className="text-[9px] text-zinc-500 bg-white/5 px-2 py-0.5 rounded-lg border border-white/5">
                                      {p.notes}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* PILLAR 2: SALAFS AND SOCIETIES */}
        {(activeTab === 'all' || activeTab === 'salafs') && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <h4 className="text-xs font-bold text-zinc-400 flex items-center gap-1.5 px-1">
                <Layers className="w-4 h-4 text-amber-500" />
                <span>سلف الجمعيات المشترك بها برقم هاتفك ({associatedSalafs.length})</span>
              </h4>
              <span className="text-[9px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full font-bold">
                حساب التكافل
              </span>
            </div>

            {associatedSalafs.length === 0 ? (
              <div className="text-center py-10 bg-[#121214]/30 border border-dashed border-white/5 rounded-3xl text-zinc-500 text-xs leading-relaxed px-6">
                لا توجد سلف أو جمعيات مسجلة برقم هاتفك حالياً في نظام سلف التكافل الموحد.
              </div>
            ) : (
              associatedSalafs.map((s) => {
                const member = s.members?.find((mem) => mem.phone && mem.phone.trim() === matchedPhone);
                if (!member) return null;

                const paidMonths = s.payments?.filter((p) => p.memberId === member.id).length || 0;
                const paidAmount = paidMonths * s.monthlyAmount;
                const totalMemAmount = s.totalAmount; 
                const remainingAmount = totalMemAmount - paidAmount;
                const progress = s.monthsCount > 0 ? (paidMonths / s.monthsCount) * 100 : 0;

                return (
                  <div key={s.id} className="p-5 rounded-3xl border border-white/5 bg-[#121214]/60 flex flex-col gap-4 relative overflow-hidden group hover:border-white/10 transition-colors">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-amber-500/5 rounded-full blur-2xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />

                    {/* Salaf Header */}
                    <div className="flex items-center justify-between">
                      <div>
                        <h5 className="text-sm font-black text-white group-hover:text-amber-400 transition-colors">{s.name}</h5>
                        <p className="text-[10px] text-zinc-500 mt-1">تاريخ انطلاق السلفة: {s.startDate}</p>
                      </div>

                      <div>
                        {member.isReceiver ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>مستلم السلفة</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <Clock className="w-3 h-3" />
                            <span>بانتظار الاستلام</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Member Details */}
                    {member.isReceiver && (
                      <div className="bg-emerald-500/5 border border-emerald-500/10 p-3 rounded-2xl flex flex-col gap-1 text-xs">
                        <div className="flex justify-between items-center text-[10px] text-emerald-400 font-bold">
                          <span>تفاصيل الاستلام والقبض:</span>
                          <span>تم الصرف بنجاح</span>
                        </div>
                        <div className="flex justify-between items-center mt-1 text-zinc-300">
                          <span>الشهر المستحق للقبض:</span>
                          <span className="font-bold">الشهر رقم {member.receiveMonthIndex || 'غير محدد'}</span>
                        </div>
                        {member.receiveDate && (
                          <div className="flex justify-between items-center text-zinc-400 text-[11px]">
                            <span>تاريخ استلام المبلغ الفعلي:</span>
                            <span>{member.receiveDate}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Financial Metrics */}
                    <div className="grid grid-cols-2 gap-y-3.5 gap-x-4 border-t border-b border-white/5 py-4 text-xs bg-black/10 rounded-2xl px-3">
                      <div>
                        <span className="text-zinc-500 block text-[10px] mb-0.5">القيمة الكلية للسلفة</span>
                        <span className="font-black text-white font-mono">{fmtIQD(s.totalAmount)}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block text-[10px] mb-0.5">القسط الشهري المشترك</span>
                        <span className="font-black text-amber-400 font-mono">{fmtIQD(s.monthlyAmount)}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block text-[10px] mb-0.5">المدفوع الكلي منك</span>
                        <span className="font-black text-emerald-400 font-mono">{fmtIQD(paidAmount)}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block text-[10px] mb-0.5">المتبقي المطلوب دفعه</span>
                        <span className="font-black text-orange-400 font-mono">{fmtIQD(remainingAmount)}</span>
                      </div>
                    </div>

                    {/* Progress with months count */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-[10px] font-semibold text-zinc-500">
                        <span>الأشهر المدفوعة</span>
                        <span className="font-mono text-amber-400">{paidMonths} / {s.monthsCount} أشهر ({Math.round(progress)}%)</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-[#18181b] overflow-hidden border border-white/5">
                        <div
                          style={{ width: `${Math.min(100, progress)}%` }}
                          className="h-full bg-gradient-to-r from-amber-500 to-orange-400 rounded-full transition-all duration-500"
                        />
                      </div>
                    </div>

                    {/* Custom note if exists */}
                    {member.notes && (
                      <div className="text-[10px] text-zinc-500 leading-relaxed bg-[#18181b]/30 p-2.5 rounded-xl border border-white/5 flex gap-1.5 items-start">
                        <Info className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                        <span>ملاحظات سلف الجمعية: {member.notes}</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* PILLAR 3: DIRECT DEBTS */}
        {(activeTab === 'all' || activeTab === 'debts') && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <h4 className="text-xs font-bold text-zinc-400 flex items-center gap-1.5 px-1">
                <Coins className="w-4 h-4 text-amber-400" />
                <span>الديون المباشرة المستحقة والحسابات خارج الأقساط ({associatedDebts.length})</span>
              </h4>
              <span className="text-[9px] bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded-full font-bold">
                كشف الذمم المالي
              </span>
            </div>

            {associatedDebts.length === 0 ? (
              <div className="text-center py-10 bg-[#121214]/30 border border-dashed border-white/5 rounded-3xl text-zinc-500 text-xs leading-relaxed px-6">
                لا توجد ديون مباشرة مسجلة برقم هاتفك حالياً خارج الأقساط.
              </div>
            ) : (
              associatedDebts.map((d) => {
                const currentDebt = d.totalAmount - d.paidAmount;
                const hasLimit = d.type === 'by_me' && d.monthlyPurchaseLimit && d.monthlyPurchaseLimit > 0;
                const remainingPurchaseLimit = hasLimit ? Math.max(0, d.monthlyPurchaseLimit! - currentDebt) : 0;
                const isExpanded = expandedDebtId === d.id;

                return (
                  <div key={d.id} className="p-5 rounded-3xl border border-white/5 bg-[#121214]/60 flex flex-col gap-3.5 group hover:border-white/10 transition-colors">
                    <div className="flex items-start justify-between">
                      <div>
                        <h5 className="text-sm font-black text-white group-hover:text-amber-400 transition-colors">{d.personName}</h5>
                        <span className="text-[10px] text-zinc-500 block mt-0.5">
                          نوع الدين: {d.type === 'to_me' ? 'دين مطلوب منك تسديده للمكتب' : 'دين مسجل عليك لصالح أطراف أخرى'}
                        </span>
                      </div>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[9px] font-bold ${
                        d.type === 'to_me'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}>
                        {d.type === 'to_me' ? 'مستحق عليك' : 'شراء وتسهيل ائتماني'}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 border-t border-b border-white/5 py-3 text-xs bg-black/10 rounded-2xl px-3">
                      <div className="text-center">
                        <span className="text-zinc-500 block text-[9px] mb-1">مبلغ الدين الأصلي</span>
                        <span className="font-black text-white font-mono">{fmtIQD(d.totalAmount)}</span>
                      </div>
                      <div className="text-center border-x border-white/5 px-1">
                        <span className="text-zinc-500 block text-[9px] mb-1">المسدد منه</span>
                        <span className="font-black text-emerald-400 font-mono">{fmtIQD(d.paidAmount)}</span>
                      </div>
                      <div className="text-center">
                        <span className="text-zinc-500 block text-[9px] mb-1">المتبقي المطلوب</span>
                        <span className="font-black text-orange-400 font-mono">{fmtIQD(currentDebt)}</span>
                      </div>
                    </div>

                    {/* DISPLAY MONTHLY PURCHASE BUDGET CAP (If specified and owes) */}
                    {hasLimit && (
                      <div className="bg-amber-500/5 border border-amber-500/10 p-3 rounded-2xl flex flex-col gap-1 text-xs">
                        <div className="flex justify-between items-center text-[10px] text-zinc-500">
                          <span>الميزانية التقديرية للشراء الشهري</span>
                          <span className="font-black text-amber-500 font-mono">{fmtIQD(d.monthlyPurchaseLimit!)}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs mt-1.5 pt-1.5 border-t border-white/5">
                          <span className="text-zinc-300 font-bold">المتبقي المتاح للشراء الشهري:</span>
                          <span className="font-black text-emerald-400 font-mono text-sm">{fmtIQD(remainingPurchaseLimit)}</span>
                        </div>
                      </div>
                    )}

                    {/* COLLAPSIBLE DETAILED TRANSACTION HISTORY */}
                    {d.transactions && d.transactions.length > 0 && (
                      <div className="flex flex-col gap-1.5">
                        <button
                          onClick={() => setExpandedDebtId(isExpanded ? null : d.id)}
                          className="w-full h-9 px-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 text-[10px] font-bold text-zinc-300 flex items-center justify-between transition-all cursor-pointer"
                        >
                          <span>سجل المشتريات والتسديدات التفصيلي بالتواريخ ({d.transactions.length})</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-amber-400" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />}
                        </button>

                        {isExpanded && (
                          <div className="flex flex-col gap-1.5 mt-1 max-h-[180px] overflow-y-auto pr-1">
                            {d.transactions
                              .slice()
                              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                              .map((t: DebtTransaction) => (
                                <div
                                  key={t.id}
                                  className="flex items-center justify-between p-2.5 bg-[#18181b]/70 border border-white/5 rounded-xl text-[11px]"
                                >
                                  <div className="flex flex-col gap-0.5 text-right">
                                    <span className="text-[9px] text-zinc-500">{t.date}</span>
                                    <span className="text-white font-medium">{t.notes || (t.type === 'purchase' ? 'شراء بدين جديد' : 'تسديد مبلغ')}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span className={`font-black font-mono ${t.type === 'purchase' ? 'text-rose-400' : 'text-emerald-400'}`}>
                                      {t.type === 'purchase' ? '+' : '-'} {fmtIQD(t.amount)}
                                    </span>
                                    <span className={`w-1.5 h-1.5 rounded-full ${t.type === 'purchase' ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`} />
                                  </div>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Contact Branch Support Card */}
        <div className="p-5 rounded-3xl border border-white/5 bg-[#121214]/40 flex flex-col gap-3">
          <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-amber-400" />
            <span>الدعم الفني المباشر ومقر المكتب</span>
          </h4>
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            لأي استفسار بخصوص السلع المعروضة، أو للاستعلام عن كيفية تسديد قسط جديد أو لتسوية وتحديث الأرقام على شيتات جوجل، يرجى الاتصال بإدارة المكتب مباشرة وسنقوم بخدمتك فوراً:
          </p>

          <div className="flex items-center justify-between bg-white/5 p-3.5 rounded-2xl border border-white/5">
            <div>
              <p className="text-xs font-black text-zinc-300">{branchSettings.name}</p>
              <p className="text-[9px] text-zinc-500 mt-1">الرقم المباشر لخدمة العملاء والزبائن</p>
            </div>
            <a
              href={`tel:${branchSettings.phone}`}
              className="px-4 h-9 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs flex items-center gap-1.5 transition-all shadow-lg shadow-amber-500/10 cursor-pointer active:scale-95"
            >
              <Phone className="w-3.5 h-3.5 stroke-[2.2]" />
              <span>اتصال مباشر</span>
            </a>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-[10px] text-zinc-600 border-t border-white/5 mt-auto">
        <span>تطبيق فقار العمشاني للأقساط الذكية والديون الكلية • جميع الحقوق محفوظة</span>
      </footer>
    </div>
  );
}
