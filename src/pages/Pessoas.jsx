// src/pages/Pessoas.jsx
import { useEffect, useMemo, useRef, useState } from "react";

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
      const url = editId
        ? `${API_BASE}/api/pessoas/${editId}`
        : `${API_BASE}/api/pessoas`;

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
        <div className="page-header__top">
          <h1 id="titulo-pagina" className="page-title">Pessoas</h1>
          <p className="page-subtitle">Gerencie as informações pessoais da sua equipe.</p>
        </div>

        <div className="page-header__toolbar" aria-label="Ações da página">
          <button className="toggle-btn" onClick={abrirNovo} aria-label="Criar nova pessoa">
            Nova Pessoa
          </button>
          <button
            className="toggle-btn"
            onClick={carregar}
            disabled={loading}
            aria-busy={loading ? "true" : "false"}
            aria-label="Atualizar lista de pessoas"
            title="Atualizar"
          >
            {loading ? "Atualizando..." : "Atualizar"}
          </button>
        </div>
      </header>

      {err && (
        <div className="error-alert" role="alert">
          {err}
        </div>
      )}

      <div className="search-container">
        <label htmlFor="busca" className="visually-hidden">Buscar por nome, CPF ou e-mail</label>
        <input
          id="busca"
          placeholder="Buscar por nome, CPF ou e-mail…"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          className="search-input"
          autoComplete="off"
        />
      </div>

      <div className="table-container">
        <div className="stat-card">
          {loading ? (
            <div className="loading-message" role="status">Carregando…</div>
          ) : listaFiltrada.length === 0 ? (
            <div className="empty-message">Nenhuma pessoa encontrada para sua empresa.</div>
          ) : (
            <div className="table-wrapper" role="region" aria-label="Tabela de pessoas">
              <table className="pessoas-table">
                <thead>
                  <tr>
                    <th scope="col">Nome</th>
                    <th scope="col" className="hide-on-mobile">CPF</th>
                    <th scope="col" className="hide-on-mobile">E-mail</th>
                    <th scope="col" className="hide-on-small">Telefone</th>
                    <th scope="col" className="actions-column">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {listaFiltrada.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div className="mobile-info">
                          <div className="main-info">{p.nome}</div>
                          <div className="mobile-details">
                            {p.cpf && <span>CPF: {p.cpf}</span>}
                            {p.email && <span>E-mail: {p.email}</span>}
                            {p.telefone && <span>Tel: {p.telefone}</span>}
                          </div>
                        </div>
                      </td>
                      <td className="hide-on-mobile">{p.cpf || "—"}</td>
                      <td className="hide-on-mobile">{p.email || "—"}</td>
                      <td className="hide-on-small">{p.telefone || "—"}</td>
                      <td>
                        <div className="actions-buttons">
                          <button
                            className="toggle-btn small-btn"
                            onClick={() => abrirEdicao(p)}
                            aria-label={`Editar ${p.nome}`}
                          >
                            Editar
                          </button>
                          <button
                            className="toggle-btn small-btn danger"
                            onClick={() => excluir(p.id)}
                            aria-label={`Excluir ${p.nome}`}
                          >
                            Excluir
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
      </div>

      {/* Drawer/ formulário simples */}
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
                className="close-btn"
                onClick={() => setShowForm(false)}
                aria-label="Fechar formulário"
              >
                ×
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
                  className="toggle-btn secondary"
                  onClick={() => setShowForm(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="toggle-btn primary">
                  {editId ? "Salvar alterações" : "Criar pessoa"}
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

      <style jsx>{`
        .visually-hidden {
          position: absolute !important;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }

        /* Header no novo padrão (mesmo respiro das outras páginas) */
        .page-header {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 16px;
          margin-bottom: 16px;
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
        }
        .page-title {
          margin: 0 0 4px 0;
          color: var(--fg);
          font-size: clamp(1.5rem, 4vw, 2rem);
        }
        .page-subtitle {
          margin: 0;
          color: var(--muted);
          font-size: clamp(var(--fs-14), 3vw, var(--fs-16));
        }
        .page-header__toolbar {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
        }

        /* Alertas */
        .error-alert {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: var(--error-strong, #b91c1c);
          padding: 12px 16px;
          border-radius: 8px;
          margin-bottom: 16px;
        }

        /* Busca */
        .search-container {
          margin-bottom: 16px;
        }
        .search-input {
          width: 100%;
          padding: 12px;
          border: 1px solid var(--border);
          border-radius: 8px;
          font-size: var(--fs-16, 1rem);
          background: var(--panel);
          color: var(--fg);
        }
        .search-input:focus-visible {
          outline: 3px solid var(--focus);
          outline-offset: 2px;
        }

        /* Container da tabela */
        .table-container {
          width: 100%;
          overflow: hidden;
        }
        .stat-card {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 0;
          box-shadow: var(--shadow);
          overflow: hidden;
        }

        /* Mensagens */
        .loading-message, .empty-message {
          padding: 24px 16px;
          text-align: center;
          color: var(--muted);
        }

        /* Tabela */
        .table-wrapper {
          overflow-x: auto;
        }
        .pessoas-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 640px;
          background: var(--panel);
          color: var(--fg);
        }
        .pessoas-table th {
          padding: 16px 12px;
          text-align: left;
          font-weight: 700;
          color: var(--muted);
          border-bottom: 1px solid var(--border);
          background: var(--panel-muted);
          position: sticky;
          top: 0;
          z-index: 1;
        }
        .pessoas-table td {
          padding: 16px 12px;
          border-bottom: 1px solid var(--border);
          vertical-align: top;
        }

        /* Informações mobile */
        .mobile-info .main-info {
          font-weight: 600;
          margin-bottom: 4px;
          color: var(--fg);
        }
        .mobile-details {
          display: none;
          font-size: var(--fs-12, 0.8rem);
          color: var(--muted);
          flex-direction: column;
          gap: 2px;
        }

        /* Ações */
        .actions-buttons {
          display: flex;
          gap: 6px;
          justify-content: flex-start;
          flex-wrap: wrap;
        }

        .small-btn {
          padding: 6px 10px !important;
          font-size: 0.8rem !important;
        }
        .danger {
          border-color: color-mix(in srgb, var(--error-strong, #991b1b) 40%, var(--border));
        }

        /* Formulário overlay (dialog) */
        .form-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,.5);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          z-index: 1000;
        }
        .form-container {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 24px;
          width: 100%;
          max-width: 520px;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 10px 25px rgba(0,0,0,0.2);
        }
        .form-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        .form-header h2 {
          margin: 0;
          font-size: clamp(var(--fs-18), 3vw, 1.3rem);
          color: var(--fg);
        }
        .close-btn {
          background: none;
          border: none;
          font-size: 1.5rem;
          cursor: pointer;
          color: var(--muted);
          padding: 0;
          width: 32px;
          height: 32px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
        }
        .close-btn:hover, .close-btn:focus-visible {
          background: var(--panel-muted);
          color: var(--fg);
          outline: 2px solid var(--focus);
          outline-offset: 2px;
        }

        .form-group {
          margin-bottom: 16px;
        }
        .form-group label {
          display: block;
          margin-bottom: 6px;
          font-weight: 600;
          color: var(--fg);
        }
        .form-group input {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid var(--border);
          border-radius: 8px;
          font-size: var(--fs-16, 1rem);
          background: #fff;
          color: #111;
        }
        .form-group input:focus-visible {
          outline: 3px solid var(--focus);
          outline-offset: 2px;
        }

        .form-actions {
          display: flex;
          gap: 10px;
          margin-top: 24px;
          flex-wrap: wrap;
        }
        .form-actions .toggle-btn {
          flex: 1 1 200px;
        }
        .form-tip {
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid var(--border);
        }
        .form-tip small { color: var(--muted); }

        /* Botões padronizados (usam tokens do tema) */
        .toggle-btn {
          padding: 10px 16px;
          border: 1px solid var(--border);
          background: var(--panel);
          color: var(--fg);
          border-radius: var(--radius);
          cursor: pointer;
          font-size: var(--fs-14, 0.9rem);
          font-weight: 600;
          transition: all 0.2s ease;
          box-shadow: var(--shadow);
        }
        .toggle-btn:hover,
        .toggle-btn:focus-visible {
          background: var(--accent);
          color: #fff;
          border-color: var(--accent-strong);
          outline: none;
        }
        .toggle-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .toggle-btn.primary {
          background: var(--accent-bg, #1d4ed8);
          color: #fff;
          border-color: var(--accent-bg-hover, #1e40af);
        }
        .toggle-btn.primary:hover,
        .toggle-btn.primary:focus-visible {
          background: var(--accent-bg-hover, #1e40af);
        }
        .toggle-btn.secondary {
          background: var(--panel);
          color: var(--fg);
        }

        /* Media Queries */
        @media (max-width: 768px) {
          .actions-buttons {
            flex-direction: column;
            gap: 4px;
          }
          .small-btn {
            padding: 8px !important;
            font-size: 0.75rem !important;
          }
          .mobile-details { display: flex; }
          .hide-on-mobile { display: none !important; }
          .form-container { padding: 20px; margin: 10px; }
          .form-actions { flex-direction: column; }
        }
        @media (max-width: 480px) {
          .hide-on-small { display: none !important; }
          .page-title { font-size: clamp(1.35rem, 6vw, 1.5rem); }
          .form-overlay { padding: 10px; }
          .form-container { padding: 16px; }
          .form-header h2 { font-size: 1.1rem; }
        }
        @media (min-width: 769px) {
          .actions-column { width: 180px; }
        }
      `}</style>
    </>
  );
}