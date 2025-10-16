import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CalendarDaysIcon,
  FunnelIcon,
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  ArrowPathIcon,
  ArrowDownTrayIcon,
  XMarkIcon,
  UserGroupIcon,
  ClipboardDocumentListIcon,
  ClockIcon,
  PrinterIcon,
  MagnifyingGlassIcon,
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

/* =================== Tipos (sanitização) =================== */
const TIPOS_WHITELIST = ["FERIADO", "ATESTADO", "FALTA", "FOLGA", "OUTRO"];

function sanitizeTipo(t) {
  if (t == null) return "";
  const norm = String(t).replace(/\\+/g, "").trim().toUpperCase();
  return TIPOS_WHITELIST.includes(norm) ? norm : "";
}
function sanitizeTipos(arr) {
  if (!Array.isArray(arr)) return [];
  const out = [];
  for (const x of arr) {
    const s = sanitizeTipo(x);
    if (s && !out.includes(s)) out.push(s);
  }
  return out;
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

/* =================== Cores por funcionário =================== */
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
  
  const onOverlayKeyDown = (ev) => {
    if (ev.key === "Escape") onClose?.();
  };

  return (
    <div
      className="form-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onKeyDown={onOverlayKeyDown}
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div className="form-container" style={{ maxWidth: sizes[size] }}>
        <div className="form-header">
          <h2 id="modal-title">{title}</h2>
          <button
            className="btn btn--neutral btn--icon-only"
            onClick={onClose}
            aria-label="Fechar formulário"
          >
            <XMarkIcon className="icon" aria-hidden="true" />
          </button>
        </div>
        <div className="form-body">{children}</div>
        {footer && <div className="form-actions">{footer}</div>}
      </div>

      <style jsx>{`
        .form-body {
          padding: 0 24px;
        }
        .form-actions {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
          padding: 16px 24px;
          border-top: 1px solid var(--border);
          margin-top: 16px;
        }
      `}</style>
    </div>
  );
}

