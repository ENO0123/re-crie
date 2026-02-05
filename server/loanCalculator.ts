/**
 * 借入返済管理から返済額を計算するロジック
 */

import { getDb } from "./db";
import { getActiveLoans } from "./db";
import { calculateLoanRepayment } from "../shared/utils";

/**
 * 元利均等返済の月額返済額を計算
 */
function calculateMonthlyPaymentForEqualInstallment(
  principal: number,
  monthlyInterestRate: number,
  totalMonths: number
): number {
  if (monthlyInterestRate === 0) {
    return Math.round(principal / totalMonths);
  }
  const factor = Math.pow(1 + monthlyInterestRate, totalMonths);
  return Math.round(principal * monthlyInterestRate * factor / (factor - 1));
}

/**
 * 対象年月の借入返済額を計算
 * @param organizationId 組織ID
 * @param targetYearMonth 対象年月（YYYY-MM形式）
 * @returns 返済額の合計（代表者借入、短期借入、長期借入、支払利息）
 */
export async function calculateLoanRepaymentsFromLoans(
  organizationId: number,
  targetYearMonth: string // YYYY-MM形式
): Promise<{
  representativeLoanRepayment: number; // 代表者借入金返済
  shortTermLoanRepayment: number; // 短期借入金返済
  longTermLoanRepayment: number; // 長期借入金返済
  paymentInterest: number; // 支払利息
}> {
  const db = await getDb();
  if (!db) {
    return {
      representativeLoanRepayment: 0,
      shortTermLoanRepayment: 0,
      longTermLoanRepayment: 0,
      paymentInterest: 0,
    };
  }

  // 対象年月の月初日を取得
  const [year, month] = targetYearMonth.split('-').map(Number);
  const targetDate = new Date(year, month - 1, 1);

  // 有効な借入を取得（対象年月の月初日時点で有効なもの）
  // 対象年月の月末日時点で有効な借入も含めるため、月末日を使用
  const targetDateEnd = new Date(year, month, 0); // 対象年月の月末日
  const activeLoans = await getActiveLoans(organizationId, targetDateEnd);

  let representativeLoanRepayment = 0;
  let shortTermLoanRepayment = 0;
  let longTermLoanRepayment = 0;
  let paymentInterest = 0;

  // 各借入について返済額を計算
  for (const loan of activeLoans) {
    // 対象年月に返済があるかチェック（返済期日が対象年月内にあるか）
    const repaymentDate = new Date(year, month - 1, loan.repaymentDueDate);
    const firstRepaymentDate = new Date(loan.firstRepaymentDate);
    
    // 初回返済日の年月を取得
    const firstRepaymentYear = firstRepaymentDate.getFullYear();
    const firstRepaymentMonth = firstRepaymentDate.getMonth() + 1;
    
    // 対象年月が初回返済日の年月より前の場合はスキップ
    if (year < firstRepaymentYear || (year === firstRepaymentYear && month < firstRepaymentMonth)) {
      continue;
    }

    // 対象年月時点での借入残高を計算
    // 初回返済日から対象年月の前月まで、逐次返済を計算して残高を求める
    // repaymentPrincipalは月々の返済元金なので、初期残高はinitialBorrowingAmountから開始
    let currentPrincipal = loan.initialBorrowingAmount;
    const firstRepayment = new Date(loan.firstRepaymentDate);
    const targetRepaymentDate = new Date(year, month - 1, loan.repaymentDueDate);
    
    // 初回返済日から対象年月の前月まで、逐次返済を計算
    let currentDate = new Date(firstRepayment);
    while (currentDate < targetRepaymentDate) {
      const currentYearMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
      
      // 月利を計算
      const monthlyInterestRate = parseFloat(String(loan.annualInterestRate)) / 12 / 100;
      
      // 返済方法に応じて返済額を計算
      let principalAmount: number;
      let interestAmount: number;
      
      if (loan.repaymentMethod === 'equal_principal') {
        // 元金均等返済: 月々の返済元金は固定（repaymentPrincipal）
        principalAmount = loan.repaymentPrincipal;
        interestAmount = Math.round(currentPrincipal * monthlyInterestRate);
      } else {
        // 元利均等返済: 月々の返済額は固定
        // 元利均等返済の場合、月々の返済額を計算する必要がある
        // 総返済回数を推定（簡略化のため、借入額と月々の返済元金から推定）
        const estimatedTotalMonths = Math.ceil(loan.initialBorrowingAmount / loan.repaymentPrincipal);
        const originalMonthlyPayment = calculateMonthlyPaymentForEqualInstallment(
          loan.initialBorrowingAmount,
          monthlyInterestRate,
          estimatedTotalMonths
        );
        
        // 月々の返済額は固定
        const repaymentAmount = originalMonthlyPayment;
        interestAmount = Math.round(currentPrincipal * monthlyInterestRate);
        principalAmount = Math.max(0, repaymentAmount - interestAmount);
      }
      
      // 返済後の残高を更新
      currentPrincipal = Math.max(0, currentPrincipal - principalAmount);
      
      // 次の返済日を計算
      currentDate = new Date(currentDate);
      currentDate.setMonth(currentDate.getMonth() + 1);
      currentDate.setDate(loan.repaymentDueDate);
    }

    // 対象年月の返済額を計算（計算された残高を使用）
    // 月利を計算
    const monthlyInterestRate = parseFloat(String(loan.annualInterestRate)) / 12 / 100;
    
    let principalAmount: number;
    let interestAmount: number;
    
    if (loan.repaymentMethod === 'equal_principal') {
      // 元金均等返済: 月々の返済元金は固定（repaymentPrincipal）
      principalAmount = loan.repaymentPrincipal;
      interestAmount = Math.round(currentPrincipal * monthlyInterestRate);
    } else {
      // 元利均等返済: 月々の返済額は固定
      // 元利均等返済の場合、月々の返済額を計算する必要がある
      // 総返済回数を推定（簡略化のため、借入額と月々の返済元金から推定）
      const estimatedTotalMonths = Math.ceil(loan.initialBorrowingAmount / loan.repaymentPrincipal);
      const originalMonthlyPayment = calculateMonthlyPaymentForEqualInstallment(
        loan.initialBorrowingAmount,
        monthlyInterestRate,
        estimatedTotalMonths
      );
      
      // 月々の返済額は固定
      const repaymentAmount = originalMonthlyPayment;
      interestAmount = Math.round(currentPrincipal * monthlyInterestRate);
      principalAmount = Math.max(0, repaymentAmount - interestAmount);
    }
    
    const calculation = {
      repaymentAmount: principalAmount + interestAmount,
      principalAmount,
      interestAmount,
      remainingPrincipal: Math.max(0, currentPrincipal - principalAmount),
    };

    // 借入の種類を判定（現在は金融機関名から判定、将来的にはスキーマに追加）
    // 暫定的にすべて代表者借入として扱う
    // TODO: 借入の種類をスキーマに追加するか、金融機関名から判定するロジックを実装
    const loanType = determineLoanType(loan.financialInstitution, loan.branchName || '');

    // 種類に応じて分類
    switch (loanType) {
      case 'representative':
        representativeLoanRepayment += calculation.principalAmount;
        paymentInterest += calculation.interestAmount;
        break;
      case 'shortTerm':
        shortTermLoanRepayment += calculation.principalAmount;
        paymentInterest += calculation.interestAmount;
        break;
      case 'longTerm':
        longTermLoanRepayment += calculation.principalAmount;
        paymentInterest += calculation.interestAmount;
        break;
    }
  }

  return {
    representativeLoanRepayment,
    shortTermLoanRepayment,
    longTermLoanRepayment,
    paymentInterest,
  };
}

/**
 * 借入の種類を判定（暫定実装）
 * 現在はすべて長期借入として扱う（支払利息と長期借入金返済に反映するため）
 * TODO: スキーマに借入の種類を追加するか、金融機関名から判定するロジックを実装
 */
function determineLoanType(
  financialInstitution: string,
  branchName: string
): 'representative' | 'shortTerm' | 'longTerm' {
  // 暫定的にすべて長期借入として扱う（支払利息と長期借入金返済に反映するため）
  // 将来的には、スキーマに借入の種類を追加するか、
  // 金融機関名や支店名から判定するロジックを実装
  return 'longTerm';
}

