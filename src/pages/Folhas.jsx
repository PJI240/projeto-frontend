// src/pages/Folhas.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowPathIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ClipboardDocumentListIcon,
  CloudArrowDownIcon,
  LockClosedIcon,
  LockOpenIcon,
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/24/solid";

const API_BASE = (import.meta.env.VITE_API_BASE?.replace(/\/+$/, "") || "");

/* ====== Utils ====== */
const monthToISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const fromMonthISO = (s) => {
  const [y, m] = String(s || "").split("-").map(Number);
  return y && m ? new Date(y, m - 1, 1) : null;
};
const formatMonthBR = (sISO) => {
  const d = fromMonthISO(sISO);
  return d ? d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) : (sISO || "");
};
const toCSV = (rows) => {
  if (!rows?.length) return "";
  const keys = Object.keys(rows[0]);
  return [keys.join(";"),
    ...rows.map(r => keys.map(k => `"${String(r[k] ?? "").replace(/"/g,'""')}"`).join(";"))
  ].join("\n");
};

/* ====== API helper ====== */
function useApi() {
  return useCallback(async (path, init = {}) => {
    const r = await fetch(`${API_BASE}${path}`, { credentials: "include", ...init });
    let data = null;
    try { data = await r.json(); } catch {}
    if (!r.ok || data?.ok === false) throw new Error(data?.error || `HTTP ${r.status}`);
    return data;
  }, []);
}