/* =================== Página: Ocorrências =================== */
export default function Ocorrencias() {
  const api = useApi();
  const liveRef = useRef(null);

  /* ------------ Estado UI ------------ */
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth <= 768 : false);
  useEffect(() => {
    const onR = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, []);

  /* ------------ Filtros ------------ */
  const HOJE = new Date();
  const [periodo, setPeriodo] = useState("semana");
  const [de, setDe] = useState(() => toISO(startOfWeek(HOJE)));
  const [ate, setAte] = useState(() => toISO(addDays(startOfWeek(HOJE), 6)));
  const [filtroFuncionario, setFiltroFuncionario] = useState("todos");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [busca, setBusca] = useState("");

  /* ------------ Dados ------------ */
  const [funcionarios, setFuncionarios] = useState([]);
  const [ocorrencias, setOcorrencias] = useState([]);
  const [tiposPermitidos, setTiposPermitidos] = useState(TIPOS_WHITELIST);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [sucesso, setSucesso] = useState("");

  /* ------------ Modal CRUD ------------ */
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({
    funcionario_id: "",
    data: toISO(HOJE),
    tipo: "FALTA",
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

  const carregarTipos = useCallback(async () => {
    try {
      const r = await api(`/api/ocorrencias/tipos`);
      let lista = Array.isArray(r?.tipos) ? r.tipos : (typeof r?.tipos === "string" ? r.tipos.split(",") : []);
      lista = sanitizeTipos(lista);
      if (!lista.length) lista = TIPOS_WHITELIST.slice();

      setTiposPermitidos(lista);
      setForm(prev => {
        const tipoOk = sanitizeTipo(prev.tipo) || lista[0];
        return { ...prev, tipo: tipoOk };
      });
    } catch {
      setTiposPermitidos(TIPOS_WHITELIST.slice());
      setForm(prev => ({ ...prev, tipo: sanitizeTipo(prev.tipo) || TIPOS_WHITELIST[0] }));
    }
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
    await Promise.all([carregarFuncionarios(), carregarTipos(), carregarOcorrencias()]);
  }, [carregarFuncionarios, carregarTipos, carregarOcorrencias]);

  useEffect(() => { recarregar(); }, []);
  useEffect(() => { carregarOcorrencias(); }, [de, ate, filtroFuncionario, filtroTipo]);

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
    const presentesSet = new Set();
    for (const o of ocorrencias) {
      const t = (o.tipo || "OUTRO").toUpperCase();
      porTipo.set(t, (porTipo.get(t) || 0) + 1);
      horasTotal += parseNumber(o.horas);
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
    setForm({
      funcionario_id: "",
      data: toISO(new Date()),
      tipo: tiposPermitidos[0] || TIPOS_WHITELIST[0],
      horas: "",
      obs: "",
    });
    setModalAberto(true);
  };
  const abrirEdicao = (o) => {
    setEditando(o);
    const tipoOk = sanitizeTipo(o.tipo) || (tiposPermitidos[0] || TIPOS_WHITELIST[0]);
    setForm({
      funcionario_id: o.funcionario_id,
      data: o.data,
      tipo: tipoOk,
      horas: o.horas ?? "",
      obs: o.obs ?? "",
    });
    setModalAberto(true);
  };
  const salvar = async () => {
    setErr(""); setSucesso("");
    try {
      const tipoVal = sanitizeTipo(form.tipo) || (tiposPermitidos[0] || TIPOS_WHITELIST[0]);
      if (!tiposPermitidos.includes(tipoVal)) {
        throw new Error(`Tipo inválido. Use um dos valores permitidos: ${tiposPermitidos.join(", ")}.`);
      }

      const payload = {
        funcionario_id: Number(form.funcionario_id),
        data: form.data,
        tipo: tipoVal,
        horas: form.horas === "" ? null : Number(form.horas),
        obs: form.obs || null,
      };

      if (!payload.funcionario_id || !payload.data) {
        throw new Error("Selecione funcionário e data.");
      }

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
      sanitizeTipo(o.tipo) || "",
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

  /* ------------ Export PDF ------------ */
  const exportarPDF = () => {
    const win = window.open("", "_blank");
    if (!win) return;

    const rowsHtml = filtradas.map((o) => {
      const f = mapFunc.get(o.funcionario_id);
      const nome = (f?.nome || `#${o.funcionario_id}`).replace(/</g, "&lt;");
      const obs = (o.obs || "").replace(/</g, "&lt;");
      const tipo = sanitizeTipo(o.tipo) || "—";
      const horas = (o.horas != null && o.horas !== "") ? Number(o.horas).toFixed(2) : "—";
      return `
        <tr>
          <td>${formatDateBR(fromISO(o.data))}</td>
          <td>${nome}</td>
          <td>${tipo}</td>
          <td style="text-align:right">${horas}</td>
          <td>${obs}</td>
        </tr>`;
    }).join("");

    win.document.write(`
      <!doctype html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8"/>
        <title>Ocorrências ${de} a ${ate}</title>
        <style>
          body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Inter,Ubuntu,'Helvetica Neue',Arial,sans-serif;padding:24px;color:#111827}
          h1{font-size:20px;margin:0 0 4px 0}
          p{margin:0 0 16px 0;color:#6b7280}
          table{width:100%;border-collapse:collapse;font-size:12px}
          th,td{border:1px solid #e5e7eb;padding:8px;vertical-align:top}
          th{background:#f3f4f6;text-align:left}
          tfoot td{font-weight:700}
          .muted{color:#6b7280}
          @media print{ @page{size: A4; margin: 14mm} }
        </style>
      </head>
      <body>
        <h1>Ocorrências</h1>
        <p class="muted">Período: ${de} a ${ate}</p>
        <table>
          <thead>
            <tr>
              <th style="width:90px">Data</th>
              <th>Funcionário</th>
              <th style="width:110px">Tipo</th>
              <th style="width:80px;text-align:right">Horas</th>
              <th>Observação</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || `<tr><td colspan="5" class="muted">Sem dados no período.</td></tr>`}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="5">Total de ocorrências: ${filtradas.length} • Horas acumuladas: ${kpis.horasTotal.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
        <script>window.focus();</script>
      </body>
      </html>
    `);
    win.document.close();
  };

  /* ------------ UI helpers ------------ */
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
    return <span className={`badge ${cls}`}>{children}</span>;
  }

  /* =================== RENDER =================== */
  return (
    <>
      {/* Região viva para leitores de tela */}
      <div ref={liveRef} aria-live="polite" className="visually-hidden" />

      {/* HEADER NO PADRÃO DA PÁGINA PESSOAS */}
      <header className="page-header" role="region" aria-labelledby="titulo-pagina">
        <div>
          <h1 id="titulo-pagina" className="page-title">Ocorrências</h1>
          <p className="page-subtitle">Registre e acompanhe ausências, atestados, feriados e outras ocorrências</p>
        </div>

        <div className="page-header__toolbar" aria-label="Ações da página">
          <button className="btn btn--success" onClick={abrirNovo} aria-label="Criar nova ocorrência">
            <PlusIcon className="icon" aria-hidden="true" />
            <span>Nova Ocorrência</span>
          </button>
          <button
            className="btn btn--neutral"
            onClick={carregarOcorrencias}
            disabled={loading}
            aria-busy={loading ? "true" : "false"}
            aria-label="Atualizar lista de ocorrências"
          >
            {loading ? <span className="spinner" aria-hidden="true" /> : <ArrowPathIcon className="icon" aria-hidden="true" />}
            <span>{loading ? "Atualizando…" : "Atualizar"}</span>
          </button>
        </div>
      </header>

      {err && (
        <div className="error-alert" role="alert">
          {err}
        </div>
      )}

      {sucesso && (
        <div className="success-alert" role="status">
          {sucesso}
        </div>
      )}

      {/* Filtros de Período */}
      <div className="filters-container">
        <div className="periodo-filters">
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

          <div className="date-range" role="group" aria-label="Intervalo de datas">
            <label className="visually-hidden" htmlFor="dt-de">Data inicial</label>
            <input id="dt-de" type="date" className="input input--sm" value={de} onChange={(e)=>{ setDe(e.target.value); setPeriodo("custom"); }} />
            <span className="range-sep">—</span>
            <label className="visually-hidden" htmlFor="dt-ate">Data final</label>
            <input id="dt-ate" type="date" className="input input--sm" value={ate} onChange={(e)=>{ setAte(e.target.value); setPeriodo("custom"); }} />
          </div>
        </div>

        {/* Filtros Avançados */}
        <div className="advanced-filters">
          <div className="filter-group">
            <FunnelIcon className="icon" aria-hidden="true" />
            <select className="input input--sm" value={filtroFuncionario} onChange={(e)=>setFiltroFuncionario(e.target.value)} aria-label="Filtrar por funcionário">
              <option value="todos">Todos os funcionários</option>
              {funcionarios.map(f => (
                <option key={f.id} value={f.id}>{f.pessoa_nome || f?.pessoa?.nome || f.nome || `#${f.id}`}</option>
              ))}
            </select>
            <select className="input input--sm" value={filtroTipo} onChange={(e)=>setFiltroTipo(e.target.value)} aria-label="Filtrar por tipo">
              <option value="todos">Todos os tipos</option>
              {tiposPermitidos.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Busca */}
          <div className="search-container">
            <div className="search-bar" role="search" aria-label="Buscar ocorrências">
              <MagnifyingGlassIcon className="icon" aria-hidden="true" />
              <label htmlFor="busca-ocorrencias" className="visually-hidden">Buscar por nome, tipo ou observação</label>
              <input
                id="busca-ocorrencias"
                type="search"
                className="input input--lg"
                placeholder="Buscar por nome, tipo ou observação…"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                autoComplete="off"
              />
              {Boolean(busca) && (
                <button
                  type="button"
                  className="btn btn--neutral btn--icon-only"
                  onClick={() => setBusca("")}
                  aria-label="Limpar busca"
                >
                  <XMarkIcon className="icon" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Ações de Exportação */}
      <div className="export-actions">
        <button className="btn btn--info btn--sm" onClick={exportarCSV}>
          <ArrowDownTrayIcon className="icon" aria-hidden="true" />
          <span>Exportar CSV</span>
        </button>
        <button className="btn btn--neutral btn--sm" onClick={exportarPDF}>
          <PrinterIcon className="icon" aria-hidden="true" />
          <span>Exportar PDF</span>
        </button>
      </div>

      {/* KPIs */}
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

      {/* LISTAGEM: Tabela (desktop) + Cards (mobile) - PADRÃO PESSOAS */}
      <div className="listagem-container">
        {/* Desktop/tablet: Tabela */}
        <div className="table-wrapper table-only" role="region" aria-label="Tabela de ocorrências">
          {loading ? (
            <div className="loading-message" role="status">Carregando…</div>
          ) : pageItems.length === 0 ? (
            <div className="empty-message">Nenhuma ocorrência encontrada no período.</div>
          ) : (
            <div className="stat-card" style={{ overflow: "hidden" }}>
              <table className="ocorrencias-table">
                <thead>
                  <tr>
                    <th scope="col">Data</th>
                    <th scope="col">Funcionário</th>
                    <th scope="col">Tipo</th>
                    <th scope="col">Horas</th>
                    <th scope="col">Observação</th>
                    <th scope="col" className="actions-column">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((o) => {
                    const f = mapFunc.get(o.funcionario_id);
                    return (
                      <tr key={o.id}>
                        <td>{formatDateBR(fromISO(o.data))}</td>
                        <td>
                          <div className="funcionario-info">
                            <span className="dot" style={{ ["--func-color"]: f?.cor || "#999" }} />
                            <div>
                              <div className="funcionario-nome">{f?.nome || `#${o.funcionario_id}`}</div>
                              {f?.cargo && <div className="funcionario-cargo">{f.cargo}</div>}
                            </div>
                          </div>
                        </td>
                        <td>
                          <StatusBadge tone={badgeTone(o.tipo)}>{sanitizeTipo(o.tipo) || "—"}</StatusBadge>
                        </td>
                        <td>{o.horas != null && o.horas !== "" ? Number(o.horas).toFixed(2) : "—"}</td>
                        <td>{o.obs || "—"}</td>
                        <td>
                          <div className="actions-buttons">
                            <button
                              className="btn btn--neutral btn--sm"
                              onClick={() => abrirEdicao(o)}
                              aria-label={`Editar ocorrência de ${f?.nome}`}
                            >
                              <PencilSquareIcon className="icon" aria-hidden="true" />
                              <span>Editar</span>
                            </button>
                            <button
                              className="btn btn--danger btn--sm"
                              onClick={() => excluir(o)}
                              aria-label={`Excluir ocorrência de ${f?.nome}`}
                            >
                              <TrashIcon className="icon" aria-hidden="true" />
                              <span>Excluir</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Mobile: Cards de ocorrência */}
        <div className="cards-wrapper cards-only" role="region" aria-label="Lista de ocorrências (versão cartões)">
          {loading ? (
            <div className="loading-message" role="status">Carregando…</div>
          ) : pageItems.length === 0 ? (
            <div className="empty-message">Nenhuma ocorrência encontrada no período.</div>
          ) : (
            <ul className="cards-grid" aria-label="Cartões de ocorrências">
              {pageItems.map((o) => {
                const f = mapFunc.get(o.funcionario_id);
                return (
                  <li key={o.id} className="ocorrencia-card" aria-label={`Ocorrência: ${f?.nome}`}>
                    <div className="ocorrencia-card__head">
                      <div className="ocorrencia-card__title">
                        <span className="dot" style={{ ["--func-color"]: f?.cor || "#999" }} />
                        <h3>{f?.nome || `#${o.funcionario_id}`}</h3>
                      </div>
                      <div className="ocorrencia-card__actions">
                        <button
                          className="btn btn--neutral btn--sm"
                          onClick={() => abrirEdicao(o)}
                          aria-label={`Editar ocorrência de ${f?.nome}`}
                          title="Editar"
                        >
                          <PencilSquareIcon className="icon" aria-hidden="true" />
                          <span>Editar</span>
                        </button>
                        <button
                          className="btn btn--danger btn--sm"
                          onClick={() => excluir(o)}
                          aria-label={`Excluir ocorrência de ${f?.nome}`}
                          title="Excluir"
                        >
                          <TrashIcon className="icon" aria-hidden="true" />
                          <span>Excluir</span>
                        </button>
                      </div>
                    </div>

                    <div className="ocorrencia-card__body">
                      <dl className="ocorrencia-dl">
                        <div className="ocorrencia-dl__row">
                          <dt>Data</dt>
                          <dd>{formatDateBR(fromISO(o.data))}</dd>
                        </div>
                        <div className="ocorrencia-dl__row">
                          <dt>Tipo</dt>
                          <dd><StatusBadge tone={badgeTone(o.tipo)}>{sanitizeTipo(o.tipo) || "—"}</StatusBadge></dd>
                        </div>
                        <div className="ocorrencia-dl__row">
                          <dt>Horas</dt>
                          <dd>{o.horas != null && o.horas !== "" ? Number(o.horas).toFixed(2) : "—"}</dd>
                        </div>
                        {o.obs && (
                          <div className="ocorrencia-dl__row">
                            <dt>Observação</dt>
                            <dd>{o.obs}</dd>
                          </div>
                        )}
                      </dl>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
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

      {/* Modal CRUD - PADRÃO PESSOAS */}
      <Modal
        open={modalAberto}
        onClose={() => setModalAberto(false)}
        title={editando ? "Editar Ocorrência" : "Nova Ocorrência"}
        footer={
          <>
            <button className="btn btn--neutral" onClick={() => setModalAberto(false)}>
              <XMarkIcon className="icon" aria-hidden="true" />
              <span>Cancelar</span>
            </button>
            {editando && (
              <button className="btn btn--danger" onClick={() => excluir(editando)}>
                <TrashIcon className="icon" aria-hidden="true" />
                <span>Excluir</span>
              </button>
            )}
            <button className="btn btn--success" onClick={salvar}>
              <span>{editando ? "Salvar Alterações" : "Salvar"}</span>
            </button>
          </>
        }
      >
        <form className="form" onSubmit={(e) => { e.preventDefault(); salvar(); }}>
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="funcionario">Funcionário *</label>
              <select 
                id="funcionario"
                className="input" 
                value={form.funcionario_id} 
                onChange={(e)=>setForm({ ...form, funcionario_id: e.target.value })} 
                required
              >
                <option value="">Selecione…</option>
                {funcionarios.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.pessoa_nome || f?.pessoa?.nome} — {f.cargo_nome || ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="data">Data *</label>
              <input 
                id="data"
                type="date" 
                className="input" 
                value={form.data} 
                onChange={(e)=>setForm({ ...form, data: e.target.value })} 
                required 
              />
            </div>

            <div className="form-field">
              <label htmlFor="tipo">Tipo *</label>
              <select
                id="tipo"
                className="input"
                value={form.tipo}
                onChange={(e)=>setForm({ ...form, tipo: sanitizeTipo(e.target.value) })}
                required
              >
                {tiposPermitidos.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="horas">Horas (decimal)</label>
              <input
                id="horas"
                type="number"
                step="0.01"
                min="0"
                className="input"
                placeholder="Ex.: 2.50"
                value={form.horas}
                onChange={(e)=>setForm({ ...form, horas: e.target.value })}
              />
            </div>

            <div className="form-field span-2">
              <label htmlFor="obs">Observação</label>
              <textarea
                id="obs"
                className="input"
                rows={4}
                placeholder="Detalhes da ocorrência…"
                value={form.obs}
                onChange={(e)=>setForm({ ...form, obs: e.target.value })}
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* estilos locais — seguindo o padrão da página Pessoas */}
      <style jsx>{`
        .listagem-container { width: 100%; }
        
        .filters-container {
          margin-bottom: 16px;
        }
        
        .periodo-filters {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 12px;
          flex-wrap: wrap;
        }
        
        .advanced-filters {
          display: flex;
          gap: 16px;
          align-items: flex-start;
          flex-wrap: wrap;
        }
        
        .filter-group {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        
        .search-container {
          flex: 1;
          min-width: 300px;
        }
        
        .export-actions {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
          flex-wrap: wrap;
        }
        
        .date-range {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .range-sep {
          color: var(--muted);
          font-weight: 600;
        }
        
        .btn-group .btn.is-active { 
          outline: 2px solid var(--accent); 
          outline-offset: -2px;
          background: var(--accent-bg);
          color: var(--accent-fg);
        }
        
        /* Tabela (desktop) e Cards (mobile) alternados por CSS */
        .table-only { display: block; }
        .cards-only { display: none; }
        
        @media (max-width: 768px) {
          .table-only { display: none; }
          .cards-only { display: block; }
        }
        
        /* Info do funcionário na tabela */
        .funcionario-info {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .funcionario-nome {
          font-weight: 600;
        }
        
        .funcionario-cargo {
          font-size: 12px;
          color: var(--muted);
        }
        
        .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--func-color);
          flex-shrink: 0;
        }
        
        /* Cards grid (mobile) */
        .cards-grid {
          list-style: none;
          padding: 0;
          margin: 0;
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
        }
        
        .ocorrencia-card {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 12px;
          box-shadow: var(--shadow);
          overflow: hidden;
          position: relative;
        }
        
        .ocorrencia-card::before {
          content: "";
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 4px;
          background: var(--accent-bg);
        }
        
        .ocorrencia-card__head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 14px 14px 0 14px;
        }
        
        .ocorrencia-card__title {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 1;
        }
        
        .ocorrencia-card__title h3 {
          margin: 0;
          font-size: 1rem;
          font-weight: 700;
          color: var(--fg);
        }
        
        .ocorrencia-card__actions {
          display: flex;
          gap: 6px;
          flex-shrink: 0;
        }
        
        .ocorrencia-card__body {
          padding: 12px 14px 14px 14px;
        }
        
        .ocorrencia-dl {
          margin: 0;
          display: grid;
          gap: 8px;
        }
        
        .ocorrencia-dl__row {
          display: grid;
          grid-template-columns: 100px 1fr;
          gap: 8px;
          align-items: start;
        }
        
        .ocorrencia-dl__row dt {
          color: var(--muted);
          font-weight: 600;
          font-size: var(--fs-12);
        }
        
        .ocorrencia-dl__row dd {
          margin: 0;
          color: var(--fg);
          font-weight: 500;
        }
        
        /* Tabela padrão (desktop) */
        .ocorrencias-table th,
        .ocorrencias-table td { 
          white-space: nowrap;
          padding: 12px;
        }
        
        .ocorrencias-table td:nth-child(2),
        .ocorrencias-table th:nth-child(2),
        .ocorrencias-table td:nth-child(5),
        .ocorrencias-table th:nth-child(5) { 
          white-space: normal;
        }
        
        /* Ações desktop */
        .actions-buttons { 
          display: flex; 
          gap: 6px; 
          flex-wrap: wrap; 
        }
        
        /* Stats Grid */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 16px;
          margin-bottom: 16px;
        }
        
        .stat-card {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 20px;
          display: flex;
          align-items: center;
          gap: 16px;
          box-shadow: var(--shadow);
        }
        
        .stat-card--info {
          border-left: 4px solid var(--info);
        }
        
        .stat-card--success {
          border-left: 4px solid var(--success);
        }
        
        .stat-card--warning {
          border-left: 4px solid var(--warning);
        }
        
        .stat-card__icon {
          width: 48px;
          height: 48px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--panel-muted);
          color: var(--muted);
        }
        
        .stat-card__content {
          flex: 1;
        }
        
        .stat-value {
          font-size: 1.75rem;
          font-weight: 800;
          line-height: 1;
          margin-bottom: 4px;
        }
        
        .stat-title {
          font-size: 0.875rem;
          color: var(--muted);
          font-weight: 600;
        }
        
        /* Badges */
        .badge {
          display: inline-flex;
          align-items: center;
          padding: 4px 8px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          border: 1px solid;
        }
        
        .badge--neutral { background: var(--neutral-bg); color: var(--neutral-fg); border-color: var(--neutral-border) }
        .badge--success { background: var(--success-bg); color: var(--success-fg); border-color: var(--success-border) }
        .badge--error { background: var(--error-bg); color: var(--error-fg); border-color: var(--error-border) }
        .badge--warning { background: var(--warning-bg); color: var(--warning-fg); border-color: var(--warning-border) }
        .badge--info { background: var(--info-bg); color: var(--info-fg); border-color: var(--info-border) }
        .badge--accent { background: var(--accent-bg); color: var(--accent-fg); border-color: var(--accent-border) }
        
        .chips-wrap {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 16px;
        }
        
        .chip {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 20px;
        }
        
        .chip__count {
          font-weight: 700;
          font-size: 12px;
          color: var(--fg);
        }
        
        .pagination {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          padding: 20px 0;
        }
        
        .pagination__status {
          color: var(--muted);
          font-weight: 600;
          font-size: 14px;
        }
        
        .form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        
        .span-2 {
          grid-column: span 2;
        }
        
        .form-field > label {
          display: block;
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 6px;
        }
        
        .success-alert {
          background: var(--success-bg);
          color: var(--success-fg);
          border: 1px solid var(--success-border);
          padding: 12px 16px;
          border-radius: 8px;
          margin-bottom: 16px;
        }
        
        @media (max-width: 768px) {
          .advanced-filters {
            flex-direction: column;
            align-items: stretch;
          }
          
          .search-container {
            min-width: auto;
          }
          
          .form-grid {
            grid-template-columns: 1fr;
          }
          
          .span-2 {
            grid-column: span 1;
          }
          
          .ocorrencia-dl__row {
            grid-template-columns: 90px 1fr;
          }
        }
        
        @media (max-width: 480px) {
          .periodo-filters {
            flex-direction: column;
            align-items: flex-start;
          }
          
          .filter-group {
            width: 100%;
            justify-content: space-between;
          }
          
          .ocorrencia-card__head {
            flex-direction: column;
            align-items: flex-start;
            gap: 12px;
          }
          
          .ocorrencia-card__actions {
            width: 100%;
            justify-content: flex-end;
          }
        }
      `}</style>
    </>
  );
}
