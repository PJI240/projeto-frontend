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

  // Estados para permissões
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
      // Recarrega as permissões do perfil expandido
      if (perfilExpandido != null) {
        await carregarPermissoesPerfil(perfilExpandido);
      }
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
    if (perfilExpandido === perfilId) {
      setPerfilExpandido(null);
    } else {
      setPerfilExpandido(perfilId);
      if (!permissoesPorPerfil.has(perfilId)) {
        carregarPermissoesPerfil(perfilId);
      }
    }
  }

  function togglePermissao(perfilId, permissaoId) {
    const perfil = perfis.find(p => p.id === perfilId);
    const isAdmin = perfil && String(perfil.nome || "").toLowerCase() === "administrador";
    if (isAdmin) return; // Não permite alterar permissões do admin

    setPermissoesPorPerfil(prev => {
      const next = new Map(prev);
      const atual = next.get(perfilId) || new Set();
      const novas = new Set(atual);
      if (novas.has(permissaoId)) novas.delete(permissaoId);
      else novas.add(permissaoId);
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
      const novas = marcar ? new Set(permissoes.map(p => p.id)) : new Set();
      next.set(perfilId, novas);
      return next;
    });
  }

  async function salvarPermissoes(perfilId) {
    setPermissoesSalvando(prev => new Set(prev).add(perfilId));
    setErr("");
    setSuccess("");
    try {
      const permissoesAtuais = permissoesPorPerfil.get(perfilId) || new Set();
      const body = {
        perfil_id: Number(perfilId),
        ids: Array.from(permissoesAtuais).map(Number),
      };

      await fetchJson(API.syncPerfilPerms, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      setSuccess("Permissões salvas com sucesso.");
      if (liveRef.current) liveRef.current.textContent = "Permissões salvas.";
    } catch (e) {
      setErr(e.message || "Falha ao salvar permissões.");
      if (liveRef.current) liveRef.current.textContent = "Erro ao salvar permissões.";
    } finally {
      setPermissoesSalvando(prev => {
        const next = new Set(prev);
        next.delete(perfilId);
        return next;
      });
    }
  }

  // CRUD de Perfis (sem alteração de lógica)
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

  function fecharForm() {
    setShowForm(false);
  }

  async function salvarPerfil(e) {
    e?.preventDefault?.();
    setLoading(true);
    setErr(""); 
    setSuccess("");

    try {
      const body = { nome: form.nome?.trim(), ativo: form.ativo ? 1 : 0 };
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
        r = await fetch(API.perfis, {
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
      await carregarPerfis();
      if (liveRef.current) liveRef.current.textContent = "Perfil excluído.";
    } catch (e) {
      setErr(e.message || "Não foi possível excluir o perfil.");
      if (liveRef.current) liveRef.current.textContent = "Erro ao excluir perfil.";
    }
  }

  // Agrupamento de permissões por escopo
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

  // Carregar dados iniciais
  useEffect(() => { 
    carregarPerfis();
    carregarPermissoes();
  }, []);

  // Acessibilidade: fechar dialog com Esc
  const onOverlayKeyDown = (ev) => {
    if (ev.key === "Escape") setShowForm(false);
  };

  return (
    <>
      {/* região viva para leitores de tela */}
      <div ref={liveRef} aria-live="polite" className="visually-hidden" />

      {/* HEADER PADRÃO */}
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
            title="Sincronizar permissões"
          >
            <ArrowPathIcon className="icon" aria-hidden="true" />
            <span>{syncing ? "Sincronizando…" : "Sincronizar"}</span>
          </button>
          <button
            className="btn btn--neutral"
            onClick={carregarPerfis}
            disabled={loading}
            aria-busy={loading ? "true" : "false"}
            aria-label="Atualizar lista de perfis"
            title="Atualizar"
          >
            <ArrowPathIcon className="icon" aria-hidden="true" />
            <span>{loading ? "Atualizando…" : "Atualizar"}</span>
          </button>
        </div>
      </header>

      {err && <div className="error-alert" role="alert">{err}</div>}
      {success && <div className="success-alert" role="status">{success}</div>}

      {/* LISTA DE PERFIS */}
      <div className="stat-card" style={{ padding: 0 }}>
        {loading ? (
          <div className="loading-message" role="status">Carregando…</div>
        ) : perfis.length === 0 ? (
          <div className="empty-message">Nenhum perfil encontrado.</div>
        ) : (
          <div className="table-wrapper table-only" role="region" aria-label="Tabela de perfis">
            <table className="usuarios-table">
              <thead>
                <tr>
                  <th scope="col">Nome</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="actions-column">Ações</th>
                </tr>
              </thead>
              <tbody>
                {perfis.map((p) => {
                  const isAdmin = String(p.nome || "").trim().toLowerCase() === "administrador";
                  const expandido = perfilExpandido === p.id;
                  const permissoesPerfil = permissoesPorPerfil.get(p.id) || new Set();
                  const carregandoPermissoes = permissoesCarregando.has(p.id);
                  const salvandoPermissoes = permissoesSalvando.has(p.id);

                  return (
                    <tr key={p.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span>{p.nome}</span>
                          {isAdmin && (
                            <span className="badge muted" title="Perfil base com todas as permissões">
                              <ShieldCheckIcon className="icon" aria-hidden="true" />
                              base
                            </span>
                          )}
                        </div>
                      </td>
                      <td>{p.ativo ? "Ativo" : "Inativo"}</td>
                      <td>
                        <div className="actions-buttons">
                          <button className="btn btn--neutral btn--sm" onClick={() => abrirEdicao(p)} aria-label={`Editar perfil ${p.nome}`}>
                            <CheckIcon className="icon" aria-hidden="true" />
                            <span>Editar</span>
                          </button>
                          <button
                            className="btn btn--neutral btn--sm"
                            onClick={() => toggleExpansaoPerfil(p.id)}
                            aria-label={expandido ? `Ocultar permissões de ${p.nome}` : `Mostrar permissões de ${p.nome}`}
                            disabled={carregandoPermissoes}
                          >
                            {expandido ? <ChevronUpIcon className="icon" aria-hidden="true" /> : <ChevronDownIcon className="icon" aria-hidden="true" />}
                            <span>{expandido ? "Ocultar" : "Atribuições"}</span>
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

                        {/* BLOCO EXPANDÍVEL */}
                        {expandido && (
                          <div className="expand-panel" role="region" aria-label={`Permissões do perfil ${p.nome}`}>
                            {carregandoPermissoes ? (
                              <div className="loading-message" role="status">Carregando permissões…</div>
                            ) : (
                              <>
                                {isAdmin && (
                                  <div className="info-callout">
                                    <strong>Perfil Administrador:</strong> possui todas as permissões automaticamente.
                                  </div>
                                )}

                                {!isAdmin && (
                                  <div className="page-header__toolbar" style={{ padding: 0, marginBottom: 12 }}>
                                    <button
                                      className="btn btn--neutral btn--sm"
                                      onClick={() => marcarTodasPermissoes(p.id, true)}
                                      disabled={salvandoPermissoes}
                                    >
                                      Marcar Todas
                                    </button>
                                    <button
                                      className="btn btn--neutral btn--sm"
                                      onClick={() => marcarTodasPermissoes(p.id, false)}
                                      disabled={salvandoPermissoes}
                                    >
                                      Limpar Todas
                                    </button>
                                    <button
                                      className="btn btn--success btn--sm"
                                      onClick={() => salvarPermissoes(p.id)}
                                      disabled={salvandoPermissoes}
                                    >
                                      <CheckIcon className="icon" aria-hidden="true" />
                                      <span>{salvandoPermissoes ? "Salvando…" : "Salvar Permissões"}</span>
                                    </button>
                                  </div>
                                )}

                                <div className="cards-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
                                  {Array.from(gruposPermissoes.keys()).map((escopo) => {
                                    const itens = gruposPermissoes.get(escopo) || [];
                                    const total = itens.length;
                                    const marcadasNoGrupo = itens.filter(perm => permissoesPerfil.has(perm.id)).length;

                                    return (
                                      <section key={escopo} className="pessoa-card" aria-label={`Escopo ${escopo}`}>
                                        <div className="pessoa-card__head">
                                          <h3 className="pessoa-card__title" style={{ textTransform: "capitalize" }}>
                                            {escopo} ({marcadasNoGrupo}/{total})
                                          </h3>
                                        </div>
                                        <div className="pessoa-card__body">
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
                                                    <span style={{ fontWeight: 600 }}>{perm.codigo}</span>
                                                    <span style={{ color: "var(--muted)" }}>
                                                      {perm.descricao || ""}
                                                    </span>
                                                  </label>
                                                </li>
                                              );
                                            })}
                                          </ul>
                                        </div>
                                      </section>
                                    );
                                  })}
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DIALOG: CRIAR/EDITAR PERFIL */}
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
              <h2 id="titulo-form">{editId ? "Editar Perfil" : "Novo Perfil"}</h2>
              <button
                className="btn btn--neutral btn--icon-only"
                onClick={fecharForm}
                aria-label="Fechar formulário"
                title="Fechar"
              >
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

      {/* estilos locais mínimos, reaproveitando tokens do global.css */}
      <style jsx>{`
        .expand-panel {
          margin-top: 10px;
          border-top: 1px dashed var(--border);
          padding-top: 12px;
        }
        .info-callout {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 12px;
          margin-bottom: 12px;
        }
        /* Reuso dos mesmos padrões Mobile/Desk de Pessoas.jsx */
        .table-only { display: block; }
        @media (max-width: 768px) {
          .table-only { display: block; overflow-x: auto; }
        }
        /* Dialog */
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
        .cards-grid {
          display: grid;
          gap: 12px;
        }
        .pessoa-card {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 12px;
          box-shadow: var(--shadow);
          overflow: hidden;
          position: relative;
        }
        .pessoa-card::before {
          content: "";
          position: absolute;
          left: 0; top: 0; bottom: 0;
          width: 4px; background: var(--accent-bg);
        }
        .pessoa-card__head {
          display: flex; align-items: center; justify-content: space-between;
          gap: 8px; padding: 14px 14px 0 14px;
        }
        .pessoa-card__title {
          margin: 0; font-size: 1rem; font-weight: 700; color: var(--fg);
        }
        .pessoa-card__body {
          padding: 12px 14px 14px 14px;
        }
        .usuarios-table th, .usuarios-table td { white-space: nowrap; }
        .usuarios-table td:first-child, .usuarios-table th:first-child { white-space: normal; }
      `}</style>
    </>
  );
}