/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  ArrowRight,
  Calendar,
  Clock,
  Activity,
  Sparkles,
  FileText,
  User,
  DollarSign
} from 'lucide-react';

interface ActionDetailViewProps {
  action: {
    title: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
    timestamp: string;
    id: string;
  };
  onBack: () => void;
}

export function ActionDetailView({ action, onBack }: ActionDetailViewProps) {
  // Determine icon and color based on type
  let Icon = Info;
  let colorClass = 'text-blue-400';
  let bgClass = 'bg-blue-500/10 border-blue-500/20';
  let gradientClass = 'from-blue-500/20 to-indigo-500/5';
  let shadowClass = 'shadow-blue-500/5';
  let label = 'معلومات';

  if (action.type === 'success') {
    Icon = CheckCircle2;
    colorClass = 'text-emerald-400';
    bgClass = 'bg-emerald-500/10 border-emerald-500/20';
    gradientClass = 'from-emerald-500/20 to-teal-500/5';
    shadowClass = 'shadow-emerald-500/5';
    label = 'تم الإجراء بنجاح';
  } else if (action.type === 'error') {
    Icon = AlertCircle;
    colorClass = 'text-rose-400';
    bgClass = 'bg-rose-500/10 border-rose-500/20';
    gradientClass = 'from-rose-500/20 to-orange-500/5';
    shadowClass = 'shadow-rose-500/5';
    label = 'خطأ في التنفيذ';
  } else if (action.type === 'warning') {
    Icon = AlertTriangle;
    colorClass = 'text-amber-400';
    bgClass = 'bg-amber-500/10 border-amber-500/20';
    gradientClass = 'from-amber-500/20 to-yellow-500/5';
    shadowClass = 'shadow-amber-500/5';
    label = 'تحذير / تنبيه';
  }

  // Parse action category for display
  const getActionCategory = (msg: string) => {
    if (msg.includes('دفعة') || msg.includes('سداد') || msg.includes('مبلغ')) {
      return { text: 'مستند مالي / دفعة', icon: DollarSign };
    }
    if (msg.includes('عميل') || msg.includes('زبون') || msg.includes('الحساب')) {
      return { text: 'إدارة المشتركين', icon: User };
    }
    if (msg.includes('عقد') || msg.includes('سلعة') || msg.includes('الأقساط')) {
      return { text: 'عقود الأقساط والجمعيات', icon: FileText };
    }
    return { text: 'تحديثات النظام العامة', icon: Activity };
  };

  const category = getActionCategory(action.message);
  const CategoryIcon = category.icon;

  return (
    <div className="w-full flex flex-col gap-6" dir="rtl">
      {/* Top Header Row with Arrow */}
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <button
          onClick={onBack}
          className="h-10 px-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 text-zinc-300 font-bold text-xs flex items-center gap-2 transition-all cursor-pointer active:scale-95"
        >
          <ArrowRight className="w-4 h-4 text-amber-500" />
          <span>الرجوع خطوة للوراء</span>
        </button>
        <span className="text-[10px] text-zinc-500 font-bold">معرف الإجراء: #{action.id}</span>
      </div>

      {/* Main Status Container */}
      <div className={`p-6 rounded-3xl border ${bgClass} bg-gradient-to-b ${gradientClass} flex flex-col items-center text-center gap-4 shadow-xl ${shadowClass}`}>
        <div className={`w-14 h-14 rounded-full ${bgClass} flex items-center justify-center border animate-bounce`}>
          <Icon className={`w-8 h-8 ${colorClass}`} />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className={`text-[10px] font-black uppercase tracking-widest ${colorClass}`}>
            {label}
          </span>
          <h3 className="text-lg font-black text-white leading-normal px-2">
            {action.message}
          </h3>
        </div>

        {/* Dynamic Category Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/40 border border-white/5 text-zinc-300 text-xs font-bold">
          <CategoryIcon className="w-3.5 h-3.5 text-amber-400" />
          <span>{category.text}</span>
        </div>
      </div>

      {/* Audit & Log Details Card */}
      <div className="p-5 rounded-3xl border border-white/5 bg-[#121214]/60 backdrop-blur-2xl flex flex-col gap-4">
        <div className="flex items-center gap-2 border-b border-white/5 pb-2.5">
          <Activity className="w-4 h-4 text-amber-500" />
          <h4 className="text-xs font-bold text-white">تفاصيل الإجراء والمستند المالي</h4>
        </div>

        <div className="flex flex-col gap-3 text-xs">
          <div className="flex items-center justify-between py-1.5 border-b border-white/5">
            <span className="text-zinc-500">حالة العملية</span>
            <span className={`font-bold ${colorClass}`}>{action.title}</span>
          </div>

          <div className="flex items-center justify-between py-1.5 border-b border-white/5">
            <span className="text-zinc-500">تاريخ ووقت التنفيذ</span>
            <div className="flex items-center gap-1.5 font-mono text-zinc-300">
              <Clock className="w-3.5 h-3.5 text-zinc-500" />
              <span>{action.timestamp}</span>
            </div>
          </div>

          <div className="flex items-center justify-between py-1.5 border-b border-white/5">
            <span className="text-zinc-500">طريقة الحفظ والسرية</span>
            <span className="text-emerald-400 font-bold">تشفير محلي آمن (IndexedDB)</span>
          </div>

          <div className="flex items-center justify-between py-1.5">
            <span className="text-zinc-500">قناة المزامنة الخارجية</span>
            <span className="text-amber-400 font-bold">مجدولة تلقائياً للتليجرام وشيتات جوجل</span>
          </div>
        </div>
      </div>

      {/* Advisory Note */}
      <div className="p-4 rounded-2xl bg-white/5 border border-white/5 text-zinc-400 text-[11px] leading-relaxed flex gap-2 items-start">
        <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5 animate-pulse" />
        <p>
          تم تسجيل هذا الإجراء وحفظه بنجاح في قاعدة بيانات المتصفح المشفرة محلياً. إذا كانت هناك عمليات غير مزامنة، سيقوم النظام بمزامنتها تلقائياً مع السيرفر أو القناة الاحتياطية بمجرد توفر اتصال بالإنترنت.
        </p>
      </div>

      {/* Solid Back Button */}
      <button
        onClick={onBack}
        className="w-full h-12 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-500/10 cursor-pointer active:scale-95"
      >
        <ArrowRight className="w-4 h-4" />
        <span>حفظ والعودة للواجهة السابقة</span>
      </button>
    </div>
  );
}
