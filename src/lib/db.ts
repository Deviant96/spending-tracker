import mysql from "mysql2/promise";

export const db = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USERNAME || "user",
  password: process.env.DB_PASSWORD || "pass",
  database: process.env.DB_DATABASE || "whateverdb",
  waitForConnections: true,
  connectionLimit: 10,
});
