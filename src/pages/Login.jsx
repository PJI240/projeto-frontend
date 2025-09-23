import { useState } from "react";
import AccessibilityToggles from "../components/AccessibilityToggles";
import "./login.css";

export default function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  const enviar = (e) => {
    e.preventDefault();
    alert(`Login com: ${email}`);
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

          <button type="submit">Entrar</button>
        </form>

        {/* Centralizado logo abaixo do botão */}
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
