import { useEffect, useMemo, useState } from "react";

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");

function isDev(roles = []) {
  return roles.map((r) => String(r || "").toLowerCase()).includes("desenvolvedor");
}

export default function Empresas() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // lista e seleção
  const [empresas, setEmpresas] = useState([]);
  const [filtro, setFiltro] = useState("");
  const [selectedId, setSelectedId] = useState(null);

  // form
  const [form, setForm] = useState({
    razao_social: "",
    nome_fantasia: "",
    cnpj: "",
    inscricao_estadual: "",
    data_abertura: "",
    telefone: "",
    email: "",
    capital_social: "",
    natureza_juridica: "",
    situacao_cadastral: "",
    data_situacao: "",
    socios_receita: "[]",
    ativa: 1,
  });
  const [editMode, setEditMode] = useState(false); // true: editando empresa existente
  const [creating, setCreating] = useState(false); // true: criando nova (dev only)

  const listaFiltrada = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    if (!q) return empresas;
    return empresas.filter((e) =>
      [e.razao_social, e.nome_fantasia, e.cnpj]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [empresas, filtro]);

  async function fetchJSON(url, init) {
    const r = await fetch(url, { credentials: "include", ...init });
    const data = await r.json().catch(() => null);
    if (!r.ok || data?.ok === false) {
      throw new Error(data?.error || `HTTP ${r.status}`);
    }
    return data;
  }

  async function carregar() {
    setLoading(true);
    setErr("");
    try {
      // 1) papéis
      const me = await fetchJSON(`${API_BASE}/api/auth/me`);
      setRoles(me.roles || []);

      // 2) lista de empresas conforme o papel
      const scope = isDev(me.roles) ? "all" : "mine";
      const li = await fetchJSON(`${API_BASE}/api/empresas?scope=${scope}`);
      const list = li.empresas || [];
      setEmpresas(list);

      // 3) decide seleção inicial (não-dev com 1 empresa já abre; dev só seleciona quando clicar)
      if (!isDev(me.roles)) {
        if (list.length === 1) {
          selecionarEmpresa(list[0].id);
        } else {
          // múltiplas: mostra seletor
          setSelectedId(null);
          setEditMode(false);
        }
      } else {
        setSelectedId(null);
        setEditMode(false);
      }
    } catch (e) {
      setErr(e.message || "Falha ao carregar empresas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function selecionarEmpresa(id) {
    setErr("");
    setCreating(false);
    setEditMode(false);
    setSelectedId(id);
    if (!id) return;

    try {
      setLoading(true);
      const d = await fetchJSON(`${API_BASE}/api/empresas/${id}`);
      const emp = d.empresa || {};
      setForm({
        razao_social: emp.razao_social || "",
        nome_fantasia: emp.nome_fantasia || "",
        cnpj: emp.cnpj || "",
        inscricao_estadual: emp.inscricao_estadual || "",
        data_abertura: emp.data_abertura || "",
        telefone: emp.telefone || "",
        email: emp.email || "",
        capital_social: emp.capital_social ?? "",
        natureza_juridica: emp.natureza_juridica || "",
        situacao_cadastral: emp.situacao_cadastral || "",
        data_situacao: emp.data_situacao || "",
        socios_receita: typeof emp.socios_receita === "string"
          ? emp.socios_receita
          : JSON.stringify(emp.socios_receita ?? []),
        ativa: emp.ativa ? 1 : 0,
      });
      setEditMode(true);
    } catch (e) {
      setErr(e.message || "Falha ao obter empresa.");
    } finally {
      setLoading(false);
    }
  }

  function novoEmpresaForm() {
    setErr("");
    setCreating(true);
    setEditMode(false);
    setSelectedId(null);
    setForm({
      razao_social: "",
      nome_fantasia: "",
      cnpj: "",
      inscricao_estadual: "",
      data_abertura: "",
      telefone: "",
      email: "",
      capital_social: "",
      natureza_juridica: "",
      situacao_cadastral: "",
      data_situacao: "",
      socios_receita: "[]",
      ativa: 1,
    });
  }

  async function salvar(e) {
    e?.preventDefault();
    setErr("");

    try {
      if (!form.razao_social.trim() || !form.cnpj.trim()) {
        throw new Error("Preencha ao menos Razão Social e CNPJ.");
      }

      const method = creating ? "POST" : "PUT";
      const url = creating
        ? `${API_BASE}/api/empresas`
        : `${API_BASE}/api/empresas/${selectedId}`;

      const payload = {
        ...form,
        // normalizações simples
        cnpj: String(form.cnpj).replace(/\D+/g, ""),
        socios_receita: form.socios_receita, // string JSON
      };

      const d = await fetchJSON(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (creating) {
        // após criar, recarrega lista e foca na nova
        await carregar();
        if (d?.id) selecionarEmpresa(d.id);
      } else {
        // só recarrega dados da atual
        await selecionarEmpresa(selectedId);
      }
    } catch (e) {
      setErr(e.message || "Falha ao salvar empresa.");
    }
  }

  return (
    <>
      <header className="main-header">
        <div className="header-content">
          <h1>Empresas</h1>
          <p>
            {isDev(roles)
              ? "Visualize e gerencie todas as empresas (desenvolvedor)."
              : "Dados da empresa vinculada à sua sessão."}
          </p>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          {isDev(roles) && (
            <>
              <input
                placeholder="Buscar por razão social, fantasia ou CNPJ…"
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border)" }}
              />
              <button className="toggle-btn" onClick={novoEmpresaForm}>Nova Empresa</button>
            </>
          )}
          <button className="toggle-btn" onClick={carregar} disabled={loading}>
            {loading ? "Atualizando…" : "Atualizar"}
          </button>
        </div>
      </header>

      {err && (
        <div className="error-alert" role="alert" style={{ marginBottom: 16 }}>
          {err}
        </div>
      )}

      {/* Desenvolvedor: lista todas + clique para editar */}
      {isDev(roles) && !creating && !editMode && (
        <div className="stats-grid" style={{ gridTemplateColumns: "1fr" }}>
          <div className="stat-card" style={{ padding: 0 }}>
            {loading ? (
              <div style={{ padding: 16, color: "var(--muted)" }}>Carregando…</div>
            ) : listaFiltrada.length === 0 ? (
              <div style={{ padding: 16, color: "var(--muted)" }}>Nenhuma empresa encontrada.</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                    <th style={{ padding: 12 }}>Razão Social</th>
                    <th style={{ padding: 12 }}>Nome Fantasia</th>
                    <th style={{ padding: 12 }}>CNPJ</th>
                    <th style={{ padding: 12, width: 150 }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {listaFiltrada.map((e) => (
                    <tr key={e.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: 12 }}>{e.razao_social}</td>
                      <td style={{ padding: 12 }}>{e.nome_fantasia || "—"}</td>
                      <td style={{ padding: 12 }}>{e.cnpj}</td>
                      <td style={{ padding: 12 }}>
                        <button className="toggle-btn" onClick={() => selecionarEmpresa(e.id)}>
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Não-dev: se múltiplas empresas, permite escolher qual editar */}
      {!isDev(roles) && empresas.length > 1 && !editMode && !creating && (
        <div className="stat-card">
          <h2 className="title" style={{ margin: 0, marginBottom: 12 }}>Selecione a empresa</h2>
          <select
            value={selectedId || ""}
            onChange={(e) => selecionarEmpresa(Number(e.target.value))}
            style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border)" }}
          >
            <option value="">— Selecione —</option>
            {empresas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.razao_social} — {e.cnpj}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Formulário (criando ou editando) */}
      {(creating || editMode) && (
        <div className="stat-card" style={{ marginTop: 16 }}>
          <h2 className="title" style={{ margin: 0, marginBottom: 12 }}>
            {creating ? "Nova Empresa" : "Dados da Empresa"}
          </h2>

          <form className="form" onSubmit={salvar}>
            <label htmlFor="razao_social">Razão Social</label>
            <input
              id="razao_social"
              value={form.razao_social}
              onChange={(e) => setForm({ ...form, razao_social: e.target.value })}
              required
            />

            <label htmlFor="nome_fantasia">Nome Fantasia</label>
            <input
              id="nome_fantasia"
              value={form.nome_fantasia}
              onChange={(e) => setForm({ ...form, nome_fantasia: e.target.value })}
            />

            <label htmlFor="cnpj">CNPJ</label>
            <input
              id="cnpj"
              value={form.cnpj}
              onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
              disabled={!creating} // no edit, mantemos CNPJ travado
            />

            <label htmlFor="insc_est">Inscrição Estadual</label>
            <input
              id="insc_est"
              value={form.inscricao_estadual}
              onChange={(e) => setForm({ ...form, inscricao_estadual: e.target.value })}
            />

            <label htmlFor="data_abertura">Data de Abertura</label>
            <input
              id="data_abertura"
              type="date"
              value={form.data_abertura || ""}
              onChange={(e) => setForm({ ...form, data_abertura: e.target.value })}
            />

            <label htmlFor="telefone">Telefone</label>
            <input
              id="telefone"
              value={form.telefone}
              onChange={(e) => setForm({ ...form, telefone: e.target.value })}
            />

            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />

            <label htmlFor="capital_social">Capital Social</label>
            <input
              id="capital_social"
              inputMode="decimal"
              value={form.capital_social}
              onChange={(e) => setForm({ ...form, capital_social: e.target.value })}
            />

            <label htmlFor="natureza_juridica">Natureza Jurídica</label>
            <input
              id="natureza_juridica"
              value={form.natureza_juridica}
              onChange={(e) => setForm({ ...form, natureza_juridica: e.target.value })}
            />

            <label htmlFor="situacao_cadastral">Situação Cadastral</label>
            <input
              id="situacao_cadastral"
              value={form.situacao_cadastral}
              onChange={(e) => setForm({ ...form, situacao_cadastral: e.target.value })}
            />

            <label htmlFor="data_situacao">Data da Situação</label>
            <input
              id="data_situacao"
              type="date"
              value={form.data_situacao || ""}
              onChange={(e) => setForm({ ...form, data_situacao: e.target.value })}
            />

            {/* JSON de sócios (texto bruto para manter simples) */}
            <label htmlFor="socios_receita">Sócios (JSON Receita)</label>
            <textarea
              id="socios_receita"
              rows={3}
              value={form.socios_receita}
              onChange={(e) => setForm({ ...form, socios_receita: e.target.value })}
              style={{ padding: "12px", borderRadius: "12px", border: "1px solid var(--border)" }}
            />

            <label htmlFor="ativa" style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                id="ativa"
                type="checkbox"
                checked={!!form.ativa}
                onChange={(e) => setForm({ ...form, ativa: e.target.checked ? 1 : 0 })}
              />
              Empresa ativa
            </label>

            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button
                type="button"
                className="toggle-btn"
                onClick={() => {
                  setCreating(false);
                  setEditMode(false);
                  setSelectedId(null);
                }}
              >
                Cancelar
              </button>
              <button type="submit" className="toggle-btn">
                {creating ? "Criar Empresa" : "Salvar Alterações"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
