import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, FileText, AlertCircle } from "lucide-react";
import { isMockupMode, mockupData, getMockupQueryOptions } from "@/lib/mockup";

type StatusType = "actual" | "forecast" | "prediction";

// 現在の月を中心に前6ヶ月と後5ヶ月の合計12ヶ月の年月リストを生成
function generateLast12Months(): string[] {
  const months: string[] = [];
  const now = new Date();
  // 前6ヶ月（過去6ヶ月）から後5ヶ月（未来5ヶ月）まで
  for (let i = 6; i >= -5; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    months.push(`${year}-${month}`);
  }
  return months;
}

const incomeLabels: Record<string, string> = {
  insuranceIncome: "保険入金",
  userBurdenTransfer: "【振込】利用者負担",
  userBurdenWithdrawal: "【口座振替】利用者負担",
  factoringIncome1: "【ファクタリング】入金(前月分)",
  factoringIncome2: "【ファクタリング】残金入金(3ヶ月前)",
  otherBusinessIncome: "【その他】事業収入",
  representativeLoan: "代表者借入",
  shortTermLoan: "短期借入",
  longTermLoan: "長期借入",
  interestIncome: "受取利息",
  otherNonBusinessIncome: "【その他】事業外収入",
};

const expenseLabels: Record<string, string> = {
  personnelCost: "人件費",
  legalWelfare: "法定福利・福利厚生",
  advertising: "広告宣伝費",
  travelVehicle: "旅費交通費・車両費",
  communication: "通信費",
  consumables: "消耗品費・事務用品",
  utilities: "水道光熱費",
  rent: "地代家賃",
  leaseLoan: "リース料・ローン支払",
  paymentFee: "支払報酬",
  paymentCommission: "支払手数料",
  paymentInterest: "支払利息",
  miscellaneous: "雑費・その他",
  pettyCash: "小口補充",
  cardPayment: "カード支払い",
  representativeLoanRepayment: "代表者借入金返済",
  shortTermLoanRepayment: "短期借入金返済",
  longTermLoanRepayment: "長期借入金返済",
  regularDeposit: "定期積金",
  taxPayment: "税金納付",
  otherNonBusinessExpense: "その他(事業外支出)",
};

