import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import { users, organizations, bankBalances, incomeRecords, expenseRecords, billingData, budgets, loans } from "../drizzle/schema";
import { sql, count } from "drizzle-orm";

async function checkDbStatus() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error("❌ DATABASE_URL環境変数が設定されていません");
    process.exit(1);
  }

  console.log("🔍 データベースの状態を確認しています...\n");

  try {
    const db = drizzle(databaseUrl);

    // 1. usersテーブルのroleカラムの状態を確認
    console.log("📊 usersテーブルの状態:");
    const roleCounts = await db
      .select({
        role: users.role,
        count: count(),
      })
      .from(users)
      .groupBy(users.role);
    
    console.log("  ロール別ユーザー数:");
    roleCounts.forEach(({ role, count }) => {
      console.log(`    - ${role}: ${count}人`);
    });

    // 全ユーザー一覧（簡易版）
    const allUsers = await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      organizationId: users.organizationId,
    }).from(users).limit(20);
    
    console.log(`\n  ユーザー一覧（最大20件）:`);
    if (allUsers.length === 0) {
      console.log("    (ユーザーが登録されていません)");
    } else {
      allUsers.forEach((user) => {
        const orgInfo = user.organizationId ? `組織ID: ${user.organizationId}` : "本部担当者";
        console.log(`    - ID: ${user.id}, 名前: ${user.name || '-'}, メール: ${user.email || '-'}, ロール: ${user.role}, ${orgInfo}`);
      });
    }

    // 2. organizationsテーブルの状態
    console.log("\n📊 organizationsテーブルの状態:");
    const orgList = await db.select().from(organizations);
    console.log(`  組織数: ${orgList.length}件`);
    if (orgList.length > 0) {
      console.log("  組織一覧:");
      orgList.forEach((org) => {
        console.log(`    - ID: ${org.id}, 名前: ${org.name}`);
      });
    } else {
      console.log("    (組織が登録されていません)");
    }

    // 3. 各テーブルのレコード数を確認
    console.log("\n📊 各テーブルのレコード数:");
    
    const bankBalanceCount = await db.select({ count: count() }).from(bankBalances);
    console.log(`  - bank_balances: ${bankBalanceCount[0]?.count || 0}件`);
    
    const incomeCount = await db.select({ count: count() }).from(incomeRecords);
    console.log(`  - income_records: ${incomeCount[0]?.count || 0}件`);
    
    const expenseCount = await db.select({ count: count() }).from(expenseRecords);
    console.log(`  - expense_records: ${expenseCount[0]?.count || 0}件`);
    
    const billingCount = await db.select({ count: count() }).from(billingData);
    console.log(`  - billing_data: ${billingCount[0]?.count || 0}件`);
    
    const budgetCount = await db.select({ count: count() }).from(budgets);
    console.log(`  - budgets: ${budgetCount[0]?.count || 0}件`);
    
    const loanCount = await db.select({ count: count() }).from(loans);
    console.log(`  - loans: ${loanCount[0]?.count || 0}件`);

    // 4. roleカラムのenum型を確認（MySQLのINFORMATION_SCHEMAから）
    console.log("\n📊 roleカラムのenum型定義:");
    try {
      const enumInfo = await db.execute(sql`
        SELECT COLUMN_TYPE 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'users' 
          AND COLUMN_NAME = 'role'
      `);
      
      // drizzle-ormのexecute結果は配列の配列を返す可能性がある
      let columnType: string | undefined;
      if (Array.isArray(enumInfo)) {
        const firstRow = enumInfo[0];
        if (firstRow && typeof firstRow === 'object') {
          // RowDataPacket形式の場合
          columnType = (firstRow as any).COLUMN_TYPE || (firstRow as any)[0]?.COLUMN_TYPE;
        } else if (typeof firstRow === 'string') {
          columnType = firstRow;
        }
      }
      
      if (columnType) {
        console.log(`  ${columnType}`);
        
        // headquartersが含まれているか確認
        if (columnType.includes("headquarters")) {
          console.log("  ✅ headquartersロールが追加されています");
        } else {
          console.log("  ⚠️  headquartersロールがまだ追加されていません");
        }
      } else {
        console.log("  ⚠️  enum型定義の取得に失敗しました");
      }
    } catch (error) {
      console.log("  ⚠️  enum型定義の確認中にエラーが発生しました");
      if (error instanceof Error) {
        console.log(`     ${error.message}`);
      }
    }

    // 5. 組織別のデータ分布
    console.log("\n📊 組織別データ分布:");
    const orgDataCounts = await db
      .select({
        organizationId: bankBalances.organizationId,
        count: count(),
      })
      .from(bankBalances)
      .groupBy(bankBalances.organizationId);
    
    if (orgDataCounts.length === 0) {
      console.log("  (データがありません)");
    } else {
      orgDataCounts.forEach(({ organizationId, count }) => {
        const orgName = orgList.find(o => o.id === organizationId)?.name || `組織ID: ${organizationId}`;
        console.log(`  - ${orgName}: ${count}件の口座残高データ`);
      });
    }

    console.log("\n✅ データベース状態の確認が完了しました！");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ エラーが発生しました:");
    if (error instanceof Error) {
      console.error(`   ${error.message}`);
      console.error(`   ${error.stack}`);
    } else {
      console.error(error);
    }
    process.exit(1);
  }
}

checkDbStatus();
