import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE?.replace(/\/+$/, "") || "";

/* Ícones SVG simples (herdam currentColor) */
function UsersIcon(props){ return (<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" {...props}><path d="M16 11c1.66 0 3-1.57 3-3.5S17.66 4 16 4s-3 1.57-3 3.5S14.34 11 16 11zm-9 0c1.66 0 3-1.57 3-3.5S8.66 4 7 4 4 5.57 4 7.5 5.34 11 7 11zm0 2c-2.67 0-8 1.34-8 4v1h10v-1c0-1.43.69-2.67 1.77-3.57C9.78 12.77 8.08 13 7 13zm9 0c-.46 0-.98.03-1.53.09 1.24.91 2.03 2.11 2.03 3.91v1h8v-1c0-2.66-5.33-4-8.5-4z"/></svg>); }
function PersonIcon(props){ return (<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" {...props}><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-3.31 0-8 1.34-8 4v2h16v-2c0-2.66-4.69-4-8-4z"/></svg>); }
function BuildingIcon(props){ return (<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" {...props}><path d="M3 21h18v-2H3v2zM19 3H5v14h14V3zm-8 12H7v-2h4v2zm0-4H7V9h4v2zm0-4H7V5h4v2zm6 8h-4v-2h4v2zm0-4h-4V9h4v2zm0-4h-4V5h4v2z"/></svg>); }
function DatabaseIcon(props){ return (<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" {...props}><path d="M12 3C7.58 3 4 4.79 4 7s3.58 4 8 4 8-1.79 8-4-3.58-4-8-4zm0 6c-4.42 0-8-1.79-8-4v4c0 2.21 3.58 4 8 4s8-1.79 8-4V5c0 2.21-3.58 4-8 4zm0 4c-4.42 0-8-1.79-8-4v6c0 2.21 3.58 4 8 4s8-1.79 8-4V9c0 2.21-3.58 4-8 4z"/></svg>); }
function PlusIcon(props){ return (<svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true" {...props}><path d="M19 11H13V5h-2v6H5v2h6v6h2v-6h6z"/></svg>); }
function RefreshIcon(props){ return (<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" {...props}><path d="M17.65 6.35A7.95 7.95 0 0012 4C7.58 4 4 7.58 4 12h2a6 6 0 1110.24 3.66L14 13v7h7l-2.35-2.35A7.96 7.96 0 0020 12c0-2.21-.9-4.2-2.35-5.65z"/></svg>); }
function AlertIcon(props){ return (<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" {...props}><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>); }

export default function Dashboard() {
  const [counts, setCounts] = useState({ usuarios: 0, pessoas: 0, empresas: 0 });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const fetchJson = useCallback(async (url, init) => {
    const r = await fetch(url, { credentials: "include", ...init });
    const data = await r.json().catch(() => null);
    if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`);
    return data;
  }, []);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      // auth/me e redirecionamento já podem ser tratados no AppLayout;
      // aqui buscamos apenas o resumo do dashboard.
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

  useEffect(() => { carregar(); }, [carregar]);

  const totalRegistros =
    (counts?.usuarios || 0) + (counts?.pessoas || 0) + (counts?.empresas || 0);

  return (
    <>
      {/* Cabeçalho da página (o aside/menu vem do AppLayout) */}
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
          <RefreshIcon /> {loading ? "Atualizando..." : "Atualizar"}
        </button>
      </header>

      {err && (
        <div className="error-alert" role="alert">
          <AlertIcon />
          <span>{err}</span>
        </div>
      )}

      {/* Cards de estatística (cores via data-accent / variáveis do tema) */}
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

      {/* Ações rápidas (ajuste as rotas para seu padrão “flat”) */}
      <section className="quick-actions" aria-labelledby="acoes-rapidas">
        <h2 id="acoes-rapidas">Ações Rápidas</h2>
        <div className="actions-grid">
          <Link to="/usuarios" className="action-card" aria-label="Ir para Usuários">
            <PlusIcon />
            <span>Gerenciar Usuários</span>
          </Link>
          <Link to="/pessoas" className="action-card" aria-label="Ir para Pessoas">
            <PlusIcon />
            <span>Gerenciar Pessoas</span>
          </Link>
          <Link to="/empresas" className="action-card" aria-label="Ir para Empresas">
            <PlusIcon />
            <span>Gerenciar Empresas</span>
          </Link>
        </div>
      </section>
    </>
  );
}

/* Card de estatística */
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