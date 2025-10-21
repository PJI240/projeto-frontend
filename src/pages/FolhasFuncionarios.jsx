// src/pages/FolhasFuncionarios.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  BoltIcon,
  CalendarDaysIcon,
  ClipboardDocumentListIcon,
  ClockIcon,
  FunnelIcon,
  PencilSquareIcon,
  PlusCircleIcon,
  PrinterIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

const API_BASE = (import.meta.env.VITE_API_BASE?.replace(/\/+$/, "") || "");

/* =================== Utils =================== */
const brMoney = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const brNumber2 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Aceita "1.234,56" ou "1234.56" e devolve Number seguro. */
function parseDec(n) {
  if (n == null || n === "") return 0;
  if (typeof n === "number" && Number.isFinite(n)) return n;
  const s = String(n).trim();
  // Heurística: se tem vírgula, normaliza para ponto decimal BR
  if (s.includes(",") && !s.includes(".")) {
    return Number(s.replace(/\./g, "").replace(",", ".")) || 0;
  }
  // Caso EN ou misto
  const cleaned = s.replace(/[^0-9.\-]/g, "");
  return Number(cleaned) || 0;
}
const money = (v) => brMoney.format(parseDec(v));
const num2 = (v) => brNumber2.format(parseDec(v));

function normalizeMidday(d) {
  const r = new Date(d);
  r.setHours(12, 0, 0, 0);
  return r;
}
function toISO(d) {
  const nd = normalizeMidday(d);
  const yy = nd.getFullYear();
  const mm = String(nd.getMonth() + 1).padStart(2, "0");
  const dd = String(nd.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}
function fromISO(s) {
  const [y, m, d] = s.split("-").map(Number);
  return normalizeMidday(new Date(y, m - 1, d));
}
function formatBRDate(iso) {
  try {
    return fromISO(iso).toLocaleDateString("pt-BR");
  } catch {
    return iso || "-";
  }
}
function csvEscape(v) {
  const s = String(v ?? "");
  const needs = /[;\n\r"]/g.test(s);
  return needs ? `"${s.replace(/"/g, '""')}"` : s;
}

/* =================== Modal simples (acessível) =================== */
function Modal({ open, onClose, title, children, footer }) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", onKey);
    // foco inicial
    const t = setTimeout(() => { panelRef.current?.querySelector("input,select,textarea,button")?.focus?.(); }, 0);
    return () => { document.removeEventListener("keydown", onKey); clearTimeout(t); };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div className="modal-panel card" ref={panelRef}>
        <div className="modal-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <h2 id="modal-title" style={{ fontSize: "var(--fs-18)", fontWeight: 700 }}>{title}</h2>
          <button className="toggle-btn" onClick={onClose} aria-label="Fechar">
            <XMarkIcon className="icon-sm" />
          </button>
        </div>
        <div className="modal-body" style={{ marginTop: 8 }}>{children}</div>
        {footer && <div className="modal-footer" style={{ marginTop: 12, display: "flex", gap: 8, justifyContent: "flex-end" }}>{footer}</div>}
      </div>
      <style jsx>{`
        .modal-backdrop{ position:fixed; inset:0; background:rgba(0,0,0,.35); display:flex; align-items:center; justify-content:center; z-index:1000; padding:16px }
        .modal-panel{ width:100%; max-width: 880px; }
      `}</style>
    </div>
  );
}

