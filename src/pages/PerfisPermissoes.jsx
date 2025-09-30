// src/pages/PerfisPermissoes.jsx
import { useEffect, useMemo, useState, useCallback } from "react";

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
    } catch (e) {
      setErr(e.message || "Falha ao carregar perfis.");
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
      
      // Recarrega as permissões dos perfis expandidos
      for (const [perfilId, perms] of permissoesPorPerfil.entries()) {
        if (perfilExpandido === perfilId) {
          await carregarPermissoesPerfil(perfilId);
        }
      }
    } catch (e) {
      setErr(e.message || "Erro ao sincronizar permissões.");
    } finally {
      setSyncing(false);
    }
  }

  async function carregarPermissoesPerfil(perfilId) {
    setPermissoesCarregando(prev => new Set(prev).add(perfilId));
    try {
      const data = await fetchJson(API.getPerfilPerms(perfilId));
      const perfil = perfis.find(p => p.id === perfilId);
      const isAdmin = perfil && perfil.nome.toLowerCase() === "administrador";
      
      // Se for admin, marca todas as permissões automaticamente
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
    const isAdmin = perfil && perfil.nome.toLowerCase() === "administrador";
    if (isAdmin) return; // Não permite alterar permissões do admin

    setPermissoesPorPerfil(prev => {
      const next = new Map(prev);
      const permissoesAtuais = next.get(perfilId) || new Set();
      const novasPermissoes = new Set(permissoesAtuais);
      
      if (novasPermissoes.has(permissaoId)) {
        novasPermissoes.delete(permissaoId);
      } else {
        novasPermissoes.add(permissaoId);
      }
      
      next.set(perfilId, novasPermissoes);
      return next;
    });
  }

  function marcarTodasPermissoes(perfilId, marcar = true) {
    const perfil = perfis.find(p => p.id === perfilId);
    const isAdmin = perfil && perfil.nome.toLowerCase() === "administrador";
    if (isAdmin) return; // Não permite alterar permissões do admin

    setPermissoesPorPerfil(prev => {
      const next = new Map(prev);
      const novasPermissoes = marcar 
        ? new Set(permissoes.map(p => p.id))
        : new Set();
      next.set(perfilId, novasPermissoes);
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
    } catch (e) {
      setErr(e.message || "Falha ao salvar permissões.");
    } finally {
      setPermissoesSalvando(prev => {
        const next = new Set(prev);
        next.delete(perfilId);
        return next;
      });
    }
  }

  // CRUD de Perfis (mantido do código anterior)
  function abrirNovo() {
    setErr(""); 
    setSuccess("");
    setEditId(null);
    setForm({ nome: "", ativo: 1 });
    setShowForm(true);
  }

  function abrirEdicao(p) {
    setErr(""); 
    setSuccess("");
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
      const body = { 
        nome: form.nome?.trim(), 
        ativo: form.ativo ? 1 : 0 
      };
      
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
    } catch (e) {
      setErr(e.message || "Falha ao salvar perfil.");
    } finally {
      setLoading(false);
    }
  }

  async function excluirPerfil(p) {
    setErr(""); 
    setSuccess("");

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
    } catch (e) {
      setErr(e.message || "Não foi possível excluir o perfil.");
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

  return (
    <>
      <header className="main-header">
        <div className="header-content">
          <h1>Perfis e Permissões</h1>
          <p>Gerencie perfis de acesso e suas permissões no sistema.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="toggle-btn" onClick={abrirNovo}>
            Novo Perfil
          </button>
          <button className="toggle-btn" onClick={sincronizarPermissoes} disabled={syncing}>
            {syncing ? "Sincronizando..." : "Sincronizar"}
          </button>
          <button className="toggle-btn" onClick={carregarPerfis} disabled={loading}>
            {loading ? "Atualizando..." : "Atualizar"}
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

      <div className="stats-grid" style={{ gridTemplateColumns: "1fr" }}>
        <div className="stat-card" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: 16, color: "var(--muted)" }}>Carregando…</div>
          ) : perfis.length === 0 ? (
            <div style={{ padding: 16, color: "var(--muted)" }}>
              Nenhum perfil encontrado.
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                  <th style={{ padding: 12 }}>Nome</th>
                  <th style={{ padding: 12 }}>Status</th>
                  <th style={{ padding: 12, width: 200 }}>Ações</th>
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
                    <>
                      <tr key={p.id} style={{ borderBottom: expandido ? "none" : "1px solid var(--border)" }}>
                        <td style={{ padding: 12 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {p.nome}
                            {isAdmin && (
                              <span
                                style={{
                                  fontSize: "12px",
                                  color: "var(--muted)",
                                  border: "1px solid var(--border)",
                                  padding: "2px 8px",
                                  borderRadius: "12px",
                                }}
                              >
                                base
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: 12 }}>
                          {p.ativo ? "Ativo" : "Inativo"}
                        </td>
                        <td style={{ padding: 12, display: "flex", gap: 8 }}>
                          <button className="toggle-btn" onClick={() => abrirEdicao(p)}>
                            Editar
                          </button>
                          <button 
                            className="toggle-btn" 
                            onClick={() => toggleExpansaoPerfil(p.id)}
                            disabled={carregandoPermissoes}
                          >
                            {expandido ? "Ocultar" : "Atribuições"}
                          </button>
                          <button 
                            className="toggle-btn" 
                            onClick={() => excluirPerfil(p)}
                            disabled={isAdmin}
                          >
                            Excluir
                          </button>
                        </td>
                      </tr>
                      {expandido && (
                        <tr>
                          <td colSpan={3} style={{ padding: 0, borderBottom: "1px solid var(--border)" }}>
                            <div style={{ padding: 16, background: "var(--panel-muted)" }}>
                              {carregandoPermissoes ? (
                                <div style={{ color: "var(--muted)" }}>Carregando permissões...</div>
                              ) : (
                                <>
                                  {isAdmin && (
                                    <div style={{ 
                                      background: "var(--panel)", 
                                      padding: "12px", 
                                      borderRadius: "8px",
                                      marginBottom: 16,
                                      border: "1px solid var(--border)"
                                    }}>
                                      <strong>Perfil Administrador:</strong> Possui todas as permissões automaticamente.
                                    </div>
                                  )}
                                  
                                  {!isAdmin && (
                                    <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                                      <button 
                                        className="toggle-btn" 
                                        onClick={() => marcarTodasPermissoes(p.id, true)}
                                        disabled={salvandoPermissoes}
                                      >
                                        Marcar Todas
                                      </button>
                                      <button 
                                        className="toggle-btn" 
                                        onClick={() => marcarTodasPermissoes(p.id, false)}
                                        disabled={salvandoPermissoes}
                                      >
                                        Limpar Todas
                                      </button>
                                      <button 
                                        className="toggle-btn" 
                                        onClick={() => salvarPermissoes(p.id)}
                                        disabled={salvandoPermissoes}
                                      >
                                        {salvandoPermissoes ? "Salvando..." : "Salvar Permissões"}
                                      </button>
                                    </div>
                                  )}

                                  <div style={{ 
                                    display: 'grid', 
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
                                    gap: 16 
                                  }}>
                                    {Array.from(gruposPermissoes.keys()).map((escopo) => {
                                      const itens = gruposPermissoes.get(escopo) || [];
                                      const total = itens.length;
                                      const marcadasNoGrupo = itens.filter(perm => permissoesPerfil.has(perm.id)).length;

                                      return (
                                        <div key={escopo} className="stat-card">
                                          <div style={{ 
                                            display: 'flex', 
                                            justifyContent: 'space-between', 
                                            alignItems: 'center',
                                            marginBottom: 12,
                                            paddingBottom: 8,
                                            borderBottom: '1px solid var(--border)'
                                          }}>
                                            <h4 style={{ margin: 0, textTransform: 'capitalize' }}>
                                              {escopo} ({marcadasNoGrupo}/{total})
                                            </h4>
                                            {!isAdmin && (
                                              <div style={{ display: 'flex', gap: 4 }}>
                                                <button 
                                                  className="toggle-btn" 
                                                  onClick={() => {
                                                    itens.forEach(perm => togglePermissao(p.id, perm.id));
                                                  }}
                                                  disabled={salvandoPermissoes || marcadasNoGrupo === total}
                                                  style={{ padding: '4px 8px', fontSize: '12px' }}
                                                >
                                                  Marcar
                                                </button>
                                                <button 
                                                  className="toggle-btn" 
                                                  onClick={() => {
                                                    itens.forEach(perm => {
                                                      if (permissoesPerfil.has(perm.id)) {
                                                        togglePermissao(p.id, perm.id);
                                                      }
                                                    });
                                                  }}
                                                  disabled={salvandoPermissoes || marcadasNoGrupo === 0}
                                                  style={{ padding: '4px 8px', fontSize: '12px' }}
                                                >
                                                  Limpar
                                                </button>
                                              </div>
                                            )}
                                          </div>

                                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                            {itens.map((perm) => {
                                              const checked = permissoesPerfil.has(perm.id);
                                              return (
                                                <label key={perm.id} style={{ 
                                                  display: 'flex', 
                                                  alignItems: 'center', 
                                                  gap: 8,
                                                  cursor: isAdmin ? 'not-allowed' : 'pointer'
                                                }}>
                                                  <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={() => togglePermissao(p.id, perm.id)}
                                                    disabled={isAdmin || salvandoPermissoes}
                                                  />
                                                  <span style={{ 
                                                    fontSize: '14px',
                                                    opacity: isAdmin ? 0.7 : 1
                                                  }}>
                                                    {perm.codigo}
                                                  </span>
                                                </label>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Drawer/ formulário de perfil */}
      {showForm && (
        <div className="stat-card" style={{ marginTop: 16 }}>
          <h2 className="title" style={{ margin: 0, marginBottom: 12 }}>
            {editId ? "Editar Perfil" : "Novo Perfil"}
          </h2>
          <form className="form" onSubmit={salvarPerfil}>
            <label htmlFor="perfil-nome">Nome do perfil</label>
            <input
              id="perfil-nome"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder='Ex.: "Supervisor", "RH", "Financeiro"'
              maxLength={100}
              required
            />

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
              <input
                id="perfil-ativo"
                type="checkbox"
                checked={!!form.ativo}
                onChange={(e) => setForm({ ...form, ativo: e.target.checked ? 1 : 0 })}
              />
              <label htmlFor="perfil-ativo">Ativo</label>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button type="button" className="toggle-btn" onClick={fecharForm}>
                Cancelar
              </button>
              <button type="submit" className="toggle-btn" disabled={loading}>
                {loading ? "Salvando..." : editId ? "Salvar alterações" : "Criar perfil"}
              </button>
            </div>

            <small style={{ color: "var(--muted)", display: "block", marginTop: 12 }}>
              Observação: o perfil <strong>Administrador</strong> é base do sistema, não pode ser excluído e a empresa nunca pode
              ficar sem pelo menos um usuário com esse perfil.
            </small>
          </form>
        </div>
      )}
    </>
  );
}
