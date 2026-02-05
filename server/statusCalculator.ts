/**
 * ステータス（確定・見込み・予測）に応じた計算ロジック
 */

import { getDb } from "./db";
import { getIncomeRecords, getExpenseRecords, getBillingDataList, getFactoringSetting, getLoans } from "./db";
import { calculateLoanRepaymentsFromLoans } from "./loanCalculator";
import { billingData } from "../drizzle/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";

type StatusType = "actual" | "forecast" | "prediction";

/**
 * 年月文字列から前3ヶ月の年月リストを生成
 */
function getPrevious3Months(yearMonth: string): string[] {
  const [year, month] = yearMonth.split('-').map(Number);
  const months: string[] = [];
  for (let i = 1; i <= 3; i++) {
    const date = new Date(year, month - 1 - i, 1);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    months.push(`${y}-${m}`);
  }
  return months;
}

/**
 * 前3ヶ月の平均値を計算
 */
function calculateAverage3Months(
  records: Array<Record<string, any>>,
  field: string
): number {
  if (!records || records.length === 0) return 0;
  const values = records
    .map(r => Number(r[field]) || 0)
    .filter(v => !isNaN(v));
  if (values.length === 0) return 0;
  // 0を含むすべての値を平均に含める（0の値も有効なデータとして扱う）
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}

/**
 * 請求データから入金データを計算
 */
