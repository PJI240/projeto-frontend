import { useEffect, useMemo, useRef, useState } from "react"; import { Link, useParams } from "react-router-dom"; import { PlusIcon, ArrowPathIcon, TrashIcon, CheckIcon, MagnifyingGlassIcon, XMarkIcon, ExclamationTriangleIcon, } from "@heroicons/react/24/solid";

// Usa o mesmo padrão visual de src/pages/Usuarios.jsx const API_BASE = import.meta.env.VITE_API_BASE?.replace(//+$/, "") || "";

// Campos conforme tabela folhas_funcionarios // id, empresa_id, folha_id, funcionario_id, horas_normais, he50_horas, he100_horas, // valor_base, valor_he50, valor_he100, descontos, proventos, total_liquido, inconsistencias

export default function FolhasFuncionarios() { const { folhaId } = useParams();

// Estados base de tela (mesma semântica do Usuarios.jsx) const [loading, setLoading] = useState(true); const [err, setErr] = useState(""); const [filter, setFilter] = useState(""); const [lista, setLista] = useState([]); // linhas já incluídas na folha

// Modal para "incluir funcionário" const [showForm, setShowForm] = useState(false); const [query, setQuery] = useState(""); const [candidatos, setCandidatos] = useState([]); // resultados de busca (mock até integrar) const [busy, setBusy] = useState(false);

const liveRef = useRef(null); const buscaRef = useRef(null);

// --- Helpers --- function fmtBRL(x) { const n = Number(x); if (!isFinite(n)) return "—"; try { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n); } catch { return n.toFixed(2); } }

// Filtro em memória (igual padrão do Usuarios.jsx) const filtrados = useMemo(() => { const q = filter.trim().toLowerCase(); if (!q) return lista; return (lista || []).filter((r) => { const nome = String(r.nome || "").toLowerCase(); const cpf = String(r.cpf || "").toLowerCase(); return nome.includes(q) || cpf.includes(q); }); }, [filter, lista]);

// Seleção em massa const [selecionados, setSelecionados] = useState([]); const allIds = useMemo(() => (lista || []).map((r) => r.id), [lista]); const allChecked = selecionados.length > 0 && selecionados.length === allIds.length; function toggleAll(on) { setSelecionados(on ? allIds : []); } function toggleOne(id, on) { setSelecionados((prev) => (on ? [...new Set([...prev, id])] : prev.filter((x) => x !== id))); }

// Carregamento inicial (mock para front-only) useEffect(() => { setLoading(true); setErr(""); // MOCK: dados estáticos apenas para o front; troque por fetch real depois const demo = [ { id: 101, funcionario_id: 1, nome: "Ana Paula Mendes", cpf: "123.456.789-09", horas_normais: 160.0, he50_horas: 12.5, he100_horas: 2.0, valor_base: 3200.0, valor_he50: 281.25, valor_he100: 120.0, proventos: 0.0, descontos: 350.0, total_liquido: 3251.25, inconsistencias: 1, }, { id: 102, funcionario_id: 2, nome: "Bruno Almeida", cpf: "987.654.321-00", horas_normais: 168.0, he50_horas: 5.0, he100_horas: 0.0, valor_base: 3800.0, valor_he50: 95.0, valor_he100: 0.0, proventos: 150.0, descontos: 275.0, total_liquido: 3770.0, inconsistencias: 0, }, ]; const t = setTimeout(() => { setLista(demo); setLoading(false); }, 400); return () => clearTimeout(t); }, [folhaId]);

// Abrir modal function abrirInclusao() { setShowForm(true); setQuery(""); setCandidatos([]); setTimeout(() => buscaRef.current?.focus(), 0); }

// Buscar candidatos (front-only: simula resposta) async function buscarCandidatos(q) { setQuery(q); if (q.trim().length < 2) { setCandidatos([]); return; } setBusy(true); // MOCK: simula 2 resultados setTimeout(() => { setCandidatos([ { funcionario_id: 3, nome: "Camila Souza", cpf: "111.222.333-44" }, { funcionario_id: 4, nome: "Diego Ramos", cpf: "555.666.777-88" }, ]); setBusy(false); }, 300); }

// Incluir (apenas front: insere item fake) function incluirFuncionario(c) { const novo = { id: Math.max(0, ...lista.map((x) => x.id)) + 1, funcionario_id: c.funcionario_id, nome: c.nome, cpf: c.cpf, horas_normais: 0, he50_horas: 0, he100_horas: 0, valor_base: 0, valor_he50: 0, valor_he100: 0, proventos: 0, descontos: 0, total_liquido: 0, inconsistencias: 0, }; setLista((prev) => [...prev, novo]); setShowForm(false); if (liveRef.current) liveRef.current.textContent = ${c.nome} incluído na folha.; }

// Remover (front-only) function remover(item) { if (!window.confirm(Remover ${item.nome} desta folha?)) return; setLista((prev) => prev.filter((x) => x.id !== item.id)); if (liveRef.current) liveRef.current.textContent = ${item.nome} removido.; }

// Recalcular selecionados (front-only: feedback visual) function recalcularSelecionados() { if (!selecionados.length) return; setBusy(true); setTimeout(() => { setBusy(false); if (liveRef.current) liveRef.current.textContent = Recalculo concluído para ${selecionados.length} registro(s).; }, 600); }

// Somas de totais (rodapé) const totais = useMemo(() => { const base = { horas_normais: 0, he50_horas: 0, he100_horas: 0, valor_base: 0, valor_he50: 0, valor_he100: 0, proventos: 0, descontos: 0, total_liquido: 0 }; for (const r of filtrados) { base.horas_normais += Number(r.horas_normais || 0); base.he50_horas += Number(r.he50_horas || 0); base.he100_horas += Number(r.he100_horas || 0); base.valor_base += Number(r.valor_base || 0); base.valor_he50 += Number(r.valor_he50 || 0); base.valor_he100 += Number(r.valor_he100 || 0); base.proventos += Number(r.proventos || 0); base.descontos += Number(r.descontos || 0); base.total_liquido += Number(r.total_liquido || 0); } return base; }, [filtrados]);

return ( <> {/* região viva para leitores de tela */} <div ref={liveRef} aria-live="polite" className="visually-hidden" />

{/* HEADER seguindo padrão de Usuarios.jsx */}
  <header className="page-header" role="region" aria-labelledby="titulo-pagina">
    <div>
      <h1 id="titulo-pagina" className="page-title">Folhas &rsaquo; Funcionários</h1>
      <p className="page-subtitle">Inclua/gerencie os colaboradores que compõem a folha #{folhaId}. Os valores são calculados pelo backend a partir dos apontamentos.</p>
    </div>

    <div className="page-header__toolbar" aria-label="Ações da página">
      <button className="btn btn--success" onClick={abrirInclusao} aria-label="Incluir funcionário">
        <PlusIcon className="icon" aria-hidden="true" />
        <span>Incluir</span>
      </button>
      <button
        className="btn btn--neutral"
        onClick={() => window.location.reload()}
        aria-label="Atualizar"
      >
        <ArrowPathIcon className="icon" aria-hidden="true" />
        <span>Atualizar</span>
      </button>
      <button
        className="btn btn--neutral"
        onClick={recalcularSelecionados}
        disabled={!selecionados.length || busy}
        aria-label="Recalcular selecionados"
        title="Recalcular selecionados"
      >
        {busy ? <span className="spinner" aria-hidden="true" /> : <ArrowPathIcon className="icon" aria-hidden="true" />}
        <span>{busy ? "Recalculando…" : "Recalcular"}</span>
      </button>
    </div>
  </header>

  {err && (
    <div className="error-alert" role="alert">
      <ExclamationTriangleIcon className="icon" aria-hidden="true" /> {err}
    </div>
  )}

  {/* Busca */}
  <div className="search-container">
    <div className="search-bar" role="search" aria-label="Buscar funcionários nesta folha">
      <MagnifyingGlassIcon className="icon" aria-hidden="true" />
      <label htmlFor="busca" className="visually-hidden">Buscar por nome ou CPF</label>
      <input
        id="busca"
        type="search"
        className="input input--lg"
        placeholder="Buscar por nome ou CPF…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        autoComplete="off"
      />
      {Boolean(filter) && (
        <button
          type="button"
          className="btn btn--neutral btn--icon-only"
          onClick={() => setFilter("")}
          aria-label="Limpar busca"
        >
          <XMarkIcon className="icon" aria-hidden="true" />
        </button>
      )}
    </div>
  </div>

  {/* LISTAGEM: Tabela (desktop) + Cards (mobile) */}
  <div className="listagem-container">
    {/* Desktop/tablet */}
    <div className="table-wrapper table-only" role="region" aria-label="Tabela de funcionários na folha">
      {loading ? (
        <div className="loading-message" role="status">Carregando…</div>
      ) : filtrados.length === 0 ? (
        <div className="empty-message">Nenhum funcionário incluído ainda.</div>
      ) : (
        <div className="stat-card" style={{ overflow: "hidden" }}>
          <table className="usuarios-table">
            <thead>
              <tr>
                <th scope="col" style={{ width: 36 }}>
                  <input
                    type="checkbox"
                    aria-label="Selecionar todos"
                    checked={allChecked}
                    onChange={(e) => toggleAll(e.target.checked)}
                  />
                </th>
                <th scope="col">Funcionário</th>
                <th scope="col">CPF</th>
                <th scope="col" className="ta-right">Horas</th>
                <th scope="col" className="ta-right">HE 50%</th>
                <th scope="col" className="ta-right">HE 100%</th>
                <th scope="col" className="ta-right">Base (R$)</th>
                <th scope="col" className="ta-right">HE50 (R$)</th>
                <th scope="col" className="ta-right">HE100 (R$)</th>
                <th scope="col" className="ta-right">Proventos</th>
                <th scope="col" className="ta-right">Descontos</th>
                <th scope="col" className="ta-right">Líquido</th>
                <th scope="col" className="actions-column">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((r) => (
                <tr key={r.id}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Selecionar ${r.nome}`}
                      checked={selecionados.includes(r.id)}
                      onChange={(e) => toggleOne(r.id, e.target.checked)}
                    />
                  </td>
                  <td>
                    <div className="flex-col">
                      <strong>{r.nome}</strong>
                      {r.inconsistencias > 0 && (
                        <small className="tag-warning">{r.inconsistencias} inconsistência(s)</small>
                      )}
                    </div>
                  </td>
                  <td>{r.cpf || "—"}</td>
                  <td className="ta-right tabular">{Number(r.horas_normais || 0).toFixed(2)}</td>
                  <td className="ta-right tabular">{Number(r.he50_horas || 0).toFixed(2)}</td>
                  <td className="ta-right tabular">{Number(r.he100_horas || 0).toFixed(2)}</td>
                  <td className="ta-right tabular">{fmtBRL(r.valor_base)}</td>
                  <td className="ta-right tabular">{fmtBRL(r.valor_he50)}</td>
                  <td className="ta-right tabular">{fmtBRL(r.valor_he100)}</td>
                  <td className="ta-right tabular">{fmtBRL(r.proventos)}</td>
                  <td className="ta-right tabular">{fmtBRL(r.descontos)}</td>
                  <td className="ta-right tabular strong">{fmtBRL(r.total_liquido)}</td>
                  <td>
                    <div className="actions-buttons">
                      <button
                        className="btn btn--neutral btn--sm"
                        onClick={() => recalcularSelecionados([r.id])}
                        aria-label={`Recalcular ${r.nome}`}
                        title="Recalcular"
                      >
                        <ArrowPathIcon className="icon" aria-hidden="true" />
                        <span>Recalcular</span>
                      </button>
                      <button
                        className="btn btn--danger btn--sm"
                        onClick={() => remover(r)}
                        aria-label={`Remover ${r.nome}`}
                        title="Remover"
                      >
                        <TrashIcon className="icon" aria-hidden="true" />
                        <span>Remover</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3}><strong>Totais</strong></td>
                <td className="ta-right tabular">{totais.horas_normais.toFixed(2)}</td>
                <td className="ta-right tabular">{totais.he50_horas.toFixed(2)}</td>
                <td className="ta-right tabular">{totais.he100_horas.toFixed(2)}</td>
                <td className="ta-right tabular">{fmtBRL(totais.valor_base)}</td>
                <td className="ta-right tabular">{fmtBRL(totais.valor_he50)}</td>
                <td className="ta-right tabular">{fmtBRL(totais.valor_he100)}</td>
                <td className="ta-right tabular">{fmtBRL(totais.proventos)}</td>
                <td className="ta-right tabular">{fmtBRL(totais.descontos)}</td>
                <td className="ta-right tabular strong">{fmtBRL(totais.total_liquido)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>

    {/* Mobile: cards */}
    <div className="cards-wrapper cards-only" role="region" aria-label="Lista de funcionários (cartões)">
      {loading ? (
        <div className="loading-message" role="status">Carregando…</div>
      ) : filtrados.length === 0 ? (
        <div className="empty-message">Nenhum funcionário incluído ainda.</div>
      ) : (
        <ul className="cards-grid">
          {filtrados.map((r) => (
            <li key={r.id} className="usuario-card" aria-label={`Funcionário: ${r.nome}`}>
              <div className="usuario-card__head">
                <h3 className="usuario-card__title">{r.nome}</h3>
                <span className="badge ok">{fmtBRL(r.total_liquido)}</span>
              </div>
              <div className="usuario-card__body">
                <dl className="usuario-dl">
                  <div className="usuario-dl__row">
                    <dt>CPF</dt>
                    <dd>{r.cpf || "—"}</dd>
                  </div>
                  <div className="usuario-dl__row">
                    <dt>Horas</dt>
                    <dd>{Number(r.horas_normais || 0).toFixed(2)}</dd>
                  </div>
                  <div className="usuario-dl__row">
                    <dt>HE 50%</dt>
                    <dd>{Number(r.he50_horas || 0).toFixed(2)}</dd>
                  </div>
                  <div className="usuario-dl__row">
                    <dt>HE 100%</dt>
                    <dd>{Number(r.he100_horas || 0).toFixed(2)}</dd>
                  </div>
                </dl>
              </div>
              <div className="usuario-card__actions">
                <button className="btn btn--neutral btn--sm" onClick={() => recalcularSelecionados([r.id])}>
                  <ArrowPathIcon className="icon" aria-hidden="true" />
                  <span>Recalcular</span>
                </button>
                <button className="btn btn--danger btn--sm" onClick={() => remover(r)}>
                  <TrashIcon className="icon" aria-hidden="true" />
                  <span>Remover</span>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  </div>

  {/* DIALOG: Incluir funcionário */}
  {showForm && (
    <div className="form-overlay" role="dialog" aria-modal="true" aria-labelledby="titulo-form">
      <div className="form-container" style={{ maxWidth: 560 }}>
        <div className="form-header">
          <h2 id="titulo-form">Incluir funcionário</h2>
          <button className="btn btn--neutral btn--icon-only" onClick={() => setShowForm(false)} aria-label="Fechar formulário">
            <XMarkIcon className="icon" aria-hidden="true" />
          </button>
        </div>
        <div className="form">
          <div className="form-field span-2">
            <label htmlFor="ff_busca">Buscar</label>
            <div className="search-bar">
              <MagnifyingGlassIcon className="icon" aria-hidden="true" />
              <input
                id="ff_busca"
                ref={buscaRef}
                type="search"
                className="input input--lg"
                placeholder="Nome ou CPF (mín. 2 caracteres)"
                value={query}
                onChange={(e) => buscarCandidatos(e.target.value)}
                autoComplete="off"
              />
              {Boolean(query) && (
                <button type="button" className="btn btn--neutral btn--icon-only" onClick={() => { setQuery(""); setCandidatos([]); }} aria-label="Limpar">
                  <XMarkIcon className="icon" aria-hidden="true" />
                </button>
              )}
            </div>
            <small className="hint">Mostra somente colaboradores ativos e ainda não incluídos nesta folha.</small>
          </div>

          <div className="form-field span-2">
            <div className="stat-card" style={{ maxHeight: 320, overflow: "auto" }}>
              {busy ? (
                <div className="loading-message">Buscando…</div>
              ) : candidatos.length === 0 ? (
                <div className="empty-message">Nenhum resultado.</div>
              ) : (
                <ul className="simple-list">
                  {candidatos.map((c) => (
                    <li key={c.funcionario_id} className="simple-list__item">
                      <div className="simple-list__content">
                        <div className="simple-list__title">{c.nome}</div>
                        <div className="simple-list__subtitle">CPF: {c.cpf || "—"}</div>
                      </div>
                      <div className="simple-list__actions">
                        <button className="btn btn--success btn--sm" onClick={() => incluirFuncionario(c)}>
                          <CheckIcon className="icon" aria-hidden="true" />
                          <span>Incluir</span>
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )}

  {/* estilos locais mínimos (igual estrutura do Usuarios.jsx) */}
  <style jsx>{`
    .listagem-container { width: 100%; }
    .search-container { margin-bottom: 16px; }
    .ta-right { text-align: right; }
    .tabular { font-variant-numeric: tabular-nums; }
    .strong { font-weight: 700; }
    .flex-col { display: flex; flex-direction: column; gap: 4px; }
    .tag-warning { background: rgba(245,158,11,.15); color: #b45309; border: 1px solid rgba(245,158,11,.35); padding: 2px 6px; border-radius: 999px; display: inline-block; }

    .table-only { display: block; }
    .cards-only { display: none; }
    @media (max-width: 768px) {
      .table-only { display: none; }
      .cards-only { display: block; }
    }

    /* Cards grid (mobile) */
    .cards-grid { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: 1fr; gap: 12px; }
    .usuario-card { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; box-shadow: var(--shadow); overflow: hidden; position: relative; }
    .usuario-card::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: var(--accent-bg); }
    .usuario-card__head { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 14px 14px 0 14px; }
    .usuario-card__title { margin: 0; font-size: 1rem; font-weight: 700; color: var(--fg); }
    .badge { font-size: 0.75rem; padding: 2px 8px; border-radius: 999px; border: 1px solid var(--border); }
    .badge.ok { background: rgba(16,185,129,.12); color: var(--success-strong); border-color: rgba(16,185,129,.35); }
    .badge.muted { background: var(--panel-muted); color: var(--muted); }
    .usuario-card__body { padding: 12px 14px 14px 14px; }
    .usuario-dl { margin: 0; display: grid; gap: 8px; }
    .usuario-dl__row { display: grid; grid-template-columns: 110px 1fr; gap: 8px; align-items: baseline; }
    .usuario-dl__row dt { color: var(--muted); font-weight: 600; font-size: var(--fs-12); }
    .usuario-dl__row dd { margin: 0; color: var(--fg); font-weight: 500; }
    .usuario-card__actions { display: flex; gap: 6px; flex-wrap: wrap; padding: 0 14px 14px 14px; }

    /* Simple list */
    .simple-list { list-style: none; padding: 0; margin: 0; }
    .simple-list__item { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 12px; border-bottom: 1px solid var(--border); }
    .simple-list__title { font-weight: 600; }
    .simple-list__subtitle { font-size: var(--fs-12); color: var(--muted); }
    .simple-list__actions { display: flex; gap: 6px; }
  `}</style>
</>

); }