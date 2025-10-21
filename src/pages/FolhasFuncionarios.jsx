// src/pages/FolhasFuncionarios.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowPathIcon,
  CalculatorIcon,
  CheckCircleIcon,
  CloudArrowDownIcon,
  ExclamationTriangleIcon,
  FunnelIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
  UserIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

const API_BASE = (import.meta.env.VITE_API_BASE?.replace(/\/+$/, "") || "");

/* ===================== Utils ===================== */
const norm = (v) => (v ?? "").toString().trim();
const monthISO = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

const formatMonthBR = (ym) => {
  const [y, m] = String(ym || "").split("-").map(Number);
  if (!y || !m) return ym || "";
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
};

const dec = (v) => {
  if (v === "" || v == null) return 0;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const money = (n) => {
  const num = Number(n);
  return Number.isFinite(num) 
    ? num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) 
    : "R$ 0,00";
};

/* ===================== API helper ===================== */
function useApi() {
  return useCallback(async (path, init = {}) => {
    const url = `${API_BASE}${path}`;
    const r = await fetch(url, {
      credentials: "include",
      headers: { 
        "Content-Type": "application/json", 
        ...(init.headers || {}) 
      },
      ...init,
    });
    
    let data = null;
    try {
      data = await r.json();
    } catch (e) {
      console.error("Parse error:", e);
      throw new Error("Resposta inválida do servidor");
    }
    
    if (!r.ok || data?.ok === false) {
      throw new Error(data?.error || `Erro ${r.status}`);
    }
    
    return data;
  }, []);
}

