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
} from "@heroicons/react/24/solid";

const API_BASE = import.meta.env.VITE_API_BASE?.replace(/\/+$/, "") || "";

const API = {
  perfis: `${API_BASE}/api/perfis`,
  permissoes: `${API_BASE}/api/permissoes`,
  getPerfilPerms: (id) => `${API_BASE}/api/perfis_permissoes?perfil_id=${id}`,
  syncPerfilPerms: `${API_BASE}/api/perfis_permissoes/sync`,
  syncPerms: `${API_BASE}/api/permissoes/sync`,
};

export default function PerfisPermissoes() {
  const [perfis, setPerfis] = useState([]);
  const [permissoes, setPermissoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ nome: "", ativo: 1 });

  const [perfilExpandido, setPerfilExpandido] = useState(null);
  const [permissoesCarregando, setPermissoesCarregando] = useState(new Set());
  const [permissoesPorPerfil, setPermissoesPorPerfil] = useState(new Map());
  const [permissoesSalvando, setPermissoesSalvando] = useState(new Set());

  const liveRef = useRef(null);

  const fetchJson = useCallback(async (url, init) => {
    const r = await fetch(url, { credentials: "include", ...init });
    let data = null;
    try { data = await r.json(); } catch {}
    if (!r.ok || !data?.ok) {
      const e = new Error(data?.error || `HTTP ${r.status}`);
      e.status = r.status;
      throw e;
    }
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

  async function excluirPerfil(perfil) {
    if (!confirm(`Deseja realmente excluir o perfil "${perfil.nome}"?`)) return;
    setErr("");
    try {
      await fetchJson(`${API_BASE}/api/perfis/${perfil.id}`, { method: "DELETE" });
      setSuccess("Perfil excluído com sucesso.");
      await carregarPerfis();
      if (liveRef.current) liveRef.current.textContent = "Perfil excluído.";
    } catch (e) {
      setErr(e.message || "Falha ao excluir perfil.");
      if (liveRef.current) liveRef.current.textContent = "Erro ao excluir perfil.";
    }
  }

  // CRUD Perfil
  function abrirNovo() { setErr(""); setSuccess(""); setEditId(null); setForm({ nome: "", ativo: 1 }); setShowForm(true); }
  function abrirEdicao(p) { setErr(""); setSuccess(""); setEditId(p.id); setForm({ nome: p.nome || "", ativo: p.ativo ? 1 : 0 }); setShowForm(true); }
  function fecharForm() { setShowForm(false); }

  async function salvarPerfil(e) {
    e?.preventDefault?.();
    setLoading(true);
    setErr(""); setSuccess("");
    try {
      const body = { nome: form.nome?.trim(), ativo: form.ativo ? 1 : 0 };
      if (!body.nome) throw new Error("Informe o nome do perfil.");

      const r = editId
        ? await fetch(`${API_BASE}/api/perfis/${editId}`, {
            method: "PUT", credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch(API.perfis, {
            method: "POST", credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });

      const data = await r.json().catch(() => null);
      if (!r.ok || !data?.ok) throw new Error(data?.error || "Falha ao salvar.");

      setSuccess(editId ? "Perfil atualizado." : "Perfil criado.");
      setShowForm(false);
      await carregarPerfis();
      if (liveRef.current) liveRef.current.textContent = "Perfil salvo.";
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

  useEffect(() => { carregarPerfis(); carregarPermissoes(); }, []);

  const onOverlayKeyDown = (ev) => { if (ev.key === "Escape") setShowForm(false); };

  return (
    <>
      {/* região viva */}
      <div ref={liveRef} aria-live="polite" className="visually-hidden" />

      {/* HEADER - Padrão igual Pessoas */}
      <header className="page-header" role="region" aria-labelledby="titulo-pagina">
        <div>
          <h1 id="titulo-pagina" className="page-title">Perfis e Permissões</h1>
          <p className="page-subtitle">Gerencie perfis de acesso e suas permissões no sistema.</p>
        </div>
        <div className="page-header__toolbar" aria-label="Ações da página">
          <button className="btn btn--success" onClick={abrirNovo} aria-label="Criar novo perfil">
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
      {Boolean(success) && (
        <div className="stat-card" data-accent="success" role="status" style={{ marginBottom: '16px' }}>
          {success}
        </div>
      )}

      {/* LISTA EM CARDS - Reaproveitando stats-grid */}
      <div className="stats-grid" style={{ gridTemplateColumns: "1fr", gap: '16px' }}>
        {loading ? (
          <div className="stat-card" style={{ textAlign: 'center', padding: '3rem' }}>
            <span className="spinner" aria-hidden="true" /> Carregando…
          </div>
        ) : perfis.length === 0 ? (
          <div className="stat-card" style={{ textAlign: 'center', padding: '3rem' }}>
            Nenhum perfil encontrado.
          </div>
        ) : (
          perfis.map((p) => {
            const isAdmin = String(p.nome || "").trim().toLowerCase() === "administrador";
            const expandido = perfilExpandido === p.id;
            const permissoesPerfil = permissoesPorPerfil.get(p.id) || new Set();
            const carregandoPerms = permissoesCarregando.has(p.id);
            const salvandoPerms = permissoesSalvando.has(p.id);

            return (
              <section key={p.id} className="stat-card" aria-label={`Perfil ${p.nome}`}>
                {/* Cabeçalho do card - usando stat-header */}
                <div className="stat-header" style={{ alignItems: "center", cursor: 'pointer' }} onClick={() => toggleExpansaoPerfil(p.id)}>
                  <div style={{ display: "flex", alignItems: "center", gap: '12px', minWidth: 0, flex: 1 }}>
                    <h3 style={{ margin: 0, fontSize: "1.25rem", color: 'var(--fg)' }}>{p.nome}</h3>
                    {isAdmin && (
                      <span className="btn btn--ghost btn--sm" style={{ pointerEvents: 'none' }}>
                        <ShieldCheckIcon className="icon" aria-hidden="true" />
                        Administrador
                      </span>
                    )}
                    <span className="btn btn--ghost btn--sm" style={{ pointerEvents: 'none' }}>
                      {p.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: '8px' }}>
                    <button 
                      className="btn btn--neutral btn--sm" 
                      onClick={(e) => { e.stopPropagation(); abrirEdicao(p); }}
                      aria-label={`Editar ${p.nome}`}
                    >
                      <CheckIcon className="icon" aria-hidden="true" />
                      <span>Editar</span>
                    </button>

                    <button
                      className="btn btn--neutral btn--sm"
                      onClick={(e) => { e.stopPropagation(); toggleExpansaoPerfil(p.id); }}
                      aria-label={expandido ? `Ocultar permissões de ${p.nome}` : `Mostrar permissões de ${p.nome}`}
                      disabled={carregandoPerms}
                    >
                      {expandido ? <ChevronUpIcon className="icon" aria-hidden="true" /> : <ChevronDownIcon className="icon" aria-hidden="true" />}
                      <span>Permissões</span>
                    </button>

                    {!isAdmin && (
                      <button
                        className="btn btn--danger btn--sm"
                        onClick={(e) => { e.stopPropagation(); excluirPerfil(p); }}
                        aria-label={`Excluir perfil ${p.nome}`}
                      >
                        <XMarkIcon className="icon" aria-hidden="true" />
                        <span>Excluir</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Painel expandido (permissões) */}
                {expandido && (
                  <div style={{ marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                    {isAdmin ? (
                      <div className="action-card" style={{ textAlign: 'left', alignItems: 'flex-start' }}>
                        <strong>Administrador:</strong> possui todas as permissões automaticamente.
                      </div>
                    ) : (
                      <>
                        <div className="page-header__toolbar" style={{ marginBottom: '16px' }}>
                          <button className="btn btn--neutral btn--sm" onClick={() => marcarTodasPermissoes(p.id, true)} disabled={salvandoPerms}>
                            Marcar Todas
                          </button>
                          <button className="btn btn--neutral btn--sm" onClick={() => marcarTodasPermissoes(p.id, false)} disabled={salvandoPerms}>
                            Limpar Todas
                          </button>
                          <button className="btn btn--success btn--sm" onClick={() => salvarPermissoes(p.id)} disabled={salvandoPerms}>
                            {salvandoPerms ? <span className="spinner" aria-hidden="true" /> : <CheckIcon className="icon" aria-hidden="true" />}
                            <span>{salvandoPerms ? "Salvando…" : "Salvar Permissões"}</span>
                          </button>
                        </div>

                        {carregandoPerms ? (
                          <div style={{ textAlign: 'center', padding: '2rem' }}>
                            <span className="spinner" aria-hidden="true" /> Carregando permissões…
                          </div>
                        ) : (
                          <div className="stats-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: '12px' }}>
                            {Array.from(gruposPermissoes.keys()).map((escopo) => {
                              const itens = gruposPermissoes.get(escopo) || [];
                              const total = itens.length;
                              const marcadas = itens.filter(perm => permissoesPerfil.has(perm.id)).length;

                              return (
                                <div key={escopo} className="stat-card" data-accent="info" style={{ padding: '16px' }}>
                                  <div className="stat-header" style={{ marginBottom: '12px' }}>
                                    <h4 style={{ margin: 0, textTransform: "capitalize" }}>
                                      {escopo} <small>({marcadas}/{total})</small>
                                    </h4>
                                  </div>

                                  <div style={{ display: 'grid', gap: '8px' }}>
                                    {itens.map((perm) => {
                                      const checked = permissoesPerfil.has(perm.id);
                                      return (
                                        <label key={perm.id} style={{ display: "flex", alignItems: "flex-start", gap: '8px', padding: '8px', borderRadius: '6px', cursor: 'pointer' }}>
                                          <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() => togglePermissao(p.id, perm.id)}
                                            style={{ marginTop: '2px' }}
                                          />
                                          <div>
                                            <div style={{ fontWeight: '600', color: 'var(--fg)' }}>{perm.codigo}</div>
                                            <div style={{ color: 'var(--muted)', fontSize: 'var(--fs-14)' }}>{perm.descricao || ""}</div>
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
              </section>
            );
          })
        )}
      </div>

      {/* DIALOG: CRIAR/EDITAR PERFIL - Reaproveitando form-overlay padrão */}
      {showForm && (
        <div className="form-overlay" role="dialog" aria-modal="true" aria-labelledby="titulo-form" onKeyDown={onOverlayKeyDown}>
          <div className="form-container">
            <div className="form-header">
              <h2 id="titulo-form">{editId ? "Editar Perfil" : "Novo Perfil"}</h2>
              <button className="btn btn--neutral btn--icon-only" onClick={() => setShowForm(false)} aria-label="Fechar formulário">
                <XMarkIcon className="icon" aria-hidden="true" />
              </button>
            </div>

            <form className="form" onSubmit={salvarPerfil}>
              <div className="form-grid">
                <div className="form-field span-2">
                  <label htmlFor="pf_nome">Nome do Perfil</label>
                  <input
                    id="pf_nome"
                    value={form.nome}
                    onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                    required
                    autoComplete="off"
                  />
                </div>

                <div className="form-field" style={{ display: "flex", alignItems: "center", gap: '8px', padding: '8px 0' }}>
                  <input
                    id="pf_ativo"
                    type="checkbox"
                    checked={!!form.ativo}
                    onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked ? 1 : 0 }))}
                    style={{ width: '16px', height: '16px' }}
                  />
                  <label htmlFor="pf_ativo" style={{ margin: 0 }}>Perfil ativo</label>
                </div>
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn--neutral" onClick={fecharForm}>
                  <XMarkIcon className="icon" aria-hidden="true" />
                  <span>Cancelar</span>
                </button>
                <button type="submit" className="btn btn--success" disabled={loading}>
                  {loading ? <span className="spinner" aria-hidden="true" /> : <CheckIcon className="icon" aria-hidden="true" />}
                  <span>{loading ? "Salvando…" : "Salvar"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}