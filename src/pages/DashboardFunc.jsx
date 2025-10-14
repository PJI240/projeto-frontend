import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { ArrowPathIcon } from "@heroicons/react/24/outline";
import { ArrowRightOnRectangleIcon, ArrowLeftOnRectangleIcon, XMarkIcon } from "@heroicons/react/24/solid";

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");
const weekdayPt = (d) => d.toLocaleDateString("pt-BR", { weekday: "long" }).replace(/^\w/, (c) => c.toUpperCase());

function getTimeZone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo"; }
  catch { return "America/Sao_Paulo"; }
}
function buildColetorIdentificador() {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "node";
  const pf = typeof navigator !== "undefined" ? navigator.platform : "unknown";
  return `web:${pf}:${ua}`.slice(0, 120);
}

const Chip = ({ children, tone = "neutral", title }) => (
  <span
    className={`chip chip--${tone}`}
    title={title}
    style={{
      fontSize: "var(--fs-12)",
      padding: "2px 8px",
      borderRadius: 999,
      border: "1px solid var(--border)",
      whiteSpace: "nowrap",
      background: "var(--panel-muted)",
    }}
  >
    {children}
  </span>
);
const OrigemBadge = ({ origem }) => {
  const map = {
    APONTADO: { tone: "neutral", label: "APONTADO" },
    IMPORTADO: { tone: "info", label: "IMPORTADO" },
    AJUSTE: { tone: "warning", label: "AJUSTE" },
  };
  const s = map[String(origem || "APONTADO").toUpperCase()] || map.APONTADO;
  return <Chip tone={s.tone}>{s.label}</Chip>;
};
const RepFlag = ({ isOficial }) => (
  <Chip
    tone={isOficial ? "success" : "warning"}
    title={isOficial ? "Registro oficial do REP-P" : "Registro de AJUSTE (PTRP)"}
  >
    {isOficial ? "OFICIAL" : "AJUSTE"}
  </Chip>
);
const TratamentoBadge = ({ status }) => (
  <Chip tone={status === "VALIDA" ? "success" : "danger"}>
    {status === "VALIDA" ? "VÁLIDA" : "INVALIDADA"}
  </Chip>
);

