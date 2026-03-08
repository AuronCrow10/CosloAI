// src/pages/app/admin/AdminIntegrationsPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  adminListIntegrations,
  adminDeleteMetaIntegration,
  adminDeleteWhatsappIntegration,
  AdminIntegrationsResponse
} from "@/api/adminIntegrations";

const AdminIntegrations: React.FC = () => {
  const locale = useMemo(() => "en-GB", []);
  const [search, setSearch] = useState("");
  const [data, setData] = useState<AdminIntegrationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = async (query?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminListIntegrations({
        q: query && query.trim() ? query.trim() : undefined
      });
      setData(res);
    } catch (err: any) {
      setError(err?.message || "Failed to load integrations.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await load(search);
  };

  const handleClearSearch = async () => {
    setSearch("");
    await load();
  };

  const handleDeleteMeta = async (id: string) => {
    if (!window.confirm("Disconnect this Meta integration?")) return;
    setDeletingId(id);
    setError(null);
    try {
      await adminDeleteMetaIntegration(id);
      await load(search);
    } catch (err: any) {
      setError(err?.message || "Failed to delete Meta integration.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteWhatsapp = async (id: string) => {
    if (!window.confirm("Disconnect this WhatsApp integration?")) return;
    setDeletingId(id);
    setError(null);
    try {
      await adminDeleteWhatsappIntegration(id);
      await load(search);
    } catch (err: any) {
      setError(err?.message || "Failed to delete WhatsApp integration.");
    } finally {
      setDeletingId(null);
    }
  };

  const metaCount = data?.meta.length ?? 0;
  const whatsappCount = data?.whatsapp.length ?? 0;
  const distinctBots = useMemo(() => {
    if (!data) return 0;
    const ids = new Set<string>();
    data.meta.forEach((m) => ids.add(m.bot.id));
    data.whatsapp.forEach((w) => ids.add(w.bot.id));
    return ids.size;
  }, [data]);
  const distinctUsers = useMemo(() => {
    if (!data) return 0;
    const ids = new Set<string>();
    data.meta.forEach((m) => ids.add(m.user.id));
    data.whatsapp.forEach((w) => ids.add(w.user.id));
    return ids.size;
  }, [data]);

  return (
    <div className="page-root">
      <div className="page-header">
        <div>
          <h1>Integrations admin</h1>
          <p className="muted">
            Inspect Meta (Facebook / Instagram / Messenger) and WhatsApp
            sessions across all bots.
          </p>
        </div>

        <form className="page-header-actions" onSubmit={handleSearchSubmit}>
          <input
            className="input"
            type="search"
            placeholder="Search by email, bot, channel, WABA..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="btn-secondary" type="button" onClick={handleClearSearch}>
            Clear
          </button>
          <button className="btn-primary" type="submit">
            Search
          </button>
        </form>
      </div>

      {loading && (
        <div className="card">
          <p>Loading.</p>
        </div>
      )}

      {!loading && error && (
        <div className="card card-error">
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && data && (
        <>
          <div className="card">
            <div className="card-header">
              <h2>Summary</h2>
              <p className="card-subtitle">
                High-level view of connected sessions.
              </p>
            </div>

            <div className="dashboard-kpi-grid">
              <div>
                <div className="dashboard-kpi-label">Meta sessions</div>
                <div className="dashboard-kpi-value">{metaCount}</div>
              </div>
              <div>
                <div className="dashboard-kpi-label">WhatsApp sessions</div>
                <div className="dashboard-kpi-value">{whatsappCount}</div>
              </div>
              <div>
                <div className="dashboard-kpi-label">Distinct bots</div>
                <div className="dashboard-kpi-value">{distinctBots}</div>
              </div>
              <div>
                <div className="dashboard-kpi-label">Distinct users</div>
                <div className="dashboard-kpi-value">{distinctUsers}</div>
              </div>
            </div>
          </div>

          {/* Meta integrations */}
          <div className="card mt-4">
            <div className="card-header">
              <h2>Meta integrations</h2>
              <p className="card-subtitle">
                Long-lived sessions for Facebook / Instagram / Messenger bots.
              </p>
            </div>

            {data.meta.length === 0 ? (
              <p className="card-empty">No Meta integrations found.</p>
            ) : (
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Bot</th>
                      <th>User</th>
                      <th>Channel</th>
                      <th>Pages</th>
                      <th>Created</th>
                      <th className="payments-actions-cell">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.meta.map((m) => {
                      const pagesLabel =
                        m.pages.count === 0
                          ? "—"
                          : `${m.pages.names.join(", ")}${
                              m.pages.count > m.pages.names.length
                                ? ` +${m.pages.count - m.pages.names.length}`
                                : ""
                            }`;

                      return (
                        <tr key={m.id}>
                          <td>
                            <div>{m.bot.name}</div>
                            <div className="muted">
                              <code>{m.bot.slug}</code>
                            </div>
                          </td>
                          <td>{m.user.email}</td>
                          <td>{m.channelType}</td>
                          <td>{pagesLabel}</td>
                          <td>{new Date(m.createdAt).toLocaleString(locale)}</td>
                          <td className="payments-actions-cell">
                            <button
                              type="button"
                              className="btn-link-small danger"
                              onClick={() => handleDeleteMeta(m.id)}
                              disabled={deletingId === m.id}
                            >
                              {deletingId === m.id ? "Removing..." : "Disconnect"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* WhatsApp integrations */}
          <div className="card mt-4">
            <div className="card-header">
              <h2>WhatsApp integrations</h2>
              <p className="card-subtitle">
                Connected WhatsApp Business Accounts and phone numbers.
              </p>
            </div>

            {data.whatsapp.length === 0 ? (
              <p className="card-empty">No WhatsApp integrations found.</p>
            ) : (
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Bot</th>
                      <th>User</th>
                      <th>WABA ID</th>
                      <th>Phone numbers</th>
                      <th>Created</th>
                      <th className="payments-actions-cell">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.whatsapp.map((w) => {
                      const phonesLabel =
                        w.phoneNumbers.count === 0
                          ? "—"
                          : `${w.phoneNumbers.display.join(", ")}${
                              w.phoneNumbers.count > w.phoneNumbers.display.length
                                ? ` +${w.phoneNumbers.count - w.phoneNumbers.display.length}`
                                : ""
                            }`;

                      return (
                        <tr key={w.id}>
                          <td>
                            <div>{w.bot.name}</div>
                            <div className="muted">
                              <code>{w.bot.slug}</code>
                            </div>
                          </td>
                          <td>{w.user.email}</td>
                          <td>
                            {w.wabaId ? (
                              <code>{w.wabaId}</code>
                            ) : (
                              <span className="muted">—</span>
                            )}
                          </td>
                          <td>{phonesLabel}</td>
                          <td>{new Date(w.createdAt).toLocaleString(locale)}</td>
                          <td className="payments-actions-cell">
                            <button
                              type="button"
                              className="btn-link-small danger"
                              onClick={() => handleDeleteWhatsapp(w.id)}
                              disabled={deletingId === w.id}
                            >
                              {deletingId === w.id ? "Removing..." : "Disconnect"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default AdminIntegrations;
