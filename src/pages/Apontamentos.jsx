import { useCallback, useEffect, useMemo, useState, useRef } from "react"; import { PlusIcon, ArrowPathIcon, CheckIcon, XMarkIcon, WrenchScrewdriverIcon, DocumentArrowDownIcon, } from "@heroicons/react/24/solid";

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");

/* ===================== helpers de data e hora ===================== */ function toISO(d) { const yy = d.getFullYear(); const mm = String(d.getMonth() + 1).padStart(2, "0"); const dd = String(d.getDate()).padStart(2, "0"); return ${yy}-${mm}-${dd}; } function fromISO(s) { const [y, m, d] = String(s).split("-").map(Number); return new Date(y, m - 1, d); } function firstDayOfMonth(d = new Date()) { return new Date(d.getFullYear(), d.getMonth(), 1); } function lastDayOfMonth(d = new Date()) { return new Date(d.getFullYear(), d.getMonth() + 1, 0); } function minutes(hhmm) { if (!hhmm) return 0; const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; } function fmtHHMM(min) { const h = Math.floor(min / 60); const m = min % 60; return ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}; } function duracao(entrada, saida) { const a = minutes(entrada); const b = minutes(saida); if (!entrada || !saida) return 0; // não consideramos virada de dia aqui (UI orienta dividir em 2 registros) return Math.max(0, b - a); } function isHHMM(v) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(v || "")); }

/* ===================== UI: Badge de origem ===================== */ function OrigemBadge({ origem }) { const o = String(origem || "").toUpperCase(); const map = { APONTADO: { bg: "rgba(59,130,246,.12)", fg: "#2563eb", label: "APONTADO" }, IMPORTADO: { bg: "rgba(16,185,129,.15)", fg: "#047857", label: "IMPORTADO" }, AJUSTE: { bg: "rgba(234,179,8,.20)", fg: "#92400e", label: "AJUSTE" }, INVALIDADA: { bg: "rgba(239,68,68,.15)", fg: "#b91c1c", label: "INVALIDADA" }, }; const sty = map[o] || map.APONTADO; return ( <span className="badge" style={{ background: sty.bg, color: sty.fg, border: "1px solid color-mix(in srgb, currentColor 25%, transparent)", }} > {sty.label} </span> ); }

/* ===================== Página ===================== / export default function Apontamentos() { / -------- filtros -------- */ const [periodo, setPeriodo] = useState({ de: toISO(firstDayOfMonth(new Date())), ate: toISO(lastDayOfMonth(new Date())), }); const [funcionarioId, setFuncionarioId] = useState(""); const [origem, setOrigem] = useState("");

/* -------- dados -------- */ const [funcionarios, setFuncionarios] = useState([]); const [itens, setItens] = useState([]);

/* -------- ui -------- */ const [loading, setLoading] = useState(false); const [err, setErr] = useState(""); const [success, setSuccess] = useState("");

/* -------- Form de AJUSTE -------- */ const [showForm, setShowForm] = useState(false); const [form, setForm] = useState({ funcionario_id: "", data: toISO(new Date()), turno_ordem: 1, entrada: "", saida: "", origem: "AJUSTE", // sempre ajuste obs: "", });

/* -------- Modal PTRP/Tratamento -------- */ const [showTratamento, setShowTratamento] = useState(false); const [tratamento, setTratamento] = useState({ apontamento_id_original: null, destino_funcionario_id: "", data: "", entrada: "", saida: "", justificativa: "", invalidar_original: true, });

/* -------- Import modal -------- */ const [showImport, setShowImport] = useState(false); const [csvText, setCsvText] = useState(""); const [preview, setPreview] = useState({ validas: [], invalidas: [], conflitos: [] });

const liveRef = useRef(null); const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

/* ---------------- API helper ---------------- */ const api = useCallback(async (path, init = {}) => { const r = await fetch(${API_BASE}${path}, { credentials: "include", ...init }); const data = await r.json().catch(() => ({})); if (!r.ok || data?.ok === false) throw new Error(data?.error || HTTP ${r.status}); return data; }, []);

/* ---------------- Carregamentos ---------------- */ const loadFuncionarios = useCallback(async () => { const d = await api(/api/funcionarios?ativos=1); setFuncionarios(d.funcionarios || []); }, [api]);

const loadItens = useCallback(async () => { const qs = new URLSearchParams({ from: periodo.de, to: periodo.ate, ...(funcionarioId ? { funcionario_id: funcionarioId } : {}), ...(origem ? { origem } : {}), }).toString(); const d = await api(/api/apontamentos?${qs}); setItens(d.apontamentos || []); }, [api, periodo, funcionarioId, origem]);

const recarregar = useCallback(async () => { setErr(""); setSuccess(""); setLoading(true); try { await Promise.all([loadFuncionarios(), loadItens()]); if (liveRef.current) liveRef.current.textContent = "Lista de apontamentos atualizada."; } catch (e) { setErr(e.message || "Falha ao carregar."); if (liveRef.current) liveRef.current.textContent = "Erro ao carregar apontamentos."; } finally { setLoading(false); } }, [loadFuncionarios, loadItens]);

useEffect(() => { recarregar(); }, [recarregar]); useEffect(() => { loadItens(); }, [periodo, funcionarioId, origem]);

/* ---------------- Ações ---------------- */ const novoAjuste = () => { setForm({ funcionario_id: funcionarioId || "", data: periodo.de, turno_ordem: 1, entrada: "", saida: "", origem: "AJUSTE", obs: "", }); setShowForm(true); };

function validarFormLocal(f) { if (!f.funcionario_id) return "Selecione um funcionário."; if (!f.data) return "Selecione a data."; if (f.entrada && !isHHMM(f.entrada)) return "Hora de entrada inválida."; if (f.saida && !isHHMM(f.saida)) return "Hora de saída inválida."; if (f.entrada && f.saida && minutes(f.saida) < minutes(f.entrada)) { return "Saída menor que a entrada. Para virada de dia, lance dois apontamentos (noite e madrugada)."; } return null; }

const salvarAjuste = async (e) => { e?.preventDefault?.(); setErr(""); setSuccess("");

const payload = {
  funcionario_id: Number(form.funcionario_id),
  data: form.data,
  turno_ordem: Number(form.turno_ordem) || 1,
  entrada: form.entrada || null,
  saida: form.saida || null,
  origem: "AJUSTE",
  obs: form.obs || null,
};

const v = validarFormLocal(payload);
if (v) { setErr(v); return; }

try {
  await api(`/api/apontamentos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  setSuccess("Ajuste criado.");
  setShowForm(false);
  await loadItens();
  if (liveRef.current) liveRef.current.textContent = "Ajuste salvo com sucesso.";
} catch (e) {
  setErr(e.message || "Falha ao salvar ajuste.");
  if (liveRef.current) liveRef.current.textContent = "Erro ao salvar ajuste.";
}

};

function tratar(item) { setTratamento({ apontamento_id_original: item.id, destino_funcionario_id: String(item.funcionario_id), data: item.data, entrada: item.entrada || "", saida: item.saida || "", justificativa: "", invalidar_original: true, }); setShowTratamento(true); }

async function enviarTratamento() { setErr(""); setSuccess(""); try { await api(/api/ptrp/ajustes, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "invalidar_e_criar_ajuste", ...tratamento, }), }); setSuccess("Tratamento aplicado: original invalidado e ajuste criado."); setShowTratamento(false); await loadItens(); if (liveRef.current) liveRef.current.textContent = "Tratamento aplicado com sucesso."; } catch (e) { setErr(e.message || "Falha ao aplicar tratamento."); if (liveRef.current) liveRef.current.textContent = "Erro ao aplicar tratamento."; } }

/* ---------------- Import (CSV) ---------------- */ function parseCSV(text) { const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean); const out = []; for (const line of lines) { const [funcionario_id, data, turno_ordem, entrada, saida, origem, obs] = line .split(";") .map((s) => s?.trim()); out.push({ funcionario_id, data, turno_ordem, entrada, saida, origem, obs }); } return out; }

function validarLote(rows) { const validas = []; const invalidas = []; const keySet = new Set();

rows.forEach((r, idx) => {
  const row = {
    funcionario_id: Number(r.funcionario_id),
    data: r.data,
    turno_ordem: Number(r.turno_ordem) || 1,
    entrada: r.entrada || null,
    saida: r.saida || null,
    origem: String(r.origem || "APONTADO").toUpperCase(),
    obs: r.obs || null,
    _idx: idx + 1,
  };

  let motivo = "";
  if (!row.funcionario_id) motivo = "funcionario_id vazio";
  else if (!row.data || !/^\d{4}-\d{2}-\d{2}$/.test(row.data)) motivo = "data inválida (YYYY-MM-DD)";
  else if (row.entrada && !isHHMM(row.entrada)) motivo = "entrada inválida";
  else if (row.saida && !isHHMM(row.saida)) motivo = "saída inválida";
  else if (row.entrada && row.saida && minutes(row.saida) < minutes(row.entrada)) motivo = "saida < entrada";

  const k = `${row.funcionario_id}|${row.data}|${row.turno_ordem}|${row.origem}`;
  if (!motivo && keySet.has(k)) motivo = "linha duplicada no arquivo";
  if (!motivo) keySet.add(k);

  if (motivo) invalidas.push({ ...row, motivo });
  else validas.push(row);
});

return { validas, invalidas };

}

function onBuildPreview() { const rows = parseCSV(csvText); const p = validarLote(rows);

const existentes = new Set(
  itens.map(
    (it) => `${it.funcionario_id}|${it.data}|${it.turno_ordem}|${String(it.origem || "").toUpperCase()}`
  )
);
const conflitos = p.validas.filter((v) => existentes.has(`${v.funcionario_id}|${v.data}|${v.turno_ordem}|${v.origem}`));
const validasSemConflito = p.validas.filter((v) => !existentes.has(`${v.funcionario_id}|${v.data}|${v.turno_ordem}|${v.origem}`));

setPreview({ validas: validasSemConflito, invalidas: p.invalidas, conflitos });

}

const importarValidas = async () => { if (!preview.validas.length) return; setErr(""); setSuccess(""); try { await api(/api/apontamentos/import, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows: preview.validas }), }); setSuccess(Importadas ${preview.validas.length} linhas. Recusadas ${preview.invalidas.length + preview.conflitos.length}.); setShowImport(false); setCsvText(""); setPreview({ validas: [], invalidas: [], conflitos: [] }); await loadItens(); if (liveRef.current) liveRef.current.textContent = "Apontamentos importados com sucesso."; } catch (e) { setErr(e.message || "Falha ao importar."); if (liveRef.current) liveRef.current.textContent = "Erro ao importar apontamentos."; } };

/* ---------------- Derivados ---------------- */ const totalMinutosPeriodo = useMemo( () => itens.reduce((acc, it) => acc + duracao(it.entrada, it.saida), 0), [itens] );

const onOverlayKeyDown = (ev) => { if (ev.key === "Escape") { setShowForm(false); setShowImport(false); setShowTratamento(false); } };

return ( <> {/* região viva para leitores de tela */} <div ref={liveRef} aria-live="polite" className="visually-hidden" />

{/* HEADER NO PADRÃO GLOBAL */}
  <header className="page-header" role="region" aria-labelledby="titulo-pagina">
    <div>
      <h1 id="titulo-pagina" className="page-title">Apontamentos</h1>
      <p className="page-subtitle">
        Controle de batidas e ajustes (sem editar/excluir oficiais). Total no período: <strong>{fmtHHMM(totalMinutosPeriodo)}</strong>
      </p>
    </div>

    <div className="page-header__toolbar" aria-label="Ações da página">
      <button className="btn btn--success" onClick={novoAjuste} aria-label="Criar ajuste de apontamento">
        <PlusIcon className="icon" aria-hidden="true" />
        <span>Novo AJUSTE</span>
      </button>
      <button
        className="btn btn--neutral"
        onClick={() => setShowImport(true)}
        aria-label="Importar apontamentos via CSV"
      >
        <DocumentArrowDownIcon className="icon" aria-hidden="true" />
        <span>Importar CSV</span>
      </button>
      <button
        className="btn btn--neutral"
        onClick={recarregar}
        disabled={loading}
        aria-busy={loading ? "true" : "false"}
        aria-label="Atualizar lista de apontamentos"
      >
        {loading ? <span className="spinner" aria-hidden="true" /> : <ArrowPathIcon className="icon" aria-hidden="true" />}
        <span>{loading ? "Atualizando…" : "Atualizar"}</span>
      </button>
    </div>
  </header>

  {err && <div className="error-alert" role="alert">{err}</div>}
  {success && <div className="success-alert" role="status">{success}</div>}

  {/* Filtros */}
  <div className="search-container">
    <div className="filters-grid" role="search" aria-label="Filtrar apontamentos">
      <div className="form-field">
        <label htmlFor="filtro-de" className="form-label">Período de</label>
        <input
          id="filtro-de"
          type="date"
          value={periodo.de}
          onChange={(e) => setPeriodo((p) => ({ ...p, de: e.target.value }))}
          className="input"
        />
      </div>
      <div className="form-field">
        <label htmlFor="filtro-ate" className="form-label">Até</label>
        <input
          id="filtro-ate"
          type="date"
          value={periodo.ate}
          onChange={(e) => setPeriodo((p) => ({ ...p, ate: e.target.value }))}
          className="input"
        />
      </div>
      <div className="form-field">
        <label htmlFor="filtro-funcionario" className="form-label">Funcionário</label>
        <select
          id="filtro-funcionario"
          value={funcionarioId}
          onChange={(e) => setFuncionarioId(e.target.value)}
          className="input"
        >
          <option value="">Todos</option>
          {funcionarios.map((f) => (
            <option key={f.id} value={f.id}>
              {f.pessoa_nome} - {f.cargo_nome}
            </option>
          ))}
        </select>
      </div>
      <div className="form-field">
        <label htmlFor="filtro-origem" className="form-label">Origem</label>
        <select
          id="filtro-origem"
          value={origem}
          onChange={(e) => setOrigem(e.target.value)}
          className="input"
        >
          <option value="">Todas</option>
          <option value="APONTADO">APONTADO</option>
          <option value="IMPORTADO">IMPORTADO</option>
          <option value="AJUSTE">AJUSTE</option>
          <option value="INVALIDADA">INVALIDADA</option>
        </select>
      </div>
    </div>
  </div>

  {/* LISTAGEM: Tabela (desktop) + Cards (mobile) */}
  <div className="listagem-container">
    {/* Desktop/tablet: Tabela */}
    <div className="table-wrapper table-only" role="region" aria-label="Tabela de apontamentos">
      {loading ? (
        <div className="loading-message" role="status">Carregando…</div>
      ) : itens.length === 0 ? (
        <div className="empty-message">Nenhum apontamento encontrado.</div>
      ) : (
        <div className="stat-card" style={{ overflow: "hidden" }}>
          <table className="apontamentos-table">
            <thead>
              <tr>
                <th scope="col">Data</th>
                <th scope="col">Funcionário</th>
                <th scope="col">Turno</th>
                <th scope="col">Entrada</th>
                <th scope="col">Saída</th>
                <th scope="col">Duração</th>
                <th scope="col">Origem</th>
                <th scope="col">Obs</th>
                <th scope="col" className="actions-column">Ações</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((it) => {
                const f = funcionarios.find((x) => x.id === it.funcionario_id);
                const minutos = duracao(it.entrada, it.saida);
                const inconsistencia = it.entrada && it.saida && minutes(it.saida) < minutes(it.entrada);

                return (
                  <tr key={it.id} className={inconsistencia ? "row-inconsistente" : ""}>
                    <td>{it.data}</td>
                    <td>{f ? `${f.pessoa_nome} - ${f.cargo_nome}` : `#${it.funcionario_id}`}</td>
                    <td>#{it.turno_ordem}</td>
                    <td>{it.entrada || "-"}</td>
                    <td>{it.saida || "-"}</td>
                    <td>
                      <strong>{fmtHHMM(minutos)}</strong>
                      {inconsistencia && " ⚠️"}
                    </td>
                    <td>
                      <OrigemBadge origem={it.origem} />
                    </td>
                    <td className="obs-cell" title={it.obs || ""}>
                      {it.obs || "-"}
                    </td>
                    <td>
                      <div className="actions-buttons">
                        <button
                          className="btn btn--warning btn--sm"
                          onClick={() => tratar(it)}
                          aria-label={`Tratar apontamento de ${it.data}`}
                          title="Invalidar por tratamento e criar ajuste"
                        >
                          <WrenchScrewdriverIcon className="icon" aria-hidden="true" />
                          <span>Tratar</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>

    {/* Mobile: Cards */}
    <div className="cards-wrapper cards-only" role="region" aria-label="Lista de apontamentos (versão cartões)">
      {loading ? (
        <div className="loading-message" role="status">Carregando…</div>
      ) : itens.length === 0 ? (
        <div className="empty-message">Nenhum apontamento encontrado.</div>
      ) : (
        <ul className="cards-grid" aria-label="Cartões de apontamentos">
          {itens.map((it) => {
            const f = funcionarios.find((x) => x.id === it.funcionario_id);
            const minutos = duracao(it.entrada, it.saida);
            const inconsistencia = it.entrada && it.saida && minutes(it.saida) < minutes(it.entrada);

            return (
              <li key={it.id} className={`apontamento-card ${inconsistencia ? "card-inconsistente" : ""}`}>
                <div className="apontamento-card__head">
                  <h3 className="apontamento-card__title">{it.data}</h3>
                  <div className="apontamento-card__badges">
                    <OrigemBadge origem={it.origem} />
                    {inconsistencia && <span className="badge badge--warning">⚠️ Inconsistente</span>}
                  </div>
                </div>
                <div className="apontamento-card__body">
                  <dl className="apontamento-dl">
                    <div className="apontamento-dl__row">
                      <dt>Funcionário</dt>
                      <dd>{f ? `${f.pessoa_nome} - ${f.cargo_nome}` : `#${it.funcionario_id}`}</dd>
                    </div>
                    <div className="apontamento-dl__row">
                      <dt>Turno</dt>
                      <dd>#{it.turno_ordem}</dd>
                    </div>
                    <div className="apontamento-dl__row">
                      <dt>Entrada/Saída</dt>
                      <dd>
                        {it.entrada || "-"} → {it.saida || "-"}
                      </dd>
                    </div>
                    <div className="apontamento-dl__row">
                      <dt>Duração</dt>
                      <dd>
                        <strong>{fmtHHMM(minutos)}</strong>
                      </dd>
                    </div>
                    {it.obs && (
                      <div className="apontamento-dl__row">
                        <dt>Observação</dt>
                        <dd>{it.obs}</dd>
                      </div>
                    )}
                  </dl>
                </div>
                <div className="apontamento-card__actions">
                  <button
                    className="btn btn--warning btn--sm"
                    onClick={() => tratar(it)}
                    aria-label={`Tratar apontamento de ${it.data}`}
                    title="Invalidar por tratamento e criar ajuste"
                  >
                    <WrenchScrewdriverIcon className="icon" aria-hidden="true" />
                    <span>Tratar</span>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  </div>

  {/* FORMULÁRIO DE AJUSTE (DIALOG OVERLAY) */}
  {showForm && (
    <div
      className="form-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-form"
      onKeyDown={onOverlayKeyDown}
    >
      <div className="form-container">
        <div className="form-header">
          <h2 id="titulo-form">Novo Ajuste</h2>
          <button
            className="btn btn--neutral btn--icon-only"
            onClick={() => setShowForm(false)}
            aria-label="Fechar formulário"
            title="Fechar"
          >
            <XMarkIcon className="icon" aria-hidden="true" />
          </button>
        </div>

        <form className="form" onSubmit={salvarAjuste}>
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="a_funcionario">Funcionário *</label>
              <select
                id="a_funcionario"
                value={form.funcionario_id}
                onChange={(e) => setField("funcionario_id", e.target.value)}
                required
              >
                <option value="">Selecione…</option>
                {funcionarios.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.pessoa_nome} - {f.cargo_nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="a_data">Data *</label>
              <input
                id="a_data"
                type="date"
                value={form.data}
                onChange={(e) => setField("data", e.target.value)}
                required
              />
            </div>

            <div className="form-field">
              <label htmlFor="a_turno">Turno (ordem)</label>
              <input
                id="a_turno"
                type="number"
                min="1"
                value={form.turno_ordem}
                onChange={(e) => setField("turno_ordem", parseInt(e.target.value) || 1)}
              />
            </div>

            <div className="form-field">
              <label htmlFor="a_entrada">Entrada</label>
              <input
                id="a_entrada"
                type="time"
                value={form.entrada}
                onChange={(e) => setField("entrada", e.target.value)}
              />
            </div>

            <div className="form-field">
              <label htmlFor="a_saida">Saída</label>
              <input
                id="a_saida"
                type="time"
                value={form.saida}
                onChange={(e) => setField("saida", e.target.value)}
              />
            </div>

            <div className="form-field">
              <label>Origem</label>
              <input value="AJUSTE" readOnly className="input" aria-readonly="true" />
            </div>

            <div className="form-field span-2">
              <label htmlFor="a_obs">Observação</label>
              <textarea
                id="a_obs"
                rows={3}
                value={form.obs}
                onChange={(e) => setField("obs", e.target.value)}
                placeholder="Observações sobre o ajuste..."
              />
            </div>
          </div>

          {/* Validação */}
          {form.entrada && form.saida && minutes(form.saida) < minutes(form.entrada) && (
            <div className="error-alert" style={{ marginTop: 12 }}>
              Saída menor que a entrada. Para virada de dia, lance dois apontamentos (noite/madrugada).
            </div>
          )}

          <div className="form-actions">
            <button type="button" className="btn btn--neutral" onClick={() => setShowForm(false)}>
              <XMarkIcon className="icon" aria-hidden="true" />
              <span>Cancelar</span>
            </button>
            <button type="submit" className="btn btn--success">
              <CheckIcon className="icon" aria-hidden="true" />
              <span>Criar ajuste</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )}

  {/* MODAL DE IMPORTAÇÃO */}
  {showImport && (
    <div
      className="form-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-import"
      onKeyDown={onOverlayKeyDown}
    >
      <div className="form-container" style={{ maxWidth: "800px", maxHeight: "90vh" }}>
        <div className="form-header">
          <h2 id="titulo-import">Importar Apontamentos (CSV)</h2>
          <button
            className="btn btn--neutral btn--icon-only"
            onClick={() => setShowImport(false)}
            aria-label="Fechar importação"
            title="Fechar"
          >
            <XMarkIcon className="icon" aria-hidden="true" />
          </button>
        </div>

        <div className="form">
          <p style={{ marginTop: 0, color: "var(--muted)" }}>
            Formato: <code>funcionario_id;data;turno_ordem;entrada;saida;origem;obs</code> — datas <code>YYYY-MM-DD</code>, horas <code>HH:MM</code>.
          </p>

          <div className="form-field span-2">
            <label htmlFor="csv-data">Dados CSV</label>
            <textarea
              id="csv-data"
              rows={8}
              placeholder="123;2025-10-01;1;08:00;12:00;APONTADO;Chegou no horário"
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              style={{ resize: "vertical" }}
            />
          </div>

          {(preview.validas.length + preview.invalidas.length + preview.conflitos.length) > 0 && (
            <div className="preview-stats">
              <div className="stat-card" data-accent="success">
                <strong>Válidas</strong>
                <div>{preview.validas.length} linhas</div>
              </div>
              <div className="stat-card" data-accent="danger">
                <strong>Inválidas</strong>
                <div>{preview.invalidas.length} linhas</div>
              </div>
              <div className="stat-card" data-accent="warning">
                <strong>Conflitos</strong>
                <div>{preview.conflitos.length} linhas</div>
              </div>
            </div>
          )}

          <div className="form-actions">
            <button type="button" className="btn btn--neutral" onClick={() => setShowImport(false)}>
              <XMarkIcon className="icon" aria-hidden="true" />
              <span>Fechar</span>
            </button>
            <button type="button" className="btn btn--neutral" onClick={onBuildPreview}>
              <ArrowPathIcon className="icon" aria-hidden="true" />
              <span>Pré-visualizar</span>
            </button>
            <button
              type="button"
              className="btn btn--success"
              onClick={importarValidas}
              disabled={!preview.validas.length}
            >
              <CheckIcon className="icon" aria-hidden="true" />
              <span>Importar {preview.validas.length} válidas</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )}

  {/* MODAL DE TRATAMENTO (PTRP) */}
  {showTratamento && (
    <div
      className="form-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-tratar"
      onKeyDown={onOverlayKeyDown}
    >
      <div className="form-container" style={{ maxWidth: 680 }}>
        <div className="form-header">
          <h2 id="titulo-tratar">Tratar Apontamento (PTRP)</h2>
          <button
            className="btn btn--neutral btn--icon-only"
            onClick={() => setShowTratamento(false)}
            aria-label="Fechar tratamento"
            title="Fechar"
          >
            <XMarkIcon className="icon" aria-hidden="true" />
          </button>
        </div>

        <div className="form">
          <p className="page-subtitle" style={{ marginTop: 0 }}>
            Esta ação <strong>não edita</strong> o apontamento original. Ela o <strong>invalida por tratamento</strong> e cria um <strong>AJUSTE</strong> para a pessoa correta.
          </p>

          <div className="form-grid">
            <div className="form-field">
              <label>Funcionário destino *</label>
              <select
                value={tratamento.destino_funcionario_id}
                onChange={(e) => setTratamento((t) => ({ ...t, destino_funcionario_id: e.target.value }))}
                required
              >
                <option value="">Selecione…</option>
                {funcionarios.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.pessoa_nome} - {f.cargo_nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label>Data *</label>
              <input
                type="date"
                value={tratamento.data}
                onChange={(e) => setTratamento((t) => ({ ...t, data: e.target.value }))}
                required
              />
            </div>

            <div className="form-field">
              <label>Entrada</label>
              <input
                type="time"
                value={tratamento.entrada}
                onChange={(e) => setTratamento((t) => ({ ...t, entrada: e.target.value }))}
              />
            </div>

            <div className="form-field">
              <label>Saída</label>
              <input
                type="time"
                value={tratamento.saida}
                onChange={(e) => setTratamento((t) => ({ ...t, saida: e.target.value }))}
              />
            </div>

            <div className="form-field span-2">
              <label>Justificativa *</label>
              <textarea
                rows={3}
                value={tratamento.justificativa}
                onChange={(e) => setTratamento((t) => ({ ...t, justificativa: e.target.value }))}
                required
                placeholder="Ex.: RH lançou para o CPF errado; ajuste direciona para o funcionário correto."
              />
            </div>

            <div className="form-field span-2" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                id="inv-orig"
                type="checkbox"
                checked={tratamento.invalidar_original}
                onChange={(e) => setTratamento((t) => ({ ...t, invalidar_original: e.target.checked }))}
              />
              <label htmlFor="inv-orig">Invalidar original por tratamento</label>
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn--neutral" onClick={() => setShowTratamento(false)}>
              <XMarkIcon className="icon" aria-hidden="true" />
              <span>Cancelar</span>
            </button>
            <button type="button" className="btn btn--success" onClick={enviarTratamento}>
              <CheckIcon className="icon" aria-hidden="true" />
              <span>Aplicar tratamento</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )}

  <style jsx>{`
    .listagem-container { width: 100%; }
    .search-container { margin-bottom: 16px; }

    .filters-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 12px;
    }

    .table-only { display: block; }
    .cards-only { display: none; }
    @media (max-width: 768px) {
      .table-only { display: none; }
      .cards-only { display: block; }
    }

    /* Tabela */
    .apontamentos-table th,
    .apontamentos-table td { white-space: nowrap; }
    .apontamentos-table td:first-child,
    .apontamentos-table th:first-child { white-space: normal; }
    .obs-cell { max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .row-inconsistente { background: rgba(220,38,38,.05) !important; }
    .actions-buttons { display: flex; gap: 6px; flex-wrap: wrap; }

    /* Cards grid (mobile) */
    .cards-grid { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: 1fr; gap: 12px; }
    .apontamento-card { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; box-shadow: var(--shadow); overflow: hidden; position: relative; }
    .apontamento-card::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: var(--accent-bg); }
    .card-inconsistente::before { background: var(--error); }
    .apontamento-card__head { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 14px 14px 0 14px; }
    .apontamento-card__title { margin: 0; font-size: 1rem; font-weight: 700; color: var(--fg); }
    .apontamento-card__badges { display: flex; gap: 6px; flex-wrap: wrap; }
    .badge { font-size: 0.75rem; padding: 2px 8px; border-radius: 999px; border: 1px solid var(--border); }
    .badge--warning { background: rgba(234,179,8,.20); color: #92400e; border-color: rgba(234,179,8,.35); }
    .apontamento-card__body { padding: 12px 14px 14px 14px; }
    .apontamento-dl { margin: 0; display: grid; gap: 8px; }
    .apontamento-dl__row { display: grid; grid-template-columns: 100px 1fr; gap: 8px; align-items: baseline; }
    .apontamento-dl__row dt { color: var(--muted); font-weight: 600; font-size: var(--fs-12); }
    .apontamento-dl__row dd { margin: 0; color: var(--fg); font-weight: 500; word-break: break-word; }
    .apontamento-card__actions { display: flex; gap: 6px; flex-wrap: wrap; padding: 0 14px 14px 14px; }

    /* Preview stats */
    .preview-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin: 16px 0; }

    /* Form grid responsivo */
    .form-grid { display: grid; grid-template-columns: 1fr; gap: 12px; }
    .form-field { display: flex; flex-direction: column; gap: 6px; }
    .form-field input, .form-field select, .form-field textarea { min-height: 44px; padding: 10px 12px; border: 1px solid var(--border); border-radius: 12px; background: #fff; color: #111; font-size: var(--fs-16); }
    .form-field textarea { min-height: 80px; resize: vertical; }
    .form-field input:focus-visible, .form-field select:focus-visible, .form-field textarea:focus-visible { outline: 3px solid var(--focus); outline-offset: 2px; }
    .form-field.span-2 { grid-column: span 1; }
    @media (min-width: 640px) { .form-grid { grid-template-columns: 1fr 1fr; } .form-field.span-2 { grid-column: span 2; } }
    @media (max-width: 480px) { .apontamento-dl__row { grid-template-columns: 90px 1fr; } .apontamento-card__title { font-size: 0.95rem; } .filters-grid { grid-template-columns: 1fr; } }
  `}</style>
</>

); }

