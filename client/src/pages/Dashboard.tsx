import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight } from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  Area,
  AreaChart,
} from "recharts";

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

// グラフ用の色配列
const incomeColors = [
  "#3b82f6", // 青
  "#8b5cf6", // 紫
  "#ec4899", // ピンク
  "#f59e0b", // オレンジ
  "#10b981", // 緑
  "#06b6d4", // シアン
  "#6366f1", // インディゴ
  "#f97316", // オレンジ
  "#84cc16", // ライム
  "#14b8a6", // ティール
  "#a855f7", // バイオレット
];

const expenseColors = [
  "#ef4444", // 赤
  "#f97316", // オレンジ
  "#f59e0b", // アンバー
  "#eab308", // イエロー
  "#84cc16", // ライム
  "#22c55e", // グリーン
  "#10b981", // エメラルド
  "#14b8a6", // ティール
  "#06b6d4", // シアン
  "#3b82f6", // ブルー
  "#6366f1", // インディゴ
  "#8b5cf6", // バイオレット
  "#a855f7", // パープル
  "#ec4899", // ピンク
  "#f43f5e", // ローズ
  "#dc2626", // レッド
  "#b91c1c", // ダークレッド
  "#991b1b", // ダークレッド2
  "#7f1d1d", // ダークレッド3
  "#dc2626", // レッド
  "#b91c1c", // ダークレッド
];

