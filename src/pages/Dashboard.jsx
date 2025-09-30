import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";

// Importando Heroicons
import {
  UsersIcon,
  UserIcon,
  BuildingOfficeIcon,
  CircleStackIcon,
  PlusIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon
} from "@heroicons/react/24/outline";

const API_BASE = import.meta.env.VITE_API_BASE?.replace(/\/+$/, "") || "";

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
          <ArrowPathIcon className={`icon-sm ${loading ? 'animate-spin' : ''}`} />
          {loading ? "Atualizando..." : "Atualizar"}
        </button>
      </header>

      {err && (
        <div className="error-alert" role="alert">
          <ExclamationTriangleIcon className="icon-sm" />
          <span>{err}</span>
        </div>
      )}

      {/* Cards de estatística (cores via data-accent / variáveis do tema) */}
      <div className="stats-grid">
        <StatCard
          title="Usuários Ativos"
          value={loading ? "…" : counts.usuarios}
          accent="info"
          icon={<UsersIcon className="stat-icon-svg" />}
          trend="+5%"
        />
        <StatCard
          title="Pessoas Cadastradas"
          value={loading ? "…" : counts.pessoas}
          accent="success"
          icon={<UserIcon className="stat-icon-svg" />}
          trend="+12%"
        />
        <StatCard
          title="Empresas Ativas"
          value={loading ? "…" : counts.empresas}
          accent="warning"
          icon={<BuildingOfficeIcon className="stat-icon-svg" />}
          trend="+3%"
        />
        <StatCard
          title="Total de Registros"
          value={loading ? "…" : totalRegistros}
          accent="error"
          icon={<CircleStackIcon className="stat-icon-svg" />}
          trend="+8%"
        />
      </div>

      {/* Ações rápidas (ajuste as rotas para seu padrão "flat") */}
      <section className="quick-actions" aria-labelledby="acoes-rapidas">
        <h2 id="acoes-rapidas">Ações Rápidas</h2>
        <div className="actions-grid">
          <Link to="/usuarios" className="action-card" aria-label="Ir para Usuários">
            <PlusIcon className="action-icon-svg" />
            <span>Gerenciar Usuários</span>
          </Link>
          <Link to="/pessoas" className="action-card" aria-label="Ir para Pessoas">
            <PlusIcon className="action-icon-svg" />
            <span>Gerenciar Pessoas</span>
          </Link>
          <Link to="/empresas" className="action-card" aria-label="Ir para Empresas">
            <PlusIcon className="action-icon-svg" />
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