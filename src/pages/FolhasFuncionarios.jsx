// src/pages/FolhasFuncionarios.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowPathIcon,
  CalculatorIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  CloudArrowDownIcon,
  ExclamationTriangleIcon,
  FunnelIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
  UserIcon,
  XMarkIcon
} from "@heroicons/react/24/outline";

const API_BASE = import.meta.env.VITE_API_BASE?.replace(/\/+$/, "") || "";

/* ========= UTILS ========= */
const norm = (v) => (v ?? "").toString().trim();

/** Converte para formato YYYY-MM */
function toYM(input) {
  const s = norm(input).toLowerCase();
  if (!s) return null;
  const mIso = s.match(/^(\d{4})-(\d{2})(?:-\d{2})?$/);
  if (mIso) return `${mIso[1]}-${mIso[2]}`;
  const meses = {
    "janeiro": "01", "fevereiro": "02", "março": "03", "marco": "03", 
    "abril": "04", "maio": "05", "junho": "06", "julho": "07", 
    "agosto": "08", "setembro": "09", "outubro": "10", "novembro": "11", "dezembro": "12"
  };
  const mBr = s.match(/(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro).*?(\d{4})/i);
  if (mBr) return `${mBr[2]}-${meses[mBr[1].toLowerCase()]}`;
  return null;
}

function monthISO(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }
function fromMonthISO(s) { const [y, m] = String(s || "").split("-").map(Number); return y && m ? new Date(y, m - 1, 1) : null; }
function formatMonthBR(sISO) { const d = fromMonthISO(sISO); return d ? d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) : sISO || ""; }

function toCSV(rows) {
  if (!rows?.length) return "";
  const keys = Object.keys(rows[0]);
  const header = keys.join(";");
  const body = rows.map((r) => keys.map((k) => `"${String(r[k] ?? "").replaceAll('"', '""')}"`).join(";")).join("\n");
  return header + "\n" + body;
}

const dec = (v) => { 
  if (v === "" || v == null) return 0;
  const x = Number(String(v).replace(",", ".")); 
  return Number.isFinite(x) ? x : 0; 
};

function money(n) { 
  const x = Number(n); 
  return Number.isFinite(x) ? x.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "R$ 0,00"; 
}

/* ========= API HELPER ========= */
function useApi() {
  return useCallback(async (path, init = {}) => {
    const url = `${API_BASE}${path}`;
    const r = await fetch(url, { 
      credentials: "include", 
      headers: {
        "Content-Type": "application/json",
        ...init.headers
      },
      ...init 
    });
    
    let data = null; 
    try { data = await r.json(); } catch {}
    
    if (!r.ok || data?.ok === false) {
      throw new Error(data?.error || `HTTP ${r.status}`);
    }
    
    return data;
  }, []);
}

