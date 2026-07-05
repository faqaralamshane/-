/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Search, Plus, UserRound, ChevronLeft, X, Lock, Unlock } from 'lucide-react';
import { Customer, Contract, Payment } from '../types';
import { daysLate, remainingForContract, totalPaidForContract, fmtIQD } from '../finance';
import { showToast } from '../components/Toast';
import { putInStore, uid } from '../db';
import { incrementPendingSync } from '../syncQueue';

interface CustomersViewProps {
  customers: Customer[];
  contracts: Contract[];
  payments: Payment[];
  onSelectCustomer: (cust: Customer) => void;
  onRefreshData: () => void;
}

export function CustomersView({
  customers,
  contracts,
  payments,
  onSelectCustomer,
  onRefreshData
}: CustomersViewProps) {
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  React.useEffect(() => {
    const handleAddCustomer = () => {
      handleOpenAddModal();
    };
    window.addEventListener('faqar-trigger-add-customer', handleAddCustomer);
    return () => {
      window.removeEventListener('faqar-trigger-add-customer', handleAddCustomer);
    };
  }, []);

  // Form states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [accessCode, setAccessCode] = useState('');

  const getWorstLate = (customer: Customer): number => {
    const custContracts = contracts.filter((c) => c.customerId === customer.id);
    let maxLate = 0;
    custContracts.forEach((c) => {
      const late = daysLate(c, payments);
      if (late > maxLate) maxLate = late;
    });
    return maxLate;
  };

  const getCustomerSummary = (customer: Customer) => {
    const custContracts = contracts.filter((c) => c.customerId === customer.id);
    const contractCount = custContracts.length;
    const paid = custContracts.reduce((sum, c) => sum + totalPaidForContract(c, payments), 0);
    const remaining = custContracts.reduce((sum, c) => sum + remainingForContract(c, payments), 0);
    const monthly = custContracts.reduce((sum, c) => sum + (remainingForContract(c, payments) > 0 ? c.monthlyInstallment : 0), 0);
    return { contractCount, paid, remaining, monthly };
  };

  const handleOpenAddModal = () => {
    setEditingCustomer(null);
    setName('');
    setPhone('');
    setNotes('');
    setAccessCode(Math.floor(1000 + Math.random() * 9000).toString());
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (cust: Customer, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCustomer(cust);
    setName(cust.name);
    setPhone(cust.phone);
    setNotes(cust.notes || '');
    setAccessCode(cust.accessCode || '');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('الرجاء إدخال اسم الزبون', 'error');
      return;
    }

    const customerId = editingCustomer ? editingCustomer.id : 'cust-' + uid();
    const cleanAccessCode = accessCode.trim() || Math.floor(1000 + Math.random() * 9000).toString();
    const newCustomer: Customer = {
      id: customerId,
      name: name.trim(),
      phone: phone.trim() || '—',
      notes: notes.trim() || undefined,
      createdAt: editingCustomer ? editingCustomer.createdAt : new Date().toISOString(),
      accessCode: cleanAccessCode,
      loginDisabled: editingCustomer ? editingCustomer.loginDisabled : false
    };

    try {
      await putInStore('customers', newCustomer);
      incrementPendingSync();
      showToast(editingCustomer ? 'تم تعديل بيانات الزبون بنجاح' : 'تم إضافة الزبون بنجاح', 'success');
      setIsModalOpen(false);
      onRefreshData();
    } catch (err) {
      showToast('حدث خطأ أثناء حفظ البيانات', 'error');
    }
  };

  const handleToggleLogin = async (cust: Customer, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated: Customer = {
      ...cust,
      loginDisabled: !cust.loginDisabled
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

  // Filter & Sort
  const filteredCustomers = customers
    .filter((c) => {
      const matchName = c.name.toLowerCase().includes(search.toLowerCase());
      const matchPhone = c.phone.includes(search);
      return matchName || matchPhone;
    })
    .map((c) => ({
      ...c,
      worstLate: getWorstLate(c),
      summary: getCustomerSummary(c)
    }))
    .sort((a, b) => b.worstLate - a.worstLate);

  return (
    <div className="flex flex-col gap-4 animate-fade-in relative min-h-[calc(100vh-200px)]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold text-amber-500 uppercase tracking-widest mb-1">إدارة الحسابات</p>
          <h1 className="text-2xl font-bold text-white tracking-tight">الزبائن</h1>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="w-11 h-11 bg-amber-500 text-black hover:bg-amber-400 font-bold rounded-xl flex items-center justify-center transition-all active:scale-[0.95] cursor-pointer shadow-lg shadow-amber-500/10"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Search Input */}
      <div className="relative">
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500">
          <Search className="w-5 h-5" />
        </span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث بالاسم أو هاتف الزبون..."
          className="w-full h-11 pr-12 pl-4 rounded-2xl bg-[#121214]/60 border border-white/5 text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/50 transition-all duration-200 text-sm"
        />
      </div>

      {/* Customers List */}
      <div className="flex flex-col gap-3">
        {filteredCustomers.length === 0 ? (
          <div className="text-center py-12 bg-[#121214]/20 rounded-2xl border border-dashed border-white/5 text-zinc-500 text-sm">
            لا يوجد زبائن يطابقون معايير البحث
          </div>
        ) : (
          filteredCustomers.map((cust) => {
            const worstLate = cust.worstLate;
            const summary = cust.summary;

            let pillBg = 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
            let pillText = 'منتظم';

            if (worstLate > 60) {
              pillBg = 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
              pillText = `متأخر +٦٠ يوم (${worstLate})`;
            } else if (worstLate > 0) {
              pillBg = 'bg-orange-500/10 text-orange-400 border border-orange-500/20';
              pillText = `متأخر +٣٠ يوم (${worstLate})`;
            }

            return (
              <div
                key={cust.id}
                onClick={() => onSelectCustomer(cust)}
                className="group flex items-center justify-between p-4 bg-[#121214]/60 hover:bg-[#18181c]/80 border border-white/5 hover:border-amber-500/20 rounded-[20px] transition-all duration-200 cursor-pointer shadow-md"
              >
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/10 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform">
                    <UserRound className="w-5 h-5" />
                  </div>

                  {/* Body Info */}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-white select-all">{cust.name}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${pillBg}`}>
                        {pillText}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 select-all">
                      {cust.phone} • {summary.contractCount} عقد • <span className="text-amber-400 font-bold font-mono">الرمز: {cust.accessCode || '—'}</span>
                    </p>
                    <div className="text-[11px] font-medium flex items-center gap-1.5 flex-wrap">
                      <span className="text-emerald-400">مدفوع: {fmtIQD(summary.paid)}</span>
                      <span className="text-zinc-600">•</span>
                      <span className="text-orange-400">متبقي: {fmtIQD(summary.remaining)}</span>
                    </div>
                    {summary.monthly > 0 && (
                      <p className="text-[10px] text-zinc-500">القسط الشهري: {fmtIQD(summary.monthly)}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={(e) => handleToggleLogin(cust, e)}
                    className={`h-8 px-2.5 rounded-xl border flex items-center gap-1 font-bold text-[10px] transition-all active:scale-95 cursor-pointer ${
                      cust.loginDisabled
                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20'
                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                    }`}
                    title={cust.loginDisabled ? 'تفعيل دخول الزبون' : 'تعطيل دخول الزبون'}
                  >
                    {cust.loginDisabled ? (
                      <>
                        <Lock className="w-3.5 h-3.5" />
                        <span>معطّل</span>
                      </>
                    ) : (
                      <>
                        <Unlock className="w-3.5 h-3.5" />
                        <span>مفعّل</span>
                      </>
                    )}
                  </button>

                  {/* Arrow Action */}
                  <div className="text-zinc-600 group-hover:text-amber-400 transition-colors pl-1">
                    <ChevronLeft className="w-5 h-5" />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-[448px] bg-[#121214] border-t border-white/10 rounded-t-[24px] p-6 shadow-2xl animate-slide-up">
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white">
                {editingCustomer ? 'تعديل بيانات الزبون' : 'إضافة زبون جديد'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/5 border border-white/5 flex items-center justify-center text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSave} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-zinc-400">الاسم الكامل *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="أدخل الاسم الرباعي للزبون"
                  required
                  className="w-full h-11 px-4 rounded-xl bg-[#18181b] border border-white/5 text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/50 text-sm"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-zinc-400">رقم الهاتف</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="07XXXXXXXXX"
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
                      value={accessCode}
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
                    onClick={() => setAccessCode(Math.floor(1000 + Math.random() * 9000).toString())}
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
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="ملاحظات حول الزبون، الكفيل، أو مكان العمل..."
                  rows={3}
                  className="w-full p-4 rounded-xl bg-[#18181b] border border-white/5 text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/50 text-sm resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full h-12 bg-amber-500 text-black hover:bg-amber-400 font-bold rounded-xl flex items-center justify-center transition-colors active:scale-[0.98] mt-2 cursor-pointer"
              >
                حفظ
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
