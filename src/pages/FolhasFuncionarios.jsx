import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowPathIcon,
  CalculatorIcon,
  CheckCircleIcon,
  CloudArrowDownIcon,
  FunnelIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
  UserIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

const API_BASE = (import.meta.env.VITE_API_BASE?.replace(/\/+$/, "") || "");

/* ===================== Utils ===================== */
const norm = (v) => (v ?? "").toString().trim();
const monthISO = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const toYM = (s) => {
  const m = String(s || "").match(/^(\d{4})-(\d{2})(?:-\d{2})?$/);
  return m ? `${m[1]}-${m[2]}` : null;
};
const formatMonthBR = (ym) => {
  const [y, m] = String(ym || "").split("-").map(Number);
  if (!y || !m) return ym || "";
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
};
const dec = (v) => {
  if (v === "" || v == null) return 0;
  const n = Number(String(v).replace(/[^\d,-.]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const money = (n) =>
  Number.isFinite(Number(n))
    ? Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "R$ 0,00";

/* ===================== API helper ===================== */
function useApi() {
  return useCallback(async (path, init = {}) => {
    const r = await fetch(`${API_BASE}${path}`, {
      credentials: "include",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, max-age=0",
        Pragma: "no-cache",
        ...(init.headers || {}),
      },
      ...init,
    });
    let data = null;
    try {
      data = await r.json();
    } catch {
      /* resposta vazia (ex.: 304) */
    }
    if (r.status === 304) {
      // fallback seguro para não quebrar a UI
      return { ok: true, items: [] };
    }
    if (!r.ok || data?.ok === false) {
      throw new Error(data?.error || `Erro ${r.status}`);
    }
    return data;
  }, []);
}

/* ===================== Página ===================== */
export default function FolhasFuncionarios() {
  const api = useApi();
  const liveRef = useRef(null);

  // Filtros (com folha_id)
  const [filtros, setFiltros] = useState({
    from: monthISO(),
    to: monthISO(),
    folha_id: "",
    funcionario_id: "todos",
    q: "",
  });

  // Masters
  const [folhas, setFolhas] = useState([]); // {id, competencia, empresa_id, status}
  const [funcionarios, setFuncionarios] = useState([]);

  // Dados e UI
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  // Modal/form
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    folha_id: "",
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

  const folhaSelecionada = useMemo(
    () => folhas.find((f) => String(f.id) === String(filtros.folha_id)),
    [folhas, filtros.folha_id]
  );

  /* ===================== Loads ===================== */
  // Carrega funcionarios da empresa da folha selecionada (evita empresa errada)
  const loadFuncionarios = useCallback(async (empresaId) => {
    try {
      const qs = new URLSearchParams();
      if (empresaId) qs.set("empresa_id", String(empresaId));
      qs.set("ativos", "1");
      qs.set("_", Date.now()); // cache-buster
      const d = await api(`/api/funcionarios?${qs.toString()}`);
      setFuncionarios(d.funcionarios || d.items || []);
    } catch (e) {
      setFuncionarios([]);
      console.error(e);
    }
  }, [api]);

  const loadFolhas = useCallback(async () => {
    try {
      const qs = new URLSearchParams();
      const f = toYM(filtros.from) || filtros.from;
      const t = toYM(filtros.to) || filtros.to;
      if (f) qs.set("from", f);
      if (t) qs.set("to", t);
      qs.set("scope", "mine");
      qs.set("_", Date.now()); // cache-buster

      const d = await api(`/api/folhas?${qs.toString()}`);
      const list = (d.folhas || []).slice();

      // ordena por competência DESC e id DESC (igual backend)
      list.sort((a, b) => {
        if (a.competencia === b.competencia) return Number(b.id) - Number(a.id);
        return a.competencia < b.competencia ? 1 : -1;
      });

      setFolhas(list);

      // auto-seleciona folha mais recente se nada estiver selecionado ou se a atual não existir mais
      if (!filtros.folha_id || !list.some((x) => String(x.id) === String(filtros.folha_id))) {
        const first = list[0];
        setFiltros((p) => ({ ...p, folha_id: first ? String(first.id) : "" }));
      }
    } catch (e) {
      setFolhas([]);
      console.error(e);
    }
  }, [api, filtros.from, filtros.to]); // evita loop desnecessário

  const loadLancamentos = useCallback(async () => {
    setErr("");
    setOk("");

    if (!filtros.folha_id) {
      setLista([]);
      setLoading(false);
      if (liveRef.current) liveRef.current.textContent = "Selecione uma folha.";
      return;
    }

    setLoading(true);
    try {
      const qs = new URLSearchParams();
      qs.set("folha_id", String(filtros.folha_id));
      if (filtros.funcionario_id !== "todos")
        qs.set("funcionario_id", filtros.funcionario_id);
      if (filtros.q) qs.set("q", filtros.q.trim());
      qs.set("_", Date.now()); // cache-buster

      const d = await api(`/api/folhas-funcionarios?${qs.toString()}`);
      setLista(Array.isArray(d.items) ? d.items : []);
      if (liveRef.current) liveRef.current.textContent = "Dados atualizados.";
    } catch (e) {
      setErr(e.message);
      if (liveRef.current) liveRef.current.textContent = "Falha ao atualizar.";
    } finally {
      setLoading(false);
    }
  }, [api, filtros.folha_id, filtros.funcionario_id, filtros.q]);

  // Primeira carga de folhas
  useEffect(() => { loadFolhas(); }, [loadFolhas]);

  // Recarrega funcionários quando a folha (empresa) mudar
  useEffect(() => {
    loadFuncionarios(folhaSelecionada?.empresa_id);
  }, [loadFuncionarios, folhaSelecionada?.empresa_id]);

  // Atualiza lançamentos sempre que filtros relevantes mudarem
  useEffect(() => { loadLancamentos(); }, [loadLancamentos]);

  /* ===================== Filtrados/KPIs ===================== */
  const filtrados = useMemo(() => {
    const termo = filtros.q.toLowerCase().trim();
    return lista.filter((r) => {
      if (filtros.funcionario_id !== "todos" && String(r.funcionario_id) !== String(filtros.funcionario_id)) return false;
      if (termo) {
        const alvo = `${r.id} ${r.funcionario_nome} ${r.competencia}`.toLowerCase();
        if (!alvo.includes(termo)) return false;
      }
      return true;
    });
  }, [lista, filtros.funcionario_id, filtros.q]);

  const kpis = useMemo(() => {
    let horas = 0, liquido = 0;
    const pessoas = new Set();
    filtrados.forEach((r) => {
      horas += dec(r.horas_normais) + dec(r.he50_horas) + dec(r.he100_horas);
      liquido += dec(r.total_liquido);
      pessoas.add(r.funcionario_id);
    });
    return { horas, liquido, pessoas: pessoas.size, registros: filtrados.length };
  }, [filtrados]);

  /* ===================== CRUD ===================== */
  const calcTotal = (v = form) =>
    dec(v.valor_base) + dec(v.valor_he50) + dec(v.valor_he100) + dec(v.proventos) - dec(v.descontos);

  const startNovo = () => {
    setEditing(null);
    setForm({
      folha_id: filtros.folha_id || "",
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
    setErr(""); setOk(""); setOpen(true);
  };

  const startEdit = (r) => {
    setEditing(r);
    setForm({
      folha_id: r.folha_id,
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
    setErr(""); setOk(""); setOpen(true);
  };

  const salvar = async () => {
    setSaving(true);
    setErr(""); setOk("");
    try {
      if (!form.folha_id) throw new Error("Selecione a folha (obrigatório).");
      if (!form.funcionario_id) throw new Error("Selecione o funcionário.");

      const toNumOrNull = (v) => (v === "" || v == null ? null : dec(v));
      const payload = {
        folha_id: Number(form.folha_id),
        funcionario_id: Number(form.funcionario_id),
        horas_normais: toNumOrNull(form.horas_normais),
        he50_horas: toNumOrNull(form.he50_horas),
        he100_horas: toNumOrNull(form.he100_horas),
        valor_base: toNumOrNull(form.valor_base),
        valor_he50: toNumOrNull(form.valor_he50),
        valor_he100: toNumOrNull(form.valor_he100),
        descontos: toNumOrNull(form.descontos),
        proventos: toNumOrNull(form.proventos),
        total_liquido: toNumOrNull(form.total_liquido) ?? calcTotal(form),
        inconsistencias: Number(form.inconsistencias || 0),
      };

      if (editing) {
        await api(`/api/folhas-funcionarios/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify({
            funcionario_id: payload.funcionario_id,
            horas_normais: payload.horas_normais,
            he50_horas: payload.he50_horas,
            he100_horas: payload.he100_horas,
            valor_base: payload.valor_base,
            valor_he50: payload.valor_he50,
            valor_he100: payload.valor_he100,
            descontos: payload.descontos,
            proventos: payload.proventos,
            total_liquido: payload.total_liquido,
            inconsistencias: payload.inconsistencias,
          }),
        });
        setOk("Registro atualizado.");
      } else {
        await api(`/api/folhas-funcionarios`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setOk("Registro adicionado.");
      }

      setOpen(false);
      await loadLancamentos();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const excluir = async (r) => {
    if (!confirm(`Excluir o lançamento de ${r.funcionario_nome} em ${formatMonthBR(r.competencia)}?`)) return;
    setErr(""); setOk("");
    try {
      await api(`/api/folhas-funcionarios/${r.id}`, { method: "DELETE" });
      setOk("Registro removido.");
      await loadLancamentos();
    } catch (e) {
      setErr(e.message);
    }
  };

  const exportar = () => {
    if (!filtrados.length) { setErr("Nada para exportar."); return; }
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
      proventos: r.proventos,
      descontos: r.descontos,
      total_liquido: r.total_liquido,
      inconsistencias: r.inconsistencias,
    }));
    const keys = Object.keys(rows[0]);
    const csv = [
      keys.join(";"),
      ...rows.map((r) => keys.map((k) => `"${String(r[k] ?? "").replace(/"/g, '""')}"`).join(";")),
    ].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), {
      href: url,
      download: `folhas_funcionarios_folha${filtros.folha_id || "??"}.csv`,
    });
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  };

  /* ===================== Render ===================== */
  return (
    <>
      <div ref={liveRef} aria-live="polite" className="sr-only" />

      {/* Header */}
      <header className="page-header">
        <div>
          <h1 className="page-title">Folhas × Funcionários</h1>
          <p className="page-subtitle">Lançamentos por funcionário (horas, valores e total líquido)</p>
        </div>
        <div className="header-actions">
          <button className="btn" onClick={loadLancamentos} disabled={loading} aria-busy={loading} aria-label="Atualizar lista">
            <ArrowPathIcon className={`icon-sm ${loading ? "animate-spin" : ""}`} />
            {loading ? "Atualizando..." : "Atualizar"}
          </button>
          <button className="btn" onClick={exportar} disabled={!filtrados.length} aria-label="Exportar CSV">
            <CloudArrowDownIcon className="icon-sm" /> Exportar
          </button>
          <button className="btn btn--primary" onClick={startNovo} disabled={!filtros.folha_id} aria-label="Novo lançamento">
            <PlusIcon className="icon-sm" /> Novo
          </button>
        </div>
      </header>

      {/* Alertas */}
      {err && <div className="alert alert--error" role="alert">{err}</div>}
      {ok && <div className="alert alert--success" role="status">{ok}</div>}

      {/* Filtros */}
      <section className="card toolbar">
        <div className="toolbar__left">
          <span className="toolbar__title"><FunnelIcon className="icon-sm text-muted" /> Filtros</span>

          <label className="sr-only" htmlFor="f-folha">Folha</label>
          <select
            id="f-folha"
            className="form-control"
            value={filtros.folha_id}
            onChange={(e) => setFiltros((p) => ({ ...p, folha_id: e.target.value }))}
          >
            <option value="">Selecione a folha…</option>
            {folhas.map((f) => (
              <option key={f.id} value={f.id}>
                #{f.id} — {formatMonthBR(f.competencia)} ({f.competencia})
              </option>
            ))}
          </select>

          <select
            className="form-control"
            value={filtros.funcionario_id}
            onChange={(e) => setFiltros((p) => ({ ...p, funcionario_id: e.target.value }))}
          >
            <option value="todos">Todos os funcionários</option>
            {funcionarios.map((f) => (
              <option key={f.id} value={f.id}>
                {f.pessoa_nome || f.nome || f.pessoa?.nome || `#${f.id}`}
              </option>
            ))}
          </select>
        </div>

        <div className="toolbar__right">
          <label className="sr-only" htmlFor="f-busca">Buscar por funcionário</label>
          <input
            id="f-busca"
            type="search"
            className="form-control"
            placeholder="Buscar por funcionário…"
            value={filtros.q}
            onChange={(e) => setFiltros((p) => ({ ...p, q: e.target.value }))}
          />
          <button
            className="btn"
            onClick={() => setFiltros({
              from: monthISO(),
              to: monthISO(),
              folha_id: "",
              funcionario_id: "todos",
              q: "",
            })}
            aria-label="Limpar filtros"
          >
            <XMarkIcon className="icon-sm" /> Limpar
          </button>
        </div>
      </section>

      {/* Dica quando nenhuma folha está selecionada */}
      {!filtros.folha_id && (
        <div className="card" style={{ marginBottom: 12 }}>
          Selecione uma <strong>Folha</strong> para visualizar e lançar valores dos funcionários. Esta lista mostra apenas folhas já criadas.
        </div>
      )}

      {/* KPIs */}
      {!!filtros.folha_id && (
        <section className="stats-grid">
          <article className="stat-card" data-accent="info">
            <div className="stat-card__icon"><UserIcon className="icon" /></div>
            <div className="stat-card__content">
              <div className="stat-value">{kpis.pessoas}</div>
              <div className="stat-title">Funcionários impactados</div>
            </div>
          </article>
          <article className="stat-card" data-accent="success">
            <div className="stat-card__icon"><CalculatorIcon className="icon" /></div>
            <div className="stat-card__content">
              <div className="stat-value">{kpis.horas.toFixed(2)}</div>
              <div className="stat-title">Horas (N + 50% + 100%)</div>
            </div>
          </article>
          <article className="stat-card" data-accent="warning">
            <div className="stat-card__icon"><CheckCircleIcon className="icon" /></div>
            <div className="stat-card__content">
              <div className="stat-value">{money(kpis.liquido)}</div>
              <div className="stat-title">Total líquido (somado)</div>
            </div>
          </article>
        </section>
      )}

      {/* Tabela */}
      <section className="card">
        {!filtros.folha_id ? (
          <div className="table-empty text-muted" style={{ padding: 16 }}>
            Escolha uma folha no filtro acima.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th><th>Competência</th><th>Funcionário</th>
                  <th className="num">N</th><th className="num">HE 50%</th><th className="num">HE 100%</th>
                  <th className="num">Base</th><th className="num">+HE50</th><th className="num">+HE100</th>
                  <th className="num">+Prov.</th><th className="num">-Desc.</th><th className="num">Líquido</th>
                  <th className="num">Inc.</th><th className="text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={14} className="table-empty">
                    <ArrowPathIcon className="icon-sm animate-spin" /> Carregando…
                  </td></tr>
                ) : !filtrados.length ? (
                  <tr><td colSpan={14} className="table-empty text-muted">
                    Nenhum lançamento para a folha selecionada.
                  </td></tr>
                ) : (
                  filtrados.map((r) => (
                    <tr key={r.id}>
                      <td><code>#{r.id}</code></td>
                      <td>
                        <div className="cell-strong">{formatMonthBR(r.competencia)}</div>
                        <div className="cell-muted">{r.competencia}</div>
                      </td>
                      <td className="cell-strong">{r.funcionario_nome}</td>
                      <td className="num">{dec(r.horas_normais).toFixed(2)}</td>
                      <td className="num">{dec(r.he50_horas).toFixed(2)}</td>
                      <td className="num">{dec(r.he100_horas).toFixed(2)}</td>
                      <td className="num">{money(r.valor_base)}</td>
                      <td className="num">{money(r.valor_he50)}</td>
                      <td className="num">{money(r.valor_he100)}</td>
                      <td className="num">{money(r.proventos)}</td>
                      <td className="num">{money(r.descontos)}</td>
                      <td className="num"><strong>{money(r.total_liquido)}</strong></td>
                      <td className="num">{r.inconsistencias || 0}</td>
                      <td className="text-right">
                        <div className="btn-group">
                          <button className="btn btn--icon" onClick={() => startEdit(r)} title="Editar" aria-label={`Editar lançamento #${r.id}`}>
                            <PencilSquareIcon className="icon-sm" />
                          </button>
                          <button className="btn btn--icon" onClick={() => excluir(r)} title="Excluir" aria-label={`Excluir lançamento #${r.id}`}>
                            <TrashIcon className="icon-sm" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
        {!!filtros.folha_id && !loading && !!filtrados.length && (
          <div className="table-footer">
            <span>Mostrando {filtrados.length} de {lista.length} registros</span>
            <span>Total filtrado: <strong>{money(kpis.liquido)}</strong></span>
          </div>
        )}
      </section>

      {/* Modal */}
      {open && (
        <div className="modal" role="dialog" aria-modal="true"
             onClick={(e) => e.target === e.currentTarget && !saving && setOpen(false)}>
          <div className="modal__content">
            <header className="modal__header">
              <h2 className="modal__title">{editing ? "Editar lançamento" : "Novo lançamento"}</h2>
              <button className="btn btn--icon" onClick={() => !saving && setOpen(false)} aria-label="Fechar">
                <XMarkIcon className="icon-sm" />
              </button>
            </header>

            <div className="modal__body">
              {err && <div className="alert alert--error">{err}</div>}

              <div className="form-grid">
                {/* Folha */}
                <div className="form-field">
                  <label className="form-label">Folha *</label>
                  <select
                    className="form-control"
                    value={form.folha_id}
                    onChange={(e) => setForm((p) => ({ ...p, folha_id: e.target.value }))}
                    required
                    disabled={saving || !!editing}
                  >
                    <option value="">Selecione…</option>
                    {folhas.map((f) => (
                      <option key={f.id} value={f.id}>
                        #{f.id} — {formatMonthBR(f.competencia)} ({f.competencia})
                      </option>
                    ))}
                  </select>
                  {form.folha_id && (
                    <small className="cell-muted">
                      Competência:&nbsp;
                      {folhas.find((f) => String(f.id) === String(form.folha_id))?.competencia}
                      {" "}(
                      {formatMonthBR(folhas.find((f) => String(f.id) === String(form.folha_id))?.competencia)}
                      )
                    </small>
                  )}
                </div>

                {/* Funcionário */}
                <div className="form-field">
                  <label className="form-label">Funcionário *</label>
                  <select
                    className="form-control"
                    value={form.funcionario_id}
                    onChange={(e) => setForm((p) => ({ ...p, funcionario_id: e.target.value }))}
                    required
                    disabled={saving}
                  >
                    <option value="">Selecione…</option>
                    {funcionarios.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.pessoa_nome || f.nome || f.pessoa?.nome || `#${f.id}`}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Horas */}
                <div className="form-field">
                  <label className="form-label">Horas normais</label>
                  <input className="form-control" type="number" step="0.01"
                    value={form.horas_normais}
                    onChange={(e) => setForm((p) => ({ ...p, horas_normais: e.target.value }))}
                    disabled={saving} />
                </div>
                <div className="form-field">
                  <label className="form-label">HE 50% (horas)</label>
                  <input className="form-control" type="number" step="0.01"
                    value={form.he50_horas}
                    onChange={(e) => setForm((p) => ({ ...p, he50_horas: e.target.value }))}
                    disabled={saving} />
                </div>
                <div className="form-field">
                  <label className="form-label">HE 100% (horas)</label>
                  <input className="form-control" type="number" step="0.01"
                    value={form.he100_horas}
                    onChange={(e) => setForm((p) => ({ ...p, he100_horas: e.target.value }))}
                    disabled={saving} />
                </div>

                {/* Valores */}
                <div className="form-field">
                  <label className="form-label">Valor base</label>
                  <input className="form-control" type="number" step="0.01"
                    value={form.valor_base}
                    onChange={(e) => {
                      const valor_base = e.target.value;
                      setForm((p) => ({ ...p, valor_base, total_liquido: calcTotal({ ...p, valor_base }).toFixed(2) }));
                    }}
                    disabled={saving} />
                </div>
                <div className="form-field">
                  <label className="form-label">Valor HE 50%</label>
                  <input className="form-control" type="number" step="0.01"
                    value={form.valor_he50}
                    onChange={(e) => {
                      const valor_he50 = e.target.value;
                      setForm((p) => ({ ...p, valor_he50, total_liquido: calcTotal({ ...p, valor_he50 }).toFixed(2) }));
                    }}
                    disabled={saving} />
                </div>
                <div className="form-field">
                  <label className="form-label">Valor HE 100%</label>
                  <input className="form-control" type="number" step="0.01"
                    value={form.valor_he100}
                    onChange={(e) => {
                      const valor_he100 = e.target.value;
                      setForm((p) => ({ ...p, valor_he100, total_liquido: calcTotal({ ...p, valor_he100 }).toFixed(2) }));
                    }}
                    disabled={saving} />
                </div>
                <div className="form-field">
                  <label className="form-label">Proventos (+)</label>
                  <input className="form-control" type="number" step="0.01"
                    value={form.proventos}
                    onChange={(e) => {
                      const proventos = e.target.value;
                      setForm((p) => ({ ...p, proventos, total_liquido: calcTotal({ ...p, proventos }).toFixed(2) }));
                    }}
                    disabled={saving} />
                </div>
                <div className="form-field">
                  <label className="form-label">Descontos (-)</label>
                  <input className="form-control" type="number" step="0.01"
                    value={form.descontos}
                    onChange={(e) => {
                      const descontos = e.target.value;
                      setForm((p) => ({ ...p, descontos, total_liquido: calcTotal({ ...p, descontos }).toFixed(2) }));
                    }}
                    disabled={saving} />
                </div>

                <div className="form-field">
                  <label className="form-label">Total líquido</label>
                  <input className="form-control" type="number" step="0.01"
                    value={form.total_liquido}
                    onChange={(e) => setForm((p) => ({ ...p, total_liquido: e.target.value }))}
                    disabled={saving} />
                </div>

                <div className="form-field">
                  <label className="form-label">Inconsistências</label>
                  <input className="form-control" type="number" min="0"
                    value={form.inconsistencias}
                    onChange={(e) => setForm((p) => ({ ...p, inconsistencias: Number(e.target.value) }))}
                    disabled={saving} />
                </div>
              </div>
            </div>

            <footer className="modal__footer">
              <button className="btn" onClick={() => setOpen(false)} disabled={saving}>Cancelar</button>
              <button className="btn btn--primary" onClick={salvar}
                disabled={saving || !form.folha_id || !form.funcionario_id} aria-busy={saving}>
                <CheckCircleIcon className="icon-sm" /> {saving ? "Salvando..." : (editing ? "Salvar" : "Criar")}
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Estilos mínimos (seguindo tokens/a11y do seu global.css) */}
      <style jsx>{`
        .sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;}
        .page-header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;}
        .page-title{font-size:20px;margin:0;}
        .page-subtitle{margin:2px 0 0;color:var(--muted);}
        .header-actions{display:flex;gap:8px;}
        .btn{display:inline-flex;gap:6px;align-items:center;padding:8px 12px;border:1px solid var(--border);border-radius:8px;background:var(--panel);}
        .btn--primary{background:var(--accent);color:#fff;border-color:var(--accent);}
        .btn--icon{padding:6px;}
        .icon-sm{width:18px;height:18px;}
        .alert{padding:10px 12px;border-radius:8px;margin:8px 0;}
        .alert--error{background:#fee;border:1px solid #f99;}
        .alert--success{background:#eefaf0;border:1px solid #b5ebc2;}
        .toolbar{display:flex;justify-content:space-between;gap:10px;align-items:center;margin:10px 0 16px;}
        .toolbar__left,.toolbar__right{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}
        .toolbar__title{font-weight:600;color:var(--muted);display:flex;gap:6px;align-items:center;}
        .form-control{border:1px solid var(--border);border-radius:8px;padding:8px 10px;background:var(--panel);}
        .stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin:14px 0;}
        .stat-card{background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:14px;display:flex;gap:12px;align-items:center;}
        .stat-card__icon{width:44px;height:44px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:var(--panel-muted);}
        .stat-card__content{flex:1;}
        .stat-value{font-weight:700;font-size:1.4rem;}
        .stat-title{color:var(--muted);font-size:.9rem;}
        .table-responsive{overflow:auto;border:1px solid var(--border);border-radius:8px;background:var(--panel);}
        .table{width:100%;border-collapse:collapse;min-width:1100px;}
        th,td{padding:10px 12px;border-bottom:1px solid var(--border);text-align:left;}
        thead th{background:var(--panel-muted);color:var(--muted);font-weight:600;}
        .num{text-align:right;font-variant-numeric:tabular-nums;}
        .text-right{text-align:right;}
        .table-empty{text-align:center;padding:24px 8px;color:var(--muted);}
        .cell-strong{font-weight:600;}
        .cell-muted{font-size:.85rem;color:var(--muted);}
        .btn-group{display:flex;gap:6px;justify-content:flex-end;}
        .table-footer{display:flex;justify-content:space-between;padding:10px 12px;color:var(--muted);}
        .card{background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:12px;box-shadow:var(--shadow);}
        .modal{position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;padding:16px;z-index:1000;}
        .modal__content{width:min(780px,100%);background:var(--panel);border:1px solid var(--border);border-radius:12px;}
        .modal__header,.modal__footer{padding:12px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;}
        .modal__footer{border-top:1px solid var(--border);border-bottom:0;}
        .modal__body{padding:12px;}
        .form-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;}
        .form-field{display:flex;flex-direction:column;gap:6px;}
        .form-label{font-weight:600;}
        @media (max-width: 900px){.form-grid{grid-template-columns:1fr;}}
      `}</style>
    </>
  );
}
