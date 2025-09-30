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
  // Estados para gerenciamento de abas
  const [abaAtiva, setAbaAtiva] = useState("perfis"); // "perfis", "permissoes", "atribuicoes"

  return (
    <>
      <header className="main-header">
        <div className="header-content">
          <h1>Perfis e Permissões</h1>
          <p>Gerencie perfis de acesso e suas permissões no sistema.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button 
            className={`toggle-btn ${abaAtiva === "perfis" ? "active" : ""}`}
            onClick={() => setAbaAtiva("perfis")}
          >
            Perfis
          </button>
          <button 
            className={`toggle-btn ${abaAtiva === "permissoes" ? "active" : ""}`}
            onClick={() => setAbaAtiva("permissoes")}
          >
            Permissões
          </button>
          <button 
            className={`toggle-btn ${abaAtiva === "atribuicoes" ? "active" : ""}`}
            onClick={() => setAbaAtiva("atribuicoes")}
          >
            Atribuições
          </button>
        </div>
      </header>

      {abaAtiva === "perfis" && <AbaPerfis />}
      {abaAtiva === "permissoes" && <AbaPermissoes />}
      {abaAtiva === "atribuicoes" && <AbaAtribuicoes />}
    </>
  );
}

// Aba de Perfis
function AbaPerfis() {
  const [perfis, setPerfis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ nome: "", ativo: 1 });

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

  async function carregar() {
    setLoading(true);
    setErr("");
    try {
      const r = await fetch(API.perfis, { credentials: "include" });
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

  useEffect(() => { 
    carregar(); 
  }, []);

  async function salvar(e) {
    e?.preventDefault?.();
    setSaving(true);
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
      await carregar();
    } catch (e) {
      setErr(e.message || "Falha ao salvar perfil.");
    } finally {
      setSaving(false);
    }
  }

  async function excluir(p) {
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
      await carregar();
    } catch (e) {
      setErr(e.message || "Não foi possível excluir o perfil.");
    }
  }

  return (
    <>
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

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button className="toggle-btn" onClick={abrirNovo}>
          Novo Perfil
        </button>
        <button className="toggle-btn" onClick={carregar} disabled={loading}>
          {loading ? "Atualizando..." : "Atualizar"}
        </button>
      </div>

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
                  <th style={{ padding: 12, width: 160 }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {perfis.map((p) => {
                  const isAdmin = String(p.nome || "").trim().toLowerCase() === "administrador";
                  return (
                    <tr key={p.id} style={{ borderBottom: "1px solid var(--border)" }}>
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
                          onClick={() => excluir(p)}
                          disabled={isAdmin}
                        >
                          Excluir
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Drawer/ formulário */}
      {showForm && (
        <div className="stat-card" style={{ marginTop: 16 }}>
          <h2 className="title" style={{ margin: 0, marginBottom: 12 }}>
            {editId ? "Editar Perfil" : "Novo Perfil"}
          </h2>
          <form className="form" onSubmit={salvar}>
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
              <button type="submit" className="toggle-btn" disabled={saving}>
                {saving ? "Salvando..." : editId ? "Salvar alterações" : "Criar perfil"}
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

// Aba de Permissões
function AbaPermissoes() {
  const [permissoes, setPermissoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState("");
  const [filtro, setFiltro] = useState("");

  async function carregar() {
    setLoading(true);
    setErr("");
    try {
      const r = await fetch(API.permissoes, { credentials: "include" });
      const data = await r.json().catch(() => null);
      if (!r.ok || !data?.ok) throw new Error(data?.error || `HTTP ${r.status}`);
      setPermissoes(data.permissoes || []);
    } catch (e) {
      console.error("PERMISSOES_LOAD_ERR", e);
      setErr(e.message || "Falha ao carregar permissões.");
    } finally {
      setLoading(false);
    }
  }

  async function sincronizar() {
    setSyncing(true);
    setErr(""); 
    setSuccess("");
    try {
      const r = await fetch(API.syncPerms, {
        method: "POST",
        credentials: "include",
      });
      const data = await r.json().catch(() => null);
      if (!r.ok || !data?.ok) throw new Error(data?.error || "Falha ao sincronizar permissões.");
      setSuccess(`Sincronizado: ${data.upserted ?? 0} atualizadas/criadas.`);
      await carregar();
    } catch (e) {
      setErr(e.message || "Erro ao sincronizar permissões.");
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => { 
    carregar(); 
  }, []);

  const listaFiltrada = useMemo(() => {
    const f = filtro.trim().toLowerCase();
    if (!f) return permissoes;
    return permissoes.filter(p =>
      String(p.codigo || "").toLowerCase().includes(f) ||
      String(p.descricao || "").toLowerCase().includes(f)
    );
  }, [filtro, permissoes]);

  return (
    <>
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

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button className="toggle-btn" onClick={sincronizar} disabled={syncing}>
          {syncing ? "Sincronizando..." : "Sincronizar Permissões"}
        </button>
        <button className="toggle-btn" onClick={carregar} disabled={loading}>
          {loading ? "Atualizando..." : "Atualizar"}
        </button>
      </div>

      <div style={{ marginBottom: 12, display: "flex", gap: 8 }}>
        <input
          placeholder="Buscar por código ou descrição…"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          style={{ flex: 1, padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border)" }}
        />
        <button className="toggle-btn" onClick={() => setFiltro("")}>
          Limpar
        </button>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: "1fr" }}>
        <div className="stat-card" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: 16, color: "var(--muted)" }}>Carregando…</div>
          ) : listaFiltrada.length === 0 ? (
            <div style={{ padding: 16, color: "var(--muted)" }}>
              Nenhuma permissão encontrada.
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                  <th style={{ padding: 12 }}>Código</th>
                  <th style={{ padding: 12 }}>Descrição</th>
                  <th style={{ padding: 12 }}>Escopo</th>
                </tr>
              </thead>
              <tbody>
                {listaFiltrada.map((p) => (
                  <tr key={p.id || p.codigo} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: 12, fontFamily: "monospace" }}>{p.codigo}</td>
                    <td style={{ padding: 12 }}>{p.descricao || "—"}</td>
                    <td style={{ padding: 12 }}>{p.escopo || "app"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div style={{ marginTop: 16, color: "var(--muted)", fontSize: "14px" }}>
        Dica: use o botão <strong>Sincronizar Permissões</strong> quando você alterar o menu/rotas do sistema para
        atualizar a lista de permissões automaticamente.
      </div>
    </>
  );
}

// Aba de Atribuições (Perfis × Permissões)
function AbaAtribuicoes() {
  const [perfis, setPerfis] = useState([]);
  const [permissoes, setPermissoes] = useState([]);
  const [perfilId, setPerfilId] = useState(null);
  const [selecionadas, setSelecionadas] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState("");

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

  // Carrega perfis + permissões
  useEffect(() => {
    let cancel = false;
    async function load() {
      setLoading(true);
      setErr("");
      try {
        const [pf, pm] = await Promise.all([
          fetchJson(API.perfis),
          fetchJson(API.permissoes),
        ]);
        if (cancel) return;
        setPerfis(pf.perfis || []);
        setPermissoes(pm.permissoes || []);
        // Seleciona primeiro perfil automaticamente
        if (!perfilId && (pf.perfis || []).length) {
          setPerfilId(pf.perfis[0].id);
        }
      } catch (e) {
        if (!cancel) setErr(e.message || "Falha ao carregar dados.");
      } finally {
        if (!cancel) setLoading(false);
      }
    }
    load();
    return () => { cancel = true; };
  }, [fetchJson]);

  // Carrega permissões do perfil atual
  useEffect(() => {
    if (!perfilId) return;
    let cancel = false;
    async function loadPerfilPerms() {
      setFetching(true);
      setErr("");
      setSuccess("");
      try {
        const data = await fetchJson(API.getPerfilPerms(perfilId));
        if (cancel) return;
        const ids = new Set((data.ids || []).map(Number));
        
        // Se for perfil Administrador, marca todas as permissões automaticamente
        const perfilAtual = perfis.find(p => p.id === perfilId);
        if (perfilAtual && perfilAtual.nome.toLowerCase() === "administrador") {
          const todasPermissoes = new Set(permissoes.map(p => p.id));
          setSelecionadas(todasPermissoes);
        } else {
          setSelecionadas(ids);
        }
      } catch (e) {
        if (!cancel) setErr(e.message || "Falha ao carregar permissões do perfil.");
      } finally {
        if (!cancel) setFetching(false);
      }
    }
    loadPerfilPerms();
    return () => { cancel = true; };
  }, [perfilId, fetchJson, perfis, permissoes]);

  // Agrupamento por escopo
  const grupos = useMemo(() => {
    const map = new Map();
    for (const p of permissoes) {
      const g = (p.escopo || "geral").toLowerCase();
      if (!map.has(g)) map.set(g, []);
      map.get(g).push(p);
    }
    // Ordena por código dentro de cada grupo
    for (const [k, arr] of map) {
      arr.sort((a, b) => String(a.codigo).localeCompare(String(b.codigo)));
      map.set(k, arr);
    }
    return map;
  }, [permissoes]);

  const perfilAtual = perfis.find(p => p.id === perfilId);
  const isAdmin = perfilAtual && perfilAtual.nome.toLowerCase() === "administrador";

  function togglePerm(id) {
    if (isAdmin) return; // Bloqueia alterações no perfil Administrador
    setSelecionadas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function marcarGrupo(escopo, marca = true) {
    if (isAdmin) return; // Bloqueia alterações no perfil Administrador
    const arr = grupos.get(escopo) || [];
    setSelecionadas((prev) => {
      const next = new Set(prev);
      for (const p of arr) {
        if (marca) next.add(p.id);
        else next.delete(p.id);
      }
      return next;
    });
  }

  function marcarTudo(marca = true) {
    if (isAdmin) return; // Bloqueia alterações no perfil Administrador
    if (marca) {
      setSelecionadas(new Set(permissoes.map((p) => p.id)));
    } else {
      setSelecionadas(new Set());
    }
  }

  async function salvar() {
    if (!perfilId) return;
    setSaving(true);
    setErr("");
    setSuccess("");
    try {
      const body = {
        perfil_id: Number(perfilId),
        ids: Array.from(selecionadas).map(Number),
      };
      await fetchJson(API.syncPerfilPerms, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      setSuccess("Permissões atualizadas com sucesso.");
    } catch (e) {
      setErr(e.message || "Falha ao salvar permissões.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
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

      <div style={{ marginBottom: 16 }}>
        <label htmlFor="perfil_sel" style={{ display: "block", marginBottom: 8 }}>Perfil</label>
        <select
          id="perfil_sel"
          value={perfilId || ""}
          onChange={(e) => setPerfilId(Number(e.target.value))}
          disabled={loading || !perfis.length}
          style={{ 
            padding: "10px 12px", 
            borderRadius: "8px", 
            border: "1px solid var(--border)",
            width: "100%",
            maxWidth: "300px"
          }}
        >
          {!perfis.length && <option value="">Carregando...</option>}
          {perfis.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome} {p.ativo ? "" : "(inativo)"}
            </option>
          ))}
        </select>
      </div>

      {isAdmin && (
        <div style={{ 
          background: "var(--panel-muted)", 
          padding: "12px 16px", 
          borderRadius: "8px", 
          border: "1px solid var(--border)",
          marginBottom: 16
        }}>
          <strong>Perfil Administrador:</strong> Este perfil possui todas as permissões automaticamente e não pode ser alterado.
        </div>
      )}

      {perfilId && !isAdmin && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <button className="toggle-btn" onClick={() => marcarTudo(true)} disabled={fetching}>
            Marcar Tudo
          </button>
          <button className="toggle-btn" onClick={() => marcarTudo(false)} disabled={fetching}>
            Limpar Tudo
          </button>
          <button className="toggle-btn" onClick={salvar} disabled={saving || fetching}>
            {saving ? "Salvando..." : "Salvar Alterações"}
          </button>
        </div>
      )}

      {perfilId && (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
          gap: 16 
        }}>
          {Array.from(grupos.keys()).map((escopo) => {
            const itens = grupos.get(escopo) || [];
            const total = itens.length;
            const marcadasNoGrupo = itens.filter((p) => selecionadas.has(p.id)).length;
            const todasMarcadas = marcadasNoGrupo === total && total > 0;

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
                  <h3 style={{ margin: 0, textTransform: 'capitalize' }}>
                    {escopo} ({marcadasNoGrupo}/{total})
                  </h3>
                  {!isAdmin && (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button 
                        className="toggle-btn" 
                        onClick={() => marcarGrupo(escopo, true)}
                        disabled={fetching || todasMarcadas}
                        style={{ padding: '4px 8px', fontSize: '12px' }}
                      >
                        Marcar
                      </button>
                      <button 
                        className="toggle-btn" 
                        onClick={() => marcarGrupo(escopo, false)}
                        disabled={fetching || marcadasNoGrupo === 0}
                        style={{ padding: '4px 8px', fontSize: '12px' }}
                      >
                        Limpar
                      </button>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {itens.map((perm) => {
                    const checked = selecionadas.has(perm.id);
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
                          onChange={() => togglePerm(perm.id)}
                          disabled={isAdmin || fetching}
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
      )}
    </>
  );
}
