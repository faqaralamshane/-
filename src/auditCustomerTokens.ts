/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Customer, Contract, Payment } from './types';
import { fmtIQD, remainingForContract, totalPaidForContract, daysLate, profitForContract } from './finance';
import { GlobalContext, NOTIF_TOKENS, evaluateTokens } from './notifTokens';

export interface CustomerTokenDefinition {
  key: string;
  label: string;
  description: string;
  compute: (ctx: GlobalContext) => string;
}

export const CUSTOMER_TOKENS: CustomerTokenDefinition[] = [
  {
    key: 'قائمة_أعلى_5_ديناً',
    label: 'قائمة أعلى 5 زبائن ديناً',
    description: 'قائمة بأول 5 زبائن لديهم أكبر مبالغ ديون متبقية مرتبة تنازلياً',
    compute: (ctx) => {
      const list = ctx.customers
        .map((cust) => {
          const custContracts = ctx.contracts.filter((c) => c.customerId === cust.id);
          const debt = custContracts.reduce((sum, c) => sum + remainingForContract(c, ctx.payments), 0);
          return { name: cust.name, debt };
        })
        .filter((item) => item.debt > 0)
        .sort((a, b) => b.debt - a.debt)
        .slice(0, 5);

      if (list.length === 0) return 'لا يوجد';
      return list.map((item, idx) => `${idx + 1}. ${item.name} — ${fmtIQD(item.debt)}`).join('\n');
    }
  },
  {
    key: 'قائمة_أعلى_10_ديناً',
    label: 'قائمة أعلى 10 زبائن ديناً',
    description: 'قائمة بأول 10 زبائن لديهم أكبر مبالغ ديون متبقية مرتبة تنازلياً',
    compute: (ctx) => {
      const list = ctx.customers
        .map((cust) => {
          const custContracts = ctx.contracts.filter((c) => c.customerId === cust.id);
          const debt = custContracts.reduce((sum, c) => sum + remainingForContract(c, ctx.payments), 0);
          return { name: cust.name, debt };
        })
        .filter((item) => item.debt > 0)
        .sort((a, b) => b.debt - a.debt)
        .slice(0, 10);

      if (list.length === 0) return 'لا يوجد';
      return list.map((item, idx) => `${idx + 1}. ${item.name} — ${fmtIQD(item.debt)}`).join('\n');
    }
  },
  {
    key: 'قائمة_المتأخرين',
    label: 'قائمة المتأخرين بالترتيب',
    description: 'جميع الزبائن الذين لديهم أقساط متأخرة حالياً مرتبين من الأكثر تأخراً',
    compute: (ctx) => {
      const list: { name: string; maxDays: number; totalRemaining: number }[] = [];
      ctx.customers.forEach((cust) => {
        const custContracts = ctx.contracts.filter((c) => c.customerId === cust.id);
        let maxDays = 0;
        let totalRemaining = 0;
        custContracts.forEach((c) => {
          const late = daysLate(c, ctx.payments);
          if (late > 0) {
            maxDays = Math.max(maxDays, late);
            totalRemaining += remainingForContract(c, ctx.payments);
          }
        });
        if (maxDays > 0) {
          list.push({ name: cust.name, maxDays, totalRemaining });
        }
      });

      const sorted = list.sort((a, b) => b.maxDays - a.maxDays);
      if (sorted.length === 0) return 'لا يوجد';
      return sorted.map((item) => `• ${item.name} — متأخر ${item.maxDays} يوم بقيمة متبقية ${fmtIQD(item.totalRemaining)}`).join('\n');
    }
  },
  {
    key: 'قائمة_متأخرين_حرجين',
    label: 'قائمة المتأخرين الحرجين (+60 يوم)',
    description: 'الزبائن الذين تجاوز تأخرهم الـ 60 يوماً',
    compute: (ctx) => {
      const list: { name: string; maxDays: number; totalRemaining: number }[] = [];
      ctx.customers.forEach((cust) => {
        const custContracts = ctx.contracts.filter((c) => c.customerId === cust.id);
        let maxDays = 0;
        let totalRemaining = 0;
        custContracts.forEach((c) => {
          const late = daysLate(c, ctx.payments);
          if (late > 60) {
            maxDays = Math.max(maxDays, late);
            totalRemaining += remainingForContract(c, ctx.payments);
          }
        });
        if (maxDays > 60) {
          list.push({ name: cust.name, maxDays, totalRemaining });
        }
      });

      const sorted = list.sort((a, b) => b.maxDays - a.maxDays);
      if (sorted.length === 0) return 'لا يوجد زبائن بحالة حرجة حالياً ✓';
      return sorted.map((item) => `🚨 ${item.name} — متأخر ${item.maxDays} يوم! بقيمة متبقية ${fmtIQD(item.totalRemaining)}`).join('\n');
    }
  },
  {
    key: 'قائمة_مستحقات_اليوم',
    label: 'قائمة مستحقات اليوم',
    description: 'قائمة بالعقود النشطة المستحقة الدفع اليوم مع تفاصيل الزبون والسلعة',
    compute: (ctx) => {
      const todayDay = new Date().getDate();
      const list: string[] = [];
      ctx.contracts.forEach((c) => {
        const rem = remainingForContract(c, ctx.payments);
        if (rem > 0 && c.dueDay === todayDay) {
          const cust = ctx.customers.find((u) => u.id === c.customerId);
          const name = cust ? cust.name : 'مجهول';
          list.push(`• ${name} — ${c.itemName} (مطلوب قسط: ${fmtIQD(Math.min(c.monthlyInstallment, rem))})`);
        }
      });
      if (list.length === 0) return 'لا توجد مستحقات لهذا اليوم';
      return list.join('\n');
    }
  },
  {
    key: 'قائمة_مستحقات_غداً',
    label: 'قائمة مستحقات يوم غد',
    description: 'قائمة العقود المستحقة غداً للتحضير والتذكير المسبق',
    compute: (ctx) => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowDay = tomorrow.getDate();
      const list: string[] = [];
      ctx.contracts.forEach((c) => {
        const rem = remainingForContract(c, ctx.payments);
        if (rem > 0 && c.dueDay === tomorrowDay) {
          const cust = ctx.customers.find((u) => u.id === c.customerId);
          const name = cust ? cust.name : 'مجهول';
          list.push(`• ${name} — ${c.itemName} (مطلوب قسط: ${fmtIQD(Math.min(c.monthlyInstallment, rem))})`);
        }
      });
      if (list.length === 0) return 'لا توجد مستحقات ليوم غد';
      return list.join('\n');
    }
  },
  {
    key: 'قائمة_مستحقات_الأسبوع',
    label: 'قائمة مستحقات الأسبوع الحالي',
    description: 'العقود المستحقة في الأيام السبعة المقبلة',
    compute: (ctx) => {
      const today = new Date();
      const list: string[] = [];
      const activeContracts = ctx.contracts.filter((c) => remainingForContract(c, ctx.payments) > 0);
      
      for (let i = 0; i < 7; i++) {
        const testDate = new Date(today.getTime());
        testDate.setDate(today.getDate() + i);
        const testDay = testDate.getDate();
        const dateStr = testDate.toLocaleDateString('ar-IQ', { month: 'numeric', day: 'numeric' });
        
        activeContracts.forEach((c) => {
          if (c.dueDay === testDay) {
            const cust = ctx.customers.find((u) => u.id === c.customerId);
            const name = cust ? cust.name : 'مجهول';
            const rem = remainingForContract(c, ctx.payments);
            list.push(`• [يوم ${dateStr}] ${name} — ${c.itemName} (${fmtIQD(Math.min(c.monthlyInstallment, rem))})`);
          }
        });
      }
      if (list.length === 0) return 'لا توجد مستحقات خلال السبعة أيام القادمة';
      return list.join('\n');
    }
  },
  {
    key: 'قائمة_زبائن_جدد_الشهر',
    label: 'قائمة الزبائن المسجلين هذا الشهر',
    description: 'الزبائن الجدد الذين تم تسجيلهم في الشهر الجاري وتواريخ تسجيلهم',
    compute: (ctx) => {
      const start = new Date();
      start.setDate(1);
      start.setHours(0,0,0,0);
      const startMs = start.getTime();

      const list = ctx.customers
        .filter((c) => new Date(c.createdAt).getTime() >= startMs)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      if (list.length === 0) return 'لا يوجد زبائن جدد هذا الشهر';
      return list.map((c) => `• ${c.name} (تم التسجيل: ${new Date(c.createdAt).toLocaleDateString('ar-IQ')})`).join('\n');
    }
  },
  {
    key: 'قائمة_عقود_قاربت_الانتهاء',
    label: 'عقود شارف ديونها على الانتهاء',
    description: 'العقود التي يقل دينه المتبقي عن قيمة قسط واحد أو يساويه تمهيداً لإغلاقه',
    compute: (ctx) => {
      const list: string[] = [];
      ctx.contracts.forEach((c) => {
        const rem = remainingForContract(c, ctx.payments);
        if (rem > 0 && rem <= c.monthlyInstallment) {
          const cust = ctx.customers.find((u) => u.id === c.customerId);
          const name = cust ? cust.name : 'مجهول';
          list.push(`• ${name} — ${c.itemName} (متبقي فقط: ${fmtIQD(rem)} من أصل ${fmtIQD(c.installmentPrice)})`);
        }
      });
      if (list.length === 0) return 'لا يوجد عقود قريبة الانتهاء حالياً';
      return list.join('\n');
    }
  },
  {
    key: 'قائمة_عقود_جديدة_الشهر',
    label: 'العقود الجديدة المسجلة هذا الشهر',
    description: 'قائمة بالعقود المضافة هذا الشهر السلعة وقيمة القسط',
    compute: (ctx) => {
      const start = new Date();
      start.setDate(1);
      start.setHours(0,0,0,0);
      const startMs = start.getTime();

      const list = ctx.contracts
        .filter((c) => new Date(c.createdAt).getTime() >= startMs)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      if (list.length === 0) return 'لا توجد عقود جديدة تم إنشاؤها هذا الشهر';
      return list.map((c) => {
        const cust = ctx.customers.find((u) => u.id === c.customerId);
        const name = cust ? cust.name : 'مجهول';
        return `• ${name} — شراء ${c.itemName} بسعر ${fmtIQD(c.installmentPrice)} (قسطه ${fmtIQD(c.monthlyInstallment)})`;
      }).join('\n');
    }
  },
  {
    key: 'قائمة_أفضل_دافعين_الشهر',
    label: 'أفضل 5 زبائن سداداً هذا الشهر',
    description: 'أفضل 5 زبائن قاموا بأكبر مبالغ تسديد للأقساط خلال الشهر الحالي',
    compute: (ctx) => {
      const start = new Date();
      start.setDate(1);
      start.setHours(0,0,0,0);
      const startMs = start.getTime();

      const paymentMap = new Map<string, number>();
      ctx.payments
        .filter((p) => new Date(p.date).getTime() >= startMs)
        .forEach((p) => {
          const contract = ctx.contracts.find((c) => c.id === p.contractId);
          if (contract) {
            paymentMap.set(contract.customerId, (paymentMap.get(contract.customerId) || 0) + p.amount);
          }
        });

      const list = Array.from(paymentMap.entries())
        .map(([customerId, amount]) => {
          const cust = ctx.customers.find((u) => u.id === customerId);
          return { name: cust ? cust.name : 'مجهول', amount };
        })
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);

      if (list.length === 0) return 'لا توجد أي سدادات مسجلة هذا الشهر';
      return list.map((item, idx) => `⭐ ${idx + 1}. ${item.name} — إجمالي ما سدده: ${fmtIQD(item.amount)}`).join('\n');
    }
  },
  {
    key: 'قائمة_بدون_دفعات_30',
    label: 'زبائن مديونين لم يسددوا منذ 30 يوماً',
    description: 'الزبائن الذين في ذمتهم مبالغ ولم يقموا بأي تسديد في آخر 30 يوماً',
    compute: (ctx) => {
      const limitDate = new Date();
      limitDate.setDate(limitDate.getDate() - 30);
      const limitMs = limitDate.getTime();

      const list: string[] = [];
      ctx.customers.forEach((cust) => {
        const custContracts = ctx.contracts.filter((c) => c.customerId === cust.id);
        const debt = custContracts.reduce((sum, c) => sum + remainingForContract(c, ctx.payments), 0);
        if (debt > 0) {
          // Find if there is any payment in last 30 days
          const contractIds = custContracts.map((c) => c.id);
          const hasRecentPayment = ctx.payments.some((p) => {
            return contractIds.includes(p.contractId) && new Date(p.date).getTime() >= limitMs;
          });
          if (!hasRecentPayment) {
            list.push(`• ${cust.name} — إجمالي الدين: ${fmtIQD(debt)} (لم يسدد منذ أكثر من ٣٠ يوماً)`);
          }
        }
      });

      if (list.length === 0) return 'جميع الزبائن المديونين لديهم سدادات نشطة خلال ٣٠ يوماً ✓';
      return list.join('\n');
    }
  },
  {
    key: 'قائمة_زبائن_بدون_عقود',
    label: 'زبائن مسجلين بدون عقود نشطة',
    description: 'قائمة بالزبائن المسجلين والذين ليس لديهم أي عقود في النظام حالياً',
    compute: (ctx) => {
      const custWithContracts = new Set(ctx.contracts.map((c) => c.customerId));
      const list = ctx.customers.filter((c) => !custWithContracts.has(c.id));
      if (list.length === 0) return 'لا يوجد زبائن بدون عقود';
      return list.map((c) => `• ${c.name} (${c.phone})`).join('\n');
    }
  },
  {
    key: 'قائمة_أعلى_ربح_عقد',
    label: 'أعلى 5 عقود أرباحاً متوقعة',
    description: 'أعلى خمسة عقود مسجلة بالربح الناتج عن الفارق بين سعر القسط وسعر الحاضر',
    compute: (ctx) => {
      const list = [...ctx.contracts]
        .map((c) => {
          const cust = ctx.customers.find((u) => u.id === c.customerId);
          const profit = profitForContract(c);
          return { name: cust ? cust.name : 'مجهول', item: c.itemName, profit };
        })
        .sort((a, b) => b.profit - a.profit)
        .slice(0, 5);

      if (list.length === 0) return 'لا يوجد عقود';
      return list.map((item, idx) => `${idx + 1}. زبون: ${item.name} — سلعة: ${item.item} (الربح: ${fmtIQD(item.profit)})`).join('\n');
    }
  },
  {
    key: 'قائمة_آخر_5_دفعات',
    label: 'أحدث 5 دفعات مستلمة',
    description: 'أحدث 5 عمليات سداد تم إدخالها للنظام لجميع العقود والزبائن',
    compute: (ctx) => {
      const sorted = [...ctx.payments]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 5);

      if (sorted.length === 0) return 'لا توجد دفعات مسجلة بعد';
      return sorted.map((p) => {
        const contract = ctx.contracts.find((c) => c.id === p.contractId);
        const itemName = contract ? contract.itemName : 'سلعة مجهولة';
        const custName = contract ? (ctx.customers.find((u) => u.id === contract.customerId)?.name || 'مجهول') : 'مجهول';
        return `• [${new Date(p.date).toLocaleDateString('ar-IQ')}] ${custName} — سدّد ${fmtIQD(p.amount)} لقاء ${itemName}`;
      }).join('\n');
    }
  },
  {
    key: 'قائمة_عقود_متأخرة_مفصلة',
    label: 'قائمة العقود المتأخرة المفصلة',
    description: 'قائمة شاملة بجميع العقود المتأخرة بالاسم والسلعة وأيام التأخر والمتبقي',
    compute: (ctx) => {
      const list: string[] = [];
      ctx.contracts.forEach((c) => {
        const late = daysLate(c, ctx.payments);
        if (late > 0) {
          const cust = ctx.customers.find((u) => u.id === c.customerId);
          const name = cust ? cust.name : 'مجهول';
          const rem = remainingForContract(c, ctx.payments);
          list.push(`• ${name} — ${c.itemName} (متأخر ${late} يوم) — متبقي له: ${fmtIQD(rem)}`);
        }
      });
      if (list.length === 0) return 'لا يوجد عقود متأخرة حالياً ✓';
      return list.join('\n');
    }
  },
  {
    key: 'جهات_اتصال_المتأخرين',
    label: 'جهات اتصال زبائن الأقساط المتأخرة',
    description: 'قائمة بأرقام هواتف الزبائن المتأخرين وأيام التأخير للاتصال المباشر',
    compute: (ctx) => {
      const map = new Map<string, { phone: string; name: string; maxDays: number }>();
      ctx.contracts.forEach((c) => {
        const late = daysLate(c, ctx.payments);
        if (late > 0) {
          const cust = ctx.customers.find((u) => u.id === c.customerId);
          if (cust) {
            const existing = map.get(cust.id);
            map.set(cust.id, {
              name: cust.name,
              phone: cust.phone,
              maxDays: Math.max(existing?.maxDays || 0, late)
            });
          }
        }
      });

      const list = Array.from(map.values()).sort((a, b) => b.maxDays - a.maxDays);
      if (list.length === 0) return 'لا يوجد متأخرين حالياً للاتصال بهم';
      return list.map((item) => `• ${item.name} — هاتف: ${item.phone} (متأخر ${item.maxDays} يوم)`).join('\n');
    }
  },
  {
    key: 'جهات_اتصال_مستحقات_اليوم',
    label: 'جهات اتصال المستحقين اليوم للاتصال',
    description: 'هواتف وأسماء الزبائن المطالبين بأقساط اليوم',
    compute: (ctx) => {
      const todayDay = new Date().getDate();
      const map = new Map<string, { phone: string; name: string }>();
      ctx.contracts.forEach((c) => {
        const rem = remainingForContract(c, ctx.payments);
        if (rem > 0 && c.dueDay === todayDay) {
          const cust = ctx.customers.find((u) => u.id === c.customerId);
          if (cust) {
            map.set(cust.id, { name: cust.name, phone: cust.phone });
          }
        }
      });

      const list = Array.from(map.values());
      if (list.length === 0) return 'لا يوجد مستحقين اليوم للاتصال بهم';
      return list.map((item) => `• ${item.name} — هاتف: ${item.phone}`).join('\n');
    }
  },
  {
    key: 'زبون_مقترح_للاتصال',
    label: 'الزبون الأكثر أولوية للاتصال والمتابعة',
    description: 'حساب حاصل ضرب (أيام التأخر × المبلغ المتبقي) لتحديد الزبون الأكثر أولوية بالاتصال',
    compute: (ctx) => {
      let highestScore = -1;
      let worstCust: Customer | null = null;
      let worstDays = 0;
      let worstDebt = 0;

      ctx.customers.forEach((cust) => {
        const custContracts = ctx.contracts.filter((c) => c.customerId === cust.id);
        let maxDays = 0;
        let totalRemaining = 0;
        custContracts.forEach((c) => {
          const late = daysLate(c, ctx.payments);
          if (late > 0) {
            maxDays = Math.max(maxDays, late);
            totalRemaining += remainingForContract(c, ctx.payments);
          }
        });
        const score = maxDays * totalRemaining;
        if (score > highestScore) {
          highestScore = score;
          worstCust = cust;
          worstDays = maxDays;
          worstDebt = totalRemaining;
        }
      });

      if (!worstCust || highestScore <= 0) return 'لا يوجد زبائن متأخرين للاقتراح';
      return `📢 الزبون المقترح: ${(worstCust as Customer).name}\n📞 رقم الهاتف: ${(worstCust as Customer).phone}\n⏱️ متأخر ${worstDays} يوم\n💰 إجمالي الدين المتبقي: ${fmtIQD(worstDebt)}`;
    }
  },
  {
    key: 'قائمة_تنبيهات_حرجة',
    label: 'قائمة التنبيهات الحرجة ذات الأولوية المطلقة',
    description: 'ترتيب الزبائن تنازلياً حسب عامل الخطورة (الأيام × الدين) وعرض أعلى 5 حالات',
    compute: (ctx) => {
      const list: { name: string; phone: string; score: number; days: number; debt: number }[] = [];
      ctx.customers.forEach((cust) => {
        const custContracts = ctx.contracts.filter((c) => c.customerId === cust.id);
        let maxDays = 0;
        let totalRemaining = 0;
        custContracts.forEach((c) => {
          const late = daysLate(c, ctx.payments);
          if (late > 0) {
            maxDays = Math.max(maxDays, late);
            totalRemaining += remainingForContract(c, ctx.payments);
          }
        });
        const score = maxDays * totalRemaining;
        if (score > 0) {
          list.push({ name: cust.name, phone: cust.phone, score, days: maxDays, debt: totalRemaining });
        }
      });

      const sorted = list.sort((a, b) => b.score - a.score).slice(0, 5);
      if (sorted.length === 0) return 'النظام آمن ومستقر بالكامل ولا يوجد أي تنبيهات حرجة ✓';
      return sorted.map((item, idx) => {
        return `⚠️ [ترتيب ${idx + 1}] ${item.name} (${item.phone})\n   מתأخر ${item.days} يوم • متبقي له: ${fmtIQD(item.debt)} (مستوى الخطورة: ${new Intl.NumberFormat('ar-IQ').format(item.score)})`;
      }).join('\n');
    }
  }
];

