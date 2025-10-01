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
            <div className="table-wrapper">
              <table className="pessoas-table">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th className="hide-on-mobile">CPF</th>
                    <th className="hide-on-mobile">E-mail</th>
                    <th className="hide-on-small">Telefone</th>
                    <th className="actions-column">Ações</th>
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
                          <button className="toggle-btn small-btn" onClick={() => abrirEdicao(p)}>Editar</button>
                          <button className="toggle-btn small-btn" onClick={() => excluir(p.id)}>Excluir</button>
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
        <div className="form-overlay">
          <div className="form-container">
            <div className="form-header">
              <h2>{editId ? "Editar Pessoa" : "Nova Pessoa"}</h2>
              <button 
                className="close-btn" 
                onClick={() => setShowForm(false)}
                aria-label="Fechar"
              >
                ×
              </button>
            </div>
            
            <form className="form" onSubmit={salvar}>
              <div className="form-group">
                <label htmlFor="nome">Nome</label>
                <input
                  id="nome"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  required
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
                />
              </div>

              <div className="form-group">
                <label htmlFor="nasc">Data de Nascimento</label>
                <input
                  id="nasc"
                  type="date"
                  value={form.data_nascimento}
                  onChange={(e) => setForm({ ...form, data_nascimento: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label htmlFor="tel">Telefone</label>
                <input
                  id="tel"
                  value={form.telefone}
                  onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label htmlFor="email">E-mail</label>
                <input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>

              <div className="form-actions">
                <button type="button" className="toggle-btn secondary" onClick={() => setShowForm(false)}>
                  Cancelar
                </button>
                <button type="submit" className="toggle-btn primary">
                  {editId ? "Salvar alterações" : "Criar pessoa"}
                </button>
              </div>

              {!editId && (
                <div className="form-tip">
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
        /* Header responsivo */
        .main-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 24px;
          gap: 16px;
        }

        .header-content h1 {
          margin: 0 0 4px 0;
          font-size: 1.5rem;
        }

        .header-content p {
          margin: 0;
          color: var(--muted);
          font-size: 0.9rem;
        }

        .header-actions {
          display: flex;
          gap: 8px;
          flex-shrink: 0;
        }

        /* Alertas */
        .error-alert {
          background: #fee;
          border: 1px solid #fcc;
          color: #c33;
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
          font-size: 1rem;
        }

        /* Container da tabela */
        .table-container {
          width: 100%;
          overflow: hidden;
        }

        .stat-card {
          background: white;
          border-radius: 12px;
          padding: 0;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
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
          min-width: 600px;
        }

        .pessoas-table th {
          padding: 16px 12px;
          text-align: left;
          font-weight: 600;
          color: var(--muted);
          border-bottom: 1px solid var(--border);
          background: #f8f9fa;
        }

        .pessoas-table td {
          padding: 16px 12px;
          border-bottom: 1px solid var(--border);
          vertical-align: top;
        }

        /* Informações mobile */
        .mobile-info .main-info {
          font-weight: 500;
          margin-bottom: 4px;
        }

        .mobile-details {
          display: none;
          font-size: 0.8rem;
          color: var(--muted);
          flex-direction: column;
          gap: 2px;
        }

        /* Ações */
        .actions-buttons {
          display: flex;
          gap: 6px;
          justify-content: flex-start;
        }

        .small-btn {
          padding: 6px 10px !important;
          font-size: 0.8rem !important;
        }

        /* Formulário overlay */
        .form-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          z-index: 1000;
        }

        .form-container {
          background: white;
          border-radius: 12px;
          padding: 24px;
          width: 100%;
          max-width: 500px;
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
          font-size: 1.3rem;
        }

        .close-btn {
          background: none;
          border: none;
          font-size: 1.5rem;
          cursor: pointer;
          color: var(--muted);
          padding: 0;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .close-btn:hover {
          color: #333;
        }

        .form-group {
          margin-bottom: 16px;
        }

        .form-group label {
          display: block;
          margin-bottom: 6px;
          font-weight: 500;
          color: #333;
        }

        .form-group input {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid var(--border);
          border-radius: 6px;
          font-size: 1rem;
        }

        .form-actions {
          display: flex;
          gap: 10px;
          margin-top: 24px;
        }

        .form-actions .toggle-btn {
          flex: 1;
        }

        .form-tip {
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid var(--border);
        }

        .form-tip small {
          color: var(--muted);
        }

        /* Botões */
        .toggle-btn {
          padding: 10px 16px;
          border: 1px solid var(--border);
          background: white;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.9rem;
          transition: all 0.2s;
        }

        .toggle-btn:hover {
          background: #f5f5f5;
        }

        .toggle-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .toggle-btn.primary {
          background: #007bff;
          color: white;
          border-color: #007bff;
        }

        .toggle-btn.primary:hover {
          background: #0056b3;
        }

        .toggle-btn.secondary {
          background: #6c757d;
          color: white;
          border-color: #6c757d;
        }

        .toggle-btn.secondary:hover {
          background: #545b62;
        }

        /* Media Queries */
        @media (max-width: 768px) {
          .main-header {
            flex-direction: column;
            align-items: stretch;
          }

          .header-actions {
            margin-top: 12px;
            justify-content: stretch;
          }

          .header-actions .toggle-btn {
            flex: 1;
          }

          .hide-on-mobile {
            display: none !important;
          }

          .mobile-details {
            display: flex;
          }

          .pessoas-table td {
            padding: 12px 8px;
          }

          .actions-buttons {
            flex-direction: column;
            gap: 4px;
          }

          .small-btn {
            padding: 8px !important;
            font-size: 0.75rem !important;
          }

          .form-container {
            padding: 20px;
            margin: 10px;
          }

          .form-actions {
            flex-direction: column;
          }
        }

        @media (max-width: 480px) {
          .hide-on-small {
            display: none !important;
          }

          .header-content h1 {
            font-size: 1.3rem;
          }

          .form-overlay {
            padding: 10px;
          }

          .form-container {
            padding: 16px;
          }

          .form-header h2 {
            font-size: 1.1rem;
          }
        }

        @media (min-width: 769px) {
          .actions-column {
            width: 160px;
          }
        }
      `}</style>
    </>
  );
}
