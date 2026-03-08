// src/pages/app/admin/AdminUsersPage.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  adminListUsers,
  adminUpdateUser,
  AdminUserListItem,
  AdminUserRole
} from "@/api/adminUsers";

const PAGE_SIZE = 20;

const roleOptions: { label: string; value: "" | AdminUserRole }[] = [
  { label: "All roles", value: "" },
  { label: "Client", value: "CLIENT" },
  { label: "Team member", value: "TEAM_MEMBER" },
  { label: "Referrer", value: "REFERRER" },
  { label: "Admin", value: "ADMIN" }
];

const AdminUsers: React.FC = () => {
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState<number>(1);
  const [total, setTotal] = useState<number>(0);

  const [queryInput, setQueryInput] = useState<string>("");
  const [query, setQuery] = useState<string>("");
  const [roleFilter, setRoleFilter] = useState<"" | AdminUserRole>("");

  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const totalPages = useMemo(
    () => (total > 0 ? Math.ceil(total / PAGE_SIZE) : 1),
    [total]
  );

  const loadUsers = useCallback(
    async (opts?: { pageOverride?: number }) => {
      const currentPage = opts?.pageOverride ?? page;

      setLoading(true);
      setError(null);
      try {
        const res = await adminListUsers({
          q: query || undefined,
          role: roleFilter || undefined,
          page: currentPage,
          pageSize: PAGE_SIZE
        });
        setUsers(res.items);
        setTotal(res.total);
        setPage(res.page);
      } catch (err: any) {
        console.error("Failed to load users:", err);
        setError(err?.message || "Failed to load users");
      } finally {
        setLoading(false);
      }
    },
    [page, query, roleFilter]
  );

  useEffect(() => {
    // Load whenever query / role filter / page changes
    loadUsers();
  }, [query, roleFilter, page, loadUsers]);

  const handleApplyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setQuery(queryInput.trim());
  };

  const handleClearFilters = () => {
    setQueryInput("");
    setQuery("");
    setRoleFilter("");
    setPage(1);
  };

  const handleChangeRole = async (userId: string, role: AdminUserRole) => {
    setUpdateError(null);
    setUpdatingUserId(userId);
    try {
      await adminUpdateUser(userId, { role });
      // Reload current page
      await loadUsers();
    } catch (err: any) {
      console.error("Failed to update user:", err);
      setUpdateError(err?.message || "Failed to update user");
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleToggleEmailVerified = async (user: AdminUserListItem) => {
    setUpdateError(null);
    setUpdatingUserId(user.id);
    try {
      await adminUpdateUser(user.id, { emailVerified: !user.emailVerified });
      await loadUsers();
    } catch (err: any) {
      console.error("Failed to update user:", err);
      setUpdateError(err?.message || "Failed to update user");
    } finally {
      setUpdatingUserId(null);
    }
  };

  const formatDateTime = (iso: string | null): string => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const formatNumber = (n: number): string => n.toLocaleString(undefined);

  const disabledPrev = page <= 1 || loading;
  const disabledNext = page >= totalPages || loading;

  return (
    <div className="page-root">
      <header className="page-header">
        <h1>Users admin</h1>
        <p className="page-subtitle">
          Inspect and manage users, roles, referral status and usage. Read-only
          aggregates; destructive actions stay in other tools.
        </p>
      </header>

      <section aria-label="User filters" className="card">
        <form className="admin-filters-bar admin-filters-bar--2" onSubmit={handleApplyFilters}>
          <div className="admin-filter-group">
            <label className="admin-filter-label" htmlFor="user-search">
              Search
            </label>
            <input
              id="user-search"
              className="input"
              type="search"
              placeholder="Search by email or name"
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
            />
          </div>

          <div className="admin-filter-group">
            <label className="admin-filter-label" htmlFor="user-role-filter">
              Role
            </label>
            <select
              id="user-role-filter"
              className="select"
              value={roleFilter}
              onChange={(e) => {
                const value = e.target.value as "" | AdminUserRole;
                setRoleFilter(value);
                setPage(1);
              }}
            >
              {roleOptions.map((opt) => (
                <option key={opt.label} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="admin-filter-actions">
            <button type="submit" className="btn-secondary" disabled={loading}>
              Apply
            </button>
            <button
              type="button"
              className="btn-link-small"
              onClick={handleClearFilters}
              disabled={loading && !query && !roleFilter}
            >
              Clear
            </button>
          </div>
        </form>

        <div className="admin-filters-meta">
          <span>
            Page {page} of {totalPages} • {formatNumber(total)} users
          </span>
          <span className="admin-filters-note">
            Usage numbers are from the last 30 days.
          </span>
        </div>
      </section>

      {loading && (
        <div className="card">
          <p>Loading users…</p>
        </div>
      )}

      {!loading && error && (
        <div className="card card-error">
          <p>{error}</p>
        </div>
      )}

      {updateError && (
        <div className="card card-error">
          <p>{updateError}</p>
        </div>
      )}

      {!loading && !error && users.length === 0 && (
        <div className="card">
          <p>No users match your filters.</p>
        </div>
      )}

      {!loading && !error && users.length > 0 && (
        <section aria-label="Users list" className="card">
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Bots</th>
                  <th>Referrals</th>
                  <th>Last usage</th>
                  <th aria-label="Row actions" />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isUpdating = updatingUserId === u.id;

                  return (
                    <tr key={u.id}>
                      <td>
                        <div className="admin-user-main">
                          <div className="admin-user-email">{u.email}</div>
                          <div className="admin-user-meta">
                            {u.name && <span>{u.name}</span>}
                            <span>Joined {formatDateTime(u.createdAt)}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <select
                          className="select select-sm"
                          value={u.role}
                          disabled={isUpdating}
                          onChange={(e) =>
                            handleChangeRole(u.id, e.target.value as AdminUserRole)
                          }
                        >
                          <option value="CLIENT">Client</option>
                          <option value="ADMIN">Admin</option>
                        </select>
                      </td>
                      <td>
                        <div className="admin-status-stack">
                          <span
                            className={
                              u.emailVerified
                                ? "status-pill status-pill-success"
                                : "status-pill status-pill-muted"
                            }
                          >
                            {u.emailVerified ? "Email verified" : "Email not verified"}
                          </span>
                          <span
                            className={
                              u.mfaEnabled
                                ? "status-pill status-pill-success"
                                : "status-pill status-pill-muted"
                            }
                          >
                            {u.mfaEnabled ? "MFA enabled" : "MFA disabled"}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="admin-number-cell">
                          <span className="admin-number-main">
                            {formatNumber(u.botsCount)}
                          </span>
                          <span className="admin-number-sub">bots</span>
                        </div>
                      </td>
                      <td>
                        <div className="admin-status-stack">
                          <span
                            className={
                              u.isReferralPartner
                                ? "status-pill status-pill-info"
                                : "status-pill status-pill-muted"
                            }
                          >
                            {u.isReferralPartner ? "Partner" : "Not partner"}
                          </span>
                          <span className="admin-number-sub">
                            {formatNumber(u.referralLeadsCount)}{" "}
                            {u.referralLeadsCount === 1 ? "lead" : "leads"}
                          </span>
                        </div>
                      </td>
                      <td>{formatDateTime(u.lastUsageAt)}</td>
                      <td className="admin-actions-cell">
                        <button
                          type="button"
                          className="btn-link-small"
                          disabled={isUpdating}
                          onClick={() => handleToggleEmailVerified(u)}
                        >
                          {u.emailVerified ? "Mark unverified" : "Mark verified"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <footer className="admin-table-footer">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => !disabledPrev && setPage((p) => Math.max(1, p - 1))}
              disabled={disabledPrev}
            >
              ← Previous
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              className="btn-secondary"
              onClick={() =>
                !disabledNext && setPage((p) => Math.min(totalPages, p + 1))
              }
              disabled={disabledNext}
            >
              Next →
            </button>
          </footer>
        </section>
      )}
    </div>
  );
};

export default AdminUsers;
