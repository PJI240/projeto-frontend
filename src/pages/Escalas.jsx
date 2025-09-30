// src/pages/Escalas.jsx - VERSÃO COMPATÍVEL COM BACKEND
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

// Horários do dia (6h às 22h)
const HORARIOS_DIA = Array.from({ length: 17 }, (_, i) => {
  const hora = i + 6;
  return `${hora.toString().padStart(2, '0')}:00`;
});

// Cores para os funcionários
const CORES_FUNCIONARIOS = [
  "#3b82f6", "#ef4444", "#10b981", "#f59e0b", 
  "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16",
  "#f97316", "#6366f1", "#14b8a6", "#84cc16",
  "#eab308", "#a855f7", "#f43f5e", "#0ea5e9"
];

function getCorFuncionario(id) {
  return CORES_FUNCIONARIOS[id % CORES_FUNCIONARIOS.length];
}

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
  
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [sucesso, setSucesso] = useState("");

  // Estados para modal
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({
    funcionario_id: "",
    data: toISO(new Date()),
    turno_ordem: 1,
    entrada: "",
    saida: "",
    origem: "FIXA",
  });

  const api = useCallback(async (path, init = {}) => {
    const url = `${API_BASE}${path}`;
    console.log('🌐 API Call:', init.method || 'GET', url);
    
    const r = await fetch(url, { 
      credentials: "include", 
      ...init 
    });
    
    let data = null;
    try { 
      data = await r.json(); 
    } catch (e) {
      console.error('❌ Erro ao parsear JSON:', e);
      throw new Error(`Resposta inválida do servidor: ${r.status}`);
    }
    
    console.log('📦 API Response:', data);
    
    if (!r.ok || data?.ok === false) {
      throw new Error(data?.error || `HTTP ${r.status}`);
    }
    
    return data;
  }, []);

  const carregarFuncionarios = useCallback(async () => {
    try {
      const d = await api(`/api/funcionarios?ativos=1`);
      console.log('👥 Funcionários carregados:', d.funcionarios?.length);
      setFuncionarios(d.funcionarios || []);
    } catch (e) {
      console.error('❌ Erro ao carregar funcionários:', e);
      throw e;
    }
  }, [api]);

  const carregarEscalas = useCallback(async () => {
    const de = toISO(dias[0]);
    const ate = toISO(dias[6]);
    
    console.log('📅 Carregando escalas de', de, 'até', ate);
    
    try {
      const d = await api(`/api/escalas?from=${de}&to=${ate}`);
      console.log('🕒 Escalas carregadas:', d.escalas?.length);
      setEscalas(d.escalas || []);
    } catch (e) {
      console.error('❌ Erro ao carregar escalas:', e);
      throw e;
    }
  }, [api, dias]);

  const recarregar = useCallback(async () => {
    setLoading(true);
    setErr("");
    setSucesso("");
    
    console.log('🔄 Iniciando recarregamento...');
    
    try {
      await Promise.all([
        carregarFuncionarios(),
        carregarEscalas()
      ]);
      console.log('✅ Recarregamento concluído');
    } catch (e) {
      console.error('❌ Erro no recarregar:', e);
      setErr(e.message || "Falha ao carregar dados.");
    } finally {
      setLoading(false);
    }
  }, [carregarFuncionarios, carregarEscalas]);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  // Recarregar quando mudar a semana
  useEffect(() => {
    if (escalas.length > 0) { // Só recarrega se já tiver dados carregados
      carregarEscalas();
    }
  }, [dataRef]);

  // Navegação
  const semanaAnterior = () => setDataRef(addDays(dataRef, -7));
  const semanaSeguinte = () => setDataRef(addDays(dataRef, 7));
  const semanaAtual = () => setDataRef(startOfWeek(new Date()));

  // Agrupar escalas por hora e dia para visualização
  const escalasAgrupadas = useMemo(() => {
  const mapa = new Map();

  escalas.forEach((escala) => {
    // tolera diferentes formatos vindos do backend
    const funcId =
      escala.funcionario_id ??
      escala.funcionarioId ??
      escala.funcionario ??
      null;

    const entradaStr = escala.entrada || escala.hora_entrada || null;
    const saidaStr   = escala.saida   || escala.hora_saida   || null;

    if (!funcId || !entradaStr || !saidaStr) return;

    const funcionario = funcionarios.find((f) => f.id === funcId);
    if (!funcionario) return;

    // inclui também a “hora cheia” final se a saída tiver minutos > 0
    const [h1, m1] = entradaStr.split(":").map(Number);
    const [h2, m2] = saidaStr.split(":").map(Number);

    const startHour = Number.isFinite(h1) ? h1 : 0;
    // se saiu 18:00, último bloco é 17; se saiu 12:50, último bloco é 12
    const endHour = Number.isFinite(h2)
      ? (m2 === 0 ? h2 - 1 : h2)
      : startHour;

    for (let hora = startHour; hora <= endHour; hora++) {
      const chave = `${escala.data}|${String(hora).padStart(2, "0")}`;
      if (!mapa.has(chave)) mapa.set(chave, []);
      if (!mapa.get(chave).some((e) => e.id === escala.id)) {
        mapa.get(chave).push({
          ...escala,
          funcionario_id: funcId,
          funcionario_nome: funcionario.pessoa_nome,
          cargo: funcionario.cargo_nome,
          cor: getCorFuncionario(funcId),
        });
      }
    }
  });

  return mapa;
}, [escalas, funcionarios]);

  // Encontrar escala em uma célula específica
  const encontrarEscalaNaCelula = (dataISO, hora) => {
    const chave = `${dataISO}|${hora}`;
    const escalas = escalasAgrupadas.get(chave) || [];
    return escalas;
  };

  // Modal handlers
  const abrirNovo = (funcId, dataISO, hora = "08:00") => {
    setEditando(null);
    setForm({
      funcionario_id: funcId || "",
      data: dataISO || toISO(new Date()),
      turno_ordem: 1,
      entrada: hora,
      saida: calcularHoraSaida(hora, 8),
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

  const calcularHoraSaida = (entrada, horas = 8) => {
    const [h, m] = entrada.split(':').map(Number);
    const saidaMinutos = h * 60 + m + horas * 60;
    const saidaHora = Math.floor(saidaMinutos / 60);
    const saidaMinuto = saidaMinutos % 60;
    return `${saidaHora.toString().padStart(2, '0')}:${saidaMinuto.toString().padStart(2, '0')}`;
  };

  const salvarEscala = async () => {
    setErr("");
    setSucesso("");
    
    try {
      const payload = {
        funcionario_id: Number(form.funcionario_id),
        data: form.data,
        turno_ordem: Number(form.turno_ordem) || 1,
        entrada: form.entrada || null,
        saida: form.saida || null,
        origem: form.origem || "FIXA",
      };

      console.log('💾 Salvando escala:', payload);

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
      // Recarregar os dados após salvar
      await carregarEscalas();
    } catch (e) {
      console.error('❌ Erro ao salvar escala:', e);
      setErr(e.message || "Falha ao salvar escala.");
    }
  };

  const excluirEscala = async (escala) => {
    if (!confirm(`Remover escala de ${escala.funcionario_nome} no dia ${escala.data}?`)) return;
    
    setErr("");
    setSucesso("");
    
    try {
      console.log('🗑️ Excluindo escala:', escala.id);
      await api(`/api/escalas/${escala.id}`, { method: "DELETE" });
      setSucesso("Escala removida com sucesso!");
      await carregarEscalas();
    } catch (e) {
      console.error('❌ Erro ao excluir escala:', e);
      setErr(e.message || "Falha ao excluir escala.");
    }
  };

  // Handler para clique na célula
  const handleCliqueCelula = (dataISO, hora) => {
    const escalasNaCelula = encontrarEscalaNaCelula(dataISO, hora);
    console.log('🖱️ Célula clicada:', dataISO, hora, 'Escalas:', escalasNaCelula.length);
    
    if (escalasNaCelula.length > 0) {
      abrirEdicao(escalasNaCelula[0]);
    } else {
      abrirNovo(null, dataISO, hora + ":00");
    }
  };

  return (
    <>
      <header className="main-header">
        <div className="header-content">
          <h1>Escalas - Visual Timeline</h1>
          <p>Clique em qualquer horário para adicionar ou editar escalas</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="toggle-btn" onClick={semanaAnterior}>
            ← Anterior
          </button>
          <button className="toggle-btn" onClick={semanaAtual}>
            Hoje
          </button>
          <button className="toggle-btn" onClick={semanaSeguinte}>
            Seguinte →
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

      {/* Cabeçalho do período */}
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
          alignItems: "center" 
        }}>
          <h2 style={{ margin: 0, color: "var(--fg)" }}>
            {formatMonthYear(dataRef)} - Semana {Math.ceil((dataRef.getDate() + startOfWeek(new Date(dataRef.getFullYear(), dataRef.getMonth(), 1)).getDay()) / 7)}
          </h2>
          <div style={{ display: "flex", gap: 8, fontSize: "14px", color: "var(--muted)" }}>
            <span>De: {formatDateBR(dias[0])}</span>
            <span>À: {formatDateBR(dias[6])}</span>
          </div>
        </div>
        
        {/* Debug info */}
        <div style={{ 
          marginTop: 8, 
          padding: 8, 
          background: "var(--panel-muted)", 
          borderRadius: 4,
          fontSize: "12px",
          color: "var(--muted)"
        }}>
          📊 {funcionarios.length} funcionários • {escalas.length} escalas carregadas
        </div>
      </div>

      {/* Timeline Visual */}
      <div style={{ 
        background: "var(--panel)", 
        borderRadius: "8px", 
        border: "1px solid var(--border)",
        overflow: "auto",
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
      }}>
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "80px repeat(7, 1fr)",
          minWidth: "1000px"
        }}>
          
          {/* Cabeçalho dos dias */}
          <div style={{ 
            padding: "16px 12px", 
            borderBottom: "2px solid var(--border)",
            background: "var(--panel-muted)"
          }}>
            <div style={{ fontWeight: 600, fontSize: "14px" }}>HORA</div>
          </div>
          {dias.map((dia, index) => (
            <div key={index} style={{ 
              padding: "16px 12px", 
              borderBottom: "2px solid var(--border)",
              textAlign: "center",
              background: "var(--panel-muted)"
            }}>
              <div style={{ fontWeight: 600, fontSize: "14px" }}>{DIAS_SEMANA_CURTO[index]}</div>
              <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px" }}>
                {formatDateBR(dia)}
              </div>
            </div>
          ))}
          
          {/* Linhas de horário */}
          {HORARIOS_DIA.map(hora => (
            <div key={hora} style={{ display: "contents" }}>
              {/* Coluna de horas */}
              <div style={{ 
                padding: "12px",
                borderBottom: "1px solid var(--border)",
                fontSize: "12px",
                color: "var(--muted)",
                background: "var(--panel-muted)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}>
                {hora}
              </div>
              
              {/* Células dos dias */}
              {dias.map((dia, diaIndex) => {
                const dataISO = toISO(dia);
                const escalasNaCelula = encontrarEscalaNaCelula(dataISO, hora.split(':')[0]);
                const isToday = toISO(new Date()) === dataISO;
                
                return (
                  <div
                    key={diaIndex}
                    style={{
                      padding: "4px",
                      borderBottom: "1px solid var(--border)",
                      borderRight: diaIndex === 6 ? "1px solid var(--border)" : "none",
                      background: isToday ? "rgba(59, 130, 246, 0.05)" : "transparent",
                      minHeight: "50px",
                      position: "relative",
                      cursor: "pointer",
                      transition: "background-color 0.2s"
                    }}
                    onClick={() => handleCliqueCelula(dataISO, hora.split(':')[0])}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "rgba(59, 130, 246, 0.1)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = isToday ? "rgba(59, 130, 246, 0.05)" : "transparent";
                    }}
                  >
                    {escalasNaCelula.map((escala, idx) => (
                      <div
                        key={`${escala.id}-${idx}`}
                        style={{
                          background: escala.cor,
                          color: "white",
                          padding: "6px 8px",
                          borderRadius: "6px",
                          fontSize: "11px",
                          marginBottom: "2px",
                          cursor: "pointer",
                          boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                          fontWeight: 500
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          abrirEdicao(escala);
                        }}
                        title={`${escala.funcionario_nome} - ${escala.entrada} às ${escala.saida} (Turno ${escala.turno_ordem})`}
                      >
                        <div style={{ 
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap"
                        }}>
                          {escala.funcionario_nome}
                        </div>
                        <div style={{ 
                          fontSize: "9px",
                          opacity: 0.9,
                          marginTop: "2px"
                        }}>
                          {escala.entrada} - {escala.saida}
                        </div>
                      </div>
                    ))}
                    
                    {/* Marcador de horário livre */}
                    {escalasNaCelula.length === 0 && (
                      <div style={{ 
                        fontSize: "20px", 
                        color: "var(--muted)",
                        textAlign: "center",
                        padding: "12px 0",
                        opacity: 0.3
                      }}>
                        +
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legenda de funcionários */}
      {funcionarios.length > 0 && (
        <div style={{ 
          display: "flex", 
          gap: "16px", 
          marginTop: "20px",
          flexWrap: "wrap",
          padding: "16px",
          background: "var(--panel)",
          borderRadius: "8px",
          border: "1px solid var(--border)"
        }}>
          <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--muted)" }}>
            Legenda:
          </div>
          {funcionarios.map(func => (
            <div key={func.id} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{
                width: "16px",
                height: "16px",
                background: getCorFuncionario(func.id),
                borderRadius: "4px",
                border: "1px solid var(--border)"
              }}></div>
              <span style={{ fontSize: "14px" }}>{func.pessoa_nome}</span>
            </div>
          ))}
        </div>
      )}

      {/* Modal Escala */}
      <Modal
        open={modalAberto}
        onClose={() => setModalAberto(false)}
        title={editando ? "Editar Escala" : "Nova Escala"}
        footer={
          <>
            <button className="toggle-btn" onClick={() => setModalAberto(false)}>
              Cancelar
            </button>
            {editando && (
              <button 
                className="toggle-btn" 
                style={{ background: "var(--error)", color: "white" }}
                onClick={() => excluirEscala(editando)}
              >
                Excluir
              </button>
            )}
            <button className="toggle-btn" onClick={salvarEscala}>
              {editando ? "Salvar" : "Adicionar"}
            </button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ display: "block", marginBottom: "6px", fontSize: "14px", fontWeight: 500 }}>
              Funcionário *
            </label>
            <select
              value={form.funcionario_id}
              onChange={(e) => setForm({ ...form, funcionario_id: e.target.value })}
              style={{ 
                width: "100%", 
                padding: "10px 12px", 
                borderRadius: "6px", 
                border: "1px solid var(--border)",
                fontSize: "14px"
              }}
              required
            >
              <option value="">Selecione um funcionário...</option>
              {funcionarios.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.pessoa_nome} - {f.cargo_nome}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "6px", fontSize: "14px", fontWeight: 500 }}>
              Data *
            </label>
            <input
              type="date"
              value={form.data}
              onChange={(e) => setForm({ ...form, data: e.target.value })}
              style={{ 
                width: "100%", 
                padding: "10px 12px", 
                borderRadius: "6px", 
                border: "1px solid var(--border)",
                fontSize: "14px"
              }}
              required
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", marginBottom: "6px", fontSize: "14px", fontWeight: 500 }}>
                Entrada
              </label>
              <input
                type="time"
                value={form.entrada}
                onChange={(e) => setForm({ ...form, entrada: e.target.value })}
                style={{ 
                  width: "100%", 
                  padding: "10px 12px", 
                  borderRadius: "6px", 
                  border: "1px solid var(--border)",
                  fontSize: "14px"
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "6px", fontSize: "14px", fontWeight: 500 }}>
                Saída
              </label>
              <input
                type="time"
                value={form.saida}
                onChange={(e) => setForm({ ...form, saida: e.target.value })}
                style={{ 
                  width: "100%", 
                  padding: "10px 12px", 
                  borderRadius: "6px", 
                  border: "1px solid var(--border)",
                  fontSize: "14px"
                }}
              />
            </div>
          </div>

          {form.entrada && form.saida && (
            <div style={{ 
              padding: "12px", 
              background: "var(--panel-muted)", 
              borderRadius: "6px",
              fontSize: "14px",
              textAlign: "center",
              border: "1px solid var(--border)"
            }}>
              Duração total: <strong>{calcularDuracao(form.entrada, form.saida)} horas</strong>
            </div>
          )}

          <div>
            <label style={{ display: "block", marginBottom: "6px", fontSize: "14px", fontWeight: 500 }}>
              Turno (ordem)
            </label>
            <input
              type="number"
              min="1"
              value={form.turno_ordem}
              onChange={(e) => setForm({ ...form, turno_ordem: parseInt(e.target.value) || 1 })}
              style={{ 
                width: "100%", 
                padding: "10px 12px", 
                borderRadius: "6px", 
                border: "1px solid var(--border)",
                fontSize: "14px"
              }}
            />
          </div>
        </div>
      </Modal>
    </>
  );
}