export default function Reports({ organizationId: propOrganizationId }: { organizationId?: number } = {}) {
  const [location] = useLocation();
  
  // URLから組織IDを取得（/:organizationId/reports形式）
  const organizationId = useMemo(() => {
    // プロップで渡された場合はそれを使用
    if (propOrganizationId) {
      return propOrganizationId;
    }
    // URLから組織IDを取得
    const match = location.match(/^\/(\d+)\/reports$/);
    if (match) {
      return parseInt(match[1], 10);
    }
    return undefined;
  }, [location, propOrganizationId]);

  const last12Months = generateLast12Months();
  
  // 月ごとのステータスを取得
  const { data: monthStatuses, isLoading: loadingStatuses } = trpc.monthStatus.list.useQuery(
    { yearMonths: last12Months, organizationId },
    {
      ...getMockupQueryOptions(mockupData.monthStatuses),
    }
  );
  
  // ステータスマップを作成（デフォルトは"actual"）
  const statusMap = new Map<string, StatusType>();
  monthStatuses?.forEach(ms => {
    statusMap.set(ms.yearMonth, ms.status);
  });
  
  // モックモード用のローカルステータス管理
  const [localMonthStatuses, setLocalMonthStatuses] = useState<Map<string, StatusType>>(new Map());
  
  // モックモードの場合はローカルステートを使用、そうでない場合はDBから取得
  const effectiveMonthStatuses = isMockupMode
    ? last12Months.map(yearMonth => ({
        id: 0,
        organizationId: 1,
        yearMonth,
        status: localMonthStatuses.get(yearMonth) || statusMap.get(yearMonth) || "actual",
        createdBy: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      }))
    : monthStatuses || [];
  
  // ステータスマップを更新
  const effectiveStatusMap = new Map<string, StatusType>();
  effectiveMonthStatuses.forEach(ms => {
    effectiveStatusMap.set(ms.yearMonth, ms.status);
  });
  
  // 月ごとのステータスに応じたデータを取得
  // モックモードの場合は直接モックデータを使用
  const incomeQueries = isMockupMode
    ? last12Months.map((yearMonth) => ({
        data: mockupData.incomeRecords.find(r => r.yearMonth === yearMonth),
        isLoading: false,
        isError: false,
        error: null,
        refetch: async () => {},
      }))
    : trpc.useQueries((t) =>
        last12Months.map((yearMonth) => {
          const status = effectiveStatusMap.get(yearMonth) || "actual";
          return status === "actual"
            ? t.income.getByYearMonth({ yearMonth, organizationId })
            : t.income.getByStatus({ yearMonth, status, organizationId });
        })
      );
  
  const expenseQueries = isMockupMode
    ? last12Months.map((yearMonth) => ({
        data: mockupData.expenseRecords.find(r => r.yearMonth === yearMonth),
        isLoading: false,
        isError: false,
        error: null,
        refetch: async () => {},
      }))
    : trpc.useQueries((t) =>
        last12Months.map((yearMonth) => {
          const status = effectiveStatusMap.get(yearMonth) || "actual";
          return status === "actual"
            ? t.expense.getByYearMonth({ yearMonth, organizationId })
            : t.expense.getByStatus({ yearMonth, status, organizationId });
        })
      );

  // デバッグ情報
  console.log("[Reports] クエリ状態:", {
    loadingStatuses,
    monthStatusesCount: monthStatuses?.length || 0,
    incomeQueriesCount: incomeQueries.length,
    incomeQueriesLoading: incomeQueries.filter(q => q.isLoading).length,
    incomeQueriesError: incomeQueries.filter(q => q.isError).length,
    incomeQueriesData: incomeQueries.filter(q => q.data).length,
    expenseQueriesCount: expenseQueries.length,
    expenseQueriesLoading: expenseQueries.filter(q => q.isLoading).length,
    expenseQueriesError: expenseQueries.filter(q => q.isError).length,
    expenseQueriesData: expenseQueries.filter(q => q.data).length,
    effectiveStatusMapSize: effectiveStatusMap.size,
  });

  // エラーチェック
  const hasErrors = incomeQueries.some(q => q.isError) || expenseQueries.some(q => q.isError);
  if (hasErrors) {
    console.error("[Reports] クエリエラー:", {
      incomeErrors: incomeQueries.filter(q => q.isError).map((q, idx) => ({ 
        index: idx, 
        yearMonth: last12Months[idx],
        error: q.error, 
        data: q.data 
      })),
      expenseErrors: expenseQueries.filter(q => q.isError).map((q, idx) => ({ 
        index: idx, 
        yearMonth: last12Months[idx],
        error: q.error, 
        data: q.data 
      })),
    });
  }

  const isLoading = loadingStatuses || incomeQueries.some(q => q.isLoading) || expenseQueries.some(q => q.isLoading);
  
  // ステータス更新のmutation
  const utils = trpc.useUtils();
  const updateStatusMutation = trpc.monthStatus.upsert.useMutation({
    onSuccess: () => {
      // 両画面のデータを再取得
      utils.monthStatus.list.invalidate();
      utils.income.list.invalidate();
      utils.expense.list.invalidate();
      incomeQueries.forEach(q => q.refetch());
      expenseQueries.forEach(q => q.refetch());
    },
  });
  
  const handleStatusChange = (yearMonth: string, status: StatusType) => {
    if (isMockupMode) {
      // モックモードの場合はローカルステートを更新
      setLocalMonthStatuses(prev => {
        const newMap = new Map(prev);
        newMap.set(yearMonth, status);
        return newMap;
      });
    } else {
      // DBモードの場合はmutationを実行
      updateStatusMutation.mutate({ yearMonth, status });
    }
  };

  // 直近12ヶ月分のデータを取得（データが存在しない月も含める）
  const displayIncomeRecords = last12Months.map((yearMonth, index) => {
    const query = incomeQueries[index];
    const record = query?.data;
    // エラーが発生している場合は空のレコードを返す
    if (query?.isError || !record) {
      return {
        yearMonth,
        id: yearMonth,
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
    // 数値フィールドを確実に数値として扱う
    return {
      ...record,
      yearMonth,
      id: record.id || yearMonth,
      insuranceIncome: Number(record.insuranceIncome) || 0,
      userBurdenTransfer: Number(record.userBurdenTransfer) || 0,
      userBurdenWithdrawal: Number(record.userBurdenWithdrawal) || 0,
      factoringIncome1: Number(record.factoringIncome1) || 0,
      factoringIncome2: Number(record.factoringIncome2) || 0,
      otherBusinessIncome: Number(record.otherBusinessIncome) || 0,
      representativeLoan: Number(record.representativeLoan) || 0,
      shortTermLoan: Number(record.shortTermLoan) || 0,
      longTermLoan: Number(record.longTermLoan) || 0,
      interestIncome: Number(record.interestIncome) || 0,
      otherNonBusinessIncome: Number(record.otherNonBusinessIncome) || 0,
    };
  });
  
  const displayExpenseRecords = last12Months.map((yearMonth, index) => {
    const query = expenseQueries[index];
    const record = query?.data;
    // エラーが発生している場合は空のレコードを返す
    if (query?.isError || !record) {
      return {
        yearMonth,
        id: yearMonth,
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
    // 数値フィールドを確実に数値として扱う
    return {
      ...record,
      yearMonth,
      id: record.id || yearMonth,
      personnelCost: Number(record.personnelCost) || 0,
      legalWelfare: Number(record.legalWelfare) || 0,
      advertising: Number(record.advertising) || 0,
      travelVehicle: Number(record.travelVehicle) || 0,
      communication: Number(record.communication) || 0,
      consumables: Number(record.consumables) || 0,
      utilities: Number(record.utilities) || 0,
      rent: Number(record.rent) || 0,
      leaseLoan: Number(record.leaseLoan) || 0,
      paymentFee: Number(record.paymentFee) || 0,
      paymentCommission: Number(record.paymentCommission) || 0,
      paymentInterest: Number(record.paymentInterest) || 0,
      miscellaneous: Number(record.miscellaneous) || 0,
      pettyCash: Number(record.pettyCash) || 0,
      cardPayment: Number(record.cardPayment) || 0,
      representativeLoanRepayment: Number(record.representativeLoanRepayment) || 0,
      shortTermLoanRepayment: Number(record.shortTermLoanRepayment) || 0,
      longTermLoanRepayment: Number(record.longTermLoanRepayment) || 0,
      regularDeposit: Number(record.regularDeposit) || 0,
      taxPayment: Number(record.taxPayment) || 0,
      otherNonBusinessExpense: Number(record.otherNonBusinessExpense) || 0,
    };
  });

  // 各月の収入合計と支出合計を計算
  const monthlyTotals = useMemo(() => {
    return last12Months.map((yearMonth, index) => {
      const incomeRecord = displayIncomeRecords[index];
      const expenseRecord = displayExpenseRecords[index];
      
      const incomeTotal = Object.keys(incomeLabels).reduce(
        (sum, key) => sum + ((incomeRecord[key as keyof typeof incomeRecord] as number) || 0),
        0
      );
      
      const expenseTotal = Object.keys(expenseLabels).reduce(
        (sum, key) => sum + ((expenseRecord[key as keyof typeof expenseRecord] as number) || 0),
        0
      );
      
      return {
        yearMonth,
        incomeTotal,
        expenseTotal,
        monthlyBalance: incomeTotal - expenseTotal,
      };
    });
  }, [displayIncomeRecords, displayExpenseRecords, last12Months]);

  // 累計収支と翌月繰越を計算
  const cumulativeBalances = useMemo(() => {
    let cumulative = 0;
    let previousCarryOver = 0;
    
    return monthlyTotals.map((monthly) => {
      cumulative += monthly.monthlyBalance;
      const carryOver = previousCarryOver + monthly.monthlyBalance;
      previousCarryOver = carryOver;
      
      return {
        ...monthly,
        cumulativeBalance: cumulative,
        carryOver,
      };
    });
  }, [monthlyTotals]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container py-8">
      {hasErrors && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>データの読み込みエラー</AlertTitle>
          <AlertDescription>
            レポートデータの読み込み中にエラーが発生しました。ブラウザのコンソールを確認してください。
          </AlertDescription>
        </Alert>
      )}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
              <FileText className="w-8 h-8" />
              実績詳細確認
            </h1>
            <p className="text-muted-foreground">
              収入・支出費目別の実績を表形式で確認できます。各月のステータス（確定/見込み/予測）を個別に設定できます。
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* 収入セクション */}
        <Card className="border-green-200 bg-green-50/30">
          <CardHeader className="bg-green-100/50 border-b border-green-200">
            <CardTitle className="text-green-900">収入費目別実績</CardTitle>
          </CardHeader>
          <CardContent className="bg-green-50/20">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-green-300">
                    <th className="text-left py-2 px-4 sticky left-0 bg-green-50/30 min-w-[250px] w-[250px]">費目</th>
                    {displayIncomeRecords.map((record, index) => {
                      const currentStatus = effectiveStatusMap.get(record.yearMonth) || "actual";
                      return (
                        <th key={record.id || index} className="text-center py-2 px-4 whitespace-nowrap bg-green-100/50">
                          <div className="flex flex-col items-center gap-1">
                            <div>{record.yearMonth}</div>
                            <Select
                              value={currentStatus}
                              onValueChange={(value) => handleStatusChange(record.yearMonth, value as StatusType)}
                            >
                              <SelectTrigger className="w-24 h-7 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="actual">確定</SelectItem>
                                <SelectItem value="forecast">見込み</SelectItem>
                                <SelectItem value="prediction">予測</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </th>
                      );
                    })}
                    <th className="text-right py-2 px-4 font-bold bg-green-200/50">合計</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(incomeLabels).map(([key, label]) => {
                    const rowTotal = displayIncomeRecords.reduce(
                      (sum, record) => sum + ((record[key as keyof typeof record] as number) || 0),
                      0
                    );

                    return (
                      <tr key={key} className="border-b border-green-200/50 hover:bg-green-100/30">
                        <td className="py-2 px-4 font-medium sticky left-0 bg-green-50/30 min-w-[250px] w-[250px]">
                          {label}
                        </td>
                        {displayIncomeRecords.map((record, index) => (
                          <td key={record.id || index} className="text-right py-2 px-4 whitespace-nowrap">
                            ¥{((record[key as keyof typeof record] as number) || 0).toLocaleString('ja-JP')}
                          </td>
                        ))}
                        <td className="text-right py-2 px-4 font-bold bg-green-200/50 whitespace-nowrap">
                          ¥{rowTotal.toLocaleString('ja-JP')}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="border-t-2 border-green-400 font-bold bg-green-200/50">
                    <td className="py-2 px-4 sticky left-0 bg-green-200/50 min-w-[250px] w-[250px]">合計</td>
                    {displayIncomeRecords.map((record, index) => {
                      const total = Object.keys(incomeLabels).reduce(
                        (sum, key) => sum + ((record[key as keyof typeof record] as number) || 0),
                        0
                      );
                      return (
                        <td key={record.id || index} className="text-right py-2 px-4 whitespace-nowrap">
                          ¥{total.toLocaleString('ja-JP')}
                        </td>
                      );
                    })}
                    <td className="text-right py-2 px-4 bg-green-300/50 whitespace-nowrap">
                      ¥{displayIncomeRecords.reduce((sum, record) => {
                        return sum + Object.keys(incomeLabels).reduce(
                          (s, key) => s + ((record[key as keyof typeof record] as number) || 0),
                          0
                        );
                      }, 0).toLocaleString('ja-JP')}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* 支出セクション */}
        <Card className="border-red-200 bg-red-50/30">
          <CardHeader className="bg-red-100/50 border-b border-red-200">
            <CardTitle className="text-red-900">支出費目別実績</CardTitle>
          </CardHeader>
          <CardContent className="bg-red-50/20">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-red-300">
                    <th className="text-left py-2 px-4 sticky left-0 bg-red-50/30 min-w-[250px] w-[250px]">費目</th>
                    {displayExpenseRecords.map((record, index) => {
                      const currentStatus = effectiveStatusMap.get(record.yearMonth) || "actual";
                      return (
                        <th key={record.id || index} className="text-center py-2 px-4 whitespace-nowrap bg-red-100/50">
                          <div className="flex flex-col items-center gap-1">
                            <div>{record.yearMonth}</div>
                            <Select
                              value={currentStatus}
                              onValueChange={(value) => handleStatusChange(record.yearMonth, value as StatusType)}
                            >
                              <SelectTrigger className="w-24 h-7 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="actual">確定</SelectItem>
                                <SelectItem value="forecast">見込み</SelectItem>
                                <SelectItem value="prediction">予測</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </th>
                      );
                    })}
                    <th className="text-right py-2 px-4 font-bold bg-red-200/50">合計</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(expenseLabels).map(([key, label]) => {
                    const rowTotal = displayExpenseRecords.reduce(
                      (sum, record) => sum + ((record[key as keyof typeof record] as number) || 0),
                      0
                    );

                    return (
                      <tr key={key} className="border-b border-red-200/50 hover:bg-red-100/30">
                        <td className="py-2 px-4 font-medium sticky left-0 bg-red-50/30 min-w-[250px] w-[250px]">
                          {label}
                        </td>
                        {displayExpenseRecords.map((record, index) => (
                          <td key={record.id || index} className="text-right py-2 px-4 whitespace-nowrap">
                            ¥{((record[key as keyof typeof record] as number) || 0).toLocaleString('ja-JP')}
                          </td>
                        ))}
                        <td className="text-right py-2 px-4 font-bold bg-red-200/50 whitespace-nowrap">
                          ¥{rowTotal.toLocaleString('ja-JP')}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="border-t-2 border-red-400 font-bold bg-red-200/50">
                    <td className="py-2 px-4 sticky left-0 bg-red-200/50 min-w-[250px] w-[250px]">合計</td>
                    {displayExpenseRecords.map((record, index) => {
                      const total = Object.keys(expenseLabels).reduce(
                        (sum, key) => sum + ((record[key as keyof typeof record] as number) || 0),
                        0
                      );
                      return (
                        <td key={record.id || index} className="text-right py-2 px-4 whitespace-nowrap">
                          ¥{total.toLocaleString('ja-JP')}
                        </td>
                      );
                    })}
                    <td className="text-right py-2 px-4 bg-red-300/50 whitespace-nowrap">
                      ¥{displayExpenseRecords.reduce((sum, record) => {
                        return sum + Object.keys(expenseLabels).reduce(
                          (s, key) => s + ((record[key as keyof typeof record] as number) || 0),
                          0
                        );
                      }, 0).toLocaleString('ja-JP')}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* 収支サマリーセクション */}
        <Card className="border-blue-200 bg-blue-50/30">
          <CardHeader className="bg-blue-100/50 border-b border-blue-200">
            <CardTitle className="text-blue-900">収支サマリー</CardTitle>
          </CardHeader>
          <CardContent className="bg-blue-50/20">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-blue-300">
                    <th className="text-left py-2 px-4 sticky left-0 bg-blue-50/30 min-w-[250px] w-[250px]">項目</th>
                    {cumulativeBalances.map((balance, index) => {
                      const currentStatus = effectiveStatusMap.get(balance.yearMonth) || "actual";
                      return (
                        <th key={balance.yearMonth} className="text-center py-2 px-4 whitespace-nowrap bg-blue-100/50">
                          <div className="flex flex-col items-center gap-1">
                            <div>{balance.yearMonth}</div>
                            <Select
                              value={currentStatus}
                              onValueChange={(value) => handleStatusChange(balance.yearMonth, value as StatusType)}
                            >
                              <SelectTrigger className="w-24 h-7 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="actual">確定</SelectItem>
                                <SelectItem value="forecast">見込み</SelectItem>
                                <SelectItem value="prediction">予測</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-blue-200/50 hover:bg-blue-100/30">
                    <td className="py-2 px-4 font-medium sticky left-0 bg-blue-50/30 min-w-[250px] w-[250px]">
                      収入合計
                    </td>
                    {cumulativeBalances.map((balance) => (
                      <td key={balance.yearMonth} className="text-right py-2 px-4 whitespace-nowrap">
                        ¥{balance.incomeTotal.toLocaleString('ja-JP')}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-blue-200/50 hover:bg-blue-100/30">
                    <td className="py-2 px-4 font-medium sticky left-0 bg-blue-50/30 min-w-[250px] w-[250px]">
                      支出合計
                    </td>
                    {cumulativeBalances.map((balance) => (
                      <td key={balance.yearMonth} className="text-right py-2 px-4 whitespace-nowrap">
                        ¥{balance.expenseTotal.toLocaleString('ja-JP')}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-t-2 border-blue-400 font-bold bg-blue-200/50">
                    <td className="py-2 px-4 sticky left-0 bg-blue-200/50 min-w-[250px] w-[250px]">
                      単月収支
                    </td>
                    {cumulativeBalances.map((balance) => (
                      <td 
                        key={balance.yearMonth} 
                        className={`text-right py-2 px-4 whitespace-nowrap ${
                          balance.monthlyBalance >= 0 ? 'text-green-700' : 'text-red-700'
                        }`}
                      >
                        ¥{balance.monthlyBalance.toLocaleString('ja-JP')}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-t border-blue-300 font-bold bg-blue-200/30">
                    <td className="py-2 px-4 sticky left-0 bg-blue-200/30 min-w-[250px] w-[250px]">
                      累計収支
                    </td>
                    {cumulativeBalances.map((balance) => (
                      <td 
                        key={balance.yearMonth} 
                        className={`text-right py-2 px-4 whitespace-nowrap ${
                          balance.cumulativeBalance >= 0 ? 'text-green-700' : 'text-red-700'
                        }`}
                      >
                        ¥{balance.cumulativeBalance.toLocaleString('ja-JP')}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-t-2 border-blue-400 font-bold bg-blue-300/50">
                    <td className="py-2 px-4 sticky left-0 bg-blue-300/50 min-w-[250px] w-[250px]">
                      翌月繰越
                    </td>
                    {cumulativeBalances.map((balance) => (
                      <td 
                        key={balance.yearMonth} 
                        className={`text-right py-2 px-4 whitespace-nowrap ${
                          balance.carryOver >= 0 ? 'text-green-700' : 'text-red-700'
                        }`}
                      >
                        ¥{balance.carryOver.toLocaleString('ja-JP')}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
