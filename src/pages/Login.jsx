import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AccessibilityToggles from "../components/AccessibilityToggles";

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");

export default function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Se já estiver logado, manda pro landing apropriado
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/auth/me`, { credentials: "include" });
        const data = await r.json().catch(() => null);
        if (r.ok && data?.ok && data.user) {
          navigate(data.landing || "/dashboard", { replace: true });
        }
      } catch {
        /* silencioso */
      }
    })();
  }, [navigate]);

  async function enviar(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, senha }),
      });

      const data = await resp.json().catch(() => null);

      if (!resp.ok || !data?.ok) {
        setErr(data?.error === "invalid_credentials"
          ? "E-mail ou senha inválidos."
          : "Não foi possível entrar. Tente novamente.");
        return;
      }

      // usa o landing decidido no backend (boas práticas)
      navigate(data.landing || "/dashboard", { replace: true });
    } catch (e) {
      console.error("LOGIN_ERROR", e);
      setErr("Erro de conexão com o servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="split">
      <section className="left">
        <div className="toggles-wrapper">
          <AccessibilityToggles />
        </div>

        <h2 className="title">Acesso ao Sistema</h2>

        <form className="form" onSubmit={enviar}>
          <label htmlFor="email">E-mail</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <label htmlFor="pass">Senha</label>
          <input
            id="pass"
            type="password"
            autoComplete="current-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
          />

          <button type="submit" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </button>

          {err && (
            <div role="alert" aria-live="polite" style={{ marginTop: 8, color: "var(--error)" }}>
              {err}
            </div>
          )}
        </form>

        <p className="register-link">
          Não tem uma conta? <Link to="/register">Cadastre-se</Link>
        </p>
      </section>

      <section className="right" aria-hidden="true">
        <div className="overlay">
          <h3>
            Projeto Integrador Univesp
            <span>Sistema de contagem de horas trabalhadas</span>
          </h3>
        </div>
      </section>
    </div>
  );
}