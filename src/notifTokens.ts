/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Customer, Contract, Payment } from './types';
import { fmtIQD, remainingForContract, totalPaidForContract, daysLate, profitForContract } from './finance';

export interface GlobalContext {
  customers: Customer[];
  contracts: Contract[];
  payments: Payment[];
}

function getStartOfDay(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// Start of week: Saturday (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
// Saturday is 6.
function getStartOfWeek(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  // Saturday is index 6. Sunday is 0.
  // Sunday (0): diff = 1 (to prev Sat)
  // Monday (1): diff = 2
  // ...
  // Saturday (6): diff = 0
  const diff = (day + 1) % 7;
  d.setDate(d.getDate() - diff);
  return d;
}

function getStartOfMonth(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getStartOfYear(): Date {
  const d = new Date();
  d.setMonth(0, 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getPercent(part: number, whole: number): string {
  if (whole <= 0) return '0%';
  return Math.round((part / whole) * 100) + '%';
}

export interface TokenDefinition {
  key: string;
  label: string;
  category: 'time' | 'customers' | 'contracts' | 'debt' | 'collection' | 'lateness' | 'profit';
  description: string;
  compute: (ctx: GlobalContext) => string | number;
}

export const NOTIF_TOKENS: TokenDefinition[] = [
  // 1. TIME
  {
    key: 'التاريخ',
    label: 'تاريخ اليوم',
    category: 'time',
    description: 'تاريخ اليوم الحالي بتنسيق YYYY-MM-DD',
    compute: () => new Date().toISOString().split('T')[0]
  },
  {
    key: 'اليوم',
    label: 'اسم اليوم',
    category: 'time',
    description: 'اسم اليوم الحالي باللغة العربية (مثلاً: السبت)',
    compute: () => new Date().toLocaleDateString('ar-IQ', { weekday: 'long' })
  },
  {
    key: 'الشهر',
    label: 'اسم الشهر',
    category: 'time',
    description: 'اسم الشهر الحالي باللغة العربية (مثلاً: تموز)',
    compute: () => new Date().toLocaleDateString('ar-IQ', { month: 'long' })
  },
  {
    key: 'السنة',
    label: 'السنة الحالية',
    category: 'time',
    description: 'السنة الحالية المكونة من 4 أرقام',
    compute: () => new Date().getFullYear().toString()
  },
  {
    key: 'الوقت_الآن',
    label: 'الوقت الحالي',
    category: 'time',
    description: 'الوقت الحالي بتنسيق 24 ساعة (HH:MM)',
    compute: () => {
      const now = new Date();
      return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    }
  },

  // 2. CUSTOMERS
  {
    key: 'عدد_الزبائن',
    label: 'إجمالي عدد الزبائن',
    category: 'customers',
    description: 'إجمالي عدد الزبائن المسجلين في النظام',
    compute: (ctx) => ctx.customers.length
  },
  {
    key: 'زبائن_جدد_هذا_الشهر',
    label: 'الزبائن الجدد هذا الشهر',
    category: 'customers',
    description: 'عدد الزبائن الذين تم تسجيلهم منذ بداية الشهر الحالي',
    compute: (ctx) => {
      const start = getStartOfMonth().getTime();
      return ctx.customers.filter((c) => new Date(c.createdAt).getTime() >= start).length;
    }
  },
  {
    key: 'زبائن_جدد_هذا_الأسبوع',
    label: 'الزبائن الجدد هذا الأسبوع',
    category: 'customers',
    description: 'عدد الزبائن الذين تم تسجيلهم منذ يوم السبت الماضي',
    compute: (ctx) => {
      const start = getStartOfWeek().getTime();
      return ctx.customers.filter((c) => new Date(c.createdAt).getTime() >= start).length;
    }
  },
  {
    key: 'زبائن_نشطون',
    label: 'عدد الزبائن النشطين',
    category: 'customers',
    description: 'عدد الزبائن الذين لديهم عقد نشط واحد على الأقل (متبقي > 0)',
    compute: (ctx) => {
      const activeIds = new Set<string>();
      ctx.contracts.forEach((c) => {
        if (remainingForContract(c, ctx.payments) > 0) {
          activeIds.add(c.customerId);
        }
      });
      return activeIds.size;
    }
  },
  {
    key: 'زبائن_بدون_عقود',
    label: 'الزبائن بدون عقود',
    category: 'customers',
    description: 'عدد الزبائن المسجلين وليس لديهم أي عقود في النظام',
    compute: (ctx) => {
      const custWithContracts = new Set(ctx.contracts.map((c) => c.customerId));
      return ctx.customers.filter((c) => !custWithContracts.has(c.id)).length;
    }
  },
  {
    key: 'زبائن_متأخرون',
    label: 'عدد الزبائن المتأخرين',
    category: 'customers',
    description: 'عدد الزبائن الذين لديهم عقد واحد على الأقل متأخر (أيام التأخير > 0)',
    compute: (ctx) => {
      const lateIds = new Set<string>();
      ctx.contracts.forEach((c) => {
        if (daysLate(c, ctx.payments) > 0) {
          lateIds.add(c.customerId);
        }
      });
      return lateIds.size;
    }
  },
  {
    key: 'أعلى_زبون_ديناً',
    label: 'أعلى زبون ديناً في السوق',
    category: 'customers',
    description: 'اسم الزبون ومجموع دينه المتبقي',
    compute: (ctx) => {
      if (ctx.customers.length === 0) return 'لا يوجد';
      let maxDebt = -1;
      let worstCustName = 'لا يوجد';
      ctx.customers.forEach((cust) => {
        const custContracts = ctx.contracts.filter((c) => c.customerId === cust.id);
        const debt = custContracts.reduce((sum, c) => sum + remainingForContract(c, ctx.payments), 0);
        if (debt > maxDebt) {
          maxDebt = debt;
          worstCustName = cust.name;
        }
      });
      return maxDebt > 0 ? `${worstCustName} (${fmtIQD(maxDebt)})` : 'لا يوجد';
    }
  },
  {
    key: 'متوسط_دين_الزبون',
    label: 'متوسط دين الزبون الواحد',
    category: 'customers',
    description: 'إجمالي الديون مقسوماً على إجمالي عدد الزبائن',
    compute: (ctx) => {
      if (ctx.customers.length === 0) return fmtIQD(0);
      const totalDebt = ctx.contracts.reduce((sum, c) => sum + remainingForContract(c, ctx.payments), 0);
      return fmtIQD(totalDebt / ctx.customers.length);
    }
  },

  // 3. CONTRACTS
  {
    key: 'عدد_العقود',
    label: 'إجمالي عدد العقود',
    category: 'contracts',
    description: 'إجمالي عدد العقود المسجلة في النظام',
    compute: (ctx) => ctx.contracts.length
  },
  {
    key: 'عقود_نشطة',
    label: 'عدد العقود النشطة',
    category: 'contracts',
    description: 'عدد العقود التي لم تسدد بالكامل بعد (متبقي > 0)',
    compute: (ctx) => ctx.contracts.filter((c) => remainingForContract(c, ctx.payments) > 0).length
  },
  {
    key: 'عقود_منتهية',
    label: 'عدد العقود المنتهية',
    category: 'contracts',
    description: 'عدد العقود التي تم سداد قيمتها بالكامل (متبقي = 0)',
    compute: (ctx) => ctx.contracts.filter((c) => remainingForContract(c, ctx.payments) === 0).length
  },
  {
    key: 'عقود_جديدة_هذا_الشهر',
    label: 'العقود الجديدة هذا الشهر',
    category: 'contracts',
    description: 'عدد العقود المضافة منذ بداية الشهر الحالي',
    compute: (ctx) => {
      const start = getStartOfMonth().getTime();
      return ctx.contracts.filter((c) => new Date(c.createdAt).getTime() >= start).length;
    }
  },
  {
    key: 'متوسط_قيمة_العقد',
    label: 'متوسط قيمة العقد بالقسط',
    category: 'contracts',
    description: 'إجمالي قيمة العقود بالقسط مقسوماً على عددها',
    compute: (ctx) => {
      if (ctx.contracts.length === 0) return fmtIQD(0);
      const totalVal = ctx.contracts.reduce((sum, c) => sum + c.installmentPrice, 0);
      return fmtIQD(totalVal / ctx.contracts.length);
    }
  },
  {
    key: 'أعلى_عقد_قيمة',
    label: 'أعلى قيمة عقد مسجل',
    category: 'contracts',
    description: 'أعلى سعر بالقسط لعقد في النظام',
    compute: (ctx) => {
      if (ctx.contracts.length === 0) return fmtIQD(0);
      const vals = ctx.contracts.map((c) => c.installmentPrice);
      return fmtIQD(Math.max(...vals));
    }
  },
  {
    key: 'أدنى_عقد_قيمة',
    label: 'أدنى قيمة عقد مسجل',
    category: 'contracts',
    description: 'أدنى سعر بالقسط لعقد في النظام',
    compute: (ctx) => {
      if (ctx.contracts.length === 0) return fmtIQD(0);
      const vals = ctx.contracts.map((c) => c.installmentPrice);
      return fmtIQD(Math.min(...vals));
    }
  },
  {
    key: 'إجمالي_الأقساط_الشهرية',
    label: 'إجمالي الاستحقاق الشهري',
    category: 'contracts',
    description: 'مجموع الأقساط الشهرية المطلوبة من العقود النشطة',
    compute: (ctx) => {
      const total = ctx.contracts
        .filter((c) => remainingForContract(c, ctx.payments) > 0)
        .reduce((sum, c) => {
          const rem = remainingForContract(c, ctx.payments);
          return sum + Math.min(c.monthlyInstallment, rem);
        }, 0);
      return fmtIQD(total);
    }
  },
  {
    key: 'عقود_مستحقة_اليوم',
    label: 'العقود المستحقة اليوم',
    category: 'contracts',
    description: 'عدد العقود النشطة التي يوم استحقاقها هو اليوم',
    compute: (ctx) => {
      const day = new Date().getDate();
      return ctx.contracts.filter((c) => {
        return remainingForContract(c, ctx.payments) > 0 && c.dueDay === day;
      }).length;
    }
  },
  {
    key: 'عقود_مستحقة_هذا_الأسبوع',
    label: 'عقود مستحقة في الـ 7 أيام القادمة',
    category: 'contracts',
    description: 'عدد العقود النشطة المستحقة خلال الأيام السبعة المقبلة',
    compute: (ctx) => {
      const today = new Date();
      const activeContracts = ctx.contracts.filter((c) => remainingForContract(c, ctx.payments) > 0);
      let count = 0;
      for (let i = 0; i < 7; i++) {
        const testDate = new Date(today.getTime());
        testDate.setDate(today.getDate() + i);
        const testDay = testDate.getDate();
        count += activeContracts.filter((c) => c.dueDay === testDay).length;
      }
      return count;
    }
  },

  // 4. DEBT
  {
    key: 'إجمالي_الديون',
    label: 'إجمالي الديون في السوق',
    category: 'debt',
    description: 'مجموع المبالغ المتبقية في ذمة جميع الزبائن',
    compute: (ctx) => {
      const total = ctx.contracts.reduce((sum, c) => sum + remainingForContract(c, ctx.payments), 0);
      return fmtIQD(total);
    }
  },
  {
    key: 'ديون_عقود_نشطة',
    label: 'ديون العقود النشطة',
    category: 'debt',
    description: 'مجموع الديون المتبقية للعقود النشطة فقط',
    compute: (ctx) => {
      const total = ctx.contracts
        .filter((c) => remainingForContract(c, ctx.payments) > 0)
        .reduce((sum, c) => sum + remainingForContract(c, ctx.payments), 0);
      return fmtIQD(total);
    }
  },
  {
    key: 'متوسط_الدين_المتبقي',
    label: 'متوسط الدين المتبقي للعقد',
    category: 'debt',
    description: 'إجمالي المبالغ المتبقية مقسوماً على عدد العقود النشطة',
    compute: (ctx) => {
      const activeContracts = ctx.contracts.filter((c) => remainingForContract(c, ctx.payments) > 0);
      if (activeContracts.length === 0) return fmtIQD(0);
      const total = activeContracts.reduce((sum, c) => sum + remainingForContract(c, ctx.payments), 0);
      return fmtIQD(total / activeContracts.length);
    }
  },
  {
    key: 'أعلى_دين_متبقي',
    label: 'أعلى دين متبقي لعقد واحد',
    category: 'debt',
    description: 'أعلى مبلغ متبقي لعقد نشط وحيد في السوق',
    compute: (ctx) => {
      const activeContracts = ctx.contracts.filter((c) => remainingForContract(c, ctx.payments) > 0);
      if (activeContracts.length === 0) return fmtIQD(0);
      const remainingVals = activeContracts.map((c) => remainingForContract(c, ctx.payments));
      return fmtIQD(Math.max(...remainingVals));
    }
  },
  {
    key: 'نسبة_السداد',
    label: 'نسبة سداد الديون الكلية',
    category: 'debt',
    description: 'النسبة المئوية للمبالغ المسددة من إجمالي قيمة المبيعات',
    compute: (ctx) => {
      const totalValue = ctx.contracts.reduce((sum, c) => sum + c.installmentPrice, 0);
      const totalPaid = ctx.payments.reduce((sum, p) => sum + p.amount, 0);
      return getPercent(totalPaid, totalValue);
    }
  },
  {
    key: 'نسبة_الديون_من_المبيعات',
    label: 'نسبة الديون المتبقية',
    category: 'debt',
    description: 'النسبة المئوية للديون المتبقية من إجمالي قيمة المبيعات',
    compute: (ctx) => {
      const totalValue = ctx.contracts.reduce((sum, c) => sum + c.installmentPrice, 0);
      const totalDebt = ctx.contracts.reduce((sum, c) => sum + remainingForContract(c, ctx.payments), 0);
      return getPercent(totalDebt, totalValue);
    }
  },
  {
    key: 'المتوقع_تحصيله_الشهر',
    label: 'المتوقع تحصيله هذا الشهر',
    category: 'debt',
    description: 'إجمالي قيمة الأقساط الشهرية المطلوبة هذا الشهر',
    compute: (ctx) => {
      const total = ctx.contracts
        .filter((c) => remainingForContract(c, ctx.payments) > 0)
        .reduce((sum, c) => {
          const rem = remainingForContract(c, ctx.payments);
          return sum + Math.min(c.monthlyInstallment, rem);
        }, 0);
      return fmtIQD(total);
    }
  },

  // 5. COLLECTION
  {
    key: 'المحصل_اليوم',
    label: 'المحصل المالي اليوم',
    category: 'collection',
    description: 'مجموع المبالغ التي تم تحصيلها منذ بداية اليوم',
    compute: (ctx) => {
      const start = getStartOfDay().getTime();
      const total = ctx.payments
        .filter((p) => new Date(p.date).getTime() >= start)
        .reduce((sum, p) => sum + p.amount, 0);
      return fmtIQD(total);
    }
  },
  {
    key: 'المحصل_هذا_الأسبوع',
    label: 'المحصل المالي هذا الأسبوع',
    category: 'collection',
    description: 'مجموع المبالغ المحصلة منذ يوم السبت الماضي',
    compute: (ctx) => {
      const start = getStartOfWeek().getTime();
      const total = ctx.payments
        .filter((p) => new Date(p.date).getTime() >= start)
        .reduce((sum, p) => sum + p.amount, 0);
      return fmtIQD(total);
    }
  },
  {
    key: 'المحصل_هذا_الشهر',
    label: 'المحصل المالي هذا الشهر',
    category: 'collection',
    description: 'مجموع المبالغ المحصلة منذ بداية الشهر الحالي',
    compute: (ctx) => {
      const start = getStartOfMonth().getTime();
      const total = ctx.payments
        .filter((p) => new Date(p.date).getTime() >= start)
        .reduce((sum, p) => sum + p.amount, 0);
      return fmtIQD(total);
    }
  },
  {
    key: 'المحصل_هذه_السنة',
    label: 'المحصل المالي هذه السنة',
    category: 'collection',
    description: 'مجموع المبالغ المحصلة منذ بداية السنة الميلادية الحالية',
    compute: (ctx) => {
      const start = getStartOfYear().getTime();
      const total = ctx.payments
        .filter((p) => new Date(p.date).getTime() >= start)
        .reduce((sum, p) => sum + p.amount, 0);
      return fmtIQD(total);
    }
  },
  {
    key: 'نسبة_تحصيل_الشهر',
    label: 'نسبة تحصيل الشهر المستهدفة',
    category: 'collection',
    description: 'النسبة المئوية للمحصل هذا الشهر مقارنة بإجمالي الأقساط المطلوبة',
    compute: (ctx) => {
      const target = ctx.contracts
        .filter((c) => remainingForContract(c, ctx.payments) > 0)
        .reduce((sum, c) => {
          const rem = remainingForContract(c, ctx.payments);
          return sum + Math.min(c.monthlyInstallment, rem);
        }, 0);
      
      const start = getStartOfMonth().getTime();
      const gotThisMonth = ctx.payments
        .filter((p) => new Date(p.date).getTime() >= start)
        .reduce((sum, p) => sum + p.amount, 0);

      return getPercent(gotThisMonth, target);
    }
  },
  {
    key: 'عدد_الدفعات_اليوم',
    label: 'عدد دفعات اليوم المسجلة',
    category: 'collection',
    description: 'عدد عمليات الدفع التي تم تسجيلها اليوم',
    compute: (ctx) => {
      const start = getStartOfDay().getTime();
      return ctx.payments.filter((p) => new Date(p.date).getTime() >= start).length;
    }
  },
  {
    key: 'عدد_الدفعات_الشهر',
    label: 'عدد دفعات الشهر الحالية',
    category: 'collection',
    description: 'عدد عمليات الدفع المسجلة منذ بداية الشهر الحالي',
    compute: (ctx) => {
      const start = getStartOfMonth().getTime();
      return ctx.payments.filter((p) => new Date(p.date).getTime() >= start).length;
    }
  },
  {
    key: 'متوسط_الدفعة',
    label: 'متوسط مبلغ الدفعة الواحدة',
    category: 'collection',
    description: 'مجموع الدفعات مقسوماً على عدد عمليات السداد',
    compute: (ctx) => {
      if (ctx.payments.length === 0) return fmtIQD(0);
      const total = ctx.payments.reduce((sum, p) => sum + p.amount, 0);
      return fmtIQD(total / ctx.payments.length);
    }
  },

  // 6. LATENESS
  {
    key: 'عدد_المتأخرين',
    label: 'عدد العقود المتأخرة',
    category: 'lateness',
    description: 'عدد العقود النشطة التي تجاوزت موعد استحقاقها بنصف يوم على الأقل',
    compute: (ctx) => ctx.contracts.filter((c) => daysLate(c, ctx.payments) > 0).length
  },
  {
    key: 'متأخرون_أقل_30',
    label: 'متأخرون (1 إلى 30 يوم)',
    category: 'lateness',
    description: 'عدد العقود المتأخرة من يوم وحتى ثلاثين يوماً',
    compute: (ctx) => ctx.contracts.filter((c) => {
      const late = daysLate(c, ctx.payments);
      return late > 0 && late <= 30;
    }).length
  },
  {
    key: 'متأخرون_30_60',
    label: 'متأخرون (31 إلى 60 يوم)',
    category: 'lateness',
    description: 'عدد العقود المتأخرة من 31 يوم وحتى 60 يوماً',
    compute: (ctx) => ctx.contracts.filter((c) => {
      const late = daysLate(c, ctx.payments);
      return late > 30 && late <= 60;
    }).length
  },
  {
    key: 'متأخرون_فوق_60',
    label: 'متأخرون (أكثر من 60 يوم)',
    category: 'lateness',
    description: 'عدد العقود المتأخرة لأكثر من 60 يوماً (حالة حرجة)',
    compute: (ctx) => ctx.contracts.filter((c) => daysLate(c, ctx.payments) > 60).length
  },
  {
    key: 'أطول_تأخير_أيام',
    label: 'أطول فترة تأخير بالأيام',
    category: 'lateness',
    description: 'أقصى عدد أيام تأخر لعقد نشط في النظام',
    compute: (ctx) => {
      const lateVals = ctx.contracts.map((c) => daysLate(c, ctx.payments));
      return lateVals.length > 0 ? Math.max(...lateVals) : 0;
    }
  },
  {
    key: 'مبلغ_المتأخرين',
    label: 'إجمالي مبالغ العقود المتأخرة',
    category: 'lateness',
    description: 'مجموع المبالغ المتبقية للعقود المتأخرة فقط',
    compute: (ctx) => {
      const total = ctx.contracts
        .filter((c) => daysLate(c, ctx.payments) > 0)
        .reduce((sum, c) => sum + remainingForContract(c, ctx.payments), 0);
      return fmtIQD(total);
    }
  },
  {
    key: 'نسبة_المتأخرين',
    label: 'نسبة العقود المتأخرة من النشطة',
    category: 'lateness',
    description: 'النسبة المئوية للعقود المتأخرة مقارنة بإجمالي العقود النشطة',
    compute: (ctx) => {
      const activeCount = ctx.contracts.filter((c) => remainingForContract(c, ctx.payments) > 0).length;
      const lateCount = ctx.contracts.filter((c) => daysLate(c, ctx.payments) > 0).length;
      return getPercent(lateCount, activeCount);
    }
  },

  // 7. PROFIT
  {
    key: 'أرباح_العقود_النشطة',
    label: 'أرباح العقود النشطة المتوقعة',
    category: 'profit',
    description: 'مجموع هامش الأرباح للعقود الفعالة حالياً',
    compute: (ctx) => {
      const total = ctx.contracts
        .filter((c) => remainingForContract(c, ctx.payments) > 0)
        .reduce((sum, c) => sum + profitForContract(c), 0);
      return fmtIQD(total);
    }
  },
  {
    key: 'أرباح_العقود_المنتهية',
    label: 'الأرباح المحققة من العقود المنتهية',
    category: 'profit',
    description: 'مجموع هامش الأرباح للعقود التي تم سدادها بالكامل',
    compute: (ctx) => {
      const total = ctx.contracts
        .filter((c) => remainingForContract(c, ctx.payments) === 0)
        .reduce((sum, c) => sum + profitForContract(c), 0);
      return fmtIQD(total);
    }
  },
  {
    key: 'إجمالي_الأرباح_المتوقعة',
    label: 'إجمالي الأرباح الكلية المستهدفة',
    category: 'profit',
    description: 'مجموع الأرباح لجميع العقود المسجلة بالكامل (نشطة + منتهية)',
    compute: (ctx) => {
      const total = ctx.contracts.reduce((sum, c) => sum + profitForContract(c), 0);
      return fmtIQD(total);
    }
  },
  {
    key: 'متوسط_ربح_العقد',
    label: 'متوسط ربح العقد الواحد',
    category: 'profit',
    description: 'إجمالي الأرباح المستهدفة مقسوماً على إجمالي عدد العقود',
    compute: (ctx) => {
      if (ctx.contracts.length === 0) return fmtIQD(0);
      const total = ctx.contracts.reduce((sum, c) => sum + profitForContract(c), 0);
      return fmtIQD(total / ctx.contracts.length);
    }
  },
  {
    key: 'هامش_الربح',
    label: 'نسبة هامش الربح الإجمالي',
    category: 'profit',
    description: 'النسبة المئوية للأرباح من إجمالي قيمة المبيعات',
    compute: (ctx) => {
      const totalValue = ctx.contracts.reduce((sum, c) => sum + c.installmentPrice, 0);
      const totalProfit = ctx.contracts.reduce((sum, c) => sum + profitForContract(c), 0);
      return getPercent(totalProfit, totalValue);
    }
  }
];

export function evaluateTokens(text: string, ctx: GlobalContext): string {
  let rendered = text;
  NOTIF_TOKENS.forEach((t) => {
    // Escape regex characters just in case
    const tokenRegex = new RegExp(`{{\\s*${t.key}\\s*}}`, 'g');
    rendered = rendered.replace(tokenRegex, String(t.compute(ctx)));
  });
  return rendered;
}
