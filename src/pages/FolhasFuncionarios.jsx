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

const API_BASE = import.meta.env.VITE_API_BASE?.replace(/\/+$/, "") || "";

/* ===================== Utils ===================== */
const norm = (v) => (v ?? "").toString().trim();

function toYM(input) {
  const s = norm(input).toLowerCase();
  if (!s) return null;
  const mIso = s.match(/^(\d{4})-(\d{2})(?:-\d{2})?$/);
  if (mIso) return `${mIso[1]}-${mIso[2]}`;
  const meses = {
    janeiro: "01",
    fevereiro: "02",
    março: "03",
    marco: "03",
    abril: "04",
    maio: "05",
    junho: "06",
    julho: "07",
    agosto: "08",
    setembro: "09",
    outubro: "10",
    novembro: "11",
    dezembro: "12",
  };
  const mBr = s.match(
    /(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro).*?(\d{4})/i
  );
  if (mBr) return `${mBr[2]}-${meses[mBr[1].toLowerCase()]}`;
  return null;
}

function monthISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthBR(sISO) {
  const [y, m] = String(sISO || "").split("-").map(Number);
  if (!y || !m) return sISO || "";
  const date = new Date(y, m - 1, 1);
  return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

const dec = (v) => {
  if (v === "" || v == null) return 0;
  const num = Number(String(v).replace(/[^\d,-]/g, "").replace(",", "."));
  return Number.isFinite(num) ? num : 0;
};

function money(n) {
  const num = Number(n);
  return Number.isFinite(num)
    ? num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "R$ 0,00";
}

/* ===================== API helper ===================== */
function useApi() {
  return useCallback(async (path, init = {}) => {
    const url = `${API_BASE}${path}`;
    const r = await fetch(url, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...init.headers,
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
      const errorMsg = data?.error || `Erro ${r.status}`;
      throw new Error(errorMsg);
    }

    return data;
  }, []);
}

/* ===================== Página ===================== */
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
    q: "",
  });

  // Modal/form
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [salvando, setSalvando] = useState(false);
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
    inconsistencias: 0,
  });

  /* ===================== Carregamento ===================== */
  const carregarFuncionarios = useCallback(async () => {
    try {
      const data = await api(`/api/funcionarios?ativos=1`);
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
      const fromYM = filtros.from || monthISO(new Date());
      const toYMVal = filtros.to || monthISO(new Date());

      params.set("from", toYM(fromYM) || fromYM);
      params.set("to", toYM(toYMVal) || toYMVal);

      if (filtros.q) params.set("q", filtros.q.trim());
      if (filtros.funcionario_id && filtros.funcionario_id !== "todos") {
        params.set("funcionario_id", filtros.funcionario_id);
      }

      const data = await api(`/api/folhas-funcionarios?${params.toString()}`);
      setLista(Array.isArray(data.items) ? data.items : []);

      if (liveRef.current) {
        liveRef.current.textContent = `Lista atualizada. ${
          data.items?.length || 0
        } registros encontrados.`;
      }
    } catch (e) {
      console.error("Erro ao carregar dados:", e);
      setErr(e.message);
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

  /* ===================== Memo ===================== */
  const dadosFiltrados = useMemo(() => {
    return lista.filter((item) => {
      if (
        filtros.funcionario_id !== "todos" &&
        String(item.funcionario_id) !== filtros.funcionario_id
      ) {
        return false;
      }
      const fromYM = toYM(filtros.from);
      const toYMVal = toYM(filtros.to);
      if (fromYM && item.competencia < fromYM) return false;
      if (toYMVal && item.competencia > toYMVal) return false;

      if (filtros.q.trim()) {
        const termo = filtros.q.toLowerCase().trim();
        const textoBusca = `${item.id} ${item.funcionario_nome} ${item.competencia}`.toLowerCase();
        if (!textoBusca.includes(termo)) return false;
      }
      return true;
    });
  }, [lista, filtros]);

  const metricas = useMemo(() => {
    let totalHoras = 0;
    let totalLiquido = 0;
    const funcionariosUnicos = new Set();

    dadosFiltrados.forEach((item) => {
      totalHoras +=
        dec(item.horas_normais) + dec(item.he50_horas) + dec(item.he100_horas);
      totalLiquido += dec(item.total_liquido);
      funcionariosUnicos.add(item.funcionario_id);
    });

    return {
      horas: totalHoras,
      liquido: totalLiquido,
      funcionarios: funcionariosUnicos.size,
      registros: dadosFiltrados.length,
    };
  }, [dadosFiltrados]);

  /* ===================== Ações do formulário ===================== */
  const calcularTotal = useCallback(
    (dados = form) => {
      return (
        dec(dados.valor_base) +
        dec(dados.valor_he50) +
        dec(dados.valor_he100) +
        dec(dados.proventos) -
        dec(dados.descontos)
      );
    },
    [form]
  );

  const atualizarCampoComCalculo = useCallback(
    (campo, valor) => {
      const novoForm = { ...form, [campo]: valor };
      const novoTotal = calcularTotal(novoForm);
      setForm({
        ...novoForm,
        total_liquido: novoTotal.toFixed(2),
      });
    },
    [form, calcularTotal]
  );

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
      inconsistencias: 0,
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
      inconsistencias: registro.inconsistencias ?? 0,
    });
    setModalAberto(true);
    setErr("");
  }, []);

  const salvarRegistro = async () => {
    setSalvando(true);
    setErr("");
    setSuccess("");

    try {
      if (!form.funcionario_id) throw new Error("Selecione um funcionário.");
      if (!form.competencia) throw new Error("Informe a competência.");

      const competenciaYM = toYM(form.competencia) || form.competencia;
      const prepararValor = (valor) => (valor === "" ? null : dec(valor));

      const payload = {
        competencia: competenciaYM,
        funcionario_id: Number(form.funcionario_id),
        horas_normais: prepararValor(form.horas_normais),
        he50_horas: prepararValor(form.he50_horas),
        he100_horas: prepararValor(form.he100_horas),
        valor_base: prepararValor(form.valor_base),
        valor_he50: prepararValor(form.valor_he50),
        valor_he100: prepararValor(form.valor_he100),
        descontos: prepararValor(form.descontos),
        proventos: prepararValor(form.proventos),
        total_liquido: prepararValor(form.total_liquido),
        inconsistencias: Number(form.inconsistencias || 0),
      };

      if (editando) {
        await api(`/api/folhas-funcionarios/${editando.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        setSuccess("Registro atualizado com sucesso.");
      } else {
        await api(`/api/folhas-funcionarios`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setSuccess("Registro criado com sucesso.");
      }

      setModalAberto(false);
      await carregarDados();
    } catch (e) {
      console.error("Erro ao salvar:", e);
      setErr(e.message);
    } finally {
      setSalvando(false);
    }
  };

  const excluirRegistro = async (registro) => {
    if (
      !confirm(
        `Excluir o lançamento de ${registro.funcionario_nome} em ${formatMonthBR(
          registro.competencia
        )}?`
      )
    ) {
      return;
    }

    setErr("");
    setSuccess("");

    try {
      await api(`/api/folhas-funcionarios/${registro.id}`, { method: "DELETE" });
      setSuccess("Registro excluído com sucesso.");
      await carregarDados();
    } catch (e) {
      setErr(e.message);
    }
  };

  const exportarCSV = () => {
    if (dadosFiltrados.length === 0) {
      setErr("Nenhum dado para exportar.");
      return;
    }

    const rows = dadosFiltrados.map((item) => ({
      ID: item.id,
      Competencia: item.competencia,
      Competencia_BR: formatMonthBR(item.competencia),
      Funcionario_ID: item.funcionario_id,
      Funcionario_Nome: item.funcionario_nome,
      Horas_Normais: item.horas_normais,
      HE_50: item.he50_horas,
      HE_100: item.he100_horas,
      Valor_Base: item.valor_base,
      Valor_HE50: item.valor_he50,
      Valor_HE100: item.valor_he100,
      Descontos: item.descontos,
      Proventos: item.proventos,
      Total_Liquido: item.total_liquido,
      Inconsistencias: item.inconsistencias,
    }));

    const headers = Object.keys(rows[0]);
    const csvContent = [
      headers.join(";"),
      ...rows.map((row) =>
        headers
          .map((header) => `"${String(row[header] ?? "").replace(/"/g, '""')}"`)
          .join(";")
      ),
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `folhas_funcionarios_${filtros.from}_a_${filtros.to}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const limparFiltros = () => {
    setFiltros({
      from: monthISO(new Date()),
      to: monthISO(new Date()),
      funcionario_id: "todos",
      q: "",
    });
  };

  /* =============== Handlers de Acessibilidade =============== */
  const onModalKeyDown = (e) => {
    if (e.key === "Escape" && !salvando) setModalAberto(false);
  };

  /* ===================== Render ===================== */
  return (
    <>
      {/* Região viva para feedbacks */}
      <div ref={liveRef} aria-live="polite" className="visually-hidden" />

      {/* Header */}
      <header className="main-header page-header">
        <div className="header-content">
          <h1 className="page-title">Folhas × Funcionários</h1>
          <p className="page-subtitle">
            Lançamentos por funcionário (horas, valores e total líquido)
          </p>
        </div>

        <div className="header-actions">
          <button
            type="button"
            className="btn"
            onClick={carregarDados}
            disabled={loading}
            aria-busy={loading}
          >
            <ArrowPathIcon
              className={`icon-sm ${loading ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            {loading ? "Atualizando..." : "Atualizar"}
          </button>

          <button type="button" className="btn btn--primary" onClick={abrirNovo}>
            <PlusIcon className="icon-sm" aria-hidden="true" />
            Novo
          </button>

          <button
            type="button"
            className="btn"
            onClick={exportarCSV}
            disabled={dadosFiltrados.length === 0}
          >
            <CloudArrowDownIcon className="icon-sm" aria-hidden="true" />
            Exportar
          </button>
        </div>
      </header>

      {/* Alertas */}
      {err && (
        <div className="alert alert--error" role="alert">
          {err}
        </div>
      )}
      {success && (
        <div className="alert alert--success" role="status">
          {success}
        </div>
      )}

      {/* Filtros */}
      <section className="section-gap">
        <div className="card toolbar" role="region" aria-label="Filtros">
          <div className="toolbar__left">
            <span className="toolbar__title">
              <FunnelIcon className="icon-sm text-muted" aria-hidden="true" /> Filtros
            </span>

            <div className="field-inline">
              <label className="sr-only" htmlFor="filt-from">
                Data inicial
              </label>
              <input
                id="filt-from"
                className="form-control"
                type="month"
                value={filtros.from}
                onChange={(e) =>
                  setFiltros((prev) => ({ ...prev, from: e.target.value }))
                }
              />
            </div>

            <span className="text-muted" aria-hidden="true">
              até
            </span>

            <div className="field-inline">
              <label className="sr-only" htmlFor="filt-to">
                Data final
              </label>
              <input
                id="filt-to"
                className="form-control"
                type="month"
                value={filtros.to}
                onChange={(e) =>
                  setFiltros((prev) => ({ ...prev, to: e.target.value }))
                }
              />
            </div>

            <div className="field-inline">
              <label className="sr-only" htmlFor="filt-func">
                Filtrar por funcionário
              </label>
              <select
                id="filt-func"
                className="form-control"
                value={filtros.funcionario_id}
                onChange={(e) =>
                  setFiltros((prev) => ({
                    ...prev,
                    funcionario_id: e.target.value,
                  }))
                }
              >
                <option value="todos">Todos os funcionários</option>
                {funcionarios.map((func) => (
                  <option key={func.id} value={func.id}>
                    {func.pessoa_nome ||
                      func.nome ||
                      func.pessoa?.nome ||
                      `Funcionário #${func.id}`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="toolbar__right">
            <div className="field-inline field-inline--grow">
              <label className="sr-only" htmlFor="filt-q">
                Buscar
              </label>
              <input
                id="filt-q"
                className="form-control"
                type="search"
                placeholder="Buscar por funcionário ou competência..."
                value={filtros.q}
                onChange={(e) =>
                  setFiltros((prev) => ({ ...prev, q: e.target.value }))
                }
              />
            </div>

            <button
              type="button"
              className="btn"
              onClick={limparFiltros}
              disabled={!filtros.q && filtros.funcionario_id === "todos"}
            >
              <XMarkIcon className="icon-sm" aria-hidden="true" />
              Limpar
            </button>
          </div>
        </div>
      </section>

      {/* Métricas */}
      <section className="section-gap">
        <div className="grid-cards">
          {/* Funcionários Impactados */}
          <article className="card kpi kpi--info" aria-label="Funcionários impactados">
            <div className="kpi__icon">
              <UserIcon className="icon" aria-hidden="true" />
            </div>
            <div className="kpi__body">
              <div className="kpi__value">{metricas.funcionarios}</div>
              <div className="kpi__label">Funcionários impactados</div>
            </div>
          </article>

          {/* Horas Totais */}
          <article className="card kpi kpi--success" aria-label="Horas totais">
            <div className="kpi__icon">
              <CalculatorIcon className="icon" aria-hidden="true" />
            </div>
            <div className="kpi__body">
              <div className="kpi__value">{metricas.horas.toFixed(2)}</div>
              <div className="kpi__label">Horas (N + 50% + 100%)</div>
            </div>
          </article>

          {/* Total Líquido */}
          <article className="card kpi kpi--warning" aria-label="Total líquido">
            <div className="kpi__icon">
              <CheckCircleIcon className="icon" aria-hidden="true" />
            </div>
            <div className="kpi__body">
              <div className="kpi__value">{money(metricas.liquido)}</div>
              <div className="kpi__label">Total líquido (somado)</div>
            </div>
          </article>
        </div>
      </section>

      {/* Tabela */}
      <section className="section-gap">
        <div className="card">
          <div className="table-responsive" role="region" aria-label="Tabela de lançamentos">
            <table className="table">
              <caption className="sr-only">Lançamentos por funcionário</caption>
              <thead>
                <tr>
                  <th scope="col">ID</th>
                  <th scope="col">Competência</th>
                  <th scope="col">Funcionário</th>
                  <th scope="col" className="num">
                    N
                  </th>
                  <th scope="col" className="num">
                    HE 50%
                  </th>
                  <th scope="col" className="num">
                    HE 100%
                  </th>
                  <th scope="col" className="num">
                    Base
                  </th>
                  <th scope="col" className="num">
                    +HE50
                  </th>
                  <th scope="col" className="num">
                    +HE100
                  </th>
                  <th scope="col" className="num">
                    +Prov.
                  </th>
                  <th scope="col" className="num">
                    -Desc.
                  </th>
                  <th scope="col" className="num">
                    Líquido
                  </th>
                  <th scope="col" className="num">
                    Inc.
                  </th>
                  <th scope="col" className="text-right">
                    Ações
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={14} className="table-empty">
                      <ArrowPathIcon className="icon-sm animate-spin" aria-hidden="true" />
                      Carregando...
                    </td>
                  </tr>
                ) : dadosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="table-empty text-muted">
                      <FunnelIcon className="icon" aria-hidden="true" />
                      Nenhum lançamento encontrado para os filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  dadosFiltrados.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <code>#{item.id}</code>
                      </td>
                      <td>
                        <div className="cell-strong">{formatMonthBR(item.competencia)}</div>
                        <div className="cell-muted">{item.competencia}</div>
                      </td>
                      <td className="cell-strong">{item.funcionario_nome}</td>
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
                          <span className="text-error">{item.inconsistencias}</span>
                        ) : (
                          item.inconsistencias || 0
                        )}
                      </td>
                      <td className="text-right">
                        <div className="btn-group">
                          <button
                            type="button"
                            className="btn btn--icon"
                            onClick={() => abrirEdicao(item)}
                            title="Editar"
                            aria-label={`Editar lançamento #${item.id}`}
                          >
                            <PencilSquareIcon className="icon-sm" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="btn btn--icon"
                            onClick={() => excluirRegistro(item)}
                            title="Excluir"
                            aria-label={`Excluir lançamento #${item.id}`}
                          >
                            <TrashIcon className="icon-sm" aria-hidden="true" />
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
            <div className="table-footer">
              <span>
                Mostrando {dadosFiltrados.length} de {lista.length} registros
                {(filtros.q || filtros.funcionario_id !== "todos") && " (filtrados)"}
              </span>
              <span>Total: {money(metricas.liquido)}</span>
            </div>
          )}
        </div>
      </section>

      {/* Modal */}
      {modalAberto && (
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && !salvando && setModalAberto(false)}
          onKeyDown={onModalKeyDown}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modalTitle"
        >
          <div className="modal-content modal-lg">
            <header className="modal-header">
              <h2 id="modalTitle" className="modal-title">
                {editando ? "Editar Lançamento" : "Novo Lançamento"}
              </h2>
              <button
                type="button"
                className="btn btn--icon"
                onClick={() => !salvando && setModalAberto(false)}
                disabled={salvando}
                aria-label="Fechar"
                title="Fechar"
              >
                <XMarkIcon className="icon-sm" aria-hidden="true" />
              </button>
            </header>

            <div className="modal-body">
              {err && <div className="alert alert--error">{err}</div>}

              <div className="form-grid form-grid--2">
                {/* Competência */}
                <div className="form-field">
                  <label className="form-label" htmlFor="cmp-competencia">
                    Competência <span className="req">*</span>
                  </label>
                  <input
                    id="cmp-competencia"
                    className="form-control"
                    type="month"
                    value={form.competencia}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, competencia: e.target.value }))
                    }
                    required
                    disabled={salvando}
                  />
                </div>

                {/* Funcionário */}
                <div className="form-field">
                  <label className="form-label" htmlFor="cmp-funcionario">
                    Funcionário <span className="req">*</span>
                  </label>
                  <select
                    id="cmp-funcionario"
                    className="form-control"
                    value={form.funcionario_id}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, funcionario_id: e.target.value }))
                    }
                    required
                    disabled={salvando}
                  >
                    <option value="">Selecione um funcionário...</option>
                    {funcionarios.map((func) => (
                      <option key={func.id} value={func.id}>
                        {func.pessoa_nome ||
                          func.nome ||
                          func.pessoa?.nome ||
                          `Funcionário #${func.id}`}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Horas */}
                <div className="form-field">
                  <label className="form-label" htmlFor="cmp-hn">
                    Horas Normais
                  </label>
                  <input
                    id="cmp-hn"
                    className="form-control"
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={form.horas_normais}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, horas_normais: e.target.value }))
                    }
                    disabled={salvando}
                  />
                </div>

                <div className="form-field">
                  <label className="form-label" htmlFor="cmp-he50h">
                    HE 50% (horas)
                  </label>
                  <input
                    id="cmp-he50h"
                    className="form-control"
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={form.he50_horas}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, he50_horas: e.target.value }))
                    }
                    disabled={salvando}
                  />
                </div>

                <div className="form-field">
                  <label className="form-label" htmlFor="cmp-he100h">
                    HE 100% (horas)
                  </label>
                  <input
                    id="cmp-he100h"
                    className="form-control"
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={form.he100_horas}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, he100_horas: e.target.value }))
                    }
                    disabled={salvando}
                  />
                </div>

                {/* Valores */}
                <div className="form-field">
                  <label className="form-label" htmlFor="cmp-vbase">
                    Valor Base
                  </label>
                  <input
                    id="cmp-vbase"
                    className="form-control"
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={form.valor_base}
                    onChange={(e) => atualizarCampoComCalculo("valor_base", e.target.value)}
                    disabled={salvando}
                  />
                </div>

                <div className="form-field">
                  <label className="form-label" htmlFor="cmp-vhe50">
                    Valor HE 50%
                  </label>
                  <input
                    id="cmp-vhe50"
                    className="form-control"
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={form.valor_he50}
                    onChange={(e) => atualizarCampoComCalculo("valor_he50", e.target.value)}
                    disabled={salvando}
                  />
                </div>

                <div className="form-field">
                  <label className="form-label" htmlFor="cmp-vhe100">
                    Valor HE 100%
                  </label>
                  <input
                    id="cmp-vhe100"
                    className="form-control"
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={form.valor_he100}
                    onChange={(e) => atualizarCampoComCalculo("valor_he100", e.target.value)}
                    disabled={salvando}
                  />
                </div>

                <div className="form-field">
                  <label className="form-label" htmlFor="cmp-prov">
                    Proventos (+)
                  </label>
                  <input
                    id="cmp-prov"
                    className="form-control"
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={form.proventos}
                    onChange={(e) => atualizarCampoComCalculo("proventos", e.target.value)}
                    disabled={salvando}
                  />
                </div>

                <div className="form-field">
                  <label className="form-label" htmlFor="cmp-desc">
                    Descontos (-)
                  </label>
                  <input
                    id="cmp-desc"
                    className="form-control"
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={form.descontos}
                    onChange={(e) => atualizarCampoComCalculo("descontos", e.target.value)}
                    disabled={salvando}
                  />
                </div>

                <div className="form-field">
                  <label className="form-label" htmlFor="cmp-total">
                    Total Líquido
                  </label>
                  <input
                    id="cmp-total"
                    className="form-control"
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={form.total_liquido}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, total_liquido: e.target.value }))
                    }
                    disabled={salvando}
                  />
                </div>

                <div className="form-field">
                  <label className="form-label" htmlFor="cmp-inc">
                    Inconsistências
                  </label>
                  <input
                    id="cmp-inc"
                    className="form-control"
                    type="number"
                    min="0"
                    value={form.inconsistencias}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        inconsistencias: Number(e.target.value),
                      }))
                    }
                    disabled={salvando}
                  />
                </div>
              </div>

              <div className="hint hint--info">
                <ExclamationTriangleIcon className="icon-sm text-info" aria-hidden="true" />
                <div className="hint__text">
                  <strong>Dica:</strong> O total líquido é calculado automaticamente quando
                  você altera valores base, horas extras, proventos ou descontos. Você pode
                  ajustar manualmente se necessário.
                </div>
              </div>
            </div>

            <footer className="modal-footer">
              <button
                type="button"
                className="btn"
                onClick={() => setModalAberto(false)}
                disabled={salvando}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={salvarRegistro}
                disabled={salvando || !form.funcionario_id || !form.competencia}
                aria-busy={salvando}
              >
                <CheckCircleIcon className="icon-sm" aria-hidden="true" />
                {salvando ? "Salvando..." : editando ? "Salvar" : "Criar"}
              </button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
