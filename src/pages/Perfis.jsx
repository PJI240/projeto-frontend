// src/pages/Perfis.jsx
import { useEffect, useState } from "react";
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
  CheckIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";

const API_BASE = import.meta.env.VITE_API_BASE?.replace(/\/+$/, "") || "";

export default function Perfis() {
  const [perfis, setPerfis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState("");

  // painel de formulário (inline)
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState(null); // objeto perfil ou null
  const [form, setForm] = useState({ nome: "", ativo: 1 });

  function openCreate() {
    setErr(""); setSuccess("");
    setEditing(null);
    setForm({ nome: "", ativo: 1 });
    setPanelOpen(true);
  }
  function openEdit(p) {
    setErr(""); setSuccess("");
    setEditing(p);
    setForm({ nome: p.nome || "", ativo: p.ativo ? 1 : 0 });
    setPanelOpen(true);
  }
  function closePanel() {
    setPanelOpen(false);
  }

  async function load() {
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
  useEffect(() => { load(); }, []);

  async function save(e) {
    e?.preventDefault?.();
    setSaving(true);
    setErr(""); setSuccess("");

    try {
      const body = { nome: form.nome?.trim(), ativo: form.ativo ? 1 : 0 };
      if (!body.nome) throw new Error("Informe o nome do perfil.");

      let r;
      if (editing) {
        r = await fetch(`${API_BASE}/api/perfis/${editing.id}`, {
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

      setSuccess(editing ? "Perfil atualizado." : "Perfil criado.");
      setPanelOpen(false);
      await load();
    } catch (e) {
      setErr(e.message || "Falha ao salvar perfil.");
    } finally {
      setSaving(false);
    }
  }

  async function removePerfil(p) {
    setErr(""); setSuccess("");

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
      await load();
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
        <div className="toggles">
          <button
            className="toggle-btn"
            onClick={load}
            disabled={loading}
            aria-busy={loading ? "true" : "false"}
            title="Atualizar"
          >
            <ArrowPathIcon className={`icon-sm ${loading ? "animate-spin" : ""}`} />
            {loading ? "Atualizando..." : "Atualizar"}
          </button>
          <button className="toggle-btn" onClick={openCreate} title="Novo perfil">
            <PlusIcon className="icon-sm" />
            Novo Perfil
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

      {/* Painel inline de criação/edição */}
      {panelOpen && (
        <section style={{ marginBottom: 16 }}>
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <h3 style={{ margin: 0 }}>{editing ? "Editar perfil" : "Novo perfil"}</h3>
              <button className="toggle-btn" onClick={closePanel} title="Fechar">
                <XMarkIcon className="icon-sm" />
                Fechar
              </button>
            </div>

            <form className="form" onSubmit={save}>
              <label htmlFor="perfil-nome">Nome do perfil</label>
              <input
                id="perfil-nome"
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                placeholder='Ex.: "Supervisor", "RH", "Financeiro"'
                maxLength={100}
                required
              />

              <label className="checkbox" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={!!form.ativo}
                  onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked ? 1 : 0 }))}
                />
                <span>Ativo</span>
              </label>

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button type="button" className="toggle-btn" onClick={closePanel}>
                  Cancelar
                </button>
                <button type="submit" className="toggle-btn" disabled={saving}>
                  <CheckIcon className="icon-sm" />
                  {saving ? "Salvando..." : editing ? "Atualizar" : "Criar"}
                </button>
              </div>
            </form>

            <p style={{ marginTop: 8, color: "var(--muted)", fontSize: "var(--fs-14)" }}>
              Observação: o perfil <strong>Administrador</strong> é base do sistema, não pode ser excluído e a empresa nunca pode
              ficar sem pelo menos um usuário com esse perfil.
            </p>
          </div>
        </section>
      )}

      {/* Tabela */}
      <section>
        <div className="card">
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: "60%" }}>Nome</th>
                  <th style={{ width: "20%" }}>Ativo</th>
                  <th style={{ width: "20%" }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={3}>Carregando…</td></tr>
                ) : perfis.length === 0 ? (
                  <tr><td colSpan={3}>Nenhum perfil encontrado.</td></tr>
                ) : (
                  perfis.map((p) => {
                    const isAdmin = String(p.nome || "").trim().toLowerCase() === "administrador";
                    return (
                      <tr key={p.id}>
                        <td>
                          <strong>{p.nome}</strong>
                          {isAdmin && (
                            <span
                              style={{
                                marginLeft: 8,
                                fontSize: "var(--fs-12)",
                                color: "var(--muted)",
                                border: "1px solid var(--border)",
                                padding: "2px 6px",
                                borderRadius: 999,
                                verticalAlign: "middle",
                              }}
                              title="Perfil base"
                            >
                              base
                            </span>
                          )}
                        </td>
                        <td>
                          {p.ativo ? (
                            <span
                              style={{
                                display: "inline-block",
                                padding: "2px 8px",
                                borderRadius: 999,
                                fontSize: "var(--fs-12)",
                                background: "color-mix(in srgb, var(--success) 18%, white)",
                                color: "#065f46",
                              }}
                            >
                              Ativo
                            </span>
                          ) : (
                            <span
                              style={{
                                display: "inline-block",
                                padding: "2px 8px",
                                borderRadius: 999,
                                fontSize: "var(--fs-12)",
                                background: "#f3f4f6",
                                color: "#374151",
                              }}
                            >
                              Inativo
                            </span>
                          )}
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button className="toggle-btn" onClick={() => openEdit(p)} title="Editar">
                              <PencilSquareIcon className="icon-sm" />
                              Editar
                            </button>
                            <button
                              className="toggle-btn"
                              onClick={() => removePerfil(p)}
                              title="Excluir"
                              disabled={isAdmin}
                            >
                              <TrashIcon className="icon-sm" />
                              Excluir
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  );
}
