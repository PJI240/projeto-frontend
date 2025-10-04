import { useEffect, useState, useRef } from "react";
import { EyeIcon } from "@heroicons/react/24/outline";

/* Ícone 'A' para “Fonte grande” */
function AIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" {...props}>
      <path d="M12 4l6 16h-2.4l-1.4-4H9.8L8.4 20H6L12 4zm-1.6 9.4h3.2L12 7.8l-1.6 5.6z" fill="currentColor"/>
    </svg>
  );
}

export default function AccessibilityToggles() {
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "default");
  const [font,  setFont ] = useState(localStorage.getItem("font")  || "md");
  const [open,  setOpen ] = useState(false);

  const isHC = theme === "hc";
  const isLG = font === "lg";

  const menuRef = useRef(null);
  const btnRef  = useRef(null);

  // aplica dataset + persiste
  useEffect(() => {
    const html = document.documentElement;
    html.dataset.theme = isHC ? "hc" : "";
    html.dataset.font  = isLG ? "lg" : "";
    localStorage.setItem("theme", theme);
    localStorage.setItem("font",  font);
  }, [theme, font, isHC, isLG]);

  // fecha no ESC / clique fora
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    const onDown = (e) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target) && !btnRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("touchstart", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("touchstart", onDown);
    };
  }, [open]);

  // bloqueia rolagem de fundo quando o menu abre em telas pequenas
  useEffect(() => {
    const prev = document.body.style.overflow;
    if (open) document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const toggleHC = () => setTheme(isHC ? "default" : "hc");
  const toggleFont = () => setFont(isLG ? "md" : "lg");

  return (
    <>
      {/* FAB flutuante com SVG azul */}
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="a11y-menu"
        aria-label={open ? "Fechar opções de acessibilidade" : "Abrir opções de acessibilidade"}
        style={{
          position: "fixed",
          right: "16px",
          bottom: "16px",
          zIndex: 70,
          width: "56px",
          height: "56px",
          borderRadius: "50%",
          background: "var(--panel)",
          border: "1px solid var(--border)",
          boxShadow: "0 6px 18px rgba(0,0,0,.12)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--fg)",
        }}
      >
        {/* Símbolo universal de acessibilidade (azul) */}
        <svg
          viewBox="0 0 24 24"
          width="26"
          height="26"
          aria-hidden="true"
          /* permite customizar o tom via CSS var, com fallback */
          style={{ color: "var(--a11y-blue, #1e90ff)" }}
        >
          {/* contorno principal */}
          <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.8" />
          {/* cabeça (preenchida) */}
          <circle cx="12" cy="7.5" r="2.2" fill="currentColor" />
          {/* braços curvos */}
          <path d="M4.5 9.2c2.7 1.2 5.5 1.2 7.5 1.2s4.8 0 7.5-1.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          {/* pernas em V */}
          <path d="M9.5 11.8L12 17.5l2.5-5.7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          {/* nós azuis nas extremidades (ornamentais, como no desenho que você mandou) */}
          <circle cx="4.3" cy="9.7" r="1.2" fill="currentColor"/>
          <circle cx="19.7" cy="9.7" r="1.2" fill="currentColor"/>
          <circle cx="7.2" cy="20" r="1.2" fill="currentColor"/>
          <circle cx="16.8" cy="20" r="1.2" fill="currentColor"/>
        </svg>
        <span className="sr-only">Acessibilidade</span>
      </button>

      {/* Popover com as duas opções */}
      {open && (
        <div
          ref={menuRef}
          id="a11y-menu"
          role="menu"
          aria-label="Opções de acessibilidade"
          style={{
            position: "fixed",
            right: "16px",
            bottom: "76px",
            zIndex: 71,
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: "12px",
            boxShadow: "0 12px 28px rgba(0,0,0,.16)",
            padding: "10px",
            minWidth: "220px",
          }}
        >
          <div className="menu-group-items" style={{ display: "grid", gap: "8px" }}>
            {/* Fonte grande */}
            <button
              type="button"
              role="menuitemcheckbox"
              aria-checked={isLG}
              onClick={toggleFont}
              className={`toggle-btn ${isLG ? "is-active" : ""}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                width: "100%",
                justifyContent: "flex-start",
                borderRadius: "10px",
                padding: "10px 12px",
                background: isLG ? "var(--panel-muted)" : "transparent",
                border: "1px solid var(--border)",
              }}
            >
              <span className="nav-item-icon" aria-hidden="true"><AIcon /></span>
              <span className="nav-item-label">{isLG ? "Fonte normal" : "Fonte grande"}</span>
            </button>

            {/* Alto contraste */}
            <button
              type="button"
              role="menuitemcheckbox"
              aria-checked={isHC}
              onClick={toggleHC}
              className={`toggle-btn ${isHC ? "is-active" : ""}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                width: "100%",
                justifyContent: "flex-start",
                borderRadius: "10px",
                padding: "10px 12px",
                background: isHC ? "var(--panel-muted)" : "transparent",
                border: "1px solid var(--border)",
              }}
            >
              <span className="nav-item-icon" aria-hidden="true"><EyeIcon width={20} height={20} /></span>
              <span className="nav-item-label">{isHC ? "Tema padrão" : "Alto contraste"}</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}