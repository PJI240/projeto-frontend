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
  const [isNarrow, setIsNarrow] = useState(false); // <=360px
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const [perms, setPerms] = useState(() => new Set());
  const [permsLoaded, setPermsLoaded] = useState(false);

  const isDev = !!me?.isSuper || me?.roles?.includes("desenvolvedor");
  const isAdm = isDev || me?.roles?.includes("administrador");
  const has = useCallback((code) => perms.has(code), [perms]);

  const FIRST = useRef(null);
  const TOPBAR_H = 56;

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

  /* ====== A11y: esc, foco, scroll lock ====== */
  useEffect(() => {
    if (!isMobile) return;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isMobile]);

  useEffect(() => {
    if (!isMobile) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = open ? "hidden" : prev || "";
    if (open && FIRST.current) FIRST.current.focus();
    return () => { document.body.style.overflow = prev; };
  }, [isMobile, open]);

  const Section = ({ title, items }) => {
    const visible = useMemo(() => items.some((i) => has(i.perm)), [items, has]);
    if (!visible) return null;
    return (
      <div className="menu-group">
        {!collapsed && (
          <div className="menu-group-title" aria-hidden="true">{title}</div>
        )}
        <div className="menu-group-items">
          {items.map((i, idx) =>
            has(i.perm) ? (
              <MenuItem
                key={i.to}
                to={i.to}
                label={i.label}
                icon={i.icon}
                collapsed={collapsed}
                onClick={() => setOpen(false)}
                refProp={!FIRST.current ? FIRST : null}
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
      {/* ===== MOBILE: AppBar fixa + Sheet ===== */}
      {isMobile && (
        <>
          <header
            role="banner"
            aria-label="Barra superior"
            className="mobile-header"
          >
            <div className="sidebar-header">
              <button
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                aria-controls="mobile-menu-sheet"
                aria-label={open ? "Fechar menu" : "Abrir menu"}
                title={open ? "Fechar menu" : "Abrir menu"}
                className="mobile-menu-toggle"
              >
                <Bars3Icon className="menu-toggle-icon" />
                {!isNarrow && <span style={{ marginLeft: 6 }}>Menu</span>}
              </button>

              <h1 className="brand">
                Projeto Integrador
              </h1>

              <button
                className="logout-btn"
                onClick={onLogout}
                title="Sair"
                aria-label="Sair do sistema"
              >
                <ArrowRightOnRectangleIcon className="logout-icon" />
              </button>
            </div>
          </header>

          <div aria-hidden="true" className="mobile-header-spacer" />

          {open && (
            <div
              id="mobile-menu-sheet"
              role="dialog"
              aria-modal="true"
              aria-label="Menu principal"
              className="mobile-menu-sheet"
            >
              <div className="user-info" role="group" aria-label="Usuário">
                <div className="user-details">
                  <div className="user-name">{me?.nome || "Usuário"}</div>
                  <div className="user-email">{me?.email}</div>
                  {empresaAtiva && (
                    <div className="empresa-info">
                      Empresa: <strong>{empresaAtiva.nome_fantasia || empresaAtiva.razao_social}</strong>
                    </div>
                  )}
                </div>
              </div>

              {canRender && (
                <nav className="sidebar-nav" aria-label="Navegação principal">
                  <Section
                    title="Geral"
                    items={[
                      { perm: PERM.DASHBOARD_FUNC, to: "/dashboard_func", label: "Meu Painel", icon: <UserIcon /> },
                      { perm: PERM.DASHBOARD_ADM, to: "/dashboard_adm", label: "Painel do Administrador", icon: <ShieldCheckIcon /> },
                    ]}
                  />
                  <Section
                    title="Cadastros"
                    items={[
                      { perm: PERM.PESSOAS, to: "/pessoas", label: "Pessoas", icon: <UserIcon /> },
                      { perm: PERM.EMPRESAS, to: "/empresas", label: "Minha Empresa", icon: <BuildingOfficeIcon /> },
                    ]}
                  />
                  <Section
                    title="Segurança"
                    items={[
                      { perm: PERM.USUARIOS, to: "/usuarios", label: "Usuários", icon: <UserGroupIcon /> },
                      { perm: PERM.PERFIS_PERMISSOES, to: "/perfis-permissoes", label: "Permissões", icon: <KeyIcon /> },
                    ]}
                  />
                  <Section
                    title="Operação"
                    items={[
                      { perm: PERM.ESCALAS, to: "/escalas", label: "Escalas", icon: <ClockIcon /> },
                      { perm: PERM.APONTAMENTOS, to: "/apontamentos", label: "Apontamentos", icon: <ClipboardDocumentListIcon /> },
                      { perm: PERM.OCORRENCIAS, to: "/ocorrencias", label: "Ocorrências", icon: <ExclamationTriangleIcon /> },
                    ]}
                  />
                  <Section
                    title="Folha"
                    items={[
                      { perm: PERM.CARGOS, to: "/cargos", label: "Cargos", icon: <BriefcaseIcon /> },
                      { perm: PERM.FUNCIONARIOS, to: "/funcionarios", label: "Funcionários x Salários", icon: <UserGroupIcon /> },
                      { perm: PERM.FOLHAS, to: "/folhas", label: "Folhas", icon: <DocumentChartBarIcon /> },
                      { perm: PERM.FOLHAS_FUNC, to: "/folhas-funcionarios", label: "Folhas × Funcionários", icon: <UserGroupIcon /> },
                      { perm: PERM.FOLHAS_ITENS, to: "/folhas-itens", label: "Itens de Folha", icon: <DocumentTextIcon /> },
                    ]}
                  />
                </nav>
              )}
            </div>
          )}
        </>
      )}

      {/* ===== DESKTOP: sidebar tradicional ===== */}
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

            <div className="user-info" role="group" aria-label="Usuário">
              {!collapsed && (
                <div className="user-details">
                  <div className="user-name">{me?.nome || "Usuário"}</div>
                  <div className="user-email">{me?.email}</div>
                  {empresaAtiva && (
                    <div className="empresa-info">
                      Empresa: <strong>{empresaAtiva.nome_fantasia || empresaAtiva.razao_social}</strong>
                    </div>
                  )}
                </div>
              )}
              <button 
                className="logout-btn" 
                onClick={onLogout} 
                title="Sair" 
                aria-label="Sair do sistema"
              >
                <ArrowRightOnRectangleIcon className="logout-icon" />
              </button>
            </div>

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
              </nav>
            )}

            {!collapsed && (
              <div className="sidebar-footer">
                <small>v1.0 • Acessível</small>
              </div>
            )}
          </aside>

          {/* Espaço para o conteúdo não sobrepor */}
          <div className={`sidebar-spacer ${collapsed ? 'collapsed' : ''}`} />
        </>
      )}
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

function MenuItem({ to, label, icon, onClick, refProp, collapsed }) {
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