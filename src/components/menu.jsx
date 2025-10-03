// src/components/menu.jsx
import { NavLink } from "react-router-dom";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Bars3Icon,
  XMarkIcon,
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
  CogIcon,
  MagnifyingGlassIcon,
  ClipboardDocumentListIcon,
  ArrowRightOnRectangleIcon,
} from "@heroicons/react/24/outline";

const API_BASE = import.meta.env.VITE_API_BASE?.replace(/\/+$/, "") || "";

const PERM = {
  DASHBOARD:           "menu.dashboard.ver",
  DASHBOARD_FUNC:      "menu.dashboard_func.ver",
  DASHBOARD_ADM:       "menu.dashboard_adm.ver",
  EMPRESAS:            "menu.empresas.ver",
  PESSOAS:             "menu.pessoas.ver",
  USUARIOS:            "menu.usuarios.ver",
  PERFIS_PERMISSOES:   "menu.perfis-permissoes.ver",
  ESCALAS:             "menu.escalas.ver",
  APONTAMENTOS:        "menu.apontamentos.ver",
  OCORRENCIAS:         "menu.ocorrencias.ver",
  CARGOS:              "menu.cargos.ver",
  FUNCIONARIOS:        "menu.funcionarios.ver",
  FOLHAS:              "menu.folhas.ver",
  FOLHAS_FUNC:         "menu.folhas-funcionarios.ver",
  FOLHAS_ITENS:        "menu.folhas-itens.ver",
  DEV_INSPECAO:        "menu.dev-inspecao.ver",
  DEV_AUDITORIA:       "menu.dev-auditoria.ver",
  DEV_CONFIG:          "menu.dev-config.ver",
};

