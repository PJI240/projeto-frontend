// src/pages/Pessoas.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import {
  PlusIcon,
  ArrowPathIcon,
  PencilSquareIcon,
  TrashIcon,
  CheckIcon,
MagnifyingGlassIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid";

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");

export default function Pessoas() {
  const [itens, setItens] = useState([]);
  const [filtro, setFiltro] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({
    nome: "",
    cpf: "",
    data_nascimento: "",
    telefone: "",
    email: "",
  });

  const liveRef = useRef(null);
  const nomeRef = useRef(null);

  const listaFiltrada = useMemo(() => {
    const f = filtro.trim().toLowerCase();
    if (!f) return itens;
    return itens.filter((p) =>
      [p.nome, p.cpf, p.email]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(f))
    );
  }, [filtro, itens]);

  async function carregar() {
    setLoading(true);
    setErr("");
    try {
      const r = await fetch(`${API_BASE}/api/pessoas`, { credentials: "include" });
      const data = await r.json().catch(() => null);
      if (!r.ok || !data?.ok) throw new Error(data?.error || "Falha ao listar pessoas.");
      setItens(data.pessoas || []);
      if (liveRef.current) liveRef.current.textContent = "Lista atualizada.";
    } catch (e) {
      setErr(e.message || "Erro ao carregar.");
      if (liveRef.current) liveRef.current.textContent = "Erro ao carregar a lista.";
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  useEffect(() => {
    if (showForm && nomeRef.current) {
      nomeRef.current.focus();
    }
  }, [showForm]);

  function abrirNovo() {
    setEditId(null);
    setForm({ nome: "", cpf: "", data_nascimento: "", telefone: "", email: "" });
    setShowForm(true);
  }

  function abrirEdicao(p) {
    setEditId(p.id);
    setForm({
      nome: p.nome || "",
      cpf: p.cpf || "",
      data_nascimento: (p.data_nascimento || "").substring(0, 10),
      telefone: p.telefone || "",
      email: p.email || "",
    });
    setShowForm(true);
  }

  async function salvar(e) {
    e?.preventDefault();
    setErr("");
    try {
      const method = editId ? "PUT" : "POST";
      const url = editId ? `${API_BASE}/api/pessoas/${editId}` : `${API_BASE}/api/pessoas`;

      const r = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await r.json().catch(() => null);
      if (!r.ok || !data?.ok) throw new Error(data?.error || "Falha ao salvar.");

      setShowForm(false);
      if (liveRef.current) {
        liveRef.current.textContent = editId ? "Pessoa atualizada." : "Pessoa criada.";
      }
      await carregar();
    } catch (e) {
      setErr(e.message || "Erro ao salvar.");
      if (liveRef.current) liveRef.current.textContent = "Erro ao salvar.";
    }
  }

  async function excluir(id) {
    if (!confirm("Deseja realmente excluir esta pessoa? Esta ação não pode ser desfeita.")) return;
    setErr("");
    try {
      const r = await fetch(`${API_BASE}/api/pessoas/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await r.json().catch(() => null);
      if (!r.ok || !data?.ok) throw new Error(data?.error || "Falha ao excluir.");
      if (liveRef.current) liveRef.current.textContent = "Pessoa excluída.";
      await carregar();
    } catch (e) {
      setErr(e.message || "Erro ao excluir.");
      if (liveRef.current) liveRef.current.textContent = "Erro ao excluir.";
    }
  }

  const onOverlayKeyDown = (ev) => {
    if (ev.key === "Escape") setShowForm(false);
  };

  return (
    <>
      {/* região viva para leitores de tela */}
      <div ref={liveRef} aria-live="polite" className="visually-hidden" />

      {/* HEADER NO NOVO PADRÃO */}
      <header className="page-header" role="region" aria-labelledby="titulo-pagina">
        <div>
          <h1 id="titulo-pagina" className="page-title">Pessoas</h1>
          <p className="page-subtitle">Gerencie as informações pessoais da sua equipe.</p>
        </div>

        <div className="page-header__toolbar" aria-label="Ações da página">
          <button className="btn btn--success" onClick={abrirNovo} aria-label="Criar nova pessoa">
            <PlusIcon className="icon" aria-hidden="true" />
            <span>Nova Pessoa</span>
          </button>
          <button
            className="btn btn--neutral"
            onClick={carregar}
            disabled={loading}
            aria-busy={loading ? "true" : "false"}
            aria-label="Atualizar lista de pessoas"
            title="Atualizar"
          >
            {loading ? <span className="spinner" aria-hidden="true" /> : <ArrowPathIcon className="icon" aria-hidden="true" />}
            <span>{loading ? "Atualizando…" : "Atualizar"}</span>
          </button>
        </div>
      </header>

      {err && (
        <div className="error-alert" role="alert">
          {err}
        </div>
      )}

    {/* Busca */}
<div className="search-container">
  <div className="search-bar" role="search" aria-label="Buscar pessoas">
    <MagnifyingGlassIcon className="icon" aria-hidden="true" />
    <label htmlFor="busca" className="visually-hidden">Buscar por nome, CPF ou e-mail</label>
    <input
      id="busca"
      type="search"
      className="input input--lg"
      placeholder="Buscar por nome, CPF ou e-mail…"
      value={filtro}
      onChange={(e) => setFiltro(e.target.value)}
      autoComplete="off"
    />
    {Boolean(filtro) && (
      <button
        type="button"
        className="btn btn--neutral btn--icon-only"
        onClick={() => setFiltro("")}
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
        <div className="table-wrapper table-only" role="region" aria-label="Tabela de pessoas">
          {loading ? (
            <div className="loading-message" role="status">Carregando…</div>
          ) : listaFiltrada.length === 0 ? (
            <div className="empty-message">Nenhuma pessoa encontrada para sua empresa.</div>
          ) : (
            <div className="stat-card" style={{ overflow: "hidden" }}>
              <table className="pessoas-table">
                <thead>
                  <tr>
                    <th scope="col">Nome</th>
                    <th scope="col">CPF</th>
                    <th scope="col">E-mail</th>
                    <th scope="col">Telefone</th>
                    <th scope="col" className="actions-column">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {listaFiltrada.map((p) => (
                    <tr key={p.id}>
                      <td>{p.nome}</td>
                      <td>{p.cpf || "—"}</td>
                      <td>{p.email || "—"}</td>
                      <td>{p.telefone || "—"}</td>
                      <td>
                        <div className="actions-buttons">
                          <button
                            className="btn btn--neutral btn--sm"
                            onClick={() => abrirEdicao(p)}
                            aria-label={`Editar ${p.nome}`}
                          >
                            <PencilSquareIcon className="icon" aria-hidden="true" />
                            <span>Editar</span>
                          </button>
                          <button
                            className="btn btn--danger btn--sm"
                            onClick={() => excluir(p.id)}
                            aria-label={`Excluir ${p.nome}`}
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

        {/* Mobile: Cards de pessoa (largura total) */}
        <div className="cards-wrapper cards-only" role="region" aria-label="Lista de pessoas (versão cartões)">
          {loading ? (
            <div className="loading-message" role="status">Carregando…</div>
          ) : listaFiltrada.length === 0 ? (
            <div className="empty-message">Nenhuma pessoa encontrada para sua empresa.</div>
          ) : (
            <ul className="cards-grid" aria-label="Cartões de pessoas">
              {listaFiltrada.map((p) => (
                <li key={p.id} className="pessoa-card" aria-label={`Pessoa: ${p.nome}`}>
                  <div className="pessoa-card__head">
                    <h3 className="pessoa-card__title">{p.nome}</h3>
                    <div className="pessoa-card__actions">
                      <button
                        className="btn btn--neutral btn--sm"
                        onClick={() => abrirEdicao(p)}
                        aria-label={`Editar ${p.nome}`}
                        title="Editar"
                      >
                        <PencilSquareIcon className="icon" aria-hidden="true" />
                        <span>Editar</span>
                      </button>
                      <button
                        className="btn btn--danger btn--sm"
                        onClick={() => excluir(p.id)}
                        aria-label={`Excluir ${p.nome}`}
                        title="Excluir"
                      >
                        <TrashIcon className="icon" aria-hidden="true" />
                        <span>Excluir</span>
                      </button>
                    </div>
                  </div>

                  <div className="pessoa-card__body">
                    <dl className="pessoa-dl">
                      <div className="pessoa-dl__row">
                        <dt>CPF</dt>
                        <dd>{p.cpf || "—"}</dd>
                      </div>
                      <div className="pessoa-dl__row">
                        <dt>E-mail</dt>
                        <dd>{p.email || "—"}</dd>
                      </div>
                      <div className="pessoa-dl__row">
                        <dt>Telefone</dt>
                        <dd>{p.telefone || "—"}</dd>
                      </div>
                    </dl>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Dialog de formulário */}
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
              <h2 id="titulo-form">{editId ? "Editar Pessoa" : "Nova Pessoa"}</h2>
              <button
                className="btn btn--neutral btn--icon-only"
                onClick={() => setShowForm(false)}
                aria-label="Fechar formulário"
                title="Fechar"
              >
                <XMarkIcon className="icon" aria-hidden="true" />
              </button>
            </div>

            <form className="form" onSubmit={salvar}>
              <div className="form-group">
                <label htmlFor="nome">Nome</label>
                <input
                  id="nome"
                  ref={nomeRef}
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  required
                  autoComplete="name"
                />
              </div>

              <div className="form-group">
                <label htmlFor="cpf">CPF</label>
                <input
                  id="cpf"
                  value={form.cpf}
                  onChange={(e) => setForm({ ...form, cpf: e.target.value })}
                  inputMode="numeric"
                  placeholder="Somente números"
                  autoComplete="off"
                />
              </div>

              <div className="form-group">
                <label htmlFor="nasc">Data de Nascimento</label>
                <input
                  id="nasc"
                  type="date"
                  value={form.data_nascimento}
                  onChange={(e) => setForm({ ...form, data_nascimento: e.target.value })}
                  autoComplete="bday"
                />
              </div>

              <div className="form-group">
                <label htmlFor="tel">Telefone</label>
                <input
                  id="tel"
                  value={form.telefone}
                  onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                  autoComplete="tel"
                />
              </div>

              <div className="form-group">
                <label htmlFor="email">E-mail</label>
                <input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  autoComplete="email"
                />
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn--neutral"
                  onClick={() => setShowForm(false)}
                >
                  <XMarkIcon className="icon" aria-hidden="true" />
                  <span>Cancelar</span>
                </button>
                <button type="submit" className="btn btn--sucess">
                  <CheckIcon className="icon" aria-hidden="true" />
                  <span>{editId ? "Salvar Alterações" : "Salvar"}</span>
                </button>
              </div>

              {!editId && (
                <div className="form-tip" id="form-tip">
                  <small>
                    * Dica: para a pessoa aparecer nesta lista, vincule-a depois como funcionário (módulo Funcionários).
                  </small>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* estilos locais — só o que é específico desta página */}
      <style jsx>{`
        .listagem-container { width: 100%; }
.search-container {
  margin-bottom: 16px;
}
        /* Tabela (desktop) e Cards (mobile) alternados por CSS */
        .table-only { display: block; }
        .cards-only { display: none; }

        @media (max-width: 768px) {
          .table-only { display: none; }
          .cards-only { display: block; }
        }

        /* Cards grid (mobile) */
        .cards-grid {
          list-style: none;
          padding: 0;
          margin: 0;
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
        }
        .pessoa-card {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 12px;
          box-shadow: var(--shadow);
          overflow: hidden;
          position: relative;
        }
        .pessoa-card::before {
          /* “cor na lateral” – como na tela anterior */
          content: "";
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 4px;
          background: var(--accent-bg);
        }
        .pessoa-card__head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 14px 14px 0 14px;
        }
        .pessoa-card__title {
          margin: 0;
          font-size: 1rem;
          font-weight: 700;
          color: var(--fg);
        }
        .pessoa-card__actions {
          display: flex;
          gap: 6px;
          flex-shrink: 0;
        }
        .pessoa-card__body {
          padding: 12px 14px 14px 14px;
        }
        .pessoa-dl {
          margin: 0;
          display: grid;
          gap: 8px;
        }
        .pessoa-dl__row {
          display: grid;
          grid-template-columns: 110px 1fr;
          gap: 8px;
          align-items: baseline;
        }
        .pessoa-dl__row dt {
          color: var(--muted);
          font-weight: 600;
          font-size: var(--fs-12);
        }
        .pessoa-dl__row dd {
          margin: 0;
          color: var(--fg);
          font-weight: 500;
        }

        /* Tabela padrão (desktop) já segue os estilos globais */
        .pessoas-table th,
        .pessoas-table td { white-space: nowrap; }
        .pessoas-table td:first-child,
        .pessoas-table th:first-child { white-space: normal; }

        /* Ações desktop */
        .actions-buttons { display: flex; gap: 6px; flex-wrap: wrap; }

        /* Form (dialog) – reaproveita tokens globais */
        .form-overlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,.5);
          display: flex; align-items: center; justify-content: center;
          padding: 20px; z-index: 1000;
        }
        .form-container {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 24px;
          width: 100%; max-width: 520px;
          max-height: 90vh; overflow-y: auto;
          box-shadow: 0 10px 25px rgba(0,0,0,0.2);
        }
        .form-header {
          display: flex; justify-content: space-between; align-items: center;
          gap: 8px; margin-bottom: 16px;
        }

        /* Pequenos ajustes extras para telas menores */
        @media (max-width: 480px) {
          .pessoa-dl__row { grid-template-columns: 90px 1fr; }
          .pessoa-card__title { font-size: 0.95rem; }
        }
      `}</style>
    </>
  );
}