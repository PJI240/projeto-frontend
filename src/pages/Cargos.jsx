// src/pages/Cargos.jsx
import { useEffect, useMemo, useState } from "react";

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");

export default function Cargos() {
  const [itens, setItens] = useState([]);
  const [filtro, setFiltro] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ nome: "", descricao: "", ativo: 1 });

  const listaFiltrada = useMemo(() => {
    const f = filtro.trim().toLowerCase();
    if (!f) return itens;
    return itens.filter((c) =>
      [c.nome, c.descricao].filter(Boolean).some((v) => String(v).toLowerCase().includes(f))
    );
  }, [filtro, itens]);

  async function carregar() {
    setLoading(true);
    setErr("");
    try {
      const r = await fetch(`${API_BASE}/api/cargos`, { credentials: "include" });
      const data = await r.json().catch(() => null);
      if (!r.ok || !data?.ok) throw new Error(data?.error || "Falha ao listar cargos.");
      setItens(data.cargos || []);
    } catch (e) {
      setErr(e.message || "Erro ao carregar.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { carregar(); }, []);

  function abrirNovo() {
    setEditId(null);
    setForm({ nome: "", descricao: "", ativo: 1 });
    setShowForm(true);
  }

  function abrirEdicao(c) {
    setEditId(c.id);
    setForm({ nome: c.nome || "", descricao: c.descricao || "", ativo: c.ativo ? 1 : 0 });
    setShowForm(true);
  }

  async function salvar(e) {
    e?.preventDefault();
    setErr("");
    try {
      if (!form.nome.trim()) {
        setErr("Nome do cargo é obrigatório.");
        return;
      }

      const method = editId ? "PUT" : "POST";
      const url = editId ? `${API_BASE}/api/cargos/${editId}` : `${API_BASE}/api/cargos`;

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
    if (!confirm("Excluir este cargo? (Atenção: se houver funcionários vinculados, a exclusão pode falhar)")) return;
    setErr("");
    try {
      const r = await fetch(`${API_BASE}/api/cargos/${id}`, {
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
          <h1>Cargos</h1>
          <p>Funções/cargos disponíveis na empresa.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="toggle-btn" onClick={abrirNovo}>Novo Cargo</button>
          <button className="toggle-btn" onClick={carregar} disabled={loading}>
            {loading ? "Atualizando..." : "Atualizar"}
          </button>
        </div>
      </header>

      {err && (
        <div className="error-alert" role="alert" style={{ marginBottom: 16 }}>
          {err}
        </div>
      )}

      <div style={{ marginBottom: 12, display: "flex", gap: 8 }}>
        <input
          placeholder="Buscar por nome ou descrição…"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          style={{ flex: 1, padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border)" }}
        />
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: "1fr" }}>
        <div className="stat-card" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: 16, color: "var(--muted)" }}>Carregando…</div>
          ) : listaFiltrada.length === 0 ? (
            <div style={{ padding: 16, color: "var(--muted)" }}>
              Nenhum cargo cadastrado.
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                  <th style={{ padding: 12 }}>Nome</th>
                  <th style={{ padding: 12 }}>Descrição</th>
                  <th style={{ padding: 12, width: 120 }}>Ativo</th>
                  <th style={{ padding: 12, width: 200 }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {listaFiltrada.map((c) => (
                  <tr key={c.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: 12 }}>{c.nome}</td>
                    <td style={{ padding: 12 }}>{c.descricao || "—"}</td>
                    <td style={{ padding: 12 }}>{c.ativo ? "Sim" : "Não"}</td>
                    <td style={{ padding: 12, display: "flex", gap: 8 }}>
                      <button className="toggle-btn" onClick={() => abrirEdicao(c)}>Editar</button>
                      <button className="toggle-btn" onClick={() => excluir(c.id)}>Excluir</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showForm && (
        <div className="stat-card" style={{ marginTop: 16 }}>
          <h2 className="title" style={{ margin: 0, marginBottom: 12 }}>
            {editId ? "Editar Cargo" : "Novo Cargo"}
          </h2>
          <form className="form" onSubmit={salvar}>
            <label htmlFor="nome">Nome</label>
            <input
              id="nome"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              required
            />

            <label htmlFor="descricao">Descrição</label>
            <input
              id="descricao"
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            />

            <label htmlFor="ativo" style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                id="ativo"
                type="checkbox"
                checked={!!form.ativo}
                onChange={(e) => setForm({ ...form, ativo: e.target.checked ? 1 : 0 })}
              />
              Ativo
            </label>

            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button type="button" className="toggle-btn" onClick={() => setShowForm(false)}>
                Cancelar
              </button>
              <button type="submit" className="toggle-btn">
                {editId ? "Salvar alterações" : "Criar cargo"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
