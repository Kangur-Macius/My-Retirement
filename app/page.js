"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import "./globals.css";

const STORAGE_KEY = "asxfolio_holdings_v2";
const REFRESH_MS  = 60000;

const DEFAULT_HOLDINGS = [
  { code: "AMC", qty: 300,   purchasePrice: 55.55, cost: 16665.00, owner: "MJ"  },
  { code: "BHP", qty: 300,   purchasePrice: 37.79, cost: 11337.00, owner: "MJ"  },
  { code: "BOQ", qty: 2000,  purchasePrice: 6.82,  cost: 13640.00, owner: "MJ"  },
  { code: "EDV", qty: 6000,  purchasePrice: 3.78,  cost: 22680.00, owner: "MJ"  },
  { code: "FMG", qty: 1000,  purchasePrice: 18.13, cost: 18130.00, owner: "MJ"  },
  { code: "HVN", qty: 4000,  purchasePrice: 4.79,  cost: 19160.00, owner: "MJ"  },
  { code: "WBC", qty: 100,   purchasePrice: 39.70, cost: 3970.00,  owner: "MJ"  },
  { code: "WTC", qty: 250,   purchasePrice: 30.26, cost: 7565.00,  owner: "MJ"  },
  { code: "LGP", qty: 20000, purchasePrice: 0.091, cost: 1820.00,  owner: "Nik" },
  { code: "RMD", qty: 100,   purchasePrice: 26.67, cost: 2667.00,  owner: "Nik" },
  { code: "TWE", qty: 1500,  purchasePrice: 4.62,  cost: 6930.00,  owner: "Nik" },
];

function loadHoldings() {
  if (typeof window === "undefined") return DEFAULT_HOLDINGS;
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!raw || !raw.length) return DEFAULT_HOLDINGS;
    return raw.map(h => ({ ...h, owner: h.owner ?? "MJ" }));
  } catch { return DEFAULT_HOLDINGS; }
}
function saveHoldings(h) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(h)); } catch {}
}

