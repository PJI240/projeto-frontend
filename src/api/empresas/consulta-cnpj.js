import express from "express";
import axios from "axios";
import { onlyDigits } from "../utils/cnpj.js";

const router = express.Router();

router.post("/consulta-cnpj", async (req, res) => {
  try {
    const { cnpj } = req.body;
    const num = onlyDigits(cnpj);
    if (num.length !== 14) {
      return res.status(400).json({ ok: false, error: "CNPJ inválido" });
    }

    // chama ReceitaWS
    const r = await axios.get(`https://www.receitaws.com.br/v1/cnpj/${num}`, {
      timeout: 10000,
    });

    if (r.data.status !== "OK") {
      return res.status(400).json({ ok: false, error: "Falha consulta ReceitaWS" });
    }

    // mapeia para o formato da sua tabela
    const empresa = {
      razao_social: r.data.nome,
      nome_fantasia: r.data.fantasia,
      cnpj: r.data.cnpj,
      inscricao_estadual: null,
      data_abertura: r.data.abertura ? r.data.abertura.split("/").reverse().join("-") : null,
      telefone: r.data.telefone,
      email: r.data.email,
      capital_social: parseFloat(r.data.capital_social.replace(/[^\d,.-]/g, "").replace(",", ".")) || null,
      natureza_juridica: r.data.natureza_juridica,
      situacao_cadastral: r.data.situacao,
      data_situacao: r.data.data_situacao ? r.data.data_situacao.split("/").reverse().join("-") : null,
      socios_receita: JSON.stringify(r.data.qsa || []),
    };

    res.json({ ok: true, empresa });
  } catch (e) {
    console.error("CNPJ_LOOKUP_ERROR", e.message);
    res.status(500).json({ ok: false, error: "Erro ao consultar ReceitaWS" });
  }
});

export default router;
