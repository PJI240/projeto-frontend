// src/pages/PerfisPermissoes.jsx
// ...imports e estado iguais...

export default function PerfisPermissoes() {
  // ...estado e funções iguais...

  return (
    <>
      {/* região viva */}
      <div ref={liveRef} aria-live="polite" className="visually-hidden" />

      {/* HEADER */}
      <header className="page-header" role="region" aria-labelledby="titulo-pagina">
        <div>
          <h1 id="titulo-pagina" className="page-title">Perfis e Permissões</h1>
          <p className="page-subtitle">Gerencie perfis de acesso e suas permissões no sistema.</p>
        </div>
        <div className="page-header__toolbar" aria-label="Ações da página">
          <button className="btn btn--success" onClick={abrirNovo} aria-label="Criar novo perfil">
            <PlusIcon className="icon" aria-hidden="true" />
            <span>Novo Perfil</span>
          </button>
          <button
            className="btn btn--neutral"
            onClick={sincronizarPermissoes}
            disabled={syncing}
            aria-busy={syncing ? "true" : "false"}
            aria-label="Sincronizar catálogo de permissões"
          >
            {syncing ? <span className="spinner" aria-hidden="true" /> : <ArrowPathIcon className="icon" aria-hidden="true" />}
            <span>{syncing ? "Sincronizando…" : "Sincronizar"}</span>
          </button>
          <button
            className="btn btn--neutral"
            onClick={carregarPerfis}
            disabled={loading}
            aria-busy={loading ? "true" : "false"}
            aria-label="Atualizar lista de perfis"
          >
            {loading ? <span className="spinner" aria-hidden="true" /> : <ArrowPathIcon className="icon" aria-hidden="true" />}
            <span>{loading ? "Atualizando…" : "Atualizar"}</span>
          </button>
        </div>
      </header>

      {err && <div className="error-alert" role="alert">{err}</div>}
      {Boolean(success) && (
        <div className="stat-card" data-accent="success" role="status" style={{ marginBottom: '16px' }}>
          {success}
        </div>
      )}

      {/* ====== DESKTOP / TABLET (>=768px): mantém cards “largos” ====== */}
      <div className="table-only">
        <div className="stats-grid" style={{ gridTemplateColumns: "1fr", gap: '16px' }}>
          {loading ? (
            <div className="stat-card" style={{ textAlign: 'center', padding: '3rem' }}>
              <span className="spinner" aria-hidden="true" /> Carregando…
            </div>
          ) : perfis.length === 0 ? (
            <div className="stat-card" style={{ textAlign: 'center', padding: '3rem' }}>
              Nenhum perfil encontrado.
            </div>
          ) : (
            perfis.map((p) => {
              const isAdmin = String(p.nome || "").trim().toLowerCase() === "administrador";
              const expandido = perfilExpandido === p.id;
              const permissoesPerfil = permissoesPorPerfil.get(p.id) || new Set();
              const carregandoPerms = permissoesCarregando.has(p.id);
              const salvandoPerms = permissoesSalvando.has(p.id);

              return (
                <section key={p.id} className="stat-card" aria-label={`Perfil ${p.nome}`}>
                  <CardPerfil
                    p={p}
                    isAdmin={isAdmin}
                    expandido={expandido}
                    carregandoPerms={carregandoPerms}
                    salvandoPerms={salvandoPerms}
                    permissoesPerfil={permissoesPerfil}
                    gruposPermissoes={gruposPermissoes}
                    onToggleExpand={() => toggleExpansaoPerfil(p.id)}
                    onEditar={() => abrirEdicao(p)}
                    onExcluir={() => excluirPerfil(p)}
                    onMarcarTodas={(v) => marcarTodasPermissoes(p.id, v)}
                    onSalvar={() => salvarPermissoes(p.id)}
                    onTogglePerm={(permId) => togglePermissao(p.id, permId)}
                  />
                </section>
              );
            })
          )}
        </div>
      </div>

      {/* ====== MOBILE (<768px): cards ocupando 100% da largura ======
           Reuso das classes: cards-only, cards-grid, pessoa-card, pessoa-dl */}
      <div className="cards-only">
        {loading ? (
          <div className="loading-message">
            <span className="spinner" aria-hidden="true" /> Carregando…
          </div>
        ) : perfis.length === 0 ? (
          <div className="empty-message">Nenhum perfil encontrado.</div>
        ) : (
          <ul className="cards-grid" role="list">
            {perfis.map((p) => {
              const isAdmin = String(p.nome || "").trim().toLowerCase() === "administrador";
              const expandido = perfilExpandido === p.id;
              const permissoesPerfil = permissoesPorPerfil.get(p.id) || new Set();
              const carregandoPerms = permissoesCarregando.has(p.id);
              const salvandoPerms = permissoesSalvando.has(p.id);

              return (
                <li key={p.id} className="pessoa-card" aria-label={`Perfil ${p.nome}`}>
                  <div className="pessoa-card__head">
                    <h3 className="pessoa-card__title">{p.nome}</h3>
                    <div className="pessoa-card__actions">
                      <button
                        className="btn btn--neutral btn--sm"
                        onClick={() => abrirEdicao(p)}
                        aria-label={`Editar ${p.nome}`}
                      >
                        <CheckIcon className="icon" aria-hidden="true" />
                        <span>Editar</span>
                      </button>
                      {!isAdmin && (
                        <button
                          className="btn btn--danger btn--sm"
                          onClick={() => excluirPerfil(p)}
                          aria-label={`Excluir perfil ${p.nome}`}
                        >
                          <XMarkIcon className="icon" aria-hidden="true" />
                          <span>Excluir</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="pessoa-card__body">
                    <dl className="pessoa-dl">
                      <div className="pessoa-dl__row">
                        <dt>Status</dt>
                        <dd>{p.ativo ? "Ativo" : "Inativo"}</dd>
                      </div>
                      <div className="pessoa-dl__row">
                        <dt>Tipo</dt>
                        <dd>
                          {isAdmin ? (
                            <span className="btn btn--ghost btn--sm" style={{ pointerEvents: "none" }}>
                              <ShieldCheckIcon className="icon" aria-hidden="true" /> Administrador
                            </span>
                          ) : (
                            "Padrão"
                          )}
                        </dd>
                      </div>
                    </dl>

                    <div className="form-actions" style={{ justifyContent: "flex-start" }}>
                      <button
                        className="btn btn--neutral btn--sm"
                        onClick={() => {
                          if (!expandido && !permissoesPorPerfil.has(p.id)) carregarPermissoesPerfil(p.id);
                          toggleExpansaoPerfil(p.id);
                        }}
                        aria-label={expandido ? `Ocultar permissões de ${p.nome}` : `Mostrar permissões de ${p.nome}`}
                        disabled={carregandoPerms}
                      >
                        {expandido ? <ChevronUpIcon className="icon" aria-hidden="true" /> : <ChevronDownIcon className="icon" aria-hidden="true" />}
                        <span>Permissões</span>
                      </button>
                    </div>

                    {expandido && (
                      <div style={{ marginTop: 12, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                        {isAdmin ? (
                          <div className="form-tip" role="note">
                            <strong>Administrador</strong> possui todas as permissões automaticamente.
                          </div>
                        ) : carregandoPerms ? (
                          <div style={{ textAlign: "center", padding: "1.5rem" }}>
                            <span className="spinner" aria-hidden="true" /> Carregando permissões…
                          </div>
                        ) : (
                          <>
                            <div className="page-header__toolbar" style={{ marginBottom: 12 }}>
                              <button className="btn btn--neutral btn--sm" onClick={() => marcarTodasPermissoes(p.id, true)} disabled={salvandoPerms}>
                                Marcar Todas
                              </button>
                              <button className="btn btn--neutral btn--sm" onClick={() => marcarTodasPermissoes(p.id, false)} disabled={salvandoPerms}>
                                Limpar Todas
                              </button>
                              <button className="btn btn--success btn--sm" onClick={() => salvarPermissoes(p.id)} disabled={salvandoPerms}>
                                {salvandoPerms ? <span className="spinner" aria-hidden="true" /> : <CheckIcon className="icon" aria-hidden="true" />}
                                <span>{salvandoPerms ? "Salvando…" : "Salvar Permissões"}</span>
                              </button>
                            </div>

                            {/* Em mobile, uma coluna de grupos (cards) empilhados */}
                            <div className="cards-grid">
                              {Array.from(gruposPermissoes.keys()).map((escopo) => {
                                const itens = gruposPermissoes.get(escopo) || [];
                                const total = itens.length;
                                const marcadas = itens.filter(perm => permissoesPerfil.has(perm.id)).length;

                                return (
                                  <div key={escopo} className="pessoa-card">
                                    <div className="pessoa-card__head">
                                      <h4 className="pessoa-card__title" style={{ textTransform: "capitalize" }}>
                                        {escopo} <small>({marcadas}/{total})</small>
                                      </h4>
                                    </div>
                                    <div className="pessoa-card__body" style={{ display: "grid", gap: 8 }}>
                                      {itens.map((perm) => {
                                        const checked = permissoesPerfil.has(perm.id);
                                        return (
                                          <label key={perm.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer" }}>
                                            <input
                                              type="checkbox"
                                              checked={checked}
                                              onChange={() => togglePermissao(p.id, perm.id)}
                                              style={{ marginTop: 2 }}
                                            />
                                            <div>
                                              <div style={{ fontWeight: 600, color: "var(--fg)" }}>{perm.codigo}</div>
                                              <div style={{ color: "var(--muted)", fontSize: "var(--fs-14)" }}>{perm.descricao || ""}</div>
                                            </div>
                                          </label>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* DIALOG: CRIAR/EDITAR PERFIL */}
      {showForm && (
        <div className="form-overlay" role="dialog" aria-modal="true" aria-labelledby="titulo-form" onKeyDown={onOverlayKeyDown}>
          <div className="form-container">
            <div className="form-header">
              <h2 id="titulo-form">{editId ? "Editar Perfil" : "Novo Perfil"}</h2>
              <button className="btn btn--neutral btn--icon-only" onClick={() => setShowForm(false)} aria-label="Fechar formulário">
                <XMarkIcon className="icon" aria-hidden="true" />
              </button>
            </div>

            <form className="form" onSubmit={salvarPerfil}>
              <div className="form-grid">
                <div className="form-field span-2">
                  <label htmlFor="pf_nome">Nome do Perfil</label>
                  <input
                    id="pf_nome"
                    className="input"
                    value={form.nome}
                    onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                    required
                    autoComplete="off"
                  />
                </div>

                <div className="form-field" style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0" }}>
                  <input
                    id="pf_ativo"
                    type="checkbox"
                    checked={!!form.ativo}
                    onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked ? 1 : 0 }))}
                    style={{ width: 16, height: 16 }}
                  />
                  <label htmlFor="pf_ativo" style={{ margin: 0 }}>Perfil ativo</label>
                </div>
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn--neutral" onClick={fecharForm}>
                  <XMarkIcon className="icon" aria-hidden="true" />
                  <span>Cancelar</span>
                </button>
                <button type="submit" className="btn btn--success" disabled={loading}>
                  {loading ? <span className="spinner" aria-hidden="true" /> : <CheckIcon className="icon" aria-hidden="true" />}
                  <span>{loading ? "Salvando…" : "Salvar"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

/* ===== Componente auxiliar para evitar repetição no desktop/tablet ===== */
function CardPerfil({
  p, isAdmin, expandido, carregandoPerms, salvandoPerms, permissoesPerfil,
  gruposPermissoes, onToggleExpand, onEditar, onExcluir, onMarcarTodas, onSalvar, onTogglePerm
}) {
  return (
    <>
      <div className="stat-header" style={{ alignItems: "center", cursor: 'pointer' }} onClick={onToggleExpand}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}>
          <h3 style={{ margin: 0, fontSize: "1.25rem", color: 'var(--fg)' }}>{p.nome}</h3>
          {isAdmin && (
            <span className="btn btn--ghost btn--sm" style={{ pointerEvents: 'none' }}>
              <ShieldCheckIcon className="icon" aria-hidden="true" />
              Administrador
            </span>
          )}
          <span className="btn btn--ghost btn--sm" style={{ pointerEvents: 'none' }}>
            {p.ativo ? "Ativo" : "Inativo"}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button className="btn btn--neutral btn--sm" onClick={(e) => { e.stopPropagation(); onEditar(); }} aria-label={`Editar ${p.nome}`}>
            <CheckIcon className="icon" aria-hidden="true" />
            <span>Editar</span>
          </button>
          <button
            className="btn btn--neutral btn--sm"
            onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
            aria-label={expandido ? `Ocultar permissões de ${p.nome}` : `Mostrar permissões de ${p.nome}`}
            disabled={carregandoPerms}
          >
            {expandido ? <ChevronUpIcon className="icon" aria-hidden="true" /> : <ChevronDownIcon className="icon" aria-hidden="true" />}
            <span>Permissões</span>
          </button>
          {!isAdmin && (
            <button className="btn btn--danger btn--sm" onClick={(e) => { e.stopPropagation(); onExcluir(); }} aria-label={`Excluir perfil ${p.nome}`}>
              <XMarkIcon className="icon" aria-hidden="true" />
              <span>Excluir</span>
            </button>
          )}
        </div>
      </div>

      {expandido && (
        <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          {isAdmin ? (
            <div className="action-card" style={{ textAlign: 'left', alignItems: 'flex-start' }}>
              <strong>Administrador:</strong> possui todas as permissões automaticamente.
            </div>
          ) : (
            <>
              <div className="page-header__toolbar" style={{ marginBottom: 16 }}>
                <button className="btn btn--neutral btn--sm" onClick={() => onMarcarTodas(true)} disabled={salvandoPerms}>Marcar Todas</button>
                <button className="btn btn--neutral btn--sm" onClick={() => onMarcarTodas(false)} disabled={salvandoPerms}>Limpar Todas</button>
                <button className="btn btn--success btn--sm" onClick={onSalvar} disabled={salvandoPerms}>
                  {salvandoPerms ? <span className="spinner" aria-hidden="true" /> : <CheckIcon className="icon" aria-hidden="true" />}
                  <span>{salvandoPerms ? "Salvando…" : "Salvar Permissões"}</span>
                </button>
              </div>

              {/* Desktop/Tablet: grid responsivo de grupos */}
              <div className="stats-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
                {Array.from(gruposPermissoes.keys()).map((escopo) => {
                  const itens = gruposPermissoes.get(escopo) || [];
                  const total = itens.length;
                  const marcadas = itens.filter(perm => permissoesPerfil.has(perm.id)).length;

                  return (
                    <div key={escopo} className="stat-card" data-accent="info" style={{ padding: 16 }}>
                      <div className="stat-header" style={{ marginBottom: 12 }}>
                        <h4 style={{ margin: 0, textTransform: "capitalize" }}>
                          {escopo} <small>({marcadas}/{total})</small>
                        </h4>
                      </div>
                      <div style={{ display: 'grid', gap: 8 }}>
                        {itens.map((perm) => {
                          const checked = permissoesPerfil.has(perm.id);
                          return (
                            <label key={perm.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: 8, borderRadius: 6, cursor: 'pointer' }}>
                              <input type="checkbox" checked={checked} onChange={() => onTogglePerm(perm.id)} style={{ marginTop: 2 }} />
                              <div>
                                <div style={{ fontWeight: 600, color: 'var(--fg)' }}>{perm.codigo}</div>
                                <div style={{ color: 'var(--muted)', fontSize: 'var(--fs-14)' }}>{perm.descricao || ""}</div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}