import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  PlusIcon,
  ArrowPathIcon,
  CheckIcon,
  XMarkIcon,
  WrenchScrewdriverIcon,
  DocumentArrowDownIcon,
} from "@heroicons/react/24/solid";

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");

/* ===================== helpers de data e hora ===================== */
function toISO(d) {
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}
function fromISO(s) {
  const [y, m, d] = String(s).split("-").map(Number);
  return new Date(y, m - 1, d);
}
function firstDayOfMonth(d = new Date()) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function lastDayOfMonth(d = new Date()) { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
function minutes(hhmm) { if (!hhmm) return 0; const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; }
function fmtHHMM(min) { const h = Math.floor(min / 60); const m = min % 60; return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`; }
function isHHMM(v) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(v || "")); }

/* ==== pareamento (para totais) - ENTRADA->SAÍDA por data/turno ==== */
function pairEventsToRanges(items) {
  // items: [{funcionario_id, data, turno_ordem, evento, horario, origem, ...}]
  // retorna { byFunc: Map, totalMin: number }
  const byFunc = new Map();
  let totalMin = 0;

  // agrupa por funcionario+data+turno
  const key = (it) => `${it.funcionario_id}|${it.data}|${it.turno_ordem}`;
  const buckets = new Map();
  for (const it of items) {
    const k = key(it);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(it);
  }
  // ordena cada bucket por horário e pareia
  for (const [k, arr] of buckets.entries()) {
    arr.sort((a, b) => (a.horario || "").localeCompare(b.horario || ""));
    for (let i = 0; i < arr.length; i++) {
      const a = arr[i];
      if (a.evento !== "ENTRADA") continue;
      const b = arr[i + 1];
      if (b && b.evento === "SAIDA") {
        const dur = Math.max(0, minutes(b.horario) - minutes(a.horario));
        totalMin += dur;
        const funcId = a.funcionario_id;
        if (!byFunc.has(funcId)) byFunc.set(funcId, { linhas: [], totalMin: 0 });
        byFunc.get(funcId).linhas.push({
          data: a.data,
          turno: a.turno_ordem,
          entrada: a.horario,
          saida: b.horario,
          minutos: dur,
          origem_entrada: a.origem,
          origem_saida: b.origem,
          obs: a.obs || b.obs || "",
        });
        byFunc.get(funcId).totalMin += dur;
        i++; // salta a saída usada
      } else {
        // ENTRADA sem saída pareada -> duração 0 (incompleta)
        const funcId = a.funcionario_id;
        if (!byFunc.has(funcId)) byFunc.set(funcId, { linhas: [], totalMin: 0 });
        byFunc.get(funcId).linhas.push({
          data: a.data,
          turno: a.turno_ordem,
          entrada: a.horario,
          saida: "-",
          minutos: 0,
          origem_entrada: a.origem,
          origem_saida: "",
          obs: a.obs || "",
          _incompleto: true,
        });
      }
    }
  }
  // ordena linhas por data/turno
  for (const v of byFunc.values()) {
    v.linhas.sort((a, b) => (a.data === b.data ? a.turno - b.turno : a.data.localeCompare(b.data)));
  }
  return { byFunc, totalMin };
}

/* ===================== UI: Badge de origem ===================== */
function OrigemBadge({ origem }) {
  const o = String(origem || "").toUpperCase();
  const map = {
    APONTADO: { bg: "rgba(59,130,246,.12)", fg: "#2563eb", label: "APONTADO" },
    IMPORTADO: { bg: "rgba(16,185,129,.15)", fg: "#047857", label: "IMPORTADO" },
    AJUSTE: { bg: "rgba(234,179,8,.20)", fg: "#92400e", label: "AJUSTE" },
    INVALIDADA: { bg: "rgba(239,68,68,.15)", fg: "#b91c1c", label: "INVALIDADA" },
  };
  const sty = map[o] || map.APONTADO;
  return (
    <span
      className="badge"
      style={{
        background: sty.bg,
        color: sty.fg,
        border: "1px solid color-mix(in srgb, currentColor 25%, transparent)",
      }}
    >
      {sty.label}
    </span>
  );
}

/* ===================== Página ===================== */
export default function Apontamentos() {
  /* -------- filtros -------- */
  const [periodo, setPeriodo] = useState({
    de: toISO(firstDayOfMonth(new Date())),
    ate: toISO(lastDayOfMonth(new Date())),
  });
  const [funcionarioId, setFuncionarioId] = useState("");
  const [origem, setOrigem] = useState("");

  /* -------- dados -------- */
  const [funcionarios, setFuncionarios] = useState([]);
  const [itens, setItens] = useState([]); // evento/horario

  /* -------- ui -------- */
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState("");

  /* -------- Form de AJUSTE (1 evento) -------- */
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    funcionario_id: "",
    data: toISO(new Date()),
    turno_ordem: 1,
    evento: "ENTRADA",     // ENTRADA | SAIDA
    horario: "",           // HH:MM
    origem: "AJUSTE",
    obs: "",
  });

  /* -------- Modal PTRP/Tratamento -------- */
  const [showTratamento, setShowTratamento] = useState(false);
  const [tratamento, setTratamento] = useState({
    apontamento_id_original: null,
    destino_funcionario_id: "",
    data: "",
    evento: "ENTRADA",
    horario: "",
    justificativa: "",
    invalidar_original: true,
  });

  /* -------- Import modal -------- */
  const [showImport, setShowImport] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [preview, setPreview] = useState({ validas: [], invalidas: [], conflitos: [] });

  const liveRef = useRef(null);
  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  /* ---------------- API helper ---------------- */
  const api = useCallback(async (path, init = {}) => {
    const r = await fetch(`${API_BASE}${path}`, { credentials: "include", ...init });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || data?.ok === false) throw new Error(data?.error || `HTTP ${r.status}`);
    return data;
  }, []);

  /* ---------------- Carregamentos ---------------- */
  const loadFuncionarios = useCallback(async () => {
    const d = await api(`/api/funcionarios?ativos=1`);
    setFuncionarios(d.funcionarios || []);
  }, [api]);

  const loadItens = useCallback(async () => {
    const qs = new URLSearchParams({
      from: periodo.de,
      to: periodo.ate,
      ...(funcionarioId ? { funcionario_id: funcionarioId } : {}),
      ...(origem ? { origem } : {}),
    }).toString();
    // IMPORTANTE: o back /api/apontamentos segue aceitando pares, mas
    // para a listagem pedimos que ele já retorne {evento, horario}.
    // Se ele ainda retornar entrada/saida, faça a conversão abaixo.
    const d = await api(`/api/apontamentos?${qs}`);
    let rows = d.apontamentos || [];

    // Conversão fallback (se vier no modelo antigo):
    if (rows.length && rows[0].entrada !== undefined) {
      const expanded = [];
      for (const r of rows) {
        if (r.entrada) expanded.push({ ...r, evento: "ENTRADA", horario: r.entrada });
        if (r.saida)   expanded.push({ ...r, evento: "SAIDA",   horario: r.saida });
      }
      rows = expanded;
    }

    rows.sort((a, b) =>
      a.data === b.data
        ? a.funcionario_id === b.funcionario_id
          ? a.turno_ordem === b.turno_ordem
            ? (a.horario || "").localeCompare(b.horario || "")
            : Number(a.turno_ordem) - Number(b.turno_ordem)
          : Number(a.funcionario_id) - Number(b.funcionario_id)
        : a.data.localeCompare(b.data)
    );

    setItens(rows);
  }, [api, periodo, funcionarioId, origem]);

  const recarregar = useCallback(async () => {
    setErr(""); setSuccess(""); setLoading(true);
    try {
      await Promise.all([loadFuncionarios(), loadItens()]);
      if (liveRef.current) liveRef.current.textContent = "Lista de apontamentos atualizada.";
    } catch (e) {
      setErr(e.message || "Falha ao carregar.");
      if (liveRef.current) liveRef.current.textContent = "Erro ao carregar apontamentos.";
    } finally {
      setLoading(false);
    }
  }, [loadFuncionarios, loadItens]);

  useEffect(() => { recarregar(); }, [recarregar]);
  useEffect(() => { loadItens(); }, [periodo, funcionarioId, origem]); // eslint-disable-line

  /* ---------------- Ações ---------------- */
  const novoAjuste = () => {
    setForm({
      funcionario_id: funcionarioId || "",
      data: periodo.de,
      turno_ordem: 1,
      evento: "ENTRADA",
      horario: "",
      origem: "AJUSTE",
      obs: "",
    });
    setShowForm(true);
  };

  function validarFormLocal(f) {
    if (!f.funcionario_id) return "Selecione um funcionário.";
    if (!f.data) return "Selecione a data.";
    if (!f.evento || !["ENTRADA", "SAIDA"].includes(String(f.evento).toUpperCase())) return "Evento inválido.";
    if (!isHHMM(f.horario)) return "Horário inválido (HH:MM).";
    return null;
  }

  const salvarAjuste = async (e) => {
    e?.preventDefault?.();
    setErr(""); setSuccess("");

    const payloadBase = {
      funcionario_id: Number(form.funcionario_id),
      data: form.data,
      turno_ordem: Number(form.turno_ordem) || 1,
      origem: "AJUSTE",
      obs: form.obs || null,
    };

    // Backend /api/apontamentos aceita um dos dois:
    const payload = form.evento === "ENTRADA"
      ? { ...payloadBase, entrada: form.horario, saida: null }
      : { ...payloadBase, entrada: null, saida: form.horario };

    const v = validarFormLocal(form);
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

  function tratar(item) {
    setTratamento({
      apontamento_id_original: item.id,
      destino_funcionario_id: String(item.funcionario_id),
      data: item.data,
      evento: item.evento || "ENTRADA",
      horario: item.horario || "",
      justificativa: "",
      invalidar_original: true,
    });
    setShowTratamento(true);
  }

  async function enviarTratamento() {
    setErr(""); setSuccess("");
    try {
      await api(`/api/ptrp/ajustes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acao: "invalidar_e_criar_ajuste",
          apontamento_id_original: tratamento.apontamento_id_original,
          destino_funcionario_id: Number(tratamento.destino_funcionario_id),
          data: tratamento.data,
          // no PTRP ajustamos 1 evento — backend já aceita entrada/saida opcionais:
          entrada: tratamento.evento === "ENTRADA" ? tratamento.horario : null,
          saida:   tratamento.evento === "SAIDA"   ? tratamento.horario : null,
          justificativa: tratamento.justificativa,
          invalidar_original: !!tratamento.invalidar_original,
        }),
      });
      setSuccess("Tratamento aplicado: original invalidado e ajuste criado.");
      setShowTratamento(false);
      await loadItens();
      if (liveRef.current) liveRef.current.textContent = "Tratamento aplicado com sucesso.";
    } catch (e) {
      setErr(e.message || "Falha ao aplicar tratamento.");
      if (liveRef.current) liveRef.current.textContent = "Erro ao aplicar tratamento.";
    }
  }

  /* ---------------- Import (CSV evento/horário) ---------------- */
  function parseCSV(text) {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const out = [];
    for (const line of lines) {
      const [funcionario_id, data, turno_ordem, evento, horario, origem, obs] = line
        .split(";")
        .map((s) => s?.trim());
      out.push({ funcionario_id, data, turno_ordem, evento, horario, origem, obs });
    }
    return out;
  }

  function validarLote(rows) {
    const validas = [];
    const invalidas = [];
    const keySet = new Set();

    rows.forEach((r, idx) => {
      const row = {
        funcionario_id: Number(r.funcionario_id),
        data: r.data,
        turno_ordem: Number(r.turno_ordem) || 1,
        evento: String(r.evento || "ENTRADA").toUpperCase(), // ENTRADA/SAIDA
        horario: r.horario || null,
        origem: String(r.origem || "APONTADO").toUpperCase(),
        obs: r.obs || null,
        _idx: idx + 1,
      };

      let motivo = "";
      if (!row.funcionario_id) motivo = "funcionario_id vazio";
      else if (!row.data || !/^\d{4}-\d{2}-\d{2}$/.test(row.data)) motivo = "data inválida (YYYY-MM-DD)";
      else if (!["ENTRADA", "SAIDA"].includes(row.evento)) motivo = "evento deve ser ENTRADA/SAIDA";
      else if (!row.horario || !isHHMM(row.horario)) motivo = "horário inválido (HH:MM)";

      const k = `${row.funcionario_id}|${row.data}|${row.turno_ordem}|${row.origem}|${row.evento}|${row.horario}`;
      if (!motivo && keySet.has(k)) motivo = "linha duplicada no arquivo";
      if (!motivo) keySet.add(k);

      if (motivo) invalidas.push({ ...row, motivo });
      else validas.push(row);
    });

    return { validas, invalidas };
  }

  function onBuildPreview() {
    const rows = parseCSV(csvText);
    const p = validarLote(rows);

    // conflito: já existe exatamente o mesmo evento/horário para a chave
    const existentes = new Set(
      itens.map(
        (it) => `${it.funcionario_id}|${it.data}|${it.turno_ordem}|${String(it.origem || "").toUpperCase()}|${it.evento}|${it.horario}`
      )
    );

    const conflitos = p.validas.filter((v) =>
      existentes.has(`${v.funcionario_id}|${v.data}|${v.turno_ordem}|${v.origem}|${v.evento}|${v.horario}`)
    );

    const validasSemConflito = p.validas.filter(
      (v) => !existentes.has(`${v.funcionario_id}|${v.data}|${v.turno_ordem}|${v.origem}|${v.evento}|${v.horario}`)
    );

    setPreview({ validas: validasSemConflito, invalidas: p.invalidas, conflitos });
  }

  const importarValidas = async () => {
    if (!preview.validas.length) return;
    setErr(""); setSuccess("");
    try {
      // Converte para o payload do back (um dos campos entrada/saida)
      const rows = preview.validas.map((v) => ({
        funcionario_id: v.funcionario_id,
        data: v.data,
        turno_ordem: v.turno_ordem,
        entrada: v.evento === "ENTRADA" ? v.horario : null,
        saida:   v.evento === "SAIDA"   ? v.horario : null,
        origem: v.origem,
        obs: v.obs,
      }));
      await api(`/api/apontamentos/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      setSuccess(
        `Importadas ${preview.validas.length} linhas. Recusadas ${preview.invalidas.length + preview.conflitos.length}.`
      );
      setShowImport(false);
      setCsvText("");
      setPreview({ validas: [], invalidas: [], conflitos: [] });
      await loadItens();
      if (liveRef.current) liveRef.current.textContent = "Apontamentos importados com sucesso.";
    } catch (e) {
      setErr(e.message || "Falha ao importar.");
      if (liveRef.current) liveRef.current.textContent = "Erro ao importar apontamentos.";
    }
  };

  /* ---------------- Derivados (relatório pareado) ---------------- */
  const { byFunc: relatorio, totalMin: totalMinutosPeriodo } = useMemo(
    () => pairEventsToRanges(itens),
    [itens]
  );

  const getFuncionarioRotulo = useCallback(
    (id) => {
      const f = funcionarios.find((x) => x.id === id);
      return f ? `${f.pessoa_nome} - ${f.cargo_nome}` : `#${id}`;
    },
    [funcionarios]
  );

  /* ---------------- Exportações ---------------- */
  function downloadBlob(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Exporta eventos (linha-a-linha)
  function exportCSV() {
    const header = ["FuncionarioID", "Funcionario", "Data", "Turno", "Evento", "Horario", "Origem", "Obs"].join(";");
    const rows = itens.map((it) =>
      [
        it.funcionario_id,
        `"${getFuncionarioRotulo(it.funcionario_id).replace(/"/g, '""')}"`,
        it.data,
        it.turno_ordem,
        it.evento,
        it.horario,
        it.origem || "",
        `"${String(it.obs || "").replace(/"/g, '""')}"`,
      ].join(";")
    );
    const csv = [header, ...rows].join("\r\n");
    const nome = funcionarioId
      ? `batidas_${funcionarioId}_${periodo.de}_a_${periodo.ate}.csv`
      : `batidas_${periodo.de}_a_${periodo.ate}.csv`;
    downloadBlob(csv, nome, "text/csv;charset=utf-8");
  }

  // Exporta relatório pareado (Entrada/Saída/Duração)
  function exportRelatorioCSV() {
    const header = ["FuncionarioID", "Funcionario", "Data", "Turno", "Entrada", "Saida", "DuracaoMin", "DuracaoHHMM", "Obs"].join(";");
    const rows = [];
    for (const [funcId, info] of relatorio.entries()) {
      for (const l of info.linhas) {
        rows.push(
          [
            funcId,
            `"${getFuncionarioRotulo(funcId).replace(/"/g, '""')}"`,
            l.data,
            l.turno,
            l.entrada,
            l.saida,
            l.minutos,
            fmtHHMM(l.minutos),
            `"${String(l.obs).replace(/"/g, '""')}"`,
          ].join(";")
        );
      }
      rows.push([funcId, `"${getFuncionarioRotulo(funcId).replace(/"/g, '""')} (Subtotal)"`, "", "", "", "", info.totalMin, fmtHHMM(info.totalMin), ""].join(";"));
    }
    const csv = [header, ...rows].join("\r\n");
    const nome = funcionarioId
      ? `relatorio_${funcionarioId}_${periodo.de}_a_${periodo.ate}.csv`
      : `relatorio_${periodo.de}_a_${periodo.ate}.csv`;
    downloadBlob(csv, nome, "text/csv;charset=utf-8");
  }

  function exportPDF() {
    const titulo = funcionarioId
      ? `Relatório de Apontamentos — ${getFuncionarioRotulo(Number(funcionarioId))}`
      : "Relatório de Apontamentos (Todos)";
    const win = window.open("", "_blank", "noopener,noreferrer");
    if (!win) return;

    const style = `
      <style>
        :root{ --fg:#111; --muted:#555; --border:#e5e7eb; --focus:#ffbf47; }
        body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica, Arial; color: var(--fg); padding: 24px; }
        h1 { margin:0 0 4px 0; font-size: 18px; }
        p.sub { margin:0 0 16px 0; color: var(--muted); }
        .section { margin: 16px 0 24px; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th, td { border: 1px solid var(--border); padding: 6px 8px; font-size: 12px; }
        th { text-align: left; background: #f9fafb; }
        tfoot td { font-weight: 700; }
        .func-title { font-weight: 700; margin: 18px 0 6px; }
        .subtotal { background: #fcfdfd; }
      </style>
    `;
    let body = `
      <h1>${titulo}</h1>
      <p class="sub">Período: ${periodo.de} a ${periodo.ate}${origem ? ` • Origem: ${origem}` : ""}</p>
    `;
    for (const [funcId, info] of relatorio.entries()) {
      body += `<div class="section">
        <div class="func-title">${getFuncionarioRotulo(funcId)} (ID ${funcId})</div>
        <table role="table" aria-label="Apontamentos de ${getFuncionarioRotulo(funcId)}">
          <thead>
            <tr>
              <th>Data</th><th>Turno</th><th>Entrada</th><th>Saída</th><th>Duração</th><th>Obs</th>
            </tr>
          </thead>
          <tbody>
            ${info.linhas.map(l => `<tr>
              <td>${l.data}</td><td>#${l.turno}</td><td>${l.entrada}</td><td>${l.saida}</td><td>${fmtHHMM(l.minutos)}</td><td>${l.obs ? String(l.obs).replace(/</g,"&lt;").replace(/>/g,"&gt;") : ""}</td>
            </tr>`).join("")}
          </tbody>
          <tfoot><tr class="subtotal"><td colspan="4">Subtotal</td><td>${fmtHHMM(info.totalMin)}</td><td></td></tr></tfoot>
        </table>
      </div>`;
    }
    win.document.write(`<html><head><title>${titulo}</title>${style}</head><body>${body}</body></html>`);
    win.document.close(); win.focus(); win.print();
  }

  const onOverlayKeyDown = (ev) => {
    if (ev.key === "Escape") { setShowForm(false); setShowImport(false); setShowTratamento(false); }
  };

  /* ======= UI ======= */
  return (
    <>
      <div ref={liveRef} className="sr-only" aria-live="polite" aria-atomic="true"></div>

      <header className="page-header" role="region" aria-labelledby="titulo-pagina">
        <div>
          <h1 id="titulo-pagina" className="page-title">Apontamentos</h1>
          <p className="page-subtitle">
            Controle de batidas e ajustes (sem editar/excluir oficiais). Total no período:{" "}
            <strong>{fmtHHMM(totalMinutosPeriodo)}</strong>
          </p>
        </div>
        <div className="page-header__toolbar" aria-label="Ações da página">
          <button className="btn btn--success" onClick={novoAjuste} aria-label="Criar ajuste de apontamento">
            <PlusIcon className="icon" aria-hidden="true" /><span>Novo AJUSTE</span>
          </button>

          <button className="btn btn--neutral" onClick={() => setShowImport(true)} aria-label="Importar apontamentos via CSV">
            <DocumentArrowDownIcon className="icon" aria-hidden="true" /><span>Importar CSV</span>
          </button>

          <button className="btn btn--neutral" onClick={exportCSV} aria-label="Exportar batidas (CSV)">
            <DocumentArrowDownIcon className="icon" aria-hidden="true" /><span>Exportar Batidas</span>
          </button>
          <button className="btn btn--neutral" onClick={exportRelatorioCSV} aria-label="Exportar relatório (CSV)">
            <DocumentArrowDownIcon className="icon" aria-hidden="true" /><span>Exportar Relatório</span>
          </button>
          <button className="btn btn--neutral" onClick={exportPDF} aria-label="Exportar relatório em PDF">
            <DocumentArrowDownIcon className="icon" aria-hidden="true" /><span>Exportar PDF</span>
          </button>

          <button className="btn btn--neutral" onClick={recarregar} disabled={loading} aria-busy={loading ? "true" : "false"} aria-label="Atualizar lista de apontamentos">
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
            <input id="filtro-de" type="date" value={periodo.de} onChange={(e) => setPeriodo((p) => ({ ...p, de: e.target.value }))} className="input" />
          </div>
          <div className="form-field">
            <label htmlFor="filtro-ate" className="form-label">Até</label>
            <input id="filtro-ate" type="date" value={periodo.ate} onChange={(e) => setPeriodo((p) => ({ ...p, ate: e.target.value }))} className="input" />
          </div>
          <div className="form-field">
            <label htmlFor="filtro-funcionario" className="form-label">Funcionário</label>
            <select id="filtro-funcionario" value={funcionarioId} onChange={(e) => setFuncionarioId(e.target.value)} className="input">
              <option value="">Todos</option>
              {funcionarios.map((f) => (<option key={f.id} value={f.id}>{f.pessoa_nome} - {f.cargo_nome}</option>))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="filtro-origem" className="form-label">Origem</label>
            <select id="filtro-origem" value={origem} onChange={(e) => setOrigem(e.target.value)} className="input">
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
                    <th scope="col">Evento</th>
                    <th scope="col">Horário</th>
                    <th scope="col">Origem</th>
                    <th scope="col">Obs</th>
                    <th scope="col" className="actions-column">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {itens.map((it) => {
                    const f = funcionarios.find((x) => x.id === it.funcionario_id);
                    return (
                      <tr key={`${it.id || `${it.funcionario_id}-${it.data}-${it.turno_ordem}-${it.evento}-${it.horario}`}`}>
                        <td>{it.data}</td>
                        <td>{f ? `${f.pessoa_nome} - ${f.cargo_nome}` : `#${it.funcionario_id}`}</td>
                        <td>#{it.turno_ordem}</td>
                        <td><strong>{it.evento}</strong></td>
                        <td style={{ fontVariantNumeric: "tabular-nums" }}>{it.horario || "-"}</td>
                        <td><OrigemBadge origem={it.origem} /></td>
                        <td className="obs-cell" title={it.obs || ""}>{it.obs || "-"}</td>
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
                return (
                  <li key={`${it.id || `${it.funcionario_id}-${it.data}-${it.turno_ordem}-${it.evento}-${it.horario}`}`} className="apontamento-card">
                    <div className="apontamento-card__head">
                      <h3 className="apontamento-card__title">{it.data}</h3>
                      <div className="apontamento-card__badges">
                        <OrigemBadge origem={it.origem} />
                      </div>
                    </div>
                    <div className="apontamento-card__body">
                      <dl className="apontamento-dl">
                        <div className="apontamento-dl__row"><dt>Funcionário</dt><dd>{f ? `${f.pessoa_nome} - ${f.cargo_nome}` : `#${it.funcionario_id}`}</dd></div>
                        <div className="apontamento-dl__row"><dt>Turno</dt><dd>#{it.turno_ordem}</dd></div>
                        <div className="apontamento-dl__row"><dt>Evento</dt><dd><strong>{it.evento}</strong></dd></div>
                        <div className="apontamento-dl__row"><dt>Horário</dt><dd>{it.horario || "-"}</dd></div>
                        {it.obs && (<div className="apontamento-dl__row"><dt>Observação</dt><dd>{it.obs}</dd></div>)}
                      </dl>
                    </div>
                    <div className="apontamento-card__actions">
                      <button className="btn btn--warning btn--sm" onClick={() => tratar(it)} aria-label={`Tratar apontamento de ${it.data}`} title="Invalidar por tratamento e criar ajuste">
                        <WrenchScrewdriverIcon className="icon" aria-hidden="true" /><span>Tratar</span>
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* FORMULÁRIO DE AJUSTE (1 evento) */}
      {showForm && (
        <div className="form-overlay" role="dialog" aria-modal="true" aria-labelledby="titulo-form" onKeyDown={onOverlayKeyDown}>
          <div className="form-container">
            <div className="form-header">
              <h2 id="titulo-form">Novo Ajuste</h2>
              <button className="btn btn--neutral btn--icon-only" onClick={() => setShowForm(false)} aria-label="Fechar formulário" title="Fechar">
                <XMarkIcon className="icon" aria-hidden="true" />
              </button>
            </div>
            <form className="form" onSubmit={salvarAjuste}>
              <div className="form-grid">
                <div className="form-field">
                  <label htmlFor="a_funcionario">Funcionário *</label>
                  <select id="a_funcionario" value={form.funcionario_id} onChange={(e) => setField("funcionario_id", e.target.value)} required>
                    <option value="">Selecione…</option>
                    {funcionarios.map((f) => (<option key={f.id} value={f.id}>{f.pessoa_nome} - {f.cargo_nome}</option>))}
                  </select>
                </div>
                <div className="form-field">
                  <label htmlFor="a_data">Data *</label>
                  <input id="a_data" type="date" value={form.data} onChange={(e) => setField("data", e.target.value)} required />
                </div>
                <div className="form-field">
                  <label htmlFor="a_turno">Turno (ordem)</label>
                  <input id="a_turno" type="number" min="1" value={form.turno_ordem} onChange={(e) => setField("turno_ordem", parseInt(e.target.value) || 1)} />
                </div>
                <div className="form-field">
                  <label htmlFor="a_evento">Evento *</label>
                  <select id="a_evento" value={form.evento} onChange={(e) => setField("evento", e.target.value)}>
                    <option value="ENTRADA">ENTRADA</option>
                    <option value="SAIDA">SAÍDA</option>
                  </select>
                </div>
                <div className="form-field">
                  <label htmlFor="a_horario">Horário *</label>
                  <input id="a_horario" type="time" value={form.horario} onChange={(e) => setField("horario", e.target.value)} required />
                </div>
                <div className="form-field">
                  <label>Origem</label>
                  <input value="AJUSTE" readOnly className="input" aria-readonly="true" />
                </div>
                <div className="form-field span-2">
                  <label htmlFor="a_obs">Observação</label>
                  <textarea id="a_obs" rows={3} value={form.obs} onChange={(e) => setField("obs", e.target.value)} placeholder="Observações sobre o ajuste..." />
                </div>
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn--neutral" onClick={() => setShowForm(false)}>
                  <XMarkIcon className="icon" aria-hidden="true" /><span>Cancelar</span>
                </button>
                <button type="submit" className="btn btn--success">
                  <CheckIcon className="icon" aria-hidden="true" /><span>Criar ajuste</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE IMPORTAÇÃO (evento/horário) */}
      {showImport && (
        <div className="form-overlay" role="dialog" aria-modal="true" aria-labelledby="titulo-import" onKeyDown={onOverlayKeyDown}>
          <div className="form-container" style={{ maxWidth: "800px", maxHeight: "90vh" }}>
            <div className="form-header">
              <h2 id="titulo-import">Importar Batidas (CSV)</h2>
              <button className="btn btn--neutral btn--icon-only" onClick={() => setShowImport(false)} aria-label="Fechar importação" title="Fechar">
                <XMarkIcon className="icon" aria-hidden="true" />
              </button>
            </div>
            <div className="form">
              <p style={{ marginTop: 0, color: "var(--muted)" }}>
                Formato: <code>funcionario_id;data;turno_ordem;<strong>evento</strong>;<strong>horario</strong>;origem;obs</code> — datas <code>YYYY-MM-DD</code>, horas <code>HH:MM</code>, evento <code>ENTRADA</code> ou <code>SAIDA</code>.
              </p>
              <div className="form-field span-2">
                <label htmlFor="csv-data">Dados CSV</label>
                <textarea
                  id="csv-data"
                  rows={8}
                  placeholder="123;2025-10-01;1;ENTRADA;08:00;APONTADO;Chegou no horário"
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  style={{ resize: "vertical" }}
                />
              </div>
              {(preview.validas.length + preview.invalidas.length + preview.conflitos.length) > 0 && (
                <div className="preview-stats">
                  <div className="stat-card" data-accent="success"><strong>Válidas</strong><div>{preview.validas.length} linhas</div></div>
                  <div className="stat-card" data-accent="danger"><strong>Inválidas</strong><div>{preview.invalidas.length} linhas</div></div>
                  <div className="stat-card" data-accent="warning"><strong>Conflitos</strong><div>{preview.conflitos.length} linhas</div></div>
                </div>
              )}
              <div className="form-actions">
                <button type="button" className="btn btn--neutral" onClick={() => setShowImport(false)}>
                  <XMarkIcon className="icon" aria-hidden="true" /><span>Fechar</span>
                </button>
                <button type="button" className="btn btn--neutral" onClick={onBuildPreview}>
                  <ArrowPathIcon className="icon" aria-hidden="true" /><span>Pré-visualizar</span>
                </button>
                <button type="button" className="btn btn--success" onClick={importarValidas} disabled={!preview.validas.length}>
                  <CheckIcon className="icon" aria-hidden="true" /><span>Importar {preview.validas.length} válidas</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE TRATAMENTO (PTRP) */}
      {showTratamento && (
        <div className="form-overlay" role="dialog" aria-modal="true" aria-labelledby="titulo-tratar" onKeyDown={onOverlayKeyDown}>
          <div className="form-container" style={{ maxWidth: 680 }}>
            <div className="form-header">
              <h2 id="titulo-tratar">Tratar Apontamento (PTRP)</h2>
            <button className="btn btn--neutral btn--icon-only" onClick={() => setShowTratamento(false)} aria-label="Fechar tratamento" title="Fechar">
                <XMarkIcon className="icon" aria-hidden="true" />
              </button>
            </div>
            <div className="form">
              <p className="page-subtitle" style={{ marginTop: 0 }}>
                Esta ação <strong>não edita</strong> o apontamento original. Ela o <strong>invalida por tratamento</strong> e cria um <strong>AJUSTE</strong> (1 batida).
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
                    {funcionarios.map((f) => (<option key={f.id} value={f.id}>{f.pessoa_nome} - {f.cargo_nome}</option>))}
                  </select>
                </div>
                <div className="form-field">
                  <label>Data *</label>
                  <input type="date" value={tratamento.data} onChange={(e) => setTratamento((t) => ({ ...t, data: e.target.value }))} required />
                </div>
                <div className="form-field">
                  <label>Evento *</label>
                  <select value={tratamento.evento} onChange={(e) => setTratamento((t) => ({ ...t, evento: e.target.value }))}>
                    <option value="ENTRADA">ENTRADA</option>
                    <option value="SAIDA">SAÍDA</option>
                  </select>
                </div>
                <div className="form-field">
                  <label>Horário *</label>
                  <input type="time" value={tratamento.horario} onChange={(e) => setTratamento((t) => ({ ...t, horario: e.target.value }))} required />
                </div>
                <div className="form-field span-2">
                  <label>Justificativa *</label>
                  <textarea rows={3} value={tratamento.justificativa} onChange={(e) => setTratamento((t) => ({ ...t, justificativa: e.target.value }))} required placeholder="Motivo do tratamento..." />
                </div>
                <div className="form-field span-2" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input id="inv-orig" type="checkbox" checked={tratamento.invalidar_original}
                    onChange={(e) => setTratamento((t) => ({ ...t, invalidar_original: e.target.checked }))} />
                  <label htmlFor="inv-orig">Invalidar original por tratamento</label>
                </div>
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn--neutral" onClick={() => setShowTratamento(false)}>
                  <XMarkIcon className="icon" aria-hidden="true" /><span>Cancelar</span>
                </button>
                <button type="button" className="btn btn--success" onClick={enviarTratamento}>
                  <CheckIcon className="icon" aria-hidden="true" /><span>Aplicar tratamento</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CSS local (ajustes) */}
      <style jsx>{`
        .listagem-container { width: 100%; }
        .search-container { margin-bottom: 16px; }
        .filters-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; }
        .table-only { display: block; } .cards-only { display: none; }
        @media (max-width: 768px) { .table-only { display: none; } .cards-only { display: block; } }
        .apontamentos-table th, .apontamentos-table td { white-space: nowrap; }
        .apontamentos-table td:first-child, .apontamentos-table th:first-child { white-space: normal; }
        .obs-cell { max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .actions-buttons { display: flex; gap: 6px; flex-wrap: wrap; }
        .cards-grid { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: 1fr; gap: 12px; }
        .apontamento-card { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; box-shadow: var(--shadow); overflow: hidden; position: relative; }
        .apontamento-card::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: var(--accent-bg); }
        .apontamento-card__head { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 14px 14px 0 14px; }
        .apontamento-card__title { margin: 0; font-size: 1rem; font-weight: 700; color: var(--fg); }
        .apontamento-card__badges { display: flex; gap: 6px; flex-wrap: wrap; }
        .badge { font-size: 0.75rem; padding: 2px 8px; border-radius: 999px; border: 1px solid var(--border); }
        .apontamento-card__body { padding: 12px 14px 14px 14px; }
        .apontamento-dl { margin: 0; display: grid; gap: 8px; }
        .apontamento-dl__row { display: grid; grid-template-columns: 100px 1fr; gap: 8px; align-items: baseline; }
        .apontamento-dl__row dt { color: var(--muted); font-weight: 600; font-size: var(--fs-12); }
        .apontamento-dl__row dd { margin: 0; color: var(--fg); font-weight: 500; word-break: break-word; }
        .apontamento-card__actions { display: flex; gap: 6px; flex-wrap: wrap; padding: 0 14px 14px 14px; }
        .preview-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin: 16px 0; }
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
  );
}