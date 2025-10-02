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

/* ====== Componentes Visuais ====== */
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

const KpiCard = ({ label, value, sub, icon, trend }) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow duration-200">
    <div className="flex items-center justify-between">
      <div className="flex-1">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-500 mb-1">
          {icon && <span className="text-lg">{icon}</span>}
          {label}
        </div>
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

const EmployeeCard = ({ employee, status, schedule, actual, duration, isCurrent = false }) => (
  <div className={`bg-white rounded-lg border-l-4 ${
    isCurrent ? 'border-l-blue-500 bg-blue-50' : 'border-l-gray-300'
  } p-4 shadow-sm hover:shadow-md transition-all duration-200`}>
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-3">
        <div 
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: getCorFuncionario(employee.id) }}
        />
        <h3 className="font-semibold text-gray-900">{employee.nome}</h3>
      </div>
      <StatusBadge tone={
        status === 'working' ? 'green' : 
        status === 'absent' ? 'red' : 
        status === 'late' ? 'yellow' : 'gray'
      }>
        {status === 'working' ? 'TRABALHANDO' : 
         status === 'absent' ? 'AUSENTE' : 
         status === 'late' ? 'ATRASADO' : 'FORA DA ESCALA'}
      </StatusBadge>
    </div>
    
    <div className="grid grid-cols-2 gap-4 text-sm">
      <div>
        <div className="text-gray-500 text-xs font-medium mb-1">ESCALA</div>
        <div className="text-gray-900 font-medium">{schedule}</div>
      </div>
      <div>
        <div className="text-gray-500 text-xs font-medium mb-1">REAL</div>
        <div className="text-gray-900 font-medium">{actual}</div>
      </div>
    </div>
    
    {duration && (
      <div className="mt-3 pt-3 border-t border-gray-200">
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-500">Duração</span>
          <span className="text-sm font-medium text-gray-900">{duration}</span>
        </div>
        {isCurrent && (
          <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: '75%' }} // Isso seria calculado baseado no tempo decorrido
            />
          </div>
        )}
      </div>
    )}
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

  /* ========= KPIs e Status em Tempo Real ========= */
  const { kpis, workingNow, absentToday, offSchedule } = useMemo(() => {
    let escalados = 0, presentes = 0, ausentes = 0, atrasos = 0, minutosTotais = 0;
    const workingNowList = [];
    const absentTodayList = [];
    const offScheduleList = [];

    const todayISO = toISO(new Date());

    for (const [dataISO, arrEsc] of escalasByDia) {
      const vistos = new Set();
      
      for (const e of arrEsc) {
        const funcId = e.funcionario_id;
        const func = mapFunc.get(funcId);
        if (!func) continue;

        const entradaEsc = e.entrada ? hhmmToMinutes(e.entrada) : null;
        const key = `${dataISO}|${funcId}|${e.turno_ordem ?? 1}`;
        const cons = consolidateApontamentos(apontByKey.get(key) || [], dataISO);

        if (!vistos.has(funcId)) {
          escalados++;
          vistos.add(funcId);
        }

        if (cons?.entradaMin != null) {
          presentes++;
          
          // Verificar se está trabalhando agora
          if (dataISO === todayISO && cons.parcial) {
            workingNowList.push({
              employee: func,
              schedule: `${e.entrada || '--'} - ${e.saida || '--'}`,
              actual: `${String(Math.floor(cons.entradaMin / 60)).padStart(2, '0')}:${String(cons.entradaMin % 60).padStart(2, '0')} - (andamento)`,
              duration: minutesToHHhMM((cons.saidaMin ?? cons.entradaMin) - cons.entradaMin)
            });
          }

          if (entradaEsc != null) {
            const delta = cons.entradaMin - entradaEsc;
            if (delta > 5) atrasos++;
          }

          const fim = cons.saidaMin ?? cons.entradaMin;
          const dur = Math.max(0, (fim ?? 0) - cons.entradaMin);
          minutosTotais += dur;
        } else if (dataISO === todayISO) {
          absentTodayList.push({
            employee: func,
            schedule: `${e.entrada || '--'} - ${e.saida || '--'}`
          });
        }
      }
    }

    // Funcionários ativos sem escala hoje
    const todayEscalas = escalasByDia.get(todayISO) || [];
    const escaladosHoje = new Set(todayEscalas.map(e => e.funcionario_id));
    
    for (const func of mapFunc.values()) {
      if (!escaladosHoje.has(func.id)) {
        offScheduleList.push({ employee: func });
      }
    }

    return {
      kpis: {
        escalados,
        presentes,
        ausentes: Math.max(ausentes, 0),
        atrasos,
        horasTotaisFmt: minutesToHHhMM(minutosTotais),
      },
      workingNow: workingNowList,
      absentToday: absentTodayList,
      offSchedule: offScheduleList
    };
  }, [apontByKey, escalasByDia, mapFunc]);

  return (
    <div className="min-h-screen bg-gray-50/30">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard em Tempo Real</h1>
            <p className="text-gray-600 mt-1">
              Status atual dos funcionários • {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={carregarTudo}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
            >
              {loading ? 'Atualizando...' : 'Atualizar'}
            </button>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
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
      </div>

      {/* Conteúdo principal */}
      <div className="p-6 max-w-7xl mx-auto">
        {err && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {err}
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <KpiCard 
            label="Total de Funcionários" 
            value={funcionarios.length}
            icon="👥"
          />
          <KpiCard 
            label="Escalados para Hoje" 
            value={kpis.escalados}
            icon="📅"
          />
          <KpiCard 
            label="Presentes no Momento" 
            value={workingNow.length}
            icon="✅"
            sub="Trabalhando agora"
          />
          <KpiCard 
            label="Ausentes" 
            value={absentToday.length}
            icon="❌"
          />
          <KpiCard 
            label="Horas Trabalhadas" 
            value={kpis.horasTotaisFmt}
            icon="⏱️"
            sub="Semana atual"
          />
        </div>

        {/* Status em Tempo Real */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Trabalhando Agora */}
          <div className="lg:col-span-1">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Trabalhando Agora ({workingNow.length})</h2>
              <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                AGORA
              </span>
            </div>
            <div className="space-y-3">
              {workingNow.map((item, index) => (
                <EmployeeCard
                  key={index}
                  employee={item.employee}
                  status="working"
                  schedule={item.schedule}
                  actual={item.actual}
                  duration={item.duration}
                  isCurrent={true}
                />
              ))}
              {workingNow.length === 0 && (
                <div className="text-center py-8 text-gray-500 bg-white rounded-lg border border-gray-200">
                  Nenhum funcionário trabalhando no momento
                </div>
              )}
            </div>
          </div>

          {/* Ausentes da Escala Atual */}
          <div className="lg:col-span-1">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Ausentes da Escala Atual ({absentToday.length})
            </h2>
            <div className="space-y-3">
              {absentToday.map((item, index) => (
                <EmployeeCard
                  key={index}
                  employee={item.employee}
                  status="absent"
                  schedule={item.schedule}
                />
              ))}
              {absentToday.length === 0 && (
                <div className="text-center py-8 text-gray-500 bg-white rounded-lg border border-gray-200">
                  Todos os escalados estão presentes
                </div>
              )}
            </div>
          </div>

          {/* Fora da Escala */}
          <div className="lg:col-span-1">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Fora da Escala ({offSchedule.length})
            </h2>
            <div className="space-y-3">
              {offSchedule.map((item, index) => (
                <EmployeeCard
                  key={index}
                  employee={item.employee}
                  status="off"
                />
              ))}
              {offSchedule.length === 0 && (
                <div className="text-center py-8 text-gray-500 bg-white rounded-lg border border-gray-200">
                  Todos os funcionários estão escalados hoje
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Legenda e Informações */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-3">Legenda de Status</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span>Trabalhando agora</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <span>Ausente da escala</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-400"></div>
              <span>Fora da escala</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <span>Atrasado</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