/* ====== Página ====== */
export default function Folhas() {
  const api = useApi();
  const liveRef = useRef(null);

  // filtros
  const [periodo, setPeriodo] = useState("mes");
  const [from, setFrom] = useState(() => monthToISO(new Date()));
  const [to, setTo] = useState(() => monthToISO(new Date()));
  const [statusFiltro, setStatusFiltro] = useState("todos");
  const [q, setQ] = useState("");

  // dados
  const [folhas, setFolhas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [sucesso, setSucesso] = useState("");

  // modal
  const [openModal, setOpenModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    competencia: monthToISO(new Date()),
    status: "ABERTA",
  });

  /* ====== load ====== */
  const carregar = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const d = await api(`/api/folhas?scope=mine`);
      setFolhas(Array.isArray(d.folhas) ? d.folhas : []);
      if (liveRef.current) liveRef.current.textContent = "Folhas atualizadas.";
    } catch (e) {
      setErr(e.message || "Falha ao carregar folhas.");
      if (liveRef.current) liveRef.current.textContent = "Erro ao atualizar folhas.";
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { carregar(); }, [carregar]);

  /* ====== filtros aplicados ====== */
  const folhasFiltradas = useMemo(() => {
    const dFrom = fromMonthISO(from);
    const dTo = fromMonthISO(to);
    const lo = dFrom ? dFrom.getTime() : -Infinity;
    const hi = dTo ? dTo.getTime() : Infinity;
    const qq = (q || "").toLowerCase();

    return folhas
      .filter((f) => {
        const t = fromMonthISO(f.competencia)?.getTime() ?? 0;
        if (t < lo || t > hi) return false;
        const st = String(f.status || "").toUpperCase();
        if (statusFiltro === "abertas" && st !== "ABERTA") return false;
        if (statusFiltro === "fechadas" && st !== "FECHADA") return false;
        if (qq) {
          const alvo = `${f.id} ${f.competencia} ${formatMonthBR(f.competencia)} ${st}`.toLowerCase();
          if (!alvo.includes(qq)) return false;
        }
        return true;
      })
      .sort((a, b) => (a.competencia < b.competencia ? 1 : -1));
  }, [folhas, from, to, statusFiltro, q]);

  /* ====== KPIs ====== */
  const kpis = useMemo(() => {
    const total = folhasFiltradas.length;
    const abertas = folhasFiltradas.filter((f) => String(f.status).toUpperCase() === "ABERTA").length;
    return { total, abertas, fechadas: total - abertas };
  }, [folhasFiltradas]);

  /* ====== handlers ====== */
  function atalhoPeriodo(p) {
    setPeriodo(p);
    const hoje = new Date();
    if (p === "hoje") { const m = monthToISO(hoje); setFrom(m); setTo(m); return; }
    if (p === "semana") {
      const d = new Date(hoje);
      const diff = (d.getDay() + 6) % 7;
      const ini = new Date(d); ini.setDate(d.getDate() - diff);
      const fim = new Date(ini); fim.setDate(ini.getDate() + 6);
      setFrom(monthToISO(ini)); setTo(monthToISO(fim)); return;
    }
    setFrom(monthToISO(hoje)); setTo(monthToISO(hoje));
  }

  function abrirNovo() {
    setEditing(null);
    setForm({ competencia: monthToISO(new Date()), status: "ABERTA" });
    setOpenModal(true);
  }

  function abrirEditar(f) {
    setEditing(f);
    setForm({ competencia: f.competencia, status: String(f.status || "ABERTA").toUpperCase() });
    setOpenModal(true);
  }

  async function salvar() {
    setErr(""); setSucesso("");
    try {
      const payload = { competencia: form.competencia, status: form.status || "ABERTA" };
      // IMPORTANTE: não enviar empresa_id — backend resolve pela empresa do usuário logado

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
    setErr(""); setSucesso("");
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
      empresa_id: f.empresa_id, // apenas exibição/relatório
      competencia: f.competencia,
      competencia_br: formatMonthBR(f.competencia),
      status: String(f.status || "").toUpperCase(),
    }));
    const csv = toCSV(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), {
      href: url,
      download: `folhas_${from}_a_${to}.csv`,
    });
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  /* ====== UI ====== */
  return (
    <>
      <div ref={liveRef} aria-live="polite" className="sr-only" />

      <header className="page-header">
        <div>
          <h1 className="page-title">Folhas</h1>
          <p className="page-subtitle">Gerencie competências, status e exportações</p>
        </div>

        <div className="page-header__toolbar">
          <div className="segmented">
            <button className={`btn ${periodo === "hoje" ? "is-active" : ""}`} onClick={() => atalhoPeriodo("hoje")}>
              <CalendarDaysIcon className="icon" /> Hoje
            </button>
            <button className={`btn ${periodo === "semana" ? "is-active" : ""}`} onClick={() => atalhoPeriodo("semana")}>
              Semana
            </button>
            <button className={`btn ${periodo === "mes" ? "is-active" : ""}`} onClick={() => atalhoPeriodo("mes")}>
              Mês
            </button>
          </div>

          <div className="filters">
            <input type="month" className="input input--sm" value={from} onChange={(e) => setFrom(e.target.value)} />
            <input type="month" className="input input--sm" value={to} onChange={(e) => setTo(e.target.value)} />
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
            <button className="btn" onClick={abrirNovo}><PlusIcon className="icon" /> Novo</button>
            <button className="btn" onClick={exportarCSV}><CloudArrowDownIcon className="icon" /> Exportar</button>
            <button className="btn" onClick={carregar} disabled={loading} aria-busy={loading}>
              {loading ? <span className="spinner" /> : <ArrowPathIcon className="icon" />} {loading ? "Atualizando…" : "Atualizar"}
            </button>
          </div>
        </div>
      </header>

      {err && <div className="error-alert">{err}</div>}
      {sucesso && <div className="success-alert">{sucesso}</div>}

      {/* KPIs */}
      <div className="stats-grid">
        <div className="stat-card" data-accent="info">
          <div className="stat-card__icon"><ClipboardDocumentListIcon className="icon" /></div>
          <div className="stat-card__content"><div className="stat-value">{kpis.total}</div><div className="stat-title">Folhas no período</div></div>
        </div>
        <div className="stat-card" data-accent="success">
          <div className="stat-card__icon"><LockOpenIcon className="icon" /></div>
          <div className="stat-card__content"><div className="stat-value">{kpis.abertas}</div><div className="stat-title">Abertas</div></div>
        </div>
        <div className="stat-card" data-accent="warning">
          <div className="stat-card__icon"><LockClosedIcon className="icon" /></div>
          <div className="stat-card__content"><div className="stat-value">{kpis.fechadas}</div><div className="stat-title">Fechadas</div></div>
        </div>
      </div>

      {/* Tabela */}
      <section className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>ID</th><th>Competência</th><th>Status</th><th>Empresa</th><th className="text-right">Ações</th></tr>
          </thead>
          <tbody>
            {folhasFiltradas.length === 0 && (
              <tr><td colSpan={5} className="empty">Nenhuma folha encontrada para o filtro.</td></tr>
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
                <td>{f.empresa_id ?? "-" /* só leitura */}</td>
                <td className="text-right">
                  <div className="row-actions">
                    <button className="btn btn--icon" title="Editar" onClick={() => abrirEditar(f)}><CheckCircleIcon className="icon" /></button>
                    <button className="btn btn--icon" title={String(f.status).toUpperCase() === "ABERTA" ? "Fechar" : "Reabrir"} onClick={() => alternarStatus(f)}>
                      {String(f.status).toUpperCase() === "ABERTA" ? <LockClosedIcon className="icon" /> : <LockOpenIcon className="icon" />}
                    </button>
                    <button className="btn btn--icon" title="Excluir" onClick={() => excluir(f)}><TrashIcon className="icon" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Cards (mobile) */}
      <div className="cards">
        {folhasFiltradas.map((f) => (
          <article key={`card-${f.id}`} className="card">
            <header className="card__header">
              <strong>{formatMonthBR(f.competencia)}</strong>
              <span className={`badge ${String(f.status).toUpperCase() === "ABERTA" ? "badge--green" : "badge--yellow"}`}>
                {String(f.status || "").toUpperCase()}
              </span>
            </header>
            <dl className="card__meta">
              <div><dt>ID</dt><dd>#{f.id}</dd></div>
              <div><dt>Empresa</dt><dd>{f.empresa_id ?? "-"}</dd></div>
            </dl>
            <footer className="card__actions">
              <button className="btn" onClick={() => abrirEditar(f)}>Editar</button>
              <button className="btn" onClick={() => alternarStatus(f)}>
                {String(f.status).toUpperCase() === "ABERTA" ? "Fechar" : "Reabrir"}
              </button>
              <button className="btn" onClick={() => excluir(f)}>Excluir</button>
            </footer>
          </article>
        ))}
      </div>

      {/* Modal (sem empresa_id no form/payload) */}
      {openModal && (
        <div role="dialog" aria-modal="true" className="modal" onClick={(e) => e.target === e.currentTarget && setOpenModal(false)}>
          <div className="modal__content">
            <header className="modal__header">
              <h2 className="modal__title">{editing ? "Editar Folha" : "Nova Folha"}</h2>
              <button className="btn btn--icon" onClick={() => setOpenModal(false)} aria-label="Fechar">✕</button>
            </header>
            <div className="modal__body">
              <div className="form-grid">
                <div className="form-field">
                  <label className="form-label">Competência *</label>
                  <input type="month" className="input" value={form.competencia}
                         onChange={(e) => setForm({ ...form, competencia: e.target.value })} required />
                </div>
                <div className="form-field">
                  <label className="form-label">Status *</label>
                  <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    <option value="ABERTA">ABERTA</option>
                    <option value="FECHADA">FECHADA</option>
                  </select>
                </div>
              </div>
              {editing && (
                <p className="muted" style={{ marginTop: 8 }}>
                  Empresa: <strong>{editing.empresa_id ?? "-"}</strong> (definida automaticamente)
                </p>
              )}
            </div>
            <footer className="modal__footer">
              <button className="btn" onClick={() => setOpenModal(false)}>Cancelar</button>
              <button className="btn" onClick={salvar}><CheckCircleIcon className="icon" /> {editing ? "Salvar" : "Adicionar"}</button>
            </footer>
          </div>
        </div>
      )}

      {/* estilos mínimos */}
      <style jsx>{`
        .sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
        .page-header{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px}
        .page-title{margin:0}
        .page-header__toolbar{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
        .segmented,.filters,.actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
        .btn{display:inline-flex;gap:6px;align-items:center;border:1px solid var(--border);background:var(--panel);padding:8px 12px;border-radius:8px}
        .btn--icon{padding:6px}
        .icon{width:18px;height:18px}
        .input{border:1px solid var(--border);border-radius:8px;padding:8px 10px;background:var(--panel)}
        .input--sm{padding:6px 8px}
        .error-alert{background:#fee;border:1px solid #f99;border-radius:8px;padding:10px 12px}
        .success-alert{background:#eefaf0;border:1px solid #b5ebc2;border-radius:8px;padding:10px 12px}
        .stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin:14px 0}
        .stat-card{background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:14px;display:flex;gap:12px;align-items:center}
        .stat-card__icon{width:44px;height:44px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:var(--panel-muted)}
        .stat-value{font-weight:700;font-size:1.4rem}
        .stat-title{color:var(--muted)}
        .table-wrap{overflow:auto;border:1px solid var(--border);border-radius:8px;background:var(--panel)}
        .table{width:100%;min-width:720px;border-collapse:collapse}
        th,td{padding:12px;border-bottom:1px solid var(--border);text-align:left}
        th{background:var(--panel-muted);color:var(--muted);font-weight:600}
        .row-actions{display:flex;gap:6px;justify-content:flex-end}
        .badge{display:inline-flex;align-items:center;padding:2px 8px;font-size:12px;border-radius:999px;border:1px solid var(--border);background:var(--panel-muted)}
        .badge--green{background:rgba(16,185,129,.15);color:var(--success)}
        .badge--yellow{background:rgba(245,158,11,.15);color:var(--warning)}
        .empty{text-align:center;color:var(--muted);padding:28px 12px}
        .cards{display:none}
        .card{background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:12px}
        .card__header{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
        .card__meta{display:grid;grid-template-columns:1fr 1fr;gap:8px}
        .card__actions{display:flex;gap:8px;margin-top:8px}
        .modal{position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;padding:16px;z-index:1000}
        .modal__content{width:min(560px,100%);background:var(--panel);border:1px solid var(--border);border-radius:12px}
        .modal__header,.modal__footer{padding:14px 16px;border-bottom:1px solid var(--border)}
        .modal__footer{border-top:1px solid var(--border);border-bottom:0;display:flex;gap:8px;justify-content:flex-end}
        .modal__body{padding:16px}
        .form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .form-field{display:flex;flex-direction:column;gap:6px}
        @media(max-width:900px){.table-wrap{display:none}.cards{display:block}.form-grid{grid-template-columns:1fr}}
      `}</style>
    </>
  );
}