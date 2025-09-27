import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import AccessibilityToggles from "../components/AccessibilityToggles";

const API_BASE = import.meta.env.VITE_API_BASE?.replace(/\/+$/, "") || "";

/** Ícones simples em SVG (herdam currentColor) */
function UsersIcon(props) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path d="M16 11c1.66 0 3-1.57 3-3.5S17.66 4 16 4s-3 1.57-3 3.5S14.34 11 16 11zm-9 0c1.66 0 3-1.57 3-3.5S8.66 4 7 4 4 5.57 4 7.5 5.34 11 7 11zm0 2c-2.67 0-8 1.34-8 4v1h10v-1c0-1.43.69-2.67 1.77-3.57C9.78 12.77 8.08 13 7 13zm9 0c-.46 0-.98.03-1.53.09 1.24.91 2.03 2.11 2.03 3.91v1h8v-1c0-2.66-5.33-4-8.5-4z" />
    </svg>
  );
}
function PersonIcon(props) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-3.31 0-8 1.34-8 4v2h16v-2c0-2.66-4.69-4-8-4z" />
    </svg>
  );
}
function BuildingIcon(props) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path d="M3 21h18v-2H3v2zM19 3H5v14h14V3zm-8 12H7v-2h4v2zm0-4H7V9h4v2zm0-4H7V5h4v2zm6 8h-4v-2h4v2zm0-4h-4V9h4v2zm0-4h-4V5h4v2z" />
    </svg>
  );
}
function DatabaseIcon(props) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path d="M12 3C7.58 3 4 4.79 4 7s3.58 4 8 4 8-1.79 8-4-3.58-4-8-4zm0 6c-4.42 0-8-1.79-8-4v4c0 2.21 3.58 4 8 4s8-1.79 8-4V5c0 2.21-3.58 4-8 4zm0 4c-4.42 0-8-1.79-8-4v6c0 2.21 3.58 4 8 4s8-1.79 8-4V9c0 2.21-3.58 4-8 4z" />
    </svg>
  );
}
function PlusIcon(props) {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path d="M19 11H13V5h-2v6H5v2h6v6h2v-6h6z" />
    </svg>
  );
}
function RefreshIcon(props) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path d="M17.65 6.35A7.95 7.95 0 0012 4C7.58 4 4 7.58 4 12h2a6 6 0 1110.24 3.66L14 13v7h7l-2.35-2.35A7.96 7.96 0 0020 12c0-2.21-.9-4.2-2.35-5.65z" />
    </svg>
  );
}
function LogoutIcon(props) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5-5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" />
    </svg>
  );
}
function AlertIcon(props) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
    </svg>
  );
}

