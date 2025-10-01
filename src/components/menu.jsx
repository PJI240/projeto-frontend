// src/components/menu.jsx
import { NavLink } from "react-router-dom";
import { useState, useEffect } from "react";

// Heroicons
import {
  Bars3Icon,
  XMarkIcon,
  ChartBarIcon,
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

// Base da API
const API_BASE = import.meta.env.VITE_API_BASE?.replace(/\/+$/, "") || "";

/** Códigos de permissão no MESMO formato do banco (menu.xxx.ver) */
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

  const isDev = !!me?.isSuper || me?.roles?.includes("desenvolvedor");
  const isAdm = isDev || me?.roles?.includes("administrador");
  const isFunc = isDev || isAdm || me?.roles?.includes("funcionario");

  // permissões efetivas (set de strings)
  const [perms, setPerms] = useState(() => new Set());
  const [permsLoaded, setPermsLoaded] = useState(false);

  // Carrega permissões (formato exatamente igual ao BD: menu.xxx.ver)
  useEffect(() => {
    let alive = true;
    async function fetchPerms() {
      if (isDev || isAdm) {
        // Admin/Dev enxerga tudo
        if (alive) {
          setPerms(new Set(Object.values(PERM)));
          setPermsLoaded(true);
        }
        return;
      }
      try {
        // tenta rota nova; se não existir, cai na antiga
        const tryFetch = async (url) => {
          const r = await fetch(url, { credentials: "include" });
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
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
          setPerms(new Set(codes)); // sem conversão!
          setPermsLoaded(true);
        }
      } catch {
        if (alive) {
          // fallback mínimo
          setPerms(new Set([PERM.DASHBOARD, PERM.DASHBOARD_FUNC]));
          setPermsLoaded(true);
        }
      }
    }
    fetchPerms();
    return () => { alive = false; };
  }, [isDev, isAdm]);

  const has = (code) => perms.has(code);

  // Detecta mobile
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 900);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Fecha o menu ao mudar rota no mobile
  useEffect(() => {
    if (!isMobile) return;
    const onPop = () => setIsMenuOpen(false);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [isMobile]);

  const toggleMenu = () => setIsMenuOpen((v) => !v);
  const closeMenu = () => setIsMenuOpen(false);

  const canRender = permsLoaded || isAdm || isDev;

  return (
    <>
      {isMobile && (
        <button
          className="menu-toggle"
          onClick={toggleMenu}
          aria-expanded={isMenuOpen}
          aria-controls="dashboard-sidebar"
          aria-label="Abrir menu"
        >
          <Bars3Icon className="menu-toggle-icon" />
          Menu
        </button>
      )}

      {isMobile && isMenuOpen && (
        <div className="sidebar-backdrop show" onClick={closeMenu} aria-hidden="true" />
      )}

      <aside
        id="dashboard-sidebar"
        className={`dashboard-sidebar ${isMenuOpen ? "is-open" : ""} ${isMobile ? "mobile" : ""}`}
        aria-label="Menu lateral"
      >
        <div className="sidebar-header">
          <h1 className="brand">Projeto Integrador</h1>
          <h2 className="subtitle">Menu</h2>
          {isMobile && (
            <button className="close-menu" onClick={closeMenu} aria-label="Fechar menu">
              <XMarkIcon className="close-menu-icon" />
            </button>
          )}
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

        {canRender && (
          <nav className="sidebar-nav" aria-label="Navegação principal">
            <MenuGroup title="Geral">
              {has(PERM.DASHBOARD) && (
                <MenuItem to="/dashboard" label="Visão Geral" icon={<ChartBarIcon />} onClick={closeMenu} />
              )}
              {isFunc && has(PERM.DASHBOARD_FUNC) && (
                <MenuItem to="/dashboard_func" label="Meu Painel" icon={<UserIcon />} onClick={closeMenu} />
              )}
              {isAdm && has(PERM.DASHBOARD_ADM) && (
                <MenuItem to="/dashboard_adm" label="Painel do Admin" icon={<ShieldCheckIcon />} onClick={closeMenu} />
              )}
              {has(PERM.EMPRESAS) && (
                <MenuItem to="/empresas" label="Minha Empresa" icon={<BuildingOfficeIcon />} onClick={closeMenu} />
              )}
            </MenuGroup>

            {(isDev || isAdm) && (
              <MenuGroup title="Cadastros">
                {has(PERM.PESSOAS) && (
                  <MenuItem to="/pessoas" label="Pessoas" icon={<UserIcon />} onClick={closeMenu} />
                )}
              </MenuGroup>
            )}

            {(isDev || isAdm) && (
              <MenuGroup title="Segurança">
                {has(PERM.USUARIOS) && (
                  <MenuItem to="/usuarios" label="Usuários" icon={<UserGroupIcon />} onClick={closeMenu} />
                )}
                {has(PERM.PERFIS_PERMISSOES) && (
                  <MenuItem to="/perfis-permissoes" label="Permissões" icon={<KeyIcon />} onClick={closeMenu} />
                )}
              </MenuGroup>
            )}

            {(isDev || isAdm || isFunc) && (
              <MenuGroup title="Operação">
                {has(PERM.ESCALAS) && (
                  <MenuItem to="/escalas" label="Escalas" icon={<ClockIcon />} onClick={closeMenu} />
                )}
                {has(PERM.APONTAMENTOS) && (
                  <MenuItem to="/apontamentos" label="Apontamentos" icon={<ClipboardDocumentListIcon />} onClick={closeMenu} />
                )}
                {has(PERM.OCORRENCIAS) && (
                  <MenuItem to="/ocorrencias" label="Ocorrências" icon={<ExclamationTriangleIcon />} onClick={closeMenu} />
                )}
              </MenuGroup>
            )}

            {(isDev || isAdm) && (
              <MenuGroup title="Folha">
                {has(PERM.CARGOS) && (
                  <MenuItem to="/cargos" label="Cargos" icon={<BriefcaseIcon />} onClick={closeMenu} />
                )}
                {has(PERM.FUNCIONARIOS) && (
                  <MenuItem to="/funcionarios" label="Funcionários x Salários" icon={<UserGroupIcon />} onClick={closeMenu} />
                )}
                {has(PERM.FOLHAS) && (
                  <MenuItem to="/folhas" label="Folhas" icon={<DocumentChartBarIcon />} onClick={closeMenu} />
                )}
                {has(PERM.FOLHAS_FUNC) && (
                  <MenuItem to="/folhas-funcionarios" label="Folhas × Funcionários" icon={<UserGroupIcon />} onClick={closeMenu} />
                )}
                {has(PERM.FOLHAS_ITENS) && (
                  <MenuItem to="/folhas-itens" label="Itens de Folha" icon={<DocumentTextIcon />} onClick={closeMenu} />
                )}
              </MenuGroup>
            )}

            {isDev && (
              <MenuGroup title="Dev">
                {has(PERM.DEV_INSPECAO) && (
                  <MenuItem to="/dev-inspecao" label="Inspeção / SQL" icon={<MagnifyingGlassIcon />} onClick={closeMenu} />
                )}
                {has(PERM.DEV_AUDITORIA) && (
                  <MenuItem to="/dev-auditoria" label="Auditoria" icon={<ClipboardDocumentListIcon />} onClick={closeMenu} />
                )}
                {has(PERM.DEV_CONFIG) && (
                  <MenuItem to="/dev-config" label="Configurações" icon={<CogIcon />} onClick={closeMenu} />
                )}
              </MenuGroup>
            )}
          </nav>
        )}

        <div className="sidebar-footer">
          <small style={{ color: "var(--muted)" }}>
            v1.0 • Acessível • {isDev ? "Dev" : isAdm ? "Admin" : isFunc ? "Func" : "User"}
          </small>
        </div>
      </aside>
    </>
  );
}

function MenuGroup({ title, children }) {
  return (
    <div className="menu-group">
      <div className="menu-group-title" aria-hidden="true">
        {title}
      </div>
      <div className="menu-group-items">{children}</div>
    </div>
  );
}

function MenuItem({ to, label, icon, onClick }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
      onClick={onClick}
      end
    >
      <span className="nav-item-icon">{icon}</span>
      <span className="nav-item-label">{label}</span>
    </NavLink>
  );
}
