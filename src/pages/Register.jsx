import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import AccessibilityToggles from "../components/AccessibilityToggles";

const API_BASE = import.meta.env.VITE_API_BASE?.replace(/\/+$/, "") || "";

const initialEmpresa = {
  razao_social: "",
  nome_fantasia: "",
  cnpj: "",
  inscricao_estadual: "",
  data_abertura: "",
  telefone: "",
  email: "",
  capital_social: "",
  natureza_juridica: "",
  situacao_cadastral: "",
  data_situacao: "",
  socios_receita: "[]",
};

const initialPessoa = {
  nome: "",
  cpf: "",
  data_nascimento: "",
  telefone: "",
  email: "",
};

const initialUsuario = {
  nome: "",
  email: "",
  senha: "",
  ativo: 1,
};

export default function Register() {
  const [step, setStep] = useState(1);

  // Etapa 1
  const [cnpjInput, setCnpjInput] = useState("");
  const [empresa, setEmpresa] = useState(initialEmpresa);
  const [empresaByApi, setEmpresaByApi] = useState(false);
  const [empresaFormVisivel, setEmpresaFormVisivel] = useState(false); // controla exibição dos campos após consulta

  // Etapa 2
  const [pessoa, setPessoa] = useState(initialPessoa);

  // Etapa 3
  const [hasAccount, setHasAccount] = useState(false);
  const [usuario, setUsuario] = useState(initialUsuario);
  const [login, setLogin] = useState({ email: "", senha: "" });

  // UI
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const navigate = useNavigate();

  const onlyDigits = (s) => (s || "").replace(/\D+/g, "");

  // ===== Progress helpers =====
  const steps = [
    { id: 1, title: "Empresa" },
    { id: 2, title: "Responsável" },
    { id: 3, title: "Usuário" },
  ];
  const progressPct = (step / steps.length) * 100;

  // ===== API: Consulta CNPJ =====
  async function consultaCNPJ() {
    setErr("");
    setEmpresaFormVisivel(false);
    const num = onlyDigits(cnpjInput);
    if (num.length !== 14) {
      setErr("Informe um CNPJ válido (14 dígitos).");
      return;
    }
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/empresas/consulta-cnpj`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ cnpj: num }),
      });
      const data = await r.json().catch(() => null);

      if (!r.ok || !data?.ok) {
        // falha: libera formulário em branco (com CNPJ já preenchido)
        setEmpresaByApi(false);
        setErr(data?.error || "Não foi possível consultar o CNPJ. Preencha manualmente.");
        setEmpresa({
          ...initialEmpresa,
          cnpj: num,
        });
        setEmpresaFormVisivel(true);
        return;
      }

      const emp = data.empresa || {};
      setEmpresa({
        razao_social: emp.razao_social || "",
        nome_fantasia: emp.nome_fantasia || "",
        cnpj: onlyDigits(emp.cnpj || num),
        inscricao_estadual: emp.inscricao_estadual || "",
        data_abertura: emp.data_abertura || "",
        telefone: emp.telefone || "",
        email: emp.email || "",
        capital_social: emp.capital_social ?? "",
        natureza_juridica: emp.natureza_juridica || "",
        situacao_cadastral: emp.situacao_cadastral || emp.situicao || "",
        data_situacao: emp.data_situicao || "",
        socios_receita: JSON.stringify(emp.socios_receita ?? emp.qsa ?? []),
      });
      setEmpresaByApi(true);
      setEmpresaFormVisivel(true);
    } catch (e) {
      setEmpresaByApi(false);
      setErr("Falha na consulta. Preencha os dados da empresa manualmente.");
      setEmpresa({
        ...initialEmpresa,
        cnpj: num,
      });
      setEmpresaFormVisivel(true);
    } finally {
      setLoading(false);
    }
  }

  // ===== Navegação entre etapas =====
  function canGoStep2() {
    const num = onlyDigits(empresa.cnpj);
    if (num.length !== 14) return false;
    if (!empresa.razao_social?.trim()) return false;
    return true;
  }

  function nextFromStep1() {
    setErr("");
    if (!canGoStep2()) {
      setErr("Preencha CNPJ (14 dígitos) e Razão Social para continuar.");
      return;
    }
    setStep(2);
  }

  function canGoStep3() {
    if (!pessoa.nome?.trim()) return false;
    if (onlyDigits(pessoa.cpf).length !== 11) return false;
    return true;
  }

  function nextFromStep2() {
    setErr("");
    if (!canGoStep3()) {
      setErr("Preencha ao menos Nome e CPF (11 dígitos).");
      return;
    }
    // Pré-preencher usuário com dados da pessoa
    setUsuario((u) => ({
      ...u,
      nome: pessoa.nome,
      email: pessoa.email || u.email,
    }));
    setStep(3);
  }

  // ===== Submits =====
  async function submitNovoUsuario() {
    setErr("");
    if (!usuario.email?.trim() || !usuario.senha?.trim()) {
      setErr("Informe e-mail e senha para criar o usuário.");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        empresa,
        pessoa,
        usuario: { ...usuario, ativo: 1 },
        perfil: "administrador",
      };
      const r = await fetch(`${API_BASE}/api/registro/completo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await r.json().catch(() => null);
      if (!r.ok || !data?.ok) {
        throw new Error(data?.error || "Falha ao concluir registro.");
      }
      navigate("/dashboard_adm");
    } catch (e) {
      setErr(e.message || "Erro ao concluir registro.");
    } finally {
      setLoading(false);
    }
  }

  async function submitJaTenhoCadastro() {
    setErr("");
    if (!login.email?.trim() || !login.senha?.trim()) {
      setErr("Informe e-mail e senha para entrar.");
      return;
    }
    setLoading(true);
    try {
      // 1) login
      let r = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: login.email, senha: login.senha }),
      });
      let data = await r.json().catch(() => null);
      if (!r.ok || !data?.ok) throw new Error(data?.error || "Login falhou.");

      // 2) vincular empresa ao usuário como ADMIN
      r = await fetch(`${API_BASE}/api/registro/vincular-admin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          empresa,
          pessoa, // opcional
          perfil: "administrador",
        }),
      });
      data = await r.json().catch(() => null);
      if (!r.ok || !data?.ok) throw new Error(data?.error || "Falha ao vincular empresa ao usuário.");

      navigate("/dashboard_adm");
    } catch (e) {
      setErr(e.message || "Erro no vínculo com a empresa.");
    } finally {
      setLoading(false);
    }
  }

  /* ===================== UI ===================== */
  return (
    <div className="container" style={{ paddingTop: 16, paddingBottom: 24 }}>
      {/* Toggles de acessibilidade sempre no topo esquerdo */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <AccessibilityToggles />
      </div>
      <h1 className="title" style={{ marginTop: 8, marginBottom: 8 }}>
        Cadastro guiado em 3 passos
      </h1>
      <p style={{ color: "var(--muted)", marginTop: 0, marginBottom: 16 }}>
        Vamos começar pelo CNPJ da sua empresa.
      </p>

      {/* Barra de progresso (acessível) */}
      <div aria-label="Progresso do cadastro" style={{ marginBottom: 16 }}>
        <div
          style={{
            height: 10,
            background: "var(--border)",
            borderRadius: 999,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${progressPct}%`,
              height: "100%",
              background: "var(--accent)",
              transition: "width .2s ease",
            }}
          />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--fs-12)", color: "var(--muted)", marginTop: 6 }}>
          {steps.map((s) => (
            <span key={s.id} aria-current={step === s.id ? "step" : undefined}>
              {s.id}) {s.title}
            </span>
          ))}
        </div>
      </div>

      {err && (
        <div className="error-alert" role="alert" style={{ marginBottom: 16 }}>
          {err}
        </div>
      )}

      {/* ===== Etapa 1 ===== */}

