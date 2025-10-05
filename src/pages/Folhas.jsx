// src/pages/Folhas.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowPathIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClipboardDocumentListIcon,
  CloudArrowDownIcon,
  ExclamationTriangleIcon,
  LockClosedIcon,
  LockOpenIcon,
  PlusIcon,
  TrashIcon,
  UserGroupIcon,
} from "@heroicons/react/24/solid";

/* ====== API base ====== */
const API_BASE = (import.meta.env.VITE_API_BASE?.replace(/\/+$/, "") || "");

/* ====== Utils ====== */
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

function monthToISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}
function fromMonthISO(s) {
  // espera "YYYY-MM"
  const [y, m] = String(s || "").split("-").map(Number);
  if (!y || !m) return null;
  return new Date(y, m - 1, 1);
}
function formatMonthBR(sISO) {
  const d = fromMonthISO(sISO);
  if (!d) return sISO || "";
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}
function toCSV(rows) {
  if (!rows?.length) return "";
  const keys = Object.keys(rows[0]);
  const header = keys.join(";");
  const body = rows
    .map((r) =>
      keys
        .map((k) => {
          const v = r[k] ?? "";
          const s = typeof v === "string" ? v.replaceAll('"', '""') : String(v);
          return `"${s}"`;
        })
        .join(";")
    )
    .join("\n");
  return header + "\n" + body;
}

/* ====== API helper ====== */
function useApi() {
  return useCallback(async (path, init = {}) => {
    const url = `${API_BASE}${path}`;
    const r = await fetch(url, { credentials: "include", ...init });
    let data = null;
    try {
      data = await r.json();
    } catch {
      /* no-op */
    }
    if (!r.ok || data?.ok === false) {
      throw new Error(data?.error || `HTTP ${r.status}`);
    }
    return data;
  }, []);
}

