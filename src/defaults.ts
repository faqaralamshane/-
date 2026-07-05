/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Template, NotificationRule, AuditSchedule, BranchSettings } from './types';
import { defaultFriendlyReminder, defaultStatementMessage, defaultOverdueMessage2, defaultOverdueMessage3 } from './messages';

export const DEFAULT_TEMPLATES: Template[] = [
  {
    id: 'tpl-friendly',
    name: 'تذكير ودّي بالقسط',
    placement: 'floating',
    style: 'tint',
    color: 'success',
    icon: 'MessageCircle',
    body: defaultFriendlyReminder
  },
  {
    id: 'tpl-statement',
    name: 'كشف حساب زبون',
    placement: 'profile_top',
    style: 'outline',
    color: 'primary',
    icon: 'FileText',
    body: defaultStatementMessage
  },
  {
    id: 'tpl-overdue2',
    name: 'تنبيه شهرين متأخرة',
    placement: 'defaulters_row',
    style: 'solid',
    color: 'warning',
    icon: 'AlertTriangle',
    body: defaultOverdueMessage2,
    minDaysLate: 31,
    maxDaysLate: 60
  },
  {
    id: 'tpl-overdue3',
    name: 'تنبيه ٣ أشهر متأخرة',
    placement: 'defaulters_row',
    style: 'solid',
    color: 'danger',
    icon: 'AlertTriangle',
    body: defaultOverdueMessage3,
    minDaysLate: 61
  }
];

export const DEFAULT_NOTIFICATION_RULES: NotificationRule[] = [
  {
    id: 'rule-debt-limit',
    name: 'تنبيه ارتفاع الديون الكلية',
    title: 'تنبيه ارتفاع الديون الكلية',
    body: 'تنبيه! بلغ إجمالي الديون في السوق {{إجمالي_الديون}}، يرجى تشديد عمليات التحصيل والمتابعة.',
    group: 'audit',
    time: '20:00',
    level: 'critical',
    days: [],
    enabled: true,
    triggerType: 'daysLate',
    daysValue: 10,
    templateId: 'tpl-friendly',
    isActive: true
  },
  {
    id: 'rule-low-collection',
    name: 'تنبيه ضعف تحصيل الشهر',
    title: 'تنبيه ضعف تحصيل الشهر',
    body: 'متابعة الأداء: نسبة تحصيل الأقساط للشهر الحالي بلغت {{نسبة_تحصيل_الشهر}} فقط حتى الآن والمبلغ المحصل هو {{المحصل_هذا_الشهر}}.',
    group: 'collection',
    time: '18:00',
    level: 'warn',
    days: [4], // Thursday
    enabled: true,
    triggerType: 'daysBefore',
    daysValue: 3,
    templateId: 'tpl-friendly',
    isActive: true
  },
  {
    id: 'rule-late-count',
    name: 'تنبيه زيادة عدد المتأخرين',
    title: 'تنبيه زيادة عدد المتأخرين',
    body: 'تنبيه هام: يوجد حالياً {{عدد_المتأخرين}} عقد متأخر في السوق بإجمالي مبالغ متأخرة تصل إلى {{مبلغ_المتأخرين}}.',
    group: 'contracts',
    time: '11:00',
    level: 'critical',
    days: [0, 2], // Sunday, Tuesday
    enabled: true,
    triggerType: 'paymentMissed',
    daysValue: 5,
    templateId: 'tpl-overdue2',
    isActive: true
  }
];

