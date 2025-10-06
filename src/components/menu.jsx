// src/components/menu.jsx
import { NavLink } from "react-router-dom";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Bars3Icon,
  UserGroupIcon,
  UserIcon,
  BuildingOfficeIcon,
  ShieldCheckIcon,
  KeyIcon,
  BriefcaseIcon,
  ClockIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  DocumentChartBarIcon,
  ClipboardDocumentListIcon,
  ArrowRightOnRectangleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";

const API_BASE = import.meta.env.VITE_API_BASE?.replace(/\/+$/, "") || "";

const PERM = {
  DASHBOARD: "menu.dashboard.ver",
  DASHBOARD_FUNC: "menu.dashboard_func.ver",
  DASHBOARD_ADM: "menu.dashboard_adm.ver",
  EMPRESAS: "menu.empresas.ver",
  PESSOAS: "menu.pessoas.ver",
  USUARIOS: "menu.usuarios.ver",
  PERFIS_PERMISSOES: "menu.perfis-permissoes.ver",
  ESCALAS: "menu.escalas.ver",
  APONTAMENTOS: "menu.apontamentos.ver",
  OCORRENCIAS: "menu.ocorrencias.ver",
  CARGOS: "menu.cargos.ver",
  FUNCIONARIOS: "menu.funcionarios.ver",
  FOLHAS: "menu.folhas.ver",
  FOLHAS_FUNC: "menu.folhas-funcionarios.ver",
  FOLHAS_ITENS: "menu.folhas-itens.ver",
  DEV_INSPECAO: "menu.dev-inspecao.ver",
  DEV_AUDITORIA: "menu.dev-auditoria.ver",
  DEV_CONFIG: "menu.dev-config.ver",
};

