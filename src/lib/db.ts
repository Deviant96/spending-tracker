import mysql from "mysql2/promise";

export const db = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "user",
  password: process.env.DB_PASS || "pass",
  database: process.env.DB_NAME || "whateverdb",
  waitForConnections: true,
  connectionLimit: 10,
});
