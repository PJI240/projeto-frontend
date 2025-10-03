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
      const idsPermissoes = isAdmin
        ? new Set(permissoes.map(p => p.id))
        : new Set((data.ids || []).map(Number));
      setPermissoesPorPerfil(prev => new Map(prev).set(perfilId, idsPermissoes));
    } catch (e) {
      setErr(e.message || "Falha ao carregar permissões do perfil.");
    } finally {
      setPermissoesCarregando(prev => {
        const next = new Set(prev);
        next.delete(perfilId);
        return next;
      });
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
      setPermissoesSalvando(prev => {
        const next = new Set(prev); next.delete(perfilId); return next;
      });
    }
  }

  // CRUD Perfil (mesma lógica)
  function abrirNovo() {
    setErr(""); setSuccess("");
    setEditId(null);
    setForm({ nome: "", ativo: 1 });
    setShowForm(true);
  }
  function abrirEdicao(p) {
    setErr(""); setSuccess("");
    setEditId(p.id);
    setForm({ nome: p.nome || "", ativo: p.ativo ? 1 : 0 });
    setShowForm(true);
  }
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

  async function excluirPerfil(p) {
    setErr(""); setSuccess("");
    const nomeLower = String(p.nome || "").trim().toLowerCase();
    if (nomeLower === "administrador") { setErr("Este perfil não pode ser excluído."); return; }
    if (!confirm(`Excluir o perfil "${p.nome}"?`)) return;
    try {
      const r = await fetch(`${API_BASE}/api/perfis/${p.id}`, {
        method: "DELETE", credentials: "include",
      });
      const data = await r.json().catch(() => null);
      if (!r.ok || !data?.ok) throw new Error(data?.error || "Falha ao excluir.");
      setSuccess("Perfil excluído.");
      await carregarPerfis();
      if (liveRef.current) liveRef.current.textContent = "Perfil excluído.";
    } catch (e) {
      setErr(e.message || "Não foi possível excluir o perfil.");
      if (liveRef.current) liveRef.current.textContent = "Erro ao excluir perfil.";
    }
  }

  const gruposPermissoes = useMemo(() => {
    const map = new Map();
    for (const p of permissoes) {
      const g = (p.escopo || "geral").toLowerCase();
      if (!map.has(g)) map.set(g, []);
      map.get(g).push(p);
    }
    for (const [k, arr] of map) {
      arr.sort((a, b) => String(a.codigo).localeCompare(String(b.codigo)));
    }
    return map;
  }, [permissoes]);

  useEffect(() => { carregarPerfis(); carregarPermissoes(); }, []);

  const onOverlayKeyDown = (ev) => { if (ev.key === "Escape") setShowForm(false); };

  return (
    <>
      {/* região viva */}
      <div ref={liveRef} aria-live="polite" className="visually-hidden" />

      {/* HEADER (global.css) */}
      <header className="page-header" role="region" aria-labelledby="ttl">
        <div>
          <h1 id="ttl" className="page-title">Perfis e Permissões</h1>
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
      {success && <div className="success-alert" role="status">{success}</div>}

      {/* LISTA EM CARDS (reuso de .stat-card) */}
      <div className="stats-grid" style={{ gridTemplateColumns: "1fr" }}>
        {loading ? (
          <div className="stat-card"><div className="spinner" aria-hidden="true" /> Carregando…</div>
        ) : perfis.length === 0 ? (
          <div className="stat-card">Nenhum perfil encontrado.</div>
        ) : (
          perfis.map((p) => {
            const isAdmin = String(p.nome || "").trim().toLowerCase() === "administrador";
            const expandido = perfilExpandido === p.id;
            const permissoesPerfil = permissoesPorPerfil.get(p.id) || new Set();
            const carregandoPerms = permissoesCarregando.has(p.id);
            const salvandoPerms = permissoesSalvando.has(p.id);

            return (
              <section key={p.id} className="stat-card" aria-label={`Perfil ${p.nome}`}>
                <div className="stat-header">
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <h3 className="title" style={{ margin: 0 }}>{p.nome}</h3>
                    {isAdmin && (
                      <span className="toggle-btn is-active" aria-label="Perfil base">
                        <ShieldCheckIcon className="icon" aria-hidden="true" />
                        base
                      </span>
                    )}
                  </div>
                  <div className="page-header__toolbar">
                    <span className="toggle-btn" aria-label={`Status: ${p.ativo ? "Ativo" : "Inativo"}`}>
                      {p.ativo ? "Ativo" : "Inativo"}
                    </span>
                    <button className="btn btn--neutral btn--sm" onClick={() => abrirEdicao(p)} aria-label={`Editar ${p.nome}`}>
                      <CheckIcon className="icon" aria-hidden="true" />
                      <span>Editar</span>
                    </button>
                    <button
                      className="btn btn--neutral btn--sm"
                      onClick={() => toggleExpansaoPerfil(p.id)}
                      aria-label={expandido ? `Ocultar permissões de ${p.nome}` : `Mostrar permissões de ${p.nome}`}
                      disabled={carregandoPerms}
                    >
                      {expandido ? <ChevronUpIcon className="icon" aria-hidden="true" /> : <ChevronDownIcon className="icon" aria-hidden="true" />}
                      <span>Atribuições</span>
                    </button>
                    <button
                      className="btn btn--danger btn--sm"
                      onClick={() => excluirPerfil(p)}
                      aria-label={`Excluir perfil ${p.nome}`}
                      disabled={isAdmin}
                    >
                      <XMarkIcon className="icon" aria-hidden="true" />
                      <span>Excluir</span>
                    </button>
                  </div>
                </div>

                {expandido && (
                  <>
                    {isAdmin && (
                      <div className="action-card" style={{ alignItems: "flex-start" }}>
                        <strong>Administrador:</strong>&nbsp;possui todas as permissões automaticamente.
                      </div>
                    )}

                    {!isAdmin && (
                      <div className="page-header__toolbar" style={{ marginBottom: 12 }}>
                        <button className="btn btn--neutral btn--sm" onClick={() => marcarTodasPermissoes(p.id, true)} disabled={salvandoPerms}>
                          Marcar Todas
                        </button>
                        <button className="btn btn--neutral btn--sm" onClick={() => marcarTodasPermissoes(p.id, false)} disabled={salvandoPerms}>
                          Limpar Todas
                        </button>
                        <button className="btn btn--success btn--sm" onClick={() => salvarPermissoes(p.id)} disabled={salvandoPerms}>
                          <CheckIcon className="icon" aria-hidden="true" />
                          <span>{salvandoPerms ? "Salvando…" : "Salvar Permissões"}</span>
                        </button>
                      </div>
                    )}

                    {carregandoPerms ? (
                      <div className="toggle-btn"><span className="spinner" aria-hidden="true" /> Carregando permissões…</div>
                    ) : (
                      <div className="stats-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
                        {Array.from(gruposPermissoes.keys()).map((escopo) => {
                          const itens = gruposPermissoes.get(escopo) || [];
                          const total = itens.length;
                          const marcadas = itens.filter(perm => permissoesPerfil.has(perm.id)).length;

                          return (
                            <div key={escopo} className="stat-card" data-accent="info" aria-label={`Escopo ${escopo}`}>
                              <div className="stat-header">
                                <h4 className="title" style={{ margin: 0, textTransform: "capitalize" }}>
                                  {escopo} ({marcadas}/{total})
                                </h4>
                              </div>

                              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
                                {itens.map((perm) => {
                                  const checked = permissoesPerfil.has(perm.id);
                                  return (
                                    <li key={perm.id}>
                                      <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          onChange={() => togglePermissao(p.id, perm.id)}
                                          disabled={isAdmin}
                                          aria-checked={checked ? "true" : "false"}
                                        />
                                        <strong>{perm.codigo}</strong>
                                        <span style={{ color: "var(--muted)" }}>{perm.descricao || ""}</span>
                                      </label>
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </section>
            );
          })
        )}
      </div>

      {/* DIALOG: CRIAR/EDITAR PERFIL (usa classes globais) */}
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
                <div className="form-field">
                  <label htmlFor="pf_nome">Nome do Perfil</label>
                  <input
                    id="pf_nome"
                    value={form.nome}
                    onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                    required
                    autoComplete="off"
                  />
                </div>
                <div className="form-field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    id="pf_ativo"
                    type="checkbox"
                    checked={!!form.ativo}
                    onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked ? 1 : 0 }))}
                  />
                  <label htmlFor="pf_ativo">Ativo</label>
                </div>
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn--neutral" onClick={fecharForm}>
                  <XMarkIcon className="icon" aria-hidden="true" />
                  <span>Cancelar</span>
                </button>
                <button type="submit" className="btn btn--success">
                  <CheckIcon className="icon" aria-hidden="true" />
                  <span>Salvar</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}