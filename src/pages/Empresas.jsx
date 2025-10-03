// src/pages/Empresas.jsx
import { useEffect, useMemo, useState, useRef } from "react";
import {
  PlusIcon,
  ArrowPathIcon,
  PencilSquareIcon,
  XMarkIcon,
  BuildingOffice2Icon,
  CheckIcon,
  MagnifyingGlassIcon,
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

  const liveRef = useRef(null);

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

      // 3) decide seleção inicial
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
      if (liveRef.current) liveRef.current.textContent = "Lista de empresas atualizada.";
    } catch (e) {
      setErr(e.message || "Falha ao carregar empresas.");
      if (liveRef.current) liveRef.current.textContent = "Erro ao carregar empresas.";
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
      if (liveRef.current) liveRef.current.textContent = "Empresa carregada para edição.";
    } catch (e) {
      setErr(e.message || "Falha ao obter empresa.");
      if (liveRef.current) liveRef.current.textContent = "Erro ao carregar empresa.";
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
    if (liveRef.current) liveRef.current.textContent = "Criando nova empresa.";
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
        socios_receita: form.socios_receita, // string JSON
      };

      const d = await fetchJSON(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (creating) {
        await carregar();
        if (d?.id) selecionarEmpresa(d.id);
        if (liveRef.current) liveRef.current.textContent = "Empresa criada.";
      } else {
        await selecionarEmpresa(selectedId);
        if (liveRef.current) liveRef.current.textContent = "Empresa salva.";
      }
    } catch (e) {
      setErr(e.message || "Falha ao salvar empresa.");
      if (liveRef.current) liveRef.current.textContent = "Erro ao salvar empresa.";
    }
  }

  return (
    <>
      {/* região viva para leitores de tela */}
      <div ref={liveRef} aria-live="polite" className="visually-hidden" />

      {/* HEADER NO NOVO PADRÃO */}
      <header className="page-header" role="region" aria-labelledby="titulo-pagina">
        <div>
          <h1 id="titulo-pagina" className="page-title">Empresas</h1>
          <p className="page-subtitle">
            {isDev(roles)
              ? "Visualize e gerencie todas as empresas (desenvolvedor)."
              : "Dados da(s) empresa(s) vinculada(s) à sua sessão."}
          </p>
        </div>

        <div className="page-header__toolbar" aria-label="Ações da página">
          {isDev(roles) && (
            <>
              {/* Barra de busca padronizada */}
              <div className="search-bar" role="search" aria-label="Buscar empresas">
                <MagnifyingGlassIcon className="icon" aria-hidden="true" />
                <label htmlFor="busca-emp" className="visually-hidden">
                  Buscar por razão social, fantasia ou CNPJ
                </label>
                <input
                  id="busca-emp"
                  type="search"
                  className="input input--lg"
                  placeholder="Buscar por razão social, fantasia ou CNPJ…"
                  value={filtro}
                  onChange={(e) => setFiltro(e.target.value)}
                  autoComplete="off"
                />
                {Boolean(filtro) && (
                  <button
                    type="button"
                    className="btn btn--neutral btn--icon-only"
                    onClick={() => setFiltro("")}
                    aria-label="Limpar busca"
                    title="Limpar"
                  >
                    <XMarkIcon className="icon" aria-hidden="true" />
                  </button>
                )}
              </div>
              <button className="btn btn--success" onClick={novoEmpresaForm} aria-label="Nova empresa">
                <PlusIcon className="icon" aria-hidden="true" />
                <span>Nova Empresa</span>
              </button>
            </>
          )}
          <button
            className="btn btn--neutral"
            onClick={carregar}
            disabled={loading}
            aria-busy={loading ? "true" : "false"}
            aria-label="Atualizar lista"
            title="Atualizar"
          >
            {loading ? <span className="spinner" aria-hidden="true" /> : <ArrowPathIcon className="icon" aria-hidden="true" />}
            <span>{loading ? "Atualizando…" : "Atualizar"}</span>
          </button>
        </div>
      </header>

      {err && (
        <div className="error-alert" role="alert" style={{ marginBottom: 16 }}>
          {err}
        </div>
      )}

      {/* DESENVOLVEDOR: listagem completa */}
      {isDev(roles) && !creating && !editMode && (
        <div className="listagem-container">
          {/* Desktop/tablet: Tabela */}
          <div className="table-wrapper table-only" role="region" aria-label="Tabela de empresas">
            {loading ? (
              <div className="loading-message" role="status">Carregando…</div>
            ) : listaFiltrada.length === 0 ? (
              <div className="empty-message">Nenhuma empresa encontrada.</div>
            ) : (
              <div className="stat-card" style={{ overflow: "hidden" }}>
                <table className="pessoas-table">
                  <thead>
                    <tr>
                      <th scope="col">Razão Social</th>
                      <th scope="col">Nome Fantasia</th>
                      <th scope="col">CNPJ</th>
                      <th scope="col" className="actions-column">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listaFiltrada.map((e) => (
                      <tr key={e.id}>
                        <td>{e.razao_social}</td>
                        <td>{e.nome_fantasia || "—"}</td>
                        <td>{e.cnpj}</td>
                        <td>
                          <div className="actions-buttons">
                            <button
                              className="btn btn--neutral btn--sm"
                              onClick={() => selecionarEmpresa(e.id)}
                              aria-label={`Editar ${e.razao_social}`}
                            >
                              <PencilSquareIcon className="icon" aria-hidden="true" />
                              <span>Editar</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Mobile: Cards */}
          <div className="cards-wrapper cards-only" role="region" aria-label="Lista de empresas (cartões)">
            {loading ? (
              <div className="loading-message" role="status">Carregando…</div>
            ) : listaFiltrada.length === 0 ? (
              <div className="empty-message">Nenhuma empresa encontrada.</div>
            ) : (
              <ul className="cards-grid" aria-label="Cartões de empresas">
                {listaFiltrada.map((e) => (
                  <li key={e.id} className="empresa-card" aria-label={`Empresa: ${e.razao_social}`}>
                    <div className="empresa-card__head">
                      <div className="empresa-card__title-wrap">
                        <BuildingOffice2Icon className="icon" aria-hidden="true" />
                        <h3 className="empresa-card__title">{e.razao_social}</h3>
                      </div>
                      <div className="empresa-card__actions">
                        <button
                          className="btn btn--neutral btn--sm"
                          onClick={() => selecionarEmpresa(e.id)}
                          aria-label={`Editar ${e.razao_social}`}
                          title="Editar"
                        >
                          <PencilSquareIcon className="icon" aria-hidden="true" />
                          <span>Editar</span>
                        </button>
                      </div>
                    </div>

                    <div className="empresa-card__body">
                      <dl className="empresa-dl">
                        <div className="empresa-dl__row">
                          <dt>Fantasia</dt>
                          <dd>{e.nome_fantasia || "—"}</dd>
                        </div>
                        <div className="empresa-dl__row">
                          <dt>CNPJ</dt>
                          <dd>{e.cnpj}</dd>
                        </div>
                      </dl>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* NÃO-DEV: seletor quando houver múltiplas empresas */}
      {!isDev(roles) && empresas.length > 1 && !editMode && !creating && (
        <div className="stat-card" style={{ marginTop: 16 }}>
          <h2 className="title" style={{ margin: 0, marginBottom: 12 }}>Selecione a empresa</h2>
          <label htmlFor="sel-emp" className="visually-hidden">Selecionar empresa</label>
          <select
            id="sel-emp"
            value={selectedId || ""}
            onChange={(e) => selecionarEmpresa(Number(e.target.value))}
            className="input input--lg"
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
        <div className="stat-card" style={{ marginTop: 16, position: "relative" }}>
          <div className="card-left-accent" aria-hidden="true" />
          <h2 className="title" style={{ margin: 0, marginBottom: 12 }}>
            {creating ? "Nova Empresa" : "Dados da Empresa"}
          </h2>

          <form className="form" onSubmit={salvar}>
            <label htmlFor="razao_social">Razão Social</label>
            <input
              id="razao_social"
              className="input"
              value={form.razao_social}
              onChange={(e) => setForm({ ...form, razao_social: e.target.value })}
              required
            />

            <label htmlFor="nome_fantasia">Nome Fantasia</label>
            <input
              id="nome_fantasia"
              className="input"
              value={form.nome_fantasia}
              onChange={(e) => setForm({ ...form, nome_fantasia: e.target.value })}
            />

            <label htmlFor="cnpj">CNPJ</label>
            <input
              id="cnpj"
              className="input"
              value={form.cnpj}
              onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
              disabled={!creating} // no edit, CNPJ travado
            />

            <label htmlFor="insc_est">Inscrição Estadual</label>
            <input
              id="insc_est"
              className="input"
              value={form.inscricao_estadual}
              onChange={(e) => setForm({ ...form, inscricao_estadual: e.target.value })}
            />

            <label htmlFor="data_abertura">Data de Abertura</label>
            <input
              id="data_abertura"
              type="date"
              className="input"
              value={form.data_abertura || ""}
              onChange={(e) => setForm({ ...form, data_abertura: e.target.value })}
            />

            <label htmlFor="telefone">Telefone</label>
            <input
              id="telefone"
              className="input"
              value={form.telefone}
              onChange={(e) => setForm({ ...form, telefone: e.target.value })}
            />

            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              type="email"
              className="input"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />

            <label htmlFor="capital_social">Capital Social</label>
            <input
              id="capital_social"
              inputMode="decimal"
              className="input"
              value={form.capital_social}
              onChange={(e) => setForm({ ...form, capital_social: e.target.value })}
            />

            <label htmlFor="natureza_juridica">Natureza Jurídica</label>
            <input
              id="natureza_juridica"
              className="input"
              value={form.natureza_juridica}
              onChange={(e) => setForm({ ...form, natureza_juridica: e.target.value })}
            />

            <label htmlFor="situacao_cadastral">Situação Cadastral</label>
            <input
              id="situacao_cadastral"
              className="input"
              value={form.situacao_cadastral}
              onChange={(e) => setForm({ ...form, situacao_cadastral: e.target.value })}
            />

            <label htmlFor="data_situacao">Data da Situação</label>
            <input
              id="data_situacao"
              type="date"
              className="input"
              value={form.data_situacao || ""}
              onChange={(e) => setForm({ ...form, data_situacao: e.target.value })}
            />

            {/* JSON de sócios (texto bruto) */}
            <label htmlFor="socios_receita">Sócios (JSON Receita)</label>
            <textarea
              id="socios_receita"
              className="input"
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

            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
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
              <button type="submit" className="btn btn--primary">
                <CheckIcon className="icon" aria-hidden="true" />
                <span>{creating ? "Criar Empresa" : "Salvar Alterações"}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* estilos locais específicos da página */}
      <style jsx>{`
        .visually-hidden {
          position: absolute !important;
          width: 1px; height: 1px; padding: 0; margin: -1px;
          overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
        }

        /* Alterna tabela (desktop) e cards (mobile) */
        .table-only { display: block; }
        .cards-only { display: none; }

        @media (max-width: 768px) {
          .table-only { display: none; }
          .cards-only { display: block; }
        }

        /* Cards grid (mobile) */
        .cards-grid {
          list-style: none; padding: 0; margin: 0;
          display: grid; grid-template-columns: 1fr; gap: 12px;
        }
        .empresa-card {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 12px;
          box-shadow: var(--shadow);
          position: relative; overflow: hidden;
        }
        .empresa-card::before {
          content: "";
          position: absolute; left: 0; top: 0; bottom: 0; width: 4px;
          background: var(--accent-bg);
        }
        .empresa-card__head {
          display: flex; align-items: center; justify-content: space-between;
          gap: 8px; padding: 14px 14px 0 14px;
        }
        .empresa-card__title-wrap {
          display: flex; align-items: center; gap: 8px;
          color: var(--fg);
        }
        .empresa-card__title { margin: 0; font-size: 1rem; font-weight: 700; }
        .empresa-card__actions { display: flex; gap: 6px; flex-shrink: 0; }
        .empresa-card__body { padding: 12px 14px 14px 14px; }
        .empresa-dl { margin: 0; display: grid; gap: 8px; }
        .empresa-dl__row {
          display: grid; grid-template-columns: 120px 1fr; gap: 8px; align-items: baseline;
        }
        .empresa-dl__row dt {
          color: var(--muted); font-weight: 600; font-size: var(--fs-12);
        }
        .empresa-dl__row dd { margin: 0; color: var(--fg); font-weight: 500; }

        /* Borda lateral no card de formulário (coerente com o padrão) */
        .card-left-accent {
          position: absolute; left: 0; top: 0; bottom: 0; width: 4px;
          background: var(--accent-bg);
          border-top-left-radius: 12px; border-bottom-left-radius: 12px;
        }

        /* Espaços padrão (coerente: busca separada do conteúdo) */
        .page-header { margin-bottom: 16px; }
        .search-bar { margin-bottom: 24px; } /* gap após a busca */

        /* Tabela usa estilos globais (pessoas-table) para consistência */
      `}</style>
    </>
  );
}