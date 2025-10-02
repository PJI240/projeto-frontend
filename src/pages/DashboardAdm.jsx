// src/pages/DashboardAdm.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE?.replace(/\/+$/, "") || "";

/* ====== Utils ====== */
function toISO(d) {
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function hhmmToMinutes(hhmm) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function formatTimeFromMinutes(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function getCurrentTimeMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

/* ====== Cores por status ====== */
const STATUS_COLORS = {
  PRESENTE: { bg: "bg-green-100", text: "text-green-800", border: "border-green-300" },
  ATRASADO: { bg: "bg-yellow-100", text: "text-yellow-800", border: "border-yellow-300" },
  AUSENTE: { bg: "bg-red-100", text: "text-red-800", border: "border-red-300" },
  FORA_ESCALA: { bg: "bg-gray-100", text: "text-gray-600", border: "border-gray-300" },
  EM_ANDAMENTO: { bg: "bg-blue-100", text: "text-blue-800", border: "border-blue-300" }
};

/* ====== Componentes de Card ====== */
function FuncionarioCard({ funcionario, status, escala, apontamento, isNow = false }) {
  const getStatusInfo = () => {
    switch (status) {
      case 'PRESENTE':
        return { texto: '✅ Presente', cor: STATUS_COLORS.PRESENTE };
      case 'ATRASADO':
        const atrasoMin = apontamento?.entradaMin - escala?.entradaMin;
        return { 
          texto: `⏰ Atrasado (+${atrasoMin}min)`, 
          cor: STATUS_COLORS.ATRASADO 
        };
      case 'AUSENTE':
        return { texto: '❌ Ausente', cor: STATUS_COLORS.AUSENTE };
      case 'FORA_ESCALA':
        return { texto: '📊 Fora da escala', cor: STATUS_COLORS.FORA_ESCALA };
      case 'EM_ANDAMENTO':
        return { texto: '⏳ Em andamento', cor: STATUS_COLORS.EM_ANDAMENTO };
      default:
        return { texto: '⚪ Sem info', cor: STATUS_COLORS.FORA_ESCALA };
    }
  };

  const statusInfo = getStatusInfo();
  
  return (
    <div className={`
      relative p-4 rounded-lg border-2 transition-all duration-200 hover:shadow-md
      ${statusInfo.cor.bg} ${statusInfo.cor.border} ${isNow ? 'ring-2 ring-blue-400 ring-opacity-50' : ''}
    `}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate text-sm">
            {funcionario.nome}
          </h3>
          <p className="text-xs text-gray-600 truncate">
            {funcionario.cargo}
          </p>
        </div>
        <div className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo.cor.text} ${statusInfo.cor.bg}`}>
          {statusInfo.texto}
        </div>
      </div>

      {/* Timeline Info */}
      <div className="space-y-2 text-xs">
        {escala && (
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Escala:</span>
            <span className="font-medium">
              {escala.entrada && formatTimeFromMinutes(escala.entrada)} - {escala.saida && formatTimeFromMinutes(escala.saida)}
            </span>
          </div>
        )}
        
        {apontamento && (
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Real:</span>
            <span className="font-medium">
              {apontamento.entradaMin && formatTimeFromMinutes(apontamento.entradaMin)} - 
              {apontamento.saidaMin ? formatTimeFromMinutes(apontamento.saidaMin) : ' (andamento)'}
            </span>
          </div>
        )}

        {apontamento?.duracao && (
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Duração:</span>
            <span className="font-medium">
              {Math.floor(apontamento.duracao / 60)}h{String(apontamento.duracao % 60).padStart(2, '0')}min
            </span>
          </div>
        )}
      </div>

      {/* Indicador de tempo atual */}
      {isNow && (
        <div className="absolute -top-2 -right-2">
          <div className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full font-medium animate-pulse">
            AGORA
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBoard({ funcionarios, escalasHoje, apontamentosHoje, currentTime }) {
  // Calcular status para cada funcionário
  const funcionariosComStatus = useMemo(() => {
    return funcionarios.map(func => {
      // Encontrar escala do funcionário para hoje
      const escalaHoje = escalasHoje.find(e => e.funcionario_id === func.id);
      
      // Encontrar apontamento consolidado
      const apontamentosFunc = apontamentosHoje.filter(a => 
        a.funcionario_id === func.id || a.funcionarioId === func.id
      );
      
      const apontamentoConsolidado = consolidateApontamentos(apontamentosFunc, toISO(new Date()));
      
      let status = 'FORA_ESCALA';
      let isWorkingNow = false;

      if (escalaHoje) {
        const entradaEscala = hhmmToMinutes(escalaHoje.entrada);
        const saidaEscala = hhmmToMinutes(escalaHoje.saida);
        
        // Verificar se deveria estar trabalhando agora
        if (entradaEscala && saidaEscala) {
          isWorkingNow = currentTime >= entradaEscala && currentTime <= saidaEscala;
        }

        if (apontamentoConsolidado?.entradaMin) {
          // Tem apontamento
          if (entradaEscala) {
            const diferenca = apontamentoConsolidado.entradaMin - entradaEscala;
            status = diferenca > 5 ? 'ATRASADO' : 'PRESENTE';
          } else {
            status = 'PRESENTE';
          }
          
          // Se ainda não bateu ponto de saída, está em andamento
          if (!apontamentoConsolidado.saidaMin) {
            status = 'EM_ANDAMENTO';
          }
        } else {
          // Sem apontamento, mas deveria estar trabalhando
          status = isWorkingNow ? 'AUSENTE' : 'FORA_ESCALA';
        }
      } else if (apontamentoConsolidado?.entradaMin) {
        // Trabalhando sem escala
        status = 'PRESENTE';
        if (!apontamentoConsolidado.saidaMin) {
          status = 'EM_ANDAMENTO';
        }
      }

      return {
        ...func,
        status,
        escala: escalaHoje ? {
          entrada: hhmmToMinutes(escalaHoje.entrada),
          saida: hhmmToMinutes(escalaHoje.saida)
        } : null,
        apontamento: apontamentoConsolidado ? {
          entradaMin: apontamentoConsolidado.entradaMin,
          saidaMin: apontamentoConsolidado.saidaMin,
          duracao: apontamentoConsolidado.saidaMin ? 
            apontamentoConsolidado.saidaMin - apontamentoConsolidado.entradaMin : 
            currentTime - apontamentoConsolidado.entradaMin
        } : null,
        isWorkingNow
      };
    });
  }, [funcionarios, escalasHoje, apontamentosHoje, currentTime]);

  // Agrupar por status
  const grupos = useMemo(() => {
    const grupos = {
      TRABALHANDO_AGORA: [],
      AUSENTES: [],
      FORA_ESCALA: [],
      EM_ANDAMENTO: []
    };

    funcionariosComStatus.forEach(func => {
      if (func.isWorkingNow) {
        if (func.status === 'PRESENTE' || func.status === 'EM_ANDAMENTO' || func.status === 'ATRASADO') {
          grupos.TRABALHANDO_AGORA.push(func);
        } else if (func.status === 'AUSENTE') {
          grupos.AUSENTES.push(func);
        }
      } else if (func.status === 'EM_ANDAMENTO') {
        grupos.EM_ANDAMENTO.push(func);
      } else {
        grupos.FORA_ESCALA.push(func);
      }
    });

    return grupos;
  }, [funcionariosComStatus]);

  return (
    <div className="space-y-6">
      {/* Trabalhando Agora */}
      {grupos.TRABALHANDO_AGORA.length > 0 && (
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
            <div className="w-3 h-3 bg-green-500 rounded-full mr-2 animate-pulse"></div>
            Trabalhando Agora ({grupos.TRABALHANDO_AGORA.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {grupos.TRABALHANDO_AGORA.map(func => (
              <FuncionarioCard 
                key={func.id} 
                funcionario={func}
                status={func.status}
                escala={func.escala}
                apontamento={func.apontamento}
                isNow={true}
              />
            ))}
          </div>
        </section>
      )}

      {/* Ausentes da Escala Atual */}
      {grupos.AUSENTES.length > 0 && (
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-4">Ausentes da Escala Atual ({grupos.AUSENTES.length})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {grupos.AUSENTES.map(func => (
              <FuncionarioCard 
                key={func.id} 
                funcionario={func}
                status={func.status}
                escala={func.escala}
                apontamento={func.apontamento}
              />
            ))}
          </div>
        </section>
      )}

      {/* Turnos em Andamento (fora do horário atual) */}
      {grupos.EM_ANDAMENTO.length > 0 && (
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-4">Turnos em Andamento ({grupos.EM_ANDAMENTO.length})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {grupos.EM_ANDAMENTO.map(func => (
              <FuncionarioCard 
                key={func.id} 
                funcionario={func}
                status={func.status}
                escala={func.escala}
                apontamento={func.apontamento}
              />
            ))}
          </div>
        </section>
      )}

      {/* Fora da Escala */}
      {grupos.FORA_ESCALA.length > 0 && (
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-4">Fora da Escala ({grupos.FORA_ESCALA.length})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {grupos.FORA_ESCALA.map(func => (
              <FuncionarioCard 
                key={func.id} 
                funcionario={func}
                status={func.status}
                escala={func.escala}
                apontamento={func.apontamento}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* ====== Dashboard Principal ====== */
export default function DashboardAdm() {
  const [funcionarios, setFuncionarios] = useState([]);
  const [escalas, setEscalas] = useState([]);
  const [apontamentos, setApontamentos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [currentTime, setCurrentTime] = useState(getCurrentTimeMinutes());
  const [autoRefresh, setAutoRefresh] = useState(true);

  const api = useCallback(async (path, init = {}) => {
    const url = `${API_BASE}${path}`;
    const r = await fetch(url, { credentials: "include", ...init });
    let data = null;
    try { data = await r.json(); } catch { /* no-op */ }
    if (!r.ok || data?.ok === false) throw new Error(data?.error || `HTTP ${r.status}`);
    return data;
  }, []);

  // Atualizar tempo atual a cada minuto
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(getCurrentTimeMinutes());
    }, 60000);
    
    return () => clearInterval(interval);
  }, []);

  const carregarDados = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const hoje = toISO(new Date());
      const [f, e, a] = await Promise.all([
        api(`/api/funcionarios?ativos=1`),
        api(`/api/escalas?from=${hoje}&to=${hoje}`),
        api(`/api/apontamentos?from=${hoje}&to=${hoje}`),
      ]);
      setFuncionarios(f.funcionarios || []);
      setEscalas(e.escalas || []);
      setApontamentos(a.apontamentos || a || []);
    } catch (e) {
      setError(e.message || "Falha ao carregar dados.");
    } finally {
      setLoading(false);
    }
  }, [api]);

  // Auto-refresh
  useEffect(() => {
    carregarDados();
    if (autoRefresh) {
      const interval = setInterval(carregarDados, 30000); // 30 segundos
      return () => clearInterval(interval);
    }
  }, [carregarDados, autoRefresh]);

  // Estatísticas rápidas
  const stats = useMemo(() => {
    const totalFuncionarios = funcionarios.length;
    const escaladosHoje = escalas.length;
    const presentes = apontamentos.filter(a => 
      a.entrada && !a.saida
    ).length;
    
    return { totalFuncionarios, escaladosHoje, presentes };
  }, [funcionarios, escalas, apontamentos]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard em Tempo Real</h1>
            <p className="text-gray-600 mt-1">
              Status atual dos funcionários • {formatTimeFromMinutes(currentTime)}
            </p>
          </div>
          
          <div className="flex flex-wrap gap-3">
            <button 
              onClick={carregarDados}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "Atualizando..." : "Atualizar"}
            </button>
            
            <label className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm text-gray-700">Auto-refresh</span>
            </label>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="text-2xl font-bold text-gray-900">{stats.totalFuncionarios}</div>
            <div className="text-gray-600 text-sm">Total de Funcionários</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="text-2xl font-bold text-gray-900">{stats.escaladosHoje}</div>
            <div className="text-gray-600 text-sm">Escalados para Hoje</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="text-2xl font-bold text-gray-900">{stats.presentes}</div>
            <div className="text-gray-600 text-sm">Presentes no Momento</div>
          </div>
        </div>

        {/* Status Board */}
        <StatusBoard 
          funcionarios={funcionarios}
          escalasHoje={escalas}
          apontamentosHoje={apontamentos}
          currentTime={currentTime}
        />
      </div>
    </div>
  );
}

// Função auxiliar para consolidar apontamentos (mantida do seu código)
function consolidateApontamentos(items, dataISO) {
  if (!items?.length) return null;
  const pri = { AJUSTE: 3, IMPORTADO: 2, APONTADO: 1 };
  let bestEntrada = null, bestEntradaOrigem = null;
  let bestSaida = null, bestSaidaOrigem = null;

  for (const it of items) {
    const ent = it.entrada ? hhmmToMinutes(it.entrada) : null;
    const sai = it.saida ? hhmmToMinutes(it.saida) : null;

    if (ent != null) {
      if (bestEntrada == null || ent < bestEntrada ||
          (ent === bestEntrada && (pri[it.origem] || 0) > (pri[bestEntradaOrigem] || 0))) {
        bestEntrada = ent; bestEntradaOrigem = it.origem;
      }
    }
    if (sai != null) {
      if (bestSaida == null || sai > bestSaida ||
          (sai === bestSaida && (pri[it.origem] || 0) > (pri[bestSaidaOrigem] || 0))) {
        bestSaida = sai; bestSaidaOrigem = it.origem;
      }
    }
  }

  return {
    entradaMin: bestEntrada,
    saidaMin: bestSaida,
    origem: (pri[bestEntradaOrigem] || 0) >= (pri[bestSaidaOrigem] || 0) ? bestEntradaOrigem : bestSaidaOrigem,
  };
}
