import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { sql } from "drizzle-orm";

async function addIsTransferColumn() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error("❌ DATABASE_URL環境変数が設定されていません");
    process.exit(1);
  }

  console.log("🔍 isTransferカラムを追加しています...");

  try {
    // 接続文字列をパース
    const url = new URL(databaseUrl);
    const host = url.hostname;
    const port = parseInt(url.port || "3306");
    const user = decodeURIComponent(url.username);
    const password = decodeURIComponent(url.password);
    const database = url.pathname.slice(1);

    // 接続
    const connection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      database,
    });

    // isTransferカラムが存在するかチェック
    const [columns] = await connection.execute<mysql.RowDataPacket[]>(
      "SHOW COLUMNS FROM billing_data LIKE 'isTransfer'"
    );

    if (columns.length > 0) {
      console.log("✅ isTransferカラムは既に存在します");
      await connection.end();
      return;
    }

    // isTransferカラムを追加
    await connection.execute(`
      ALTER TABLE billing_data 
      ADD COLUMN isTransfer BOOLEAN DEFAULT FALSE NOT NULL
    `);

    console.log("✅ isTransferカラムを追加しました");

    await connection.end();
  } catch (error: any) {
    console.error("❌ エラーが発生しました:", error.message);
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log("ℹ️  isTransferカラムは既に存在します");
    } else {
      process.exit(1);
    }
  }
}

addIsTransferColumn();










