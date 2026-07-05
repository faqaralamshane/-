/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ArrowRight, Plus, Bell, Pencil, Trash2, X, Zap } from 'lucide-react';
import { NotificationRule, Template } from '../types';
import { showToast } from '../components/Toast';
import { uid } from '../db';
import { incrementPendingSync } from '../syncQueue';

interface NotificationsSettingsViewProps {
  notificationRules: NotificationRule[];
  templates: Template[];
  onBack: () => void;
  onRefreshData: () => void;
}

export function NotificationsSettingsView({
  notificationRules,
  templates,
  onBack,
  onRefreshData
}: NotificationsSettingsViewProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<NotificationRule | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [triggerType, setTriggerType] = useState<NotificationRule['triggerType']>('daysBefore');
  const [daysValue, setDaysValue] = useState(3);
  const [templateId, setTemplateId] = useState('');
  const [isActive, setIsActive] = useState(true);

  const handleOpenAddModal = () => {
    setEditingRule(null);
    setName('');
    setTriggerType('daysBefore');
    setDaysValue(3);
    setTemplateId(templates[0]?.id || '');
    setIsActive(true);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (rule: NotificationRule) => {
    setEditingRule(rule);
    setName(rule.name);
    setTriggerType(rule.triggerType);
    setDaysValue(rule.daysValue);
    setTemplateId(rule.templateId);
    setIsActive(rule.isActive);
    setIsModalOpen(true);
  };

  const handleSaveRule = () => {
    if (!name.trim()) {
      showToast('الرجاء إدخال اسم القاعدة', 'error');
      return;
    }

    const savedRules = [...notificationRules];
    const rid = editingRule ? editingRule.id : 'rule-' + uid();

    const newRule: NotificationRule = {
      id: rid,
      name: name.trim(),
      triggerType,
      daysValue: Number(daysValue),
      templateId,
      isActive
    };

    if (editingRule) {
      const idx = savedRules.findIndex((r) => r.id === editingRule.id);
      if (idx !== -1) savedRules[idx] = newRule;
    } else {
      savedRules.push(newRule);
    }

    localStorage.setItem('faqar-notification-rules-v1', JSON.stringify(savedRules));
    incrementPendingSync();
    showToast(editingRule ? 'تم تعديل قاعدة الإشعارات بنجاح' : 'تم إضافة قاعدة جديدة بنجاح', 'success');
    setIsModalOpen(false);
    onRefreshData();
  };

  const handleDeleteRule = (id: string) => {
    const confirmDelete = window.confirm('هل أنت متأكد من حذف قاعدة الإشعارات هذه؟');
    if (!confirmDelete) return;

    const filtered = notificationRules.filter((r) => r.id !== id);
    localStorage.setItem('faqar-notification-rules-v1', JSON.stringify(filtered));
    incrementPendingSync();
    showToast('تم حذف القاعدة بنجاح', 'success');
    onRefreshData();
  };

  const handleToggleActive = (rule: NotificationRule) => {
    const updated = { ...rule, isActive: !rule.isActive };
    const savedRules = notificationRules.map((r) => (r.id === rule.id ? updated : r));
    localStorage.setItem('faqar-notification-rules-v1', JSON.stringify(savedRules));
    onRefreshData();
    showToast(updated.isActive ? 'تم تنشيط القاعدة' : 'تم إيقاف القاعدة المحددة', 'success');
  };

  const getTriggerLabel = (type: NotificationRule['triggerType'], val: number) => {
    if (type === 'daysBefore') return `قبل الاستحقاق بـ ${val} أيام`;
    if (type === 'daysLate') return `بعد التأخر عن الموعد بـ ${val} أيام`;
    if (type === 'contractCreated') return `مباشرة عند إنشاء العقد الجديد`;
    return `عند فوات قسط بمقدار ${val} أيام`;
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-12">
      {/* Back Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-amber-500 hover:text-amber-400 p-1 cursor-pointer">
          <ArrowRight className="w-6 h-6" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">قواعد الإشعارات والإنذارات</h1>
          <p className="text-xs text-zinc-500 mt-0.5">جدولة إشعارات تحصيل الديون وحسابات الزبائن تلقائياً</p>
        </div>
      </div>

      {/* Rules List Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-2">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <Bell className="w-5 h-5 text-amber-500" />
          <span>القواعد المجدولة ({notificationRules.length})</span>
        </h2>
        <button
          onClick={handleOpenAddModal}
          className="h-8 px-3 rounded-lg bg-amber-500 text-black hover:bg-amber-400 font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>إضافة قاعدة</span>
        </button>
      </div>

      {/* Rules Grid */}
      <div className="flex flex-col gap-4">
        {notificationRules.map((r) => {
          const associatedTemplate = templates.find((t) => t.id === r.templateId);

          return (
            <div
              key={r.id}
              className={`p-5 rounded-2xl border transition-all duration-200 ${
                r.isActive
                  ? 'bg-[#121214]/60 border-white/5'
                  : 'bg-[#121214]/20 border-white/5 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleToggleActive(r)}
                    className={`w-10 h-6 rounded-full p-0.5 transition-colors cursor-pointer ${
                      r.isActive ? 'bg-amber-500' : 'bg-zinc-800'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-black shadow-md transform transition-transform duration-200 ${
                        r.isActive ? '-translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                  <div className="flex flex-col text-right">
                    <span className="text-xs font-bold text-white">{r.name}</span>
                    <span className="text-[10px] text-zinc-500">
                      الحدث: {getTriggerLabel(r.triggerType, r.daysValue)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenEditModal(r)}
                    className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 flex items-center justify-center cursor-pointer transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteRule(r.id)}
                    className="w-8 h-8 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 flex items-center justify-center cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Template Associated Name */}
              <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-zinc-500">
                <span>القالب المستخدم:</span>
                <span className="font-bold text-amber-500 flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5" />
                  <span>{associatedTemplate ? associatedTemplate.name : 'لا يوجد قالب مرتبطة'}</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-[448px] bg-[#121214] border-t border-white/10 rounded-t-[24px] p-6 shadow-2xl animate-slide-up">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white">
                {editingRule ? 'تعديل قاعدة الإشعارات' : 'إضافة قاعدة تذكير جديدة'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/5 border border-white/5 flex items-center justify-center text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-zinc-400">اسم القاعدة التذكيرية *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: رسالة قبل موعد الاستحقاق بـ ٣ أيام"
                  required
                  className="w-full h-11 px-4 rounded-xl bg-[#18181b] border border-white/5 text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/50 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-zinc-400">نوع حدث الإطلاق</label>
                  <select
                    value={triggerType}
                    onChange={(e: any) => setTriggerType(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl bg-[#18181b] border border-white/5 text-white focus:outline-none text-xs"
                  >
                    <option value="daysBefore">قبل الاستحقاق</option>
                    <option value="daysLate">بعد فوات الأوان (تأخير)</option>
                    <option value="contractCreated">عند إنشاء العقد مباشرة</option>
                    <option value="paymentMissed">عند فوات قسط مستحق</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-zinc-400">عدد الأيام</label>
                  <input
                    type="number"
                    value={daysValue}
                    onChange={(e) => setDaysValue(Number(e.target.value))}
                    min={0}
                    className="w-full h-11 px-4 rounded-xl bg-[#18181b] border border-white/5 text-white focus:outline-none focus:border-amber-500/50 text-sm"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-zinc-400">ربط قالب الرسالة التلقائي *</label>
                <select
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl bg-[#18181b] border border-white/5 text-white focus:outline-none text-xs"
                >
                  <option value="">-- اختر القالب المراد إرساله --</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.placement})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between p-3 bg-white/[0.01] border border-white/5 rounded-xl mt-1">
                <span className="text-xs font-semibold text-zinc-400">تفعيل القاعدة حالياً</span>
                <button
                  onClick={() => setIsActive(!isActive)}
                  className={`w-10 h-6 rounded-full p-0.5 transition-colors cursor-pointer ${
                    isActive ? 'bg-amber-500' : 'bg-zinc-800'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-black shadow-md transform transition-transform duration-200 ${
                      isActive ? '-translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <button
                onClick={handleSaveRule}
                className="w-full h-12 bg-amber-500 text-black hover:bg-amber-400 font-bold rounded-xl flex items-center justify-center transition-colors mt-2 cursor-pointer text-sm shadow-lg"
              >
                حفظ القاعدة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
