/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { User, Lock, Eye, EyeOff, Coins, ArrowRight, ShieldCheck, RefreshCw } from 'lucide-react';
import { getAllFromStore } from '../db';
import { Customer } from '../types';
import { showToast } from '../components/Toast';
import { validateLogin } from '../auth';

interface CustomerPortalLoginProps {
  onLoginSuccess: (role: 'admin' | 'customer', customerId?: string) => void;
}

export function CustomerPortalLogin({ onLoginSuccess }: CustomerPortalLoginProps) {
  const [phone, setPhone] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  // Auto-fill from URL parameters if available
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlPhone = params.get('phone');
    const urlCode = params.get('code');
    if (urlPhone) setPhone(urlPhone);
    if (urlCode) setAccessCode(urlCode);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(false);
    setLoading(true);

    try {
      const cleanPhone = phone.trim();
      const cleanCode = accessCode.trim();

      // 1. Check if the login is for the Admin
      const isAdminValid = await validateLogin(cleanPhone, cleanCode);
      if (isAdminValid) {
        showToast('تم تسجيل الدخول بنجاح كمدير للمنظومة', 'success');
        onLoginSuccess('admin');
        return;
      }

      // 2. Check if the login is for a Customer
      const dbCustomers = await getAllFromStore<Customer>('customers');
      
      const match = dbCustomers.find(
        (c) =>
          c.phone &&
          c.phone.trim() === cleanPhone &&
          (c.accessCode || '').trim() === cleanCode
      );

      if (match) {
        if (match.loginDisabled) {
          setError(true);
          showToast('عذراً، تم إيقاف صلاحية الدخول لحسابك من قبل الإدارة', 'warning');
          return;
        }
        
        // Save customer session
        localStorage.setItem('faqar-session-v1', 'customer-logged-in-' + match.id);
        showToast(`مرحباً بك عزيزي ${match.name}، جاري تحميل كشف الحساب...`, 'success');
        onLoginSuccess('customer', match.id);
      } else {
        setError(true);
        showToast('اسم المستخدم/رقم الهاتف أو رمز الدخول غير صحيح! يرجى التأكد وإعادة المحاولة', 'error');
      }
    } catch (err) {
      setError(true);
      showToast('حدث خطأ أثناء تحميل قاعدة البيانات، يرجى المحاولة لاحقاً', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#050505] text-zinc-100 flex items-center justify-center overflow-hidden p-5 select-none" dir="rtl">
      {/* Decorative ambient glowing circles */}
      <div className="absolute top-1/4 left-1/4 w-[300px] h-[300px] bg-amber-500/10 rounded-full blur-[96px] -z-10 pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[350px] h-[350px] bg-emerald-500/5 rounded-full blur-[96px] -z-10 pointer-events-none" />

      {/* Main Glassmorphism Card */}
      <div
        className={`w-full max-w-[440px] bg-[#121214]/70 backdrop-blur-3xl border border-white/5 rounded-[24px] p-8 shadow-2xl transition-all duration-300 ${
          error ? 'animate-shake' : ''
        }`}
      >
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-4 shadow-lg shadow-amber-500/5">
            <Coins className="w-7 h-7 text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
            بوابة استعلام الأقساط
          </h1>
          <p className="text-sm text-zinc-400 px-2 leading-relaxed">
            أهلاً وسهلاً بك. أدخل اسم المستخدم أو رقم الهاتف مع رمز الدخول لاستعراض كشف الحساب التفصيلي والأقساط المستحقة
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Phone Field */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-zinc-400 mr-1 flex items-center gap-1.5">
              <span>اسم المستخدم / رقم الهاتف للزبون</span>
            </label>
            <div className="relative">
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500">
                <User className="w-5 h-5" />
              </span>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="اسم المستخدم أو رقم الهاتف الخاص بك"
                required
                className="w-full h-12 pr-12 pl-4 rounded-2xl bg-[#18181b]/90 border border-white/5 text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all duration-200 text-sm text-right font-medium tracking-wide"
              />
            </div>
          </div>

          {/* Code Field */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-zinc-400 mr-1">
              رمز الدخول السري / كلمة المرور
            </label>
            <div className="relative">
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500">
                <Lock className="w-5 h-5" />
              </span>
              <input
                type={showCode ? 'text' : 'password'}
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                placeholder="أدخل رمز الدخول المسلم لك أو كلمة المرور"
                required
                className="w-full h-12 pr-12 pl-12 rounded-2xl bg-[#18181b]/90 border border-white/5 text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all duration-200 text-sm font-semibold tracking-widest text-center"
              />
              <button
                type="button"
                onClick={() => setShowCode(!showCode)}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                {showCode ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Error Feedback */}
          {error && (
            <div className="text-xs text-rose-400 font-semibold text-center bg-rose-500/10 border border-rose-500/20 py-3 rounded-xl animate-pulse">
              بيانات الدخول غير صحيحة! تأكد من المدخلات وأعد المحاولة
            </div>
          )}

          {/* Query Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-amber-500 shadow-amber-500/10 hover:bg-amber-400 text-black font-bold rounded-2xl flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none mt-2 cursor-pointer shadow-lg"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>جاري تحميل كشف الحساب...</span>
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5" />
                <span>عرض كشف الحساب المالي</span>
              </span>
            )}
          </button>
        </form>

        <div className="mt-8 text-center border-t border-white/5 pt-5 flex items-center justify-center gap-1.5 text-xs text-zinc-500">
          <span>نظام آمن للمتابعة الفورية للأقساط</span>
        </div>
      </div>
    </div>
  );
}
