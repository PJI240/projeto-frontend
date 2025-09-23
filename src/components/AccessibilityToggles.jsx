import { useEffect, useState } from "react";

export default function AccessibilityToggles() {
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "default");
  const [font,  setFont ] = useState(localStorage.getItem("font")  || "md");

  useEffect(() => {
    const html = document.documentElement;
    html.dataset.theme = theme === "hc" ? "hc" : "";
    html.dataset.font  = font  === "lg" ? "lg" : "";
    localStorage.setItem("theme", theme);
    localStorage.setItem("font",  font);
  }, [theme, font]);

  const isHC = theme === "hc";
  const isLG = font  === "lg";

  return (
    <div className="toggles" role="group" aria-label="Acessibilidade">
      <button
        type="button"
        className={`toggle-btn ${isHC ? "is-active" : ""}`}
        onClick={() => setTheme(isHC ? "default" : "hc")}
        aria-pressed={isHC}
      >
        {isHC ? "Tema padrão" : "Alto contraste"}
      </button>

      <button
        type="button"
        className={`toggle-btn ${isLG ? "is-active" : ""}`}
        onClick={() => setFont(isLG ? "md" : "lg")}
        aria-pressed={isLG}
      >
        {isLG ? "Fonte normal" : "Fonte grande"}
      </button>
    </div>
  );
}
