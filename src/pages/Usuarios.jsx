// src/pages/Usuarios.jsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE?.replace(/\/+$/, "") || "";

/* ícones */
function PlusIcon(props){ return (<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" {...props}><path d="M19 11H13V5h-2v6H5v2h6v6h2v-6h6z"/></svg>); }
function TrashIcon(props){ return (<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" {...props}><path d="M6 7h12v13H6zM8 4h8l1 2H7l1-2z"/></svg>); }
function EditIcon(props){ return (<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" {...props}><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0L15.13 5.12l3.75 3.75 1.83-1.83z"/></svg>); }
function RefreshIcon(props){ return (<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" {...props}><path d="M17.65 6.35A7.95 7.95 0 0012 4 8 8 0 104 12h2a6 6 0 1110.24 3.66L14 13v7h7l-2.35-2.35A7.96 7.96 0 0020 12c0-2.21-.9-4.2-2.35-5.65z"/></svg>); }

const EMPTY_FORM = {
  id: null,
  pessoa_id: "",
  nome: "",
  email: "",
  senha: "",
  perfil_id: "",
  ativo: 1,
};

export default function Usuarios() {
  const [me, setMe] = useState({ roles: [] });

  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [pessoas, setPessoas] = useState([]);   // pessoas da empresa
  const [perfis, setPerfis] = useState([]);     // perfis da empresa
  const [loadingOpts, setLoadingOpts] = useState(true);

  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("");
  const [showForm, setShowForm] = useState(false);

  const isDev   = me.roles?.some((r) => String(r).toLowerCase() === "desenvolvedor");
  const isAdmin = me.roles?.some((r) => String(r).toLowerCase() === "administrador");

  function setField(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function fetchJSON(url, init = {}) {
    const r = await fetch(url, { credentials: "include", ...init });
    const data = await r.json().catch(() => null);
    if (!r.ok || data?.ok === false) {
      throw new Error(data?.error || `HTTP ${r.status}`);
    }
    return data;
  }

  async function carregarMe() {
    const d = await fetchJSON(`${API_BASE}/api/auth/me`);
    setMe({ roles: d.roles || [] });
  }

  async function carregarLista() {
    setLoading(true);
    setErr("");
    try {
      const data = await fetchJSON(`${API_BASE}/api/usuarios`);
      setLista(data.usuarios || []);
    } catch (e) {
      setErr(e.message || "Falha ao listar usuários.");
    } finally {
      setLoading(false);
    }
  }

  async function carregarOpcoes() {
    setLoadingOpts(true);
    try {
      const [p, pf] = await Promise.all([
        fetchJSON(`${API_BASE}/api/pessoas`), // pessoas da empresa
        fetchJSON(`${API_BASE}/api/perfis`),  // perfis da empresa
      ]);
      setPessoas(p.pessoas || []);
      setPerfis(pf.perfis || []);
    } catch (e) {
      console.error("LOAD_OPTS_ERR", e);
      setErr("Falha ao carregar pessoas/perfis.");
    } finally {
      setLoadingOpts(false);
    }
  }

  useEffect(() => {
    (async () => {
      await carregarMe();
      await carregarOpcoes();
      await carregarLista();
    })();
  }, []);

  // Pessoas disponíveis para criar usuário (1:1)
  const pessoasSemUsuario = useMemo(() => {
    const usedPessoaIds = new Set((lista || []).map((u) => u.pessoa_id).filter(Boolean));
    return (pessoas || []).filter((p) => !usedPessoaIds.has(p.id));
  }, [pessoas, lista]);

  const filtrados = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return lista;
    return (lista || []).filter((u) => {
      const nome = (u.nome || "").toLowerCase();
      const email = (u.email || "").toLowerCase();
      const pessoa = (u.pessoa_nome || "").toLowerCase();
      const perfil = (u.perfil_nome || "").toLowerCase();
      return nome.includes(q) || email.includes(q) || pessoa.includes(q) || perfil.includes(q);
    });
  }, [filter, lista]);

  function novo() {
    setErr("");
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function editar(item) {
    setErr("");
    setForm({
      id: item.id,
      pessoa_id: item.pessoa_id, // bloqueado na edição (mantém 1:1)
      nome: item.nome || "",
      email: item.email || "",
      senha: "", // não exibimos hash; só troca se informar nova senha
      perfil_id: item.perfil_id || "",
      ativo: item.ativo ? 1 : 0,
    });
    setShowForm(true);
  }

  function cancelar() {
    setForm(EMPTY_FORM);
    setShowForm(false);
  }

  function validaPerfil(perfilId) {
    const perfil = perfis.find((p) => p.id === Number(perfilId));
    if (!perfil) return { ok: false, error: "Perfil inválido." };
    const nome = String(perfil.nome || "").toLowerCase();
    if (nome === "administrador" && !(isAdmin || isDev)) {
      return { ok: false, error: "Você não tem permissão para atribuir perfil administrador." };
    }
    return { ok: true };
  }

  async function salvar(e) {
    e?.preventDefault?.();
    setErr("");
    setSaving(true);
    try {
      if (!form.id) {
        // criação
        if (!String(form.pessoa_id || "").trim()) throw new Error("Selecione a pessoa.");
        if (!String(form.nome || "").trim()) throw new Error("Informe o nome do usuário.");
        if (!String(form.email || "").trim()) throw new Error("Informe o e-mail.");
        if (!String(form.senha || "").trim()) throw new Error("Informe a senha.");
        if (!String(form.perfil_id || "").trim()) throw new Error("Selecione um perfil.");

        // valida permissão para admin
        const vp = validaPerfil(form.perfil_id);
        if (!vp.ok) throw new Error(vp.error);

        const payload = {
          pessoa_id: Number(form.pessoa_id),
          nome: form.nome.trim(),
          email: form.email.trim().toLowerCase(),
          senha: form.senha,
          perfil_id: Number(form.perfil_id),
          ativo: form.ativo ? 1 : 0,
        };

        await fetchJSON(`${API_BASE}/api/usuarios`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
      } else {
        // edição (pessoa travada; opcional trocar senha)
        if (!String(form.nome || "").trim()) throw new Error("Informe o nome do usuário.");
        if (!String(form.email || "").trim()) throw new Error("Informe o e-mail.");
        if (!String(form.perfil_id || "").trim()) throw new Error("Selecione um perfil.");

        const vp = validaPerfil(form.perfil_id);
        if (!vp.ok) throw new Error(vp.error);

        const payload = {
          nome: form.nome.trim(),
          email: form.email.trim().toLowerCase(),
          perfil_id: Number(form.perfil_id),
          ativo: form.ativo ? 1 : 0,
        };
        if (String(form.senha || "").trim()) {
          payload.senha = form.senha; // backend decide atualizar se presente
        }

        await fetchJSON(`${API_BASE}/api/usuarios/${form.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
      }

      await carregarLista();
      setForm(EMPTY_FORM);
      setShowForm(false);
    } catch (e) {
      setErr(e.message || "Falha ao salvar usuário.");
    } finally {
      setSaving(false);
    }
  }

  async function excluir(item) {
    if (!window.confirm(`Remover o usuário ${item.nome}?`)) return;
    setErr("");
    try {
      await fetchJSON(`${API_BASE}/api/usuarios/${item.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      await carregarLista();
      if (form.id === item.id) {
        setForm(EMPTY_FORM);
        setShowForm(false);
      }
    } catch (e) {
      setErr(e.message || "Falha ao excluir usuário.");
    }
  }

  return (
    <>
      <header className="main-header">
        <div className="header-content">
          <h1>Usuários</h1>
          <p>Gerencie os acessos vinculados às pessoas da empresa.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="toggle-btn" onClick={novo}>
            Novo Usuário
          </button>
          <button className="toggle-btn" onClick={carregarLista} disabled={loading}>
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
          placeholder="Buscar por nome, e-mail, pessoa ou perfil…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ flex: 1, padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border)" }}
        />
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: "1fr" }}>
        <div className="stat-card" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: 16, color: "var(--muted)" }}>Carregando…</div>
          ) : filtrados.length === 0 ? (
            <div style={{ padding: 16, color: "var(--muted)" }}>
              Nenhum usuário encontrado.
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                  <th style={{ padding: 12 }}>Nome</th>
                  <th style={{ padding: 12 }}>E-mail</th>
                  <th style={{ padding: 12 }}>Pessoa</th>
                  <th style={{ padding: 12 }}>Perfil</th>
                  <th style={{ padding: 12 }}>Ativo</th>
                  <th style={{ padding: 12, width: 160 }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((u) => (
                  <tr key={u.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: 12 }}>{u.nome}</td>
                    <td style={{ padding: 12 }}>{u.email}</td>
                    <td style={{ padding: 12 }}>{u.pessoa_nome || "—"}</td>
                    <td style={{ padding: 12 }}>{u.perfil_nome || "—"}</td>
                    <td style={{ padding: 12 }}>{u.ativo ? "Sim" : "Não"}</td>
                    <td style={{ padding: 12, display: "flex", gap: 8 }}>
                      <button className="toggle-btn" onClick={() => editar(u)}>
                        Editar
                      </button>
                      <button className="toggle-btn" onClick={() => excluir(u)}>
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Drawer/ formulário */}
      {showForm && (
        <div className="stat-card" style={{ marginTop: 16 }}>
          <h2 className="title" style={{ margin: 0, marginBottom: 12 }}>
            {form.id ? "Editar Usuário" : "Novo Usuário"}
          </h2>
          <form className="form" onSubmit={salvar}>
            <label htmlFor="u_nome">Nome</label>
            <input
              id="u_nome"
              value={form.nome}
              onChange={(e) => setField("nome", e.target.value)}
              required
            />

            <label htmlFor="u_email">E-mail</label>
            <input
              id="u_email"
              type="email"
              value={form.email}
              onChange={(e) => setField("email", e.target.value)}
              required
            />

            <label htmlFor="u_senha">Senha {form.id ? "(deixe em branco para manter)" : ""}</label>
            <input
              id="u_senha"
              type="password"
              value={form.senha}
              onChange={(e) => setField("senha", e.target.value)}
              placeholder={form.id ? "••••••••" : ""}
              required={!form.id}
            />
            {/* Pessoa (só na criação) */}
            {!form.id && (
              <>
                <label htmlFor="u_pessoa">Pessoa</label>
                <select
                  id="u_pessoa"
                  value={form.pessoa_id}
                  onChange={(e) => setField("pessoa_id", e.target.value)}
                  disabled={loadingOpts}
                  required
                  style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border)", width: "100%" }}
                >
                  <option value="">Selecione…</option>
                  {pessoasSemUsuario.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome} {p.cpf ? `— ${p.cpf}` : ""}
                    </option>
                  ))}
                </select>
                <small style={{ color: "var(--muted)" }}>
                  Precisa cadastrar uma <Link to="/pessoas"><strong>pessoa</strong></Link> antes?
                </small>
              </>
            )}
            <label htmlFor="u_perfil">Perfil</label>
            <select
              id="u_perfil"
              value={form.perfil_id}
              onChange={(e) => setField("perfil_id", e.target.value)}
              disabled={loadingOpts}
              required
              style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border)", width: "100%" }}
            >
              <option value="">Selecione…</option>
              {perfis.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
            {(!isAdmin && !isDev) && (
              <small style={{ color: "var(--muted)" }}>
                Você não pode atribuir o perfil <strong>administrador</strong>.
              </small>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
              <input
                id="u_ativo"
                type="checkbox"
                checked={!!form.ativo}
                onChange={(e) => setField("ativo", e.target.checked ? 1 : 0)}
              />
              <label htmlFor="u_ativo">Ativo</label>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button type="button" className="toggle-btn" onClick={cancelar}>
                Cancelar
              </button>
              <button type="submit" className="toggle-btn" disabled={saving}>
                {saving ? "Salvando..." : form.id ? "Salvar alterações" : "Criar usuário"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