async function calculateIncomeFromBilling(
  organizationId: number,
  targetYearMonth: string
): Promise<{
  insuranceIncome: number;
  userBurdenTransfer: number;
  userBurdenWithdrawal: number;
  factoringIncome1: number;
  factoringIncome2: number;
}> {
  const db = await getDb();
  if (!db) {
    return {
      insuranceIncome: 0,
      userBurdenTransfer: 0,
      userBurdenWithdrawal: 0,
      factoringIncome1: 0,
      factoringIncome2: 0,
    };
  }

  // 請求年月をYYYYMM形式に変換
  const billingYearMonth = targetYearMonth.replace('-', '');
  
  // 前月分の請求データを取得（ファクタリング残金入金用、口座振替利用者負担用）
  const [year, month] = targetYearMonth.split('-').map(Number);
  const prevMonth = new Date(year, month - 2, 1); // monthは1-12なので、month-2で前月
  const prevBillingYearMonth = `${prevMonth.getFullYear()}${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;
  
  // 前々月分の請求データを取得（保険入金用）
  const twoMonthsAgo = new Date(year, month - 3, 1); // month-3で前々月
  const twoMonthsAgoBillingYearMonth = `${twoMonthsAgo.getFullYear()}${String(twoMonthsAgo.getMonth() + 1).padStart(2, '0')}`;

  // 請求データを取得
  // 【振込】利用者負担: 請求年月が当月で、isTransfer=trueの人の利用者負担の合計
  let transferUserBurden = [{ total: 0 }];
  let withdrawalUserBurden = [{ total: 0 }];
  
  try {
    transferUserBurden = await db.select({
      total: sql<number>`COALESCE(SUM(${billingData.userBurdenTransfer} + ${billingData.userBurdenWithdrawal}), 0)`,
    })
      .from(billingData)
      .where(and(
        eq(billingData.organizationId, organizationId),
        eq(billingData.billingYearMonth, billingYearMonth),
        eq(billingData.isTransfer, true)
      ));

    // 【口座振替】利用者負担: 請求年月が前月で、isTransfer=falseの人の利用者負担の合計（翌月に入金されるため）
    withdrawalUserBurden = await db.select({
      total: sql<number>`COALESCE(SUM(${billingData.userBurdenTransfer} + ${billingData.userBurdenWithdrawal}), 0)`,
    })
      .from(billingData)
      .where(and(
        eq(billingData.organizationId, organizationId),
        eq(billingData.billingYearMonth, prevBillingYearMonth),
        eq(billingData.isTransfer, false)
      ));
  } catch (error: any) {
    // isTransferカラムが存在しない場合のフォールバック（旧データとの互換性のため）
    if (error?.message?.includes('isTransfer') || error?.code === 'ER_BAD_FIELD_ERROR') {
      console.warn("[calculateIncomeFromBilling] isTransferカラムが存在しないため、従来のロジックを使用します");
      // 従来のロジック: 当月のuserBurdenTransferとuserBurdenWithdrawalをそのまま使用
      const fallbackBilling = await db.select({
        userBurdenTransfer: sql<number>`COALESCE(SUM(${billingData.userBurdenTransfer}), 0)`,
        userBurdenWithdrawal: sql<number>`COALESCE(SUM(${billingData.userBurdenWithdrawal}), 0)`,
      })
        .from(billingData)
        .where(and(
          eq(billingData.organizationId, organizationId),
          eq(billingData.billingYearMonth, billingYearMonth)
        ));
      
      transferUserBurden = [{ total: fallbackBilling[0]?.userBurdenTransfer || 0 }];
      withdrawalUserBurden = [{ total: fallbackBilling[0]?.userBurdenWithdrawal || 0 }];
    } else {
      throw error;
    }
  }

  // その他の請求データを取得（保険入金、ファクタリング計算用）
  // 当月の保険給付額を取得（ファクタリング入金1用、ファクタリング残金入金用）
  const currentBilling = await db.select({
    insurancePayment: sql<number>`COALESCE(SUM(${billingData.insurancePayment}), 0)`,
  })
    .from(billingData)
    .where(and(
      eq(billingData.organizationId, organizationId),
      eq(billingData.billingYearMonth, billingYearMonth)
    ));

  // 前月の保険給付額を取得（ファクタリング残金入金用：前月の請求年月の保険給付額から計算して翌月に入力）
  const prevBilling = await db.select({
    insurancePayment: sql<number>`COALESCE(SUM(${billingData.insurancePayment}), 0)`,
  })
    .from(billingData)
    .where(and(
      eq(billingData.organizationId, organizationId),
      eq(billingData.billingYearMonth, prevBillingYearMonth)
    ));

  // 前々月の保険給付額を取得（保険入金用）
  const twoMonthsAgoBilling = await db.select({
    insurancePayment: sql<number>`COALESCE(SUM(${billingData.insurancePayment}), 0)`,
  })
    .from(billingData)
    .where(and(
      eq(billingData.organizationId, organizationId),
      eq(billingData.billingYearMonth, twoMonthsAgoBillingYearMonth)
    ));

  // ファクタリング設定を取得
  const factoringSetting = await getFactoringSetting(organizationId);
  
  // ファクタリング計算
  const currentInsurancePayment = currentBilling[0]?.insurancePayment || 0;
  const prevInsurancePayment = prevBilling[0]?.insurancePayment || 0;
  
  let factoringIncome1 = 0;
  let factoringIncome2 = 0;
  let insuranceIncome = twoMonthsAgoBilling[0]?.insurancePayment || 0;
  
  // ファクタリング設定が有効な場合、保険入金は0
  if (factoringSetting) {
    insuranceIncome = 0;
    
    // 【ファクタリング】入金(前月分): 当月の保険給付額から計算し、当月に入力
    if (currentInsurancePayment > 0) {
      const factoringRate = factoringSetting.factoringRate / 10000; // 8000 -> 0.8
      const feeRate = factoringSetting.feeRate / 10000; // 70 -> 0.007
      const usageFee = factoringSetting.usageFee;
      
      const factoringAmount = Math.round(currentInsurancePayment * factoringRate);
      const fee = Math.round(factoringAmount * feeRate);
      factoringIncome1 = Math.max(0, factoringAmount - fee - usageFee);
    }
    
    // 【ファクタリング】残金入金: 前月の請求年月の保険給付額から計算し、翌月（当月）に入力
    // 前月の請求年月の保険給付額 - ファクタリング総額(A) = 残金入金
    if (prevInsurancePayment > 0) {
      const factoringRate = factoringSetting.factoringRate / 10000; // 8000 -> 0.8
      const factoringAmount = Math.round(prevInsurancePayment * factoringRate);
      factoringIncome2 = prevInsurancePayment - factoringAmount;
    }
  }

  return {
    insuranceIncome,
    // 【振込】利用者負担: 当月の請求データでisTransfer=trueの人の利用者負担の合計
    userBurdenTransfer: transferUserBurden[0]?.total || 0,
    // 【口座振替】利用者負担: 前月の請求データでisTransfer=falseの人の利用者負担の合計（翌月に入金されるため）
    userBurdenWithdrawal: withdrawalUserBurden[0]?.total || 0,
    factoringIncome1,
    factoringIncome2,
  };
}

/**
 * 借入返済管理から長期借入の金額を取得
 * 当初借入日が該当している月の当初借入額を合計
 */
async function getLongTermLoanFromLoans(
  organizationId: number,
  targetYearMonth: string
): Promise<number> {
  const loans = await getLoans(organizationId);
  if (!loans || loans.length === 0) return 0;
  
  // 対象年月をDateオブジェクトに変換（月初日）
  const [year, month] = targetYearMonth.split('-').map(Number);
  const targetDate = new Date(year, month - 1, 1);
  const targetYear = targetDate.getFullYear();
  const targetMonth = targetDate.getMonth() + 1;
  
  let total = 0;
  
  for (const loan of loans) {
    // 当初借入日が該当している月かチェック
    const initialBorrowingDate = new Date(loan.initialBorrowingDate);
    const borrowingYear = initialBorrowingDate.getFullYear();
    const borrowingMonth = initialBorrowingDate.getMonth() + 1;
    
    // 対象年月と当初借入日が同じ年月の場合、当初借入額を合計
    if (targetYear === borrowingYear && targetMonth === borrowingMonth) {
      total += loan.initialBorrowingAmount || 0;
    }
  }
  
  return total;
}

/**
 * ステータスに応じた収入データを計算
 */
export async function calculateIncomeByStatus(
  organizationId: number,
  targetYearMonth: string,
  status: StatusType
): Promise<Record<string, number>> {
  if (status === "actual") {
    // 確定: 入力されているデータを使用
    const incomeRecords = await getIncomeRecords(organizationId, 12);
    const record = incomeRecords.find(r => r.yearMonth === targetYearMonth);
    if (record) {
      return {
        insuranceIncome: record.insuranceIncome || 0,
        userBurdenTransfer: record.userBurdenTransfer || 0,
        userBurdenWithdrawal: record.userBurdenWithdrawal || 0,
        factoringIncome1: record.factoringIncome1 || 0,
        factoringIncome2: record.factoringIncome2 || 0,
        otherBusinessIncome: record.otherBusinessIncome || 0,
        representativeLoan: record.representativeLoan || 0,
        shortTermLoan: record.shortTermLoan || 0,
        longTermLoan: record.longTermLoan || 0,
        interestIncome: record.interestIncome || 0,
        otherNonBusinessIncome: record.otherNonBusinessIncome || 0,
      };
    }
    return {
      insuranceIncome: 0,
      userBurdenTransfer: 0,
      userBurdenWithdrawal: 0,
      factoringIncome1: 0,
      factoringIncome2: 0,
      otherBusinessIncome: 0,
      representativeLoan: 0,
      shortTermLoan: 0,
      longTermLoan: 0,
      interestIncome: 0,
      otherNonBusinessIncome: 0,
    };
  }

  if (status === "forecast") {
    // 見込み: 請求データとファクタリング設定から計算、なければ前3ヶ月平均
    const billingIncome = await calculateIncomeFromBilling(organizationId, targetYearMonth);
    
    // 前3ヶ月のデータを取得
    const prev3Months = getPrevious3Months(targetYearMonth);
    const prev3MonthsRecords = await getIncomeRecords(organizationId, 12);
    const prev3MonthsData = prev3MonthsRecords.filter(r => prev3Months.includes(r.yearMonth));
    
    // 借入返済管理から借入データを取得
    const loanData = await calculateLoanRepaymentsFromLoans(organizationId, targetYearMonth);
    
    // 長期借入: 借入返済管理から取得（当初借入日が該当している月の当初借入額）
    const longTermLoan = await getLongTermLoanFromLoans(organizationId, targetYearMonth);
    
    return {
      insuranceIncome: billingIncome.insuranceIncome || calculateAverage3Months(prev3MonthsData, 'insuranceIncome'),
      userBurdenTransfer: billingIncome.userBurdenTransfer || calculateAverage3Months(prev3MonthsData, 'userBurdenTransfer'),
      userBurdenWithdrawal: billingIncome.userBurdenWithdrawal || calculateAverage3Months(prev3MonthsData, 'userBurdenWithdrawal'),
      factoringIncome1: billingIncome.factoringIncome1 || calculateAverage3Months(prev3MonthsData, 'factoringIncome1'),
      factoringIncome2: billingIncome.factoringIncome2 || calculateAverage3Months(prev3MonthsData, 'factoringIncome2'),
      otherBusinessIncome: calculateAverage3Months(prev3MonthsData, 'otherBusinessIncome'),
      representativeLoan: calculateAverage3Months(prev3MonthsData, 'representativeLoan'),
      shortTermLoan: calculateAverage3Months(prev3MonthsData, 'shortTermLoan'),
      longTermLoan: longTermLoan,
      interestIncome: calculateAverage3Months(prev3MonthsData, 'interestIncome'),
      otherNonBusinessIncome: calculateAverage3Months(prev3MonthsData, 'otherNonBusinessIncome'),
    };
  }

  // 予測: 前3ヶ月平均、長期借入のみ借入返済管理から取得
  const prev3Months = getPrevious3Months(targetYearMonth);
  console.log(`[calculateIncomeByStatus] prediction - targetYearMonth: ${targetYearMonth}, prev3Months:`, prev3Months);
  const prev3MonthsRecords = await getIncomeRecords(organizationId, 12);
  const prev3MonthsData = prev3MonthsRecords.filter(r => prev3Months.includes(r.yearMonth));
  console.log(`[calculateIncomeByStatus] prediction - found ${prev3MonthsData.length} records for prev3Months`);
  
  // 長期借入: 借入返済管理から取得（データがなければ0）
  const longTermLoan = await getLongTermLoanFromLoans(organizationId, targetYearMonth);
  
  return {
    insuranceIncome: calculateAverage3Months(prev3MonthsData, 'insuranceIncome'),
    userBurdenTransfer: calculateAverage3Months(prev3MonthsData, 'userBurdenTransfer'),
    userBurdenWithdrawal: calculateAverage3Months(prev3MonthsData, 'userBurdenWithdrawal'),
    factoringIncome1: calculateAverage3Months(prev3MonthsData, 'factoringIncome1'),
    factoringIncome2: calculateAverage3Months(prev3MonthsData, 'factoringIncome2'),
    otherBusinessIncome: calculateAverage3Months(prev3MonthsData, 'otherBusinessIncome'),
    representativeLoan: calculateAverage3Months(prev3MonthsData, 'representativeLoan'),
    shortTermLoan: calculateAverage3Months(prev3MonthsData, 'shortTermLoan'),
    longTermLoan: longTermLoan,
    interestIncome: calculateAverage3Months(prev3MonthsData, 'interestIncome'),
    otherNonBusinessIncome: calculateAverage3Months(prev3MonthsData, 'otherNonBusinessIncome'),
  };
}

/**
 * ステータスに応じた支出データを計算
 */
export async function calculateExpenseByStatus(
  organizationId: number,
  targetYearMonth: string,
  status: StatusType
): Promise<Record<string, number>> {
  if (status === "actual") {
    // 確定: 入力されているデータを使用
    const expenseRecords = await getExpenseRecords(organizationId, 12);
    const record = expenseRecords.find(r => r.yearMonth === targetYearMonth);
    if (record) {
      return {
        personnelCost: record.personnelCost || 0,
        legalWelfare: record.legalWelfare || 0,
        advertising: record.advertising || 0,
        travelVehicle: record.travelVehicle || 0,
        communication: record.communication || 0,
        consumables: record.consumables || 0,
        utilities: record.utilities || 0,
        rent: record.rent || 0,
        leaseLoan: record.leaseLoan || 0,
        paymentFee: record.paymentFee || 0,
        paymentCommission: record.paymentCommission || 0,
        paymentInterest: record.paymentInterest || 0,
        miscellaneous: record.miscellaneous || 0,
        pettyCash: record.pettyCash || 0,
        cardPayment: record.cardPayment || 0,
        representativeLoanRepayment: record.representativeLoanRepayment || 0,
        shortTermLoanRepayment: record.shortTermLoanRepayment || 0,
        longTermLoanRepayment: record.longTermLoanRepayment || 0,
        regularDeposit: record.regularDeposit || 0,
        taxPayment: record.taxPayment || 0,
        otherNonBusinessExpense: record.otherNonBusinessExpense || 0,
      };
    }
    return {
      personnelCost: 0,
      legalWelfare: 0,
      advertising: 0,
      travelVehicle: 0,
      communication: 0,
      consumables: 0,
      utilities: 0,
      rent: 0,
      leaseLoan: 0,
      paymentFee: 0,
      paymentCommission: 0,
      paymentInterest: 0,
      miscellaneous: 0,
      pettyCash: 0,
      cardPayment: 0,
      representativeLoanRepayment: 0,
      shortTermLoanRepayment: 0,
      longTermLoanRepayment: 0,
      regularDeposit: 0,
      taxPayment: 0,
      otherNonBusinessExpense: 0,
    };
  }

  if (status === "forecast") {
    // 見込み: 借入返済管理から取得、なければ前3ヶ月平均
    const prev3Months = getPrevious3Months(targetYearMonth);
    const prev3MonthsRecords = await getExpenseRecords(organizationId, 12);
    const prev3MonthsData = prev3MonthsRecords.filter(r => prev3Months.includes(r.yearMonth));
    
    // 借入返済管理から借入返済データを取得
    const loanData = await calculateLoanRepaymentsFromLoans(organizationId, targetYearMonth);
    
    return {
      personnelCost: calculateAverage3Months(prev3MonthsData, 'personnelCost'),
      legalWelfare: calculateAverage3Months(prev3MonthsData, 'legalWelfare'),
      advertising: calculateAverage3Months(prev3MonthsData, 'advertising'),
      travelVehicle: calculateAverage3Months(prev3MonthsData, 'travelVehicle'),
      communication: calculateAverage3Months(prev3MonthsData, 'communication'),
      consumables: calculateAverage3Months(prev3MonthsData, 'consumables'),
      utilities: calculateAverage3Months(prev3MonthsData, 'utilities'),
      rent: calculateAverage3Months(prev3MonthsData, 'rent'),
      leaseLoan: calculateAverage3Months(prev3MonthsData, 'leaseLoan'),
      paymentFee: calculateAverage3Months(prev3MonthsData, 'paymentFee'),
      paymentCommission: calculateAverage3Months(prev3MonthsData, 'paymentCommission'),
      paymentInterest: loanData.paymentInterest || calculateAverage3Months(prev3MonthsData, 'paymentInterest'),
      miscellaneous: calculateAverage3Months(prev3MonthsData, 'miscellaneous'),
      pettyCash: calculateAverage3Months(prev3MonthsData, 'pettyCash'),
      cardPayment: calculateAverage3Months(prev3MonthsData, 'cardPayment'),
      representativeLoanRepayment: calculateAverage3Months(prev3MonthsData, 'representativeLoanRepayment'),
      shortTermLoanRepayment: calculateAverage3Months(prev3MonthsData, 'shortTermLoanRepayment'),
      longTermLoanRepayment: loanData.longTermLoanRepayment || calculateAverage3Months(prev3MonthsData, 'longTermLoanRepayment'),
      regularDeposit: calculateAverage3Months(prev3MonthsData, 'regularDeposit'),
      taxPayment: calculateAverage3Months(prev3MonthsData, 'taxPayment'),
      otherNonBusinessExpense: calculateAverage3Months(prev3MonthsData, 'otherNonBusinessExpense'),
    };
  }

  // 予測: 前3ヶ月平均、長期借入のみ借入返済管理から取得
  const prev3Months = getPrevious3Months(targetYearMonth);
  console.log(`[calculateExpenseByStatus] prediction - targetYearMonth: ${targetYearMonth}, prev3Months:`, prev3Months);
  const prev3MonthsRecords = await getExpenseRecords(organizationId, 12);
  const prev3MonthsData = prev3MonthsRecords.filter(r => prev3Months.includes(r.yearMonth));
  console.log(`[calculateExpenseByStatus] prediction - found ${prev3MonthsData.length} records for prev3Months`);
  
  // 長期借入のみ借入返済管理から取得
  const loanData = await calculateLoanRepaymentsFromLoans(organizationId, targetYearMonth);
  
  return {
    personnelCost: calculateAverage3Months(prev3MonthsData, 'personnelCost'),
    legalWelfare: calculateAverage3Months(prev3MonthsData, 'legalWelfare'),
    advertising: calculateAverage3Months(prev3MonthsData, 'advertising'),
    travelVehicle: calculateAverage3Months(prev3MonthsData, 'travelVehicle'),
    communication: calculateAverage3Months(prev3MonthsData, 'communication'),
    consumables: calculateAverage3Months(prev3MonthsData, 'consumables'),
    utilities: calculateAverage3Months(prev3MonthsData, 'utilities'),
    rent: calculateAverage3Months(prev3MonthsData, 'rent'),
    leaseLoan: calculateAverage3Months(prev3MonthsData, 'leaseLoan'),
    paymentFee: calculateAverage3Months(prev3MonthsData, 'paymentFee'),
    paymentCommission: calculateAverage3Months(prev3MonthsData, 'paymentCommission'),
    paymentInterest: calculateAverage3Months(prev3MonthsData, 'paymentInterest'),
    miscellaneous: calculateAverage3Months(prev3MonthsData, 'miscellaneous'),
    pettyCash: calculateAverage3Months(prev3MonthsData, 'pettyCash'),
    cardPayment: calculateAverage3Months(prev3MonthsData, 'cardPayment'),
    representativeLoanRepayment: calculateAverage3Months(prev3MonthsData, 'representativeLoanRepayment'),
    shortTermLoanRepayment: calculateAverage3Months(prev3MonthsData, 'shortTermLoanRepayment'),
    longTermLoanRepayment: loanData.longTermLoanRepayment || calculateAverage3Months(prev3MonthsData, 'longTermLoanRepayment'),
    regularDeposit: calculateAverage3Months(prev3MonthsData, 'regularDeposit'),
    taxPayment: calculateAverage3Months(prev3MonthsData, 'taxPayment'),
    otherNonBusinessExpense: calculateAverage3Months(prev3MonthsData, 'otherNonBusinessExpense'),
  };
}

