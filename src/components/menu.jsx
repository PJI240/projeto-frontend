// src/components/menu.jsx
import { NavLink, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";

export default function Menu({ me, onLogout, empresaAtiva }) {
  const [open, setOpen] = useState(false);
  const loc = useLocation();

  // Fecha ao trocar de rota
  useEffect(() => { setOpen(false); }, [loc.pathname]);

  // Travar scroll do body quando o drawer está aberto
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
  }, [open]);

  const isDev  = !!me?.isSuper || me?.roles?.includes("desenvolvedor");
  const isAdm  = isDev || me?.roles?.includes("administrador");
  const isFunc = isDev || isAdm || me?.roles?.includes("funcionario");

  return (
    <>
      {/* Botão hambúrguer (mobile) */}
      <button
        type="button"
        className="menu-toggle"
        aria-label="Abrir menu"
        aria-expanded={open ? "true" : "false"}
        aria-controls="app-sidebar"
        onClick={() => setOpen(v => !v)}
      >
        <span className="menu-toggle-icon">☰</span> Menu
      </button>

      {/* Backdrop por trás do drawer */}
      <div
        className={`sidebar-backdrop ${open ? "show" : ""}`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      <aside
        id="app-sidebar"
        className={`dashboard-sidebar ${open ? "is-open" : ""}`}
        aria-label="Menu lateral"
      >
        <div className="sidebar-header">
          <h1 className="brand">Projeto Integrador</h1>
          <h2 className="subtitle">Menu</h2>
        </div>

        <div className="user-info" role="group" aria-label="Usuário">
          <div className="user-details">
            <div className="user-name">{me?.nome || "Usuário"}</div>
            <div className="user-email">{me?.email}</div>
            {empresaAtiva && (
              <div style={{ fontSize: "var(--fs-12)", color: "var(--muted)", marginTop: 4 }}>
                Empresa: <strong>{empresaAtiva.nome_fantasia || empresaAtiva.razao_social}</strong>
              </div>
            )}
          </div>
          <button className="logout-btn" onClick={onLogout} title="Sair">Sair</button>
        </div>

        <nav className="sidebar-nav">
          <Group title="Geral">
            <Item to="/dashboard" label="Visão Geral" />
            {isFunc && <Item to="/dashboard_func" label="Meu Painel" />}
            {isAdm && <Item to="/dashboard_adm" label="Painel do Admin" />}
          </Group>

          {(isDev || isAdm) && (
            <Group title="Cadastros">
              <Item to="/usuarios" label="Usuários" />
              <Item to="/pessoas" label="Pessoas" />
              <Item to="/empresas" label="Empresas" />
              <Item to="/perfis" label="Perfis" />
              <Item to="/permissoes" label="Permissões" />
              <Item to="/cargos" label="Cargos" />
              <Item to="/funcionarios" label="Funcionários" />
            </Group>
          )}

          {(isDev || isAdm) && (
            <Group title="Vínculos / Segurança">
              <Item to="/empresas-usuarios" label="Empresas × Usuários" />
              <Item to="/usuarios-perfis" label="Usuários × Perfis" />
              <Item to="/perfis-permissoes" label="Perfis × Permissões" />
            </Group>
          )}

          {(isDev || isAdm || isFunc) && (
            <Group title="Operação">
              <Item to="/escalas" label="Escalas" />
              <Item to="/apontamentos" label="Apontamentos" />
              <Item to="/ocorrencias" label="Ocorrências" />
            </Group>
          )}

          {(isDev || isAdm) && (
            <Group title="Folha">
              <Item to="/folhas" label="Folhas" />
              <Item to="/folhas-funcionarios" label="Folhas × Funcionários" />
              <Item to="/folhas-itens" label="Itens de Folha" />
            </Group>
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

function Group({ title, children }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div
        style={{
          padding: "8px 16px",
          fontSize: "var(--fs-12)",
          color: "var(--muted)",
          textTransform: "uppercase",
          letterSpacing: ".04em",
        }}
        aria-hidden="true"
      >
        {title}
      </div>
      <div>{children}</div>
    </div>
  );
}
function Item({ to, label }) {
  return (
    <NavLink to={to} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`} end>
      <span>{label}</span>
    </NavLink>
  );
}