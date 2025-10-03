// src/pages/Usuarios.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  ArrowPathIcon,
  CheckIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid";

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
  const nomeRef = useRef(null);

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

  useEffect(() => {
    if (showForm && nomeRef.current) nomeRef.current.focus();
  }, [showForm]);

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
  function cancelarInline() {
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

  const onOverlayKeyDown = (ev) => {
    if (ev.key === "Escape") setShowForm(false);
  };

  return (
    <>
      {/* região viva para leitores de tela */}
      <div ref={liveRef} aria-live="polite" className="visually-hidden" />

      {/* HEADER NO PADRÃO GLOBAL (igual Pessoas.jsx) */}
      <header className="page-header" role="region" aria-labelledby="titulo-pagina">
        <div>
          <h1 id="titulo-pagina" className="page-title">Usuários</h1>
          <p className="page-subtitle">Gerencie os acessos do sistema. Cada pessoa possui no máximo um usuário vinculado.</p>
        </div>

        <div className="page-header__toolbar" aria-label="Ações da página">
          <button className="btn btn--success" onClick={novo} aria-label="Criar novo usuário">
            <PlusIcon className="icon" aria-hidden="true" />
            <span>Novo Usuário</span>
          </button>
          <button
            className="btn btn--neutral"
            onClick={carregarLista}
            disabled={loading}
            aria-busy={loading ? "true" : "false"}
            aria-label="Atualizar lista de usuários"
            title="Atualizar"
          >
            {loading ? <span className="spinner" aria-hidden="true" /> : <ArrowPathIcon className="icon" aria-hidden="true" />}
            <span>{loading ? "Atualizando…" : "Atualizar"}</span>
          </button>
        </div>
      </header>

      {err && <div className="error-alert" role="alert">{err}</div>}

      {/* Busca (padrão Pessoas.jsx) */}
      <div className="search-container">
        <div className="search-bar" role="search" aria-label="Buscar usuários">
          <MagnifyingGlassIcon className="icon" aria-hidden="true" />
          <label htmlFor="busca" className="visually-hidden">Buscar por nome, e-mail, pessoa ou perfil</label>
          <input
            id="busca"
            type="search"
            className="input input--lg"
            placeholder="Buscar por nome, e-mail, pessoa ou perfil…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            autoComplete="off"
          />
          {Boolean(filter) && (
            <button
              type="button"
              className="btn btn--neutral btn--icon-only"
              onClick={() => setFilter("")}
              aria-label="Limpar busca"
              title="Limpar"
            >
              <XMarkIcon className="icon" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* LISTAGEM: Tabela (desktop) + Cards (mobile) */}
      <div className="listagem-container">
        {/* Desktop/tablet: Tabela */}
        <div className="table-wrapper table-only" role="region" aria-label="Tabela de usuários">
          {loading ? (
            <div className="loading-message" role="status">Carregando…</div>
          ) : filtrados.length === 0 ? (
            <div className="empty-message">Nenhum usuário encontrado.</div>
          ) : (
            <div className="stat-card" style={{ overflow: "hidden" }}>
              <table className="usuarios-table">
                <thead>
                  <tr>
                    <th scope="col">Nome</th>
                    <th scope="col">E-mail</th>
                    <th scope="col">Pessoa</th>
                    <th scope="col">Perfil</th>
                    <th scope="col">Ativo</th>
                    <th scope="col" className="actions-column">Ações</th>
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
                          <button
                            className="btn btn--neutral btn--sm"
                            onClick={() => editar(u)}
                            aria-label={`Editar ${u.nome}`}
                          >
                            <PencilSquareIcon className="icon" aria-hidden="true" />
                            <span>Editar</span>
                          </button>
                          <button
                            className="btn btn--danger btn--sm"
                            onClick={() => excluir(u)}
                            aria-label={`Excluir ${u.nome}`}
                          >
                            <TrashIcon className="icon" aria-hidden="true" />
                            <span>Excluir</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Mobile: Cards */}
        <div className="cards-wrapper cards-only" role="region" aria-label="Lista de usuários (versão cartões)">
          {loading ? (
            <div className="loading-message" role="status">Carregando…</div>
          ) : filtrados.length === 0 ? (
            <div className="empty-message">Nenhum usuário encontrado.</div>
          ) : (
            <ul className="cards-grid" aria-label="Cartões de usuários">
              {filtrados.map((u) => (
                <li key={u.id} className="usuario-card" aria-label={`Usuário: ${u.nome}`}>
                  <div className="usuario-card__head">
                    <h3 className="usuario-card__title">{u.nome}</h3>
                    <span className={`badge ${u.ativo ? "ok" : "muted"}`}>{u.ativo ? "Ativo" : "Inativo"}</span>
                  </div>
                  <div className="usuario-card__body">
                    <dl className="usuario-dl">
                      <div className="usuario-dl__row">
                        <dt>E-mail</dt>
                        <dd>{u.email}</dd>
                      </div>
                      <div className="usuario-dl__row">
                        <dt>Pessoa</dt>
                        <dd>{u.pessoa_nome || "—"}</dd>
                      </div>
                      <div className="usuario-dl__row">
                        <dt>Perfil</dt>
                        <dd>{u.perfil_nome || "—"}</dd>
                      </div>
                    </dl>
                  </div>
                  <div className="usuario-card__actions">
                    <button
                      className="btn btn--neutral btn--sm"
                      onClick={() => editar(u)}
                      aria-label={`Editar ${u.nome}`}
                      title="Editar"
                    >
                      <PencilSquareIcon className="icon" aria-hidden="true" />
                      <span>Editar</span>
                    </button>
                    <button
                      className="btn btn--danger btn--sm"
                      onClick={() => excluir(u)}
                      aria-label={`Excluir ${u.nome}`}
                      title="Excluir"
                    >
                      <TrashIcon className="icon" aria-hidden="true" />
                      <span>Excluir</span>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* FORMULÁRIO COMO DIALOG OVERLAY (padrão Pessoas.jsx) */}
      {showForm && (
        <div
          className="form-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-form"
          onKeyDown={onOverlayKeyDown}
        >
          <div className="form-container">
            <div className="form-header">
              <h2 id="titulo-form">{form.id ? "Editar Usuário" : "Novo Usuário"}</h2>
              <button
                className="btn btn--neutral btn--icon-only"
                onClick={() => setShowForm(false)}
                aria-label="Fechar formulário"
                title="Fechar"
              >
                <XMarkIcon className="icon" aria-hidden="true" />
              </button>
            </div>

            <form className="form" onSubmit={salvar}>
              <div className="form-grid">
                <div className="form-field span-2">
                  <label htmlFor="u_nome">Nome</label>
                  <input
                    id="u_nome"
                    ref={nomeRef}
                    value={form.nome}
                    onChange={(e) => setField("nome", e.target.value)}
                    required
                    autoComplete="name"
                  />
                </div>

                <div className="form-field span-2">
                  <label htmlFor="u_email">E-mail</label>
                  <input
                    id="u_email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setField("email", e.target.value)}
                    required
                    autoComplete="email"
                  />
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
                    autoComplete={form.id ? "new-password" : "new-password"}
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
                <button type="button" className="btn btn--neutral" onClick={cancelarInline}>
                  <XMarkIcon className="icon" aria-hidden="true" />
                  <span>Cancelar</span>
                </button>
                <button type="submit" className="btn btn--success" disabled={saving}>
                  <CheckIcon className="icon" aria-hidden="true" />
                  <span>{saving ? "Salvando..." : form.id ? "Salvar alterações" : "Criar usuário"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* estilos locais mínimos — responsividade e dialog, seguindo o mesmo de Pessoas.jsx */}
      <style jsx>{`
        .listagem-container { width: 100%; }
        .search-container { margin-bottom: 16px; }

        .table-only { display: block; }
        .cards-only { display: none; }
        @media (max-width: 768px) {
          .table-only { display: none; }
          .cards-only { display: block; }
        }

        /* Cards grid (mobile) */
        .cards-grid {
          list-style: none;
          padding: 0;
          margin: 0;
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
        }
        .usuario-card {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 12px;
          box-shadow: var(--shadow);
          overflow: hidden;
          position: relative;
        }
        .usuario-card::before {
          content: "";
          position: absolute;
          left: 0; top: 0; bottom: 0;
          width: 4px;
          background: var(--accent-bg);
        }
        .usuario-card__head {
          display: flex; align-items: center; justify-content: space-between;
          gap: 8px; padding: 14px 14px 0 14px;
        }
        .usuario-card__title {
          margin: 0; font-size: 1rem; font-weight: 700; color: var(--fg);
        }
        .badge {
          font-size: 0.75rem; padding: 2px 8px; border-radius: 999px;
          border: 1px solid var(--border);
        }
        .badge.ok { background: rgba(16,185,129,.12); color: var(--success-strong); border-color: rgba(16,185,129,.35); }
        .badge.muted { background: var(--panel-muted); color: var(--muted); }

        .usuario-card__body { padding: 12px 14px 14px 14px; }
        .usuario-dl { margin: 0; display: grid; gap: 8px; }
        .usuario-dl__row {
          display: grid;
          grid-template-columns: 110px 1fr;
          gap: 8px; align-items: baseline;
        }
        .usuario-dl__row dt { color: var(--muted); font-weight: 600; font-size: var(--fs-12); }
        .usuario-dl__row dd { margin: 0; color: var(--fg); font-weight: 500; }

        .usuario-card__actions {
          display: flex; gap: 6px; flex-wrap: wrap; padding: 0 14px 14px 14px;
        }

        /* Tabela (desktop) */
        .usuarios-table th,
        .usuarios-table td { white-space: nowrap; }
        .usuarios-table td:first-child,
        .usuarios-table th:first-child { white-space: normal; }
        .actions-buttons { display: flex; gap: 6px; flex-wrap: wrap; }

        /* Dialog (form) */
        .form-overlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,.5);
          display: flex; align-items: center; justify-content: center;
          padding: 20px; z-index: 1000;
        }
        .form-container {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 24px;
          width: 100%; max-width: 560px;
          max-height: 90vh; overflow-y: auto;
          box-shadow: 0 10px 25px rgba(0,0,0,0.2);
        }
        .form-header {
          display: flex; justify-content: space-between; align-items: center;
          gap: 8px; margin-bottom: 16px;
        }
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
        @media (min-width: 640px) {
          .form-grid { grid-template-columns: 1fr 1fr; }
          .form-field.span-2 { grid-column: span 2; }
        }

        /* Ajustes menores */
        @media (max-width: 480px) {
          .usuario-dl__row { grid-template-columns: 90px 1fr; }
          .usuario-card__title { font-size: 0.95rem; }
        }
      `}</style>
    </>
  );
}