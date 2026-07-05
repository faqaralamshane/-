/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AlertTriangle, Phone, MessageSquare, Zap } from 'lucide-react';
import { Customer, Contract, Payment, Template } from '../types';
import { daysLate, remainingForContract, fmtIQD } from '../finance';
import { waLink } from '../messages';
import { evaluateCustomerSpecificTokens } from '../auditCustomerTokens';

interface DefaultersViewProps {
  customers: Customer[];
  contracts: Contract[];
  payments: Payment[];
  templates: Template[];
  onSelectCustomer: (cust: Customer) => void;
}

export function DefaultersView({
  customers,
  contracts,
  payments,
  templates,
  onSelectCustomer
}: DefaultersViewProps) {
  const getWorstLate = (customer: Customer): number => {
    const custContracts = contracts.filter((c) => c.customerId === customer.id);
    let maxLate = 0;
    custContracts.forEach((c) => {
      const late = daysLate(c, payments);
      if (late > maxLate) maxLate = late;
    });
    return maxLate;
  };

  const getDelinquentSummary = (customer: Customer) => {
    const custContracts = contracts.filter((c) => c.customerId === customer.id);
    let lateContractsCount = 0;
    let totalRemainingLate = 0;
    let monthlyInstallmentTotal = 0;

    custContracts.forEach((c) => {
      const late = daysLate(c, payments);
      if (late > 0) {
        lateContractsCount++;
        totalRemainingLate += remainingForContract(c, payments);
        monthlyInstallmentTotal += c.monthlyInstallment;
      }
    });

    return { lateContractsCount, totalRemainingLate, monthlyInstallmentTotal };
  };

  // Get only customers with a delinquency
  const delinquentCustomers = customers
    .map((c) => ({
      ...c,
      worstLate: getWorstLate(c),
      sumInfo: getDelinquentSummary(c)
    }))
    .filter((c) => c.worstLate > 0)
    .sort((a, b) => b.worstLate - a.worstLate);

  const getBranchSettings = () => {
    try {
      const data = localStorage.getItem('faqar-branch-settings-v1');
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  };
  const branchSettings = getBranchSettings();

  const handleSendReminder = (customer: Customer, months: 2 | 3) => {
    // Generate text from default templates
    const tplId = months === 2 ? 'tpl-overdue2' : 'tpl-overdue3';
    const customTpl = templates.find((t) => t.id === tplId);
    
    let bodyText = '';
    if (customTpl) {
      bodyText = evaluateCustomerSpecificTokens(customTpl.body, customer, contracts, payments, undefined, branchSettings);
    } else {
      // Fallback
      bodyText = `السلام عليكم أخي ${customer.name}،\n\nنُذكِّرك بأنه قد تراكم عليك ${
        months === 2 ? 'قسطان (شهران)' : 'ثلاثة أقساط (٣ أشهر)'
      } متأخرة.\nالمبلغ المطلوب تسديده: ${fmtIQD(getDelinquentSummary(customer).monthlyInstallmentTotal * months)}.\n\nيرجى المبادرة بالتسديد في أقرب وقت تجنباً لأي إجراءات.\nشاكرين تفهّمك وتعاونك.`;
    }

    window.open(waLink(customer.phone, bodyText), '_blank');
  };

  const handleCustomTemplateClick = (customer: Customer, tpl: Template) => {
    const text = evaluateCustomerSpecificTokens(tpl.body, customer, contracts, payments, undefined, branchSettings);
    window.open(waLink(customer.phone, text), '_blank');
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
          <AlertTriangle className="w-6 h-6 animate-pulse" />
        </div>
        <div>
          <p className="text-[11px] font-semibold text-orange-500 uppercase tracking-widest mb-0.5">قسم التحصيل</p>
          <h1 className="text-2xl font-bold text-white tracking-tight">المتأخرين عن الدفع ({delinquentCustomers.length})</h1>
        </div>
      </div>

      {/* Delinquent Cards List */}
      <div className="flex flex-col gap-4">
        {delinquentCustomers.length === 0 ? (
          <div className="text-center py-16 bg-emerald-500/5 border border-dashed border-emerald-500/10 rounded-3xl p-6 text-zinc-400">
            <span className="text-2xl block mb-2">🎉</span>
            <p className="text-sm font-bold text-emerald-400">لا يوجد أي متأخرين في السوق حالياً!</p>
            <p className="text-xs text-zinc-500 mt-1">كل الزبائن ملتزمون وجدول الديون منتظم.</p>
          </div>
        ) : (
          delinquentCustomers.map((c) => {
            const worstLate = c.worstLate;
            const info = c.sumInfo;

            let pillColor = 'bg-orange-500/10 text-orange-400 border-orange-500/20';
            if (worstLate > 60) {
              pillColor = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
            }

            // Get templates for defaulters_row matching conditions
            const rowTemplates = templates.filter((t) => {
              if (t.placement !== 'defaulters_row') return false;
              if (t.minDaysLate !== undefined && worstLate < t.minDaysLate) return false;
              if (t.maxDaysLate !== undefined && worstLate > t.maxDaysLate) return false;
              return true;
            });

            return (
              <div
                key={c.id}
                className="bg-[#121214]/60 border border-white/5 rounded-[22px] p-5 flex flex-col gap-4 shadow-md hover:border-white/10 transition-colors"
              >
                <div
                  className="flex items-start justify-between cursor-pointer"
                  onClick={() => onSelectCustomer(c)}
                >
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-white select-all">{c.name}</h3>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${pillColor}`}>
                        متأخر {worstLate} يوم
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 flex items-center gap-1 select-all">
                      <Phone className="w-3.5 h-3.5 text-zinc-500" />
                      <span>{c.phone}</span>
                    </p>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      عدد العقود المتأخرة: <strong className="text-zinc-300 select-all">{info.lateContractsCount}</strong> • متبقي له متأخر: <strong className="text-zinc-300 select-all">{fmtIQD(info.totalRemainingLate)}</strong>
                    </p>
                  </div>
                </div>

                {/* Primary Alert Buttons */}
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/5">
                  <button
                    onClick={() => handleSendReminder(c, 2)}
                    className="h-10 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20 text-orange-400 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-[0.98]"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>تنبيه شهرين</span>
                  </button>
                  <button
                    onClick={() => handleSendReminder(c, 3)}
                    className="h-10 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-[0.98]"
                  >
                    <AlertTriangle className="w-4 h-4" />
                    <span>تنبيه ٣ أشهر</span>
                  </button>
                </div>

                {/* Customized Custom Row Templates */}
                {rowTemplates.length > 0 && (
                  <div className="flex flex-col gap-2 pt-1">
                    <span className="text-[10px] font-semibold text-zinc-500">قوالب تذكير مخصصة</span>
                    <div className="flex flex-wrap gap-2">
                      {rowTemplates.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => handleCustomTemplateClick(c, t)}
                          className={`h-8 px-3 rounded-xl font-semibold text-xs flex items-center gap-1.5 cursor-pointer transition-all active:scale-[0.98] ${
                            t.style === 'tint'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/25 hover:bg-amber-500/20'
                              : 'bg-zinc-800 text-zinc-100 border border-white/5'
                          }`}
                        >
                          <Zap className="w-3.5 h-3.5 text-amber-500" />
                          <span>{t.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
