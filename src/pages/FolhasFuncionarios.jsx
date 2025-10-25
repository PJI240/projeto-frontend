// src/pages/FolhasFuncionarios.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  PlusIcon,
  ArrowPathIcon,
  TrashIcon,
  CheckIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/solid";

const API_BASE = import.meta.env.VITE_API_BASE?.replace(/\/+$/, "") || "";

/* ===== Helpers HTTP ===== */
async function fetchJSON(url, init = {}) {
  const r = await fetch(url, { credentials: "include", ...init });
  const data = await r.json().catch(() => null);
  if (!r.ok || data?.ok === false) throw new Error(data?.error || `HTTP ${r.status}`);
  return data;
}

/* Fallbacks de nome/CPF (para diferentes formatos de resposta) */
function getDisplayName(row) {
  return (
    row?.nome ??
    row?.funcionario_nome ??
    row?.pessoa_nome ??
    (row?.funcionario_id ? `#${row.funcionario_id}` : "—")
  );
}
function getCPF(row) {
  return row?.cpf ?? row?.pessoa_cpf ?? "—";
}

export default function FolhasFuncionarios() {
  const { folhaId: folhaIdParam } = useParams();
  const navigate = useNavigate();

  // Seletor de folha
  const [folhas, setFolhas] = useState([]); // [{id, competencia, status, empresa_id}]
  const [folhaId, setFolhaId] = useState(folhaIdParam ? Number(folhaIdParam) : null);
  const [folhaInfo, setFolhaInfo] = useState(null);

  // Estado da tela
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState("");
  const [lista, setLista] = useState([]); // linhas já incluídas

  // Modal inclusão
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState("");
  const [candidatosAll, setCandidatosAll] = useState([]); // todos carregados do backend
  const [candidatos, setCandidatos] = useState([]);       // exibidos (filtrados no cliente)
  const [busy, setBusy] = useState(false);

  const liveRef = useRef(null);
  const buscaRef = useRef(null);

  /* Pode editar? (se a folha estiver ABERTA) */
  const canEdit = useMemo(() => {
    const st = String(folhaInfo?.status || "").trim().toUpperCase();
    return st === "ABERTA";
  }, [folhaInfo]);

  /* ===== Utils ===== */
  function fmtBRL(x) {
    const n = Number(x);
    if (!Number.isFinite(n)) return "—";
    try {
      return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
    } catch {
      return n.toFixed(2);
    }
  }

  /* Filtro da tabela principal */
  const filtrados = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return lista;
    return (lista || []).filter((r) => {
      const nome = String(getDisplayName(r) || "").toLowerCase();
      const cpf = String(getCPF(r) || "").toLowerCase();
      return nome.includes(q) || cpf.includes(q);
    });
  }, [filter, lista]);

  /* Seleção em massa */
  const [selecionados, setSelecionados] = useState([]);
  const allIds = useMemo(() => (lista || []).map((r) => r.id), [lista]);
  const allChecked = selecionados.length > 0 && selecionados.length === allIds.length;
  function toggleAll(on) { setSelecionados(on ? allIds : []); }
  function toggleOne(id, on) {
    setSelecionados((prev) => (on ? [...new Set([...prev, id])] : prev.filter((x) => x !== id)));
  }

  /* ===== Carregamentos ===== */
  async function carregarFolhas() {
    const data = await fetchJSON(`${API_BASE}/api/folhas`);
    const arr = Array.isArray(data) ? data : (data.folhas || []);
    setFolhas(arr);

    // Se não veio id pela URL, prefira uma ABERTA
    if (!folhaId && arr.length > 0) {
      const prefer = arr.find((f) => String(f.status).toUpperCase() === "ABERTA");
      const chosen = (prefer || arr[0]).id;
      setFolhaId(chosen);
    }
  }

  async function carregarFolhaInfo(id) {
    if (!id) { setFolhaInfo(null); return; }
    const info = await fetchJSON(`${API_BASE}/api/folhas/${id}`);
    setFolhaInfo(info?.folha ?? info);
  }

  async function carregarLista(id) {
    if (!id) { setLista([]); return; }
    const rows = await fetchJSON(`${API_BASE}/api/folhas/${id}/funcionarios`);
    const arr = Array.isArray(rows) ? rows : (rows.folhas_funcionarios || []);
    setLista(arr);
    setSelecionados([]);
    if (liveRef.current) liveRef.current.textContent = "Lista atualizada.";
  }

  // Inicial
  useEffect(() => {
    let alive = true;
    (async () => {
      setErr("");
      try {
        await carregarFolhas();
      } catch (e) {
        if (alive) setErr(e.message || "Falha ao carregar folhas.");
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sincroniza se a URL mudar externamente
  useEffect(() => {
    if (folhaIdParam && Number(folhaIdParam) !== Number(folhaId)) {
      setFolhaId(Number(folhaIdParam));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folhaIdParam]);

  // Reage à mudança da folha
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!folhaId) return;
      setLoading(true);
      setErr("");
      try {
        await carregarFolhaInfo(folhaId);
        await carregarLista(folhaId);
        // Mantém a URL no padrão /folhas/:folhaId/funcionarios
        if (String(folhaIdParam || "") !== String(folhaId)) {
          navigate(`/folhas/${folhaId}/funcionarios`, { replace: true });
        }
      } catch (e) {
        if (alive) setErr(e.message || "Falha ao carregar dados da folha.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folhaId]);

  /* ===== Ações ===== */

  // Abre o modal e carrega TODOS os candidatos (sem precisar digitar)
  async function abrirInclusao() {
    if (!canEdit || !folhaId) return;
    setShowForm(true);
    setQuery("");
    setCandidatosAll([]);
    setCandidatos([]);
    setBusy(true);
    try {
      // Sem ?search — backend já retorna os aptos (ativos, mesma empresa e não incluídos)
      const data = await fetchJSON(`${API_BASE}/api/folhas/${folhaId}/candidatos`);
      const arr = Array.isArray(data) ? data : (data.candidatos || []);
      setCandidatosAll(arr);
      setCandidatos(arr); // exibe tudo inicialmente
      setTimeout(() => buscaRef.current?.focus(), 0);
    } catch (e) {
      setErr(e.message || "Falha ao carregar candidatos.");
      setShowForm(false);
    } finally {
      setBusy(false);
    }
  }

  // Filtro local de candidatos (nome/CPF)
  function filtrarCandidatosLocal(q) {
    setQuery(q);
    const t = q.trim().toLowerCase();
    if (!t) { setCandidatos(candidatosAll); return; }
    setCandidatos(
      candidatosAll.filter((c) => {
        const nome = String(getDisplayName(c) || "").toLowerCase();
        const cpf  = String(getCPF(c) || "").toLowerCase();
        return nome.includes(t) || cpf.includes(t);
      })
    );
  }

  async function incluirFuncionario(c) {
    if (!folhaId) return;
    setBusy(true);
    try {
      await fetchJSON(`${API_BASE}/api/folhas/${folhaId}/funcionarios`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ funcionario_id: Number(c.funcionario_id) }),
      });
      await carregarLista(folhaId);
      if (liveRef.current) liveRef.current.textContent = `${getDisplayName(c)} incluído na folha.`;
      // remove do pool local para não duplicar visualmente
      const rest = candidatosAll.filter((x) => x.funcionario_id !== c.funcionario_id);
      setCandidatosAll(rest);
      setCandidatos((prev) => prev.filter((x) => x.funcionario_id !== c.funcionario_id));
    } catch (e) {
      setErr(e.message || "Falha ao incluir funcionário.");
    } finally {
      setBusy(false);
    }
  }

  // Inclui todos os visíveis (respeita o filtro atual)
  async function incluirTodos() {
    if (!folhaId || !candidatos.length) return;
    if (!window.confirm(`Incluir todos os ${candidatos.length} funcionário(s) listados nesta folha?`)) return;

    setBusy(true);
    try {
      for (const c of candidatos) {
        try {
          await fetchJSON(`${API_BASE}/api/folhas/${folhaId}/funcionarios`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ funcionario_id: Number(c.funcionario_id) }),
          });
        } catch (e) {
          console.warn("Falha ao incluir", c, e);
        }
      }
      await carregarLista(folhaId);
      if (liveRef.current) {
        liveRef.current.textContent = `Inclusão em massa concluída (${candidatos.length} candidato(s) processados).`;
      }
      setShowForm(false);
    } catch (e) {
      setErr(e.message || "Falha na inclusão em massa.");
    } finally {
      setBusy(false);
    }
  }

  async function remover(item) {
    if (!folhaId || !item?.id) return;
    if (!window.confirm(`Remover ${getDisplayName(item)} desta folha?`)) return;
    setBusy(true);
    try {
      await fetchJSON(`${API_BASE}/api/folhas/${folhaId}/funcionarios/${item.id}`, { method: "DELETE" });
      await carregarLista(folhaId);
      if (liveRef.current) liveRef.current.textContent = `${getDisplayName(item)} removido.`;
    } catch (e) {
      setErr(e.message || "Falha ao remover.");
    } finally {
      setBusy(false);
    }
  }

  async function recalcularSelecionados(idsOptional) {
    const alvo = Array.isArray(idsOptional) && idsOptional.length > 0 ? idsOptional : selecionados;
    if (!folhaId || !alvo.length) return;
    setBusy(true);
    try {
      await fetchJSON(`${API_BASE}/api/folhas/${folhaId}/funcionarios/recalcular`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: alvo }),
      });
      await carregarLista(folhaId);
      if (liveRef.current) liveRef.current.textContent = `Recalculo concluído para ${alvo.length} registro(s).`;
    } catch (e) {
      setErr(e.message || "Falha ao recalcular.");
    } finally {
      setBusy(false);
    }
  }

  /* Totais */
  const totais = useMemo(() => {
    const base = {
      horas_normais: 0,
      he50_horas: 0,
      he100_horas: 0,
      valor_base: 0,
      valor_he50: 0,
      valor_he100: 0,
      proventos: 0,
      descontos: 0,
      total_liquido: 0,
    };
    for (const r of filtrados) {
      base.horas_normais += Number(r.horas_normais || 0);
      base.he50_horas += Number(r.he50_horas || 0);
      base.he100_horas += Number(r.he100_horas || 0);
      base.valor_base += Number(r.valor_base || 0);
      base.valor_he50 += Number(r.valor_he50 || 0);
      base.valor_he100 += Number(r.valor_he100 || 0);
      base.proventos += Number(r.proventos || 0);
      base.descontos += Number(r.descontos || 0);
      base.total_liquido += Number(r.total_liquido || 0);
    }
    return base;
  }, [filtrados]);

  return (
    <>
      {/* região viva para leitores de tela */}
      <div ref={liveRef} aria-live="polite" className="visually-hidden" />

      {/* HEADER */}
      <header className="page-header" role="region" aria-labelledby="titulo-pagina">
        <div>
          <h1 id="titulo-pagina" className="page-title">Folhas &rsaquo; Funcionários</h1>
          <p className="page-subtitle">
            {folhaInfo
              ? <>Competência: <strong>{folhaInfo.competencia}</strong> — Status: <strong className="capitalize">{folhaInfo.status}</strong></>
              : "Selecione uma folha para gerenciar os lançamentos."}
          </p>
        </div>

        <div className="page-header__toolbar" aria-label="Ações da página">
          <button
            className="btn btn--success"
            onClick={abrirInclusao}
            aria-label="Incluir funcionário"
            disabled={!canEdit || !folhaId}
            title={canEdit ? "Incluir funcionário" : "Folha não permite novos lançamentos"}
          >
            <PlusIcon className="icon" aria-hidden="true" />
            <span>Incluir</span>
          </button>
          <button
            className="btn btn--neutral"
            onClick={() => folhaId && carregarLista(folhaId)}
            disabled={loading || !folhaId}
            aria-busy={loading ? "true" : "false"}
            aria-label="Atualizar"
          >
            {loading ? <span className="spinner" aria-hidden="true" /> : <ArrowPathIcon className="icon" aria-hidden="true" />}
            <span>{loading ? "Atualizando…" : "Atualizar"}</span>
          </button>
          <button
            className="btn btn--neutral"
            onClick={() => recalcularSelecionados()}
            disabled={!selecionados.length || busy || !folhaId}
            aria-label="Recalcular selecionados"
            title="Recalcular selecionados"
          >
            {busy ? <span className="spinner" aria-hidden="true" /> : <ArrowPathIcon className="icon" aria-hidden="true" />}
            <span>{busy ? "Recalculando…" : "Recalcular"}</span>
          </button>
        </div>
      </header>

      {/* Seletor de Folha */}
      <div className="search-container" style={{ marginTop: -8 }}>
        <div className="form-field" style={{ maxWidth: 420 }}>
          <label htmlFor="sel_folha">Selecionar Folha</label>
          <select
            id="sel_folha"
            className="input input--lg"
            value={folhaId ?? ""}
            onChange={(e) => setFolhaId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">Selecione…</option>
            {folhas.map((f) => (
              <option key={f.id} value={f.id}>
                {f.competencia} — {String(f.status || "").toUpperCase()}
              </option>
            ))}
          </select>
          {!canEdit && folhaId && (
            <small className="hint">Esta folha está <strong>fechada</strong>. Não é possível incluir novos funcionários.</small>
          )}
        </div>
      </div>

      {err && (
        <div className="error-alert" role="alert">
          <ExclamationTriangleIcon className="icon" aria-hidden="true" /> {err}
        </div>
      )}

      {/* Busca (lista principal) */}
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
            disabled={!folhaId}
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

      {/* LISTAGEM */}
      <div className="listagem-container">
        {/* Desktop/tablet */}
        <div className="table-wrapper table-only" role="region" aria-label="Tabela de funcionários na folha">
          {!folhaId ? (
            <div className="empty-message">Selecione uma folha para visualizar os lançamentos.</div>
          ) : loading ? (
            <div className="loading-message" role="status">Carregando…</div>
          ) : filtrados.length === 0 ? (
            <div className="empty-message">Nenhum funcionário incluído nesta folha.</div>
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
                  {filtrados.map((r) => {
                    const nome = getDisplayName(r);
                    return (
                      <tr key={r.id}>
                        <td>
                          <input
                            type="checkbox"
                            aria-label={`Selecionar ${nome}`}
                            checked={selecionados.includes(r.id)}
                            onChange={(e) => toggleOne(r.id, e.target.checked)}
                          />
                        </td>
                        <td>
                          <div className="flex-col">
                            <strong>{nome}</strong>
                            {Number(r.inconsistencias || 0) > 0 && (
                              <small className="tag-warning">{r.inconsistencias} inconsistência(s)</small>
                            )}
                          </div>
                        </td>
                        <td>{getCPF(r)}</td>
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
                              aria-label={`Recalcular ${nome}`}
                              title="Recalcular"
                            >
                              <ArrowPathIcon className="icon" aria-hidden="true" />
                              <span>Recalcular</span>
                            </button>
                            <button
                              className="btn btn--danger btn--sm"
                              onClick={() => remover(r)}
                              aria-label={`Remover ${nome}`}
                              title="Remover"
                            >
                              <TrashIcon className="icon" aria-hidden="true" />
                              <span>Remover</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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
          {!folhaId ? (
            <div className="empty-message">Selecione uma folha para visualizar os lançamentos.</div>
          ) : loading ? (
            <div className="loading-message" role="status">Carregando…</div>
          ) : filtrados.length === 0 ? (
            <div className="empty-message">Nenhum funcionário incluído nesta folha.</div>
          ) : (
            <ul className="cards-grid">
              {filtrados.map((r) => (
                <li key={r.id} className="usuario-card" aria-label={`Funcionário: ${getDisplayName(r)}`}>
                  <div className="usuario-card__head">
                    <h3 className="usuario-card__title">{getDisplayName(r)}</h3>
                    <span className="badge ok">{fmtBRL(r.total_liquido)}</span>
                  </div>
                  <div className="usuario-card__body">
                    <dl className="usuario-dl">
                      <div className="usuario-dl__row">
                        <dt>CPF</dt>
                        <dd>{getCPF(r)}</dd>
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
              <div className="form-actions">
                <button
                  className="btn btn--success"
                  onClick={incluirTodos}
                  disabled={!canEdit || busy || candidatos.length === 0}
                  title={candidatos.length ? "Incluir todos os listados" : "Nenhum candidato listado"}
                >
                  <CheckIcon className="icon" aria-hidden="true" />
                  <span>Incluir todos</span>
                </button>
                <button
                  className="btn btn--neutral btn--icon-only"
                  onClick={() => setShowForm(false)}
                  aria-label="Fechar formulário"
                >
                  <XMarkIcon className="icon" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="form">
              {!canEdit ? (
                <div className="error-alert">Esta folha não permite novos lançamentos.</div>
              ) : (
                <>
                  <div className="form-field span-2">
                    <label htmlFor="ff_busca">Buscar (filtra a lista abaixo)</label>
                    <div className="search-bar">
                      <MagnifyingGlassIcon className="icon" aria-hidden="true" />
                      <input
                        id="ff_busca"
                        ref={buscaRef}
                        type="search"
                        className="input input--lg"
                        placeholder="Nome ou CPF"
                        value={query}
                        onChange={(e) => filtrarCandidatosLocal(e.target.value)}
                        autoComplete="off"
                        disabled={busy}
                      />
                      {Boolean(query) && (
                        <button
                          type="button"
                          className="btn btn--neutral btn--icon-only"
                          onClick={() => { setQuery(""); setCandidatos(candidatosAll); }}
                          aria-label="Limpar"
                        >
                          <XMarkIcon className="icon" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                    <small className="hint">
                      Lista mostra <strong>todos</strong> os colaboradores ativos da empresa que ainda não estão nesta folha.
                    </small>
                  </div>

                  <div className="form-field span-2">
                    <div className="stat-card" style={{ maxHeight: 360, overflow: "auto" }}>
                      {busy ? (
                        <div className="loading-message">Carregando candidatos…</div>
                      ) : candidatos.length === 0 ? (
                        <div className="empty-message">Nenhum candidato disponível.</div>
                      ) : (
                        <ul className="simple-list">
                          {candidatos.map((c) => (
                            <li key={c.funcionario_id} className="simple-list__item">
                              <div className="simple-list__content">
                                <div className="simple-list__title">{getDisplayName(c)}</div>
                                <div className="simple-list__subtitle">CPF: {getCPF(c)}</div>
                              </div>
                              <div className="simple-list__actions">
                                <button
                                  className="btn btn--success btn--sm"
                                  onClick={() => incluirFuncionario(c)}
                                  disabled={busy}
                                >
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
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* estilos locais mínimos */}
      <style jsx>{`
        .listagem-container { width: 100%; }
        .search-container { margin-bottom: 16px; }
        .ta-right { text-align: right; }
        .tabular { font-variant-numeric: tabular-nums; }
        .strong { font-weight: 700; }
        .flex-col { display: flex; flex-direction: column; gap: 4px; }
        .tag-warning { background: rgba(245,158,11,.15); color: #b45309; border: 1px solid rgba(245,158,11,.35); padding: 2px 6px; border-radius: 999px; display: inline-block; }
        .capitalize { text-transform: capitalize; }

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
        .usuario-card__actions { display: flex; gap: 6px; }

        /* Simple list */
        .simple-list { list-style: none; padding: 0; margin: 0; }
        .simple-list__item { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 12px; border-bottom: 1px solid var(--border); }
        .simple-list__title { font-weight: 600; }
        .simple-list__subtitle { font-size: var(--fs-12); color: var(--muted); }
        .simple-list__actions { display: flex; gap: 6px; }
        .form-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .form-actions { display: inline-flex; align-items: center; gap: 8px; }
      `}</style>
    </>
  );
}