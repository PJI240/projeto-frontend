// src/pages/FolhasFuncionarios.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowPathIcon,
  CalculatorIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CloudArrowDownIcon,
  ExclamationTriangleIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
  UserIcon,
} from "@heroicons/react/24/solid";

const API_BASE = (import.meta.env.VITE_API_BASE?.replace(/\/+$/, "") || "");

/* ========= Utils ========= */
const norm = (v) => (v ?? "").toString().trim();

/** Aceita "YYYY-MM", "YYYY-MM-DD" e nomes de mês PT-BR -> retorna "YYYY-MM" */
function normalizeYM(input) {
  const s = norm(input).toLowerCase();
  if (!s) return null;
  const mIso = s.match(/^(\d{4})-(\d{2})(?:-\d{2})?$/);
  if (mIso) return `${mIso[1]}-${mIso[2]}`;
  const meses = {
    janeiro: "01", fevereiro: "02", março: "03", marco: "03", abril: "04", maio: "05", junho: "06",
    julho: "07", agosto: "08", setembro: "09", outubro: "10", novembro: "11", dezembro: "12",
  };
  const mBr = s.match(/(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro).*?(\d{4})/i);
  if (mBr) return `${mBr[2]}-${meses[mBr[1].toLowerCase()]}`;
  return null;
}

function monthISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}
function fromMonthISO(s) {
  const [y, m] = String(s || "").split("-").map(Number);
  if (!y || !m) return null;
  return new Date(y, m - 1, 1);
}
function formatMonthBR(sISO) {
  const d = fromMonthISO(sISO);
  return d ? d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) : sISO || "";
}
function toCSV(rows) {
  if (!rows?.length) return "";
  const keys = Object.keys(rows[0]);
  const header = keys.join(";");
  const body = rows
    .map((r) =>
      keys
        .map((k) => {
          const v = r[k] ?? "";
          const s = typeof v === "string" ? v.replaceAll('"', '""') : String(v);
          return `"${s}"`;
        })
        .join(";")
    )
    .join("\n");
  return header + "\n" + body;
}
function money(n) {
  if (n == null || isNaN(n)) return "R$ 0,00";
  return Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function dec(v) {
  const x = Number(String(v).replace(",", "."));
  return Number.isFinite(x) ? x : 0;
}

/* ========= API helper ========= */
function useApi() {
  return useCallback(async (path, init = {}) => {
    const url = `${API_BASE}${path}`;
    const reqInit = { credentials: "include", ...init };
    const r = await fetch(url, reqInit);
    let data = null;
    try { data = await r.json(); } catch {}
    if (!r.ok || data?.ok === false) {
      // erro mais descritivo p/ debug
      let payload = "";
      try { payload = reqInit.body ? ` | body=${JSON.stringify(JSON.parse(reqInit.body))}` : ""; } catch {}
      throw new Error(`[${reqInit.method || "GET"} ${path}] ${data?.error || `HTTP ${r.status}`}${payload}`);
    }
    return data;
  }, []);
}

/* ========= Página ========= */
export default function FolhasFuncionarios() {
  const api = useApi();
  const liveRef = useRef(null);

  // filtros
  const [periodo, setPeriodo] = useState("mes");
  const [from, setFrom] = useState(() => monthISO(new Date()));
  const [to, setTo] = useState(() => monthISO(new Date()));
  const [funcionarioFiltro, setFuncionarioFiltro] = useState("todos");
  const [q, setQ] = useState("");

  // dados
  const [lista, setLista] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const refTimer = useRef(null);

  // modal
  const [openModal, setOpenModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    folha_id: "",
    competencia: monthISO(new Date()), // sempre "YYYY-MM"
    funcionario_id: "",
    horas_normais: "",
    he50_horas: "",
    he100_horas: "",
    valor_base: "",
    valor_he50: "",
    valor_he100: "",
    descontos: "",
    proventos: "",
    total_liquido: "",
    inconsistencias: 0,
  });

  /* ====== carregar ====== */
  const carregarFuncionarios = useCallback(async () => {
    const d = await api(`/api/funcionarios?ativos=1`);
    setFuncionarios(d.funcionarios || []);
  }, [api]);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErr(""); setOkMsg("");
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", normalizeYM(from) || from);
      if (to) params.set("to", normalizeYM(to) || to);
      if (q) params.set("q", q);
      if (funcionarioFiltro !== "todos") params.set("funcionario_id", funcionarioFiltro);

      const d = await api(`/api/folhas-funcionarios?${params.toString()}`);
      setLista(Array.isArray(d.items) ? d.items : (d.folhas_funcionarios || []));
      if (liveRef.current) liveRef.current.textContent = "Folhas/Funcionários atualizados.";
    } catch (e) {
      setErr(e.message || "Falha ao carregar.");
      if (liveRef.current) liveRef.current.textContent = "Erro ao atualizar a lista.";
    } finally {
      setLoading(false);
    }
  }, [api, from, to, q, funcionarioFiltro]);

  useEffect(() => {
    // executa cada carga isoladamente para não mascarar a origem do erro
    (async () => {
      try { await carregarFuncionarios(); }
      catch (e) { setErr((prev) => prev || `Falha ao carregar funcionários: ${e.message}`); }
    })();
    (async () => {
      try { await carregar(); }
      catch (e) { setErr((prev) => prev || `Falha ao carregar lançamentos: ${e.message}`); }
    })();
  }, [carregar, carregarFuncionarios]);

  useEffect(() => {
    if (autoRefresh) {
      refTimer.current = setInterval(() => carregar(), 60000);
    } else if (refTimer.current) {
      clearInterval(refTimer.current);
      refTimer.current = null;
    }
    return () => refTimer.current && clearInterval(refTimer.current);
  }, [autoRefresh, carregar]);

  /* ====== filtros aplicados/kpis ====== */
  const filtrados = useMemo(() => {
    const qn = q.toLowerCase();
    const f = normalizeYM(from) || from;
    const t = normalizeYM(to) || to;
    return lista.filter((r) => {
      if (funcionarioFiltro !== "todos" && String(r.funcionario_id) !== String(funcionarioFiltro)) return false;
      if (f && r.competencia < f) return false;
      if (t && r.competencia > t) return false;
      if (qn) {
        const alvo = `${r.id} ${r.funcionario_nome} ${r.competencia}`.toLowerCase();
        if (!alvo.includes(qn)) return false;
      }
      return true;
    });
  }, [lista, q, funcionarioFiltro, from, to]);

  const kpis = useMemo(() => {
    const total = filtrados.length;
    let horas = 0;
    let liquido = 0;
    let pessoas = new Set();
    filtrados.forEach((r) => {
      horas += dec(r.horas_normais) + dec(r.he50_horas) + dec(r.he100_horas);
      liquido += dec(r.total_liquido);
      pessoas.add(r.funcionario_id);
    });
    return { total, horas, liquido, pessoas: pessoas.size };
  }, [filtrados]);

  /* ====== ações ====== */
  function atalhoPeriodo(p) {
    setPeriodo(p);
    const hoje = new Date();
    if (p === "hoje" || p === "mes") {
      const m = monthISO(hoje);
      setFrom(m); setTo(m);
      return;
    }
    if (p === "semana") {
      const d = new Date(hoje);
      const diff = (d.getDay() + 6) % 7;
      const ini = new Date(d);
      ini.setDate(d.getDate() - diff);
      const fim = new Date(ini);
      fim.setDate(ini.getDate() + 6);
      setFrom(monthISO(ini)); setTo(monthISO(fim));
    }
  }

  function abrirNovo() {
    setEditing(null);
    setForm((prev) => ({
      ...prev,
      folha_id: "",
      competencia: normalizeYM(from) || monthISO(new Date()),
      funcionario_id: "",
      horas_normais: "",
      he50_horas: "",
      he100_horas: "",
      valor_base: "",
      valor_he50: "",
      valor_he100: "",
      descontos: "",
      proventos: "",
      total_liquido: "",
      inconsistencias: 0,
    }));
    setOpenModal(true);
  }

  function abrirEditar(r) {
    setEditing(r);
    setForm({
      folha_id: r.folha_id,
      competencia: normalizeYM(r.competencia) || monthISO(new Date()),
      funcionario_id: r.funcionario_id,
      horas_normais: r.horas_normais ?? "",
      he50_horas: r.he50_horas ?? "",
      he100_horas: r.he100_horas ?? "",
      valor_base: r.valor_base ?? "",
      valor_he50: r.valor_he50 ?? "",
      valor_he100: r.valor_he100 ?? "",
      descontos: r.descontos ?? "",
      proventos: r.proventos ?? "",
      total_liquido: r.total_liquido ?? "",
      inconsistencias: r.inconsistencias ?? 0,
    });
    setOpenModal(true);
  }

  function recomputaTotal(next = form) {
    const total =
      dec(next.valor_base) +
      dec(next.valor_he50) +
      dec(next.valor_he100) +
      dec(next.proventos) -
      dec(next.descontos);
    return total;
  }

  async function salvar() {
    setErr(""); setOkMsg("");
    try {
      const competenciaYM = normalizeYM(form.competencia);
      const payload = {
        ...(form.folha_id ? { folha_id: Number(form.folha_id) } : {}),
        competencia: competenciaYM,
        funcionario_id: Number(form.funcionario_id),
        horas_normais: form.horas_normais === "" ? null : Number(dec(form.horas_normais)),
        he50_horas:    form.he50_horas === ""    ? null : Number(dec(form.he50_horas)),
        he100_horas:   form.he100_horas === ""   ? null : Number(dec(form.he100_horas)),
        valor_base:    form.valor_base === ""    ? null : Number(dec(form.valor_base)),
        valor_he50:    form.valor_he50 === ""    ? null : Number(dec(form.valor_he50)),
        valor_he100:   form.valor_he100 === ""   ? null : Number(dec(form.valor_he100)),
        descontos:     form.descontos === ""     ? null : Number(dec(form.descontos)),
        proventos:     form.proventos === ""     ? null : Number(dec(form.proventos)),
        total_liquido:
          form.total_liquido === "" ? Number(recomputaTotal(form)) : Number(dec(form.total_liquido)),
        inconsistencias: Number(form.inconsistencias || 0),
      };

      if (!payload.funcionario_id) throw new Error("Selecione o funcionário.");
      if (!competenciaYM && !payload.folha_id) throw new Error("Informe a competência (YYYY-MM) ou selecione uma folha.");

      if (editing) {
        await api(`/api/folhas-funcionarios/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        setOkMsg("Registro atualizado.");
      } else {
        await api(`/api/folhas-funcionarios`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        setOkMsg("Registro adicionado.");
      }
      setOpenModal(false);
      await carregar();
    } catch (e) {
      setErr(e.message || "Falha ao salvar.");
    }
  }

  async function excluir(r) {
    if (!confirm(`Excluir o lançamento de ${r.funcionario_nome} em ${formatMonthBR(r.competencia)}?`)) return;
    setErr(""); setOkMsg("");
    try {
      await api(`/api/folhas-funcionarios/${r.id}`, { method: "DELETE" });
      setOkMsg("Registro removido.");
      await carregar();
    } catch (e) {
      setErr(e.message || "Falha ao excluir.");
    }
  }

  function exportarCSV() {
    const rows = filtrados.map((r) => ({
      id: r.id,
      competencia: r.competencia,
      competencia_br: formatMonthBR(r.competencia),
      funcionario_id: r.funcionario_id,
      funcionario_nome: r.funcionario_nome,
      horas_normais: r.horas_normais,
      he50_horas: r.he50_horas,
      he100_horas: r.he100_horas,
      valor_base: r.valor_base,
      valor_he50: r.valor_he50,
      valor_he100: r.valor_he100,
      descontos: r.descontos,
      proventos: r.proventos,
      total_liquido: r.total_liquido,
      inconsistencias: r.inconsistencias,
    }));
    const csv = toCSV(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `folhas_funcionarios_${normalizeYM(from) || from}_a_${normalizeYM(to) || to}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  /* ====== UI ====== */
  return (
    <>
      <div ref={liveRef} aria-live="polite" className="visually-hidden" />

      {/* Header */}
      <header className="page-header" role="region" aria-labelledby="titulo-pagina">
        <div>
          <h1 id="titulo-pagina" className="page-title">Folhas × Funcionários</h1>
          <p className="page-subtitle">Lançamentos por funcionário (horas, valores e total líquido)</p>
        </div>

        <div className="page-header__toolbar" aria-label="Ações">
          <div className="segmented">
            <button className={`btn btn--neutral ${periodo === "mes" ? "is-active" : ""}`} onClick={() => atalhoPeriodo("mes")}>
              <CalendarDaysIcon className="icon" aria-hidden="true" /> Mês
            </button>
            <button className={`btn btn--neutral ${periodo === "semana" ? "is-active" : ""}`} onClick={() => atalhoPeriodo("semana")}>
              Semana
            </button>
          </div>

          <div className="filters">
            <input
              type="month"
              className="input input--sm"
              value={from}
              onChange={(e) => setFrom(normalizeYM(e.target.value) || e.target.value)}
              aria-label="De"
            />
            <input
              type="month"
              className="input input--sm"
              value={to}
              onChange={(e) => setTo(normalizeYM(e.target.value) || e.target.value)}
              aria-label="Até"
            />
            <select className="input input--sm" value={funcionarioFiltro} onChange={(e) => setFuncionarioFiltro(e.target.value)} aria-label="Funcionário">
              <option value="todos">Todos os funcionários</option>
              {funcionarios.map((f) => (
                <option key={f.id} value={f.id}>{f.pessoa_nome || f?.pessoa?.nome || `#${f.id}`}</option>
              ))}
            </select>
            <input type="search" className="input input--sm" placeholder="Buscar por funcionário/competência…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>

          <div className="actions">
            <button className="btn btn--neutral" onClick={abrirNovo}><PlusIcon className="icon" aria-hidden="true" /> Novo</button>
            <button className="btn btn--neutral" onClick={exportarCSV}><CloudArrowDownIcon className="icon" aria-hidden="true" /> Exportar</button>
            <button className="btn btn--neutral" onClick={carregar} disabled={loading} aria-busy={loading ? "true" : "false"}>
              {loading ? <span className="spinner" aria-hidden="true" /> : <ArrowPathIcon className="icon" aria-hidden="true" />}
              <span>{loading ? "Atualizando…" : "Atualizar"}</span>
            </button>
            <label className="btn btn--neutral" style={{ cursor: "pointer" }}>
              <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} style={{ marginRight: 6 }} />
              Auto Refresh
            </label>
          </div>
        </div>
      </header>

      {/* Alerts */}
      {err && <div className="error-alert" role="alert" style={{ marginBottom: 12 }}>{err}</div>}
      {okMsg && <div className="success-alert" role="status" style={{ marginBottom: 12 }}>{okMsg}</div>}

      {/* KPIs */}
      <div className="stats-grid">
        <div className="stat-card" data-accent="info">
          <div className="stat-card__icon"><UserIcon className="icon" aria-hidden="true" /></div>
          <div className="stat-card__content">
            <div className="stat-value">{kpis.pessoas}</div>
            <div className="stat-title">Funcionários impactados</div>
          </div>
        </div>
        <div className="stat-card" data-accent="success">
          <div className="stat-card__icon"><CalculatorIcon className="icon" aria-hidden="true" /></div>
          <div className="stat-card__content">
            <div className="stat-value">{kpis.horas.toFixed(2)}</div>
            <div className="stat-title">Horas (N + 50% + 100%)</div>
          </div>
        </div>
        <div className="stat-card" data-accent="warning">
          <div className="stat-card__icon"><CheckCircleIcon className="icon" aria-hidden="true" /></div>
          <div className="stat-card__content">
            <div className="stat-value">{money(kpis.liquido)}</div>
            <div className="stat-title">Total líquido (somado)</div>
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Competência</th>
              <th>Funcionário</th>
              <th className="num">N</th>
              <th className="num">HE 50%</th>
              <th className="num">HE 100%</th>
              <th className="num">Base</th>
              <th className="num">+HE50</th>
              <th className="num">+HE100</th>
              <th className="num">+Prov.</th>
              <th className="num">-Desc.</th>
              <th className="num">Líquido</th>
              <th className="num">Inc.</th>
              <th className="text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 && (
              <tr><td colSpan={14} className="empty">Nenhum lançamento para o filtro.</td></tr>
            )}
            {filtrados.map((r) => (
              <tr key={r.id}>
                <td>#{r.id}</td>
                <td>
                  <div>{formatMonthBR(r.competencia)}</div>
                  <div className="muted mono">{r.competencia}</div>
                </td>
                <td>{r.funcionario_nome}</td>
                <td className="num">{dec(r.horas_normais).toFixed(2)}</td>
                <td className="num">{dec(r.he50_horas).toFixed(2)}</td>
                <td className="num">{dec(r.he100_horas).toFixed(2)}</td>
                <td className="num">{money(dec(r.valor_base))}</td>
                <td className="num">{money(dec(r.valor_he50))}</td>
                <td className="num">{money(dec(r.valor_he100))}</td>
                <td className="num">{money(dec(r.proventos))}</td>
                <td className="num">{money(dec(r.descontos))}</td>
                <td className="num"><strong>{money(dec(r.total_liquido))}</strong></td>
                <td className="num">{r.inconsistencias ?? 0}</td>
                <td className="text-right">
                  <div className="row-actions">
                    <button className="btn btn--neutral btn--icon" title="Editar" onClick={() => abrirEditar(r)}>
                      <PencilSquareIcon className="icon" aria-hidden="true" />
                    </button>
                    <button className="btn btn--neutral btn--icon" title="Excluir" onClick={() => excluir(r)}>
                      <TrashIcon className="icon" aria-hidden="true" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cards (mobile) */}
      <div className="cards">
        {filtrados.map((r) => (
          <article key={`card-${r.id}`} className="card" aria-label={`Lançamento de ${r.funcionario_nome}`}>
            <header className="card__header">
              <div>
                <strong>{r.funcionario_nome}</strong>
                <div className="muted">{formatMonthBR(r.competencia)} <span className="mono">({r.competencia})</span></div>
              </div>
              <div className="mono">{money(dec(r.total_liquido))}</div>
            </header>
            <dl className="card__grid">
              <div><dt>N</dt><dd>{dec(r.horas_normais).toFixed(2)}</dd></div>
              <div><dt>HE 50%</dt><dd>{dec(r.he50_horas).toFixed(2)}</dd></div>
              <div><dt>HE 100%</dt><dd>{dec(r.he100_horas).toFixed(2)}</dd></div>
              <div><dt>Base</dt><dd>{money(dec(r.valor_base))}</dd></div>
              <div><dt>+HE50</dt><dd>{money(dec(r.valor_he50))}</dd></div>
              <div><dt>+HE100</dt><dd>{money(dec(r.valor_he100))}</dd></div>
              <div><dt>+Prov.</dt><dd>{money(dec(r.proventos))}</dd></div>
              <div><dt>-Desc.</dt><dd>{money(dec(r.descontos))}</dd></div>
            </dl>
            <footer className="card__actions">
              <button className="btn btn--neutral" onClick={() => abrirEditar(r)}><PencilSquareIcon className="icon" aria-hidden="true" /> Editar</button>
              <button className="btn btn--neutral" onClick={() => excluir(r)}><TrashIcon className="icon" aria-hidden="true" /> Excluir</button>
            </footer>
          </article>
        ))}
      </div>

      {/* Modal */}
      {openModal && (
        <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.target === e.currentTarget && setOpenModal(false)}>
          <div className="modal__content">
            <header className="modal__header">
              <h2 className="modal__title">{editing ? "Editar lançamento" : "Novo lançamento"}</h2>
              <button className="btn btn--neutral btn--icon" onClick={() => setOpenModal(false)} aria-label="Fechar">✕</button>
            </header>

            <div className="modal__body">
              <div className="form-grid">
                <div className="form-field">
                  <label className="form-label">Competência *</label>
                  <input
                    type="month"
                    className="input"
                    value={form.competencia}
                    onChange={(e) => setForm({ ...form, competencia: normalizeYM(e.target.value) || e.target.value })}
                    required
                  />
                </div>

                <div className="form-field">
                  <label className="form-label">Funcionário *</label>
                  <select className="input" value={form.funcionario_id} onChange={(e) => setForm({ ...form, funcionario_id: e.target.value })} required>
                    <option value="">Selecione…</option>
                    {funcionarios.map((f) => (
                      <option key={f.id} value={f.id}>{f.pessoa_nome || f?.pessoa?.nome || `#${f.id}`}</option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label className="form-label">Horas normais</label>
                  <input className="input" inputMode="decimal" placeholder="0,00" value={form.horas_normais} onChange={(e) => setForm({ ...form, horas_normais: e.target.value })} />
                </div>
                <div className="form-field">
                  <label className="form-label">HE 50% (horas)</label>
                  <input className="input" inputMode="decimal" placeholder="0,00" value={form.he50_horas} onChange={(e) => setForm({ ...form, he50_horas: e.target.value })} />
                </div>
                <div className="form-field">
                  <label className="form-label">HE 100% (horas)</label>
                  <input className="input" inputMode="decimal" placeholder="0,00" value={form.he100_horas} onChange={(e) => setForm({ ...form, he100_horas: e.target.value })} />
                </div>

                <div className="form-field">
                  <label className="form-label">Valor base</label>
                  <input className="input" inputMode="decimal" placeholder="0,00" value={form.valor_base} onChange={(e) => setForm({ ...form, valor_base: e.target.value, total_liquido: recomputaTotal({ ...form, valor_base: e.target.value }).toFixed(2) })} />
                </div>
                <div className="form-field">
                  <label className="form-label">Valor HE 50%</label>
                  <input className="input" inputMode="decimal" placeholder="0,00" value={form.valor_he50} onChange={(e) => setForm({ ...form, valor_he50: e.target.value, total_liquido: recomputaTotal({ ...form, valor_he50: e.target.value }).toFixed(2) })} />
                </div>
                <div className="form-field">
                  <label className="form-label">Valor HE 100%</label>
                  <input className="input" inputMode="decimal" placeholder="0,00" value={form.valor_he100} onChange={(e) => setForm({ ...form, valor_he100: e.target.value, total_liquido: recomputaTotal({ ...form, valor_he100: e.target.value }).toFixed(2) })} />
                </div>

                <div className="form-field">
                  <label className="form-label">Proventos (+)</label>
                  <input className="input" inputMode="decimal" placeholder="0,00" value={form.proventos} onChange={(e) => setForm({ ...form, proventos: e.target.value, total_liquido: recomputaTotal({ ...form, proventos: e.target.value }).toFixed(2) })} />
                </div>
                <div className="form-field">
                  <label className="form-label">Descontos (-)</label>
                  <input className="input" inputMode="decimal" placeholder="0,00" value={form.descontos} onChange={(e) => setForm({ ...form, descontos: e.target.value, total_liquido: recomputaTotal({ ...form, descontos: e.target.value }).toFixed(2) })} />
                </div>

                <div className="form-field">
                  <label className="form-label">Total líquido</label>
                  <input className="input" inputMode="decimal" placeholder="0,00" value={form.total_liquido} onChange={(e) => setForm({ ...form, total_liquido: e.target.value })} />
                </div>

                <div className="form-field">
                  <label className="form-label">Inconsistências</label>
                  <input className="input" type="number" min="0" value={form.inconsistencias} onChange={(e) => setForm({ ...form, inconsistencias: e.target.value })} />
                </div>
              </div>

              <p className="muted" style={{ marginTop: 8 }}>
                <ExclamationTriangleIcon className="icon" style={{ width: 16, height: 16 }} aria-hidden="true" /> 
                O total líquido é recalculado automaticamente quando você altera base/HE/proventos/descontos (pode ser ajustado manualmente).
              </p>
            </div>

            <footer className="modal__footer">
              <button className="btn btn--neutral" onClick={() => setOpenModal(false)}>Cancelar</button>
              <button className="btn btn--neutral" onClick={salvar}><CheckCircleIcon className="icon" aria-hidden="true" /> {editing ? "Salvar" : "Adicionar"}</button>
            </footer>
          </div>
        </div>
      )}

      {/* Estilos locais */}
      <style jsx>{`
        .segmented { display:flex; gap:8px; flex-wrap:wrap; }
        .filters { display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
        .actions { display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
        .is-active { outline:2px solid var(--accent); }

        .stats-grid {
          display:grid; grid-template-columns: repeat(auto-fit, minmax(220px,1fr));
          gap:16px; margin:16px 0 20px;
        }
        .stat-card { background:var(--panel); border:1px solid var(--border); border-radius:12px; padding:18px; display:flex; align-items:center; gap:14px; box-shadow:var(--shadow); }
        .stat-card[data-accent="info"] { border-left:4px solid var(--info); }
        .stat-card[data-accent="success"] { border-left:4px solid var(--success); }
        .stat-card[data-accent="warning"] { border-left:4px solid var(--warning); }
        .stat-card__icon { width:44px; height:44px; border-radius:8px; display:flex; align-items:center; justify-content:center; background:var(--panel-muted); }
        .stat-card__content { flex:1; }
        .stat-value { font-size:1.6rem; font-weight:700; line-height:1; }
        .stat-title { font-size:.85rem; color:var(--muted); font-weight:600; }

        .table-wrap { display:block; overflow:auto; border:1px solid var(--border); border-radius:8px; background:var(--panel); box-shadow:var(--shadow); }
        .table { width:100%; border-collapse:collapse; min-width:1100px; }
        th, td { padding:12px; border-bottom:1px solid var(--border); text-align:left; }
        th { font-weight:700; font-size:13px; color:var(--muted); background:var(--panel-muted); }
        .num { text-align:right; font-variant-numeric: tabular-nums; }
        .text-right { text-align:right; }
        .row-actions { display:flex; gap:6px; justify-content:flex-end; }
        .btn--icon .icon { width:18px; height:18px; }
        .muted { color:var(--muted); }
        .mono { font-variant-numeric: tabular-nums; }
        .empty { text-align:center; color:var(--muted); padding:32px 12px; }

        .cards { display:none; }
        .card { background:var(--panel); border:1px solid var(--border); border-radius:12px; padding:12px; display:flex; flex-direction:column; gap:10px; }
        .card + .card { margin-top:12px; }
        .card__header { display:flex; align-items:center; justify-content:space-between; gap:8px; }
        .card__grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
        .card__grid dt { font-size:12px; color:var(--muted); }
        .card__grid dd { font-weight:600; }
        .card__actions { display:flex; gap:8px; flex-wrap:wrap; }

        .modal { position:fixed; inset:0; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,.35); z-index:1000; padding:16px; }
        .modal__content { width:min(780px,100%); background:var(--panel); border:1px solid var(--border); border-radius:12px; box-shadow:var(--shadow); }
        .modal__header, .modal__footer { padding:14px 16px; border-bottom:1px solid var(--border); }
        .modal__footer { border-top:1px solid var(--border); border-bottom:0; display:flex; gap:8px; justify-content:flex-end; }
        .modal__title { margin:0; font-size:18px; }
        .modal__body { padding:16px; }
        .form-grid { display:grid; grid-template-columns:repeat(3, 1fr); gap:12px; }
        .form-field { display:flex; flex-direction:column; gap:6px; }
        .form-label { font-weight:600; font-size:14px; }

        @media (max-width: 1024px) {
          .form-grid { grid-template-columns:repeat(2, 1fr); }
        }
        @media (max-width: 900px) {
          .table-wrap { display:none; }
          .cards { display:block; }
          .form-grid { grid-template-columns:1fr; }
        }
        @media (max-width: 640px) {
          .page-header__toolbar { flex-direction:column; align-items:stretch; gap:8px; }
          .segmented, .filters, .actions { width:100%; }
          .segmented .btn, .filters .input, .actions .btn { width:100%; justify-content:center; }
        }
      `}</style>
    </>
  );
}