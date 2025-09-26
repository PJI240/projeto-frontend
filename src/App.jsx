import mysql from "mysql2/promise";

// Tenta, nessa ordem:
// 1) MYSQL_URL (privado, recomendado quando o backend está no mesmo projeto do MySQL no Railway)
// 2) MYSQL_PUBLIC_URL (caso você queira usar o proxy público do Railway)
// 3) Monta a URL a partir das variáveis nativas do Railway (MYSQLHOST, MYSQLPORT, etc.)
function resolveMysqlUrl() {
  const urlFromEnv =
    process.env.MYSQL_URL ||
    process.env.MYSQL_PUBLIC_URL ||
    "";

  if (urlFromEnv) return urlFromEnv.trim();

  const host = (process.env.MYSQLHOST || process.env.DB_HOST || "mysql.railway.internal").trim();
  const port = String(process.env.MYSQLPORT || process.env.DB_PORT || 3306).trim();
  const user = (process.env.MYSQLUSER || process.env.DB_USER || "root").trim();
  const pass = (process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || "").trim();
  const db   = (process.env.MYSQLDATABASE || process.env.DB_NAME || "railway").trim();

  return `mysql://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}:${port}/${db}`;
}

const MYSQL_URI = resolveMysqlUrl();
if (!MYSQL_URI) {
  throw new Error("❌ Não encontrei MYSQL_URL (ou variáveis MYSQL*). Configure no Railway.");
}

// Dica de log sem vazar senha:
(() => {
  try {
    const masked = MYSQL_URI.replace(/:[^:@/]+@/, ":******@");
    console.log("Conectando MySQL em:", masked);
  } catch {}
})();

export const pool = mysql.createPool({
  uri: MYSQL_URI,              // mysql2 aceita URI diretamente
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: true,
});

// (Opcional) teste de conexão no boot:
// const [rows] = await pool.query("SELECT 1 AS ok"); console.log("DB OK:", rows);
