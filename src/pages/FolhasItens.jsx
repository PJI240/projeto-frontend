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
  ClipboardDocumentListIcon,
  CurrencyDollarIcon,
  UserGroupIcon,
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
          <button className="btn btn--neutral btn--icon" onClick={onClose} aria-label="Fechar">
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
        <div className="page-header__content">
          <div className="page-header__info">
            <h1 id="titulo-pagina" className="page-title">Itens de Folha</h1>
            <p className="page-subtitle">Cadastre proventos, descontos e lançamentos manuais por funcionário da folha.</p>
          </div>

          <div className="page-header__toolbar">
            <button className="btn btn--success" onClick={abrirNovo}>
              <PlusCircleIcon className="icon" aria-hidden="true" />
              <span>Novo Item</span>
            </button>
            <button className="btn btn--info" onClick={exportarCSV}>
              <ArrowDownTrayIcon className="icon" aria-hidden="true" />
              <span>Exportar</span>
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

        {/* Filtros */}
        <div className="filters-section">
          <div className="filters-group">
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
                placeholder="Buscar por referência/funcionário…"
                value={busca}
                onChange={(e)=>setBusca(e.target.value)}
              />
            </div>
          </div>
        </div>
      </header>

      {err && <div className="alert alert--error" role="alert" style={{ marginBottom: 12 }}>{err}</div>}

      {/* KPIs */}
      <div className="stats-grid">
        <div className="stat-card stat-card--info">
          <div className="stat-card__icon">
            <ClipboardDocumentListIcon className="icon" aria-hidden="true" />
          </div>
          <div className="stat-card__content">
            <div className="stat-value">{kpis.itens}</div>
            <div className="stat-title">Itens no período</div>
          </div>
        </div>
        <div className="stat-card stat-card--success">
          <div className="stat-card__icon">
            <CurrencyDollarIcon className="icon" aria-hidden="true" />
          </div>
          <div className="stat-card__content">
            <div className="stat-value">{kpis.valorTotalFmt}</div>
            <div className="stat-title">Valor total</div>
          </div>
        </div>
        <div className="stat-card stat-card--warning">
          <div className="stat-card__icon">
            <UserGroupIcon className="icon" aria-hidden="true" />
          </div>
          <div className="stat-card__content">
            <div className="stat-value">{kpis.funcionarios}</div>
            <div className="stat-title">Funcionários impactados</div>
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="table-wrap">
        <div className="table">
          <div className="th">ID</div>
          <div className="th">Funcionário</div>
          <div className="th">Tipo</div>
          <div className="th">Referência</div>
          <div className="th" style={{textAlign:"right"}}>Qtd</div>
          <div className="th" style={{textAlign:"right"}}>Valor Unit.</div>
          <div className="th" style={{textAlign:"right"}}>Valor Total</div>
          <div className="th th--actions">Ações</div>

          {itens.length === 0 && (
            <div className="td td--empty" style={{ gridColumn: "1 / -1" }}>
              Nenhum item encontrado para os filtros selecionados.
            </div>
          )}
          
          {itens.map((r) => (
            <div key={r.id} className="row">
              <div className="td">{r.id}</div>
              <div className="td">{r.funcionario_nome || r.pessoa_nome || `#${r.folha_funcionario_id}`}</div>
              <div className="td">
                <span className={`badge badge--${String(r.tipo||"").toLowerCase()}`}>
                  {r.tipo || "-"}
                </span>
              </div>
              <div className="td">{r.referencia || "-"}</div>
              <div className="td td--number">{Number(r.quantidade || 0).toLocaleString("pt-BR")}</div>
              <div className="td td--number">{toMoney(r.valor_unit)}</div>
              <div className="td td--number" style={{fontWeight:600}}>{toMoney(r.valor_total)}</div>
              <div className="td td--actions">
                <button className="btn btn--neutral btn--icon" aria-label="Editar" onClick={() => abrirEdicao(r)}>
                  <PencilSquareIcon className="icon" />
                </button>
                <button className="btn btn--danger btn--icon" aria-label="Excluir" onClick={() => excluir(r)}>
                  <TrashIcon className="icon" />
                </button>
              </div>
            </div>
          ))}
          
          {itens.length > 0 && (
            <div className="row row--footer">
              <div className="td" style={{gridColumn: "1 / 7", textAlign: "right", fontWeight: 700}}>Total</div>
              <div className="td td--number" style={{fontWeight: 700}}>
                {toMoney(itens.reduce((s, i) => s + Number(i.valor_total || 0), 0))}
              </div>
              <div className="td"></div>
            </div>
          )}
        </div>
        
        <div className="table-footer">
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
              <button className="btn btn--danger" onClick={() => excluir(editando)}>
                <TrashIcon className="icon" aria-hidden="true" /><span>Excluir</span>
              </button>
            )}
            <button className="btn btn--success" onClick={async () => { try { await salvar(); } catch(e){ alert(e.message); } }}>
              <span>Salvar</span>
            </button>
          </>
        }
      >
        <div className="form-grid">
          <div className="form-field">
            <label>Funcionário (linha da folha) *</label>
            <select
              value={form.folha_funcionario_id}
              onChange={(e)=>setForm({...form, folha_funcionario_id: e.target.value})}
              className="input"
              required
            >
              <option value="">Selecione…</option>
              {funcOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>

          <div className="form-field">
            <label>Tipo</label>
            <select value={form.tipo} onChange={(e)=>setForm({...form, tipo: e.target.value})} className="input">
              {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="form-field">
            <label>Referência</label>
            <input
              className="input"
              value={form.referencia}
              onChange={(e)=>setForm({...form, referencia: e.target.value})}
              placeholder="ex.: Adiantamento, Vale-transporte…"
            />
          </div>

          <div className="form-field">
            <label>Quantidade</label>
            <input
              className="input"
              inputMode="decimal"
              value={form.quantidade}
              onChange={(e)=>setForm({...form, quantidade: e.target.value})}
              placeholder="ex.: 1,00"
            />
          </div>

          <div className="form-field">
            <label>Valor unitário (R$)</label>
            <input
              className="input"
              inputMode="decimal"
              value={form.valor_unit}
              onChange={(e)=>setForm({...form, valor_unit: e.target.value})}
              placeholder="ex.: 100,00"
            />
          </div>

          <div className="form-field">
            <label>Valor total (R$)</label>
            <input
              className="input"
              inputMode="decimal"
              value={form.valor_total}
              onChange={(e)=>setForm({...form, valor_total: e.target.value})}
            />
          </div>
        </div>
      </Modal>

      {/* estilos locais */}
      <style jsx>{`
        /* Header layout */
        .page-header__content{
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          width: 100%;
        }
        .page-header__info{
          flex: 1;
          min-width: 0;
        }
        .page-header__toolbar{
          display: flex;
          gap: 8px;
          flex-shrink: 0;
          align-items: center;
        }

        /* Filtros section */
        .filters-section{
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid var(--border);
        }
        .filters-group{
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          align-items: center;
        }

        .btn-group{ display:flex; gap:6px; flex-wrap:wrap }
        .btn-group .btn.is-active{ 
          outline: 2px solid var(--accent); 
          outline-offset: -2px;
          background: var(--accent-bg);
          color: var(--accent-fg);
        }

        .range-inline{ display:flex; align-items:center; gap:6px; flex-wrap:wrap }
        .range-sep{ color: var(--muted) }

        .filters-inline{ 
          display:flex; align-items:center; gap:8px; flex-wrap:wrap;
          margin-left: auto;
        }
        .filters-inline .icon{ width:18px; height:18px; color: var(--muted) }

        /* Stats grid */
        .stats-grid{
          display:grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap:16px;
          margin-bottom:12px;
          width:100%;
        }
        .stat-card{ 
          background:var(--panel);
          border:1px solid var(--border);
          border-radius:12px;
          padding:16px;
          display:flex;
          align-items:center;
          gap:12px;
          box-shadow:var(--shadow);
          border-left: 4px solid var(--border);
        }
        .stat-card--info{ border-left-color: var(--info) }
        .stat-card--success{ border-left-color: var(--success) }
        .stat-card--warning{ border-left-color: var(--warning) }
        .stat-card__icon{ 
          width:44px;
          height:44px;
          border-radius:8px;
          display:flex;
          align-items:center;
          justify-content:center;
          background:var(--panel-muted);
          color: var(--muted);
        }
        .stat-card__content{ flex:1 }
        .stat-value{ font-size:1.75rem; font-weight:800; line-height:1 }
        .stat-title{ font-size:.875rem; color:var(--muted); font-weight:600 }

        /* Table grid */
        .table-wrap{ 
          width:100%;
          overflow:auto;
          border:1px solid var(--border);
          border-radius:8px;
          background:var(--panel);
          box-shadow:var(--shadow);
        }
        .table{ 
          display:grid;
          grid-template-columns: 80px 1.5fr 120px 1.2fr 100px 120px 120px 110px;
          min-width: 1000px;
        }
        .th{ 
          padding:12px;
          border-bottom:2px solid var(--border);
          background:var(--panel-muted);
          font-weight:700;
          font-size:14px;
        }
        .th--actions{ text-align:center }
        .row{ display:contents }
        .row--footer{ display:contents }
        .td{ 
          padding:12px;
          border-bottom:1px solid var(--border);
          display:flex;
          align-items:center;
          gap:8px;
        }
        .td--empty{
          justify-content: center;
          color: var(--muted);
          font-style: italic;
          grid-column: 1 / -1;
          padding: 24px;
        }
        .td--number{ justify-content: flex-end; text-align: right }
        .td--actions{ justify-content:center; gap:6px }

        /* Badges */
        .badge{
          display: inline-flex;
          align-items: center;
          padding: 4px 8px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          border: 1px solid;
        }
        .badge--provento{ 
          background: var(--success-bg);
          color: var(--success-fg);
          border-color: var(--success-border);
        }
        .badge--desconto{ 
          background: var(--error-bg);
          color: var(--error-fg);
          border-color: var(--error-border);
        }
        .badge--outro{ 
          background: var(--info-bg);
          color: var(--info-fg);
          border-color: var(--info-border);
        }

        .table-footer{
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: var(--panel-muted);
          border-top: 1px solid var(--border);
          font-size: 14px;
        }
        .muted{ color: var(--muted) }

        /* Form */
        .form-grid{
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .form-field{
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .form-field > label{
          font-size: 14px;
          font-weight: 600;
        }

        /* Responsive */
        @media (max-width: 900px){
          .page-header__content{
            flex-direction: column;
            gap: 12px;
          }
          .page-header__toolbar{
            width: 100%;
            justify-content: flex-start;
            flex-wrap: wrap;
          }
          .filters-group{
            flex-direction: column;
            align-items: stretch;
          }
          .filters-inline{
            margin-left: 0;
            width: 100%;
          }
          .form-grid{ grid-template-columns:1fr }
        }
        @media (max-width: 480px){
          .page-header__toolbar{
            flex-direction: column;
            align-items: stretch;
          }
          .page-header__toolbar .btn{
            justify-content: center;
          }
        }
      `}</style>
    </>
  );
}