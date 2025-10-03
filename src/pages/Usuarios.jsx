// src/pages/Usuarios.jsx
import { useEffect, useMemo, useState, useRef } from "react";
import { Link } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE?.replace(/\/+$/, "") || "";

/* Ícones minimalistas (substituíveis por Heroicons) */
function PlusIcon(props){ return (<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" {...props}><path d="M19 11H13V5h-2v6H5v2h6v6h2v-6h6z"/></svg>); }
function TrashIcon(props){ return (<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" {...props}><path d="M6 7h12v13H6zM8 4h8l1 2H7l1-2z"/></svg>); }
function EditIcon(props){ return (<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" {...props}><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0L15.13 5.12l3.75 3.75 1.83-1.83z"/></svg>); }
function RefreshIcon(props){ return (<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" {...props}><path d="M17.65 6.35A7.95 7.95 0 0012 4 8 8 0 104 12h2a6 6 0 1110.24 3.66L14 13v7h7l-2.35-2.35A7.96 7.96 0 0020 12c0-2.21-.9-4.2-2.35-5.65z"/></svg>); }
function CheckIcon(props){ return (<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" {...props}><path d="M9 16.2l-3.5-3.5-1.4 1.4L9 19 20.3 7.7l-1.4-1.4z"/></svg>); }

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

  const [pessoas, setPessoas] = useState([]);
  const [perfis, setPerfis] = useState([]);
  const [loadingOpts, setLoadingOpts] = useState(true);

  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("");
  const [showForm, setShowForm] = useState(false);

  const liveRef = useRef(null);

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
      if (liveRef.current) liveRef.current.textContent = "Lista de usuários atualizada.";
    } catch (e) {
      setErr(e.message || "Falha ao listar usuários.");
      if (liveRef.current) liveRef.current.textContent = "Erro ao carregar a lista.";
    } finally {
      setLoading(false);
    }
  }

  async function carregarOpcoes() {
    setLoadingOpts(true);
    try {
      const [p, pf] = await Promise.all([
        fetchJSON(`${API_BASE}/api/pessoas`),
        fetchJSON(`${API_BASE}/api/perfis`),
      ]);
      setPessoas(p.pessoas || []);
      setPerfis(pf.perfis || []);
    } catch (e) {
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

  const pessoasSemUsuario = useMemo(() => {
    const usedPessoaIds = new Set((lista || []).map((u) => u.pessoa_id).filter(Boolean));
    return (pessoas || []).filter((p) => !usedPessoaIds.has(p.id));
  }, [pessoas, lista]);

  const pessoasDisponiveis = useMemo(() => {
    if (!form.id) return pessoasSemUsuario;
    const atual = (pessoas || []).find((p) => p.id === Number(form.pessoa_id));
    const base = [...pessoasSemUsuario];
    if (atual && !base.some((x) => x.id === atual.id)) base.push(atual);
    return base.sort((a, b) => String(a.nome).localeCompare(String(b.nome)));
  }, [form.id, form.pessoa_id, pessoas, pessoasSemUsuario]);

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
      pessoa_id: item.pessoa_id || "",
      nome: item.nome || "",
      email: item.email || "",
      senha: "",
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
      if (!String(form.pessoa_id || "").trim()) throw new Error("Selecione a pessoa.");
      if (!String(form.nome || "").trim()) throw new Error("Informe o nome do usuário.");
      if (!String(form.email || "").trim()) throw new Error("Informe o e-mail.");
      if (!String(form.perfil_id || "").trim()) throw new Error("Selecione um perfil.");
      const vp = validaPerfil(form.perfil_id);
      if (!vp.ok) throw new Error(vp.error);

      if (!form.id) {
        if (!String(form.senha || "").trim()) throw new Error("Informe a senha.");
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
        const payload = {
          pessoa_id: Number(form.pessoa_id),
          nome: form.nome.trim(),
          email: form.email.trim().toLowerCase(),
          perfil_id: Number(form.perfil_id),
          ativo: form.ativo ? 1 : 0,
        };
        if (String(form.senha || "").trim()) payload.senha = form.senha;
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
      if (liveRef.current) liveRef.current.textContent = "Usuário salvo com sucesso.";
    } catch (e) {
      setErr(e.message || "Falha ao salvar usuário.");
      if (liveRef.current) liveRef.current.textContent = "Erro ao salvar usuário.";
    } finally {
      setSaving(false);
    }
  }

  async function excluir(item) {
    if (!window.confirm(`Remover o usuário ${item.nome}?`)) return;
    setErr("");
    try {
      await fetchJSON(`${API_BASE}/api/usuarios/${item.id}`, { method: "DELETE", credentials: "include" });
      await carregarLista();
      if (form.id === item.id) { setForm(EMPTY_FORM); setShowForm(false); }
      if (liveRef.current) liveRef.current.textContent = "Usuário excluído.";
    } catch (e) {
      setErr(e.message || "Falha ao excluir usuário.");
      if (liveRef.current) liveRef.current.textContent = "Erro ao excluir usuário.";
    }
  }

  return (
    <>
      {/* live region */}
      <div ref={liveRef} aria-live="polite" className="visually-hidden" />

      {/* HEADER PADRÃO */}
      <header className="main-header" role="region" aria-labelledby="titulo-pagina">
        <div className="header-content">
          <h1 id="titulo-pagina">Usuários</h1>
          <p>Gerencie os acessos do sistema. Cada pessoa pode ter apenas um usuário vinculado.</p>
        </div>
        <div className="header-actions">
          <button className="btn btn--primary" onClick={novo} aria-label="Criar novo usuário">
            <PlusIcon className="icon" />
            <span>Novo Usuário</span>
          </button>
          <button
            className="btn btn--primary"
            onClick={carregarLista}
            disabled={loading}
            aria-busy={loading ? "true" : "false"}
            aria-label="Atualizar lista de usuários"
            title="Atualizar"
          >
            <RefreshIcon className={`icon ${loading ? "animate-spin" : ""}`} />
            <span>{loading ? "Atualizando..." : "Atualizar"}</span>
          </button>
        </div>
      </header>

      {err && <div className="error-alert" role="alert">{err}</div>}

      {/* BUSCA */}
      <div className="search-row" style={{ marginBottom: 12 }}>
        <label htmlFor="busca" className="visually-hidden">Buscar por nome, e-mail, pessoa ou perfil</label>
        <input
          id="busca"
          className="search-input"
          placeholder="Buscar por nome, e-mail, pessoa ou perfil…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          autoComplete="off"
        />
      </div>

      {/* LISTAGEM */}
      <div className="stat-card list-card">
        {/* TABELA (desktop) */}
        <div className="table-wrapper hide-on-mobile-only">
          {loading ? (
            <div className="loading-message" role="status">Carregando…</div>
          ) : filtrados.length === 0 ? (
            <div className="empty-message">Nenhum usuário encontrado.</div>
          ) : (
            <table className="std-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Pessoa</th>
                  <th>Perfil</th>
                  <th>Ativo</th>
                  <th className="actions-column">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((u) => (
                  <tr key={u.id}>
                    <td>{u.nome}</td>
                    <td>{u.email}</td>
                    <td>{u.pessoa_nome || "—"}</td>
                    <td>{u.perfil_nome || "—"}</td>
                    <td>{u.ativo ? "Sim" : "Não"}</td>
                    <td>
                      <div className="actions-buttons">
                        <button className="btn btn--neutral btn--sm" onClick={() => editar(u)} aria-label={`Editar ${u.nome}`}>
                          <EditIcon className="icon" /><span>Editar</span>
                        </button>
                        <button className="btn btn--danger btn--sm" onClick={() => excluir(u)} aria-label={`Excluir ${u.nome}`}>
                          <TrashIcon className="icon" /><span>Excluir</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* CARDS (mobile) */}
        <div className="cards-mobile">
          {loading ? (
            <div className="loading-message" role="status">Carregando…</div>
          ) : filtrados.length === 0 ? (
            <div className="empty-message">Nenhum usuário encontrado.</div>
          ) : (
            <div className="cards-grid">
              {filtrados.map((u) => (
                <article key={u.id} className="item-card" aria-label={`Usuário ${u.nome}`}>
                  <header className="item-head">
                    <strong className="item-title">{u.nome}</strong>
                    <span className={`badge ${u.ativo ? "ok" : "muted"}`}>{u.ativo ? "Ativo" : "Inativo"}</span>
                  </header>
                  <div className="item-body">
                    <div><span className="label">E-mail:</span> {u.email}</div>
                    <div><span className="label">Pessoa:</span> {u.pessoa_nome || "—"}</div>
                    <div><span className="label">Perfil:</span> {u.perfil_nome || "—"}</div>
                  </div>
                  <footer className="item-actions">
                    <button className="btn btn--neutral btn--sm" onClick={() => editar(u)} aria-label={`Editar ${u.nome}`}>
                      <EditIcon className="icon" /><span>Editar</span>
                    </button>
                    <button className="btn btn--danger btn--sm" onClick={() => excluir(u)} aria-label={`Excluir ${u.nome}`}>
                      <TrashIcon className="icon" /><span>Excluir</span>
                    </button>
                  </footer>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* FORMULÁRIO (card) */}
      {showForm && (
        <div className="stat-card form-card" data-accent="info" style={{ borderLeft: "4px solid var(--accent-bg)", marginTop: 16 }}>
          <h2 className="title" style={{ margin: 0, marginBottom: 12 }}>
            {form.id ? "Editar Usuário" : "Novo Usuário"}
          </h2>
          <form className="form" onSubmit={salvar}>
            <div className="form-grid">
              <div className="form-field span-2">
                <label htmlFor="u_nome">Nome</label>
                <input id="u_nome" value={form.nome} onChange={(e) => setField("nome", e.target.value)} required />
              </div>

              <div className="form-field span-2">
                <label htmlFor="u_email">E-mail</label>
                <input id="u_email" type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} required />
              </div>

              <div className="form-field">
                <label htmlFor="u_senha">Senha {form.id ? "(deixe em branco para manter)" : ""}</label>
                <input
                  id="u_senha"
                  type="password"
                  value={form.senha}
                  onChange={(e) => setField("senha", e.target.value)}
                  placeholder={form.id ? "••••••••" : ""}
                  required={!form.id}
                />
              </div>

              <div className="form-field">
                <label htmlFor="u_pessoa">Pessoa</label>
                <select
                  id="u_pessoa"
                  value={form.pessoa_id}
                  onChange={(e) => setField("pessoa_id", e.target.value)}
                  disabled={loadingOpts}
                  required
                >
                  <option value="">Selecione…</option>
                  {pessoasDisponiveis.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome} {p.cpf ? `— ${p.cpf}` : ""}
                    </option>
                  ))}
                </select>
                <small className="hint">
                  Precisa cadastrar uma <Link to="/pessoas"><strong>pessoa</strong></Link> antes?
                </small>
              </div>

              <div className="form-field">
                <label htmlFor="u_perfil">Perfil</label>
                <select
                  id="u_perfil"
                  value={form.perfil_id}
                  onChange={(e) => setField("perfil_id", e.target.value)}
                  disabled={loadingOpts}
                  required
                >
                  <option value="">Selecione…</option>
                  {perfis.map((p) => (
                    <option key={p.id} value={p.id}>{p.nome}</option>
                  ))}
                </select>
                {(!isAdmin && !isDev) && (
                  <small className="hint">Você não pode atribuir o perfil <strong>administrador</strong>.</small>
                )}
              </div>

              <div className="form-field span-2" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  id="u_ativo"
                  type="checkbox"
                  checked={!!form.ativo}
                  onChange={(e) => setField("ativo", e.target.checked ? 1 : 0)}
                />
                <label htmlFor="u_ativo">Ativo</label>
              </div>
            </div>

            <div className="form-actions">
              <button type="button" className="btn btn--neutral" onClick={cancelar}>
                <span>Cancelar</span>
              </button>
              <button type="submit" className="btn btn--success" disabled={saving}>
                <CheckIcon className="icon" />
                <span>{saving ? "Salvando..." : form.id ? "Salvar alterações" : "Criar usuário"}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* estilos locais só do Usuarios (usa tokens e utilitários globais) */}
      <style jsx>{`
        .header-actions { display: flex; gap: 8px; flex-wrap: wrap; }

        .search-row { margin-bottom: 16px; }
        .search-input {
          width: 100%;
          padding: 12px;
          border: 1px solid var(--border);
          border-radius: 12px;
          font-size: var(--fs-16);
          background: var(--panel);
          color: var(--fg);
        }

        .list-card { padding: 0; }
        .table-wrapper { overflow-x: auto; }
        .std-table { width: 100%; border-collapse: collapse; min-width: 760px; }
        .std-table th {
          text-align: left;
          padding: 14px 12px;
          border-bottom: 1px solid var(--border);
          background: var(--panel-muted);
          color: var(--muted);
          font-weight: 700;
        }
        .std-table td {
          padding: 14px 12px;
          border-bottom: 1px solid var(--border);
          vertical-align: top;
        }
        .actions-buttons { display: flex; gap: 8px; flex-wrap: wrap; }
        .btn--sm { padding: 8px 10px; font-size: var(--fs-14); }

        /* Cards mobile */
        .cards-mobile { display: none; }
        .cards-grid { display: grid; gap: 10px; padding: 12px; }
        .item-card {
          border: 1px solid var(--border);
          border-radius: 12px;
          background: var(--panel);
          padding: 12px;
          border-left: 4px solid var(--accent-bg);
        }
        .item-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
        .item-title { font-size: 1rem; }
        .badge { font-size: 0.75rem; padding: 2px 8px; border-radius: 999px; border: 1px solid var(--border); }
        .badge.ok { background: rgba(16,185,129,.12); color: var(--success-strong); border-color: rgba(16,185,129,.35); }
        .badge.muted { background: var(--panel-muted); color: var(--muted); }
        .item-body { display: grid; gap: 2px; color: var(--fg); }
        .item-body .label { color: var(--muted); margin-right: 4px; }
        .item-actions { display: flex; gap: 6px; margin-top: 10px; }

        /* Form grid */
        .form-card .hint { color: var(--muted); }
        .form-grid { display: grid; grid-template-columns: 1fr; gap: 12px; }
        .form-field { display: flex; flex-direction: column; gap: 6px; }
        .form-field input, .form-field select {
          width: 100%; min-height: 44px; padding: 10px 12px;
          border: 1px solid var(--border); border-radius: 12px;
          background: #fff; color: #111; font-size: var(--fs-16);
        }
        .form-field input:focus-visible, .form-field select:focus-visible {
          outline: 3px solid var(--focus); outline-offset: 2px;
        }
        .form-actions { display: flex; gap: 12px; justify-content: flex-end; margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--border); }

        /* Responsividade */
        @media (min-width: 768px) {
          .hide-on-mobile-only { display: block; }
          .cards-mobile { display: none; }
          .form-grid { grid-template-columns: 1fr 1fr; }
          .form-field.span-2 { grid-column: span 2; }
        }
        @media (max-width: 767px) {
          .hide-on-mobile-only { display: none; }
          .cards-mobile { display: block; }
          .item-actions .btn { width: 100%; }
          .form-actions { flex-direction: column; }
          .form-actions .btn { width: 100%; }
        }
      `}</style>
    </>
  );
}