/* ===== Modal de Confirmação ===== */
const ConfirmacaoModal = ({ isOpen, onClose, onConfirm, tipoRegistro, loading }) => {
  if (!isOpen) return null;
  const isEntrada = tipoRegistro === "entrada";
  const titulo = isEntrada ? "Confirmar Registro de Entrada" : "Confirmar Registro de Saída";
  const mensagem = isEntrada
    ? "Você está prestes a registrar sua ENTRADA. Este registro é definitivo e não poderá ser alterado posteriormente. Deseja continuar?"
    : "Você está prestes a registrar sua SAÍDA. Este registro é definitivo e não poderá ser alterado posteriormente. Deseja continuar?";

  return (
    <div
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 24, maxWidth: 480, width: "100%", boxShadow: "0 10px 25px rgba(0,0,0,.2)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: "var(--fs-18)", fontWeight: 600, color: "var(--fg)" }}>{titulo}</h3>
          <button type="button" onClick={onClose} disabled={loading} style={{ background: "none", border: "none", padding: 4, borderRadius: 4, color: "var(--muted)", cursor: loading ? "not-allowed" : "pointer" }} aria-label="Fechar">
            <XMarkIcon style={{ width: 20, height: 20 }} />
          </button>
        </div>

        <div style={{ marginBottom: 24 }}>
          <p style={{ margin: 0, color: "var(--fg)", lineHeight: 1.5 }}>{mensagem}</p>
          <div style={{ marginTop: 12, padding: 12, background: "var(--warning-muted)", border: "1px solid var(--warning-border)", borderRadius: 6, fontSize: "var(--fs-12)", color: "var(--warning-strong)" }}>
            ⚠️ <strong>Atenção:</strong> Esta ação é irreversível após a confirmação.
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button type="button" onClick={onClose} disabled={loading} className="btn btn--neutral" style={{ minWidth: 100 }}>
            Cancelar
          </button>
          <button type="button" onClick={onConfirm} disabled={loading} className={isEntrada ? "btn btn--primary" : "btn btn--warning"} style={{ minWidth: 100 }} aria-busy={loading ? "true" : "false"}>
            {loading ? (<><span className="spinner" aria-hidden="true" /><span>Confirmando...</span></>) : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default function DashboardFunc() {
  const [tick, setTick] = useState(0);
  const [loading, setLoading] = useState(true);
  const [registrando, setRegistrando] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [showConfirmacao, setShowConfirmacao] = useState(false);
  const [tipoRegistroPendente, setTipoRegistroPendente] = useState(null);

  const [empresaId, setEmpresaId] = useState(null);
  const [func, setFunc] = useState(null);
  const [dataISO, setDataISO] = useState("");
  const [escalaHoje, setEscalaHoje] = useState([]);
  const [apontsHoje, setApontsHoje] = useState([]); // agora: [{ id, turno_ordem, evento, horario, ... }]

  const isMounted = useRef(true);
  const liveRef = useRef(null);

  const api = useCallback(async (path, init = {}) => {
    const r = await fetch(`${API_BASE}${path}`, {
      credentials: "include",
      ...init,
      headers: { "Content-Type": "application/json", ...(init.headers || {}) },
    });
    let data = null;
    try { data = await r.json(); } catch {}
    if (!r.ok || data?.ok === false) throw new Error(data?.error || `HTTP ${r.status}`);
    return data;
  }, []);

  const carregarHoje = useCallback(async () => {
    setLoading(true); setErr(""); setMsg("");
    try {
      const d = await api("/api/dashboard_func/hoje");
      if (!isMounted.current) return;
      setEmpresaId(d.empresa_id || null);
      setFunc(d.funcionario || null);
      setDataISO(d.data || "");
      setEscalaHoje(d.escala || []);
      // backend já vem ordenado por horario; se precisar, garantimos aqui:
      const eventos = Array.isArray(d.apontamentos) ? [...d.apontamentos].sort((a,b) => (a.horario || "").localeCompare(b.horario || "")) : [];
      setApontsHoje(eventos);
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
    return () => { isMounted.current = false; clearInterval(t); };
  }, [carregarHoje]);

  // === Estado do ponto com base na ÚLTIMA batida (evento) ===
  const estadoPonto = useMemo(() => {
    const ultimo = apontsHoje[apontsHoje.length - 1];
    if (ultimo?.evento === "ENTRADA") {
      return { status: "TRABALHANDO", label: "Registrar saída", tipo: "saida" };
    }
    return { status: "FORA", label: "Registrar entrada", tipo: "entrada" };
  }, [apontsHoje]);

  const iniciarRegistroPonto = () => {
    if (!func || registrando) return;
    setTipoRegistroPendente(estadoPonto.tipo);
    setShowConfirmacao(true);
  };

  const confirmarRegistroPonto = async () => {
    if (!func || registrando) return;
    setRegistrando(true); setErr(""); setMsg(""); setShowConfirmacao(false);
    try {
      const payload = {
        empresa_id: empresaId || undefined,
        origem: "APONTADO",
        tz: getTimeZone(),
        coletor_identificador: buildColetorIdentificador(),
        coletor_versao: typeof navigator !== "undefined" ? navigator.appVersion?.slice(0, 40) : undefined,
      };
      const resp = await api(`/api/dashboard_func/clock`, { method: "POST", body: JSON.stringify(payload) });
      await carregarHoje();
      const feedback = resp?.action === "saida" ? "Saída registrada com sucesso!" : "Entrada registrada com sucesso!";
      setMsg(feedback);
      if (liveRef.current) liveRef.current.textContent = feedback;
    } catch (e) {
      setErr(e.message || "Falha ao registrar ponto.");
      if (liveRef.current) liveRef.current.textContent = "Erro ao registrar ponto.";
    } finally {
      setRegistrando(false);
      setTipoRegistroPendente(null);
    }
  };

  const cancelarRegistroPonto = () => {
    setShowConfirmacao(false);
    setTipoRegistroPendente(null);
  };

  const agoraTexto = useMemo(() => {
    const d = new Date();
    const data = d.toLocaleDateString("pt-BR");
    const hora = d.toLocaleTimeString("pt-BR", { hour12: false });
    return { data, hora, semana: weekdayPt(d) };
  }, [tick]);

  const horaAgora = new Date().toLocaleTimeString("pt-BR", { hour12: false });

  const isTrabalhando = estadoPonto.status === "TRABALHANDO";
  const btnClassePrincipal = isTrabalhando ? "btn btn--warning btn--lg" : "btn btn--primary btn--lg";
  const BtnIcon = isTrabalhando ? ArrowLeftOnRectangleIcon : ArrowRightOnRectangleIcon;

  return (
    <div className="container" role="main" aria-labelledby="titulo-pagina" style={{ paddingBlock: 16 }}>
      <ConfirmacaoModal
        isOpen={showConfirmacao}
        onClose={cancelarRegistroPonto}
        onConfirm={confirmarRegistroPonto}
        tipoRegistro={tipoRegistroPendente}
        loading={registrando}
      />

      <header className="page-header">
        <div>
          <h1 id="titulo-pagina" className="page-title">Meu Painel</h1>
          <p className="page-subtitle">
            {agoraTexto.semana}, {agoraTexto.data} •{" "}
            <strong style={{ fontVariantNumeric: "tabular-nums", color: "var(--fg)" }}>
              {agoraTexto.hora}
            </strong>
          </p>
        </div>
        <div className="page-header__toolbar">
          <button
            type="button"
            className="btn btn--neutral"
            onClick={carregarHoje}
            disabled={loading}
            aria-busy={loading ? "true" : "false"}
            aria-label="Atualizar painel"
            title="Atualizar"
          >
            {loading ? <span className="spinner" aria-hidden="true" /> : <ArrowPathIcon className="icon" aria-hidden="true" />}
            <span>{loading ? "Atualizando…" : "Atualizar"}</span>
          </button>
        </div>
      </header>

      <div ref={liveRef} id="announce" aria-live="polite" className="visually-hidden" />

      {err && <div className="error-alert" role="alert">{err}</div>}
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

      <main id="conteudo" tabIndex={-1} style={{ outline: "none" }}>
        {/* Cartão principal */}
        <section style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16, marginBottom: 16 }}>
          <div
            style={{
              background: "var(--panel)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              padding: 20,
              borderLeft: `4px solid ${isTrabalhando ? "var(--success)" : "var(--accent-bg)"}`,
              display: "flex",
              flexDirection: "column",
              gap: 20,
            }}
          >
            <div>
              <div style={{ fontSize: "var(--fs-14)", color: "var(--muted)", marginBottom: 8 }}>
                {func ? (<><strong>{func.pessoa_nome}</strong>{func.cargo_nome ? <> • {func.cargo_nome}</> : null}</>) : "Carregando…"}
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
                <strong style={{ color: isTrabalhando ? "var(--success)" : "var(--muted)" }}>
                  {isTrabalhando ? "Em jornada" : "Fora da jornada"}
                </strong>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <button
                type="button"
                onClick={iniciarRegistroPonto}
                disabled={loading || !func || registrando}
                aria-disabled={loading || !func || registrando ? "true" : "false"}
                aria-label={estadoPonto.label}
                className={btnClassePrincipal}
                style={{
                  width: "100%",
                  maxWidth: 380,
                  fontSize: "clamp(1rem, 5vw, 1.25rem)",
                  padding: "clamp(14px, 5vw, 18px) clamp(18px, 5vw, 28px)",
                }}
              >
                {registrando ? (
                  <>
                    <span className="spinner" aria-hidden="true" />
                    <span>Registrando…</span>
                  </>
                ) : (
                  <>
                    <BtnIcon className="icon" aria-hidden="true" />
                    <span>{estadoPonto.label}</span>
                  </>
                )}
              </button>
              <div style={{ fontSize: "var(--fs-12)", color: "var(--muted)", display: "flex", alignItems: "center", gap: 6 }}>
                <span>Origem:</span> <OrigemBadge origem="APONTADO" />
                <span aria-hidden>•</span>
                <span>TZ:</span> <code>{getTimeZone()}</code>
              </div>
            </div>
          </div>

          {/* Escala */}
          <div
            style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 20 }}
            aria-labelledby="titulo-escala"
          >
            <h2 id="titulo-escala" style={{ fontWeight: 700, margin: 0, marginBottom: 12, fontSize: "clamp(var(--fs-16), 4vw, var(--fs-18))", color: "var(--fg)" }}>
              Minha escala de hoje
            </h2>
            {escalaHoje.length === 0 ? (
              <p style={{ color: "var(--muted)", fontSize: "var(--fs-14)", margin: 0 }}>Nenhum turno registrado na escala de hoje.</p>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {escalaHoje.map((t) => (
                  <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12, border: "1px solid var(--border)", borderRadius: 8, background: "var(--panel-muted)", fontSize: "var(--fs-14)" }} aria-label={`Turno ${t.turno_ordem}`}>
                    <span style={{ color: "var(--muted)" }}>Turno {t.turno_ordem}</span>
                    <span style={{ fontWeight: 600, color: "var(--fg)" }}>{(t.entrada || "—")} — {(t.saida || "—")}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Apontamentos (eventos do dia) */}
        <section style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 20 }} aria-labelledby="titulo-apont">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
            <h2 id="titulo-apont" style={{ margin: 0, fontWeight: 700, fontSize: "clamp(var(--fs-16), 4vw, var(--fs-18))", color: "var(--fg)" }}>
              Meus apontamentos de hoje • {new Date(dataISO || Date.now()).toLocaleDateString("pt-BR")}
            </h2>
            <button type="button" className="btn btn--neutral" onClick={carregarHoje} disabled={loading} aria-label="Recarregar apontamentos de hoje">
              {loading ? <span className="spinner" aria-hidden="true" /> : <ArrowPathIcon className="icon" aria-hidden="true" />}
              <span>{loading ? "Atualizando…" : "Recarregar"}</span>
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
                  aria-label={`Turno ${a.turno_ordem} • ${a.evento} ${a.horario}`}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ color: "var(--muted)" }}>Turno {a.turno_ordem}</span>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                      <RepFlag isOficial={String(a.is_rep_oficial) === "1" || a.is_rep_oficial === 1 || a.is_rep_oficial === true} />
                      <OrigemBadge origem={a.origem} />
                      {a.status_tratamento && <TratamentoBadge status={a.status_tratamento} />}
                    </div>
                  </div>

                  {/* Linha principal do evento */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {a.evento === "ENTRADA" ? (
                        <ArrowRightOnRectangleIcon className="icon" aria-hidden="true" />
                      ) : (
                        <ArrowLeftOnRectangleIcon className="icon" aria-hidden="true" />
                      )}
                      <strong>{a.evento}</strong>
                    </div>
                    <div style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{a.horario || "—"}</div>
                  </div>

                  {(a.nsr || a.coletor_id || a.tz) && (
                    <div style={{ fontSize: "var(--fs-12)", color: "var(--muted)", display: "flex", gap: 12, flexWrap: "wrap" }}>
                      {a.nsr ? <span>NSR: <code>{a.nsr}</code></span> : null}
                      {a.coletor_id ? <span>Coletor: <code>#{a.coletor_id}</code></span> : null}
                      {a.tz ? <span>TZ: <code>{a.tz}</code></span> : null}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}