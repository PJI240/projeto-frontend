// src/pages/Usuarios.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  ArrowPathIcon,
  CheckIcon,
} from "@heroicons/react/24/outline";

const API_BASE = import.meta.env.VITE_API_BASE?.replace(/\/+$/, "") || "";

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

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function fetchJSON(url, init = {}) {
    const r = await fetch(url, { credentials: "include", ...init });
    const data = await r.json().catch(() => null);
    if (!r.ok || data?.ok === false) throw new Error(data?.error || `HTTP ${r.status}`);
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

  // Pessoas sem usuário
  const pessoasSemUsuario = useMemo(() => {
    const usedPessoaIds = new Set((lista || []).map((u) => u.pessoa_id).filter(Boolean));
    return (pessoas || []).filter((p) => !usedPessoaIds.has(p.id));
  }, [pessoas, lista]);

  // Pessoas disponíveis no select (criação: sem usuário; edição: sem usuário + atual)
  const pessoasDisponiveis = useMemo(() => {
    if (!form.id) return pessoasSemUsuario;
    const atual = (pessoas || []).find((p) => p.id === Number(form.pessoa_id));
    const base = [...pessoasSemUsuario];
    if (atual && !base.some((x) => x.id === atual.id)) base.push(atual);
    return base.sort((a, b) => String(a.nome).localeCompare(String(b.nome)));
  }, [form.id, form.pessoa_id, pessoas, pessoasSemUsuario]);

  // Filtro
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
      {/* live region para feedbacks */}
      <div ref={liveRef} aria-live="polite" className="visually-hidden" />

      {/* HEADER PADRÃO (classes globais) */}
      <header className="main-header" role="region" aria-labelledby="titulo-pagina">
        <div className="header-content">
          <h1 id="titulo-pagina">Usuários</h1>
          <p>Gerencie os acessos do sistema. Cada pessoa pode ter apenas um usuário vinculado.</p>
        </div>
        <div className="header-actions">
          <button className="btn btn--primary" onClick={novo} aria-label="Criar novo usuário">
            <PlusIcon className="icon-sm" />
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
            <ArrowPathIcon className={`icon-sm ${loading ? "animate-spin" : ""}`} />
            <span>{loading ? "Atualizando..." : "Atualizar"}</span>
          </button>
        </div>
      </header>

      {err && <div className="error-alert" role="alert">{err}</div>}

      {/* BUSCA — usando .search-input global + gap abaixo */}
      <div className="search-row" style={{ marginBottom: 16 }}>
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
      <div className="stat-card" style={{ padding: 0 }}>
        {/* Tabela (desktop) */}
        <div className="table-wrapper desktop-only">
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
                          <PencilSquareIcon className="icon-sm" />
                          <span>Editar</span>
                        </button>
                        <button className="btn btn--danger btn--sm" onClick={() => excluir(u)} aria-label={`Excluir ${u.nome}`}>
                          <TrashIcon className="icon-sm" />
                          <span>Excluir</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Cards (mobile) */}
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
                      <PencilSquareIcon className="icon-sm" />
                      <span>Editar</span>
                    </button>
                    <button className="btn btn--danger btn--sm" onClick={() => excluir(u)} aria-label={`Excluir ${u.nome}`}>
                      <TrashIcon className="icon-sm" />
                      <span>Excluir</span>
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
        <div className="stat-card" data-accent="info" style={{ borderLeft: "4px solid var(--accent-bg)", marginTop: 16 }}>
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
                <CheckIcon className="icon-sm" />
                <span>{saving ? "Salvando..." : form.id ? "Salvar alterações" : "Criar usuário"}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CSS leve só para responsividade da listagem e grid do form;
          todo o resto vem do seu global.css */}
      <style jsx>{`
        /* tabela padrão aproveitando tokens globais */
        .std-table { width: 100%; border-collapse: collapse; min-width: 760px; }
        .std-table th {
          padding: 14px 12px; text-align: left; font-weight: 700;
          color: var(--muted); border-bottom: 1px solid var(--border); background: var(--panel-muted);
        }
        .std-table td { padding: 14px 12px; border-bottom: 1px solid var(--border); vertical-align: top; }
        .actions-buttons { display: flex; gap: 8px; flex-wrap: wrap; }

        /* cards no mobile */
        .cards-mobile { display: none; }
        .cards-grid { display: grid; gap: 10px; padding: 12px; }
        .item-card {
          border: 1px solid var(--border); border-radius: 12px; background: var(--panel);
          padding: 12px; border-left: 4px solid var(--accent-bg);
        }
        .item-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        .item-title { font-size: 1rem; }
        .badge { font-size: 0.75rem; padding: 2px 8px; border-radius: 999px; border: 1px solid var(--border); }
        .badge.ok { background: rgba(16,185,129,.12); color: var(--success-strong); border-color: rgba(16,185,129,.35); }
        .badge.muted { background: var(--panel-muted); color: var(--muted); }
        .item-body { display: grid; gap: 2px; }
        .item-body .label { color: var(--muted); margin-right: 4px; }
        .item-actions { display: flex; gap: 6px; margin-top: 10px; }

        /* grid do formulário */
        .form-grid { display: grid; grid-template-columns: 1fr; gap: 12px; }
        .form-field { display: flex; flex-direction: column; gap: 6px; }
        .form-field input, .form-field select {
          min-height: 44px; padding: 10px 12px; border: 1px solid var(--border);
          border-radius: 12px; background: #fff; color: #111; font-size: var(--fs-16);
        }
        .form-field input:focus-visible, .form-field select:focus-visible {
          outline: 3px solid var(--focus); outline-offset: 2px;
        }
        .form-field.span-2 { grid-column: span 1; }

        @media (min-width: 768px) {
          .desktop-only { display: block; }
          .cards-mobile { display: none; }
          .form-grid { grid-template-columns: 1fr 1fr; }
          .form-field.span-2 { grid-column: span 2; }
        }
        @media (max-width: 767px) {
          .desktop-only { display: none; }
          .cards-mobile { display: block; }
          .item-actions .btn { width: 100%; }
          .form-actions { flex-direction: column; gap: 10px; }
          .form-actions .btn { width: 100%; }
        }
      `}</style>
    </>
  );
}