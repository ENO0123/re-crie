import "dotenv/config";
import { getDb } from "../server/db";
import { billingData } from "../drizzle/schema";
import { eq, gte, sql, and } from "drizzle-orm";

async function check2026BillingData() {
  const db = await getDb();
  if (!db) {
    console.error("データベースに接続できません");
    process.exit(1);
  }

  const organizationId = 1; // デフォルトの組織ID

  console.log("2026年1月以降の請求データを確認中...\n");

  // 2026年1月以降の請求データを取得
  const results = await db
    .select({
      id: billingData.id,
      billingYearMonth: billingData.billingYearMonth,
      serviceYearMonth: billingData.serviceYearMonth,
      userName: billingData.userName,
      insurancePayment: billingData.insurancePayment,
      userBurdenTransfer: billingData.userBurdenTransfer,
      userBurdenWithdrawal: billingData.userBurdenWithdrawal,
      isTransfer: billingData.isTransfer,
    })
    .from(billingData)
    .where(
      and(
        eq(billingData.organizationId, organizationId),
        gte(billingData.billingYearMonth, "202601")
      )
    )
    .orderBy(billingData.billingYearMonth, billingData.userName);

  console.log(`2026年1月以降の請求データ件数: ${results.length}\n`);

  if (results.length === 0) {
    console.log("⚠️  2026年1月以降の請求データが存在しません。");
    console.log("   これが原因で、26年1月以降の数字が表示されていない可能性があります。\n");
  } else {
    console.log("請求データ一覧:");
    console.log("=".repeat(100));
    
    // 請求年月ごとにグループ化
    const groupedByMonth = results.reduce((acc, record) => {
      const month = record.billingYearMonth;
      if (!acc[month]) {
        acc[month] = [];
      }
      acc[month].push(record);
      return acc;
    }, {} as Record<string, typeof results>);

    for (const [month, records] of Object.entries(groupedByMonth)) {
      const totalInsurance = records.reduce((sum, r) => sum + (r.insurancePayment || 0), 0);
      const totalUserBurden = records.reduce(
        (sum, r) => sum + (r.userBurdenTransfer || 0) + (r.userBurdenWithdrawal || 0),
        0
      );
      
      console.log(`\n請求年月: ${month} (${records.length}件)`);
      console.log(`  保険給付額合計: ${totalInsurance.toLocaleString()}円`);
      console.log(`  利用者負担合計: ${totalUserBurden.toLocaleString()}円`);
      console.log(`  振込件数: ${records.filter(r => r.isTransfer).length}件`);
      console.log(`  口座振替件数: ${records.filter(r => !r.isTransfer).length}件`);
    }
  }

  // 2025年12月のデータも確認（比較用）
  const dec2025Results = await db
    .select({
      count: sql<number>`count(*)`,
      totalInsurance: sql<number>`COALESCE(SUM(${billingData.insurancePayment}), 0)`,
    })
    .from(billingData)
    .where(
      and(
        eq(billingData.organizationId, organizationId),
        eq(billingData.billingYearMonth, "202512")
      )
    );

  console.log("\n" + "=".repeat(100));
  console.log("比較: 2025年12月の請求データ");
  console.log(`  件数: ${dec2025Results[0]?.count || 0}件`);
  console.log(`  保険給付額合計: ${Number(dec2025Results[0]?.totalInsurance || 0).toLocaleString()}円`);

  process.exit(0);
}

check2026BillingData().catch(console.error);

