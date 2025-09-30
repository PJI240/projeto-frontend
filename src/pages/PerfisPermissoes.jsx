// src/pages/PerfisPermissoes.jsx
import { useEffect, useMemo, useState, useCallback } from "react";
import {
  ShieldCheckIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";

const API_BASE = import.meta.env.VITE_API_BASE?.replace(/\/+$/, "") || "";

const API = {
  perfis: `${API_BASE}/api/perfis`,
  permissoes: `${API_BASE}/api/permissoes`,
  getPerfilPerms: (id) => `${API_BASE}/api/perfis-permissoes?perfil_id=${id}`,
  syncPerfilPerms: `${API_BASE}/api/perfis-permissoes/sync`,
};

export default function PerfisPermissoes() {
  const [perfis, setPerfis] = useState([]);
  const [permissoes, setPermissoes] = useState([]);
  const [perfilId, setPerfilId] = useState(null);

  const [selecionadas, setSelecionadas] = useState(new Set()); // ids de permissões
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [okMsg, setOkMsg] = useState("");

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

  // carrega perfis + permissões
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
        // seleciona primeiro perfil automaticamente
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
  }, [fetchJson]); // perfilId setado depois

  // carrega permissões do perfil atual
  useEffect(() => {
    if (!perfilId) return;
    let cancel = false;
    async function loadPerfilPerms() {
      setFetching(true);
      setErr("");
      setOkMsg("");
      try {
        const data = await fetchJson(API.getPerfilPerms(perfilId));
        if (cancel) return;
        const ids = new Set((data.ids || []).map(Number));
        setSelecionadas(ids);
      } catch (e) {
        if (!cancel) setErr(e.message || "Falha ao carregar permissões do perfil.");
      } finally {
        if (!cancel) setFetching(false);
      }
    }
    loadPerfilPerms();
    return () => { cancel = true; };
  }, [perfilId, fetchJson]);

  // agrupamento por escopo (ex.: "cadastros", "operacao", etc.)
  const grupos = useMemo(() => {
    const map = new Map();
    for (const p of permissoes) {
      const g = (p.escopo || "geral").toLowerCase();
      if (!map.has(g)) map.set(g, []);
      map.get(g).push(p);
    }
    // ordena por codigo dentro de cada grupo
    for (const [k, arr] of map) {
      arr.sort((a, b) => String(a.codigo).localeCompare(String(b.codigo)));
      map.set(k, arr);
    }
    return map;
  }, [permissoes]);

  function togglePerm(id) {
    setSelecionadas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function marcarGrupo(escopo, marca = true) {
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
    setOkMsg("");
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
      setOkMsg("Permissões atualizadas com sucesso.");
    } catch (e) {
      setErr(e.message || "Falha ao salvar permissões.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <header className="main-header">
        <div className="header-content">
          <h1>Perfis × Permissões</h1>
          <p>Defina o que cada perfil pode visualizar e operar no sistema.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="refresh-btn"
            onClick={() => perfilId && setPerfilId(perfilId)} // recarrega apenas as permissões do perfil atual
            disabled={fetching || loading}
            aria-busy={fetching || loading}
            title="Recarregar"
          >
            <ArrowPathIcon className={`icon-sm ${fetching || loading ? "animate-spin" : ""}`} />
            Recarregar
          </button>
          <button
            className="toggle-btn"
            onClick={salvar}
            disabled={saving || !perfilId}
            aria-busy={saving ? "true" : "false"}
          >
            <ShieldCheckIcon className="icon-sm" />
            {saving ? "Salvando..." : "Salvar alterações"}
          </button>
        </div>
      </header>

      {err && (
        <div className="error-alert" role="alert">
          <XCircleIcon className="icon-sm" />
          <span>{err}</span>
        </div>
      )}
      {okMsg && (
        <div className="error-alert" role="status" style={{ background: "#ecfdf5", color: "var(--success)", borderColor: "#bbf7d0" }}>
          <CheckCircleIcon className="icon-sm" />
          <span>{okMsg}</span>
        </div>
      )}

      <section className="container" aria-busy={loading ? "true" : "false"}>
        {/* Seletor de perfil */}
        <div className="form" style={{ marginBottom: 16 }}>
          <label htmlFor="perfil_sel">Perfil</label>
          <select
            id="perfil_sel"
            value={perfilId || ""}
            onChange={(e) => setPerfilId(Number(e.target.value))}
            disabled={loading || !perfis.length}
            style={{ padding: "10px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}
          >
            {!perfis.length && <option value="">Carregando...</option>}
            {perfis.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome} {p.ativo ? "" : "(inativo)"}
              </option>
            ))}
          </select>
        </div>

        {/* Ações rápidas */}
        <div className="toggles" style={{ marginBottom: 12, flexWrap: "wrap" }}>
          <button className="toggle-btn" onClick={() => marcarTudo(true)} disabled={!perfilId || fetching}>
            Marcar tudo
          </button>
          <button className="toggle-btn" onClick={() => marcarTudo(false)} disabled={!perfilId || fetching}>
            Limpar tudo
          </button>
        </div>

        {/* Grid por grupos/escopos */}
        <div className="actions-grid">
          {Array.from(grupos.keys()).map((escopo) => {
            const itens = grupos.get(escopo) || [];
            const total = itens.length;
            const marcadasNoGrupo = itens.filter((p) => selecionadas.has(p.id)).length;
            const all = marcadasNoGrupo === total && total > 0;
            const some = marcadasNoGrupo > 0 && marcadasNoGrupo < total;

            return (
              <article key={escopo} className="stat-card" data-accent={all ? "success" : some ? "info" : "warning"}>
                <div className="stat-header">
                  <div className="stat-title" style={{ textTransform: "uppercase", letterSpacing: ".04em" }}>
                    {escopo}
                  </div>
                  <div className="toggles">
                    <button className="toggle-btn" onClick={() => marcarGrupo(escopo, true)} disabled={!perfilId || fetching}>
                      Marcar
                    </button>
                    <button className="toggle-btn" onClick={() => marcarGrupo(escopo, false)} disabled={!perfilId || fetching}>
                      Limpar
                    </button>
                  </div>
                </div>

                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
                  {itens.map((perm) => {
                    const checked = selecionadas.has(perm.id);
                    return (
                      <li key={perm.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <input
                          id={`perm_${escopo}_${perm.id}`}
                          type="checkbox"
                          checked={checked}
                          onChange={() => togglePerm(perm.id)}
                          disabled={!perfilId || fetching}
                        />
                        <label
                          htmlFor={`perm_${escopo}_${perm.id}`}
                          style={{ cursor: "pointer", userSelect: "none" }}
                          title={perm.codigo}
                        >
                          {perm.codigo}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}
