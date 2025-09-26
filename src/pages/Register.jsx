import { useState } from "react";
import AccessibilityToggles from "../components/AccessibilityToggles";
import "./login.css"; // reaproveita o estilo do login

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

export default function Register() {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setErr("");
    setOk("");
    if (!nome || !email || !senha) {
      setErr("Preencha todos os campos.");
      return;
    }
    if (senha !== confirm) {
      setErr("As senhas não coincidem.");
      return;
    }
    if (senha.length < 6) {
      setErr("A senha deve ter ao menos 6 caracteres.");
      return;
    }

    setLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, email, senha }),
      });
      const data = await resp.json();

      if (!resp.ok) {
        setErr(data?.error || "Erro ao cadastrar.");
        return;
      }

      setOk("Cadastro realizado com sucesso. Você pode fazer login.");
      setNome("");
      setEmail("");
      setSenha("");
      setConfirm("");
    } catch (e) {
      console.error("REGISTER_ERR", e);
      setErr("Erro de conexão com o servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="split">
      <section className="left">
        <h1 className="brand">Projeto Integrador</h1>
        <h2 className="title">Cadastro de Usuário</h2>

        <form className="form" onSubmit={enviar} aria-live="polite">
          <label htmlFor="nome">Nome</label>
          <input
            id="nome"
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
            autoComplete="name"
          />

          <label htmlFor="email">E-mail</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />

          <label htmlFor="senha">Senha</label>
          <input
            id="senha"
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
            autoComplete="new-password"
            minLength={6}
          />

          <label htmlFor="confirm">Confirmar senha</label>
          <input
            id="confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            autoComplete="new-password"
            minLength={6}
          />

          <button type="submit" disabled={loading}>
            {loading ? "Cadastrando..." : "Cadastrar"}
          </button>

          {err && (
            <div role="alert" className="mt-2 text-red-600">
              {err}
            </div>
          )}
          {ok && (
            <div role="status" className="mt-2 text-green-600">
              {ok}
            </div>
          )}
        </form>

        <div className="toggles-wrapper">
          <AccessibilityToggles />
        </div>
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
