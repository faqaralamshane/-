/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ArrowRight, Plus, MessageSquare, Pencil, Trash2, X, Search, Sparkles, Zap } from 'lucide-react';
import { Template, BranchSettings } from '../types';
import { showToast } from '../components/Toast';
import { uid } from '../db';
import { incrementPendingSync } from '../syncQueue';
import { evaluateCustomerSpecificTokens } from '../auditCustomerTokens';

interface TemplatesSettingsViewProps {
  templates: Template[];
  onBack: () => void;
  onRefreshData: () => void;
}

export function TemplatesSettingsView({
  templates,
  onBack,
  onRefreshData
}: TemplatesSettingsViewProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);

  // Branch Settings State
  const getBranchSettings = (): BranchSettings => {
    try {
      const saved = localStorage.getItem('faqar-branch-settings-v1');
      return saved ? JSON.parse(saved) : { branchAddress: 'العراق، بغداد', supportPhone: '07827744096', penaltyRate: 5 };
    } catch {
      return { branchAddress: 'العراق، بغداد', supportPhone: '07827744096', penaltyRate: 5 };
    }
  };
  const [branch, setBranch] = useState<BranchSettings>(getBranchSettings());

  // Form states
  const [name, setName] = useState('');
  const [placement, setPlacement] = useState<Template['placement']>('profile_top');
  const [style, setStyle] = useState<Template['style']>('tint');
  const [color, setColor] = useState<Template['color']>('primary');
  const [icon, setIcon] = useState('MessageCircle');
  const [body, setBody] = useState('');
  const [minDaysLate, setMinDaysLate] = useState('');
  const [maxDaysLate, setMaxDaysLate] = useState('');
  const [minRemaining, setMinRemaining] = useState('');
  const [hoursFrom, setHoursFrom] = useState('');
  const [hoursTo, setHoursTo] = useState('');

  // Search in tokens
  const [tokenSearch, setTokenSearch] = useState('');
  const [activeTokenTab, setActiveTokenTab] = useState<string>('all');
  const [showLegacyTokens, setShowLegacyTokens] = useState(false);

  const handleSaveBranch = () => {
    localStorage.setItem('faqar-branch-settings-v1', JSON.stringify(branch));
    showToast('تم حفظ بيانات الفرع الذكي والغرامات', 'success');
  };

  const handleOpenAddModal = () => {
    setEditingTemplate(null);
    setName('');
    setPlacement('profile_top');
    setStyle('tint');
    setColor('primary');
    setIcon('MessageCircle');
    setBody('');
    setMinDaysLate('');
    setMaxDaysLate('');
    setMinRemaining('');
    setHoursFrom('');
    setHoursTo('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (t: Template) => {
    setEditingTemplate(t);
    setName(t.name);
    setPlacement(t.placement);
    setStyle(t.style);
    setColor(t.color);
    setIcon(t.icon);
    setBody(t.body);
    setMinDaysLate(t.minDaysLate !== undefined ? String(t.minDaysLate) : '');
    setMaxDaysLate(t.maxDaysLate !== undefined ? String(t.maxDaysLate) : '');
    setMinRemaining(t.minRemaining !== undefined ? String(t.minRemaining) : '');
    setHoursFrom(t.hoursFrom !== undefined ? String(t.hoursFrom) : '');
    setHoursTo(t.hoursTo !== undefined ? String(t.hoursTo) : '');
    setIsModalOpen(true);
  };

  const handleSaveTemplate = () => {
    if (!name.trim() || !body.trim()) {
      showToast('الرجاء إدخال اسم القالب ومحتوى الرسالة', 'error');
      return;
    }

    const savedTemplates = [...templates];
    const tid = editingTemplate ? editingTemplate.id : 'tpl-' + uid();
    
    const newTemplate: Template = {
      id: tid,
      name: name.trim(),
      placement,
      style,
      color,
      icon,
      body,
      minDaysLate: minDaysLate ? Number(minDaysLate) : undefined,
      maxDaysLate: maxDaysLate ? Number(maxDaysLate) : undefined,
      minRemaining: minRemaining ? Number(minRemaining) : undefined,
      hoursFrom: hoursFrom ? Number(hoursFrom) : undefined,
      hoursTo: hoursTo ? Number(hoursTo) : undefined
    };

    if (editingTemplate) {
      const idx = savedTemplates.findIndex((t) => t.id === editingTemplate.id);
      if (idx !== -1) savedTemplates[idx] = newTemplate;
    } else {
      savedTemplates.push(newTemplate);
    }

    localStorage.setItem('faqar-message-templates-v1', JSON.stringify(savedTemplates));
    incrementPendingSync();
    showToast(editingTemplate ? 'تم تعديل القالب بنجاح' : 'تم إضافة القالب الجديد بنجاح', 'success');
    setIsModalOpen(false);
    onRefreshData();
  };

  const handleDeleteTemplate = (id: string) => {
    const doubleConfirm = window.confirm('هل أنت متأكد من رغبتك في حذف قالب الرسائل هذا؟');
    if (!doubleConfirm) return;

    const filtered = templates.filter((t) => t.id !== id);
    localStorage.setItem('faqar-message-templates-v1', JSON.stringify(filtered));
    incrementPendingSync();
    showToast('تم حذف القالب بنجاح', 'success');
    onRefreshData();
  };

  // Mock Data for Live Preview
  const MOCK_CUSTOMER = {
    id: 'cust-mock',
    name: 'أحمد محمد علي',
    phone: '07827744096',
    notes: 'زبون تجريبي للمعاينة الحية',
    createdAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString() // 100 days ago
  };
  const MOCK_CONTRACTS = [
    {
      id: 'cont-mock',
      customerId: 'cust-mock',
      itemName: 'موبايل آيفون 15 برو',
      dueDay: 5,
      cashPrice: 1200000,
      installmentPrice: 1500000,
      monthlyInstallment: 100000,
      notes: 'الضمان ساري المفعول',
      createdAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString()
    }
  ];
  const MOCK_PAYMENTS = [
    {
      id: 'pay-mock-1',
      contractId: 'cont-mock',
      amount: 100000,
      date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      notes: 'القسط الأول'
    },
    {
      id: 'pay-mock-2',
      contractId: 'cont-mock',
      amount: 100000,
      date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      notes: 'القسط الثاني'
    }
  ];

  const getLivePreview = () => {
    if (!body) return 'محتوى المعاينة الحية فارغ...';
    try {
      return evaluateCustomerSpecificTokens(
        body,
        MOCK_CUSTOMER,
        MOCK_CONTRACTS,
        MOCK_PAYMENTS,
        MOCK_CONTRACTS[0],
        branch
      );
    } catch (err: any) {
      return `خطأ في المعاينة: ${err.message}`;
    }
  };

  // Modern smart tokens library for UI copy-paste helper
  const MOCK_TOKENS = [
    { key: 'client_name', label: 'اسم الزبون الكلي', desc: 'أحمد محمد علي' },
    { key: 'client_phone', label: 'هاتف الزبون', desc: '07827744096' },
    { key: 'client_first_name', label: 'الاسم الأول للزبون', desc: 'أحمد' },
    { key: 'client_since_months', label: 'أشهر الاشتراك', desc: '٣ أشهر' },
    { key: 'contract_item', label: 'اسم السلعة المباعة', desc: 'موبايل آيفون 15 برو' },
    { key: 'total_amount', label: 'سعر السلعة بالقسط', desc: '١,٥٠٠,٠٠٠ د.ع' },
    { key: 'cash_price', label: 'السعر حاضر (كاش)', desc: '١,٢٠٠,٠٠٠ د.ع' },
    { key: 'profit_amount', label: 'أرباح العقد المستهدفة', desc: '٣٠٠,٠٠٠ د.ع' },
    { key: 'paid_amount', label: 'إجمالي المبالغ المسددة', desc: '٢٠٠,٠٠٠ د.ع' },
    { key: 'remaining_balance', label: 'إجمالي المبالغ المتبقية', desc: '١,٣٠٠,٠٠٠ د.ع' },
    { key: 'next_installment', label: 'القسط الشهري المطلوب', desc: '١٠٠,٠٠٠ د.ع' },
    { key: 'days_late', label: 'أيام التأخر الكلية', desc: 'أيام التأخير الفعلي' },
    { key: 'total_due_now', label: 'المستحق حالياً مع الغرامات', desc: 'المبلغ المطلوب دفعه حالياً' },
    { key: 'penalty_amount', label: 'مجموع غرامات التأخير', desc: 'حسب نسبة غرامة الفرع' },
    { key: 'current_date', label: 'تاريخ اليوم الحالي', desc: 'اليوم بنمط ar-IQ' },
    { key: 'branch_address', label: 'عنوان الفرع والمكتب', desc: 'العراق، بغداد' },
    { key: 'hadith_debt', label: 'حديث شريف حول الدين', desc: 'حديث عشوائي يتغير تلقائياً' },
    { key: 'quran_reminder', label: 'آية قرآنية حول الوفاء', desc: 'آية تحفيزية للوفاء بالعقود' }
  ];

  const LEGACY_TOKENS = [
    { key: 'اسم_الزبون', label: 'اسم الزبون' },
    { key: 'رقم_الهاتف', label: 'الهاتف' },
    { key: 'المبلغ_المتبقي', label: 'المتبقي' },
    { key: 'القسط_الشهري', label: 'قسط الشهر' },
    { key: 'اسم_السلعة', label: 'المنتج' },
    { key: 'سعر_القسط', label: 'سعر العقد الكلي' },
    { key: 'تاريخ_اليوم', label: 'تاريخ اليوم' }
  ];

  const filteredTokens = MOCK_TOKENS.filter((t) => {
    return t.label.includes(tokenSearch) || t.key.includes(tokenSearch);
  });

  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-12">
      {/* Back Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-amber-500 hover:text-amber-400 p-1 cursor-pointer">
          <ArrowRight className="w-6 h-6" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">قوالب الرسائل ورسائل واتساب</h1>
          <p className="text-xs text-zinc-500 mt-0.5">تحرير {templates.length} قالب تذكير ذكي للتحصيل</p>
        </div>
      </div>

      {/* Branch Settings Card */}
      <div className="bg-[#121214]/60 border border-white/5 rounded-2xl p-5 flex flex-col gap-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-500" />
          <span>بيانات الفرع وغرامات التأخير</span>
        </h3>
        <p className="text-[11px] text-zinc-400 leading-relaxed -mt-2">
          تستخدم هذه البيانات في تعويض الحقول الذكية مثل {"{{branch_address}}"} وحساب غرامات المتأخرين تراكمياً.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-zinc-500 font-semibold">عنوان المكتب والفرع</span>
            <input
              type="text"
              value={branch.branchAddress}
              onChange={(e) => setBranch({ ...branch, branchAddress: e.target.value })}
              className="w-full h-10 px-3 rounded-xl bg-[#18181b] border border-white/5 text-white focus:outline-none text-xs"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-zinc-500 font-semibold">هاتف الدعم للزبائن</span>
            <input
              type="text"
              value={branch.supportPhone}
              onChange={(e) => setBranch({ ...branch, supportPhone: e.target.value })}
              className="w-full h-10 px-3 rounded-xl bg-[#18181b] border border-white/5 text-white focus:outline-none text-xs"
              dir="ltr"
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex flex-col gap-1 flex-1">
            <span className="text-[10px] text-zinc-500 font-semibold">نسبة الغرامة التأخيرية شهرياً (%)</span>
            <input
              type="number"
              value={branch.penaltyRate}
              onChange={(e) => setBranch({ ...branch, penaltyRate: Number(e.target.value) })}
              className="w-full h-10 px-3 rounded-xl bg-[#18181b] border border-white/5 text-white focus:outline-none text-xs"
            />
          </div>
          <button
            onClick={handleSaveBranch}
            className="h-10 px-6 rounded-xl bg-amber-500 text-black hover:bg-amber-400 font-bold text-xs cursor-pointer transition-colors self-end"
          >
            حفظ إعدادات الفرع
          </button>
        </div>
      </div>

      {/* Templates List Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-2">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-amber-500" />
          <span>القوالب المتاحة بالنظام ({templates.length})</span>
        </h2>
        <button
          onClick={handleOpenAddModal}
          className="h-8 px-3 rounded-lg bg-amber-500 text-black hover:bg-amber-400 font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>قالب جديد</span>
        </button>
      </div>

      {/* Templates List */}
      <div className="flex flex-col gap-4">
        {templates.map((t) => (
          <div
            key={t.id}
            className="p-5 rounded-2xl bg-[#121214]/60 border border-white/5 flex flex-col gap-3 shadow-md"
          >
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
                  <Zap className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-white">{t.name}</span>
                  <span className="text-[10px] text-zinc-500">
                    مكان الظهور: {t.placement} • المظهر: {t.style}
                  </span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenEditModal(t)}
                  className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 flex items-center justify-center cursor-pointer transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDeleteTemplate(t.id)}
                  className="w-8 h-8 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 flex items-center justify-center cursor-pointer transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Preview of body with line clamp */}
            <div className="p-3 rounded-xl bg-zinc-950/40 border border-white/5 text-[11px] text-zinc-400 select-all leading-relaxed whitespace-pre-wrap line-clamp-3">
              {t.body}
            </div>
          </div>
        ))}
      </div>

      {/* Add / Edit Template Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-[500px] bg-[#121214] border-t border-white/10 rounded-t-[24px] p-6 shadow-2xl animate-slide-up max-h-[92vh] overflow-y-auto flex flex-col gap-4">
            
            {/* Header */}
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">
                {editingTemplate ? 'تعديل قالب رسالة' : 'إنشاء قالب رسالة جديد'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/5 border border-white/5 flex items-center justify-center text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-zinc-400">اسم القالب (عنوان الزر) *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: تذكير بموعد الدفع"
                  required
                  className="w-full h-10 px-3 rounded-xl bg-[#18181b] border border-white/5 text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/50 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-zinc-400">مكان الظهور بالملف الشخصي</label>
                  <select
                    value={placement}
                    onChange={(e: any) => setPlacement(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-[#18181b] border border-white/5 text-white focus:outline-none text-xs"
                  >
                    <option value="profile_top">أعلى الملف (معاينة كشف)</option>
                    <option value="profile_bottom">أسفل الملف (شريط إجراءات)</option>
                    <option value="contract_card">بجانب بطاقة العقد</option>
                    <option value="defaulters_row">بجانب صف المتأخرين</option>
                    <option value="payment_success">بعد تسجيل دفعة ناجحة تلقائياً</option>
                    <option value="floating">زر دائري عائم يسار</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-zinc-400">نمط عرض الزر (Style)</label>
                  <select
                    value={style}
                    onChange={(e: any) => setStyle(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-[#18181b] border border-white/5 text-white focus:outline-none text-xs"
                  >
                    <option value="tint">شفاف ملون (Tint)</option>
                    <option value="solid">ملون بالكامل (Solid)</option>
                    <option value="outline">إطار خارجي (Outline)</option>
                    <option value="gradient">متدرج ناعم (Gradient)</option>
                    <option value="glass">زجاجي (Glass)</option>
                    <option value="pill">دائري كبسولة (Pill)</option>
                    <option value="icon_only">أيقونة دائرية فقط (Icon)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-zinc-400">اللون الأساسي للزر</label>
                  <select
                    value={color}
                    onChange={(e: any) => setColor(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-[#18181b] border border-white/5 text-white focus:outline-none text-xs"
                  >
                    <option value="primary">الذهبي / الأصفر الرئيسي</option>
                    <option value="success">الأخضر (ودّي ومريح)</option>
                    <option value="warning">البرتقالي (تنبيه معتدل)</option>
                    <option value="danger">الأحمر (تنبيه صارم/نهائي)</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-zinc-400">أيقونة الزر التعبيرية</label>
                  <select
                    value={icon}
                    onChange={(e) => setIcon(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-[#18181b] border border-white/5 text-white focus:outline-none text-xs"
                  >
                    <option value="MessageCircle">فقاعة مراسلة (MessageCircle)</option>
                    <option value="FileText">ملف كشف حساب (FileText)</option>
                    <option value="AlertTriangle">مثلث تحذير (AlertTriangle)</option>
                    <option value="Zap">شعلة سريعة (Zap)</option>
                    <option value="Phone">سماعة هاتف (Phone)</option>
                    <option value="Clock">ساعة مؤقت (Clock)</option>
                  </select>
                </div>
              </div>

              {/* Conditions toggle */}
              <div className="p-3.5 bg-zinc-950/40 border border-white/5 rounded-xl flex flex-col gap-2">
                <span className="text-[10px] font-bold text-amber-500">شروط الظهور التلقائي (اختياري)</span>
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[9px] text-zinc-500">الحد الأدنى للتأخير (أيام)</span>
                    <input
                      type="number"
                      value={minDaysLate}
                      onChange={(e) => setMinDaysLate(e.target.value)}
                      placeholder="0"
                      className="h-8 px-2 bg-[#18181b] border border-white/5 text-white text-[10px] rounded-lg"
                    />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[9px] text-zinc-500">الحد الأقصى للتأخير (أيام)</span>
                    <input
                      type="number"
                      value={maxDaysLate}
                      onChange={(e) => setMaxDaysLate(e.target.value)}
                      placeholder="120"
                      className="h-8 px-2 bg-[#18181b] border border-white/5 text-white text-[10px] rounded-lg"
                    />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[9px] text-zinc-500">الحد الأدنى للدين (د.ع)</span>
                    <input
                      type="number"
                      value={minRemaining}
                      onChange={(e) => setMinRemaining(e.target.value)}
                      placeholder="0"
                      className="h-8 px-2 bg-[#18181b] border border-white/5 text-white text-[10px] rounded-lg"
                    />
                  </div>
                </div>
              </div>

              {/* Message Body Field */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-zinc-400">محتوى رسالة واتساب *</label>
                  <button
                    type="button"
                    onClick={() => setShowLegacyTokens(!showLegacyTokens)}
                    className="text-[10px] font-bold text-amber-500 hover:underline cursor-pointer"
                  >
                    {showLegacyTokens ? 'إخفاء المتغيرات العربية' : 'إظهار المتغيرات العربية'}
                  </button>
                </div>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="السلام عليكم، نذكركم بقسطكم الشهري..."
                  rows={5}
                  required
                  className="w-full p-3 rounded-xl bg-[#18181b] border border-white/5 text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/50 text-xs resize-none leading-relaxed"
                />
              </div>

              {/* Tokens Library copy assistant */}
              <div className="p-3.5 bg-[#121214]/60 border border-white/5 rounded-xl flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-zinc-400">مكتبة المتغيرات الذكية والرموز الكودية</span>
                  <input
                    type="text"
                    value={tokenSearch}
                    onChange={(e) => setTokenSearch(e.target.value)}
                    placeholder="ابحث عن متغير..."
                    className="h-7 px-3 bg-zinc-950 border border-white/5 text-[9px] text-white rounded-lg w-1/2"
                  />
                </div>

                <div className="max-h-[140px] overflow-y-auto flex flex-col gap-1.5 scrollbar-thin">
                  {showLegacyTokens ? (
                    <div className="flex flex-col gap-1">
                      <p className="text-[9px] text-zinc-500">المتغيرات الكلاسيكية (العربية):</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {LEGACY_TOKENS.map((l) => (
                          <div
                            key={l.key}
                            onClick={() => {
                              setBody(body + ` {{${l.key}}}`);
                              showToast(`تم إدراج {{${l.key}}}`);
                            }}
                            className="p-1.5 bg-zinc-950 hover:bg-zinc-900 rounded-lg text-[9px] font-mono text-amber-400 flex justify-between cursor-pointer border border-white/5"
                          >
                            <span>{l.label}</span>
                            <span>{`{{${l.key}}}`}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    filteredTokens.map((tok) => (
                      <div
                        key={tok.key}
                        onClick={() => {
                          setBody(body + ` {{${tok.key}}}`);
                          showToast(`تم إدراج {{${tok.key}}}`);
                        }}
                        className="p-2 bg-zinc-950 hover:bg-zinc-900 rounded-xl flex items-center justify-between border border-white/5 cursor-pointer"
                      >
                        <div className="flex flex-col text-right">
                          <span className="text-[9px] text-zinc-300 font-bold">{tok.label}</span>
                          <span className="text-[8px] text-zinc-500 select-none">{tok.desc}</span>
                        </div>
                        <code className="text-[9px] font-mono text-amber-400 bg-amber-500/5 px-2 py-0.5 rounded-md border border-amber-500/10">
                          {`{{${tok.key}}}`}
                        </code>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Live Preview panel */}
              <div className="p-3 bg-emerald-950/20 border border-emerald-500/10 rounded-xl flex flex-col gap-1.5">
                <span className="text-[9px] font-bold text-emerald-400">معاينة الرسالة الحية ببيانات تجريبية:</span>
                <div className="text-[10px] text-zinc-400 whitespace-pre-wrap select-all font-medium leading-relaxed bg-black/30 p-2.5 rounded-lg border border-white/5 max-h-[120px] overflow-y-auto leading-relaxed">
                  {getLivePreview()}
                </div>
              </div>

              <button
                type="button"
                onClick={handleSaveTemplate}
                className="w-full h-11 bg-amber-500 text-black hover:bg-amber-400 font-bold rounded-xl flex items-center justify-center transition-colors cursor-pointer text-xs shadow-lg mt-1"
              >
                حفظ القالب
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
