// src/App.jsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
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

export default function App() {
  return (
    <Router>
      <Routes>
        {/* 🔓 públicas: sem menu */}
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* 🔒 internas: com menu via AppLayout */}
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
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