/* =================== Página: Folhas × Funcionários =================== */
export default function FolhasFuncionarios() {
  const liveRef = useRef(null);

  /* ------------ Estado base ------------ */
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState("");

  /* Sessão/empresa */
  const [usuario, setUsuario] = useState(null);
  const [empresaId, setEmpresaId] = useState(null);

  /* Domínios auxiliares */
  const [funcionarios, setFuncionarios] = useState([]);
  const [folhas, setFolhas] = useState([]);
  const [folhaId, setFolhaId] = useState("");
  const [statusFolha, setStatusFolha] = useState("todas"); // filtro de status opcional

  /* Dados principais */
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [filtroFunc, setFiltroFunc] = useState("todos");

  /* Modal CRUD */
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

  /* ------------ Carregamentos (com AbortController) ------------ */
  // Sessão + empresa
  const loadSessao = useCallback(async () => {
    const r = await fetch(`${API_BASE}/api/sessao/usuario`, { credentials: "include" });
    const data = await r.json().catch(() => null);
    if (!r.ok || data?.ok === false) throw new Error(data?.error || `HTTP ${r.status}`);
    const u = data.usuario || data;
    setUsuario(u);

    const ru = await fetch(`${API_BASE}/api/empresas-usuarios?usuario_id=${encodeURIComponent(u.id)}&ativo=1`, { credentials: "include" });
    const eu = await ru.json().catch(() => null);
    if (!ru.ok || eu?.ok === false) throw new Error(eu?.error || `HTTP ${ru.status}`);
    const vinculos = eu.empresas_usuarios || eu || [];
    if (!Array.isArray(vinculos) || vinculos.length === 0) throw new Error("Usuário sem vínculo de empresa ativo.");

    const principal = vinculos.find(v => v.perfil_principal) || vinculos[0];
    setEmpresaId(principal.empresa_id);
    return principal.empresa_id;
  }, []);

  const loadFolhas = useCallback(async (empresa_id) => {
    const qs = new URLSearchParams({ empresa_id });
    if (statusFolha !== "todas") qs.set("status", statusFolha);
    const r = await fetch(`${API_BASE}/api/folhas?${qs}`, { credentials: "include" });
    const data = await r.json().catch(() => null);
    if (!r.ok || data?.ok === false) throw new Error(data?.error || `HTTP ${r.status}`);
    const list = data.folhas || data || [];
    // Ordena por competência desc (YYYY-MM) e id desc
    list.sort((a, b) => (a.competencia === b.competencia ? (b.id ?? 0) - (a.id ?? 0) : (a.competencia > b.competencia ? -1 : 1)));
    setFolhas(list);
    // Seleciona a folha mais recente se nenhuma selecionada
    setFolhaId((prev) => prev || (list[0]?.id ?? ""));
    return list;
  }, [statusFolha]);

  const loadFuncionarios = useCallback(async (empresa_id) => {
    const r = await fetch(`${API_BASE}/api/funcionarios?empresa_id=${encodeURIComponent(empresa_id)}&ativos=1`, { credentials: "include" });
    const data = await r.json().catch(() => null);
    if (!r.ok || data?.ok === false) throw new Error(data?.error || `HTTP ${r.status}`);
    setFuncionarios(data.funcionarios || []);
  }, []);

  const loadRows = useCallback(async (empresa_id, folha_id, signal) => {
    if (!empresa_id || !folha_id) { setRows([]); return; }
    const params = new URLSearchParams({ empresa_id, folha_id });
    if (filtroFunc !== "todos") params.set("funcionario_id", filtroFunc);
    if (q) params.set("q", q);
    const r = await fetch(`${API_BASE}/api/folhas-funcionarios?${params}`, { credentials: "include", signal });
    const data = await r.json().catch(() => null);
    if (!r.ok || data?.ok === false) throw new Error(data?.error || `HTTP ${r.status}`);
    const items = Array.isArray(data) ? data : (data.folhas_funcionarios || []);
    // Ordenação estável: por nome do funcionário (se disponível), senão por id
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

  // bootstrap
  useEffect(() => {
    let abort = new AbortController();
    setLoading(true); setErr(""); setSuccess("");
    (async () => {
      try {
        const empId = await loadSessao();
        await Promise.all([loadFolhas(empId), loadFuncionarios(empId)]);
        await loadRows(empId, folhaId, abort.signal);
      } catch (e) {
        console.error("FF_BOOT_ERR", e);
        setErr(e.message || "Falha ao carregar dados.");
      } finally {
        setLoading(false);
      }
    })();
    return () => { abort.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recarrega folhas quando filtro de status muda
  useEffect(() => {
    if (!empresaId) return;
    (async () => {
      try {
        await loadFolhas(empresaId);
      } catch (e) {
        setErr(e.message || "Falha ao carregar folhas.");
      }
    })();
  }, [empresaId, loadFolhas]);

  // Recarrega linhas ao mudar filtros principais
  useEffect(() => {
    if (!empresaId || !folhaId) return;
    const ctrl = new AbortController();
    (async () => {
      try {
        setLoading(true); setErr("");
        await loadRows(empresaId, folhaId, ctrl.signal);
      } catch (e) {
        if (e.name !== "AbortError") setErr(e.message || "Falha ao carregar lançamentos.");
      } finally {
        setLoading(false);
      }
    })();
    return () => ctrl.abort();
  }, [empresaId, folhaId, filtroFunc, q, loadRows]);

  const refresh = async () => {
    if (!empresaId) return;
    setLoading(true); setErr(""); setSuccess("");
    const ctrl = new AbortController();
    try {
      await Promise.all([loadFolhas(empresaId), loadFuncionarios(empresaId)]);
      await loadRows(empresaId, folhaId, ctrl.signal);
      setSuccess("Atualizado com sucesso.");
    } catch (e) {
      if (e.name !== "AbortError") setErr(e.message || "Falha ao atualizar.");
    } finally {
      setLoading(false);
    }
  };

  /* ------------ Mapeamentos ------------ */
  const mapFunc = useMemo(() => {
    const m = new Map();
    for (const f of funcionarios) {
      m.set(f.id, f);
    }
    return m;
  }, [funcionarios]);

  const folhaSelecionada = useMemo(() => folhas.find(f => f.id === folhaId), [folhas, folhaId]);

  /* ------------ KPIs ------------ */
  const kpis = useMemo(() => {
    let hn = 0, h50 = 0, h100 = 0;
    let vb = 0, v50 = 0, v100 = 0, desc = 0, prov = 0, liq = 0;
    const inconsistentes = rows.filter(r => (r.inconsistencias || "").trim()).length;

    for (const r of rows) {
      hn += parseDec(r.horas_normais);
      h50 += parseDec(r.he50_horas);
      h100 += parseDec(r.he100_horas);

      vb += parseDec(r.valor_base);
      v50 += parseDec(r.valor_he50);
      v100 += parseDec(r.valor_he100);
      desc += parseDec(r.descontos);
      prov += parseDec(r.proventos);
      liq += parseDec(r.total_liquido);
    }
    return { hn, h50, h100, vb, v50, v100, desc, prov, liq, inconsistentes, total: rows.length };
  }, [rows]);

  /* ------------ CRUD ------------ */
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
      empresa_id: empresaId,
      folha_id: folhaId,
      funcionario_id: Number(form.funcionario_id),
      horas_normais: parseDec(form.horas_normais),
      he50_horas: parseDec(form.he50_horas),
      he100_horas: parseDec(form.he100_horas),
      valor_base: parseDec(form.valor_base),
      valor_he50: parseDec(form.valor_he50),
      valor_he100: parseDec(form.valor_he100),
      descontos: parseDec(form.descontos),
      proventos: parseDec(form.proventos),
      total_liquido: parseDec(form.total_liquido),
      inconsistencias: (form.inconsistencias || "").trim() || null,
    };
    // Se total_liquido não foi informado, calcula
    if (!form.total_liquido && (p.valor_base || p.valor_he50 || p.valor_he100 || p.descontos || p.proventos)) {
      p.total_liquido = (p.valor_base + p.valor_he50 + p.valor_he100 + p.proventos - p.descontos);
    }
    return p;
  };

  const salvar = async () => {
    try {
      setErr(""); setSuccess("");
      if (!empresaId || !folhaId) throw new Error("Empresa ou Folha não selecionada.");
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
    if (!confirm(`Remover lançamento de ${nome} na folha ${folhaSelecionada?.competencia || folhaId}?`)) return;
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

  /* ------------ Exportações ------------ */
  const exportCSV = () => {
    const header = [
      "id","empresa_id","folha_id","funcionario_id","funcionario_nome",
      "horas_normais","he50_horas","he100_horas",
      "valor_base","valor_he50","valor_he100","descontos","proventos","total_liquido",
      "inconsistencias","competencia"
    ];
    const linhas = rows.map(r => {
      const f = mapFunc.get(r.funcionario_id);
      const nome = f?.pessoa_nome || f?.pessoa?.nome || f?.nome || "";
      return [
        r.id, r.empresa_id, r.folha_id, r.funcionario_id, nome,
        r.horas_normais, r.he50_horas, r.he100_horas,
        r.valor_base, r.valor_he50, r.valor_he100, r.descontos, r.proventos, r.total_liquido,
        (r.inconsistencias || "").replace(/\r?\n/g, "\\n"),
        folhaSelecionada?.competencia || ""
      ];
    });
    const csv = [header, ...linhas].map(row => row.map(csvEscape).join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const compet = folhaSelecionada?.competencia || "sem_competencia";
    a.download = `folhas_funcionarios_${compet}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    const head = `
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
    `;
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
      <head><meta charset="utf-8"/><title>Folha ${folhaSelecionada?.competencia || ""}</title>${head}</head>
      <body>
        <h1>Folha × Funcionários</h1>
        <p>Competência: <strong>${folhaSelecionada?.competencia || "-"}</strong> • Criado em: ${folhaSelecionada?.criado_em ? formatBRDate(String(folhaSelecionada.criado_em).slice(0,10)) : "-"}</p>
        <table>
          <thead>
            <tr>
              <th>ID</th><th>Funcionário</th>
              <th>Hrs Normais</th><th>HE 50%</th><th>HE 100%</th>
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
        <script>window.focus();</script>
      </body>
      </html>
    `);
    win.document.close();
  };

  /* ------------ Filtro e view ------------ */
  const filteredRows = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => {
      const f = mapFunc.get(r.funcionario_id);
      const nome = String(f?.pessoa_nome || f?.pessoa?.nome || f?.nome || "").toLowerCase();
      const inc = String(r.inconsistencias || "").toLowerCase();
      return nome.includes(term) || inc.includes(term);
    });
  }, [rows, q, mapFunc]);

  /* ------------ RENDER ------------ */
  return (
    <>
      <div ref={liveRef} aria-live="polite" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(1px, 1px, 1px, 1px)" }} />

      <header className="main-header">
        <div className="header-content">
          <h1>Folha × Funcionários</h1>
          <p>Gerencie os lançamentos de horas e valores por funcionário dentro de uma <strong>Folha de Pagamento</strong>.</p>
        </div>

        <div className="toggles">
          <button className="toggle-btn" onClick={abrirNovo} title="Novo lançamento">
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

      {err && <div className="error-alert" role="alert" style={{ marginBottom: 12 }}>{err}</div>}
      {success && <div className="success-alert" role="status" style={{ marginBottom: 12 }}>{success}</div>}

      {/* Filtros */}
      <section style={{ marginBottom: 12 }}>
        <div className="card" style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <CalendarDaysIcon className="icon-sm" />
            <label className="visually-hidden" htmlFor="sel-folha">Folha</label>
            <select
              id="sel-folha"
              className="select"
              value={folhaId || ""}
              onChange={(e) => setFolhaId(e.target.value)}
              style={{ minWidth: 240 }}
            >
              {folhas.length === 0 && <option value="">Nenhuma folha</option>}
              {folhas.map(f => (
                <option key={f.id} value={f.id}>
                  {f.competencia} {f.status ? `— ${String(f.status).toUpperCase()}` : ""}
                </option>
              ))}
            </select>

            <label className="visually-hidden" htmlFor="sel-status">Status</label>
            <select
              id="sel-status"
              className="select"
              value={statusFolha}
              onChange={(e) => setStatusFolha(e.target.value)}
              title="Filtrar por status da folha"
            >
              <option value="todas">Todas as folhas</option>
              <option value="aberta">Apenas abertas</option>
              <option value="fechada">Apenas fechadas</option>
              <option value="aprovada">Apenas aprovadas</option>
            </select>

            <FunnelIcon className="icon-sm" />
            <label className="visualmente-oculto" htmlFor="sel-func">Funcionário</label>
            <select
              id="sel-func"
              className="select"
              value={filtroFunc}
              onChange={(e) => setFiltroFunc(e.target.value)}
              style={{ minWidth: 220 }}
            >
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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            <div className="stat-card">
              <div className="stat-icon"><ClipboardDocumentListIcon className="icon-sm" /></div>
              <div>
                <div className="stat-value">{kpis.total}</div>
                <div className="stat-label">Lançamentos</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon"><ClockIcon className="icon-sm" /></div>
              <div>
                <div className="stat-value">{num2(kpis.hn)} / {num2(kpis.h50)} / {num2(kpis.h100)}</div>
                <div className="stat-label">Horas (N / 50% / 100%)</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon"><BoltIcon className="icon-sm" /></div>
              <div>
                <div className="stat-value">{money(kpis.vb + kpis.v50 + kpis.v100)}</div>
                <div className="stat-label">Remuneração Bruta (Base+HE)</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon"><BoltIcon className="icon-sm" /></div>
              <div>
                <div className="stat-value">{money(kpis.prov - kpis.desc)}</div>
                <div className="stat-label">Proventos - Descontos</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon"><BoltIcon className="icon-sm" /></div>
              <div>
                <div className="stat-value">{money(kpis.liq)}</div>
                <div className="stat-label">Total Líquido (somado)</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon"><FunnelIcon className="icon-sm" /></div>
              <div>
                <div className="stat-value">{kpis.inconsistentes}</div>
                <div className="stat-label">Com inconsistências</div>
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
                  <th title="Horas Normais">Hrs N</th>
                  <th title="Horas Extras 50%">HE 50%</th>
                  <th title="Horas Extras 100%">HE 100%</th>
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
                ) : filteredRows.length === 0 ? (
                  <tr><td colSpan={12}>Nenhum lançamento encontrado.</td></tr>
                ) : (
                  filteredRows.map((r) => {
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
                        <td>{r.inconsistencias ? <span className="badge badge-warn" title={r.inconsistencias}>Com apontes</span> : <span className="muted">—</span>}</td>
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
              {filteredRows.length > 0 && (
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
        <div className="form-grid">
          <div className="form-row">
            <label>Folha</label>
            <div className="input" style={{ background: "var(--panel-muted)" }}>
              {folhaSelecionada ? `${folhaSelecionada.competencia} ${folhaSelecionada.status ? "— " + String(folhaSelecionada.status).toUpperCase() : ""}` : "-"}
            </div>
          </div>

          <div className="form-row">
            <label>Funcionário *</label>
            <select
              className="input"
              value={form.funcionario_id}
              onChange={(e) => setForm({ ...form, funcionario_id: e.target.value })}
              required
            >
              <option value="">Selecione…</option>
              {funcionarios.map((f) => {
                const nome = f.pessoa_nome || f?.pessoa?.nome || f.nome || `#${f.id}`;
                return <option key={f.id} value={f.id}>{nome}</option>;
              })}
            </select>
          </div>

          <div className="grid-3">
            <div className="form-row">
              <label>Horas Normais</label>
              <input className="input" inputMode="decimal" placeholder="0,00" value={form.horas_normais} onChange={(e) => setForm({ ...form, horas_normais: e.target.value })} />
            </div>
            <div className="form-row">
              <label>HE 50% (horas)</label>
              <input className="input" inputMode="decimal" placeholder="0,00" value={form.he50_horas} onChange={(e) => setForm({ ...form, he50_horas: e.target.value })} />
            </div>
            <div className="form-row">
              <label>HE 100% (horas)</label>
              <input className="input" inputMode="decimal" placeholder="0,00" value={form.he100_horas} onChange={(e) => setForm({ ...form, he100_horas: e.target.value })} />
            </div>
          </div>

          <div className="grid-3">
            <div className="form-row">
              <label>Valor Base</label>
              <input className="input" inputMode="decimal" placeholder="0,00" value={form.valor_base} onChange={(e) => setForm({ ...form, valor_base: e.target.value })} />
            </div>
            <div className="form-row">
              <label>Valor HE 50%</label>
              <input className="input" inputMode="decimal" placeholder="0,00" value={form.valor_he50} onChange={(e) => setForm({ ...form, valor_he50: e.target.value })} />
            </div>
            <div className="form-row">
              <label>Valor HE 100%</label>
              <input className="input" inputMode="decimal" placeholder="0,00" value={form.valor_he100} onChange={(e) => setForm({ ...form, valor_he100: e.target.value })} />
            </div>
          </div>

          <div className="grid-3">
            <div className="form-row">
              <label>Proventos</label>
              <input className="input" inputMode="decimal" placeholder="0,00" value={form.proventos} onChange={(e) => setForm({ ...form, proventos: e.target.value })} />
            </div>
            <div className="form-row">
              <label>Descontos</label>
              <input className="input" inputMode="decimal" placeholder="0,00" value={form.descontos} onChange={(e) => setForm({ ...form, descontos: e.target.value })} />
            </div>
            <div className="form-row">
              <label>Total Líquido (deixe em branco para calcular)</label>
              <input className="input" inputMode="decimal" placeholder="auto" value={form.total_liquido} onChange={(e) => setForm({ ...form, total_liquido: e.target.value })} />
            </div>
          </div>

          <div className="form-row">
            <label>Inconsistências</label>
            <textarea className="input" rows={4} placeholder="Apontamentos ou observações…" value={form.inconsistencias} onChange={(e) => setForm({ ...form, inconsistencias: e.target.value })} />
          </div>
        </div>
      </Modal>

      {/* Estilos locais coesos ao tema HC */}
      <style jsx>{`
        .visually-hidden { position:absolute !important; height:1px; width:1px; overflow:hidden; clip:rect(1px, 1px, 1px, 1px); white-space:nowrap }
        .muted{ color: var(--muted) }

        .select, .input {
          width: 100%;
          padding: 10px 12px;
          border-radius: var(--radius);
          border: 1px solid var(--border);
          background: var(--panel);
          color: var(--fg);
        }
        .btn-ghost {
          display:inline-flex; align-items:center; justify-content:center; gap:6px;
          padding:6px 8px; border-radius: var(--radius);
          background: transparent; color: var(--fg);
          border: 1px solid transparent;
        }
        .btn-ghost:hover { background: var(--panel-muted); border-color: var(--border) }
        .btn-ghost.danger { color: var(--error-fg) }

        .badge { display:inline-flex; align-items:center; padding:2px 6px; border-radius: 999px; font-size: var(--fs-12); border:1px solid var(--warning-border); background:var(--warning-bg); color:var(--warning-fg) }
        .badge-warn { border-color: var(--warning-border) }

        .stat-card {
          display:flex; align-items:center; gap:10px; padding:12px;
          border:1px solid var(--border); background: var(--panel);
          border-left: 4px solid var(--accent); border-radius: var(--radius);
        }
        .stat-icon { width:36px; height:36px; display:flex; align-items:center; justify-content:center; border-radius: 8px; background: var(--panel-muted); color: var(--muted) }
        .stat-value { font-size: 1.25rem; font-weight: 800; line-height: 1 }
        .stat-label { color: var(--muted); font-weight: 600 }

        .form-grid { display: grid; gap: 12px }
        .form-row > label { display:block; font-weight: 600; margin-bottom: 6px; font-size: var(--fs-14) }
        .grid-3 { display:grid; grid-template-columns: repeat(3, 1fr); gap: 12px }
        @media (max-width: 900px){ .grid-3{ grid-template-columns: 1fr } }

        /* Modal usa .card da base */
        .modal-header { border-bottom: 1px solid var(--border) }
        .modal-footer { border-top: 1px solid var(--border) }

        /* Aproveitando o tema: main-header, header-content, toggles, toggle-btn, card, table, table-responsive já existem */
        .table tfoot td { background: var(--panel-muted) }
      `}</style>
    </>
  );
}