const f2   = n => n == null ? "—" : Math.abs(n).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const f0   = n => n == null ? "—" : Math.abs(n).toLocaleString("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fD   = n => n == null ? "—" : `$${f2(n)}`;
const fD0  = n => n == null ? "—" : `$${f0(n)}`;
const fS0  = n => n == null ? "—" : `${n >= 0 ? "+" : "−"}$${f0(n)}`;
const fPct = n => n == null ? "" : `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

function PnL({ val, pct }) {
  if (val == null) return <span style={{ color: "var(--muted)" }}>—</span>;
  const pos = val >= 0;
  return (
    <span>
      <span className={`badge ${pos ? "badge-pos" : "badge-neg"}`}>{pos ? "▲" : "▼"} {fD(val)}</span>
      {pct != null && <span className="pct" style={{ color: pos ? "var(--green)" : "var(--red)" }}>{fPct(pct)}</span>}
    </span>
  );
}

export default function Home() {
  const [page,     setPage]     = useState("portfolio");
  const [holdings, setHoldings] = useState([]);
  const [prices,   setPrices]   = useState({});
  const [loading,  setLoading]  = useState(false);
  const [updated,  setUpdated]  = useState(null);
  const [error,    setError]    = useState(null);
  const [form,     setForm]     = useState({ code: "", qty: "", purchasePrice: "" });
  const [editIdx,  setEditIdx]  = useState(null);
  const [formErr,  setFormErr]  = useState("");

  useEffect(() => { setHoldings(loadHoldings()); }, []);

  const fetchPrices = useCallback(async (list) => {
    if (!list.length) { setPrices({}); return; }
    setLoading(true); setError(null);
    try {
      const codes = list.map(h => h.code.toUpperCase()).join(",");
      const res = await fetch(`/api/prices?codes=${encodeURIComponent(codes)}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? `Request failed (${res.status})`);
      } else {
        setPrices(data.prices ?? {});
        if (data.errors && Object.keys(data.errors).length)
          setError(`Some prices unavailable — ${Object.entries(data.errors).map(([c,e]) => `${c}: ${e}`).join(", ")}`);
      }
      setUpdated(new Date());
    } catch (err) { setError(err?.message ?? "Network error"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (holdings.length) fetchPrices(holdings); }, [holdings, fetchPrices]);
  useEffect(() => {
    if (!holdings.length) return;
    const t = setInterval(() => fetchPrices(holdings), REFRESH_MS);
    return () => clearInterval(t);
  }, [holdings, fetchPrices]);

  function updateHoldings(next) { setHoldings(next); saveHoldings(next); }

  function saveForm(owner) {
    const code          = form.code.trim().toUpperCase();
    const qty           = parseFloat(form.qty);
    const purchasePrice = parseFloat(form.purchasePrice);
    if (!code)                                   return setFormErr("Enter an ASX code.");
    if (isNaN(qty) || qty <= 0)                  return setFormErr("Enter a valid quantity.");
    if (isNaN(purchasePrice) || purchasePrice < 0) return setFormErr("Enter a valid purchase price.");
    if (editIdx == null && holdings.some(h => h.code.toUpperCase() === code))
      return setFormErr(`${code} is already in your portfolio.`);
    setFormErr("");
    const cost = +(qty * purchasePrice).toFixed(2);
    updateHoldings(
      editIdx == null
        ? [...holdings, { code, qty, cost, purchasePrice, owner }]
        : holdings.map((h, i) => i === editIdx ? { code, qty, cost, purchasePrice, owner: h.owner } : h)
    );
    setEditIdx(null);
    setForm({ code: "", qty: "", purchasePrice: "" });
  }
  function startEdit(i) {
    const h = holdings[i];
    setForm({ code: h.code, qty: String(h.qty), purchasePrice: String(h.purchasePrice ?? (h.cost / h.qty).toFixed(4)) });
    setEditIdx(i); setFormErr(""); setPage("settings");
  }
  function cancelEdit() { setEditIdx(null); setForm({ code: "", qty: "", purchasePrice: "" }); setFormErr(""); }
  function remove(i)    { updateHoldings(holdings.filter((_, j) => j !== i)); }

  const rows = useMemo(() => holdings.map(h => {
    const code  = h.code.toUpperCase();
    const p     = prices[code];
    const price = p?.price ?? null;
    const prev  = p?.prev  ?? null;
    const val   = price != null ? price * h.qty : null;
    const pnl   = val   != null ? val - h.cost  : null;
    const pnlPct = h.cost > 0 && pnl != null ? (pnl / h.cost) * 100 : null;
    const dayC  = price != null && prev != null ? (price - prev) * h.qty : null;
    const dayP  = price != null && prev != null ? ((price - prev) / prev) * 100 : null;
    return { code, qty: h.qty, cost: h.cost, purchasePrice: h.purchasePrice, owner: h.owner ?? "MJ", price, val, pnl, pnlPct, dayC, dayP };
  }), [holdings, prices]);

  const totCost   = rows.reduce((s, r) => s + r.cost, 0);
  const totVal    = rows.length && rows.every(r => r.val  != null) ? rows.reduce((s, r) => s + r.val,  0) : null;
  const totPnl    = totVal != null ? totVal - totCost : null;
  const totPnlPct = totCost > 0 && totPnl != null ? (totPnl / totCost) * 100 : null;
  const totDay    = rows.length && rows.every(r => r.dayC != null) ? rows.reduce((s, r) => s + r.dayC, 0) : null;

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
      <button className="btn-mj" style={{ flex: "none" }} onClick={onGoSettings}>Go to Settings →</button>
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

      {error && <div className="err-box"><span>⚠ {error}</span><button className="err-retry" onClick={onRefresh}>Retry</button></div>}

      <div className="cards">
        {[
          ["Total Invested", fD0(totCost), "", null],
          ["Market Value",   totVal == null ? "—" : fD0(totVal), "Live", null],
          ["Total P&L",      totPnl == null ? "—" : fS0(totPnl), totPnlPct != null ? fPct(totPnlPct) : "", pPos],
          ["Today's Move",   totDay == null ? "—" : fS0(totDay), "vs prior close", totDay == null ? null : totDay >= 0],
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
            {rows.map(r => (
              <tr key={r.code + r.owner}>
                <td>
                  <div className={r.owner === "MJ" ? "ticker-code-mj" : "ticker-code-nik"}>{r.code}</div>
                  <div className={r.owner === "MJ" ? "owner-tag owner-tag-mj" : "owner-tag owner-tag-nik"}>{r.owner}</div>
                </td>
                <td>{r.qty.toLocaleString("en-AU")}</td>
                <td style={{ fontFamily: "var(--fm)" }}>{r.price == null ? <span style={{ color: "var(--muted)" }}>—</span> : fD(r.price)}</td>
                <td>{r.val  == null ? <span style={{ color: "var(--muted)" }}>—</span> : fD(r.val)}</td>
                <td>{fD(r.cost)}</td>
                <td><PnL val={r.pnl}  pct={r.pnlPct} /></td>
                <td><PnL val={r.dayC} pct={r.dayP}   /></td>
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
        <input className="inp" placeholder="e.g. BHP, CBA, WES" value={form.code} disabled={editIdx != null}
          onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} />

        <label className="lbl">Number of Shares</label>
        <input className="inp" type="number" min="0" inputMode="decimal" placeholder="e.g. 100" value={form.qty}
          onChange={e => setForm(f => ({ ...f, qty: e.target.value }))} />

        <label className="lbl">Purchase Price Per Share ($)</label>
        <input className="inp" type="number" min="0" step="0.001" inputMode="decimal" placeholder="e.g. 45.20" value={form.purchasePrice}
          onChange={e => setForm(f => ({ ...f, purchasePrice: e.target.value }))} />

        {formErr && <div className="form-err">⚠ {formErr}</div>}

        {editIdx != null ? (
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button className="btn-mj" onClick={() => onSave(holdings[editIdx]?.owner ?? "MJ")}>Update</button>
            <button className="btn-ghost" onClick={onCancel}>Cancel</button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button className="btn-mj"  onClick={() => onSave("MJ")}>Add MJ</button>
            <button className="btn-nik" onClick={() => onSave("Nik")}>Add Nik</button>
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-title">Your Holdings ({holdings.length})</div>
        {!holdings.length
          ? <div style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: "30px 0" }}>None added yet.</div>
          : holdings.map((h, i) => (
            <div className={`holding-row ${h.owner === "MJ" ? "holding-row-mj" : "holding-row-nik"}`} key={i}>
              <div>
                <div className={h.owner === "MJ" ? "ticker-code-mj" : "ticker-code-nik"}>{h.code}</div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>
                  {h.owner} · {h.qty.toLocaleString()} shares · @ {fD(h.purchasePrice ?? (h.cost / h.qty))}
                </div>
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
