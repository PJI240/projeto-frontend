import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import AccessibilityToggles from "../components/AccessibilityToggles";
import "./dashboard.css";

const API_BASE = import.meta.env.VITE_API_BASE?.replace(/\/+$/, "") || "";

export default function Dashboard() {
  const [counts, setCounts] = useState({ usuarios: 0, pessoas: 0, empresas: 0 });
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const fetchJson = useCallback(async (url, init) => {
    const r = await fetch(url, { credentials: "include", ...init });
    let data;
    try { data = await r.json(); } catch { data = null; }
    if (!r.ok) {
      throw new Error(data?.error || `HTTP ${r.status}`);
    }
    return data;
  }, []);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      // 1) verifica sessão
      const meResp = await fetchJson(`${API_BASE}/api/auth/me`);
      if (!meResp?.ok || !meResp.user) {
        // não autenticado -> redireciona pro login
        window.location.href = "/login";
        return;
      }
      setMe(meResp.user);

      // 2) busca resumo
      const resumo = await fetchJson(`${API_BASE}/api/dashboard/resumo`);
      if (!resumo?.ok) throw new Error(resumo?.error || "Falha ao obter resumo");
      setCounts(resumo.counts || { usuarios: 0, pessoas: 0, empresas: 0 });
    } catch (e) {
      console.error("DASHBOARD_LOAD_ERROR", e);
      setErr(e.message || "Erro ao carregar dados.");
    } finally {
      setLoading(false);
    }
  }, [fetchJson]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const logout = async () => {
    try {
      await fetch(`${API_BASE}/api/auth/logout`, { method: "POST", credentials: "include" });
    } finally {
      window.location.href = "/login";
    }
  };

  return (
    <div className="split">
      {/* LADO ESQUERDO - similar ao Login */}
      <section className="left">
        <h1 className="brand">Projeto Integrador</h1>
        <h2 className="title">Dashboard</h2>

        <div className="user-box" aria-live="polite">
          {me ? (
            <>
              <div className="hello">Olá, <strong>{me.nome}</strong></div>
              <div className="email">{me.email}</div>
              <button className="linklike" onClick={logout}>Sair</button>
            </>
          ) : (
            <div className="hello">Verificando sessão…</div>
          )}
        </div>

        <div className="toggles-wrapper">
          <AccessibilityToggles />
        </div>

        <nav className="menu">
          <Link to="/dashboard">Início</Link>
          <Link to="/cadastros/usuarios">Usuários</Link>
          <Link to="/cadastros/pessoas">Pessoas</Link>
          <Link to="/cadastros/empresas">Empresas</Link>
        </nav>
      </section>

      {/* LADO DIREITO - conteúdo */}
      <section className="right">
        <div className="overlay">
          <header className="topbar">
            <h3>
              Projeto Integrador Univesp
              <span> Visão geral do sistema</span>
            </h3>
            <div className="actions">
              <button onClick={carregar} disabled={loading}>
                {loading ? "Atualizando…" : "Atualizar"}
              </button>
            </div>
          </header>

          {err && (
            <div role="alert" className="alert-error">
              {err}
            </div>
          )}

          <div className="cards" aria-busy={loading ? "true" : "false"}>
            <StatCard
              title="Usuários ativos"
              value={loading ? "…" : counts.usuarios}
              hint="usuarios.ativo = TRUE"
            />
            <StatCard
              title="Pessoas"
              value={loading ? "…" : counts.pessoas}
              hint="pessoas (total)"
            />
            <StatCard
              title="Empresas ativas"
              value={loading ? "…" : counts.empresas}
              hint="empresas.ativa = TRUE"
            />
          </div>

          <section className="next-steps">
            <h4>Próximos passos</h4>
            <ul>
              <li>Adicionar cards: Funcionários, Escalas de hoje e Apontamentos.</li>
              <li>Filtrar por empresa vinculada ao usuário logado.</li>
              <li>Gráfico semanal de apontamentos (linha/colunas).</li>
            </ul>
          </section>
        </div>
      </section>
    </div>
  );
}

function StatCard({ title, value, hint }) {
  return (
    <article className="stat-card">
      <div className="stat-title">{title}</div>
      <div className="stat-value" aria-live="polite">{value}</div>
      <div className="stat-hint">{hint}</div>
    </article>
  );
}