/* ========= COMPONENTE PRINCIPAL ========= */
export default function FolhasFuncionarios() {
  const api = useApi();
  const liveRef = useRef(null);

  // Estado principal
  const [lista, setLista] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState("");

  // Filtros
  const [filtros, setFiltros] = useState({
    from: monthISO(new Date()),
    to: monthISO(new Date()),
    funcionario_id: "todos",
    q: ""
  });

  // Modal
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({
    competencia: monthISO(new Date()),
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
    inconsistencias: 0
  });
  const [salvando, setSalvando] = useState(false);

  /* ====== CARREGAMENTO ====== */
  const carregarFuncionarios = useCallback(async () => {
    try {
      const data = await api(`/api/funcionarios?ativos=1&limit=1000`);
      setFuncionarios(data.funcionarios || data.items || []);
    } catch (e) {
      console.error("Erro ao carregar funcionários:", e);
      setFuncionarios([]);
    }
  }, [api]);

  const carregarDados = useCallback(async () => {
    setLoading(true);
    setErr("");
    setSuccess("");
    
    try {
      const params = new URLSearchParams();
      const fromYM = toYM(filtros.from) || monthISO(new Date());
      const toYMVal = toYM(filtros.to) || monthISO(new Date());
      
      params.set("from", fromYM);
      params.set("to", toYMVal);
      
      if (filtros.q) params.set("q", filtros.q);
      if (filtros.funcionario_id && filtros.funcionario_id !== "todos") {
        params.set("funcionario_id", filtros.funcionario_id);
      }

      const data = await api(`/api/folhas-funcionarios?${params.toString()}`);
      setLista(Array.isArray(data.items) ? data.items : []);
      
      if (liveRef.current) {
        liveRef.current.textContent = `Lista atualizada. ${data.items?.length || 0} registros encontrados.`;
      }
    } catch (e) {
      setErr(`Erro: ${e.message}`);
      if (liveRef.current) liveRef.current.textContent = "Erro ao carregar dados.";
    } finally { 
      setLoading(false); 
    }
  }, [api, filtros]);

  useEffect(() => { 
    carregarFuncionarios(); 
  }, [carregarFuncionarios]);

  useEffect(() => { 
    carregarDados(); 
  }, [carregarDados]);

  /* ====== CÁLCULOS E FILTROS ====== */
  const dadosFiltrados = useMemo(() => {
    const qn = filtros.q.toLowerCase();
    const fromYM = toYM(filtros.from);
    const toYMVal = toYM(filtros.to);
    
    return lista.filter((item) => {
      // Filtro por funcionário
      if (filtros.funcionario_id !== "todos" && String(item.funcionario_id) !== filtros.funcionario_id) {
        return false;
      }
      
      // Filtro por período
      if (fromYM && item.competencia < fromYM) return false;
      if (toYMVal && item.competencia > toYMVal) return false;
      
      // Filtro por texto
      if (qn) {
        const textoBusca = `${item.id} ${item.funcionario_nome} ${item.competencia}`.toLowerCase();
        if (!textoBusca.includes(qn)) return false;
      }
      
      return true;
    });
  }, [lista, filtros]);

  const metricas = useMemo(() => {
    let totalHoras = 0;
    let totalLiquido = 0;
    const funcionariosUnicos = new Set();
    
    dadosFiltrados.forEach((item) => {
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

  /* ====== AÇÕES ====== */
  const abrirNovo = useCallback(() => {
    setEditando(null);
    setForm({
      competencia: monthISO(new Date()),
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
      inconsistencias: 0
    });
    setModalAberto(true);
    setErr("");
  }, []);

  const abrirEdicao = useCallback((registro) => {
    setEditando(registro);
    setForm({
      competencia: registro.competencia,
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
      inconsistencias: registro.inconsistencias ?? 0
    });
    setModalAberto(true);
    setErr("");
  }, []);

  const calcularTotal = useCallback((dados = form) => {
    return (
      dec(dados.valor_base) +
      dec(dados.valor_he50) +
      dec(dados.valor_he100) +
      dec(dados.proventos) -
      dec(dados.descontos)
    );
  }, [form]);

  const salvarRegistro = async () => {
    setSalvando(true);
    setErr("");
    setSuccess("");
    
    try {
      // Validações
      if (!form.funcionario_id) {
        throw new Error("Selecione um funcionário.");
      }
      
      if (!form.competencia) {
        throw new Error("Informe a competência.");
      }

      const competenciaYM = toYM(form.competencia) || form.competencia;
      
      const payload = {
        competencia: competenciaYM,
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
        inconsistencias: Number(form.inconsistencias || 0)
      };

      if (editando) {
        await api(`/api/folhas-funcionarios/${editando.id}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        });
        setSuccess("Registro atualizado com sucesso.");
      } else {
        await api(`/api/folhas-funcionarios`, {
          method: "POST",
          body: JSON.stringify(payload)
        });
        setSuccess("Registro criado com sucesso.");
      }
      
      setModalAberto(false);
      await carregarDados();
    } catch (e) {
      setErr(e.message || "Erro ao salvar registro.");
    } finally {
      setSalvando(false);
    }
  };

  const excluirRegistro = async (registro) => {
    if (!confirm(`Excluir o lançamento de ${registro.funcionario_nome} em ${formatMonthBR(registro.competencia)}?`)) {
      return;
    }
    
    setErr("");
    setSuccess("");
    
    try {
      await api(`/api/folhas-funcionarios/${registro.id}`, { method: "DELETE" });
      setSuccess("Registro excluído com sucesso.");
      await carregarDados();
    } catch (e) {
      setErr(e.message || "Erro ao excluir registro.");
    }
  };

  const exportarCSV = () => {
    const rows = dadosFiltrados.map((item) => ({
      id: item.id,
      competencia: item.competencia,
      competencia_br: formatMonthBR(item.competencia),
      funcionario_id: item.funcionario_id,
      funcionario_nome: item.funcionario_nome,
      horas_normais: item.horas_normais,
      he50_horas: item.he50_horas,
      he100_horas: item.he100_horas,
      valor_base: item.valor_base,
      valor_he50: item.valor_he50,
      valor_he100: item.valor_he100,
      descontos: item.descontos,
      proventos: item.proventos,
      total_liquido: item.total_liquido,
      inconsistencias: item.inconsistencias
    }));
    
    const csv = toCSV(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `folhas_funcionarios_${filtros.from}_a_${filtros.to}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const limparFiltros = () => {
    setFiltros({
      from: monthISO(new Date()),
      to: monthISO(new Date()),
      funcionario_id: "todos",
      q: ""
    });
  };

  /* ====== RENDER ====== */
  return (
    <>
      <div ref={liveRef} aria-live="polite" className="visually-hidden" />

      {/* Header */}
      <header className="main-header">
        <div className="header-content">
          <h1>Folhas × Funcionários</h1>
          <p>Lançamentos por funcionário (horas, valores e total líquido)</p>
        </div>

        <div className="toggles">
          <button
            className="toggle-btn"
            onClick={carregarDados}
            disabled={loading}
            aria-busy={loading ? "true" : "false"}
          >
            <ArrowPathIcon className={`icon-sm ${loading ? "animate-spin" : ""}`} />
            {loading ? "Atualizando..." : "Atualizar"}
          </button>
          <button className="toggle-btn" onClick={abrirNovo}>
            <PlusIcon className="icon-sm" />
            Novo
          </button>
          <button className="toggle-btn" onClick={exportarCSV}>
            <CloudArrowDownIcon className="icon-sm" />
            Exportar
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
        <div className="card" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <FunnelIcon className="icon-sm" />
          
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <label htmlFor="filtro-from" className="visually-hidden">De</label>
            <input
              id="filtro-from"
              type="month"
              value={filtros.from}
              onChange={(e) => setFiltros(prev => ({ ...prev, from: e.target.value }))}
              style={{ width: 140 }}
            />
            <span style={{ color: "var(--muted)" }}>até</span>
            <label htmlFor="filtro-to" className="visually-hidden">Até</label>
            <input
              id="filtro-to"
              type="month"
              value={filtros.to}
              onChange={(e) => setFiltros(prev => ({ ...prev, to: e.target.value }))}
              style={{ width: 140 }}
            />
          </div>

          <select
            value={filtros.funcionario_id}
            onChange={(e) => setFiltros(prev => ({ ...prev, funcionario_id: e.target.value }))}
            style={{ minWidth: 180 }}
          >
            <option value="todos">Todos os funcionários</option>
            {funcionarios.map((func) => (
              <option key={func.id} value={func.id}>
                {func.pessoa_nome || func.nome || func.pessoa?.nome || `Funcionário #${func.id}`}
              </option>
            ))}
          </select>

          <input
            aria-label="Buscar por funcionário ou competência"
            placeholder="Buscar por funcionário/competência..."
            value={filtros.q}
            onChange={(e) => setFiltros(prev => ({ ...prev, q: e.target.value }))}
            style={{ flex: 1, minWidth: 200, maxWidth: 300 }}
          />

          <button className="toggle-btn" onClick={limparFiltros}>
            <XMarkIcon className="icon-sm" />
            Limpar
          </button>
        </div>
      </section>

      {/* Métricas */}
      <section style={{ marginBottom: 20 }}>
        <div className="stats-grid">
          <div className="stat-card" data-accent="info">
            <div className="stat-card__icon">
              <UserIcon className="icon" />
            </div>
            <div className="stat-card__content">
              <div className="stat-value">{metricas.funcionarios}</div>
              <div className="stat-title">Funcionários impactados</div>
            </div>
          </div>

          <div className="stat-card" data-accent="success">
            <div className="stat-card__icon">
              <CalculatorIcon className="icon" />
            </div>
            <div className="stat-card__content">
              <div className="stat-value">{metricas.horas.toFixed(2)}</div>
              <div className="stat-title">Horas (N + 50% + 100%)</div>
            </div>
          </div>

          <div className="stat-card" data-accent="warning">
            <div className="stat-card__icon">
              <CheckCircleIcon className="icon" />
            </div>
            <div className="stat-card__content">
              <div className="stat-value">{money(metricas.liquido)}</div>
              <div className="stat-title">Total líquido (somado)</div>
            </div>
          </div>
        </div>
      </section>

      {/* Tabela */}
      <section>
        <div className="card">
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: "5%" }}>ID</th>
                  <th style={{ width: "12%" }}>Competência</th>
                  <th style={{ width: "18%" }}>Funcionário</th>
                  <th style={{ width: "6%" }} className="num">N</th>
                  <th style={{ width: "6%" }} className="num">HE 50%</th>
                  <th style={{ width: "7%" }} className="num">HE 100%</th>
                  <th style={{ width: "8%" }} className="num">Base</th>
                  <th style={{ width: "8%" }} className="num">+HE50</th>
                  <th style={{ width: "8%" }} className="num">+HE100</th>
                  <th style={{ width: "8%" }} className="num">+Prov.</th>
                  <th style={{ width: "8%" }} className="num">-Desc.</th>
                  <th style={{ width: "10%" }} className="num">Líquido</th>
                  <th style={{ width: "6%" }} className="num">Inc.</th>
                  <th style={{ width: "10%" }} className="text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={14} style={{ textAlign: "center", padding: "32px" }}>
                      Carregando...
                    </td>
                  </tr>
                ) : dadosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={14} style={{ textAlign: "center", padding: "32px", color: "var(--muted)" }}>
                      Nenhum lançamento encontrado para os filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  dadosFiltrados.map((item) => (
                    <tr key={item.id}>
                      <td><code>#{item.id}</code></td>
                      <td>
                        <div>{formatMonthBR(item.competencia)}</div>
                        <div style={{ fontSize: "var(--fs-12)", color: "var(--muted)" }}>
                          {item.competencia}
                        </div>
                      </td>
                      <td>{item.funcionario_nome}</td>
                      <td className="num">{dec(item.horas_normais).toFixed(2)}</td>
                      <td className="num">{dec(item.he50_horas).toFixed(2)}</td>
                      <td className="num">{dec(item.he100_horas).toFixed(2)}</td>
                      <td className="num">{money(item.valor_base)}</td>
                      <td className="num">{money(item.valor_he50)}</td>
                      <td className="num">{money(item.valor_he100)}</td>
                      <td className="num">{money(item.proventos)}</td>
                      <td className="num">{money(item.descontos)}</td>
                      <td className="num">
                        <strong>{money(item.total_liquido)}</strong>
                      </td>
                      <td className="num">
                        {item.inconsistencias ? (
                          <span style={{ color: "var(--error)" }}>{item.inconsistencias}</span>
                        ) : (
                          item.inconsistencias || 0
                        )}
                      </td>
                      <td className="text-right">
                        <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                          <button
                            className="toggle-btn"
                            onClick={() => abrirEdicao(item)}
                            title="Editar"
                          >
                            <PencilSquareIcon className="icon-sm" />
                          </button>
                          <button
                            className="toggle-btn"
                            onClick={() => excluirRegistro(item)}
                            title="Excluir"
                          >
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
          
          {!loading && dadosFiltrados.length > 0 && (
            <p style={{ marginTop: 12, color: "var(--muted)", fontSize: "var(--fs-14)" }}>
              Mostrando {dadosFiltrados.length} de {lista.length} registros
              {filtros.q || filtros.funcionario_id !== "todos" ? " (filtrados)" : ""}
            </p>
          )}
        </div>
      </section>

      {/* Modal */}
      {modalAberto && (
        <div 
          className="modal-overlay" 
          onClick={(e) => e.target === e.currentTarget && setModalAberto(false)}
        >
          <div className="modal-content" style={{ maxWidth: 800 }}>
            <header className="modal-header">
              <h2 className="modal-title">
                {editando ? "Editar Lançamento" : "Novo Lançamento"}
              </h2>
              <button
                className="toggle-btn"
                onClick={() => setModalAberto(false)}
                aria-label="Fechar"
              >
                <XMarkIcon className="icon-sm" />
              </button>
            </header>

            <div className="modal-body">
              <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                <div className="form-field">
                  <label className="form-label">Competência *</label>
                  <input
                    type="month"
                    value={form.competencia}
                    onChange={(e) => setForm(prev => ({ ...prev, competencia: e.target.value }))}
                    required
                  />
                </div>

                <div className="form-field">
                  <label className="form-label">Funcionário *</label>
                  <select
                    value={form.funcionario_id}
                    onChange={(e) => setForm(prev => ({ ...prev, funcionario_id: e.target.value }))}
                    required
                  >
                    <option value="">Selecione um funcionário...</option>
                    {funcionarios.map((func) => (
                      <option key={func.id} value={func.id}>
                        {func.pessoa_nome || func.nome || func.pessoa?.nome || `Funcionário #${func.id}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label className="form-label">Horas Normais</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={form.horas_normais}
                    onChange={(e) => setForm(prev => ({ ...prev, horas_normais: e.target.value }))}
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
                  />
                </div>

                <div className="form-field">
                  <label className="form-label">Inconsistências</label>
                  <input
                    type="number"
                    min="0"
                    value={form.inconsistencias}
                    onChange={(e) => setForm(prev => ({ ...prev, inconsistencias: Number(e.target.value) }))}
                  />
                </div>
              </div>

              <div style={{ marginTop: 16, padding: 12, background: "var(--info-soft)", borderRadius: "var(--radius)" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <ExclamationTriangleIcon className="icon-sm" style={{ color: "var(--info)", marginTop: 2 }} />
                  <div style={{ fontSize: "var(--fs-14)", color: "var(--muted)" }}>
                    <strong>Dica:</strong> O total líquido é calculado automaticamente quando você altera 
                    valores base, horas extras, proventos ou descontos. Você pode ajustar manualmente se necessário.
                  </div>
                </div>
              </div>
            </div>

            <footer className="modal-footer">
              <button
                className="toggle-btn"
                onClick={() => setModalAberto(false)}
                disabled={salvando}
              >
                Cancelar
              </button>
              <button
                className="toggle-btn"
                onClick={salvarRegistro}
                disabled={salvando || !form.funcionario_id || !form.competencia}
                aria-busy={salvando ? "true" : "false"}
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