export function evaluateAllTokens(text: string, ctx: GlobalContext): string {
  // 1. Evaluate general notification financial tokens (50 tokens)
  let rendered = evaluateTokens(text, ctx);

  // 2. Evaluate customer list tokens (20 tokens)
  CUSTOMER_TOKENS.forEach((t) => {
    const tokenRegex = new RegExp(`{{\\s*${t.key}\\s*}}`, 'g');
    rendered = rendered.replace(tokenRegex, t.compute(ctx));
  });

  return rendered;
}

// Function to substitute customer-specific tokens (Legacy & Smart)
// receives single customer context
export function evaluateCustomerSpecificTokens(
  body: string,
  customer: Customer,
  contracts: Contract[],
  payments: Payment[],
  selectedContract?: Contract,
  branchSettings?: { branchAddress: string; supportPhone: string; penaltyRate: number }
): string {
  const activeContracts = contracts.filter((c) => c.customerId === customer.id);
  const totalPaid = activeContracts.reduce((sum, c) => sum + totalPaidForContract(c, payments), 0);
  const totalRemaining = activeContracts.reduce((sum, c) => sum + remainingForContract(c, payments), 0);
  const totalInstallmentPrice = activeContracts.reduce((sum, c) => sum + c.installmentPrice, 0);
  const totalMonthly = activeContracts.reduce((sum, c) => {
    const rem = remainingForContract(c, payments);
    return sum + (rem > 0 ? c.monthlyInstallment : 0);
  }, 0);

  // Determine worst lateness
  let maxLate = 0;
  activeContracts.forEach((c) => {
    const late = daysLate(c, payments);
    maxLate = Math.max(maxLate, late);
  });

  const penaltyRate = branchSettings?.penaltyRate || 0;
  const monthsLate = Math.floor(maxLate / 30);
  const penaltyAmount = totalMonthly * (penaltyRate / 100) * monthsLate;

  // Selected contract helpers
  const currentContract = selectedContract || activeContracts[0];
  const contractPaid = currentContract ? totalPaidForContract(currentContract, payments) : 0;
  const contractRemaining = currentContract ? remainingForContract(currentContract, payments) : 0;
  const contractLate = currentContract ? daysLate(currentContract, payments) : 0;

  // Define values for matching
  const tokenMap: Record<string, string> = {
    client_name: customer.name,
    client_phone: customer.phone,
    client_first_name: customer.name.split(/\s+/)[0] || '',
    client_initials: customer.name.split(/\s+/).map(n => n[0]).join('.'),
    client_since_months: String(Math.max(1, Math.round((Date.now() - new Date(customer.createdAt).getTime()) / (1000 * 60 * 60 * 24 * 30.5)))),

    contract_id: currentContract?.id || '',
    contract_item: currentContract?.itemName || '',
    total_amount: currentContract ? fmtIQD(currentContract.installmentPrice) : fmtIQD(0),
    cash_price: currentContract ? fmtIQD(currentContract.cashPrice) : fmtIQD(0),
    profit_amount: fmtIQD(activeContracts.reduce((sum, c) => sum + (c.installmentPrice - c.cashPrice), 0)),
    installments_count: currentContract ? String(Math.ceil(currentContract.installmentPrice / currentContract.monthlyInstallment)) : '0',
    installments_paid: currentContract ? String(Math.floor(contractPaid / currentContract.monthlyInstallment)) : '0',
    installments_left: currentContract ? String(Math.max(0, Math.ceil(contractRemaining / currentContract.monthlyInstallment))) : '0',
    contract_progress_pct: currentContract ? `${Math.round((contractPaid / currentContract.installmentPrice) * 100)}%` : '0%',
    contract_status: contractRemaining === 0 ? 'منتهي' : contractLate > 0 ? 'متأخر' : 'منتظم',

    paid_amount: currentContract ? fmtIQD(contractPaid) : fmtIQD(0),
    remaining_balance: fmtIQD(totalRemaining),
    next_installment: fmtIQD(totalMonthly),
    last_payment_date: (() => {
      if (activeContracts.length === 0) return '—';
      const dates = payments
        .filter((p) => activeContracts.some((c) => c.id === p.contractId))
        .map((p) => new Date(p.date).getTime());
      if (dates.length === 0) return '—';
      return new Date(Math.max(...dates)).toLocaleDateString('ar-IQ');
    })(),
    last_payment_amount: (() => {
      const activeContractIds = activeContracts.map(c => c.id);
      const custPayments = payments.filter(p => activeContractIds.includes(p.contractId));
      if (custPayments.length === 0) return fmtIQD(0);
      const sorted = [...custPayments].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return fmtIQD(sorted[0].amount);
    })(),
    days_since_last_payment: (() => {
      const activeContractIds = activeContracts.map(c => c.id);
      const custPayments = payments.filter(p => activeContractIds.includes(p.contractId));
      if (custPayments.length === 0) return '—';
      const dates = custPayments.map((p) => new Date(p.date).getTime());
      const maxDate = Math.max(...dates);
      const diff = Date.now() - maxDate;
      return String(Math.floor(diff / (1000 * 60 * 60 * 24)));
    })(),
    payment_receipt_number: `INV-${customer.id.substring(customer.id.length - 6).toUpperCase()}-${String(payments.filter(p => activeContracts.some(c => c.id === p.contractId)).length + 1).padStart(3, '0')}`,

    days_late: String(maxLate),
    months_late: String(monthsLate),
    penalty_amount: fmtIQD(penaltyAmount),
    daily_penalty: fmtIQD(Math.round((totalMonthly * (penaltyRate / 100)) / 30)),
    lateness_tier_label: maxLate === 0 ? 'منتظم' : maxLate <= 30 ? 'بسيط' : maxLate <= 60 ? 'متوسط' : 'خطر للغاية',
    late_installments_count: String(monthsLate),
    suggested_min_payment: fmtIQD(penaltyAmount + totalMonthly * 0.5),
    legal_warning_stage: maxLate === 0 ? 'لا يوجد' : maxLate <= 30 ? 'إنذار أول' : maxLate <= 60 ? 'إنذار ثانٍ' : 'إنذار نهائي ومراجعة قانونية',

    total_due_now: fmtIQD(totalMonthly + penaltyAmount),
    next_payment_date: (() => {
      if (activeContracts.length === 0) return '—';
      const today = new Date();
      // Suggest next due date
      const nextDue = new Date(today.getFullYear(), today.getMonth(), Math.min(currentContract?.dueDay || 5, 28));
      if (today > nextDue) {
        nextDue.setMonth(nextDue.getMonth() + 1);
      }
      return nextDue.toLocaleDateString('ar-IQ');
    })(),
    days_until_due: (() => {
      if (activeContracts.length === 0) return '—';
      const today = new Date();
      today.setHours(0,0,0,0);
      const nextDue = new Date(today.getFullYear(), today.getMonth(), Math.min(currentContract?.dueDay || 5, 28));
      if (today > nextDue) {
        nextDue.setMonth(nextDue.getMonth() + 1);
      }
      return String(Math.max(0, Math.floor((nextDue.getTime() - today.getTime()) / 86400000)));
    })(),
    urgency_emoji: maxLate === 0 ? '🟢' : maxLate <= 30 ? '🟡' : maxLate <= 60 ? '🟠' : '🔴',
    expected_completion_date: (() => {
      if (totalMonthly <= 0) return '—';
      const monthsLeft = Math.ceil(totalRemaining / totalMonthly);
      const targetDate = new Date();
      targetDate.setMonth(targetDate.getMonth() + monthsLeft);
      return targetDate.toLocaleDateString('ar-IQ', { year: 'numeric', month: 'long' });
    })(),
    discount_if_full_pay: fmtIQD(Math.round(activeContracts.reduce((sum, c) => sum + (c.installmentPrice - c.cashPrice), 0) * 0.1)),
    installment_split_2: fmtIQD(Math.round(totalMonthly / 2)),
    installment_split_3: fmtIQD(Math.round(totalMonthly / 3)),
    weekly_saving_needed: fmtIQD(Math.round((totalMonthly + penaltyAmount) / 4)),
    daily_saving_needed: fmtIQD(Math.round((totalMonthly + penaltyAmount) / 30)),

    greeting: new Date().getHours() < 12 ? 'صباح الخير' : 'مساء الخير',
    hijri_date: new Date().toLocaleDateString('ar-SA-u-ca-islamic-umalqura'),
    current_date: new Date().toLocaleDateString('ar-IQ'),
    branch_address: branchSettings?.branchAddress || 'الفرع الرئيسي',
    support_phone: branchSettings?.supportPhone || '07827744096',

    hadith_debt: (() => {
      const hadiths = [
        '«نَفْسُ المؤمنِ مُعلَّقةٌ بدَيْنِهِ حتى يُقضى عنه»',
        '«مَطْلُ الغنيِّ ظُلمٌ، فإذا أُتبع أحدُكم على مليءٍ فليتبع»',
        '«الدَّينُ هَمٌّ بالليلِ وذُلٌّ بالنهار»',
        '«من استدان ديناً ونوى قضاءه أعانه الله عليه»'
      ];
      // pick deterministically by customerId length or similar hash
      const hash = customer.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      return hadiths[hash % hadiths.length];
    })(),
    quran_reminder: (() => {
      const ayahs = [
        '﴿وَأَوْفُوا بِالْعَهْدِ ۖ إِنَّ الْعَهْدَ كَانَ مَسْئُولًا﴾',
        '﴿يَا أَيُّهَا الَّذِينَ آمَنُوا أَوْفُوا بِالْعُقُودِ﴾',
        '﴿وَإِن كَانَ ذُو عُسْرَةٍ فَنَظِرَةٌ إِلَىٰ مَيْسَرَةٍ﴾'
      ];
      const hash = customer.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      return ayahs[hash % ayahs.length];
    })(),
    dua_facilitation: 'اللهم اكفني بحلالك عن حرامك، وأغنني بفضلك عمن سواك.',
    reward_message: 'شكراً لالتزامك الرائع 🌟 التسديد في وقته بركة — نقدّر تعاونك 🤝',
    wa_map_link: branchSettings?.branchAddress 
      ? `https://maps.google.com/?q=${encodeURIComponent(branchSettings.branchAddress)}` 
      : '—'
  };

  // legacy mapping
  const legacyMap: Record<string, string> = {
    'اسم_الزبون': customer.name,
    'رقم_الهاتف': customer.phone,
    'المبلغ_المتبقي': fmtIQD(totalRemaining),
    'المبلغ_المدفوع': fmtIQD(totalPaid),
    'القسط_الشهري': fmtIQD(totalMonthly),
    'تاريخ_اليوم': new Date().toLocaleDateString('ar-IQ'),
    'عدد_العقود': String(activeContracts.length),
    'اسم_السلعة': currentContract?.itemName || '',
    'قسط_العقد': currentContract ? fmtIQD(currentContract.monthlyInstallment) : fmtIQD(0),
    'متبقي_العقد': currentContract ? fmtIQD(contractRemaining) : fmtIQD(0),
    'مدفوع_العقد': currentContract ? fmtIQD(contractPaid) : fmtIQD(0),
    'سعر_القسط': currentContract ? fmtIQD(currentContract.installmentPrice) : fmtIQD(0),
    'سعر_الحاضر': currentContract ? fmtIQD(currentContract.cashPrice) : fmtIQD(0),
    'يوم_الاستحقاق': currentContract ? String(currentContract.dueDay) : '',
    'ايام_التاخير': String(contractLate)
  };

  let rendered = body;

  // Replace modern tokens
  Object.keys(tokenMap).forEach((key) => {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
    rendered = rendered.replace(regex, tokenMap[key]);
  });

  // Replace legacy Arabic tokens
  Object.keys(legacyMap).forEach((key) => {
    // Both standard curly and simple text replacements if users forgot double brackets
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
    rendered = rendered.replace(regex, legacyMap[key]);
    const simpleRegex = new RegExp(`{${key}}`, 'g');
    rendered = rendered.replace(simpleRegex, legacyMap[key]);
  });

  return rendered;
}
