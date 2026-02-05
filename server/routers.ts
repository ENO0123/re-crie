import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "./db";
import { normalizeNumericInput, parseYYYYMM, formatYYYYMM } from "../shared/utils";
import { calculateIncomeByStatus, calculateExpenseByStatus } from "./statusCalculator";
import { getMonthStatus, getMonthStatuses, upsertMonthStatus } from "./db";
import { sdk } from "./_core/sdk";
import { ENV } from "./_core/env";
import bcrypt from "bcryptjs";

// Role-based procedures
const editorProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin' && ctx.user.role !== 'editor' && ctx.user.role !== 'headquarters') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Editor role required' });
  }
  return next({ ctx });
});

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin' && ctx.user.role !== 'headquarters') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin role required' });
  }
  return next({ ctx });
});

const headquartersProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'headquarters') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Headquarters role required' });
  }
  return next({ ctx });
});

// データアクセス制御ヘルパー関数
function getEffectiveOrganizationId(user: { role: string; organizationId: number | null }, requestedOrgId?: number | null): number {
  // 本部担当者は全組織にアクセス可能（組織IDの指定が必要）
  if (user.role === 'headquarters') {
    if (!requestedOrgId) {
      throw new TRPCError({ 
        code: 'BAD_REQUEST', 
        message: '本部担当者は組織IDの指定が必要です。クエリパラメータにorganizationIdを指定してください。' 
      });
    }
    return requestedOrgId;
  }
  
  // 各社アカウントは自分の組織のみアクセス可能
  if (!user.organizationId) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: '組織が設定されていません' });
  }
  
  // 他社の組織IDを指定された場合はエラー（各社アカウントは他社のデータにアクセス不可）
  if (requestedOrgId && requestedOrgId !== user.organizationId) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'この組織へのアクセスは許可されていません' });
  }
  
  // 組織IDが指定されていない場合は、ユーザーの組織IDを使用
  return user.organizationId;
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    // 開発環境用: ユーザー作成エンドポイント
    createUser: publicProcedure
      .input(z.object({
        email: z.string().email("有効なメールアドレスを入力してください"),
        password: z.string().min(1, "パスワードを入力してください"),
        name: z.string().min(1, "名前を入力してください"),
      }))
      .mutation(async ({ ctx, input }) => {
        // 開発環境でのみ許可
        if (ENV.isProduction) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "このエンドポイントは開発環境でのみ使用できます",
          });
        }

        // 既存ユーザーをチェック
        const existingUser = await db.getUserByEmail(input.email);
        if (existingUser) {
          // 既存ユーザーのパスワードを更新
          const passwordHash = await bcrypt.hash(input.password, 10);
          await db.upsertUser({
            openId: existingUser.openId,
            email: input.email,
            name: input.name,
            passwordHash: passwordHash,
            role: "admin",
          });
          return {
            success: true,
            message: "既存ユーザーのパスワードを更新しました",
            user: {
              id: existingUser.id,
              openId: existingUser.openId,
              name: input.name,
              email: input.email,
              role: "admin",
            },
          };
        }

        // 新規ユーザーを作成
        const passwordHash = await bcrypt.hash(input.password, 10);
        const openId = `email:${input.email}`;
        
        await db.upsertUser({
          openId: openId,
          email: input.email,
          name: input.name,
          passwordHash: passwordHash,
          role: "admin",
        });

        const createdUser = await db.getUserByEmail(input.email);
        if (!createdUser) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "ユーザーの作成に失敗しました",
          });
        }

        return {
          success: true,
          message: "ユーザーが正常に作成されました",
          user: {
            id: createdUser.id,
            openId: createdUser.openId,
            name: createdUser.name,
            email: createdUser.email,
            role: createdUser.role,
          },
        };
      }),
    login: publicProcedure
      .input(z.object({
        email: z.string().email("有効なメールアドレスを入力してください"),
        password: z.string().min(1, "パスワードを入力してください"),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          // ユーザーをメールアドレスで検索
          const user = await db.getUserByEmail(input.email);
          
          if (!user) {
            throw new TRPCError({
              code: "UNAUTHORIZED",
              message: "メールアドレスまたはパスワードが正しくありません",
            });
          }

          // パスワードハッシュがない場合（OAuthユーザーなど）はエラー
          if (!user.passwordHash) {
            throw new TRPCError({
              code: "UNAUTHORIZED",
              message: "このアカウントはID/パスワードログインに対応していません",
            });
          }

          // パスワードを検証
          const isValidPassword = await bcrypt.compare(input.password, user.passwordHash);
          if (!isValidPassword) {
            throw new TRPCError({
              code: "UNAUTHORIZED",
              message: "メールアドレスまたはパスワードが正しくありません",
            });
          }

          // セッショントークンを発行
          const sessionToken = await sdk.signSession({
            openId: user.openId,
            appId: ENV.appId || "default-app",
            name: user.name || "",
          }, {
            expiresInMs: ONE_YEAR_MS,
          });

          // 最終ログイン時刻を更新
          await db.upsertUser({
            openId: user.openId,
            lastSignedIn: new Date(),
          });

          // クッキーにセッショントークンを設定
          const cookieOptions = getSessionCookieOptions(ctx.req);
          ctx.res.cookie(COOKIE_NAME, sessionToken, {
            ...cookieOptions,
            maxAge: ONE_YEAR_MS,
          });

          return {
            success: true,
            user: {
              id: user.id,
              openId: user.openId,
              name: user.name,
              email: user.email,
              role: user.role,
              organizationId: user.organizationId,
            },
          };
        } catch (error) {
          // データベースエラーの場合
          if (error instanceof TRPCError) {
            throw error;
          }
          console.error("[Auth] Login error:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error instanceof Error ? error.message : "ログイン処理中にエラーが発生しました",
          });
        }
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    changePassword: protectedProcedure
      .input(z.object({
        currentPassword: z.string().min(1, "現在のパスワードを入力してください"),
        newPassword: z.string().min(8, "新しいパスワードは8文字以上である必要があります"),
      }))
      .mutation(async ({ ctx, input }) => {
        const user = ctx.user;
        
        if (!user) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "認証が必要です",
          });
        }

        // ユーザーを取得（最新の情報を取得）
        const dbUser = await db.getUserByOpenId(user.openId);
        if (!dbUser) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "ユーザーが見つかりません",
          });
        }

        // パスワードハッシュがない場合（OAuthユーザーなど）はエラー
        if (!dbUser.passwordHash) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "このアカウントはID/パスワードログインに対応していません",
          });
        }

        // 現在のパスワードを検証
        const isValidPassword = await bcrypt.compare(input.currentPassword, dbUser.passwordHash);
        if (!isValidPassword) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "現在のパスワードが正しくありません",
          });
        }

        // 新しいパスワードをハッシュ化
        const newPasswordHash = await bcrypt.hash(input.newPassword, 10);

        // パスワードを更新
        await db.upsertUser({
          openId: user.openId,
          passwordHash: newPasswordHash,
        });

        return {
          success: true,
          message: "パスワードが正常に変更されました",
        };
      }),
  }),

  // Bank balance operations
  bankBalance: router({
    list: protectedProcedure
      .input(z.object({ 
        limit: z.number().optional(),
        organizationId: z.number().optional(), // 本部担当者用
      }))
      .query(async ({ ctx, input }) => {
        const orgId = getEffectiveOrganizationId(ctx.user, input.organizationId);
        return db.getBankBalances(orgId, input.limit);
      }),
    
    getByYearMonth: protectedProcedure
      .input(z.object({ 
        yearMonth: z.string(),
        organizationId: z.number().optional(), // 本部担当者用
      }))
      .query(async ({ ctx, input }) => {
        const orgId = getEffectiveOrganizationId(ctx.user, input.organizationId);
        return db.getBankBalanceByYearMonth(orgId, input.yearMonth);
      }),
    
    upsert: editorProcedure
      .input(z.object({
        yearMonth: z.string(),
        balance1: z.union([z.string(), z.number()]).optional(),
        balance2: z.union([z.string(), z.number()]).optional(),
        balance3: z.union([z.string(), z.number()]).optional(),
        balance4: z.union([z.string(), z.number()]).optional(),
        balance5: z.union([z.string(), z.number()]).optional(),
        organizationId: z.number().optional(), // 本部担当者用
      }))
      .mutation(async ({ ctx, input }) => {
        const orgId = getEffectiveOrganizationId(ctx.user, input.organizationId);
        
        const b1 = normalizeNumericInput(input.balance1);
        const b2 = normalizeNumericInput(input.balance2);
        const b3 = normalizeNumericInput(input.balance3);
        const b4 = normalizeNumericInput(input.balance4);
        const b5 = normalizeNumericInput(input.balance5);
        const total = b1 + b2 + b3 + b4 + b5;
        
        return db.upsertBankBalance({
          organizationId: orgId,
          yearMonth: input.yearMonth,
          balance1: b1,
          balance2: b2,
          balance3: b3,
          balance4: b4,
          balance5: b5,
          totalBalance: total,
          createdBy: ctx.user.id,
        });
      }),
  }),

  // Income record operations
  income: router({
    list: protectedProcedure
      .input(z.object({ 
        limit: z.number().optional(),
        organizationId: z.number().optional(), // 本部担当者用
      }))
      .query(async ({ ctx, input }) => {
        const orgId = getEffectiveOrganizationId(ctx.user, input.organizationId);
        return db.getIncomeRecords(orgId, input.limit);
      }),
    
    getByYearMonth: protectedProcedure
      .input(z.object({ 
        yearMonth: z.string(),
        organizationId: z.number().optional(), // 本部担当者用
      }))
      .query(async ({ ctx, input }) => {
        const orgId = getEffectiveOrganizationId(ctx.user, input.organizationId);
        console.log(`[Income.getByYearMonth] organizationId: ${orgId}, yearMonth: ${input.yearMonth}`);
        const result = await db.getIncomeRecordByYearMonth(orgId, input.yearMonth);
        console.log(`[Income.getByYearMonth] result:`, result ? 'found' : 'not found');
        return result;
      }),
    
    getByStatus: protectedProcedure
      .input(z.object({ 
        yearMonth: z.string(),
        status: z.enum(["actual", "forecast", "prediction"]),
        organizationId: z.number().optional(), // 本部担当者用
      }))
      .query(async ({ ctx, input }) => {
        const orgId = getEffectiveOrganizationId(ctx.user, input.organizationId);
        console.log(`[Income.getByStatus] organizationId: ${orgId}, yearMonth: ${input.yearMonth}, status: ${input.status}`);
        const result = await calculateIncomeByStatus(orgId, input.yearMonth, input.status);
        console.log(`[Income.getByStatus] result keys:`, Object.keys(result));
        return result;
      }),
    
    listByStatus: protectedProcedure
      .input(z.object({ 
        yearMonths: z.array(z.string()),
        status: z.enum(["actual", "forecast", "prediction"]),
        organizationId: z.number().optional(), // 本部担当者用
      }))
      .query(async ({ ctx, input }) => {
        const orgId = getEffectiveOrganizationId(ctx.user, input.organizationId);
        const results = await Promise.all(
          input.yearMonths.map(yearMonth => 
            calculateIncomeByStatus(orgId, yearMonth, input.status)
              .then(data => ({ ...data, yearMonth, id: yearMonth }))
          )
        );
        return results;
      }),
    
    upsert: editorProcedure
      .input(z.object({
        yearMonth: z.string(),
        insuranceIncome: z.union([z.string(), z.number()]).optional(),
        userBurdenTransfer: z.union([z.string(), z.number()]).optional(),
        userBurdenWithdrawal: z.union([z.string(), z.number()]).optional(),
        factoringIncome1: z.union([z.string(), z.number()]).optional(),
        factoringIncome2: z.union([z.string(), z.number()]).optional(),
        otherBusinessIncome: z.union([z.string(), z.number()]).optional(),
        representativeLoan: z.union([z.string(), z.number()]).optional(),
        shortTermLoan: z.union([z.string(), z.number()]).optional(),
        longTermLoan: z.union([z.string(), z.number()]).optional(),
        interestIncome: z.union([z.string(), z.number()]).optional(),
        otherNonBusinessIncome: z.union([z.string(), z.number()]).optional(),
        organizationId: z.number().optional(), // 本部担当者用
      }))
      .mutation(async ({ ctx, input }) => {
        const orgId = getEffectiveOrganizationId(ctx.user, input.organizationId);
        
        return db.upsertIncomeRecord({
          organizationId: orgId,
          yearMonth: input.yearMonth,
          insuranceIncome: normalizeNumericInput(input.insuranceIncome),
          userBurdenTransfer: normalizeNumericInput(input.userBurdenTransfer),
          userBurdenWithdrawal: normalizeNumericInput(input.userBurdenWithdrawal),
          factoringIncome1: normalizeNumericInput(input.factoringIncome1),
          factoringIncome2: normalizeNumericInput(input.factoringIncome2),
          otherBusinessIncome: normalizeNumericInput(input.otherBusinessIncome),
          representativeLoan: normalizeNumericInput(input.representativeLoan),
          shortTermLoan: normalizeNumericInput(input.shortTermLoan),
          longTermLoan: normalizeNumericInput(input.longTermLoan),
          interestIncome: normalizeNumericInput(input.interestIncome),
          otherNonBusinessIncome: normalizeNumericInput(input.otherNonBusinessIncome),
          createdBy: ctx.user.id,
        });
      }),
  }),

  // Expense record operations
  expense: router({
    list: protectedProcedure
      .input(z.object({ 
        limit: z.number().optional(),
        organizationId: z.number().optional(), // 本部担当者用
      }))
      .query(async ({ ctx, input }) => {
        const orgId = getEffectiveOrganizationId(ctx.user, input.organizationId);
        return db.getExpenseRecords(orgId, input.limit);
      }),
    
    getByYearMonth: protectedProcedure
      .input(z.object({ 
        yearMonth: z.string(),
        organizationId: z.number().optional(), // 本部担当者用
      }))
      .query(async ({ ctx, input }) => {
        const orgId = getEffectiveOrganizationId(ctx.user, input.organizationId);
        console.log(`[Expense.getByYearMonth] organizationId: ${orgId}, yearMonth: ${input.yearMonth}`);
        const result = await db.getExpenseRecordByYearMonth(orgId, input.yearMonth);
        console.log(`[Expense.getByYearMonth] result:`, result ? 'found' : 'not found');
        return result;
      }),
    
    getByStatus: protectedProcedure
      .input(z.object({ 
        yearMonth: z.string(),
        status: z.enum(["actual", "forecast", "prediction"]),
        organizationId: z.number().optional(), // 本部担当者用
      }))
      .query(async ({ ctx, input }) => {
        const orgId = getEffectiveOrganizationId(ctx.user, input.organizationId);
        console.log(`[Expense.getByStatus] organizationId: ${orgId}, yearMonth: ${input.yearMonth}, status: ${input.status}`);
        const result = await calculateExpenseByStatus(orgId, input.yearMonth, input.status);
        console.log(`[Expense.getByStatus] result keys:`, Object.keys(result));
        return result;
      }),
    
    listByStatus: protectedProcedure
      .input(z.object({ 
        yearMonths: z.array(z.string()),
        status: z.enum(["actual", "forecast", "prediction"]),
        organizationId: z.number().optional(), // 本部担当者用
      }))
      .query(async ({ ctx, input }) => {
        const orgId = getEffectiveOrganizationId(ctx.user, input.organizationId);
        const results = await Promise.all(
          input.yearMonths.map(yearMonth => 
            calculateExpenseByStatus(orgId, yearMonth, input.status)
              .then(data => ({ ...data, yearMonth, id: yearMonth }))
          )
        );
        return results;
      }),
    
    upsert: editorProcedure
      .input(z.object({
        yearMonth: z.string(),
        personnelCost: z.union([z.string(), z.number()]).optional(),
        legalWelfare: z.union([z.string(), z.number()]).optional(),
        advertising: z.union([z.string(), z.number()]).optional(),
        travelVehicle: z.union([z.string(), z.number()]).optional(),
        communication: z.union([z.string(), z.number()]).optional(),
        consumables: z.union([z.string(), z.number()]).optional(),
        utilities: z.union([z.string(), z.number()]).optional(),
        rent: z.union([z.string(), z.number()]).optional(),
        leaseLoan: z.union([z.string(), z.number()]).optional(),
        paymentFee: z.union([z.string(), z.number()]).optional(),
        paymentCommission: z.union([z.string(), z.number()]).optional(),
        paymentInterest: z.union([z.string(), z.number()]).optional(),
        miscellaneous: z.union([z.string(), z.number()]).optional(),
        pettyCash: z.union([z.string(), z.number()]).optional(),
        cardPayment: z.union([z.string(), z.number()]).optional(),
        representativeLoanRepayment: z.union([z.string(), z.number()]).optional(),
        shortTermLoanRepayment: z.union([z.string(), z.number()]).optional(),
        longTermLoanRepayment: z.union([z.string(), z.number()]).optional(),
        regularDeposit: z.union([z.string(), z.number()]).optional(),
        taxPayment: z.union([z.string(), z.number()]).optional(),
        otherNonBusinessExpense: z.union([z.string(), z.number()]).optional(),
        organizationId: z.number().optional(), // 本部担当者用
      }))
      .mutation(async ({ ctx, input }) => {
        const orgId = getEffectiveOrganizationId(ctx.user, input.organizationId);
        
        return db.upsertExpenseRecord({
          organizationId: orgId,
          yearMonth: input.yearMonth,
          personnelCost: normalizeNumericInput(input.personnelCost),
          legalWelfare: normalizeNumericInput(input.legalWelfare),
          advertising: normalizeNumericInput(input.advertising),
          travelVehicle: normalizeNumericInput(input.travelVehicle),
          communication: normalizeNumericInput(input.communication),
          consumables: normalizeNumericInput(input.consumables),
          utilities: normalizeNumericInput(input.utilities),
          rent: normalizeNumericInput(input.rent),
          leaseLoan: normalizeNumericInput(input.leaseLoan),
          paymentFee: normalizeNumericInput(input.paymentFee),
          paymentCommission: normalizeNumericInput(input.paymentCommission),
          paymentInterest: normalizeNumericInput(input.paymentInterest),
          miscellaneous: normalizeNumericInput(input.miscellaneous),
          pettyCash: normalizeNumericInput(input.pettyCash),
          cardPayment: normalizeNumericInput(input.cardPayment),
          representativeLoanRepayment: normalizeNumericInput(input.representativeLoanRepayment),
          shortTermLoanRepayment: normalizeNumericInput(input.shortTermLoanRepayment),
          longTermLoanRepayment: normalizeNumericInput(input.longTermLoanRepayment),
          regularDeposit: normalizeNumericInput(input.regularDeposit),
          taxPayment: normalizeNumericInput(input.taxPayment),
          otherNonBusinessExpense: normalizeNumericInput(input.otherNonBusinessExpense),
          createdBy: ctx.user.id,
        });
      }),
  }),

  // Billing data operations
  billing: router({
    list: protectedProcedure
      .input(z.object({ 
        page: z.number().default(1),
        pageSize: z.number().default(50),
        organizationId: z.number().optional(), // 本部担当者用
      }))
      .query(async ({ ctx, input }) => {
        const orgId = getEffectiveOrganizationId(ctx.user, input.organizationId);
        return db.getBillingDataList(orgId, input.page, input.pageSize);
      }),
    
    search: protectedProcedure
      .input(z.object({
        billingYearMonth: z.string().optional(),
        serviceYearMonth: z.string().optional(),
        userName: z.string().optional(),
        page: z.number().default(1),
        pageSize: z.number().default(50),
        organizationId: z.number().optional(), // 本部担当者用
      }))
      .query(async ({ ctx, input }) => {
        const orgId = getEffectiveOrganizationId(ctx.user, input.organizationId);
        return db.searchBillingData(
          orgId,
          {
            billingYearMonth: input.billingYearMonth,
            serviceYearMonth: input.serviceYearMonth,
            userName: input.userName,
          },
          input.page,
          input.pageSize
        );
      }),
    
    create: editorProcedure
      .input(z.object({
        billingYearMonth: z.string(),
        serviceYearMonth: z.string(),
        userName: z.string(),
        totalCost: z.union([z.string(), z.number()]),
        insurancePayment: z.union([z.string(), z.number()]),
        publicPayment: z.union([z.string(), z.number()]),
        reduction: z.union([z.string(), z.number()]),
        userBurdenTransfer: z.union([z.string(), z.number()]),
        userBurdenWithdrawal: z.union([z.string(), z.number()]),
        organizationId: z.number().optional(), // 本部担当者用
      }))
      .mutation(async ({ ctx, input }) => {
        const orgId = getEffectiveOrganizationId(ctx.user, input.organizationId);
        
        return db.createBillingData({
          organizationId: orgId,
          billingYearMonth: formatYYYYMM(input.billingYearMonth),
          serviceYearMonth: formatYYYYMM(input.serviceYearMonth),
          userName: input.userName,
          totalCost: normalizeNumericInput(input.totalCost),
          insurancePayment: normalizeNumericInput(input.insurancePayment),
          publicPayment: normalizeNumericInput(input.publicPayment),
          reduction: normalizeNumericInput(input.reduction),
          userBurdenTransfer: normalizeNumericInput(input.userBurdenTransfer),
          userBurdenWithdrawal: normalizeNumericInput(input.userBurdenWithdrawal),
          createdBy: ctx.user.id,
        });
      }),
    
    update: editorProcedure
      .input(z.object({
        id: z.number(),
        billingYearMonth: z.string().optional(),
        serviceYearMonth: z.string().optional(),
        userName: z.string().optional(),
        totalCost: z.union([z.string(), z.number()]).optional(),
        insurancePayment: z.union([z.string(), z.number()]).optional(),
        publicPayment: z.union([z.string(), z.number()]).optional(),
        reduction: z.union([z.string(), z.number()]).optional(),
        userBurdenTransfer: z.union([z.string(), z.number()]).optional(),
        userBurdenWithdrawal: z.union([z.string(), z.number()]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        const normalized: any = {};
        
        if (data.billingYearMonth) normalized.billingYearMonth = formatYYYYMM(data.billingYearMonth);
        if (data.serviceYearMonth) normalized.serviceYearMonth = formatYYYYMM(data.serviceYearMonth);
        if (data.userName) normalized.userName = data.userName;
        if (data.totalCost !== undefined) normalized.totalCost = normalizeNumericInput(data.totalCost);
        if (data.insurancePayment !== undefined) normalized.insurancePayment = normalizeNumericInput(data.insurancePayment);
        if (data.publicPayment !== undefined) normalized.publicPayment = normalizeNumericInput(data.publicPayment);
        if (data.reduction !== undefined) normalized.reduction = normalizeNumericInput(data.reduction);
        if (data.userBurdenTransfer !== undefined) normalized.userBurdenTransfer = normalizeNumericInput(data.userBurdenTransfer);
        if (data.userBurdenWithdrawal !== undefined) normalized.userBurdenWithdrawal = normalizeNumericInput(data.userBurdenWithdrawal);
        
        return db.updateBillingData(id, normalized);
      }),
    
    delete: editorProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return db.deleteBillingData(input.id);
      }),
    
    deleteBatch: editorProcedure
      .input(z.object({ ids: z.array(z.number()) }))
      .mutation(async ({ input }) => {
        return db.deleteBillingDataBatch(input.ids);
      }),
  }),

  // Factoring settings operations
  factoring: router({
    getSetting: protectedProcedure
      .input(z.object({
        organizationId: z.number().optional(), // 本部担当者用
      }).optional())
      .query(async ({ ctx, input }) => {
        const orgId = getEffectiveOrganizationId(ctx.user, input?.organizationId);
        return db.getFactoringSetting(orgId);
      }),
    
    upsertSetting: editorProcedure
      .input(z.object({
        factoringRate: z.number(),
        remainingRate: z.number(),
        feeRate: z.number(),
        usageFee: z.number(),
        paymentDay: z.number(),
        remainingPaymentDay: z.number(),
        organizationId: z.number().optional(), // 本部担当者用
      }))
      .mutation(async ({ ctx, input }) => {
        const orgId = getEffectiveOrganizationId(ctx.user, input.organizationId);
        
        return db.upsertFactoringSetting({
          organizationId: orgId,
          factoringRate: input.factoringRate,
          remainingRate: input.remainingRate,
          feeRate: input.feeRate,
          usageFee: input.usageFee,
          paymentDay: input.paymentDay,
          remainingPaymentDay: input.remainingPaymentDay,
          createdBy: ctx.user.id,
        });
      }),
  }),

  // Budget operations
  budget: router({
    list: protectedProcedure
      .input(z.object({ 
        yearMonth: z.string(),
        organizationId: z.number().optional(), // 本部担当者用
      }))
      .query(async ({ ctx, input }) => {
        const orgId = getEffectiveOrganizationId(ctx.user, input.organizationId);
        return db.getBudgets(orgId, input.yearMonth);
      }),
    
    upsert: editorProcedure
      .input(z.object({
        yearMonth: z.string(),
        category: z.string(),
        itemName: z.string(),
        amount: z.union([z.string(), z.number()]),
        organizationId: z.number().optional(), // 本部担当者用
      }))
      .mutation(async ({ ctx, input }) => {
        const orgId = getEffectiveOrganizationId(ctx.user, input.organizationId);
        
        return db.upsertBudget({
          organizationId: orgId,
          yearMonth: input.yearMonth,
          category: input.category,
          itemName: input.itemName,
          amount: normalizeNumericInput(input.amount),
          createdBy: ctx.user.id,
        });
      }),
  }),

  // Organization operations
  organization: router({
    list: headquartersProcedure.query(async () => {
      return db.getAllOrganizations();
    }),
    create: adminProcedure
      .input(z.object({ name: z.string() }))
      .mutation(async ({ input }) => {
        return db.createOrganization({ name: input.name });
      }),
  }),

  // Loan operations
  loan: router({
    list: protectedProcedure
      .input(z.object({
        organizationId: z.number().optional(), // 本部担当者用
      }).optional())
      .query(async ({ ctx, input }) => {
        const orgId = getEffectiveOrganizationId(ctx.user, input?.organizationId);
        return db.getLoans(orgId);
      }),
    
    create: editorProcedure
      .input(z.object({
        financialInstitution: z.string(),
        branchName: z.string().optional(),
        repaymentMethod: z.enum(["equal_principal", "equal_installment"]),
        annualInterestRate: z.union([z.string(), z.number()]),
        initialBorrowingDate: z.string(),
        repaymentDueDate: z.number(),
        initialBorrowingAmount: z.union([z.string(), z.number()]),
        repaymentPrincipal: z.union([z.string(), z.number()]),
        firstRepaymentDate: z.string(),
        effectiveFrom: z.string(),
        organizationId: z.number().optional(), // 本部担当者用
      }))
      .mutation(async ({ ctx, input }) => {
        const orgId = getEffectiveOrganizationId(ctx.user, input.organizationId);
        
        // annualInterestRateはdecimal型なので、文字列として保存（例: "1.500"）
        const annualInterestRateValue = typeof input.annualInterestRate === 'string' 
          ? input.annualInterestRate 
          : String(input.annualInterestRate);
        
        const loanId = await db.createLoan({
          organizationId: orgId,
          financialInstitution: input.financialInstitution,
          branchName: input.branchName || null,
          repaymentMethod: input.repaymentMethod,
          annualInterestRate: annualInterestRateValue,
          initialBorrowingDate: new Date(input.initialBorrowingDate),
          repaymentDueDate: input.repaymentDueDate,
          initialBorrowingAmount: normalizeNumericInput(input.initialBorrowingAmount),
          repaymentPrincipal: normalizeNumericInput(input.repaymentPrincipal),
          firstRepaymentDate: new Date(input.firstRepaymentDate),
          isActive: true,
          effectiveFrom: new Date(input.effectiveFrom),
          createdBy: ctx.user.id,
        });
        
        return { id: loanId };
      }),
    
    update: editorProcedure
      .input(z.object({
        id: z.number(),
        financialInstitution: z.string().optional(),
        branchName: z.string().optional(),
        repaymentMethod: z.enum(["equal_principal", "equal_installment"]).optional(),
        annualInterestRate: z.union([z.string(), z.number()]).optional(),
        initialBorrowingDate: z.string().optional(),
        repaymentDueDate: z.number().optional(),
        initialBorrowingAmount: z.union([z.string(), z.number()]).optional(),
        repaymentPrincipal: z.union([z.string(), z.number()]).optional(),
        firstRepaymentDate: z.string().optional(),
        effectiveFrom: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        const updateData: any = {};
        
        if (data.financialInstitution !== undefined) updateData.financialInstitution = data.financialInstitution;
        if (data.branchName !== undefined) updateData.branchName = data.branchName || null;
        if (data.repaymentMethod !== undefined) updateData.repaymentMethod = data.repaymentMethod;
        if (data.annualInterestRate !== undefined) {
          // annualInterestRateはdecimal型なので、文字列として保存
          updateData.annualInterestRate = typeof data.annualInterestRate === 'string' 
            ? data.annualInterestRate 
            : String(data.annualInterestRate);
        }
        if (data.initialBorrowingDate !== undefined) updateData.initialBorrowingDate = new Date(data.initialBorrowingDate);
        if (data.repaymentDueDate !== undefined) updateData.repaymentDueDate = data.repaymentDueDate;
        if (data.initialBorrowingAmount !== undefined) updateData.initialBorrowingAmount = normalizeNumericInput(data.initialBorrowingAmount);
        if (data.repaymentPrincipal !== undefined) updateData.repaymentPrincipal = normalizeNumericInput(data.repaymentPrincipal);
        if (data.firstRepaymentDate !== undefined) updateData.firstRepaymentDate = new Date(data.firstRepaymentDate);
        if (data.effectiveFrom !== undefined) updateData.effectiveFrom = new Date(data.effectiveFrom);
        
        await db.updateLoan(id, updateData);
        return { success: true };
      }),
    
    toggleActive: editorProcedure
      .input(z.object({
        id: z.number(),
        isActive: z.boolean(),
        effectiveFrom: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.updateLoan(input.id, {
          isActive: input.isActive,
          effectiveFrom: new Date(input.effectiveFrom),
        });
        return { success: true };
      }),
    
    delete: editorProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteLoan(input.id);
        return { success: true };
      }),
  }),

  // Month status operations
  monthStatus: router({
    get: protectedProcedure
      .input(z.object({ 
        yearMonth: z.string(),
        organizationId: z.number().optional(), // 本部担当者用
      }))
      .query(async ({ ctx, input }) => {
        const orgId = getEffectiveOrganizationId(ctx.user, input.organizationId);
        return getMonthStatus(orgId, input.yearMonth);
      }),
    
    list: protectedProcedure
      .input(z.object({ 
        yearMonths: z.array(z.string()).optional(),
        organizationId: z.number().optional(), // 本部担当者用
      }))
      .query(async ({ ctx, input }) => {
        const orgId = getEffectiveOrganizationId(ctx.user, input.organizationId);
        try {
          console.log(`[MonthStatus.list] organizationId: ${orgId}, yearMonths:`, input.yearMonths);
          const result = await getMonthStatuses(orgId, input.yearMonths);
          console.log(`[MonthStatus.list] result count:`, result.length);
          return result;
        } catch (error) {
          console.error("[MonthStatus.list] Error:", error);
          if (error instanceof Error) {
            console.error("[MonthStatus.list] Error message:", error.message);
            console.error("[MonthStatus.list] Error stack:", error.stack);
          }
          throw new TRPCError({ 
            code: 'INTERNAL_SERVER_ERROR', 
            message: `Failed to get month statuses: ${error instanceof Error ? error.message : 'Unknown error'}` 
          });
        }
      }),
    
    upsert: editorProcedure
      .input(z.object({
        yearMonth: z.string(),
        status: z.enum(["actual", "forecast", "prediction"]),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user.organizationId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Organization not set' });
        }
        return upsertMonthStatus({
          organizationId: ctx.user.organizationId,
          yearMonth: input.yearMonth,
          status: input.status,
          createdBy: ctx.user.id,
        });
      }),
  }),
});

export type AppRouter = typeof appRouter;