/* ====== Página ====== */
export default function Folhas() {
  const api = useApi();
  const liveRef = useRef(null);

  // filtros
  const [periodo, setPeriodo] = useState("mes"); // 'hoje' | 'semana' | 'mes' (usado só p/ atalhos do filtro)
  const [from, setFrom] = useState(() => monthToISO(new Date()));
  const [to, setTo] = useState(() => monthToISO(new Date()));
  const [statusFiltro, setStatusFiltro] = useState("todos"); // todos|abertas|fechadas
  const [q, setQ] = useState("");

  // dados
  const [folhas, setFolhas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const refresher = useRef(null);

  // modal
  const [openModal, setOpenModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    competencia: monthToISO(new Date()),
    status: "ABERTA",
    empresa_id: "", // opcional, depende do papel
  });

  /* ====== load ====== */
  const carregar = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const d = await api(`/api/folhas?scope=mine`);
      setFolhas(Array.isArray(d.folhas) ? d.folhas : []);
      liveRef.current && (liveRef.current.textContent = "Folhas atualizadas.");
    } catch (e) {
      setErr(e.message || "Falha ao carregar folhas.");
      liveRef.current && (liveRef.current.textContent = "Erro ao atualizar folhas.");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    if (autoRefresh) {
      refresher.current = setInterval(() => carregar(), 60000);
    } else if (refresher.current) {
      clearInterval(refresher.current);
    }
    return () => refresher.current && clearInterval(refresher.current);
  }, [autoRefresh, carregar]);

  /* ====== filtros aplicados ====== */
  const folhasFiltradas = useMemo(() => {
    const dFrom = fromMonthISO(from);
    const dTo = fromMonthISO(to);
    const lo = dFrom ? dFrom.getTime() : -Infinity;
    const hi = dTo ? dTo.getTime() : Infinity;

    const qNorm = (q || "").toLowerCase();

    return folhas
      .filter((f) => {
        // competência em range (compara mês)
        const d = fromMonthISO(f.competencia);
        const t = d ? d.getTime() : 0;
        if (t < lo || t > hi) return false;

        // status
        const st = String(f.status || "").toUpperCase();
        if (statusFiltro === "abertas" && st !== "ABERTA") return false;
        if (statusFiltro === "fechadas" && st !== "FECHADA") return false;

        // busca
        if (qNorm) {
          const alvo =
            `${f.id} ${f.competencia} ${formatMonthBR(f.competencia)} ${f.status}`.toLowerCase();
          if (!alvo.includes(qNorm)) return false;
        }
        return true;
      })
      .sort((a, b) => (a.competencia < b.competencia ? 1 : -1));
  }, [folhas, from, to, statusFiltro, q]);

  /* ====== KPIs ====== */
  const kpis = useMemo(() => {
    const total = folhasFiltradas.length;
    const abertas = folhasFiltradas.filter((f) => String(f.status).toUpperCase() === "ABERTA").length;
    const fechadas = total - abertas;
    return { total, abertas, fechadas };
  }, [folhasFiltradas]);

  /* ====== handlers ====== */
  function atalhoPeriodo(p) {
    setPeriodo(p);
    const hoje = new Date();
    if (p === "hoje") {
      const m = monthToISO(hoje);
      setFrom(m);
      setTo(m);
      return;
    }
    if (p === "semana") {
      // pega mês do início e do fim da semana — simplificado
      const d = new Date(hoje);
      const diff = (d.getDay() + 6) % 7;
      const ini = new Date(d);
      ini.setDate(d.getDate() - diff);
      const fim = new Date(ini);
      fim.setDate(ini.getDate() + 6);
      setFrom(monthToISO(ini));
      setTo(monthToISO(fim));
      return;
    }
    // mês atual
    setFrom(monthToISO(hoje));
    setTo(monthToISO(hoje));
  }

  function abrirNovo() {
    setEditing(null);
    setForm({
      competencia: monthToISO(new Date()),
      status: "ABERTA",
      empresa_id: "",
    });
    setOpenModal(true);
  }

  function abrirEditar(f) {
    setEditing(f);
    setForm({
      competencia: f.competencia,
      status: String(f.status || "ABERTA").toUpperCase(),
      empresa_id: f.empresa_id ?? "",
    });
    setOpenModal(true);
  }

  async function salvar() {
    setErr("");
    setSucesso("");
    try {
      const payload = {
        competencia: form.competencia,
        status: form.status || "ABERTA",
      };
      if (form.empresa_id) payload.empresa_id = Number(form.empresa_id);

      if (editing) {
        await api(`/api/folhas/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        setSucesso("Folha atualizada com sucesso!");
      } else {
        await api(`/api/folhas`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        setSucesso("Folha criada com sucesso!");
      }
      setOpenModal(false);
      await carregar();
    } catch (e) {
      setErr(e.message || "Falha ao salvar folha.");
    }
  }

  async function excluir(f) {
    if (!confirm(`Remover a folha de ${formatMonthBR(f.competencia)}?`)) return;
    setErr("");
    setSucesso("");
    try {
      await api(`/api/folhas/${f.id}`, { method: "DELETE" });
      setSucesso("Folha excluída.");
      await carregar();
    } catch (e) {
      setErr(e.message || "Falha ao excluir.");
    }
  }

  async function alternarStatus(f) {
    const novo = String(f.status || "ABERTA").toUpperCase() === "ABERTA" ? "FECHADA" : "ABERTA";
    try {
      await api(`/api/folhas/${f.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: novo }),
      });
      await carregar();
    } catch (e) {
      setErr(e.message || "Falha ao alterar status.");
    }
  }

  function exportarCSV() {
    const rows = folhasFiltradas.map((f) => ({
      id: f.id,
      empresa_id: f.empresa_id,
      competencia: f.competencia,
      competencia_br: formatMonthBR(f.competencia),
      status: String(f.status || "").toUpperCase(),
    }));
    const csv = toCSV(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `folhas_${from}_a_${to}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  /* ====== UI ====== */
  return (
    <>
      {/* Região viva para leitores de tela */}
      <div ref={liveRef} aria-live="polite" className="visually-hidden" />

      {/* Header */}
      <header className="page-header" role="region" aria-labelledby="titulo-pagina">
        <div>
          <h1 id="titulo-pagina" className="page-title">Folhas</h1>
          <p className="page-subtitle">Gerencie competências, status e exportações</p>
        </div>

        <div className="page-header__toolbar" aria-label="Ações da página">
          <div className="segmented">
            <button
              className={`btn btn--neutral ${periodo === "hoje" ? "is-active" : ""}`}
              onClick={() => atalhoPeriodo("hoje")}
              aria-pressed={periodo === "hoje"}
            >
              <CalendarDaysIcon className="icon" aria-hidden="true" />
              Hoje
            </button>
            <button
              className={`btn btn--neutral ${periodo === "semana" ? "is-active" : ""}`}
              onClick={() => atalhoPeriodo("semana")}
              aria-pressed={periodo === "semana"}
            >
              Semana
            </button>
            <button
              className={`btn btn--neutral ${periodo === "mes" ? "is-active" : ""}`}
              onClick={() => atalhoPeriodo("mes")}
              aria-pressed={periodo === "mes"}
            >
              Mês
            </button>
          </div>

          <div className="filters">
            <label className="sr-only" htmlFor="from">De</label>
            <input id="from" type="month" className="input input--sm" value={from} onChange={(e) => setFrom(e.target.value)} />
            <label className="sr-only" htmlFor="to">Até</label>
            <input id="to" type="month" className="input input--sm" value={to} onChange={(e) => setTo(e.target.value)} />
            <select className="input input--sm" value={statusFiltro} onChange={(e) => setStatusFiltro(e.target.value)}>
              <option value="todos">Todos os status</option>
              <option value="abertas">Abertas</option>
              <option value="fechadas">Fechadas</option>
            </select>
            <input
              type="search"
              className="input input--sm"
              placeholder="Buscar por competência / status…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{ minWidth: 200 }}
            />
          </div>

          <div className="actions">
            <button className="btn btn--neutral" onClick={abrirNovo}>
              <PlusIcon className="icon" aria-hidden="true" />
              Novo
            </button>
            <button className="btn btn--neutral" onClick={exportarCSV}>
              <CloudArrowDownIcon className="icon" aria-hidden="true" />
              Exportar
            </button>
            <button
              className="btn btn--neutral"
              onClick={carregar}
              disabled={loading}
              aria-busy={loading ? "true" : "false"}
              aria-label="Atualizar"
            >
              {loading ? <span className="spinner" aria-hidden="true" /> : <ArrowPathIcon className="icon" aria-hidden="true" />}
              <span>{loading ? "Atualizando…" : "Atualizar"}</span>
            </button>
            <label className="btn btn--neutral" style={{ cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                style={{ marginRight: 6 }}
              />
              Auto Refresh
            </label>
          </div>
        </div>
      </header>

      {/* Alertas */}
      {err && <div className="error-alert" role="alert" style={{ marginBottom: 12 }}>{err}</div>}
      {sucesso && <div className="success-alert" role="status" style={{ marginBottom: 12 }}>{sucesso}</div>}

      {/* KPIs */}
      <div className="stats-grid">
        <div className="stat-card" data-accent="info">
          <div className="stat-card__icon"><ClipboardDocumentListIcon className="icon" aria-hidden="true" /></div>
          <div className="stat-card__content">
            <div className="stat-value">{kpis.total}</div>
            <div className="stat-title">Folhas no período</div>
          </div>
        </div>
        <div className="stat-card" data-accent="success">
          <div className="stat-card__icon"><LockOpenIcon className="icon" aria-hidden="true" /></div>
          <div className="stat-card__content">
            <div className="stat-value">{kpis.abertas}</div>
            <div className="stat-title">Abertas</div>
          </div>
        </div>
        <div className="stat-card" data-accent="warning">
          <div className="stat-card__icon"><LockClosedIcon className="icon" aria-hidden="true" /></div>
          <div className="stat-card__content">
            <div className="stat-value">{kpis.fechadas}</div>
            <div className="stat-title">Fechadas</div>
          </div>
        </div>
      </div>

      {/* Tabela / Cards */}
      <section aria-labelledby="lista-folhas-titulo">
        <h2 id="lista-folhas-titulo" className="sr-only">Lista de folhas</h2>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Competência</th>
                <th>Status</th>
                <th>Empresa</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {folhasFiltradas.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty">Nenhuma folha encontrada para o filtro.</td>
                </tr>
              )}
              {folhasFiltradas.map((f) => (
                <tr key={f.id}>
                  <td>#{f.id}</td>
                  <td>
                    <div className="mono">{formatMonthBR(f.competencia)}</div>
                    <div className="muted">{f.competencia}</div>
                  </td>
                  <td>
                    <span className={`badge ${String(f.status).toUpperCase() === "ABERTA" ? "badge--green" : "badge--yellow"}`}>
                      {String(f.status || "").toUpperCase()}
                    </span>
                  </td>
                  <td>{f.empresa_id ?? "-"}</td>
                  <td className="text-right">
                    <div className="row-actions">
                      <button className="btn btn--neutral btn--icon" title="Editar" onClick={() => abrirEditar(f)}>
                        <CheckCircleIcon className="icon" aria-hidden="true" />
                      </button>
                      <button
                        className="btn btn--neutral btn--icon"
                        title={String(f.status).toUpperCase() === "ABERTA" ? "Fechar" : "Reabrir"}
                        onClick={() => alternarStatus(f)}
                      >
                        {String(f.status).toUpperCase() === "ABERTA" ? (
                          <LockClosedIcon className="icon" aria-hidden="true" />
                        ) : (
                          <LockOpenIcon className="icon" aria-hidden="true" />
                        )}
                      </button>
                      <button className="btn btn--neutral btn--icon" title="Excluir" onClick={() => excluir(f)}>
                        <TrashIcon className="icon" aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Cards (mobile) */}
        <div className="cards">
          {folhasFiltradas.map((f) => (
            <article key={`card-${f.id}`} className="card" aria-label={`Folha ${formatMonthBR(f.competencia)}`}>
              <header className="card__header">
                <div className="card__title">
                  <strong>{formatMonthBR(f.competencia)}</strong>
                  <span className="muted mono">({f.competencia})</span>
                </div>
                <span className={`badge ${String(f.status).toUpperCase() === "ABERTA" ? "badge--green" : "badge--yellow"}`}>
                  {String(f.status || "").toUpperCase()}
                </span>
              </header>
              <dl className="card__meta">
                <div><dt>ID</dt><dd>#{f.id}</dd></div>
                <div><dt>Empresa</dt><dd>{f.empresa_id ?? "-"}</dd></div>
              </dl>
              <footer className="card__actions">
                <button className="btn btn--neutral" onClick={() => abrirEditar(f)}>
                  <CheckCircleIcon className="icon" aria-hidden="true" /> Editar
                </button>
                <button className="btn btn--neutral" onClick={() => alternarStatus(f)}>
                  {String(f.status).toUpperCase() === "ABERTA" ? (
                    <><LockClosedIcon className="icon" aria-hidden="true" /> Fechar</>
                  ) : (
                    <><LockOpenIcon className="icon" aria-hidden="true" /> Reabrir</>
                  )}
                </button>
                <button className="btn btn--neutral" onClick={() => excluir(f)}>
                  <TrashIcon className="icon" aria-hidden="true" /> Excluir
                </button>
              </footer>
            </article>
          ))}
        </div>
      </section>

      {/* Modal */}
      {openModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={editing ? "Editar folha" : "Nova folha"}
          className="modal"
          onClick={(e) => e.target === e.currentTarget && setOpenModal(false)}
        >
          <div className="modal__content">
            <header className="modal__header">
              <h2 className="modal__title">{editing ? "Editar Folha" : "Nova Folha"}</h2>
              <button className="btn btn--neutral btn--icon" onClick={() => setOpenModal(false)} aria-label="Fechar">
                ✕
              </button>
            </header>

            <div className="modal__body">
              <div className="form-grid">
                <div className="form-field">
                  <label className="form-label" htmlFor="f-competencia">Competência *</label>
                  <input
                    id="f-competencia"
                    type="month"
                    value={form.competencia}
                    onChange={(e) => setForm({ ...form, competencia: e.target.value })}
                    className="input"
                    required
                  />
                </div>

                <div className="form-field">
                  <label className="form-label" htmlFor="f-status">Status *</label>
                  <select
                    id="f-status"
                    className="input"
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                  >
                    <option value="ABERTA">ABERTA</option>
                    <option value="FECHADA">FECHADA</option>
                  </select>
                </div>

                <div className="form-field">
                  <label className="form-label" htmlFor="f-empresa">Empresa (opcional)</label>
                  <input
                    id="f-empresa"
                    type="number"
                    className="input"
                    placeholder="empresa_id"
                    value={form.empresa_id}
                    onChange={(e) => setForm({ ...form, empresa_id: e.target.value })}
                    min={0}
                  />
                </div>
              </div>
              <p className="muted" style={{ marginTop: 8 }}>
                <ExclamationTriangleIcon className="icon" style={{ width: 16, height: 16 }} aria-hidden="true" /> Deixe “Empresa” vazio para usar a empresa padrão do usuário.
              </p>
            </div>

            <footer className="modal__footer">
              <button className="btn btn--neutral" onClick={() => setOpenModal(false)}>Cancelar</button>
              <button className="btn btn--neutral" onClick={salvar}>
                <CheckCircleIcon className="icon" aria-hidden="true" />
                {editing ? "Salvar" : "Adicionar"}
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Estilos locais (usando variáveis do global.css) */}
      <style jsx>{`
        .segmented { display:flex; gap:8px; flex-wrap:wrap; }
        .filters { display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
        .actions { display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
        .is-active { outline:2px solid var(--accent); }

        .stats-grid {
          display:grid;
          grid-template-columns: repeat(auto-fit,minmax(220px,1fr));
          gap:16px;
          margin:16px 0 20px;
        }
        .stat-card {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 18px;
          display:flex; align-items:center; gap:14px;
          box-shadow: var(--shadow);
        }
        .stat-card[data-accent="info"] { border-left:4px solid var(--info); }
        .stat-card[data-accent="success"] { border-left:4px solid var(--success); }
        .stat-card[data-accent="warning"] { border-left:4px solid var(--warning); }
        .stat-card__icon { width:44px; height:44px; border-radius:8px; display:flex; align-items:center; justify-content:center; background:var(--panel-muted); }
        .stat-card__content { flex:1; }
        .stat-value { font-size:1.6rem; font-weight:700; line-height:1; }
        .stat-title { font-size:.85rem; color:var(--muted); font-weight:600; }

        .table-wrap { display:block; overflow:auto; border:1px solid var(--border); border-radius:8px; background:var(--panel); box-shadow:var(--shadow); }
        .table { width:100%; border-collapse: collapse; min-width:720px; }
        th, td { padding:12px; border-bottom:1px solid var(--border); text-align:left; }
        th { font-weight:700; font-size:13px; color:var(--muted); background:var(--panel-muted); }
        .text-right { text-align:right; }
        .row-actions { display:flex; gap:6px; justify-content:flex-end; }
        .btn--icon .icon { width:18px; height:18px; }
        .badge { display:inline-flex; align-items:center; padding:2px 8px; font-size:12px; border-radius:999px; border:1px solid var(--border); background:var(--panel-muted); }
        .badge--green { background: rgba(16,185,129,.15); color: var(--success); border-color: color-mix(in srgb,var(--success) 40%, var(--border)); }
        .badge--yellow { background: rgba(245,158,11,.15); color: var(--warning); border-color: color-mix(in srgb,var(--warning) 40%, var(--border)); }
        .muted { color: var(--muted); }
        .mono { font-variant-numeric: tabular-nums; }

        .cards { display:none; }
        .card { background:var(--panel); border:1px solid var(--border); border-radius:12px; padding:12px; display:flex; flex-direction:column; gap:8px; }
        .card + .card { margin-top:12px; }
        .card__header { display:flex; align-items:center; justify-content:space-between; gap:8px; }
        .card__meta { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
        .card__meta dt { font-size:12px; color:var(--muted); }
        .card__meta dd { font-weight:600; }
        .card__actions { display:flex; gap:8px; flex-wrap:wrap; }

        .empty { text-align:center; color:var(--muted); padding:32px 12px; }

        .modal {
          position: fixed; inset: 0; display:flex; align-items:center; justify-content:center;
          background: rgba(0,0,0,.35); z-index:1000; padding: 16px;
        }
        .modal__content { width:min(560px, 100%); background:var(--panel); border:1px solid var(--border); border-radius:12px; box-shadow:var(--shadow); }
        .modal__header, .modal__footer { padding:14px 16px; border-bottom:1px solid var(--border); }
        .modal__footer { border-top:1px solid var(--border); border-bottom:0; display:flex; gap:8px; justify-content:flex-end; }
        .modal__title { margin:0; font-size:18px; }
        .modal__body { padding:16px; }
        .form-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
        .form-field { display:flex; flex-direction:column; gap:6px; }
        .form-label { font-weight:600; font-size:14px; }

        @media (max-width: 900px) {
          .table-wrap { display:none; }
          .cards { display:block; }
          .form-grid { grid-template-columns:1fr; }
        }

        @media (max-width: 640px) {
          .page-header__toolbar { flex-direction:column; align-items:stretch; gap:8px; }
          .segmented, .filters, .actions { width:100%; }
          .segmented .btn, .filters .input, .actions .btn { width:100%; justify-content:center; }
        }
      `}</style>
    </>
  );
}