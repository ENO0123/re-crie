import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { isMockupMode, getMockupQueryOptions } from "@/lib/mockup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";

type BudgetRow = {
  yearMonth: string;
  totalSales: number; // 合計売上予算（手入力）
  insuranceIncome: number; // 保険入金予算（自動計算）
  userBurden: number; // 利用者請求予算（自動計算）
};

export default function Budget() {
  // 割合設定（デフォルト値：保険入金90%、利用者請求10%）
  const [insuranceRatio, setInsuranceRatio] = useState(90); // 保険入金の割合（%）
  const [userBurdenRatio, setUserBurdenRatio] = useState(10); // 利用者請求の割合（%）

  const [budgetRows, setBudgetRows] = useState<BudgetRow[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // 直近12ヶ月の年月リストを生成
  const yearMonths = useMemo(() => {
    const months: string[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      months.push(`${year}-${month}`);
    }
    return months;
  }, []);

  // モックアップ用のダミーデータ
  const mockupBudgets: BudgetRow[] = yearMonths.map(ym => {
    const totalSales = Math.round(6000000 + (Math.random() - 0.5) * 500000);
    return {
      yearMonth: ym,
      totalSales,
      insuranceIncome: Math.round(totalSales * 0.9),
      userBurden: Math.round(totalSales * 0.1),
    };
  });

  // 予算データを取得
  const { data: budgets, isLoading } = trpc.budget.list.useQuery(
    { yearMonth: "" }, // 全期間を取得するため空文字列
    {
      enabled: !isMockupMode,
      ...getMockupQueryOptions([]),
    }
  );

  // 割合設定を取得（特別なyearMonth "__RATIO__" で保存）
  useEffect(() => {
    if (isMockupMode) {
      // モックアップモードではデフォルト値を使用
      return;
    }

    if (budgets) {
      const ratioBudget = budgets.find(b => b.yearMonth === "__RATIO__");
      if (ratioBudget) {
        if (ratioBudget.itemName === "保険入金割合") {
          setInsuranceRatio(ratioBudget.amount);
        } else if (ratioBudget.itemName === "利用者請求割合") {
          setUserBurdenRatio(ratioBudget.amount);
        }
      }
    }
  }, [budgets, isMockupMode]);

  useEffect(() => {
    if (isMockupMode) {
      setBudgetRows(mockupBudgets);
      return;
    }

    if (budgets) {
      // 予算データを年月ごとに集計
      const budgetMap = new Map<string, BudgetRow>();
      
      yearMonths.forEach(ym => {
        budgetMap.set(ym, {
          yearMonth: ym,
          totalSales: 0,
          insuranceIncome: 0,
          userBurden: 0,
        });
      });

      budgets.forEach(budget => {
        // 割合設定はスキップ
        if (budget.yearMonth === "__RATIO__") return;

        const row = budgetMap.get(budget.yearMonth) || {
          yearMonth: budget.yearMonth,
          totalSales: 0,
          insuranceIncome: 0,
          userBurden: 0,
        };

        if (budget.itemName === "合計売上予算") {
          row.totalSales = budget.amount;
          // 割合に基づいて自動計算
          row.insuranceIncome = Math.round(budget.amount * (insuranceRatio / 100));
          row.userBurden = Math.round(budget.amount * (userBurdenRatio / 100));
        }

        budgetMap.set(budget.yearMonth, row);
      });

      setBudgetRows(Array.from(budgetMap.values()).sort((a, b) => 
        a.yearMonth.localeCompare(b.yearMonth)
      ));
    }
  }, [budgets, yearMonths, isMockupMode, insuranceRatio, userBurdenRatio]);

  const utils = trpc.useUtils();
  const upsertMutation = trpc.budget.upsert.useMutation({
    onSuccess: () => {
      toast.success("予算を保存しました");
      utils.budget.list.invalidate();
    },
    onError: (error) => {
      toast.error(`保存に失敗しました: ${error.message}`);
    },
  });

  // 合計売上予算の入力変更
  const handleTotalSalesChange = (index: number, value: string) => {
    const normalized = value.replace(/[¥￥円,]/g, '').replace(/[^0-9.-]/g, '');
    const totalSales = parseFloat(normalized) || 0;

    const newRows = [...budgetRows];
    newRows[index] = {
      ...newRows[index],
      totalSales,
      // 割合に基づいて自動計算
      insuranceIncome: Math.round(totalSales * (insuranceRatio / 100)),
      userBurden: Math.round(totalSales * (userBurdenRatio / 100)),
    };
    setBudgetRows(newRows);
  };

  // 割合設定の変更
  const handleRatioChange = (type: 'insurance' | 'userBurden', value: string) => {
    const normalized = value.replace(/[^0-9.]/g, '');
    const ratio = Math.min(100, Math.max(0, parseFloat(normalized) || 0));
    
    let newInsuranceRatio = insuranceRatio;
    let newUserBurdenRatio = userBurdenRatio;
    
    if (type === 'insurance') {
      newInsuranceRatio = ratio;
      newUserBurdenRatio = 100 - ratio;
    } else {
      newUserBurdenRatio = ratio;
      newInsuranceRatio = 100 - ratio;
    }

    setInsuranceRatio(newInsuranceRatio);
    setUserBurdenRatio(newUserBurdenRatio);

    // 既存の予算データを再計算
    const newRows = budgetRows.map(row => ({
      ...row,
      insuranceIncome: Math.round(row.totalSales * (newInsuranceRatio / 100)),
      userBurden: Math.round(row.totalSales * (newUserBurdenRatio / 100)),
    }));
    setBudgetRows(newRows);
  };

  const handleSave = async () => {
    if (isMockupMode) {
      toast.success("モックアップモード: 予算を保存しました（実際には保存されません）");
      return;
    }

    setIsSaving(true);
    try {
      const promises: Promise<any>[] = [];

      // 割合設定を保存
      promises.push(
        upsertMutation.mutateAsync({
          yearMonth: "__RATIO__",
          category: 'income',
          itemName: '保険入金割合',
          amount: insuranceRatio,
        })
      );
      promises.push(
        upsertMutation.mutateAsync({
          yearMonth: "__RATIO__",
          category: 'income',
          itemName: '利用者請求割合',
          amount: userBurdenRatio,
        })
      );

      // 各年月の予算を保存
      budgetRows.forEach(row => {
        // 合計売上予算を保存
        promises.push(
          upsertMutation.mutateAsync({
            yearMonth: row.yearMonth,
            category: 'income',
            itemName: '合計売上予算',
            amount: row.totalSales,
          })
        );
      });

      await Promise.all(promises);
      toast.success("すべての予算と割合設定を保存しました");
    } catch (error) {
      toast.error(`保存に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const formatCurrency = (value: number) => {
    return `¥${value.toLocaleString('ja-JP')}`;
  };

  if (!isMockupMode && isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">予算入力</h1>
        <p className="text-muted-foreground">
          合計売上予算を入力してください。保険入金分と利用者請求分は設定した割合に基づいて自動計算されます。
        </p>
      </div>

      {/* 割合設定カード */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>割合設定</CardTitle>
          <CardDescription>
            保険入金と利用者請求の割合を設定してください（合計100%になるように自動調整されます）
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="insurance-ratio">保険入金の割合 (%)</Label>
              <Input
                id="insurance-ratio"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={insuranceRatio}
                onChange={(e) => handleRatioChange('insurance', e.target.value)}
                className="text-right"
              />
              <p className="text-sm text-muted-foreground">
                現在の設定: {insuranceRatio}%
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-burden-ratio">利用者請求の割合 (%)</Label>
              <Input
                id="user-burden-ratio"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={userBurdenRatio}
                onChange={(e) => handleRatioChange('userBurden', e.target.value)}
                className="text-right"
              />
              <p className="text-sm text-muted-foreground">
                現在の設定: {userBurdenRatio}%
              </p>
            </div>
          </div>
          <div className="mt-4 p-3 bg-muted rounded-md">
            <p className="text-sm font-medium">
              合計: {insuranceRatio + userBurdenRatio}%
              {insuranceRatio + userBurdenRatio !== 100 && (
                <span className="text-red-500 ml-2">（100%になるように調整してください）</span>
              )}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>売上予算入力</CardTitle>
              <CardDescription>
                各月の合計売上予算を入力してください。保険入金と利用者請求は割合に基づいて自動計算されます。
              </CardDescription>
            </div>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  保存中...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  一括保存
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-semibold">年月</th>
                  <th className="text-right py-3 px-4 font-semibold bg-muted">合計売上予算</th>
                  <th className="text-right py-3 px-4 font-semibold">保険入金予算</th>
                  <th className="text-right py-3 px-4 font-semibold">利用者請求予算</th>
                </tr>
              </thead>
              <tbody>
                {budgetRows.map((row, index) => (
                  <tr key={row.yearMonth} className="border-b hover:bg-muted/50">
                    <td className="py-3 px-4 font-medium">{row.yearMonth}</td>
                    <td className="text-right py-3 px-4 bg-muted">
                      <Input
                        type="text"
                        value={row.totalSales > 0 ? formatCurrency(row.totalSales) : ''}
                        onChange={(e) => handleTotalSalesChange(index, e.target.value)}
                        placeholder="¥0"
                        className="text-right w-40 font-semibold"
                      />
                    </td>
                    <td className="text-right py-3 px-4">
                      {formatCurrency(row.insuranceIncome)}
                      <span className="text-xs text-muted-foreground ml-2">
                        ({insuranceRatio}%)
                      </span>
                    </td>
                    <td className="text-right py-3 px-4">
                      {formatCurrency(row.userBurden)}
                      <span className="text-xs text-muted-foreground ml-2">
                        ({userBurdenRatio}%)
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-t-primary font-bold bg-muted/30">
                  <td className="py-3 px-4">合計</td>
                  <td className="text-right py-3 px-4 bg-muted">
                    {formatCurrency(budgetRows.reduce((sum, row) => sum + row.totalSales, 0))}
                  </td>
                  <td className="text-right py-3 px-4">
                    {formatCurrency(budgetRows.reduce((sum, row) => sum + row.insuranceIncome, 0))}
                  </td>
                  <td className="text-right py-3 px-4">
                    {formatCurrency(budgetRows.reduce((sum, row) => sum + row.userBurden, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

