/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export function normalizePhone(p: string): string {
  let cleaned = p.replace(/\D/g, '');
  if (cleaned.startsWith('00')) {
    cleaned = cleaned.substring(2);
  }
  if (cleaned.startsWith('0')) {
    cleaned = '964' + cleaned.substring(1);
  }
  if (!cleaned.startsWith('964')) {
    cleaned = '964' + cleaned;
  }
  return cleaned;
}

export function waLink(phone: string, text: string): string {
  const normalized = normalizePhone(phone);
  return `https://wa.me/${normalized}?text=${encodeURIComponent(text)}`;
}

export const defaultFriendlyReminder = `السلام عليكم ورحمة الله وبركاته،
أهلاً بك أخي {{client_name}} 🌹

تذكير ودّي بقسطك الشهري المستحق بمبلغ {{next_installment}}.
إجمالي المتبقي عليك حالياً: {{remaining_balance}}.

نشكر التزامك وتعاونك، وفقك الله.`;

export const defaultStatementMessage = `📋 *كشف حساب* — {{client_name}}

{{contract_progress_pct}}

💰 إجمالي المدفوع: {{paid_amount}}
📉 إجمالي المتبقي: {{remaining_balance}}
📅 المستحق الشهري: {{next_installment}}

— أحاديث في الدَّين —
{{hadith_debt}}

نسأل الله لك التوفيق والسداد.`;

export const defaultOverdueMessage2 = `السلام عليكم أخي {{client_name}}،

نُذكِّرك بأنه قد تراكم عليك قسطان (شهران) متأخرة.
المبلغ المطلوب تسديده: {{total_due_now}}.

يرجى المبادرة بالتسديد في أقرب وقت تجنباً لأي إجراءات.
شاكرين تفهّمك وتعاونك.`;

export const defaultOverdueMessage3 = `السلام عليكم أخي {{client_name}}،

نُذكِّرك بأنه قد تراكم عليك ثلاثة أقساط (٣ أشهر) متأخرة.
المبلغ المطلوب تسديده: {{total_due_now}}.

يرجى المبادرة بالتسديد في أقرب وقت تجنباً لأي إجراءات.
شاكرين تفهّمك وتعاونك.`;
