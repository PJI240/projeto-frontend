// src/pages/Pessoas.jsx
import { useEffect, useMemo, useState } from "react";

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
    } catch (e) {
      setErr(e.message || "Erro ao carregar.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

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
      await carregar();
    } catch (e) {
      setErr(e.message || "Erro ao salvar.");
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
      await carregar();
    } catch (e) {
      setErr(e.message || "Erro ao excluir.");
    }
  }

  return (
    <>
      <header className="main-header">
        <div className="header-content">
          <h1>Pessoas</h1>
          <p>Gerencie as informações pessoais da sua equipe.</p>
        </div>
        <div className="header-actions">
          <button className="toggle-btn" onClick={abrirNovo}>Nova Pessoa</button>
          <button className="toggle-btn" onClick={carregar} disabled={loading}>
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
        <input
          placeholder="Buscar por nome, CPF ou e-mail…"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          className="search-input"
        />
      </div>

      <div className="table-container">
        <div className="stat-card">
          {loading ? (
            <div className="loading-message">Carregando…</div>
          ) : listaFiltrada.length === 0 ? (
            <div className="empty-message">
              Nenhuma pessoa encontrada para sua empresa.
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <table className="desktop-table">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>CPF</th>
                    <th>E-mail</th>
                    <th>Telefone</th>
                    <th className="actions-header">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {listaFiltrada.map((p) => (
                    <tr key={p.id}>
                      <td>{p.nome}</td>
                      <td>{p.cpf || "—"}</td>
                      <td>{p.email || "—"}</td>
                      <td>{p.telefone || "—"}</td>
                      <td className="actions-cell">
                        <button className="toggle-btn" onClick={() => abrirEdicao(p)}>Editar</button>
                        <button className="toggle-btn" onClick={() => excluir(p.id)}>Excluir</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Mobile Cards */}
              <div className="mobile-cards">
                {listaFiltrada.map((p) => (
                  <div key={p.id} className="person-card">
                    <div className="person-info">
                      <div className="person-name">{p.nome}</div>
                      <div className="person-details">
                        <div><strong>CPF:</strong> {p.cpf || "—"}</div>
                        <div><strong>E-mail:</strong> {p.email || "—"}</div>
                        <div><strong>Telefone:</strong> {p.telefone || "—"}</div>
                      </div>
                    </div>
                    <div className="person-actions">
                      <button className="toggle-btn" onClick={() => abrirEdicao(p)}>Editar</button>
                      <button className="toggle-btn" onClick={() => excluir(p.id)}>Excluir</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Drawer/ formulário simples */}
      {showForm && (
        <div className="form-container">
          <div className="stat-card">
            <h2 className="form-title">
              {editId ? "Editar Pessoa" : "Nova Pessoa"}
            </h2>
            <form className="form" onSubmit={salvar}>
              <div className="form-grid">
                <div className="form-field">
                  <label htmlFor="nome">Nome</label>
                  <input
                    id="nome"
                    value={form.nome}
                    onChange={(e) => setForm({ ...form, nome: e.target.value })}
                    required
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="cpf">CPF</label>
                  <input
                    id="cpf"
                    value={form.cpf}
                    onChange={(e) => setForm({ ...form, cpf: e.target.value })}
                    inputMode="numeric"
                    placeholder="Somente números"
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="nasc">Data de Nascimento</label>
                  <input
                    id="nasc"
                    type="date"
                    value={form.data_nascimento}
                    onChange={(e) => setForm({ ...form, data_nascimento: e.target.value })}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="tel">Telefone</label>
                  <input
                    id="tel"
                    value={form.telefone}
                    onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                  />
                </div>

                <div className="form-field full-width">
                  <label htmlFor="email">E-mail</label>
                  <input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-actions">
                <button type="button" className="toggle-btn" onClick={() => setShowForm(false)}>
                  Cancelar
                </button>
                <button type="submit" className="toggle-btn">
                  {editId ? "Salvar alterações" : "Criar pessoa"}
                </button>
              </div>

              {!editId && (
                <small className="form-hint">
                  * Dica: para a pessoa aparecer nesta lista, vincule-a depois como funcionário (módulo Funcionários).
                </small>
              )}
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        .main-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 16px;
          flex-wrap: wrap;
        }

        .header-content {
          flex: 1;
          min-width: 250px;
        }

        .header-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .error-alert {
          margin-bottom: 16px;
          padding: 12px 16px;
          background: var(--error-bg, #fee);
          color: var(--error-text, #c33);
          border: 1px solid var(--error-border, #fcc);
          border-radius: 8px;
        }

        .search-container {
          margin-bottom: 16px;
        }

        .search-input {
          width: 100%;
          padding: 12px;
          border: 1px solid var(--border);
          border-radius: 8px;
          font-size: 14px;
        }

        .table-container {
          margin-bottom: 16px;
        }

        .stat-card {
          background: var(--card-bg, #fff);
          border-radius: 12px;
          border: 1px solid var(--border);
          overflow: hidden;
        }

        .loading-message,
        .empty-message {
          padding: 20px;
          text-align: center;
          color: var(--muted);
        }

        /* Desktop Table */
        .desktop-table {
          width: 100%;
          border-collapse: collapse;
          display: table;
        }

        .desktop-table th {
          padding: 16px 12px;
          text-align: left;
          border-bottom: 1px solid var(--border);
          background: var(--table-header-bg, #f8f9fa);
          font-weight: 600;
          color: var(--text);
        }

        .desktop-table td {
          padding: 16px 12px;
          border-bottom: 1px solid var(--border);
        }

        .actions-header {
          width: 160px;
        }

        .actions-cell {
          display: flex;
          gap: 8px;
        }

        /* Mobile Cards */
        .mobile-cards {
          display: none;
          flex-direction: column;
          gap: 12px;
          padding: 16px;
        }

        .person-card {
          background: var(--card-bg, #fff);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 16px;
        }

        .person-name {
          font-weight: 600;
          font-size: 16px;
          margin-bottom: 8px;
          color: var(--text);
        }

        .person-details {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-bottom: 12px;
          font-size: 14px;
          color: var(--muted);
        }

        .person-details strong {
          color: var(--text);
        }

        .person-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        /* Form Styles */
        .form-container {
          margin-top: 16px;
        }

        .form-title {
          margin: 0 0 16px 0;
          font-size: 20px;
          font-weight: 600;
        }

        .form-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
        }

        .form-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .form-field.full-width {
          grid-column: 1 / -1;
        }

        .form-field label {
          font-weight: 500;
          color: var(--text);
          font-size: 14px;
        }

        .form-field input {
          padding: 12px;
          border: 1px solid var(--border);
          border-radius: 8px;
          font-size: 14px;
          width: 100%;
          box-sizing: border-box;
        }

        .form-actions {
          display: flex;
          gap: 8px;
          margin-top: 20px;
          flex-wrap: wrap;
        }

        .form-hint {
          display: block;
          margin-top: 12px;
          color: var(--muted);
          font-size: 12px;
        }

        /* Toggle Button Base Styles */
        .toggle-btn {
          padding: 10px 16px;
          border: 1px solid var(--border);
          background: var(--button-bg, #fff);
          color: var(--button-text, #333);
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .toggle-btn:hover {
          background: var(--button-hover-bg, #f5f5f5);
        }

        .toggle-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        /* Responsive Breakpoints */
        @media (max-width: 768px) {
          .main-header {
            flex-direction: column;
            align-items: stretch;
          }

          .header-actions {
            justify-content: stretch;
          }

          .header-actions .toggle-btn {
            flex: 1;
            min-width: 120px;
          }

          .desktop-table {
            display: none;
          }

          .mobile-cards {
            display: flex;
          }

          .form-grid {
            grid-template-columns: 1fr;
          }

          .form-actions {
            flex-direction: column;
          }

          .form-actions .toggle-btn {
            flex: 1;
          }
        }

        @media (min-width: 769px) {
          .form-grid {
            grid-template-columns: 1fr 1fr;
          }

          .form-field.full-width {
            grid-column: 1 / -1;
          }
        }

        @media (max-width: 480px) {
          .person-actions {
            flex-direction: column;
          }

          .person-actions .toggle-btn {
            flex: 1;
          }
        }
      `}</style>
    </>
  );
}
