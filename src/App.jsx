import mysql from "mysql2/promise";

// pega direto da env (Railway fornece MYSQL_URL ou MYSQL_PUBLIC_URL)
const dbUrl = process.env.MYSQL_URL;

if (!dbUrl) {
  throw new Error("❌ Variável MYSQL_URL não encontrada. Configure no Railway!");
}

export const pool = mysql.createPool(dbUrl + "?connectionLimit=10&namedPlaceholders=true");
