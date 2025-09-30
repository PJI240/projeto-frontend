// src/pages/Escalas.jsx
import { useEffect, useMemo, useState, useCallback } from "react";
import {
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  ArrowPathIcon,
  ClipboardDocumentListIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

const API_BASE = import.meta.env.VITE_API_BASE?.replace(/\/+$/, "") || "";

/* ========== utils de data ========== */
function toISO(d) {
  // Date -> YYYY-MM-DD (local)
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}
function fromISO(s) {
  // YYYY-MM-DD -> Date
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function startOfWeek(d) {
  const dt = new Date(d);
  const day = dt.getDay(); // 0=Dom, 1=Seg...
  const diff = (day + 6) % 7; // deixa segunda como início
  dt.setDate(dt.getDate() - diff);
  dt.setHours(0, 0, 0, 0);
  return dt;
}
function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth() === b.getMonth() &&
         a.getDate() === b.getDate();
}
const WEEKDAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

/* ========== componentes auxiliares ========== */
function IconBtn({ title, onClick, children, style }) {
  return (
    <button
      type="button"
      className="toggle-btn"
      title={title}
      onClick={onClick}
      style={style}
    >
      {children}
    </button>
  );
}

function SmallTag({ children }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 6px",
        borderRadius: 8,
        border: "1px solid var(--border)",
        fontSize: "var(--fs-12)",
        color: "var(--muted)",
        background: "var(--panel-muted)",
      }}
    >
      {children}
    </span>
  );
}

