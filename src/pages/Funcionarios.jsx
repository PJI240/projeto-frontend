// src/pages/Funcionarios.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  PlusIcon,
  ArrowPathIcon,
  CheckIcon,
  XMarkIcon,
  PencilSquareIcon,
  TrashIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/solid";

const API_BASE = import.meta.env.VITE_API_BASE?.replace(/\/+$/, "") || "";

const REGIMES = ["HORISTA", "DIARISTA", "MENSALISTA"];

const EMPTY_FORM = {
  id: null,
  pessoa_id: "",
  cargo_id: "",
  regime: "MENSALISTA",
  salario_base: "",
  valor_hora: "",
  ativo: 1,
};

export default function Funcionarios() {
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState("");
  const [filter, setFilter] = useState("");

  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // opções de selects
  const [pessoas, setPessoas] = useState([]);
  const [cargos, setCargos] = useState([]);
  const [loadingOpts, setLoadingOpts] = useState(true);

  const liveRef = useRef(null);
  const pessoaRef = useRef(null);

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function fetchJSON(url, init = {}) {
    const r = await fetch(url, { credentials: "include", ...init });
    const data = await r.json().catch(() => null);
    if (!r.ok || data?.ok === false) {
      const msg = data?.error || `HTTP ${r.status}`;
      throw new Error(msg);
    }
    return data;
  }

  async function carregarLista() {
    setLoading(true);
    setErr("");
    try {
      const data = await fetchJSON(`${API_BASE}/api/funcionarios`);
      setLista(data.funcionarios || []);
      if (liveRef.current) liveRef.current.textContent = "Lista de funcionários atualizada.";
    } catch (e) {
      setErr(e.message || "Falha ao listar funcionários.");
      if (liveRef.current) liveRef.current.textContent = "Erro ao carregar funcionários.";
    } finally {
      setLoading(false);
    }
  }

  async function carregarOpcoes() {
    setLoadingOpts(true);
    try {
      const [p, c] = await Promise.all([
        fetchJSON(`${API_BASE}/api/pessoas`),
        fetchJSON(`${API_BASE}/api/cargos`),
      ]);
      setPessoas(p.pessoas || []);
      setCargos(c.cargos || []);
    } catch (e) {
      console.error("LOAD_OPTS_ERR", e);
      setErr("Falha ao carregar opções de pessoas/cargos.");
    } finally {
      setLoadingOpts(false);
    }
  }

  useEffect(() => {
    carregarOpcoes();
    carregarLista();
  }, []);

  useEffect(() => {
    if (showForm && pessoaRef.current) pessoaRef.current.focus();
  }, [showForm]);

  const filtrados = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return lista;
    return (lista || []).filter((f) => {
      const nome = (f.pessoa_nome || "").toLowerCase();
      const cargo = (f.cargo_nome || "").toLowerCase();
      return nome.includes(q) || cargo.includes(q);
    });
  }, [filter, lista]);

  function novo() {
    setErr("");
    setSuccess("");
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function editar(item) {
    setErr("");
    setSuccess("");
    setForm({
      id: item.id,
      pessoa_id: item.pessoa_id,
      cargo_id: item.cargo_id,
      regime: item.regime || "MENSALISTA",
      salario_base: item.salario_base ?? "",
      valor_hora: item.valor_hora ?? "",
      ativo: item.ativo ? 1 : 0,
    });
    setShowForm(true);
  }

  function cancelarInline() {
    setForm(EMPTY_FORM);
    setShowForm(false);
  }

  async function salvar(e) {
    e?.preventDefault?.();
    setErr("");
    setSuccess("");
    setSaving(true);
    
    try {
      if (!String(form.pessoa_id || "").trim()) throw new Error("Selecione uma pessoa.");
      if (!String(form.cargo_id || "").trim()) throw new Error("Selecione um cargo.");
      if (!REGIMES.includes(String(form.regime))) throw new Error("Regime inválido.");

      const payload = {
        pessoa_id: Number(form.pessoa_id),
        cargo_id: Number(form.cargo_id),
        regime: form.regime,
        salario_base: form.salario_base === "" ? null : Number(form.salario_base),
        valor_hora: form.valor_hora === "" ? null : Number(form.valor_hora),
        ativo: form.ativo ? 1 : 0,
      };

      if (!form.id) {
        await fetchJSON(`${API_BASE}/api/funcionarios`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await fetchJSON(`${API_BASE}/api/funcionarios/${form.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      
      setSuccess(form.id ? "Funcionário atualizado com sucesso." : "Funcionário criado com sucesso.");
      await carregarLista();
      cancelarInline();
      if (liveRef.current) liveRef.current.textContent = "Funcionário salvo com sucesso.";
    } catch (e) {
      setErr(e.message || "Falha ao salvar funcionário.");
      if (liveRef.current) liveRef.current.textContent = "Erro ao salvar funcionário.";
    } finally {
      setSaving(false);
    }
  }

  async function excluir(item) {
    if (!window.confirm(`Remover vínculo de ${item.pessoa_nome}?`)) return;
    setErr("");
    setSuccess("");
    try {
      await fetchJSON(`${API_BASE}/api/funcionarios/${item.id}`, {
        method: "DELETE",
      });
      setSuccess("Funcionário excluído com sucesso.");
      await carregarLista();
      if (form.id === item.id) cancelarInline();
      if (liveRef.current) liveRef.current.textContent = "Funcionário excluído.";
    } catch (e) {
      setErr(e.message || "Falha ao excluir funcionário.");
      if (liveRef.current) liveRef.current.textContent = "Erro ao excluir funcionário.";
    }
  }

  const onOverlayKeyDown = (ev) => {
    if (ev.key === "Escape") setShowForm(false);
  };

  return (
    <>
      {/* região viva para leitores de tela */}
      <div ref={liveRef} aria-live="polite" className="visually-hidden" />

      {/* HEADER NO PADRÃO GLOBAL */}
      <header className="page-header" role="region" aria-labelledby="titulo-pagina">
        <div>
          <h1 id="titulo-pagina" className="page-title">Funcionários</h1>
          <p className="page-subtitle">Vínculo de pessoas a cargos dentro da sua empresa.</p>
        </div>

        <div className="page-header__toolbar" aria-label="Ações da página">
          <button className="btn btn--success" onClick={novo} aria-label="Criar novo funcionário">
            <PlusIcon className="icon" aria-hidden="true" />
            <span>Novo Funcionário</span>
          </button>
          <button
            className="btn btn--neutral"
            onClick={carregarLista}
            disabled={loading}
            aria-busy={loading ? "true" : "false"}
            aria-label="Atualizar lista de funcionários"
          >
            {loading ? <span className="spinner" aria-hidden="true" /> : <ArrowPathIcon className="icon" aria-hidden="true" />}
            <span>{loading ? "Atualizando…" : "Atualizar"}</span>
          </button>
        </div>
      </header>

      {err && <div className="error-alert" role="alert">{err}</div>}
      {success && <div className="success-alert" role="status">{success}</div>}

      {/* Busca */}
      <div className="search-container">
        <div className="search-bar" role="search" aria-label="Buscar funcionários">
          <MagnifyingGlassIcon className="icon" aria-hidden="true" />
          <label htmlFor="busca" className="visually-hidden">Buscar por nome ou cargo</label>
          <input
            id="busca"
            type="search"
            className="input input--lg"
            placeholder="Buscar por nome ou cargo…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            autoComplete="off"
          />
          {Boolean(filter) && (
            <button
              type="button"
              className="btn btn--neutral btn--icon-only"
              onClick={() => setFilter("")}
              aria-label="Limpar busca"
              title="Limpar"
            >
              <XMarkIcon className="icon" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* LISTAGEM: Tabela (desktop) + Cards (mobile) */}
      <div className="listagem-container">
        {/* Desktop/tablet: Tabela */}
        <div className="table-wrapper table-only" role="region" aria-label="Tabela de funcionários">
          {loading ? (
            <div className="loading-message" role="status">Carregando…</div>
          ) : filtrados.length === 0 ? (
            <div className="empty-message">Nenhum funcionário encontrado.</div>
          ) : (
            <div className="stat-card" style={{ overflow: "hidden" }}>
              <table className="funcionarios-table">
                <thead>
                  <tr>
                    <th scope="col">Pessoa</th>
                    <th scope="col">Cargo</th>
                    <th scope="col">Regime</th>
                    <th scope="col">Salário Base</th>
                    <th scope="col">Valor Hora</th>
                    <th scope="col">Ativo</th>
                    <th scope="col" className="actions-column">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((f) => (
                    <tr key={f.id}>
                      <td>{f.pessoa_nome}</td>
                      <td>{f.cargo_nome}</td>
                      <td>{f.regime}</td>
                      <td>{formatMoney(f.salario_base)}</td>
                      <td>{formatMoney(f.valor_hora)}</td>
                      <td>
                        <span className={`badge ${f.ativo ? "ok" : "muted"}`}>
                          {f.ativo ? "Sim" : "Não"}
                        </span>
                      </td>
                      <td>
                        <div className="actions-buttons">
                          <button
                            className="btn btn--neutral btn--sm"
                            onClick={() => editar(f)}
                            aria-label={`Editar ${f.pessoa_nome}`}
                          >
                            <PencilSquareIcon className="icon" aria-hidden="true" />
                            <span>Editar</span>
                          </button>
                          <button
                            className="btn btn--danger btn--sm"
                            onClick={() => excluir(f)}
                            aria-label={`Excluir ${f.pessoa_nome}`}
                          >
                            <TrashIcon className="icon" aria-hidden="true" />
                            <span>Excluir</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Mobile: Cards */}
        <div className="cards-wrapper cards-only" role="region" aria-label="Lista de funcionários (versão cartões)">
          {loading ? (
            <div className="loading-message" role="status">Carregando…</div>
          ) : filtrados.length === 0 ? (
            <div className="empty-message">Nenhum funcionário encontrado.</div>
          ) : (
            <ul className="cards-grid" aria-label="Cartões de funcionários">
              {filtrados.map((f) => (
                <li key={f.id} className="funcionario-card" aria-label={`Funcionário: ${f.pessoa_nome}`}>
                  <div className="funcionario-card__head">
                    <h3 className="funcionario-card__title">{f.pessoa_nome}</h3>
                    <div className="funcionario-card__badges">
                      <span className={`badge ${f.ativo ? "ok" : "muted"}`}>
                        {f.ativo ? "Ativo" : "Inativo"}
                      </span>
                      <span className="badge badge--neutral">{f.regime}</span>
                    </div>
                  </div>
                  <div className="funcionario-card__body">
                    <dl className="funcionario-dl">
                      <div className="funcionario-dl__row">
                        <dt>Cargo</dt>
                        <dd>{f.cargo_nome}</dd>
                      </div>
                      <div className="funcionario-dl__row">
                        <dt>Salário Base</dt>
                        <dd>{formatMoney(f.salario_base)}</dd>
                      </div>
                      <div className="funcionario-dl__row">
                        <dt>Valor Hora</dt>
                        <dd>{formatMoney(f.valor_hora)}</dd>
                      </div>
                    </dl>
                  </div>
                  <div className="funcionario-card__actions">
                    <button
                      className="btn btn--neutral btn--sm"
                      onClick={() => editar(f)}
                      aria-label={`Editar ${f.pessoa_nome}`}
                      title="Editar"
                    >
                      <PencilSquareIcon className="icon" aria-hidden="true" />
                      <span>Editar</span>
                    </button>
                    <button
                      className="btn btn--danger btn--sm"
                      onClick={() => excluir(f)}
                      aria-label={`Excluir ${f.pessoa_nome}`}
                      title="Excluir"
                    >
                      <TrashIcon className="icon" aria-hidden="true" />
                      <span>Excluir</span>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* FORMULÁRIO COMO DIALOG OVERLAY */}
      {showForm && (
        <div
          className="form-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-form"
          onKeyDown={onOverlayKeyDown}
        >
          <div className="form-container">
            <div className="form-header">
              <h2 id="titulo-form">{form.id ? "Editar Funcionário" : "Novo Funcionário"}</h2>
              <button
                className="btn btn--neutral btn--icon-only"
                onClick={cancelarInline}
                aria-label="Fechar formulário"
                title="Fechar"
              >
                <XMarkIcon className="icon" aria-hidden="true" />
              </button>
            </div>

            <form className="form" onSubmit={salvar}>
              <div className="form-grid">
                <div className="form-field">
                  <label htmlFor="f_pessoa">Pessoa *</label>
                  <select
                    id="f_pessoa"
                    ref={pessoaRef}
                    value={form.pessoa_id}
                    onChange={(e) => setField("pessoa_id", e.target.value)}
                    disabled={loadingOpts}
                    required
                  >
                    <option value="">Selecione…</option>
                    {pessoas.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome} {p.cpf ? `— ${p.cpf}` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label htmlFor="f_cargo">Cargo *</label>
                  <select
                    id="f_cargo"
                    value={form.cargo_id}
                    onChange={(e) => setField("cargo_id", e.target.value)}
                    disabled={loadingOpts}
                    required
                  >
                    <option value="">Selecione…</option>
                    {cargos.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label htmlFor="f_regime">Regime</label>
                  <select
                    id="f_regime"
                    value={form.regime}
                    onChange={(e) => setField("regime", e.target.value)}
                  >
                    {REGIMES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label htmlFor="f_sal">Salário base</label>
                  <input
                    id="f_sal"
                    type="number"
                    step="0.01"
                    value={form.salario_base}
                    onChange={(e) => setField("salario_base", e.target.value)}
                    placeholder="3029.00"
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="f_vh">Valor hora</label>
                  <input
                    id="f_vh"
                    type="number"
                    step="0.01"
                    value={form.valor_hora}
                    onChange={(e) => setField("valor_hora", e.target.value)}
                    placeholder="Ex.: 18.50"
                  />
                </div>

                <div className="form-field span-2" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    id="f_ativo"
                    type="checkbox"
                    checked={!!form.ativo}
                    onChange={(e) => setField("ativo", e.target.checked ? 1 : 0)}
                  />
                  <label htmlFor="f_ativo" className="checkbox-label">Ativo</label>
                </div>
              </div>

              <small className="hint">
                Precisa cadastrar uma <Link to="/pessoas"><strong>pessoa</strong></Link> ou um{" "}
                <Link to="/cargos"><strong>cargo</strong></Link> antes?
              </small>

              <div className="form-actions">
                <button type="button" className="btn btn--neutral" onClick={cancelarInline}>
                  <XMarkIcon className="icon" aria-hidden="true" />
                  <span>Cancelar</span>
                </button>
                <button type="submit" className="btn btn--success" disabled={saving}>
                  <CheckIcon className="icon" aria-hidden="true" />
                  <span>{saving ? "Salvando..." : form.id ? "Salvar alterações" : "Criar funcionário"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Estilos seguindo o padrão */}
      <style jsx>{`
        .listagem-container { width: 100%; }
        .search-container { margin-bottom: 16px; }

        .table-only { display: block; }
        .cards-only { display: none; }
        @media (max-width: 768px) {
          .table-only { display: none; }
          .cards-only { display: block; }
        }

        /* Tabela */
        .funcionarios-table th,
        .funcionarios-table td { white-space: nowrap; }
        .funcionarios-table td:first-child,
        .funcionarios-table th:first-child { white-space: normal; }
        .actions-buttons { display: flex; gap: 6px; flex-wrap: wrap; }

        /* Cards grid (mobile) */
        .cards-grid {
          list-style: none;
          padding: 0;
          margin: 0;
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
        }
        .funcionario-card {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 12px;
          box-shadow: var(--shadow);
          overflow: hidden;
          position: relative;
        }
        .funcionario-card::before {
          content: "";
          position: absolute;
          left: 0; top: 0; bottom: 0;
          width: 4px;
          background: var(--accent-bg);
        }
        .funcionario-card__head {
          display: flex; align-items: center; justify-content: space-between;
          gap: 8px; padding: 14px 14px 0 14px;
        }
        .funcionario-card__title {
          margin: 0; font-size: 1rem; font-weight: 700; color: var(--fg);
        }
        .funcionario-card__badges {
          display: flex; gap: 6px; flex-wrap: wrap;
        }
        .badge {
          font-size: 0.75rem; padding: 2px 8px; border-radius: 999px;
          border: 1px solid var(--border);
        }
        .badge.ok { 
          background: rgba(16,185,129,.12); 
          color: var(--success-strong); 
          border-color: rgba(16,185,129,.35); 
        }
        .badge.muted { 
          background: var(--panel-muted); 
          color: var(--muted); 
        }
        .badge--neutral {
          background: rgba(59,130,246,.12);
          color: #2563eb;
          border-color: rgba(59,130,246,.35);
        }

        .funcionario-card__body { padding: 12px 14px 14px 14px; }
        .funcionario-dl { margin: 0; display: grid; gap: 8px; }
        .funcionario-dl__row {
          display: grid;
          grid-template-columns: 100px 1fr;
          gap: 8px; align-items: baseline;
        }
        .funcionario-dl__row dt { color: var(--muted); font-weight: 600; font-size: var(--fs-12); }
        .funcionario-dl__row dd { margin: 0; color: var(--fg); font-weight: 500; }

        .funcionario-card__actions {
          display: flex; gap: 6px; flex-wrap: wrap; padding: 0 14px 14px 14px;
        }

        /* Form grid responsivo */
        .form-grid { 
          display: grid; 
          grid-template-columns: 1fr; 
          gap: 12px; 
        }
        .form-field { 
          display: flex; 
          flex-direction: column; 
          gap: 6px; 
        }
        .form-field input, 
        .form-field select {
          min-height: 44px; 
          padding: 10px 12px; 
          border: 1px solid var(--border);
          border-radius: 12px; 
          background: #fff; 
          color: #111; 
          font-size: var(--fs-16);
        }
        .form-field input:focus-visible, 
        .form-field select:focus-visible {
          outline: 3px solid var(--focus); 
          outline-offset: 2px;
        }
        .form-field.span-2 { grid-column: span 1; }
        @media (min-width: 640px) {
          .form-grid { grid-template-columns: 1fr 1fr; }
          .form-field.span-2 { grid-column: span 2; }
        }

        /* Hint text */
        .hint {
          color: var(--muted);
          display: block;
          margin-top: 12px;
          font-size: var(--fs-14);
        }

        /* Success alert */
        .success-alert {
          background: rgba(16,185,129,.12);
          border: 1px solid rgba(16,185,129,.35);
          color: var(--success-strong);
          padding: 12px 16px;
          border-radius: 8px;
          margin-bottom: 16px;
        }

        /* Checkbox label para modo HC */
        .checkbox-label {
          color: var(--fg);
          font-weight: 500;
        }

        /* Ajustes menores */
        @media (max-width: 480px) {
          .funcionario-dl__row { grid-template-columns: 90px 1fr; }
          .funcionario-card__title { font-size: 0.95rem; }
          .funcionario-card__badges { flex-direction: column; align-items: flex-start; }
        }
      `}</style>
    </>
  );
}

function formatMoney(v) {
  if (v == null || v === "") return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}