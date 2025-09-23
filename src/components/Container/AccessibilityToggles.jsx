import { useEffect, useState } from "react";

export default function AccessibilityToggles(){
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "default");
  const [font, setFont]   = useState(localStorage.getItem("font")  || "md");

  useEffect(() => {
    const html = document.documentElement;
    html.dataset.theme = theme === "hc" ? "hc" : "";
    html.dataset.font  = font === "lg" ? "lg" : "";
    localStorage.setItem("theme", theme);
    localStorage.setItem("font", font);
  }, [theme, font]);

  return (
    <div style={{display:"flex", gap:12, alignItems:"center"}}>
      <button onClick={() => setTheme(theme==="hc" ? "default" : "hc")}>
        {theme==="hc" ? "Tema padrão" : "Alto contraste"}
      </button>
      <button onClick={() => setFont(font==="lg" ? "md" : "lg")}>
        {font==="lg" ? "Fonte normal" : "Fonte grande"}
      </button>
    </div>
  );
}
