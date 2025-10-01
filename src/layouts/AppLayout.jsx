import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Menu from "../components/menu.jsx";
import AccessibilityToggles from "../components/AccessibilityToggles";

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");

export default function AppLayout() {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();

  // carrega sessão e decide rota inicial
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/auth/me`, { credentials: "include" });
        const data = await r.json().catch(() => null);

        if (!r.ok || !data?.ok || !data.user) {
          if (alive) {
            setMe(null);
            navigate("/login", { replace: true });
          }
          return;
        }

        if (alive) {
          setMe({ ...data.user, roles: data.roles || [] });
          
          // CORREÇÃO: Se cair em "/", manda para o dashboard apropriado baseado nas roles
          if (location.pathname === "/") {
            const roles = (data.roles || []).map((s) => String(s).toLowerCase());
            const isAdm = roles.includes("administrador") || roles.includes("desenvolvedor");
            const landingPath = isAdm ? "/dashboard_adm" : "/dashboard_func";
            navigate(landingPath, { replace: true });
          }
        }
      } catch {
        if (alive) navigate("/login", { replace: true });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, navigate]);

  async function logout() {
    try {
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } finally {
      setMe(null);
      navigate("/login", { replace: true });
    }
  }

  // enquanto valida sessão, evita flicker de layout
  if (loading) {
    return (
      <div className="dashboard-container">
        <aside className="dashboard-sidebar" aria-hidden="true" />
        <main className="dashboard-main">
          <div style={{ padding: 24, color: "var(--muted)" }}>Carregando…</div>
        </main>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <Menu me={me} onLogout={logout} />

      <main className="dashboard-main">
        {/* Toggles de acessibilidade sempre no topo */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div className="toggles">
            <AccessibilityToggles />
          </div>
        </div>

        <Outlet />
      </main>
    </div>
  );
}
