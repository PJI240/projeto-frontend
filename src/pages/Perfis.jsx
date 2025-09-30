// src/pages/Perfis.jsx
import { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE?.replace(/\/+$/, "") || "";

export default function Perfis() {
  const [perfis, setPerfis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState("");

  // painel de formulário (inline)
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ nome: "", ativo: 1 });

  function abrirNovo() {
    setErr(""); 
    setSuccess("");
    setEditId(null);
    setForm({ nome: "", ativo: 1 });
    setShowForm(true);
  }

  function abrirEdicao(p) {
    setErr(""); 
    setSuccess("");
    setEditId(p.id);
    setForm({ nome: p.nome || "", ativo: p.ativo ? 1 : 0 });
    setShowForm(true);
  }

  function fecharForm() {
    setShowForm(false);
  }

  async function carregar() {
    setLoading(true);
    setErr("");
    try {
      const r = await fetch(`${API_BASE}/api/perfis`, { credentials: "include" });
      const data = await r.json().catch(() => null);
      if (!r.ok || !data?.ok) throw new Error(data?.error || `HTTP ${r.status}`);
      setPerfis(data.perfis || []);
    } catch (e) {
      console.error("PERFIS_LOAD_ERR", e);
      setErr(e.message || "Falha ao carregar perfis.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { 
    carregar(); 
  }, []);

  async function salvar(e) {
    e?.preventDefault?.();
    setSaving(true);
    setErr(""); 
    setSuccess("");

    try {
      const body = { 
        nome: form.nome?.trim(), 
        ativo: form.ativo ? 1 : 0 
      };
      
      if (!body.nome) throw new Error("Informe o nome do perfil.");

      let r;
      if (editId) {
        r = await fetch(`${API_BASE}/api/perfis/${editId}`, {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        r = await fetch(`${API_BASE}/api/perfis`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }
      
      const data = await r.json().catch(() => null);
      if (!r.ok || !data?.ok) throw new Error(data?.error || "Falha ao salvar.");

      setSuccess(editId ? "Perfil atualizado." : "Perfil criado.");
      setShowForm(false);
      await carregar();
    } catch (e) {
      setErr(e.message || "Falha ao salvar perfil.");
    } finally {
      setSaving(false);
    }
  }

  async function excluir(p) {
    setErr(""); 
    setSuccess("");

    const nomeLower = String(p.nome || "").trim().toLowerCase();
    if (nomeLower === "administrador") {
      setErr("Este perfil não pode ser excluído.");
      return;
    }
    
    if (!confirm(`Excluir o perfil "${p.nome}"?`)) return;

    try {
      const r = await fetch(`${API_BASE}/api/perfis/${p.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await r.json().catch(() => null);
      if (!r.ok || !data?.ok) throw new Error(data?.error || "Falha ao excluir.");
      setSuccess("Perfil excluído.");
      await carregar();
    } catch (e) {
      setErr(e.message || "Não foi possível excluir o perfil.");
    }
  }

  return (
    <>
      <header className="main-header">
        <div className="header-content">
          <h1>Perfis</h1>
          <p>Gerencie os perfis de acesso desta empresa.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="toggle-btn" onClick={abrirNovo}>
            Novo Perfil
          </button>
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
      
      {success && (
        <div className="success-alert" role="status" style={{ marginBottom: 16 }}>
          {success}
        </div>
      )}

      <div className="stats-grid" style={{ gridTemplateColumns: "1fr" }}>
        <div className="stat-card" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: 16, color: "var(--muted)" }}>Carregando…</div>
          ) : perfis.length === 0 ? (
            <div style={{ padding: 16, color: "var(--muted)" }}>
              Nenhum perfil encontrado.
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                  <th style={{ padding: 12 }}>Nome</th>
                  <th style={{ padding: 12 }}>Status</th>
                  <th style={{ padding: 12, width: 160 }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {perfis.map((p) => {
                  const isAdmin = String(p.nome || "").trim().toLowerCase() === "administrador";
                  return (
                    <tr key={p.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {p.nome}
                          {isAdmin && (
                            <span
                              style={{
                                fontSize: "12px",
                                color: "var(--muted)",
                                border: "1px solid var(--border)",
                                padding: "2px 8px",
                                borderRadius: "12px",
                              }}
                            >
                              base
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: 12 }}>
                        {p.ativo ? "Ativo" : "Inativo"}
                      </td>
                      <td style={{ padding: 12, display: "flex", gap: 8 }}>
                        <button className="toggle-btn" onClick={() => abrirEdicao(p)}>
                          Editar
                        </button>
                        <button 
                          className="toggle-btn" 
                          onClick={() => excluir(p)}
                          disabled={isAdmin}
                        >
                          Excluir
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Drawer/ formulário */}
      {showForm && (
        <div className="stat-card" style={{ marginTop: 16 }}>
          <h2 className="title" style={{ margin: 0, marginBottom: 12 }}>
            {editId ? "Editar Perfil" : "Novo Perfil"}
          </h2>
          <form className="form" onSubmit={salvar}>
            <label htmlFor="perfil-nome">Nome do perfil</label>
            <input
              id="perfil-nome"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder='Ex.: "Supervisor", "RH", "Financeiro"'
              maxLength={100}
              required
            />

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
              <input
                id="perfil-ativo"
                type="checkbox"
                checked={!!form.ativo}
                onChange={(e) => setForm({ ...form, ativo: e.target.checked ? 1 : 0 })}
              />
              <label htmlFor="perfil-ativo">Ativo</label>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button type="button" className="toggle-btn" onClick={fecharForm}>
                Cancelar
              </button>
              <button type="submit" className="toggle-btn" disabled={saving}>
                {saving ? "Salvando..." : editId ? "Salvar alterações" : "Criar perfil"}
              </button>
            </div>

            <small style={{ color: "var(--muted)", display: "block", marginTop: 12 }}>
              Observação: o perfil <strong>Administrador</strong> é base do sistema, não pode ser excluído e a empresa nunca pode
              ficar sem pelo menos um usuário com esse perfil.
            </small>
          </form>
        </div>
      )}
    </>
  );
}
