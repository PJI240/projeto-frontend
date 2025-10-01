// ===== API: Consulta CNPJ (primeiro verifica local, depois API externa) =====
async function consultaCNPJ() {
  setErr("");
  setEmpresaFormVisivel(false);
  const num = onlyDigits(cnpjInput);
  if (num.length !== 14) {
    setErr("Informe um CNPJ válido (14 dígitos).");
    return;
  }
  setLoading(true);
  try {
    // PRIMEIRO: Verificar se CNPJ já existe no banco local
    const checkLocal = await fetch(`${API_BASE}/api/empresas/verificar-cnpj/${num}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    // Se CNPJ já existe localmente (status 200)
    if (checkLocal.status === 200) {
      const data = await checkLocal.json().catch(() => null);
      const razao = data?.razao_social ? ` (${data.razao_social})` : "";
      setErr((data?.error || "Sua empresa já tem cadastro, procure o seu administrador.") + razao);
      setEmpresaFormVisivel(false);
      setEmpresa({ ...initialEmpresa, cnpj: num });
      return;
    }

    // Se CNPJ não existe (status 404), prossegue com API externa
    if (checkLocal.status === 404) {
      // SEGUNDO: Buscar na API externa
      const r = await fetch(`${API_BASE}/api/empresas/consulta-cnpj`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ cnpj: num }),
      });

      const data = await r.json().catch(() => null);

      if (!r.ok || !data?.ok) {
        // falha na API externa: libera formulário em branco
        setEmpresaByApi(false);
        setErr(data?.error || "Não foi possível consultar o CNPJ. Preencha manualmente.");
        setEmpresa({ ...initialEmpresa, cnpj: num });
        setEmpresaFormVisivel(true);
        return;
      }

      // Sucesso na API externa: preenche os dados
      const emp = data.empresa || {};
      setEmpresa({
        razao_social: emp.razao_social || "",
        nome_fantasia: emp.nome_fantasia || "",
        cnpj: onlyDigits(emp.cnpj || num),
        inscricao_estadual: emp.inscricao_estadual || "",
        data_abertura: emp.data_abertura || "",
        telefone: emp.telefone || "",
        email: emp.email || "",
        capital_social: emp.capital_social ?? "",
        natureza_juridica: emp.natureza_juridica || "",
        situacao_cadastral: emp.situacao_cadastral || emp.situicao || "",
        data_situacao: emp.data_situicao || "",
        socios_receita: JSON.stringify(emp.socios_receita ?? emp.qsa ?? []),
      });
      setEmpresaByApi(true);
      setEmpresaFormVisivel(true);
      setErr("");
    } else {
      // Outro status inesperado
      throw new Error("Erro inesperado ao verificar CNPJ");
    }
    
  } catch (e) {
    setEmpresaByApi(false);
    setErr("Falha na consulta. Preencha os dados da empresa manualmente.");
    setEmpresa({ ...initialEmpresa, cnpj: num });
    setEmpresaFormVisivel(true);
  } finally {
    setLoading(false);
  }
}