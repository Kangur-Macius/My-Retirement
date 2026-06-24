"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import "./globals.css";

const STORAGE_KEY = "asxfolio_holdings_v1";
const REFRESH_MS = 60000;

function loadHoldings() {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch { return []; }
}
function saveHoldings(holdings) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(holdings)); } catch {}
}

const f2   = (n) => n == null ? "—" : Math.abs(n).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fD   = (n) => n == null ? "—" : `$${f2(n)}`;
const fS   = (n) => n == null ? "—" : `${n >= 0 ? "+" : "−"}$${f2(n)}`;
const fPct = (n) => n == null ? "" : `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

function PnL({ val, pct }) {
  if (val == null) return <span style={{ color: "var(--muted)" }}>—</span>;
  const pos = val >= 0;
  return (
    <span>
      <span className={`badge ${pos ? "badge-pos" : "badge-neg"}`}>
        {pos ? "▲" : "▼"} {fD(val)}
      </span>
      {pct != null && (
        <span className="pct" style={{ color: pos ? "var(--green)" : "var(--red)" }}>
          {fPct(pct)}
        </span>
      )}
    </span>
  );
}

export default function Home() {
  const [page,    setPage]    = useState("portfolio");
  const [holdings, setHoldings] = useState([]);
  const [prices,  setPrices]  = useState({});
  const [loading, setLoading] = useState(false);
  const [updated, setUpdated] = useState(null);
  const [error,   setError]   = useState(null);
  const [form,    setForm]    = useState({ code: "", qty: "", cost: "" });
  const [editIdx, setEditIdx] = useState(null);
  const [formErr, setFormErr] = useState("");

  useEffect(() => { setHoldings(loadHoldings()); }, []);

  const fetchPrices = useCallback(async (list) => {
    if (!list.length) { setPrices({}); return; }
    setLoading(true);
    setError(null);
    try {
      const codes = list.map((h) => h.code.toUpperCase()).join(",");
      const res = await fetch(`/api/prices?codes=${encodeURIComponent(codes)}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? `Request failed (${res.status})`);
      } else {
        setPrices(data.prices ?? {});
        if (data.errors && Object.keys(data.errors).length) {
          setError(`Some prices unavailable — ${Object.entries(data.errors).map(([c, e]) => `${c}: ${e}`).join(", ")}`);
        }
      }
      setUpdated(new Date());
    } catch (err) {
      setError(err?.message ?? "Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (holdings.length) fetchPrices(holdings); }, [holdings, fetchPrices]);
  useEffect(() => {
    if (!holdings.length) return;
    const t = setInterval(() => fetchPrices(holdings), REFRESH_MS);
    return () => clearInterval(t);
  }, [holdings, fetchPrices]);

  function updateHoldings(next) { setHoldings(next); saveHoldings(next); }

  function saveForm() {
    const code = form.code.trim().toUpperCase();
    const qty  = parseFloat(form.qty);
    const cost = parseFloat(form.cost);
    if (!code)                    return setFormErr("Enter an ASX code.");
    if (isNaN(qty) || qty <= 0)   return setFormErr("Enter a valid quantity.");
    if (isNaN(cost) || cost < 0)  return setFormErr("Enter a valid total cost.");
    if (editIdx == null && holdings.some((h) => h.code.toUpperCase() === code))
      return setFormErr(`${code} is already in your portfolio.`);
    setFormErr("");
    updateHoldings(
      editIdx == null
        ? [...holdings, { code, qty, cost }]
        : holdings.map((h, i) => (i === editIdx ? { code, qty, cost } : h))
    );
    setEditIdx(null);
    setForm({ code: "", qty: "", cost: "" });
  }
  function startEdit(i) {
    const h = holdings[i];
    setForm({ code: h.code, qty: String(h.qty), cost: String(h.cost) });
    setEditIdx(i); setFormErr(""); setPage("settings");
  }
  function cancelEdit() { setEditIdx(null); setForm({ code: "", qty: "", cost: "" }); setFormErr(""); }
  function remove(i)    { updateHoldings(holdings.filter((_, j) => j !== i)); }

  const rows = useMemo(() => holdings.map((h) => {
    const code  = h.code.toUpperCase();
    const p     = prices[code];
    const price = p?.price ?? null;
    const prev  = p?.prev  ?? null;
    const val   = price != null ? price * h.qty : null;
    const pnl   = val   != null ? val - h.cost  : null;
    const pnlPct = h.cost > 0 && pnl != null ? (pnl / h.cost) * 100 : null;
    const dayC  = price != null && prev != null ? (price - prev) * h.qty : null;
    const dayP  = price != null && prev != null ? ((price - prev) / prev) * 100 : null;
    return { code, qty: h.qty, cost: h.cost, price, val, pnl, pnlPct, dayC, dayP };
  }), [holdings, prices]);

  const totCost   = rows.reduce((s, r) => s + r.cost, 0);
  const totVal    = rows.length && rows.every((r) => r.val  != null) ? rows.reduce((s, r) => s + r.val,  0) : null;
  const totPnl    = totVal != null ? totVal - totCost : null;
  const totPnlPct = totCost > 0 && totPnl != null ? (totPnl / totCost) * 100 : null;
  const totDay    = rows.length && rows.every((r) => r.dayC != null) ? rows.reduce((s, r) => s + r.dayC, 0) : null;

  return (
    <div className="shell">
      <header>
        <div className="logo">ASX<span>Folio</span></div>
        <nav>
          <button className={page === "portfolio" ? "active" : ""} onClick={() => setPage("portfolio")}>Portfolio</button>
          <button className={page === "settings"  ? "active" : ""} onClick={() => setPage("settings")}>Settings</button>
        </nav>
      </header>

      {page === "portfolio" && (
        <PortfolioPage rows={rows} totCost={totCost} totVal={totVal}
          totPnl={totPnl} totPnlPct={totPnlPct} totDay={totDay}
          loading={loading} updated={updated} error={error}
          onRefresh={() => fetchPrices(holdings)}
          onGoSettings={() => setPage("settings")} />
      )}
      {page === "settings" && (
        <SettingsPage holdings={holdings} form={form} setForm={setForm}
          editIdx={editIdx} formErr={formErr}
          onSave={saveForm} onCancel={cancelEdit} onEdit={startEdit} onRemove={remove} />
      )}
    </div>
  );
}

function PortfolioPage({ rows, totCost, totVal, totPnl, totPnlPct, totDay, loading, updated, error, onRefresh, onGoSettings }) {
  if (!rows.length) return (
    <div className="empty">
      <div className="empty-icon">📈</div>
      <h3>No holdings yet</h3>
      <p>Add your ASX shares in Settings to get started.</p>
      <button className="btn-accent" onClick={onGoSettings}>Go to Settings →</button>
    </div>
  );

  const pPos = totPnl == null ? null : totPnl >= 0;

  return (
    <>
      <div className="statusbar">
        <span className={`dot ${loading ? "dot-yellow" : error ? "dot-red" : ""}`} />
        <span>{loading ? "Fetching live prices…" : "Live"}</span>
        <span style={{ color: "var(--border)" }}>• Auto-refresh every 60s</span>
        <button className="refresh-btn" onClick={onRefresh} disabled={loading}>↻ Refresh</button>
      </div>

      {error && (
        <div className="err-box">
          <span>⚠ {error}</span>
          <button className="err-retry" onClick={onRefresh}>Retry</button>
        </div>
      )}

      <div className="cards">
        {[
          ["Total Invested", fD(totCost), "", null],
          ["Market Value", totVal == null ? "—" : fD(totVal), "Live", null],
          ["Total P&L", totPnl == null ? "—" : fS(totPnl), totPnlPct != null ? fPct(totPnlPct) : "", pPos],
          ["Today's Move", totDay == null ? "—" : fS(totDay), "vs prior close", totDay == null ? null : totDay >= 0],
        ].map(([label, val, sub, pos]) => (
          <div key={label} className={`card ${pos === true ? "card-pos" : pos === false ? "card-neg" : ""}`}>
            <div className="card-label">{label}</div>
            <div className={`card-val ${pos === true ? "pos" : pos === false ? "neg" : ""}`}>{val}</div>
            <div className="card-sub">{sub}</div>
          </div>
        ))}
      </div>

      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Stock</th>
              <th>Qty</th><th>Price</th><th>Value</th><th>Cost</th><th>P&amp;L</th><th>Today</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.code}>
                <td><div className="ticker-code">{r.code}</div></td>
                <td>{r.qty.toLocaleString("en-AU")}</td>
                <td style={{ fontFamily: "var(--fm)" }}>
                  {r.price == null ? <span style={{ color: "var(--muted)" }}>—</span> : fD(r.price)}
                </td>
                <td>{r.val == null ? <span style={{ color: "var(--muted)" }}>—</span> : fD(r.val)}</td>
                <td>{fD(r.cost)}</td>
                <td><PnL val={r.pnl} pct={r.pnlPct} /></td>
                <td><PnL val={r.dayC} pct={r.dayP} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="updated-footer">
        {updated ? `Last updated ${updated.toLocaleDateString("en-AU")} at ${updated.toLocaleTimeString("en-AU")}` : "Not yet updated"}
      </div>
    </>
  );
}

