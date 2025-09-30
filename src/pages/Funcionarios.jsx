// src/pages/Funcionarios.jsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE?.replace(/\/+$/, "") || "";

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
  const [showForm, setShowForm] = useState(false);

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

  function abrirNovo() {
    setErr("");
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function abrirEdicao(item) {
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
    setShowForm(true);
  }

  function fecharForm() {
    setShowForm(false);
    setForm(EMPTY_FORM);
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
      fecharForm();
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
      if (form.id === item.id) fecharForm();
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
        <div style={{ display: "flex", gap: 8 }}>
          <button className="toggle-btn" onClick={abrirNovo}>
            Novo Funcionário
          </button>
          <button className="toggle-btn" onClick={carregarLista} disabled={loading}>
            {loading ? "Atualizando..." : "Atualizar"}
          </button>
        </div>
      </header>

      {err && (
        <div className="error-alert" role="alert" style={{ marginBottom: 16 }}>
          {err}
        </div>
      )}

      <div style={{ marginBottom: 12, display: "flex", gap: 8 }}>
        <input
          placeholder="Buscar por nome ou cargo…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ flex: 1, padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border)" }}
        />
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: "1fr" }}>
        <div className="stat-card" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: 16, color: "var(--muted)" }}>Carregando…</div>
          ) : filtrados.length === 0 ? (
            <div style={{ padding: 16, color: "var(--muted)" }}>
              Nenhum funcionário encontrado.
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                  <th style={{ padding: 12 }}>Pessoa</th>
                  <th style={{ padding: 12 }}>Cargo</th>
                  <th style={{ padding: 12 }}>Regime</th>
                  <th style={{ padding: 12 }}>Salário Base</th>
                  <th style={{ padding: 12 }}>Valor Hora</th>
                  <th style={{ padding: 12 }}>Ativo</th>
                  <th style={{ padding: 12, width: 160 }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((f) => (
                  <tr key={f.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: 12 }}>{f.pessoa_nome}</td>
                    <td style={{ padding: 12 }}>{f.cargo_nome}</td>
                    <td style={{ padding: 12 }}>{f.regime}</td>
                    <td style={{ padding: 12 }}>{formatMoney(f.salario_base)}</td>
                    <td style={{ padding: 12 }}>{formatMoney(f.valor_hora)}</td>
                    <td style={{ padding: 12 }}>{f.ativo ? "Sim" : "Não"}</td>
                    <td style={{ padding: 12, display: "flex", gap: 8 }}>
                      <button className="toggle-btn" onClick={() => abrirEdicao(f)}>
                        Editar
                      </button>
                      <button className="toggle-btn" onClick={() => excluir(f)}>
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Drawer/ formulário */}
      {showForm && (
        <div className="stat-card" style={{ marginTop: 16 }}>
          <h2 className="title" style={{ margin: 0, marginBottom: 12 }}>
            {form.id ? "Editar Funcionário" : "Novo Funcionário"}
          </h2>
          <form className="form" onSubmit={salvar}>
            {/* Pessoa */}
            <label htmlFor="f_pessoa">Pessoa</label>
            <select
              id="f_pessoa"
              value={form.pessoa_id}
              onChange={(e) => setField("pessoa_id", e.target.value)}
              disabled={loadingOpts}
              required
              style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border)", width: "100%" }}
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
              required
              style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border)", width: "100%" }}
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
              style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border)", width: "100%" }}
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

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
              <input
                id="f_ativo"
                type="checkbox"
                checked={!!form.ativo}
                onChange={(e) => setField("ativo", e.target.checked ? 1 : 0)}
              />
              <label htmlFor="f_ativo">Ativo</label>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button type="button" className="toggle-btn" onClick={fecharForm}>
                Cancelar
              </button>
              <button type="submit" className="toggle-btn" disabled={saving}>
                {saving ? "Salvando..." : form.id ? "Salvar alterações" : "Criar funcionário"}
              </button>
            </div>

            <small style={{ color: "var(--muted)", display: "block", marginTop: 12 }}>
              Precisa cadastrar uma <Link to="/pessoas"><strong>pessoa</strong></Link> ou um{" "}
              <Link to="/cargos"><strong>cargo</strong></Link> antes?
            </small>
          </form>
        </div>
      )}
    </>
  );
}

function formatMoney(v) {
  if (v == null || v === "") return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
