/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Customer, Contract, Payment } from './types';
import { openDB } from './db';

const SEED_PHONE = '07827744096';

function getRelativeDateString(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString();
}

export function seedDatabaseIfEmpty(): Promise<boolean> {
  return openDB().then((db) => {
    return new Promise<boolean>((resolve, reject) => {
      const tx = db.transaction(['customers', 'contracts', 'payments'], 'readonly');
      const store = tx.objectStore('customers');
      const countReq = store.count();

      countReq.onsuccess = () => {
        if (countReq.result > 0) {
          // Already has data, skip seeding
          resolve(false);
          return;
        }

        // Proceed to seed
        performSeed(db).then(() => resolve(true)).catch(reject);
      };

      countReq.onerror = () => reject(countReq.error);
    });
  });
}

function performSeed(db: IDBDatabase): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(['customers', 'contracts', 'payments'], 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);

    const customerStore = tx.objectStore('customers');
    const contractStore = tx.objectStore('contracts');
    const paymentStore = tx.objectStore('payments');

    // 1. Create Customers
    const customers: Customer[] = [
      {
        id: 'cust-ali',
        name: 'علي حسن الموسوي',
        phone: SEED_PHONE,
        notes: 'زبون منتظم وملتزم بالسداد',
        createdAt: getRelativeDateString(180),
        accessCode: '4321'
      },
      {
        id: 'cust-hayder',
        name: 'حيدر كاظم العبودي',
        phone: SEED_PHONE,
        notes: 'متأخر شهر واحد حالياً بانتظار الاتصال به',
        createdAt: getRelativeDateString(120),
        accessCode: '7890'
      },
      {
        id: 'cust-mohammed',
        name: 'محمد جواد الساعدي',
        phone: SEED_PHONE,
        notes: 'متأخر شهرين - يحتاج متابعة جادة وغرامة تأخيرية',
        createdAt: getRelativeDateString(200),
        accessCode: '5566'
      },
      {
        id: 'cust-ahmed',
        name: 'أحمد عبد الزهرة',
        phone: SEED_PHONE,
        notes: 'ملتزم جداً، العقد قارب على الانتهاء',
        createdAt: getRelativeDateString(330),
        accessCode: '2024'
      },
      {
        id: 'cust-karrar',
        name: 'كرار فاضل الحسيني',
        phone: SEED_PHONE,
        notes: 'عقدين فعّالين في نفس الوقت',
        createdAt: getRelativeDateString(90),
        accessCode: '1122'
      }
    ];

    customers.forEach((c) => customerStore.put(c));

    // 2. Create Contracts
    const today = new Date();
    const currentDueDay = today.getDate();

    const contracts: Contract[] = [
      {
        id: 'cont-ali-fridge',
        customerId: 'cust-ali',
        itemName: 'ثلاجة LG 18 قدم',
        dueDay: currentDueDay, // due today
        cashPrice: 700000,
        installmentPrice: 900000,
        monthlyInstallment: 75000,
        notes: 'ضمان سنة كاملة مع التوصيل',
        createdAt: getRelativeDateString(180)
      },
      {
        id: 'cont-hayder-washer',
        customerId: 'cust-hayder',
        itemName: 'غسالة سامسونغ 12 كغم',
        dueDay: 5,
        cashPrice: 550000,
        installmentPrice: 720000,
        monthlyInstallment: 60000,
        notes: 'ضمان تشغيل وملاحظة كارت الضمان',
        createdAt: getRelativeDateString(120)
      },
      {
        id: 'cont-mohammed-tv',
        customerId: 'cust-mohammed',
        itemName: 'تلفزيون سوني 65 بوصة',
        dueDay: 10,
        cashPrice: 900000,
        installmentPrice: 1200000,
        monthlyInstallment: 100000,
        notes: 'جهاز ذكي 4K مع ستاند جداري',
        createdAt: getRelativeDateString(200)
      },
      {
        id: 'cont-ahmed-iphone',
        customerId: 'cust-ahmed',
        itemName: 'موبايل آيفون 15',
        dueDay: 20,
        cashPrice: 1500000,
        installmentPrice: 1800000,
        monthlyInstallment: 150000,
        notes: 'اللون التيتانيوم الطبيعي، سعة 256 جيجا',
        createdAt: getRelativeDateString(330)
      },
      {
        id: 'cont-karrar-ac',
        customerId: 'cust-karrar',
        itemName: 'مكيف هايسنس 1.5 طن',
        dueDay: 15,
        cashPrice: 600000,
        installmentPrice: 780000,
        monthlyInstallment: 65000,
        notes: 'روتري حار بارد',
        createdAt: getRelativeDateString(90)
      },
      {
        id: 'cont-karrar-oven',
        customerId: 'cust-karrar',
        itemName: 'فرن غازي بفك',
        dueDay: 25,
        cashPrice: 350000,
        installmentPrice: 450000,
        monthlyInstallment: 45000,
        notes: 'تركي أصلي 4 عيون شواية دوارة',
        createdAt: getRelativeDateString(90)
      }
    ];

    contracts.forEach((c) => contractStore.put(c));

    // 3. Create Payments
    const payments: Payment[] = [
      // Ali: 3 payments, latest is 5 days ago
      {
        id: 'pay-ali-1',
        contractId: 'cont-ali-fridge',
        amount: 75000,
        date: getRelativeDateString(65),
        notes: 'القسط الأول'
      },
      {
        id: 'pay-ali-2',
        contractId: 'cont-ali-fridge',
        amount: 75000,
        date: getRelativeDateString(35),
        notes: 'القسط الثاني'
      },
      {
        id: 'pay-ali-3',
        contractId: 'cont-ali-fridge',
        amount: 75000,
        date: getRelativeDateString(5),
        notes: 'القسط الثالث - سداد يدوي بالفرع'
      },

      // Hayder: latest payment is 35 days ago (1 payment)
      {
        id: 'pay-hayder-1',
        contractId: 'cont-hayder-washer',
        amount: 60000,
        date: getRelativeDateString(35),
        notes: 'القسط الأول - متأخر عن موعده'
      },

      // Mohammed Jawad: latest payment is 65 days ago (1 payment)
      {
        id: 'pay-mohammed-1',
        contractId: 'cont-mohammed-tv',
        amount: 100000,
        date: getRelativeDateString(65),
        notes: 'قسط الشهر الأول'
      },

      // Ahmed: 10 installments (10 * 150k = 1,500k) at relative 30-day intervals
      ...Array.from({ length: 10 }).map((_, i) => {
        const index = i + 1; // 1 to 10
        return {
          id: `pay-ahmed-${index}`,
          contractId: 'cont-ahmed-iphone',
          amount: 150000,
          date: getRelativeDateString((11 - index) * 30),
          notes: `القسط رقم ${index}`
        };
      }),

      // Karrar - AC Contract: paid 2 payments: 10 days ago and 40 days ago
      {
        id: 'pay-karrar-ac-1',
        contractId: 'cont-karrar-ac',
        amount: 65000,
        date: getRelativeDateString(40),
        notes: 'قسط الأول مكيف'
      },
      {
        id: 'pay-karrar-ac-2',
        contractId: 'cont-karrar-ac',
        amount: 65000,
        date: getRelativeDateString(10),
        notes: 'قسط الثاني مكيف'
      },

      // Karrar - Oven Contract: paid 1 payment: 40 days ago
      {
        id: 'pay-karrar-oven-1',
        contractId: 'cont-karrar-oven',
        amount: 45000,
        date: getRelativeDateString(40),
        notes: 'دفعة أولى فرن'
      }
    ];

    payments.forEach((p) => paymentStore.put(p));
  });
}
