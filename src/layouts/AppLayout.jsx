// src/layouts/AppLayout.jsx
import { Outlet, useNavigate } from "react-router-dom";
import Menu from "../components/menu.jsx";
import AccessibilityToggles from "../components/AccessibilityToggles";

export default function AppLayout() {
  const navigate = useNavigate();

  function logout() {
    // opcional: chamar API /api/auth/logout
    navigate("/login");
  }

  return (
    <div className="dashboard-container">
      <Menu onLogout={logout} />

      <main className="dashboard-main">
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <div className="toggles"><AccessibilityToggles /></div>
        </div>
        <Outlet />
      </main>
    </div>
  );
}