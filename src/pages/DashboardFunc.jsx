import { useEffect, useMemo, useRef, useState, useCallback } from "react";

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");

/* ===== helpers de data/hora ===== */
const pad2 = (n) => String(n).padStart(2, "0");
const toISO = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const hojeISO = () => toISO(new Date());
const agoraHHMM = () => {
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};
const weekdayPt = (d) =>
  d.toLocaleDateString("pt-BR", { weekday: "long" }).replace(/^\w/, (c) => c.toUpperCase());

/* badge de origem */
const OrigemBadge = ({ origem }) => {
  const map = {
    APONTADO: { bg: "var(--panel-muted)", color: "var(--fg)", label: "APONTADO" },
    IMPORTADO: { bg: "rgba(14,165,233,.12)", color: "var(--info)", label: "IMPORTADO" },
    AJUSTE: { bg: "rgba(234,179,8,.15)", color: "var(--warning)", label: "AJUSTE" },
  };
  const s = map[String(origem || "APONTADO").toUpperCase()] || map.APONTADO;
  return (
    <span
      style={{
        fontSize: "12px",
        padding: "2px 8px",
        borderRadius: 999,
        background: s.bg,
        color: s.color,
        border: "1px solid var(--border)",
        whiteSpace: "nowrap",
      }}
    >
      {s.label}
    </span>
  );
};

