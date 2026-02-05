import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "./db";
import { normalizeNumericInput, parseYYYYMM, formatYYYYMM } from "../shared/utils";
import { calculateIncomeByStatus, calculateExpenseByStatus } from "./statusCalculator";
import { getMonthStatus, getMonthStatuses, upsertMonthStatus } from "./db";

// Role-based procedures
const editorProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin' && ctx.user.role !== 'editor') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Editor role required' });
  }
  return next({ ctx });
});

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin role required' });
  }
  return next({ ctx });
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // Bank balance operations
  bankBalance: router({
    list: protectedProcedure
      .input(z.object({ limit: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        if (!ctx.user.organizationId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Organization not set' });
        }
        return db.getBankBalances(ctx.user.organizationId, input.limit);
      }),
    
    getByYearMonth: protectedProcedure
      .input(z.object({ yearMonth: z.string() }))
      .query(async ({ ctx, input }) => {
        if (!ctx.user.organizationId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Organization not set' });
        }
        return db.getBankBalanceByYearMonth(ctx.user.organizationId, input.yearMonth);
      }),
    
    upsert: editorProcedure
      .input(z.object({
        yearMonth: z.string(),
        balance1: z.union([z.string(), z.number()]).optional(),
        balance2: z.union([z.string(), z.number()]).optional(),
        balance3: z.union([z.string(), z.number()]).optional(),
        balance4: z.union([z.string(), z.number()]).optional(),
        balance5: z.union([z.string(), z.number()]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user.organizationId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Organization not set' });
        }
        
        const b1 = normalizeNumericInput(input.balance1);
        const b2 = normalizeNumericInput(input.balance2);
        const b3 = normalizeNumericInput(input.balance3);
        const b4 = normalizeNumericInput(input.balance4);
        const b5 = normalizeNumericInput(input.balance5);
        const total = b1 + b2 + b3 + b4 + b5;
        
        return db.upsertBankBalance({
          organizationId: ctx.user.organizationId,
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
      .input(z.object({ limit: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        if (!ctx.user.organizationId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Organization not set' });
        }
        return db.getIncomeRecords(ctx.user.organizationId, input.limit);
      }),
    
    getByYearMonth: protectedProcedure
      .input(z.object({ yearMonth: z.string() }))
      .query(async ({ ctx, input }) => {
        if (!ctx.user.organizationId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Organization not set' });
        }
        console.log(`[Income.getByYearMonth] organizationId: ${ctx.user.organizationId}, yearMonth: ${input.yearMonth}`);
        const result = await db.getIncomeRecordByYearMonth(ctx.user.organizationId, input.yearMonth);
        console.log(`[Income.getByYearMonth] result:`, result ? 'found' : 'not found');
        return result;
      }),
    
    getByStatus: protectedProcedure
      .input(z.object({ 
        yearMonth: z.string(),
        status: z.enum(["actual", "forecast", "prediction"]),
      }))
      .query(async ({ ctx, input }) => {
        if (!ctx.user.organizationId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Organization not set' });
        }
        console.log(`[Income.getByStatus] organizationId: ${ctx.user.organizationId}, yearMonth: ${input.yearMonth}, status: ${input.status}`);
        const result = await calculateIncomeByStatus(ctx.user.organizationId, input.yearMonth, input.status);
        console.log(`[Income.getByStatus] result keys:`, Object.keys(result));
        return result;
      }),
    
    listByStatus: protectedProcedure
      .input(z.object({ 
        yearMonths: z.array(z.string()),
        status: z.enum(["actual", "forecast", "prediction"]),
      }))
      .query(async ({ ctx, input }) => {
        if (!ctx.user.organizationId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Organization not set' });
        }
        const results = await Promise.all(
          input.yearMonths.map(yearMonth => 
            calculateIncomeByStatus(ctx.user.organizationId, yearMonth, input.status)
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
      }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user.organizationId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Organization not set' });
        }
        
        return db.upsertIncomeRecord({
          organizationId: ctx.user.organizationId,
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
      .input(z.object({ limit: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        if (!ctx.user.organizationId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Organization not set' });
        }
        return db.getExpenseRecords(ctx.user.organizationId, input.limit);
      }),
    
    getByYearMonth: protectedProcedure
      .input(z.object({ yearMonth: z.string() }))
      .query(async ({ ctx, input }) => {
        if (!ctx.user.organizationId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Organization not set' });
        }
        console.log(`[Expense.getByYearMonth] organizationId: ${ctx.user.organizationId}, yearMonth: ${input.yearMonth}`);
        const result = await db.getExpenseRecordByYearMonth(ctx.user.organizationId, input.yearMonth);
        console.log(`[Expense.getByYearMonth] result:`, result ? 'found' : 'not found');
        return result;
      }),
    
    getByStatus: protectedProcedure
      .input(z.object({ 
        yearMonth: z.string(),
        status: z.enum(["actual", "forecast", "prediction"]),
      }))
      .query(async ({ ctx, input }) => {
        if (!ctx.user.organizationId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Organization not set' });
        }
        console.log(`[Expense.getByStatus] organizationId: ${ctx.user.organizationId}, yearMonth: ${input.yearMonth}, status: ${input.status}`);
        const result = await calculateExpenseByStatus(ctx.user.organizationId, input.yearMonth, input.status);
        console.log(`[Expense.getByStatus] result keys:`, Object.keys(result));
        return result;
      }),
    
    listByStatus: protectedProcedure
      .input(z.object({ 
        yearMonths: z.array(z.string()),
        status: z.enum(["actual", "forecast", "prediction"]),
      }))
      .query(async ({ ctx, input }) => {
        if (!ctx.user.organizationId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Organization not set' });
        }
        const results = await Promise.all(
          input.yearMonths.map(yearMonth => 
            calculateExpenseByStatus(ctx.user.organizationId, yearMonth, input.status)
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
      }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user.organizationId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Organization not set' });
        }
        
        return db.upsertExpenseRecord({
          organizationId: ctx.user.organizationId,
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
      }))
      .query(async ({ ctx, input }) => {
        if (!ctx.user.organizationId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Organization not set' });
        }
        return db.getBillingDataList(ctx.user.organizationId, input.page, input.pageSize);
      }),
    
    search: protectedProcedure
      .input(z.object({
        billingYearMonth: z.string().optional(),
        serviceYearMonth: z.string().optional(),
        userName: z.string().optional(),
        page: z.number().default(1),
        pageSize: z.number().default(50),
      }))
      .query(async ({ ctx, input }) => {
        if (!ctx.user.organizationId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Organization not set' });
        }
        return db.searchBillingData(
          ctx.user.organizationId,
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
      }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user.organizationId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Organization not set' });
        }
        
        return db.createBillingData({
          organizationId: ctx.user.organizationId,
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
      .query(async ({ ctx }) => {
        if (!ctx.user.organizationId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Organization not set' });
        }
        return db.getFactoringSetting(ctx.user.organizationId);
      }),
    
    upsertSetting: editorProcedure
      .input(z.object({
        factoringRate: z.number(),
        remainingRate: z.number(),
        feeRate: z.number(),
        usageFee: z.number(),
        paymentDay: z.number(),
        remainingPaymentDay: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user.organizationId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Organization not set' });
        }
        
        return db.upsertFactoringSetting({
          organizationId: ctx.user.organizationId,
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
      .input(z.object({ yearMonth: z.string() }))
      .query(async ({ ctx, input }) => {
        if (!ctx.user.organizationId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Organization not set' });
        }
        return db.getBudgets(ctx.user.organizationId, input.yearMonth);
      }),
    
    upsert: editorProcedure
      .input(z.object({
        yearMonth: z.string(),
        category: z.string(),
        itemName: z.string(),
        amount: z.union([z.string(), z.number()]),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user.organizationId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Organization not set' });
        }
        
        return db.upsertBudget({
          organizationId: ctx.user.organizationId,
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
    create: adminProcedure
      .input(z.object({ name: z.string() }))
      .mutation(async ({ input }) => {
        return db.createOrganization({ name: input.name });
      }),
  }),

  // Loan operations
  loan: router({
    list: protectedProcedure
      .query(async ({ ctx }) => {
        if (!ctx.user.organizationId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Organization not set' });
        }
        return db.getLoans(ctx.user.organizationId);
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
      }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user.organizationId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Organization not set' });
        }
        
        // annualInterestRateはdecimal型なので、文字列として保存（例: "1.500"）
        const annualInterestRateValue = typeof input.annualInterestRate === 'string' 
          ? input.annualInterestRate 
          : String(input.annualInterestRate);
        
        const loanId = await db.createLoan({
          organizationId: ctx.user.organizationId,
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
      .input(z.object({ yearMonth: z.string() }))
      .query(async ({ ctx, input }) => {
        if (!ctx.user.organizationId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Organization not set' });
        }
        return getMonthStatus(ctx.user.organizationId, input.yearMonth);
      }),
    
    list: protectedProcedure
      .input(z.object({ yearMonths: z.array(z.string()).optional() }))
      .query(async ({ ctx, input }) => {
        if (!ctx.user.organizationId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Organization not set' });
        }
        try {
          console.log(`[MonthStatus.list] organizationId: ${ctx.user.organizationId}, yearMonths:`, input.yearMonths);
          const result = await getMonthStatuses(ctx.user.organizationId, input.yearMonths);
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
