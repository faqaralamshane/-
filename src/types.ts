/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Customer {
  id: string;
  name: string;
  phone: string;
  notes?: string;
  createdAt: string; // ISO date-time
  accessCode?: string; // Automatically generated 4-6 digit or short passcode
  loginDisabled?: boolean;
}

export interface Contract {
  id: string;
  customerId: string;
  itemName: string;
  dueDay: number; // 1..31
  cashPrice: number;
  installmentPrice: number;
  monthlyInstallment: number;
  notes?: string;
  createdAt: string; // ISO date-time
}

export interface Payment {
  id: string;
  contractId: string;
  date: string; // ISO date-time or YYYY-MM-DD
  amount: number;
  notes?: string;
}

export interface Template {
  id: string;
  name: string;
  placement: 'profile_top' | 'profile_bottom' | 'contract_card' | 'defaulters_row' | 'customer_list_row' | 'payment_success' | 'floating';
  style: 'tint' | 'solid' | 'outline' | 'gradient' | 'glass' | 'pill' | 'icon_only';
  color: 'primary' | 'success' | 'warning' | 'danger';
  icon: string; // e.g., MessageCircle, Bell
  body: string;
  minDaysLate?: number;
  maxDaysLate?: number;
  minRemaining?: number;
  hoursFrom?: number;
  hoursTo?: number;
  days?: number[]; // 0..6
  compact?: boolean;
}

export interface NotificationRule {
  id: string;
  title?: string;
  name: string;
  body?: string;
  group?: 'audit' | 'collection' | 'contracts';
  time?: string; // HH:MM
  level?: 'info' | 'warn' | 'critical';
  days?: number[]; // 0..6 (empty = all days)
  enabled?: boolean;
  triggerType: 'daysBefore' | 'daysLate' | 'contractCreated' | 'paymentMissed';
  daysValue: number;
  templateId: string;
  isActive: boolean;
}

export interface AuditSchedule {
  id: string;
  name: string;
  enabled?: boolean;
  time?: string; // HH:MM
  frequency?: 'daily' | 'weekly' | 'monthly' | 'once' | 'hourly';
  days?: number[]; // 0..6 for weekly
  dayOfMonth?: number; // 1..28 for monthly
  date?: string; // YYYY-MM-DD for once
  everyHours?: number; // 1..24 for hourly
  body?: string;
  lastSent?: string; // ISO or date string
  createdAt?: string;
  cronExpression: string;
  reportVariables: string[];
  isActive: boolean;
}

export interface BranchSettings {
  branchAddress: string;
  supportPhone: string;
  penaltyRate: number; // percentage
}

export interface DebtPayment {
  id: string;
  date: string;
  amount: number;
  notes?: string;
}

export interface DebtTransaction {
  id: string;
  type: 'purchase' | 'payment'; // 'purchase' = شراء بدين جديد (red circle), 'payment' = تسديد جزئي (green circle)
  date: string;
  amount: number;
  notes?: string;
  createdAt: string;
}

export interface DebtNotification {
  id: string;
  debtId: string;
  type: 'reminder' | 'report' | 'action';
  title: string;
  body: string;
  status: 'active' | 'disabled' | 'hidden';
  createdAt: string;
}

export interface Debt {
  id: string;
  personName: string;
  phone?: string;
  type: 'to_me' | 'by_me'; // 'to_me' = I am owed (أطلبه دين), 'by_me' = I owe (يطلبني دين)
  totalAmount: number;
  paidAmount: number;
  dueDate?: string; // YYYY-MM-DD
  status: 'pending' | 'partially_paid' | 'paid' | 'overdue';
  priority: 'low' | 'medium' | 'high' | 'critical';
  notes?: string;
  createdAt: string; // ISO date-time
  updatedAt: string; // ISO date-time
  payments?: DebtPayment[]; // legacy fallback
  transactions?: DebtTransaction[]; // detailed ledger (purchases & payments)
  notifications?: DebtNotification[]; // custom templates/alerts
  monthlyPurchaseLimit?: number; // الميزانية التقديرية للشراء الشهري
  targetMonthlyPayment?: number; // المبلغ المطلوب تسديده كل شهر لكي لا يبقى علي دين
  lastPurchaseDate?: string; // تاريخ آخر شراء
  lastPurchaseAmount?: number; // مبلغ آخر شراء
}

// === Salaf Feature Interfaces ===

export interface SalafMember {
  id: string;
  name: string;
  phone: string;
  isReceiver: boolean; // هل استلم السلفة؟
  receiveMonthIndex?: number; // رقم الشهر الذي استلم فيه السلفة (1-indexed)
  receiveDate?: string; // تاريخ الاستلام
  notes?: string;
  createdAt: string;
}

export interface SalafPayment {
  id: string;
  memberId: string;
  monthIndex: number; // رقم الشهر المدفوع له (1 to monthsCount)
  date: string; // YYYY-MM-DD
  amount: number;
  isPaidByMe: boolean; // أنا دفعت بدلاً عنه
  notes?: string;
  createdAt: string;
}

export interface Salaf {
  id: string;
  name: string;
  totalAmount: number; // قيمة السلفة الكلية (e.g. 10,000,000)
  monthlyAmount: number; // مبلغ القسط الشهري (e.g. 500,000)
  monthsCount: number; // عدد الأشهر / الأسهم (e.g. 20)
  startDate: string; // تاريخ الانطلاق YYYY-MM-DD
  notes?: string;
  createdAt: string;
  members: SalafMember[];
  payments: SalafPayment[];
}

export interface FinancialAccount {
  id: string;
  name: string;
  balance: number;
  currency: 'IQD' | 'USD';
  color: string;
  icon: string;
  createdAt: string;
}

export interface FinancialTransaction {
  id: string;
  accountId: string;
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  description: string;
  category: string;
  date: string;
  transferToAccountId?: string;
  createdAt: string;
}

export interface FinancialSettings {
  showSystemStats: boolean;
  showBudgetsList: boolean;
  showTransactionsList: boolean;
  showReports: boolean;
  hideZeroBalanceAccounts: boolean;
}

export interface CustomPage {
  id: string;
  title: string;
  visibilityCondition: 'always' | 'admin' | 'has_contracts' | 'custom_expr';
  customExpression?: string;
  position: 'top' | 'bottom' | 'left' | 'right';
  layout: 'dropdown' | 'full';
  embeddedBlocks: string[]; // ['stats', 'salafs', 'wallets', 'recent_actions', 'debts', 'customer_details', 'whatsapp_sender']
  builderBlocks?: any[];
  isActive: boolean;
  createdAt: string;
}

export interface MessageTemplate {
  id: string;
  title: string;
  type: 'whatsapp' | 'alert' | 'notification' | 'report' | 'block';
  content: string;
  triggerCondition: string; // e.g. "delay > 5 days", "always"
  activeDays: string[]; // e.g. ['Saturday', 'Sunday']
  targetPage: string; // e.g. 'all', 'customers', 'analytics'
  isActive: boolean;
  createdAt: string;
}

export interface SubscriptionConfig {
  formula: string; // mathematical calculation expression
  activeFee: number; // e.g. 140
  isActive: boolean;
  notes?: string;
  updatedAt: string;
}




