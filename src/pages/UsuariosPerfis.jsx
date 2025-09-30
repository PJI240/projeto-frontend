// src/pages/UsuariosPerfis.jsx
import { useEffect, useMemo, useState, useCallback } from "react";
import { CheckCircleIcon, XCircleIcon, ArrowPathIcon, ShieldCheckIcon, UserGroupIcon } from "@heroicons/react/24/outline";

const API_BASE = import.meta.env.VITE_API_BASE?.replace(/\/+$/, "") || "";

export default function UsuariosPerfis() {
  const [users, setUsers] = useState([]);
  const [perfis, setPerfis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState("");
  const [savingId, setSavingId] = useState(null);

  const fetchJson = useCallback(async (url, init) => {
    const r = await fetch(url, { credentials: "include", ...init });
    let data = null;
    try { data = await r.json(); } catch {}
    if (!r.ok || data?.ok === false) {
      const msg = data?.error || `HTTP ${r.status}`;
      throw new Error(msg);
    }
    return data;
  }, []);

  async function loadAll() {
    setLoading(true);
    setErr("");
    try {
      const [u, p] = await Promise.all([
        fetchJson(`${API_BASE}/api/usuarios`), // lista usuários da empresa
        fetchJson(`${API_BASE}/api/perfis`),   // lista perfis da empresa
      ]);
      setUsers(u.usuarios || []);
      setPerfis(p.perfis || []);
    } catch (e) {
      console.error("LOAD_USUARIOS_PERFIS_ERR", e);
      setErr(e.message || "Falha ao carregar dados.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []); // eslint-disable-line

  const usersFiltered = useMemo(() => {
    const t = filter.trim().toLowerCase();
    if (!t) return users;
    return users.filter(u =>
      u.nome?.toLowerCase().includes(t) ||
      u.email?.toLowerCase().includes(t) ||
      u.pessoa_nome?.toLowerCase().includes(t)
    );
  }, [users, filter]);

  async function saveUserPerfil(u, novoPerfilId) {
    setErr("");
    setSavingId(u.id);
    try {
      // PUT /api/usuarios/:id exige nome/email/ativo + perfil_id
      const body = {
        nome: u.nome,
        email: u.email,
        ativo: u.ativo ? 1 : 0,
        perfil_id: Number(novoPerfilId),
      };
      await fetchJson(`${API_BASE}/api/usuarios/${u.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      // atualizar em memória
      setUsers(prev =>
        prev.map(x => (x.id === u.id ? { ...x, perfil_id: Number(novoPerfilId), perfil_nome: perfis.find(p => p.id === Number(novoPerfilId))?.nome || x.perfil_nome } : x))
      );
    } catch (e) {
      console.error("SAVE_PERFIL_ERR", e);
      setErr(e.message || "Falha ao salvar perfil do usuário.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <>
      <header className="main-header">
        <div className="header-content">
          <h1 style={{ display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
            <ShieldCheckIcon className="icon-sm" aria-hidden="true" />
            Usuários × Perfis
          </h1>
          <p>Defina o <strong>perfil principal</strong> de cada usuário na empresa atual.</p>
        </div>
        <button className="refresh-btn" onClick={loadAll} disabled={loading} aria-busy={loading ? "true" : "false"}>
          <ArrowPathIcon className={`icon-sm ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
          {loading ? "Atualizando..." : "Atualizar"}
        </button>
      </header>

      {err && (
        <div className="error-alert" role="alert">
          <XCircleIcon className="icon-sm" aria-hidden="true" />
          <span>{err}</span>
        </div>
      )}

      <section className="container" style={{ padding: 0, marginBottom: 16 }}>
        <div className="form" style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
          <label htmlFor="filtro" style={{ minWidth: 64, margin: 0 }}>Filtrar</label>
          <input
            id="filtro"
            placeholder="Nome, e-mail ou pessoa…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ maxWidth: 420 }}
          />
        </div>
      </section>

      <section>
        <div className="stats-grid" style={{ gridTemplateColumns: "1fr" }}>
          <article className="stat-card" data-accent="info">
            <div className="stat-header">
              <div className="stat-icon" aria-hidden="true">
                <UserGroupIcon className="stat-icon-svg" />
              </div>
              <span className="stat-trend">{users.length} usuários</span>
            </div>
            <div className="stat-content">
              <div className="stat-title">Perfis disponíveis: {perfis.length}</div>
            </div>
          </article>
        </div>

        {/* Tabela simples */}
        <div style={{ overflowX: "auto", background: "var(--panel)", borderRadius: 12, border: "1px solid var(--border)" }}>
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
            <thead>
              <tr style={{ background: "var(--panel-muted)" }}>
                <Th>Usuário</Th>
                <Th>E-mail</Th>
                <Th>Pessoa</Th>
                <Th>Perfil Atual</Th>
                <Th>Alterar Perfil</Th>
                <Th>Ações</Th>
              </tr>
            </thead>
            <tbody>
              {usersFiltered.map((u) => (
                <tr key={u.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <Td>
                    <div style={{ fontWeight: 600 }}>{u.nome}</div>
                    <div style={{ fontSize: "var(--fs-12)", color: "var(--muted)" }}>
                      {u.ativo ? "Ativo" : "Inativo"} • ID {u.id}
                    </div>
                  </Td>
                  <Td>{u.email}</Td>
                  <Td>
                    {u.pessoa_nome ? (
                      <>
                        <div>{u.pessoa_nome}</div>
                        {u.pessoa_cpf && <div style={{ fontSize: "var(--fs-12)", color: "var(--muted)" }}>{u.pessoa_cpf}</div>}
                      </>
                    ) : (
                      <span style={{ color: "var(--muted)" }}>—</span>
                    )}
                  </Td>
                  <Td>
                    {u.perfil_nome ? (
                      <strong>{u.perfil_nome}</strong>
                    ) : (
                      <span style={{ color: "var(--muted)" }}>Sem perfil</span>
                    )}
                  </Td>
                  <Td>
                    <select
                      value={u.perfil_id || ""}
                      onChange={(e) => {
                        const novo = Number(e.target.value);
                        if (!novo) return;
                        saveUserPerfil(u, novo);
                      }}
                      disabled={savingId === u.id}
                      style={{
                        padding: "10px 12px",
                        border: "1px solid var(--border)",
                        borderRadius: "10px",
                        background: "#fff",
                        minWidth: 180,
                      }}
                    >
                      <option value="" disabled>
                        {savingId === u.id ? "Salvando…" : "Selecionar perfil…"}
                      </option>
                      {perfis.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nome}
                        </option>
                      ))}
                    </select>
                  </Td>
                  <Td>
                    <button
                      className="toggle-btn"
                      onClick={() => saveUserPerfil(u, u.perfil_id || (perfis[0]?.id ?? 0))}
                      disabled={!u.perfil_id || savingId === u.id}
                      title="Reaplicar perfil atual"
                    >
                      <CheckCircleIcon className="icon-sm" aria-hidden="true" />
                      Aplicar
                    </button>
                  </Td>
                </tr>
              ))}
              {!loading && usersFiltered.length === 0 && (
                <tr>
                  <Td colSpan={6}>
                    <span style={{ color: "var(--muted)" }}>Nenhum usuário encontrado.</span>
                  </Td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function Th({ children }) {
  return (
    <th
      style={{
        textAlign: "left",
        padding: "12px 16px",
        fontSize: "var(--fs-14)",
        color: "var(--muted)",
        fontWeight: 600,
        borderBottom: "1px solid var(--border)",
      }}
      scope="col"
    >
      {children}
    </th>
  );
}

function Td({ children, colSpan }) {
  return (
    <td
      colSpan={colSpan}
      style={{
        padding: "12px 16px",
        verticalAlign: "top",
      }}
    >
      {children}
    </td>
  );
}