export default function Menu({ me, onLogout, empresaAtiva }) {
  const [isMobile, setIsMobile] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [perms, setPerms] = useState(() => new Set());
  const [permsLoaded, setPermsLoaded] = useState(false);

  const isDev = !!me?.isSuper || me?.roles?.includes("desenvolvedor");
  const isAdm = isDev || me?.roles?.includes("administrador");
  const has = useCallback((code) => perms.has(code), [perms]);

  const firstLinkRef = useRef(null);
  const TOPBAR_H = 56; // altura fixa da topbar mobile

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
        const tryFetch = async (url) => {
          const r = await fetch(url, { credentials: "include" });
          if (!r.ok) throw new Error(String(r.status));
          const data = await r.json().catch(() => ({}));
          return Array.isArray(data?.codes) ? data.codes : [];
        };
        let codes;
        try {
          codes = await tryFetch(`${API_BASE}/api/permissoes_menu/minhas`);
        } catch {
          codes = await tryFetch(`${API_BASE}/api/permissoes/minhas`);
        }
        if (alive) {
          setPerms(new Set(codes));
          setPermsLoaded(true);
        }
      } catch {
        if (alive) {
          setPerms(new Set([PERM.DASHBOARD, PERM.EMPRESAS]));
          setPermsLoaded(true);
        }
      }
    }
    fetchPerms();
    return () => { alive = false; };
  }, [isDev, isAdm]);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 900);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!isMobile) return;
    const onPop = () => setIsMenuOpen(false);
    const onKey = (e) => { if (e.key === "Escape") setIsMenuOpen(false); };
    window.addEventListener("popstate", onPop);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("keydown", onKey);
    };
  }, [isMobile]);

  useEffect(() => {
    if (!isMobile) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = isMenuOpen ? "hidden" : prev || "";
    return () => { document.body.style.overflow = prev; };
  }, [isMobile, isMenuOpen]);

  useEffect(() => {
    if (isMobile && isMenuOpen && firstLinkRef.current) firstLinkRef.current.focus();
  }, [isMobile, isMenuOpen]);

  const toggleMenu = () => setIsMenuOpen((v) => !v);
  const closeMenu = () => setIsMenuOpen(false);

  const Section = ({ title, items }) => {
    const anyVisible = useMemo(() => items.some((i) => has(i.perm)), [items, has]);
    if (!anyVisible) return null;
    return (
      <div className="menu-group">
        <div className="menu-group-title" aria-hidden="true">{title}</div>
        <div className="menu-group-items">
          {items.map((i, idx) =>
            has(i.perm) ? (
              <MenuItem
                key={i.to}
                to={i.to}
                label={i.label}
                icon={i.icon}
                onClick={closeMenu}
                refProp={(!firstLinkRef.current && idx === 0) ? firstLinkRef : null}
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
      {/* ===== MOBILE: topbar fixa 100% ===== */}
      {isMobile && (
        <>
          <header
            role="banner"
            aria-label="Barra superior"
            style={{
              position: "fixed",
              top: 0, left: 0, right: 0,
              zIndex: 60,
              background: "var(--bg)",
              borderBottom: "1px solid var(--border)",
              height: `${TOPBAR_H}px`,
            }}
          >
            <div
              className="sidebar-header"
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "8px 12px",
                height: "100%",
              }}
            >
              <button
                className="menu-toggle"
                onClick={toggleMenu}
                aria-expanded={isMenuOpen}
                aria-controls="dashboard-mobile-panel"
                aria-label={isMenuOpen ? "Fechar menu" : "Abrir menu"}
                title={isMenuOpen ? "Fechar menu" : "Abrir menu"}
                style={{ display: "inline-flex", alignItems: "center" }}
              >
                <Bars3Icon className="menu-toggle-icon" />
                <span style={{ marginLeft: 6 }}>Menu</span>
              </button>

              <div style={{ flex: 1, minWidth: 0 }}>
                <h1 className="brand" style={{ margin: 0, lineHeight: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  Projeto Integrador
                </h1>
                {/* REMOVIDO subtítulo no mobile para não “empurrar” o layout */}
              </div>

              <button
                className="logout-btn"
                onClick={onLogout}
                title="Sair"
                aria-label="Sair do sistema"
              >
                <ArrowRightOnRectangleIcon className="logout-icon" />
              </button>
            </div>

            {/* Painel drop-down, full-width, abaixo da topbar */}
            <div
              id="dashboard-mobile-panel"
              role="region"
              aria-label="Menu principal"
              hidden={!isMenuOpen}
              style={{
                display: isMenuOpen ? "block" : "none",
                maxHeight: `calc(100dvh - ${TOPBAR_H}px)`,
                overflowY: "auto",
                borderTop: "1px solid var(--panel-muted)",
                background: "var(--panel)",
              }}
            >
              <div className="user-info" role="group" aria-label="Usuário" style={{ padding: "10px 12px" }}>
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
                <nav className="sidebar-nav" aria-label="Navegação principal" style={{ paddingBottom: 8 }}>
                  <Section
                    title="Geral"
                    items={[
                      { perm: PERM.DASHBOARD_FUNC,  to: "/dashboard_func",   label: "Meu Painel",              icon: <UserIcon /> },
                      { perm: PERM.DASHBOARD_ADM,   to: "/dashboard_adm",    label: "Painel do Administrador", icon: <ShieldCheckIcon /> },
                    ]}
                  />
                  <Section
                    title="Cadastros"
                    items={[
                      { perm: PERM.PESSOAS,  to: "/pessoas",  label: "Pessoas",       icon: <UserIcon /> },
                      { perm: PERM.EMPRESAS, to: "/empresas", label: "Minha Empresa", icon: <BuildingOfficeIcon /> },
                    ]}
                  />
                  <Section
                    title="Segurança"
                    items={[
                      { perm: PERM.USUARIOS,          to: "/usuarios",          label: "Usuários",    icon: <UserGroupIcon /> },
                      { perm: PERM.PERFIS_PERMISSOES, to: "/perfis-permissoes", label: "Permissões",  icon: <KeyIcon /> },
                    ]}
                  />
                  <Section
                    title="Operação"
                    items={[
                      { perm: PERM.ESCALAS,      to: "/escalas",      label: "Escalas",       icon: <ClockIcon /> },
                      { perm: PERM.APONTAMENTOS, to: "/apontamentos", label: "Apontamentos",  icon: <ClipboardDocumentListIcon /> },
                      { perm: PERM.OCORRENCIAS,  to: "/ocorrencias",  label: "Ocorrências",   icon: <ExclamationTriangleIcon /> },
                    ]}
                  />
                  <Section
                    title="Folha"
                    items={[
                      { perm: PERM.CARGOS,        to: "/cargos",               label: "Cargos",                  icon: <BriefcaseIcon /> },
                      { perm: PERM.FUNCIONARIOS,  to: "/funcionarios",         label: "Funcionários x Salários", icon: <UserGroupIcon /> },
                      { perm: PERM.FOLHAS,        to: "/folhas",               label: "Folhas",                  icon: <DocumentChartBarIcon /> },
                      { perm: PERM.FOLHAS_FUNC,   to: "/folhas-funcionarios",  label: "Folhas × Funcionários",   icon: <UserGroupIcon /> },
                      { perm: PERM.FOLHAS_ITENS,  to: "/folhas-itens",         label: "Itens de Folha",          icon: <DocumentTextIcon /> },
                    ]}
                  />
                  <Section
                    title="Dev"
                    items={[
                      { perm: PERM.DEV_INSPECAO,  to: "/dev-inspecao",  label: "Inspeção / SQL", icon: <MagnifyingGlassIcon /> },
                      { perm: PERM.DEV_AUDITORIA, to: "/dev-auditoria", label: "Auditoria",      icon: <ClipboardDocumentListIcon /> },
                      { perm: PERM.DEV_CONFIG,    to: "/dev-config",    label: "Configurações",  icon: <CogIcon /> },
                    ]}
                  />
                </nav>
              )}
            </div>
          </header>

          {/* Spacer para o conteúdo NÃO ficar por baixo do header */}
          <div aria-hidden="true" style={{ height: `${TOPBAR_H}px` }} />
        </>
      )}

      {/* Backdrop ajustado para iniciar abaixo do header */}
      {isMobile && isMenuOpen && (
        <div
          className="sidebar-backdrop show"
          onClick={closeMenu}
          aria-hidden="true"
          style={{ top: `${TOPBAR_H}px` }}
        />
      )}

      {/* ===== DESKTOP (sidebar padrão) ===== */}
      {!isMobile && (
        <aside id="dashboard-sidebar" className="dashboard-sidebar" aria-label="Menu lateral">
          <div className="sidebar-header">
            <h1 className="brand">Projeto Integrador</h1>
            <h2 className="subtitle">Menu</h2>
          </div>

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
            <button className="logout-btn" onClick={onLogout} title="Sair" aria-label="Sair do sistema">
              <ArrowRightOnRectangleIcon className="logout-icon" />
            </button>
          </div>

          {(permsLoaded || isAdm || isDev) && (
            <nav className="sidebar-nav" aria-label="Navegação principal">
              <div className="menu-group">
                <div className="menu-group-title" aria-hidden="true">Geral</div>
                <div className="menu-group-items">
                  {has(PERM.DASHBOARD_FUNC) && (
                    <MenuItem to="/dashboard_func" label="Meu Painel" icon={<UserIcon />} />
                  )}
                  {has(PERM.DASHBOARD_ADM) && (
                    <MenuItem to="/dashboard_adm" label="Painel do Administrador" icon={<ShieldCheckIcon />} />
                  )}
                </div>
              </div>

              <div className="menu-group">
                <div className="menu-group-title" aria-hidden="true">Cadastros</div>
                <div className="menu-group-items">
                  {has(PERM.PESSOAS) && (<MenuItem to="/pessoas" label="Pessoas" icon={<UserIcon />} />)}
                  {has(PERM.EMPRESAS) && (<MenuItem to="/empresas" label="Minha Empresa" icon={<BuildingOfficeIcon />} />)}
                </div>
              </div>

              <div className="menu-group">
                <div className="menu-group-title" aria-hidden="true">Segurança</div>
                <div className="menu-group-items">
                  {has(PERM.USUARIOS) && (<MenuItem to="/usuarios" label="Usuários" icon={<UserGroupIcon />} />)}
                  {has(PERM.PERFIS_PERMISSOES) && (<MenuItem to="/perfis-permissoes" label="Permissões" icon={<KeyIcon />} />)}
                </div>
              </div>

              <div className="menu-group">
                <div className="menu-group-title" aria-hidden="true">Operação</div>
                <div className="menu-group-items">
                  {has(PERM.ESCALAS) && (<MenuItem to="/escalas" label="Escalas" icon={<ClockIcon />} />)}
                  {has(PERM.APONTAMENTOS) && (<MenuItem to="/apontamentos" label="Apontamentos" icon={<ClipboardDocumentListIcon />} />)}
                  {has(PERM.OCORRENCIAS) && (<MenuItem to="/ocorrencias" label="Ocorrências" icon={<ExclamationTriangleIcon />} />)}
                </div>
              </div>

              <div className="menu-group">
                <div className="menu-group-title" aria-hidden="true">Folha</div>
                <div className="menu-group-items">
                  {has(PERM.CARGOS) && (<MenuItem to="/cargos" label="Cargos" icon={<BriefcaseIcon />} />)}
                  {has(PERM.FUNCIONARIOS) && (<MenuItem to="/funcionarios" label="Funcionários x Salários" icon={<UserGroupIcon />} />)}
                  {has(PERM.FOLHAS) && (<MenuItem to="/folhas" label="Folhas" icon={<DocumentChartBarIcon />} />)}
                  {has(PERM.FOLHAS_FUNC) && (<MenuItem to="/folhas-funcionarios" label="Folhas × Funcionários" icon={<UserGroupIcon />} />)}
                  {has(PERM.FOLHAS_ITENS) && (<MenuItem to="/folhas-itens" label="Itens de Folha" icon={<DocumentTextIcon />} />)}
                </div>
              </div>

              <div className="menu-group">
                <div className="menu-group-title" aria-hidden="true">Dev</div>
                <div className="menu-group-items">
                  {has(PERM.DEV_INSPECAO) && (<MenuItem to="/dev-inspecao" label="Inspeção / SQL" icon={<MagnifyingGlassIcon />} />)}
                  {has(PERM.DEV_AUDITORIA) && (<MenuItem to="/dev-auditoria" label="Auditoria" icon={<ClipboardDocumentListIcon />} />)}
                  {has(PERM.DEV_CONFIG) && (<MenuItem to="/dev-config" label="Configurações" icon={<CogIcon />} />)}
                </div>
              </div>
            </nav>
          )}

          <div className="sidebar-footer">
            <small style={{ color: "var(--muted)" }}>v1.0 • Acessível</small>
          </div>
        </aside>
      )}
    </>
  );
}

function MenuItem({ to, label, icon, onClick, refProp }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
      onClick={onClick}
      end
      ref={refProp ?? null}
    >
      <span className="nav-item-icon">{icon}</span>
      <span className="nav-item-label">{label}</span>
    </NavLink>
  );
}