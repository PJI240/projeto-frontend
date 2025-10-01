import express from "express";
import axios from "axios";
import { onlyDigits } from "../utils/cnpj.js";
// Importe seu modelo de Empresa
import Empresa from "../routes/Empresa.js"; // ajuste o caminho conforme sua estrutura

const router = express.Router();

// NOVO ENDPOINT: Verificar se CNPJ já existe localmente
router.get("/verificar-cnpj/:cnpj", async (req, res) => {
  try {
    const { cnpj } = req.params;
    const num = onlyDigits(cnpj);
    
    if (num.length !== 14) {
      return res.status(400).json({ ok: false, error: "CNPJ inválido" });
    }

    // Verifica se empresa já existe no banco
    const empresaExistente = await Empresa.findOne({ where: { cnpj: num } });
    
    if (empresaExistente) {
      return res.status(200).json({
        ok: false,
        error: "Sua empresa já tem cadastro, procure o seu administrador.",
        razao_social: empresaExistente.razao_social
      });
    }
    
    // CNPJ não encontrado - pode prosseguir com cadastro
    return res.status(404).json({ 
      ok: true, 
      message: "CNPJ não cadastrado" 
    });
    
  } catch (error) {
    console.error('Erro ao verificar CNPJ:', error);
    return res.status(500).json({ 
      ok: false, 
      error: "Erro interno ao verificar CNPJ" 
    });
  }
});

// ENDPOINT EXISTente: Consulta CNPJ na API externa
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