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
  PrinterIcon,
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
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-[1000] bg-black/35 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div className="w-full max-h-[90vh] overflow-auto rounded-xl border border-gray-200 bg-white shadow-xl"
           style={{ maxWidth: sizes[size] }}>
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h2 id="modal-title" className="text-lg font-bold">{title}</h2>
          <button className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-sm hover:bg-gray-50"
                  aria-label="Fechar" onClick={onClose}>
            <XMarkIcon className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="p-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-gray-200 px-4 py-3">{footer}</div>}
      </div>
    </div>
  );
}

/* =================== Badge =================== */
function StatusBadge({ children, tone = "neutral" }) {
  const map = {
    neutral: "bg-gray-50 text-gray-700 border-gray-200",
    success: "bg-emerald-50 text-emerald-700 border-emerald-200",
    error:   "bg-rose-50 text-rose-700 border-rose-200",
    warning: "bg-amber-50 text-amber-700 border-amber-200",
    info:    "bg-sky-50 text-sky-700 border-sky-200",
    accent:  "bg-indigo-50 text-indigo-700 border-indigo-200",
  };
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${map[tone] || map.neutral}`}>
      {children}
    </span>
  );
}
const badgeTone = (tipo) => {
  const t = String(tipo || "").toUpperCase();
  if (t.includes("HORA")) return "success";
  if (t.includes("ATRASO")) return "warning";
  if (t.includes("AUS") || t.includes("FALTA")) return "error";
  if (t.includes("ATEST")) return "info";
  if (t.includes("FER")) return "accent";
  return "neutral";
};

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
      setDe(toISO(hoje)); setAte(toISO(hoje));
    } else if (p === "semana") {
      const ini = startOfWeek(hoje); setDe(toISO(ini)); setAte(toISO(addDays(ini, 6)));
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
      setForm(prev => ({ ...prev, tipo: sanitizeTipo(prev.tipo) || lista[0] }));
    } catch {
      setTiposPermitidos(TIPOS_WHITELIST.slice());
      setForm(prev => ({ ...prev, tipo: sanitizeTipo(prev.tipo) || TIPOS_WHITELIST[0] }));
    }
  }, [api]);

  const carregarOcorrencias = useCallback(async () => {
    setLoading(true); setErr(""); setSucesso("");
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
    const presentesSet = new Set();
    for (const o of ocorrencias) {
      const t = (o.tipo || "OUTRO").toUpperCase();
      porTipo.set(t, (porTipo.get(t) || 0) + 1);
      horasTotal += parseNumber(o.horas);
      if (parseNumber(o.horas) > 0) presentesSet.add(o.funcionario_id ?? o.funcionarioId ?? o.funcionario);
    }
    return { total, horasTotal, presentes: presentesSet.size, porTipo };
  }, [ocorrencias]);

  const porTipoArray = useMemo(() => {
    const arr = [];
    for (const [tipo, qtd] of kpis.porTipo.entries()) arr.push({ tipo, qtd });
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
      if (!tiposPermitidos.includes(tipoVal)) throw new Error(`Tipo inválido. Use um dos valores permitidos: ${tiposPermitidos.join(", ")}.`);

      const payload = {
        funcionario_id: Number(form.funcionario_id),
        data: form.data,
        tipo: tipoVal,
        horas: form.horas === "" ? null : Number(form.horas),
        obs: form.obs || null,
      };
      if (!payload.funcionario_id || !payload.data) throw new Error("Selecione funcionário e data.");

      if (editando) {
        await api(`/api/ocorrencias/${editando.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        setSucesso("Ocorrência atualizada com sucesso!");
      } else {
        await api(`/api/ocorrencias`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        setSucesso("Ocorrência adicionada com sucesso!");
      }
      setModalAberto(false);
      await carregarOcorrencias();
    } catch (e) { setErr(e.message || "Falha ao salvar ocorrência."); }
  };
  const excluir = async (o) => {
    if (!confirm(`Remover ocorrência de ${mapFunc.get(o.funcionario_id)?.nome || "#"} no dia ${formatDateBR(fromISO(o.data))}?`)) return;
    setErr(""); setSucesso("");
    try {
      await api(`/api/ocorrencias/${o.id}`, { method: "DELETE" });
      setSucesso("Ocorrência removida com sucesso!");
      await carregarOcorrencias();
    } catch (e) { setErr(e.message || "Falha ao excluir ocorrência."); }
  };

  /* ------------ Export CSV ------------ */
  const exportarCSV = () => {
    const header = ["id", "data", "funcionario_id", "funcionario_nome", "tipo", "horas", "obs"];
    const linhas = filtradas.map(o => [
      o.id, o.data, o.funcionario_id, mapFunc.get(o.funcionario_id)?.nome || "", sanitizeTipo(o.tipo) || "", (o.horas ?? ""),
      (o.obs ?? "").replace(/\n/g, " ").replace(/;/g, ","),
    ]);
    const csv = [header.join(";")].concat(linhas.map(l => l.join(";"))).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `ocorrencias_${de}_a_${ate}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  /* ------------ Export PDF ------------ */
  const exportarPDF = () => {
    const win = window.open("", "_blank"); if (!win) return;
    const rowsHtml = filtradas.map((o) => {
      const f = mapFunc.get(o.funcionario_id);
      const nome = (f?.nome || `#${o.funcionario_id}`).replace(/</g, "&lt;");
      const obs = (o.obs || "").replace(/</g, "&lt;");
      const tipo = sanitizeTipo(o.tipo) || "—";
      const horas = (o.horas != null && o.horas !== "") ? Number(o.horas).toFixed(2) : "—";
      return `<tr><td>${formatDateBR(fromISO(o.data))}</td><td>${nome}</td><td>${tipo}</td><td style="text-align:right">${horas}</td><td>${obs}</td></tr>`;
    }).join("");
    win.document.write(`
      <!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/><title>Ocorrências ${de} a ${ate}</title>
      <style>
        body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Inter,Ubuntu,'Helvetica Neue',Arial,sans-serif;padding:24px;color:#111827}
        h1{font-size:20px;margin:0 0 4px 0} p{margin:0 0 16px 0;color:#6b7280}
        table{width:100%;border-collapse:collapse;font-size:12px} th,td{border:1px solid #e5e7eb;padding:8px;vertical-align:top}
        th{background:#f3f4f6;text-align:left} tfoot td{font-weight:700} .muted{color:#6b7280}
        @media print{ @page{size: A4; margin: 14mm} }
      </style></head>
      <body><h1>Ocorrências</h1><p class="muted">Período: ${de} a ${ate}</p>
        <table><thead><tr><th style="width:90px">Data</th><th>Funcionário</th><th style="width:110px">Tipo</th>
        <th style="width:80px;text-align:right">Horas</th><th>Observação</th></tr></thead>
        <tbody>${rowsHtml || `<tr><td colspan="5" class="muted">Sem dados no período.</td></tr>`}</tbody>
        <tfoot><tr><td colspan="5">Total de ocorrências: ${filtradas.length} • Horas acumuladas: ${kpis.horasTotal.toFixed(2)}</td></tr></tfoot>
        </table><script>window.focus();</script></body></html>
    `);
    win.document.close();
  };

  /* =================== RENDER =================== */
  return (
    <>
      {/* Região viva para leitores de tela */}
      <div ref={liveRef} aria-live="polite" className="sr-only" />

      {/* Cabeçalho */}
      <header className="mb-3" role="region" aria-labelledby="titulo-oc">
        <div className="mb-2">
          <h1 id="titulo-oc" className="text-2xl font-extrabold tracking-tight text-gray-900">Ocorrências</h1>
          <p className="text-sm text-gray-500">Registre e acompanhe ausências, atestados, feriados e outras ocorrências</p>
        </div>

        {/* Toolbar unificada */}
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-[1fr_auto_auto] items-start">
          {/* Filtros + Busca */}
          <div className="flex flex-wrap items-center gap-2">
            <FunnelIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
            <select className="input input--sm min-w-[210px]" value={filtroFuncionario} onChange={(e)=>setFiltroFuncionario(e.target.value)} aria-label="Filtrar por funcionário">
              <option value="todos">Todos os funcionários</option>
              {funcionarios.map(f => (
                <option key={f.id} value={f.id}>{f.pessoa_nome || f?.pessoa?.nome || f.nome || `#${f.id}`}</option>
              ))}
            </select>
            <select className="input input--sm min-w-[160px]" value={filtroTipo} onChange={(e)=>setFiltroTipo(e.target.value)} aria-label="Filtrar por tipo">
              <option value="todos">Todos os tipos</option>
              {tiposPermitidos.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input
              className="input input--sm flex-1 min-w-[200px]"
              placeholder="Buscar por nome, tipo ou observação…"
              value={busca}
              onChange={(e)=>setBusca(e.target.value)}
              aria-label="Buscar"
            />
          </div>

          {/* Período + datas */}
          <div className="flex flex-wrap items-center gap-2 justify-start lg:justify-center">
            <div className="inline-flex flex-wrap gap-1" role="group" aria-label="Atalhos de período">
              <button className={`btn btn--neutral ${periodo==='hoje' ? 'is-active' : ''}`} onClick={()=>aplicarPeriodo("hoje")}>
                <CalendarDaysIcon className="icon" aria-hidden="true" /><span>Hoje</span>
              </button>
              <button className={`btn btn--neutral ${periodo==='semana' ? 'is-active' : ''}`} onClick={()=>aplicarPeriodo("semana")}><span>Semana</span></button>
              <button className={`btn btn--neutral ${periodo==='mes' ? 'is-active' : ''}`} onClick={()=>aplicarPeriodo("mes")}><span>Mês</span></button>
            </div>
            <div className="flex items-center gap-2">
              <label className="sr-only" htmlFor="dt-de">Data inicial</label>
              <input id="dt-de" type="date" className="input input--sm" value={de} onChange={(e)=>{ setDe(e.target.value); setPeriodo("custom"); }} />
              <span aria-hidden className="text-gray-400">—</span>
              <label className="sr-only" htmlFor="dt-ate">Data final</label>
              <input id="dt-ate" type="date" className="input input--sm" value={ate} onChange={(e)=>{ setAte(e.target.value); setPeriodo("custom"); }} />
            </div>
          </div>

          {/* Ações */}
          <div className="flex flex-wrap gap-2 justify-start lg:justify-end">
            <button className="btn btn--success" onClick={abrirNovo}>
              <PlusCircleIcon className="icon" aria-hidden="true" /><span>Nova Ocorrência</span>
            </button>
            <button className="btn btn--info" onClick={exportarCSV}>
              <ArrowDownTrayIcon className="icon" aria-hidden="true" /><span>Exportar CSV</span>
            </button>
            <button className="btn btn--neutral" onClick={exportarPDF}>
              <PrinterIcon className="icon" aria-hidden="true" /><span>Exportar PDF</span>
            </button>
            <button className="btn btn--neutral" onClick={carregarOcorrencias} disabled={loading} aria-busy={loading ? "true" : "false"}>
              {loading ? <span className="spinner" aria-hidden="true" /> : <ArrowPathIcon className="icon" aria-hidden="true" />}
              <span>{loading ? "Atualizando…" : "Atualizar"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Alerts */}
      {err && <div role="alert" className="mb-3 rounded-lg border border-rose-200 bg-white shadow-sm pl-3 pr-3 py-2">
        <div className="border-l-4 border-rose-500 pl-3 text-rose-700 font-medium">{err}</div>
      </div>}
      {sucesso && <div role="status" className="mb-3 rounded-lg border border-emerald-200 bg-white shadow-sm pl-3 pr-3 py-2">
        <div className="border-l-4 border-emerald-500 pl-3 text-emerald-700 font-medium">{sucesso}</div>
      </div>}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
        <div className="flex items-center gap-3 rounded-xl border border-sky-200 bg-white shadow-sm px-4 py-3">
          <div className="h-11 w-11 rounded-md bg-sky-50 text-sky-500 grid place-items-center">
            <ClipboardDocumentListIcon className="h-6 w-6" />
          </div>
          <div>
            <div className="text-2xl font-extrabold leading-none">{kpis.total}</div>
            <div className="text-sm font-semibold text-gray-500">Ocorrências no período</div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-white shadow-sm px-4 py-3">
          <div className="h-11 w-11 rounded-md bg-emerald-50 text-emerald-600 grid place-items-center">
            <ClockIcon className="h-6 w-6" />
          </div>
          <div>
            <div className="text-2xl font-extrabold leading-none">{kpis.horasTotal.toFixed(2)}</div>
            <div className="text-sm font-semibold text-gray-500">Horas acumuladas</div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-white shadow-sm px-4 py-3">
          <div className="h-11 w-11 rounded-md bg-amber-50 text-amber-600 grid place-items-center">
            <UserGroupIcon className="h-6 w-6" />
          </div>
          <div>
            <div className="text-2xl font-extrabold leading-none">{kpis.presentes}</div>
            <div className="text-sm font-semibold text-gray-500">Funcionários impactados</div>
          </div>
        </div>
      </div>

      {/* Totais por tipo */}
      {porTipoArray.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2" aria-label="Totais por tipo">
          {porTipoArray.map(({ tipo, qtd }) => (
            <span key={tipo} className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 text-sm shadow-sm">
              <StatusBadge tone={badgeTone(tipo)}>{tipo}</StatusBadge>
              <span className="text-gray-700 font-bold text-xs">{qtd}</span>
            </span>
          ))}
        </div>
      )}

      {/* Tabela com “bordinha” azul arredondada à esquerda */}
      <div className="relative overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        {/* faixa azul lateral esquerda com raio */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-1.5 bg-sky-500 rounded-l-lg" aria-hidden="true" />
        <table className="min-w-[980px] w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr className="text-gray-600">
              <th className="px-4 py-3 font-semibold">Data</th>
              <th className="px-4 py-3 font-semibold">Funcionário</th>
              <th className="px-4 py-3 font-semibold">Tipo</th>
              <th className="px-4 py-3 font-semibold">Horas</th>
              <th className="px-4 py-3 font-semibold">Observação</th>
              <th className="px-4 py-3 font-semibold text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((o) => {
              const f = mapFunc.get(o.funcionario_id);
              return (
                <tr key={o.id} className="border-t border-gray-200">
                  <td className="px-4 py-3 align-top">{formatDateBR(fromISO(o.data))}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full border border-gray-200" style={{ background: f?.cor || "#999" }} />
                      <div className="min-w-0">
                        <div className="font-semibold text-gray-900 truncate">{f?.nome || `#${o.funcionario_id}`}</div>
                        {f?.cargo && <div className="text-xs text-gray-500">{f.cargo}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <StatusBadge tone={badgeTone(o.tipo)}>{sanitizeTipo(o.tipo) || "—"}</StatusBadge>
                  </td>
                  <td className="px-4 py-3 align-top">{o.horas != null && o.horas !== "" ? Number(o.horas).toFixed(2) : "—"}</td>
                  <td className="px-4 py-3 align-top">
                    {o.obs ? <span className="line-clamp-2">{o.obs}</span> : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex items-center justify-center gap-2">
                      <button className="btn btn--neutral btn--icon" aria-label="Editar" onClick={() => abrirEdicao(o)}>
                        <PencilSquareIcon className="icon" aria-hidden="true" /> <span className="hidden sm:inline">Editar</span>
                      </button>
                      <button className="btn btn--danger btn--icon" aria-label="Excluir" onClick={() => excluir(o)}>
                        <TrashIcon className="icon" aria-hidden="true" /> <span className="hidden sm:inline">Excluir</span>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {pageItems.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-500">Sem dados no período.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 px-3 py-3">
          <button className="btn btn--neutral" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
            <ChevronLeftIcon className="icon" aria-hidden="true" /><span>Anterior</span>
          </button>
          <span className="text-sm font-semibold text-gray-500">Página {page} de {totalPages}</span>
          <button className="btn btn--neutral" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
            <span>Próxima</span><ChevronRightIcon className="icon" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Modal CRUD */}
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
        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className="mb-1 block text-sm font-semibold">Funcionário *</label>
            <select className="input w-full" value={form.funcionario_id} onChange={(e)=>setForm({ ...form, funcionario_id: e.target.value })} required>
              <option value="">Selecione…</option>
              {funcionarios.map((f) => (
                <option key={f.id} value={f.id}>
                  {(f.pessoa_nome || f?.pessoa?.nome) ?? `#${f.id}`} {f.cargo_nome ? `— ${f.cargo_nome}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold">Data *</label>
            <input type="date" className="input w-full" value={form.data} onChange={(e)=>setForm({ ...form, data: e.target.value })} required />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-semibold">Tipo *</label>
              <select className="input w-full" value={form.tipo} onChange={(e)=>setForm({ ...form, tipo: sanitizeTipo(e.target.value) })} required>
                {tiposPermitidos.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold">Horas (decimal)</label>
              <input type="number" step="0.01" min="0" className="input w-full" placeholder="Ex.: 2.50" value={form.horas} onChange={(e)=>setForm({ ...form, horas: e.target.value })} />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold">Observação</label>
            <textarea className="input w-full" rows={4} placeholder="Detalhes da ocorrência…" value={form.obs} onChange={(e)=>setForm({ ...form, obs: e.target.value })} />
          </div>
        </div>
      </Modal>

      {/* Utilitários locais (line-clamp para obs) */}
      <style jsx>{`
        .line-clamp-2{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
      `}</style>
    </>
  );
}