{step === 1 && (
  <div className="form" aria-labelledby="etapa-empresa">
    <h2 id="etapa-empresa" className="title" style={{ marginBottom: 8 }}>
      Cadastro da empresa
    </h2>
    <p style={{ color: "var(--muted)", marginTop: 0 }}>
      Busque pelo seu <strong>CNPJ</strong> para preencher automaticamente os dados da empresa.
    </p>

    {/* Campo único de busca (visível inicialmente) */}
    <label htmlFor="cnpj">CNPJ</label>
    <div style={{ display: "flex", gap: 8 }}>
      <input
        id="cnpj"
        inputMode="numeric"
        autoComplete="off"
        placeholder="00.000.000/0000-00"
        value={cnpjInput}
        onChange={(e) => setCnpjInput(e.target.value)}
      />
      <button
        type="button"
        className="toggle-btn"
        onClick={consultaCNPJ}
        disabled={loading}
      >
        {loading ? "Consultando..." : "Buscar"}
      </button>
    </div>

    {/* Form da empresa — só aparece após a consulta */}
    {empresaFormVisivel && (
      <>
        <div style={{ height: 8 }} />
        <label htmlFor="razao_social">Razão social</label>
        <input
          id="razao_social"
          value={empresa.razao_social}
          onChange={(e) => setEmpresa({ ...empresa, razao_social: e.target.value })}
        />

        <label htmlFor="nome_fantasia">Nome fantasia</label>
        <input
          id="nome_fantasia"
          value={empresa.nome_fantasia}
          onChange={(e) => setEmpresa({ ...empresa, nome_fantasia: e.target.value })}
        />

        <label htmlFor="cnpj_conf">CNPJ (confirmação)</label>
        <input
          id="cnpj_conf"
          value={empresa.cnpj}
          onChange={(e) => setEmpresa({ ...empresa, cnpj: e.target.value })}
        />

        <label htmlFor="telefone">Telefone</label>
        <input
          id="telefone"
          value={empresa.telefone}
          onChange={(e) => setEmpresa({ ...empresa, telefone: e.target.value })}
        />

        <label htmlFor="email_emp">Email</label>
        <input
          id="email_emp"
          type="email"
          value={empresa.email}
          onChange={(e) => setEmpresa({ ...empresa, email: e.target.value })}
        />

        <small style={{ color: "var(--muted)" }}>
          {empresaByApi
            ? "Os campos foram preenchidos automaticamente. Revise antes de continuar."
            : "A busca não retornou dados. Preencha os campos manualmente para prosseguir."}
        </small>
      </>
    )}

    {/* Ações — SEMPRE visíveis. 
        “Continuar” fica desabilitado até existir formulário e validar. */}
    {(() => {
      const canContinueStep1 = empresaFormVisivel && canGoStep2();
      return (
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
         
          <button
            type="button"
            className="toggle-btn"
            onClick={() => navigate("/login")}
            style={{ background: "var(--error)", color: "#fff" }}
          >
            Cancelar
          </button>
 <button
            type="button"
            className="toggle-btn"
            onClick={nextFromStep1}
            disabled={!canContinueStep1}
            aria-disabled={!canContinueStep1}
            title={!canContinueStep1 ? "Consulte o CNPJ e preencha os campos obrigatórios" : undefined}
          >
            Continuar
          </button>

               </div>
      );
    })()}
  </div>
)}

      {/* ===== Etapa 2 ===== */}
      {step === 2 && (
        <div className="form" aria-labelledby="etapa-pessoa">
          <h2 id="etapa-pessoa" className="title" style={{ marginBottom: 8 }}>
            2) Cadastro do responsável pela empresa
          </h2>
          <p style={{ color: "var(--muted)", marginTop: 0 }}>
            Informe seus <strong>dados pessoais</strong>. Eles serão vinculados como responsável da empresa.
          </p>

          <label htmlFor="p_nome">Nome completo</label>
          <input
            id="p_nome"
            value={pessoa.nome}
            onChange={(e) => setPessoa({ ...pessoa, nome: e.target.value })}
          />

          <label htmlFor="p_cpf">CPF</label>
          <input
            id="p_cpf"
            inputMode="numeric"
            value={pessoa.cpf}
            onChange={(e) => setPessoa({ ...pessoa, cpf: e.target.value })}
          />

          <label htmlFor="p_nasc">Data de nascimento</label>
          <input
            id="p_nasc"
            type="date"
            value={pessoa.data_nascimento}
            onChange={(e) => setPessoa({ ...pessoa, data_nascimento: e.target.value })}
          />

          <label htmlFor="p_tel">Telefone</label>
          <input
            id="p_tel"
            value={pessoa.telefone}
            onChange={(e) => setPessoa({ ...pessoa, telefone: e.target.value })}
          />

          <label htmlFor="p_email">Email</label>
          <input
            id="p_email"
            type="email"
            value={pessoa.email}
            onChange={(e) => setPessoa({ ...pessoa, email: e.target.value })}
          />

          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button type="button" className="toggle-btn" onClick={() => setStep(1)}>
              Voltar
            </button>
            <button type="button" className="toggle-btn" onClick={nextFromStep2}>
              Continuar
            </button>
          </div>
        </div>
      )}

      {/* ===== Etapa 3 ===== */}
      {step === 3 && (
        <div className="form" aria-labelledby="etapa-usuario">
          <h2 id="etapa-usuario" className="title" style={{ marginBottom: 8 }}>
            3) Usuário principal (administrador)
          </h2>
          <p style={{ color: "var(--muted)", marginTop: 0 }}>
            Crie o <strong>usuário responsável</strong> por gerenciar a empresa no sistema,
            ou entre com sua conta para <strong>vincular</strong> esta empresa como administrador.
          </p>

          <div className="toggles" role="group" aria-label="Modo de cadastro">
            <button
              type="button"
              className={`toggle-btn ${!hasAccount ? "is-active" : ""}`}
              onClick={() => setHasAccount(false)}
            >
              Criar novo usuário
            </button>
            <button
              type="button"
              className={`toggle-btn ${hasAccount ? "is-active" : ""}`}
              onClick={() => setHasAccount(true)}
            >
              Já tenho cadastro
            </button>
          </div>

          {!hasAccount ? (
            <>
              <label htmlFor="u_nome">Nome</label>
              <input
                id="u_nome"
                value={usuario.nome}
                onChange={(e) => setUsuario({ ...usuario, nome: e.target.value })}
                placeholder="Nome (pré-preenchido com a etapa 2)"
              />

              <label htmlFor="u_email">Email</label>
              <input
                id="u_email"
                type="email"
                value={usuario.email}
                onChange={(e) => setUsuario({ ...usuario, email: e.target.value })}
              />

              <label htmlFor="u_senha">Senha</label>
              <input
                id="u_senha"
                type="password"
                value={usuario.senha}
                onChange={(e) => setUsuario({ ...usuario, senha: e.target.value })}
              />

              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button type="button" className="toggle-btn" onClick={() => setStep(2)}>
                  Voltar
                </button>
                <button
                  type="button"
                  className="toggle-btn"
                  onClick={submitNovoUsuario}
                  disabled={loading}
                >
                  {loading ? "Enviando..." : "Concluir cadastro (Administrador)"}
                </button>
              </div>
            </>
          ) : (
            <>
              <label htmlFor="l_email">Email</label>
              <input
                id="l_email"
                type="email"
                value={login.email}
                onChange={(e) => setLogin({ ...login, email: e.target.value })}
              />

              <label htmlFor="l_senha">Senha</label>
              <input
                id="l_senha"
                type="password"
                value={login.senha}
                onChange={(e) => setLogin({ ...login, senha: e.target.value })}
              />

              <small className="register-link">
                Ao entrar, esta empresa será vinculada ao seu usuário com perfil <strong>administrador</strong>.
              </small>

              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button type="button" className="toggle-btn" onClick={() => setStep(2)}>
                  Voltar
                </button>
                <button
                  type="button"
                  className="toggle-btn"
                  onClick={submitJaTenhoCadastro}
                  disabled={loading}
                >
                  {loading ? "Vinculando..." : "Entrar e vincular"}
                </button>
              </div>
            </>
          )}

          <div style={{ marginTop: 16 }}>
            <Link to="/login" className="links">Já tenho cadastro — ir para Login</Link>
          </div>
        </div>
      )}

      <div className="foot" style={{ marginTop: 24 }}>
        Suporte • Acessibilidade • Termos
      </div>
    </div>
  );
}
