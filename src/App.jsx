// src/App.jsx
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import AppLayout from "./layouts/AppLayout.jsx";

import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";

import Dashboard from "./pages/Dashboard.jsx";
import DashboardAdm from "./pages/DashboardAdm.jsx";
import DashboardFunc from "./pages/DashboardFunc.jsx";

import Usuarios from "./pages/Usuarios.jsx";
import Pessoas from "./pages/Pessoas.jsx";
import Empresas from "./pages/Empresas.jsx";
import Perfis from "./pages/Perfis.jsx";
import Permissoes from "./pages/Permissoes.jsx";
import Cargos from "./pages/Cargos.jsx";
import Funcionarios from "./pages/Funcionarios.jsx";

import EmpresasUsuarios from "./pages/EmpresasUsuarios.jsx";
import UsuariosPerfis from "./pages/UsuariosPerfis.jsx";
import PerfisPermissoes from "./pages/PerfisPermissoes.jsx";

import Escalas from "./pages/Escalas.jsx";
import Apontamentos from "./pages/Apontamentos.jsx";
import Ocorrencias from "./pages/Ocorrencias.jsx";

import Folhas from "./pages/Folhas.jsx";
import FolhasFuncionarios from "./pages/FolhasFuncionarios.jsx";
import FolhasItens from "./pages/FolhasItens.jsx";

import DevInspecao from "./pages/DevInspecao.jsx";
import DevAuditoria from "./pages/DevAuditoria.jsx";
import DevConfig from "./pages/DevConfig.jsx";

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");

/** Decide a rota inicial com base nos papéis do usuário. */
function Landing() {
  const [state, setState] = useState({ loading: true, path: "/login" });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/auth/me`, { credentials: "include" });
        const data = await r.json().catch(() => null);

        if (!alive) return;

        if (r.ok && data?.ok && data.user) {
          const roles = (data.roles || []).map((s) => String(s).toLowerCase());
          const isAdm = roles.includes("administrador") || roles.includes("desenvolvedor");
          
          // CORREÇÃO: Redireciona para dashboard_func se não for admin
          if (isAdm) {
            setState({ loading: false, path: "/dashboard_adm" });
          } else {
            setState({ loading: false, path: "/dashboard_func" });
          }
        } else {
          setState({ loading: false, path: "/login" });
        }
      } catch {
        if (alive) setState({ loading: false, path: "/login" });
      }
    })();
    return () => { alive = false; };
  }, []);

  if (state.loading) return null; // opcional: tela de splash
  return <Navigate to={state.path} replace />;
}

export default function App() {
  return (
    <Router>
      <Routes>
        {/* 🔓 públicas: sem menu */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* 🔒 internas: com menu via AppLayout */}
        <Route element={<AppLayout />}>
          <Route path="/dashboard_func" element={<Dashboard />} />
          <Route path="/dashboard_adm" element={<DashboardAdm />} />
          <Route path="/dashboard_func" element={<DashboardFunc />} />

          {/* cadastros */}
          <Route path="/usuarios" element={<Usuarios />} />
          <Route path="/pessoas" element={<Pessoas />} />
          <Route path="/empresas" element={<Empresas />} />
          <Route path="/perfis" element={<Perfis />} />
          <Route path="/permissoes" element={<Permissoes />} />
          <Route path="/cargos" element={<Cargos />} />
          <Route path="/funcionarios" element={<Funcionarios />} />

          {/* vínculos */}
          <Route path="/empresas-usuarios" element={<EmpresasUsuarios />} />
          <Route path="/usuarios-perfis" element={<UsuariosPerfis />} />
          <Route path="/perfis-permissoes" element={<PerfisPermissoes />} />

          {/* operação */}
          <Route path="/escalas" element={<Escalas />} />
          <Route path="/apontamentos" element={<Apontamentos />} />
          <Route path="/ocorrencias" element={<Ocorrencias />} />

          {/* folha */}
          <Route path="/folhas" element={<Folhas />} />
          <Route path="/folhas-funcionarios" element={<FolhasFuncionarios />} />
          <Route path="/folhas-itens" element={<FolhasItens />} />

          {/* dev */}
          <Route path="/dev-inspecao" element={<DevInspecao />} />
          <Route path="/dev-auditoria" element={<DevAuditoria />} />
          <Route path="/dev-config" element={<DevConfig />} />
        </Route>
      </Routes>
    </Router>
  );
}
