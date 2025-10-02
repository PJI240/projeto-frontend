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
  <div className="stat-card">
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
    <div style={{
      background: "var(--panel)",
      borderRadius: 8,
      border: "1px solid var(--border)",
      padding: 16,
      marginBottom: 16
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        flexWrap: 'wrap',
        gap: 12
      }}>
        <h3 style={{ margin: 0, fontSize: isMobile ? 16 : 18 }}>
          Horas Trabalhadas
        </h3>
        
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select 
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
            style={{
              padding: '6px 12px',
              border: '1px solid var(--border)',
              borderRadius: 6,
              background: 'var(--panel)',
              fontSize: 14
            }}
          >
            <option value="hoje">Hoje</option>
            <option value="semana">Esta Semana</option>
            <option value="mes">Este Mês</option>
          </select>
        </div>
      </div>

      {horasPorFuncionario.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 20, color: 'var(--muted)' }}>
          Nenhum dado encontrado para o período selecionado
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
            >
              <div style={{ flex: 1 }}>
                <div style={{ 
                  fontWeight: 600, 
                  fontSize: isMobile ? 14 : 15,
                  marginBottom: 4
                }}>
                  {func.nome}
                </div>
                <div style={{ 
                  fontSize: isMobile ? 11 : 12, 
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
    </div>
  );
}

