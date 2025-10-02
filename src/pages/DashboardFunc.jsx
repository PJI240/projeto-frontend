// src/pages/DashboardFunc.jsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");

/* ===== helpers visuais ===== */
const weekdayPt = (d) =>
  d.toLocaleDateString("pt-BR", { weekday: "long" }).replace(/^\w/, (c) => c.toUpperCase());

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
        fontSize: "var(--fs-12)",
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
  const [loading, setLoading] = useState(true);
  const [registrando, setRegistrando] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  // dados vindos do backend do dashboard
  const [empresaId, setEmpresaId] = useState(null);
  const [func, setFunc] = useState(null); // { id, pessoa_nome, cargo_nome }
  const [dataISO, setDataISO] = useState("");
  const [escalaHoje, setEscalaHoje] = useState([]); // [{ id, entrada, saida, turno_ordem }]
  const [apontsHoje, setApontsHoje] = useState([]); // [{ id, turno_ordem, entrada, saida, origem }]

  const isMounted = useRef(true);
  const liveRef = useRef(null);

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
      /* no body */
    }
    if (!r.ok || data?.ok === false) {
      throw new Error(data?.error || `HTTP ${r.status}`);
    }
    return data;
  }, []);

  /** Carrega tudo de uma vez do endpoint do dashboard */
  const carregarHoje = useCallback(async () => {
    setLoading(true);
    setErr("");
    setMsg("");
    try {
      const d = await api(`/api/dashboard_func/hoje`);
      if (!isMounted.current) return;

      setEmpresaId(d.empresa_id || null);
      setFunc(d.funcionario || null);
      setDataISO(d.data || "");
      setEscalaHoje(d.escala || []);
      setApontsHoje(d.apontamentos || []);
    } catch (e) {
      setErr(e.message || "Falha ao carregar painel.");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    isMounted.current = true;
    carregarHoje();
    const t = setInterval(() => setTick((v) => v + 1), 1000);
    return () => {
      isMounted.current = false;
      clearInterval(t);
    };
  }, [carregarHoje]);

  /* ========= estado do botão de ponto ========= */
  const estadoPonto = useMemo(() => {
    const aberto = apontsHoje.find((a) => a.entrada && !a.saida);
    if (aberto) {
      return { status: "TRABALHANDO", label: "Registrar saída", aberto };
    }
    return { status: "FORA", label: "Registrar entrada", aberto: null };
  }, [apontsHoje]);

  /* ========= ação principal (registrar ponto) ========= */
  const acaoRegistrarPonto = async () => {
    if (!func || registrando) return;
    setRegistrando(true);
    setErr("");
    setMsg("");

    try {
      await api(`/api/dashboard_func/clock`, {
        method: "POST",
        body: JSON.stringify({ empresa_id: empresaId || undefined }), // opcional
      });

      // Recarrega do endpoint do dashboard para refletir a mudança
      await carregarHoje();
      const feedback =
        estadoPonto.status === "TRABALHANDO"
          ? "Saída registrada com sucesso!"
          : "Entrada registrada com sucesso!";
      setMsg(feedback);
      if (liveRef.current) liveRef.current.textContent = feedback; // aria-live
    } catch (e) {
      setErr(e.message || "Falha ao registrar ponto.");
      if (liveRef.current) liveRef.current.textContent = "Erro ao registrar ponto.";
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

  const horaAgora = new Date().toLocaleTimeString("pt-BR", { hour12: false });

  const primaryBtnStyle =
    estadoPonto.status === "TRABALHANDO"
      ? {
          background: "var(--warning-strong)",
          color: "#fff",
          borderColor: "var(--warning-strong)",
        }
      : {
          background: "var(--accent-bg)",
          color: "#fff",
          borderColor: "var(--accent-bg-hover)",
        };

  return (
    <div className="container" role="main" aria-labelledby="titulo-pagina" style={{ paddingBlock: 16 }}>
      {/* skip-link opcional se você tiver no layout global */}
      <a href="#conteudo" className="visually-hidden focus:not-sr-only">Pular para conteúdo</a>

      {/* Header */}
      <header
        style={{
          background: "var(--panel)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: 16,
          marginBottom: 16,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div style={{ flex: 1 }}>
          <h1 id="titulo-pagina" style={{ margin: "0 0 4px 0", fontSize: "clamp(1.5rem, 4vw, 2rem)", color: "var(--fg)" }}>
            Meu Painel
          </h1>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: "clamp(var(--fs-14), 3vw, var(--fs-16))" }}>
            {agoraTexto.semana}, {agoraTexto.data} •{" "}
            <strong style={{ fontVariantNumeric: "tabular-nums", color: "var(--fg)" }}>{agoraTexto.hora}</strong>
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className="toggle-btn"
            onClick={carregarHoje}
            disabled={loading}
            aria-live="off"
            aria-busy={loading ? "true" : "false"}
            aria-label="Atualizar painel"
            title="Atualizar"
            style={{ opacity: loading ? 0.7 : 1 }}
          >
            {loading ? "Atualizando…" : "Atualizar"}
          </button>
        </div>
      </header>

      {/* Live region para feedbacks rápidos */}
      <div ref={liveRef} id="announce" aria-live="polite" className="visually-hidden" />

      {/* Alertas */}
      {err && (
        <div
          style={{
            background: "#fef2f2",
            color: "var(--error-strong)",
            border: "1px solid #fecaca",
            borderRadius: 8,
            padding: "12px 16px",
            marginBottom: 16,
            fontSize: "var(--fs-14)",
          }}
          role="alert"
        >
          {err}
        </div>
      )}
      {msg && (
        <div
          style={{
            background: "rgba(16,185,129,.08)",
            color: "var(--success-strong)",
            border: "1px solid rgba(16,185,129,.35)",
            borderRadius: 8,
            padding: "12px 16px",
            marginBottom: 16,
            fontSize: "var(--fs-14)",
          }}
          role="status"
        >
          {msg}
        </div>
      )}

      {/* Conteúdo principal */}
      <main id="conteudo" tabIndex={-1} style={{ outline: "none" }}>
        {/* Cartão Principal - Relógio + Botão */}
        <section style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16, marginBottom: 16 }}>
          <div
            style={{
              background: "var(--panel)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              padding: 20,
              borderLeft: `4px solid ${
                estadoPonto.status === "TRABALHANDO" ? "var(--success)" : "var(--accent-bg)"
              }`,
              display: "flex",
              flexDirection: "column",
              gap: 20,
            }}
          >
            {/* Info do funcionário e relógio */}
            <div>
              <div style={{ fontSize: "var(--fs-14)", color: "var(--muted)", marginBottom: 8 }}>
                {func ? (
                  <>
                    <strong>{func.pessoa_nome}</strong>
                    {func.cargo_nome ? <> • {func.cargo_nome}</> : null}
                  </>
                ) : (
                  "Carregando…"
                )}
              </div>
              <div
                style={{
                  fontSize: "clamp(2.5rem, 8vw, 4rem)",
                  lineHeight: 1,
                  fontWeight: 800,
                  letterSpacing: "1px",
                  fontVariantNumeric: "tabular-nums",
                  color: "var(--fg)",
                  marginBottom: 8,
                }}
                aria-live="off"
              >
                {horaAgora}
              </div>
              <div style={{ color: "var(--muted)", fontSize: "var(--fs-14)" }}>
                Data-base: <strong>{dataISO || "—"}</strong>
                {" • "}Status:{" "}
                <strong
                  style={{
                    color: estadoPonto.status === "TRABALHANDO" ? "var(--success)" : "var(--muted)",
                  }}
                >
                  {estadoPonto.status === "TRABALHANDO" ? "Em jornada" : "Fora da jornada"}
                </strong>
              </div>
            </div>

            {/* Botão principal */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <button
                type="button"
                onClick={acaoRegistrarPonto}
                disabled={loading || !func || registrando}
                aria-disabled={loading || !func || registrando ? "true" : "false"}
                aria-label={estadoPonto.label}
                className="refresh-btn"
                style={{
                  ...primaryBtnStyle,
                  fontSize: "clamp(var(--fs-16), 4vw, 1.25rem)",
                  padding: "clamp(12px, 4vw, 18px) clamp(16px, 4vw, 28px)",
                  borderWidth: 2,
                  width: "100%",
                  maxWidth: 320,
                  boxShadow: "var(--shadow)",
                  opacity: loading || registrando ? 0.8 : 1,
                }}
              >
                {registrando ? "Registrando..." : estadoPonto.label}
              </button>
              <div style={{ fontSize: "var(--fs-12)", color: "var(--muted)", display: "flex", alignItems: "center", gap: 6 }}>
                Origem: <OrigemBadge origem="APONTADO" />
              </div>
            </div>
          </div>

          {/* Escala de Hoje */}
          <div
            style={{
              background: "var(--panel)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              padding: 20,
            }}
            aria-labelledby="titulo-escala"
          >
            <h2
              id="titulo-escala"
              style={{
                fontWeight: 700,
                margin: 0,
                marginBottom: 12,
                fontSize: "clamp(var(--fs-16), 4vw, var(--fs-18))",
                color: "var(--fg)",
              }}
            >
              Minha escala de hoje
            </h2>
            {escalaHoje.length === 0 ? (
              <p style={{ color: "var(--muted)", fontSize: "var(--fs-14)", margin: 0 }}>
                Nenhum turno registrado na escala de hoje.
              </p>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {escalaHoje.map((t) => (
                  <div
                    key={t.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: 12,
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      background: "var(--panel-muted)",
                      fontSize: "var(--fs-14)",
                    }}
                    aria-label={`Turno ${t.turno_ordem}`}
                  >
                    <span style={{ color: "var(--muted)" }}>Turno {t.turno_ordem}</span>
                    <span style={{ fontWeight: 600, color: "var(--fg)" }}>
                      {(t.entrada || "—")} — {(t.saida || "—")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Apontamentos do Dia */}
        <section
          style={{
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            padding: 20,
          }}
          aria-labelledby="titulo-apont"
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <h2
              id="titulo-apont"
              style={{
                margin: 0,
                fontWeight: 700,
                fontSize: "clamp(var(--fs-16), 4vw, var(--fs-18))",
                color: "var(--fg)",
              }}
            >
              Meus apontamentos de hoje • {new Date(dataISO || Date.now()).toLocaleDateString("pt-BR")}
            </h2>
            <button
              type="button"
              className="toggle-btn"
              onClick={carregarHoje}
              disabled={loading}
              aria-label="Recarregar apontamentos de hoje"
              style={{ opacity: loading ? 0.7 : 1 }}
            >
              Recarregar
            </button>
          </div>

          {apontsHoje.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: "var(--fs-14)", margin: 0 }}>Nenhum apontamento hoje.</p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {apontsHoje.map((a) => (
                <article
                  key={a.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr",
                    gap: 8,
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    padding: 12,
                    background: "var(--panel-muted)",
                    fontSize: "var(--fs-14)",
                  }}
                  aria-label={`Apontamento do turno ${a.turno_ordem}`}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "var(--muted)" }}>Turno {a.turno_ordem}</span>
                    <OrigemBadge origem={a.origem} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div>
                      <div style={{ fontSize: "var(--fs-12)", color: "var(--muted)", marginBottom: 2 }}>Entrada</div>
                      <strong>{a.entrada || "—"}</strong>
                    </div>
                    <div>
                      <div style={{ fontSize: "var(--fs-12)", color: "var(--muted)", marginBottom: 2 }}>Saída</div>
                      <strong>{a.saida || "—"}</strong>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}