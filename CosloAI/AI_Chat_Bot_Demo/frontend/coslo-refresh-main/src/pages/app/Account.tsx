// src/pages/app/ProfilePage.tsx
import React, { useEffect, useState, useRef } from "react";
import {
  AccountMe,
  fetchAccountMe,
  updateAccountProfile,
  changePasswordApi,
  deleteAccountWithPassword,
  deleteAccountWithGoogle,
  startTotpSetup,
  confirmTotpSetup,
  disableTotp
} from "@/api/account";

import { clearAuthData } from "@/api/auth";
import { useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { Bot, fetchBots } from "@/api/bots";
import {
  createTeamInvite,
  fetchTeamMembers,
  revokeTeamInvite,
  revokeTeamMember,
  updateTeamMemberBots,
  TeamInviteItem,
  TeamMemberItem
} from "@/api/team";

declare global {
  interface Window {
    google?: any;
  }
}

const Account: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [account, setAccount] = useState<AccountMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // MFA state
  const [mfaSaving, setMfaSaving] = useState(false);
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [mfaSuccess, setMfaSuccess] = useState<string | null>(null);

  const [totpSetupToken, setTotpSetupToken] = useState<string | null>(null);
  const [totpOtpauthUrl, setTotpOtpauthUrl] = useState<string | null>(null);
  const [totpSecret, setTotpSecret] = useState<string | null>(null);
  const [totpCodeInput, setTotpCodeInput] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  const [disableMfaMode, setDisableMfaMode] = useState(false);
  const [disableMfaCode, setDisableMfaCode] = useState("");
  const [disableMfaBackupCode, setDisableMfaBackupCode] = useState("");

  // Team management
  const [teamBots, setTeamBots] = useState<Bot[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMemberItem[]>([]);
  const [teamInvites, setTeamInvites] = useState<TeamInviteItem[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [teamSuccess, setTeamSuccess] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteBotIds, setInviteBotIds] = useState<Set<string>>(new Set());
  const [inviteSending, setInviteSending] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editBotIds, setEditBotIds] = useState<Set<string>>(new Set());
  const [editSavingId, setEditSavingId] = useState<string | null>(null);

  const navigate = useNavigate();

  const [deletePassword, setDeletePassword] = useState("");
  const [deleteSaving, setDeleteSaving] = useState(false);

  const googleDeleteButtonRef = useRef<HTMLDivElement | null>(null);

  const resetAllNotices = () => {
    setError(null);
    setProfileSuccess(null);
    setPasswordSuccess(null);
    setMfaError(null);
    setMfaSuccess(null);
  };

  const confirmDangerousDelete = (): boolean => {
    return window.confirm(t("profile.confirmDelete"));
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchAccountMe()
      .then((me) => {
        if (cancelled) return;
        setAccount(me);
        setName(me.name || "");
        setAvatarUrl(me.avatarUrl || "");
      })
      .catch((err: any) => {
        console.error(err);
        if (!cancelled) {
          setError(err?.message || t("profile.errors.loadFailed"));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [t]);

  useEffect(() => {
    if (!account || account.authProvider !== "google") return;

    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      console.warn("VITE_GOOGLE_CLIENT_ID is not set; Google delete disabled.");
      return;
    }

    if (!window.google || !window.google.accounts?.id) {
      console.warn("Google Identity Services script not available.");
      return;
    }

    if (!googleDeleteButtonRef.current) {
      return;
    }

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: async (response: any) => {
        const idToken = response.credential;
        if (!idToken) return;

        const confirmed = confirmDangerousDelete();
        if (!confirmed) return;

        setDeleteSaving(true);
        resetAllNotices();

        try {
          const res = await deleteAccountWithGoogle(idToken);
          clearAuthData();
          navigate("/login", { replace: true });
        } catch (err: any) {
          console.error(err);
          setError(err?.message || t("profile.errors.deleteFailed"));
        } finally {
          setDeleteSaving(false);
        }
      }
    });

    window.google.accounts.id.renderButton(googleDeleteButtonRef.current, {
      theme: "outline",
      size: "large",
      text: "continue_with"
    });
  }, [account, navigate, t]);

  const loadTeamData = async () => {
    if (!user || user.role === "TEAM_MEMBER") return;
    setTeamLoading(true);
    setTeamError(null);
    try {
      const [bots, team] = await Promise.all([fetchBots(), fetchTeamMembers()]);
      setTeamBots(bots || []);
      setTeamMembers(team.members || []);
      setTeamInvites(team.invites || []);
    } catch (err: any) {
      console.error(err);
      setTeamError(err?.message || t("profile.team.errors.loadFailed"));
    } finally {
      setTeamLoading(false);
    }
  };

  useEffect(() => {
    if (!user || user.role === "TEAM_MEMBER") return;
    loadTeamData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role]);

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account) return;
    if (!deletePassword) return;

    const confirmed = confirmDangerousDelete();
    if (!confirmed) return;

    setDeleteSaving(true);
    resetAllNotices();

    try {
      const res = await deleteAccountWithPassword(deletePassword);
      clearAuthData();
      navigate("/login", { replace: true });
    } catch (err: any) {
      console.error(err);
      setError(err?.message || t("profile.errors.deleteFailed"));
    } finally {
      setDeleteSaving(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account) return;

    setProfileSaving(true);
    resetAllNotices();

    try {
      const updated = await updateAccountProfile({
        name: name.trim() || undefined,
        avatarUrl: avatarUrl.trim() || undefined
      });
      setAccount(updated);
      setProfileSuccess(t("profile.profile.success"));
    } catch (err: any) {
      console.error(err);
      setError(err?.message || t("profile.errors.updateProfileFailed"));
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account || !account.hasPassword) return;

    if (newPassword !== confirmPassword) {
      setError(t("profile.password.errors.mismatch"));
      return;
    }

    setPasswordSaving(true);
    resetAllNotices();

    try {
      const res = await changePasswordApi(currentPassword, newPassword);
      setPasswordSuccess(res.message || t("profile.password.success"));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      console.error(err);
      setError(err?.message || t("profile.errors.changePasswordFailed"));
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleStartTotpSetup = async () => {
    if (!account) return;

    setMfaError(null);
    setMfaSuccess(null);
    setError(null);
    setProfileSuccess(null);
    setPasswordSuccess(null);

    setMfaSaving(true);
    try {
      const res = await startTotpSetup();
      setTotpSetupToken(res.setupToken);
      setTotpOtpauthUrl(res.otpauthUrl);
      setTotpSecret(res.secret);
      setTotpCodeInput("");
      setBackupCodes([]);
    } catch (err: any) {
      console.error(err);
      setMfaError(err?.message || t("profile.mfa.errors.startFailed"));
    } finally {
      setMfaSaving(false);
    }
  };

  const handleConfirmTotpSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!totpSetupToken) return;

    setMfaError(null);
    setMfaSuccess(null);
    setError(null);
    setProfileSuccess(null);
    setPasswordSuccess(null);

    setMfaSaving(true);
    try {
      const res = await confirmTotpSetup(totpSetupToken, totpCodeInput.trim());
      setBackupCodes(res.backupCodes || []);
      setTotpSetupToken(null);
      setTotpOtpauthUrl(null);
      setTotpSecret(null);
      setTotpCodeInput("");
      setDisableMfaMode(false);

      setAccount((prev) => (prev ? { ...prev, mfaEnabled: res.mfaEnabled } : prev));
      setMfaSuccess(t("profile.mfa.success.enabledSaveBackupCodes"));
    } catch (err: any) {
      console.error(err);
      setMfaError(err?.message || t("profile.mfa.errors.confirmFailed"));
    } finally {
      setMfaSaving(false);
    }
  };

  const handleDisableTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account) return;

    if (!disableMfaCode && !disableMfaBackupCode) {
      setMfaError(t("profile.mfa.errors.disableRequiresCode"));
      return;
    }

    setMfaSaving(true);
    setMfaError(null);
    setMfaSuccess(null);
    setError(null);
    setProfileSuccess(null);
    setPasswordSuccess(null);

    try {
      const res = await disableTotp({
        code: disableMfaCode.trim() || undefined,
        backupCode: disableMfaBackupCode.trim() || undefined
      });

      setAccount((prev) => (prev ? { ...prev, mfaEnabled: res.mfaEnabled } : prev));
      setDisableMfaMode(false);
      setDisableMfaCode("");
      setDisableMfaBackupCode("");
      setBackupCodes([]);
      setTotpSetupToken(null);
      setTotpOtpauthUrl(null);
      setTotpSecret(null);
      setMfaSuccess(res.message || t("profile.mfa.success.disabled"));
    } catch (err: any) {
      console.error(err);
      setMfaError(err?.message || t("profile.mfa.errors.disableFailed"));
    } finally {
      setMfaSaving(false);
    }
  };

  const handleCopyBackupCodes = async () => {
    if (!backupCodes.length) return;
    try {
      await navigator.clipboard.writeText(backupCodes.join("\n"));
      setMfaSuccess(t("profile.mfa.success.backupCodesCopied"));
    } catch {
      setMfaError(t("profile.mfa.errors.backupCodesCopyFailed"));
    }
  };

  const toggleInviteBot = (botId: string) => {
    setInviteBotIds((prev) => {
      const next = new Set(prev);
      if (next.has(botId)) {
        next.delete(botId);
      } else {
        next.add(botId);
      }
      return next;
    });
  };

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) {
      setTeamError(t("profile.team.errors.emailRequired"));
      return;
    }
    if (inviteBotIds.size === 0) {
      setTeamError(t("profile.team.errors.botsRequired"));
      return;
    }

    setInviteSending(true);
    setTeamError(null);
    setTeamSuccess(null);
    try {
      await createTeamInvite(inviteEmail.trim(), Array.from(inviteBotIds));
      setInviteEmail("");
      setInviteBotIds(new Set());
      setTeamSuccess(t("profile.team.success.inviteSent"));
      await loadTeamData();
    } catch (err: any) {
      console.error(err);
      setTeamError(err?.message || t("profile.team.errors.inviteFailed"));
    } finally {
      setInviteSending(false);
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    setTeamError(null);
    setTeamSuccess(null);
    try {
      await revokeTeamInvite(inviteId);
      setTeamSuccess(t("profile.team.success.inviteRevoked"));
      await loadTeamData();
    } catch (err: any) {
      console.error(err);
      setTeamError(err?.message || t("profile.team.errors.revokeFailed"));
    }
  };

  const handleRevokeMember = async (userId: string) => {
    const confirmed = window.confirm(t("profile.team.members.confirmRemove"));
    if (!confirmed) return;
    setTeamError(null);
    setTeamSuccess(null);
    try {
      await revokeTeamMember(userId);
      setTeamSuccess(t("profile.team.success.memberRevoked"));
      await loadTeamData();
    } catch (err: any) {
      console.error(err);
      setTeamError(err?.message || t("profile.team.errors.revokeFailed"));
    }
  };

  const startEditMemberBots = (member: TeamMemberItem) => {
    setEditingMemberId(member.userId);
    setEditBotIds(new Set(member.bots.map((b) => b.id)));
    setTeamError(null);
    setTeamSuccess(null);
  };

  const cancelEditMemberBots = () => {
    setEditingMemberId(null);
    setEditBotIds(new Set());
  };

  const toggleEditBot = (botId: string) => {
    setEditBotIds((prev) => {
      const next = new Set(prev);
      if (next.has(botId)) {
        next.delete(botId);
      } else {
        next.add(botId);
      }
      return next;
    });
  };

  const handleSaveMemberBots = async (memberId: string) => {
    if (editBotIds.size === 0) {
      setTeamError(t("profile.team.errors.botsRequired"));
      return;
    }

    setEditSavingId(memberId);
    setTeamError(null);
    setTeamSuccess(null);
    try {
      await updateTeamMemberBots(memberId, Array.from(editBotIds));
      setTeamSuccess(t("profile.team.success.memberUpdated"));
      setEditingMemberId(null);
      setEditBotIds(new Set());
      await loadTeamData();
    } catch (err: any) {
      console.error(err);
      setTeamError(err?.message || t("profile.team.errors.updateFailed"));
    } finally {
      setEditSavingId(null);
    }
  };

  const initials = (() => {
    if (name.trim()) {
      return name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((n) => n[0])
        .join("")
        .toUpperCase();
    }
    if (account?.email) {
      return account.email[0].toUpperCase();
    }
    return "?";
  })();

  const loginMethodLabel = (() => {
    if (!account) return t("profile.security.loginMethod.unknown");
    if (account.authProvider === "google") return t("profile.security.loginMethod.google");
    if (account.hasPassword) return t("profile.security.loginMethod.emailPassword");
    return t("profile.security.loginMethod.unknown");
  })();

  return (
    <div className="profile-page">
      <div className="page-hero profile-hero">
        <div>
          <p className="page-hero-eyebrow">{t("profile.pageTitle")}</p>
          <h1 className="page-hero-title">{t("profile.pageTitle")}</h1>
          <p className="page-hero-subtitle">{t("profile.pageSubtitle")}</p>
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}
      {profileSuccess && <div className="form-success">{profileSuccess}</div>}
      {passwordSuccess && <div className="form-success">{passwordSuccess}</div>}
      {mfaSuccess && <div className="form-success">{mfaSuccess}</div>}

      {loading && (
        <div className="detail-main mt-4">
          <p>{t("profile.loading")}</p>
        </div>
      )}

      {!loading && account && (
        <>
          {/* Profile card */}
          <section className="app-card profile-card mt-4">
            <div className="profile-header-row">
              <div className="profile-avatar">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={t("profile.profile.avatarAlt")} />
                ) : (
                  <span className="profile-avatar-initials">{initials}</span>
                )}
              </div>

              <div>
                <h2 className="profile-card-title">{t("profile.profile.title")}</h2>
                <p className="muted mt-1">
                  {t("profile.profile.subtitle")}
                </p>
              </div>
            </div>

            <form className="form" onSubmit={handleSaveProfile}>
              <div className="form-field">
                <label>{t("profile.profile.displayName.label")}</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("profile.profile.displayName.placeholder")}
                />
              </div>

              <div className="form-field">
                <label>{t("profile.profile.avatarUrl.label")}</label>
                <input
                  type="url"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder={t("profile.profile.avatarUrl.placeholder")}
                />
                <span>{t("profile.profile.avatarUrl.help")}</span>
              </div>

              <div>
                <button className="btn-primary" type="submit" disabled={profileSaving}>
                  {profileSaving ? t("profile.profile.actions.saving") : t("profile.profile.actions.save")}
                </button>
              </div>
            </form>
          </section>

          {/* Login & security */}
          <section className="app-card security-card mt-6">
            <h2 className="card-title">{t("profile.security.title")}</h2>

            <div className="mt-3">
              <p className="muted">
                <strong>{t("profile.security.emailLabel")}:</strong> {account.email}
              </p>
              <p className="muted">
                <strong>{t("profile.security.loginMethodLabel")}:</strong> {loginMethodLabel}
              </p>
            </div>

            {account.hasPassword ? (
              <form className="form mt-4" onSubmit={handleChangePassword}>
                <div className="form-field">
                  <label>{t("profile.password.current.label")}</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                </div>

                <div className="form-field">
                  <label>{t("profile.password.new.label")}</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <span>{t("profile.password.new.help")}</span>
                </div>

                <div className="form-field">
                  <label>{t("profile.password.confirm.label")}</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>

                <div>
                  <button className="btn-secondary" type="submit" disabled={passwordSaving}>
                    {passwordSaving ? t("profile.password.actions.updating") : t("profile.password.actions.change")}
                  </button>
                </div>
              </form>
            ) : (
              <p className="muted mt-4">
                {t("profile.security.googleOnlyNoteStrongPrefix")}{" "}
                <strong>{t("profile.security.googleSignInStrong")}</strong>.{" "}
                {t("profile.security.googleOnlyNoteSuffix")}
              </p>
            )}
          </section>

          {/* Two-factor authentication */}
          <section className="app-card mfa-card mt-6">
            <h2 className="card-title">{t("profile.mfa.title")}</h2>
            <p className="muted mt-2">
              {t("profile.mfa.subtitle")}
            </p>

            {mfaError && (
              <div className="form-error mt-3">
                {mfaError}
              </div>
            )}

            <div className="mt-4">
              <p className="muted">
                <strong>{t("profile.mfa.statusLabel")}:</strong>{" "}
                {account.mfaEnabled ? (
                  <span className="badge badge-success">{t("profile.mfa.status.enabled")}</span>
                ) : (
                  <span className="badge badge-muted">{t("profile.mfa.status.disabled")}</span>
                )}
              </p>
            </div>

            {/* Setup flow */}
            {!account.mfaEnabled && !totpSetupToken && (
              <div className="mt-4">
                <p className="muted">{t("profile.mfa.recommendation")}</p>
                <button
                  className="btn-secondary"
                  type="button"
                  disabled={mfaSaving}
                  onClick={handleStartTotpSetup}
                >
                  {mfaSaving ? t("profile.mfa.actions.preparing") : t("profile.mfa.actions.enable")}
                </button>
              </div>
            )}

            {/* Show QR + code confirmation */}
            {!account.mfaEnabled && totpSetupToken && (
              <div className="mfa-setup-grid mt-5 grid gap-5">
                <div>
                  <h3 className="mt-0">{t("profile.mfa.setup.step1Title")}</h3>
                  <p className="muted">{t("profile.mfa.setup.step1Body")}</p>

                  <div
                    className="mt-3 inline-block rounded-xl border border-border bg-muted/40 p-3"
                  >
                    {totpOtpauthUrl && (
                      <QRCodeSVG value={totpOtpauthUrl} width={160} height={160} />
                    )}
                  </div>

                  {totpSecret && (
                    <div className="mt-3">
                      <p className="muted mb-1">
                        {t("profile.mfa.setup.manualSecretLabel")}
                      </p>
                      <code className="inline-block rounded-lg bg-muted/60 px-2 py-1 text-xs text-foreground">
                        {totpSecret}
                      </code>
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="mt-0">{t("profile.mfa.setup.step2Title")}</h3>
                  <p className="muted">{t("profile.mfa.setup.step2Body")}</p>

                  <form className="form mt-3" onSubmit={handleConfirmTotpSetup}>
                    <div className="form-field">
                      <label>{t("profile.mfa.setup.codeLabel")}</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="\d*"
                        maxLength={6}
                        value={totpCodeInput}
                        onChange={(e) => setTotpCodeInput(e.target.value)}
                        required
                      />
                    </div>

                    <div className="flex gap-2">
                      <button className="btn-primary" type="submit" disabled={mfaSaving}>
                        {mfaSaving ? t("profile.mfa.actions.verifying") : t("profile.mfa.actions.confirmEnable")}
                      </button>
                      <button
                        type="button"
                        className="btn-ghost"
                        disabled={mfaSaving}
                        onClick={() => {
                          setTotpSetupToken(null);
                          setTotpOtpauthUrl(null);
                          setTotpSecret(null);
                          setTotpCodeInput("");
                          setBackupCodes([]);
                        }}
                      >
                        {t("profile.common.cancel")}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Enabled state */}
            {account.mfaEnabled && (
              <div className="mt-5">
                <p className="muted">{t("profile.mfa.enabledNote")}</p>

                {backupCodes.length > 0 && (
                  <div
                    className="mfa-backup-codes mt-4 border-dashed bg-muted/40"
                  >
                    <h3 className="mt-0">{t("profile.mfa.backupCodes.title")}</h3>
                    <p className="muted">{t("profile.mfa.backupCodes.body")}</p>

                    <div className="mt-3 grid gap-2 grid-cols-[repeat(auto-fit,minmax(120px,1fr))]">
                      {backupCodes.map((code) => (
                        <code
                          key={code}
                          className="inline-block rounded-lg bg-background px-2.5 py-1.5 text-center text-xs"
                        >
                          {code}
                        </code>
                      ))}
                    </div>

                    <button
                      type="button"
                      className="btn-secondary mt-3"
                      onClick={handleCopyBackupCodes}
                    >
                      {t("profile.mfa.backupCodes.copyAll")}
                    </button>
                  </div>
                )}

                <div
                  className="mfa-disable mt-6 border-t border-border pt-4"
                >
                  {!disableMfaMode ? (
                    <>
                      <p className="muted">{t("profile.mfa.disable.intro")}</p>
                      <button
                        type="button"
                        className="btn-danger"
                        onClick={() => {
                          setDisableMfaMode(true);
                          setDisableMfaCode("");
                          setDisableMfaBackupCode("");
                          setMfaError(null);
                          setMfaSuccess(null);
                        }}
                      >
                        {t("profile.mfa.disable.open")}
                      </button>
                    </>
                  ) : (
                    <form className="form mt-3" onSubmit={handleDisableTotp}>
                      <p className="muted">{t("profile.mfa.disable.confirmBody")}</p>

                      <div className="form-field">
                        <label>{t("profile.mfa.disable.codeLabel")}</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="\d*"
                          maxLength={6}
                          value={disableMfaCode}
                          onChange={(e) => setDisableMfaCode(e.target.value)}
                        />
                      </div>

                      <div className="form-field">
                        <label>{t("profile.mfa.disable.backupCodeLabel")}</label>
                        <input
                          type="text"
                          value={disableMfaBackupCode}
                          onChange={(e) => setDisableMfaBackupCode(e.target.value)}
                        />
                      </div>

                      <div className="flex gap-2">
                        <button className="btn-danger" type="submit" disabled={mfaSaving}>
                          {mfaSaving ? t("profile.mfa.actions.disabling") : t("profile.mfa.disable.confirm")}
                        </button>
                        <button
                          type="button"
                          className="btn-ghost"
                          disabled={mfaSaving}
                          onClick={() => {
                            setDisableMfaMode(false);
                            setDisableMfaCode("");
                            setDisableMfaBackupCode("");
                          }}
                        >
                          {t("profile.common.cancel")}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* Team management (owners only) */}
          {user?.role !== "TEAM_MEMBER" && (
          <section className="app-card team-card mt-6">
            <h2 className="card-title">{t("profile.team.title")}</h2>
            <p className="muted mt-2">
              {t("profile.team.subtitle")}
            </p>

            {teamError && (
              <div className="form-error mt-3">
                {teamError}
              </div>
            )}
            {teamSuccess && (
              <div className="form-success mt-3">
                {teamSuccess}
              </div>
            )}

            <form className="form mt-4" onSubmit={handleInviteSubmit}>
                <div className="form-field">
                  <label>{t("profile.team.invite.emailLabel")}</label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder={t("profile.team.invite.emailPlaceholder")}
                  />
                </div>

                <div className="form-field">
                  <label>{t("profile.team.invite.botLabel")}</label>
                  <div className="team-bot-picker">
                    {teamBots.length === 0 && (
                      <p className="muted">
                        {t("profile.team.invite.noBots")}
                      </p>
                    )}
                    {teamBots.map((bot) => (
                      <label key={bot.id} className="team-bot-option">
                        <input
                          type="checkbox"
                          checked={inviteBotIds.has(bot.id)}
                          onChange={() => toggleInviteBot(bot.id)}
                        />
                        <span>{bot.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <button className="btn-primary" type="submit" disabled={inviteSending}>
                    {inviteSending
                      ? t("profile.team.invite.sending")
                      : t("profile.team.invite.send")}
                  </button>
                </div>
              </form>

              <div className="team-section-divider" />

              <div className="team-table-block">
                <h3>{t("profile.team.members.title")}</h3>
                {teamLoading ? (
                  <p className="muted">{t("profile.team.loading")}</p>
                ) : teamMembers.length === 0 ? (
                  <p className="muted">{t("profile.team.members.empty")}</p>
                ) : (
                  <div className="table-responsive">
                    <table className="table team-table">
                      <thead>
                        <tr>
                          <th>{t("profile.team.members.columns.member")}</th>
                          <th>{t("profile.team.members.columns.bots")}</th>
                          <th>{t("profile.team.members.columns.lastLogin")}</th>
                          <th>{t("profile.team.members.columns.actions")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {teamMembers.map((member) => (
                          <tr key={member.userId}>
                            <td>
                              <div className="team-member-name">
                                {member.name || member.email}
                              </div>
                              <div className="muted">{member.email}</div>
                            </td>
                            <td>
                              {editingMemberId === member.userId ? (
                                <div className="team-bot-picker">
                                  {teamBots.map((bot) => (
                                    <label key={bot.id} className="team-bot-option">
                                      <input
                                        type="checkbox"
                                        checked={editBotIds.has(bot.id)}
                                        onChange={() => toggleEditBot(bot.id)}
                                      />
                                      <span>{bot.name}</span>
                                    </label>
                                  ))}
                                </div>
                              ) : (
                                <div className="team-bot-tags">
                                  {member.bots.map((b) => (
                                    <span key={b.id} className="team-bot-tag">
                                      {b.name}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td>
                              {member.lastLoginAt
                                ? new Date(member.lastLoginAt).toLocaleString()
                                : t("profile.team.members.never")}
                            </td>
                            <td>
                              {editingMemberId === member.userId ? (
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    className="btn-primary btn-small"
                                    onClick={() => handleSaveMemberBots(member.userId)}
                                    disabled={editSavingId === member.userId}
                                  >
                                    {editSavingId === member.userId
                                      ? t("profile.team.members.saving")
                                      : t("profile.team.members.save")}
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-ghost btn-small"
                                    onClick={cancelEditMemberBots}
                                    disabled={editSavingId === member.userId}
                                  >
                                    {t("profile.team.members.cancel")}
                                  </button>
                                </div>
                              ) : (
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    className="btn-secondary btn-small"
                                    onClick={() => startEditMemberBots(member)}
                                  >
                                    {t("profile.team.members.editMember")}
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-danger btn-small"
                                    onClick={() => handleRevokeMember(member.userId)}
                                  >
                                    {t("profile.team.members.remove")}
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="team-table-block">
                <h3>{t("profile.team.invites.title")}</h3>
                {teamLoading ? (
                  <p className="muted">{t("profile.team.loading")}</p>
                ) : teamInvites.length === 0 ? (
                  <p className="muted">{t("profile.team.invites.empty")}</p>
                ) : (
                  <div className="table-responsive">
                    <table className="table team-table">
                      <thead>
                        <tr>
                          <th>{t("profile.team.invites.columns.email")}</th>
                          <th>{t("profile.team.invites.columns.bots")}</th>
                          <th>{t("profile.team.invites.columns.sent")}</th>
                          <th>{t("profile.team.invites.columns.actions")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {teamInvites.map((invite) => (
                          <tr key={invite.id}>
                            <td>{invite.email}</td>
                            <td>
                              <div className="team-bot-tags">
                                {invite.bots.map((b) => (
                                  <span key={b.id} className="team-bot-tag">
                                    {b.name}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td>{new Date(invite.createdAt).toLocaleDateString()}</td>
                            <td>
                              <button
                                type="button"
                                className="btn-ghost btn-small"
                                onClick={() => handleRevokeInvite(invite.id)}
                              >
                                {t("profile.team.invites.revoke")}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Danger zone: account deletion */}
          <section className="app-card danger-card mt-6">
            <h2 className="card-title">{t("profile.danger.title")}</h2>
            <p className="muted mt-2">
              {t("profile.danger.subtitle")}
            </p>

            {account.hasPassword ? (
              <form className="form mt-4" onSubmit={handleDeleteAccount}>
                <div className="form-field">
                  <label>{t("profile.danger.passwordConfirm.label")}</label>
                  <input
                    type="password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                  />
                  <span>{t("profile.danger.passwordConfirm.help")}</span>
                </div>

                <div>
                  <button
                    className="btn-danger"
                    type="submit"
                    disabled={deleteSaving || !deletePassword}
                  >
                    {deleteSaving ? t("profile.danger.actions.deleting") : t("profile.danger.actions.delete")}
                  </button>
                </div>
              </form>
            ) : account.authProvider === "google" ? (
              <div className="mt-4">
                <p className="muted">{t("profile.danger.googleNote")}</p>
                <div className="mt-3">
                  <div ref={googleDeleteButtonRef} />
                </div>
                {deleteSaving && (
                  <p className="muted mt-2">
                    {t("profile.danger.actions.deletingInline")}
                  </p>
                )}
              </div>
            ) : (
              <div className="alert-warning mt-4">
                {t("profile.danger.unsupported")}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default Account;
