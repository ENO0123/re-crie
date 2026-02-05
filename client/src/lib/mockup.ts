/**
 * モックアップ環境の検出とダミーデータの提供
 */

// ポート番号に基づいてモックモードを判定（4000=モック、4001=DB接続）
const currentPort = typeof window !== 'undefined' ? window.location.port : '';
// ポート4001の場合は必ずDB接続モード、ポート4000の場合はモックモード
export const isMockupMode = currentPort === '4000';

/**
 * モックアップ環境ではクエリを無効化し、ダミーデータを返すためのオプションを返す
 */
export function getMockupQueryOptions<T>(defaultData: T) {
  if (isMockupMode) {
    return {
      enabled: false,
      initialData: defaultData,
      staleTime: Infinity, // データを常に新鮮として扱う
    };
  }
  return {
    enabled: true,
  };
}

/**
 * 過去Nヶ月の年月リストを生成
 */
function generateYearMonths(months: number): string[] {
  const result: string[] = [];
  const now = new Date();
  for (let i = 0; i < months; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    result.push(`${year}-${month}`);
  }
  return result;
}

/**
 * モックアップ環境用のダミーデータ
 */
export const mockupData = {
  bankBalances: (() => {
    const yearMonths = generateYearMonths(12);
    return yearMonths.map((yearMonth, index) => {
      const baseBalance = 5000000; // 500万円を基準
      const variation = (Math.random() - 0.5) * 1000000; // ±50万円の変動
      const totalBalance = Math.round(baseBalance + variation - (index * 50000)); // 徐々に減少
      
      return {
        id: index + 1,
        organizationId: 1,
        yearMonth,
        balance1: Math.round(totalBalance * 0.4),
        balance2: Math.round(totalBalance * 0.3),
        balance3: Math.round(totalBalance * 0.2),
        balance4: Math.round(totalBalance * 0.08),
        balance5: Math.round(totalBalance * 0.02),
        totalBalance,
        createdBy: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    });
  })(),
  
  incomeRecords: (() => {
    const yearMonths = generateYearMonths(12);
    return yearMonths.map((yearMonth, index) => {
      const baseIncome = 8000000; // 800万円を基準
      const variation = (Math.random() - 0.5) * 500000; // ±25万円の変動
      
      return {
        id: index + 1,
        organizationId: 1,
        yearMonth,
        insuranceIncome: Math.round(baseIncome * 0.6 + variation * 0.4),
        userBurdenTransfer: Math.round(baseIncome * 0.15 + variation * 0.2),
        userBurdenWithdrawal: Math.round(baseIncome * 0.15 + variation * 0.2),
        factoringIncome1: Math.round(baseIncome * 0.05 + variation * 0.1),
        factoringIncome2: Math.round(baseIncome * 0.02 + variation * 0.05),
        otherBusinessIncome: Math.round(baseIncome * 0.01 + variation * 0.02),
        representativeLoan: index % 3 === 0 ? Math.round(baseIncome * 0.01) : 0,
        shortTermLoan: 0,
        longTermLoan: 0,
        interestIncome: Math.round(baseIncome * 0.005),
        otherNonBusinessIncome: Math.round(baseIncome * 0.005),
        createdBy: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    });
  })(),
  
  expenseRecords: (() => {
    const yearMonths = generateYearMonths(12);
    return yearMonths.map((yearMonth, index) => {
      const baseExpense = 7500000; // 750万円を基準
      const variation = (Math.random() - 0.5) * 300000; // ±15万円の変動
      
      return {
        id: index + 1,
        organizationId: 1,
        yearMonth,
        personnelCost: Math.round(baseExpense * 0.65 + variation * 0.5), // 人件費65%
        legalWelfare: Math.round(baseExpense * 0.12 + variation * 0.1), // 法定福利12%
        advertising: Math.round(baseExpense * 0.02 + variation * 0.02),
        travelVehicle: Math.round(baseExpense * 0.03 + variation * 0.03),
        communication: Math.round(baseExpense * 0.01 + variation * 0.01),
        consumables: Math.round(baseExpense * 0.02 + variation * 0.02),
        utilities: Math.round(baseExpense * 0.03 + variation * 0.02),
        rent: Math.round(baseExpense * 0.05 + variation * 0.03),
        leaseLoan: Math.round(baseExpense * 0.02 + variation * 0.02),
        paymentFee: Math.round(baseExpense * 0.01 + variation * 0.01),
        paymentCommission: Math.round(baseExpense * 0.005 + variation * 0.005),
        paymentInterest: Math.round(baseExpense * 0.005 + variation * 0.005),
        miscellaneous: Math.round(baseExpense * 0.02 + variation * 0.02),
        pettyCash: Math.round(baseExpense * 0.01 + variation * 0.01),
        cardPayment: Math.round(baseExpense * 0.01 + variation * 0.01),
        representativeLoanRepayment: index % 6 === 0 ? Math.round(baseExpense * 0.01) : 0,
        shortTermLoanRepayment: 0,
        longTermLoanRepayment: 0,
        regularDeposit: 0,
        taxPayment: index % 3 === 0 ? Math.round(baseExpense * 0.02) : 0,
        otherNonBusinessExpense: Math.round(baseExpense * 0.01 + variation * 0.01),
        createdBy: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    });
  })(),
  
  billingData: (() => {
    const users = ['田中太郎', '佐藤花子', '鈴木一郎', '高橋次郎', '伊藤三郎', '渡辺四郎', '中村五郎', '小林六郎'];
    const yearMonths = generateYearMonths(3).map(ym => ym.replace('-', ''));
    const result: any[] = [];
    
    yearMonths.forEach((billingYearMonth, monthIndex) => {
      users.forEach((userName, userIndex) => {
        const baseCost = 150000; // 15万円を基準
        const variation = (Math.random() - 0.5) * 50000; // ±2.5万円の変動
        const totalCost = Math.round(baseCost + variation);
        const insurancePayment = Math.round(totalCost * 0.9);
        const userBurden = Math.round(totalCost * 0.1);
        
        result.push({
          id: monthIndex * users.length + userIndex + 1,
          organizationId: 1,
          billingYearMonth,
          serviceYearMonth: billingYearMonth, // 簡略化のため同じ月とする
          userName,
          totalCost,
          insurancePayment,
          publicPayment: 0,
          reduction: 0,
          userBurdenTransfer: Math.round(userBurden * 0.6),
          userBurdenWithdrawal: Math.round(userBurden * 0.4),
          createdBy: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      });
    });
    
    return result;
  })(),
  
  factoringSetting: {
    id: 1,
    organizationId: 1,
    factoringRate: 8000, // 80.00%
    remainingRate: 2000, // 20.00%
    feeRate: 70, // 0.700%
    usageFee: 2000, // ¥2,000
    paymentDay: 15, // 翌月15日
    remainingPaymentDay: 5, // 翌々翌月5日
    createdBy: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  
  monthStatuses: (() => {
    const yearMonths = generateYearMonths(12);
    return yearMonths.map((yearMonth, index) => {
      // 最初の月は「確定」、それ以降は「予測」をデフォルトとする
      let status: "actual" | "forecast" | "prediction" = "prediction";
      if (index === yearMonths.length - 1) {
        status = "actual"; // 最新月は確定
      } else if (index >= yearMonths.length - 3) {
        status = "forecast"; // 直近3ヶ月は見込み
      }
      
      return {
        id: index + 1,
        organizationId: 1,
        yearMonth,
        status,
        createdBy: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    });
  })(),
};

