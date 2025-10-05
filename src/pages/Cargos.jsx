// src/pages/Cargos.jsx
import { useEffect, useMemo, useState, useRef } from "react";
import {
  PlusIcon,
  ArrowPathIcon,
  CheckIcon,
  XMarkIcon,
  PencilSquareIcon,
  TrashIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/solid";

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");

const EMPTY_FORM = {
  id: null,
  nome: "",
  descricao: "",
  ativo: 1,
};

export default function Cargos() {
  const [itens, setItens] = useState([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const liveRef = useRef(null);
  const nomeRef = useRef(null);

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const listaFiltrada = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return itens;
    return itens.filter((c) =>
      [c.nome, c.descricao].filter(Boolean).some((v) => String(v).toLowerCase().includes(f))
    );
  }, [filter, itens]);

  async function carregarLista() {
    setLoading(true);
    setErr("");
    try {
      const r = await fetch(`${API_BASE}/api/cargos`, { credentials: "include" });
      const data = await r.json().catch(() => null);
      if (!r.ok || !data?.ok) throw new Error(data?.error || "Falha ao listar cargos.");
      setItens(data.cargos || []);
      if (liveRef.current) liveRef.current.textContent = "Lista de cargos atualizada.";
    } catch (e) {
      setErr(e.message || "Erro ao carregar.");
      if (liveRef.current) liveRef.current.textContent = "Erro ao carregar cargos.";
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { carregarLista(); }, []);

  useEffect(() => {
    if (showForm && nomeRef.current) nomeRef.current.focus();
  }, [showForm]);

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
      nome: item.nome || "",
      descricao: item.descricao || "",
      ativo: item.ativo ? 1 : 0,
    });
    setShowForm(true);
  }

  function cancelarInline() {
    setForm(EMPTY_FORM);
    setShowForm(false);
  }

  async function salvar(e) {
    e?.preventDefault();
    setErr("");
    setSuccess("");
    setLoading(true);
    
    try {
      if (!form.nome.trim()) {
        throw new Error("Nome do cargo é obrigatório.");
      }

      const payload = {
        nome: form.nome.trim(),
        descricao: form.descricao.trim(),
        ativo: form.ativo ? 1 : 0,
      };

      if (form.id) {
        await fetch(`${API_BASE}/api/cargos/${form.id}`, {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch(`${API_BASE}/api/cargos`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      setSuccess(form.id ? "Cargo atualizado com sucesso." : "Cargo criado com sucesso.");
      setShowForm(false);
      await carregarLista();
      if (liveRef.current) liveRef.current.textContent = "Cargo salvo com sucesso.";
    } catch (e) {
      setErr(e.message || "Erro ao salvar.");
      if (liveRef.current) liveRef.current.textContent = "Erro ao salvar cargo.";
    } finally {
      setLoading(false);
    }
  }

  async function excluir(item) {
    if (!window.confirm(`Excluir o cargo "${item.nome}"? (Atenção: se houver funcionários vinculados, a exclusão pode falhar)`)) return;
    setErr("");
    setSuccess("");
    try {
      const r = await fetch(`${API_BASE}/api/cargos/${item.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await r.json().catch(() => null);
      if (!r.ok || !data?.ok) throw new Error(data?.error || "Falha ao excluir.");
      
      setSuccess("Cargo excluído com sucesso.");
      await carregarLista();
      if (liveRef.current) liveRef.current.textContent = "Cargo excluído.";
    } catch (e) {
      setErr(e.message || "Erro ao excluir.");
      if (liveRef.current) liveRef.current.textContent = "Erro ao excluir cargo.";
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
          <h1 id="titulo-pagina" className="page-title">Cargos</h1>
          <p className="page-subtitle">Funções/cargos disponíveis na empresa.</p>
        </div>

        <div className="page-header__toolbar" aria-label="Ações da página">
          <button className="btn btn--success" onClick={novo} aria-label="Criar novo cargo">
            <PlusIcon className="icon" aria-hidden="true" />
            <span>Novo Cargo</span>
          </button>
          <button
            className="btn btn--neutral"
            onClick={carregarLista}
            disabled={loading}
            aria-busy={loading ? "true" : "false"}
            aria-label="Atualizar lista de cargos"
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
        <div className="search-bar" role="search" aria-label="Buscar cargos">
          <MagnifyingGlassIcon className="icon" aria-hidden="true" />
          <label htmlFor="busca" className="visually-hidden">Buscar por nome ou descrição</label>
          <input
            id="busca"
            type="search"
            className="input input--lg"
            placeholder="Buscar por nome ou descrição…"
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
        <div className="table-wrapper table-only" role="region" aria-label="Tabela de cargos">
          {loading ? (
            <div className="loading-message" role="status">Carregando…</div>
          ) : listaFiltrada.length === 0 ? (
            <div className="empty-message">Nenhum cargo encontrado.</div>
          ) : (
            <div className="stat-card" style={{ overflow: "hidden" }}>
              <table className="cargos-table">
                <thead>
                  <tr>
                    <th scope="col">Nome</th>
                    <th scope="col">Descrição</th>
                    <th scope="col">Ativo</th>
                    <th scope="col" className="actions-column">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {listaFiltrada.map((c) => (
                    <tr key={c.id}>
                      <td>{c.nome}</td>
                      <td>{c.descricao || "—"}</td>
                      <td>
                        <span className={`badge ${c.ativo ? "ok" : "muted"}`}>
                          {c.ativo ? "Sim" : "Não"}
                        </span>
                      </td>
                      <td>
                        <div className="actions-buttons">
                          <button
                            className="btn btn--neutral btn--sm"
                            onClick={() => editar(c)}
                            aria-label={`Editar ${c.nome}`}
                          >
                            <PencilSquareIcon className="icon" aria-hidden="true" />
                            <span>Editar</span>
                          </button>
                          <button
                            className="btn btn--danger btn--sm"
                            onClick={() => excluir(c)}
                            aria-label={`Excluir ${c.nome}`}
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
        <div className="cards-wrapper cards-only" role="region" aria-label="Lista de cargos (versão cartões)">
          {loading ? (
            <div className="loading-message" role="status">Carregando…</div>
          ) : listaFiltrada.length === 0 ? (
            <div className="empty-message">Nenhum cargo encontrado.</div>
          ) : (
            <ul className="cards-grid" aria-label="Cartões de cargos">
              {listaFiltrada.map((c) => (
                <li key={c.id} className="cargo-card" aria-label={`Cargo: ${c.nome}`}>
                  <div className="cargo-card__head">
                    <h3 className="cargo-card__title">{c.nome}</h3>
                    <span className={`badge ${c.ativo ? "ok" : "muted"}`}>
                      {c.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </div>
                  <div className="cargo-card__body">
                    <dl className="cargo-dl">
                      <div className="cargo-dl__row">
                        <dt>Descrição</dt>
                        <dd>{c.descricao || "—"}</dd>
                      </div>
                    </dl>
                  </div>
                  <div className="cargo-card__actions">
                    <button
                      className="btn btn--neutral btn--sm"
                      onClick={() => editar(c)}
                      aria-label={`Editar ${c.nome}`}
                      title="Editar"
                    >
                      <PencilSquareIcon className="icon" aria-hidden="true" />
                      <span>Editar</span>
                    </button>
                    <button
                      className="btn btn--danger btn--sm"
                      onClick={() => excluir(c)}
                      aria-label={`Excluir ${c.nome}`}
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
              <h2 id="titulo-form">{form.id ? "Editar Cargo" : "Novo Cargo"}</h2>
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
                <div className="form-field span-2">
                  <label htmlFor="c_nome">Nome *</label>
                  <input
                    id="c_nome"
                    ref={nomeRef}
                    value={form.nome}
                    onChange={(e) => setField("nome", e.target.value)}
                    required
                    autoComplete="off"
                  />
                </div>

                <div className="form-field span-2">
                  <label htmlFor="c_descricao">Descrição</label>
                  <textarea
                    id="c_descricao"
                    rows={3}
                    value={form.descricao}
                    onChange={(e) => setField("descricao", e.target.value)}
                    placeholder="Descrição opcional do cargo..."
                  />
                </div>

                <div className="form-field span-2" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    id="c_ativo"
                    type="checkbox"
                    checked={!!form.ativo}
                    onChange={(e) => setField("ativo", e.target.checked ? 1 : 0)}
                  />
                  <label htmlFor="c_ativo" className="checkbox-label">Cargo ativo</label>
                </div>
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn--neutral" onClick={cancelarInline}>
                  <XMarkIcon className="icon" aria-hidden="true" />
                  <span>Cancelar</span>
                </button>
                <button type="submit" className="btn btn--success" disabled={loading}>
                  <CheckIcon className="icon" aria-hidden="true" />
                  <span>{loading ? "Salvando..." : form.id ? "Salvar alterações" : "Criar cargo"}</span>
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
        .cargos-table th,
        .cargos-table td { white-space: nowrap; }
        .cargos-table td:first-child,
        .cargos-table th:first-child { white-space: normal; }
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
        .cargo-card {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 12px;
          box-shadow: var(--shadow);
          overflow: hidden;
          position: relative;
        }
        .cargo-card::before {
          content: "";
          position: absolute;
          left: 0; top: 0; bottom: 0;
          width: 4px;
          background: var(--accent-bg);
        }
        .cargo-card__head {
          display: flex; align-items: center; justify-content: space-between;
          gap: 8px; padding: 14px 14px 0 14px;
        }
        .cargo-card__title {
          margin: 0; font-size: 1rem; font-weight: 700; color: var(--fg);
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

        .cargo-card__body { padding: 12px 14px 14px 14px; }
        .cargo-dl { margin: 0; display: grid; gap: 8px; }
        .cargo-dl__row {
          display: grid;
          grid-template-columns: 100px 1fr;
          gap: 8px; align-items: baseline;
        }
        .cargo-dl__row dt { color: var(--muted); font-weight: 600; font-size: var(--fs-12); }
        .cargo-dl__row dd { margin: 0; color: var(--fg); font-weight: 500; }

        .cargo-card__actions {
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
        .form-field select, 
        .form-field textarea {
          min-height: 44px; 
          padding: 10px 12px; 
          border: 1px solid var(--border);
          border-radius: 12px; 
          background: #fff; 
          color: #111; 
          font-size: var(--fs-16);
        }
        .form-field textarea {
          min-height: 80px;
          resize: vertical;
        }
        .form-field input:focus-visible, 
        .form-field select:focus-visible,
        .form-field textarea:focus-visible {
          outline: 3px solid var(--focus); 
          outline-offset: 2px;
        }
        .form-field.span-2 { grid-column: span 1; }
        @media (min-width: 640px) {
          .form-grid { grid-template-columns: 1fr 1fr; }
          .form-field.span-2 { grid-column: span 2; }
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
          .cargo-dl__row { grid-template-columns: 90px 1fr; }
          .cargo-card__title { font-size: 0.95rem; }
        }
      `}</style>
    </>
  );
}