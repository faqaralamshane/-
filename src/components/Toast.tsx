/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  text: string;
  duration?: number;
}

let toastListeners: ((msg: ToastMessage) => void)[] = [];

export const showToast = (text: string, type: ToastMessage['type'] = 'info', duration = 4000) => {
  const id = Math.random().toString(36).substring(2, 9);
  toastListeners.forEach((l) => l({ id, type, text, duration }));

  // Dispatch custom event for dedicated action page representation on state changes
  if (type === 'success' || type === 'error' || type === 'warning') {
    const detail = {
      id,
      title: type === 'success' ? 'تأكيد نجاح العملية 🌟' : type === 'error' ? 'خطأ في تنفيذ الإجراء ⚠️' : 'تنبيه من النظام 💡',
      message: text,
      type,
      timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };
    window.dispatchEvent(new CustomEvent('faqar-action-details', { detail }));
  }
};

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const listener = (msg: ToastMessage) => {
      setToasts((prev) => [...prev, msg]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== msg.id));
      }, msg.duration || 4000);
    };

    toastListeners.push(listener);
    return () => {
      toastListeners = toastListeners.filter((l) => l !== listener);
    };
  }, []);

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-full max-w-sm px-4 pointer-events-none" dir="rtl">
      {toasts.map((toast) => {
        let bg = 'bg-zinc-900 border-zinc-800 text-white';
        let icon = 'ℹ️';
        if (toast.type === 'success') {
          bg = 'bg-emerald-950/90 border-emerald-800 text-emerald-400';
          icon = '✅';
        } else if (toast.type === 'error') {
          bg = 'bg-rose-950/90 border-rose-800 text-rose-400';
          icon = '❌';
        } else if (toast.type === 'warning') {
          bg = 'bg-amber-950/90 border-amber-800 text-amber-400';
          icon = '⚠️';
        }

        return (
          <div
            key={toast.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl border backdrop-blur-xl shadow-2xl transition-all duration-300 pointer-events-auto transform animate-slide-down ${bg}`}
          >
            <span className="text-lg">{icon}</span>
            <p className="text-xs font-medium">{toast.text}</p>
          </div>
        );
      })}
    </div>
  );
}