export default function DashboardFunc() {
  const [tick, setTick] = useState(0);
  const [me, setMe] = useState(null);
  const [func, setFunc] = useState(null);
  const [escalaHoje, setEscalaHoje] = useState([]);
  const [apontsHoje, setApontsHoje] = useState([]);
  const [loading, setLoading] = useState(true);
  const [registrando, setRegistrando] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const isMounted = useRef(true);

  const api = useCallback(async (path, init = {}) => {
    const r = await fetch(`${API_BASE}${path}`, {
      credentials: "include",
      ...init,
      headers: { "Content-Type": "application/json", ...(init.headers || {}) },
    });
    let data = null;
    try {
      data = await r.json();
    } catch {
      // ignora parse se sem corpo
    }
    if (!r.ok || data?.ok === false) {
      throw new Error(data?.error || `HTTP ${r.status}`);
    }
    return data;
  }, []);

  /* ========= resolve usuário e funcionário ========= */
  const loadMe = useCallback(async () => {
    const d = await api("/api/auth/me");
    return d?.user || null;
  }, [api]);

  const loadFuncionarioDoUsuario = useCallback(
    async (user) => {
      // 1) tenta endpoint "mine=1"
      try {
        const d = await api("/api/funcionarios?mine=1");
        const f = (d?.funcionarios || [])[0];
        if (f) return f;
      } catch {}

      // 2) tenta "usuario_me=1"
      try {
        const d = await api("/api/funcionarios?usuario_me=1");
        const f = (d?.funcionarios || [])[0];
        if (f) return f;
      } catch {}

      // 3) fallback: pega todos e tenta casar pelo nome/email da pessoa
      try {
        const d = await api("/api/funcionarios?ativos=1");
        const lista = d?.funcionarios || [];
        const cand =
          lista.find(
            (f) =>
              String(f.pessoa_nome || "").toLowerCase() ===
              String(user?.nome || "").toLowerCase()
          ) || lista[0];
        return cand || null;
      } catch {}

      return null;
    },
    [api]
  );

  /* ========= dados do dia ========= */
  const loadEscalaHoje = useCallback(
    async (funcionarioId) => {
      const iso = hojeISO();
      const d = await api(`/api/escalas?from=${iso}&to=${iso}`);
      const todos = d?.escalas || [];
      return todos
        .filter((e) => e.funcionario_id === funcionarioId)
        .sort((a, b) => (a.turno_ordem || 1) - (b.turno_ordem || 1));
    },
    [api]
  );

  const loadApontsHoje = useCallback(
    async (funcionarioId) => {
      const iso = hojeISO();
      const d = await api(
        `/api/apontamentos?from=${iso}&to=${iso}&funcionario_id=${funcionarioId}&origem=APONTADO`
      );
      return (d?.apontamentos || []).sort(
        (a, b) => (a.turno_ordem || 1) - (b.turno_ordem || 1)
      );
    },
    [api]
  );

  const recarregar = useCallback(async () => {
    setLoading(true);
    setErr("");
    setMsg("");
    try {
      const u = await loadMe();
      if (!u) throw new Error("Sessão expirada. Faça login novamente.");
      if (!isMounted.current) return;

      setMe(u);
      const f = await loadFuncionarioDoUsuario(u);
      if (!f) throw new Error("Não foi possível localizar seu cadastro de funcionário.");
      if (!isMounted.current) return;

      setFunc(f);
      const [esc, ap] = await Promise.all([loadEscalaHoje(f.id), loadApontsHoje(f.id)]);
      if (!isMounted.current) return;
      setEscalaHoje(esc);
      setApontsHoje(ap);
    } catch (e) {
      setErr(e.message || "Falha ao carregar dados.");
    } finally {
      setLoading(false);
    }
  }, [loadMe, loadFuncionarioDoUsuario, loadEscalaHoje, loadApontsHoje]);

  useEffect(() => {
    isMounted.current = true;
    recarregar();
    const t = setInterval(() => setTick((v) => v + 1), 1000);
    return () => {
      isMounted.current = false;
      clearInterval(t);
    };
  }, [recarregar]);

  /* ========= estado do botão de ponto ========= */
  const estadoPonto = useMemo(() => {
    const aberto = apontsHoje.find((a) => a.entrada && !a.saida);
    if (aberto) {
      return { status: "TRABALHANDO", label: "Registrar Saída", aberto };
    }
    return { status: "FORA", label: "Registrar Entrada", aberto: null };
  }, [apontsHoje]);

  /* ========= ação principal (registrar ponto) ========= */
  const acaoRegistrarPonto = async () => {
    if (!func || registrando) return;
    
    setRegistrando(true);
    setErr("");
    setMsg("");

    const iso = hojeISO();
    const hhmm = agoraHHMM();

    try {
      // Buscar dados atualizados antes da ação
      const apontamentosAtuais = await loadApontsHoje(func.id);
      const turnoAberto = apontamentosAtuais.find((a) => a.entrada && !a.saida);

      if (turnoAberto) {
        // Fechar o turno atual com dados frescos
        await api(`/api/apontamentos/${turnoAberto.id}`, {
          method: "PUT",
          body: JSON.stringify({
            funcionario_id: func.id,
            data: iso,
            turno_ordem: turnoAberto.turno_ordem || 1,
            entrada: turnoAberto.entrada,
            saida: hhmm,
            origem: "APONTADO",
            obs: null,
          }),
        });
        setMsg("Saída registrada com sucesso!");
      } else {
        // Abrir novo turno
        const maxTurno = apontamentosAtuais.reduce(
          (m, a) => Math.max(m, Number(a.turno_ordem || 1)), 
          0
        );
        await api(`/api/apontamentos`, {
          method: "POST",
          body: JSON.stringify({
            funcionario_id: func.id,
            data: iso,
            turno_ordem: maxTurno + 1,
            entrada: hhmm,
            saida: null,
            origem: "APONTADO",
            obs: null,
          }),
        });
        setMsg("Entrada registrada com sucesso!");
      }

      // Recarregar dados
      const [esc, ap] = await Promise.all([
        loadEscalaHoje(func.id), 
        loadApontsHoje(func.id)
      ]);
      setEscalaHoje(esc);
      setApontsHoje(ap);
    } catch (e) {
      console.error("Erro ao registrar ponto:", e);
      setErr(e.message || "Falha ao registrar ponto.");
    } finally {
      setRegistrando(false);
    }
  };

  /* ========= UI ========= */
  const agoraTexto = useMemo(() => {
    const d = new Date();
    const data = d.toLocaleDateString("pt-BR");
    const hora = d.toLocaleTimeString("pt-BR", { hour12: false });
    return { data, hora, semana: weekdayPt(d) };
  }, [tick]);

  return (
    <div style={{ 
      minHeight: "100vh", 
      background: "var(--bg)",
      padding: "16px"
    }}>
      {/* Header */}
      <header style={{
        background: "var(--panel)",
        border: "1px solid var(--border)",
        borderRadius: "12px",
        padding: "16px",
        marginBottom: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "12px"
      }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ 
            margin: "0 0 4px 0", 
            fontSize: "clamp(1.5rem, 4vw, 2rem)",
            color: "var(--fg)" 
          }}>
            Meu Painel
          </h1>
          <p style={{ 
            margin: 0, 
            color: "var(--muted)",
            fontSize: "clamp(0.875rem, 3vw, 1rem)"
          }}>
            {agoraTexto.semana}, {agoraTexto.data} •{" "}
            <strong style={{ 
              fontVariantNumeric: "tabular-nums",
              color: "var(--fg)"
            }}>
              {agoraTexto.hora}
            </strong>
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button 
            style={{
              padding: "8px 16px",
              border: "1px solid var(--border)",
              borderRadius: "6px",
              background: "var(--panel)",
              color: "var(--fg)",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1,
              fontSize: "14px"
            }}
            onClick={recarregar} 
            disabled={loading}
          >
            {loading ? "Atualizando…" : "Atualizar"}
          </button>
        </div>
      </header>

      {/* Alertas */}
      {err && (
        <div style={{
          background: "rgba(239,68,68,.1)",
          color: "var(--danger)",
          border: "1px solid rgba(239,68,68,.35)",
          borderRadius: "8px",
          padding: "12px 16px",
          marginBottom: "16px",
          fontSize: "14px"
        }} role="alert">
          {err}
        </div>
      )}
      {msg && (
        <div style={{
          background: "rgba(16,185,129,.1)",
          color: "var(--success)",
          border: "1px solid rgba(16,185,129,.35)",
          borderRadius: "8px",
          padding: "12px 16px",
          marginBottom: "16px",
          fontSize: "14px"
        }} role="status">
          {msg}
        </div>
      )}

      {/* Cartão Principal - Relógio + Botão */}
      <section style={{
        display: "grid",
        gridTemplateColumns: "1fr",
        gap: "16px",
        marginBottom: "16px"
      }}>
        <div style={{
          background: "var(--panel)",
          border: "1px solid var(--border)",
          borderRadius: "12px",
          padding: "20px",
          borderLeft: `4px solid ${estadoPonto.status === "TRABALHANDO" ? "var(--success)" : "var(--accent)"}`,
          display: "flex",
          flexDirection: "column",
          gap: "20px"
        }}>
          {/* Informações do Funcionário e Hora */}
          <div>
            <div style={{ 
              fontSize: "14px", 
              color: "var(--muted)", 
              marginBottom: "8px" 
            }}>
              {func ? (
                <>
                  <strong>{func.pessoa_nome}</strong>
                  {func.cargo_nome ? <> • {func.cargo_nome}</> : null}
                </>
              ) : (
                "Carregando…"
              )}
            </div>
            <div style={{
              fontSize: "clamp(2.5rem, 8vw, 4rem)",
              lineHeight: 1,
              fontWeight: 800,
              letterSpacing: "1px",
              fontVariantNumeric: "tabular-nums",
              color: "var(--fg)",
              marginBottom: "8px"
            }}>
              {agoraTexto.hora}
            </div>
            <div style={{ 
              color: "var(--muted)",
              fontSize: "14px"
            }}>
              Status:{" "}
              <strong style={{ 
                color: estadoPonto.status === "TRABALHANDO" ? "var(--success)" : "var(--muted)" 
              }}>
                {estadoPonto.status === "TRABALHANDO" ? "Em jornada" : "Fora da jornada"}
              </strong>
            </div>
          </div>

          {/* Botão de Ponto */}
          <div style={{ 
            display: "flex", 
            flexDirection: "column",
            alignItems: "center",
            gap: "8px"
          }}>
            <button
              style={{
                fontSize: "clamp(1rem, 4vw, 1.25rem)",
                padding: "clamp(12px, 4vw, 18px) clamp(16px, 4vw, 28px)",
                border: "2px solid",
                borderRadius: "8px",
                background: estadoPonto.status === "TRABALHANDO" ? "var(--warning)" : "var(--accent)",
                color: estadoPonto.status === "TRABALHANDO" ? "#111" : "#fff",
                borderColor: estadoPonto.status === "TRABALHANDO" ? "var(--warning)" : "var(--accent-strong)",
                boxShadow: "0 4px 12px rgba(0,0,0,.1)",
                cursor: (loading || !func || registrando) ? "not-allowed" : "pointer",
                opacity: (loading || registrando) ? 0.6 : 1,
                width: "100%",
                maxWidth: "300px",
                fontWeight: "600"
              }}
              onClick={acaoRegistrarPonto}
              disabled={loading || !func || registrando}
            >
              {registrando ? "Registrando..." : estadoPonto.label}
            </button>
            <div style={{ 
              fontSize: "12px", 
              color: "var(--muted)",
              display: "flex",
              alignItems: "center",
              gap: "4px"
            }}>
              Origem: <OrigemBadge origem="APONTADO" />
            </div>
          </div>
        </div>

        {/* Escala de Hoje */}
        <div style={{
          background: "var(--panel)",
          border: "1px solid var(--border)",
          borderRadius: "12px",
          padding: "20px"
        }}>
          <div style={{ 
            fontWeight: 700, 
            marginBottom: "12px",
            fontSize: "clamp(1rem, 4vw, 1.125rem)",
            color: "var(--fg)"
          }}>
            Minha escala de hoje
          </div>
          {escalaHoje.length === 0 ? (
            <div style={{ 
              color: "var(--muted)",
              fontSize: "14px"
            }}>
              Nenhum turno registrado na escala de hoje.
            </div>
          ) : (
            <div style={{ 
              display: "grid", 
              gap: "8px" 
            }}>
              {escalaHoje.map((t) => (
                <div
                  key={t.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    background: "var(--panel-muted)",
                    fontSize: "14px"
                  }}
                >
                  <span style={{ color: "var(--muted)" }}>
                    Turno {t.turno_ordem}
                  </span>
                  <span style={{ 
                    fontWeight: 600,
                    color: "var(--fg)"
                  }}>
                    {(t.entrada || "—")} — {(t.saida || "—")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Apontamentos do Dia */}
      <section style={{
        background: "var(--panel)",
        border: "1px solid var(--border)",
        borderRadius: "12px",
        padding: "20px"
      }}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px",
          flexWrap: "wrap",
          gap: "8px"
        }}>
          <div style={{ 
            fontWeight: 700,
            fontSize: "clamp(1rem, 4vw, 1.125rem)",
            color: "var(--fg)"
          }}>
            Meus apontamentos de hoje • {agoraTexto.data}
          </div>
          <button 
            style={{
              padding: "6px 12px",
              border: "1px solid var(--border)",
              borderRadius: "6px",
              background: "var(--panel)",
              color: "var(--fg)",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1,
              fontSize: "14px"
            }}
            onClick={recarregar} 
            disabled={loading}
          >
            Recarregar
          </button>
        </div>

        {apontsHoje.length === 0 ? (
          <div style={{ 
            color: "var(--muted)",
            fontSize: "14px"
          }}>
            Nenhum apontamento hoje.
          </div>
        ) : (
          <div style={{ 
            display: "grid", 
            gap: "8px" 
          }}>
            {apontsHoje.map((a) => (
              <div
                key={a.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr",
                  gap: "8px",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  padding: "12px",
                  background: "var(--panel-muted)",
                  fontSize: "14px"
                }}
              >
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}>
                  <span style={{ color: "var(--muted)" }}>
                    Turno {a.turno_ordem}
                  </span>
                  <OrigemBadge origem={a.origem} />
                </div>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "8px"
                }}>
                  <div>
                    <div style={{ 
                      fontSize: "12px", 
                      color: "var(--muted)",
                      marginBottom: "2px"
                    }}>
                      Entrada
                    </div>
                    <strong>{a.entrada || "—"}</strong>
                  </div>
                  <div>
                    <div style={{ 
                      fontSize: "12px", 
                      color: "var(--muted)",
                      marginBottom: "2px"
                    }}>
                      Saída
                    </div>
                    <strong>{a.saida || "—"}</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Media Query para Desktop */}
      <style>{`
        @media (min-width: 768px) {
          .dashboard-grid {
            grid-template-columns: 1.4fr 1fr !important;
          }
          .card-responsive {
            flex-direction: row !important;
            align-items: flex-start !important;
          }
          .apontamento-grid {
            grid-template-columns: 80px 1fr 1fr auto !important;
            gap: 16px !important;
          }
          .apontamento-item {
            grid-template-columns: 80px 1fr 1fr auto !important;
            align-items: center !important;
            padding: 8px 12px !important;
          }
          .header-responsive {
            flex-direction: row !important;
            align-items: center !important;
          }
        }
      `}</style>
    </div>
  );
}