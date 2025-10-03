// src/pages/Empresas.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowPathIcon,
  PlusIcon,
  PencilSquareIcon,
  CheckIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid";

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
      const me = await fetchJSON(`${API_BASE}/api/auth/me`);
      setRoles(me.roles || []);

      const scope = isDev(me.roles) ? "all" : "mine";
      const li = await fetchJSON(`${API_BASE}/api/empresas?scope=${scope}`);
      const list = li.empresas || [];
      setEmpresas(list);

      if (!isDev(me.roles)) {
        if (list.length === 1) {
          selecionarEmpresa(list[0].id);
        } else {
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
        socios_receita:
          typeof emp.socios_receita === "string"
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
        cnpj: String(form.cnpj).replace(/\D+/g, ""),
        socios_receita: form.socios_receita,
      };

      const d = await fetchJSON(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (creating) {
        await carregar();
        if (d?.id) selecionarEmpresa(d.id);
      } else {
        await selecionarEmpresa(selectedId);
      }
    } catch (e) {
      setErr(e.message || "Falha ao salvar empresa.");
    }
  }

  return (
    <>
      {/* HEADER */}
      <header className="page-header">
        <div className="page-header__top">
          <h1 className="page-title">Empresas</h1>
          <p className="page-subtitle">
            {isDev(roles)
              ? "Visualize e gerencie todas as empresas (desenvolvedor)."
              : "Dados da empresa vinculada à sua sessão."}
          </p>
        </div>

        <div className="page-header__toolbar">
          {isDev(roles) && (
            <>
              <input
                placeholder="Buscar por razão social, fantasia ou CNPJ…"
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                className="search-input"
              />
              <button
                className="btn btn--primary"
                onClick={novoEmpresaForm}
                aria-label="Criar nova empresa"
              >
                <PlusIcon className="icon" aria-hidden="true" />
                <span>Nova Empresa</span>
              </button>
            </>
          )}
          <button
            className="btn btn--neutral"
            onClick={carregar}
            disabled={loading}
            aria-label="Atualizar lista de empresas"
          >
            <ArrowPathIcon className="icon" aria-hidden="true" />
            <span>{loading ? "Atualizando…" : "Atualizar"}</span>
          </button>
        </div>
      </header>

      {err && (
        <div className="error-alert" role="alert" style={{ marginBottom: 16 }}>
          {err}
        </div>
      )}

      {/* Lista de empresas para DEV */}
      {isDev(roles) && !creating && !editMode && (
        <div className="stat-card" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: 16, color: "var(--muted)" }}>Carregando…</div>
          ) : listaFiltrada.length === 0 ? (
            <div style={{ padding: 16, color: "var(--muted)" }}>
              Nenhuma empresa encontrada.
            </div>
          ) : (
            <table className="pessoas-table">
              <thead>
                <tr>
                  <th>Razão Social</th>
                  <th>Nome Fantasia</th>
                  <th>CNPJ</th>
                  <th className="actions-column">Ações</th>
                </tr>
              </thead>
              <tbody>
                {listaFiltrada.map((e) => (
                  <tr key={e.id}>
                    <td>{e.razao_social}</td>
                    <td>{e.nome_fantasia || "—"}</td>
                    <td>{e.cnpj}</td>
                    <td>
                      <button
                        className="btn btn--neutral btn--sm"
                        onClick={() => selecionarEmpresa(e.id)}
                        aria-label={`Editar ${e.razao_social}`}
                      >
                        <PencilSquareIcon className="icon" aria-hidden="true" />
                        <span>Editar</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Seleção de empresa para não-dev com múltiplas */}
      {!isDev(roles) && empresas.length > 1 && !editMode && !creating && (
        <div className="stat-card">
          <h2 className="title" style={{ marginBottom: 12 }}>Selecione a empresa</h2>
          <select
            value={selectedId || ""}
            onChange={(e) => selecionarEmpresa(Number(e.target.value))}
            className="search-input"
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

      {/* Formulário */}
      {(creating || editMode) && (
        <div className="stat-card" style={{ marginTop: 16 }}>
          <h2 className="title" style={{ marginBottom: 12 }}>
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
              disabled={!creating}
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

            <label htmlFor="socios_receita">Sócios (JSON Receita)</label>
            <textarea
              id="socios_receita"
              rows={3}
              value={form.socios_receita}
              onChange={(e) => setForm({ ...form, socios_receita: e.target.value })}
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

            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn btn--neutral"
                onClick={() => {
                  setCreating(false);
                  setEditMode(false);
                  setSelectedId(null);
                }}
              >
                <XMarkIcon className="icon" aria-hidden="true" />
                <span>Cancelar</span>
              </button>
              <button type="submit" className="btn btn--success">
                <CheckIcon className="icon" aria-hidden="true" />
                <span>{creating ? "Criar Empresa" : "Salvar Alterações"}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}