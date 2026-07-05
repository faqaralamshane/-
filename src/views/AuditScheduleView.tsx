/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ArrowRight, Plus, Clock, Pencil, Trash2, X, Zap, Check, Search, ShieldCheck } from 'lucide-react';
import { AuditSchedule } from '../types';
import { showToast } from '../components/Toast';
import { uid } from '../db';
import { incrementPendingSync } from '../syncQueue';

interface AuditScheduleViewProps {
  auditSchedules: AuditSchedule[];
  onBack: () => void;
  onRefreshData: () => void;
}

export function AuditScheduleView({
  auditSchedules,
  onBack,
  onRefreshData
}: AuditScheduleViewProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<AuditSchedule | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [cronExpression, setCronExpression] = useState('0 20 * * *'); // default daily 8 PM
  const [selectedTokens, setSelectedTokens] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true);

  // Token picker search
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'financial' | 'customer' | 'delay' | 'operational'>('all');

  // Definitions of 70 Smart Report Variables (Tokens) Grouped by Category
  const REPORT_TOKENS = [
    // 1. Financial (20 tokens)
    { id: 't_total_debts', category: 'financial', key: 'total_debts', label: 'إجمالي الديون القائمة في السوق', desc: 'مجموع المبالغ المتبقية في كافة العقود المفتوحة' },
    { id: 't_expected_monthly', category: 'financial', key: 'expected_monthly', label: 'المتوقع تحصيله شهرياً', desc: 'مجموع الأقساط الشهرية لكافة العقود النشطة' },
    { id: 't_total_profits_target', category: 'financial', key: 'total_profits_target', label: 'إجمالي أرباح المحفظة المستهدفة', desc: 'مجموع أرباح جميع العقود (سعر الأقساط - كاش)' },
    { id: 't_total_paid', category: 'financial', key: 'total_paid', label: 'إجمالي المبالغ المسددة فعلياً', desc: 'مجموع كل الدفعات المسجلة بالنظام تاريخياً' },
    { id: 't_cash_valuation', category: 'financial', key: 'cash_valuation', label: 'القيمة التقديرية الحاضرة للعقود', desc: 'مجموع السعر كاش لجميع السلع المباعة بالقسط' },
    { id: 't_installment_valuation', category: 'financial', key: 'installment_valuation', label: 'القيمة الكلية بالقسط للعقود', desc: 'مجموع أسعار الأقساط الكلية المسجلة' },
    { id: 't_paid_percentage', category: 'financial', key: 'paid_percentage', label: 'نسبة التحصيل الكلية للمحفظة', desc: 'النسبة المئوية للمدفوع من أصل إجمالي قيمة العقود' },
    { id: 't_remaining_percentage', category: 'financial', key: 'remaining_percentage', label: 'نسبة الديون المتبقية في السوق', desc: 'النسبة المئوية للمبالغ المتبقية من أصل العقود' },
    { id: 't_total_penalties_collected', category: 'financial', key: 'total_penalties_collected', label: 'إجمالي غرامات التأخير المحصلة', desc: 'مجموع المبالغ المدفوعة الإضافية كغرامات' },
    { id: 't_profits_realized', category: 'financial', key: 'profits_realized', label: 'الأرباح المحققة (المستلمة)', desc: 'نسبة الأرباح التي تم استلامها فعلياً مع الدفعات' },
    { id: 't_profits_outstanding', category: 'financial', key: 'profits_outstanding', label: 'الأرباح المعلقة (في السوق)', desc: 'أرباح مسجلة بالعقود ولم تسدد بعد' },
    { id: 't_average_contract_value', category: 'financial', key: 'avg_contract_val', label: 'متوسط قيمة العقد الواحد', desc: 'إجمالي قيمة العقود مقسوماً على عددها الكلي' },
    { id: 't_average_monthly_installment', category: 'financial', key: 'avg_monthly_installment', label: 'متوسط القسط الشهري للزبون', desc: 'متوسط الأقساط المفروضة شهرياً' },
    { id: 't_capital_in_circulation', category: 'financial', key: 'capital_circ', label: 'رأس المال المتداول الفعلي', desc: 'إجمالي الكاش المستثمر لشراء السلع المباعة' },
    { id: 't_projected_cash_flow_30d', category: 'financial', key: 'proj_flow_30d', label: 'التدفق المالي المتوقع لـ ٣٠ يوماً القادمة', desc: 'مجموع الأقساط المستحقة خلال الشهر الحالي' },
    { id: 't_projected_cash_flow_90d', category: 'financial', key: 'proj_flow_90d', label: 'التدفق المالي المتوقع لـ ٩٠ يوماً القادمة', desc: 'المتوقع تحصيله خلال ٣ أشهر القادمة' },
    { id: 't_safe_debt_ratio', category: 'financial', key: 'safe_debt_ratio', label: 'نسبة الديون الآمنة في السوق', desc: 'نسبة العقود المستمرة بالدفع بدون أي تأخير' },
    { id: 't_at_risk_debt_ratio', category: 'financial', key: 'at_risk_ratio', label: 'نسبة الديون المعرضة للمخاطر', desc: 'نسبة العقود المتأخرة لأكثر من ٦٠ يوماً' },
    { id: 't_total_discounts_given', category: 'financial', key: 'discounts_given', label: 'إجمالي الخصومات الممنوحة للزبائن', desc: 'التنزيلات الممنوحة عند التسديد المبكر الكاش' },
    { id: 't_monthly_growth_rate', category: 'financial', key: 'growth_rate', label: 'معدل نمو المبيعات الشهري', desc: 'نسبة زيادة قيمة العقود الجديدة مقارنة بالشهر السابق' },

    // 2. Customer Statistics (15 tokens)
    { id: 't_total_customers', category: 'customer', key: 'total_customers', label: 'إجمالي عدد الزبائن المسجلين', desc: 'العدد الكلي للزبائن النشطين وغير النشطين' },
    { id: 't_active_customers_count', category: 'customer', key: 'active_customers', label: 'عدد الزبائن النشطين (لديهم ديون)', desc: 'الزبائن الذين لديهم عقد متبقي واحد على الأقل' },
    { id: 't_settled_customers_count', category: 'customer', key: 'settled_customers', label: 'عدد الزبائن المسددين بالكامل', desc: 'زبائن مسجلين سددوا كافة عقودهم السابقة' },
    { id: 't_new_customers_this_month', category: 'customer', key: 'new_customers_30d', label: 'الزبائن الجدد المضافين هذا الشهر', desc: 'عدد الزبائن المضافين آخر ٣٠ يوماً' },
    { id: 't_average_contracts_per_customer', category: 'customer', key: 'avg_contracts_cust', label: 'معدل العقود لكل زبون', desc: 'مجموع العقود مقسوماً على مجموع الزبائن' },
    { id: 't_top_debtor_name', category: 'customer', key: 'top_debtor_name', label: 'اسم الزبون الأكثر مديونية', desc: 'صاحب أكبر مبلغ متبقي قائم حالياً في السوق' },
    { id: 't_top_debtor_balance', category: 'customer', key: 'top_debtor_balance', label: 'قيمة دين الزبون الأكثر مديونية', desc: 'رصيد المديونية الكلية لأكبر مدين' },
    { id: 't_most_committed_customer', category: 'customer', key: 'most_committed_customer', label: 'الزبون الأكثر التزاماً بالتسديد', desc: 'الزبون صاحب أكثر عدد دفعات متتالية بالموعد' },
    { id: 't_debt_free_growth', category: 'customer', key: 'debt_free_growth', label: 'معدل تخريج الزبائن من الديون', desc: 'عدد الزبائن الذين صفروا حساباتهم مؤخراً' },
    { id: 't_customer_retention_rate', category: 'customer', key: 'retention_rate', label: 'نسبة عودة الزبائن للشراء', desc: 'نسبة الزبائن الذين اشتروا للمرة الثانية أو أكثر' },
    { id: 't_workplaces_diversity', category: 'customer', key: 'work_diversity', label: 'تنوع دوائر العمل للزبائن', desc: 'عدد الدوائر أو الكفلاء المختلفين المسجلين' },
    { id: 't_trusted_tier_customers', category: 'customer', key: 'trusted_tier_count', label: 'عدد زبائن الفئة الموثوقة (أ)', desc: 'الزبائن الذين لم يتأخروا يوماً واحداً' },
    { id: 't_medium_tier_customers', category: 'customer', key: 'medium_tier_count', label: 'عدد زبائن الفئة المتوسطة (ب)', desc: 'الزبائن بتأخر بين ١ و ٣٠ يوماً' },
    { id: 't_blacklisted_customers', category: 'customer', key: 'blacklist_count', label: 'عدد زبائن القائمة السوداء (ج)', desc: 'الزبائن المتأخرين لأكثر من ٩٠ يوماً متواصلة' },
    { id: 't_average_payment_cycle_days', category: 'customer', key: 'avg_payment_cycle', label: 'متوسط دورة الدفع للزبائن (أيام)', desc: 'متوسط الفاصل الزمني الفعلي بين كل دفعة وأخرى' },

    // 3. Delay & Delinquency Statistics (15 tokens)
    { id: 't_total_delinquent_customers', category: 'delay', key: 'delinquent_customers_count', label: 'إجمالي عدد الزبائن المتأخرين', desc: 'عدد الزبائن الذين لديهم عقد متأخر ليوم واحد أو أكثر' },
    { id: 't_delinquent_contracts_count', category: 'delay', key: 'delinquent_contracts', label: 'عدد العقود المتأخرة حالياً', desc: 'العقود التي فات تاريخ استحقاق قسطها ولم تسدد' },
    { id: 't_total_overdue_days_sum', category: 'delay', key: 'overdue_days_sum', label: 'مجموع أيام التأخر التراكمي', desc: 'حاصل جمع أيام التأخير لكافة العقود المتأخرة' },
    { id: 't_average_overdue_days', category: 'delay', key: 'avg_overdue_days', label: 'متوسط أيام التأخر للعقد الواحد', desc: 'مجموع أيام التأخر مقسوماً على عدد العقود المتأخرة' },
    { id: 't_total_overdue_amount_now', category: 'delay', key: 'overdue_amount_now', label: 'إجمالي الأقساط المستحقة المتأخرة', desc: 'قيمة مبالغ الأقساط الشهرية التي تجاوزت موعدها' },
    { id: 't_delinquency_rate_value', category: 'delay', key: 'delinquency_rate', label: 'نسبة المديونية المتأخرة في السوق', desc: 'النسبة المئوية لقيمة الأقساط المتأخرة من الديون الكلية' },
    { id: 't_late_30d_count', category: 'delay', key: 'late_30d', label: 'عدد العقود المتأخرة لأكثر من ٣٠ يوماً', desc: 'عقود مبيعات تأخر سدادها بين ٣١ و ٦٠ يوماً' },
    { id: 't_late_60d_count', category: 'delay', key: 'late_60d', label: 'عدد العقود المتأخرة لأكثر من ٦٠ يوماً', desc: 'عقود مبيعات تأخر سدادها بين ٦١ و ٩٠ يوماً' },
    { id: 't_late_90d_count', category: 'delay', key: 'late_90d', label: 'عدد العقود الميؤوس منها (+٩٠ يوماً)', desc: 'الديون الميتة أو المعلقة لأكثر من ٣ أشهر' },
    { id: 't_worst_late_contract_name', category: 'delay', key: 'worst_late_contract', label: 'اسم العقد الأكثر تأخراً بالسوق', desc: 'العقد صاحب الرقم القياسي في أيام التأخير الفعلي' },
    { id: 't_worst_late_days_count', category: 'delay', key: 'worst_late_days', label: 'رقم التأخر القياسي (أيام)', desc: 'أقصى عدد أيام تأخر مسجل لعقد واحد نشط' },
    { id: 't_worst_late_customer_name', category: 'delay', key: 'worst_late_customer', label: 'اسم الزبون الأكثر تأخراً بالسوق', desc: 'صاحب العقد الأكثر تأخراً حالياً' },
    { id: 't_expected_penalties_projected', category: 'delay', key: 'projected_penalties', label: 'الغرامات المتراكمة المتوقع إضافتها', desc: 'المتوقع تجميعه كغرامات تأخير تراكمية' },
    { id: 't_collection_efficiency_ratio', category: 'delay', key: 'collection_efficiency', label: 'مؤشر كفاءة التحصيل السنوي', desc: 'معدل سداد الأقساط في تاريخ استحقاقها المجدول' },
    { id: 't_arrears_recovery_rate', category: 'delay', key: 'recovery_rate', label: 'معدل استرداد المديونيات المتأخرة', desc: 'نسبة نجاح تصفية الديون القديمة المتأخرة شهرياً' },

    // 4. Operational & Applet Stats (20 tokens)
    { id: 't_total_contracts_created', category: 'operational', key: 'contracts_count', label: 'إجمالي العقود المسجلة تاريخياً', desc: 'العدد الكلي للعقود النشطة والمسددة والمغلقة' },
    { id: 't_total_payments_recorded', category: 'operational', key: 'payments_count', label: 'إجمالي عدد عمليات الدفع تاريخياً', desc: 'العدد الكلي لعمليات استلام الكاش المسجلة' },
    { id: 't_database_size_records', category: 'operational', key: 'db_records_size', label: 'الحجم الكلي لسجلات قاعدة البيانات', desc: 'مجموع الصفوف المسجلة محلياً في IndexedDB' },
    { id: 't_pending_sync_count', category: 'operational', key: 'pending_sync_rows', label: 'عدد العمليات غير المتزامنة مع السيرفر', desc: 'التحديثات المحلية التي تنتظر الإرسال لقناة التليجرام' },
    { id: 't_last_successful_sync_time', category: 'operational', key: 'last_sync_timestamp', label: 'تاريخ آخر مزامنة ونسخ احتياطي ناجح', desc: 'توقيت آخر عملية اتصال ناجحة بالبوت والإنترنت' },
    { id: 't_last_backup_file_name', category: 'operational', key: 'last_backup_name', label: 'اسم ملف النسخة الاحتياطية الأخيرة', desc: 'اسم كود الحفظ المعتمد في السحابة ومحلياً' },
    { id: 't_device_platform_info', category: 'operational', key: 'platform_info', label: 'منصة ونوع جهاز التشغيل الحالي', desc: 'نظام تشغيل هاتف الفرع أو المتصفح النشط' },
    { id: 't_applet_version_build', category: 'operational', key: 'applet_version', label: 'إصدار نظام إدارة الأقساط الفرعي', desc: 'رقم إصدار البناء الحالي المدعوم بالـ PWA أوفلاين' },
    { id: 't_average_transaction_time_ms', category: 'operational', key: 'avg_tx_time', label: 'سرعة استجابة قاعدة البيانات (ملي ثانية)', desc: 'زمن إتمام قراءة وكتابة السجل محلياً بالملي ثانية' },
    { id: 't_total_templates_count', category: 'operational', key: 'templates_count', label: 'إجمالي عدد قوالب الرسائل المخصصة', desc: 'عدد القوالب التي تم تكوينها لإرسالها بالواتساب' },
    { id: 't_total_notification_rules_count', category: 'operational', key: 'rules_count', label: 'إجمالي عدد قواعد التنبيهات المفعّلة', desc: 'عدد قواعد الجدولة النشطة بالفرع حالياً' },
    { id: 't_daily_payments_count_today', category: 'operational', key: 'payments_today_count', label: 'عدد المقبوضات والدفعات اليوم', desc: 'عمليات الاستلام التي تم قيدها باليوم الحالي' },
    { id: 't_daily_payments_amount_today', category: 'operational', key: 'payments_today_amount', label: 'إجمالي المبالغ المستلمة اليوم', desc: 'مجموع المبالغ المقبوضة بالدينار العراقي لليوم' },
    { id: 't_weekly_payments_amount', category: 'operational', key: 'payments_weekly_amount', label: 'إجمالي المقبوضات خلال آخر ٧ أيام', desc: 'مجموع المبالغ المحصلة هذا الأسبوع' },
    { id: 't_monthly_payments_amount', category: 'operational', key: 'payments_monthly_amount', label: 'إجمالي المقبوضات خلال آخر ٣٠ يوماً', desc: 'مجموع المبالغ المحصلة هذا الشهر' },
    { id: 't_new_contracts_this_week', category: 'operational', key: 'contracts_new_7d', label: 'العقود الجديدة الموقعة هذا الأسبوع', desc: 'مبيعات الأقساط الجديدة لآخر ٧ أيام' },
    { id: 't_new_contracts_this_month', category: 'operational', key: 'contracts_new_30d', label: 'العقود الجديدة الموقعة هذا الشهر', desc: 'مبيعات الأقساط الجديدة لآخر ٣٠ يوماً' },
    { id: 't_average_new_contracts_daily', category: 'operational', key: 'contracts_new_avg_daily', label: 'معدل كتابة العقود اليومي بالفرع', desc: 'متوسط العقود اليومية الجديدة المسجلة بالنظام' },
    { id: 't_active_collaboration_users', category: 'operational', key: 'collab_users_count', label: 'عدد الأجهزة النشطة المرتبطة بالحساب', desc: 'عدد أجهزة الجباية والموظفين المتصلة بالفرع' },
    { id: 't_total_audit_schedules_count', category: 'operational', key: 'audit_schedules_count', label: 'إجمالي عدد تقارير الجرد المجدولة', desc: 'عدد مواعيد التقارير الكرونية النشطة' }
  ];

  const handleOpenAddModal = () => {
    setEditingSchedule(null);
    setName('');
    setCronExpression('0 20 * * *');
    setSelectedTokens(['total_debts', 'expected_monthly', 'total_paid', 'total_customers', 'delinquent_customers_count']);
    setIsActive(true);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (sch: AuditSchedule) => {
    setEditingSchedule(sch);
    setName(sch.name);
    setCronExpression(sch.cronExpression);
    setSelectedTokens(sch.reportVariables);
    setIsActive(sch.isActive);
    setIsModalOpen(true);
  };

  const handleSaveSchedule = () => {
    if (!name.trim() || !cronExpression.trim()) {
      showToast('يرجى إدخال اسم التقرير وتعبير الجدولة الكرونية', 'error');
      return;
    }
    if (selectedTokens.length === 0) {
      showToast('يرجى تحديد متغير تقرير واحد على الأقل ليتم تضمينه بالجرد', 'error');
      return;
    }

    const savedSchedules = [...auditSchedules];
    const sid = editingSchedule ? editingSchedule.id : 'sch-' + uid();

    const newSchedule: AuditSchedule = {
      id: sid,
      name: name.trim(),
      cronExpression: cronExpression.trim(),
      reportVariables: selectedTokens,
      isActive
    };

    if (editingSchedule) {
      const idx = savedSchedules.findIndex((s) => s.id === editingSchedule.id);
      if (idx !== -1) savedSchedules[idx] = newSchedule;
    } else {
      savedSchedules.push(newSchedule);
    }

    localStorage.setItem('faqar-audit-schedules-v1', JSON.stringify(savedSchedules));
    incrementPendingSync();
    showToast(editingSchedule ? 'تم حفظ تعديلات تقرير الجرد الدوري' : 'تم جدولة تقرير جرد دوري جديد بنجاح', 'success');
    setIsModalOpen(false);
    onRefreshData();
  };

  const handleDeleteSchedule = (id: string) => {
    const confirmDelete = window.confirm('هل أنت متأكد من حذف جدول الجرد التلقائي هذا؟');
    if (!confirmDelete) return;

    const filtered = auditSchedules.filter((s) => s.id !== id);
    localStorage.setItem('faqar-audit-schedules-v1', JSON.stringify(filtered));
    incrementPendingSync();
    showToast('تم حذف جدول الجرد الدوري بنجاح', 'success');
    onRefreshData();
  };

  const handleToggleToken = (tokenKey: string) => {
    if (selectedTokens.includes(tokenKey)) {
      setSelectedTokens(selectedTokens.filter((k) => k !== tokenKey));
    } else {
      setSelectedTokens([...selectedTokens, tokenKey]);
    }
  };

  const filteredTokens = REPORT_TOKENS.filter((t) => {
    const matchSearch = t.label.includes(searchQuery) || t.key.includes(searchQuery);
    const matchCat = activeCategory === 'all' || t.category === activeCategory;
    return matchSearch && matchCat;
  });

  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-12">
      {/* Back Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-amber-500 hover:text-amber-400 p-1 cursor-pointer">
          <ArrowRight className="w-6 h-6" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">جدولة تقارير الجرد الدوري (كرون)</h1>
          <p className="text-xs text-zinc-500 mt-0.5">تقارير جرد ذكية تُرسل تلقائياً لقناة التليجرام الخاص بك</p>
        </div>
      </div>

      {/* Telegram Connection Status Card */}
      <div className="p-5 rounded-3xl bg-[#121214]/60 border border-white/5 flex flex-col gap-3.5 text-right animate-fade-in" dir="rtl">
        <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold text-emerald-400">اتصال تيليجرام مفعل ونشط</span>
          </div>
          <span className="text-[9px] bg-emerald-500/10 text-emerald-400 font-bold px-2 py-0.5 rounded-full">آمن وتلقائي 🔐</span>
        </div>

        <div className="grid grid-cols-2 gap-y-3.5 gap-x-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-zinc-500 font-bold">اسم البوت (Bot Username)</span>
            <span className="text-xs font-mono font-bold text-amber-500">@Faqar_qst_tqrer_bot</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-zinc-500 font-bold">معرف الشات (Chat ID)</span>
            <span className="text-xs font-mono font-bold text-white">1155110938</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-zinc-500 font-bold">المستخدم المسجل</span>
            <span className="text-xs font-bold text-white">Faqar Alamshane (ar)</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-zinc-500 font-bold">ذكاء اصطناعي مدمج</span>
            <span className="text-xs font-bold text-zinc-400">DeepSeek & ChatGPT ✨</span>
          </div>
        </div>
      </div>

      {/* Schedules List Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-2">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-500" />
          <span>مواعيد الجرد الفعالة ({auditSchedules.length})</span>
        </h2>
        <button
          onClick={handleOpenAddModal}
          className="h-8 px-3 rounded-lg bg-amber-500 text-black hover:bg-amber-400 font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>إضافة جرد دوري</span>
        </button>
      </div>

      {/* Schedules List */}
      <div className="flex flex-col gap-4">
        {auditSchedules.map((s) => (
          <div
            key={s.id}
            className={`p-5 rounded-2xl border transition-all duration-200 ${
              s.isActive
                ? 'bg-[#121214]/60 border-white/5'
                : 'bg-[#121214]/20 border-white/5 opacity-60'
            }`}
          >
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <span className={`w-2.5 h-2.5 rounded-full ${s.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-600'}`} />
                <div className="flex flex-col text-right">
                  <span className="text-xs font-bold text-white">{s.name}</span>
                  <span className="text-[10px] text-zinc-500">
                    الجدولة (Cron): <code className="text-amber-400 select-all font-mono">{s.cronExpression}</code>
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenEditModal(s)}
                  className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 flex items-center justify-center cursor-pointer transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDeleteSchedule(s.id)}
                  className="w-8 h-8 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 flex items-center justify-center cursor-pointer transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* List of active tokens summary */}
            <div className="mt-4 pt-3 border-t border-white/5">
              <span className="text-[10px] font-semibold text-zinc-500 block mb-1.5">متغيرات الجرد المشمولة ({s.reportVariables.length}):</span>
              <div className="flex flex-wrap gap-1">
                {s.reportVariables.map((v) => (
                  <span
                    key={v}
                    className="text-[9px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/10"
                  >
                    {v}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add / Edit Schedule Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-[500px] bg-[#121214] border-t border-white/10 rounded-t-[24px] p-6 shadow-2xl animate-slide-up max-h-[92vh] overflow-y-auto flex flex-col gap-4">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">
                {editingSchedule ? 'تعديل جدول الجرد' : 'جدولة تقرير جرد كرون جديد'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/5 border border-white/5 flex items-center justify-center text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form fields */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-zinc-400">اسم التقرير المجدول *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: الجرد اليومي الختامي"
                  required
                  className="w-full h-10 px-3 rounded-xl bg-[#18181b] border border-white/5 text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/50 text-xs"
                />
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-zinc-400">تعبير كرون للجدولة (Cron Expression) *</label>
                  <span className="text-[9px] text-zinc-500 font-bold select-none">دقيقة • ساعة • يوم • شهر • أسبوع</span>
                </div>
                <input
                  type="text"
                  value={cronExpression}
                  onChange={(e) => setCronExpression(e.target.value)}
                  placeholder="مثال: 0 20 * * * (يومياً الساعة 8 مساءً)"
                  required
                  className="w-full h-10 px-3 rounded-xl bg-[#18181b] border border-white/5 text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/50 font-mono text-xs text-left"
                  dir="ltr"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-white/[0.01] border border-white/5 rounded-xl">
                <span className="text-xs font-semibold text-zinc-400">تفعيل الجدول التلقائي حالياً</span>
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

              {/* 70 Variable Picker Panel */}
              <div className="p-4 bg-zinc-950/40 border border-white/5 rounded-xl flex flex-col gap-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs font-bold text-amber-500">منتقي متغيرات الجرد السبعين ({selectedTokens.length} مختار)</span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ابحث بالمتغيرات..."
                    className="h-7 px-3 bg-[#18181b] border border-white/5 text-[9px] text-white rounded-lg w-1/2"
                  />
                </div>

                {/* Category tabs */}
                <div className="flex gap-1.5 overflow-x-auto scrollbar-none border-b border-white/5 pb-1 select-none">
                  {[
                    { id: 'all', label: 'الكل (٧٠)' },
                    { id: 'financial', label: 'المالي (٢٠)' },
                    { id: 'customer', label: 'الزبائن (١٥)' },
                    { id: 'delay', label: 'المتأخرين (١٥)' },
                    { id: 'operational', label: 'التشغيلي (٢٠)' }
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setActiveCategory(cat.id as any)}
                      className={`text-[9px] font-bold px-2.5 py-1 rounded-full transition-colors shrink-0 cursor-pointer ${
                        activeCategory === cat.id
                          ? 'bg-amber-500 text-black'
                          : 'bg-white/5 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                {/* Tokens library picker scroll */}
                <div className="max-h-[180px] overflow-y-auto flex flex-col gap-1.5 scrollbar-thin">
                  {filteredTokens.length === 0 ? (
                    <p className="text-center text-[10px] text-zinc-600 py-6">لا يوجد متغيرات تطابق معايير البحث</p>
                  ) : (
                    filteredTokens.map((tok) => {
                      const isSelected = selectedTokens.includes(tok.key);

                      return (
                        <div
                          key={tok.id}
                          onClick={() => handleToggleToken(tok.key)}
                          className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                            isSelected
                              ? 'bg-amber-500/10 border-amber-500/25'
                              : 'bg-black/20 border-white/5 hover:bg-black/40'
                          }`}
                        >
                          <div className="flex flex-col text-right pl-3">
                            <span className="text-[10px] font-bold text-zinc-200">{tok.label}</span>
                            <span className="text-[8px] text-zinc-500 font-medium leading-normal">{tok.desc}</span>
                          </div>
                          
                          <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                            isSelected
                              ? 'bg-amber-500 border-amber-500 text-black'
                              : 'border-white/10 text-transparent'
                          }`}>
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Save */}
              <button
                type="button"
                onClick={handleSaveSchedule}
                className="w-full h-11 bg-amber-500 text-black hover:bg-amber-400 font-bold rounded-xl flex items-center justify-center transition-colors cursor-pointer text-xs shadow-lg mt-1"
              >
                حفظ الجدولة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
