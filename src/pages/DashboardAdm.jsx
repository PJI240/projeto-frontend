// src/pages/DashboardAdm.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE?.replace(/\/+$/, "") || "";

/* ====== Utils de data/hora BR ====== */
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
function formatMonthYear(d) {
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
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
const CONFIG_HORARIOS = { inicio: 6, fim: 22 };

/* ====== Cores por funcionário ====== */
const CORES_FUNCIONARIOS = [
  "#3b82f6", "#ef4444", "#10b981", "#f59e0b",
  "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16",
  "#f97316", "#6366f1", "#14b8a6", "#84cc16",
  "#eab308", "#a855f7", "#f43f5e", "#0ea5e9",
];
const getCorFuncionario = (id) => CORES_FUNCIONARIOS[id % CORES_FUNCIONARIOS.length];

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

/* ====== Consolidação de apontamentos ====== */
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
    origem: (pri[bestEntradaOrigem] || 0) >= (pri[bestSaidaOrigem] || 0) ? bestEntradaOrigem : bestSaidaOrigem,
  };
}

/* ====== Componentes Visuais Melhorados ====== */
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

const KpiCard = ({ label, value, sub, trend }) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-200 group">
    <div className="flex items-center justify-between">
      <div className="flex-1">
        <div className="text-sm font-medium text-gray-500 mb-1">{label}</div>
        <div className="text-2xl font-bold text-gray-900 mb-1">{value}</div>
        {sub && (
          <div className="flex items-center gap-2">
            <div className="text-xs text-gray-500">{sub}</div>
            {trend && (
              <span className={`text-xs font-medium ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {trend > 0 ? '↗' : '↘'} {Math.abs(trend)}%
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  </div>
);

const TimeIndicator = ({ time, isCurrent = false }) => (
  <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${
    isCurrent 
      ? 'bg-blue-100 text-blue-800 border border-blue-200' 
      : 'bg-gray-100 text-gray-600 border border-gray-200'
  }`}>
    <div className={`w-2 h-2 rounded-full ${isCurrent ? 'bg-blue-500 animate-pulse' : 'bg-gray-400'}`} />
    {time}
  </div>
);

/* ====== Componente principal ====== */
export default function DashboardAdm() {
  const [dataRef, setDataRef] = useState(() => startOfWeek(new Date()));
  const dias = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(dataRef, i)), [dataRef]);

  const api = useApi();
  const [funcionarios, setFuncionarios] = useState([]);
  const [escalas, setEscalas] = useState([]);
  const [apontamentos, setApontamentos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const refreshRef = useRef(null);

  // Navegação
  const semanaAnterior = () => setDataRef(addDays(dataRef, -7));
  const semanaSeguinte = () => setDataRef(addDays(dataRef, 7));
  const semanaAtual = () => setDataRef(startOfWeek(new Date()));

  const carregarTudo = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const de = toISO(dias[0]);
      const ate = toISO(dias[6]);
      const [f, e, a] = await Promise.all([
        api(`/api/funcionarios?ativos=1`),
        api(`/api/escalas?from=${de}&to=${ate}`),
        api(`/api/apontamentos?from=${de}&to=${ate}`),
      ]);
      setFuncionarios(f.funcionarios || []);
      setEscalas(e.escalas || []);
      setApontamentos(a.apontamentos || a || []);
    } catch (e) {
      setErr(e.message || "Falha ao carregar dados.");
    } finally {
      setLoading(false);
    }
  }, [api, dias]);

  useEffect(() => {
    carregarTudo();
  }, [carregarTudo]);

  useEffect(() => {
    if (escalas.length || apontamentos.length) carregarTudo();
  }, [dataRef]);

  useEffect(() => {
    if (autoRefresh) {
      refreshRef.current = setInterval(() => carregarTudo(), 60000);
    } else if (refreshRef.current) {
      clearInterval(refreshRef.current);
    }
    return () => refreshRef.current && clearInterval(refreshRef.current);
  }, [autoRefresh, carregarTudo]);

  /* ========= Processamento de dados ========= */
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

  const escalasByDia = useMemo(() => {
    const m = new Map();
    for (const e of escalas) {
      if (!e.data || !e.funcionario_id) continue;
      const arr = m.get(e.data) || [];
      arr.push(e);
      m.set(e.data, arr);
    }
    return m;
  }, [escalas]);

  const apontByKey = useMemo(() => {
    const m = new Map();
    for (const a of apontamentos) {
      const funcId = a.funcionario_id ?? a.funcionarioId ?? a.funcionario;
      if (!a.data || !funcId) continue;
      const k = `${a.data}|${funcId}|${a.turno_ordem ?? 1}`;
      const arr = m.get(k) || [];
      arr.push(a);
      m.set(k, arr);
    }
    return m;
  }, [apontamentos]);

  /* ========= KPIs ========= */
  const kpis = useMemo(() => {
    let escalados = 0, presentes = 0, ausentes = 0, atrasos = 0, minutosTotais = 0;

    for (const [dataISO, arrEsc] of escalasByDia) {
      const vistos = new Set();
      for (const e of arrEsc) {
        const funcId = e.funcionario_id;
        const entradaEsc = e.entrada ? hhmmToMinutes(e.entrada) : null;
        const key = `${dataISO}|${funcId}|${e.turno_ordem ?? 1}`;
        const cons = consolidateApontamentos(apontByKey.get(key) || [], dataISO);

        if (!vistos.has(funcId)) {
          escalados++;
          vistos.add(funcId);
        }

        if (cons?.entradaMin != null) {
          presentes++;
          if (entradaEsc != null) {
            const delta = cons.entradaMin - entradaEsc;
            if (delta > 5) atrasos++;
          }
          const fim = cons.saidaMin ?? cons.entradaMin;
          const dur = Math.max(0, (fim ?? 0) - cons.entradaMin);
          minutosTotais += dur;
        } else {
          ausentes++;
        }
      }
    }

    return {
      escalados,
      presentes,
      ausentes: Math.max(ausentes, 0),
      atrasos,
      horasTotaisFmt: minutesToHHhMM(minutosTotais),
    };
  }, [apontByKey, escalasByDia]);

  /* ========= Timeline Visual Melhorada ========= */
  const dayHeight = 1200;
  const minVisible = CONFIG_HORARIOS.inicio * 60;
  const maxVisible = CONFIG_HORARIOS.fim * 60;
  const minutesSpan = maxVisible - minVisible;

  function blockStyleByMinutes(iniMin, endMin) {
    if (iniMin == null) return { display: "none" };
    const start = Math.max(minVisible, iniMin);
    const end = endMin != null ? Math.min(maxVisible, endMin) : null;
    const top = ((start - minVisible) / minutesSpan) * dayHeight;
    const height = end != null ? Math.max(8, ((end - start) / minutesSpan) * dayHeight) : 16;
    return { 
      position: "absolute", 
      left: 8, 
      right: 8, 
      top, 
      height, 
      borderRadius: 8,
      transition: 'all 0.2s ease-in-out'
    };
  }

  const DiasAgenda = () => {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Cabeçalho da Timeline */}
        <div className="grid grid-cols-[120px,repeat(7,1fr)] bg-gray-50 border-b border-gray-200">
          <div className="p-4 font-semibold text-gray-700 text-sm border-r border-gray-200">
            HORÁRIO
          </div>
          {dias.map((dia, i) => {
            const isToday = toISO(new Date()) === toISO(dia);
            return (
              <div
                key={i}
                className={`p-4 text-center border-r border-gray-200 last:border-r-0 ${
                  isToday ? 'bg-blue-50 border-b-2 border-b-blue-500' : ''
                }`}
              >
                <div className={`font-bold text-sm ${isToday ? 'text-blue-700' : 'text-gray-900'}`}>
                  {DIAS_SEMANA_CURTO[i]}
                </div>
                <div className={`text-xs mt-1 ${isToday ? 'text-blue-600' : 'text-gray-500'}`}>
                  {formatDateBR(dia)}
                </div>
                {isToday && (
                  <div className="mt-1">
                    <TimeIndicator time="HOJE" isCurrent={true} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Corpo da Timeline */}
        <div className="grid grid-cols-[120px,repeat(7,1fr)] relative">
          {/* Coluna de horas */}
          <div className="border-r border-gray-200 relative" style={{ height: dayHeight }}>
            {Array.from({ length: CONFIG_HORARIOS.fim - CONFIG_HORARIOS.inicio + 1 }, (_, idx) => {
              const hora = CONFIG_HORARIOS.inicio + idx;
              const top = (idx * dayHeight) / (CONFIG_HORARIOS.fim - CONFIG_HORARIOS.inicio);
              
              return (
                <div
                  key={idx}
                  className="absolute right-3 text-xs text-gray-400 font-medium"
                  style={{ top: top - 8 }}
                >
                  {String(hora).padStart(2, "0")}:00
                </div>
              );
            })}
            {/* Linhas de grade */}
            <div 
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'repeating-linear-gradient(to bottom, transparent, transparent 59px, #f3f4f6 60px)'
              }}
            />
          </div>

          {/* Colunas dos dias */}
          {dias.map((dia, idxDia) => {
            const dataISO = toISO(dia);
            const arrEsc = (escalasByDia.get(dataISO) || []).slice();
            const isToday = toISO(new Date()) === dataISO;

            return (
              <div
                key={idxDia}
                className={`relative border-r border-gray-200 last:border-r-0 ${
                  isToday ? 'bg-blue-50/30' : ''
                }`}
                style={{ height: dayHeight }}
              >
                {/* Linha do tempo atual */}
                {isToday && (() => {
                  const now = new Date();
                  const nowMin = now.getHours() * 60 + now.getMinutes();
                  if (nowMin >= minVisible && nowMin <= maxVisible) {
                    const top = ((nowMin - minVisible) / minutesSpan) * dayHeight;
                    return (
                      <div
                        className="absolute left-0 right-0 z-20"
                        style={{ top, height: 2 }}
                      >
                        <div className="absolute left-0 w-2 h-2 bg-red-500 rounded-full -translate-y-1 -translate-x-1 animate-pulse" />
                        <div className="w-full h-0.5 bg-red-500 shadow-sm" />
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Linhas de grade */}
                <div 
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: 'repeating-linear-gradient(to bottom, transparent, transparent 59px, #f3f4f6 60px)'
                  }}
                />

                {/* Blocos de ESCALA (contornos) */}
                {arrEsc.map((e, idx) => {
                  const func = mapFunc.get(e.funcionario_id);
                  if (!func) return null;
                  const ini = hhmmToMinutes(e.entrada);
                  const end = hhmmToMinutes(e.saida) ?? ini;
                  const style = blockStyleByMinutes(ini, end);
                  
                  return (
                    <div
                      key={`esc-${e.id}-${idx}`}
                      style={style}
                      className="border-2 bg-white/80 backdrop-blur-sm hover:bg-white hover:shadow-md group"
                    >
                      <div className="flex items-center gap-2 p-2 h-full">
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: func.cor }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-gray-900 truncate">
                            {func.nome}
                          </div>
                          <div className="text-[10px] text-gray-500">
                            {e.entrada || "--"} – {e.saida || "--"}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Blocos de APONTAMENTO (preenchidos) */}
                {arrEsc.map((e, idx) => {
                  const func = mapFunc.get(e.funcionario_id);
                  if (!func) return null;
                  const key = `${dataISO}|${e.funcionario_id}|${e.turno_ordem ?? 1}`;
                  const cons = consolidateApontamentos(apontByKey.get(key) || [], dataISO);
                  if (!cons?.entradaMin) return null;
                  
                  const style = blockStyleByMinutes(cons.entradaMin, cons.saidaMin);
                  const atrasoMin = e.entrada ? (cons.entradaMin - hhmmToMinutes(e.entrada)) : null;
                  const dur = (cons.saidaMin ?? cons.entradaMin) - cons.entradaMin;
                  const status =
                    atrasoMin == null ? "PRESENTE"
                    : atrasoMin > 5 ? "ATRASO"
                    : atrasoMin < -5 ? "ADIANTADO"
                    : "PONTUAL";

                  const tone =
                    status === "ATRASO" ? "yellow"
                    : status === "ADIANTADO" ? "blue"
                    : status === "PONTUAL" ? "green"
                    : "emerald";

                  return (
                    <div
                      key={`apo-${e.id}-${idx}`}
                      style={{
                        ...style,
                        background: `linear-gradient(135deg, ${func.cor}, ${func.cor}dd)`,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                        zIndex: 10
                      }}
                      className="text-white hover:shadow-lg hover:scale-[1.02] transition-all"
                    >
                      <div className="flex items-center gap-2 p-2 h-full">
                        <div className="w-2 h-2 bg-white/90 rounded-full flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold truncate">{func.nome}</div>
                          <div className="text-[10px] opacity-90">
                            {String(Math.floor(cons.entradaMin / 60)).padStart(2, "0")}:
                            {String(cons.entradaMin % 60).padStart(2, "0")}
                            {" – "}
                            {cons.saidaMin != null
                              ? `${String(Math.floor(cons.saidaMin / 60)).padStart(2, "0")}:${String(cons.saidaMin % 60).padStart(2, "0")}`
                              : "em andamento"}
                          </div>
                        </div>
                        <div className="flex-shrink-0">
                          <StatusBadge tone={tone}>
                            {status}{atrasoMin != null ? ` (${atrasoMin > 0 ? "+" : ""}${atrasoMin}m)` : ""}
                          </StatusBadge>
                        </div>
                      </div>
                      {/* Barra de progresso para turnos em andamento */}
                      {cons.parcial && (
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/30 rounded-b">
                          <div 
                            className="h-full bg-white/50 rounded-b transition-all duration-1000"
                            style={{ width: '75%' }} // Isso seria calculado dinamicamente
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const Legenda = () => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="font-semibold text-gray-900 mb-4">Legenda do Sistema</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-gray-400 rounded bg-transparent" />
          <div>
            <div className="font-medium text-gray-900">Escala</div>
            <div className="text-gray-500 text-xs">Planejado</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 rounded bg-gray-600" />
          <div>
            <div className="font-medium text-gray-900">Apontamento</div>
            <div className="text-gray-500 text-xs">Realizado</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-red-500 rounded-full">
            <div className="w-full h-full bg-red-500 rounded-full animate-pulse" />
          </div>
          <div>
            <div className="font-medium text-gray-900">Tempo Atual</div>
            <div className="text-gray-500 text-xs">Agora</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 bg-blue-500 rounded" />
          <div>
            <div className="font-medium text-gray-900">Dia Atual</div>
            <div className="text-gray-500 text-xs">Hoje</div>
          </div>
        </div>
      </div>
      
      {/* Cores dos funcionários */}
      <div className="mt-6">
        <h4 className="font-medium text-gray-900 mb-3">Funcionários</h4>
        <div className="flex flex-wrap gap-3">
          {funcionarios.slice(0, 8).map((f) => (
            <div key={f.id} className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded border border-gray-300"
                style={{ backgroundColor: getCorFuncionario(f.id) }}
              />
              <span className="text-sm text-gray-700">{f.pessoa_nome}</span>
            </div>
          ))}
          {funcionarios.length > 8 && (
            <div className="text-sm text-gray-500">
              +{funcionarios.length - 8} outros
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50/50 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard Administrativo</h1>
            <p className="text-gray-600 mt-1">Comparativo visual de Escala × Apontamento</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-white rounded-lg shadow-sm border border-gray-200 p-1">
              <button 
                onClick={semanaAnterior}
                className="px-3 py-1 rounded-md hover:bg-gray-100 text-gray-600 font-medium"
              >
                ←
              </button>
              <button 
                onClick={semanaAtual}
                className="px-4 py-1 rounded-md bg-blue-600 text-white font-medium mx-1"
              >
                Hoje
              </button>
              <button 
                onClick={semanaSeguinte}
                className="px-3 py-1 rounded-md hover:bg-gray-100 text-gray-600 font-medium"
              >
                →
              </button>
            </div>
            <button 
              onClick={carregarTudo}
              disabled={loading}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 text-gray-700 font-medium shadow-sm"
            >
              {loading ? '🔄 Atualizando...' : '↻ Atualizar'}
            </button>
            <label className="flex items-center gap-2 text-sm text-gray-600 bg-white px-3 py-2 rounded-lg border border-gray-300 shadow-sm cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Auto-refresh
            </label>
          </div>
        </div>

        {err && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {err}
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <KpiCard label="Escalados (semana)" value={kpis.escalados} />
        <KpiCard label="Presentes" value={kpis.presentes} />
        <KpiCard label="Ausentes" value={kpis.ausentes} />
        <KpiCard label="Atrasos" value={kpis.atrasos} />
        <KpiCard 
          label="Horas Trabalhadas" 
          value={kpis.horasTotaisFmt} 
          sub="Parciais incluídas" 
        />
      </div>

      {/* Timeline */}
      <div className="mb-6">
        <DiasAgenda />
      </div>

      {/* Legenda */}
      <div className="mb-6">
        <Legenda />
      </div>

      {/* Notas */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-3">Como interpretar</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
          <div>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <div className="w-1 h-1 bg-gray-400 rounded-full mt-2 flex-shrink-0" />
                <span><strong>Escala</strong> (contorno) mostra o turno planejado</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1 h-1 bg-gray-400 rounded-full mt-2 flex-shrink-0" />
                <span><strong>Apontamento</strong> (preenchido) mostra o realizado</span>
              </li>
            </ul>
          </div>
          <div>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <div className="w-1 h-1 bg-gray-400 rounded-full mt-2 flex-shrink-0" />
                <span><strong>Linha vermelha</strong> indica o horário atual</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1 h-1 bg-gray-400 rounded-full mt-2 flex-shrink-0" />
                <span><strong>Cores</strong> identificam cada funcionário</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
