/**
 * Normalize input value by:
 * 1. Converting full-width characters to half-width
 * 2. Removing currency symbols (¥, ￥)
 * 3. Removing "円"
 * 4. Removing all characters except digits, decimal point, and minus sign
 * 5. Converting to number
 */
export function normalizeNumericInput(input: string | number | null | undefined): number {
  if (input === null || input === undefined) return 0;
  if (typeof input === 'number') return input;
  
  let normalized = input;
  
  // Convert full-width to half-width
  normalized = normalized.replace(/[Ā-ヿ]/g, (char) => {
    return String.fromCharCode(char.charCodeAt(0) - 0xFEE0);
  });
  
  // Remove currency symbols
  normalized = normalized.replace(/[¥￥]/g, '');
  
  // Remove 円
  normalized = normalized.replace(/円/g, '');
  
  // Remove all characters except digits, decimal point, and minus sign
  normalized = normalized.replace(/[^\d.-]/g, '');
  
  // Convert to number
  const num = parseFloat(normalized);
  return isNaN(num) ? 0 : Math.round(num);
}

/**
 * Format number as Japanese currency
 */
export function formatCurrency(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP')}`;
}

/**
 * Format year-month string (YYYY-MM) for display
 */
export function formatYearMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split('-');
  return `${year}年${parseInt(month)}月`;
}

/**
 * Parse YYYYMM format to YYYY-MM format
 */
export function parseYYYYMM(yyyymm: string): string {
  if (yyyymm.length !== 6) return yyyymm;
  return `${yyyymm.substring(0, 4)}-${yyyymm.substring(4, 6)}`;
}

/**
 * Format YYYY-MM to YYYYMM format
 */
export function formatYYYYMM(yearMonth: string): string {
  return yearMonth.replace('-', '');
}

/**
 * 借入返済計算用の型定義
 */
export type LoanCalculationParams = {
  repaymentMethod: 'equal_principal' | 'equal_installment'; // 元金均等 or 元利均等
  annualInterestRate: number; // 年利（%）
  initialBorrowingAmount: number; // 当初借入額
  repaymentPrincipal: number; // 現在の返済元金（残高）
  firstRepaymentDate: Date; // 初回返済日
  repaymentDueDate: number; // 返済期日（毎月の日付、1-31）
  targetYearMonth: string; // 計算対象年月（YYYY-MM）
};

export type LoanCalculationResult = {
  repaymentAmount: number; // 返済額
  principalAmount: number; // 返済元金
  interestAmount: number; // 利息額
  remainingPrincipal: number; // 返済後の残高
};

/**
 * 借入返済計算（元金均等返済）
 */
function calculateEqualPrincipalRepayment(
  remainingPrincipal: number,
  monthlyInterestRate: number,
  remainingMonths: number
): LoanCalculationResult {
  const principalAmount = Math.round(remainingPrincipal / remainingMonths);
  const interestAmount = Math.round(remainingPrincipal * monthlyInterestRate);
  const repaymentAmount = principalAmount + interestAmount;
  const newRemainingPrincipal = remainingPrincipal - principalAmount;

  return {
    repaymentAmount,
    principalAmount,
    interestAmount,
    remainingPrincipal: Math.max(0, newRemainingPrincipal),
  };
}

/**
 * 借入返済計算（元利均等返済）
 */
function calculateEqualInstallmentRepayment(
  remainingPrincipal: number,
  monthlyInterestRate: number,
  remainingMonths: number,
  originalMonthlyPayment: number
): LoanCalculationResult {
  // 元利均等の場合、毎月の返済額は一定
  const repaymentAmount = originalMonthlyPayment;
  const interestAmount = Math.round(remainingPrincipal * monthlyInterestRate);
  const principalAmount = repaymentAmount - interestAmount;
  const newRemainingPrincipal = remainingPrincipal - principalAmount;

  return {
    repaymentAmount,
    principalAmount: Math.max(0, principalAmount),
    interestAmount,
    remainingPrincipal: Math.max(0, newRemainingPrincipal),
  };
}

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
  
  const numerator = monthlyInterestRate * Math.pow(1 + monthlyInterestRate, totalMonths);
  const denominator = Math.pow(1 + monthlyInterestRate, totalMonths) - 1;
  return Math.round(principal * (numerator / denominator));
}

/**
 * 返済回数を計算（初回返済日から対象年月までの回数）
 */
function calculateRepaymentCount(
  firstRepaymentDate: Date,
  targetYearMonth: string,
  repaymentDueDate: number
): number {
  const [targetYear, targetMonth] = targetYearMonth.split('-').map(Number);
  const targetDate = new Date(targetYear, targetMonth - 1, repaymentDueDate);
  
  let count = 0;
  let currentDate = new Date(firstRepaymentDate);
  
  while (currentDate <= targetDate) {
    count++;
    // 次の返済日を計算
    currentDate = new Date(currentDate);
    currentDate.setMonth(currentDate.getMonth() + 1);
    currentDate.setDate(repaymentDueDate);
  }
  
  return count;
}

/**
 * 借入返済計算メイン関数
 */
export function calculateLoanRepayment(params: LoanCalculationParams): LoanCalculationResult {
  const {
    repaymentMethod,
    annualInterestRate,
    initialBorrowingAmount,
    repaymentPrincipal,
    firstRepaymentDate,
    repaymentDueDate,
    targetYearMonth,
  } = params;

  // 月利を計算（年利 / 12 / 100）
  const monthlyInterestRate = annualInterestRate / 12 / 100;

  // 初回返済日から対象年月までの返済回数を計算
  const repaymentCount = calculateRepaymentCount(
    firstRepaymentDate,
    targetYearMonth,
    repaymentDueDate
  );

  // 総返済回数を計算（初回返済日から最終返済日まで）
  // 簡略化のため、借入額と年利から総返済期間を推定
  // 実際の実装では、返済期間を別途管理する必要があるかもしれません
  const estimatedTotalMonths = Math.ceil(
    (initialBorrowingAmount / repaymentPrincipal) * repaymentCount
  );
  const remainingMonths = Math.max(1, estimatedTotalMonths - repaymentCount + 1);

  if (repaymentMethod === 'equal_principal') {
    // 元金均等返済
    return calculateEqualPrincipalRepayment(
      repaymentPrincipal,
      monthlyInterestRate,
      remainingMonths
    );
  } else {
    // 元利均等返済
    const originalMonthlyPayment = calculateMonthlyPaymentForEqualInstallment(
      initialBorrowingAmount,
      monthlyInterestRate,
      estimatedTotalMonths
    );
    
    return calculateEqualInstallmentRepayment(
      repaymentPrincipal,
      monthlyInterestRate,
      remainingMonths,
      originalMonthlyPayment
    );
  }
}
