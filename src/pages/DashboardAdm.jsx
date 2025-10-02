// src/pages/DashboardAdm.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;  // "YYYY-MM-DD"
  if (s.includes("T")) return s.split("T")[0];  // "YYYY-MM-DDTHH:mm:ss..."
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
const DIAS_SEMANA_LONGO = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
const CONFIG_HORARIOS = { inicio: 6, fim: 22 }; // [06:00 .. 22:00]

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

/* ====== Consolidação de apontamentos por prioridade ====== */
function consolidateApontamentos(items, dataISO) {
  if (!items?.length) return null;
  const pri = { AJUSTE: 3, IMPORTADO: 2, APONTADO: 1 };
  let bestEntrada = null, bestEntradaOrigem = null;
  let bestSaida = null, bestSaidaOrigem = null;

  for (const it of items) {
    const ent = it.entrada ? hhmmToMinutes(it.entrada) : null;
    const sai = it.saida ? hhmmToMinutes(it.saida) : null;

    if (ent != null) {
      if (
        bestEntrada == null ||
        ent < bestEntrada ||
        (ent === bestEntrada && (pri[it.origem] || 0) > (pri[bestEntradaOrigem] || 0))
      ) {
        bestEntrada = ent; bestEntradaOrigem = it.origem;
      }
    }
    if (sai != null) {
      if (
        bestSaida == null ||
        sai > bestSaida ||
        (sai === bestSaida && (pri[it.origem] || 0) > (pri[bestSaidaOrigem] || 0))
      ) {
        bestSaida = sai; bestSaidaOrigem = it.origem;
      }
    }
  }

  const now = new Date();
  const nowIsToday = toISO(now) === dataISO;
  const nowMin = nowIsToday ? now.getHours() * 60 + now.getMinutes() : null;

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
  };
  const cls = map[tone] || map.gray;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${cls}`}>
      {children}
    </span>
  );
}

/* ====== KPIs ====== */
const Kpi = ({ label, value, sub }) => (
  <div className="stat-card" role="group" aria-label={label}>
    <div className="stat-value">{value}</div>
    <div className="stat-title">{label}</div>
    {sub ? <div className="stat-trend">{sub}</div> : null}
  </div>
);

/* ====== Componente de Horas Trabalhadas ====== */
function HorasTrabalhadas({ funcionarios, escalasByDia, apontByKey, filtroFuncionario, isMobile }) {
  const [periodo, setPeriodo] = useState('hoje'); // 'hoje', 'semana', 'mes'
  
  // Calcular horas trabalhadas
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

        for (const escala of escalasFunc) {
          const key = `${dataISO}|${func.id}|${escala.turno_ordem ?? 1}`;
          const cons = consolidateApontamentos(apontByKey.get(key) || [], dataISO);

          if (cons?.entradaMin != null && cons.saidaMin != null) {
            const duracao = cons.saidaMin - cons.entradaMin;
            totalMinutos += Math.max(0, duracao);
            diasTrabalhados++;

            // Calcular atraso
            if (escala.entrada) {
              const entradaEscala = hhmmToMinutes(escala.entrada);
              const atraso = cons.entradaMin - entradaEscala;
              if (atraso > 0) {
                totalAtrasoMinutos += atraso;
              }
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
        atrasoFormatado: minutesToHHhMM(totalAtrasoMinutos)
      });
    }

    return resultado.sort((a, b) => b.horasTrabalhadas - a.horasTrabalhadas);
  }, [funcionarios, escalasByDia, apontByKey, filtroFuncionario, periodo]);

  return (
    <section
      style={{
        background: "var(--panel)",
        borderRadius: "var(--radius)",
        border: "1px solid var(--border)",
        padding: 16,
        marginBottom: 16
      }}
      aria-labelledby="titulo-horas"
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 12
        }}
      >
        <h3 id="titulo-horas" style={{ margin: 0, fontSize: "clamp(var(--fs-16), 2.5vw, var(--fs-18))", color: "var(--fg)" }}>
          Horas Trabalhadas
        </h3>
        
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label htmlFor="periodo" className="visually-hidden">Período</label>
          <select 
            id="periodo"
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
            style={{
              padding: '6px 12px',
              border: '1px solid var(--border)',
              borderRadius: 6,
              background: 'var(--panel)',
              fontSize: 'var(--fs-14)',
              color: 'var(--fg)'
            }}
          >
            <option value="hoje">Hoje</option>
            <option value="semana">Esta semana</option>
            <option value="mes">Este mês</option>
          </select>
        </div>
      </div>

      {horasPorFuncionario.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 20, color: 'var(--muted)' }}>
          Nenhum dado encontrado para o período selecionado.
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gap: 8,
          maxHeight: isMobile ? 300 : 400,
          overflowY: 'auto'
        }}>
          {horasPorFuncionario.map((func) => (
            <div
              key={func.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px',
                background: 'var(--panel-muted)',
                borderRadius: 6,
                border: '1px solid var(--border)'
              }}
              aria-label={`Funcionário ${func.nome}`}
            >
              <div style={{ flex: 1 }}>
                <div style={{ 
                  fontWeight: 600, 
                  fontSize: isMobile ? 'var(--fs-14)' : '15px',
                  marginBottom: 4,
                  color: 'var(--fg)'
                }}>
                  {func.nome}
                </div>
                <div style={{ 
                  fontSize: isMobile ? '11px' : '12px', 
                  color: 'var(--muted)',
                  display: 'flex',
                  gap: 12,
                  flexWrap: 'wrap'
                }}>
                  <span>Dias: {func.diasTrabalhados}</span>
                  <span>Horas: {func.horasFormatadas}</span>
                  {func.atrasoTotal > 0 && (
                    <span style={{ color: '#ef4444' }}>
                      Atraso: {func.atrasoFormatado}
                    </span>
                  )}
                </div>
              </div>
              
              <div style={{
                width: 60,
                height: 8,
                background: '#e5e7eb',
                borderRadius: 4,
                overflow: 'hidden',
                marginLeft: 12
              }}>
                <div
                  style={{
                    width: `${Math.min(100, (func.horasTrabalhadas / (8 * 60)) * 100)}%`,
                    height: '100%',
                    background: func.atrasoTotal > 60 ? '#ef4444' : 
                               func.atrasoTotal > 15 ? '#f59e0b' : '#10b981',
                    borderRadius: 4
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* ====== Componente principal ====== */
export default function DashboardAdm() {
  // Estado para controlar se está em mobile
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth <= 900 : true);
  
  // Semana atual ou dia atual (dependendo do mobile)
  const [dataRef, setDataRef] = useState(() => startOfWeek(new Date()));
  const [diaAtual, setDiaAtual] = useState(new Date());
  
  // Estado para filtro de funcionário
  const [filtroFuncionario, setFiltroFuncionario] = useState('todos');
  
  const dias = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(dataRef, i)), [dataRef]);

  const api = useApi();
  const [funcionarios, setFuncionarios] = useState([]);
  const [escalas, setEscalas] = useState([]);
  const [apontamentos, setApontamentos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const refreshRef = useRef(null);
  const liveRef = useRef(null);

  // Detecta mudança de tamanho da tela
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 900);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Navegação
  const semanaAnterior = () => setDataRef(addDays(dataRef, -7));
  const semanaSeguinte = () => setDataRef(addDays(dataRef, 7));
  const semanaAtual = () => {
    const hoje = new Date();
    setDataRef(startOfWeek(hoje));
    setDiaAtual(hoje);
  };

  const diaAnterior = () => setDiaAtual(addDays(diaAtual, -1));
  const diaSeguinte = () => setDiaAtual(addDays(diaAtual, 1));
  const irParaHoje = () => setDiaAtual(new Date());

  const carregarTudo = useCallback(async () => {
    setLoading(true);
    setErr("");
    setMsg("");
    try {
      const de = isMobile ? toISO(addDays(diaAtual, -1)) : toISO(dias[0]);
      const ate = isMobile ? toISO(addDays(diaAtual, 1)) : toISO(dias[6]);
      const q = (s) => encodeURIComponent(s);

      const [f, e, a] = await Promise.all([
        api(`/api/funcionarios?ativos=1`),
        api(`/api/escalas?from=${q(de)}&to=${q(ate)}&ativos=1`),
        api(`/api/apontamentos?from=${q(de)}&to=${q(ate)}&ativos=1`),
      ]);

      setFuncionarios(f.funcionarios || []);
      setEscalas(e.escalas || []);
      setApontamentos(Array.isArray(a) ? a : (a.apontamentos || []));

      const feedback = "Dados atualizados.";
      setMsg(feedback);
      if (liveRef.current) liveRef.current.textContent = feedback;
    } catch (e) {
      setErr(e.message || "Falha ao carregar dados.");
      if (liveRef.current) liveRef.current.textContent = "Erro ao carregar dados.";
    } finally {
      setLoading(false);
    }
  }, [api, dias, diaAtual, isMobile]);

  // carrega na montagem e quando mudar a semana/dia
  useEffect(() => { carregarTudo(); }, [carregarTudo]);

  // Auto refresh 60s
  useEffect(() => {
    if (autoRefresh) {
      refreshRef.current = setInterval(() => carregarTudo(), 60000);
    } else if (refreshRef.current) {
      clearInterval(refreshRef.current);
    }
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

  // Group apontamentos por (data, funcionario, turno)
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
    return m;
  }, [apontamentos]);

  // Filtrar dados baseado no filtro selecionado
  const funcionariosFiltrados = useMemo(() => {
    if (filtroFuncionario === 'todos') return funcionarios;
    return funcionarios.filter(f => f.id.toString() === filtroFuncionario);
  }, [funcionarios, filtroFuncionario]);

  // Escalas filtradas
  const escalasFiltradas = useMemo(() => {
    if (filtroFuncionario === 'todos') return escalas;
    return escalas.filter(e => e.funcionario_id.toString() === filtroFuncionario);
  }, [escalas, filtroFuncionario]);

  // Apontamentos filtrados
  const apontamentosFiltrados = useMemo(() => {
    if (filtroFuncionario === 'todos') return apontamentos;
    return apontamentos.filter(a => {
      const funcId = a.funcionario_id ?? a.funcionarioId ?? a.funcionario;
      return funcId.toString() === filtroFuncionario;
    });
  }, [apontamentos, filtroFuncionario]);

  // Re-criar índices com dados filtrados
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
    return m;
  }, [apontamentosFiltrados]);

  /* ========= Cálculos de KPIs ========= */
  const kpis = useMemo(() => {
    const hojeISO = toISO(new Date());
    const alvoISO = isMobile ? toISO(diaAtual) : 
                   (dias.some(d => toISO(d) === hojeISO) ? hojeISO : toISO(dias[0]));

    const arrEsc = escalasByDiaFiltrado.get(alvoISO) || [];

    const escaladosSet = new Set();
    const presentesSet = new Set();
    let atrasos = 0;
    let minutosTotais = 0;

    for (const e of arrEsc) {
      const funcId = e.funcionario_id;
      escaladosSet.add(funcId);

      const entradaEsc = e.entrada ? hhmmToMinutes(e.entrada) : null;
      const key = `${alvoISO}|${funcId}|${e.turno_ordem ?? 1}`;
      const cons = consolidateApontamentos(apontByKeyFiltrado.get(key) || [], alvoISO);

      if (cons?.entradaMin != null) {
        presentesSet.add(funcId);

        if (entradaEsc != null) {
          const delta = cons.entradaMin - entradaEsc;
          if (delta > 5) atrasos++;
        }

        const fim = cons.saidaMin ?? cons.entradaMin;
        const dur = Math.max(0, fim - cons.entradaMin);
        minutosTotais += dur;
      }
    }

    const escalados = escaladosSet.size;
    const presentes = presentesSet.size;
    const ausentes  = Math.max(0, escalados - presentes);

    return {
      escalados,
      presentes,
      ausentes,
      atrasos,
      horasTotaisFmt: minutesToHHhMM(minutosTotais),
    };
  }, [apontByKeyFiltrado, escalasByDiaFiltrado, dias, diaAtual, isMobile]);

  /* ========= Render helpers ========= */
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

  /* ========= Timeline simplificada ========= */
  const LinhaTempoDia = ({ data }) => {
    const dataISO = toISO(data);
    const escalasDia = escalasByDiaFiltrado.get(dataISO) || [];

    return (
      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          background: "var(--panel)",
          padding: 12
        }}
        aria-label={`Agenda de ${formatDateFull(data)}`}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
          <strong style={{ color: "var(--fg)" }}>
            {DIAS_SEMANA_LONGO[data.getDay() === 0 ? 6 : data.getDay() - 1]} • {formatDateBR(data)}
          </strong>
          <span style={{ color: "var(--muted)", fontSize: "var(--fs-12)" }}>
            {escalasDia.length} turno(s) escalado(s)
          </span>
        </div>

        {escalasDia.length === 0 ? (
          <div style={{ color: "var(--muted)", fontSize: "var(--fs-14)" }}>Sem escalas para este dia.</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {escalasDia.map((e) => {
              const key = `${dataISO}|${e.funcionario_id}|${e.turno_ordem ?? 1}`;
              const cons = consolidateApontamentos(apontByKeyFiltrado.get(key) || [], dataISO);
              const f = mapFunc.get(e.funcionario_id);
              const cor = f?.cor || "var(--accent-bg)";

              const entrada = e.entrada || (cons?.entradaMin != null ? `${String(Math.floor(cons.entradaMin / 60)).padStart(2,"0")}:${String(cons.entradaMin % 60).padStart(2,"0")}` : "—");
              const saida  = e.saida  || (cons?.saidaMin   != null ? `${String(Math.floor(cons.saidaMin / 60)).padStart(2,"0")}:${String(cons.saidaMin % 60).padStart(2,"0")}`   : "—");

              return (
                <div
                  key={key}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: 8,
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    background: "var(--panel-muted)",
                    padding: 12
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, color: "var(--fg)" }}>
                      {f?.nome || `#${e.funcionario_id}`} {f?.cargo ? <span style={{ color: "var(--muted)", fontWeight: 400 }}>• {f.cargo}</span> : null}
                    </div>
                    <div style={{ fontSize: "var(--fs-12)", color: "var(--muted)" }}>
                      Turno {e.turno_ordem ?? 1} — {entrada} — {saida}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      aria-hidden="true"
                      style={{ width: 12, height: 12, borderRadius: 999, background: cor, display: "inline-block" }}
                    />
                    {cons?.parcial ? <StatusBadge tone="yellow">Em andamento</StatusBadge> : <StatusBadge tone="green">Consolidado</StatusBadge>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  /* ========= Render ========= */
  const tituloPeriodo = isMobile
    ? `Dia ${formatDateFull(diaAtual)}`
    : `Semana ${formatDateBR(dias[0])} — ${formatDateBR(dias[6])}`;

  return (
    <div className="container" role="main" aria-labelledby="titulo-pagina" style={{ paddingBlock: 16 }}>
      {/* Live region para mensagens globais */}
      <div ref={liveRef} id="announce" aria-live="polite" className="visually-hidden" />

      {/* HEADER PADRONIZADO */}
      <header
        style={{
          background: "var(--panel)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: 16,
          marginBottom: 16,
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: 12
        }}
      >
        {/* Título e período */}
        <div>
          <h1 id="titulo-pagina" style={{ margin: "0 0 4px 0", fontSize: "clamp(1.5rem, 4vw, 2rem)", color: "var(--fg)" }}>
            Administração
          </h1>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: "clamp(var(--fs-14), 3vw, var(--fs-16))" }}>
            {tituloPeriodo}
          </p>
        </div>

        {/* Barra de ações responsiva */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            alignItems: "center",
            justifyContent: "flex-start"
          }}
          aria-label="Ações do painel"
        >
          {/* Filtro funcionário */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <label htmlFor="filtro-func" className="visually-hidden">Filtrar por funcionário</label>
            <select
              id="filtro-func"
              value={filtroFuncionario}
              onChange={(e) => setFiltroFuncionario(e.target.value)}
              style={{
                padding: "8px 12px",
                border: "1px solid var(--border)",
                borderRadius: 8,
                background: "var(--panel)",
                color: "var(--fg)",
                fontSize: "var(--fs-14)"
              }}
              aria-label="Filtrar por funcionário"
            >
              <option value="todos">Todos</option>
              {funcionarios.map((f) => (
                <option key={f.id} value={String(f.id)}>
                  {f.pessoa_nome || f?.pessoa?.nome || f.nome || `#${f.id}`}
                </option>
              ))}
            </select>
          </div>

          {/* Navegação por período */}
          {isMobile ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }} aria-label="Navegação por dia">
              <button type="button" className="toggle-btn" onClick={diaAnterior} aria-label="Dia anterior">◀</button>
              <button type="button" className="toggle-btn" onClick={irParaHoje} aria-label="Ir para hoje">Hoje</button>
              <button type="button" className="toggle-btn" onClick={diaSeguinte} aria-label="Dia seguinte">▶</button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }} aria-label="Navegação por semana">
              <button type="button" className="toggle-btn" onClick={semanaAnterior} aria-label="Semana anterior">◀</button>
              <button type="button" className="toggle-btn" onClick={semanaAtual} aria-label="Semana atual">Essa semana</button>
              <button type="button" className="toggle-btn" onClick={semanaSeguinte} aria-label="Próxima semana">▶</button>
            </div>
          )}

          {/* Atualizar e Auto-refresh */}
          <button
            type="button"
            className="toggle-btn"
            onClick={carregarTudo}
            disabled={loading}
            aria-busy={loading ? "true" : "false"}
            aria-label="Atualizar dados"
            title="Atualizar"
            style={{ opacity: loading ? 0.7 : 1 }}
          >
            {loading ? "Atualizando…" : "Atualizar"}
          </button>

          <button
            type="button"
            onClick={() => setAutoRefresh(v => !v)}
            className={`toggle-btn ${autoRefresh ? "is-active" : ""}`}
            aria-pressed={autoRefresh ? "true" : "false"}
            aria-label="Alternar atualização automática"
            title="Auto atualização a cada 60s"
          >
            Auto 60s
          </button>
        </div>
      </header>

      {/* Alertas */}
      {err && (
        <div
          role="alert"
          style={{
            background: "#fef2f2",
            color: "var(--error-strong)",
            border: "1px solid #fecaca",
            borderRadius: 8,
            padding: "12px 16px",
            marginBottom: 16,
            fontSize: "var(--fs-14)",
          }}
        >
          {err}
        </div>
      )}
      {msg && (
        <div
          role="status"
          style={{
            background: "rgba(16,185,129,.08)",
            color: "var(--success-strong)",
            border: "1px solid rgba(16,185,129,.35)",
            borderRadius: 8,
            padding: "12px 16px",
            marginBottom: 16,
            fontSize: "var(--fs-14)",
          }}
        >
          {msg}
        </div>
      )}

      {/* KPIs */}
      <section className="stats-grid" aria-label="Indicadores principais">
        <Kpi label="Escalados (hoje)" value={kpis.escalados} />
        <Kpi label="Presentes (hoje)" value={kpis.presentes} />
        <Kpi label="Ausentes (hoje)" value={kpis.ausentes} />
        <Kpi label="Atrasos (hoje)" value={kpis.atrasos} sub={`Tempo total: ${kpis.horasTotaisFmt}`} />
      </section>

      {/* Horas trabalhadas */}
      <HorasTrabalhadas
        funcionarios={funcionariosFiltrados}
        escalasByDia={escalasByDiaFiltrado}
        apontByKey={apontByKeyFiltrado}
        filtroFuncionario={filtroFuncionario}
        isMobile={isMobile}
      />

      {/* Agenda / Timeline */}
      <section aria-label="Agenda" style={{ display: "grid", gap: 12 }}>
        {isMobile ? (
          <LinhaTempoDia data={diaAtual} />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 12, minWidth: 960 }}>
            {dias.map((d) => (
              <LinhaTempoDia key={toISO(d)} data={d} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}