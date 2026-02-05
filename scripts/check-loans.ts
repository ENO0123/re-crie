import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { loans } from "../drizzle/schema";
import { eq, and, sql, asc } from "drizzle-orm";

async function checkLoans() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error("❌ DATABASE_URL環境変数が設定されていません");
    console.log("\n以下の形式で.envファイルに設定してください：");
    console.log("DATABASE_URL=mysql://user:password@localhost:3306/database_name");
    process.exit(1);
  }

  console.log("🔍 借入返済管理データを確認しています...\n");

  try {
    // 接続文字列をパース
    const url = new URL(databaseUrl);
    const host = url.hostname;
    const port = parseInt(url.port || "3306");
    const user = decodeURIComponent(url.username);
    const password = decodeURIComponent(url.password);
    const database = url.pathname.slice(1);

    // MySQL接続
    const connection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      database,
    });

    console.log("✅ データベース接続成功！\n");

    // 1. loansテーブルの存在確認
    console.log("📊 loansテーブルの確認...");
    const [tables] = await connection.execute<mysql.RowDataPacket[]>(
      "SHOW TABLES LIKE 'loans'"
    );
    
    if (tables.length === 0) {
      console.log("❌ loansテーブルが存在しません");
      console.log("   マイグレーションを実行してください: pnpm drizzle-kit push");
      await connection.end();
      process.exit(1);
    }
    console.log("✅ loansテーブルが存在します\n");

    // 2. 全データを取得（生SQL）
    console.log("📋 全借入データ（生SQL）:");
    const [allLoansRaw] = await connection.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM loans ORDER BY id"
    );
    
    if (allLoansRaw.length === 0) {
      console.log("  ⚠️  データが0件です\n");
    } else {
      console.log(`  ✅ ${allLoansRaw.length}件のデータが見つかりました:\n`);
      allLoansRaw.forEach((loan, index) => {
        console.log(`  [${index + 1}] ID: ${loan.id}`);
        console.log(`      金融機関: ${loan.financialInstitution}`);
        console.log(`      支店名: ${loan.branchName || '(なし)'}`);
        console.log(`      組織ID: ${loan.organizationId}`);
        console.log(`      有効: ${loan.isActive ? 'はい' : 'いいえ'}`);
        console.log(`      適用開始日: ${loan.effectiveFrom}`);
        console.log(`      当初借入額: ¥${loan.initialBorrowingAmount?.toLocaleString('ja-JP') || 0}`);
        console.log(`      返済元金: ¥${loan.repaymentPrincipal?.toLocaleString('ja-JP') || 0}`);
        console.log(`      年利: ${loan.annualInterestRate}%`);
        console.log(`      返済方法: ${loan.repaymentMethod === 'equal_principal' ? '元金均等' : '元利均等'}`);
        console.log(`      初回返済日: ${loan.firstRepaymentDate}`);
        console.log(`      返済期日: 毎月${loan.repaymentDueDate}日`);
        console.log("");
      });
    }

    // 3. 組織ID別の集計
    console.log("📊 組織ID別の集計:");
    const [orgStats] = await connection.execute<mysql.RowDataPacket[]>(
      `SELECT 
        organizationId,
        COUNT(*) as count,
        SUM(CASE WHEN isActive = 1 THEN 1 ELSE 0 END) as activeCount,
        SUM(CASE WHEN isActive = 0 THEN 1 ELSE 0 END) as inactiveCount
       FROM loans 
       GROUP BY organizationId`
    );
    
    orgStats.forEach((stat) => {
      console.log(`  組織ID ${stat.organizationId}:`);
      console.log(`    総数: ${stat.count}件`);
      console.log(`    有効: ${stat.activeCount}件`);
      console.log(`    無効: ${stat.inactiveCount}件`);
      console.log("");
    });

    // 4. Drizzle ORMで取得（getLoans関数の動作確認）
    console.log("🔧 Drizzle ORMで取得（getLoans関数の動作確認）:");
    const db = drizzle(databaseUrl);
    
    // 組織ID 1で試す（実際の組織IDに変更してください）
    const testOrganizationId = 1;
    console.log(`  組織ID ${testOrganizationId}の借入を取得中...`);
    
    const loansData = await db.select().from(loans)
      .where(eq(loans.organizationId, testOrganizationId))
      .orderBy(asc(loans.financialInstitution), asc(loans.branchName));
    
    if (loansData.length === 0) {
      console.log(`  ⚠️  組織ID ${testOrganizationId}のデータが0件です`);
      console.log(`     他の組織IDを確認してください\n`);
    } else {
      console.log(`  ✅ ${loansData.length}件のデータが見つかりました:\n`);
      loansData.forEach((loan, index) => {
        console.log(`  [${index + 1}] ID: ${loan.id}`);
        console.log(`      金融機関: ${loan.financialInstitution}`);
        console.log(`      支店名: ${loan.branchName || '(なし)'}`);
        console.log(`      有効: ${loan.isActive ? 'はい' : 'いいえ'}`);
        console.log(`      適用開始日: ${loan.effectiveFrom.toISOString().split('T')[0]}`);
        console.log("");
      });
    }

    // 5. 有効な借入の確認（getActiveLoans関数の動作確認）
    console.log("🔧 有効な借入の確認（getActiveLoans関数の動作確認）:");
    const testDate = new Date(); // 今日の日付
    const testDateStr = testDate.toISOString().split('T')[0];
    console.log(`  対象日: ${testDateStr}時点で有効な借入を取得中...`);
    
    const activeLoans = await db.select().from(loans)
      .where(
        and(
          eq(loans.organizationId, testOrganizationId),
          eq(loans.isActive, true),
          sql`${loans.effectiveFrom} <= ${testDateStr}`
        )
      )
      .orderBy(asc(loans.financialInstitution), asc(loans.branchName));
    
    if (activeLoans.length === 0) {
      console.log(`  ⚠️  組織ID ${testOrganizationId}で有効な借入が0件です`);
      console.log(`     以下を確認してください:`);
      console.log(`     - isActiveがtrueになっているか`);
      console.log(`     - effectiveFromが${testDateStr}以前になっているか\n`);
    } else {
      console.log(`  ✅ ${activeLoans.length}件の有効な借入が見つかりました\n`);
    }

    await connection.end();
    console.log("✨ 確認が完了しました！");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ エラーが発生しました:");
    if (error instanceof Error) {
      console.error(`   エラーメッセージ: ${error.message}`);
      console.error(`   スタックトレース:`, error.stack);
    } else {
      console.error(error);
    }
    process.exit(1);
  }
}

checkLoans();

