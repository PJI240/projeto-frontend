// src/pages/Escalas.jsx
import { useEffect, useMemo, useState, useCallback } from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CalendarDaysIcon,
  PlusCircleIcon,
  Cog6ToothIcon,
  ArrowPathIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid";

const API_BASE = (import.meta.env.VITE_API_BASE?.replace(/\/+$/, "") || "");

/* ========== utils de data BR ========== */
function toISO(d) {
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}
function fromISO(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function startOfWeek(d) {
  const dt = new Date(d);
  const day = dt.getDay();
  const diff = (day + 6) % 7;
  dt.setDate(dt.getDate() - diff);
  dt.setHours(0, 0, 0, 0);
  return dt;
}
function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function formatDateBR(d) {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
function formatMonthYear(d) {
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}
function calcularDuracao(entrada, saida) {
  if (!entrada || !saida) return "0:00";
  const [h1, m1] = entrada.split(":").map(Number);
  const [h2, m2] = saida.split(":").map(Number);
  const totalMin = (h2 * 60 + m2) - (h1 * 60 + m1);
  const h = Math.max(0, Math.floor(totalMin / 60));
  const m = Math.max(0, totalMin % 60);
  return `${h}:${String(m).padStart(2, "0")}`;
}
function calcularDuracaoEmMinutos(entrada, saida) {
  if (!entrada || !saida) return 0;
  const [h1, m1] = entrada.split(":").map(Number);
  const [h2, m2] = saida.split(":").map(Number);
  return (h2 * 60 + m2) - (h1 * 60 + m1);
}
function formatarHorasTotais(horas, minutos) {
  if (!horas && !minutos) return "-";
  return `${horas}:${String(minutos).padStart(2, "0")}h`;
}

const DIAS_SEMANA_CURTO = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

// Config de horários da grade (pode ser alterada no modal)
const CONFIG_HORARIOS = { inicio: 6, fim: 22, incremento: 1 };
function gerarHorarios() {
  const arr = [];
  for (let h = CONFIG_HORARIOS.inicio; h <= CONFIG_HORARIOS.fim; h += CONFIG_HORARIOS.incremento) {
    arr.push(`${String(h).padStart(2, "0")}:00`);
  }
  return arr;
}

// Cores por funcionário (alimentam uma CSS var para respeitar HC)
const CORES_FUNCIONARIOS = [
  "#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16",
  "#f97316", "#6366f1", "#14b8a6", "#84cc16", "#eab308", "#a855f7", "#f43f5e", "#0ea5e9",
];
const getCorFuncionario = (id) => {
  const n = Math.abs(Number(id) || 0);
  return CORES_FUNCIONARIOS[n % CORES_FUNCIONARIOS.length];
};

/* ========== Modal acessível (padrão visual do app) ========== */
function Modal({ open, onClose, title, children, footer, size = "medium" }) {
  if (!open) return null;
  const sizes = { small: 380, medium: 520, large: 820, xlarge: 1100 };
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div className="modal-panel" style={{ maxWidth: sizes[size] }}>
        <div className="modal-header">
          <h2 id="modal-title" className="modal-title">{title}</h2>
          <button className="btn btn--icon" aria-label="Fechar" onClick={onClose}>
            <XMarkIcon className="icon" aria-hidden="true" />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
      <style jsx>{`
        .modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;z-index:1000;padding:16px}
        .modal-panel{width:100%;background:var(--panel);border:1px solid var(--border);border-radius:12px;box-shadow:var(--shadow);max-height:90vh;overflow:auto}
        .modal-header{display:flex;align-items:center;justify-content:space-between;padding:16px;border-bottom:1px solid var(--border)}
        .modal-title{font-size:18px;font-weight:700}
        .modal-body{padding:16px}
        .modal-footer{display:flex;gap:8px;justify-content:flex-end;padding:12px 16px;border-top:1px solid var(--border)}
        .btn--icon{background:var(--panel-muted)}
      `}</style>
    </div>
  );
}

/* ========== Calendário multi-seleção (com tokens de cor) ========== */
function CalendarioMultiSelecao({ datasSelecionadas, onDatasChange, mesInicial }) {
  const [mesAtual, setMesAtual] = useState(mesInicial || new Date());
  const primeiroDiaMes = new Date(mesAtual.getFullYear(), mesAtual.getMonth(), 1);
  const primeiroDiaGrid = new Date(primeiroDiaMes);
  primeiroDiaGrid.setDate(primeiroDiaGrid.getDate() - (primeiroDiaMes.getDay() + 6) % 7);

  const dias = [];
  const d = new Date(primeiroDiaGrid);
  for (let i = 0; i < 42; i++) { dias.push(new Date(d)); d.setDate(d.getDate() + 1); }

  const toggleData = (data) => {
    const iso = toISO(data);
    const set = new Set(datasSelecionadas);
    set.has(iso) ? set.delete(iso) : set.add(iso);
    onDatasChange(Array.from(set));
  };

  const hojeISO = toISO(new Date());

  return (
    <div className="calendar">
      <div className="calendar__toolbar">
        <button className="btn btn--neutral" onClick={() => setMesAtual(new Date(mesAtual.getFullYear(), mesAtual.getMonth() - 1, 1))}>
          <ChevronLeftIcon className="icon" aria-hidden="true" /><span>Anterior</span>
        </button>
        <div className="calendar__title">{mesAtual.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</div>
        <button className="btn btn--neutral" onClick={() => setMesAtual(new Date(mesAtual.getFullYear(), mesAtual.getMonth() + 1, 1))}>
          <span>Próximo</span><ChevronRightIcon className="icon" aria-hidden="true" />
        </button>
      </div>

      <div className="calendar__grid calendar__grid--head">
        {DIAS_SEMANA_CURTO.map((d) => <div key={d} className="calendar__dow">{d}</div>)}
      </div>

      <div className="calendar__grid">
        {dias.map((dia, idx) => {
          const iso = toISO(dia);
          const isMes = dia.getMonth() === mesAtual.getMonth();
          const ativo = datasSelecionadas.includes(iso);
          const hoje = iso === hojeISO;
          return (
            <button
              key={idx}
              className={`calendar__cell ${ativo ? "is-active" : ""} ${hoje ? "is-today" : ""} ${!isMes ? "is-out" : ""}`}
              onClick={() => toggleData(dia)}
              title={dia.toLocaleDateString("pt-BR")}
            >
              {dia.getDate()}
            </button>
          );
        })}
      </div>

      <div className="calendar__foot">
        {datasSelecionadas.length} data{datasSelecionadas.length !== 1 ? "s" : ""} selecionada{datasSelecionadas.length !== 1 ? "s" : ""}
      </div>

      <style jsx>{`
        .calendar{background:var(--panel);border:1px solid var(--border);border-radius:var(--radius);box-shadow:var(--shadow);padding:12px}
        .calendar__toolbar{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
        .calendar__title{font-weight:700;text-transform:capitalize}
        .calendar__grid{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}
        .calendar__grid--head{margin:6px 0}
        .calendar__dow{font-size:12px;font-weight:600;text-align:center;color:var(--muted);background:var(--panel-muted);padding:6px;border-radius:4px}
        .calendar__cell{padding:10px;border:1px solid var(--border);border-radius:6px;background:var(--panel);cursor:pointer}
        .calendar__cell:hover{background:var(--panel-muted)}
        .calendar__cell.is-active{background:var(--accent);color:var(--on-accent, #fff);border-color:var(--accent)}
        .calendar__cell.is-today{outline:2px solid var(--accent);outline-offset:0}
        .calendar__cell.is-out{opacity:.6}
        .calendar__foot{margin-top:8px;font-size:12px;color:var(--muted);text-align:center;background:var(--panel-muted);padding:6px;border-radius:6px}
      `}</style>
    </div>
  );
}

/* ========== Página Escalas ========== */
export default function Escalas() {
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth <= 900 : false);
  useEffect(() => {
    const onR = () => setIsMobile(window.innerWidth <= 900);
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, []);

  const [dataRef, setDataRef] = useState(() => startOfWeek(new Date()));
  const dias = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(dataRef, i)), [dataRef]);

  const [funcionarios, setFuncionarios] = useState([]);
  const [escalas, setEscalas] = useState([]);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [sucesso, setSucesso] = useState("");

  // Modais
  const [modalAberto, setModalAberto] = useState(false);
  const [modalMultiploAberto, setModalMultiploAberto] = useState(false);
  const [modalConfigAberto, setModalConfigAberto] = useState(false);
  const [editando, setEditando] = useState(null);

  const [form, setForm] = useState({ funcionario_id: "", data: toISO(new Date()), turno_ordem: 1, entrada: "", saida: "", origem: "FIXA" });
  const [formMultiplo, setFormMultiplo] = useState({ funcionario_id: "", datas: [], turno_ordem: 1, entrada: "08:00", saida: "17:00", origem: "FIXA" });

  const api = useCallback(async (path, init = {}) => {
    const url = `${API_BASE}${path}`;
    const r = await fetch(url, { credentials: "include", ...init });
    let data = null; try { data = await r.json(); } catch { /* no-op */ }
    if (!r.ok || data?.ok === false) throw new Error(data?.error || `HTTP ${r.status}`);
    return data;
  }, []);

  const carregarFuncionarios = useCallback(async () => {
    const d = await api(`/api/funcionarios?ativos=1`);
    setFuncionarios(d.funcionarios || []);
  }, [api]);

  const carregarEscalas = useCallback(async () => {
    const de = toISO(dias[0]);
    const ate = toISO(dias[6]);
    const d = await api(`/api/escalas?from=${encodeURIComponent(de)}&to=${encodeURIComponent(ate)}`);
    setEscalas(d.escalas || []);
  }, [api, dias]);

  const recarregar = useCallback(async () => {
    setLoading(true); setErr(""); setSucesso("");
    try { await Promise.all([carregarFuncionarios(), carregarEscalas()]); }
    catch (e) { setErr(e.message || "Falha ao carregar dados."); }
    finally { setLoading(false); }
  }, [carregarFuncionarios, carregarEscalas]);

  useEffect(() => { recarregar(); }, [recarregar]);
  useEffect(() => { if (escalas.length >= 0) carregarEscalas(); }, [dataRef]); // atualiza ao mudar semana

  // Navegação
  const semanaAnterior = () => setDataRef(addDays(dataRef, -7));
  const semanaSeguinte = () => setDataRef(addDays(dataRef, 7));
  const semanaAtual = () => setDataRef(startOfWeek(new Date()));

  // Agrupar escalas por data|hora
  const escalasAgrupadas = useMemo(() => {
    const map = new Map();
    escalas.forEach((esc) => {
      const funcId = esc.funcionario_id ?? esc.funcionarioId ?? esc.funcionario ?? null;
      const entrada = esc.entrada || esc.hora_entrada || null;
      const saida = esc.saida || esc.hora_saida || null;
      if (!funcId || !entrada || !saida) return;
      const f = funcionarios.find((x) => x.id === funcId); if (!f) return;
      const [h1] = entrada.split(":").map(Number);
      const [h2, m2] = saida.split(":").map(Number);
      const endHour = Number.isFinite(h2) ? (m2 === 0 ? h2 - 1 : h2) : h1;
      const startHour = Number.isFinite(h1) ? h1 : 0;

      for (let h = startHour; h <= endHour; h++) {
        const key = `${esc.data}|${String(h).padStart(2, "0")}`;
        if (!map.has(key)) map.set(key, []);
        const arr = map.get(key);
        if (!arr.some((e) => e.id === esc.id)) {
          arr.push({
            ...esc,
            funcionario_id: funcId,
            funcionario_nome: f.pessoa_nome,
            cargo: f.cargo_nome,
            cor: getCorFuncionario(funcId),
          });
        }
      }
    });
    return map;
  }, [escalas, funcionarios]);

  // Totais por funcionário/dia
  const horasTotaisPorDia = useMemo(() => {
    const r = {};
    funcionarios.forEach((f) => {
      r[f.id] = { nome: f.pessoa_nome, cor: getCorFuncionario(f.id), totaisPorDia: {} };
      dias.forEach((d) => { r[f.id].totaisPorDia[toISO(d)] = { horas: 0, minutos: 0, escalas: [] }; });
    });
    escalas.forEach((e) => {
      const fid = e.funcionario_id; const iso = e.data;
      if (r[fid] && r[fid].totaisPorDia[iso]) {
        const dur = calcularDuracaoEmMinutos(e.entrada, e.saida);
        r[fid].totaisPorDia[iso].horas += Math.floor(dur / 60);
        r[fid].totaisPorDia[iso].minutos += dur % 60;
        r[fid].totaisPorDia[iso].escalas.push(e);
        if (r[fid].totaisPorDia[iso].minutos >= 60) {
          r[fid].totaisPorDia[iso].horas += Math.floor(r[fid].totaisPorDia[iso].minutos / 60);
          r[fid].totaisPorDia[iso].minutos = r[fid].totaisPorDia[iso].minutos % 60;
        }
      }
    });
    return r;
  }, [escalas, funcionarios, dias]);

  const encontrarEscalaNaCelula = (dataISO, hora) => escalasAgrupadas.get(`${dataISO}|${hora}`) || [];

  // CRUD / Modais
  const calcularHoraSaida = (entrada, horas = 8) => {
    const [h, m] = entrada.split(":").map(Number);
    const t = h * 60 + m + horas * 60;
    return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
  };
  const abrirNovo = (funcId, dataISO, hora = "08:00") => {
    setEditando(null);
    setForm({ funcionario_id: funcId || "", data: dataISO || toISO(new Date()), turno_ordem: 1, entrada: hora, saida: calcularHoraSaida(hora, 8), origem: "FIXA" });
    setModalAberto(true);
  };
  const abrirMultiplo = () => {
    setFormMultiplo({ funcionario_id: "", datas: [], turno_ordem: 1, entrada: "08:00", saida: "17:00", origem: "FIXA" });
    setModalMultiploAberto(true);
  };
  const abrirConfig = () => setModalConfigAberto(true);
  const abrirEdicao = (escala) => {
    setEditando(escala);
    setForm({ funcionario_id: escala.funcionario_id, data: escala.data, turno_ordem: escala.turno_ordem, entrada: escala.entrada || "", saida: escala.saida || "", origem: escala.origem || "FIXA" });
    setModalAberto(true);
  };

  const salvarEscala = async () => {
    setErr(""); setSucesso("");
    try {
      const payload = {
        funcionario_id: Number(form.funcionario_id),
        data: form.data,
        turno_ordem: Number(form.turno_ordem) || 1,
        entrada: form.entrada || null,
        saida: form.saida || null,
        origem: form.origem || "FIXA",
      };
      if (!payload.funcionario_id || !payload.data) throw new Error("Selecione funcionário e data.");
      if (editando) {
        await api(`/api/escalas/${editando.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        setSucesso("Escala atualizada com sucesso!");
      } else {
        await api(`/api/escalas`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        setSucesso("Escala adicionada com sucesso!");
      }
      setModalAberto(false);
      await carregarEscalas();
    } catch (e) { setErr(e.message || "Falha ao salvar escala."); }
  };

  const salvarEscalasMultiplas = async () => {
    setErr(""); setSucesso(""); setLoading(true);
    try {
      if (!formMultiplo.funcionario_id || formMultiplo.datas.length === 0) throw new Error("Selecione funcionário e pelo menos uma data.");
      const escalasBatch = formMultiplo.datas.map((d) => ({
        funcionario_id: Number(formMultiplo.funcionario_id),
        data: d,
        turno_ordem: Number(formMultiplo.turno_ordem) || 1,
        entrada: formMultiplo.entrada || null,
        saida: formMultiplo.saida || null,
        origem: formMultiplo.origem || "FIXA",
      }));
      const r = await api(`/api/escalas/batch`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ escalas: escalasBatch }) });
      setSucesso(r.message || `${escalasBatch.length} escalas adicionadas com sucesso!`);
      setModalMultiploAberto(false);
      await carregarEscalas();
    } catch (e) { setErr(e.message || "Falha ao salvar escalas."); }
    finally { setLoading(false); }
  };

  const excluirEscala = async (escala) => {
    if (!confirm(`Remover escala de ${escala.funcionario_nome} no dia ${escala.data}?`)) return;
    setErr(""); setSucesso("");
    try {
      await api(`/api/escalas/${escala.id}`, { method: "DELETE" });
      setSucesso("Escala removida com sucesso!");
      await carregarEscalas();
    } catch (e) { setErr(e.message || "Falha ao excluir escala."); }
  };

  const atualizarConfigHorarios = (nova) => {
    CONFIG_HORARIOS.inicio = nova.inicio;
    CONFIG_HORARIOS.fim = nova.fim;
    CONFIG_HORARIOS.incremento = nova.incremento;
    setModalConfigAberto(false);
    setDataRef(new Date(dataRef)); // re-render
  };

  const HORARIOS_DIA = gerarHorarios();

  /* ===================== RENDER ===================== */
  return (
    <>
      {/* Header no padrão visual */}
      <header className="page-header" role="region" aria-labelledby="titulo-esc">
        <div>
          <h1 id="titulo-esc" className="page-title">Escalas</h1>
          <p className="page-subtitle">Clique em qualquer horário para adicionar ou editar</p>
        </div>
        <div className="page-header__toolbar" aria-label="Ações da página">
          <button className="btn btn--neutral" onClick={semanaAnterior}>
            <ChevronLeftIcon className="icon" aria-hidden="true" /><span>Anterior</span>
          </button>
          <button className="btn btn--neutral" onClick={semanaAtual}>
            <CalendarDaysIcon className="icon" aria-hidden="true" /><span>Hoje</span>
          </button>
          <button className="btn btn--neutral" onClick={semanaSeguinte}>
            <span>Seguinte</span><ChevronRightIcon className="icon" aria-hidden="true" />
          </button>
          <button className="btn" data-accent="success" onClick={abrirMultiplo}>
            <PlusCircleIcon className="icon" aria-hidden="true" /><span>Nova Escala</span>
          </button>
          <button className="btn" data-accent="info" onClick={abrirConfig}>
            <Cog6ToothIcon className="icon" aria-hidden="true" /><span>Configurar</span>
          </button>
          <button
            className="btn btn--neutral"
            onClick={recarregar}
            disabled={loading}
            aria-busy={loading ? "true" : "false"}
            aria-label="Atualizar dados"
          >
            {loading ? <span className="spinner" aria-hidden="true" /> : <ArrowPathIcon className="icon" aria-hidden="true" />}
            <span>{loading ? "Atualizando…" : "Atualizar"}</span>
          </button>
        </div>
      </header>

      {/* Alerts usando a paleta (HC) */}
      {err && <div className="alert" data-accent="error" role="alert" style={{ marginBottom: 12 }}>{err}</div>}
      {sucesso && <div className="alert" data-accent="success" role="status" style={{ marginBottom: 12 }}>{sucesso}</div>}

      {/* Período selecionado */}
      <div className="stat-card" style={{ marginBottom: 12 }}>
        <div className="stat-card__content">
          <div className="stat-title" style={{ fontWeight: 700 }}>
            {formatMonthYear(dataRef)} — {formatDateBR(dias[0])} a {formatDateBR(dias[6])}
          </div>
          <div className="stat-subtitle" style={{ fontSize: 12, color: "var(--muted)" }}>
            {funcionarios.length} funcionários • {escalas.length} escalas carregadas • Janela {CONFIG_HORARIOS.inicio}h–{CONFIG_HORARIOS.fim}h
          </div>
        </div>
      </div>

      {/* Grade de horários */}
      <div className="dashboard-wrapper">
        <div className="esc-grid">
          <div className="esc-grid__head">HORA</div>
          {dias.map((dia, i) => (
            <div key={i} className="esc-grid__day">
              <div className="esc-grid__day-name">{DIAS_SEMANA_CURTO[i]}</div>
              <div className="esc-grid__day-date">{formatDateBR(dia)}</div>
            </div>
          ))}

          {HORARIOS_DIA.map((hora) => (
            <div key={hora} style={{ display: "contents" }}>
              <div className="esc-grid__hour">{hora}</div>
              {dias.map((dia) => {
                const dataISO = toISO(dia);
                const hourStr = hora.split(":")[0];
                const arr = encontrarEscalaNaCelula(dataISO, hourStr);
                const isToday = toISO(new Date()) === dataISO;
                return (
                  <div
                    key={`${dataISO}-${hourStr}`}
                    className={`esc-grid__cell ${isToday ? "is-today" : ""}`}
                    onClick={() => abrirNovo(null, dataISO, `${hourStr}:00`)}
                    onMouseEnter={(e) => { e.currentTarget.classList.add("is-hover"); }}
                    onMouseLeave={(e) => { e.currentTarget.classList.remove("is-hover"); }}
                  >
                    {arr.map((esc, idx) => (
                      <button
                        key={`${esc.id}-${idx}`}
                        className="esc-chip"
                        style={{ ["--func-color"]: esc.cor }}
                        title={`${esc.funcionario_nome} • ${esc.entrada}–${esc.saida} (Turno ${esc.turno_ordem})`}
                        onClick={(ev) => { ev.stopPropagation(); abrirEdicao(esc); }}
                      >
                        <span className="esc-chip__name">{esc.funcionario_nome}</span>
                        <span className="esc-chip__time">{esc.entrada}–{esc.saida}</span>
                      </button>
                    ))}
                    {arr.length === 0 && <div className="esc-cell__plus" aria-hidden>+</div>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Resumo por funcionário */}
      {funcionarios.length > 0 && (
        <section className="summary">
          <div className="summary__head">
            <h3 className="summary__title">📊 Resumo de Horas por Funcionário</h3>
            <p className="summary__desc">Total de horas por dia na semana selecionada</p>
          </div>

          <div className="summary__tablewrap">
            <div className="summary__table">
              <div className="summary__th summary__th--name">Funcionário</div>
              {dias.map((dia, i) => (
                <div key={i} className="summary__th">
                  <div>{DIAS_SEMANA_CURTO[i]}</div>
                  <div className="summary__th-date">{formatDateBR(dia)}</div>
                </div>
              ))}

              {funcionarios.map((f) => {
                const t = horasTotaisPorDia[f.id]; if (!t) return null;
                return (
                  <div key={f.id} style={{ display: "contents" }}>
                    <div className="summary__td summary__name">
                      <span className="summary__dot" style={{ ["--func-color"]: getCorFuncionario(f.id) }} />
                      <span>{f.pessoa_nome}</span>
                    </div>
                    {dias.map((d) => {
                      const iso = toISO(d);
                      const tot = t.totaisPorDia[iso];
                      const h = tot?.horas || 0, m = tot?.minutos || 0, has = tot?.escalas?.length > 0;
                      return (
                        <div key={iso} className={`summary__td ${has ? "has" : "no"}`} title={has ? `${tot.escalas.length} turno(s)` : "Sem escalas"}>
                          <div>{formatarHorasTotais(h, m)}</div>
                          {has && tot.escalas.length > 1 && <div className="summary__badge">{tot.escalas.length} turnos</div>}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="summary__foot">
            <span>{funcionarios.length} funcionário(s) na semana</span>
            <span><strong>{escalas.length}</strong> escala(s) no total</span>
          </div>
        </section>
      )}

      {/* Legenda */}
      {funcionarios.length > 0 && (
        <div className="legend">
          <div className="legend__title">Legenda:</div>
          {funcionarios.map((f) => (
            <div key={f.id} className="legend__item">
              <span className="legend__swatch" style={{ ["--func-color"]: getCorFuncionario(f.id) }} />
              <span>{f.pessoa_nome}</span>
            </div>
          ))}
        </div>
      )}

      {/* Modal simples */}
      <Modal
        open={modalAberto}
        onClose={() => setModalAberto(false)}
        title={editando ? "Editar Escala" : "Nova Escala"}
        footer={
          <>
            <button className="btn btn--neutral" onClick={() => setModalAberto(false)}>Cancelar</button>
            {editando && <button className="btn" data-accent="error" onClick={() => excluirEscala(editando)}>Excluir</button>}
            <button className="btn" data-accent="success" onClick={salvarEscala}>{editando ? "Salvar" : "Adicionar"}</button>
          </>
        }
      >
        <div className="form-grid">
          <div className="form-field">
            <label>Funcionário *</label>
            <select className="input" value={form.funcionario_id} onChange={(e) => setForm({ ...form, funcionario_id: e.target.value })} required>
              <option value="">Selecione…</option>
              {funcionarios.map((f) => <option key={f.id} value={f.id}>{f.pessoa_nome} — {f.cargo_nome}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>Data *</label>
            <input type="date" className="input" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} required />
          </div>
          <div className="form-2col">
            <div className="form-field">
              <label>Entrada</label>
              <input type="time" className="input" value={form.entrada} onChange={(e) => setForm({ ...form, entrada: e.target.value })} />
            </div>
            <div className="form-field">
              <label>Saída</label>
              <input type="time" className="input" value={form.saida} onChange={(e) => setForm({ ...form, saida: e.target.value })} />
            </div>
          </div>
          {form.entrada && form.saida && <div className="hint-box">Duração total: <strong>{calcularDuracao(form.entrada, form.saida)} horas</strong></div>}
          <div className="form-field">
            <label>Turno (ordem)</label>
            <input type="number" className="input" min="1" value={form.turno_ordem} onChange={(e) => setForm({ ...form, turno_ordem: parseInt(e.target.value) || 1 })} />
          </div>
        </div>
      </Modal>

      {/* Modal múltiplas datas */}
      <Modal
        open={modalMultiploAberto}
        onClose={() => setModalMultiploAberto(false)}
        title="Adicionar Escalas em Múltiplas Datas"
        size="large"
        footer={
          <>
            <button className="btn btn--neutral" onClick={() => setModalMultiploAberto(false)}>Cancelar</button>
            <button className="btn" data-accent="success" onClick={salvarEscalasMultiplas}>
              Adicionar {formMultiplo.datas.length} Escala(s)
            </button>
          </>
        }
      >
        <div className="form-grid">
          <div className="form-field">
            <label>Funcionário *</label>
            <select className="input" value={formMultiplo.funcionario_id} onChange={(e) => setFormMultiplo({ ...formMultiplo, funcionario_id: e.target.value })} required>
              <option value="">Selecione…</option>
              {funcionarios.map((f) => <option key={f.id} value={f.id}>{f.pessoa_nome} — {f.cargo_nome}</option>)}
            </select>
          </div>
          <div className="form-2col">
            <div className="form-field">
              <label>Entrada</label>
              <input type="time" className="input" value={formMultiplo.entrada} onChange={(e) => setFormMultiplo({ ...formMultiplo, entrada: e.target.value })} />
            </div>
            <div className="form-field">
              <label>Saída</label>
              <input type="time" className="input" value={formMultiplo.saida} onChange={(e) => setFormMultiplo({ ...formMultiplo, saida: e.target.value })} />
            </div>
          </div>
          {formMultiplo.entrada && formMultiplo.saida && <div className="hint-box">Duração total: <strong>{calcularDuracao(formMultiplo.entrada, formMultiplo.saida)} horas</strong></div>}
          <div className="form-field">
            <label>Turno (ordem)</label>
            <input type="number" className="input" min="1" value={formMultiplo.turno_ordem} onChange={(e) => setFormMultiplo({ ...formMultiplo, turno_ordem: parseInt(e.target.value) || 1 })} />
          </div>
          <div className="form-field">
            <label>Selecionar Datas *</label>
            <CalendarioMultiSelecao
              datasSelecionadas={formMultiplo.datas}
              onDatasChange={(datas) => setFormMultiplo({ ...formMultiplo, datas })}
              mesInicial={new Date()}
            />
          </div>
        </div>
      </Modal>

      {/* Modal Config */}
      <Modal
        open={modalConfigAberto}
        onClose={() => setModalConfigAberto(false)}
        title="Configurar Horários de Exibição"
        footer={
          <>
            <button className="btn btn--neutral" onClick={() => setModalConfigAberto(false)}>Cancelar</button>
            <button className="btn" data-accent="warning" onClick={() => atualizarConfigHorarios({ inicio: 6, fim: 22, incremento: 1 })}>Padrão</button>
            <button className="btn" data-accent="success" onClick={() => atualizarConfigHorarios({ inicio: CONFIG_HORARIOS.inicio, fim: CONFIG_HORARIOS.fim, incremento: CONFIG_HORARIOS.incremento })}>Aplicar</button>
          </>
        }
      >
        <div className="form-2col">
          <div className="form-field">
            <label>Hora Inicial</label>
            <input type="number" className="input" min="0" max="23" defaultValue={CONFIG_HORARIOS.inicio} onChange={(e) => (CONFIG_HORARIOS.inicio = parseInt(e.target.value) || 0)} />
          </div>
          <div className="form-field">
            <label>Hora Final</label>
            <input type="number" className="input" min="1" max="24" defaultValue={CONFIG_HORARIOS.fim} onChange={(e) => (CONFIG_HORARIOS.fim = parseInt(e.target.value) || 24)} />
          </div>
        </div>
        <div className="form-field">
          <label>Incremento (em horas)</label>
          <select className="input" defaultValue={CONFIG_HORARIOS.incremento} onChange={(e) => (CONFIG_HORARIOS.incremento = parseInt(e.target.value) || 1)}>
            <option value="1">1 hora</option>
            <option value="2">2 horas</option>
            <option value="4">4 horas</option>
          </select>
        </div>
        <div className="hint-box">Pré-visualização: {CONFIG_HORARIOS.inicio}h – {CONFIG_HORARIOS.fim}h, a cada {CONFIG_HORARIOS.incremento}h</div>
      </Modal>

      {/* Estilos locais (somente com variáveis do tema) */}
      <style jsx>{`
        /* Alerts (usando paleta do global.css) */
        .alert{
          background: var(--panel);
          border: 1px solid var(--border);
          border-left: 4px solid var(--fg);
          padding: 12px 14px; border-radius: 8px; box-shadow: var(--shadow);
        }
        .alert[data-accent="success"]{ border-left-color: var(--success); }
        .alert[data-accent="error"]{ border-left-color: var(--error); }

        .dashboard-wrapper{width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch}
        .esc-grid{display:grid;grid-template-columns:90px repeat(7,1fr);border:1px solid var(--border);border-radius:8px;background:var(--panel);box-shadow:var(--shadow);min-width:1000px;overflow:hidden}
        .esc-grid__head{padding:14px 10px;border-bottom:2px solid var(--border);background:var(--panel-muted);font-weight:700;font-size:14px}
        .esc-grid__day{padding:12px;border-bottom:2px solid var(--border);text-align:center;background:var(--panel-muted)}
        .esc-grid__day-name{font-weight:700;font-size:14px}
        .esc-grid__day-date{font-size:12px;color:var(--muted);margin-top:4px}
        .esc-grid__hour{padding:10px;border-right:1px solid var(--border);border-bottom:1px solid var(--border);font-size:12px;color:var(--muted);background:var(--panel-muted);display:flex;align-items:center;justify-content:center}
        .esc-grid__cell{position:relative;min-height:54px;border-bottom:1px solid var(--border);border-right:1px solid var(--border);background:transparent;cursor:pointer;transition:background .15s ease}
        .esc-grid__cell.is-today{ background: color-mix(in srgb, var(--info) 10%, transparent); }
        .esc-grid__cell.is-hover{ background: color-mix(in srgb, var(--info) 18%, transparent); }
        .esc-cell__plus{font-size:22px;color:var(--muted);text-align:center;padding:12px 0;opacity:.35}

        /* Chip de escala com var de funcionário + HC */
        .esc-chip{
          --_bg: var(--func-color);
          display:flex;gap:8px;align-items:center;justify-content:space-between;
          width:100%;border-radius:6px;padding:6px 8px;font-size:11px;margin:2px 0;
          background: var(--_bg);
          color: var(--on-colored, #fff);
          box-shadow: 0 1px 2px rgb(0 0 0 / .12);
          border: 1px solid color-mix(in srgb, var(--_bg) 55%, var(--border));
        }
        .esc-chip__name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700}
        .esc-chip__time{opacity:.95}

        [data-hc="true"] .esc-chip{
          background: var(--panel);
          color: var(--fg);
          border-color: var(--fg);
          box-shadow: none;
          position: relative; padding-left: 20px;
        }
        [data-hc="true"] .esc-chip::before{
          content:"";
          width:10px;height:10px;border-radius:999px;
          background: var(--func-color);
          outline: 1px solid var(--fg);
          position:absolute;left:6px;top:50%;transform:translateY(-50%);
        }

        .summary{background:var(--panel);border:1px solid var(--border);border-radius:8px;box-shadow:var(--shadow);margin-top:16px}
        .summary__head{padding:12px 16px;border-bottom:1px solid var(--border);background:var(--panel-muted)}
        .summary__title{margin:0;font-size:16px;font-weight:700}
        .summary__desc{margin:4px 0 0;color:var(--muted);font-size:14px}
        .summary__tablewrap{overflow:auto}
        .summary__table{display:grid;grid-template-columns:200px repeat(7,140px);min-width:1200px}
        .summary__th{padding:10px;border-bottom:1px solid var(--border);background:var(--panel-muted);text-align:center;font-weight:700;font-size:14px}
        .summary__th--name{position:sticky;left:0;z-index:2}
        .summary__th-date{font-size:11px;color:var(--muted)}
        .summary__td{padding:12px;border-bottom:1px solid var(--border);border-right:1px solid var(--border);text-align:center;font-size:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px}
        .summary__td.has{background:color-mix(in srgb, var(--success) 12%, transparent);color:var(--success);font-weight:700}
        .summary__td.no{color:var(--muted)}
        .summary__name{position:sticky;left:0;background:var(--panel);z-index:1;display:flex;gap:8px;align-items:center;justify-content:flex-start}
        .summary__dot{width:12px;height:12px;border-radius:3px;border:1px solid var(--border);background:var(--func-color)}
        .summary__badge{font-size:10px;color:var(--muted);background:var(--panel-muted);padding:1px 4px;border-radius:3px}
        .summary__foot{display:flex;align-items:center;justify-content:space-between;padding:10px 16px;border-top:1px solid var(--border);background:var(--panel-muted);font-size:14px}

        .legend{display:flex;flex-wrap:wrap;gap:12px;padding:12px;background:var(--panel);border:1px solid var(--border);border-radius:8px;margin-top:12px}
        .legend__title{font-weight:600;color:var(--muted)}
        .legend__item{display:flex;gap:8px;align-items:center}
        .legend__swatch{width:14px;height:14px;border-radius:4px;border:1px solid var(--border);background:var(--func-color)}

        .form-grid{display:flex;flex-direction:column;gap:12px}
        .form-2col{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .form-field > label{display:block;font-size:14px;font-weight:600;margin-bottom:6px}
        .hint-box{padding:10px;border:1px solid var(--border);border-radius:6px;background:var(--panel-muted);text-align:center;font-size:14px}

        @media (max-width: 900px){
          .page-header__toolbar{flex-direction:column;align-items:stretch}
          .page-header__toolbar .btn, .page-header__toolbar .input{width:100%;justify-content:center}
          .summary__table{grid-template-columns:160px repeat(7,120px);min-width:1000px}
          .form-2col{grid-template-columns:1fr}
        }
        @media (max-width: 480px){
          .esc-grid{min-width:800px}
          .summary__table{grid-template-columns:140px repeat(7,110px);min-width:920px}
        }
      `}</style>
    </>
  );
}