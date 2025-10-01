// src/pages/Apontamentos.jsx
import { useCallback, useEffect, useMemo, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE?.replace(/\/+$/, "") || "";

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
function firstDayOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function lastDayOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
function minutes(hhmm) {
  if (!hhmm) return 0;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
function fmtHHMM(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function duracao(entrada, saida) {
  const a = minutes(entrada);
  const b = minutes(saida);
  if (!entrada || !saida) return 0;
  // não consideramos virada de dia aqui (UI orienta dividir em 2 registros)
  return Math.max(0, b - a);
}
function isHHMM(v) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(v || ""));
}

/* ===================== UI: Badge de origem ===================== */
function OrigemBadge({ origem }) {
  const o = String(origem || "").toUpperCase();
  const map = {
    APONTADO: { bg: "rgba(59,130,246,.12)", fg: "#2563eb", label: "APONTADO" },
    IMPORTADO: { bg: "rgba(16,185,129,.15)", fg: "#047857", label: "IMPORTADO" },
    AJUSTE: { bg: "rgba(234,179,8,.20)", fg: "#92400e", label: "AJUSTE" },
  };
  const sty = map[o] || map.APONTADO;
  return (
    <span style={{
      background: sty.bg,
      color: sty.fg,
      border: "1px solid color-mix(in srgb, currentColor 25%, transparent)",
      padding: "2px 8px",
      borderRadius: 999,
      fontSize: "12px",
      fontWeight: 700
    }}>
      {sty.label}
    </span>
  );
}

/* ===================== UI: Modal simples ===================== */
function Modal({ open, title, onClose, children, footer }) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,.35)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 1000
      }}
    >
      <div style={{ width: "min(720px,100%)", background: "var(--panel)", borderRadius: 12, border: "1px solid var(--border)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", padding: 16, borderBottom: "1px solid var(--border)" }}>
          <h2 style={{ margin: 0, fontSize: "18px" }}>{title}</h2>
          <button className="toggle-btn" onClick={onClose}>Fechar</button>
        </div>
        <div style={{ padding: 16 }}>{children}</div>
        {footer && <div style={{ padding: 16, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: 8 }}>{footer}</div>}
      </div>
    </div>
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
  const [itens, setItens] = useState([]);

  /* -------- ui -------- */
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [okMsg, setOkMsg] = useState("");

  /* -------- CRUD modal -------- */
  const [openForm, setOpenForm] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({
    funcionario_id: "",
    data: toISO(new Date()),
    turno_ordem: 1,
    entrada: "",
    saida: "",
    origem: "APONTADO",
    obs: ""
  });

  /* -------- Import modal -------- */
  const [openImport, setOpenImport] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [preview, setPreview] = useState({ validas: [], invalidas: [], conflitos: [] });

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
    const d = await api(`/api/apontamentos?${qs}`);
    setItens(d.apontamentos || []);
  }, [api, periodo, funcionarioId, origem]);

  const recarregar = useCallback(async () => {
    setErr(""); setOkMsg(""); setLoading(true);
    try {
      await Promise.all([loadFuncionarios(), loadItens()]);
    } catch (e) {
      setErr(e.message || "Falha ao carregar.");
    } finally {
      setLoading(false);
    }
  }, [loadFuncionarios, loadItens]);

  useEffect(() => { recarregar(); }, [recarregar]);
  useEffect(() => { loadItens(); }, [periodo, funcionarioId, origem]); // reage aos filtros

  /* ---------------- Ações (CRUD) ---------------- */
  const abrirNovo = () => {
    setEditando(null);
    setForm({
      funcionario_id: funcionarioId || "",
      data: periodo.de,
      turno_ordem: 1,
      entrada: "",
      saida: "",
      origem: "APONTADO",
      obs: ""
    });
    setOpenForm(true);
  };
  const abrirEdicao = (it) => {
    setEditando(it);
    setForm({
      funcionario_id: it.funcionario_id,
      data: it.data,
      turno_ordem: it.turno_ordem,
      entrada: it.entrada || "",
      saida: it.saida || "",
      origem: it.origem || "APONTADO",
      obs: it.obs || "",
    });
    setOpenForm(true);
  };

  function validarFormLocal(f) {
    if (!f.funcionario_id) return "Selecione um funcionário.";
    if (!f.data) return "Selecione a data.";
    if (f.entrada && !isHHMM(f.entrada)) return "Hora de entrada inválida.";
    if (f.saida && !isHHMM(f.saida)) return "Hora de saída inválida.";
    if (f.entrada && f.saida && minutes(f.saida) < minutes(f.entrada)) {
      return "Saída menor que a entrada. Para virada de dia, lance dois apontamentos (noite e madrugada).";
    }
    return null;
  }

  const salvar = async () => {
    setErr(""); setOkMsg("");
    const payload = {
      funcionario_id: Number(form.funcionario_id),
      data: form.data,
      turno_ordem: Number(form.turno_ordem) || 1,
      entrada: form.entrada || null,
      saida: form.saida || null,
      origem: String(form.origem || "APONTADO").toUpperCase(),
      obs: form.obs || null
    };
    const v = validarFormLocal(payload);
    if (v) { setErr(v); return; }

    try {
      if (editando) {
        await api(`/api/apontamentos/${editando.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        setOkMsg("Apontamento atualizado.");
      } else {
        await api(`/api/apontamentos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        setOkMsg("Apontamento criado.");
      }
      setOpenForm(false);
      await loadItens();
    } catch (e) {
      setErr(e.message || "Falha ao salvar.");
    }
  };

  const excluir = async (it) => {
    if (!confirm("Excluir este apontamento?")) return;
    setErr(""); setOkMsg("");
    try {
      await api(`/api/apontamentos/${it.id}`, { method: "DELETE" });
      setOkMsg("Apontamento removido.");
      await loadItens();
    } catch (e) {
      setErr(e.message || "Falha ao excluir.");
    }
  };

  /* ---------------- Import (CSV) ---------------- */
  function parseCSV(text) {
    // espera ; como separador
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const out = [];
    for (const line of lines) {
      const [funcionario_id, data, turno_ordem, entrada, saida, origem, obs] = line.split(";").map(s => s?.trim());
      out.push({ funcionario_id, data, turno_ordem, entrada, saida, origem, obs });
    }
    return out;
  }

  function validarLote(rows) {
    const validas = [];
    const invalidas = [];
    const keySet = new Set(); // para detectar duplicidade no próprio arquivo

    rows.forEach((r, idx) => {
      const row = {
        funcionario_id: Number(r.funcionario_id),
        data: r.data,
        turno_ordem: Number(r.turno_ordem) || 1,
        entrada: r.entrada || null,
        saida: r.saida || null,
        origem: String(r.origem || "APONTADO").toUpperCase(),
        obs: r.obs || null,
        _idx: idx + 1
      };

      let motivo = "";
      if (!row.funcionario_id) motivo = "funcionario_id vazio";
      else if (!row.data || !/^\d{4}-\d{2}-\d{2}$/.test(row.data)) motivo = "data inválida (YYYY-MM-DD)";
      else if (row.entrada && !isHHMM(row.entrada)) motivo = "entrada inválida";
      else if (row.saida && !isHHMM(row.saida)) motivo = "saída inválida";
      else if (row.entrada && row.saida && minutes(row.saida) < minutes(row.entrada)) motivo = "saida < entrada";
      // chave de duplicidade (no arquivo)
      const k = `${row.funcionario_id}|${row.data}|${row.turno_ordem}|${row.origem}`;
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

    // detecta conflitos com itens já carregados (mesma chave)
    const existentes = new Set(
      itens.map(it => `${it.funcionario_id}|${it.data}|${it.turno_ordem}|${String(it.origem || "").toUpperCase()}`)
    );
    const conflitos = p.validas.filter(v => existentes.has(`${v.funcionario_id}|${v.data}|${v.turno_ordem}|${v.origem}`));
    const validasSemConflito = p.validas.filter(v => !existentes.has(`${v.funcionario_id}|${v.data}|${v.turno_ordem}|${v.origem}`));

    setPreview({ validas: validasSemConflito, invalidas: p.invalidas, conflitos });
  }

  const importarValidas = async () => {
    if (!preview.validas.length) return;
    setErr(""); setOkMsg("");
    try {
      await api(`/api/apontamentos/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: preview.validas }),
      });
      setOkMsg(`Importadas ${preview.validas.length} linhas. Recusadas ${preview.invalidas.length + preview.conflitos.length}.`);
      setOpenImport(false);
      setCsvText("");
      setPreview({ validas: [], invalidas: [], conflitos: [] });
      await loadItens();
    } catch (e) {
      setErr(e.message || "Falha ao importar.");
    }
  };

  /* ---------------- Derivados ---------------- */
  const totalMinutosPeriodo = useMemo(
    () => itens.reduce((acc, it) => acc + duracao(it.entrada, it.saida), 0),
    [itens]
  );

  /* ===================== render ===================== */
  return (
    <>
      <header className="main-header">
        <div className="header-content">
          <h1>Apontamentos</h1>
          <p>Cadastre batidas/turnos, edite e importe CSV. Total no período: <strong>{fmtHHMM(totalMinutosPeriodo)}</strong></p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="toggle-btn" onClick={abrirNovo}>+ Novo apontamento</button>
          <button className="toggle-btn" onClick={() => setOpenImport(true)}>Importar CSV</button>
          <button className="toggle-btn" onClick={recarregar} disabled={loading}>{loading ? "Atualizando..." : "Atualizar"}</button>
        </div>
      </header>

      {/* Filtros */}
      <div className="container" style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>Período de</label>
            <input type="date" value={periodo.de} onChange={(e) => setPeriodo(p => ({ ...p, de: e.target.value }))} style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 8 }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>Até</label>
            <input type="date" value={periodo.ate} onChange={(e) => setPeriodo(p => ({ ...p, ate: e.target.value }))} style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 8 }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>Funcionário</label>
            <select value={funcionarioId} onChange={(e) => setFuncionarioId(e.target.value)} style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 8 }}>
              <option value="">Todos</option>
              {funcionarios.map(f => <option key={f.id} value={f.id}>{f.pessoa_nome} - {f.cargo_nome}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>Origem</label>
            <select value={origem} onChange={(e) => setOrigem(e.target.value)} style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 8 }}>
              <option value="">Todas</option>
              <option value="APONTADO">APONTADO</option>
              <option value="IMPORTADO">IMPORTADO</option>
              <option value="AJUSTE">AJUSTE</option>
            </select>
          </div>
        </div>
      </div>

      {err && <div className="error-alert" role="alert" style={{ marginBottom: 16 }}>{err}</div>}
      {okMsg && <div className="success-alert" role="status" style={{ marginBottom: 16, padding: 12, background: "#ecfdf5", color: "#065f46", border: "1px solid #a7f3d0", borderRadius: 8 }}>{okMsg}</div>}

      {/* Tabela */}
      <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 12, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--panel-muted)" }}>
              <th style={th}>Data</th>
              <th style={th}>Funcionário</th>
              <th style={th}>Turno</th>
              <th style={th}>Entrada</th>
              <th style={th}>Saída</th>
              <th style={th}>Duração</th>
              <th style={th}>Origem</th>
              <th style={th}>Obs</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {itens.map((it) => {
              const f = funcionarios.find(x => x.id === it.funcionario_id);
              const minutos = duracao(it.entrada, it.saida);
              const inconsistencia =
                (it.entrada && it.saida && minutes(it.saida) < minutes(it.entrada)) ? "Saída < entrada" : "";

              return (
                <tr key={it.id} style={{ borderTop: "1px solid var(--border)", background: inconsistencia ? "rgba(220,38,38,.05)" : "transparent" }}>
                  <td style={td}>{it.data}</td>
                  <td style={td}>{f ? `${f.pessoa_nome} - ${f.cargo_nome}` : `#${it.funcionario_id}`}</td>
                  <td style={td}>&#35;{it.turno_ordem}</td>
                  <td style={td}>{it.entrada || "-"}</td>
                  <td style={td}>{it.saida || "-"}</td>
                  <td style={td}><strong>{fmtHHMM(minutos)}</strong>{inconsistencia ? " ⚠️" : ""}</td>
                  <td style={td}><OrigemBadge origem={it.origem} /></td>
                  <td style={td} title={it.obs || ""} >
                    <span style={{ display: "inline-block", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {it.obs || "-"}
                    </span>
                  </td>
                  <td style={{ ...td, textAlign: "right" }}>
                    <button className="toggle-btn" onClick={() => abrirEdicao(it)} style={{ marginRight: 8 }}>Editar</button>
                    <button className="toggle-btn" onClick={() => excluir(it)} style={{ background: "var(--error)", color: "#fff" }}>Excluir</button>
                  </td>
                </tr>
              );
            })}
            {!itens.length && (
              <tr>
                <td colSpan={9} style={{ ...td, textAlign: "center", color: "var(--muted)" }}>Nenhum apontamento no período.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de formulário */}
      <Modal
        open={openForm}
        title={editando ? "Editar apontamento" : "Novo apontamento"}
        onClose={() => setOpenForm(false)}
        footer={
          <>
            <button className="toggle-btn" onClick={() => setOpenForm(false)}>Cancelar</button>
            <button className="toggle-btn" onClick={salvar}>{editando ? "Salvar" : "Adicionar"}</button>
          </>
        }
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
          <div>
            <label className="nav-item-label" style={lbl}>Funcionário *</label>
            <select
              value={form.funcionario_id}
              onChange={(e) => setForm(f => ({ ...f, funcionario_id: e.target.value }))}
              style={inp}
            >
              <option value="">Selecione…</option>
              {funcionarios.map(f => <option key={f.id} value={f.id}>{f.pessoa_nome} - {f.cargo_nome}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Data *</label>
            <input type="date" value={form.data} onChange={(e) => setForm(f => ({ ...f, data: e.target.value }))} style={inp} />
          </div>
          <div>
            <label style={lbl}>Turno (ordem)</label>
            <input type="number" min="1" value={form.turno_ordem} onChange={(e) => setForm(f => ({ ...f, turno_ordem: parseInt(e.target.value) || 1 }))} style={inp} />
          </div>
          <div>
            <label style={lbl}>Entrada</label>
            <input type="time" value={form.entrada} onChange={(e) => setForm(f => ({ ...f, entrada: e.target.value }))} style={inp} />
          </div>
          <div>
            <label style={lbl}>Saída</label>
            <input type="time" value={form.saida} onChange={(e) => setForm(f => ({ ...f, saida: e.target.value }))} style={inp} />
          </div>
          <div>
            <label style={lbl}>Origem</label>
            <select value={form.origem} onChange={(e) => setForm(f => ({ ...f, origem: e.target.value }))} style={inp}>
              <option>APONTADO</option>
              <option>IMPORTADO</option>
              <option>AJUSTE</option>
            </select>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={lbl}>Observação</label>
            <textarea rows={3} value={form.obs} onChange={(e) => setForm(f => ({ ...f, obs: e.target.value }))} style={{ ...inp, resize: "vertical" }} />
          </div>
        </div>

        {/* dicas/validações */}
        {form.entrada && form.saida && minutes(form.saida) < minutes(form.entrada) && (
          <div className="error-alert" style={{ marginTop: 12 }}>
            Saída menor que a entrada. Para virada de dia, lance dois apontamentos (noite/madrugada).
          </div>
        )}
      </Modal>

      {/* Modal de importação */}
      <Modal
        open={openImport}
        title="Importar apontamentos (CSV ; separado por ponto e vírgula)"
        onClose={() => setOpenImport(false)}
        footer={
          <>
            <button className="toggle-btn" onClick={() => setOpenImport(false)}>Fechar</button>
            <button className="toggle-btn" onClick={onBuildPreview}>Pré-visualizar</button>
            <button className="toggle-btn" onClick={importarValidas} disabled={!preview.validas.length}>Importar {preview.validas.length} válidas</button>
          </>
        }
      >
        <p style={{ marginTop: 0, color: "var(--muted)" }}>
          Formato: <code>funcionario_id;data;turno_ordem;entrada;saida;origem;obs</code> — datas <code>YYYY-MM-DD</code>, horas <code>HH:MM</code>.  
          Duplicidade evitada pela chave <em>(func, data, turno, origem)</em>.
        </p>
        <textarea
          rows={8}
          placeholder="123;2025-10-01;1;08:00;12:00;APONTADO;Chegou no horário"
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          style={{ ...inp, width: "100%", resize: "vertical" }}
        />
        {(preview.validas.length + preview.invalidas.length + preview.conflitos.length) > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12, marginTop: 12 }}>
            <div style={card}>
              <strong>Válidas</strong>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>{preview.validas.length} linhas</div>
            </div>
            <div style={card}>
              <strong>Inválidas</strong>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>{preview.invalidas.length} linhas</div>
            </div>
            <div style={card}>
              <strong>Conflitos</strong>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>{preview.conflitos.length} linhas</div>
            </div>
          </div>
        )}

        {preview.invalidas.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <h3 style={{ fontSize: 14, margin: "12px 0 6px" }}>Inválidas</h3>
            <div style={{ maxHeight: 220, overflow: "auto", border: "1px solid var(--border)", borderRadius: 8 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr><th style={thSm}>#</th><th style={thSm}>func</th><th style={thSm}>data</th><th style={thSm}>turno</th><th style={thSm}>entrada</th><th style={thSm}>saida</th><th style={thSm}>origem</th><th style={thSm}>motivo</th></tr></thead>
                <tbody>
                  {preview.invalidas.map((r,i) => (
                    <tr key={`inv-${i}`} style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={tdSm}>{r._idx}</td><td style={tdSm}>{r.funcionario_id}</td><td style={tdSm}>{r.data}</td>
                      <td style={tdSm}>{r.turno_ordem}</td><td style={tdSm}>{r.entrada||"-"}</td><td style={tdSm}>{r.saida||"-"}</td>
                      <td style={tdSm}>{r.origem}</td><td style={tdSm}>{r.motivo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {preview.conflitos.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <h3 style={{ fontSize: 14, margin: "12px 0 6px" }}>Conflitos com dados existentes</h3>
            <div style={{ maxHeight: 220, overflow: "auto", border: "1px solid var(--border)", borderRadius: 8 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr><th style={thSm}>func</th><th style={thSm}>data</th><th style={thSm}>turno</th><th style={thSm}>origem</th></tr></thead>
                <tbody>
                  {preview.conflitos.map((r,i) => (
                    <tr key={`conf-${i}`} style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={tdSm}>{r.funcionario_id}</td><td style={tdSm}>{r.data}</td><td style={tdSm}>{r.turno_ordem}</td><td style={tdSm}>{r.origem}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

/* ===================== estilos inline reutilizáveis ===================== */
const th = { textAlign: "left", padding: "12px", fontSize: 12, color: "var(--muted)", borderBottom: "1px solid var(--border)" };
const td = { padding: "12px", fontSize: 14, color: "var(--fg)" };
const thSm = { ...th, padding: "8px" };
const tdSm  = { ...td, padding: "8px" };
const lbl = { display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4, fontWeight: 600 };
const inp = { width: "100%", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 8, background: "#fff", color: "#111" };
const card = { background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 8, padding: 12 };
