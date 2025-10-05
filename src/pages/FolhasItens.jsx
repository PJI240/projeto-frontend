// src/pages/folhasitens.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowPathIcon,
  ArrowDownTrayIcon,
  CalendarDaysIcon,
  FunnelIcon,
  PlusCircleIcon,
  TrashIcon,
  PencilSquareIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid";

const API_BASE = (import.meta.env.VITE_API_BASE?.replace(/\/+$/, "") || "");

/* ================= utils ================= */
const useApi = () =>
  useCallback(async (path, init = {}) => {
    const url = `${API_BASE}${path}`;
    const r = await fetch(url, { credentials: "include", ...init });
    let data = null;
    try {
      data = await r.json();
    } catch { /* noop */ }
    if (!r.ok || data?.ok === false) {
      throw new Error(data?.error || `HTTP ${r.status}`);
    }
    return data;
  }, []);

const toMoney = (v) =>
  (Number(v || 0)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const parseDec = (v) => {
  if (v == null || v === "") return 0;
  const s = String(v).replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

function toISO(d) {
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/* ================= modal ================= */
function Modal({ open, onClose, title, children, footer }) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div className="modal-card" role="document">
        <div className="modal-head">
          <h2 className="modal-title">{title}</h2>
          <button className="btn btn--icon" onClick={onClose} aria-label="Fechar">
            <XMarkIcon className="icon" />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
      <style jsx>{`
        .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;z-index:1000;padding:16px}
        .modal-card{width:min(720px,100%);background:var(--panel);border:1px solid var(--border);border-radius:12px;box-shadow:var(--shadow);display:flex;flex-direction:column;max-height:90vh}
        .modal-head{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--border)}
        .modal-title{margin:0;font-size:18px}
        .modal-body{padding:16px;overflow:auto}
        .modal-foot{padding:12px 16px;border-top:1px solid var(--border);display:flex;gap:8px;justify-content:flex-end}
      `}</style>
    </div>
  );
}

/* ================= página ================= */
export default function FolhasItensPage() {
  const api = useApi();
  const liveRef = useRef(null);

  /* filtros */
  const [folhas, setFolhas] = useState([]);
  const [folhaId, setFolhaId] = useState("");
  const [funcsDaFolha, setFuncsDaFolha] = useState([]);
  const [folhaFuncId, setFolhaFuncId] = useState("todos");
  const [tipo, setTipo] = useState("todos");
  const [busca, setBusca] = useState("");
  const [periodo, setPeriodo] = useState("mes"); // hoje | semana | mes
  const hoje = useMemo(() => new Date(), []);
  const [de, setDe] = useState(toISO(new Date(hoje.getFullYear(), hoje.getMonth(), 1)));
  const [ate, setAte] = useState(toISO(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)));

  /* listagem */
  const [itens, setItens] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  /* modal edição */
  const [editando, setEditando] = useState(null);
  const [openModal, setOpenModal] = useState(false);
  const [form, setForm] = useState({
    folha_funcionario_id: "",
    tipo: "PROVENTO", // PROVENTO | DESCONTO | OUTRO
    referencia: "",
    quantidade: "",
    valor_unit: "",
    valor_total: "",
  });

  const TIPOS = ["PROVENTO", "DESCONTO", "OUTRO"];

  /* =========== helpers filtro período =========== */
  const aplicarPeriodo = useCallback((p) => {
    setPeriodo(p);
    const base = new Date();
    if (p === "hoje") {
      const s = toISO(base);
      setDe(s); setAte(s);
    } else if (p === "semana") {
      const dt = new Date(base);
      const diff = (dt.getDay() + 6) % 7; // seg=0
      const start = new Date(dt); start.setDate(dt.getDate() - diff);
      const end = new Date(start); end.setDate(start.getDate() + 6);
      setDe(toISO(start)); setAte(toISO(end));
    } else {
      const start = new Date(base.getFullYear(), base.getMonth(), 1);
      const end = new Date(base.getFullYear(), base.getMonth() + 1, 0);
      setDe(toISO(start)); setAte(toISO(end));
    }
  }, []);

  /* =========== carregamentos =========== */
  const carregarFolhas = useCallback(async () => {
    const d = await api(`/api/folhas?scope=mine`);
    setFolhas(d.folhas || []);
    if (!folhaId && d.folhas?.length) setFolhaId(String(d.folhas[0].id));
  }, [api, folhaId]);

  const carregarFolhaFuncionarios = useCallback(async (id) => {
    if (!id) { setFuncsDaFolha([]); return; }
    // endpoint sugerido — ajuste se necessário
    const d = await api(`/api/folhas-funcionarios?folha_id=${encodeURIComponent(id)}`);
    // normaliza: espera { itens: [{id, funcionario_id, pessoa_nome}] }
    const arr = d.itens || d.funcionarios || [];
    setFuncsDaFolha(arr);
    // deixa "todos" por padrão
  }, [api]);

  const carregarItens = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const params = new URLSearchParams();
      if (folhaId) params.set("folha_id", folhaId);
      if (folhaFuncId && folhaFuncId !== "todos") params.set("folha_funcionario_id", folhaFuncId);
      if (tipo && tipo !== "todos") params.set("tipo", tipo);
      if (busca) params.set("q", busca);
      if (de) params.set("from", de);
      if (ate) params.set("to", ate);
      params.set("limit", "500");
      params.set("offset", "0");
      const d = await api(`/api/folhas-itens?${params.toString()}`);
      const lista = Array.isArray(d) ? d : (d.ocorrencias || d.itens || []);
      setItens(lista);
      setTotal(d.total ?? lista.length ?? 0);
      if (liveRef.current) liveRef.current.textContent = "Lista de itens atualizada.";
    } catch (e) {
      setErr(e.message || "Falha ao carregar itens.");
      if (liveRef.current) liveRef.current.textContent = "Erro ao carregar itens.";
    } finally {
      setLoading(false);
    }
  }, [api, folhaId, folhaFuncId, tipo, busca, de, ate]);

  /* efeitos */
  useEffect(() => { carregarFolhas(); }, [carregarFolhas]);
  useEffect(() => { carregarFolhaFuncionarios(folhaId); }, [folhaId, carregarFolhaFuncionarios]);
  useEffect(() => { carregarItens(); }, [carregarItens]);

  /* =========== totais/kpis =========== */
  const kpis = useMemo(() => {
    let qt = 0;
    let val = 0;
    let funcImpactados = new Set();
    for (const it of itens) {
      qt++;
      val += Number(it.valor_total || 0);
      if (it.folha_funcionario_id) funcImpactados.add(it.folha_funcionario_id);
    }
    return {
      itens: qt,
      valorTotalFmt: toMoney(val),
      funcionarios: funcImpactados.size,
    };
  }, [itens]);

  /* =========== CRUD =========== */
  const abrirNovo = () => {
    setEditando(null);
    setForm({
      folha_funcionario_id: folhaFuncId !== "todos" ? String(folhaFuncId) : "",
      tipo: "PROVENTO",
      referencia: "",
      quantidade: "",
      valor_unit: "",
      valor_total: "",
    });
    setOpenModal(true);
  };

  const abrirEdicao = (row) => {
    setEditando(row);
    setForm({
      folha_funcionario_id: String(row.folha_funcionario_id || ""),
      tipo: row.tipo || "PROVENTO",
      referencia: row.referencia || "",
      quantidade: String(row.quantidade ?? ""),
      valor_unit: String(row.valor_unit ?? ""),
      valor_total: String(row.valor_total ?? ""),
    });
    setOpenModal(true);
  };

  const salvar = async () => {
    const payload = {
      folha_funcionario_id: Number(form.folha_funcionario_id),
      tipo: form.tipo || null,
      referencia: form.referencia || null,
      quantidade: parseDec(form.quantidade),
      valor_unit: parseDec(form.valor_unit),
      valor_total: parseDec(form.valor_total) || (parseDec(form.quantidade) * parseDec(form.valor_unit)),
    };
    if (!payload.folha_funcionario_id) throw new Error("Selecione o funcionário (linha da folha).");

    if (editando?.id) {
      await api(`/api/folhas-itens/${editando.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await api(`/api/folhas-itens`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    setOpenModal(false);
    await carregarItens();
  };

  const excluir = async (row) => {
    if (!confirm("Excluir este item da folha?")) return;
    await api(`/api/folhas-itens/${row.id}`, { method: "DELETE" });
    await carregarItens();
  };

  /* =========== export CSV =========== */
  const exportarCSV = () => {
    const cols = [
      "id",
      "folha_funcionario_id",
      "funcionario_nome",
      "tipo",
      "referencia",
      "quantidade",
      "valor_unit",
      "valor_total",
    ];
    const csv = [
      cols.join(";"),
      ...itens.map((r) =>
        cols
          .map((c) => {
            const v = r[c] ?? "";
            return String(v).replaceAll(";", ",");
          })
          .join(";")
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "folhas_itens.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  /* =========== render helpers =========== */
  const funcOptions = useMemo(() => {
    return funcsDaFolha.map((f) => ({
      id: f.id ?? f.folha_funcionario_id ?? f.folhaFuncId ?? f.funcionario_id,
      label: f.pessoa_nome || f.funcionario_nome || f.nome || `#${f.id}`,
    }));
  }, [funcsDaFolha]);

  // cálculo automático do total
  useEffect(() => {
    const q = parseDec(form.quantidade);
    const vu = parseDec(form.valor_unit);
    const tot = q * vu;
    if (!Number.isNaN(tot)) {
      setForm((p) => ({ ...p, valor_total: String(tot.toFixed(2)) }));
    }
  }, [form.quantidade, form.valor_unit]);

  return (
    <>
      {/* aria-live */}
      <div ref={liveRef} aria-live="polite" className="visually-hidden" />

      {/* header */}
      <header className="page-header" role="region" aria-labelledby="titulo-pagina">
        <div>
          <h1 id="titulo-pagina" className="page-title">Itens de Folha</h1>
          <p className="page-subtitle">Cadastre proventos, descontos e lançamentos manuais por funcionário da folha.</p>
        </div>

        <div className="page-header__toolbar">
          <div className="toolbar-grid">
            {/* esquerda: filtros */}
            <div className="filters-wrap">
              <div className="btn-group" role="group" aria-label="Atalhos de período">
                <button className={`btn btn--neutral ${periodo==='hoje'?'is-active':''}`} onClick={() => aplicarPeriodo("hoje")}>
                  <CalendarDaysIcon className="icon" aria-hidden="true" />
                  <span>Hoje</span>
                </button>
                <button className={`btn btn--neutral ${periodo==='semana'?'is-active':''}`} onClick={() => aplicarPeriodo("semana")}>
                  <span>Semana</span>
                </button>
                <button className={`btn btn--neutral ${periodo==='mes'?'is-active':''}`} onClick={() => aplicarPeriodo("mes")}>
                  <span>Mês</span>
                </button>
              </div>

              <div className="range-inline" role="group" aria-label="Intervalo customizado">
                <input type="date" className="input input--sm" value={de} onChange={(e)=>{ setDe(e.target.value); setPeriodo("custom"); }} />
                <span className="range-sep">—</span>
                <input type="date" className="input input--sm" value={ate} onChange={(e)=>{ setAte(e.target.value); setPeriodo("custom"); }} />
              </div>

              <div className="filters-inline">
                <FunnelIcon className="icon" aria-hidden="true" />
                <select className="input input--sm" value={folhaId} onChange={(e)=>setFolhaId(e.target.value)}>
                  {folhas.map(f => <option key={f.id} value={f.id}>{f.competencia} {f.status ? `• ${f.status}` : ""}</option>)}
                </select>

                <select className="input input--sm" value={folhaFuncId} onChange={(e)=>setFolhaFuncId(e.target.value)}>
                  <option value="todos">Todos os funcionários</option>
                  {funcOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>

                <select className="input input--sm" value={tipo} onChange={(e)=>setTipo(e.target.value)}>
                  <option value="todos">Todos os tipos</option>
                  {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>

                <input
                  className="input input--sm"
                  placeholder="Buscar por referência/observação/funcionário…"
                  value={busca}
                  onChange={(e)=>setBusca(e.target.value)}
                />
              </div>
            </div>

            {/* direita: ações */}
            <div className="actions-wrap">
              <button className="btn" data-accent="success" onClick={abrirNovo}>
                <PlusCircleIcon className="icon" aria-hidden="true" /><span>Novo</span>
              </button>
              <button className="btn" data-accent="info" onClick={exportarCSV}>
                <ArrowDownTrayIcon className="icon" aria-hidden="true" /><span>Exportar</span>
              </button>
              <button
                className="btn btn--neutral"
                onClick={carregarItens}
                disabled={loading}
                aria-busy={loading ? "true" : "false"}
              >
                {loading ? <span className="spinner" aria-hidden="true" /> : <ArrowPathIcon className="icon" aria-hidden="true" />}
                <span>{loading ? "Atualizando…" : "Atualizar"}</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {err && <div className="error-alert" role="alert" style={{ marginBottom: 12 }}>{err}</div>}

      {/* KPIs */}
      <div className="stats-grid">
        <div className="stat-card" data-accent="info">
          <div className="stat-card__icon">📄</div>
          <div className="stat-card__content">
            <div className="stat-value">{kpis.itens}</div>
            <div className="stat-title">Itens no período</div>
          </div>
        </div>
        <div className="stat-card" data-accent="success">
          <div className="stat-card__icon">💰</div>
          <div className="stat-card__content">
            <div className="stat-value">{kpis.valorTotalFmt}</div>
            <div className="stat-title">Valor total</div>
          </div>
        </div>
        <div className="stat-card" data-accent="warning">
          <div className="stat-card__icon">👥</div>
          <div className="stat-card__content">
            <div className="stat-value">{kpis.funcionarios}</div>
            <div className="stat-title">Funcionários impactados</div>
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="card">
        <div className="table-responsive">
          <table className="tbl" role="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Funcionário</th>
                <th>Tipo</th>
                <th>Referência</th>
                <th style={{textAlign:"right"}}>Qtd</th>
                <th style={{textAlign:"right"}}>Valor Unit.</th>
                <th style={{textAlign:"right"}}>Valor Total</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {itens.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", color: "var(--muted)" }}>
                    Nenhum item encontrado para os filtros selecionados.
                  </td>
                </tr>
              )}
              {itens.map((r) => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>{r.funcionario_nome || r.pessoa_nome || `#${r.folha_funcionario_id}`}</td>
                  <td><span className={`tag tag--${String(r.tipo||"").toLowerCase()}`}>{r.tipo || "-"}</span></td>
                  <td>{r.referencia || "-"}</td>
                  <td style={{textAlign:"right"}}>{Number(r.quantidade || 0).toLocaleString("pt-BR")}</td>
                  <td style={{textAlign:"right"}}>{toMoney(r.valor_unit)}</td>
                  <td style={{textAlign:"right", fontWeight:600}}>{toMoney(r.valor_total)}</td>
                  <td className="row-actions">
                    <button className="btn btn--icon" aria-label="Editar" onClick={() => abrirEdicao(r)}>
                      <PencilSquareIcon className="icon" />
                    </button>
                    <button className="btn btn--icon danger" aria-label="Excluir" onClick={() => excluir(r)}>
                      <TrashIcon className="icon" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            {itens.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={6} style={{ textAlign: "right", fontWeight: 700 }}>Total</td>
                  <td style={{ textAlign: "right", fontWeight: 700 }}>
                    {toMoney(itens.reduce((s, i) => s + Number(i.valor_total || 0), 0))}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <div className="card-foot">
          <span className="muted">{total} registro(s)</span>
        </div>
      </div>

      {/* Modal */}
      <Modal
        open={openModal}
        onClose={() => setOpenModal(false)}
        title={editando ? "Editar item" : "Novo item"}
        footer={
          <>
            <button className="btn btn--neutral" onClick={() => setOpenModal(false)}>Cancelar</button>
            {editando && (
              <button className="btn" data-accent="error" onClick={() => excluir(editando)}>
                <TrashIcon className="icon" aria-hidden="true" /><span>Excluir</span>
              </button>
            )}
            <button className="btn" data-accent="success" onClick={async () => { try { await salvar(); } catch(e){ alert(e.message); } }}>
              <span>Salvar</span>
            </button>
          </>
        }
      >
        <div className="form-grid">
          <label className="form-field">
            <span>Funcionário (linha da folha) *</span>
            <select
              value={form.folha_funcionario_id}
              onChange={(e)=>setForm({...form, folha_funcionario_id: e.target.value})}
              className="input"
              required
            >
              <option value="">Selecione…</option>
              {funcOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </label>

          <label className="form-field">
            <span>Tipo</span>
            <select value={form.tipo} onChange={(e)=>setForm({...form, tipo: e.target.value})} className="input">
              {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>

          <label className="form-field">
            <span>Referência</span>
            <input
              className="input"
              value={form.referencia}
              onChange={(e)=>setForm({...form, referencia: e.target.value})}
              placeholder="ex.: Adiantamento, Vale-transporte…"
            />
          </label>

          <label className="form-field">
            <span>Quantidade</span>
            <input
              className="input"
              inputMode="decimal"
              value={form.quantidade}
              onChange={(e)=>setForm({...form, quantidade: e.target.value})}
              placeholder="ex.: 1,00"
            />
          </label>

          <label className="form-field">
            <span>Valor unitário (R$)</span>
            <input
              className="input"
              inputMode="decimal"
              value={form.valor_unit}
              onChange={(e)=>setForm({...form, valor_unit: e.target.value})}
              placeholder="ex.: 100,00"
            />
          </label>

          <label className="form-field">
            <span>Valor total (R$)</span>
            <input
              className="input"
              inputMode="decimal"
              value={form.valor_total}
              onChange={(e)=>setForm({...form, valor_total: e.target.value})}
            />
          </label>
        </div>
      </Modal>

      {/* estilos locais: SEM perder o tema (usa vars do global.css) */}
      <style jsx>{`
        .toolbar-grid{width:100%;display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center}
        .filters-wrap{display:flex;align-items:center;flex-wrap:wrap;gap:10px 12px;min-width:0}
        .filters-inline{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
        .range-inline{display:flex;align-items:center;gap:6px}
        .range-sep{color:var(--muted)}
        .actions-wrap{display:flex;gap:8px;justify-self:end}
        .btn .icon{width:18px;height:18px}
        @media (max-width: 1100px){ .toolbar-grid{grid-template-columns:1fr} .actions-wrap{justify-self:stretch} .actions-wrap .btn{width:100%;justify-content:center} }

        .stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin:16px 0}
        .stat-card{background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:16px;display:flex;align-items:center;gap:12px}
        .stat-card[data-accent="info"]{border-left:4px solid var(--info)}
        .stat-card[data-accent="success"]{border-left:4px solid var(--success)}
        .stat-card[data-accent="warning"]{border-left:4px solid var(--warning)}
        .stat-card__icon{width:40px;height:40px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:var(--panel-muted)}
        .stat-value{font-size:1.6rem;font-weight:700;line-height:1}
        .stat-title{font-size:.85rem;color:var(--muted);font-weight:600}

        .card{background:var(--panel);border:1px solid var(--border);border-radius:12px;overflow:hidden;box-shadow:var(--shadow)}
        .table-responsive{width:100%;overflow:auto}
        table.tbl{width:100%;border-collapse:separate;border-spacing:0}
        .tbl thead th{position:sticky;top:0;background:var(--panel-muted);border-bottom:1px solid var(--border);text-align:left;padding:10px;font-size:.9rem}
        .tbl tbody td{border-bottom:1px solid var(--border);padding:10px;vertical-align:middle}
        .tbl tfoot td{background:var(--panel-muted);padding:10px;border-top:1px solid var(--border)}
        .row-actions{display:flex;gap:4px}
        .btn--icon{padding:8px}
        .btn--icon.danger{color:var(--error)}
        .tag{display:inline-flex;align-items:center;border-radius:999px;padding:2px 8px;font-size:.75rem;font-weight:700;border:1px solid var(--border);background:var(--panel-muted)}
        .tag--provento{color:var(--success)}
        .tag--desconto{color:var(--error)}
        .tag--outro{color:var(--info)}

        .card-foot{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:var(--panel-muted);font-size:.9rem}
        .muted{color:var(--muted)}

        .form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .form-field{display:flex;flex-direction:column;gap:6px}
        .form-field>span{font-size:.9rem;font-weight:600}
        @media (max-width: 640px){ .form-grid{grid-template-columns:1fr} }
      `}</style>
    </>
  );
}