/* ===================== Página ===================== */
export default function FolhasFuncionarios() {
  const api = useApi();
  const liveRef = useRef(null);

  // Estado
  const [lista, setLista] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [folhas, setFolhas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState("");

  // Filtros SIMPLIFICADOS
  const [filtros, setFiltros] = useState({
    folha_id: "",
    funcionario_id: "todos",
    q: ""
  });

  // Modal
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState({
    folha_id: "",
    funcionario_id: "",
    horas_normais: "",
    he50_horas: "",
    he100_horas: "",
    valor_base: "",
    valor_he50: "",
    valor_he100: "",
    descontos: "",
    proventos: "",
    total_liquido: "",
    inconsistencias: 0,
  });

  /* ===================== Carregamentos ===================== */
  const carregarFuncionarios = useCallback(async () => {
    try {
      const data = await api(`/api/funcionarios?ativos=1`);
      setFuncionarios(data.funcionarios || data.items || []);
    } catch (e) {
      console.error("Erro funcionários:", e);
      setFuncionarios([]);
    }
  }, [api]);

  const carregarFolhas = useCallback(async () => {
    try {
      const data = await api(`/api/folhas?limit=1000`);
      setFolhas(data.folhas || data.items || []);
    } catch (e) {
      console.error("Erro folhas:", e);
      setFolhas([]);
    }
  }, [api]);

  const carregarLancamentos = useCallback(async () => {
    setLoading(true);
    setErr("");
    setSuccess("");
    
    try {
      const params = new URLSearchParams();
      
      // APENAS folha_id é obrigatório para o backend
      if (filtros.folha_id) {
        params.set("folha_id", filtros.folha_id);
      }
      
      // Filtros opcionais
      if (filtros.funcionario_id && filtros.funcionario_id !== "todos") {
        params.set("funcionario_id", filtros.funcionario_id);
      }
      if (filtros.q) {
        params.set("q", filtros.q.trim());
      }

      console.log("Carregando com params:", params.toString());

      const data = await api(`/api/folhas-funcionarios?${params.toString()}`);
      setLista(Array.isArray(data.items) ? data.items : []);
      
      if (liveRef.current) {
        liveRef.current.textContent = `Carregados ${data.items?.length || 0} registros`;
      }
    } catch (e) {
      console.error("Erro lançamentos:", e);
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [api, filtros]);

  // Carregar dados iniciais
  useEffect(() => {
    carregarFuncionarios();
    carregarFolhas();
  }, [carregarFuncionarios, carregarFolhas]);

  // Carregar quando filtros mudarem
  useEffect(() => {
    carregarLancamentos();
  }, [carregarLancamentos]);

  /* ===================== Cálculos e Filtros ===================== */
  const dadosFiltrados = useMemo(() => {
    // Filtro local apenas por busca textual
    if (!filtros.q) return lista;
    
    const termo = filtros.q.toLowerCase();
    return lista.filter(item => 
      item.funcionario_nome.toLowerCase().includes(termo) ||
      item.competencia.includes(termo) ||
      String(item.id).includes(termo)
    );
  }, [lista, filtros.q]);

  const metricas = useMemo(() => {
    let totalHoras = 0;
    let totalLiquido = 0;
    const funcionariosUnicos = new Set();
    
    dadosFiltrados.forEach(item => {
      totalHoras += dec(item.horas_normais) + dec(item.he50_horas) + dec(item.he100_horas);
      totalLiquido += dec(item.total_liquido);
      funcionariosUnicos.add(item.funcionario_id);
    });
    
    return {
      horas: totalHoras,
      liquido: totalLiquido,
      funcionarios: funcionariosUnicos.size,
      registros: dadosFiltrados.length
    };
  }, [dadosFiltrados]);

  /* ===================== Ações ===================== */
  const calcularTotal = useCallback((dados = form) => {
    return (
      dec(dados.valor_base) +
      dec(dados.valor_he50) +
      dec(dados.valor_he100) +
      dec(dados.proventos) -
      dec(dados.descontos)
    );
  }, [form]);

  const abrirNovo = useCallback(() => {
    setEditando(null);
    setForm({
      folha_id: filtros.folha_id || "", // Pré-seleciona a folha atual
      funcionario_id: "",
      horas_normais: "",
      he50_horas: "",
      he100_horas: "",
      valor_base: "",
      valor_he50: "",
      valor_he100: "",
      descontos: "",
      proventos: "",
      total_liquido: "",
      inconsistencias: 0,
    });
    setModalAberto(true);
    setErr("");
    setSuccess("");
  }, [filtros.folha_id]);

  const abrirEdicao = useCallback((registro) => {
    setEditando(registro);
    setForm({
      folha_id: registro.folha_id,
      funcionario_id: registro.funcionario_id,
      horas_normais: registro.horas_normais ?? "",
      he50_horas: registro.he50_horas ?? "",
      he100_horas: registro.he100_horas ?? "",
      valor_base: registro.valor_base ?? "",
      valor_he50: registro.valor_he50 ?? "",
      valor_he100: registro.valor_he100 ?? "",
      descontos: registro.descontos ?? "",
      proventos: registro.proventos ?? "",
      total_liquido: registro.total_liquido ?? "",
      inconsistencias: registro.inconsistencias ?? 0,
    });
    setModalAberto(true);
    setErr("");
    setSuccess("");
  }, []);

  const salvarRegistro = async () => {
    setSalvando(true);
    setErr("");
    setSuccess("");
    
    try {
      // Validações
      if (!form.folha_id) throw new Error("Selecione a folha.");
      if (!form.funcionario_id) throw new Error("Selecione o funcionário.");

      const payload = {
        folha_id: Number(form.folha_id),
        funcionario_id: Number(form.funcionario_id),
        horas_normais: form.horas_normais === "" ? null : dec(form.horas_normais),
        he50_horas: form.he50_horas === "" ? null : dec(form.he50_horas),
        he100_horas: form.he100_horas === "" ? null : dec(form.he100_horas),
        valor_base: form.valor_base === "" ? null : dec(form.valor_base),
        valor_he50: form.valor_he50 === "" ? null : dec(form.valor_he50),
        valor_he100: form.valor_he100 === "" ? null : dec(form.valor_he100),
        descontos: form.descontos === "" ? null : dec(form.descontos),
        proventos: form.proventos === "" ? null : dec(form.proventos),
        total_liquido: form.total_liquido === "" ? calcularTotal() : dec(form.total_liquido),
        inconsistencias: Number(form.inconsistencias || 0),
      };

      if (editando) {
        await api(`/api/folhas-funcionarios/${editando.id}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        });
        setSuccess("Registro atualizado com sucesso!");
      } else {
        await api(`/api/folhas-funcionarios`, {
          method: "POST",
          body: JSON.stringify(payload)
        });
        setSuccess("Registro criado com sucesso!");
      }
      
      setModalAberto(false);
      await carregarLancamentos();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSalvando(false);
    }
  };

  const excluirRegistro = async (registro) => {
    if (!confirm(`Excluir lançamento de ${registro.funcionario_nome}?`)) return;
    
    setErr("");
    setSuccess("");
    
    try {
      await api(`/api/folhas-funcionarios/${registro.id}`, { method: "DELETE" });
      setSuccess("Registro excluído com sucesso!");
      await carregarLancamentos();
    } catch (e) {
      setErr(e.message);
    }
  };

  const exportarCSV = () => {
    if (dadosFiltrados.length === 0) {
      setErr("Nenhum dado para exportar");
      return;
    }

    const headers = [
      "ID", "Competencia", "Funcionario_ID", "Funcionario_Nome", 
      "Horas_Normais", "HE_50", "HE_100", "Valor_Base", "Valor_HE50", 
      "Valor_HE100", "Proventos", "Descontos", "Total_Liquido", "Inconsistencias"
    ];
    
    const rows = dadosFiltrados.map(item => [
      item.id,
      item.competencia,
      item.funcionario_id,
      item.funcionario_nome,
      item.horas_normais,
      item.he50_horas,
      item.he100_horas,
      item.valor_base,
      item.valor_he50,
      item.valor_he100,
      item.proventos,
      item.descontos,
      item.total_liquido,
      item.inconsistencias
    ]);

    const csvContent = [
      headers.join(";"),
      ...rows.map(row => row.map(cell => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(";"))
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `folhas_funcionarios_${filtros.folha_id || "geral"}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const limparFiltros = () => {
    setFiltros({
      folha_id: "",
      funcionario_id: "todos",
      q: ""
    });
  };

  /* ===================== Render ===================== */
  return (
    <>
      <div ref={liveRef} aria-live="polite" className="sr-only" />

      {/* Header */}
      <header className="main-header">
        <div className="header-content">
          <h1>Folhas × Funcionários</h1>
          <p>Lançamentos por funcionário (horas, valores e total líquido)</p>
        </div>

        <div className="toggles">
          <button
            className="toggle-btn"
            onClick={carregarLancamentos}
            disabled={loading}
            aria-busy={loading}
          >
            <ArrowPathIcon className={`icon-sm ${loading ? "animate-spin" : ""}`} />
            {loading ? "Atualizando..." : "Atualizar"}
          </button>
          <button 
            className="toggle-btn" 
            onClick={exportarCSV}
            disabled={dadosFiltrados.length === 0}
          >
            <CloudArrowDownIcon className="icon-sm" />
            Exportar
          </button>
          <button 
            className="toggle-btn" 
            onClick={abrirNovo}
            disabled={!filtros.folha_id}
          >
            <PlusIcon className="icon-sm" />
            Novo
          </button>
        </div>
      </header>

      {/* Alertas */}
      {err && (
        <div className="error-alert" role="alert" style={{ marginBottom: 16 }}>
          {err}
        </div>
      )}
      {success && (
        <div className="success-alert" role="status" style={{ marginBottom: 16 }}>
          {success}
        </div>
      )}

      {/* Filtros */}
      <section style={{ marginBottom: 16 }}>
        <div className="card" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", padding: 16 }}>
          <FunnelIcon className="icon-sm" style={{ color: "var(--muted)" }} />
          
          <select
            value={filtros.folha_id}
            onChange={(e) => setFiltros(prev => ({ ...prev, folha_id: e.target.value }))}
            style={{ minWidth: 200 }}
            aria-label="Selecionar folha"
          >
            <option value="">Selecione uma folha...</option>
            {folhas.map(folha => (
              <option key={folha.id} value={folha.id}>
                {formatMonthBR(folha.competencia)} (ID: {folha.id})
              </option>
            ))}
          </select>

          <select
            value={filtros.funcionario_id}
            onChange={(e) => setFiltros(prev => ({ ...prev, funcionario_id: e.target.value }))}
            style={{ minWidth: 180 }}
            aria-label="Filtrar por funcionário"
          >
            <option value="todos">Todos os funcionários</option>
            {funcionarios.map(func => (
              <option key={func.id} value={func.id}>
                {func.pessoa_nome || func.nome || func.pessoa?.nome || `Funcionário #${func.id}`}
              </option>
            ))}
          </select>

          <input
            type="search"
            placeholder="Buscar..."
            value={filtros.q}
            onChange={(e) => setFiltros(prev => ({ ...prev, q: e.target.value }))}
            style={{ flex: 1, minWidth: 200, maxWidth: 300 }}
            aria-label="Buscar"
          />

          <button 
            className="toggle-btn" 
            onClick={limparFiltros}
          >
            <XMarkIcon className="icon-sm" />
            Limpar
          </button>
        </div>
      </section>

      {/* KPIs */}
      {filtros.folha_id && (
        <section style={{ marginBottom: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
            <div className="card" style={{ padding: 20, borderLeft: "4px solid var(--info)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 48, height: 48, borderRadius: 8, background: "var(--info-soft)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <UserIcon className="icon" style={{ color: "var(--info)", width: 24, height: 24 }} />
                </div>
                <div>
                  <div style={{ fontSize: "1.5rem", fontWeight: "bold", lineHeight: 1 }}>{metricas.funcionarios}</div>
                  <div style={{ fontSize: "0.875rem", color: "var(--muted)", fontWeight: 600 }}>Funcionários impactados</div>
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: 20, borderLeft: "4px solid var(--success)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 48, height: 48, borderRadius: 8, background: "var(--success-soft)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <CalculatorIcon className="icon" style={{ color: "var(--success)", width: 24, height: 24 }} />
                </div>
                <div>
                  <div style={{ fontSize: "1.5rem", fontWeight: "bold", lineHeight: 1 }}>{metricas.horas.toFixed(2)}</div>
                  <div style={{ fontSize: "0.875rem", color: "var(--muted)", fontWeight: 600 }}>Horas (N + 50% + 100%)</div>
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: 20, borderLeft: "4px solid var(--warning)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 48, height: 48, borderRadius: 8, background: "var(--warning-soft)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <CheckCircleIcon className="icon" style={{ color: "var(--warning)", width: 24, height: 24 }} />
                </div>
                <div>
                  <div style={{ fontSize: "1.5rem", fontWeight: "bold", lineHeight: 1 }}>{money(metricas.liquido)}</div>
                  <div style={{ fontSize: "0.875rem", color: "var(--muted)", fontWeight: 600 }}>Total líquido (somado)</div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Tabela */}
      <section>
        <div className="card">
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Competência</th>
                  <th>Funcionário</th>
                  <th className="num">N</th>
                  <th className="num">HE 50%</th>
                  <th className="num">HE 100%</th>
                  <th className="num">Base</th>
                  <th className="num">+HE50</th>
                  <th className="num">+HE100</th>
                  <th className="num">+Prov.</th>
                  <th className="num">-Desc.</th>
                  <th className="num">Líquido</th>
                  <th className="num">Inc.</th>
                  <th className="text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={14} style={{ textAlign: "center", padding: "40px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                        <ArrowPathIcon className="icon-sm animate-spin" />
                        Carregando...
                      </div>
                    </td>
                  </tr>
                ) : !filtros.folha_id ? (
                  <tr>
                    <td colSpan={14} style={{ textAlign: "center", padding: "40px", color: "var(--muted)" }}>
                      Selecione uma folha para visualizar os lançamentos
                    </td>
                  </tr>
                ) : dadosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={14} style={{ textAlign: "center", padding: "40px", color: "var(--muted)" }}>
                      Nenhum lançamento encontrado para os filtros aplicados
                    </td>
                  </tr>
                ) : (
                  dadosFiltrados.map((item) => (
                    <tr key={item.id}>
                      <td><code>#{item.id}</code></td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{formatMonthBR(item.competencia)}</div>
                        <div style={{ fontSize: "var(--fs-12)", color: "var(--muted)" }}>{item.competencia}</div>
                      </td>
                      <td style={{ fontWeight: 500 }}>{item.funcionario_nome}</td>
                      <td className="num">{dec(item.horas_normais).toFixed(2)}</td>
                      <td className="num">{dec(item.he50_horas).toFixed(2)}</td>
                      <td className="num">{dec(item.he100_horas).toFixed(2)}</td>
                      <td className="num">{money(item.valor_base)}</td>
                      <td className="num">{money(item.valor_he50)}</td>
                      <td className="num">{money(item.valor_he100)}</td>
                      <td className="num">{money(item.proventos)}</td>
                      <td className="num">{money(item.descontos)}</td>
                      <td className="num"><strong>{money(item.total_liquido)}</strong></td>
                      <td className="num">{item.inconsistencias || 0}</td>
                      <td className="text-right">
                        <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                          <button className="toggle-btn" onClick={() => abrirEdicao(item)} title="Editar">
                            <PencilSquareIcon className="icon-sm" />
                          </button>
                          <button className="toggle-btn" onClick={() => excluirRegistro(item)} title="Excluir">
                            <TrashIcon className="icon-sm" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Modal */}
      {modalAberto && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && !salvando && setModalAberto(false)}>
          <div className="modal-content" style={{ maxWidth: 800 }}>
            <header className="modal-header">
              <h2 className="modal-title">{editando ? "Editar Lançamento" : "Novo Lançamento"}</h2>
              <button className="toggle-btn" onClick={() => !salvando && setModalAberto(false)} aria-label="Fechar">
                <XMarkIcon className="icon-sm" />
              </button>
            </header>

            <div className="modal-body">
              <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div className="form-field">
                  <label className="form-label">Folha *</label>
                  <select
                    value={form.folha_id}
                    onChange={(e) => setForm(prev => ({ ...prev, folha_id: e.target.value }))}
                    required
                    disabled={salvando || !!editando}
                  >
                    <option value="">Selecione...</option>
                    {folhas.map(folha => (
                      <option key={folha.id} value={folha.id}>
                        {formatMonthBR(folha.competencia)} (ID: {folha.id})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label className="form-label">Funcionário *</label>
                  <select
                    value={form.funcionario_id}
                    onChange={(e) => setForm(prev => ({ ...prev, funcionario_id: e.target.value }))}
                    required
                    disabled={salvando}
                  >
                    <option value="">Selecione...</option>
                    {funcionarios.map(func => (
                      <option key={func.id} value={func.id}>
                        {func.pessoa_nome || func.nome || func.pessoa?.nome || `Funcionário #${func.id}`}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Campos do formulário... (mantenha igual ao anterior) */}
                <div className="form-field">
                  <label className="form-label">Horas Normais</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={form.horas_normais}
                    onChange={(e) => setForm(prev => ({ ...prev, horas_normais: e.target.value }))}
                    disabled={salvando}
                  />
                </div>

                <div className="form-field">
                  <label className="form-label">HE 50% (horas)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={form.he50_horas}
                    onChange={(e) => setForm(prev => ({ ...prev, he50_horas: e.target.value }))}
                    disabled={salvando}
                  />
                </div>

                <div className="form-field">
                  <label className="form-label">HE 100% (horas)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={form.he100_horas}
                    onChange={(e) => setForm(prev => ({ ...prev, he100_horas: e.target.value }))}
                    disabled={salvando}
                  />
                </div>

                <div className="form-field">
                  <label className="form-label">Valor Base</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={form.valor_base}
                    onChange={(e) => {
                      const novoForm = { ...form, valor_base: e.target.value };
                      setForm({
                        ...novoForm,
                        total_liquido: calcularTotal(novoForm).toFixed(2)
                      });
                    }}
                    disabled={salvando}
                  />
                </div>

                <div className="form-field">
                  <label className="form-label">Valor HE 50%</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={form.valor_he50}
                    onChange={(e) => {
                      const novoForm = { ...form, valor_he50: e.target.value };
                      setForm({
                        ...novoForm,
                        total_liquido: calcularTotal(novoForm).toFixed(2)
                      });
                    }}
                    disabled={salvando}
                  />
                </div>

                <div className="form-field">
                  <label className="form-label">Valor HE 100%</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={form.valor_he100}
                    onChange={(e) => {
                      const novoForm = { ...form, valor_he100: e.target.value };
                      setForm({
                        ...novoForm,
                        total_liquido: calcularTotal(novoForm).toFixed(2)
                      });
                    }}
                    disabled={salvando}
                  />
                </div>

                <div className="form-field">
                  <label className="form-label">Proventos (+)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={form.proventos}
                    onChange={(e) => {
                      const novoForm = { ...form, proventos: e.target.value };
                      setForm({
                        ...novoForm,
                        total_liquido: calcularTotal(novoForm).toFixed(2)
                      });
                    }}
                    disabled={salvando}
                  />
                </div>

                <div className="form-field">
                  <label className="form-label">Descontos (-)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={form.descontos}
                    onChange={(e) => {
                      const novoForm = { ...form, descontos: e.target.value };
                      setForm({
                        ...novoForm,
                        total_liquido: calcularTotal(novoForm).toFixed(2)
                      });
                    }}
                    disabled={salvando}
                  />
                </div>

                <div className="form-field">
                  <label className="form-label">Total Líquido</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={form.total_liquido}
                    onChange={(e) => setForm(prev => ({ ...prev, total_liquido: e.target.value }))}
                    disabled={salvando}
                  />
                </div>

                <div className="form-field">
                  <label className="form-label">Inconsistências</label>
                  <input
                    type="number"
                    min="0"
                    value={form.inconsistencias}
                    onChange={(e) => setForm(prev => ({ ...prev, inconsistencias: Number(e.target.value) }))}
                    disabled={salvando}
                  />
                </div>
              </div>
            </div>

            <footer className="modal-footer">
              <button className="toggle-btn" onClick={() => setModalAberto(false)} disabled={salvando}>
                Cancelar
              </button>
              <button
                className="toggle-btn"
                onClick={salvarRegistro}
                disabled={salvando || !form.folha_id || !form.funcionario_id}
                aria-busy={salvando}
              >
                <CheckCircleIcon className="icon-sm" />
                {salvando ? "Salvando..." : (editando ? "Salvar" : "Criar")}
              </button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}