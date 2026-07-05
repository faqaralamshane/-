/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Contract, Payment } from './types';

export function fmtIQD(n: number): string {
  return new Intl.NumberFormat('ar-IQ').format(Math.round(n)) + ' د.ع';
}

export function totalPaidForContract(c: Contract, payments: Payment[]): number {
  return payments
    .filter((p) => p.contractId === c.id)
    .reduce((sum, p) => sum + p.amount, 0);
}

export function remainingForContract(c: Contract, payments: Payment[]): number {
  return Math.max(0, c.installmentPrice - totalPaidForContract(c, payments));
}

export function profitForContract(c: Contract): number {
  return c.installmentPrice - c.cashPrice;
}

export function lastPaymentDate(cid: string, payments: Payment[]): string | null {
  const contractPayments = payments.filter((p) => p.contractId === cid);
  if (contractPayments.length === 0) return null;
  // Sort descending by date
  const sorted = [...contractPayments].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return sorted[0].date;
}

export function daysLate(c: Contract, payments: Payment[]): number {
  const remaining = remainingForContract(c, payments);
  if (remaining <= 0) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const due = new Date(today.getFullYear(), today.getMonth(), Math.min(c.dueDay, 28));
  due.setHours(0, 0, 0, 0);

  if (today < due) {
    // If today is before due day of this month, let's see if we missed previous month
    // But the formula requested is: "if today < due: return 0"
    // Let's follow it literally:
    return 0;
  }

  const last = lastPaymentDate(c.id, payments);
  if (last) {
    const lastDate = new Date(last);
    lastDate.setHours(0, 0, 0, 0);
    if (lastDate >= due) return 0;
  }

  const diffTime = today.getTime() - due.getTime();
  return Math.max(0, Math.floor(diffTime / 86400000));
}

export type LatenessTier = 'ok' | 'soft' | 'orange' | 'red';

export function latenessTier(days: number): LatenessTier {
  if (days <= 0) return 'ok';
  if (days <= 30) return 'soft';
  if (days <= 60) return 'orange';
  return 'red';
}
