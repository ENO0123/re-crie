import { eq, and, desc, asc, sql, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, 
  users, 
  organizations,
  bankBalances,
  incomeRecords,
  expenseRecords,
  billingData,
  factoringSettings,
  budgets,
  loans,
  loanHistory,
  monthStatuses,
  type BankBalance,
  type IncomeRecord,
  type ExpenseRecord,
  type BillingData,
  type FactoringSetting,
  type Budget,
  type Organization,
  type InsertOrganization,
  type InsertBankBalance,
  type InsertIncomeRecord,
  type InsertExpenseRecord,
  type InsertBillingData,
  type InsertFactoringSetting,
  type InsertBudget,
  type Loan,
  type InsertLoan,
  type LoanHistory,
  type InsertLoanHistory,
  type MonthStatus,
  type InsertMonthStatus,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      console.warn("[Database] DATABASE_URL環境変数が設定されていません");
      return null;
    }
    
    try {
      _db = drizzle(databaseUrl);
      console.log("[Database] Drizzleインスタンスを作成しました（接続は遅延実行されます）");
    } catch (error) {
      console.error("[Database] Drizzleインスタンス作成エラー:", error);
      if (error instanceof Error) {
        console.error(`[Database] エラーメッセージ: ${error.message}`);
      }
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }
    if (user.organizationId !== undefined) {
      values.organizationId = user.organizationId;
      updateSet.organizationId = user.organizationId;
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// Organization helpers
export async function getOrganizationById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createOrganization(org: InsertOrganization) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(organizations).values(org);
  return result;
}

// Bank balance helpers
export async function getBankBalances(organizationId: number, limit: number = 12) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(bankBalances)
    .where(eq(bankBalances.organizationId, organizationId))
    .orderBy(desc(bankBalances.yearMonth))
    .limit(limit);
}

export async function getBankBalanceByYearMonth(organizationId: number, yearMonth: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(bankBalances)
    .where(and(
      eq(bankBalances.organizationId, organizationId),
      eq(bankBalances.yearMonth, yearMonth)
    ))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function upsertBankBalance(balance: InsertBankBalance) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await getBankBalanceByYearMonth(balance.organizationId, balance.yearMonth);
  if (existing) {
    await db.update(bankBalances)
      .set(balance)
      .where(eq(bankBalances.id, existing.id));
    return existing.id;
  } else {
    const result = await db.insert(bankBalances).values(balance);
    return result[0].insertId;
  }
}

// Income record helpers
export async function getIncomeRecords(organizationId: number, limit: number = 12) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(incomeRecords)
    .where(eq(incomeRecords.organizationId, organizationId))
    .orderBy(desc(incomeRecords.yearMonth))
    .limit(limit);
}

export async function getIncomeRecordByYearMonth(organizationId: number, yearMonth: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(incomeRecords)
    .where(and(
      eq(incomeRecords.organizationId, organizationId),
      eq(incomeRecords.yearMonth, yearMonth)
    ))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function upsertIncomeRecord(record: InsertIncomeRecord) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await getIncomeRecordByYearMonth(record.organizationId, record.yearMonth);
  if (existing) {
    await db.update(incomeRecords)
      .set(record)
      .where(eq(incomeRecords.id, existing.id));
    return existing.id;
  } else {
    const result = await db.insert(incomeRecords).values(record);
    return result[0].insertId;
  }
}

// Expense record helpers
export async function getExpenseRecords(organizationId: number, limit: number = 12) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(expenseRecords)
    .where(eq(expenseRecords.organizationId, organizationId))
    .orderBy(desc(expenseRecords.yearMonth))
    .limit(limit);
}

export async function getExpenseRecordByYearMonth(organizationId: number, yearMonth: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(expenseRecords)
    .where(and(
      eq(expenseRecords.organizationId, organizationId),
      eq(expenseRecords.yearMonth, yearMonth)
    ))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function upsertExpenseRecord(record: InsertExpenseRecord) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await getExpenseRecordByYearMonth(record.organizationId, record.yearMonth);
  if (existing) {
    await db.update(expenseRecords)
      .set(record)
      .where(eq(expenseRecords.id, existing.id));
    return existing.id;
  } else {
    const result = await db.insert(expenseRecords).values(record);
    return result[0].insertId;
  }
}

