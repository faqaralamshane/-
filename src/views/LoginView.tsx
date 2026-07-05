/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ShieldCheck, User, Lock, Eye, EyeOff, Users, Coins } from 'lucide-react';
import { validateLogin } from '../auth';
import { showToast } from '../components/Toast';
import { getAllFromStore } from '../db';
import { Customer } from '../types';

interface LoginViewProps {
  onLoginSuccess: (role: 'admin' | 'customer', customerId?: string) => void;
}

export function LoginView({ onLoginSuccess }: LoginViewProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(false);
    setLoading(true);

    try {
      // 1. Try Admin Login first
      const isAdminValid = await validateLogin(username, password);
      if (isAdminValid) {
        showToast('تم تسجيل الدخول بنجاح كمدير للمنظومة', 'success');
        onLoginSuccess('admin');
        return;
      }

      // 2. If not admin, attempt Customer login against IndexedDB customers list
      const dbCustomers = await getAllFromStore<Customer>('customers');
      const cleanInputUsername = username.trim();
      const cleanInputPassword = password.trim();

      const match = dbCustomers.find(
        (c) => 
          (c.phone && c.phone.trim() === cleanInputUsername) && 
          ((c.accessCode || '').trim() === cleanInputPassword)
      );

      if (match) {
        if (match.loginDisabled) {
          setError(true);
          showToast('عذراً، تم إيقاف صلاحية الدخول لحسابك من قبل الإدارة', 'warning');
          return;
        }
        localStorage.setItem('faqar-session-v1', 'customer-logged-in-' + match.id);
        showToast(`أهلاً وسهلاً بك عزيزي ${match.name} في بوابة الاستعلام الخاصة بك`, 'success');
        onLoginSuccess('customer', match.id);
      } else {
        setError(true);
        showToast('بيانات الدخول غير صحيحة! تأكد من اسم المستخدم/الهاتف والرمز السري', 'error');
      }
    } catch (err) {
      setError(true);
      showToast('حدث خطأ أثناء الاتصال بقاعدة البيانات المحلية', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-height-screen min-h-screen bg-[#050505] text-zinc-100 flex items-center justify-center overflow-hidden p-4 select-none" dir="rtl">
      {/* Decorative ambient glowing circles */}
      <div className="absolute top-1/4 left-1/4 w-[300px] h-[300px] bg-amber-500/10 rounded-full blur-[96px] -z-10 pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[350px] h-[350px] bg-orange-500/5 rounded-full blur-[96px] -z-10 pointer-events-none" />

      {/* Main Card */}
      <div
        className={`w-full max-w-[448px] bg-[#121214]/60 backdrop-blur-2xl border border-white/5 rounded-[24px] p-8 shadow-2xl transition-all duration-300 ${
          error ? 'animate-shake' : ''
        }`}
      >
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-4">
            <Coins className="w-7 h-7 text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mb-1">
            منظومة الأقساط والجرد المالي
          </h1>
          <p className="text-sm text-zinc-400">
            بوابة تسجيل الدخول الموحدة للمدير والمشتركين
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Username / Phone Field */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-zinc-400 mr-1">
              اسم المستخدم (المدير) أو رقم الهاتف (الزبون)
            </label>
            <div className="relative">
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500">
                <User className="w-5 h-5" />
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="أدخل اسم المستخدم أو رقم الهاتف الخاص بك"
                required
                className="w-full h-12 pr-12 pl-4 rounded-2xl bg-[#18181b] border border-white/5 text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all duration-200 text-sm"
              />
            </div>
          </div>

          {/* Password / Access Code Field */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-zinc-400 mr-1">
              رقم السر (المدير) أو رمز الدخول (الزبون)
            </label>
            <div className="relative">
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500">
                <Lock className="w-5 h-5" />
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="أدخل الرمز السري أو كود العميل للمتابعة"
                required
                className="w-full h-12 pr-12 pl-12 rounded-2xl bg-[#18181b] border border-white/5 text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all duration-200 text-sm text-left"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="text-xs text-rose-400 font-medium text-center bg-rose-500/10 border border-rose-500/20 py-2.5 rounded-xl mt-1">
              بيانات الاعتماد المدخلة غير متطابقة مع أي حساب في النظام
            </div>
          )}

          {/* Login Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-amber-500 shadow-amber-500/10 text-black font-bold rounded-2xl flex items-center justify-center transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none mt-2 cursor-pointer shadow-lg"
          >
            {loading ? 'جاري التحقق...' : 'تسجيل دخول آمن'}
          </button>
        </form>

        <div className="mt-8 text-center border-t border-white/5 pt-5">
          <p className="text-xs text-zinc-500">يعمل بالكامل دون اتصال • جرد وأقساط ذكية مشفرة</p>
        </div>
      </div>
    </div>
  );
}
