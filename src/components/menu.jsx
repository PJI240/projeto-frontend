// src/components/menu.jsx
import { NavLink } from "react-router-dom";
import { useState, useEffect } from "react";

// Importando Heroicons
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
  WrenchScrewdriverIcon,
  ArrowRightOnRectangleIcon
} from "@heroicons/react/24/outline";

export default function Menu({ me, onLogout, empresaAtiva }) {
  const [isMobile, setIsMobile] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const isDev = !!me?.isSuper || me?.roles?.includes("desenvolvedor");
  const isAdm = isDev || me?.roles?.includes("administrador");
  const isFunc = isDev || isAdm || me?.roles?.includes("funcionario");

  // Detecta se está em mobile
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth <= 900);
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Fecha o menu ao mudar de rota no mobile
  useEffect(() => {
    if (isMobile) {
      setIsMenuOpen(false);
    }
  }, [isMobile, window.location.pathname]);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  return (
    <>
      {/* Botão hambúrguer para mobile */}
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

      {/* Backdrop para fechar o menu no mobile */}
      {isMobile && isMenuOpen && (
        <div 
          className="sidebar-backdrop show" 
          onClick={closeMenu}
          aria-hidden="true"
        />
      )}

      {/* Sidebar/Menu */}
      <aside 
        id="dashboard-sidebar"
        className={`dashboard-sidebar ${isMenuOpen ? 'is-open' : ''} ${isMobile ? 'mobile' : ''}`}
        aria-label="Menu lateral"
      >
        <div className="sidebar-header">
          <h1 className="brand">Projeto Integrador</h1>
          <h2 className="subtitle">Menu</h2>
          
          {/* Botão fechar no mobile */}
          {isMobile && (
            <button 
              className="close-menu"
              onClick={closeMenu}
              aria-label="Fechar menu"
            >
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
          <button 
            className="logout-btn" 
            onClick={onLogout} 
            title="Sair"
            aria-label="Sair do sistema"
          >
            <ArrowRightOnRectangleIcon className="logout-icon" />
          </button>
        </div>

        <nav className="sidebar-nav" aria-label="Navegação principal">
          <MenuGroup title="Geral">
            
            <MenuItem to="/dashboard" label="Visão Geral" icon={<ChartBarIcon />} onClick={closeMenu} />
            {isFunc && <MenuItem to="/dashboard_func" label="Meu Painel" icon={<UserIcon />} onClick={closeMenu} />}
            {isAdm && <MenuItem to="/dashboard_adm" label="Painel do Admin" icon={<ShieldCheckIcon />} onClick={closeMenu} />}
            <MenuItem to="/empresas" label="Minha Empresa" icon={<BuildingOfficeIcon />} onClick={closeMenu} />
          </MenuGroup>

          {(isDev || isAdm) && (
            <MenuGroup title="Cadastros">
              <MenuItem to="/pessoas" label="Pessoas" icon={<UserIcon />} onClick={closeMenu} />
            </MenuGroup>
          )}

          {(isDev || isAdm) && (
            <MenuGroup title="Segurança">
              <MenuItem to="/usuarios" label="Usuários" icon={<UserGroupIcon />} onClick={closeMenu} />
              <MenuItem to="/perfis-permissoes" label="Permissões" icon={<KeyIcon />} onClick={closeMenu} />
            </MenuGroup>
          )}

          {(isDev || isAdm || isFunc) && (
            <MenuGroup title="Operação">
              <MenuItem to="/escalas" label="Escalas" icon={<ClockIcon />} onClick={closeMenu} />
              <MenuItem to="/apontamentos" label="Apontamentos" icon={<ClipboardDocumentListIcon />} onClick={closeMenu} />
              <MenuItem to="/ocorrencias" label="Ocorrências" icon={<ExclamationTriangleIcon />} onClick={closeMenu} />
            </MenuGroup>
          )}

          {(isDev || isAdm) && (
            <MenuGroup title="Folha">
              <MenuItem to="/cargos" label="Cargos" icon={<BriefcaseIcon />} onClick={closeMenu} />
              <MenuItem to="/funcionarios" label="Funcionários" icon={<UserGroupIcon />} onClick={closeMenu} />
              <MenuItem to="/folhas" label="Folhas" icon={<DocumentChartBarIcon />} onClick={closeMenu} />
              <MenuItem to="/folhas-funcionarios" label="Folhas × Funcionários" icon={<UserGroupIcon />} onClick={closeMenu} />
              <MenuItem to="/folhas-itens" label="Itens de Folha" icon={<DocumentTextIcon />} onClick={closeMenu} />
            </MenuGroup>
          )}

          {isDev && (
            <MenuGroup title="Dev">
              <MenuItem to="/dev-inspecao" label="Inspeção / SQL" icon={<MagnifyingGlassIcon />} onClick={closeMenu} />
              <MenuItem to="/dev-auditoria" label="Auditoria" icon={<ClipboardDocumentListIcon />} onClick={closeMenu} />
              <MenuItem to="/dev-config" label="Configurações" icon={<CogIcon />} onClick={closeMenu} />
            </MenuGroup>
          )}
        </nav>

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
      <div 
        className="menu-group-title"
        aria-hidden="true"
      >
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
