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
  const [isNarrow, setIsNarrow] = useState(false); // <=360px
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const [perms, setPerms] = useState(() => new Set());
  const [permsLoaded, setPermsLoaded] = useState(false);

  const isDev = !!me?.isSuper || me?.roles?.includes("desenvolvedor");
  const isAdm = isDev || me?.roles?.includes("administrador");
  const has = useCallback((code) => perms.has(code), [perms]);

  const FIRST = useRef(null);

  /* ====== Permissões ====== */
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

  /* ====== Responsivo ====== */
  useEffect(() => {
    const onResize = () => {
      const w = window.innerWidth;
      setIsMobile(w <= 900);
      setIsNarrow(w <= 360);
      if (w < 1200 && !isMobile) {
        setCollapsed(true);
      }
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [isMobile]);

  /* ====== A11y + comportamento de push no mobile ====== */
  useEffect(() => {
    if (isMobile) {
      const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }
  }, [isMobile]);

  // Empurra conteúdo quando o menu mobile está aberto (sem sobrepor)
  useEffect(() => {
    if (!isMobile) {
      document.documentElement.style.removeProperty("--sidebar-mobile-offset");
      return;
    }
    document.documentElement.style.setProperty("--sidebar-mobile-offset", open ? "280px" : "0px");
    return () => document.documentElement.style.removeProperty("--sidebar-mobile-offset");
  }, [isMobile, open]);

  const Section = ({ title, items, forceExpanded = false }) => {
    const visible = useMemo(() => items.some((i) => has(i.perm)), [items, has]);
    if (!visible) return null;
    const isCollapsed = forceExpanded ? false : collapsed;
    return (
      <div className="menu-group">
        {!isCollapsed && (
          <div className="menu-group-title" aria-hidden="true">{title}</div>
        )}
        <div className="menu-group-items">
          {items.map((i) =>
            has(i.perm) ? (
              <MenuItem
                key={i.to || i.key || i.label}
                to={i.to}
                label={i.label}
                icon={i.icon}
                collapsed={isCollapsed}
                onClick={() => setOpen(false)}
                refProp={!FIRST.current ? FIRST : null}
                action={i.action}
              />
            ) : null
          )}
        </div>
      </div>
    );
  };

  const canRender = permsLoaded || isAdm || isDev;

  return (
    <>
      {/* ===== MOBILE ===== */}
      {isMobile && (
        <>
          <header role="banner" aria-label="Barra superior" className="mobile-header">
            <div className="sidebar-header">
              <button
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                aria-controls="mobile-sidebar"
                aria-label={open ? "Fechar menu" : "Abrir menu"}
                title={open ? "Fechar menu" : "Abrir menu"}
                className="mobile-menu-toggle"
              >
                <Bars3Icon className="menu-toggle-icon" />
                {/* Mostrar texto sempre no mobile (mesmo estreito) */}
                <span style={{ marginLeft: 6 }}>Menu</span>
              </button>

              <h1 className="brand">Projeto Integrador</h1>
              {/* Removemos o botão de logout do header no mobile — agora é o último item do menu */}
              <span aria-hidden="true" />
            </div>
          </header>

          {/* Spacer vertical para não sobrepor o conteúdo ao header */}
          <div aria-hidden="true" className="mobile-header-spacer" />

          <div className="mobile-shell">
            {/* Sidebar em fluxo que empurra o conteúdo (largura 0 → 280px) */}
            <aside
              id="mobile-sidebar"
              className={`mobile-sidebar ${open ? "open" : ""}`}
              aria-label="Menu principal"
            >
              {canRender && (
                <nav className="sidebar-nav" aria-label="Navegação principal">
                  <Section
                    title="Geral"
                    forceExpanded
                    items={[
                      { perm: PERM.DASHBOARD_FUNC, to: "/dashboard_func", label: "Meu Painel", icon: <UserIcon /> },
                      { perm: PERM.DASHBOARD_ADM, to: "/dashboard_adm", label: "Painel do Administrador", icon: <ShieldCheckIcon /> },
                    ]}
                  />
                  <Section
                    title="Cadastros"
                    forceExpanded
                    items={[
                      { perm: PERM.PESSOAS, to: "/pessoas", label: "Pessoas", icon: <UserIcon /> },
                      { perm: PERM.EMPRESAS, to: "/empresas", label: "Minha Empresa", icon: <BuildingOfficeIcon /> },
                    ]}
                  />
                  <Section
                    title="Segurança"
                    forceExpanded
                    items={[
                      { perm: PERM.USUARIOS, to: "/usuarios", label: "Usuários", icon: <UserGroupIcon /> },
                      { perm: PERM.PERFIS_PERMISSOES, to: "/perfis-permissoes", label: "Permissões", icon: <KeyIcon /> },
                    ]}
                  />
                  <Section
                    title="Operação"
                    forceExpanded
                    items={[
                      { perm: PERM.ESCALAS, to: "/escalas", label: "Escalas", icon: <ClockIcon /> },
                      { perm: PERM.APONTAMENTOS, to: "/apontamentos", label: "Apontamentos", icon: <ClipboardDocumentListIcon /> },
                      { perm: PERM.OCORRENCIAS, to: "/ocorrencias", label: "Ocorrências", icon: <ExclamationTriangleIcon /> },
                    ]}
                  />
                  <Section
                    title="Folha"
                    forceExpanded
                    items={[
                      { perm: PERM.CARGOS, to: "/cargos", label: "Cargos", icon: <BriefcaseIcon /> },
                      { perm: PERM.FUNCIONARIOS, to: "/funcionarios", label: "Funcionários x Salários", icon: <UserGroupIcon /> },
                      { perm: PERM.FOLHAS, to: "/folhas", label: "Folhas", icon: <DocumentChartBarIcon /> },
                      { perm: PERM.FOLHAS_FUNC, to: "/folhas-funcionarios", label: "Folhas × Funcionários", icon: <UserGroupIcon /> },
                      { perm: PERM.FOLHAS_ITENS, to: "/folhas-itens", label: "Itens de Folha", icon: <DocumentTextIcon /> },
                    ]}
                  />

                  {/* Último item do menu: Sair */}
                  <Section
                    title="Conta"
                    forceExpanded
                    items={[
                      {
                        key: "logout",
                        perm: PERM.DASHBOARD, // qualquer perm real já carrega o menu; aqui só para exibir
                        label: "Sair",
                        icon: <ArrowRightOnRectangleIcon />,
                        action: onLogout,
                      },
                    ]}
                  />
                </nav>
              )}
            </aside>

            {/* Spacer horizontal em fluxo para empurrar o conteúdo quando aberto */}
            <div className={`mobile-sidebar-spacer ${open ? "open" : ""}`} aria-hidden="true" />

            {/* OBS: removido rodapé de versão no menu (economia de espaço) */}
          </div>
        </>
      )}

      {/* ===== DESKTOP ===== */}
      {!isMobile && (
        <>
          <aside 
            id="dashboard-sidebar" 
            className={`dashboard-sidebar ${collapsed ? 'collapsed' : ''}`}
            aria-label="Menu lateral"
          >
            <div className="sidebar-header">
              {!collapsed && <h1 className="brand">Projeto Integrador</h1>}
              <div className="sidebar-header-content">
                {!collapsed && <h2 className="subtitle">Menu</h2>}
                <button
                  onClick={() => setCollapsed(!collapsed)}
                  className="toggle-collapse-btn"
                  aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
                  title={collapsed ? "Expandir menu" : "Recolher menu"}
                >
                  {collapsed ? <ChevronRightIcon className="w-4 h-4" /> : <ChevronLeftIcon className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Removido bloco com nome do usuário/empresa no topo do menu desktop */}
            {/* Também removemos o logout daqui — ele vai como último item do menu */}

            {canRender && (
              <nav className="sidebar-nav" aria-label="Navegação principal">
                <MenuBlock title="Geral" collapsed={collapsed}>
                  {has(PERM.DASHBOARD_FUNC) && <MenuItem to="/dashboard_func" label="Meu Painel" icon={<UserIcon />} collapsed={collapsed} />}
                  {has(PERM.DASHBOARD_ADM) && <MenuItem to="/dashboard_adm" label="Painel do Administrador" icon={<ShieldCheckIcon />} collapsed={collapsed} />}
                </MenuBlock>

                <MenuBlock title="Cadastros" collapsed={collapsed}>
                  {has(PERM.PESSOAS) && <MenuItem to="/pessoas" label="Pessoas" icon={<UserIcon />} collapsed={collapsed} />}
                  {has(PERM.EMPRESAS) && <MenuItem to="/empresas" label="Minha Empresa" icon={<BuildingOfficeIcon />} collapsed={collapsed} />}
                </MenuBlock>

                <MenuBlock title="Segurança" collapsed={collapsed}>
                  {has(PERM.USUARIOS) && <MenuItem to="/usuarios" label="Usuários" icon={<UserGroupIcon />} collapsed={collapsed} />}
                  {has(PERM.PERFIS_PERMISSOES) && <MenuItem to="/perfis-permissoes" label="Permissões" icon={<KeyIcon />} collapsed={collapsed} />}
                </MenuBlock>

                <MenuBlock title="Operação" collapsed={collapsed}>
                  {has(PERM.ESCALAS) && <MenuItem to="/escalas" label="Escalas" icon={<ClockIcon />} collapsed={collapsed} />}
                  {has(PERM.APONTAMENTOS) && <MenuItem to="/apontamentos" label="Apontamentos" icon={<ClipboardDocumentListIcon />} collapsed={collapsed} />}
                  {has(PERM.OCORRENCIAS) && <MenuItem to="/ocorrencias" label="Ocorrências" icon={<ExclamationTriangleIcon />} collapsed={collapsed} />}
                </MenuBlock>

                <MenuBlock title="Folha" collapsed={collapsed}>
                  {has(PERM.CARGOS) && <MenuItem to="/cargos" label="Cargos" icon={<BriefcaseIcon />} collapsed={collapsed} />}
                  {has(PERM.FUNCIONARIOS) && <MenuItem to="/funcionarios" label="Funcionários x Salários" icon={<UserGroupIcon />} collapsed={collapsed} />}
                  {has(PERM.FOLHAS) && <MenuItem to="/folhas" label="Folhas" icon={<DocumentChartBarIcon />} collapsed={collapsed} />}
                  {has(PERM.FOLHAS_FUNC) && <MenuItem to="/folhas-funcionarios" label="Folhas × Funcionários" icon={<UserGroupIcon />} collapsed={collapsed} />}
                  {has(PERM.FOLHAS_ITENS) && <MenuItem to="/folhas-itens" label="Itens de Folha" icon={<DocumentTextIcon />} collapsed={collapsed} />}
                </MenuBlock>

                {/* Último bloco: Sair */}
                <MenuBlock title="Conta" collapsed={collapsed}>
                  <MenuItem
                    label="Sair"
                    icon={<ArrowRightOnRectangleIcon />}
                    collapsed={collapsed}
                    action={onLogout}
                  />
                </MenuBlock>
              </nav>
            )}

            {/* Removido rodapé com versão para economizar espaço */}
          </aside>

          {/* Espaço para o conteúdo não sobrepor (desktop) */}
          <div className={`sidebar-spacer ${collapsed ? 'collapsed' : ''}`} />
        </>
      )}

      <style jsx>{`
        /* ===== Estrutura base ===== */
        .brand { font-size: 16px; font-weight: 700; color: var(--fg); }
        .subtitle { font-size: 12px; color: var(--muted); font-weight: 600; }

        .sidebar-header,
        .sidebar-header-content {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .toggle-collapse-btn,
        .mobile-menu-toggle {
          background: var(--panel-muted);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 8px 10px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .menu-toggle-icon { width: 20px; height: 20px; }

        /* ===== Desktop sidebar ===== */
        .dashboard-sidebar {
          position: fixed;
          left: 0; top: 0; bottom: 0;
          width: 260px;
          background: var(--panel);
          border-right: 1px solid var(--border);
          padding: 12px;
          box-shadow: var(--shadow);
          z-index: 20;
        }
        .dashboard-sidebar.collapsed { width: 70px; }

        .sidebar-spacer {
          width: 260px;
          height: 1px; /* só para ocupar espaço em fluxo */
        }
        .sidebar-spacer.collapsed { width: 70px; }

        .sidebar-nav { margin-top: 12px; }
        .menu-group { margin-bottom: 10px; }
        .menu-group-title {
          color: var(--muted);
          font-weight: 700;
          font-size: 12px;
          letter-spacing: .02em;
          padding: 8px 6px;
        }
        .menu-group-items { display: flex; flex-direction: column; gap: 4px; }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 10px;
          border-radius: 8px;
          color: var(--fg);
          border: 1px solid transparent;
        }
        .nav-item:hover {
          background: var(--panel-muted);
          border-color: var(--border);
        }
        .nav-item.active {
          background: color-mix(in srgb, var(--accent) 12%, transparent);
          border-color: color-mix(in srgb, var(--accent) 35%, var(--border));
        }
        .nav-item.collapsed { justify-content: center; }
        .nav-item-icon { width: 20px; height: 20px; display: inline-flex; }
        .nav-item-label { font-size: 14px; font-weight: 600; }

        /* ===== Mobile header + layout push ===== */
        .mobile-header {
          position: sticky;
          top: 0;
          z-index: 30;
          background: var(--panel);
          border-bottom: 1px solid var(--border);
          padding: 8px 12px;
        }
        .mobile-header-spacer { height: 56px; } /* altura do header fixo */

        .mobile-shell {
          display: flex;
          flex-direction: row;
          width: 100%;
        }

        /* Sidebar mobile empurrando conteúdo */
        .mobile-sidebar {
          width: 0;
          overflow: hidden;
          transition: width .2s ease;
          border-right: 1px solid transparent;
          background: var(--panel);
        }
        .mobile-sidebar.open {
          width: 280px;
          border-right: 1px solid var(--border);
          box-shadow: var(--shadow);
        }

        /* Spacer horizontal que ocupa o mesmo espaço da sidebar */
        .mobile-sidebar-spacer {
          width: 0;
          transition: width .2s ease;
          height: 1px;
        }
        .mobile-sidebar-spacer.open { width: 280px; }

        /* Você também pode usar a var global para empurrar do lado do app:
           :root { --sidebar-mobile-offset: 0; }
           .app-content { margin-left: var(--sidebar-mobile-offset); }
         */

        /* Botão sair uniforme */
        .logout-btn { display: inline-flex; align-items: center; gap: 6px; }
        .logout-icon { width: 20px; height: 20px; }

        @media (max-width: 900px) {
          .dashboard-sidebar, .sidebar-spacer {
            display: none;
          }
        }
      `}</style>
    </>
  );
}

function MenuBlock({ title, children, collapsed }) {
  return (
    <div className="menu-group">
      {!collapsed && (
        <div className="menu-group-title" aria-hidden="true">{title}</div>
      )}
      <div className="menu-group-items">{children}</div>
    </div>
  );
}

function MenuItem({ to, label, icon, onClick, refProp, collapsed, action }) {
  // Se for ação (ex.: logout), renderiza como botão estilizado igual link
  if (!to && typeof action === "function") {
    return (
      <button
        className={`nav-item ${collapsed ? "collapsed" : ""}`}
        onClick={action}
        ref={refProp ?? null}
        type="button"
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
      className={({ isActive }) => `nav-item ${isActive ? "active" : ""} ${collapsed ? "collapsed" : ""}`}
      onClick={onClick}
      end
      ref={refProp ?? null}
      title={collapsed ? label : undefined}
    >
      <span className="nav-item-icon">{icon}</span>
      {!collapsed && <span className="nav-item-label">{label}</span>}
    </NavLink>
  );
}