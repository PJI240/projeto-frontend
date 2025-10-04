import { useEffect, useState, useRef } from "react";
import { EyeIcon } from "@heroicons/react/24/outline";
import AccessibilityLogo from "../assets/Accessibility_logo.png";

/* Ícone 'A' para “Fonte grande” */
function AIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" {...props}>
      <path
        d="M12 4l6 16h-2.4l-1.4-4H9.8L8.4 20H6L12 4zm-1.6 9.4h3.2L12 7.8l-1.6 5.6z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function AccessibilityToggles() {
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "default");
  const [font, setFont] = useState(localStorage.getItem("font") || "md");
  const [open, setOpen] = useState(false);

  const isHC = theme === "hc";
  const isLG = font === "lg";

  const menuRef = useRef(null);
  const btnRef = useRef(null);

  /* aplica tema e fonte */
  useEffect(() => {
    const html = document.documentElement;
    html.dataset.theme = isHC ? "hc" : "";
    html.dataset.font = isLG ? "lg" : "";
    localStorage.setItem("theme", theme);
    localStorage.setItem("font", font);
  }, [theme, font, isHC, isLG]);

  /* fecha com ESC ou clique fora */
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    const onDown = (e) => {
      if (
        !menuRef.current?.contains(e.target) &&
        !btnRef.current?.contains(e.target)
      ) {
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

  /* bloqueia rolagem quando o menu abre */
  useEffect(() => {
    const prev = document.body.style.overflow;
    if (open) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const toggleHC = () => setTheme(isHC ? "default" : "hc");
  const toggleFont = () => setFont(isLG ? "md" : "lg");

  return (
    <>
      {/* FAB flutuante com ícone PNG */}
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="a11y-menu"
        aria-label={
          open
            ? "Fechar opções de acessibilidade"
            : "Abrir opções de acessibilidade"
        }
        style={{
          position: "fixed",
          right: "16px",
          bottom: "16px",
          zIndex: 70,
          width: "70px",
          height: "70px",
          borderRadius: "50%",
          background: isHC ? "#00ffaa" : "var(--a11y-blue, #1e90ff)",
          border: isHC ? "2px solid #fff" : "none",
          boxShadow: "0 6px 18px rgba(0,0,0,.25)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          animation: "pulse 2s infinite",
          transition: "all .2s ease",
        }}
      >
        <img
          src={AccessibilityLogo}
          alt="Acessibilidade"
          width="46"
          height="46"
          style={{
            display: "block",
            objectFit: "contain",
            pointerEvents: "none",
            filter: isHC ? "brightness(1)" : "brightness(0) invert(1)",
          }}
        />
      </button>

      {/* Menu popover com opções */}
      {open && (
        <div
          ref={menuRef}
          id="a11y-menu"
          role="menu"
          aria-label="Opções de acessibilidade"
          style={{
            position: "fixed",
            right: "16px",
            bottom: "100px",
            zIndex: 71,
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: "12px",
            boxShadow: "0 12px 28px rgba(0,0,0,.16)",
            padding: "10px",
            minWidth: "220px",
            color: "var(--fg)",
            fontSize: isLG ? "1.1rem" : "1rem",
          }}
        >
          <div style={{ display: "grid", gap: "8px" }}>
            {/* Fonte */}
            <button
              type="button"
              role="menuitemcheckbox"
              aria-checked={isLG}
              onClick={toggleFont}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                width: "100%",
                justifyContent: "flex-start",
                borderRadius: "10px",
                padding: "10px 12px",
                background: isLG ? "color-mix(in srgb, var(--accent) 12%, var(--panel))" : "transparent",
                border: "1px solid var(--border)",
                color: "var(--fg)",
                fontWeight: isLG ? "700" : "600",
                transition: "all .2s ease",
              }}
            >
              <AIcon />
              <span>{isLG ? "Fonte normal" : "Fonte grande"}</span>
            </button>

            {/* Contraste */}
            <button
              type="button"
              role="menuitemcheckbox"
              aria-checked={isHC}
              onClick={toggleHC}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                width: "100%",
                justifyContent: "flex-start",
                borderRadius: "10px",
                padding: "10px 12px",
                background: isHC ? "color-mix(in srgb, var(--accent) 12%, var(--panel))" : "transparent",
                border: "1px solid var(--border)",
                color: "var(--fg)",
                fontWeight: isHC ? "700" : "600",
                transition: "all .2s ease",
              }}
            >
              <EyeIcon width={20} height={20} />
              <span>{isHC ? "Tema padrão" : "Alto contraste"}</span>
            </button>
          </div>
        </div>
      )}

      {/* Animação do botão */}
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
      `}</style>
    </>
  );
}