function Modal({ open, onClose, title, children, footer }) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        style={{
          width: "min(680px, 100%)",
          background: "var(--panel)",
          borderRadius: "var(--radius)",
          boxShadow: "var(--shadow)",
          border: "1px solid var(--border)",
          padding: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h3 className="title" style={{ fontSize: "var(--fs-18)" }}>{title}</h3>
          <button className="logout-btn" onClick={onClose} title="Fechar">
            <XMarkIcon className="icon-sm" />
          </button>
        </div>
        <div className="form">
          {children}
        </div>
        {footer && (
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* ========== Página Escalas ========== */
export default function Escalas() {
  const [weekRef, setWeekRef] = useState(() => startOfWeek(new Date())); // segunda da semana atual
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekRef, i)), [weekRef]);

  const [funcs, setFuncs] = useState([]);   // { id, pessoa_nome, cargo_nome }
  const [scales, setScales] = useState([]); // [{ id, funcionario_id, data, turno_ordem, entrada, saida, origem }]

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // modal state (create/edit)
  const [openModal, setOpenModal] = useState(false);
  const [editing, setEditing] = useState(null); // escala row ou null
  const [form, setForm] = useState({
    funcionario_id: "",
    data: toISO(new Date()),
    turno_ordem: 1,
    entrada: "",
    saida: "",
    origem: "FIXA",
  });

  // copiar p/ outros dias
  const [copyFrom, setCopyFrom] = useState(null); // escala (base) para copiar

  const api = useCallback(async (path, init = {}) => {
    const r = await fetch(`${API_BASE}${path}`, { credentials: "include", ...init });
    let data = null;
    try { data = await r.json(); } catch { /* noop */ }
    if (!r.ok || !data?.ok) throw new Error(data?.error || `HTTP ${r.status}`);
    return data;
  }, []);

  const loadFuncs = useCallback(async () => {
    const d = await api(`/api/funcionarios?ativos=1`);
    // backend retorna { funcionarios: [...] }
    setFuncs(d.funcionarios || []);
  }, [api]);

  const fetchWeek = useCallback(async () => {
    const from = toISO(days[0]);
    const to = toISO(days[6]);
    const d = await api(`/api/escalas?from=${from}&to=${to}`);
    // backend retorna { escalas: [...] }
    setScales(d.escalas || []);
  }, [api, days]);

  const reload = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      await Promise.all([loadFuncs(), fetchWeek()]);
    } catch (e) {
      setErr(e.message || "Falha ao carregar escalas.");
    } finally {
      setLoading(false);
    }
  }, [loadFuncs, fetchWeek]);

  useEffect(() => {
    reload();
  }, [reload]);

  // navegação de semana
  const goPrevWeek = () => setWeekRef(addDays(weekRef, -7));
  const goNextWeek = () => setWeekRef(addDays(weekRef, 7));
  const goThisWeek = () => setWeekRef(startOfWeek(new Date()));

  // quando weekRef muda, recarrega
  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr("");
      try {
        await fetchWeek();
      } catch (e) {
        setErr(e.message || "Falha ao atualizar a semana.");
      } finally {
        setLoading(false);
      }
    })();
  }, [weekRef]); // eslint-disable-line

  // helpers de visualização
  const funcById = useMemo(() => {
    const map = new Map();
    funcs.forEach((f) => map.set(f.id, f));
    return map;
  }, [funcs]);

  const scalesByFuncDay = useMemo(() => {
    // chave = `${funcionario_id}|${data}`
    const map = new Map();
    for (const s of scales) {
      const key = `${s.funcionario_id}|${s.data}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(s);
    }
    // ordena por turno_ordem crescente
    for (const arr of map.values()) {
      arr.sort((a, b) => (a.turno_ordem || 0) - (b.turno_ordem || 0));
    }
    return map;
  }, [scales]);

  // abrir modal novo
  const openNew = (funcId, dateISO) => {
    setEditing(null);
    setForm({
      funcionario_id: funcId || "",
      data: dateISO || toISO(new Date()),
      turno_ordem: 1,
      entrada: "",
      saida: "",
      origem: "FIXA",
    });
    setOpenModal(true);
  };

  // editar existente
  const openEdit = (row) => {
    setEditing(row);
    setForm({
      funcionario_id: row.funcionario_id,
      data: row.data,
      turno_ordem: row.turno_ordem,
      entrada: row.entrada || "",
      saida: row.saida || "",
      origem: row.origem || "FIXA",
    });
    setOpenModal(true);
  };

  const save = async () => {
    setErr("");
    try {
      const payload = {
        funcionario_id: Number(form.funcionario_id),
        data: form.data,
        turno_ordem: Number(form.turno_ordem) || 1,
        entrada: form.entrada || null,
        saida: form.saida || null,
        origem: form.origem || "FIXA",
      };
      if (!payload.funcionario_id || !payload.data) {
        throw new Error("Selecione funcionário e data.");
      }
      if (!editing) {
        await api(`/api/escalas`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await api(`/api/escalas/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      setOpenModal(false);
      await fetchWeek();
    } catch (e) {
      setErr(String(e.message || "Falha ao salvar escala."));
    }
  };

  const remove = async (row) => {
    if (!confirm("Remover este turno da escala?")) return;
    try {
      await api(`/api/escalas/${row.id}`, { method: "DELETE" });
      await fetchWeek();
    } catch (e) {
      alert(e.message || "Falha ao excluir.");
    }
  };

  const startCopy = (row) => {
    setCopyFrom(row);
  };

  const doCopyTo = async (dateISO) => {
    if (!copyFrom) return;
    try {
      const payload = {
        funcionario_id: copyFrom.funcionario_id,
        data: dateISO,
        turno_ordem: copyFrom.turno_ordem,
        entrada: copyFrom.entrada,
        saida: copyFrom.saida,
        origem: copyFrom.origem,
      };
      await api(`/api/escalas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      await fetchWeek();
    } catch (e) {
      alert(e.message || "Falha ao copiar para o dia escolhido.");
    } finally {
      setCopyFrom(null);
    }
  };

  return (
    <>
      <header className="main-header">
        <div className="header-content">
          <h1>Escalas</h1>
          <p>Planejamento semanal por funcionário e turnos.</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <IconBtn title="Semana anterior" onClick={goPrevWeek}>
            <ChevronLeftIcon className="icon-sm" />
            Anterior
          </IconBtn>
          <IconBtn title="Semana atual" onClick={goThisWeek}>
            <CalendarDaysIcon className="icon-sm" />
            Hoje
          </IconBtn>
          <IconBtn title="Próxima semana" onClick={goNextWeek}>
            Próxima
            <ChevronRightIcon className="icon-sm" />
          </IconBtn>
          <IconBtn title="Atualizar" onClick={reload}>
            <ArrowPathIcon className="icon-sm" />
            {loading ? "Atualizando…" : "Atualizar"}
          </IconBtn>
        </div>
      </header>

      {err && (
        <div className="error-alert" role="alert">
          <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
            <span>⚠️</span>
            <span>{err}</span>
          </span>
        </div>
      )}

      {/* cabeçalho da semana */}
      <div className="container" style={{ marginBottom: 12 }}>
        <SmallTag>
          Semana: {toISO(days[0])} → {toISO(days[6])}
        </SmallTag>
        {copyFrom && (
          <span style={{ marginLeft: 8 }}>
            <SmallTag>
              Copiando turno de <strong>{funcById.get(copyFrom.funcionario_id)?.pessoa_nome || "?"}</strong>{" "}
              ({copyFrom.data} • T{copyFrom.turno_ordem})
            </SmallTag>
            <button
              className="toggle-btn"
              style={{ marginLeft: 8 }}
              onClick={() => setCopyFrom(null)}
            >
              Cancelar cópia
            </button>
          </span>
        )}
      </div>

      {/* grade */}
      <div className="container" style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "separate",
            borderSpacing: 0,
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            boxShadow: "var(--shadow)",
          }}
        >
          <thead>
            <tr>
              <th style={thStyle}>Funcionário</th>
              {days.map((d, i) => (
                <th key={i} style={thStyle}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <div>{WEEKDAY_LABELS[i]}</div>
                    <div style={{ fontSize: "var(--fs-12)", color: "var(--muted)" }}>{toISO(d)}</div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {funcs.map((f) => (
              <tr key={f.id}>
                <td style={tdNameStyle}>
                  <div style={{ fontWeight: 600 }}>{f.pessoa_nome}</div>
                  {f.cargo_nome && (
                    <div style={{ fontSize: "var(--fs-12)", color: "var(--muted)" }}>{f.cargo_nome}</div>
                  )}
                  <button
                    className="toggle-btn"
                    style={{ marginTop: 8 }}
                    onClick={() => openNew(f.id, toISO(days[0]))}
                    title="Adicionar turno nesta semana"
                  >
                    <PlusIcon className="icon-sm" />
                    Novo turno
                  </button>
                </td>

                {days.map((d, i) => {
                  const key = `${f.id}|${toISO(d)}`;
                  const items = scalesByFuncDay.get(key) || [];
                  const isToday = sameDay(d, new Date());
                  return (
                    <td key={i} style={cellStyle(isToday)}>
                      {items.length === 0 ? (
                        <button
                          className="toggle-btn"
                          onClick={() => openNew(f.id, toISO(d))}
                          title="Adicionar turno"
                        >
                          <PlusIcon className="icon-sm" />
                          Adicionar
                        </button>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {items.map((row) => (
                            <div
                              key={row.id}
                              style={{
                                border: "1px solid var(--border)",
                                borderRadius: 10,
                                padding: "8px 10px",
                                background: "var(--panel-muted)",
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div style={{ fontWeight: 600 }}>
                                  T{row.turno_ordem} • {row.entrada || "--:--"} → {row.saida || "--:--"}
                                </div>
                                <div style={{ display: "flex", gap: 6 }}>
                                  <button
                                    className="logout-btn"
                                    title="Copiar para outro dia desta semana"
                                    onClick={() => startCopy(row)}
                                  >
                                    <ClipboardDocumentListIcon className="icon-sm" />
                                  </button>
                                  <button className="logout-btn" title="Editar" onClick={() => openEdit(row)}>
                                    <PencilSquareIcon className="icon-sm" />
                                  </button>
                                  <button className="logout-btn" title="Excluir" onClick={() => remove(row)}>
                                    <TrashIcon className="icon-sm" />
                                  </button>
                                </div>
                              </div>
                              <div style={{ fontSize: "var(--fs-12)", color: "var(--muted)" }}>
                                Origem: {row.origem || "—"}
                              </div>
                              {copyFrom && copyFrom.id === row.id && (
                                <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                                  {days
                                    .filter((dd) => toISO(dd) !== row.data)
                                    .map((dd, idx) => (
                                      <button
                                        key={idx}
                                        className="toggle-btn"
                                        onClick={() => doCopyTo(toISO(dd))}
                                      >
                                        {WEEKDAY_LABELS[idx]} {toISO(dd)}
                                      </button>
                                    ))}
                                </div>
                              )}
                            </div>
                          ))}
                          {/* adicionar mais um turno no mesmo dia */}
                          <button
                            className="toggle-btn"
                            onClick={() => openNew(f.id, toISO(d))}
                            title="Adicionar outro turno neste dia"
                          >
                            <PlusIcon className="icon-sm" />
                            Outro turno
                          </button>
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {funcs.length === 0 && (
              <tr>
                <td colSpan={8} style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>
                  Nenhum funcionário encontrado. Cadastre funcionários para montar a escala.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL */}
      <Modal
        open={openModal}
        onClose={() => setOpenModal(false)}
        title={editing ? "Editar turno da escala" : "Novo turno na escala"}
        footer={
          <>
            <button className="toggle-btn" onClick={() => setOpenModal(false)}>Cancelar</button>
            <button className="toggle-btn is-active" onClick={save}>
              <PlusIcon className="icon-sm" />
              {editing ? "Salvar alterações" : "Adicionar turno"}
            </button>
          </>
        }
      >
        {/* funcionário */}
        <label htmlFor="f_func">Funcionário</label>
        <select
          id="f_func"
          value={form.funcionario_id}
          onChange={(e) => setForm((s) => ({ ...s, funcionario_id: Number(e.target.value) }))}
          style={selectStyle}
        >
          <option value="">Selecione…</option>
          {funcs.map((f) => (
            <option key={f.id} value={f.id}>
              {f.pessoa_nome} {f.cargo_nome ? `• ${f.cargo_nome}` : ""}
            </option>
          ))}
        </select>

        {/* data */}
        <label htmlFor="f_data">Data</label>
        <input
          id="f_data"
          type="date"
          value={form.data}
          onChange={(e) => setForm((s) => ({ ...s, data: e.target.value }))}
        />

        {/* turno */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <div>
            <label htmlFor="f_turno">Turno (ordem)</label>
            <input
              id="f_turno"
              type="number"
              min={1}
              value={form.turno_ordem}
              onChange={(e) => setForm((s) => ({ ...s, turno_ordem: Number(e.target.value || 1) }))}
            />
          </div>
          <div>
            <label htmlFor="f_entrada">Entrada</label>
            <input
              id="f_entrada"
              type="time"
              value={form.entrada}
              onChange={(e) => setForm((s) => ({ ...s, entrada: e.target.value }))}
            />
          </div>
          <div>
            <label htmlFor="f_saida">Saída</label>
            <input
              id="f_saida"
              type="time"
              value={form.saida}
              onChange={(e) => setForm((s) => ({ ...s, saida: e.target.value }))}
            />
          </div>
        </div>

        {/* origem */}
        <label htmlFor="f_origem">Origem</label>
        <select
          id="f_origem"
          value={form.origem}
          onChange={(e) => setForm((s) => ({ ...s, origem: e.target.value }))}
          style={selectStyle}
        >
          <option value="FIXA">FIXA</option>
          <option value="EXCECAO">EXCECAO</option>
        </select>
      </Modal>
    </>
  );
}

const thStyle = {
  position: "sticky",
  top: 0,
  background: "var(--panel)",
  borderBottom: "1px solid var(--border)",
  padding: "12px 10px",
  textAlign: "center",
  fontWeight: 700,
  color: "var(--fg)",
  zIndex: 1,
};
const tdNameStyle = {
  verticalAlign: "top",
  borderTop: "1px solid var(--border)",
  padding: 12,
  minWidth: 220,
  background: "var(--panel)",
};
const cellStyle = (today) => ({
  verticalAlign: "top",
  borderTop: "1px solid var(--border)",
  borderLeft: "1px solid var(--border)",
  padding: 12,
  minWidth: 220,
  background: today ? "color-mix(in srgb, var(--info) 8%, #fff)" : "var(--panel)",
});
const selectStyle = {
  padding: "12px 14px",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  fontSize: "var(--fs-16)",
  background: "#fff",
  color: "#111",
};