export default function Dashboard() {
  const [counts, setCounts] = useState({ usuarios: 0, pessoas: 0, empresas: 0 });
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const navigate = useNavigate();

  const fetchJson = useCallback(async (url, init) => {
    const r = await fetch(url, { credentials: "include", ...init });
    let data;
    try { data = await r.json(); } catch { data = null; }
    if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`);
    return data;
  }, []);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const meResp = await fetchJson(`${API_BASE}/api/auth/me`);
      if (!meResp?.ok || !meResp.user) {
        navigate("/login");
        return;
      }
      setMe(meResp.user);

      const resumo = await fetchJson(`${API_BASE}/api/dashboard/resumo`);
      if (!resumo?.ok) throw new Error(resumo?.error || "Falha ao obter resumo");
      setCounts(resumo.counts || { usuarios: 0, pessoas: 0, empresas: 0 });
    } catch (e) {
      console.error("DASHBOARD_LOAD_ERROR", e);
      setErr(e.message || "Erro ao carregar dados.");
    } finally {
      setLoading(false);
    }
  }, [fetchJson, navigate]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const logout = async () => {
    try {
      await fetch(`${API_BASE}/api/auth/logout`, { method: "POST", credentials: "include" });
    } finally {
      navigate("/login");
    }
  };

  const totalRegistros = (counts?.usuarios || 0) + (counts?.pessoas || 0) + (counts?.empresas || 0);

  return (
    <div className="dashboard-container">
      {/* Sidebar */}
      <aside className="dashboard-sidebar" aria-label="Menu lateral">
        <div className="sidebar-header">
          <h1 className="brand">Projeto Integrador</h1>
          <h2 className="subtitle">Dashboard</h2>
        </div>

        {/* Informações do usuário (sem avatar/bordinha) */}
        <div className="user-info" aria-live="polite">
          {me ? (
            <>
              <div className="user-details">
                <div className="user-name">{me.nome}</div>
                <div className="user-email">{me.email}</div>
              </div>
              <button className="logout-btn" onClick={logout} title="Sair">
                <LogoutIcon />
              </button>
            </>
          ) : (
            <div className="user-loading">Carregando…</div>
          )}
        </div>

        <nav className="sidebar-nav" aria-label="Navegação principal">
          <Link to="/dashboard" className="nav-item active">
            <DatabaseIcon />
            <span>Visão Geral</span>
          </Link>
          <Link to="/cadastros/usuarios" className="nav-item">
            <UsersIcon />
            <span>Usuários</span>
          </Link>
          <Link to="/cadastros/pessoas" className="nav-item">
            <PersonIcon />
            <span>Pessoas</span>
          </Link>
          <Link to="/cadastros/empresas" className="nav-item">
            <BuildingIcon />
            <span>Empresas</span>
          </Link>
        </nav>

        <div className="sidebar-footer">
          <AccessibilityToggles />
        </div>
      </aside>

      {/* Conteúdo principal */}
      <main className="dashboard-main">
        <header className="main-header">
          <div className="header-content">
            <h1>Visão Geral do Sistema</h1>
            <p>Monitoramento e gestão de dados</p>
          </div>
          <button
            className="refresh-btn"
            onClick={carregar}
            disabled={loading}
            aria-busy={loading ? "true" : "false"}
          >
            <RefreshIcon />
            {loading ? "Atualizando..." : "Atualizar"}
          </button>
        </header>

        {err && (
          <div className="error-alert" role="alert">
            <AlertIcon />
            <span>{err}</span>
          </div>
        )}

        {/* Cards de estatística (sem emoji; cores via tema/data-accent) */}
        <div className="stats-grid">
          <StatCard
            title="Usuários Ativos"
            value={loading ? "…" : counts.usuarios}
            accent="info"
            icon={<UsersIcon />}
            trend="+5%"
          />
          <StatCard
            title="Pessoas Cadastradas"
            value={loading ? "…" : counts.pessoas}
            accent="success"
            icon={<PersonIcon />}
            trend="+12%"
          />
          <StatCard
            title="Empresas Ativas"
            value={loading ? "…" : counts.empresas}
            accent="warning"
            icon={<BuildingIcon />}
            trend="+3%"
          />
          <StatCard
            title="Total de Registros"
            value={loading ? "…" : totalRegistros}
            accent="error"
            icon={<DatabaseIcon />}
            trend="+8%"
          />
        </div>

        <section className="quick-actions" aria-labelledby="acoes-rapidas">
          <h2 id="acoes-rapidas">Ações Rápidas</h2>
          <div className="actions-grid">
            <Link to="/cadastros/usuarios/novo" className="action-card" aria-label="Criar novo usuário">
              <PlusIcon />
              <span>Novo Usuário</span>
            </Link>
            <Link to="/cadastros/pessoas/novo" className="action-card" aria-label="Criar nova pessoa">
              <PlusIcon />
              <span>Nova Pessoa</span>
            </Link>
            <Link to="/cadastros/empresas/novo" className="action-card" aria-label="Criar nova empresa">
              <PlusIcon />
              <span>Nova Empresa</span>
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}

/** Card de estatística usando variáveis do tema
 *  - cor da borda: var(--accent) por padrão ou via data-accent="success|warning|error|info"
 *  - fonte e contrastes respeitam [data-font] e [data-theme]
 */
function StatCard({ title, value, icon, trend, accent }) {
  return (
    <article className="stat-card" data-accent={accent}>
      <div className="stat-header">
        <div className="stat-icon" aria-hidden="true">{icon}</div>
        <span className="stat-trend">{trend}</span>
      </div>
      <div className="stat-content">
        <div className="stat-value" aria-live="polite">{value}</div>
        <div className="stat-title">{title}</div>
      </div>
    </article>
  );
}
