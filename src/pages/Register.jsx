import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";

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

  async function consultaCNPJ() {
    setErr("");
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
        setEmpresaByApi(false);
        setErr(data?.error || "Não foi possível consultar o CNPJ. Preencha manualmente.");
        // libera preenchimento manual mantendo CNPJ digitado
        setEmpresa((e) => ({ ...e, cnpj: num }));
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
        data_situacao: emp.data_situacao || "",
        socios_receita: JSON.stringify(emp.socios_receita ?? emp.qsa ?? []),
      });
      setEmpresaByApi(true);
    } catch (e) {
      setEmpresaByApi(false);
      setErr("Falha na consulta. Preencha os dados da empresa manualmente.");
      setEmpresa((prev) => ({ ...prev, cnpj: num }));
    } finally {
      setLoading(false);
    }
  }

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
        perfil: "administrador", // backend deve usar isso para gerar vínculos nas tabelas
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
      // sucesso → ir para dashboard_adm
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
          empresa,              // deve conter ao menos CNPJ + Razão Social
          pessoa,               // opcional: backend pode registrar pessoa se quiser
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

  return (
    <div className="split">
      <section className="left">
        <div className="brand">Projeto Integrador</div>
        <h1 className="title">Cadastro de Acesso</h1>

        {err && (
          <div className="error-alert" role="alert" style={{ marginBottom: 16 }}>
            {err}
          </div>
        )}

        {/* ===== Etapas ===== */}
        {step === 1 && (
          <div className="form" aria-labelledby="etapa-empresa">
            <h2 id="etapa-empresa" className="title" style={{ marginBottom: 8 }}>1) Empresa</h2>

            {/* Busca por CNPJ */}
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
              <button type="button" className="toggle-btn" onClick={consultaCNPJ} disabled={loading}>
                {loading ? "Consultando..." : "Consultar"}
              </button>
            </div>

            {/* Form da empresa (preenchido pela API ou manual) */}
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

            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button type="button" className="toggle-btn" onClick={nextFromStep1}>
                Continuar
              </button>
              <Link className="links" to="/login" style={{ alignSelf: "center" }}>
                Já tenho conta
              </Link>
            </div>

            {!empresaByApi && (
              <small style={{ color: "var(--muted)" }}>
                * Se a consulta não retornar, preencha os dados manualmente.
              </small>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="form" aria-labelledby="etapa-pessoa">
            <h2 id="etapa-pessoa" className="title" style={{ marginBottom: 8 }}>2) Seus dados</h2>

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

            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button type="button" className="toggle-btn" onClick={() => setStep(1)}>
                Voltar
              </button>
              <button type="button" className="toggle-btn" onClick={nextFromStep2}>
                Continuar
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="form" aria-labelledby="etapa-usuario">
            <h2 id="etapa-usuario" className="title" style={{ marginBottom: 8 }}>3) Usuário / Acesso</h2>

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

                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
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

                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
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

        <div className="foot">Suporte • Acessibilidade • Termos</div>
      </section>

      <section className="right" aria-hidden="true">
        <div className="overlay">
          <h3>
            Sua escola, <span>organizada e acessível</span>
          </h3>
        </div>
      </section>
    </div>
  );
}
