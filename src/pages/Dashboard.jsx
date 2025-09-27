import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import AccessibilityToggles from "../components/AccessibilityToggles";

const API_BASE = import.meta.env.VITE_API_BASE?.replace(/\/+$/, "") || "";

export default function Dashboard() {
  const [counts, setCounts] = useState({ usuarios: 0, pessoas: 0, empresas: 0 });
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const navigate = useNavigate();

  const fetchJson = useCallback(async (url, init) => {
    const r = await fetch(url, { credentials: "include", ...init });
    let data;
    try { 
      data = await r.json(); 
    } catch { 
      data = null; 
    }
    if (!r.ok) {
      throw new Error(data?.error || `HTTP ${r.status}`);
    }
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
      await fetch(`${API_BASE}/api/auth/logout`, { 
        method: "POST", 
        credentials: "include" 
      });
    } finally {
      navigate("/login");
    }
  };

  return (
    <div className="dashboard-container">
      {/* Sidebar */}
      <aside className="dashboard-sidebar">
        <div className="sidebar-header">
          <h1 className="brand">Projeto Integrador</h1>
          <h2 className="subtitle">Dashboard</h2>
        </div>

        <div className="user-info">
          {me ? (
            <>
              <div className="user-avatar">
                <span>{me.nome.charAt(0).toUpperCase()}</span>
              </div>
              <div className="user-details">
                <div className="user-name">{me.nome}</div>
                <div className="user-email">{me.email}</div>
              </div>
              <button className="logout-btn" onClick={logout} title="Sair">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
                </svg>
              </button>
            </>
          ) : (
            <div className="user-loading">Carregando...</div>
          )}
        </div>

        <nav className="sidebar-nav">
          <Link to="/dashboard" className="nav-item active">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>
            </svg>
            <span>Visão Geral</span>
          </Link>
          <Link to="/cadastros/usuarios" className="nav-item">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>
            <span>Usuários</span>
          </Link>
          <Link to="/cadastros/pessoas" className="nav-item">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
            </svg>
            <span>Pessoas</span>
          </Link>
          <Link to="/cadastros/empresas" className="nav-item">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/>
            </svg>
            <span>Empresas</span>
          </Link>
        </nav>

        <div className="sidebar-footer">
          <AccessibilityToggles />
        </div>
      </aside>

      {/* Main Content */}
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
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
            </svg>
            {loading ? "Atualizando..." : "Atualizar"}
          </button>
        </header>

        {err && (
          <div className="error-alert">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
            {err}
          </div>
        )}

        <div className="stats-grid">
          <StatCard
            title="Usuários Ativos"
            value={loading ? "..." : counts.usuarios}
            icon="👥"
            trend="+5%"
            color="#3B82F6"
          />
          <StatCard
            title="Pessoas Cadastradas"
            value={loading ? "..." : counts.pessoas}
            icon="👤"
            trend="+12%"
            color="#10B981"
          />
          <StatCard
            title="Empresas Ativas"
            value={loading ? "..." : counts.empresas}
            icon="🏢"
            trend="+3%"
            color="#F59E0B"
          />
          <StatCard
            title="Total de Registros"
            value={loading ? "..." : counts.usuarios + counts.pessoas + counts.empresas}
            icon="📊"
            trend="+8%"
            color="#8B5CF6"
          />
        </div>

        <section className="quick-actions">
          <h2>Ações Rápidas</h2>
          <div className="actions-grid">
            <button className="action-card">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
              </svg>
              <span>Novo Usuário</span>
            </button>
            <button className="action-card">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
              </svg>
              <span>Nova Pessoa</span>
            </button>
            <button className="action-card">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
              </svg>
              <span>Nova Empresa</span>
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

function StatCard({ title, value, icon, trend, color }) {
  return (
    <div className="stat-card" style={{ borderLeftColor: color }}>
      <div className="stat-header">
        <div className="stat-icon">{icon}</div>
        <span className="stat-trend">{trend}</span>
      </div>
      <div className="stat-content">
        <div className="stat-value">{value}</div>
        <div className="stat-title">{title}</div>
      </div>
    </div>
  );
}
