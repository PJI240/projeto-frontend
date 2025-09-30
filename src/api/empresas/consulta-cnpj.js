import express from "express";
import axios from "axios";
import { onlyDigits } from "../utils/cnpj.js";
import { pool } from "../db.js"; // ← Importar a conexão com o banco

const router = express.Router();

router.post("/consulta-cnpj", async (req, res) => {
  let conn;
  try {
    const { cnpj } = req.body;
    const num = onlyDigits(cnpj);
    if (num.length !== 14) {
      return res.status(400).json({ ok: false, error: "CNPJ inválido" });
    }

    // CORREÇÃO: Primeiro verifica se já existe no banco de dados
    conn = await pool.getConnection();
    
    const [empresasExistentes] = await conn.query(
      "SELECT id, razao_social, nome_fantasia, cnpj, ativa FROM empresas WHERE cnpj = ? LIMIT 1",
      [num]
    );

    // Se já existe uma empresa com este CNPJ, retorna erro
    if (empresasExistentes.length > 0) {
      const empresaExistente = empresasExistentes[0];
      return res.status(400).json({ 
        ok: false, 
        error: "CNPJ já cadastrado",
        empresa_existente: {
          id: empresaExistente.id,
          razao_social: empresaExistente.razao_social,
          nome_fantasia: empresaExistente.nome_fantasia,
          ativa: empresaExistente.ativa
        }
      });
    }

    // Se não existe, consulta a ReceitaWS
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
    
    // CORREÇÃO: Mensagens de erro mais específicas
    let errorMessage = "Erro ao consultar CNPJ";
    
    if (e.code === 'ECONNABORTED') {
      errorMessage = "Tempo limite excedido na consulta";
    } else if (e.response?.status === 429) {
      errorMessage = "Limite de consultas excedido. Tente novamente em alguns instantes.";
    } else if (e.message.includes("getaddrinfo")) {
      errorMessage = "Erro de conexão com o serviço de consulta";
    }
    
    res.status(500).json({ ok: false, error: errorMessage });
  } finally {
    // CORREÇÃO: Liberar conexão sempre
    if (conn) conn.release();
  }
});

export default router;