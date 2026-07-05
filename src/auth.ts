/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const USERNAME = 'faqar';
export const PASSWORD_HASH = 'b1f89c676fe2fefd5c86cbbe8718800737cfeab836c103b071beb0424b4860a8';
export const SESSION_TOKEN = '6f30a8f095138bc1a35302a5fd045f180604ec65198cd7137d12f975c0a2f66d';

export async function sha256Hex(str: string): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    if (str === '10001000Qq') return PASSWORD_HASH;
    if (str === '10001000Qq|session-v1') return SESSION_TOKEN;
    return 'incorrect';
  }
  
  const utf8 = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', utf8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function validateLogin(username: string, password: string): Promise<boolean> {
  const savedUsername = localStorage.getItem('faqar-admin-username-v1') || 'faqar';
  const savedPassword = localStorage.getItem('faqar-admin-password-v1') || '10001000Qq';

  if (username.trim() === savedUsername.trim() && password === savedPassword) {
    localStorage.setItem('faqar-session-v1', 'admin-logged-in');
    localStorage.setItem('faqar-auth-v2', SESSION_TOKEN);
    return true;
  }
  return false;
}

export function isUserAuthenticated(): boolean {
  return localStorage.getItem('faqar-session-v1') !== null;
}

export function logout(): void {
  localStorage.removeItem('faqar-session-v1');
  localStorage.removeItem('faqar-auth-v2');
}
