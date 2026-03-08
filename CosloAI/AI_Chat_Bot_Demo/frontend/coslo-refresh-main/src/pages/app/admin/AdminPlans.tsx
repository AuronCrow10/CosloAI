// src/pages/app/admin/AdminPlansPage.tsx
import React, { useEffect, useState } from "react";
import {
  AdminUsagePlan,
  AdminFeaturePrice,
  adminListUsagePlans,
  adminCreateUsagePlan,
  adminUpdateUsagePlan,
  adminDeleteUsagePlan,
  adminListFeaturePrices,
  adminCreateFeaturePrice,
  adminUpdateFeaturePrice,
  adminDeleteFeaturePrice
} from "@/api/adminPlans";

function formatMoney(amountCents: number, currency: string): string {
  const curr = (currency || "eur").toUpperCase();
  const value = amountCents / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: curr
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${curr}`;
  }
}

type PlanFormState = {
  code: string;
  name: string;
  description: string;
  monthlyTokens: string;
  monthlyEmails: string;
  monthlyAmountCents: string;
  currency: string;
  stripePriceId: string;
  isActive: boolean;
};

type FeaturePriceFormState = {
  code: string;
  label: string;
  monthlyAmountCents: string;
  currency: string;
  stripePriceId: string;
  isActive: boolean;
};

const emptyPlanForm: PlanFormState = {
  code: "",
  name: "",
  description: "",
  monthlyTokens: "",
  monthlyEmails: "",
  monthlyAmountCents: "",
  currency: "eur",
  stripePriceId: "",
  isActive: true
};

const emptyFeatureForm: FeaturePriceFormState = {
  code: "",
  label: "",
  monthlyAmountCents: "",
  currency: "eur",
  stripePriceId: "",
  isActive: true
};

const AdminPlans: React.FC = () => {
  // Usage plans
  const [plans, setPlans] = useState<AdminUsagePlan[]>([]);
  const [plansTotal, setPlansTotal] = useState(0);
  const [plansLoading, setPlansLoading] = useState(false);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [planSearch, setPlanSearch] = useState("");
  const [plansIncludeInactive, setPlansIncludeInactive] = useState(false);

  const [planForm, setPlanForm] = useState<PlanFormState>(emptyPlanForm);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [planFormError, setPlanFormError] = useState<string | null>(null);
  const [planSaving, setPlanSaving] = useState(false);

  // Feature prices
  const [features, setFeatures] = useState<AdminFeaturePrice[]>([]);
  const [featuresTotal, setFeaturesTotal] = useState(0);
  const [featuresLoading, setFeaturesLoading] = useState(false);
  const [featuresError, setFeaturesError] = useState<string | null>(null);
  const [featureSearch, setFeatureSearch] = useState("");
  const [featuresIncludeInactive, setFeaturesIncludeInactive] = useState(false);

  const [featureForm, setFeatureForm] = useState<FeaturePriceFormState>(emptyFeatureForm);
  const [editingFeatureId, setEditingFeatureId] = useState<string | null>(null);
  const [featureFormError, setFeatureFormError] = useState<string | null>(null);
  const [featureSaving, setFeatureSaving] = useState(false);

  /* ===== Loaders ===== */

  const loadPlans = async () => {
    setPlansLoading(true);
    setPlansError(null);
    try {
      const res = await adminListUsagePlans({
        search: planSearch || undefined,
        includeInactive: plansIncludeInactive,
        take: 100,
        skip: 0
      });
      setPlans(res.items);
      setPlansTotal(res.total);
    } catch (err: any) {
      setPlansError(err?.message || "Failed to load usage plans.");
    } finally {
      setPlansLoading(false);
    }
  };

  const loadFeatures = async () => {
    setFeaturesLoading(true);
    setFeaturesError(null);
    try {
      const res = await adminListFeaturePrices({
        search: featureSearch || undefined,
        includeInactive: featuresIncludeInactive
      });
      setFeatures(res.items);
      setFeaturesTotal(res.total);
    } catch (err: any) {
      setFeaturesError(err?.message || "Failed to load feature prices.");
    } finally {
      setFeaturesLoading(false);
    }
  };

  useEffect(() => {
    void loadPlans();
    void loadFeatures();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ===== Handlers: Usage plans ===== */

  const resetPlanForm = () => {
    setPlanForm(emptyPlanForm);
    setEditingPlanId(null);
    setPlanFormError(null);
  };

  const fillPlanFormFromRow = (p: AdminUsagePlan) => {
    setPlanForm({
      code: p.code,
      name: p.name,
      description: p.description || "",
      monthlyTokens: p.monthlyTokens != null ? String(p.monthlyTokens) : "",
      monthlyEmails: p.monthlyEmails != null ? String(p.monthlyEmails) : "",
      monthlyAmountCents: String(p.monthlyAmountCents),
      currency: p.currency || "eur",
      stripePriceId: p.stripePriceId || "",
      isActive: p.isActive
    });
  };

  const handlePlanSubmit: React.FormEventHandler = async (e) => {
    e.preventDefault();
    setPlanFormError(null);

    const code = planForm.code.trim();
    const name = planForm.name.trim();
    const description = planForm.description.trim() || "";

    if (!code) {
      setPlanFormError("Code is required.");
      return;
    }
    if (!name) {
      setPlanFormError("Name is required.");
      return;
    }

    const monthlyAmountCents = Number(planForm.monthlyAmountCents);
    if (!Number.isFinite(monthlyAmountCents) || monthlyAmountCents < 0) {
      setPlanFormError("Monthly price (in cents) must be a non-negative integer.");
      return;
    }

    let monthlyTokens: number | null = null;
    if (planForm.monthlyTokens.trim() !== "") {
      const v = Number(planForm.monthlyTokens);
      if (!Number.isFinite(v) || v < 0) {
        setPlanFormError("Monthly tokens must be a non-negative integer or blank.");
        return;
      }
      monthlyTokens = Math.trunc(v);
    }

    let monthlyEmails: number | null = null;
    if (planForm.monthlyEmails.trim() !== "") {
      const v = Number(planForm.monthlyEmails);
      if (!Number.isFinite(v) || v < 0) {
        setPlanFormError("Monthly emails must be a non-negative integer or blank.");
        return;
      }
      monthlyEmails = Math.trunc(v);
    }

    const payload = {
      code,
      name,
      description: description || null,
      monthlyTokens,
      monthlyEmails,
      monthlyAmountCents: Math.trunc(monthlyAmountCents),
      currency: (planForm.currency || "eur").toLowerCase(),
      stripePriceId: planForm.stripePriceId.trim() || null,
      isActive: planForm.isActive
    };

    setPlanSaving(true);
    try {
      if (editingPlanId) {
        await adminUpdateUsagePlan(editingPlanId, payload);
      } else {
        await adminCreateUsagePlan(payload);
      }
      await loadPlans();
      resetPlanForm();
    } catch (err: any) {
      setPlanFormError(err?.message || "Failed to save usage plan.");
    } finally {
      setPlanSaving(false);
    }
  };

  const handlePlanEdit = (p: AdminUsagePlan) => {
    setEditingPlanId(p.id);
    fillPlanFormFromRow(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handlePlanDelete = async (p: AdminUsagePlan) => {
    const confirmed = window.confirm(
      `Delete plan "${p.name}"? This cannot be undone.`
    );
    if (!confirmed) return;

    try {
      await adminDeleteUsagePlan(p.id);
      await loadPlans();
    } catch (err: any) {
      alert(err?.message || "Failed to delete usage plan.");
    }
  };

  const handleTogglePlanActive = async (p: AdminUsagePlan) => {
    try {
      await adminUpdateUsagePlan(p.id, { isActive: !p.isActive });
      await loadPlans();
    } catch (err: any) {
      alert(err?.message || "Failed to update plan status.");
    }
  };

  /* ===== Handlers: Feature prices ===== */

  const resetFeatureForm = () => {
    setFeatureForm(emptyFeatureForm);
    setEditingFeatureId(null);
    setFeatureFormError(null);
  };

  const fillFeatureFormFromRow = (f: AdminFeaturePrice) => {
    setFeatureForm({
      code: f.code,
      label: f.label,
      monthlyAmountCents: String(f.monthlyAmountCents),
      currency: f.currency || "eur",
      stripePriceId: f.stripePriceId || "",
      isActive: f.isActive
    });
  };

  const handleFeatureSubmit: React.FormEventHandler = async (e) => {
    e.preventDefault();
    setFeatureFormError(null);

    const code = featureForm.code.trim();
    const label = featureForm.label.trim();

    if (!code) {
      setFeatureFormError("Code is required.");
      return;
    }
    if (!label) {
      setFeatureFormError("Label is required.");
      return;
    }

    const monthlyAmountCents = Number(featureForm.monthlyAmountCents);
    if (!Number.isFinite(monthlyAmountCents) || monthlyAmountCents < 0) {
      setFeatureFormError("Monthly price (in cents) must be a non-negative integer.");
      return;
    }

    const payload = {
      code,
      label,
      monthlyAmountCents: Math.trunc(monthlyAmountCents),
      currency: (featureForm.currency || "eur").toLowerCase(),
      stripePriceId: featureForm.stripePriceId.trim() || null,
      isActive: featureForm.isActive
    };

    setFeatureSaving(true);
    try {
      if (editingFeatureId) {
        await adminUpdateFeaturePrice(editingFeatureId, payload);
      } else {
        await adminCreateFeaturePrice(payload);
      }
      await loadFeatures();
      resetFeatureForm();
    } catch (err: any) {
      setFeatureFormError(err?.message || "Failed to save feature price.");
    } finally {
      setFeatureSaving(false);
    }
  };

  const handleFeatureEdit = (f: AdminFeaturePrice) => {
    setEditingFeatureId(f.id);
    fillFeatureFormFromRow(f);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleFeatureDelete = async (f: AdminFeaturePrice) => {
    const confirmed = window.confirm(
      `Delete feature price "${f.label}"? This cannot be undone.`
    );
    if (!confirmed) return;

    try {
      await adminDeleteFeaturePrice(f.id);
      await loadFeatures();
    } catch (err: any) {
      alert(err?.message || "Failed to delete feature price.");
    }
  };

  const handleToggleFeatureActive = async (f: AdminFeaturePrice) => {
    try {
      await adminUpdateFeaturePrice(f.id, { isActive: !f.isActive });
      await loadFeatures();
    } catch (err: any) {
      alert(err?.message || "Failed to update feature price status.");
    }
  };

  return (
    <div className="page-root">
      <div className="page-header">
        <div>
          <h1>Plans & feature prices</h1>
          <p className="muted">
            Manage usage plans and legacy feature add-ons.
          </p>
        </div>
      </div>

      {/* Usage plans card */}
      <div className="card">
        <div className="card-header">
          <h2>Usage plans</h2>
          <p className="card-subtitle">
            Per-bot plans with token & email quotas.
          </p>
        </div>

        {/* Search / filters */}
        <div className="admin-filters-bar admin-filters-bar--2">
          <div className="admin-filter-group">
            <label className="admin-filter-label" htmlFor="plan-search">
              Search
            </label>
            <input
              id="plan-search"
              type="text"
              className="input"
              placeholder="Search by code or name"
              value={planSearch}
              onChange={(e) => setPlanSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  void loadPlans();
                }
              }}
            />
          </div>
          <div className="admin-filter-group">
            <label className="admin-filter-label" htmlFor="plan-include-inactive">
              Status
            </label>
            <label className="checkbox-inline">
              <input
                id="plan-include-inactive"
                type="checkbox"
                checked={plansIncludeInactive}
                onChange={(e) => {
                  setPlansIncludeInactive(e.target.checked);
                  void loadPlans();
                }}
              />
              <span>Include inactive</span>
            </label>
          </div>
          <div className="admin-filter-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => void loadPlans()}
            >
              Reload
            </button>
          </div>
        </div>

        {/* Create / edit form */}
        <div className="card-body">
          <h3 className="mt-0">
            {editingPlanId ? "Edit plan" : "Create new plan"}
          </h3>

          {planFormError && <div className="form-error">{planFormError}</div>}

          <form onSubmit={handlePlanSubmit} className="form">
              <div className="form-row">
                <label className="form-field">
                  <span>Code</span>
                  <input
                    type="text"
                    className="input"
                    value={planForm.code}
                    onChange={(e) =>
                      setPlanForm((f) => ({ ...f, code: e.target.value }))
                    }
                    placeholder="STARTER"
                  />
                </label>
                <label className="form-field">
                  <span>Name</span>
                  <input
                    type="text"
                    className="input"
                    value={planForm.name}
                    onChange={(e) =>
                      setPlanForm((f) => ({ ...f, name: e.target.value }))
                    }
                    placeholder="Starter"
                  />
                </label>
              </div>

              <div className="form-row">
                <label className="form-field">
                  <span>Description</span>
                  <textarea
                    rows={3}
                    className="input"
                    value={planForm.description}
                    onChange={(e) =>
                      setPlanForm((f) => ({ ...f, description: e.target.value }))
                    }
                    placeholder="Short description (optional)"
                  />
                </label>
              </div>

              <div className="form-row">
                <label className="form-field">
                  <span>Monthly tokens</span>
                  <input
                    type="number"
                    className="input"
                    value={planForm.monthlyTokens}
                    onChange={(e) =>
                      setPlanForm((f) => ({ ...f, monthlyTokens: e.target.value }))
                    }
                    placeholder="Leave blank for unlimited"
                    min={0}
                  />
                </label>
                <label className="form-field">
                  <span>Monthly emails</span>
                  <input
                    type="number"
                    className="input"
                    value={planForm.monthlyEmails}
                    onChange={(e) =>
                      setPlanForm((f) => ({ ...f, monthlyEmails: e.target.value }))
                    }
                    placeholder="Leave blank for unlimited"
                    min={0}
                  />
                </label>
              </div>

              <div className="form-row">
                <label className="form-field">
                  <span>Monthly price (cents)</span>
                  <input
                    type="number"
                    className="input"
                    value={planForm.monthlyAmountCents}
                    onChange={(e) =>
                      setPlanForm((f) => ({
                        ...f,
                        monthlyAmountCents: e.target.value
                      }))
                    }
                    placeholder="e.g. 2900"
                    min={0}
                    required
                  />
                </label>
                <label className="form-field">
                  <span>Currency</span>
                  <input
                    type="text"
                    className="input"
                    value={planForm.currency}
                    onChange={(e) =>
                      setPlanForm((f) => ({ ...f, currency: e.target.value }))
                    }
                    placeholder="eur"
                    maxLength={3}
                  />
                </label>
                <label className="form-field">
                  <span>Stripe price ID</span>
                  <input
                    type="text"
                    className="input"
                    value={planForm.stripePriceId}
                    onChange={(e) =>
                      setPlanForm((f) => ({
                        ...f,
                        stripePriceId: e.target.value
                      }))
                    }
                    placeholder="price_..."
                  />
                </label>
              </div>

            <div className="form-row">
              <label className="checkbox-inline">
                <input
                  type="checkbox"
                  checked={planForm.isActive}
                  onChange={(e) =>
                    setPlanForm((f) => ({ ...f, isActive: e.target.checked }))
                  }
                />
                <span>Active</span>
              </label>
            </div>

            <div className="form-actions-inline">
              <button
                type="submit"
                className="btn-primary"
                disabled={planSaving}
              >
                {planSaving
                  ? editingPlanId
                    ? "Saving..."
                    : "Creating..."
                  : editingPlanId
                    ? "Save changes"
                    : "Create plan"}
              </button>
              {editingPlanId && (
                <button
                  type="button"
                  className="btn-link-small"
                  onClick={resetPlanForm}
                  disabled={planSaving}
                >
                  Cancel edit
                </button>
              )}
            </div>
          </form>
        </div>

        {/* List */}
        <div className="card-body">
          <h3 className="mt-0">Existing plans</h3>

          {plansError && <div className="form-error">{plansError}</div>}
          {plansLoading && <p>Loading plans…</p>}

          {!plansLoading && plans.length === 0 && (
            <p className="muted">No plans found.</p>
          )}

          {!plansLoading && plans.length > 0 && (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Code</th>
                    <th>Quotas</th>
                    <th>Price</th>
                    <th>Stripe price</th>
                    <th>Active</th>
                    <th>Subscriptions</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {plans.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div>{p.name}</div>
                        <div className="muted small">
                          {p.description || "\u00A0"}
                        </div>
                      </td>
                      <td>
                        <code>{p.code}</code>
                      </td>
                      <td>
                        <div className="small">
                          Tokens:{" "}
                          {p.monthlyTokens != null
                            ? p.monthlyTokens.toLocaleString()
                            : "∞"}
                        </div>
                        <div className="small">
                          Emails:{" "}
                          {p.monthlyEmails != null
                            ? p.monthlyEmails.toLocaleString()
                            : "∞"}
                        </div>
                      </td>
                      <td>{formatMoney(p.monthlyAmountCents, p.currency)}</td>
                      <td className="small">
                        {p.stripePriceId ? (
                          <code>{p.stripePriceId}</code>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className={
                            p.isActive ? "status-pill status-pill-success" : "status-pill status-pill-muted"
                          }
                          onClick={() => void handleTogglePlanActive(p)}
                        >
                          {p.isActive ? "Active" : "Inactive"}
                        </button>
                      </td>
                      <td>{p.subscriptionsCount}</td>
                      <td className="admin-actions-cell">
                        <button
                          type="button"
                          className="btn-link-small"
                          onClick={() => handlePlanEdit(p)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn-link-small text-danger"
                          onClick={() => void handlePlanDelete(p)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="admin-table-footer">
                <span className="muted">
                  Showing {plans.length} of {plansTotal} plan(s)
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Feature prices card */}
      <div className="card mt-8">
        <div className="card-header">
          <h2>Feature prices (legacy)</h2>
          <p className="card-subtitle">
            Standalone feature add-ons, kept for backwards compatibility.
          </p>
        </div>

        {/* Search / filters */}
        <div className="admin-filters-bar admin-filters-bar--2">
          <div className="admin-filter-group">
            <label className="admin-filter-label" htmlFor="feature-search">
              Search
            </label>
            <input
              id="feature-search"
              type="text"
              className="input"
              placeholder="Search by code or label"
              value={featureSearch}
              onChange={(e) => setFeatureSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  void loadFeatures();
                }
              }}
            />
          </div>
          <div className="admin-filter-group">
            <label className="admin-filter-label" htmlFor="feature-include-inactive">
              Status
            </label>
            <label className="checkbox-inline">
              <input
                id="feature-include-inactive"
                type="checkbox"
                checked={featuresIncludeInactive}
                onChange={(e) => {
                  setFeaturesIncludeInactive(e.target.checked);
                  void loadFeatures();
                }}
              />
              <span>Include inactive</span>
            </label>
          </div>
          <div className="admin-filter-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => void loadFeatures()}
            >
              Reload
            </button>
          </div>
        </div>

        {/* Create / edit form */}
        <div className="card-body">
          <h3 className="mt-0">
            {editingFeatureId ? "Edit feature price" : "Create new feature price"}
          </h3>

          {featureFormError && (
            <div className="form-error">{featureFormError}</div>
          )}

          <form onSubmit={handleFeatureSubmit} className="form">
              <div className="form-row">
                <label className="form-field">
                  <span>Code</span>
                  <input
                    type="text"
                    className="input"
                    value={featureForm.code}
                    onChange={(e) =>
                      setFeatureForm((f) => ({ ...f, code: e.target.value }))
                    }
                    placeholder="DOMAIN_CRAWLER"
                  />
                </label>
                <label className="form-field">
                  <span>Label</span>
                  <input
                    type="text"
                    className="input"
                    value={featureForm.label}
                    onChange={(e) =>
                      setFeatureForm((f) => ({ ...f, label: e.target.value }))
                    }
                    placeholder="Domain crawler add-on"
                  />
                </label>
              </div>

              <div className="form-row">
                <label className="form-field">
                  <span>Monthly price (cents)</span>
                  <input
                    type="number"
                    className="input"
                    value={featureForm.monthlyAmountCents}
                    onChange={(e) =>
                      setFeatureForm((f) => ({
                        ...f,
                        monthlyAmountCents: e.target.value
                      }))
                    }
                    placeholder="e.g. 900"
                    min={0}
                    required
                  />
                </label>
                <label className="form-field">
                  <span>Currency</span>
                  <input
                    type="text"
                    className="input"
                    value={featureForm.currency}
                    onChange={(e) =>
                      setFeatureForm((f) => ({ ...f, currency: e.target.value }))
                    }
                    placeholder="eur"
                    maxLength={3}
                  />
                </label>
                <label className="form-field">
                  <span>Stripe price ID</span>
                  <input
                    type="text"
                    className="input"
                    value={featureForm.stripePriceId}
                    onChange={(e) =>
                      setFeatureForm((f) => ({
                        ...f,
                        stripePriceId: e.target.value
                      }))
                    }
                    placeholder="price_..."
                  />
                </label>
              </div>

            <div className="form-row">
              <label className="checkbox-inline">
                <input
                  type="checkbox"
                  checked={featureForm.isActive}
                  onChange={(e) =>
                    setFeatureForm((f) => ({ ...f, isActive: e.target.checked }))
                  }
                />
                <span>Active</span>
              </label>
            </div>

            <div className="form-actions-inline">
              <button
                type="submit"
                className="btn-primary"
                disabled={featureSaving}
              >
                {featureSaving
                  ? editingFeatureId
                    ? "Saving..."
                    : "Creating..."
                  : editingFeatureId
                    ? "Save changes"
                    : "Create feature price"}
              </button>
              {editingFeatureId && (
                <button
                  type="button"
                  className="btn-link-small"
                  onClick={resetFeatureForm}
                  disabled={featureSaving}
                >
                  Cancel edit
                </button>
              )}
            </div>
          </form>
        </div>

        {/* List */}
        <div className="card-body">
          <h3 className="mt-0">Existing feature prices</h3>

          {featuresError && <div className="form-error">{featuresError}</div>}
          {featuresLoading && <p>Loading feature prices…</p>}

          {!featuresLoading && features.length === 0 && (
            <p className="muted">No feature prices found.</p>
          )}

          {!featuresLoading && features.length > 0 && (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Label</th>
                    <th>Code</th>
                    <th>Price</th>
                    <th>Stripe price</th>
                    <th>Active</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {features.map((f) => (
                    <tr key={f.id}>
                      <td>{f.label}</td>
                      <td>
                        <code>{f.code}</code>
                      </td>
                      <td>{formatMoney(f.monthlyAmountCents, f.currency)}</td>
                      <td className="small">
                        {f.stripePriceId ? (
                          <code>{f.stripePriceId}</code>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className={f.isActive ? "status-pill status-pill-success" : "status-pill status-pill-muted"}
                          onClick={() => void handleToggleFeatureActive(f)}
                        >
                          {f.isActive ? "Active" : "Inactive"}
                        </button>
                      </td>
                      <td className="admin-actions-cell">
                        <button
                          type="button"
                          className="btn-link-small"
                          onClick={() => handleFeatureEdit(f)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn-link-small text-danger"
                          onClick={() => void handleFeatureDelete(f)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="admin-table-footer">
                <span className="muted">
                  Showing {features.length} of {featuresTotal} feature price(s)
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPlans;
