// src/components/menu.jsx  
import { NavLink } from "react-router-dom";  
  
export default function Menu({ me, onLogout, empresaAtiva }) {  
  const isDev = !!me?.isSuper || me?.roles?.includes("desenvolvedor");  
  const isAdm = isDev || me?.roles?.includes("administrador");  
  const isFunc = isDev || isAdm || me?.roles?.includes("funcionario");  
  
  return (  
    <aside className="dashboard-sidebar" aria-label="Menu lateral">  
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
  
        {isDev && (  
          <Group title="Dev">  
            <Item to="/dev-inspecao" label="Inspeção / SQL" />  
            <Item to="/dev-auditoria" label="Auditoria" />  
            <Item to="/dev-config" label="Configurações" />  
          </Group>  
        )}  
      </nav>  
  
      <div className="sidebar-footer">  
        <small style={{ color: "var(--muted)" }}>  
          v1.0 • Acessível • {isDev ? "Dev" : isAdm ? "Admin" : isFunc ? "Func" : "User"}  
        </small>  
      </div>  
    </aside>  
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