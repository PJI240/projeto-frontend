import { useState } from "react";
import { Link } from "react-router-dom";
import AccessibilityToggles from "../components/AccessibilityToggles";
import "./login.css";

const API_BASE = import.meta.env.VITE_API_BASE;

export default function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);

    try {
      const resp = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        credentials: "include", // mantém o cookie JWT
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, senha }),
      });

      const data = await resp.json();

      if (!resp.ok || !data.ok) {
        setErr("E-mail ou senha inválidos.");
        return;
      }

      // redireciona para a dashboard
      window.location.href = "/dashboard";
    } catch (e) {
      console.error("LOGIN_ERROR", e);
      setErr("Erro de conexão com o servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="split">
      <section className="left">
        <h1 className="brand">Projeto Integrador</h1>
        <h2 className="title">Acesso ao Sistema</h2>

        <form className="form" onSubmit={enviar}>
          <label htmlFor="email">E-mail</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <label htmlFor="pass">Senha</label>
          <input
            id="pass"
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
          />

          <button type="submit" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </button>

          {err && (
            <div role="alert" aria-live="polite" className="mt-2 text-red-600">
              {err}
            </div>
          )}
        </form>

        <div className="toggles-wrapper">
          <AccessibilityToggles />
        </div>

        {/* Rodapé com link de cadastro */}
        <p className="mt-4 text-sm text-gray-700">
          Não tem acesso?{" "}
          <strong>
            <Link to="/register">Cadastre-se</Link>
          </strong>
        </p>
      </section>

      <section className="right">
        <div className="overlay">
          <h3>
            Projeto Integrador Univesp
            <span> Sistema de contagem de horas trabalhadas</span>
          </h3>
        </div>
      </section>
    </div>
  );
}
