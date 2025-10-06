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
  const [open, setOpen] = useState(false);          // apenas mobile
  const [collapsed, setCollapsed] = useState(false); // apenas desktop

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
      // no desktop, auto-colapsa se estreito
      if (w < 1200 && !isMobile) setCollapsed(true);
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [isMobile]);

  /* ====== Mobile: acessibilidade + push do conteúdo ====== */
  useEffect(() => {
    if (!isMobile) {
      document.body.classList.remove("menu-open");
      return;
    }
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isMobile]);

  useEffect(() => {
    if (!isMobile) return;
    // empurra o conteúdo do app sem sobrepor
    if (open) document.body.classList.add("menu-open");
    else document.body.classList.remove("menu-open");
    // foco inicial no 1º item do menu
    if (open && FIRST.current) FIRST.current.focus();
    return () => document.body.classList.remove("menu-open");
  }, [isMobile, open]);

  const canRender = permsLoaded || isAdm || isDev;

  return (
    <>
      {/* ========= MOBILE ========= */}
      {isMobile && (
        <>
          <header role="banner" aria-label="Barra superior" className="mobile-header">
            <div className="mobile-header__row">
              <button
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                aria-controls="mobile-sidebar"
                aria-label={open ? "Fechar menu" : "Abrir menu"}
                title={open ? "Fechar menu" : "Abrir menu"}
                className="btn-ghost"
              >
                <Bars3Icon className="icon" aria-hidden="true" />
                <span className="btn-text">Menu</span>
              </button>

              <h1 className="brand">Projeto Integrador</h1>
              {/* nada aqui — logout fica por último dentro do menu */}
              <span aria-hidden="true" />
            </div>
          </header>

          {/* Spacer do header para não sobrepor o conteúdo */}
          <div className="mobile-header-spacer" aria-hidden="true" />

          {/* Sidebar Mobile que EMPURRA o conteúdo (body.menu-open -> margin-left) */}
          <aside
            id="mobile-sidebar"
            className={`mobile-sidebar ${open ? "open" : ""}`}
            aria-label="Menu principal"
          >
            {canRender && (
              <nav className="sidebar-nav" aria-label="Navegação principal">
                <MenuGroup title="Geral" expanded>
                  {has(PERM.DASHBOARD_FUNC) && (
                    <MenuItem to="/dashboard_func" label="Meu Painel" icon={<UserIcon />} refProp={!FIRST.current ? FIRST : null} onClick={() => setOpen(false)} />
                  )}
                  {has(PERM.DASHBOARD_ADM) && (
                    <MenuItem to="/dashboard_adm" label="Painel do Administrador" icon={<ShieldCheckIcon />} onClick={() => setOpen(false)} />
                  )}
                </MenuGroup>

                <MenuGroup title="Cadastros" expanded>
                  {has(PERM.PESSOAS) && <MenuItem to="/pessoas" label="Pessoas" icon={<UserIcon />} onClick={() => setOpen(false)} />}
                  {has(PERM.EMPRESAS) && <MenuItem to="/empresas" label="Minha Empresa" icon={<BuildingOfficeIcon />} onClick={() => setOpen(false)} />}
                </MenuGroup>

                <MenuGroup title="Segurança" expanded>
                  {has(PERM.USUARIOS) && <MenuItem to="/usuarios" label="Usuários" icon={<UserGroupIcon />} onClick={() => setOpen(false)} />}
                  {has(PERM.PERFIS_PERMISSOES) && <MenuItem to="/perfis-permissoes" label="Permissões" icon={<KeyIcon />} onClick={() => setOpen(false)} />}
                </MenuGroup>

                <MenuGroup title="Operação" expanded>
                  {has(PERM.ESCALAS) && <MenuItem to="/escalas" label="Escalas" icon={<ClockIcon />} onClick={() => setOpen(false)} />}
                  {has(PERM.APONTAMENTOS) && <MenuItem to="/apontamentos" label="Apontamentos" icon={<ClipboardDocumentListIcon />} onClick={() => setOpen(false)} />}
                  {has(PERM.OCORRENCIAS) && <MenuItem to="/ocorrencias" label="Ocorrências" icon={<ExclamationTriangleIcon />} onClick={() => setOpen(false)} />}
                </MenuGroup>

                <MenuGroup title="Folha" expanded>
                  {has(PERM.CARGOS) && <MenuItem to="/cargos" label="Cargos" icon={<BriefcaseIcon />} onClick={() => setOpen(false)} />}
                  {has(PERM.FUNCIONARIOS) && <MenuItem to="/funcionarios" label="Funcionários x Salários" icon={<UserGroupIcon />} onClick={() => setOpen(false)} />}
                  {has(PERM.FOLHAS) && <MenuItem to="/folhas" label="Folhas" icon={<DocumentChartBarIcon />} onClick={() => setOpen(false)} />}
                  {has(PERM.FOLHAS_FUNC) && <MenuItem to="/folhas-funcionarios" label="Folhas × Funcionários" icon={<UserGroupIcon />} onClick={() => setOpen(false)} />}
                  {has(PERM.FOLHAS_ITENS) && <MenuItem to="/folhas-itens" label="Itens de Folha" icon={<DocumentTextIcon />} onClick={() => setOpen(false)} />}
                </MenuGroup>

                {/* Por último: SAIR */}
                <MenuGroup title="Conta" expanded>
                  <MenuItem
                    label="Sair"
                    icon={<ArrowRightOnRectangleIcon />}
                    onClick={() => { setOpen(false); onLogout?.(); }}
                  />
                </MenuGroup>
              </nav>
            )}
          </aside>
        </>
      )}

      {/* ========= DESKTOP ========= */}
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
                  {has(PERM.DASHBOARD_FUNC) && <MenuItem to="/dashboard_func" label="Meu Painel" icon={<UserIcon />} collapsed={collapsed} />}
                  {has(PERM.DASHBOARD_ADM) && <MenuItem to="/dashboard_adm" label="Painel do Administrador" icon={<ShieldCheckIcon />} collapsed={collapsed} />}
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

          {/* Spacer para o conteúdo não sobrepor no desktop */}
          <div className={`sidebar-spacer ${collapsed ? "collapsed" : ""}`} aria-hidden="true" />
        </>
      )}

      <style jsx>{`
        /* ===== Variáveis úteis ===== */
        :root {
          --sidebar-desktop-w: 260px;
          --sidebar-desktop-w-collapsed: 70px;
          --sidebar-mobile-w: 280px;
          --mobile-header-h: 56px;
        }

        .icon { width: 18px; height: 18px; }

        /* ===== Botões fantasma no padrão global */
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

        .brand { font-size: 16px; font-weight: 800; color: var(--fg); }
        .subtitle { font-size: 12px; color: var(--muted); font-weight: 700; }

        /* ===== MOBILE ===== */
        .mobile-header {
          position: sticky;
          top: 0;
          z-index: 30;
          background: var(--panel);
          border-bottom: 1px solid var(--border);
          padding: 8px 12px;
        }
        .mobile-header__row {
          display: flex; align-items: center; justify-content: space-between; gap: 8px;
        }
        .mobile-header-spacer { height: var(--mobile-header-h); }

        /* Sidebar fixa que empurra body quando aberta */
        .mobile-sidebar {
          position: fixed;
          top: var(--mobile-header-h);
          bottom: 0;
          left: 0;
          width: 0;
          overflow: hidden;
          background: var(--panel);
          border-right: 1px solid transparent;
          transition: width .2s ease, border-color .2s ease;
          z-index: 25;
          box-shadow: none;
        }
        .mobile-sidebar.open {
          width: var(--sidebar-mobile-w);
          border-right: 1px solid var(--border);
          box-shadow: var(--shadow);
        }
        /* Empurra o conteúdo do app inteiro quando menu abre */
        :global(body.menu-open) {
          margin-left: var(--sidebar-mobile-w);
          transition: margin-left .2s ease;
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

        .sidebar-spacer {
          width: var(--sidebar-desktop-w);
          height: 1px;
        }
        .sidebar-spacer.collapsed { width: var(--sidebar-desktop-w-collapsed); }

        .sidebar-header { display: flex; flex-direction: column; gap: 8px; }
        .sidebar-header__row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }

        .sidebar-nav { margin-top: 12px; overflow-y: auto; }
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
        .nav-item-label { font-size: 14px; font-weight: 700; }

        @media (max-width: 900px) {
          .dashboard-sidebar, .sidebar-spacer { display: none; }
        }
      `}</style>
    </>
  );
}

function MenuGroup({ title, children, collapsed = false, expanded = false }) {
  // expanded = true força labels sempre visíveis (mobile funcional)
  return (
    <div className="menu-group">
      {!collapsed && <div className="menu-group-title" aria-hidden="true">{title}</div>}
      <div className="nav-list">
        {Array.isArray(children) ? children.map((c, i) => c && { ...c, key: c?.key ?? i }) : children}
      </div>
    </div>
  );
}

function MenuItem({ to, label, icon, onClick, refProp, collapsed = false }) {
  // Sem TO -> vira botão (ex.: Sair)
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