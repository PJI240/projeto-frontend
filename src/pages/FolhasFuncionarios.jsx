// src/pages/FolhasFuncionarios.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  CalendarDaysIcon,
  ClipboardDocumentListIcon,
  ClockIcon,
  FunnelIcon,
  PencilSquareIcon,
  PlusCircleIcon,
  PrinterIcon,
  TrashIcon,
  BoltIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

const API_BASE = (import.meta.env.VITE_API_BASE?.replace(/\/+$/, "") || "");

/* ============ Utils numéricos/formatadores (robustos a BR/EN) ============ */
const brMoney = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const brNum2  = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function parseDec(n) {
  if (n == null || n === "") return 0;
  if (typeof n === "number" && Number.isFinite(n)) return n;
  const s = String(n).trim();
  if (s.includes(",") && !s.includes(".")) return Number(s.replace(/\./g, "").replace(",", ".")) || 0;
  return Number(s.replace(/[^0-9.-]/g, "")) || 0;
}
const money = (v) => brMoney.format(parseDec(v));
const num2  = (v) => brNum2.format(parseDec(v));

function csvEscape(v) {
  const s = String(v ?? "");
  return /[;\n\r"]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/* ============ Modal acessível (com fallback de estilo) ============ */
function Modal({ open, onClose, title, children, footer }) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", onKey);
    const t = setTimeout(() => {
      panelRef.current?.querySelector("input,select,textarea,button")?.focus?.();
    }, 0);
    return () => { document.removeEventListener("keydown", onKey); clearTimeout(t); };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="ff-modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div className="card ff-modal-panel" ref={panelRef}>
        <div className="ff-modal-header">
          <h2 id="modal-title"> {title} </h2>
          <button className="toggle-btn" onClick={onClose} aria-label="Fechar">
            <XMarkIcon className="icon-sm" />
          </button>
        </div>
        <div className="ff-modal-body">{children}</div>
        {footer && <div className="ff-modal-footer">{footer}</div>}
      </div>

      <style jsx>{`
        .ff-modal-backdrop { position:fixed; inset:0; background:rgba(0,0,0,.35); display:flex; align-items:center; justify-content:center; z-index:1000; padding:16px }
        .ff-modal-panel { width:100%; max-width: 900px }
        .ff-modal-header { display:flex; align-items:center; justify-content:space-between; gap:8px; border-bottom:1px solid var(--border) }
        .ff-modal-header h2 { font-size: var(--fs-18); font-weight: 700; margin: 0 }
        .ff-modal-body { margin-top: 10px }
        .ff-modal-footer { margin-top: 12px; display:flex; gap:8px; justify-content:flex-end; border-top:1px solid var(--border); padding-top: 10px }
      `}</style>
    </div>
  );
}

