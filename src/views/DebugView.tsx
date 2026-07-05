/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ArrowRight, Terminal, RefreshCw, Trash2, Download, CheckCircle, AlertCircle } from 'lucide-react';
import { showToast } from '../components/Toast';
import { syncNow, getPendingSyncCount, getLastSyncTime } from '../syncQueue';

interface DebugViewProps {
  onBack: () => void;
  onRefreshData: () => void;
}

export function DebugView({ onBack, onRefreshData }: DebugViewProps) {
  const [logs, setLogs] = useState<string[]>([]);
  const [pendingSync, setPendingSync] = useState(0);
  const [lastSync, setLastSync] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  // Load debug logs
  const loadLogs = () => {
    try {
      const saved = localStorage.getItem('faqar-debug-logs-v1');
      if (saved) {
        setLogs(JSON.parse(saved));
      } else {
        const initial = [`[SYSTEM] [${new Date().toLocaleTimeString('ar-IQ')}] تم تهيئة وحدة مراقبة النظام والـ cache`];
        localStorage.setItem('faqar-debug-logs-v1', JSON.stringify(initial));
        setLogs(initial);
      }
    } catch {
      setLogs(['خطأ في تحميل سجلات الأخطاء والعمليات']);
    }

    setPendingSync(getPendingSyncCount());
    setLastSync(getLastSyncTime());
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const handleClearLogs = () => {
    const confirmClear = window.confirm('هل تريد مسح لوحة سجلات العمليات؟');
    if (!confirmClear) return;
    localStorage.removeItem('faqar-debug-logs-v1');
    setLogs([]);
    showToast('تم مسح السجلات بنجاح', 'success');
  };

  const handleDownloadLogs = () => {
    try {
      const text = logs.join('\n');
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `faqar_debug_logs_${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('تم تنزيل ملف السجلات بنجاح', 'success');
    } catch {
      showToast('فشل تصدير ملف السجلات', 'error');
    }
  };

  const handleForceSync = async () => {
    setIsSyncing(true);
    try {
      // Add logs
      const updatedLogs = [
        ...logs,
        `[SYNC] [${new Date().toLocaleTimeString('ar-IQ')}] جاري إجراء محاولة مزامنة إجبارية لقناة التليجرام...`
      ];
      localStorage.setItem('faqar-debug-logs-v1', JSON.stringify(updatedLogs));
      setLogs(updatedLogs);

      await syncNow();

      const successLogs = [
        ...updatedLogs,
        `[SYNC] [${new Date().toLocaleTimeString('ar-IQ')}] تمت المزامنة والنسخ الاحتياطي بنجاح كود الاستجابة: 200`
      ];
      localStorage.setItem('faqar-debug-logs-v1', JSON.stringify(successLogs));
      setLogs(successLogs);

      showToast('تمت المزامنة بنجاح لتيليجرام', 'success');
      loadLogs();
      onRefreshData();
    } catch (err: any) {
      const failLogs = [
        ...logs,
        `[SYNC] [${new Date().toLocaleTimeString('ar-IQ')}] فشل المزامنة. التفاصيل: ${err.message || 'خطأ اتصال بالسيرفر'}`
      ];
      localStorage.setItem('faqar-debug-logs-v1', JSON.stringify(failLogs));
      setLogs(failLogs);
      showToast(err.message || 'فشل الاتصال بخدمة تيليجرام', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-amber-500 hover:text-amber-400 p-1 cursor-pointer">
          <ArrowRight className="w-6 h-6" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">سجلات النظام والـ Debug</h1>
          <p className="text-xs text-zinc-500 mt-0.5">مراقبة حالات الطلبات والشبكة وقاعدة بيانات IndexedDB</p>
        </div>
      </div>

      {/* Sync Status Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 rounded-2xl bg-[#121214]/60 border border-white/5 flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-zinc-500 font-bold">العمليات المعلقة للمزامنة</span>
            <span className="text-lg font-bold text-white select-all">{pendingSync}</span>
          </div>
          {pendingSync > 0 ? (
            <AlertCircle className="w-8 h-8 text-orange-400" />
          ) : (
            <CheckCircle className="w-8 h-8 text-emerald-400" />
          )}
        </div>

        <div className="p-4 rounded-2xl bg-[#121214]/60 border border-white/5 flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-zinc-500 font-bold">آخر مزامنة ناجحة</span>
            <span className="text-xs font-bold text-zinc-300 truncate select-all">{lastSync || 'لم تتم المزامنة بعد'}</span>
          </div>
          <RefreshCw className={`w-6 h-6 text-amber-500 ${isSyncing ? 'animate-spin' : ''}`} />
        </div>
      </div>

      {/* Terminal logs box */}
      <div className="bg-black/90 border border-white/5 rounded-2xl overflow-hidden flex flex-col shadow-xl">
        {/* Terminal Header */}
        <div className="bg-zinc-900 px-4 py-3 border-b border-white/5 flex items-center justify-between select-none">
          <div className="flex items-center gap-2 text-zinc-400 text-xs font-bold">
            <Terminal className="w-4 h-4 text-amber-500" />
            <span>نظام مراقبة الأحداث وسجلات السيرفر (Console Logs)</span>
          </div>
          <div className="flex gap-1.5">
            <span className="w-3 h-3 rounded-full bg-rose-500/80" />
            <span className="w-3 h-3 rounded-full bg-orange-500/80" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
          </div>
        </div>

        {/* Console Body */}
        <div className="p-4 font-mono text-[10px] text-zinc-400 flex flex-col gap-2 min-h-[220px] max-h-[300px] overflow-y-auto leading-relaxed text-left selection:bg-amber-500 selection:text-black">
          {logs.length === 0 ? (
            <span className="text-zinc-600 italic">[خالي من السجلات]</span>
          ) : (
            logs.map((log, idx) => {
              let colorClass = 'text-zinc-400';
              if (log.includes('[ERROR]') || log.includes('فشل')) colorClass = 'text-rose-400';
              if (log.includes('[SYNC]') || log.includes('تمت')) colorClass = 'text-emerald-400';
              if (log.includes('[SYSTEM]')) colorClass = 'text-amber-400';

              return (
                <div key={idx} className={colorClass}>
                  {log}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleForceSync}
          disabled={isSyncing}
          className="flex-1 h-11 bg-amber-500 text-black hover:bg-amber-400 font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shadow-lg shadow-amber-500/10 text-xs"
        >
          <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>مزامنة إجبارية</span>
        </button>
        <button
          onClick={handleDownloadLogs}
          className="h-11 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold flex items-center justify-center gap-1.5 cursor-pointer border border-white/5 text-xs"
        >
          <Download className="w-4 h-4" />
          <span>تنزيل السجل</span>
        </button>
        <button
          onClick={handleClearLogs}
          className="h-11 px-4 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 font-bold flex items-center justify-center gap-1.5 cursor-pointer text-xs"
        >
          <Trash2 className="w-4 h-4" />
          <span>تفريغ</span>
        </button>
      </div>
    </div>
  );
}
