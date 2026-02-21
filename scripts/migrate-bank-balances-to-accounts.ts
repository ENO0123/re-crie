/**
 * 既存の口座残高データ（balance1〜5）を新構造（金融機関マスタ + 金融機関別残高）へ移行するスクリプト。
 * マイグレーション 0007 実行後、bank_balances_old が存在する場合に実行してください。
 *
 * 使い方: pnpm exec tsx scripts/migrate-bank-balances-to-accounts.ts
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import { sql } from "drizzle-orm";
import { bankAccounts, bankBalances } from "../drizzle/schema";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL が設定されていません");
    process.exit(1);
  }

  const db = drizzle(databaseUrl);

  type OldRow = {
    id: number;
    organizationId: number;
    yearMonth: string;
    balance1: number;
    balance2: number;
    balance3: number;
    balance4: number;
    balance5: number;
    createdBy: number;
  };

  let rows: OldRow[];
  try {
    const [result] = await db.execute<OldRow[]>(
      sql.raw("SELECT id, organizationId, yearMonth, balance1, balance2, balance3, balance4, balance5, createdBy FROM bank_balances_old")
    );
    rows = Array.isArray(result) ? result : [];
  } catch {
    console.log("bank_balances_old は存在しません。移行は不要です。");
    process.exit(0);
  }

  if (rows.length === 0) {
    console.log("移行対象のデータがありません。");
    await db.execute(sql.raw("DROP TABLE IF EXISTS bank_balances_old"));
    console.log("bank_balances_old を削除しました。");
    process.exit(0);
  }

  const orgIds = Array.from(new Set(rows.map((r) => r.organizationId)));
  const accountNames = ["口座1", "口座2", "口座3", "口座4", "口座5"];
  const orgToAccountIds: Record<number, number[]> = {};

  for (const orgId of orgIds) {
    const ids: number[] = [];
    for (let i = 0; i < 5; i++) {
      const insertResult = await db.insert(bankAccounts).values({
        organizationId: orgId,
        name: accountNames[i],
        displayOrder: i,
      });
      ids.push(Number(insertResult[0].insertId));
    }
    orgToAccountIds[orgId] = ids;
  }

  for (const row of rows) {
    const accountIds = orgToAccountIds[row.organizationId];
    const amounts = [row.balance1, row.balance2, row.balance3, row.balance4, row.balance5];
    for (let i = 0; i < 5; i++) {
      await db.insert(bankBalances).values({
        organizationId: row.organizationId,
        yearMonth: row.yearMonth,
        bankAccountId: accountIds[i],
        balance: amounts[i] ?? 0,
        createdBy: row.createdBy,
      });
    }
  }

  await db.execute(sql.raw("DROP TABLE bank_balances_old"));
  console.log(`移行完了: ${rows.length} 件の月データを新構造に移行し、bank_balances_old を削除しました。`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
