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
const CONFIG_HORARIOS = { inicio: 6, fim: 22 }; // [06:00 .. 22:00]

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

/* ====== Consolidação de apontamentos por prioridade ====== */
function consolidateApontamentos(items, dataISO) {
  if (!items?.length) return null;

  const pri = { AJUSTE: 3, IMPORTADO: 2, APONTADO: 1 };
  // menor entrada + maior saída (quebrando empate por prioridade)
  let bestEntrada = null, bestEntradaOrigem = null;
  let bestSaida = null, bestSaidaOrigem = null;

  for (const it of items) {
    const origem = String(it.origem || "").toUpperCase().trim();
    const ent = it.entrada ? hhmmToMinutes(it.entrada) : null;
    const sai = it.saida ? hhmmToMinutes(it.saida) : null;

    if (ent != null) {
      if (
        bestEntrada == null ||
        ent < bestEntrada ||
        (ent === bestEntrada && (pri[origem] || 0) > (pri[bestEntradaOrigem] || 0))
      ) {
        bestEntrada = ent; bestEntradaOrigem = origem;
      }
    }
    if (sai != null) {
      if (
        bestSaida == null ||
        sai > bestSaida ||
        (sai === bestSaida && (pri[origem] || 0) > (pri[bestSaidaOrigem] || 0))
      ) {
        bestSaida = sai; bestSaidaOrigem = origem;
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

/* ====== KPIs card ====== */
const Kpi = ({ label, value, sub }) => (
  <div className="bg-white rounded-2xl shadow-sm p-4 ring-1 ring-gray-200">
    <div className="text-sm text-gray-500">{label}</div>
    <div className="mt-1 text-2xl font-semibold text-gray-900">{value}</div>
    {sub ? <div className="mt-1 text-xs text-gray-500">{sub}</div> : null}
  </div>
);

/* ====== Página ====== */
export default function DashboardAdm() {
  // Semana atual
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

      // 1) Tenta endpoint consolidado
      const consolidated = await api(`/api/dashboard/adm?from=${de}&to=${ate}&ativos=1`);
      if (consolidated?.funcionarios || consolidated?.escalas || consolidated?.apontamentos) {
        setFuncionarios(consolidated.funcionarios || []);
        setEscalas(consolidated.escalas || []);
        setApontamentos(consolidated.apontamentos || []);
      } else {
        // 2) Fallback para rotas separadas
        const [f, e, a] = await Promise.all([
          api(`/api/funcionarios?ativos=1`),
          api(`/api/escalas?from=${de}&to=${ate}`),
          api(`/api/apontamentos?from=${de}&to=${ate}`),
        ]);
        setFuncionarios(f.funcionarios || f || []);
        setEscalas(e.escalas || e || []);
        setApontamentos(a.apontamentos || a || []);
      }
    } catch (e) {
      setErr(e.message || "Falha ao carregar dados.");
    } finally {
      setLoading(false);
    }
  }, [api, dias]);

  useEffect(() => { carregarTudo(); }, [carregarTudo]);

  // Recarrega ao trocar semana (se já havia dados)
  useEffect(() => {
    if (escalas.length || apontamentos.length) carregarTudo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataRef]);

  // Auto refresh 60s
  useEffect(() => {
    if (autoRefresh) {
      refreshRef.current = setInterval(() => carregarTudo(), 60000);
    } else if (refreshRef.current) {
      clearInterval(refreshRef.current);
    }
    return () => refreshRef.current && clearInterval(refreshRef.current);
  }, [autoRefresh, carregarTudo]);

  /* ========= Índices ========= */
  // Funcionários (id -> info + cor)
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

  // Escalas por dia
  const escalasByDia = useMemo(() => {
    const m = new Map(); // key = dataISO -> array
    for (const e of escalas) {
      if (!e.data || !e.funcionario_id) continue;
      const arr = m.get(e.data) || [];
      arr.push(e);
      m.set(e.data, arr);
    }
    return m;
  }, [escalas]);

  // Apontamentos por (data, func, turno) — origem normalizada
  const apontByKey = useMemo(() => {
    const m = new Map();
    for (const a of apontamentos) {
      const funcId = a.funcionario_id ?? a.funcionarioId ?? a.funcionario;
      if (!a.data || !funcId) continue;
      const turno = a.turno_ordem ?? 1;
      const origem = String(a.origem || "").toUpperCase().trim();
      const k = `${a.data}|${funcId}|${turno}`;
      const arr = m.get(k) || [];
      arr.push({ ...a, origem });
      m.set(k, arr);
    }
    return m;
  }, [apontamentos]);

  // Apontamentos por (data, func) — fallback quando turno não bate
  const apontByFuncDia = useMemo(() => {
    const m = new Map();
    for (const a of apontamentos) {
      const funcId = a.funcionario_id ?? a.funcionarioId ?? a.funcionario;
      if (!a.data || !funcId) continue;
      const origem = String(a.origem || "").toUpperCase().trim();
      const k = `${a.data}|${funcId}`;
      const arr = m.get(k) || [];
      arr.push({ ...a, origem });
      m.set(k, arr);
    }
    return m;
  }, [apontamentos]);

  /* ========= KPIs (somente dia atual) ========= */
  const kpiDate = toISO(new Date());
  const kpis = useMemo(() => {
    let escalados = 0, presentes = 0, ausentes = 0, atrasos = 0, minutosTotais = 0;

    const arrEsc = escalasByDia.get(kpiDate) || [];
    const vistos = new Set();

    for (const e of arrEsc) {
      const funcId = e.funcionario_id;
      if (!vistos.has(funcId)) { escalados++; vistos.add(funcId); }

      const entradaEsc = e.entrada ? hhmmToMinutes(e.entrada) : null;

      // busca por turno; se não achar, cai no fallback por dia
      const key = `${kpiDate}|${funcId}|${e.turno_ordem ?? 1}`;
      let cons = consolidateApontamentos(apontByKey.get(key) || [], kpiDate);
      if (!cons?.entradaMin) cons = consolidateApontamentos(apontByFuncDia.get(`${kpiDate}|${funcId}`) || [], kpiDate);

      if (cons?.entradaMin != null) {
        presentes++;
        if (entradaEsc != null) {
          const delta = cons.entradaMin - entradaEsc;
          if (delta > 5) atrasos++;
        }
        const fim = cons.saidaMin ?? cons.entradaMin;
        minutosTotais += Math.max(0, (fim ?? 0) - cons.entradaMin);
      } else {
        ausentes++;
      }
    }

    return {
      escalados,
      presentes,
      ausentes,
      atrasos,
      horasTotaisFmt: minutesToHHhMM(minutosTotais),
    };
  }, [apontByFuncDia, apontByKey, escalasByDia, kpiDate]);

  /* ========= Render helpers (agenda) ========= */
  const dayHeight = 1200; // px
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

  /* ========= Grade semanal estilo Google Agenda ========= */
  const DiasAgenda = () => {
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
          const arrEsc = (escalasByDia.get(dataISO) || []).slice();

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
              {/* Linha “agora” */}
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

              {/* ESCALA (contorno) */}
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

              {/* APONTAMENTO sobre a escala (mesmo turno, com fallback por dia) */}
              {arrEsc.map((e, idx) => {
                const func = mapFunc.get(e.funcionario_id);
                if (!func) return null;
                const key = `${dataISO}|${e.funcionario_id}|${e.turno_ordem ?? 1}`;
                let cons = consolidateApontamentos(apontByKey.get(key) || [], dataISO);
                if (!cons?.entradaMin) {
                  cons = consolidateApontamentos(apontByFuncDia.get(`${dataISO}|${e.funcionario_id}`) || [], dataISO);
                }
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
                    <div style={{ width: 8, height: 8, borderRadius: 999, background: "white", opacity: 0.9 }} />
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

              {/* Apontamentos SEM escala para este dia */}
              {(() => {
                // chaves já cobertas por escala
                const keysComEscala = new Set(
                  arrEsc.map(e => `${dataISO}|${e.funcionario_id}|${e.turno_ordem ?? 1}`)
                );

                const blocks = [];
                for (const [k, itens] of apontByKey.entries()) {
                  const [dataK, funcK, turnoK] = k.split("|");
                  if (dataK !== dataISO) continue;
                  if (keysComEscala.has(k)) continue;

                  const cons = consolidateApontamentos(itens, dataISO);
                  if (!cons?.entradaMin) continue;

                  const func = mapFunc.get(Number(funcK));
                  if (!func) continue;

                  const style = blockStyleByMinutes(cons.entradaMin, cons.saidaMin);
                  const dur = (cons.saidaMin ?? cons.entradaMin) - cons.entradaMin;

                  blocks.push(
                    <div
                      key={`apo-sem-escala-${k}`}
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
                      title={`Apontamento (sem escala) • ${func.nome} • ${minutesToHHhMM(dur)}${cons.parcial ? " • em andamento" : ""}`}
                    >
                      <div style={{ width: 8, height: 8, borderRadius: 999, background: "white", opacity: 0.9 }} />
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
                        <StatusBadge tone="emerald">PRESENTE</StatusBadge>
                      </div>
                    </div>
                  );
                }
                return blocks;
              })()}
            </div>
          );
        })}
      </div>
    );
  };

  /* ========= Legenda ========= */
  const Legenda = () => (
    <div
      style={{
        display: "flex",
        gap: 16,
        flexWrap: "wrap",
        padding: 16,
        background: "var(--panel)",
        borderRadius: 8,
        border: "1px solid var(--border)",
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--muted)" }}>Legenda:</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 16, height: 16, border: "2px solid var(--fg)", borderRadius: 4 }} />
        <span style={{ fontSize: 14 }}>Escala (planejado)</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 16, height: 16, background: "var(--fg)", borderRadius: 4 }} />
        <span style={{ fontSize: 14 }}>Apontamento (real)</span>
      </div>
      {funcionarios.slice(0, 12).map((f) => (
        <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 16, height: 16, background: getCorFuncionario(f.id), borderRadius: 4, border: "1px solid var(--border)" }} />
          <span style={{ fontSize: 14 }}>{f.pessoa_nome}</span>
        </div>
      ))}
      {funcionarios.length > 12 && (
        <div style={{ fontSize: 13, color: "var(--muted)" }}>+{funcionarios.length - 12} funcionários…</div>
      )}
    </div>
  );

  return (
    <>
      <header className="main-header">
        <div className="header-content">
          <h1>Dashboard Administrativo</h1>
          <p>Comparativo visual de Escala × Apontamento (semana)</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="toggle-btn" onClick={semanaAnterior}>←</button>
          <button className="toggle-btn" onClick={semanaAtual}>Hoje</button>
          <button className="toggle-btn" onClick={semanaSeguinte}>→</button>
          <button className="toggle-btn" onClick={carregarTudo} disabled={loading}>
            {loading ? "Atualizando..." : "Atualizar"}
          </button>
          <label className="toggle-btn" style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh 60s
          </label>
        </div>
      </header>

      {err && <div className="error-alert" role="alert" style={{ marginBottom: 16 }}>{err}</div>}

      {/* KPIs (hoje) */}
      <section className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <Kpi label={`Escalados (${formatDateBR(new Date())})`} value={kpis.escalados} />
        <Kpi label="Presentes" value={kpis.presentes} />
        <Kpi label="Ausentes" value={kpis.ausentes} />
        <Kpi label="Atrasos (turnos)" value={kpis.atrasos} />
        <Kpi label="Horas trabalhadas" value={kpis.horasTotaisFmt} sub="Parciais contam até o momento" />
      </section>

      {/* Grade estilo Google Agenda */}
      <DiasAgenda />

      {/* Legenda */}
      <div style={{ marginTop: 20 }}>
        <Legenda />
      </div>

      {/* Notas */}
      <section className="text-xs text-gray-500 mt-3">
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Escala</strong> (contorno) = planejado; <strong>Apontamento</strong> (preenchido) = realizado.</li>
          <li><strong>Atraso</strong> = entrada apontada − entrada da escala (&gt; 5 min).</li>
          <li>Sem saída no apontamento ⇒ bloco <em>parcial</em> cresce até “agora”.</li>
          <li>Prioridade: AJUSTE &gt; IMPORTADO &gt; APONTADO.</li>
        </ul>
      </section>
    </>
  );
}
