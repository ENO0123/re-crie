import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { isMockupMode, getMockupQueryOptions } from "@/lib/mockup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Edit } from "lucide-react";

export default function Budget({ organizationId: propOrganizationId }: { organizationId?: number } = {}) {
  const [location] = useLocation();
  
  // URLから組織IDを取得（/:organizationId/budget形式）
  const organizationId = useMemo(() => {
    // プロップで渡された場合はそれを使用
    if (propOrganizationId) {
      return propOrganizationId;
    }
    // URLから組織IDを取得
    const match = location.match(/^\/(\d+)\/budget$/);
    if (match) {
      return parseInt(match[1], 10);
    }
    return undefined;
  }, [location, propOrganizationId]);

  const [yearMonth, setYearMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [formData, setFormData] = useState({
    totalSales: "",
    insuranceIncome: "",
    userBurden: "",
  });

  // 予算データを取得（対象年月のデータ）
  const { data: budgets, isLoading } = trpc.budget.list.useQuery(
    { yearMonth, organizationId },
    {
      enabled: !isMockupMode && !!yearMonth,
      ...getMockupQueryOptions(null),
    }
  );

  // 登録履歴を取得（直近12ヶ月）
  const { data: historyData, refetch: refetchHistory } = trpc.budget.list.useQuery(
    { yearMonth: "", organizationId }, // 全期間を取得
    isMockupMode 
      ? {
          enabled: false,
          initialData: undefined,
        }
      : { 
          enabled: true,
          initialData: undefined,
        }
  );

  const utils = trpc.useUtils();
  const upsertMutation = trpc.budget.upsert.useMutation({
    onSuccess: async () => {
      toast.success("予算を保存しました");
      await utils.budget.list.invalidate();
      await refetchHistory();
    },
    onError: (error) => {
      toast.error(`保存に失敗しました: ${error.message}`);
    },
  });

  // データベースから取得した予算データをフォームに反映
  useEffect(() => {
    if (budgets && budgets.length > 0) {
      const newFormData: { totalSales: string; insuranceIncome: string; userBurden: string } = {
        totalSales: "",
        insuranceIncome: "",
        userBurden: "",
      };

      budgets.forEach(budget => {
        // 割合設定はスキップ
        if (budget.yearMonth === "__RATIO__") return;

        const value = budget.amount > 0 ? budget.amount.toLocaleString('ja-JP') : "";
        
        if (budget.itemName === "合計売上予算") {
          newFormData.totalSales = value;
        } else if (budget.itemName === "保険入金予算") {
          newFormData.insuranceIncome = value;
        } else if (budget.itemName === "利用者請求予算") {
          newFormData.userBurden = value;
        }
      });

      setFormData(newFormData);
    } else {
      setFormData({
        totalSales: "",
        insuranceIncome: "",
        userBurden: "",
      });
    }
  }, [budgets]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const normalize = (val: string) => {
      const cleaned = val.replace(/[¥￥円,]/g, '').replace(/[^0-9.-]/g, '');
      return parseFloat(cleaned) || 0;
    };

    const totalSales = normalize(formData.totalSales);
    const insuranceIncome = normalize(formData.insuranceIncome);
    const userBurden = normalize(formData.userBurden);

    if (totalSales === 0 && insuranceIncome === 0 && userBurden === 0) {
      toast.error("少なくとも1つの項目に入力してください");
      return;
    }

    const promises: Promise<any>[] = [];

    if (totalSales > 0) {
      promises.push(
        upsertMutation.mutateAsync({
          yearMonth,
          category: 'income',
          itemName: '合計売上予算',
          amount: totalSales,
          organizationId,
        })
      );
    }

    if (insuranceIncome > 0) {
      promises.push(
        upsertMutation.mutateAsync({
          yearMonth,
          category: 'income',
          itemName: '保険入金予算',
          amount: insuranceIncome,
          organizationId,
        })
      );
    }

    if (userBurden > 0) {
      promises.push(
        upsertMutation.mutateAsync({
          yearMonth,
          category: 'income',
          itemName: '利用者請求予算',
          amount: userBurden,
          organizationId,
        })
      );
    }

    Promise.all(promises).catch((error) => {
      toast.error(`保存に失敗しました: ${error.message}`);
    });
  };

  const calculateTotal = () => {
    const normalize = (val: string) => {
      const cleaned = val.replace(/[¥￥円,]/g, '').replace(/[^0-9.-]/g, '');
      return parseFloat(cleaned) || 0;
    };
    
    return normalize(formData.totalSales);
  };

  const handleEdit = (record: any) => {
    setYearMonth(record.yearMonth);
    
    // 履歴データから該当月の予算を取得
    const yearMonthBudgets = historyData?.filter(b => b.yearMonth === record.yearMonth) || [];
    
    const newFormData: { totalSales: string; insuranceIncome: string; userBurden: string } = {
      totalSales: "",
      insuranceIncome: "",
      userBurden: "",
    };

    yearMonthBudgets.forEach(budget => {
      if (budget.yearMonth === "__RATIO__") return;

      const value = budget.amount > 0 ? budget.amount.toLocaleString('ja-JP') : "";
      
      if (budget.itemName === "合計売上予算") {
        newFormData.totalSales = value;
      } else if (budget.itemName === "保険入金予算") {
        newFormData.insuranceIncome = value;
      } else if (budget.itemName === "利用者請求予算") {
        newFormData.userBurden = value;
      }
    });

    setFormData(newFormData);
    
    // フォームまでスクロール
    setTimeout(() => {
      const formElement = document.querySelector('form');
      if (formElement) {
        formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  // 履歴データを年月ごとに集計
  const historyByYearMonth = useMemo(() => {
    if (!historyData) return new Map();

    const map = new Map<string, { yearMonth: string; totalSales: number; insuranceIncome: number; userBurden: number }>();
    
    historyData.forEach(budget => {
      if (budget.yearMonth === "__RATIO__") return;

      const existing = map.get(budget.yearMonth) || {
        yearMonth: budget.yearMonth,
        totalSales: 0,
        insuranceIncome: 0,
        userBurden: 0,
      };

      if (budget.itemName === "合計売上予算") {
        existing.totalSales = budget.amount;
      } else if (budget.itemName === "保険入金予算") {
        existing.insuranceIncome = budget.amount;
      } else if (budget.itemName === "利用者請求予算") {
        existing.userBurden = budget.amount;
      }

      map.set(budget.yearMonth, existing);
    });

    return map;
  }, [historyData]);

  if (!isMockupMode && isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">予算入力</h1>
        <p className="text-muted-foreground">
          各月の予算を入力してください。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>予算入力</CardTitle>
          <CardDescription>
            全角数字や通貨記号は自動的に半角数字に変換されます
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="yearMonth">対象年月</Label>
              <Input
                id="yearMonth"
                type="month"
                value={yearMonth}
                onChange={(e) => setYearMonth(e.target.value)}
                required
              />
            </div>

            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="totalSales">合計売上予算</Label>
                <Input
                  id="totalSales"
                  type="text"
                  placeholder="例: ¥6,000,000 または 6000000"
                  value={formData.totalSales}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      totalSales: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="insuranceIncome">保険入金予算</Label>
                <Input
                  id="insuranceIncome"
                  type="text"
                  placeholder="例: ¥5,400,000 または 5400000"
                  value={formData.insuranceIncome}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      insuranceIncome: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="userBurden">利用者請求予算</Label>
                <Input
                  id="userBurden"
                  type="text"
                  placeholder="例: ¥600,000 または 600000"
                  value={formData.userBurden}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      userBurden: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="pt-4 border-t">
              <div className="flex justify-between items-center text-lg font-semibold">
                <span>合計売上予算:</span>
                <span className="text-primary">
                  ¥{calculateTotal().toLocaleString('ja-JP')}
                </span>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={upsertMutation.isPending}
            >
              {upsertMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  保存中...
                </>
              ) : (
                "保存"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {historyData && Array.from(historyByYearMonth.values()).length > 0 && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>登録履歴</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Array.from(historyByYearMonth.values())
                .sort((a, b) => b.yearMonth.localeCompare(a.yearMonth))
                .slice(0, 12)
                .map((record) => {
                  const total = record.totalSales;
                  
                  return (
                    <div
                      key={record.yearMonth}
                      className="flex justify-between items-center p-3 rounded-lg bg-muted/50"
                    >
                      <div className="flex flex-col">
                        <span className="font-medium">{record.yearMonth}</span>
                        <span className="text-sm text-muted-foreground">
                          保険入金: ¥{record.insuranceIncome.toLocaleString('ja-JP')} / 
                          利用者請求: ¥{record.userBurden.toLocaleString('ja-JP')}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-primary font-semibold">
                          ¥{total.toLocaleString('ja-JP')}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(record)}
                          className="h-8"
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          編集
                        </Button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

