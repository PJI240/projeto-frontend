import { useState } from "react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mensagem, setMensagem] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const resposta = await fetch(`${import.meta.env.VITE_API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, senha }),
      });

      const dados = await resposta.json();
      if (resposta.ok) {
        setMensagem("Login realizado com sucesso! ✅");
        // aqui futuramente: salvar token, redirecionar para dashboard etc.
      } else {
        setMensagem(dados.error || "Falha no login ❌");
      }
    } catch (err) {
      setMensagem("Erro de conexão com servidor ❌");
    }
  };

  return (
    <main style={{ maxWidth: 400, margin: "3rem auto", fontFamily: "Arial" }}>
      <h1>Login</h1>
      <form onSubmit={handleSubmit}>
        <label>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ width: "100%", marginBottom: "1rem" }}
        />

        <label>Senha</label>
        <input
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          required
          style={{ width: "100%", marginBottom: "1rem" }}
        />

        <button type="submit" style={{ width: "100%", padding: "0.5rem" }}>
          Entrar
        </button>
      </form>

      {mensagem && <p style={{ marginTop: "1rem" }}>{mensagem}</p>}
    </main>
  );
}