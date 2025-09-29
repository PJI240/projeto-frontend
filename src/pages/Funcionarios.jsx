// src/pages/Funcionarios.jsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE?.replace(/\/+$/, "") || "";

/** ícones simples */
function PlusIcon(props) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path d="M19 11H13V5h-2v6H5v2h6v6h2v-6h6z" />
    </svg>
  );
}
function TrashIcon(props) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path d="M6 7h12v13H6zM8 4h8l1 2H7l1-2z" />
    </svg>
  );
}
function EditIcon(props) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
    </svg>
  );
}
function RefreshIcon(props) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path d="M17.65 6.35A7.95 7.95 0 0012 4 8 8 0 104 12h2a6 6 0 1110.24 3.66L14 13v7h7l-2.35-2.35A7.96 7.96 0 0020 12c0-2.21-.9-4.2-2.35-5.65z" />
    </svg>
  );
}

const REGIMES = ["HORISTA", "DIARISTA", "MENSALISTA"];

const EMPTY_FORM = {
  id: null,
  pessoa_id: "",
  cargo_id: "",
  regime: "MENSALISTA",
  salario_base: "",
  valor_hora: "",
  ativo: 1,
};

export default function Funcionarios() {
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("");

  // opções de selects
  const [pessoas, setPessoas] = useState([]);
  const [cargos, setCargos] = useState([]);
  const [loadingOpts, setLoadingOpts] = useState(true);

  function setField(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function fetchJSON(url, init = {}) {
    const r = await fetch(url, { credentials: "include", ...init });
    const data = await r.json().catch(() => null);
    if (!r.ok || data?.ok === false) {
      const msg = data?.error || `HTTP ${r.status}`;
      throw new Error(msg);
    }
    return data;
  }

  async function carregarLista() {
    setLoading(true);
    setErr("");
    try {
      const data = await fetchJSON(`${API_BASE}/api/funcionarios`);
      setLista(data.funcionarios || []);
    } catch (e) {
      setErr(e.message || "Falha ao listar funcionários.");
    } finally {
      setLoading(false);
    }
  }

  async function carregarOpcoes() {
    setLoadingOpts(true);
    try {
      const [p, c] = await Promise.all([
        fetchJSON(`${API_BASE}/api/pessoas`), // já retorna pessoas da empresa do usuário
        fetchJSON(`${API_BASE}/api/cargos`),
      ]);
      setPessoas(p.pessoas || []);
      setCargos(c.cargos || []);
    } catch (e) {
      console.error("LOAD_OPTS_ERR", e);
      setErr("Falha ao carregar opções de pessoas/cargos.");
    } finally {
      setLoadingOpts(false);
    }
  }

  useEffect(() => {
    carregarOpcoes();
    carregarLista();
  }, []);

  const filtrados = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return lista;
    return (lista || []).filter((f) => {
      const nome = (f.pessoa_nome || "").toLowerCase();
      const cargo = (f.cargo_nome || "").toLowerCase();
      return nome.includes(q) || cargo.includes(q);
    });
  }, [filter, lista]);

  function novo() {
    setErr("");
    setForm(EMPTY_FORM);
  }

  function editar(item) {
    setErr("");
    setForm({
      id: item.id,
      pessoa_id: item.pessoa_id,
      cargo_id: item.cargo_id,
      regime: item.regime || "MENSALISTA",
      salario_base: item.salario_base ?? "",
      valor_hora: item.valor_hora ?? "",
      ativo: item.ativo ? 1 : 0,
    });
  }

  async function salvar(e) {
    e?.preventDefault?.();
    setErr("");
    setSaving(true);
    try {
      // validações mínimas
      if (!String(form.pessoa_id || "").trim()) throw new Error("Selecione uma pessoa.");
      if (!String(form.cargo_id || "").trim()) throw new Error("Selecione um cargo.");
      if (!REGIMES.includes(String(form.regime))) throw new Error("Regime inválido.");

      const payload = {
        pessoa_id: Number(form.pessoa_id),
        cargo_id: Number(form.cargo_id),
        regime: form.regime,
        salario_base: form.salario_base === "" ? null : Number(form.salario_base),
        valor_hora: form.valor_hora === "" ? null : Number(form.valor_hora),
        ativo: form.ativo ? 1 : 0,
      };

      if (!form.id) {
        await fetchJSON(`${API_BASE}/api/funcionarios`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
      } else {
        await fetchJSON(`${API_BASE}/api/funcionarios/${form.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
      }
      await carregarLista();
      setForm(EMPTY_FORM);
    } catch (e) {
      setErr(e.message || "Falha ao salvar funcionário.");
    } finally {
      setSaving(false);
    }
  }

  async function excluir(item) {
    if (!window.confirm(`Remover vínculo de ${item.pessoa_nome}?`)) return;
    setErr("");
    try {
      await fetchJSON(`${API_BASE}/api/funcionarios/${item.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      await carregarLista();
      // se estava editando o mesmo, limpa o form
      if (form.id === item.id) setForm(EMPTY_FORM);
    } catch (e) {
      setErr(e.message || "Falha ao excluir funcionário.");
    }
  }

  return (
    <>
      <header className="main-header">
        <div className="header-content">
          <h1>Funcionários</h1>
          <p>Vínculo de pessoas a cargos dentro da sua empresa.</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="refresh-btn" onClick={carregarLista} disabled={loading}>
            <RefreshIcon />
            {loading ? "Atualizando..." : "Atualizar"}
          </button>
          <button className="toggle-btn" onClick={novo} title="Novo vínculo">
            <PlusIcon /> Novo
          </button>
        </div>
      </header>

      {err && (
        <div className="error-alert" role="alert" style={{ marginBottom: 12 }}>
          {err}
        </div>
      )}

      {/* Formulário */}
      <section style={{ marginBottom: 16 }}>
        <form className="form" onSubmit={salvar} aria-labelledby="form-func">
          <h2 id="form-func" className="title" style={{ margin: 0 }}>
            {form.id ? "Editar Funcionário" : "Novo Funcionário"}
          </h2>

        {/* Pessoa */}
          <label htmlFor="f_pessoa">Pessoa</label>
          <select
            id="f_pessoa"
            value={form.pessoa_id}
            onChange={(e) => setField("pessoa_id", e.target.value)}
            disabled={loadingOpts}
          >
            <option value="">Selecione…</option>
            {pessoas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome} {p.cpf ? `— ${p.cpf}` : ""}
              </option>
            ))}
          </select>

          {/* Cargo */}
          <label htmlFor="f_cargo">Cargo</label>
          <select
            id="f_cargo"
            value={form.cargo_id}
            onChange={(e) => setField("cargo_id", e.target.value)}
            disabled={loadingOpts}
          >
            <option value="">Selecione…</option>
            {cargos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>

          <label htmlFor="f_regime">Regime</label>
          <select
            id="f_regime"
            value={form.regime}
            onChange={(e) => setField("regime", e.target.value)}
          >
            {REGIMES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          <label htmlFor="f_sal">Salário base</label>
          <input
            id="f_sal"
            type="number"
            step="0.01"
            value={form.salario_base}
            onChange={(e) => setField("salario_base", e.target.value)}
            placeholder="3029.00"
          />

          <label htmlFor="f_vh">Valor hora</label>
          <input
            id="f_vh"
            type="number"
            step="0.01"
            value={form.valor_hora}
            onChange={(e) => setField("valor_hora", e.target.value)}
            placeholder="Ex.: 18.50"
          />

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              id="f_ativo"
              type="checkbox"
              checked={!!form.ativo}
              onChange={(e) => setField("ativo", e.target.checked ? 1 : 0)}
            />
            <label htmlFor="f_ativo">Ativo</label>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" className="toggle-btn" disabled={saving}>
              {saving ? "Salvando..." : form.id ? "Salvar alterações" : "Cadastrar"}
            </button>
            <button
              type="button"
              className="toggle-btn"
              onClick={() => setForm(EMPTY_FORM)}
              disabled={saving}
            >
              Cancelar
            </button>
          </div>

          <small className="register-link">
            Precisa cadastrar uma <strong>pessoa</strong> ou um <strong>cargo</strong> antes?
            &nbsp;<Link to="/pessoas">Pessoas</Link>&nbsp;•&nbsp;<Link to="/cargos">Cargos</Link>
          </small>
        </form>
      </section>

      {/* Filtro + Tabela */}
      <section>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h2 className="title" style={{ margin: 0, fontSize: "var(--fs-18)" }}>Lista</h2>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filtrar por nome/cargo…"
            aria-label="Filtrar funcionários por nome ou cargo"
            style={{ padding: "8px 10px", border: "1px solid var(--border)", borderRadius: "8px" }}
          />
        </div>

        <div style={{
          overflowX: "auto",
          background: "var(--panel)",
          border: "1px solid var(--border)",
          borderRadius: "12px",
        }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--panel-muted)" }}>
                <th style={th}>Pessoa</th>
                <th style={th}>Cargo</th>
                <th style={th}>Regime</th>
                <th style={th}>Salário base</th>
                <th style={th}>Valor hora</th>
                <th style={th}>Ativo</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={td}>Carregando…</td></tr>
              ) : filtrados.length === 0 ? (
                <tr><td colSpan={7} style={td}>Nenhum funcionário encontrado.</td></tr>
              ) : (
                filtrados.map((f) => (
                  <tr key={f.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={td}>{f.pessoa_nome}</td>
                    <td style={td}>{f.cargo_nome}</td>
                    <td style={td}>{f.regime}</td>
                    <td style={td}>{formatMoney(f.salario_base)}</td>
                    <td style={td}>{formatMoney(f.valor_hora)}</td>
                    <td style={td}>{f.ativo ? "Sim" : "Não"}</td>
                    <td style={tdActions}>
                      <button className="toggle-btn" onClick={() => editar(f)} title="Editar">
                        <EditIcon />
                      </button>
                      <button className="toggle-btn" onClick={() => excluir(f)} title="Excluir">
                        <TrashIcon />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

/* ===== helpers visuais ===== */
const th = { textAlign: "left", padding: "12px", fontWeight: 600, color: "var(--fg)", borderBottom: "1px solid var(--border)" };
const td = { padding: "10px 12px", color: "var(--fg)" };
const tdActions = { ...td, display: "flex", gap: 6, justifyContent: "flex-end" };

function formatMoney(v) {
  if (v == null || v === "") return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}