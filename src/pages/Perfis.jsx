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

  // modal state
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null); // perfil em edição (obj) ou null
  const [form, setForm] = useState({ nome: "", ativo: 1 });

  function openCreate() {
    setErr(""); setSuccess("");
    setEditing(null);
    setForm({ nome: "", ativo: 1 });
    setOpen(true);
  }
  function openEdit(p) {
    setErr(""); setSuccess("");
    setEditing(p);
    setForm({ nome: p.nome || "", ativo: p.ativo ? 1 : 0 });
    setOpen(true);
  }
  function closeModal() {
    setOpen(false);
  }

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const r = await fetch(`${API_BASE}/api/perfis`, {
        credentials: "include",
      });
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

      let r, data;
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
      data = await r.json().catch(() => null);
      if (!r.ok || !data?.ok) throw new Error(data?.error || "Falha ao salvar.");

      setSuccess(editing ? "Perfil atualizado." : "Perfil criado.");
      setOpen(false);
      await load();
    } catch (e) {
      // mensagens vindas do backend (ex.: “não pode renomear/excluir administrador”, etc)
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
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="toggle-btn" onClick={load} disabled={loading} aria-busy={loading ? "true" : "false"}>
            <ArrowPathIcon width="18" height="18" />
            {loading ? "Atualizando..." : "Atualizar"}
          </button>
          <button className="toggle-btn" onClick={openCreate}>
            <PlusIcon width="18" height="18" />
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
                  <tr>
                    <td colSpan={3}>Carregando…</td>
                  </tr>
                ) : perfis.length === 0 ? (
                  <tr>
                    <td colSpan={3}>Nenhum perfil encontrado.</td>
                  </tr>
                ) : (
                  perfis.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.nome}</strong>
                        {String(p.nome || "").trim().toLowerCase() === "administrador" && (
                          <span className="badge" title="Perfil fixo">
                            base
                          </span>
                        )}
                      </td>
                      <td>
                        {p.ativo ? (
                          <span className="chip chip-success">Ativo</span>
                        ) : (
                          <span className="chip chip-muted">Inativo</span>
                        )}
                      </td>
                      <td>
                        <div className="btns">
                          <button className="icon-btn" onClick={() => openEdit(p)} title="Editar">
                            <PencilSquareIcon width="18" height="18" />
                          </button>
                          <button
                            className="icon-btn danger"
                            onClick={() => removePerfil(p)}
                            title="Excluir"
                            disabled={String(p.nome || "").trim().toLowerCase() === "administrador"}
                          >
                            <TrashIcon width="18" height="18" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Modal simples */}
      {open && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">{editing ? "Editar perfil" : "Novo perfil"}</h3>
              <button className="icon-btn" onClick={closeModal} aria-label="Fechar">
                <XMarkIcon width="20" height="20" />
              </button>
            </div>

            <form className="form" onSubmit={save}>
              <label htmlFor="p-nome">Nome do perfil</label>
              <input
                id="p-nome"
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                placeholder='Ex.: "Supervisor", "RH", "Financeiro"'
                maxLength={100}
                required
              />

              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={!!form.ativo}
                  onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked ? 1 : 0 }))}
                />
                <span>Ativo</span>
              </label>

              <div className="modal-actions">
                <button type="button" className="toggle-btn" onClick={closeModal}>
                  Cancelar
                </button>
                <button type="submit" className="toggle-btn" disabled={saving}>
                  <CheckIcon width="18" height="18" />
                  {saving ? "Salvando..." : editing ? "Atualizar" : "Criar"}
                </button>
              </div>
            </form>

            <p className="hint">
              Observação: o perfil <strong>Administrador</strong> é base do sistema, não pode ser excluído e a empresa nunca pode ficar sem pelo menos um usuário com esse perfil.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
