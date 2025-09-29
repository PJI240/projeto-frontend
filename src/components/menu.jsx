/* ===== Menu responsivo (mobile drawer) — VERSÃO AJUSTADA ===== */

/* Botão hambúrguer: oculto no desktop, visível no mobile */
.menu-toggle {
  display: none;
  position: fixed;            /* <- era sticky, agora fixed pra sempre clicável */
  top: 10px;
  left: 10px;
  z-index: 1100;              /* acima do backdrop e do conteúdo; abaixo do sidebar ao abrir */
  margin: 0;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--panel);
  color: var(--fg);
  font-size: var(--fs-14);
  font-weight: 700;
  box-shadow: var(--shadow);
}
.menu-toggle:focus-visible,
.menu-toggle:hover {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent-strong);
}
.menu-toggle-icon { margin-right: 8px; }

/* Backdrop atrás do drawer */
.sidebar-backdrop {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.35);
  z-index: 900;
  pointer-events: none;       /* <- não captura clique quando escondido */
}
.sidebar-backdrop.show {
  display: block;
  pointer-events: auto;       /* <- só captura clique quando visível */
}

/* Conteúdo principal deve ficar abaixo do drawer/backdrop no stacking */
.dashboard-main {
  position: relative;
  z-index: 1;
}

/* No mobile: vira off-canvas */
@media (max-width: 900px) {
  .menu-toggle { display: inline-flex; align-items: center; gap: 6px; }

  .dashboard-container { position: relative; }

  .dashboard-sidebar {
    position: fixed;
    top: 0; left: 0;
    height: 100dvh;
    width: 82%;
    max-width: 320px;
    transform: translateX(-100%);
    transition: transform .25s ease;
    z-index: 1000;             /* acima do backdrop (900) e do toggle (1100? veja abaixo) */
    border-right: 1px solid var(--border);
    pointer-events: none;      /* <- fechado: não clica */
  }
  .dashboard-sidebar.is-open {
    transform: translateX(0);
    pointer-events: auto;      /* <- aberto: clicável */
  }

  /* O conteúdo principal não precisa “empurrar” nada — drawer paira por cima */
  .dashboard-main { padding-top: 8px; }
}

/* ⚠️ REMOVA/COMENTE o trecho antigo que quebrava o drawer:
@media (max-width: 768px) {
  .dashboard-container { flex-direction: column; }
  .dashboard-sidebar { width: 100%; }   <-- ISSO conflitava com o drawer
  .dashboard-main { padding: 1rem; }
  .stats-grid { grid-template-columns: 1fr; }
}
*/

/* Se quiser manter os ajustes de padding e grid do bloco acima, sem quebrar o drawer,
   use esta variante segura (sem mexer na sidebar): */
@media (max-width: 768px) {
  .dashboard-container { flex-direction: column; }
  /* .dashboard-sidebar { width: 100%; }  <-- NÃO DEFINA ISSO */
  .dashboard-main { padding: 1rem; }
  .stats-grid { grid-template-columns: 1fr; }
}