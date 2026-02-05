import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

async function testConnection() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error("❌ DATABASE_URL環境変数が設定されていません");
    console.log("\n以下の形式で.envファイルに設定してください：");
    console.log("DATABASE_URL=mysql://user:password@localhost:3306/database_name");
    process.exit(1);
  }

  console.log("🔍 データベース接続をテストしています...");
  console.log(`接続文字列: ${databaseUrl.replace(/:[^:@]+@/, ':****@')}`); // パスワードを隠す

  try {
    // 接続文字列をパース
    const url = new URL(databaseUrl);
    const host = url.hostname;
    const port = parseInt(url.port || "3306");
    const user = decodeURIComponent(url.username);
    const password = decodeURIComponent(url.password); // URLエンコードされたパスワードをデコード
    const database = url.pathname.slice(1); // 先頭の/を削除

    console.log(`\n接続情報:`);
    console.log(`  ホスト: ${host}`);
    console.log(`  ポート: ${port}`);
    console.log(`  ユーザー: ${user}`);
    console.log(`  データベース: ${database}`);

    // 接続テスト
    const connection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      database,
    });

    console.log("\n✅ データベース接続成功！");

    // テーブル一覧を取得
    const [tables] = await connection.execute<mysql.RowDataPacket[]>(
      "SHOW TABLES"
    );
    
    console.log(`\n📊 データベース内のテーブル (${tables.length}個):`);
    if (tables.length === 0) {
      console.log("  (テーブルがありません - マイグレーションが必要です)");
    } else {
      tables.forEach((row) => {
        const tableName = Object.values(row)[0];
        console.log(`  - ${tableName}`);
      });
    }

    // Drizzle接続テスト
    console.log("\n🔧 Drizzle ORM接続テスト...");
    const db = drizzle(databaseUrl);
    console.log("✅ Drizzle接続成功！");

    await connection.end();
    console.log("\n✨ すべてのテストが成功しました！");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ データベース接続エラー:");
    if (error instanceof Error) {
      console.error(`   エラーメッセージ: ${error.message}`);
      
      // よくあるエラーの解決方法を提示
      if (error.message.includes("ECONNREFUSED")) {
        console.error("\n💡 解決方法:");
        console.error("   - MySQLサーバーが起動しているか確認してください");
        console.error("   - ホスト名とポート番号が正しいか確認してください");
      } else if (error.message.includes("Access denied")) {
        console.error("\n💡 解決方法:");
        console.error("   - ユーザー名とパスワードが正しいか確認してください");
        console.error("   - ユーザーにデータベースへのアクセス権限があるか確認してください");
      } else if (error.message.includes("Unknown database")) {
        console.error("\n💡 解決方法:");
        console.error("   - データベースが存在するか確認してください");
        console.error("   - データベースを作成: CREATE DATABASE database_name;");
      }
    } else {
      console.error(error);
    }
    process.exit(1);
  }
}

testConnection();

