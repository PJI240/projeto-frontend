// src/pages/Permissoes.jsx
import { useEffect, useMemo, useState } from "react";
import {
  ArrowPathIcon,
  FunnelIcon,
  BoltIcon,
} from "@heroicons/react/24/outline";

const API_BASE = import.meta.env.VITE_API_BASE?.replace(/\/+$/, "") || "";

export default function Permissoes() {
  const [permissoes, setPermissoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState("");
  const [q, setQ] = useState("");

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const r = await fetch(`${API_BASE}/api/permissoes`, { credentials: "include" });
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

  async function sync() {
    setSyncing(true);
    setErr(""); setSuccess("");
    try {
      const r = await fetch(`${API_BASE}/api/permissoes/sync`, {
        method: "POST",
        credentials: "include",
      });
      const data = await r.json().catch(() => null);
      if (!r.ok || !data?.ok) throw new Error(data?.error || "Falha ao sincronizar permissões.");
      setSuccess(`Sincronizado: ${data.upserted ?? 0} atualizadas/criadas.`);
      await load();
    } catch (e) {
      setErr(e.message || "Erro ao sincronizar permissões.");
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return permissoes;
    return permissoes.filter(p =>
      String(p.codigo || "").toLowerCase().includes(term) ||
      String(p.descricao || "").toLowerCase().includes(term)
    );
  }, [q, permissoes]);

  return (
    <>
      <header className="main-header">
        <div className="header-content">
          <h1>Permissões</h1>
          <p>Lista canônica de permissões (gerada pelo sistema). Atribuições são feitas em <strong>Perfis × Permissões</strong>.</p>
        </div>

        <div className="toggles">
          <button
            className="toggle-btn"
            onClick={load}
            disabled={loading}
            title="Atualizar"
            aria-busy={loading ? "true" : "false"}
          >
            <ArrowPathIcon className={`icon-sm ${loading ? "animate-spin" : ""}`} />
            {loading ? "Atualizando..." : "Atualizar"}
          </button>
          <button
            className="toggle-btn"
            onClick={sync}
            disabled={syncing}
            title="Sincronizar com registro interno"
          >
            <BoltIcon className="icon-sm" />
            {syncing ? "Sincronizando..." : "Sincronizar"}
          </button>
        </div>
      </header>

      {err && <div className="error-alert" role="alert" style={{ marginBottom: 16 }}>{err}</div>}
      {success && <div className="success-alert" role="status" style={{ marginBottom: 16 }}>{success}</div>}

      <section style={{ marginBottom: 12 }}>
        <div className="card" style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <FunnelIcon className="icon-sm" />
          <input
            aria-label="Filtrar permissões"
            placeholder="Filtrar por código ou descrição…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ flex: 1, padding: "10px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}
          />
          <button className="toggle-btn" onClick={() => setQ("")}>Limpar</button>
        </div>
      </section>

      <section>
        <div className="card">
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: "36%" }}>Código</th>
                  <th style={{ width: "44%" }}>Descrição</th>
                  <th style={{ width: "20%" }}>Escopo</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={3}>Carregando…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={3}>Nenhuma permissão encontrada.</td></tr>
                ) : (
                  filtered.map((p) => (
                    <tr key={p.id || p.codigo}>
                      <td><code>{p.codigo}</code></td>
                      <td>{p.descricao || "-"}</td>
                      <td>{p.escopo || "app"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p style={{ marginTop: 8, color: "var(--muted)", fontSize: "var(--fs-14)" }}>
            Dica: use o botão <strong>Sincronizar</strong> quando você alterar o menu/rotas do sistema para
            atualizar a lista de permissões automaticamente.
          </p>
        </div>
      </section>
    </>
  );
}
