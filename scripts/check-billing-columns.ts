import "dotenv/config";
import mysql from "mysql2/promise";

async function checkColumns() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error("❌ DATABASE_URL環境変数が設定されていません");
    process.exit(1);
  }

  try {
    const url = new URL(databaseUrl);
    const connection = await mysql.createConnection({
      host: url.hostname,
      port: parseInt(url.port || "3306"),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.slice(1),
    });

    const [columns] = await connection.execute<mysql.RowDataPacket[]>(
      "DESCRIBE billing_data"
    );

    console.log("📊 billing_dataテーブルのカラム一覧:");
    columns.forEach((col) => {
      console.log(`  - ${col.Field} (${col.Type}) ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Default !== null ? `DEFAULT ${col.Default}` : ''}`);
    });

    const hasIsTransfer = columns.some((col) => col.Field === 'isTransfer');
    console.log(`\n${hasIsTransfer ? '✅' : '❌'} isTransferカラム: ${hasIsTransfer ? '存在します' : '存在しません'}`);

    await connection.end();
  } catch (error: any) {
    console.error("❌ エラー:", error.message);
    process.exit(1);
  }
}

checkColumns();










