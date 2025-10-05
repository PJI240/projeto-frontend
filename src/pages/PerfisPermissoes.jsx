// src/pages/PerfisPermissoes.jsx
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  PlusIcon,
  ArrowPathIcon,
  CheckIcon,
  XMarkIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ShieldCheckIcon,
  PencilSquareIcon,
  TrashIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/solid";

const API_BASE = import.meta.env.VITE_API_BASE?.replace(/\/+$/, "") || "";

const API = {
  perfis: `${API_BASE}/api/perfis`,
  permissoes: `${API_BASE}/api/permissoes`,
  getPerfilPerms: (id) => `${API_BASE}/api/perfis_permissoes?perfil_id=${id}`,
  syncPerfilPerms: `${API_BASE}/api/perfis_permissoes/sync`,
  syncPerms: `${API_BASE}/api/permissoes/sync`,
};

const EMPTY_FORM = {
  id: null,
  nome: "",
  ativo: 1,
};

export default function PerfisPermissoes() {
  const [perfis, setPerfis] = useState([]);
  const [permissoes, setPermissoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState("");
  const [filter, setFilter] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const [perfilExpandido, setPerfilExpandido] = useState(null);
  const [permissoesCarregando, setPermissoesCarregando] = useState(new Set());
  const [permissoesPorPerfil, setPermissoesPorPerfil] = useState(new Map());
  const [permissoesSalvando, setPermissoesSalvando] = useState(new Set());

  const liveRef = useRef(null);
  const nomeRef = useRef(null);

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const fetchJson = useCallback(async (url, init = {}) => {
    const r = await fetch(url, { credentials: "include", ...init });
    const data = await r.json().catch(() => null);
    if (!r.ok || data?.ok === false) throw new Error(data?.error || `HTTP ${r.status}`);
    return data;
  }, []);

  async function carregarPerfis() {
    setLoading(true);
    setErr("");
    try {
      const data = await fetchJson(API.perfis);
      setPerfis(data.perfis || []);
      if (liveRef.current) liveRef.current.textContent = "Lista de perfis atualizada.";
    } catch (e) {
      setErr(e.message || "Falha ao carregar perfis.");
      if (liveRef.current) liveRef.current.textContent = "Erro ao carregar perfis.";
    } finally {
      setLoading(false);
    }
  }

  async function carregarPermissoes() {
    try {
      const data = await fetchJson(API.permissoes);
      setPermissoes(data.permissoes || []);
    } catch (e) {
      console.error("Erro ao carregar permissões:", e);
    }
  }

  async function sincronizarPermissoes() {
    setSyncing(true);
    setErr("");
    setSuccess("");
    try {
      const data = await fetchJson(API.syncPerms, { method: "POST" });
      setSuccess(`Permissões sincronizadas: ${data.upserted ?? 0} atualizadas/criadas.`);
      await carregarPermissoes();
      if (perfilExpandido != null) await carregarPermissoesPerfil(perfilExpandido);
      if (liveRef.current) liveRef.current.textContent = "Permissões sincronizadas.";
    } catch (e) {
      setErr(e.message || "Erro ao sincronizar permissões.");
      if (liveRef.current) liveRef.current.textContent = "Erro ao sincronizar permissões.";
    } finally {
      setSyncing(false);
    }
  }

  async function carregarPermissoesPerfil(perfilId) {
    setPermissoesCarregando(prev => new Set(prev).add(perfilId));
    try {
      const data = await fetchJson(API.getPerfilPerms(perfilId));
      const perfil = perfis.find(p => p.id === perfilId);
      const isAdmin = perfil && String(perfil.nome || "").toLowerCase() === "administrador";
      const ids = isAdmin ? new Set(permissoes.map(p => p.id)) : new Set((data.ids || []).map(Number));
      setPermissoesPorPerfil(prev => new Map(prev).set(perfilId, ids));
    } catch (e) {
      setErr(e.message || "Falha ao carregar permissões do perfil.");
    } finally {
      setPermissoesCarregando(prev => { const n = new Set(prev); n.delete(perfilId); return n; });
    }
  }

  function toggleExpansaoPerfil(perfilId) {
    if (perfilExpandido === perfilId) setPerfilExpandido(null);
    else {
      setPerfilExpandido(perfilId);
      if (!permissoesPorPerfil.has(perfilId)) carregarPermissoesPerfil(perfilId);
    }
  }

  function togglePermissao(perfilId, permissaoId) {
    const perfil = perfis.find(p => p.id === perfilId);
    const isAdmin = perfil && String(perfil.nome || "").toLowerCase() === "administrador";
    if (isAdmin) return;
    setPermissoesPorPerfil(prev => {
      const next = new Map(prev);
      const atual = next.get(perfilId) || new Set();
      const novas = new Set(atual);
      novas.has(permissaoId) ? novas.delete(permissaoId) : novas.add(permissaoId);
      next.set(perfilId, novas);
      return next;
    });
  }

  function marcarTodasPermissoes(perfilId, marcar = true) {
    const perfil = perfis.find(p => p.id === perfilId);
    const isAdmin = perfil && String(perfil.nome || "").toLowerCase() === "administrador";
    if (isAdmin) return;
    setPermissoesPorPerfil(prev => {
      const next = new Map(prev);
      next.set(perfilId, marcar ? new Set(permissoes.map(p => p.id)) : new Set());
      return next;
    });
  }

  async function salvarPermissoes(perfilId) {
    setPermissoesSalvando(prev => new Set(prev).add(perfilId));
    setErr(""); setSuccess("");
    try {
      const atual = permissoesPorPerfil.get(perfilId) || new Set();
      await fetchJson(API.syncPerfilPerms, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ perfil_id: Number(perfilId), ids: Array.from(atual).map(Number) }),
      });
      setSuccess("Permissões salvas com sucesso.");
      if (liveRef.current) liveRef.current.textContent = "Permissões salvas.";
    } catch (e) {
      setErr(e.message || "Falha ao salvar permissões.");
      if (liveRef.current) liveRef.current.textContent = "Erro ao salvar permissões.";
    } finally {
      setPermissoesSalvando(prev => { const n = new Set(prev); n.delete(perfilId); return n; });
    }
  }

  // Filtro
  const filtrados = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return perfis;
    return (perfis || []).filter((p) => {
      const nome = (p.nome || "").toLowerCase();
      const status = (p.ativo ? "ativo" : "inativo");
      return nome.includes(q) || status.includes(q);
    });
  }, [filter, perfis]);

  // CRUD Perfil
  function novo() { 
    setErr(""); 
    setSuccess("");
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function editar(item) { 
    setErr(""); 
    setSuccess("");
    setForm({
      id: item.id,
      nome: item.nome || "",
      ativo: item.ativo ? 1 : 0,
    });
    setShowForm(true);
  }

  function cancelarInline() {
    setForm(EMPTY_FORM);
    setShowForm(false);
  }

  async function excluir(item) {
    if (!window.confirm(`Excluir o perfil "${item.nome}"?`)) return;
    setErr("");
    try {
      await fetchJson(`${API_BASE}/api/perfis/${item.id}`, { method: "DELETE" });
      setSuccess("Perfil excluído com sucesso.");
      await carregarPerfis();
      if (liveRef.current) liveRef.current.textContent = "Perfil excluído.";
    } catch (e) {
      setErr(e.message || "Falha ao excluir perfil.");
      if (liveRef.current) liveRef.current.textContent = "Erro ao excluir perfil.";
    }
  }

  async function salvar(e) {
    e?.preventDefault?.();
    setErr("");
    setSuccess("");
    setLoading(true);
    
    try {
      if (!String(form.nome || "").trim()) throw new Error("Informe o nome do perfil.");

      const payload = {
        nome: form.nome.trim(),
        ativo: form.ativo ? 1 : 0,
      };

      if (form.id) {
        await fetchJson(`${API_BASE}/api/perfis/${form.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await fetchJson(API.perfis, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      setSuccess(form.id ? "Perfil atualizado." : "Perfil criado.");
      await carregarPerfis();
      setForm(EMPTY_FORM);
      setShowForm(false);
      if (liveRef.current) liveRef.current.textContent = "Perfil salvo com sucesso.";
    } catch (e) {
      setErr(e.message || "Falha ao salvar perfil.");
      if (liveRef.current) liveRef.current.textContent = "Erro ao salvar perfil.";
    } finally {
      setLoading(false);
    }
  }

  const gruposPermissoes = useMemo(() => {
    const map = new Map();
    for (const p of permissoes) {
      const g = (p.escopo || "geral").toLowerCase();
      if (!map.has(g)) map.set(g, []);
      map.get(g).push(p);
    }
    for (const [, arr] of map) arr.sort((a, b) => String(a.codigo).localeCompare(String(b.codigo)));
    return map;
  }, [permissoes]);

  useEffect(() => { 
    carregarPerfis(); 
    carregarPermissoes(); 
  }, []);

  useEffect(() => {
    if (showForm && nomeRef.current) nomeRef.current.focus();
  }, [showForm]);

  const onOverlayKeyDown = (ev) => { 
    if (ev.key === "Escape") setShowForm(false); 
  };

  return (
    <>
      {/* região viva para leitores de tela */}
      <div ref={liveRef} aria-live="polite" className="visually-hidden" />

      {/* HEADER NO PADRÃO GLOBAL */}
      <header className="page-header" role="region" aria-labelledby="titulo-pagina">
        <div>
          <h1 id="titulo-pagina" className="page-title">Perfis e Permissões</h1>
          <p className="page-subtitle">Gerencie perfis de acesso e suas permissões no sistema.</p>
        </div>

        <div className="page-header__toolbar" aria-label="Ações da página">
          <button className="btn btn--success" onClick={novo} aria-label="Criar novo perfil">
            <PlusIcon className="icon" aria-hidden="true" />
            <span>Novo Perfil</span>
          </button>
          <button
            className="btn btn--neutral"
            onClick={sincronizarPermissoes}
            disabled={syncing}
            aria-busy={syncing ? "true" : "false"}
            aria-label="Sincronizar catálogo de permissões"
          >
            {syncing ? <span className="spinner" aria-hidden="true" /> : <ArrowPathIcon className="icon" aria-hidden="true" />}
            <span>{syncing ? "Sincronizando…" : "Sincronizar"}</span>
          </button>
          <button
            className="btn btn--neutral"
            onClick={carregarPerfis}
            disabled={loading}
            aria-busy={loading ? "true" : "false"}
            aria-label="Atualizar lista de perfis"
          >
            {loading ? <span className="spinner" aria-hidden="true" /> : <ArrowPathIcon className="icon" aria-hidden="true" />}
            <span>{loading ? "Atualizando…" : "Atualizar"}</span>
          </button>
        </div>
      </header>

      {err && <div className="error-alert" role="alert">{err}</div>}
      {success && <div className="success-alert" role="status">{success}</div>}

      {/* Busca (padrão igual Usuários) */}
      <div className="search-container">
        <div className="search-bar" role="search" aria-label="Buscar perfis">
          <MagnifyingGlassIcon className="icon" aria-hidden="true" />
          <label htmlFor="busca" className="visually-hidden">Buscar por nome ou status</label>
          <input
            id="busca"
            type="search"
            className="input input--lg"
            placeholder="Buscar por nome ou status…"
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

      {/* LISTAGEM: Cards responsivos */}
      <div className="listagem-container">
        {loading ? (
          <div className="loading-message" role="status">Carregando…</div>
        ) : filtrados.length === 0 ? (
          <div className="empty-message">Nenhum perfil encontrado.</div>
        ) : (
          <ul className="cards-grid" aria-label="Lista de perfis">
            {filtrados.map((p) => {
              const isAdmin = String(p.nome || "").trim().toLowerCase() === "administrador";
              const expandido = perfilExpandido === p.id;
              const permissoesPerfil = permissoesPorPerfil.get(p.id) || new Set();
              const carregandoPerms = permissoesCarregando.has(p.id);
              const salvandoPerms = permissoesSalvando.has(p.id);

              return (
                <li key={p.id} className="perfil-card" aria-label={`Perfil: ${p.nome}`}>
                  <div className="perfil-card__head">
                    <div className="perfil-card__title-section">
                      <h3 className="perfil-card__title">{p.nome}</h3>
                      <div className="perfil-card__badges">
                        {isAdmin && (
                          <span className="badge badge--admin">
                            <ShieldCheckIcon className="icon" aria-hidden="true" />
                            Administrador
                          </span>
                        )}
                        <span className={`badge ${p.ativo ? "ok" : "muted"}`}>
                          {p.ativo ? "Ativo" : "Inativo"}
                        </span>
                      </div>
                    </div>
                    <div className="perfil-card__actions">
                      {/* Omitir botão Editar para perfil Administrador */}
                      {!isAdmin && (
                        <button
                          className="btn btn--neutral btn--sm"
                          onClick={() => editar(p)}
                          aria-label={`Editar ${p.nome}`}
                          title="Editar"
                        >
                          <PencilSquareIcon className="icon" aria-hidden="true" />
                          <span>Editar</span>
                        </button>
                      )}
                      <button
                        className="btn btn--neutral btn--sm"
                        onClick={() => toggleExpansaoPerfil(p.id)}
                        aria-label={expandido ? `Ocultar permissões de ${p.nome}` : `Mostrar permissões de ${p.nome}`}
                        disabled={carregandoPerms}
                        title="Permissões"
                      >
                        {expandido ? <ChevronUpIcon className="icon" aria-hidden="true" /> : <ChevronDownIcon className="icon" aria-hidden="true" />}
                        <span>Permissões</span>
                      </button>
                      {!isAdmin && (
                        <button
                          className="btn btn--danger btn--sm"
                          onClick={() => excluir(p)}
                          aria-label={`Excluir perfil ${p.nome}`}
                          title="Excluir"
                        >
                          <TrashIcon className="icon" aria-hidden="true" />
                          <span>Excluir</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Painel expandido (permissões) */}
                  {expandido && (
                    <div className="perfil-card__expanded">
                      {isAdmin ? (
                        <div className="perfil-card__admin-notice">
                          <strong>Administrador:</strong> possui todas as permissões automaticamente.
                        </div>
                      ) : (
                        <>
                          <div className="perfil-card__permissions-toolbar">
                            <button 
                              className="btn btn--neutral btn--sm" 
                              onClick={() => marcarTodasPermissoes(p.id, true)} 
                              disabled={salvandoPerms}
                            >
                              Marcar Todas
                            </button>
                            <button 
                              className="btn btn--neutral btn--sm" 
                              onClick={() => marcarTodasPermissoes(p.id, false)} 
                              disabled={salvandoPerms}
                            >
                              Limpar Todas
                            </button>
                            <button 
                              className="btn btn--success btn--sm" 
                              onClick={() => salvarPermissoes(p.id)} 
                              disabled={salvandoPerms}
                            >
                              {salvandoPerms ? <span className="spinner" aria-hidden="true" /> : <CheckIcon className="icon" aria-hidden="true" />}
                              <span>{salvandoPerms ? "Salvando…" : "Salvar Permissões"}</span>
                            </button>
                          </div>

                          {carregandoPerms ? (
                            <div className="perfil-card__loading">
                              <span className="spinner" aria-hidden="true" /> Carregando permissões…
                            </div>
                          ) : (
                            <div className="permissoes-grid">
                              {Array.from(gruposPermissoes.keys()).map((escopo) => {
                                const itens = gruposPermissoes.get(escopo) || [];
                                const total = itens.length;
                                const marcadas = itens.filter(perm => permissoesPerfil.has(perm.id)).length;

                                return (
                                  <div key={escopo} className="permissao-grupo">
                                    <div className="permissao-grupo__header">
                                      <h4 className="permissao-grupo__title">
                                        {escopo} <small>({marcadas}/{total})</small>
                                      </h4>
                                    </div>
                                    <div className="permissao-grupo__list">
                                      {itens.map((perm) => {
                                        const checked = permissoesPerfil.has(perm.id);
                                        return (
                                          <label key={perm.id} className="permissao-item">
                                            <input
                                              type="checkbox"
                                              checked={checked}
                                              onChange={() => togglePermissao(p.id, perm.id)}
                                              className="permissao-item__checkbox"
                                            />
                                            <div className="permissao-item__content">
                                              <div className="permissao-item__codigo">{perm.codigo}</div>
                                              <div className="permissao-item__descricao">{perm.descricao || ""}</div>
                                            </div>
                                          </label>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* FORMULÁRIO COMO DIALOG OVERLAY (padrão Usuários) */}
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
              <h2 id="titulo-form">{form.id ? "Editar Perfil" : "Novo Perfil"}</h2>
              <button
                className="btn btn--neutral btn--icon-only"
                onClick={cancelarInline}
                aria-label="Fechar formulário"
                title="Fechar"
              >
                <XMarkIcon className="icon" aria-hidden="true" />
              </button>
            </div>

            <form className="form" onSubmit={salvar}>
              <div className="form-grid">
                <div className="form-field span-2">
                  <label htmlFor="pf_nome">Nome do Perfil</label>
                  <input
                    id="pf_nome"
                    ref={nomeRef}
                    value={form.nome}
                    onChange={(e) => setField("nome", e.target.value)}
                    required
                    autoComplete="off"
                  />
                </div>

                <div className="form-field span-2" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    id="pf_ativo"
                    type="checkbox"
                    checked={!!form.ativo}
                    onChange={(e) => setField("ativo", e.target.checked ? 1 : 0)}
                  />
                  <label htmlFor="pf_ativo" className="checkbox-label">Perfil ativo</label>
                </div>
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn--neutral" onClick={cancelarInline}>
                  <XMarkIcon className="icon" aria-hidden="true" />
                  <span>Cancelar</span>
                </button>
                <button type="submit" className="btn btn--success" disabled={loading}>
                  <CheckIcon className="icon" aria-hidden="true" />
                  <span>{loading ? "Salvando..." : form.id ? "Salvar alterações" : "Criar perfil"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Estilos seguindo o padrão do Usuários */}
      <style jsx>{`
        .listagem-container { width: 100%; }
        .search-container { margin-bottom: 16px; }

        /* Cards grid */
        .cards-grid {
          list-style: none;
          padding: 0;
          margin: 0;
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
        }

        .perfil-card {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 12px;
          box-shadow: var(--shadow);
          overflow: hidden;
          position: relative;
        }

        .perfil-card::before {
          content: "";
          position: absolute;
          left: 0; top: 0; bottom: 0;
          width: 4px;
          background: var(--accent-bg);
        }

        .perfil-card__head {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 14px 14px 16px 14px; /* Aumentado padding inferior */
        }

        @media (min-width: 768px) {
          .perfil-card__head {
            flex-direction: row;
            align-items: flex-start;
            justify-content: space-between;
          }
        }

        .perfil-card__title-section {
          display: flex;
          flex-direction: column;
          gap: 8px;
          min-width: 0;
          flex: 1;
        }

        .perfil-card__title {
          margin: 0;
          font-size: 1rem;
          font-weight: 700;
          color: var(--fg);
        }

        .perfil-card__badges {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }

        .badge {
          font-size: 0.75rem;
          padding: 4px 8px;
          border-radius: 999px;
          border: 1px solid var(--border);
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: var(--badge-bg, var(--panel-muted));
          color: var(--badge-fg, var(--muted));
          border-color: var(--badge-border, var(--border));
        }

        .badge.ok { 
          --badge-bg: rgba(16,185,129,.12);
          --badge-fg: var(--success-strong);
          --badge-border: rgba(16,185,129,.35);
        }

        .badge.muted { 
          --badge-bg: var(--panel-muted);
          --badge-fg: var(--muted);
          --badge-border: var(--border);
        }

        .badge--admin {
          --badge-bg: rgba(139, 92, 246, 0.12);
          --badge-fg: var(--admin-color, #8b5cf6);
          --badge-border: rgba(139, 92, 246, 0.35);
        }

        .perfil-card__actions {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          margin-top: 4px; /* Espaço adicional para separar dos badges */
        }

        .perfil-card__expanded {
          margin-top: 0;
          border-top: 1px solid var(--border);
          padding: 16px 14px 14px 14px;
        }

        .perfil-card__admin-notice {
          background: var(--panel-muted);
          padding: 12px;
          border-radius: 8px;
          color: var(--muted);
          text-align: center;
        }

        .perfil-card__permissions-toolbar {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 16px;
        }

        .perfil-card__loading {
          text-align: center;
          padding: 2rem;
          color: var(--muted);
        }

        .permissoes-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
        }

        @media (min-width: 640px) {
          .permissoes-grid {
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          }
        }

        .permissao-grupo {
          background: var(--panel-muted);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 12px;
        }

        .permissao-grupo__header {
          margin-bottom: 12px;
          padding-bottom: 8px;
          border-bottom: 1px solid var(--border);
        }

        .permissao-grupo__title {
          margin: 0;
          font-size: 0.9rem;
          font-weight: 600;
          color: var(--fg);
          text-transform: capitalize;
        }

        .permissao-grupo__title small {
          color: var(--muted);
          font-weight: normal;
        }

        .permissao-grupo__list {
          display: grid;
          gap: 8px;
        }

        .permissao-item {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          padding: 8px;
          border-radius: 6px;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .permissao-item:hover {
          background: var(--hover-bg, rgba(0,0,0,0.05));
        }

        .permissao-item__checkbox {
          margin-top: 2px;
        }

        .permissao-item__content {
          flex: 1;
        }

        .permissao-item__codigo {
          font-weight: 600;
          color: var(--fg);
          font-size: 0.85rem;
        }

        .permissao-item__descricao {
          color: var(--muted);
          font-size: 0.75rem;
          line-height: 1.3;
        }

        /* Success alert */
        .success-alert {
          background: rgba(16,185,129,.12);
          border: 1px solid rgba(16,185,129,.35);
          color: var(--success-strong);
          padding: 12px 16px;
          border-radius: 8px;
          margin-bottom: 16px;
        }

        /* Checkbox label para modo HC */
        .checkbox-label {
          color: var(--fg);
          font-weight: 500;
        }

        /* Botão placeholder para manter consistência */
        .btn--placeholder {
          visibility: hidden;
          pointer-events: none;
        }

        /* Ajustes menores */
        @media (max-width: 480px) {
          .perfil-card__actions {
            width: 100%;
          }
          
          .perfil-card__actions .btn {
            flex: 1;
            justify-content: center;
          }

          .perfil-card__head {
            padding: 14px 14px 18px 14px; /* Mais espaço no mobile */
          }
        }
      `}</style>
    </>
  );
}