function SettingsPage({ holdings, form, setForm, editIdx, formErr, onSave, onCancel, onEdit, onRemove }) {
  return (
    <div className="settings-grid">
      <div className="panel">
        <div className="panel-title">{editIdx != null ? "Edit Holding" : "Add Holding"}</div>

        <label className="lbl">ASX Code</label>
        <input className="inp" placeholder="e.g. CBA, BHP, WES" value={form.code} disabled={editIdx != null}
          onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} />

        <label className="lbl">Number of Shares</label>
        <input className="inp" type="number" min="0" inputMode="decimal" placeholder="e.g. 100" value={form.qty}
          onChange={(e) => setForm((f) => ({ ...f, qty: e.target.value }))} />

        <label className="lbl">Total Cost Paid (AUD, inc. brokerage)</label>
        <input className="inp" type="number" min="0" step="0.01" inputMode="decimal" placeholder="e.g. 1500.00" value={form.cost}
          onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))} />

        {formErr && <div className="form-err">⚠ {formErr}</div>}

        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button className="btn-accent" style={{ flex: 1 }} onClick={onSave}>{editIdx != null ? "Update" : "Add Holding"}</button>
          {editIdx != null && <button className="btn-ghost" onClick={onCancel}>Cancel</button>}
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">Your Holdings ({holdings.length})</div>
        {!holdings.length
          ? <div style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: "30px 0" }}>None added yet.</div>
          : holdings.map((h, i) => (
            <div className="holding-row" key={h.code}>
              <div>
                <div className="ticker-code">{h.code}</div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>{h.qty.toLocaleString()} shares · cost {fD(h.cost)}</div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button className="icon-btn" onClick={() => onEdit(i)}>✎</button>
                <button className="icon-btn del" onClick={() => onRemove(i)}>✕</button>
              </div>
            </div>
          ))
        }
      </div>
    </div>
  );
}
