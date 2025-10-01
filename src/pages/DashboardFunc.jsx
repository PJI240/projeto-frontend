// src/pages/DashboardFunc.jsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");

/* ===== helpers de data/hora ===== */
const pad2 = (n) => String(n).padStart(2, "0");
const toISO = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const hojeISO = () => toISO(new Date());

// AGORA com segundos para enviar ao backend (evita 400)
const agoraHHMMSS = () => {
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
};

// Normaliza string para HH:MM:SS (aceita HH:MM e completa com :00)
const toHHMMSS = (s) => {
  if (!s) return null;
  const m = String(s).trim().match(/^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/);
  if (!m) return null;
  const hh = m[1], mm = m[2], ss = m[3] ?? "00";
  return `${hh}:${mm}:${ss}`;
};

// Para exibir só HH:MM
const showHHMM = (s) => (s ? String(s).slice(0, 5) : "—");

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
  const [func, setFunc] = useState(null); // { id, pessoa_nome, cargo_nome }
  const [escalaHoje, setEscalaHoje] = useState([]); // [{entrada,saida,turno_ordem}]
  const [apontsHoje, setApontsHoje] = useState([]); // apontamentos APONTADO de hoje do funcionário
  const [loading, setLoading] = useState(true);
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
    if (!func) return;
    setErr("");
    setMsg("");

    const iso = hojeISO();
    const hhmmss = agoraHHMMSS();

    try {
      // refresh do estado antes de bater
      const atuais = await loadApontsHoje(func.id);
      const aberto = atuais.find((a) => a.entrada && !a.saida);

      if (aberto) {
        // fechar o turno atual
        await api(`/api/apontamentos/${aberto.id}`, {
          method: "PUT",
          body: JSON.stringify({
            funcionario_id: func.id,
            data: iso,
            turno_ordem: aberto.turno_ordem || 1,
            entrada: toHHMMSS(aberto.entrada), // normaliza backend
            saida: toHHMMSS(hhmmss),           // normaliza backend
            origem: "APONTADO",
            obs: null,
          }),
        });
        setMsg("Saída registrada com sucesso!");
      } else {
        // abrir um novo turno: turno_ordem = max + 1
        const maxTurno = atuais.reduce((m, a) => Math.max(m, Number(a.turno_ordem || 1)), 0) || 0;
        await api(`/api/apontamentos`, {
          method: "POST",
          body: JSON.stringify({
            funcionario_id: func.id,
            data: iso,
            turno_ordem: maxTurno + 1,
            entrada: toHHMMSS(hhmmss), // normaliza backend
            saida: null,
            origem: "APONTADO",
            obs: null,
          }),
        });
        setMsg("Entrada registrada com sucesso!");
      }

      // reload
      const [esc, ap] = await Promise.all([loadEscalaHoje(func.id), loadApontsHoje(func.id)]);
      setEscalaHoje(esc);
      setApontsHoje(ap);
    } catch (e) {
      setErr(e.message || "Falha ao registrar ponto.");
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
    <>
      <header className="main-header">
        <div className="header-content">
          <h1>Meu Painel</h1>
          <p>
            {agoraTexto.semana}, {agoraTexto.data} •{" "}
            <strong style={{ fontVariantNumeric: "tabular-nums" }}>{agoraTexto.hora}</strong>
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="toggle-btn" onClick={recarregar} disabled={loading}>
            {loading ? "Atualizando…" : "Atualizar"}
          </button>
        </div>
      </header>

      {err && (
        <div className="error-alert" role="alert" style={{ marginBottom: 16 }}>
          {err}
        </div>
      )}
      {msg && (
        <div
          className="error-alert"
          role="status"
          style={{
            marginBottom: 16,
            background: "rgba(16,185,129,.1)",
            color: "var(--success)",
            borderColor: "rgba(16,185,129,.35)",
          }}
        >
          {msg}
        </div>
      )}

      {/* Cartão do relógio + botão */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr",
          gap: 16,
          marginBottom: 16,
        }}
      >
        <div
          className="stat-card"
          style={{
            borderLeftColor: estadoPonto.status === "TRABALHANDO" ? "var(--success)" : "var(--accent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "2rem",
          }}
        >
          <div>
            <div style={{ fontSize: "14px", color: "var(--muted)", marginBottom: 8 }}>
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
                fontSize: "64px",
                lineHeight: 1,
                fontWeight: 800,
                letterSpacing: 1,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {agoraTexto.hora}
            </div>
            <div style={{ color: "var(--muted)", marginTop: 8 }}>
              Status:{" "}
              <strong style={{ color: estadoPonto.status === "TRABALHANDO" ? "var(--success)" : "var(--muted)" }}>
                {estadoPonto.status === "TRABALHANDO" ? "Em jornada" : "Fora da jornada"}
              </strong>
            </div>
          </div>

          <div style={{ textAlign: "center" }}>
            <button
              className="toggle-btn"
              onClick={acaoRegistrarPonto}
              disabled={loading || !func}
              style={{
                fontSize: "20px",
                padding: "18px 28px",
                borderWidth: 2,
                background: estadoPonto.status === "TRABALHANDO" ? "var(--warning)" : "var(--accent)",
                color: estadoPonto.status === "TRABALHANDO" ? "#111" : "#fff",
                borderColor: estadoPonto.status === "TRABALHANDO" ? "var(--warning)" : "var(--accent-strong)",
                boxShadow: "0 6px 18px rgba(0,0,0,.08)",
              }}
              aria-label={estadoPonto.label}
              title={estadoPonto.label}
            >
              {estadoPonto.label}
            </button>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
              Origem: <OrigemBadge origem="APONTADO" />
            </div>
          </div>
        </div>

        {/* Escala de hoje */}
        <div className="stat-card" data-accent="info" style={{ padding: "1.25rem 1.25rem" }}>
          <div className="stat-header" style={{ marginBottom: 8 }}>
            <div style={{ fontWeight: 700 }}>Minha escala de hoje</div>
          </div>
          {escalaHoje.length === 0 ? (
            <div style={{ color: "var(--muted)" }}>Nenhum turno registrado na escala de hoje.</div>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
              {escalaHoje.map((t) => (
                <li
                  key={t.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "10px 12px",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    background: "var(--panel)",
                  }}
                >
                  <div>Turno {t.turno_ordem}</div>
                  <div style={{ fontWeight: 600 }}>
                    {showHHMM(t.entrada)} — {showHHMM(t.saida)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Apontamentos do dia */}
      <section
        style={{
          background: "var(--panel)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: 16,
        }}
      >
        <div className="stat-header" style={{ marginBottom: 8 }}>
          <div style={{ fontWeight: 700 }}>Meus apontamentos de hoje • {agoraTexto.data}</div>
          <button className="toggle-btn" onClick={recarregar} disabled={loading}>
            Recarregar
          </button>
        </div>

        {apontsHoje.length === 0 ? (
          <div style={{ color: "var(--muted)" }}>Nenhum apontamento hoje.</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {apontsHoje.map((a) => (
              <div
                key={a.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "80px 1fr 1fr 1fr",
                  alignItems: "center",
                  gap: 8,
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "8px 12px",
                }}
              >
                <div style={{ color: "var(--muted)" }}>Turno {a.turno_ordem}</div>
                <div>
                  Entrada: <strong>{showHHMM(a.entrada)}</strong>
                </div>
                <div>
                  Saída: <strong>{showHHMM(a.saida)}</strong>
                </div>
                <div style={{ textAlign: "right" }}>
                  <OrigemBadge origem={a.origem} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