// Billing data helpers
export async function getBillingDataList(organizationId: number, page: number = 1, pageSize: number = 50) {
  const db = await getDb();
  if (!db) return { data: [], total: 0 };
  
  try {
    const offset = (page - 1) * pageSize;
    const data = await db.select().from(billingData)
      .where(eq(billingData.organizationId, organizationId))
      .orderBy(desc(billingData.billingYearMonth), desc(billingData.id))
      .limit(pageSize)
      .offset(offset);
    
    const countResult = await db.select({ count: sql<number>`count(*)` })
      .from(billingData)
      .where(eq(billingData.organizationId, organizationId));
    
    return {
      data: data.map(record => ({
        ...record,
        isTransfer: record.isTransfer ?? false, // デフォルト値を設定
      })),
      total: countResult[0]?.count || 0,
    };
  } catch (error: any) {
    // isTransferカラムが存在しない場合のフォールバック
    if (error?.message?.includes('isTransfer') || error?.code === 'ER_BAD_FIELD_ERROR') {
      const offset = (page - 1) * pageSize;
      const data = await db.select({
        id: billingData.id,
        organizationId: billingData.organizationId,
        billingYearMonth: billingData.billingYearMonth,
        serviceYearMonth: billingData.serviceYearMonth,
        userName: billingData.userName,
        totalCost: billingData.totalCost,
        insurancePayment: billingData.insurancePayment,
        publicPayment: billingData.publicPayment,
        reduction: billingData.reduction,
        userBurdenTransfer: billingData.userBurdenTransfer,
        userBurdenWithdrawal: billingData.userBurdenWithdrawal,
        createdBy: billingData.createdBy,
        createdAt: billingData.createdAt,
        updatedAt: billingData.updatedAt,
      }).from(billingData)
        .where(eq(billingData.organizationId, organizationId))
        .orderBy(desc(billingData.billingYearMonth), desc(billingData.id))
        .limit(pageSize)
        .offset(offset);
      
      const countResult = await db.select({ count: sql<number>`count(*)` })
        .from(billingData)
        .where(eq(billingData.organizationId, organizationId));
      
      return {
        data: data.map(record => ({
          ...record,
          isTransfer: false, // デフォルト値を設定
        })),
        total: countResult[0]?.count || 0,
      };
    }
    throw error;
  }
}

export async function searchBillingData(
  organizationId: number,
  filters: {
    billingYearMonth?: string;
    serviceYearMonth?: string;
    userName?: string;
  },
  page: number = 1,
  pageSize: number = 50
) {
  const db = await getDb();
  if (!db) return { data: [], total: 0 };
  
  const conditions = [eq(billingData.organizationId, organizationId)];
  
  if (filters.billingYearMonth) {
    conditions.push(eq(billingData.billingYearMonth, filters.billingYearMonth));
  }
  if (filters.serviceYearMonth) {
    conditions.push(eq(billingData.serviceYearMonth, filters.serviceYearMonth));
  }
  if (filters.userName) {
    conditions.push(sql`${billingData.userName} LIKE ${`%${filters.userName}%`}`);
  }
  
  try {
    const offset = (page - 1) * pageSize;
    const data = await db.select().from(billingData)
      .where(and(...conditions))
      .orderBy(desc(billingData.billingYearMonth), desc(billingData.id))
      .limit(pageSize)
      .offset(offset);
    
    const countResult = await db.select({ count: sql<number>`count(*)` })
      .from(billingData)
      .where(and(...conditions));
    
    return {
      data: data.map(record => ({
        ...record,
        isTransfer: record.isTransfer ?? false, // デフォルト値を設定
      })),
      total: countResult[0]?.count || 0,
    };
  } catch (error: any) {
    // isTransferカラムが存在しない場合のフォールバック
    if (error?.message?.includes('isTransfer') || error?.code === 'ER_BAD_FIELD_ERROR') {
      const offset = (page - 1) * pageSize;
      const data = await db.select({
        id: billingData.id,
        organizationId: billingData.organizationId,
        billingYearMonth: billingData.billingYearMonth,
        serviceYearMonth: billingData.serviceYearMonth,
        userName: billingData.userName,
        totalCost: billingData.totalCost,
        insurancePayment: billingData.insurancePayment,
        publicPayment: billingData.publicPayment,
        reduction: billingData.reduction,
        userBurdenTransfer: billingData.userBurdenTransfer,
        userBurdenWithdrawal: billingData.userBurdenWithdrawal,
        createdBy: billingData.createdBy,
        createdAt: billingData.createdAt,
        updatedAt: billingData.updatedAt,
      }).from(billingData)
        .where(and(...conditions))
        .orderBy(desc(billingData.billingYearMonth), desc(billingData.id))
        .limit(pageSize)
        .offset(offset);
      
      const countResult = await db.select({ count: sql<number>`count(*)` })
        .from(billingData)
        .where(and(...conditions));
      
      return {
        data: data.map(record => ({
          ...record,
          isTransfer: false, // デフォルト値を設定
        })),
        total: countResult[0]?.count || 0,
      };
    }
    throw error;
  }
}

