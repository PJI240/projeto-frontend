// src/pages/DashboardAdm.jsx
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
  ChartBarIcon,
} from "@heroicons/react/24/solid";

const API_BASE = (import.meta.env.VITE_API_BASE?.replace(/\/+$/, "") || "");

/* ====== Utils de data/hora ====== */
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
function normDateStr(x) {
  if (!x) return "";
  if (x instanceof Date) return toISO(x);
  const s = String(x);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;      // "YYYY-MM-DD"
  if (s.includes("T")) return s.split("T")[0];      // "YYYY-MM-DDTHH:mm:ss..."
  const d = new Date(s);
  return isNaN(d) ? "" : toISO(d);
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
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
function formatDateFull(d) {
  return d.toLocaleDateString("pt-BR", { weekday: 'long', day: "2-digit", month: "2-digit", year: "numeric" });
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

/* ====== Config da timeline ====== */
const DIAS_SEMANA_CURTO = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const DIAS_SEMANA_LONGO  = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
const CONFIG_HORARIOS    = { inicio: 6, fim: 22 }; // [06:00 .. 22:00]

/* ====== Cores por funcionário ====== */
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

/* ====== API helper ====== */
const useApi = () => useCallback(async (path, init = {}) => {
  const url = `${API_BASE}${path}`;
  const r = await fetch(url, { credentials: "include", ...init });
  let data = null;
  try { data = await r.json(); } catch { /* no-op */ }
  if (!r.ok || data?.ok === false) throw new Error(data?.error || `HTTP ${r.status}`);
  return data;
}, []);

/* ====== Consolidação de apontamentos (evento/horario) ====== */
function consolidateApontamentos(items, dataISO) {
  if (!items?.length) return null;

  const pri = { AJUSTE: 3, IMPORTADO: 2, APONTADO: 1 };

  const hasConsolidado = items.some(it => it.entrada != null || it.saida != null);
  if (hasConsolidado) {
    let entMin = null;
    let saiMax = null;
    let origemBest = null;
    let origemScore = -1;

    for (const it of items) {
      const o = String(it.origem || "APONTADO").toUpperCase();
      const oScore = pri[o] ?? 0;

      if (it.entrada) {
        const m = hhmmToMinutes(String(it.entrada).slice(0,5));
        if (m != null && (entMin == null || m < entMin)) entMin = m;
      }
      if (it.saida) {
        const m = hhmmToMinutes(String(it.saida).slice(0,5));
        if (m != null && (saiMax == null || m > saiMax)) saiMax = m;
      }
      if (oScore > origemScore) { origemScore = oScore; origemBest = o; }
    }

    const now = new Date();
    const isHoje = toISO(now) === dataISO;
    const nowMin = isHoje ? now.getHours() * 60 + now.getMinutes() : null;

    const parcial = entMin != null && saiMax == null;
    const fim = parcial ? nowMin : saiMax;

    return {
      entradaMin: entMin ?? null,
      saidaMin: fim ?? null,
      parcial,
      origem: origemBest || "APONTADO",
    };
  }

  let bestEntrada = null, bestEntradaOrigem = null;
  let bestSaida   = null, bestSaidaOrigem   = null;

  for (const it of items) {
    const ev = String(it.evento || "").toUpperCase();
    const hh = String(it.horario || "").slice(0,5);
    const mm = hhmmToMinutes(hh);
    const origem = String(it.origem || "APONTADO").toUpperCase();
    if (mm == null) continue;

    if (ev === "ENTRADA") {
      if (
        bestEntrada == null ||
        mm < bestEntrada ||
        (mm === bestEntrada && (pri[origem] || 0) > (pri[bestEntradaOrigem] || 0))
      ) { bestEntrada = mm; bestEntradaOrigem = origem; }
    } else if (ev === "SAIDA") {
      if (
        bestSaida == null ||
        mm > bestSaida ||
        (mm === bestSaida && (pri[origem] || 0) > (pri[bestSaidaOrigem] || 0))
      ) { bestSaida = mm; bestSaidaOrigem = origem; }
    }
  }

  const now = new Date();
  const isHoje = toISO(now) === dataISO;
  const nowMin = isHoje ? now.getHours()*60 + now.getMinutes() : null;

  const parcial = bestEntrada != null && bestSaida == null;
  const fim = parcial ? nowMin : bestSaida;

  return {
    entradaMin: bestEntrada ?? null,
    saidaMin: fim ?? null,
    parcial,
    origem:
      (pri[bestEntradaOrigem] || 0) >= (pri[bestSaidaOrigem] || 0)
        ? bestEntradaOrigem
        : bestSaidaOrigem,
  };
}

/* ====== Badge ====== */
function StatusBadge({ children, tone = "gray" }) {
  const map = {
    gray: "bg-gray-100 text-gray-800 ring-gray-200",
    green: "bg-green-100 text-green-800 ring-green-200",
    red: "bg-red-100 text-red-800 ring-red-200",
    yellow: "bg-yellow-100 text-yellow-800 ring-yellow-200",
    blue: "bg-blue-100 text-blue-800 ring-blue-200",
    emerald: "bg-emerald-100 text-emerald-800 ring-emerald-200",
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

/* ====== Componente de Gráfico ====== */
function GraficoDashboard({ metricas, isMobile }) {
  if (!metricas?.grafico) return null;

  const { dias, presentes, ausentes, atrasos } = metricas.grafico;
  const maxValor = Math.max(...presentes, ...ausentes, ...atrasos) || 1;

  return (
    <div className="stat-card stat-card--section" style={{ width: "100%" }}>
      <div className="stat-header stat-header--row">
        <h3 className="stat-title">Evolução Diária</h3>
        <ChartBarIcon className="icon" style={{ width: 20, height: 20 }} />
      </div>
      
      <div className="grafico-container" style={{ height: isMobile ? 200 : 250 }}>
        <div className="grafico-bars">
          {dias.map((dia, index) => (
            <div key={dia} className="grafico-bar-group">
              <div className="grafico-bar-label">{dia}</div>
              <div className="grafico-bars-container">
                <div 
                  className="grafico-bar grafico-bar--presentes"
                  style={{ height: `${(presentes[index] / maxValor) * 80}%` }}
                  title={`Presentes: ${presentes[index]}`}
                />
                <div 
                  className="grafico-bar grafico-bar--ausentes" 
                  style={{ height: `${(ausentes[index] / maxValor) * 80}%` }}
                  title={`Ausentes: ${ausentes[index]}`}
                />
                <div 
                  className="grafico-bar grafico-bar--atrasos"
                  style={{ height: `${(atrasos[index] / maxValor) * 80}%` }}
                  title={`Atrasos: ${atrasos[index]}`}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <div className="grafico-legend">
        <div className="grafico-legend-item">
          <div className="grafico-legend-color grafico-legend-color--presentes"></div>
          <span>Presentes</span>
        </div>
        <div className="grafico-legend-item">
          <div className="grafico-legend-color grafico-legend-color--ausentes"></div>
          <span>Ausentes</span>
        </div>
        <div className="grafico-legend-item">
          <div className="grafico-legend-color grafico-legend-color--atrasos"></div>
          <span>Atrasos</span>
        </div>
      </div>
    </div>
  );
}

/* ====== Componente de Horas Trabalhadas ====== */
function HorasTrabalhadas({ funcionarios, escalasByDia, apontByKey, apontByFuncDia, filtroFuncionario, isMobile }) {
  const [periodo, setPeriodo] = useState('hoje'); // 'hoje', 'semana', 'mes'
  
  const horasPorFuncionario = useMemo(() => {
    const resultado = [];
    const hoje = new Date();
    const dataInicio = periodo === 'hoje' ? hoje : 
                      periodo === 'semana' ? startOfWeek(hoje) : 
                      new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    
    const dataFim = periodo === 'hoje' ? hoje :
                    periodo === 'semana' ? addDays(startOfWeek(hoje), 6) :
                    new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);

    // Gerar todas as datas do período
    const datas = [];
    let dataAtual = new Date(dataInicio);
    while (dataAtual <= dataFim) {
      datas.push(toISO(dataAtual));
      dataAtual = addDays(dataAtual, 1);
    }

    for (const func of funcionarios) {
      if (filtroFuncionario && filtroFuncionario !== 'todos' && func.id.toString() !== filtroFuncionario) {
        continue;
      }

      let totalMinutos = 0;
      let totalAtrasoMinutos = 0;
      let diasTrabalhados = 0;

      for (const dataISO of datas) {
        const escalasDia = escalasByDia.get(dataISO) || [];
        const escalasFunc = escalasDia.filter(e => e.funcionario_id === func.id);

        if (escalasFunc.length > 0) {
          // consolidar via escalas
          for (const escala of escalasFunc) {
            const key = `${dataISO}|${func.id}|${escala.turno_ordem ?? 1}`;
            const cons = consolidateApontamentos(apontByKey.get(key) || [], dataISO);

            if (cons?.entradaMin != null && cons.saidaMin != null) {
              const duracao = cons.saidaMin - cons.entradaMin;
              totalMinutos += Math.max(0, duracao);
              diasTrabalhados++;

              // atraso com referência de escala
              if (escala.entrada) {
                const entradaEscala = hhmmToMinutes(escala.entrada);
                const atraso = cons.entradaMin - entradaEscala;
                if (atraso > 0) totalAtrasoMinutos += atraso;
              }
            }
          }
        } else {
          // funcionário sem escala no dia, mas com apontamento
          const apList = apontByFuncDia.get(`${dataISO}|${func.id}`) || [];
          const cons = consolidateApontamentos(apList, dataISO);
          if (cons?.entradaMin != null && cons.saidaMin != null) {
            const duracao = cons.saidaMin - cons.entradaMin;
            totalMinutos += Math.max(0, duracao);
            diasTrabalhados++;
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
        atrasoFormatado: minutesToHHhMM(totalAtrasoMinutos)
      });
    }

    return resultado.sort((a, b) => b.horasTrabalhadas - a.horasTrabalhadas);
  }, [funcionarios, escalasByDia, apontByKey, apontByFuncDia, filtroFuncionario, periodo]);

  return (
    <div className="stat-card stat-card--section" style={{ width: "100%" }}>
      <div className="stat-header stat-header--row">
        <h3 className="stat-title" id="titulo-horas-trabalhadas">Horas Trabalhadas</h3>
        <label className="visually-hidden" htmlFor="periodo-horas">Selecionar período das horas trabalhadas</label>
        <select 
          id="periodo-horas"
          aria-labelledby="titulo-horas-trabalhadas"
          value={periodo}
          onChange={(e) => setPeriodo(e.target.value)}
          className="input input--sm"
          style={{ minWidth: 120 }}
        >
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
                  {func.atrasoTotal > 0 && (
                    <span className="hours-item__delay">
                      Atraso: {func.atrasoFormatado}
                    </span>
                  )}
                </div>
              </div>
              <div className="hours-item__progress" aria-hidden="true">
                <div
                  className="hours-item__progress-bar"
                  style={{
                    width: `${Math.min(100, (func.horasTrabalhadas / (8 * 60)) * 100)}%`,
                    backgroundColor: func.atrasoTotal > 60 ? 'var(--error)' : 
                                    func.atrasoTotal > 15 ? 'var(--warning)' : 'var(--success)',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ====== Componente principal ====== */
export default function DashboardAdm() {
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth <= 900 : false);
  const [dataRef, setDataRef] = useState(() => startOfWeek(new Date()));
  const [diaAtual, setDiaAtual] = useState(new Date());
  const [filtroFuncionario, setFiltroFuncionario] = useState('todos');

  const dias = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(dataRef, i)), [dataRef]);

  const api = useApi();
  const [dadosDashboard, setDadosDashboard] = useState({
    funcionarios: [],
    escalas: [],
    apontamentos: [],
    metricas: null,
    period: null
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const refreshRef = useRef(null);
  const liveRef = useRef(null);

  const { funcionarios, escalas, apontamentos, metricas } = dadosDashboard;

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 900);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Navegação (permanece igual)
  const semanaAnterior = () => setDataRef(addDays(dataRef, -7));
  const semanaSeguinte = () => setDataRef(addDays(dataRef, 7));
  const semanaAtual = () => { const hoje = new Date(); setDataRef(startOfWeek(hoje)); setDiaAtual(hoje); };
  const diaAnterior = () => setDiaAtual(addDays(diaAtual, -1));
  const diaSeguinte  = () => setDiaAtual(addDays(diaAtual, 1));
  const irParaHoje   = () => setDiaAtual(new Date());

  const carregarTudo = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const de  = isMobile ? toISO(addDays(diaAtual, -1)) : toISO(dias[0]);
      const ate = isMobile ? toISO(addDays(diaAtual,  1)) : toISO(dias[6]);
      const q = (s) => encodeURIComponent(s);
      
      // CORREÇÃO: Usar a rota correta do dashboard
      const dashboardData = await api(`/api/dashboard/adm?from=${q(de)}&to=${q(ate)}&ativos=1`);
      
      setDadosDashboard({
        funcionarios: dashboardData.funcionarios || [],
        escalas: dashboardData.escalas || [],
        apontamentos: dashboardData.apontamentos || [],
        metricas: dashboardData.metricas || null,
        period: dashboardData.period || { from: de, to: ate }
      });
      
      if (liveRef.current) liveRef.current.textContent = "Dados do dashboard atualizados.";
    } catch (e) {
      console.error('Erro ao carregar dashboard:', e);
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

  /* ========= Índices para render ========= */
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

  // Group escalas por dia
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

  // Group apontamentos por (data, funcionario, turno) + ORDEM POR HORÁRIO
  const apontByKey = useMemo(() => {
    const m = new Map();
    for (const a of apontamentos) {
      const funcId = a.funcionario_id ?? a.funcionarioId ?? a.funcionario;
      const dkey   = normDateStr(a.data);
      if (!dkey || !funcId) continue;
      const k = `${dkey}|${funcId}|${a.turno_ordem ?? 1}`;
      const arr = m.get(k) || [];
      arr.push(a);
      m.set(k, arr);
    }
    for (const [k, arr] of m.entries()) {
      arr.sort((x, y) => (String(x.horario||"").localeCompare(String(y.horario||"")) || ((x.id||0) - (y.id||0))));
    }
    return m;
  }, [apontamentos]);

  // Group apontamentos por (data, funcionario) — casos sem escala + ORDEM
  const apontByFuncDia = useMemo(() => {
    const m = new Map();
    for (const a of apontamentos) {
      const funcId = a.funcionario_id ?? a.funcionarioId ?? a.funcionario;
      const dkey   = normDateStr(a.data);
      if (!dkey || !funcId) continue;
      const k = `${dkey}|${funcId}`;
      const arr = m.get(k) || [];
      arr.push(a);
      m.set(k, arr);
    }
    for (const [k, arr] of m.entries()) {
      arr.sort((x, y) => (String(x.horario||"").localeCompare(String(y.horario||"")) || ((x.id||0) - (y.id||0))));
    }
    return m;
  }, [apontamentos]);

  // Filtros
  const funcionariosFiltrados = useMemo(() => {
    if (filtroFuncionario === 'todos') return funcionarios;
    return funcionarios.filter(f => f.id.toString() === filtroFuncionario);
  }, [funcionarios, filtroFuncionario]);

  const escalasFiltradas = useMemo(() => {
    if (filtroFuncionario === 'todos') return escalas;
    return escalas.filter(e => e.funcionario_id.toString() === filtroFuncionario);
  }, [escalas, filtroFuncionario]);

  const apontamentosFiltrados = useMemo(() => {
    if (filtroFuncionario === 'todos') return apontamentos;
    return apontamentos.filter(a => {
      const funcId = a.funcionario_id ?? a.funcionarioId ?? a.funcionario;
      return funcId.toString() === filtroFuncionario;
    });
  }, [apontamentos, filtroFuncionario]);

  // Recriar índices filtrados + ORDEM
  const escalasByDiaFiltrado = useMemo(() => {
    const m = new Map();
    for (const e of escalasFiltradas) {
      const dkey = normDateStr(e.data);
      if (!dkey || !e.funcionario_id) continue;
      const arr = m.get(dkey) || [];
      arr.push(e);
      m.set(dkey, arr);
    }
    return m;
  }, [escalasFiltradas]);

  const apontByKeyFiltrado = useMemo(() => {
    const m = new Map();
    for (const a of apontamentosFiltrados) {
      const funcId = a.funcionario_id ?? a.funcionarioId ?? a.funcionario;
      const dkey   = normDateStr(a.data);
      if (!dkey || !funcId) continue;
      const k = `${dkey}|${funcId}|${a.turno_ordem ?? 1}`;
      const arr = m.get(k) || [];
      arr.push(a);
      m.set(k, arr);
    }
    for (const [k, arr] of m.entries()) {
      arr.sort((x, y) => (String(x.horario||"").localeCompare(String(y.horario||"")) || ((x.id||0) - (y.id||0))));
    }
    return m;
  }, [apontamentosFiltrados]);

  const apontByFuncDiaFiltrado = useMemo(() => {
    const m = new Map();
    for (const a of apontamentosFiltrados) {
      const funcId = a.funcionario_id ?? a.funcionarioId ?? a.funcionario;
      const dkey   = normDateStr(a.data);
      if (!dkey || !funcId) continue;
      const k = `${dkey}|${funcId}`;
      const arr = m.get(k) || [];
      arr.push(a);
      m.set(k, arr);
    }
    for (const [k, arr] of m.entries()) {
      arr.sort((x, y) => (String(x.horario||"").localeCompare(String(y.horario||"")) || ((x.id||0) - (y.id||0))));
    }
    return m;
  }, [apontamentosFiltrados]);

  /* ========= KPIs - Usando métricas do backend ========= */
  const kpis = useMemo(() => {
    if (metricas?.totais) {
      return {
        escalados: metricas.totais.escalas || 0,
        presentes: metricas.totais.presentes || 0,
        ausentes: metricas.totais.ausentes || 0,
        atrasos: metricas.totais.atrasos || 0,
        horasTotaisFmt: minutesToHHhMM(metricas.totais.horasTrabalhadas || 0),
      };
    }

    // Fallback para cálculo local se não houver métricas do backend
    const hoje = new Date();
    const hojeISO = toISO(hoje);
    const alvoISO = isMobile
      ? toISO(diaAtual)
      : (dias.some(d => toISO(d) === hojeISO) ? hojeISO : toISO(dias[0]));

    const arrEsc = escalasByDiaFiltrado.get(alvoISO) || [];
    const escaladosSet = new Set(arrEsc.map(e => e.funcionario_id));

    const presentesComEscala = new Set();
    let atrasos = 0;
    let minutosTotais = 0;

    for (const e of arrEsc) {
      const funcId = e.funcionario_id;
      const entradaEsc = e.entrada ? hhmmToMinutes(e.entrada) : null;
      const key = `${alvoISO}|${funcId}|${e.turno_ordem ?? 1}`;
      const cons = consolidateApontamentos(apontByKeyFiltrado.get(key) || [], alvoISO);

      if (cons?.entradaMin != null) {
        presentesComEscala.add(funcId);

        if (entradaEsc != null) {
          const delta = cons.entradaMin - entradaEsc;
          if (delta > 5) atrasos++;
        }

        const fim = cons.saidaMin ?? cons.entradaMin;
        const dur = Math.max(0, fim - cons.entradaMin);
        minutosTotais += dur;
      }
    }

    // Presentes sem escala
    const presentesSemEscala = new Set();
    for (const f of funcionariosFiltrados) {
      if (escaladosSet.has(f.id)) continue;
      const lista = apontByFuncDiaFiltrado.get(`${alvoISO}|${f.id}`) || [];
      const cons = consolidateApontamentos(lista, alvoISO);
      if (cons?.entradaMin != null) presentesSemEscala.add(f.id);
    }

    const presentesTotal = presentesComEscala.size + presentesSemEscala.size;
    const ausentes = Math.max(0, escaladosSet.size - presentesComEscala.size);

    return {
      escalados: escaladosSet.size,
      presentes: presentesTotal,
      ausentes,
      atrasos,
      horasTotaisFmt: minutesToHHhMM(minutosTotais),
    };
  }, [metricas, apontByKeyFiltrado, apontByFuncDiaFiltrado, escalasByDiaFiltrado, funcionariosFiltrados, dias, diaAtual, isMobile]);

  // ... (resto do código permanece igual: DiasAgendaDesktop, DiaAgendaMobile, Legenda, HorasTrabalhadas, etc.)

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
              <button className="btn btn--neutral" onClick={diaAnterior}>
                <ChevronLeftIcon className="icon" aria-hidden="true" />
                <span>Anterior</span>
              </button>
              <button className="btn btn--neutral" onClick={irParaHoje}>
                <CalendarDaysIcon className="icon" aria-hidden="true" />
                <span>Hoje</span>
              </button>
              <button className="btn btn--neutral" onClick={diaSeguinte}>
                <span>Seguinte</span>
                <ChevronRightIcon className="icon" aria-hidden="true" />
              </button>
            </>
          ) : (
            <>
              <button className="btn btn--neutral" onClick={semanaAnterior}>
                <ChevronLeftIcon className="icon" aria-hidden="true" />
                <span>Anterior</span>
              </button>
              <button className="btn btn--neutral" onClick={semanaAtual}>
                <CalendarDaysIcon className="icon" aria-hidden="true" />
                <span>Hoje</span>
              </button>
              <button className="btn btn--neutral" onClick={semanaSeguinte}>
                <span>Seguinte</span>
                <ChevronRightIcon className="icon" aria-hidden="true" />
              </button>
            </>
          )}
          
          <select 
            value={filtroFuncionario}
            onChange={(e) => setFiltroFuncionario(e.target.value)}
            className="input"
            style={{ minWidth: 180 }}
            aria-label="Filtrar por funcionário"
          >
            <option value="todos">Todos os funcionários</option>
            {funcionarios.map(f => (
              <option key={f.id} value={f.id}>
                {f.pessoa_nome || f?.pessoa?.nome || f.nome || `#${f.id}`}
              </option>
            ))}
          </select>

          <button
            className="btn btn--neutral"
            onClick={carregarTudo}
            disabled={loading}
            aria-busy={loading ? "true" : "false"}
            aria-label="Atualizar dados do dashboard"
          >
            {loading ? <span className="spinner" aria-hidden="true" /> : <ArrowPathIcon className="icon" aria-hidden="true" />}
            <span>{loading ? "Atualizando…" : "Atualizar"}</span>
          </button>

          <label className="btn btn--neutral" style={{ cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              style={{ marginRight: 8 }}
              aria-label="Ativar atualização automática"
            />
            <span>Atualizar Automático</span>
          </label>
        </div>
      </header>

      {err && <div className="error-alert" role="alert">{err}</div>}

      {/* KPIs */}
      <div className="stats-grid" role="group" aria-label="Indicadores do dia">
        <div className="stat-card" data-accent="info">
          <div className="stat-card__icon"><UserGroupIcon className="icon" aria-hidden="true" /></div>
          <div className="stat-card__content">
            <div className="stat-value">{kpis.escalados}</div>
            <div className="stat-title">Escalados (dia)</div>
          </div>
        </div>

        <div className="stat-card" data-accent="success">
          <div className="stat-card__icon"><CheckCircleIcon className="icon" aria-hidden="true" /></div>
          <div className="stat-card__content">
            <div className="stat-value">{kpis.presentes}</div>
            <div className="stat-title">Presentes</div>
          </div>
        </div>

        <div className="stat-card" data-accent="error">
          <div className="stat-card__icon"><XCircleIcon className="icon" aria-hidden="true" /></div>
          <div className="stat-card__content">
            <div className="stat-value">{kpis.ausentes}</div>
            <div className="stat-title">Ausentes</div>
          </div>
        </div>

        <div className="stat-card" data-accent="warning">
          <div className="stat-card__icon"><ClockIcon className="icon" aria-hidden="true" /></div>
          <div className="stat-card__content">
            <div className="stat-value">{kpis.atrasos}</div>
            <div className="stat-title">Atrasos (turnos)</div>
          </div>
        </div>
      </div>

      {/* Gráfico */}
      <GraficoDashboard metricas={metricas} isMobile={isMobile} />

      {/* Grade agenda */}
      {isMobile ? <DiaAgendaMobile /> : <DiasAgendaDesktop />}

      {/* Legenda */}
      <div style={{ marginTop: 16 }}>
        <Legenda />
      </div>

      {/* Notas */}
      <div className="dashboard-notes">
        <ul>
          <li><strong>Escala</strong> (contorno) representa o planejado; <strong>Apontamento</strong> (preenchido) representa o realizado.</li>
          <li><strong>Atraso</strong> é a diferença entre entrada apontada e entrada prevista na escala (tolerância de 5 minutos).</li>
          <li><strong>Apontamento sem escala</strong> é exibido e contabilizado (sem atraso por não haver referência).</li>
        </ul>
      </div>

      {/* Horas Trabalhadas */}
      <HorasTrabalhadas 
        funcionarios={funcionariosFiltrados}
        escalasByDia={escalasByDiaFiltrado}
        apontByKey={apontByKeyFiltrado}
        apontByFuncDia={apontByFuncDiaFiltrado}
        filtroFuncionario={filtroFuncionario}
        isMobile={isMobile}
      />

      <style jsx>{`
        /* Estilos permanecem exatamente iguais */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
          width: 100%;
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
          width: 100%;
        }

        .stat-card[data-accent="info"]    { border-left: 4px solid var(--info); }
        .stat-card[data-accent="success"] { border-left: 4px solid var(--success); }
        .stat-card[data-accent="error"]   { border-left: 4px solid var(--error); }
        .stat-card[data-accent="warning"] { border-left: 4px solid var(--warning); }
        
        .stat-card__icon { width: 48px; height: 48px; border-radius: 8px; display: flex; align-items: center; justify-content: center; background: var(--panel-muted); }
        .stat-card__icon .icon { width: 24px; height: 24px; }
        .stat-card[data-accent="info"]    .stat-card__icon { background: rgba(59,130,246,0.1); color: var(--info); }
        .stat-card[data-accent="success"] .stat-card__icon { background: rgba(16,185,129,0.1); color: var(--success); }
        .stat-card[data-accent="error"]   .stat-card__icon { background: rgba(239,68,68,0.1); color: var(--error); }
        .stat-card[data-accent="warning"] .stat-card__icon { background: rgba(245,158,11,0.1); color: var(--warning); }
        
        .stat-card__content { flex: 1; }
        .stat-value { font-size: 2rem; font-weight: 700; line-height: 1; margin-bottom: 4px; }
        .stat-title { font-size: 0.875rem; color: var(--muted); font-weight: 600; }

        /* Estilos do gráfico */
        .grafico-container {
          padding: 16px 0;
          width: 100%;
        }

        .grafico-bars {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          height: 100%;
          gap: 8px;
        }

        .grafico-bar-group {
          display: flex;
          flex-direction: column;
          align-items: center;
          flex: 1;
          height: 100%;
        }

        .grafico-bar-label {
          font-size: 11px;
          color: var(--muted);
          margin-bottom: 8px;
          text-align: center;
        }

        .grafico-bars-container {
          display: flex;
          align-items: flex-end;
          gap: 2px;
          height: calc(100% - 30px);
          width: 100%;
        }

        .grafico-bar {
          flex: 1;
          border-radius: 2px 2px 0 0;
          transition: height 0.3s ease;
          min-height: 4px;
        }

        .grafico-bar--presentes {
          background-color: #10b981;
        }

        .grafico-bar--ausentes {
          background-color: #ef4444;
        }

        .grafico-bar--atrasos {
          background-color: #f59e0b;
        }

        .grafico-legend {
          display: flex;
          justify-content: center;
          gap: 16px;
          margin-top: 12px;
          flex-wrap: wrap;
        }

        .grafico-legend-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: var(--muted);
        }

        .grafico-legend-color {
          width: 12px;
          height: 12px;
          border-radius: 2px;
        }

        .grafico-legend-color--presentes {
          background-color: #10b981;
        }

        .grafico-legend-color--ausentes {
          background-color: #ef4444;
        }

        .grafico-legend-color--atrasos {
          background-color: #f59e0b;
        }

        /* Outros estilos permanecem iguais */
        /* ... */
      `}</style>
    </>
  );
}