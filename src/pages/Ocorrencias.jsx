// src/pages/ocorrencias.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CalendarDaysIcon,
  FunnelIcon,
  PlusCircleIcon,
  PencilSquareIcon,
  TrashIcon,
  ArrowPathIcon,
  ArrowDownTrayIcon,
  XMarkIcon,
  UserGroupIcon,
  ClipboardDocumentListIcon,
  ClockIcon,
} from "@heroicons/react/24/solid";

const API_BASE = (import.meta.env.VITE_API_BASE?.replace(/\/+$/, "") || "");

/* =================== Utils de Data/Hora =================== */
function toISO(d) {
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}
function fromISO(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function startOfWeek(d) {
  const dt = new Date(d);
  const day = dt.getDay();
  const diff = (day + 6) % 7; // 0 = Seg
  dt.setDate(dt.getDate() - diff);
  dt.setHours(0, 0, 0, 0);
  return dt;
}
function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function formatDateBR(d) {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function parseNumber(n) {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

/* =================== API helper =================== */
const useApi = () => {
  return useCallback(async (path, init = {}) => {
    const url = `${API_BASE}${path}`;
    const r = await fetch(url, { credentials: "include", ...init });
    let data = null;
    try { data = await r.json(); } catch { /* no-op */ }
    if (!r.ok || data?.ok === false) throw new Error(data?.error || `HTTP ${r.status}`);
    return data;
  }, []);
};

/* =================== Cores por funcionário (via CSS var) =================== */
const CORES_FUNCIONARIOS = [
  "#3b82f6", "#ef4444", "#10b981", "#f59e0b",
  "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16",
  "#f97316", "#6366f1", "#14b8a6", "#84cc16",
  "#eab308", "#a855f7", "#f43f5e", "#0ea5e9",
];
const getCorFuncionario = (id) => {
  const n = Math.abs(Number(id) || 0);
  return CORES_FUNCIONARIOS[n % CORES_FUNCIONARIOS.length];
};

/* =================== Modal acessível =================== */
function Modal({ open, onClose, title, children, footer, size = "medium" }) {
  if (!open) return null;
  const sizes = { small: 380, medium: 560, large: 820, xlarge: 1100 };
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div className="modal-panel" style={{ maxWidth: sizes[size] }}>
        <div className="modal-header">
          <h2 id="modal-title" className="modal-title">{title}</h2>
          <button className="btn btn--neutral btn--icon" aria-label="Fechar" onClick={onClose}>
            <XMarkIcon className="icon" aria-hidden="true" />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>

      <style jsx>{`
        .modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;z-index:1000;padding:16px}
        .modal-panel{width:100%;background:var(--panel);border:1px solid var(--border);border-radius:12px;box-shadow:var(--shadow);max-height:90vh;overflow:auto}
        .modal-header{display:flex;align-items:center;justify-content:space-between;padding:16px;border-bottom:1px solid var(--border)}
        .modal-title{font-size:18px;font-weight:700}
        .modal-body{padding:16px}
        .modal-footer{display:flex;gap:8px;justify-content:flex-end;padding:12px 16px;border-top:1px solid var(--border)}
      `}</style>
    </div>
  );
}

/* =================== Página: Ocorrências =================== */
export default function Ocorrencias() {
  const api = useApi();
  const liveRef = useRef(null);

  /* ------------ Estado UI ------------ */
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth <= 900 : false);
  useEffect(() => {
    const onR = () => setIsMobile(window.innerWidth <= 900);
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, []);

  /* ------------ Filtros ------------ */
  const HOJE = new Date();
  const [periodo, setPeriodo] = useState("semana"); // 'hoje' | 'semana' | 'mes' | 'custom'
  const [de, setDe] = useState(() => {
    if (periodo === "semana") return toISO(startOfWeek(HOJE));
    if (periodo === "mes") return toISO(new Date(HOJE.getFullYear(), HOJE.getMonth(), 1));
    return toISO(HOJE);
  });
  const [ate, setAte] = useState(() => {
    if (periodo === "semana") return toISO(addDays(startOfWeek(HOJE), 6));
    if (periodo === "mes") return toISO(new Date(HOJE.getFullYear(), HOJE.getMonth() + 1, 0));
    return toISO(HOJE);
  });
  const [filtroFuncionario, setFiltroFuncionario] = useState("todos");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [busca, setBusca] = useState("");

  /* ------------ Dados ------------ */
  const [funcionarios, setFuncionarios] = useState([]);
  const [ocorrencias, setOcorrencias] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [sucesso, setSucesso] = useState("");

  /* ------------ Modal CRUD ------------ */
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({
    funcionario_id: "",
    data: toISO(HOJE),
    tipo: "AUSENCIA", // sugestão default
    horas: "",
    obs: "",
  });

  /* ------------ Navegação de período ------------ */
  const aplicarPeriodo = (p) => {
    const hoje = new Date();
    if (p === "hoje") {
      setDe(toISO(hoje));
      setAte(toISO(hoje));
    } else if (p === "semana") {
      const ini = startOfWeek(hoje);
      setDe(toISO(ini));
      setAte(toISO(addDays(ini, 6)));
    } else if (p === "mes") {
      setDe(toISO(new Date(hoje.getFullYear(), hoje.getMonth(), 1)));
      setAte(toISO(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)));
    }
    setPeriodo(p);
  };

  /* ------------ Carregamento ------------ */
  const carregarFuncionarios = useCallback(async () => {
    const d = await api(`/api/funcionarios?ativos=1`);
    setFuncionarios(d.funcionarios || []);
  }, [api]);

  const carregarOcorrencias = useCallback(async () => {
    setLoading(true);
    setErr(""); setSucesso("");
    try {
      const q = (s) => encodeURIComponent(s);
      const qs = `/api/ocorrencias?from=${q(de)}&to=${q(ate)}`
        + (filtroFuncionario !== "todos" ? `&funcionario_id=${q(filtroFuncionario)}` : "")
        + (filtroTipo !== "todos" ? `&tipo=${q(filtroTipo)}` : "")
        + (busca ? `&q=${q(busca)}` : "");
      const r = await api(qs);
      // a API pode retornar {ocorrencias: []} ou []
      const items = Array.isArray(r) ? r : (r.ocorrencias || []);
      setOcorrencias(items);
      if (liveRef.current) liveRef.current.textContent = "Ocorrências atualizadas.";
    } catch (e) {
      setErr(e.message || "Falha ao carregar ocorrências.");
      if (liveRef.current) liveRef.current.textContent = "Erro ao carregar ocorrências.";
    } finally {
      setLoading(false);
    }
  }, [api, de, ate, filtroFuncionario, filtroTipo, busca]);

  const recarregar = useCallback(async () => {
    await Promise.all([carregarFuncionarios(), carregarOcorrencias()]);
  }, [carregarFuncionarios, carregarOcorrencias]);

  useEffect(() => { recarregar(); }, []); // mount
  useEffect(() => { carregarOcorrencias(); }, [de, ate, filtroFuncionario, filtroTipo]); // filtros mudam

  /* ------------ Mapas auxiliares ------------ */
  const mapFunc = useMemo(() => {
    const m = new Map();
    for (const f of funcionarios) {
      m.set(f.id, {
        id: f.id,
        nome: f.pessoa_nome || f?.pessoa?.nome || f.nome || `#${f.id}`,
        cargo: f.cargo_nome || f?.cargo?.nome || "",
        cor: getCorFuncionario(f.id),
      });
    }
    return m;
  }, [funcionarios]);

  /* ------------ KPIs e totais ------------ */
  const kpis = useMemo(() => {
    const total = ocorrencias.length;
    const porTipo = new Map();
    let horasTotal = 0;
    const presentesSet = new Set(); // presença por evento que envolva HORA_EXTRA ou APONTO (depende da sua regra)
    for (const o of ocorrencias) {
      const t = (o.tipo || "OUTRO").toUpperCase();
      porTipo.set(t, (porTipo.get(t) || 0) + 1);
      horasTotal += parseNumber(o.horas);
      // Heurística simples: qualquer ocorrência com 'HORAS' > 0 conta como presença pontual (ajuste se quiser)
      if (parseNumber(o.horas) > 0) presentesSet.add(o.funcionario_id ?? o.funcionarioId ?? o.funcionario);
    }
    return {
      total,
      horasTotal,
      presentes: presentesSet.size,
      porTipo,
    };
  }, [ocorrencias]);

  const porTipoArray = useMemo(() => {
    const arr = [];
    for (const [tipo, qtd] of kpis.porTipo.entries()) {
      arr.push({ tipo, qtd });
    }
    arr.sort((a, b) => b.qtd - a.qtd);
    return arr;
  }, [kpis]);

  /* ------------ Listagem + paginação local ------------ */
  const [page, setPage] = useState(1);
  const pageSize = 12;
  const filtradas = useMemo(() => {
    let arr = ocorrencias.slice();
    if (busca) {
      const q = busca.toLowerCase();
      arr = arr.filter(o => {
        const nome = mapFunc.get(o.funcionario_id)?.nome || "";
        return nome.toLowerCase().includes(q) || (o.obs || "").toLowerCase().includes(q) || (o.tipo || "").toLowerCase().includes(q);
      });
    }
    arr.sort((a, b) => (a.data > b.data ? -1 : 1));
    return arr;
  }, [ocorrencias, busca, mapFunc]);
  const totalPages = Math.max(1, Math.ceil(filtradas.length / pageSize));
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [totalPages]);
  const pageItems = useMemo(() => filtradas.slice((page - 1) * pageSize, page * pageSize), [filtradas, page]);

  /* ------------ CRUD ------------ */
  const abrirNovo = () => {
    setEditando(null);
    setForm({ funcionario_id: "", data: toISO(new Date()), tipo: "AUSENCIA", horas: "", obs: "" });
    setModalAberto(true);
  };
  const abrirEdicao = (o) => {
    setEditando(o);
    setForm({
      funcionario_id: o.funcionario_id,
      data: o.data,
      tipo: o.tipo || "",
      horas: o.horas ?? "",
      obs: o.obs ?? "",
    });
    setModalAberto(true);
  };
  const salvar = async () => {
    setErr(""); setSucesso("");
    try {
      const payload = {
        funcionario_id: Number(form.funcionario_id),
        data: form.data,
        tipo: form.tipo || null,
        horas: form.horas === "" ? null : Number(form.horas),
        obs: form.obs || null,
      };
      if (!payload.funcionario_id || !payload.data) throw new Error("Selecione funcionário e data.");
      if (editando) {
        await api(`/api/ocorrencias/${editando.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        setSucesso("Ocorrência atualizada com sucesso!");
      } else {
        await api(`/api/ocorrencias`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        setSucesso("Ocorrência adicionada com sucesso!");
      }
      setModalAberto(false);
      await carregarOcorrencias();
    } catch (e) {
      setErr(e.message || "Falha ao salvar ocorrência.");
    }
  };
  const excluir = async (o) => {
    if (!confirm(`Remover ocorrência de ${mapFunc.get(o.funcionario_id)?.nome || "#"} no dia ${formatDateBR(fromISO(o.data))}?`)) return;
    setErr(""); setSucesso("");
    try {
      await api(`/api/ocorrencias/${o.id}`, { method: "DELETE" });
      setSucesso("Ocorrência removida com sucesso!");
      await carregarOcorrencias();
    } catch (e) {
      setErr(e.message || "Falha ao excluir ocorrência.");
    }
  };

  /* ------------ Export CSV ------------ */
  const exportarCSV = () => {
    const header = ["id", "data", "funcionario_id", "funcionario_nome", "tipo", "horas", "obs"];
    const linhas = filtradas.map(o => [
      o.id,
      o.data,
      o.funcionario_id,
      mapFunc.get(o.funcionario_id)?.nome || "",
      o.tipo || "",
      (o.horas ?? ""),
      (o.obs ?? "").replace(/\n/g, " ").replace(/;/g, ","),
    ]);
    const csv = [header.join(";")].concat(linhas.map(l => l.join(";"))).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ocorrencias_${de}_a_${ate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ------------ UI helpers ------------ */
  const tiposSugeridos = ["AUSENCIA", "ATESTADO", "FERIAS", "FOLGA", "HORA_EXTRA", "ATRASO", "ABONO", "OUTRO"];

  const badgeTone = (tipo) => {
    const t = String(tipo || "").toUpperCase();
    if (t.includes("HORA")) return "success";
    if (t.includes("ATRASO")) return "warning";
    if (t.includes("AUS") || t.includes("FALTA")) return "error";
    if (t.includes("ATEST")) return "info";
    if (t.includes("FER")) return "accent";
    return "neutral";
  };
  function StatusBadge({ children, tone = "neutral" }) {
    const map = {
      neutral: "badge--neutral",
      success: "badge--success",
      error: "badge--error",
      warning: "badge--warning",
      info: "badge--info",
      accent: "badge--accent",
    };
    const cls = map[tone] || map.neutral;
    return (
      <span className={`badge ${cls}`}>
        {children}
      </span>
    );
  }

  /* =================== RENDER =================== */
  return (
    <>
      {/* Região viva para leitores de tela */}
      <div ref={liveRef} aria-live="polite" className="visually-hidden" />

      {/* HEADER no padrão global - CORRIGIDO */}
      <header className="page-header" role="region" aria-labelledby="titulo-oc">
        <div className="page-header__content">
          <div className="page-header__info">
            <h1 id="titulo-oc" className="page-title">Ocorrências</h1>
            <p className="page-subtitle">Registre e acompanhe ausências, horas extras, atestados e outras ocorrências</p>
          </div>

          <div className="page-header__toolbar" aria-label="Ações da página">
            <button className="btn btn--success" onClick={abrirNovo} aria-label="Criar nova ocorrência">
              <PlusCircleIcon className="icon" aria-hidden="true" />
              <span>Nova Ocorrência</span>
            </button>
            <button className="btn btn--info" onClick={exportarCSV}>
              <ArrowDownTrayIcon className="icon" aria-hidden="true" />
              <span>Exportar</span>
            </button>
            <button
              className="btn btn--neutral"
              onClick={carregarOcorrencias}
              disabled={loading}
              aria-busy={loading ? "true" : "false"}
              aria-label="Atualizar dados"
            >
              {loading ? <span className="spinner" aria-hidden="true" /> : <ArrowPathIcon className="icon" aria-hidden="true" />}
              <span>{loading ? "Atualizando…" : "Atualizar"}</span>
            </button>
          </div>
        </div>

        {/* Filtros abaixo do header principal */}
        <div className="filters-section">
          <div className="filters-group">
            {/* período rápido */}
            <div className="btn-group" role="group" aria-label="Atalhos de período">
              <button className={`btn btn--neutral ${periodo==='hoje' ? 'is-active' : ''}`} onClick={() => aplicarPeriodo("hoje")}>
                <CalendarDaysIcon className="icon" aria-hidden="true" /><span>Hoje</span>
              </button>
              <button className={`btn btn--neutral ${periodo==='semana' ? 'is-active' : ''}`} onClick={() => aplicarPeriodo("semana")}>
                <span>Semana</span>
              </button>
              <button className={`btn btn--neutral ${periodo==='mes' ? 'is-active' : ''}`} onClick={() => aplicarPeriodo("mes")}>
                <span>Mês</span>
              </button>
            </div>

            {/* intervalo custom */}
            <div className="range-inline" role="group" aria-label="Intervalo customizado">
              <input type="date" className="input input--sm" value={de} onChange={(e)=>{ setDe(e.target.value); setPeriodo("custom"); }} />
              <span className="range-sep">—</span>
              <input type="date" className="input input--sm" value={ate} onChange={(e)=>{ setAte(e.target.value); setPeriodo("custom"); }} />
            </div>

            {/* filtros */}
            <div className="filters-inline">
              <FunnelIcon className="icon" aria-hidden="true" />
              <select className="input input--sm" value={filtroFuncionario} onChange={(e)=>setFiltroFuncionario(e.target.value)}>
                <option value="todos">Todos os funcionários</option>
                {funcionarios.map(f => (
                  <option key={f.id} value={f.id}>{f.pessoa_nome || f?.pessoa?.nome || f.nome || `#${f.id}`}</option>
                ))}
              </select>
              <select className="input input--sm" value={filtroTipo} onChange={(e)=>setFiltroTipo(e.target.value)}>
                <option value="todos">Todos os tipos</option>
                {tiposSugeridos.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <input
                className="input input--sm"
                placeholder="Buscar por nome, tipo ou observação…"
                value={busca}
                onChange={(e)=>setBusca(e.target.value)}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Alerts - CORRIGIDOS */}
      {err && <div className="alert alert--error" role="alert" style={{ marginBottom: 12 }}>{err}</div>}
      {sucesso && <div className="alert alert--success" role="status" style={{ marginBottom: 12 }}>{sucesso}</div>}

      {/* KPIs - CORRIGIDOS */}
      <div className="stats-grid">
        <div className="stat-card stat-card--info">
          <div className="stat-card__icon"><ClipboardDocumentListIcon className="icon" aria-hidden="true" /></div>
          <div className="stat-card__content">
            <div className="stat-value">{kpis.total}</div>
            <div className="stat-title">Ocorrências no período</div>
          </div>
        </div>
        <div className="stat-card stat-card--success">
          <div className="stat-card__icon"><ClockIcon className="icon" aria-hidden="true" /></div>
          <div className="stat-card__content">
            <div className="stat-value">{kpis.horasTotal.toFixed(2)}</div>
            <div className="stat-title">Horas acumuladas</div>
          </div>
        </div>
        <div className="stat-card stat-card--warning">
          <div className="stat-card__icon"><UserGroupIcon className="icon" aria-hidden="true" /></div>
          <div className="stat-card__content">
            <div className="stat-value">{kpis.presentes}</div>
            <div className="stat-title">Funcionários impactados</div>
          </div>
        </div>
      </div>

      {/* Totais por tipo */}
      {porTipoArray.length > 0 && (
        <div className="chips-wrap" aria-label="Totais por tipo">
          {porTipoArray.map(({ tipo, qtd }) => (
            <span key={tipo} className="chip" title={`${qtd} ocorrência(s) do tipo ${tipo}`}>
              <StatusBadge tone={badgeTone(tipo)}>{tipo}</StatusBadge>
              <span className="chip__count">{qtd}</span>
            </span>
          ))}
        </div>
      )}

      {/* Tabela / Cards */}
      <div className="table-wrap">
        <div className="table">
          <div className="th th--date">Data</div>
          <div className="th th--func">Funcionário</div>
          <div className="th th--type">Tipo</div>
          <div className="th th--hours">Horas</div>
          <div className="th th--obs">Observação</div>
          <div className="th th--actions">Ações</div>

          {pageItems.map((o) => {
            const f = mapFunc.get(o.funcionario_id);
            return (
              <div key={o.id} className="row">
                <div className="td td--date">{formatDateBR(fromISO(o.data))}</div>
                <div className="td td--func">
                  <span className="dot" style={{ ["--func-color"]: f?.cor || "#999" }} />
                  <span className="td__main">{f?.nome || `#${o.funcionario_id}`}</span>
                  {f?.cargo && <span className="td__sub">{f.cargo}</span>}
                </div>
                <div className="td td--type">
                  <StatusBadge tone={badgeTone(o.tipo)}>{o.tipo || "—"}</StatusBadge>
                </div>
                <div className="td td--hours">{o.horas != null && o.horas !== "" ? Number(o.horas).toFixed(2) : "—"}</div>
                <div className="td td--obs">
                  {o.obs ? <span className="obs">{o.obs}</span> : <span className="muted">—</span>}
                </div>
                <div className="td td--actions">
                  <button className="btn btn--neutral btn--icon" aria-label="Editar" onClick={() => abrirEdicao(o)}>
                    <PencilSquareIcon className="icon" aria-hidden="true" />
                  </button>
                  <button className="btn btn--danger btn--icon" aria-label="Excluir" onClick={() => excluir(o)}>
                    <TrashIcon className="icon" aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="pagination">
          <button className="btn btn--neutral" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
            <ChevronLeftIcon className="icon" aria-hidden="true" /><span>Anterior</span>
          </button>
          <span className="pagination__status">Página {page} de {totalPages}</span>
          <button className="btn btn--neutral" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
            <span>Próxima</span><ChevronRightIcon className="icon" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Modal CRUD - CORRIGIDO */}
      <Modal
        open={modalAberto}
        onClose={() => setModalAberto(false)}
        title={editando ? "Editar Ocorrência" : "Nova Ocorrência"}
        footer={
          <>
            <button className="btn btn--neutral" onClick={() => setModalAberto(false)}>Cancelar</button>
            {editando && (
              <button className="btn btn--danger" onClick={() => excluir(editando)}>
                <TrashIcon className="icon" aria-hidden="true" /><span>Excluir</span>
              </button>
            )}
            <button className="btn btn--success" onClick={salvar}>
              <PlusCircleIcon className="icon" aria-hidden="true" /><span>{editando ? "Salvar" : "Adicionar"}</span>
            </button>
          </>
        }
      >
        <div className="form-grid">
          <div className="form-field">
            <label>Funcionário *</label>
            <select className="input" value={form.funcionario_id} onChange={(e)=>setForm({ ...form, funcionario_id: e.target.value })} required>
              <option value="">Selecione…</option>
              {funcionarios.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.pessoa_nome || f?.pessoa?.nome} — {f.cargo_nome || ""}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label>Data *</label>
            <input type="date" className="input" value={form.data} onChange={(e)=>setForm({ ...form, data: e.target.value })} required />
          </div>

          <div className="form-2col">
            <div className="form-field">
              <label>Tipo</label>
              <select className="input" value={form.tipo} onChange={(e)=>setForm({ ...form, tipo: e.target.value })}>
                {tiposSugeridos.map(t => <option key={t} value={t}>{t}</option>)}
                <option value="">(Outro — preencha em Observação)</option>
              </select>
            </div>
            <div className="form-field">
              <label>Horas (decimal)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="input"
                placeholder="Ex.: 2.50"
                value={form.horas}
                onChange={(e)=>setForm({ ...form, horas: e.target.value })}
              />
            </div>
          </div>

          <div className="form-field">
            <label>Observação</label>
            <textarea
              className="input"
              rows={4}
              placeholder="Detalhes da ocorrência…"
              value={form.obs}
              onChange={(e)=>setForm({ ...form, obs: e.target.value })}
            />
          </div>
        </div>
      </Modal>

      {/* Estilos locais - CORRIGIDOS */}
      <style jsx>{`
        /* Alertas usando variáveis CSS */
        .alert{
          background: var(--panel);
          border: 1px solid var(--border);
          border-left: 4px solid var(--fg);
          padding: 12px 14px; border-radius: 8px; box-shadow: var(--shadow);
        }
        .alert--success{ border-left-color: var(--success); }
        .alert--error{ border-left-color: var(--error); }

        /* Stats grid usando classes semânticas */
        .stats-grid{
          display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap:16px; margin-bottom:12px; width:100%;
        }
        .stat-card{ 
          background:var(--panel); border:1px solid var(--border); border-radius:12px;
          padding:16px; display:flex; align-items:center; gap:12px; box-shadow:var(--shadow);
          border-left: 4px solid var(--border);
        }
        .stat-card--info{ border-left-color: var(--info) }
        .stat-card--success{ border-left-color: var(--success) }
        .stat-card--warning{ border-left-color: var(--warning) }
        .stat-card__icon{ 
          width:44px;height:44px;border-radius:8px;
          display:flex;align-items:center;justify-content:center;
          background:var(--panel-muted);
          color: var(--muted);
        }
        .stat-card__content{ flex:1 }
        .stat-value{ font-size:1.75rem; font-weight:800; line-height:1 }
        .stat-title{ font-size:.875rem; color:var(--muted); font-weight:600 }

        /* Badges usando classes semânticas */
        .badge{
          display: inline-flex;
          align-items: center;
          padding: 4px 8px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          border: 1px solid;
        }
        .badge--neutral{ background: var(--neutral-bg); color: var(--neutral-fg); border-color: var(--neutral-border) }
        .badge--success{ background: var(--success-bg); color: var(--success-fg); border-color: var(--success-border) }
        .badge--error{ background: var(--error-bg); color: var(--error-fg); border-color: var(--error-border) }
        .badge--warning{ background: var(--warning-bg); color: var(--warning-fg); border-color: var(--warning-border) }
        .badge--info{ background: var(--info-bg); color: var(--info-fg); border-color: var(--info-border) }
        .badge--accent{ background: var(--accent-bg); color: var(--accent-fg); border-color: var(--accent-border) }

        .chips-wrap{ display:flex; flex-wrap:wrap; gap:8px; margin-bottom:12px }
        .chip{ 
          display:inline-flex; align-items:center; gap:8px; 
          padding:6px 8px; background:var(--panel); 
          border:1px solid var(--border); border-radius:999px 
        }
        .chip__count{ font-weight:700; font-size:12px; color:var(--fg) }

        .table-wrap{ 
          width:100%; overflow:auto; border:1px solid var(--border); 
          border-radius:8px; background:var(--panel); box-shadow:var(--shadow) 
        }
        .table{ 
          display:grid; grid-template-columns: 120px 1.3fr 140px 110px 1.6fr 120px; min-width:980px 
        }
        .th{ 
          padding:12px; border-bottom:2px solid var(--border); 
          background:var(--panel-muted); font-weight:700; font-size:14px 
        }
        .th--actions{ text-align:center }
        .row{ display:contents }
        .td{ 
          padding:12px; border-bottom:1px solid var(--border); 
          display:flex; align-items:center; gap:8px 
        }
        .td--func{ gap:10px }
        .td__main{ font-weight:700 }
        .td__sub{ font-size:12px; color:var(--muted) }
        .dot{ 
          width:10px; height:10px; border-radius:999px; 
          background: var(--func-color); border:1px solid var(--border) 
        }
        .td--obs .obs{ 
          display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden 
        }
        .muted{ color: var(--muted) }
        .td--actions{ justify-content:center; gap:6px }

        .pagination{ 
          display:flex; align-items:center; justify-content:center; gap:12px; padding:12px 
        }
        .pagination__status{ color:var(--muted); font-weight:600 }

        .form-grid{ display:flex; flex-direction:column; gap:12px }
        .form-2col{ display:grid; grid-template-columns:1fr 1fr; gap:12px }
        .form-field > label{ display:block; font-size:14px; font-weight:600; margin-bottom:6px }

        /* Filtros section */
        .filters-section{
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid var(--border);
        }
        .filters-group{
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          align-items: center;
        }

        .btn-group{ display:flex; gap:6px; flex-wrap:wrap }
        .btn-group .btn.is-active{ 
          outline: 2px solid var(--accent); 
          outline-offset: -2px;
          background: var(--accent-bg);
          color: var(--accent-fg);
        }

        .range-inline{ display:flex; align-items:center; gap:6px; flex-wrap:wrap }
        .range-sep{ color: var(--muted) }

        .filters-inline{ 
          display:flex; align-items:center; gap:8px; flex-wrap:wrap;
          margin-left: auto;
        }
        .filters-inline .icon{ width:18px; height:18px; color: var(--muted) }

        /* Header layout corrigido */
        .page-header__content{
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          width: 100%;
        }
        .page-header__info{
          flex: 1;
          min-width: 0;
        }
        .page-header__toolbar{
          display: flex;
          gap: 8px;
          flex-shrink: 0;
          align-items: center;
        }

        @media (max-width: 900px){
          .page-header__content{
            flex-direction: column;
            gap: 12px;
          }
          .page-header__toolbar{
            width: 100%;
            justify-content: flex-start;
            flex-wrap: wrap;
          }
          .filters-group{
            flex-direction: column;
            align-items: stretch;
          }
          .filters-inline{
            margin-left: 0;
            width: 100%;
          }
          .form-2col{ grid-template-columns:1fr }
          .table{ 
            grid-template-columns: 110px 1.3fr 120px 90px 1.4fr 110px; 
            min-width:860px 
          }
        }
        @media (max-width: 480px){
          .table{ min-width:780px }
          .page-header__toolbar{
            flex-direction: column;
            align-items: stretch;
          }
          .page-header__toolbar .btn{
            justify-content: center;
          }
        }
      `}</style>
    </>
  );
}