// カスタム凡例コンポーネント
const CustomLegend = ({ 
  payload, 
  labels 
}: { 
  payload?: any[]; 
  labels: Record<string, string>;
}) => {
  const [showAll, setShowAll] = useState(false);
  const maxVisibleItems = 5; // 1列に表示する最大項目数

  if (!payload || payload.length === 0) return null;

  const visibleItems = showAll ? payload : payload.slice(0, maxVisibleItems);
  const hiddenItems = payload.slice(maxVisibleItems);

  return (
    <div className="w-full relative">
      <ul className="flex flex-wrap gap-1 justify-center items-center p-0 m-0 list-none" style={{ fontSize: '8px' }}>
        {visibleItems.map((entry: any, index: number) => {
          const label = labels[entry.dataKey] || entry.dataKey;
          return (
            <li
              key={`item-${index}`}
              className="inline-flex items-center gap-1 px-1"
              style={{ fontSize: '8px' }}
            >
              <span
                className="inline-block w-2 h-2 rounded-sm flex-shrink-0"
                style={{ backgroundColor: entry.color }}
              />
              <span style={{ fontSize: '8px', lineHeight: '1.2' }}>{label}</span>
            </li>
          );
        })}
        {hiddenItems.length > 0 && !showAll && (
          <li
            className="inline-flex items-center gap-1 px-1 cursor-pointer text-muted-foreground hover:text-foreground"
            onMouseEnter={() => setShowAll(true)}
            style={{ fontSize: '8px' }}
          >
            <span>+{hiddenItems.length}件</span>
          </li>
        )}
      </ul>
      {showAll && hiddenItems.length > 0 && (
        <div 
          className="absolute top-full left-1/2 transform -translate-x-1/2 bg-background border rounded shadow-lg z-10 p-2 max-h-48 overflow-y-auto mt-1"
          onMouseLeave={() => setShowAll(false)}
        >
          <ul 
            className="flex flex-col gap-0.5 p-0 m-0 list-none" 
            style={{ fontSize: '8px' }}
          >
            {hiddenItems.map((entry: any, index: number) => {
              const label = labels[entry.dataKey] || entry.dataKey;
              return (
                <li
                  key={`hidden-item-${index}`}
                  className="flex items-center gap-1 px-1"
                  style={{ fontSize: '8px' }}
                >
                  <span
                    className="inline-block w-2 h-2 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span style={{ fontSize: '8px', lineHeight: '1.2' }}>{label}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

export default function Dashboard() {
  const { data: bankBalances, isLoading: loadingBalances } = trpc.bankBalance.list.useQuery({ limit: 12 });
  const { data: incomeRecords, isLoading: loadingIncome } = trpc.income.list.useQuery({ limit: 12 });
  const { data: expenseRecords, isLoading: loadingExpense } = trpc.expense.list.useQuery({ limit: 12 });

  const isLoading = loadingBalances || loadingIncome || loadingExpense;

  // Calculate summary metrics
  const currentBalance = bankBalances?.[0]?.totalBalance || 0;
  const previousBalance = bankBalances?.[1]?.totalBalance || 0;
  const balanceChange = currentBalance - previousBalance;

  const currentIncome = incomeRecords?.[0] || null;
  const currentExpense = expenseRecords?.[0] || null;

  const totalIncome = currentIncome
    ? Object.entries(currentIncome)
        .filter(([key]) => !['id', 'organizationId', 'yearMonth', 'createdBy', 'createdAt', 'updatedAt'].includes(key))
        .reduce((sum, [, value]) => sum + (typeof value === 'number' ? value : 0), 0)
    : 0;

  const totalExpense = currentExpense
    ? Object.entries(currentExpense)
        .filter(([key]) => !['id', 'organizationId', 'yearMonth', 'createdBy', 'createdAt', 'updatedAt'].includes(key))
        .reduce((sum, [, value]) => sum + (typeof value === 'number' ? value : 0), 0)
    : 0;

  const businessProfit = totalIncome - totalExpense;

  // Prepare chart data
  const chartData = bankBalances
    ?.slice()
    .reverse()
    .map((balance, index) => {
      const income = incomeRecords?.find((r) => r.yearMonth === balance.yearMonth);
      const expense = expenseRecords?.find((r) => r.yearMonth === balance.yearMonth);

      const incomeTotal = income
        ? Object.entries(income)
            .filter(([key]) => !['id', 'organizationId', 'yearMonth', 'createdBy', 'createdAt', 'updatedAt'].includes(key))
            .reduce((sum, [, value]) => sum + (typeof value === 'number' ? value : 0), 0)
        : 0;

      const expenseTotal = expense
        ? Object.entries(expense)
            .filter(([key]) => !['id', 'organizationId', 'yearMonth', 'createdBy', 'createdAt', 'updatedAt'].includes(key))
            .reduce((sum, [, value]) => sum + (typeof value === 'number' ? value : 0), 0)
        : 0;

      // 費目ごとの収入データ（100%積上げ用）
      const incomeByCategory: Record<string, number> = {};
      const incomeAmountByCategory: Record<string, number> = {};
      if (income) {
        Object.entries(income).forEach(([key, value]) => {
          if (!['id', 'organizationId', 'yearMonth', 'createdBy', 'createdAt', 'updatedAt'].includes(key)) {
            const amount = typeof value === 'number' ? value : 0;
            incomeAmountByCategory[`${key}_amount`] = amount; // 実際の金額を保存
            if (amount > 0 && incomeTotal > 0) {
              incomeByCategory[key] = (amount / incomeTotal) * 100; // パーセンテージ
            } else {
              incomeByCategory[key] = 0;
            }
          }
        });
      }

      // 費目ごとの支出データ（100%積上げ用）
      const expenseByCategory: Record<string, number> = {};
      const expenseAmountByCategory: Record<string, number> = {};
      if (expense) {
        Object.entries(expense).forEach(([key, value]) => {
          if (!['id', 'organizationId', 'yearMonth', 'createdBy', 'createdAt', 'updatedAt'].includes(key)) {
            const amount = typeof value === 'number' ? value : 0;
            expenseAmountByCategory[`${key}_amount`] = amount; // 実際の金額を保存
            if (amount > 0 && expenseTotal > 0) {
              expenseByCategory[key] = (amount / expenseTotal) * 100; // パーセンテージ
            } else {
              expenseByCategory[key] = 0;
            }
          }
        });
      }

      const balanceValue = typeof balance.totalBalance === 'number' ? balance.totalBalance : 0;
      
      return {
        month: balance.yearMonth,
        balance: balanceValue,
        income: incomeTotal,
        expense: expenseTotal,
        expenseNegative: -expenseTotal, // グラフ用にマイナス値として保存
        profit: incomeTotal - expenseTotal,
        ...incomeByCategory,
        ...expenseByCategory,
        ...incomeAmountByCategory,
        ...expenseAmountByCategory,
      };
    }) || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">ダッシュボード</h1>
        <p className="text-muted-foreground">
          事業所の財務状況を一目で確認できます
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              現在の口座残高
            </CardTitle>
            <Wallet className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ¥{currentBalance.toLocaleString('ja-JP')}
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              {balanceChange >= 0 ? (
                <>
                  <ArrowUpRight className="w-3 h-3 text-green-500" />
                  <span className="text-green-500">
                    +¥{Math.abs(balanceChange).toLocaleString('ja-JP')}
                  </span>
                </>
              ) : (
                <>
                  <ArrowDownRight className="w-3 h-3 text-red-500" />
                  <span className="text-red-500">
                    -¥{Math.abs(balanceChange).toLocaleString('ja-JP')}
                  </span>
                </>
              )}
              <span className="ml-1">前月比</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              当月収入合計
            </CardTitle>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ¥{totalIncome.toLocaleString('ja-JP')}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {currentIncome?.yearMonth || '未登録'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              当月支出合計
            </CardTitle>
            <TrendingDown className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              ¥{totalExpense.toLocaleString('ja-JP')}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {currentExpense?.yearMonth || '未登録'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              事業収支
            </CardTitle>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${businessProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {businessProfit >= 0 ? '+' : ''}¥{businessProfit.toLocaleString('ja-JP')}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              収入 - 支出
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="space-y-6 mb-8">
        {/* 口座残高推移 - PC表示時は一行まるまる使用 */}
        <Card>
          <CardHeader>
            <CardTitle>口座残高推移</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart 
                  data={chartData} 
                  margin={{ left: 20, right: 20, top: 5, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="month"
                    tick={{ fontSize: 12 }}
                    interval={0}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis 
                    tickFormatter={(value) => {
                      if (value >= 10000) {
                        return `¥${(value / 10000).toFixed(0)}万`;
                      }
                      return `¥${value.toLocaleString('ja-JP')}`;
                    }}
                    width={90}
                    tick={{ fontSize: 12 }}
                    domain={['dataMin', 'dataMax']}
                  />
                  <Tooltip
                    formatter={(value: number) => [`¥${value.toLocaleString('ja-JP')}`, '口座残高']}
                    labelFormatter={(label) => `年月: ${label}`}
                  />
                  <Legend />
                  <Line
                    type="linear"
                    dataKey="balance"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    name="口座残高"
                    dot={{ fill: "#3b82f6", r: 4 }}
                    activeDot={{ r: 6 }}
                    connectNulls={false}
                    isAnimationActive={true}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                データがありません
              </div>
            )}
          </CardContent>
        </Card>

        {/* 収入推移と支出推移 - PC表示時は横並び */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 収入推移グラフ - 費目ごとに分かれた100%積上げ棒グラフ */}
          <Card>
            <CardHeader>
              <CardTitle>収入推移</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} margin={{ left: 20, right: 20, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis 
                    domain={[0, 100]} 
                    label={{ value: '割合', angle: -90, position: 'insideLeft' }}
                    tickFormatter={(value) => `${value}%`}
                    width={60}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-background border rounded-lg shadow-lg p-3">
                            <p className="font-semibold mb-2">{label}</p>
                            {payload.map((entry: any, index: number) => {
                              const key = entry.dataKey;
                              const label = incomeLabels[key] || key;
                              const percentage = entry.value as number;
                              const amount = entry.payload[`${key}_amount`] || 0;
                              return (
                                <p key={index} className="text-sm" style={{ color: entry.color }}>
                                  {label}: {percentage.toFixed(1)}% (¥{amount.toLocaleString('ja-JP')})
                                </p>
                              );
                            })}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend
                    content={(props: any) => <CustomLegend payload={props.payload} labels={incomeLabels} />}
                  />
                  {Object.keys(incomeLabels).map((key, index) => (
                    <Bar
                      key={key}
                      dataKey={key}
                      stackId="income"
                      fill={incomeColors[index % incomeColors.length]}
                      name={key}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* 支出推移グラフ - 費目ごとに分かれた100%積上げ棒グラフ */}
          <Card>
            <CardHeader>
              <CardTitle>支出推移</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} margin={{ left: 20, right: 20, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis 
                    domain={[0, 100]} 
                    label={{ value: '割合', angle: -90, position: 'insideLeft' }}
                    tickFormatter={(value) => `${value}%`}
                    width={60}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-background border rounded-lg shadow-lg p-3">
                            <p className="font-semibold mb-2">{label}</p>
                            {payload.map((entry: any, index: number) => {
                              const key = entry.dataKey;
                              const label = expenseLabels[key] || key;
                              const percentage = entry.value as number;
                              const amount = entry.payload[`${key}_amount`] || 0;
                              return (
                                <p key={index} className="text-sm" style={{ color: entry.color }}>
                                  {label}: {percentage.toFixed(1)}% (¥{amount.toLocaleString('ja-JP')})
                                </p>
                              );
                            })}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend
                    content={(props: any) => <CustomLegend payload={props.payload} labels={expenseLabels} />}
                  />
                  {Object.keys(expenseLabels).map((key, index) => (
                    <Bar
                      key={key}
                      dataKey={key}
                      stackId="expense"
                      fill={expenseColors[index % expenseColors.length]}
                      name={key}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent Data Summary */}
      <Card>
        <CardHeader>
          <CardTitle>直近12ヶ月のデータサマリー</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-4">年月</th>
                  <th className="text-right py-2 px-4">口座残高</th>
                  <th className="text-right py-2 px-4">収入</th>
                  <th className="text-right py-2 px-4">支出</th>
                  <th className="text-right py-2 px-4">収支</th>
                </tr>
              </thead>
              <tbody>
                {chartData.slice().reverse().map((row) => (
                  <tr key={row.month} className="border-b hover:bg-muted/50">
                    <td className="py-2 px-4 font-medium">{row.month}</td>
                    <td className="text-right py-2 px-4">
                      ¥{row.balance.toLocaleString('ja-JP')}
                    </td>
                    <td className="text-right py-2 px-4 text-green-600">
                      ¥{row.income.toLocaleString('ja-JP')}
                    </td>
                    <td className="text-right py-2 px-4 text-red-600">
                      ¥{row.expense.toLocaleString('ja-JP')}
                    </td>
                    <td className={`text-right py-2 px-4 font-semibold ${row.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {row.profit >= 0 ? '+' : ''}¥{row.profit.toLocaleString('ja-JP')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