export async function createBillingData(data: InsertBillingData) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(billingData).values(data);
  return result[0].insertId;
}

export async function updateBillingData(id: number, data: Partial<InsertBillingData>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  try {
    // データを準備（boolean値を適切に変換）
    const updateData: any = { ...data };
    if ('isTransfer' in updateData && typeof updateData.isTransfer === 'boolean') {
      updateData.isTransfer = updateData.isTransfer ? 1 : 0;
    }
    
    await db.update(billingData).set(updateData).where(eq(billingData.id, id));
  } catch (error: any) {
    console.error("[Database] updateBillingData error:", error);
    console.error("[Database] Error message:", error?.message);
    console.error("[Database] Error code:", error?.code);
    console.error("[Database] Update data:", data);
    
    // isTransferカラムが存在しない場合のフォールバック
    if (error?.message?.includes('isTransfer') || error?.code === 'ER_BAD_FIELD_ERROR') {
      // isTransfer以外のフィールドのみ更新
      const { isTransfer, ...dataWithoutIsTransfer } = data;
      if (Object.keys(dataWithoutIsTransfer).length > 0) {
        await db.update(billingData).set(dataWithoutIsTransfer).where(eq(billingData.id, id));
      }
      // isTransferカラムが存在しない場合は、更新をスキップ（エラーを出さない）
      return;
    }
    throw error;
  }
}

export async function deleteBillingData(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(billingData).where(eq(billingData.id, id));
}

export async function deleteBillingDataBatch(ids: number[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(billingData).where(sql`${billingData.id} IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})`);
}

export async function getBillingDataKeys(organizationId: number): Promise<Array<{ billingYearMonth: string; serviceYearMonth: string; userName: string }>> {
  const db = await getDb();
  if (!db) return [];
  const result = await db.select({
    billingYearMonth: billingData.billingYearMonth,
    serviceYearMonth: billingData.serviceYearMonth,
    userName: billingData.userName,
  })
    .from(billingData)
    .where(eq(billingData.organizationId, organizationId));
  return result;
}

export async function createBillingDataBatch(dataList: InsertBillingData[]): Promise<number[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (dataList.length === 0) return [];
  
  const result = await db.insert(billingData).values(dataList);
  // MySQLのinsertIdは最初のIDのみを返すため、連続するIDを生成
  const firstId = result[0].insertId;
  return Array.from({ length: dataList.length }, (_, i) => firstId + i);
}

// Factoring settings helpers
export async function getFactoringSetting(organizationId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(factoringSettings)
    .where(eq(factoringSettings.organizationId, organizationId))
    .orderBy(desc(factoringSettings.createdAt))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function upsertFactoringSetting(setting: InsertFactoringSetting) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await getFactoringSetting(setting.organizationId);
  if (existing) {
    await db.update(factoringSettings)
      .set(setting)
      .where(eq(factoringSettings.id, existing.id));
    return existing.id;
  } else {
    const result = await db.insert(factoringSettings).values(setting);
    return result[0].insertId;
  }
}

// Budget helpers
export async function getBudgets(organizationId: number, yearMonth?: string) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [eq(budgets.organizationId, organizationId)];
  
  // yearMonthが指定されている場合のみフィルタ
  if (yearMonth && yearMonth !== "") {
    conditions.push(eq(budgets.yearMonth, yearMonth));
  }
  
  return db.select().from(budgets)
    .where(and(...conditions))
    .orderBy(asc(budgets.yearMonth));
}

