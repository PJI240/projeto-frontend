import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CalendarDaysIcon,
  UserGroupIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
} from "@heroicons/react/24/solid";

const API_BASE = (import.meta.env.VITE_API_BASE?.replace(/\/+$/, "") || "");

function toISO(d) {
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}
function normDateStr(x) {
  if (!x) return "";
  if (x instanceof Date) return toISO(x);
  const s = String(x);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (s.includes("T")) return s.split("T")[0];
  const d = new Date(s);
  return isNaN(d) ? "" : toISO(d);
}
function startOfWeek(d) {
  const dt = new Date(d);
  const day = dt.getDay();
  const diff = (day + 6) % 7;
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
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
function formatDateFull(d) {
  return d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
}
function hhmmToMinutes(hhmm) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
function minutesToHHhMM(min) {
  const sign = min < 0 ? "-" : "";
  const abs = Math.abs(min);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${String(h).padStart(2, "0")}h${String(m).padStart(2, "0")}`;
}

const DIAS_SEMANA_CURTO = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const DIAS_SEMANA_LONGO = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
const CONFIG_HORARIOS = { inicio: 6, fim: 22 };

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

const useApi = () => useCallback(async (path, init = {}) => {
  const url = `${API_BASE}${path}`;
  const r = await fetch(url, { credentials: "include", ...init });
  let data = null;
  try { data = await r.json(); } catch {}
  if (!r.ok || data?.ok === false) throw new Error(data?.error || `HTTP ${r.status}`);
  return data;
}, []);

function StatusBadge({ children, tone = "gray" }) {
  const map = {
    gray: "bg-gray-100 text-gray-800 ring-gray-200",
    warning: "bg-yellow-100 text-yellow-800 ring-yellow-200",
    info: "bg-blue-100 text-blue-800 ring-blue-200",
    success: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  };
  const cls = map[tone] || map.gray;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${cls}`}>
      {children}
    </span>
  );
}