export const DEFAULT_AUDIT_SCHEDULES: AuditSchedule[] = [
  {
    id: 'sched-daily-audit',
    name: 'الجرد المالي الشامل اليومي',
    enabled: true,
    time: '21:00',
    frequency: 'daily',
    body: `📊 *تقرير الجرد المالي الشامل*
📅 اليوم: {{اليوم}} — {{التاريخ}}
⏱️ الوقت: {{الوقت_الآن}}

👥 الزبائن والنشاط:
• إجمالي عدد الزبائن: {{عدد_الزبائن}} (النشطون منهم: {{زبائن_نشطون}})
• إجمالي العقود: {{عدد_العقود}} (عقود نشطة: {{عقود_نشطة}})

💰 المحصل المالي:
• محصل اليوم: {{المحصل_اليوم}}
• محصل الأسبوع: {{المحصل_هذا_الأسبوع}}
• محصل الشهر الحالي: {{المحصل_هذا_الشهر}}
• نسبة التحصيل الحالية: {{نسبة_تحصيل_الشهر}}

📉 الديون والمتأخرين:
• إجمالي ديون السوق: {{إجمالي_الديون}}
• عدد المتأخرين: {{عدد_المتأخرين}} (مبلغ المتأخرات: {{مبلغ_المتأخرين}})
• نسبة المتأخرين من النشطين: {{نسبة_المتأخرين}}

📈 الأرباح المقدرة:
• أرباح العقود النشطة: {{أرباح_العقود_النشطة}}
• أرباح العقود المغلقة: {{أرباح_العقود_المنتهية}}
• إجمالي الأرباح المستهدفة: {{إجمالي_الأرباح_المتوقعة}}
• هامش الربح الإجمالي: {{هامش_الربح}}`,
    createdAt: new Date().toISOString(),
    cronExpression: '0 21 * * *',
    reportVariables: ['total_debts', 'expected_monthly', 'total_paid', 'total_customers', 'delinquent_customers_count'],
    isActive: true
  },
  {
    id: 'sched-today-due',
    name: 'تذكير مستحقات اليوم',
    enabled: true,
    time: '09:00',
    frequency: 'daily',
    body: `⏰ *تذكير يومي بمستحقات اليوم*
📅 تاريخ اليوم: {{التاريخ}}

📋 العقود المستحقة الدفع اليوم:
{{قائمة_مستحقات_اليوم}}

📋 جهات الاتصال المطلوبة للمتابعة اليوم:
{{جهات_اتصال_مستحقات_اليوم}}`,
    createdAt: new Date().toISOString(),
    cronExpression: '0 9 * * *',
    reportVariables: ['total_debts', 'expected_monthly'],
    isActive: true
  },
  {
    id: 'sched-critical-defaulters',
    name: 'تنبيه المتأخرين الحرجين الدوري',
    enabled: true,
    time: '10:00',
    frequency: 'weekly',
    days: [0, 3], // Sunday and Wednesday
    body: `🚨 *تقرير المتأخرين ذوي الأولوية والخطورة القصوى*
📅 اليوم: {{اليوم}}

🔍 إحصائيات المتأخرين:
• عدد المتأخرين الإجمالي: {{عدد_المتأخرين}}
• إجمالي مبلغ المتأخرات: {{مبلغ_المتأخرين}}

🎯 قائمة التنبيهات الأكثر خطورة (ترتيب الأولوية):
{{قائمة_تنبيهات_حرجة}}

💡 مقترح التواصل المباشر الآلي:
{{زبون_مقترح_للاتصال}}`,
    createdAt: new Date().toISOString(),
    cronExpression: '0 10 * * 0,3',
    reportVariables: ['total_debts', 'delinquent_customers_count', 'worst_late_days'],
    isActive: true
  }
];

export const DEFAULT_BRANCH_SETTINGS: BranchSettings = {
  branchAddress: 'العراق، بغداد، شارع الصناعة',
  supportPhone: '07827744096',
  penaltyRate: 5 // 5% monthly penalty rate
};

export function initializeDefaultsIfEmpty(): void {
  if (!localStorage.getItem('faqar-message-templates-v1')) {
    localStorage.setItem('faqar-message-templates-v1', JSON.stringify(DEFAULT_TEMPLATES));
  }
  if (!localStorage.getItem('faqar-notification-rules-v1')) {
    localStorage.setItem('faqar-notification-rules-v1', JSON.stringify(DEFAULT_NOTIFICATION_RULES));
  }
  if (!localStorage.getItem('faqar-audit-schedules-v1')) {
    localStorage.setItem('faqar-audit-schedules-v1', JSON.stringify(DEFAULT_AUDIT_SCHEDULES));
  }
  if (!localStorage.getItem('faqar-branch-settings-v1')) {
    localStorage.setItem('faqar-branch-settings-v1', JSON.stringify(DEFAULT_BRANCH_SETTINGS));
  }
}