/* ============ Página Folha × Funcionários ============ */
export default function FolhasFuncionarios() {
  const liveRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState("");

  const [folhas, setFolhas] = useState([]);
  const [folhaId, setFolhaId] = useState("");
  const [statusFolha, setStatusFolha] = useState("todas");

  const [funcionarios, setFuncionarios] = useState([]);

  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [filtroFunc, setFiltroFunc] = useState("todos");

  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({
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
    inconsistencias: "",
  });

  /* ============ LOADERS (sem empresa_id; requireAuth resolve via cookie) ============ */
  const loadFolhas = useCallback(async () => {
    const qs = new URLSearchParams();
    if (statusFolha !== "todas") qs.set("status", statusFolha);
    const r = await fetch(`${API_BASE}/api/folhas?${qs}`, { credentials: "include" });
    const data = await r.json().catch(() => null);

    if (!r.ok || data?.ok === false) {
      // 404 ou outro erro: mostre feedback mas não quebre
      throw new Error(data?.error || `HTTP ${r.status}`);
    }

    const list = data.folhas || data || [];
    list.sort((a, b) => (a.competencia === b.competencia ? (b.id ?? 0) - (a.id ?? 0) : (a.competencia > b.competencia ? -1 : 1)));
    setFolhas(list);
    setFolhaId((prev) => prev || (list[0]?.id ?? ""));
    return list;
  }, [statusFolha]);

  const loadFuncionarios = useCallback(async () => {
    const r = await fetch(`${API_BASE}/api/funcionarios?ativos=1`, { credentials: "include" });
    const data = await r.json().catch(() => null);
    if (!r.ok || data?.ok === false) throw new Error(data?.error || `HTTP ${r.status}`);
    setFuncionarios(data.funcionarios || []);
  }, []);

  const loadRows = useCallback(async (folha_id, signal) => {
    if (!folha_id) { setRows([]); return; }
    const params = new URLSearchParams({ folha_id });
    if (filtroFunc !== "todos") params.set("funcionario_id", filtroFunc);
    if (q) params.set("q", q);

    const r = await fetch(`${API_BASE}/api/folhas-funcionarios?${params}`, { credentials: "include", signal });
    const data = await r.json().catch(() => null);
    if (!r.ok || data?.ok === false) throw new Error(data?.error || `HTTP ${r.status}`);

    const items = Array.isArray(data) ? data : (data.folhas_funcionarios || []);
    // Ordenar por nome (se existir) depois id
    items.sort((a, b) => {
      const af = funcionarios.find(f => f.id === a.funcionario_id);
      const bf = funcionarios.find(f => f.id === b.funcionario_id);
      const an = (af?.pessoa_nome || af?.pessoa?.nome || af?.nome || "").toLowerCase();
      const bn = (bf?.pessoa_nome || bf?.pessoa?.nome || bf?.nome || "").toLowerCase();
      if (an && bn && an !== bn) return an < bn ? -1 : 1;
      return (a.id ?? 0) - (b.id ?? 0);
    });

    setRows(items);
    if (liveRef.current) liveRef.current.textContent = "Registros atualizados.";
  }, [filtroFunc, q, funcionarios]);

  // Bootstrap
  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      setLoading(true); setErr(""); setSuccess("");
      try {
        await Promise.all([loadFolhas(), loadFuncionarios()]);
        if (folhaId) await loadRows(folhaId, ctrl.signal);
      } catch (e) {
        setErr(e.message || "Falha ao carregar dados.");
      } finally {
        setLoading(false);
      }
    })();
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recarrega as folhas ao mudar status
  useEffect(() => {
    (async () => {
      try { await loadFolhas(); } catch (e) { setErr(e.message || "Falha ao carregar folhas."); }
    })();
  }, [loadFolhas]);

  // Recarrega rows ao mudar filtros
  useEffect(() => {
    if (!folhaId) return;
    const ctrl = new AbortController();
    (async () => {
      try { setLoading(true); setErr(""); await loadRows(folhaId, ctrl.signal); }
      catch (e) { if (e.name !== "AbortError") setErr(e.message || "Falha ao carregar lançamentos."); }
      finally { setLoading(false); }
    })();
    return () => ctrl.abort();
  }, [folhaId, filtroFunc, q, loadRows]);

  const refresh = async () => {
    setLoading(true); setErr(""); setSuccess("");
    const ctrl = new AbortController();
    try {
      await Promise.all([loadFolhas(), loadFuncionarios()]);
      await loadRows(folhaId, ctrl.signal);
      setSuccess("Atualizado com sucesso.");
    } catch (e) {
      if (e.name !== "AbortError") setErr(e.message || "Falha ao atualizar.");
    } finally {
      setLoading(false);
    }
  };

  /* ============ Mapas/KPIs ============ */
  const mapFunc = useMemo(() => {
    const m = new Map();
    for (const f of funcionarios) m.set(f.id, f);
    return m;
  }, [funcionarios]);

  const kpis = useMemo(() => {
    let hn=0, h50=0, h100=0, vb=0, v50=0, v100=0, prov=0, desc=0, liq=0;
    let inconsistentes = 0;
    for (const r of rows) {
      hn   += parseDec(r.horas_normais);
      h50  += parseDec(r.he50_horas);
      h100 += parseDec(r.he100_horas);
      vb   += parseDec(r.valor_base);
      v50  += parseDec(r.valor_he50);
      v100 += parseDec(r.valor_he100);
      prov += parseDec(r.proventos);
      desc += parseDec(r.descontos);
      liq  += parseDec(r.total_liquido);
      if ((r.inconsistencias || "").trim()) inconsistentes++;
    }
    return { total: rows.length, hn, h50, h100, vb, v50, v100, prov, desc, liq, inconsistentes };
  }, [rows]);

  /* ============ CRUD ============ */
  const abrirNovo = () => {
    setEditando(null);
    setForm({
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
      inconsistencias: "",
    });
    setModalOpen(true);
  };
  const abrirEdicao = (r) => {
    setEditando(r);
    setForm({
      funcionario_id: r.funcionario_id ?? "",
      horas_normais: r.horas_normais ?? "",
      he50_horas: r.he50_horas ?? "",
      he100_horas: r.he100_horas ?? "",
      valor_base: r.valor_base ?? "",
      valor_he50: r.valor_he50 ?? "",
      valor_he100: r.valor_he100 ?? "",
      descontos: r.descontos ?? "",
      proventos: r.proventos ?? "",
      total_liquido: r.total_liquido ?? "",
      inconsistencias: r.inconsistencias ?? "",
    });
    setModalOpen(true);
  };

  const payloadFromForm = () => {
    const p = {
      folha_id: Number(folhaId),
      funcionario_id: Number(form.funcionario_id),
      horas_normais: parseDec(form.horas_normais),
      he50_horas: parseDec(form.he50_horas),
      he100_horas: parseDec(form.he100_horas),
      valor_base: parseDec(form.valor_base),
      valor_he50: parseDec(form.valor_he50),
      valor_he100: parseDec(form.valor_he100),
      descontos: parseDec(form.descontos),
      proventos: parseDec(form.proventos),
      total_liquido: form.total_liquido === "" ? null : parseDec(form.total_liquido),
      inconsistencias: (form.inconsistencias || "").trim() || null,
    };
    if (p.total_liquido == null) {
      p.total_liquido = p.valor_base + p.valor_he50 + p.valor_he100 + p.proventos - p.descontos;
    }
    return p;
  };

  const salvar = async () => {
    try {
      setErr(""); setSuccess("");
      if (!folhaId) throw new Error("Selecione uma Folha.");
      const p = payloadFromForm();
      if (!p.funcionario_id) throw new Error("Selecione um funcionário.");

      const init = {
        method: editando ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(p),
      };
      const url = editando
        ? `${API_BASE}/api/folhas-funcionarios/${editando.id}`
        : `${API_BASE}/api/folhas-funcionarios`;

      const r = await fetch(url, init);
      const data = await r.json().catch(() => null);
      if (!r.ok || data?.ok === false) throw new Error(data?.error || `HTTP ${r.status}`);

      setSuccess(editando ? "Registro atualizado." : "Registro criado.");
      setModalOpen(false);
      await refresh();
    } catch (e) {
      setErr(e.message || "Falha ao salvar.");
    }
  };

  const excluir = async (r) => {
    if (!r?.id) return;
    const f = mapFunc.get(r.funcionario_id);
    const nome = f?.pessoa_nome || f?.pessoa?.nome || f?.nome || `#${r.funcionario_id}`;
    if (!confirm(`Remover lançamento de ${nome}?`)) return;
    try {
      setErr(""); setSuccess("");
      const res = await fetch(`${API_BASE}/api/folhas-funcionarios/${r.id}`, { method: "DELETE", credentials: "include" });
      const data = await res.json().catch(() => null);
      if (!res.ok || data?.ok === false) throw new Error(data?.error || `HTTP ${res.status}`);
      setSuccess("Registro removido.");
      await refresh();
    } catch (e) {
      setErr(e.message || "Falha ao excluir.");
    }
  };

  /* ============ Exportações ============ */
  const exportCSV = () => {
    const header = [
      "id","folha_id","funcionario_id","funcionario_nome",
      "horas_normais","he50_horas","he100_horas",
      "valor_base","valor_he50","valor_he100",
      "descontos","proventos","total_liquido","inconsistencias"
    ];
    const linhas = rows.map(r => {
      const f = mapFunc.get(r.funcionario_id);
      const nome = f?.pessoa_nome || f?.pessoa?.nome || f?.nome || "";
      return [
        r.id, r.folha_id, r.funcionario_id, nome,
        r.horas_normais, r.he50_horas, r.he100_horas,
        r.valor_base, r.valor_he50, r.valor_he100,
        r.descontos, r.proventos, r.total_liquido,
        (r.inconsistencias || "").replace(/\r?\n/g, "\\n"),
      ];
    });
    const csv = [header, ...linhas].map(row => row.map(csvEscape).join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const comp = (folhas.find(f => f.id === folhaId)?.competencia) || "sem_competencia";
    a.download = `folhas_funcionarios_${comp}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    const folha = folhas.find(f => f.id === folhaId);
    const rowsHtml = rows.map((r) => {
      const f = mapFunc.get(r.funcionario_id);
      const nome = (f?.pessoa_nome || f?.pessoa?.nome || f?.nome || `#${r.funcionario_id}`).replace(/</g,"&lt;");
      const inc = (r.inconsistencias || "").replace(/</g,"&lt;");
      return `
        <tr>
          <td>${r.id ?? "-"}</td>
          <td>${nome}</td>
          <td style="text-align:right">${num2(r.horas_normais)}</td>
          <td style="text-align:right">${num2(r.he50_horas)}</td>
          <td style="text-align:right">${num2(r.he100_horas)}</td>
          <td style="text-align:right">${money(r.valor_base)}</td>
          <td style="text-align:right">${money(r.valor_he50)}</td>
          <td style="text-align:right">${money(r.valor_he100)}</td>
          <td style="text-align:right">${money(r.proventos)}</td>
          <td style="text-align:right">-${money(r.descontos)}</td>
          <td style="text-align:right"><strong>${money(r.total_liquido)}</strong></td>
          <td>${inc || "—"}</td>
        </tr>
      `;
    }).join("");

    win.document.write(`
      <!doctype html><html lang="pt-BR">
      <head><meta charset="utf-8"/>
        <title>Folha ${folha?.competencia || ""}</title>
        <style>
          body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Inter,Ubuntu,'Helvetica Neue',Arial,sans-serif;padding:24px;color:#111827}
          h1{font-size:20px;margin:0 0 4px 0}
          p{margin:0 0 16px 0;color:#6b7280}
          table{width:100%;border-collapse:collapse;font-size:12px}
          th,td{border:1px solid #e5e7eb;padding:6px 8px;vertical-align:top}
          th{background:#f3f4f6;text-align:left}
          tfoot td{font-weight:700}
          @media print{ @page{size: A4 landscape; margin: 12mm} }
        </style>
      </head>
      <body>
        <h1>Folha × Funcionários</h1>
        <p>Competência: <strong>${folha?.competencia || "-"}</strong> ${folha?.status ? `• Status: ${String(folha.status).toUpperCase()}` : ""}</p>
        <table>
          <thead>
            <tr>
              <th>ID</th><th>Funcionário</th>
              <th>Hrs N</th><th>HE 50%</th><th>HE 100%</th>
              <th>Valor Base</th><th>Valor HE50</th><th>Valor HE100</th>
              <th>Proventos</th><th>Descontos</th><th>Total Líquido</th>
              <th>Inconsistências</th>
            </tr>
          </thead>
          <tbody>${rowsHtml || `<tr><td colspan="12">Sem lançamentos.</td></tr>`}</tbody>
          <tfoot>
            <tr>
              <td colspan="12">
                Lançamentos: ${kpis.total} • Hrs N: ${num2(kpis.hn)} • HE50: ${num2(kpis.h50)} • HE100: ${num2(kpis.h100)}
                • Base: ${money(kpis.vb)} • HE50: ${money(kpis.v50)} • HE100: ${money(kpis.v100)}
                • Prov: ${money(kpis.prov)} • Desc: ${money(kpis.desc)} • Líquido: ${money(kpis.liq)}
              </td>
            </tr>
          </tfoot>
        </table>
      </body></html>
    `);
    win.document.close();
  };

  /* ============ Filtragem visível (busca em nome/inc.) ============ */
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => {
      const f = mapFunc.get(r.funcionario_id);
      const nome = String(f?.pessoa_nome || f?.pessoa?.nome || f?.nome || "").toLowerCase();
      const inc = String(r.inconsistencias || "").toLowerCase();
      return nome.includes(term) || inc.includes(term);
    });
  }, [rows, q, mapFunc]);

  return (
    <>
      {/* live region */}
      <div ref={liveRef} aria-live="polite" style={{ position: "absolute", width:1, height:1, overflow:"hidden", clip:"rect(1px,1px,1px,1px)" }} />

      {/* Header */}
      <header className="main-header">
        <div className="header-content">
          <h1>Folha × Funcionários</h1>
          <p>Gerencie os lançamentos de horas e valores por funcionário dentro de uma <strong>Folha de Pagamento</strong>.</p>
        </div>

        <div className="toggles">
          <button className="toggle-btn primary" onClick={abrirNovo} title="Novo lançamento">
            <PlusCircleIcon className="icon-sm" />
            Novo
          </button>
          <button className="toggle-btn" onClick={exportCSV} title="Exportar CSV">
            <ArrowDownTrayIcon className="icon-sm" />
            CSV
          </button>
          <button className="toggle-btn" onClick={exportPDF} title="Exportar PDF">
            <PrinterIcon className="icon-sm" />
            PDF
          </button>
          <button
            className="toggle-btn"
            onClick={refresh}
            disabled={loading}
            aria-busy={loading ? "true" : "false"}
            title="Atualizar"
          >
            <ArrowPathIcon className={`icon-sm ${loading ? "animate-spin" : ""}`} />
            {loading ? "Atualizando..." : "Atualizar"}
          </button>
        </div>
      </header>

      {/* Alerts */}
      {err && <div className="error-alert" role="alert" style={{ marginBottom: 12 }}>{err}</div>}
      {success && <div className="success-alert" role="status" style={{ marginBottom: 12 }}>{success}</div>}

      {/* Filtros + KPIs */}
      <section style={{ marginBottom: 12 }}>
        <div className="card" style={{ display:"grid", gap:12 }}>
          <div style={{ display:"flex", gap:12, alignItems:"center", flexWrap:"wrap" }}>
            <CalendarDaysIcon className="icon-sm" />
            <label className="visually-hidden" htmlFor="sel-folha">Folha</label>
            <select id="sel-folha" className="input" value={folhaId || ""} onChange={(e)=>setFolhaId(e.target.value)} style={{ minWidth: 240 }}>
              {folhas.length === 0 && <option value="">Nenhuma folha</option>}
              {folhas.map(f => <option key={f.id} value={f.id}>{f.competencia} {f.status ? `— ${String(f.status).toUpperCase()}` : ""}</option>)}
            </select>

            <label className="visually-hidden" htmlFor="sel-status">Status</label>
            <select id="sel-status" className="input" value={statusFolha} onChange={(e)=>setStatusFolha(e.target.value)} title="Filtrar por status da folha" style={{ minWidth: 180 }}>
              <option value="todas">Todas as folhas</option>
              <option value="aberta">Apenas abertas</option>
              <option value="fechada">Apenas fechadas</option>
              <option value="aprovada">Apenas aprovadas</option>
            </select>

            <FunnelIcon className="icon-sm" />
            <label className="visually-hidden" htmlFor="sel-func">Funcionário</label>
            <select id="sel-func" className="input" value={filtroFunc} onChange={(e)=>setFiltroFunc(e.target.value)} style={{ minWidth: 220 }}>
              <option value="todos">Todos os funcionários</option>
              {funcionarios.map(f => {
                const nome = f.pessoa_nome || f?.pessoa?.nome || f.nome || `#${f.id}`;
                return <option key={f.id} value={f.id}>{nome}</option>;
              })}
            </select>

            <input
              aria-label="Buscar"
              className="input"
              placeholder="Buscar por nome ou inconsistências…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{ flex: 1, minWidth: 220 }}
            />
            <button className="toggle-btn" onClick={() => setQ("")} title="Limpar">Limpar</button>
          </div>

          {/* KPIs */}
          <div className="ff-kpis">
            <div className="ff-stat">
              <div className="ff-stat-icon"><ClipboardDocumentListIcon className="icon-sm" /></div>
              <div>
                <div className="ff-stat-value">{kpis.total}</div>
                <div className="ff-stat-label">Lançamentos</div>
              </div>
            </div>
            <div className="ff-stat">
              <div className="ff-stat-icon"><ClockIcon className="icon-sm" /></div>
              <div>
                <div className="ff-stat-value">{num2(kpis.hn)} / {num2(kpis.h50)} / {num2(kpis.h100)}</div>
                <div className="ff-stat-label">Horas (N / 50% / 100%)</div>
              </div>
            </div>
            <div className="ff-stat">
              <div className="ff-stat-icon"><BoltIcon className="icon-sm" /></div>
              <div>
                <div className="ff-stat-value">{money(kpis.vb + kpis.v50 + kpis.v100)}</div>
                <div className="ff-stat-label">Remuneração Bruta (Base+HE)</div>
              </div>
            </div>
            <div className="ff-stat">
              <div className="ff-stat-icon"><BoltIcon className="icon-sm" /></div>
              <div>
                <div className="ff-stat-value">{money(kpis.prov - kpis.desc)}</div>
                <div className="ff-stat-label">Proventos - Descontos</div>
              </div>
            </div>
            <div className="ff-stat">
              <div className="ff-stat-icon"><BoltIcon className="icon-sm" /></div>
              <div>
                <div className="ff-stat-value">{money(kpis.liq)}</div>
                <div className="ff-stat-label">Total Líquido (somado)</div>
              </div>
            </div>
            <div className="ff-stat">
              <div className="ff-stat-icon"><FunnelIcon className="icon-sm" /></div>
              <div>
                <div className="ff-stat-value">{kpis.inconsistentes}</div>
                <div className="ff-stat-label">Com inconsistências</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tabela */}
      <section>
        <div className="card">
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 240 }}>Funcionário</th>
                  <th>Hrs N</th>
                  <th>HE 50%</th>
                  <th>HE 100%</th>
                  <th>Base</th>
                  <th>V. HE50</th>
                  <th>V. HE100</th>
                  <th>Proventos</th>
                  <th>Descontos</th>
                  <th>Total Líq.</th>
                  <th>Inconsistências</th>
                  <th style={{ textAlign: "center" }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={12}>Carregando…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={12}>Nenhum lançamento encontrado.</td></tr>
                ) : (
                  filtered.map((r) => {
                    const f = mapFunc.get(r.funcionario_id);
                    const nome = f?.pessoa_nome || f?.pessoa?.nome || f?.nome || `#${r.funcionario_id}`;
                    return (
                      <tr key={r.id ?? `${r.funcionario_id}-${r.folha_id}`}>
                        <td>{nome}</td>
                        <td style={{ textAlign: "right" }}>{num2(r.horas_normais)}</td>
                        <td style={{ textAlign: "right" }}>{num2(r.he50_horas)}</td>
                        <td style={{ textAlign: "right" }}>{num2(r.he100_horas)}</td>
                        <td style={{ textAlign: "right" }}>{money(r.valor_base)}</td>
                        <td style={{ textAlign: "right" }}>{money(r.valor_he50)}</td>
                        <td style={{ textAlign: "right" }}>{money(r.valor_he100)}</td>
                        <td style={{ textAlign: "right" }}>{money(r.proventos)}</td>
                        <td style={{ textAlign: "right" }}>-{money(r.descontos)}</td>
                        <td style={{ textAlign: "right" }}><strong>{money(r.total_liquido)}</strong></td>
                        <td>{r.inconsistencias ? <span className="ff-badge-warn" title={r.inconsistencias}>Com apontes</span> : <span className="muted">—</span>}</td>
                        <td style={{ textAlign: "center", whiteSpace: "nowrap" }}>
                          <button className="btn-ghost" onClick={() => abrirEdicao(r)} title="Editar">
                            <PencilSquareIcon className="icon-sm" />
                          </button>
                          <button className="btn-ghost danger" onClick={() => excluir(r)} title="Excluir">
                            <TrashIcon className="icon-sm" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {filtered.length > 0 && (
                <tfoot>
                  <tr>
                    <td><strong>Totais</strong></td>
                    <td style={{ textAlign: "right" }}><strong>{num2(kpis.hn)}</strong></td>
                    <td style={{ textAlign: "right" }}><strong>{num2(kpis.h50)}</strong></td>
                    <td style={{ textAlign: "right" }}><strong>{num2(kpis.h100)}</strong></td>
                    <td style={{ textAlign: "right" }}><strong>{money(kpis.vb)}</strong></td>
                    <td style={{ textAlign: "right" }}><strong>{money(kpis.v50)}</strong></td>
                    <td style={{ textAlign: "right" }}><strong>{money(kpis.v100)}</strong></td>
                    <td style={{ textAlign: "right" }}><strong>{money(kpis.prov)}</strong></td>
                    <td style={{ textAlign: "right" }}><strong>-{money(kpis.desc)}</strong></td>
                    <td style={{ textAlign: "right" }}><strong>{money(kpis.liq)}</strong></td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          <p style={{ marginTop: 8, color: "var(--muted)", fontSize: "var(--fs-14)" }}>
            Dica: se a <strong>Folha</strong> estiver fechada/aprovada, você pode bloquear edição no backend via <code>status</code>.
          </p>
        </div>
      </section>

      {/* Modal CRUD */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editando ? "Editar lançamento" : "Novo lançamento"}
        footer={
          <>
            {editando && (
              <button className="toggle-btn danger" onClick={() => excluir(editando)}>
                <TrashIcon className="icon-sm" />
                Excluir
              </button>
            )}
            <button className="toggle-btn" onClick={() => setModalOpen(false)}>Cancelar</button>
            <button className="toggle-btn primary" onClick={salvar}>
              <PlusCircleIcon className="icon-sm" />
              {editando ? "Salvar" : "Adicionar"}
            </button>
          </>
        }
      >
        <div className="ff-form-grid">
          <div className="ff-form-row">
            <label>Folha</label>
            <div className="input" style={{ background: "var(--panel-muted)" }}>
              {folhas.find(f => f.id === folhaId)?.competencia || "-"}
            </div>
          </div>

          <div className="ff-form-row">
            <label>Funcionário *</label>
            <select className="input" value={form.funcionario_id} onChange={(e)=>setForm({ ...form, funcionario_id: e.target.value })} required>
              <option value="">Selecione…</option>
              {funcionarios.map((f) => {
                const nome = f.pessoa_nome || f?.pessoa?.nome || f.nome || `#${f.id}`;
                return <option key={f.id} value={f.id}>{nome}</option>;
              })}
            </select>
          </div>

          <div className="ff-grid-3">
            <div className="ff-form-row">
              <label>Horas Normais</label>
              <input className="input" inputMode="decimal" placeholder="0,00" value={form.horas_normais} onChange={(e)=>setForm({ ...form, horas_normais: e.target.value })} />
            </div>
            <div className="ff-form-row">
              <label>HE 50% (horas)</label>
              <input className="input" inputMode="decimal" placeholder="0,00" value={form.he50_horas} onChange={(e)=>setForm({ ...form, he50_horas: e.target.value })} />
            </div>
            <div className="ff-form-row">
              <label>HE 100% (horas)</label>
              <input className="input" inputMode="decimal" placeholder="0,00" value={form.he100_horas} onChange={(e)=>setForm({ ...form, he100_horas: e.target.value })} />
            </div>
          </div>

          <div className="ff-grid-3">
            <div className="ff-form-row">
              <label>Valor Base</label>
              <input className="input" inputMode="decimal" placeholder="0,00" value={form.valor_base} onChange={(e)=>setForm({ ...form, valor_base: e.target.value })} />
            </div>
            <div className="ff-form-row">
              <label>Valor HE 50%</label>
              <input className="input" inputMode="decimal" placeholder="0,00" value={form.valor_he50} onChange={(e)=>setForm({ ...form, valor_he50: e.target.value })} />
            </div>
            <div className="ff-form-row">
              <label>Valor HE 100%</label>
              <input className="input" inputMode="decimal" placeholder="0,00" value={form.valor_he100} onChange={(e)=>setForm({ ...form, valor_he100: e.target.value })} />
            </div>
          </div>

          <div className="ff-grid-3">
            <div className="ff-form-row">
              <label>Proventos</label>
              <input className="input" inputMode="decimal" placeholder="0,00" value={form.proventos} onChange={(e)=>setForm({ ...form, proventos: e.target.value })} />
            </div>
            <div className="ff-form-row">
              <label>Descontos</label>
              <input className="input" inputMode="decimal" placeholder="0,00" value={form.descontos} onChange={(e)=>setForm({ ...form, descontos: e.target.value })} />
            </div>
            <div className="ff-form-row">
              <label>Total Líquido (deixe em branco para calcular)</label>
              <input className="input" inputMode="decimal" placeholder="auto" value={form.total_liquido} onChange={(e)=>setForm({ ...form, total_liquido: e.target.value })} />
            </div>
          </div>

          <div className="ff-form-row">
            <label>Inconsistências</label>
            <textarea className="input" rows={4} placeholder="Apontamentos ou observações…" value={form.inconsistencias} onChange={(e)=>setForm({ ...form, inconsistencias: e.target.value })} />
          </div>
        </div>
      </Modal>

      {/* Fallback de estilos para tema HC (se global faltar, isso segura o layout e os botões) */}
      <style jsx>{`
        .visually-hidden { position:absolute !important; height:1px; width:1px; overflow:hidden; clip:rect(1px,1px,1px,1px); white-space:nowrap }
        .muted{ color: var(--muted) }

        /* Botões (fallback coerente com Permissoes.jsx) */
        .toggle-btn{
          display:inline-flex; align-items:center; gap:8px;
          border:1px solid var(--border); border-radius: var(--radius);
          background: var(--panel); color: var(--fg);
          padding: 8px 12px; font-weight: 600;
          transition: background .15s ease, border-color .15s ease;
        }
        .toggle-btn:hover{ background: var(--panel-muted) }
        .toggle-btn.primary{ background: var(--accent); border-color: var(--accent); color: var(--accent-fg) }
        .toggle-btn.primary:hover{ filter: brightness(0.98) }
        .toggle-btn.danger{ color: var(--error-fg); border-color: var(--error-border) }

        .btn-ghost{
          display:inline-flex; align-items:center; justify-content:center;
          padding:6px 8px; border:1px solid transparent; border-radius: var(--radius);
          background: transparent; color: var(--fg);
        }
        .btn-ghost:hover{ background: var(--panel-muted); border-color: var(--border) }
        .btn-ghost.danger{ color: var(--error-fg) }

        .ff-badge-warn{
          display:inline-flex; align-items:center; padding:2px 6px; border-radius:999px;
          font-size: var(--fs-12);
          border:1px solid var(--warning-border); background: var(--warning-bg); color: var(--warning-fg);
        }

        .input{
          width:100%; padding:10px 12px; border-radius: var(--radius);
          border:1px solid var(--border); background: var(--panel); color: var(--fg);
        }

        .ff-kpis{
          display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:12px;
        }
        .ff-stat{
          display:flex; align-items:center; gap:10px; padding:12px;
          border:1px solid var(--border); background: var(--panel);
          border-left:4px solid var(--accent); border-radius: var(--radius);
        }
        .ff-stat-icon{ width:36px; height:36px; display:flex; align-items:center; justify-content:center; border-radius:8px; background: var(--panel-muted); color: var(--muted) }
        .ff-stat-value{ font-size: 1.25rem; font-weight: 800; line-height: 1 }
        .ff-stat-label{ color: var(--muted); font-weight: 600 }

        .ff-form-grid{ display:grid; gap:12px }
        .ff-form-row > label{ display:block; font-weight:600; margin-bottom:6px; font-size: var(--fs-14) }
        .ff-grid-3{ display:grid; grid-template-columns: repeat(3,1fr); gap:12px }
        @media (max-width: 900px){ .ff-grid-3{ grid-template-columns: 1fr } }

        .table tfoot td{ background: var(--panel-muted) }
      `}</style>
    </>
  );
}