export async function upsertBudget(budget: InsertBudget) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await db.select().from(budgets)
    .where(and(
      eq(budgets.organizationId, budget.organizationId),
      eq(budgets.yearMonth, budget.yearMonth),
      eq(budgets.category, budget.category),
      eq(budgets.itemName, budget.itemName)
    ))
    .limit(1);
  
  if (existing.length > 0) {
    await db.update(budgets)
      .set(budget)
      .where(eq(budgets.id, existing[0].id));
    return existing[0].id;
  } else {
    const result = await db.insert(budgets).values(budget);
    return result[0].insertId;
  }
}

// Loan helpers
export async function getLoans(organizationId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(loans)
    .where(eq(loans.organizationId, organizationId))
    .orderBy(asc(loans.financialInstitution), asc(loans.branchName));
}

export async function getLoanById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(loans)
    .where(eq(loans.id, id))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getActiveLoans(organizationId: number, effectiveDate: Date) {
  const db = await getDb();
  if (!db) return [];
  const dateStr = effectiveDate.toISOString().split('T')[0];
  return db.select().from(loans)
    .where(and(
      eq(loans.organizationId, organizationId),
      eq(loans.isActive, true),
      sql`${loans.effectiveFrom} <= ${dateStr}`
    ))
    .orderBy(asc(loans.financialInstitution), asc(loans.branchName));
}

export async function createLoan(loan: InsertLoan) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(loans).values(loan);
  return result[0].insertId;
}

export async function updateLoan(id: number, loan: Partial<InsertLoan>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(loans).set(loan).where(eq(loans.id, id));
}

export async function deleteLoan(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(loans).where(eq(loans.id, id));
}

export async function createLoanHistory(history: InsertLoanHistory) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(loanHistory).values(history);
  return result[0].insertId;
}

export async function getLoanHistory(loanId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(loanHistory)
    .where(eq(loanHistory.loanId, loanId))
    .orderBy(desc(loanHistory.createdAt));
}

// Month status helpers
export async function getMonthStatus(organizationId: number, yearMonth: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(monthStatuses)
    .where(and(
      eq(monthStatuses.organizationId, organizationId),
      eq(monthStatuses.yearMonth, yearMonth)
    ))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getMonthStatuses(organizationId: number, yearMonths?: string[]) {
  const db = await getDb();
  if (!db) {
    console.warn("[getMonthStatuses] Database not available");
    return [];
  }
  
  try {
    const conditions = [eq(monthStatuses.organizationId, organizationId)];
    
    if (yearMonths && yearMonths.length > 0) {
      conditions.push(inArray(monthStatuses.yearMonth, yearMonths));
    }
    
    const result = await db.select().from(monthStatuses)
      .where(and(...conditions))
      .orderBy(desc(monthStatuses.yearMonth));
    
    console.log(`[getMonthStatuses] Found ${result.length} records for organizationId: ${organizationId}`);
    return result;
  } catch (error) {
    console.error("[getMonthStatuses] Error:", error);
    if (error instanceof Error) {
      console.error("[getMonthStatuses] Error message:", error.message);
      console.error("[getMonthStatuses] Error stack:", error.stack);
    }
    throw error;
  }
}

export async function upsertMonthStatus(status: InsertMonthStatus) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await getMonthStatus(status.organizationId, status.yearMonth);
  if (existing) {
    await db.update(monthStatuses)
      .set(status)
      .where(eq(monthStatuses.id, existing.id));
    return existing.id;
  } else {
    const result = await db.insert(monthStatuses).values(status);
    return result[0].insertId;
  }
}
