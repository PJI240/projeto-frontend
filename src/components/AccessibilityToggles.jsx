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

  useEffect(() => {
    const html = document.documentElement;
    html.dataset.theme = isHC ? "hc" : "";
    html.dataset.font  = isLG ? "lg" : "";
    localStorage.setItem("theme", theme);
    localStorage.setItem("font",  font);
  }, [theme, font, isHC, isLG]);

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

  useEffect(() => {
    const prev = document.body.style.overflow;
    if (open) document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const toggleHC = () => setTheme(isHC ? "default" : "hc");
  const toggleFont = () => setFont(isLG ? "md" : "lg");

  return (
    <>
      {/* FAB flutuante azul com pulse */}
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
    width: "64px",
    height: "64px",
    borderRadius: "50%",
    background: "var(--a11y-blue, #1e90ff)",
    border: "none",
    boxShadow: "0 6px 18px rgba(0,0,0,.25)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    animation: "pulse 2s infinite",
  }}
>
  {/* Ícone universal em branco, com padding no viewBox pra não cortar */}
  <svg
    viewBox="-1 -1 26 26"     // <-- dá folga nas bordas
    width="34"
    height="34"
    aria-hidden="true"
    style={{ color: '#fff' }}  // <-- força branco mesmo se o CSS global definir currentColor
  >
    {/* contorno */}
    <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    {/* cabeça */}
    <circle cx="12" cy="7.6" r="2.2" fill="currentColor" />
    {/* braços */}
    <path d="M4.5 9.3c2.7 1.1 5.7 1.1 7.5 1.1s4.8 0 7.5-1.1"
          fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    {/* pernas */}
    <path d="M9.4 11.9L12 17.6l2.6-5.7"
          fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
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
            bottom: "90px",
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

      {/* Keyframes pulse */}
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
      `}</style>
    </>
  );
}