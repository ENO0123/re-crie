import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean, date } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extended with role-based access control for RECARE system.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  passwordHash: varchar("passwordHash", { length: 255 }), // ID/パスワードログイン用（OAuthユーザーはnull）
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["admin", "editor", "viewer", "headquarters"]).default("viewer").notNull(),
  organizationId: int("organizationId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Organizations (事業所) table for multi-tenant support
 */
export const organizations = mysqlTable("organizations", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = typeof organizations.$inferInsert;

/**
 * Bank balances (口座残高) table
 */
export const bankBalances = mysqlTable("bank_balances", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  yearMonth: varchar("yearMonth", { length: 7 }).notNull(), // YYYY-MM format
  balance1: int("balance1").default(0).notNull(),
  balance2: int("balance2").default(0).notNull(),
  balance3: int("balance3").default(0).notNull(),
  balance4: int("balance4").default(0).notNull(),
  balance5: int("balance5").default(0).notNull(),
  totalBalance: int("totalBalance").default(0).notNull(),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BankBalance = typeof bankBalances.$inferSelect;
export type InsertBankBalance = typeof bankBalances.$inferInsert;

/**
 * Income records (入金実績) table
 */
export const incomeRecords = mysqlTable("income_records", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  yearMonth: varchar("yearMonth", { length: 7 }).notNull(), // YYYY-MM format
  insuranceIncome: int("insuranceIncome").default(0).notNull(),
  userBurdenTransfer: int("userBurdenTransfer").default(0).notNull(),
  userBurdenWithdrawal: int("userBurdenWithdrawal").default(0).notNull(),
  factoringIncome1: int("factoringIncome1").default(0).notNull(),
  factoringIncome2: int("factoringIncome2").default(0).notNull(),
  otherBusinessIncome: int("otherBusinessIncome").default(0).notNull(),
  representativeLoan: int("representativeLoan").default(0).notNull(),
  shortTermLoan: int("shortTermLoan").default(0).notNull(),
  longTermLoan: int("longTermLoan").default(0).notNull(),
  interestIncome: int("interestIncome").default(0).notNull(),
  otherNonBusinessIncome: int("otherNonBusinessIncome").default(0).notNull(),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type IncomeRecord = typeof incomeRecords.$inferSelect;
export type InsertIncomeRecord = typeof incomeRecords.$inferInsert;

/**
 * Expense records (支出実績) table
 */
export const expenseRecords = mysqlTable("expense_records", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  yearMonth: varchar("yearMonth", { length: 7 }).notNull(), // YYYY-MM format
  personnelCost: int("personnelCost").default(0).notNull(),
  legalWelfare: int("legalWelfare").default(0).notNull(),
  advertising: int("advertising").default(0).notNull(),
  travelVehicle: int("travelVehicle").default(0).notNull(),
  communication: int("communication").default(0).notNull(),
  consumables: int("consumables").default(0).notNull(),
  utilities: int("utilities").default(0).notNull(),
  rent: int("rent").default(0).notNull(),
  leaseLoan: int("leaseLoan").default(0).notNull(),
  paymentFee: int("paymentFee").default(0).notNull(),
  paymentCommission: int("paymentCommission").default(0).notNull(),
  paymentInterest: int("paymentInterest").default(0).notNull(),
  miscellaneous: int("miscellaneous").default(0).notNull(),
  pettyCash: int("pettyCash").default(0).notNull(),
  cardPayment: int("cardPayment").default(0).notNull(),
  representativeLoanRepayment: int("representativeLoanRepayment").default(0).notNull(),
  shortTermLoanRepayment: int("shortTermLoanRepayment").default(0).notNull(),
  longTermLoanRepayment: int("longTermLoanRepayment").default(0).notNull(),
  regularDeposit: int("regularDeposit").default(0).notNull(),
  taxPayment: int("taxPayment").default(0).notNull(),
  otherNonBusinessExpense: int("otherNonBusinessExpense").default(0).notNull(),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ExpenseRecord = typeof expenseRecords.$inferSelect;
export type InsertExpenseRecord = typeof expenseRecords.$inferInsert;

/**
 * Billing data (請求データ) table
 */
export const billingData = mysqlTable("billing_data", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  billingYearMonth: varchar("billingYearMonth", { length: 6 }).notNull(), // YYYYMM format
  serviceYearMonth: varchar("serviceYearMonth", { length: 6 }).notNull(), // YYYYMM format
  userName: varchar("userName", { length: 255 }).notNull(),
  totalCost: int("totalCost").default(0).notNull(),
  insurancePayment: int("insurancePayment").default(0).notNull(),
  publicPayment: int("publicPayment").default(0).notNull(),
  reduction: int("reduction").default(0).notNull(),
  userBurdenTransfer: int("userBurdenTransfer").default(0).notNull(),
  userBurdenWithdrawal: int("userBurdenWithdrawal").default(0).notNull(),
  isTransfer: boolean("isTransfer").default(false).notNull(), // 振込チェック（true: 振込、false: 口座振替）
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BillingData = typeof billingData.$inferSelect;
export type InsertBillingData = typeof billingData.$inferInsert;

/**
 * Factoring settings (ファクタリング設定) table
 */
export const factoringSettings = mysqlTable("factoring_settings", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  factoringRate: int("factoringRate").default(8000).notNull(), // 80.00% stored as 8000 (basis points)
  remainingRate: int("remainingRate").default(2000).notNull(), // 20.00% stored as 2000 (basis points)
  feeRate: int("feeRate").default(70).notNull(), // 0.700% stored as 70 (basis points)
  usageFee: int("usageFee").default(2000).notNull(), // ¥2,000
  paymentDay: int("paymentDay").default(15).notNull(), // 翌月15日
  remainingPaymentDay: int("remainingPaymentDay").default(5).notNull(), // 翌々翌月5日
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FactoringSetting = typeof factoringSettings.$inferSelect;
export type InsertFactoringSetting = typeof factoringSettings.$inferInsert;

/**
 * Budget (予算) table
 */
export const budgets = mysqlTable("budgets", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  yearMonth: varchar("yearMonth", { length: 7 }).notNull(), // YYYY-MM format
  category: varchar("category", { length: 50 }).notNull(), // 'income' or 'expense'
  itemName: varchar("itemName", { length: 255 }).notNull(),
  amount: int("amount").default(0).notNull(),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Budget = typeof budgets.$inferSelect;
export type InsertBudget = typeof budgets.$inferInsert;

/**
 * Loans (借入返済管理) table
 */
export const loans = mysqlTable("loans", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  financialInstitution: varchar("financialInstitution", { length: 255 }).notNull(), // 金融機関
  branchName: varchar("branchName", { length: 255 }), // 支店名
  repaymentMethod: mysqlEnum("repaymentMethod", ["equal_principal", "equal_installment"]).notNull(), // 返済方法: 元金均等/元利均等
  annualInterestRate: decimal("annualInterestRate", { precision: 5, scale: 3 }).default("0.000").notNull(), // 年利（%）
  initialBorrowingDate: date("initialBorrowingDate").notNull(), // 当初借入日
  repaymentDueDate: int("repaymentDueDate").notNull(), // 返済期日（毎月の日付、1-31）
  initialBorrowingAmount: int("initialBorrowingAmount").default(0).notNull(), // 当初借入額
  repaymentPrincipal: int("repaymentPrincipal").default(0).notNull(), // 返済元金（現在の残高）
  firstRepaymentDate: date("firstRepaymentDate").notNull(), // 初回返済日
  isActive: boolean("isActive").default(true).notNull(), // 有効/無効フラグ
  effectiveFrom: date("effectiveFrom").notNull(), // 適用開始日
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Loan = typeof loans.$inferSelect;
export type InsertLoan = typeof loans.$inferInsert;

/**
 * Loan history (借入履歴管理) table
 * 借入の追加・編集・on/offの履歴を管理
 */
export const loanHistory = mysqlTable("loan_history", {
  id: int("id").autoincrement().primaryKey(),
  loanId: int("loanId").notNull(), // loansテーブルのID
  organizationId: int("organizationId").notNull(),
  action: mysqlEnum("action", ["create", "update", "activate", "deactivate"]).notNull(), // アクション種別
  effectiveFrom: date("effectiveFrom").notNull(), // 適用開始日
  // 変更前の値（JSON形式で保存）
  previousValues: text("previousValues"), // JSON形式
  // 変更後の値（JSON形式で保存）
  newValues: text("newValues"), // JSON形式
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LoanHistory = typeof loanHistory.$inferSelect;
export type InsertLoanHistory = typeof loanHistory.$inferInsert;

/**
 * Month status (月ごとのステータス管理) table
 * 各月の確定/見込み/予測ステータスを管理
 */
export const monthStatuses = mysqlTable("month_statuses", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  yearMonth: varchar("yearMonth", { length: 7 }).notNull(), // YYYY-MM format
  status: mysqlEnum("status", ["actual", "forecast", "prediction"]).default("actual").notNull(),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MonthStatus = typeof monthStatuses.$inferSelect;
export type InsertMonthStatus = typeof monthStatuses.$inferInsert;
