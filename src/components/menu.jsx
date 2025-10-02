// src/components/menu.jsx
import { NavLink } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";

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

/** Códigos de permissão (exatamente como no BD: menu.xxx.ver) */
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

  // permissões (strings exatamente como no BD)
  const [perms, setPerms] = useState(() => new Set());
  const [permsLoaded, setPermsLoaded] = useState(false);

  // Carrega permissões efetivas
  useEffect(() => {
    let alive = true;

    async function fetchPerms() {
      // Dev/Admin: vê tudo (qualquer front que dependa só de perm também funcionará)
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

        // tenta rota dedicada; cai para a antiga se necessário
        let codes;
        try {
          codes = await tryFetch(`${API_BASE}/api/permissoes_menu/minhas`);
        } catch {
          codes = await tryFetch(`${API_BASE}/api/permissoes/minhas`);
        }

        if (alive) {
          setPerms(new Set(codes)); // sem mapear/renomear → igual ao BD
          setPermsLoaded(true);
        }
      } catch {
        if (alive) {
          // fallback mínimo
          setPerms(new Set([PERM.DASHBOARD, PERM.EMPRESAS]));
          setPermsLoaded(true);
        }
      }
    }

    fetchPerms();
    return () => { alive = false; };
  }, [isDev, isAdm]);

  const has = (code) => perms.has(code);

  // mobile
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 900);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  useEffect(() => {
    if (!isMobile) return;
    const onPop = () => setIsMenuOpen(false);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [isMobile]);

  const toggleMenu = () => setIsMenuOpen((v) => !v);
  const closeMenu = () => setIsMenuOpen(false);

  // Seção só aparece se tiver pelo menos um item permitido
  const Section = ({ title, items }) => {
    const anyVisible = useMemo(() => items.some((i) => has(i.perm)), [items, perms]);
    if (!anyVisible) return null;
    return (
      <div className="menu-group">
        <div className="menu-group-title" aria-hidden="true">{title}</div>
        <div className="menu-group-items">
          {items.map((i) =>
            has(i.perm) ? (
              <MenuItem key={i.to} to={i.to} label={i.label} icon={i.icon} onClick={closeMenu} />
            ) : null
          )}
        </div>
      </div>
    );
  };

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
            <Section
              title="Geral"
              items={[
               { perm: PERM.DASHBOARD_FUNC,  to: "/dashboard_func",   label: "Meu Painel",         icon: <UserIcon /> },
                { perm: PERM.DASHBOARD_ADM,   to: "/dashboard_adm",    label: "Painel do Admin",    icon: <ShieldCheckIcon /> },
                              ]}
            />

            <Section
              title="Cadastros"
              items={[
                { perm: PERM.PESSOAS,         to: "/pessoas",          label: "Pessoas",            icon: <UserIcon /> },
                { perm: PERM.EMPRESAS,        to: "/empresas",         label: "Minha Empresa",      icon: <BuildingOfficeIcon /> },
              ]}
            />

            <Section
              title="Segurança"
              items={[
                { perm: PERM.USUARIOS,        to: "/usuarios",         label: "Usuários",           icon: <UserGroupIcon /> },
                { perm: PERM.PERFIS_PERMISSOES,to: "/perfis-permissoes",label: "Permissões",        icon: <KeyIcon /> },
              ]}
            />

            <Section
              title="Operação"
              items={[
                { perm: PERM.ESCALAS,         to: "/escalas",          label: "Escalas",            icon: <ClockIcon /> },
                { perm: PERM.APONTAMENTOS,    to: "/apontamentos",     label: "Apontamentos",       icon: <ClipboardDocumentListIcon /> },
                { perm: PERM.OCORRENCIAS,     to: "/ocorrencias",      label: "Ocorrências",        icon: <ExclamationTriangleIcon /> },
              ]}
            />

            <Section
              title="Folha"
              items={[
                { perm: PERM.CARGOS,          to: "/cargos",           label: "Cargos",             icon: <BriefcaseIcon /> },
                { perm: PERM.FUNCIONARIOS,    to: "/funcionarios",     label: "Funcionários x Salários", icon: <UserGroupIcon /> },
                { perm: PERM.FOLHAS,          to: "/folhas",           label: "Folhas",             icon: <DocumentChartBarIcon /> },
                { perm: PERM.FOLHAS_FUNC,     to: "/folhas-funcionarios", label: "Folhas × Funcionários", icon: <UserGroupIcon /> },
                { perm: PERM.FOLHAS_ITENS,    to: "/folhas-itens",     label: "Itens de Folha",     icon: <DocumentTextIcon /> },
              ]}
            />

            <Section
              title="Dev"
              items={[
                { perm: PERM.DEV_INSPECAO,    to: "/dev-inspecao",     label: "Inspeção / SQL",     icon: <MagnifyingGlassIcon /> },
                { perm: PERM.DEV_AUDITORIA,   to: "/dev-auditoria",    label: "Auditoria",          icon: <ClipboardDocumentListIcon /> },
                { perm: PERM.DEV_CONFIG,      to: "/dev-config",       label: "Configurações",      icon: <CogIcon /> },
              ]}
            />
          </nav>
        )}

        <div className="sidebar-footer">
          <small style={{ color: "var(--muted)" }}>
            v1.0 • Acessível
          </small>
        </div>
      </aside>
    </>
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
