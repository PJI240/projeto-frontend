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
        <div style={{ display: "flex", gap: 8 }}>
          <button className="toggle-btn" onClick={abrirNovo}>Nova Pessoa</button>
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
          placeholder="Buscar por nome, CPF ou e-mail…"
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
              Nenhuma pessoa encontrada para sua empresa.
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                  <th style={{ padding: 12 }}>Nome</th>
                  <th style={{ padding: 12 }}>CPF</th>
                  <th style={{ padding: 12 }}>E-mail</th>
                  <th style={{ padding: 12 }}>Telefone</th>
                  <th style={{ padding: 12, width: 160 }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {listaFiltrada.map((p) => (
                  <tr key={p.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: 12 }}>{p.nome}</td>
                    <td style={{ padding: 12 }}>{p.cpf || "—"}</td>
                    <td style={{ padding: 12 }}>{p.email || "—"}</td>
                    <td style={{ padding: 12 }}>{p.telefone || "—"}</td>
                    <td style={{ padding: 12, display: "flex", gap: 8 }}>
                      <button className="toggle-btn" onClick={() => abrirEdicao(p)}>Editar</button>
                      <button className="toggle-btn" onClick={() => excluir(p.id)}>Excluir</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Drawer/ formulário simples */}
      {showForm && (
        <div className="stat-card" style={{ marginTop: 16 }}>
          <h2 className="title" style={{ margin: 0, marginBottom: 12 }}>
            {editId ? "Editar Pessoa" : "Nova Pessoa"}
          </h2>
          <form className="form" onSubmit={salvar}>
            <label htmlFor="nome">Nome</label>
            <input
              id="nome"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              required
            />

            <label htmlFor="cpf">CPF</label>
            <input
              id="cpf"
              value={form.cpf}
              onChange={(e) => setForm({ ...form, cpf: e.target.value })}
              inputMode="numeric"
              placeholder="Somente números"
            />

            <label htmlFor="nasc">Data de Nascimento</label>
            <input
              id="nasc"
              type="date"
              value={form.data_nascimento}
              onChange={(e) => setForm({ ...form, data_nascimento: e.target.value })}
            />

            <label htmlFor="tel">Telefone</label>
            <input
              id="tel"
              value={form.telefone}
              onChange={(e) => setForm({ ...form, telefone: e.target.value })}
            />

            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />

            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button type="button" className="toggle-btn" onClick={() => setShowForm(false)}>
                Cancelar
              </button>
              <button type="submit" className="toggle-btn">
                {editId ? "Salvar alterações" : "Criar pessoa"}
              </button>
            </div>

            {!editId && (
              <small style={{ color: "var(--muted)" }}>
                * Dica: para a pessoa aparecer nesta lista, vincule-a depois como funcionário (módulo Funcionários).
              </small>
            )}
          </form>
        </div>
      )}
    </>
  );
}
