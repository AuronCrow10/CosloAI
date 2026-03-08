// src/utils/referral.ts
const REFERRAL_CODE_KEY = "referralCode";

export function getStoredReferralCode(): string | null {
  const raw = localStorage.getItem(REFERRAL_CODE_KEY);
  const code = raw?.trim();
  return code ? code : null;
}

export function setStoredReferralCode(code: string): void {
  const trimmed = code.trim();
  if (!trimmed) return;
  localStorage.setItem(REFERRAL_CODE_KEY, trimmed);
}

export function clearStoredReferralCode(): void {
  localStorage.removeItem(REFERRAL_CODE_KEY);
}
