import { useEffect, useState } from "react";

// Lê a base da API do .env da Vite
const API = import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, "") || "";

export default function Dashboard() {
  const [data, setData] = useState({ usuarios: 0, pessoas: 0, empresas: 0 });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setErr("");
        const resp = await fetch(`${API}/api/dashboard/resumo`, {
          credentials: "include",
        });
        if (!resp.ok) throw new Error("Falha na API de resumo");
        const json = await resp.json();
        if (!json.ok) throw new Error(json.error || "Erro desconhecido");
        setData(json.counts || { usuarios: 0, pessoas: 0, empresas: 0 });
      } catch (e) {
        setErr(e.message || "Erro ao carregar");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <main className="p-4 sm:p-6 lg:p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Dashboard
        </h1>
        <p className="text-sm text-gray-600">
          Visão geral temporária do sistema (totais básicos).
        </p>
      </header>

      {err && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-red-700"
        >
          {err}
        </div>
      )}

      <section
        aria-label="Indicadores principais"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        <CardStat
          title="Usuários ativos"
          value={loading ? "…" : data.usuarios}
          subtitle="Tabela: usuarios.ativo = TRUE"
        />
        <CardStat
          title="Pessoas"
          value={loading ? "…" : data.pessoas}
          subtitle="Tabela: pessoas"
        />
        <CardStat
          title="Empresas ativas"
          value={loading ? "…" : data.empresas}
          subtitle="Tabela: empresas.ativa = TRUE"
        />
      </section>

      <section className="mt-8">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="text-base font-semibold text-gray-900">
            Próximos passos
          </h2>
          <ul className="mt-2 list-disc pl-5 text-sm text-gray-700">
            <li>Adicionar cards para “Funcionários”, “Escalas” e “Apontamentos”.</li>
            <li>Filtrar por empresa do usuário logado (multi-empresa).</li>
            <li>Gráfico simples de evolução semanal de apontamentos (futuro).</li>
          </ul>
        </div>
      </section>
    </main>
  );
}

function CardStat({ title, value, subtitle }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="text-sm font-medium text-gray-600">{title}</div>
      <div className="mt-1 text-3xl font-bold tabular-nums text-gray-900">
        {value}
      </div>
      <div className="mt-1 text-xs text-gray-500">{subtitle}</div>
    </div>
  );
}
