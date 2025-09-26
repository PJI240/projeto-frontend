// src/pages/Register.jsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE;

export default function Register() { // ← IMPORTANTE: export default
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);

    try {
      const resp = await fetch(`${API_BASE}/api/auth/register`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, email, senha }),
      });

      const data = await resp.json();

      if (!resp.ok || !data.ok) {
        if (data.error === "email_already_exists") {
          setErr("Este e-mail já está cadastrado.");
        } else {
          setErr("Erro ao criar conta. Tente novamente.");
        }
        return;
      }

      navigate("/dashboard");
    } catch (e) {
      console.error("REGISTER_ERROR", e);
      setErr("Erro de conexão com o servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="split">
      <section className="left">
        <h1 className="brand">Projeto Integrador</h1>
        <h2 className="title">Criar Conta</h2>

        <form className="form" onSubmit={handleSubmit}>
          <label htmlFor="nome">Nome completo</label>
          <input
            id="nome"
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
          />

          <label htmlFor="email">E-mail</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <label htmlFor="senha">Senha</label>
          <input
            id="senha"
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
            minLength="6"
          />

          <button type="submit" disabled={loading}>
            {loading ? "Criando conta..." : "Cadastrar"}
          </button>

          {err && (
            <div role="alert" className="mt-2 text-red-600">
              {err}
            </div>
          )}
        </form>

        <p className="register-link">
          Já tem uma conta? <Link to="/login">Faça login</Link>
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
