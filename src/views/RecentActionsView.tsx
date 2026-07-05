/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  Trash2,
  Search,
  Calendar,
  Clock,
  ChevronLeft,
  Activity,
  User,
  DollarSign,
  FileText
} from 'lucide-react';

interface ActionItem {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  timestamp: string;
}

interface RecentActionsViewProps {
  actions: ActionItem[];
  onSelectAction: (action: ActionItem) => void;
  onClearLogs: () => void;
  onBack: () => void;
}

export function RecentActionsView({ actions, onSelectAction, onClearLogs, onBack }: RecentActionsViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  // Filter actions based on search and type
  const filteredActions = actions.filter((act) => {
    const matchesSearch = act.message.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          act.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || act.type === filterType;
    return matchesSearch && matchesType;
  });

  const getIcon = (type: ActionItem['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-rose-400" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      default:
        return <Info className="w-4 h-4 text-blue-400" />;
    }
  };

  const getBg = (type: ActionItem['type']) => {
    switch (type) {
      case 'success':
        return 'bg-emerald-500/5 hover:bg-emerald-500/10 border-emerald-500/10';
      case 'error':
        return 'bg-rose-500/5 hover:bg-rose-500/10 border-rose-500/10';
      case 'warning':
        return 'bg-amber-500/5 hover:bg-amber-500/10 border-amber-500/10';
      default:
        return 'bg-blue-500/5 hover:bg-blue-500/10 border-blue-500/10';
    }
  };

  return (
    <div className="w-full flex flex-col gap-5" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <button
          onClick={onBack}
          className="h-10 px-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 text-zinc-300 font-bold text-xs flex items-center gap-2 transition-all cursor-pointer active:scale-95"
        >
          <ArrowRight className="w-4 h-4 text-amber-500" />
          <span>الرجوع للاعدادات</span>
        </button>

        {actions.length > 0 && (
          <button
            onClick={() => {
              if (window.confirm('هل أنت متأكد من رغبتك في مسح وتفريغ سجل الإجراءات والتحديثات بالكامل؟')) {
                onClearLogs();
              }
            }}
            className="h-10 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/15 border border-rose-500/20 text-rose-400 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>مسح السجل</span>
          </button>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <h2 className="text-base font-black text-white flex items-center gap-2">
          <Activity className="w-5 h-5 text-amber-500" />
          <span>سجل الإجراءات والتحديثات الأخيرة</span>
        </h2>
        <p className="text-xs text-zinc-400 leading-normal">
          يتتبع هذا السجل كافة العمليات المالية والادارية التي قمت بها في جلستك الحالية لضمان دقة العمل والرجوع إليها بسهولة.
        </p>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col gap-2.5">
        <div className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="البحث في تفاصيل الإجراء..."
            className="w-full h-11 pl-4 pr-10 rounded-xl bg-[#18181b] border border-white/5 text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/50 text-xs font-semibold"
          />
          <div className="absolute inset-y-0 right-3.5 flex items-center pointer-events-none text-zinc-500">
            <Search className="w-4 h-4" />
          </div>
        </div>

        {/* Filter Badges */}
        <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {[
            { id: 'all', label: 'الكل' },
            { id: 'success', label: 'الناجحة ✨' },
            { id: 'warning', label: 'التنبيهات ⚠️' },
            { id: 'error', label: 'الأخطاء 🛑' }
          ].map((type) => (
            <button
              key={type.id}
              onClick={() => setFilterType(type.id)}
              className={`px-3.5 py-1.5 rounded-full text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap border ${
                filterType === type.id
                  ? 'bg-amber-500 border-amber-500 text-black'
                  : 'bg-white/5 border-white/5 text-zinc-400 hover:bg-white/10'
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {/* Log Items list */}
      <div className="flex flex-col gap-2">
        {filteredActions.length === 0 ? (
          <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/5 text-center flex flex-col items-center gap-2">
            <span className="text-2xl">🗒️</span>
            <p className="text-xs text-zinc-400 font-bold">لا توجد إجراءات مسجلة حالياً</p>
            <p className="text-[10px] text-zinc-600 leading-normal max-w-xs">
              عند إضافة زبائن، تعديل أقساط، أو تنفيذ سداد، ستظهر هنا تفاصيل الإجراء كاملة بنظام حماية ذكي.
            </p>
          </div>
        ) : (
          filteredActions.map((act) => (
            <button
              key={act.id}
              onClick={() => onSelectAction(act)}
              className={`w-full p-3.5 rounded-2xl border text-right transition-all flex items-center justify-between gap-3 group cursor-pointer ${getBg(act.type)}`}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="p-2 rounded-xl bg-black/30 border border-white/5 shrink-0">
                  {getIcon(act.type)}
                </div>
                <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <span className="text-xs font-black text-white leading-normal truncate block">
                    {act.message}
                  </span>
                  <div className="flex items-center gap-3 text-[10px] text-zinc-500 font-semibold">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-zinc-600" />
                      <span>{act.timestamp}</span>
                    </span>
                    <span className="text-zinc-600">|</span>
                    <span>المعرف: #{act.id}</span>
                  </div>
                </div>
              </div>
              <ChevronLeft className="w-4 h-4 text-zinc-600 group-hover:text-amber-500 group-hover:translate-x-[-2px] transition-all shrink-0" />
            </button>
          ))
        )}
      </div>
    </div>
  );
}