export default function Menu({ me, onLogout, empresaAtiva }) {
  const [isMobile, setIsMobile] = useState(false);
  const [collapsed, setCollapsed] = useState(false); // desktop
  const [openMobile, setOpenMobile] = useState(false); // mobile full-screen

  const [perms, setPerms] = useState(() => new Set());
  const [permsLoaded, setPermsLoaded] = useState(false);

  const isDev = !!me?.isSuper || me?.roles?.includes("desenvolvedor");
  const isAdm = isDev || me?.roles?.includes("administrador");
  const has = useCallback((code) => perms.has(code), [perms]);

  const FIRST = useRef(null);

  /* ===== Permissões ===== */
  useEffect(() => {
    let alive = true;
    async function fetchPerms() {
      if (isDev || isAdm) {
        if (alive) {
          setPerms(new Set(Object.values(PERM)));
          setPermsLoaded(true);
        }
        return;
      }
      try {
        const req = async (url) => {
          const r = await fetch(url, { credentials: "include" });
          if (!r.ok) throw new Error(String(r.status));
          const js = await r.json().catch(() => ({}));
          return Array.isArray(js?.codes) ? js.codes : [];
        };
        let codes;
        try { codes = await req(`${API_BASE}/api/permissoes_menu/minhas`); }
        catch { codes = await req(`${API_BASE}/api/permissoes/minhas`); }
        if (alive) { setPerms(new Set(codes)); setPermsLoaded(true); }
      } catch {
        if (alive) { setPerms(new Set([PERM.DASHBOARD, PERM.EMPRESAS])); setPermsLoaded(true); }
      }
    }
    fetchPerms();
    return () => { alive = false; };
  }, [isDev, isAdm]);

  /* ===== Responsivo ===== */
  useEffect(() => {
    const onResize = () => {
      const w = window.innerWidth;
      setIsMobile(w <= 900);
      if (w < 1200 && !isMobile) setCollapsed(true);
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [isMobile]);

  /* ===== Mobile: a11y e scroll lock enquanto o menu ocupa a tela ===== */
  useEffect(() => {
    if (!isMobile) return;
    const onKey = (e) => { if (e.key === "Escape") setOpenMobile(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isMobile]);

  useEffect(() => {
    if (!isMobile) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = openMobile ? "hidden" : prev || "";
    if (openMobile && FIRST.current) FIRST.current.focus();
    return () => { document.body.style.overflow = prev; };
  }, [isMobile, openMobile]);

  const canRender = permsLoaded || isAdm || isDev;

  return (
    <>
      {/* ===== MOBILE: Header fixo e menu em tela cheia ===== */}
      {isMobile && (
        <>
          <header className="mobile-header" role="banner" aria-label="Barra superior">
            <div className="mobile-header__row">
              <button
                className="btn-ghost"
                onClick={() => setOpenMobile((v) => !v)}
                aria-expanded={openMobile}
                aria-controls="mobile-menu"
                aria-label={openMobile ? "Fechar menu" : "Abrir menu"}
                title={openMobile ? "Fechar menu" : "Abrir menu"}
              >
                <Bars3Icon className="icon" aria-hidden="true" />
                <span className="btn-text">Menu</span>
              </button>
              <h1 className="brand">Projeto Integrador</h1>
              <span aria-hidden="true" />
            </div>
          </header>
          {/* Spacer do header para não sobrepor conteúdo */}
          <div className="mobile-header-spacer" aria-hidden="true" />

          {/* Menu MOBILE em tela cheia (abaixo do header) */}
          {openMobile && (
            <div
              id="mobile-menu"
              role="dialog"
              aria-modal="true"
              aria-label="Menu principal"
              className="mobile-menu-fullscreen"
            >
              {canRender && (
                <nav className="sidebar-nav" aria-label="Navegação principal">
                  <MenuGroup title="Geral" expanded>
                    {has(PERM.DASHBOARD_FUNC) && (
                      <MenuItem
                        to="/dashboard_func"
                        label="Meu Painel"
                        icon={<UserIcon />}
                        refProp={!FIRST.current ? FIRST : null}
                        onClick={() => setOpenMobile(false)}
                      />
                    )}
                    {has(PERM.DASHBOARD_ADM) && (
                      <MenuItem
                        to="/dashboard_adm"
                        label="Painel do Administrador"
                        icon={<ShieldCheckIcon />}
                        onClick={() => setOpenMobile(false)}
                      />
                    )}
                  </MenuGroup>

                  <MenuGroup title="Cadastros" expanded>
                    {has(PERM.PESSOAS) && (
                      <MenuItem to="/pessoas" label="Pessoas" icon={<UserIcon />} onClick={() => setOpenMobile(false)} />
                    )}
                    {has(PERM.EMPRESAS) && (
                      <MenuItem to="/empresas" label="Minha Empresa" icon={<BuildingOfficeIcon />} onClick={() => setOpenMobile(false)} />
                    )}
                  </MenuGroup>

                  <MenuGroup title="Segurança" expanded>
                    {has(PERM.USUARIOS) && (
                      <MenuItem to="/usuarios" label="Usuários" icon={<UserGroupIcon />} onClick={() => setOpenMobile(false)} />
                    )}
                    {has(PERM.PERFIS_PERMISSOES) && (
                      <MenuItem to="/perfis-permissoes" label="Permissões" icon={<KeyIcon />} onClick={() => setOpenMobile(false)} />
                    )}
                  </MenuGroup>

                  <MenuGroup title="Operação" expanded>
                    {has(PERM.ESCALAS) && (
                      <MenuItem to="/escalas" label="Escalas" icon={<ClockIcon />} onClick={() => setOpenMobile(false)} />
                    )}
                    {has(PERM.APONTAMENTOS) && (
                      <MenuItem to="/apontamentos" label="Apontamentos" icon={<ClipboardDocumentListIcon />} onClick={() => setOpenMobile(false)} />
                    )}
                    {has(PERM.OCORRENCIAS) && (
                      <MenuItem to="/ocorrencias" label="Ocorrências" icon={<ExclamationTriangleIcon />} onClick={() => setOpenMobile(false)} />
                    )}
                  </MenuGroup>

                  <MenuGroup title="Folha" expanded>
                    {has(PERM.CARGOS) && (
                      <MenuItem to="/cargos" label="Cargos" icon={<BriefcaseIcon />} onClick={() => setOpenMobile(false)} />
                    )}
                    {has(PERM.FUNCIONARIOS) && (
                      <MenuItem to="/funcionarios" label="Funcionários x Salários" icon={<UserGroupIcon />} onClick={() => setOpenMobile(false)} />
                    )}
                    {has(PERM.FOLHAS) && (
                      <MenuItem to="/folhas" label="Folhas" icon={<DocumentChartBarIcon />} onClick={() => setOpenMobile(false)} />
                    )}
                    {has(PERM.FOLHAS_FUNC) && (
                      <MenuItem to="/folhas-funcionarios" label="Folhas × Funcionários" icon={<UserGroupIcon />} onClick={() => setOpenMobile(false)} />
                    )}
                    {has(PERM.FOLHAS_ITENS) && (
                      <MenuItem to="/folhas-itens" label="Itens de Folha" icon={<DocumentTextIcon />} onClick={() => setOpenMobile(false)} />
                    )}
                  </MenuGroup>

                  {/* Último item: Sair */}
                  <MenuGroup title="Conta" expanded>
                    <MenuItem
                      label="Sair"
                      icon={<ArrowRightOnRectangleIcon />}
                      onClick={() => { setOpenMobile(false); onLogout?.(); }}
                    />
                  </MenuGroup>
                </nav>
              )}
            </div>
          )}
        </>
      )}

      {/* ===== DESKTOP: Sidebar colapsável ===== */}
      {!isMobile && (
        <>
          <aside
            id="dashboard-sidebar"
            className={`dashboard-sidebar ${collapsed ? "collapsed" : ""}`}
            aria-label="Menu lateral"
          >
            <div className="sidebar-header">
              {!collapsed && <h1 className="brand">Projeto Integrador</h1>}
              <div className="sidebar-header__row">
                {!collapsed && <h2 className="subtitle">Menu</h2>}
                <button
                  onClick={() => setCollapsed(!collapsed)}
                  className="btn-ghost"
                  aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
                  title={collapsed ? "Expandir menu" : "Recolher menu"}
                >
                  {collapsed ? <ChevronRightIcon className="icon" /> : <ChevronLeftIcon className="icon" />}
                </button>
              </div>
            </div>

            {canRender && (
              <nav className="sidebar-nav" aria-label="Navegação principal">
                <MenuGroup title="Geral" collapsed={collapsed}>
                  {has(PERM.DASHBOARD_FUNC) && (
                    <MenuItem to="/dashboard_func" label="Meu Painel" icon={<UserIcon />} collapsed={collapsed} />
                  )}
                  {has(PERM.DASHBOARD_ADM) && (
                    <MenuItem to="/dashboard_adm" label="Painel do Administrador" icon={<ShieldCheckIcon />} collapsed={collapsed} />
                  )}
                </MenuGroup>

                <MenuGroup title="Cadastros" collapsed={collapsed}>
                  {has(PERM.PESSOAS) && <MenuItem to="/pessoas" label="Pessoas" icon={<UserIcon />} collapsed={collapsed} />}
                  {has(PERM.EMPRESAS) && <MenuItem to="/empresas" label="Minha Empresa" icon={<BuildingOfficeIcon />} collapsed={collapsed} />}
                </MenuGroup>

                <MenuGroup title="Segurança" collapsed={collapsed}>
                  {has(PERM.USUARIOS) && <MenuItem to="/usuarios" label="Usuários" icon={<UserGroupIcon />} collapsed={collapsed} />}
                  {has(PERM.PERFIS_PERMISSOES) && <MenuItem to="/perfis-permissoes" label="Permissões" icon={<KeyIcon />} collapsed={collapsed} />}
                </MenuGroup>

                <MenuGroup title="Operação" collapsed={collapsed}>
                  {has(PERM.ESCALAS) && <MenuItem to="/escalas" label="Escalas" icon={<ClockIcon />} collapsed={collapsed} />}
                  {has(PERM.APONTAMENTOS) && <MenuItem to="/apontamentos" label="Apontamentos" icon={<ClipboardDocumentListIcon />} collapsed={collapsed} />}
                  {has(PERM.OCORRENCIAS) && <MenuItem to="/ocorrencias" label="Ocorrências" icon={<ExclamationTriangleIcon />} collapsed={collapsed} />}
                </MenuGroup>

                <MenuGroup title="Folha" collapsed={collapsed}>
                  {has(PERM.CARGOS) && <MenuItem to="/cargos" label="Cargos" icon={<BriefcaseIcon />} collapsed={collapsed} />}
                  {has(PERM.FUNCIONARIOS) && <MenuItem to="/funcionarios" label="Funcionários x Salários" icon={<UserGroupIcon />} collapsed={collapsed} />}
                  {has(PERM.FOLHAS) && <MenuItem to="/folhas" label="Folhas" icon={<DocumentChartBarIcon />} collapsed={collapsed} />}
                  {has(PERM.FOLHAS_FUNC) && <MenuItem to="/folhas-funcionarios" label="Folhas × Funcionários" icon={<UserGroupIcon />} collapsed={collapsed} />}
                  {has(PERM.FOLHAS_ITENS) && <MenuItem to="/folhas-itens" label="Itens de Folha" icon={<DocumentTextIcon />} collapsed={collapsed} />}
                </MenuGroup>

                {/* Último bloco: SAIR */}
                <MenuGroup title="Conta" collapsed={collapsed}>
                  <MenuItem
                    label="Sair"
                    icon={<ArrowRightOnRectangleIcon />}
                    collapsed={collapsed}
                    onClick={onLogout}
                  />
                </MenuGroup>
              </nav>
            )}
          </aside>

          {/* Spacer para o conteúdo não sobrepor a sidebar no desktop */}
          <div className={`sidebar-spacer ${collapsed ? "collapsed" : ""}`} aria-hidden="true" />
        </>
      )}

      <style jsx>{`
        :root{
          --sidebar-desktop-w: 260px;
          --sidebar-desktop-w-collapsed: 70px;
          --mobile-header-h: 56px;
        }

        .icon { width: 18px; height: 18px; }
        .brand { font-size: 16px; font-weight: 800; color: var(--fg); }
        .subtitle { font-size: 12px; color: var(--muted); font-weight: 700; }

        .btn-ghost {
          display: inline-flex;
          gap: 8px;
          align-items: center;
          background: var(--panel-muted);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 8px 10px;
          font-weight: 600;
        }
        .btn-text { font-size: 14px; }

        /* ===== MOBILE ===== */
        .mobile-header {
          position: sticky;
          top: 0;
          z-index: 40;
          background: var(--panel);
          border-bottom: 1px solid var(--border);
          padding: 8px 12px;
        }
        .mobile-header__row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .mobile-header-spacer { height: var(--mobile-header-h); }

        .mobile-menu-fullscreen {
          position: fixed;
          top: var(--mobile-header-h);
          left: 0; right: 0; bottom: 0;
          background: var(--panel);
          z-index: 35;
          border-top: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          padding: 12px;
          overflow-y: auto;
        }

        /* ===== DESKTOP ===== */
        .dashboard-sidebar {
          position: fixed;
          left: 0; top: 0; bottom: 0;
          width: var(--sidebar-desktop-w);
          background: var(--panel);
          border-right: 1px solid var(--border);
          padding: 12px;
          box-shadow: var(--shadow);
          z-index: 20;
          display: flex;
          flex-direction: column;
        }
        .dashboard-sidebar.collapsed { width: var(--sidebar-desktop-w-collapsed); }
        .sidebar-spacer { width: var(--sidebar-desktop-w); height: 1px; }
        .sidebar-spacer.collapsed { width: var(--sidebar-desktop-w-collapsed); }

        .sidebar-header { display: flex; flex-direction: column; gap: 8px; }
        .sidebar-header__row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }

        .sidebar-nav { margin-top: 12px; }
        .menu-group { margin-bottom: 12px; }
        .menu-group-title {
          color: var(--muted);
          font-weight: 800;
          font-size: 11px;
          letter-spacing: .04em;
          padding: 8px 6px;
          text-transform: uppercase;
        }

        .nav-list { display: flex; flex-direction: column; gap: 4px; }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 10px;
          border-radius: 8px;
          color: var(--fg);
          border: 1px solid transparent;
          background: transparent;
          text-align: left;
        }
        .nav-item:hover { background: var(--panel-muted); border-color: var(--border); }
        .nav-item.active {
          background: color-mix(in srgb, var(--accent) 12%, transparent);
          border-color: color-mix(in srgb, var(--accent) 35%, var(--border));
        }
        .nav-item.collapsed { justify-content: center; }
        .nav-item-icon { width: 20px; height: 20px; display: inline-flex; }
        .nav-item-label { font-size: 14px; font-weight: 700; }

        @media (max-width: 900px) {
          .dashboard-sidebar, .sidebar-spacer { display: none; }
        }
      `}</style>
    </>
  );
}

function MenuGroup({ title, children, collapsed = false, expanded = false }) {
  return (
    <div className="menu-group">
      {!collapsed && <div className="menu-group-title" aria-hidden="true">{title}</div>}
      <div className="nav-list">{children}</div>
    </div>
  );
}

function MenuItem({ to, label, icon, onClick, refProp, collapsed = false }) {
  if (!to) {
    return (
      <button
        type="button"
        className={`nav-item ${collapsed ? "collapsed" : ""}`}
        onClick={onClick}
        ref={refProp ?? null}
        title={collapsed ? label : undefined}
      >
        <span className="nav-item-icon">{icon}</span>
        {!collapsed && <span className="nav-item-label">{label}</span>}
      </button>
    );
  }
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        `nav-item ${isActive ? "active" : ""} ${collapsed ? "collapsed" : ""}`
      }
      onClick={onClick}
      ref={refProp ?? null}
      title={collapsed ? label : undefined}
    >
      <span className="nav-item-icon">{icon}</span>
      {!collapsed && <span className="nav-item-label">{label}</span>}
    </NavLink>
  );
}