/* ====== Componente principal ====== */
export default function DashboardAdm() {
  // Estado para controlar se está em mobile
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 900);
  
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
  const [autoRefresh, setAutoRefresh] = useState(false);
  const refreshRef = useRef(null);

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
    try {
      // No mobile carrega apenas +/- 1 dia do dia atual para performance
      // No desktop carrega a semana inteira
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
    } catch (e) {
      setErr(e.message || "Falha ao carregar dados.");
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
    // No mobile usa o dia atual, no desktop usa hoje se estiver na semana ou primeiro dia
    const alvoISO = isMobile ? toISO(diaAtual) : 
                   (dias.some(d => toISO(d) === toISO(new Date())) ? toISO(new Date()) : toISO(dias[0]));

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

  /* ========= Grade da Semana (Desktop) ========= */
  const DiasAgendaDesktop = () => {
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "100px repeat(7, 1fr)",
          minWidth: 1040,
          border: "1px solid var(--border)",
          borderRadius: 8,
          overflow: "hidden",
          background: "var(--panel)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        }}
      >
        {/* Cabeçalho */}
        <div
          style={{
            padding: "16px 12px",
            borderBottom: "2px solid var(--border)",
            background: "var(--panel-muted)",
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          HORA
        </div>
        {dias.map((dia, i) => (
          <div
            key={i}
            style={{
              padding: "12px",
              borderBottom: "2px solid var(--border)",
              textAlign: "center",
              background: "var(--panel-muted)",
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 14 }}>{DIAS_SEMANA_CURTO[i]}</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{formatDateBR(dia)}</div>
          </div>
        ))}

        {/* Coluna de horas com linhas */}
        <div
          style={{
            position: "relative",
            borderRight: "1px solid var(--border)",
            background:
              "repeating-linear-gradient(to bottom, transparent, transparent 59px, var(--border) 60px)",
            height: dayHeight,
          }}
        >
          {Array.from({ length: CONFIG_HORARIOS.fim - CONFIG_HORARIOS.inicio + 1 }, (_, idx) => (
            <div
              key={idx}
              style={{
                position: "absolute",
                top: (idx * dayHeight) / (CONFIG_HORARIOS.fim - CONFIG_HORARIOS.inicio),
                left: 0,
                right: 0,
                height: 0,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: -8,
                  right: 8,
                  fontSize: 12,
                  color: "var(--muted)",
                }}
              >
                {String(CONFIG_HORARIOS.inicio + idx).padStart(2, "0")}:00
              </div>
            </div>
          ))}
        </div>

        {/* 7 colunas do período */}
        {dias.map((dia, idxDia) => {
          const dataISO = toISO(dia);
          const arrEsc = (escalasByDiaFiltrado.get(dataISO) || []).slice();

          return (
            <div
              key={idxDia}
              style={{
                position: "relative",
                height: dayHeight,
                borderRight: idxDia === 6 ? "none" : "1px solid var(--border)",
                background:
                  "repeating-linear-gradient(to bottom, transparent, transparent 59px, var(--border) 60px)",
              }}
            >
              {/* Linha "agora" */}
              {toISO(new Date()) === dataISO && (() => {
                const now = new Date();
                const nowMin = now.getHours() * 60 + now.getMinutes();
                if (nowMin >= minVisible && nowMin <= maxVisible) {
                  const top = ((nowMin - minVisible) / minutesSpan) * dayHeight;
                  return (
                    <div
                      style={{
                        position: "absolute",
                        left: 0,
                        right: 0,
                        top,
                        height: 2,
                        background: "rgba(59,130,246,0.9)",
                        boxShadow: "0 0 0 1px rgba(59,130,246,0.4)",
                      }}
                    />
                  );
                }
                return null;
              })()}

              {/* Blocos de ESCALA */}
              {arrEsc.map((e, idx) => {
                const func = mapFunc.get(e.funcionario_id);
                if (!func) return null;
                const ini = hhmmToMinutes(e.entrada);
                const end = hhmmToMinutes(e.saida) ?? ini;
                const style = blockStyleByMinutes(ini, end);
                return (
                  <div
                    key={`esc-${e.id}-${idx}`}
                    style={{
                      ...style,
                      border: `2px solid ${func.cor}`,
                      background: "transparent",
                      display: "flex",
                      alignItems: "center",
                      padding: "6px 8px",
                      gap: 8,
                    }}
                    title={`Escala • ${func.nome} (${e.entrada || "--"} - ${e.saida || "--"}) • Turno ${e.turno_ordem}`}
                  >
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 999,
                        background: func.cor,
                      }}
                    />
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--fg)" }}>
                      {func.nome}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>
                      {e.entrada || "--"} – {e.saida || "--"}
                    </div>
                  </div>
                );
              })}

              {/* Blocos de APONTAMENTO */}
              {arrEsc.map((e, idx) => {
                const func = mapFunc.get(e.funcionario_id);
                if (!func) return null;

                const key = `${dataISO}|${e.funcionario_id}|${e.turno_ordem ?? 1}`;
                const cons = consolidateApontamentos(apontByKeyFiltrado.get(key) || [], dataISO);
                if (!cons?.entradaMin) return null;

                const style = blockStyleByMinutes(cons.entradaMin, cons.saidaMin);
                const atrasoMin = e.entrada ? (cons.entradaMin - hhmmToMinutes(e.entrada)) : null;
                const dur = (cons.saidaMin ?? cons.entradaMin) - cons.entradaMin;

                const status =
                  atrasoMin == null ? "PRESENTE"
                  : atrasoMin > 5   ? "ATRASO"
                  : atrasoMin < -5  ? "ADIANTADO"
                  : "PONTUAL";

                const tone =
                  status === "ATRASO"   ? "yellow"
                : status === "ADIANTADO" ? "blue"
                : status === "PONTUAL"   ? "green"
                : "emerald";

                return (
                  <div
                    key={`apo-${e.id}-${idx}`}
                    style={{
                      ...style,
                      background: func.cor,
                      color: "white",
                      boxShadow: "0 2px 6px rgba(0,0,0,.12)",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "6px 8px",
                      opacity: cons.parcial ? 0.9 : 1,
                    }}
                    title={`Apontamento • ${func.nome} (${minutesToHHhMM(dur)}${cons.parcial ? " • em andamento" : ""})`}
                  >
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 999,
                        background: "white",
                        opacity: 0.9,
                      }}
                    />
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{func.nome}</div>
                    <div style={{ fontSize: 11, opacity: 0.95 }}>
                      {String(Math.floor(cons.entradaMin / 60)).padStart(2, "0")}:
                      {String(cons.entradaMin % 60).padStart(2, "0")}
                      {" – "}
                      {cons.saidaMin != null
                        ? `${String(Math.floor(cons.saidaMin / 60)).padStart(2, "0")}:${String(cons.saidaMin % 60).padStart(2, "0")}`
                        : "em andamento"}
                    </div>
                    <div style={{ marginLeft: "auto" }}>
                      <StatusBadge tone={tone}>
                        {status}{atrasoMin != null ? ` (${atrasoMin > 0 ? "+" : ""}${atrasoMin}m)` : ""}
                      </StatusBadge>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };

  /* ========= Dia Único (Mobile) ========= */
  const DiaAgendaMobile = () => {
    const dataISO = toISO(diaAtual);
    const arrEsc = (escalasByDiaFiltrado.get(dataISO) || []).slice();
    const diaSemana = diaAtual.getDay();
    const nomeDia = DIAS_SEMANA_LONGO[(diaSemana + 6) % 7]; // Ajuste para Seg=0

    return (
      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: 8,
          overflow: "hidden",
          background: "var(--panel)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        }}
      >
        {/* Cabeçalho do dia */}
        <div
          style={{
            padding: "16px",
            borderBottom: "2px solid var(--border)",
            background: "var(--panel-muted)",
            textAlign: "center",
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
            {nomeDia}
          </div>
          <div style={{ fontSize: 14, color: "var(--muted)" }}>
            {formatDateFull(diaAtual)}
          </div>
        </div>

        {/* Grade do dia */}
        <div
          style={{
            position: "relative",
            height: dayHeight,
            background:
              "repeating-linear-gradient(to bottom, transparent, transparent 39px, var(--border) 40px)",
          }}
        >
          {/* Linhas de hora */}
          {Array.from({ length: CONFIG_HORARIOS.fim - CONFIG_HORARIOS.inicio + 1 }, (_, idx) => (
            <div
              key={idx}
              style={{
                position: "absolute",
                top: (idx * dayHeight) / (CONFIG_HORARIOS.fim - CONFIG_HORARIOS.inicio),
                left: 0,
                right: 0,
                height: 0,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: -6,
                  left: 8,
                  fontSize: 11,
                  color: "var(--muted)",
                  background: "var(--panel)",
                  padding: "2px 6px",
                  borderRadius: 4,
                }}
              >
                {String(CONFIG_HORARIOS.inicio + idx).padStart(2, "0")}:00
              </div>
            </div>
          ))}

          {/* Linha "agora" */}
          {toISO(new Date()) === dataISO && (() => {
            const now = new Date();
            const nowMin = now.getHours() * 60 + now.getMinutes();
            if (nowMin >= minVisible && nowMin <= maxVisible) {
              const top = ((nowMin - minVisible) / minutesSpan) * dayHeight;
              return (
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top,
                    height: 2,
                    background: "rgba(59,130,246,0.9)",
                    boxShadow: "0 0 0 1px rgba(59,130,246,0.4)",
                  }}
                />
              );
            }
            return null;
          })()}

          {/* Blocos de ESCALA */}
          {arrEsc.map((e, idx) => {
            const func = mapFunc.get(e.funcionario_id);
            if (!func) return null;
            const ini = hhmmToMinutes(e.entrada);
            const end = hhmmToMinutes(e.saida) ?? ini;
            const style = blockStyleByMinutes(ini, end);
            return (
              <div
                key={`esc-mobile-${e.id}-${idx}`}
                style={{
                  ...style,
                  border: `2px solid ${func.cor}`,
                  background: "transparent",
                  display: "flex",
                  alignItems: "center",
                  padding: "4px 6px",
                  gap: 6,
                }}
                title={`Escala • ${func.nome} (${e.entrada || "--"} - ${e.saida || "--"})`}
              >
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 999,
                    background: func.cor,
                  }}
                />
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--fg)" }}>
                  {func.nome}
                </div>
                <div style={{ fontSize: 10, color: "var(--muted)" }}>
                  {e.entrada || "--"}–{e.saida || "--"}
                </div>
              </div>
            );
          })}

          {/* Blocos de APONTAMENTO */}
          {arrEsc.map((e, idx) => {
            const func = mapFunc.get(e.funcionario_id);
            if (!func) return null;

            const key = `${dataISO}|${e.funcionario_id}|${e.turno_ordem ?? 1}`;
            const cons = consolidateApontamentos(apontByKeyFiltrado.get(key) || [], dataISO);
            if (!cons?.entradaMin) return null;

            const style = blockStyleByMinutes(cons.entradaMin, cons.saidaMin);
            const atrasoMin = e.entrada ? (cons.entradaMin - hhmmToMinutes(e.entrada)) : null;

            const status =
              atrasoMin == null ? "PRESENTE"
              : atrasoMin > 5   ? "ATRASO"
              : atrasoMin < -5  ? "ADIANTADO"
              : "PONTUAL";

            return (
              <div
                key={`apo-mobile-${e.id}-${idx}`}
                style={{
                  ...style,
                  background: func.cor,
                  color: "white",
                  boxShadow: "0 1px 4px rgba(0,0,0,.12)",
                  display: "flex",
                  flexDirection: "column",
                  padding: "4px 6px",
                  gap: 2,
                  opacity: cons.parcial ? 0.9 : 1,
                }}
                title={`Apontamento • ${func.nome}`}
              >
                <div style={{ fontSize: 10, fontWeight: 700, lineHeight: 1.2 }}>
                  {func.nome}
                </div>
                <div style={{ fontSize: 9, opacity: 0.95, lineHeight: 1.2 }}>
                  {String(Math.floor(cons.entradaMin / 60)).padStart(2, "0")}:
                  {String(cons.entradaMin % 60).padStart(2, "0")}
                  {cons.saidaMin != null ? `–${String(Math.floor(cons.saidaMin / 60)).padStart(2, "0")}:${String(cons.saidaMin % 60).padStart(2, "0")}` : " (andamento)"}
                </div>
                <div style={{ fontSize: 8, opacity: 0.9 }}>
                  <StatusBadge tone={status === "ATRASO" ? "yellow" : status === "ADIANTADO" ? "blue" : "green"}>
                    {status}
                  </StatusBadge>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /* ========= Legenda ========= */
  const Legenda = () => (
    <div
      style={{
        display: "flex",
        gap: 12,
        flexWrap: "wrap",
        padding: 12,
        background: "var(--panel)",
        borderRadius: 8,
        border: "1px solid var(--border)",
        fontSize: isMobile ? 12 : 14,
      }}
    >
      <div style={{ fontWeight: 600, color: "var(--muted)" }}>Legenda:</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ width: 12, height: 12, border: "2px solid var(--fg)", borderRadius: 3 }} />
        <span>Escala</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ width: 12, height: 12, background: "var(--fg)", borderRadius: 3 }} />
        <span>Apontamento</span>
      </div>
      {funcionariosFiltrados.slice(0, isMobile ? 6 : 12).map((f) => (
        <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ 
            width: 12, 
            height: 12, 
            background: getCorFuncionario(f.id), 
            borderRadius: 3, 
            border: "1px solid var(--border)" 
          }} />
          <span style={{ fontSize: isMobile ? 11 : 13 }}>
            {f.pessoa_nome?.split(' ')[0]}
          </span>
        </div>
      ))}
      {funcionariosFiltrados.length > (isMobile ? 6 : 12) && (
        <div style={{ fontSize: 11, color: "var(--muted)" }}>
          +{funcionariosFiltrados.length - (isMobile ? 6 : 12)}...
        </div>
      )}
    </div>
  );

  return (
    <>
      <header className="main-header">
        <div className="header-content">
          <h1>Painel do Administrador</h1>
          <p>
            {isMobile 
              ? "Escala × Apontamento" 
              : "Escala × Apontamento"
            }
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
 {/* Navegação por semana/dia */}
          {isMobile ? (
            <>
              <button className="toggle-btn" onClick={diaAnterior}>←</button>
              <button className="toggle-btn" onClick={irParaHoje}>Hoje</button>
              <button className="toggle-btn" onClick={diaSeguinte}>→</button>
            </>
          ) : (
            <>
              <button className="toggle-btn" onClick={semanaAnterior}>←</button>
              <button className="toggle-btn" onClick={semanaAtual}>Hoje</button>
              <button className="toggle-btn" onClick={semanaSeguinte}>→</button>
            </>
          )}
          
          {/* Filtro de funcionário */}
          <select 
            value={filtroFuncionario}
            onChange={(e) => setFiltroFuncionario(e.target.value)}
            style={{
              padding: '6px 12px',
              border: '1px solid var(--border)',
              borderRadius: 6,
              background: 'var(--panel)',
              fontSize: 14,
              minWidth: 150
            }}
          >
            <option value="todos">Todos os funcionários</option>
            {funcionarios.map(f => (
              <option key={f.id} value={f.id}>
                {f.pessoa_nome || f?.pessoa?.nome || f.nome || `#${f.id}`}
              </option>
            ))}
          </select>

         
          
          <button className="toggle-btn" onClick={carregarTudo} disabled={loading}>
            {loading ? "Atualizando..." : "Atualizar"}
          </button>
          <label className="toggle-btn" style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Atualizar Automático
          </label>
        </div>
      </header>

      {err && <div className="error-alert" role="alert" style={{ marginBottom: 16 }}>{err}</div>}

      {/* KPIs */}
      <section className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{kpis.escalados}</div>
          <div className="stat-title">Escalados (dia)</div>
        </div>

        <div className="stat-card" data-accent="success">
          <div className="stat-value">{kpis.presentes}</div>
          <div className="stat-title">Presentes</div>
        </div>

        <div className="stat-card" data-accent="error">
          <div className="stat-value">{kpis.ausentes}</div>
          <div className="stat-title">Ausentes</div>
        </div>

        <div className="stat-card" data-accent="warning">
          <div className="stat-value">{kpis.atrasos}</div>
          <div className="stat-title">Atrasos (turnos)</div>
        </div>
      </section>

      {/* Grade agenda */}
      {isMobile ? <DiaAgendaMobile /> : <DiasAgendaDesktop />}

      {/* Legenda */}
      <div style={{ marginTop: 16 }}>
        <Legenda />
      </div>

      {/* Notas */}
      <section style={{ 
        fontSize: isMobile ? 11 : 12, 
        color: "var(--muted)", 
        marginTop: 12 
      }}>
        <ul style={{ listStyle: "disc", paddingLeft: 20, display: "flex", flexDirection: "column", gap: 4 }}>
          <li><strong>Escala</strong> (contorno) representa o planejado; <strong>Apontamento</strong> (preenchido) representa o realizado.</li>
          <li><strong>Atraso</strong> é calculado pela diferença entre entrada apontada e entrada da escala (&gt; 5 min).</li>                    
        </ul>
      </section>
      {/* Componente de Horas Trabalhadas */}
      <HorasTrabalhadas 
        funcionarios={funcionariosFiltrados}
        escalasByDia={escalasByDiaFiltrado}
        apontByKey={apontByKeyFiltrado}
        filtroFuncionario={filtroFuncionario}
        isMobile={isMobile}
      />
    </>
  );
}