function HorasTrabalhadas({ funcionarios, escalasByDia, apontConsolidadosByKey, apontConsolidadosByFuncDia, filtroFuncionario }) {
  const [periodo, setPeriodo] = useState("hoje");
  const horasPorFuncionario = useMemo(() => {
    const resultado = [];
    const hoje = new Date();
    const ini = periodo === "hoje" ? hoje : periodo === "semana" ? startOfWeek(hoje) : new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const fim = periodo === "hoje" ? hoje : periodo === "semana" ? addDays(startOfWeek(hoje), 6) : new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    const datas = [];
    for (let d = new Date(ini); d <= fim; d.setDate(d.getDate() + 1)) datas.push(toISO(d));
    for (const func of funcionarios) {
      if (filtroFuncionario !== "todos" && func.id.toString() !== filtroFuncionario) continue;
      let totalMinutos = 0;
      let totalAtrasoMinutos = 0;
      let diasTrabalhados = 0;
      for (const dataISO of datas) {
        const escalasDia = escalasByDia.get(dataISO) || [];
        const escalasFunc = escalasDia.filter((e) => e.funcionario_id === func.id);
        if (escalasFunc.length > 0) {
          for (const escala of escalasFunc) {
            const key = `${dataISO}|${func.id}|${escala.turno_ordem ?? 1}`;
            const ap = apontConsolidadosByKey.get(key);
            if (ap?.entrada) {
              const iniMin = hhmmToMinutes(ap.entrada);
              let fimMin = ap.saida ? hhmmToMinutes(ap.saida) : null;
              if (!ap.saida && dataISO === toISO(new Date())) {
                const now = new Date();
                fimMin = now.getHours() * 60 + now.getMinutes();
              }
              if (iniMin != null && fimMin != null && fimMin >= iniMin) {
                totalMinutos += (fimMin - iniMin);
                diasTrabalhados++;
                if (escala.entrada) {
                  const entradaEsc = hhmmToMinutes(escala.entrada);
                  const atraso = iniMin - entradaEsc;
                  if (atraso > 0) totalAtrasoMinutos += atraso;
                }
              }
            }
          }
        } else {
          const ap = apontConsolidadosByFuncDia.get(`${dataISO}|${func.id}`);
          if (ap?.entrada) {
            const iniMin = hhmmToMinutes(ap.entrada);
            let fimMin = ap.saida ? hhmmToMinutes(ap.saida) : null;
            if (!ap.saida && dataISO === toISO(new Date())) {
              const now = new Date();
              fimMin = now.getHours() * 60 + now.getMinutes();
            }
            if (iniMin != null && fimMin != null && fimMin >= iniMin) {
              totalMinutos += (fimMin - iniMin);
              diasTrabalhados++;
            }
          }
        }
      }
      resultado.push({
        id: func.id,
        nome: func.pessoa_nome || func?.pessoa?.nome || func.nome || `#${func.id}`,
        horasTrabalhadas: totalMinutos,
        atrasoTotal: totalAtrasoMinutos,
        diasTrabalhados,
        horasFormatadas: minutesToHHhMM(totalMinutos),
        atrasoFormatado: minutesToHHhMM(totalAtrasoMinutos),
      });
    }
    return resultado.sort((a, b) => b.horasTrabalhadas - a.horasTrabalhadas);
  }, [funcionarios, escalasByDia, apontConsolidadosByKey, apontConsolidadosByFuncDia, filtroFuncionario, periodo]);
  return (
    <div className="stat-card stat-card--section" style={{ width: "100%" }}>
      <div className="stat-header stat-header--row">
        <h3 className="stat-title" id="titulo-horas-trabalhadas">Horas Trabalhadas</h3>
        <label className="visually-hidden" htmlFor="periodo-horas">Selecionar período</label>
        <select id="periodo-horas" aria-labelledby="titulo-horas-trabalhadas" value={periodo} onChange={(e) => setPeriodo(e.target.value)} className="input input--sm" style={{ minWidth: 120 }}>
          <option value="hoje">Hoje</option>
          <option value="semana">Esta Semana</option>
          <option value="mes">Este Mês</option>
        </select>
      </div>
      {horasPorFuncionario.length === 0 ? (
        <div className="empty-message">Nenhum dado encontrado para o período selecionado</div>
      ) : (
        <div className="hours-list">
          {horasPorFuncionario.map((func) => (
            <div key={func.id} className="hours-item">
              <div className="hours-item__content">
                <div className="hours-item__name">{func.nome}</div>
                <div className="hours-item__details">
                  <span>Dias: {func.diasTrabalhados}</span>
                  <span>Horas: {func.horasFormatadas}</span>
                  {func.atrasoTotal > 0 && <span className="hours-item__delay">Atraso: {func.atrasoFormatado}</span>}
                </div>
              </div>
              <div className="hours-item__progress" aria-hidden="true">
                <div className="hours-item__progress-bar" style={{ width: `${Math.min(100, (func.horasTrabalhadas / (8 * 60)) * 100)}%`, backgroundColor: func.atrasoTotal > 60 ? "var(--error)" : func.atrasoTotal > 15 ? "var(--warning)" : "var(--success)" }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DashboardAdm() {
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth <= 900 : false);
  const [dataRef, setDataRef] = useState(() => startOfWeek(new Date()));
  const [diaAtual, setDiaAtual] = useState(new Date());
  const [filtroFuncionario, setFiltroFuncionario] = useState("todos");
  const dias = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(dataRef, i)), [dataRef]);
  const api = useApi();
  const [funcionarios, setFuncionarios] = useState([]);
  const [escalas, setEscalas] = useState([]);
  const [apontamentos, setApontamentos] = useState([]);
  const [metricas, setMetricas] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const refreshRef = useRef(null);
  const liveRef = useRef(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 900);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const semanaAnterior = () => setDataRef(addDays(dataRef, -7));
  const semanaSeguinte = () => setDataRef(addDays(dataRef, 7));
  const semanaAtual = () => { const hoje = new Date(); setDataRef(startOfWeek(hoje)); setDiaAtual(hoje); };
  const diaAnterior = () => setDiaAtual(addDays(diaAtual, -1));
  const diaSeguinte = () => setDiaAtual(addDays(diaAtual, 1));
  const irParaHoje = () => setDiaAtual(new Date());

  const carregarTudo = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const de = isMobile ? toISO(addDays(diaAtual, -1)) : toISO(dias[0]);
      const ate = isMobile ? toISO(addDays(diaAtual, 1)) : toISO(dias[6]);
      const q = (s) => encodeURIComponent(s);
      const data = await api(`/api/dashboard/adm?from=${q(de)}&to=${q(ate)}&ativos=1`);
      setFuncionarios(data.funcionarios || []);
      setEscalas(data.escalas || []);
      setApontamentos(data.apontamentos || []);
      setMetricas(data.metricas || null);
      if (liveRef.current) liveRef.current.textContent = "Dados do dashboard atualizados.";
    } catch (e) {
      setErr(e.message || "Falha ao carregar dados.");
      if (liveRef.current) liveRef.current.textContent = "Erro ao carregar dados do dashboard.";
    } finally {
      setLoading(false);
    }
  }, [api, dias, diaAtual, isMobile]);

  useEffect(() => { carregarTudo(); }, [carregarTudo]);

  useEffect(() => {
    if (autoRefresh) refreshRef.current = setInterval(() => carregarTudo(), 60000);
    else if (refreshRef.current) clearInterval(refreshRef.current);
    return () => refreshRef.current && clearInterval(refreshRef.current);
  }, [autoRefresh, carregarTudo]);

  const mapFunc = useMemo(() => {
    const m = new Map();
    for (const f of funcionarios) {
      m.set(f.id, { id: f.id, nome: f.pessoa_nome || f?.pessoa?.nome || f.nome || `#${f.id}`, cargo: f.cargo_nome || f?.cargo?.nome || "", cor: getCorFuncionario(f.id) });
    }
    return m;
  }, [funcionarios]);

  const escalasByDia = useMemo(() => {
    const m = new Map();
    for (const e of escalas) {
      const dkey = normDateStr(e.data);
      if (!dkey || !e.funcionario_id) continue;
      const arr = m.get(dkey) || [];
      arr.push(e);
      m.set(dkey, arr);
    }
    return m;
  }, [escalas]);

  const apontConsolidadosByKey = useMemo(() => {
    const m = new Map();
    for (const a of apontamentos) {
      const funcId = a.funcionario_id ?? a.funcionarioId ?? a.funcionario;
      const dkey = normDateStr(a.data);
      if (!dkey || !funcId) continue;
      const k = `${dkey}|${funcId}|${a.turno_ordem ?? 1}`;
      m.set(k, a);
    }
    return m;
  }, [apontamentos]);

  const apontConsolidadosByFuncDia = useMemo(() => {
    const m = new Map();
    for (const a of apontamentos) {
      const funcId = a.funcionario_id ?? a.funcionarioId ?? a.funcionario;
      const dkey = normDateStr(a.data);
      if (!dkey || !funcId) continue;
      const k = `${dkey}|${funcId}`;
      if (!m.has(k)) m.set(k, a);
      else {
        const cur = m.get(k);
        const entA = hhmmToMinutes(a.entrada || "");
        const entC = hhmmToMinutes(cur.entrada || "");
        if (entA != null && (entC == null || entA < entC)) m.set(k, a);
      }
    }
    return m;
  }, [apontamentos]);

  const funcionariosFiltrados = useMemo(() => {
    if (filtroFuncionario === "todos") return funcionarios;
    return funcionarios.filter((f) => f.id.toString() === filtroFuncionario);
  }, [funcionarios, filtroFuncionario]);

  const escalasByDiaFiltrado = useMemo(() => {
    const m = new Map();
    for (const e of escalas) {
      if (filtroFuncionario !== "todos" && e.funcionario_id.toString() !== filtroFuncionario) continue;
      const dkey = normDateStr(e.data);
      if (!dkey || !e.funcionario_id) continue;
      const arr = m.get(dkey) || [];
      arr.push(e);
      m.set(dkey, arr);
    }
    return m;
  }, [escalas, filtroFuncionario]);

  const apontByKeyFiltrado = useMemo(() => {
    const m = new Map();
    for (const [k, v] of apontConsolidadosByKey.entries()) {
      if (filtroFuncionario !== "todos") {
        const parts = k.split("|");
        if (parts[1] !== String(filtroFuncionario)) continue;
      }
      m.set(k, v);
    }
    return m;
  }, [apontConsolidadosByKey, filtroFuncionario]);

  const apontByFuncDiaFiltrado = useMemo(() => {
    const m = new Map();
    for (const [k, v] of apontConsolidadosByFuncDia.entries()) {
      if (filtroFuncionario !== "todos") {
        const parts = k.split("|");
        if (parts[1] !== String(filtroFuncionario)) continue;
      }
      m.set(k, v);
    }
    return m;
  }, [apontConsolidadosByFuncDia, filtroFuncionario]);

  const kpis = useMemo(() => {
    if (metricas?.totais) {
      return {
        escalados: metricas.totais.escalas ?? 0,
        presentes: metricas.totais.presentes ?? 0,
        ausentes: metricas.totais.ausentes ?? 0,
        atrasos: metricas.totais.atrasos ?? 0,
        horasTotaisFmt: "",
      };
    }
    const hoje = new Date();
    const hojeISO = toISO(hoje);
    const alvoISO = isMobile ? toISO(diaAtual) : (dias.some((d) => toISO(d) === hojeISO) ? hojeISO : toISO(dias[0]));
    const arrEsc = escalasByDiaFiltrado.get(alvoISO) || [];
    const escaladosSet = new Set(arrEsc.map((e) => e.funcionario_id));
    const presentesComEscala = new Set();
    let atrasos = 0;
    let minutosTotais = 0;
    for (const e of arrEsc) {
      const funcId = e.funcionario_id;
      const key = `${alvoISO}|${funcId}|${e.turno_ordem ?? 1}`;
      const ap = apontByKeyFiltrado.get(key);
      if (ap?.entrada) {
        const iniMin = hhmmToMinutes(ap.entrada);
        const escMin = e.entrada ? hhmmToMinutes(e.entrada) : null;
        let fimMin = ap.saida ? hhmmToMinutes(ap.saida) : null;
        if (!ap.saida && alvoISO === hojeISO) {
          fimMin = hoje.getHours() * 60 + hoje.getMinutes();
        }
        if (iniMin != null) {
          presentesComEscala.add(funcId);
          if (escMin != null && iniMin - escMin > 5) atrasos++;
          if (fimMin != null && fimMin >= iniMin) minutosTotais += (fimMin - iniMin);
        }
      }
    }
    const presentesSemEscala = new Set();
    for (const f of funcionariosFiltrados) {
      if (escaladosSet.has(f.id)) continue;
      const ap = apontByFuncDiaFiltrado.get(`${alvoISO}|${f.id}`);
      if (ap?.entrada) presentesSemEscala.add(f.id);
    }
    const presentesTotal = presentesComEscala.size + presentesSemEscala.size;
    const ausentes = Math.max(0, escaladosSet.size - presentesComEscala.size);
    return { escalados: escaladosSet.size, presentes: presentesTotal, ausentes, atrasos, horasTotaisFmt: minutesToHHhMM(minutosTotais) };
  }, [
    metricas,
    apontByKeyFiltrado,
    apontByFuncDiaFiltrado,
    escalasByDiaFiltrado,
    funcionariosFiltrados,
    dias,
    diaAtual,
    isMobile,
  ]);

  const dayHeight = isMobile ? 800 : 1200;
  const minVisible = CONFIG_HORARIOS.inicio * 60;
  const maxVisible = CONFIG_HORARIOS.fim * 60;
  const minutesSpan = maxVisible - minVisible;

  function blockStyleByMinutes(iniMin, endMin) {
    if (iniMin == null) return { display: "none" };
    const start = Math.max(minVisible, iniMin);
    const end = endMin != null ? Math.min(maxVisible, endMin) : null;
    const top = ((start - minVisible) / minutesSpan) * dayHeight;
    const height = end != null ? Math.max(8, ((end - start) / minutesSpan) * dayHeight) : 16;
    return { position: "absolute", left: 6, right: 6, top, height, borderRadius: 8 };
  }

  const DiasAgendaDesktop = () => (
    <div className="dashboard-wrapper" role="region" aria-label="Agenda semanal">
      <div className="dashboard-grid">
        <div className="dashboard-grid__header">HORA</div>
        {dias.map((dia, i) => (
          <div key={i} className="dashboard-grid__day-header">
            <div className="dashboard-grid__day-name">{DIAS_SEMANA_CURTO[i]}</div>
            <div className="dashboard-grid__day-date">{formatDateBR(dia)}</div>
          </div>
        ))}
        <div className="dashboard-grid__hours-column">
          {Array.from({ length: CONFIG_HORARIOS.fim - CONFIG_HORARIOS.inicio + 1 }, (_, idx) => (
            <div key={idx} className="dashboard-grid__hour-line" style={{ top: (idx * dayHeight) / (CONFIG_HORARIOS.fim - CONFIG_HORARIOS.inicio) }}>
              <div className="dashboard-grid__hour-label">{String(CONFIG_HORARIOS.inicio + idx).padStart(2, "0")}:00</div>
            </div>
          ))}
        </div>
        {dias.map((dia, idxDia) => {
          const dataISO = toISO(dia);
          const arrEsc = (escalasByDiaFiltrado.get(dataISO) || []).slice();
          const funcIdsComEscala = new Set(arrEsc.map((e) => e.funcionario_id));
          const apontSoltosPorFunc = [];
          for (const f of funcionariosFiltrados) {
            if (funcIdsComEscala.has(f.id)) continue;
            const ap = apontByFuncDiaFiltrado.get(`${dataISO}|${f.id}`);
            if (ap) apontSoltosPorFunc.push({ func: f, ap });
          }
          return (
            <div key={idxDia} className="dashboard-grid__day-column">
              {toISO(new Date()) === dataISO && (() => {
                const now = new Date();
                const nowMin = now.getHours() * 60 + now.getMinutes();
                if (nowMin >= minVisible && nowMin <= maxVisible) {
                  const top = ((nowMin - minVisible) / minutesSpan) * dayHeight;
                  return <div className="dashboard-grid__now-line" style={{ top }} />;
                }
                return null;
              })()}
              {arrEsc.map((e, idx) => {
                const func = mapFunc.get(e.funcionario_id);
                if (!func) return null;
                const ini = hhmmToMinutes(e.entrada);
                const end = hhmmToMinutes(e.saida) ?? ini;
                const style = blockStyleByMinutes(ini, end);
                return (
                  <div key={`esc-${e.id}-${idx}`} className="dashboard-block dashboard-block--scale" style={{ ...style, borderColor: func.cor }} title={`Escala • ${func.nome} (${e.entrada || "--"} - ${e.saida || "--"}) • Turno ${e.turno_ordem}`}>
                    <div className="dashboard-block__dot" style={{ backgroundColor: func.cor }} />
                    <div className="dashboard-block__name">{func.nome}</div>
                    <div className="dashboard-block__time">{e.entrada || "--"} – {e.saida || "--"}</div>
                  </div>
                );
              })}
              {arrEsc.map((e, idx) => {
                const func = mapFunc.get(e.funcionario_id);
                if (!func) return null;
                const key = `${dataISO}|${e.funcionario_id}|${e.turno_ordem ?? 1}`;
                const ap = apontByKeyFiltrado.get(key);
                if (!ap?.entrada) return null;
                const iniMin = hhmmToMinutes(ap.entrada);
                let fimMin = ap.saida ? hhmmToMinutes(ap.saida) : null;
                const isHoje = toISO(new Date()) === dataISO;
                if (!ap.saida && isHoje) {
                  const now = new Date();
                  fimMin = now.getHours() * 60 + now.getMinutes();
                }
                const style = blockStyleByMinutes(iniMin, fimMin);
                const atrasoMin = e.entrada ? (iniMin - hhmmToMinutes(e.entrada)) : null;
                const dur = (fimMin ?? iniMin) - iniMin;
                const status = atrasoMin == null ? "PRESENTE" : atrasoMin > 5 ? "ATRASO" : atrasoMin < -5 ? "ADIANTADO" : "PONTUAL";
                const tone = status === "ATRASO" ? "warning" : status === "ADIANTADO" ? "info" : "success";
                return (
                  <div key={`apo-${e.id}-${idx}`} className="dashboard-block dashboard-block--apontamento" style={{ ...style, backgroundColor: func.cor, opacity: !ap.saida && isHoje ? 0.9 : 1 }} title={`Apontamento • ${func.nome} (${minutesToHHhMM(dur)}${!ap.saida && isHoje ? " • em andamento" : ""})`}>
                    <div className="dashboard-block__dot" style={{ backgroundColor: "white" }} />
                    <div className="dashboard-block__name">{func.nome}</div>
                    <div className="dashboard-block__time">
                      {String(Math.floor(iniMin / 60)).padStart(2, "0")}:
                      {String(iniMin % 60).padStart(2, "0")}
                      {" – "}
                      {fimMin != null ? `${String(Math.floor(fimMin / 60)).padStart(2, "0")}:${String(fimMin % 60).padStart(2, "0")}` : "em andamento"}
                    </div>
                    <div className="dashboard-block__status">
                      <StatusBadge tone={tone}>{status}{atrasoMin != null ? ` (${atrasoMin > 0 ? "+" : ""}${atrasoMin}m)` : ""}</StatusBadge>
                    </div>
                  </div>
                );
              })}
              {apontSoltosPorFunc.map(({ func, ap }, idx) => {
                if (!ap?.entrada) return null;
                const iniMin = hhmmToMinutes(ap.entrada);
                let fimMin = ap.saida ? hhmmToMinutes(ap.saida) : null;
                const isHoje = toISO(new Date()) === dataISO;
                if (!ap.saida && isHoje) {
                  const now = new Date();
                  fimMin = now.getHours() * 60 + now.getMinutes();
                }
                const style = blockStyleByMinutes(iniMin, fimMin);
                return (
                  <div key={`apo-solto-${func.id}-${idx}`} className="dashboard-block dashboard-block--apontamento" style={{ ...style, backgroundColor: getCorFuncionario(func.id), opacity: !ap.saida && isHoje ? 0.9 : 1 }} title={`Apontamento (sem escala) • ${func.pessoa_nome || func.nome}`}>
                    <div className="dashboard-block__dot" style={{ backgroundColor: "white" }} />
                    <div className="dashboard-block__name">{func.pessoa_nome || func.nome}</div>
                    <div className="dashboard-block__time">
                      {String(Math.floor(iniMin / 60)).padStart(2, "0")}:
                      {String(iniMin % 60).padStart(2, "0")}
                      {" – "}
                      {fimMin != null ? `${String(Math.floor(fimMin / 60)).padStart(2, "0")}:${String(fimMin % 60).padStart(2, "0")}` : "em andamento"} • fora da escala
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );

  const DiaAgendaMobile = () => {
    const dataISO = toISO(diaAtual);
    const arrEsc = (escalasByDiaFiltrado.get(dataISO) || []).slice();
    const diaSemana = diaAtual.getDay();
    const nomeDia = DIAS_SEMANA_LONGO[(diaSemana + 6) % 7];
    const funcIdsComEscala = new Set(arrEsc.map((e) => e.funcionario_id));
    const apontSoltosPorFunc = [];
    for (const f of funcionariosFiltrados) {
      if (funcIdsComEscala.has(f.id)) continue;
      const ap = apontByFuncDiaFiltrado.get(`${dataISO}|${f.id}`);
      if (ap) apontSoltosPorFunc.push({ func: f, ap });
    }
    return (
      <div className="dashboard-mobile" role="region" aria-label={`Agenda de ${formatDateFull(diaAtual)}`}>
        <div className="dashboard-mobile__header">
          <div className="dashboard-mobile__day-name">{nomeDia}</div>
          <div className="dashboard-mobile__day-date">{formatDateFull(diaAtual)}</div>
        </div>
        <div className="dashboard-mobile__grid">
          {Array.from({ length: CONFIG_HORARIOS.fim - CONFIG_HORARIOS.inicio + 1 }, (_, idx) => (
            <div key={idx} className="dashboard-mobile__hour-line" style={{ top: (idx * dayHeight) / (CONFIG_HORARIOS.fim - CONFIG_HORARIOS.inicio) }}>
              <div className="dashboard-mobile__hour-label">{String(CONFIG_HORARIOS.inicio + idx).padStart(2, "0")}:00</div>
            </div>
          ))}
          {toISO(new Date()) === dataISO && (() => {
            const now = new Date();
            const nowMin = now.getHours() * 60 + now.getMinutes();
            if (nowMin >= minVisible && nowMin <= maxVisible) {
              const top = ((nowMin - minVisible) / minutesSpan) * dayHeight;
              return <div className="dashboard-mobile__now-line" style={{ top }} />;
            }
            return null;
          })()}
          {arrEsc.map((e, idx) => {
            const func = mapFunc.get(e.funcionario_id);
            if (!func) return null;
            const ini = hhmmToMinutes(e.entrada);
            const end = hhmmToMinutes(e.saida) ?? ini;
            const style = blockStyleByMinutes(ini, end);
            return (
              <div key={`esc-mobile-${e.id}-${idx}`} className="dashboard-block dashboard-block--scale dashboard-block--mobile" style={{ ...style, borderColor: func.cor }} title={`Escala • ${func.nome} (${e.entrada || "--"} - ${e.saida || "--"})`}>
                <div className="dashboard-block__dot" style={{ backgroundColor: func.cor }} />
                <div className="dashboard-block__name">{func.nome}</div>
                <div className="dashboard-block__time">{e.entrada || "--"}–{e.saida || "--"}</div>
              </div>
            );
          })}
          {arrEsc.map((e, idx) => {
            const func = mapFunc.get(e.funcionario_id);
            if (!func) return null;
            const key = `${dataISO}|${e.funcionario_id}|${e.turno_ordem ?? 1}`;
            const ap = apontByKeyFiltrado.get(key);
            if (!ap?.entrada) return null;
            const iniMin = hhmmToMinutes(ap.entrada);
            let fimMin = ap.saida ? hhmmToMinutes(ap.saida) : null;
            const isHoje = toISO(new Date()) === dataISO;
            if (!ap.saida && isHoje) {
              const now = new Date();
              fimMin = now.getHours() * 60 + now.getMinutes();
            }
            const style = blockStyleByMinutes(iniMin, fimMin);
            const atrasoMin = e.entrada ? (iniMin - hhmmToMinutes(e.entrada)) : null;
            const status = atrasoMin == null ? "PRESENTE" : atrasoMin > 5 ? "ATRASO" : atrasoMin < -5 ? "ADIANTADO" : "PONTUAL";
            return (
              <div key={`apo-mobile-${e.id}-${idx}`} className="dashboard-block dashboard-block--apontamento dashboard-block--mobile" style={{ ...style, backgroundColor: func.cor, opacity: !ap.saida && isHoje ? 0.9 : 1 }} title={`Apontamento • ${func.nome}`}>
                <div className="dashboard-block__name">{func.nome}</div>
                <div className="dashboard-block__time">
                  {String(Math.floor(iniMin / 60)).padStart(2, "0")}:
                  {String(iniMin % 60).padStart(2, "0")}
                  {fimMin != null ? `–${String(Math.floor(fimMin / 60)).padStart(2, "0")}:${String(fimMin % 60).padStart(2, "0")}` : " (andamento)"}
                </div>
                <div className="dashboard-block__status">
                  <StatusBadge tone={status === "ATRASO" ? "warning" : status === "ADIANTADO" ? "info" : "success"}>{status}</StatusBadge>
                </div>
              </div>
            );
          })}
          {apontSoltosPorFunc.map(({ func, ap }, idx) => {
            if (!ap?.entrada) return null;
            const iniMin = hhmmToMinutes(ap.entrada);
            let fimMin = ap.saida ? hhmmToMinutes(ap.saida) : null;
            const isHoje = toISO(new Date()) === dataISO;
            if (!ap.saida && isHoje) {
              const now = new Date();
              fimMin = now.getHours() * 60 + now.getMinutes();
            }
            const style = blockStyleByMinutes(iniMin, fimMin);
            return (
              <div key={`apo-solto-mobile-${func.id}-${idx}`} className="dashboard-block dashboard-block--apontamento dashboard-block--mobile" style={{ ...style, backgroundColor: getCorFuncionario(func.id), opacity: !ap.saida && isHoje ? 0.9 : 1 }} title={`Apontamento (sem escala) • ${func.pessoa_nome || func.nome}`}>
                <div className="dashboard-block__name">{func.pessoa_nome || func.nome}</div>
                <div className="dashboard-block__time">
                  {String(Math.floor(iniMin / 60)).padStart(2, "0")}:
                  {String(iniMin % 60).padStart(2, "0")}
                  {fimMin != null ? `–${String(Math.floor(fimMin / 60)).padStart(2, "0")}:${String(fimMin % 60).padStart(2, "0")}` : " (andamento)"} — fora da escala
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const Legenda = () => (
    <div className="dashboard-legend" role="note" aria-label="Legenda da agenda">
      <div className="dashboard-legend__title">Legenda:</div>
      <div className="dashboard-legend__item"><div className="dashboard-legend__symbol dashboard-legend__symbol--scale" /><span>Escala</span></div>
      <div className="dashboard-legend__item"><div className="dashboard-legend__symbol dashboard-legend__symbol--apontamento" /><span>Apontamento</span></div>
      {funcionariosFiltrados.slice(0, isMobile ? 6 : 12).map((f) => (
        <div key={f.id} className="dashboard-legend__item">
          <div className="dashboard-legend__symbol" style={{ backgroundColor: getCorFuncionario(f.id) }} />
          <span className="dashboard-legend__name">{(f.pessoa_nome || f?.pessoa?.nome || f.nome || "").split(" ")[0]}</span>
        </div>
      ))}
      {funcionariosFiltrados.length > (isMobile ? 6 : 12) && <div className="dashboard-legend__more">+{funcionariosFiltrados.length - (isMobile ? 6 : 12)}...</div>}
    </div>
  );

  return (
    <>
      <div ref={liveRef} aria-live="polite" className="visually-hidden" />
      <header className="page-header" role="region" aria-labelledby="titulo-pagina">
        <div>
          <h1 id="titulo-pagina" className="page-title">Painel do Administrador</h1>
          <p className="page-subtitle">Escala × Apontamento</p>
        </div>
        <div className="page-header__toolbar" aria-label="Ações da página">
          {isMobile ? (
            <>
              <button className="btn btn--neutral" onClick={diaAnterior}><ChevronLeftIcon className="icon" aria-hidden="true" /><span>Anterior</span></button>
              <button className="btn btn--neutral" onClick={irParaHoje}><CalendarDaysIcon className="icon" aria-hidden="true" /><span>Hoje</span></button>
              <button className="btn btn--neutral" onClick={diaSeguinte}><span>Seguinte</span><ChevronRightIcon className="icon" aria-hidden="true" /></button>
            </>
          ) : (
            <>
              <button className="btn btn--neutral" onClick={semanaAnterior}><ChevronLeftIcon className="icon" aria-hidden="true" /><span>Anterior</span></button>
              <button className="btn btn--neutral" onClick={semanaAtual}><CalendarDaysIcon className="icon" aria-hidden="true" /><span>Hoje</span></button>
              <button className="btn btn--neutral" onClick={semanaSeguinte}><span>Seguinte</span><ChevronRightIcon className="icon" aria-hidden="true" /></button>
            </>
          )}
          <select value={filtroFuncionario} onChange={(e) => setFiltroFuncionario(e.target.value)} className="input" style={{ minWidth: 180 }} aria-label="Filtrar por funcionário">
            <option value="todos">Todos os funcionários</option>
            {funcionarios.map((f) => (
              <option key={f.id} value={f.id}>{f.pessoa_nome || f?.pessoa?.nome || f.nome || `#${f.id}`}</option>
            ))}
          </select>
          <button className="btn btn--neutral" onClick={carregarTudo} disabled={loading} aria-busy={loading ? "true" : "false"} aria-label="Atualizar dados do dashboard">
            {loading ? <span className="spinner" aria-hidden="true" /> : <ArrowPathIcon className="icon" aria-hidden="true" />}
            <span>{loading ? "Atualizando…" : "Atualizar"}</span>
          </button>
          <label className="btn btn--neutral" style={{ cursor: "pointer" }}>
            <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} style={{ marginRight: 8 }} aria-label="Ativar atualização automática" />
            <span>Atualizar Automático</span>
          </label>
        </div>
      </header>
      {err && <div className="error-alert" role="alert">{err}</div>}
      <div className="stats-grid" role="group" aria-label="Indicadores do dia">
        <div className="stat-card" data-accent="info">
          <div className="stat-card__icon"><UserGroupIcon className="icon" aria-hidden="true" /></div>
          <div className="stat-card__content"><div className="stat-value">{kpis.escalados}</div><div className="stat-title">Escalados (dia)</div></div>
        </div>
        <div className="stat-card" data-accent="success">
          <div className="stat-card__icon"><CheckCircleIcon className="icon" aria-hidden="true" /></div>
          <div className="stat-card__content"><div className="stat-value">{kpis.presentes}</div><div className="stat-title">Presentes</div></div>
        </div>
        <div className="stat-card" data-accent="error">
          <div className="stat-card__icon"><XCircleIcon className="icon" aria-hidden="true" /></div>
          <div className="stat-card__content"><div className="stat-value">{kpis.ausentes}</div><div className="stat-title">Ausentes</div></div>
        </div>
        <div className="stat-card" data-accent="warning">
          <div className="stat-card__icon"><ClockIcon className="icon" aria-hidden="true" /></div>
          <div className="stat-card__content"><div className="stat-value">{kpis.atrasos}</div><div className="stat-title">Atrasos (turnos)</div></div>
        </div>
      </div>
      {isMobile ? <DiaAgendaMobile /> : <DiasAgendaDesktop />}
      <div style={{ marginTop: 16 }}><Legenda /></div>
      <div className="dashboard-notes">
        <ul>
          <li><strong>Escala</strong> (contorno) representa o planejado; <strong>Apontamento</strong> (preenchido) representa o realizado.</li>
          <li><strong>Atraso</strong> é a diferença entre entrada apontada e entrada prevista na escala (tolerância de 5 minutos).</li>
          <li><strong>Apontamento sem escala</strong> é exibido e contabilizado.</li>
        </ul>
      </div>
      <HorasTrabalhadas
        funcionarios={funcionariosFiltrados}
        escalasByDia={escalasByDiaFiltrado}
        apontConsolidadosByKey={apontByKeyFiltrado}
        apontConsolidadosByFuncDia={apontByFuncDiaFiltrado}
        filtroFuncionario={filtroFuncionario}
      />
      <style jsx>{`
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; width: 100%; }
        .stat-card { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 20px; display: flex; align-items: center; gap: 16px; box-shadow: var(--shadow); width: 100%; }
        .stat-card[data-accent="info"]    { border-left: 4px solid var(--info); }
        .stat-card[data-accent="success"] { border-left: 4px solid var(--success); }
        .stat-card[data-accent="error"]   { border-left: 4px solid var(--error); }
        .stat-card[data-accent="warning"] { border-left: 4px solid var(--warning"); }
        .stat-card__icon { width: 48px; height: 48px; border-radius: 8px; display: flex; align-items: center; justify-content: center; background: var(--panel-muted); }
        .stat-card__icon .icon { width: 24px; height: 24px; }
        .stat-card[data-accent="info"]    .stat-card__icon { background: rgba(59,130,246,0.1); color: var(--info); }
        .stat-card[data-accent="success"] .stat-card__icon { background: rgba(16,185,129,0.1); color: var(--success); }
        .stat-card[data-accent="error"]   .stat-card__icon { background: rgba(239,68,68,0.1); color: var(--error); }
        .stat-card[data-accent="warning"] .stat-card__icon { background: rgba(245,158,11,0.1); color: var(--warning); }
        .stat-card__content { flex: 1; }
        .stat-value { font-size: 2rem; font-weight: 700; line-height: 1; margin-bottom: 4px; }
        .stat-title { font-size: 0.875rem; color: var(--muted); font-weight: 600; }
        .dashboard-wrapper { width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .dashboard-grid { display: grid; grid-template-columns: 100px repeat(7, 1fr); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; background: var(--panel); box-shadow: var(--shadow); width: 100%; }
        .dashboard-grid__header { padding: 16px 12px; border-bottom: 2px solid var(--border); background: var(--panel-muted); font-weight: 600; font-size: 14px; }
        .dashboard-grid__day-header { padding: 12px; border-bottom: 2px solid var(--border); text-align: center; background: var(--panel-muted); }
        .dashboard-grid__day-name { font-weight: 700; font-size: 14px; }
        .dashboard-grid__day-date { font-size: 12px; color: var(--muted); margin-top: 4px; }
        .dashboard-grid__hours-column { position: relative; border-right: 1px solid var(--border); background: repeating-linear-gradient(to bottom, transparent, transparent 59px, var(--border) 60px); height: ${isMobile ? 800 : 1200}px; }
        .dashboard-grid__hour-line { position: absolute; left: 0; right: 0; height: 0; }
        .dashboard-grid__hour-label { position: absolute; top: -8px; right: 8px; font-size: 12px; color: var(--muted); }
        .dashboard-grid__day-column { position: relative; height: ${isMobile ? 800 : 1200}px; border-right: 1px solid var(--border); background: repeating-linear-gradient(to bottom, transparent, transparent 59px, var(--border) 60px); }
        .dashboard-grid__now-line { position: absolute; left: 0; right: 0; height: 2px; background: rgba(59,130,246,0.9); box-shadow: 0 0 0 1px rgba(59,130,246,0.4); }
        .dashboard-mobile { border: 1px solid var(--border); border-radius: 8px; overflow: hidden; background: var(--panel); box-shadow: var(--shadow); width: 100%; }
        .dashboard-mobile__header { padding: 16px; border-bottom: 2px solid var(--border); background: var(--panel-muted); text-align: center; }
        .dashboard-mobile__day-name { font-weight: 700; font-size: 16px; margin-bottom: 4px; }
        .dashboard-mobile__day-date { font-size: 14px; color: var(--muted); }
        .dashboard-mobile__grid { position: relative; height: ${isMobile ? 800 : 1200}px; background: repeating-linear-gradient(to bottom, transparent, transparent 39px, var(--border) 40px); }
        .dashboard-mobile__hour-line { position: absolute; left: 0; right: 0; height: 0; }
        .dashboard-mobile__hour-label { position: absolute; top: -6px; left: 8px; font-size: 11px; color: var(--muted); background: var(--panel); padding: 2px 6px; border-radius: 4px; }
        .dashboard-mobile__now-line { position: absolute; left: 0; right: 0; height: 2px; background: rgba(59,130,246,0.9); box-shadow: 0 0 0 1px rgba(59,130,246,0.4); }
        .dashboard-block { position: absolute; left: 6px; right: 6px; border-radius: 8px; display: flex; align-items: center; gap: 8px; padding: 6px 8px; }
        .dashboard-block--scale { border: 2px solid; background: transparent; }
        .dashboard-block--apontamento { background: var(--accent-bg); color: white; box-shadow: 0 2px 6px rgba(0,0,0,.12); }
        .dashboard-block--mobile { flex-direction: column; gap: 2px; padding: 4px 6px; }
        .dashboard-block__dot { width: 8px; height: 8px; border-radius: 999px; }
        .dashboard-block__name { font-size: 12px; font-weight: 600; }
        .dashboard-block--mobile .dashboard-block__name { font-size: 10px; line-height: 1.2; }
        .dashboard-block__time { font-size: 11px; color: var(--muted); }
        .dashboard-block--apontamento .dashboard-block__time { color: rgba(255,255,255,0.95); font-size: 11px; }
        .dashboard-block--mobile .dashboard-block__time { font-size: 9px; line-height: 1.2; }
        .dashboard-block__status { margin-left: auto; }
        .dashboard-block--mobile .dashboard-block__status { margin-left: 0; font-size: 8px; }
        .dashboard-legend { display: flex; gap: 12px; flex-wrap: wrap; padding: 12px; background: var(--panel); border-radius: 8px; border: 1px solid var(--border); font-size: 14px; align-items: center; width: 100%; }
        .dashboard-legend__title { font-weight: 600; color: var(--muted); }
        .dashboard-legend__item { display: flex; align-items: center; gap: 6px; }
        .dashboard-legend__symbol { width: 12px; height: 12px; border-radius: 3px; border: 1px solid var(--border); }
        .dashboard-legend__symbol--scale { border: 2px solid var(--fg); background: transparent; }
        .dashboard-legend__symbol--apontamento { background: var(--fg); }
        .dashboard-legend__name { font-size: 13px; }
        .dashboard-legend__more { font-size: 11px; color: var(--muted); }
        .dashboard-notes { font-size: 12px; color: var(--muted); margin-top: 12px; width: 100%; }
        .dashboard-notes ul { list-style: disc; padding-left: 20px; display: flex; flex-direction: column; gap: 4px; }
        .hours-list { display: grid; gap: 8px; max-height: 400px; overflow-y: auto; }
        .hours-item { display: flex; justify-content: space-between; align-items: center; padding: 12px; background: var(--panel-muted); border-radius: 6px; border: 1px solid var(--border); }
        .hours-item__content { flex: 1; }
        .hours-item__name { font-weight: 600; font-size: 15px; margin-bottom: 4px; }
        .hours-item__details { font-size: 12px; color: var(--muted); display: flex; gap: 12px; flex-wrap: wrap; }
        .hours-item__delay { color: var(--error); }
        .hours-item__progress { width: 60px; height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden; margin-left: 12px; }
        .hours-item__progress-bar { height: 100%; border-radius: 4px; transition: width 0.3s ease; }
        .stat-card--section { display: block; }
        .stat-header--row { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
        @media (max-width: 480px) { .stat-header--row { flex-wrap: wrap; gap: 8px; } }
        @media (max-width: 768px) {
          .stats-grid { grid-template-columns: 1fr 1fr; }
          .stat-card { padding: 16px; }
          .stat-value { font-size: 1.5rem; }
          .page-header__toolbar { flex-direction: column; align-items: stretch; }
          .page-header__toolbar .btn, .page-header__toolbar .input, .page-header__toolbar label.btn { width: 100%; justify-content: center; }
        }
        @media (max-width: 480px) {
          .stats-grid { grid-template-columns: 1fr; }
          .dashboard-legend { font-size: 12px; }
          .hours-item__name { font-size: 14px; }
          .hours-item__details { flex-direction: column; gap: 4px; }
        }
      `}</style>
    </>
  );
}