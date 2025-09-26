const handleSubmit = async (e) => {
  e.preventDefault();
  setErr("");
  setLoading(true);

  try {
    console.log("Tentando registrar:", { nome, email });
    
    const resp = await fetch(`${API_BASE}/api/auth/register`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, email, senha }),
    });

    const text = await resp.text();
    console.log("Resposta bruta:", text);
    
    let data;
    try {
      data = JSON.parse(text);
    } catch (parseError) {
      console.error("Erro ao parsear JSON:", parseError);
      setErr("Resposta inválida do servidor");
      return;
    }

    if (!resp.ok || !data.ok) {
      console.error("Erro do servidor:", data);
      if (data.error === "email_already_exists") {
        setErr("Este e-mail já está cadastrado.");
      } else {
        setErr(data.details || "Erro ao criar conta. Tente novamente.");
      }
      return;
    }

    console.log("Registro bem-sucedido:", data);
    navigate("/dashboard");
  } catch (e) {
    console.error("REGISTER_ERROR:", e);
    setErr("Erro de conexão com o servidor: " + e.message);
  } finally {
    setLoading(false);
  }
};
