// src/api/account.ts
import { authFetchJson } from "./authorizedClient";

export interface AccountMe {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  emailVerified: boolean;
  hasPassword: boolean;
  authProvider: "google" | "password" | "unknown";
  mfaEnabled: boolean;
}

export async function fetchAccountMe(): Promise<AccountMe> {
  return authFetchJson<AccountMe>("/account/me");
}

export async function updateAccountProfile(input: {
  name?: string;
  avatarUrl?: string | null;
}): Promise<AccountMe> {
  return authFetchJson<AccountMe>("/account/profile", {
    method: "PUT",
    body: JSON.stringify(input)
  });
}

export interface ChangePasswordResponse {
  message: string;
}

export async function changePasswordApi(
  currentPassword: string,
  newPassword: string
): Promise<ChangePasswordResponse> {
  return authFetchJson<ChangePasswordResponse>("/account/change-password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword })
  });
}

export interface DeleteAccountResponse {
  message: string;
}

export async function deleteAccountWithPassword(
  password: string
): Promise<DeleteAccountResponse> {
  return authFetchJson<DeleteAccountResponse>("/account", {
    method: "DELETE",
    body: JSON.stringify({ password })
  });
}

export async function deleteAccountWithGoogle(
  googleIdToken: string
): Promise<DeleteAccountResponse> {
  return authFetchJson<DeleteAccountResponse>("/account", {
    method: "DELETE",
    body: JSON.stringify({ googleIdToken })
  });
}

// ---------- MFA (TOTP) ----------

export interface TotpStartResponse {
  otpauthUrl: string;
  secret: string;
  setupToken: string;
}

export interface TotpConfirmResponse {
  mfaEnabled: boolean;
  backupCodes: string[];
}

export interface TotpDisableResponse {
  message: string;
  mfaEnabled: boolean;
}

export async function startTotpSetup(): Promise<TotpStartResponse> {
  return authFetchJson<TotpStartResponse>("/account/mfa/totp/start", {
    method: "POST"
  });
}

export async function confirmTotpSetup(
  setupToken: string,
  code: string
): Promise<TotpConfirmResponse> {
  return authFetchJson<TotpConfirmResponse>("/account/mfa/totp/confirm", {
    method: "POST",
    body: JSON.stringify({ setupToken, code })
  });
}

export async function disableTotp(options: {
  code?: string;
  backupCode?: string;
}): Promise<TotpDisableResponse> {
  return authFetchJson<TotpDisableResponse>("/account/mfa/totp/disable", {
    method: "POST",
    body: JSON.stringify(options)
  });
}
