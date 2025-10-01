/* =========================================================
   1) Consulta CNPJ (pública, checa banco antes da Receita)
   ========================================================= */

// helper: fetch com timeout (pode reaproveitar o seu)
async function fetchJson(url, { timeoutMs = 12000 } = {}) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ac.signal });
    const data = await r.json().catch(() => null);
    return { ok: r.ok, status: r.status, data };
  } finally {
    clearTimeout(timer);
  }
}

// 🔓 PÚBLICA — não usa requireAuth
router.post("/consulta-cnpj", async (req, res) => {
  try {
    const num = onlyDigits(req.body?.cnpj);
    if (num.length !== 14) {
      return res.status(400).json({ ok: false, error: "CNPJ inválido (14 dígitos)." });
    }
    if (num === "00000000000000") {
      return res.status(400).json({ ok: false, error: "CNPJ reservado ao sistema (GLOBAL)." });
    }

    // 1) Verifica se já existe no banco (NORMALIZADO)
    const [[ja]] = await pool.query(
      `SELECT id, razao_social
         FROM empresas
        WHERE REPLACE(REPLACE(REPLACE(cnpj,'/',''),'.',''),'-','') = ?
        LIMIT 1`,
      [num]
    );
    if (ja) {
      return res.status(409).json({
        ok: false,
        code: "already_registered",
        error: "Sua empresa já tem cadastro, procure o seu administrador.",
        empresa_id: ja.id,
        razao_social: ja.razao_social
      });
    }

    // 2) Não existe? Consulta ReceitaWS
    const { ok, status, data } = await fetchJson(`https://www.receitaws.com.br/v1/cnpj/${num}`, { timeoutMs: 12000 });
    if (!ok || !data || data.status !== "OK") {
      return res.status(502).json({
        ok: false,
        error: "Falha ao consultar a Receita (tente novamente em instantes).",
        upstream: status,
      });
    }

    // 3) Mapeia para o formato da sua tabela
    const d = data;
    const empresa = {
      razao_social:       d.nome || "",
      nome_fantasia:      d.fantasia || "",
      cnpj:               num, // normalizado
      inscricao_estadual: null,
      data_abertura:      d.abertura ? d.abertura.split("/").reverse().join("-") : null,
      telefone:           d.telefone || "",
      email:              d.email || "",
      capital_social:     (() => {
        const raw = String(d.capital_social ?? "")
          .replace(/[^\d,.-]/g, "")
          .replace(/\./g, "")
          .replace(",", ".");
        const val = parseFloat(raw);
        return Number.isFinite(val) ? val : null;
      })(),
      natureza_juridica:  d.natureza_juridica || "",
      situacao_cadastral: d.situacao || "",
      data_situacao:      d.data_situicao ? d.data_situicao.split("/").reverse().join("-") : null,
      socios_receita:     JSON.stringify(d.qsa || []),
    };

    return res.json({ ok: true, empresa });
  } catch (e) {
    console.error("EMPRESAS_CONSULTA_CNPJ_ERR", e?.message || e);
    const timeout = /abort|timeout|ECONNABORTED/i.test(String(e?.message || ""));
    return res.status(timeout ? 504 : 500).json({
      ok: false,
      error: timeout ? "Tempo de consulta esgotado." : "Erro ao consultar CNPJ.",
    });
  }
});