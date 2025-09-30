// src/pages/Escalas.jsx
import { useEffect, useMemo, useState, useCallback } from "react";

const API_BASE = import.meta.env.VITE_API_BASE?.replace(/\/+$/, "") || "";

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
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function formatMonthYear(d) {
  return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

function calcularDuracao(entrada, saida) {
  if (!entrada || !saida) return "0:00";
  
  const [h1, m1] = entrada.split(':').map(Number);
  const [h2, m2] = saida.split(':').map(Number);
  
  const totalMinutos = (h2 * 60 + m2) - (h1 * 60 + m1);
  const horas = Math.floor(totalMinutos / 60);
  const minutos = totalMinutos % 60;
  
  return `${horas}:${minutos.toString().padStart(2, '0')}`;
}

const DIAS_SEMANA = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
const DIAS_SEMANA_CURTO = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

/* ========== Modal ========== */
function Modal({ open, onClose, title, children, footer }) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
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
          width: "min(500px, 100%)",
          background: "var(--panel)",
          borderRadius: "12px",
          border: "1px solid var(--border)",
          padding: 20,
        }}
      >
        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "space-between", 
          marginBottom: 16,
          paddingBottom: 12,
          borderBottom: "1px solid var(--border)"
        }}>
          <h2 style={{ margin: 0, fontSize: "18px" }}>{title}</h2>
          <button 
            className="toggle-btn" 
            onClick={onClose}
            style={{ padding: "8px" }}
          >
            ✕
          </button>
        </div>
        <div style={{ marginBottom: 16 }}>
          {children}
        </div>
        {footer && (
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* ========== Página Escalas ========== */
export default function Escalas() {
  const [dataRef, setDataRef] = useState(() => startOfWeek(new Date()));
  const dias = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(dataRef, i)), [dataRef]);

  const [funcionarios, setFuncionarios] = useState([]);
  const [escalas, setEscalas] = useState([]);
  const [feriados, setFeriados] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [sucesso, setSucesso] = useState("");

  // Estados para modais
  const [modalAberto, setModalAberto] = useState(false);
  const [modalFeriadoAberto, setModalFeriadoAberto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({
    funcionario_id: "",
    data: toISO(new Date()),
    turno_ordem: 1,
    entrada: "",
    saida: "",
    origem: "FIXA",
  });
  
  const [formFeriado, setFormFeriado] = useState({
    data: toISO(new Date()),
    descricao: ""
  });

  const api = useCallback(async (path, init = {}) => {
    const r = await fetch(`${API_BASE}${path}`, { credentials: "include", ...init });
    let data = null;
    try { data = await r.json(); } catch {}
    if (!r.ok || !data?.ok) throw new Error(data?.error || `HTTP ${r.status}`);
    return data;
  }, []);

  const carregarFuncionarios = useCallback(async () => {
    const d = await api(`/api/funcionarios?ativos=1`);
    setFuncionarios(d.funcionarios || []);
  }, [api]);

  const carregarEscalas = useCallback(async () => {
    const de = toISO(dias[0]);
    const ate = toISO(dias[6]);
    const d = await api(`/api/escalas?from=${de}&to=${ate}`);
    setEscalas(d.escalas || []);
  }, [api, dias]);

  const carregarFeriados = useCallback(async () => {
    try {
      const de = toISO(dias[0]);
      const ate = toISO(dias[6]);
      const d = await api(`/api/feriados?from=${de}&to=${ate}`);
      setFeriados(d.feriados || []);
    } catch (e) {
      console.error("Erro ao carregar feriados:", e);
    }
  }, [api, dias]);

  const recarregar = useCallback(async () => {
    setLoading(true);
    setErr("");
    setSucesso("");
    try {
      await Promise.all([
        carregarFuncionarios(),
        carregarEscalas(),
        carregarFeriados()
      ]);
    } catch (e) {
      setErr(e.message || "Falha ao carregar dados.");
    } finally {
      setLoading(false);
    }
  }, [carregarFuncionarios, carregarEscalas, carregarFeriados]);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  // Navegação
  const semanaAnterior = () => setDataRef(addDays(dataRef, -7));
  const semanaSeguinte = () => setDataRef(addDays(dataRef, 7));
  const semanaAtual = () => setDataRef(startOfWeek(new Date()));

  // Helpers de visualização
  const funcionarioPorId = useMemo(() => {
    const map = new Map();
    funcionarios.forEach((f) => map.set(f.id, f));
    return map;
  }, [funcionarios]);

  const escalasPorFuncionarioDia = useMemo(() => {
    const map = new Map();
    for (const s of escalas) {
      const key = `${s.funcionario_id}|${s.data}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(s);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => (a.turno_ordem || 0) - (b.turno_ordem || 0));
    }
    return map;
  }, [escalas]);

  const feriadoPorData = useMemo(() => {
    const map = new Map();
    feriados.forEach(f => map.set(f.data, f));
    return map;
  }, [feriados]);

  // Calcular totais por dia
  const calcularTotaisDia = (escalasDia) => {
    let totalMinutos = 0;
    
    escalasDia.forEach(escala => {
      if (escala.entrada && escala.saida) {
        const [h1, m1] = escala.entrada.split(':').map(Number);
        const [h2, m2] = escala.saida.split(':').map(Number);
        totalMinutos += (h2 * 60 + m2) - (h1 * 60 + m1);
      }
    });

    const horas = Math.floor(totalMinutos / 60);
    const minutos = totalMinutos % 60;
    return `${horas}:${minutos.toString().padStart(2, '0')}`;
  };

  // Modal handlers
  const abrirNovo = (funcId, dataISO) => {
    setEditando(null);
    setForm({
      funcionario_id: funcId || "",
      data: dataISO || toISO(new Date()),
      turno_ordem: 1,
      entrada: "",
      saida: "",
      origem: "FIXA",
    });
    setModalAberto(true);
  };

  const abrirEdicao = (escala) => {
    setEditando(escala);
    setForm({
      funcionario_id: escala.funcionario_id,
      data: escala.data,
      turno_ordem: escala.turno_ordem,
      entrada: escala.entrada || "",
      saida: escala.saida || "",
      origem: escala.origem || "FIXA",
    });
    setModalAberto(true);
  };

  const salvarEscala = async () => {
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

      if (editando) {
        await api(`/api/escalas/${editando.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        setSucesso("Escala atualizada com sucesso!");
      } else {
        await api(`/api/escalas`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        setSucesso("Escala adicionada com sucesso!");
      }

      setModalAberto(false);
      await carregarEscalas();
    } catch (e) {
      setErr(e.message || "Falha ao salvar escala.");
    }
  };

  const excluirEscala = async (escala) => {
    if (!confirm("Remover este turno da escala?")) return;
    try {
      await api(`/api/escalas/${escala.id}`, { method: "DELETE" });
      await carregarEscalas();
      setSucesso("Escala removida com sucesso!");
    } catch (e) {
      setErr(e.message || "Falha ao excluir escala.");
    }
  };

  const salvarFeriado = async () => {
    setErr("");
    try {
      await api(`/api/feriados`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formFeriado),
      });
      setModalFeriadoAberto(false);
      setSucesso("Feriado adicionado com sucesso!");
      await carregarFeriados();
    } catch (e) {
      setErr(e.message || "Falha ao salvar feriado.");
    }
  };

  return (
    <>
      <header className="main-header">
        <div className="header-content">
          <h1>Escalas de Trabalho</h1>
          <p>Gestão de escalas semanais por funcionário</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="toggle-btn" onClick={semanaAnterior}>
            ← Anterior
          </button>
          <button className="toggle-btn" onClick={semanaAtual}>
            Esta Semana
          </button>
          <button className="toggle-btn" onClick={semanaSeguinte}>
            Seguinte →
          </button>
          <button className="toggle-btn" onClick={() => setModalFeriadoAberto(true)}>
            + Feriado
          </button>
          <button className="toggle-btn" onClick={recarregar} disabled={loading}>
            {loading ? "Atualizando..." : "Atualizar"}
          </button>
        </div>
      </header>

      {err && (
        <div className="error-alert" role="alert" style={{ marginBottom: 16 }}>
          {err}
        </div>
      )}

      {sucesso && (
        <div className="success-alert" role="status" style={{ marginBottom: 16 }}>
          {sucesso}
        </div>
      )}

      {/* Cabeçalho do calendário */}
      <div style={{ 
        background: "var(--panel)", 
        padding: "16px", 
        borderRadius: "8px", 
        border: "1px solid var(--border)",
        marginBottom: 16
      }}>
        <div style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center",
          marginBottom: 12
        }}>
          <h2 style={{ margin: 0, color: "var(--fg)" }}>
            {formatMonthYear(dataRef)} - Semana {Math.ceil((dataRef.getDate() + startOfWeek(new Date(dataRef.getFullYear(), dataRef.getMonth(), 1)).getDay()) / 7)}
          </h2>
          <div style={{ display: "flex", gap: 8, fontSize: "14px", color: "var(--muted)" }}>
            <span>De: {formatDateBR(dias[0])}</span>
            <span>À: {formatDateBR(dias[6])}</span>
          </div>
        </div>

        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "220px repeat(7, 1fr)", 
          gap: "1px",
          background: "var(--border)"
        }}>
          {/* Cabeçalho dos dias */}
          <div style={{ background: "var(--panel)", padding: "12px" }}></div>
          {dias.map((dia, index) => {
            const feriado = feriadoPorData.get(toISO(dia));
            return (
              <div key={index} style={{ 
                background: "var(--panel)", 
                padding: "12px",
                textAlign: "center",
                borderBottom: "2px solid var(--border)"
              }}>
                <div style={{ fontWeight: 600, fontSize: "14px" }}>
                  {DIAS_SEMANA_CURTO[index]}
                </div>
                <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px" }}>
                  {formatDateBR(dia)}
                </div>
                {feriado && (
                  <div style={{ 
                    fontSize: "11px", 
                    color: "#dc2626",
                    background: "#fef2f2",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    marginTop: "4px"
                  }}>
                    🎉 {feriado.descricao}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Grade de escalas */}
      <div style={{ 
        background: "var(--panel)", 
        borderRadius: "8px", 
        border: "1px solid var(--border)",
        overflow: "hidden"
      }}>
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "220px repeat(7, 1fr)", 
          gap: "1px",
          background: "var(--border)"
        }}>
          {/* Linha de funcionários */}
          {funcionarios.map((func) => (
            <div key={func.id} style={{ 
              display: "contents",
              background: "var(--panel)"
            }}>
              {/* Coluna do funcionário */}
              <div style={{ 
                background: "var(--panel)",
                padding: "12px",
                position: "sticky",
                left: 0,
                zIndex: 2
              }}>
                <div style={{ fontWeight: 600, fontSize: "14px" }}>
                  {func.pessoa_nome}
                </div>
                <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                  {func.cargo_nome}
                </div>
                <button
                  className="toggle-btn"
                  style={{ marginTop: "8px", fontSize: "12px", padding: "4px 8px" }}
                  onClick={() => abrirNovo(func.id)}
                >
                  + Turno
                </button>
              </div>

              {/* Dias da semana */}
              {dias.map((dia, diaIndex) => {
                const key = `${func.id}|${toISO(dia)}`;
                const escalasDia = escalasPorFuncionarioDia.get(key) || [];
                const feriado = feriadoPorData.get(toISO(dia));
                const totalDia = calcularTotaisDia(escalasDia);

                return (
                  <div key={diaIndex} style={{ 
                    background: "var(--panel)",
                    padding: "8px",
                    minHeight: "120px",
                    position: "relative"
                  }}>
                    {feriado ? (
                      <div style={{ 
                        textAlign: "center", 
                        color: "#dc2626",
                        fontSize: "12px",
                        padding: "8px"
                      }}>
                        🎉 Feriado
                      </div>
                    ) : (
                      <>
                        {escalasDia.length === 0 ? (
                          <button
                            className="toggle-btn"
                            style={{ width: "100", fontSize: "12px", padding: "8px" }}
                            onClick={() => abrirNovo(func.id, toISO(dia))}
                          >
                            + Add
                          </button>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            {escalasDia.map((escala, turnoIndex) => (
                              <div key={escala.id} style={{
                                border: "1px solid var(--border)",
                                borderRadius: "6px",
                                padding: "6px",
                                fontSize: "11px",
                                background: "var(--panel-muted)"
                              }}>
                                <div style={{ fontWeight: 600 }}>
                                  T{escala.turno_ordem}: {escala.entrada || "--:--"} às {escala.saida || "--:--"}
                                </div>
                                <div style={{ color: "var(--muted)", marginTop: "2px" }}>
                                  {calcularDuracao(escala.entrada, escala.saida)}h
                                </div>
                                <div style={{ display: "flex", gap: "4px", marginTop: "4px" }}>
                                  <button
                                    className="toggle-btn"
                                    style={{ padding: "2px 4px", fontSize: "10px" }}
                                    onClick={() => abrirEdicao(escala)}
                                  >
                                    Editar
                                  </button>
                                  <button
                                    className="toggle-btn"
                                    style={{ padding: "2px 4px", fontSize: "10px" }}
                                    onClick={() => excluirEscala(escala)}
                                  >
                                    Excluir
                                  </button>
                                </div>
                              </div>
                            ))}
                            <button
                              className="toggle-btn"
                              style={{ fontSize: "11px", padding: "4px" }}
                              onClick={() => abrirNovo(func.id, toISO(dia))}
                            >
                              + Turno
                            </button>
                          </div>
                        )}
                        
                        {escalasDia.length > 0 && (
                          <div style={{
                            position: "absolute",
                            bottom: "4px",
                            right: "4px",
                            fontSize: "10px",
                            fontWeight: 600,
                            color: "var(--success)",
                            background: "var(--panel)",
                            padding: "2px 4px",
                            borderRadius: "4px",
                            border: "1px solid var(--border)"
                          }}>
                            Total: {totalDia}h
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Modal Escala */}
      <Modal
        open={modalAberto}
        onClose={() => setModalAberto(false)}
        title={editando ? "Editar Turno" : "Novo Turno"}
        footer={
          <>
            <button className="toggle-btn" onClick={() => setModalAberto(false)}>
              Cancelar
            </button>
            <button className="toggle-btn" onClick={salvarEscala}>
              {editando ? "Salvar" : "Adicionar"}
            </button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div>
            <label style={{ display: "block", marginBottom: "4px", fontSize: "14px" }}>
              Funcionário
            </label>
            <select
              value={form.funcionario_id}
              onChange={(e) => setForm({ ...form, funcionario_id: e.target.value })}
              style={{ 
                width: "100%", 
                padding: "8px 12px", 
                borderRadius: "6px", 
                border: "1px solid var(--border)" 
              }}
            >
              <option value="">Selecione...</option>
              {funcionarios.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.pessoa_nome} - {f.cargo_nome}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "4px", fontSize: "14px" }}>
              Data
            </label>
            <input
              type="date"
              value={form.data}
              onChange={(e) => setForm({ ...form, data: e.target.value })}
              style={{ 
                width: "100%", 
                padding: "8px 12px", 
                borderRadius: "6px", 
                border: "1px solid var(--border)" 
              }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
            <div>
              <label style={{ display: "block", marginBottom: "4px", fontSize: "14px" }}>
                Turno
              </label>
              <input
                type="number"
                min="1"
                value={form.turno_ordem}
                onChange={(e) => setForm({ ...form, turno_ordem: parseInt(e.target.value) || 1 })}
                style={{ 
                  width: "100%", 
                  padding: "8px 12px", 
                  borderRadius: "6px", 
                  border: "1px solid var(--border)" 
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "4px", fontSize: "14px" }}>
                Entrada
              </label>
              <input
                type="time"
                value={form.entrada}
                onChange={(e) => setForm({ ...form, entrada: e.target.value })}
                style={{ 
                  width: "100%", 
                  padding: "8px 12px", 
                  borderRadius: "6px", 
                  border: "1px solid var(--border)" 
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "4px", fontSize: "14px" }}>
                Saída
              </label>
              <input
                type="time"
                value={form.saida}
                onChange={(e) => setForm({ ...form, saida: e.target.value })}
                style={{ 
                  width: "100%", 
                  padding: "8px 12px", 
                  borderRadius: "6px", 
                  border: "1px solid var(--border)" 
                }}
              />
            </div>
          </div>

          {form.entrada && form.saida && (
            <div style={{ 
              padding: "8px", 
              background: "var(--panel-muted)", 
              borderRadius: "6px",
              fontSize: "14px",
              textAlign: "center"
            }}>
              Duração: <strong>{calcularDuracao(form.entrada, form.saida)} horas</strong>
            </div>
          )}
        </div>
      </Modal>

      {/* Modal Feriado */}
      <Modal
        open={modalFeriadoAberto}
        onClose={() => setModalFeriadoAberto(false)}
        title="Adicionar Feriado"
        footer={
          <>
            <button className="toggle-btn" onClick={() => setModalFeriadoAberto(false)}>
              Cancelar
            </button>
            <button className="toggle-btn" onClick={salvarFeriado}>
              Adicionar
            </button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div>
            <label style={{ display: "block", marginBottom: "4px", fontSize: "14px" }}>
              Data do Feriado
            </label>
            <input
              type="date"
              value={formFeriado.data}
              onChange={(e) => setFormFeriado({ ...formFeriado, data: e.target.value })}
              style={{ 
                width: "100%", 
                padding: "8px 12px", 
                borderRadius: "6px", 
                border: "1px solid var(--border)" 
              }}
            />
          </div>
          <div>
            <label style={{ display: "block", marginBottom: "4px", fontSize: "14px" }}>
              Descrição
            </label>
            <input
              type="text"
              value={formFeriado.descricao}
              onChange={(e) => setFormFeriado({ ...formFeriado, descricao: e.target.value })}
              placeholder="Ex: Natal, Ano Novo, Feriado Municipal..."
              style={{ 
                width: "100%", 
                padding: "8px 12px", 
                borderRadius: "6px", 
                border: "1px solid var(--border)" 
              }}
            />
          </div>
        </div>
      </Modal>
    </>
  );
}
