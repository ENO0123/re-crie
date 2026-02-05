import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { isMockupMode, getMockupQueryOptions, mockupData } from "@/lib/mockup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Edit } from "lucide-react";

const incomeFields = [
  { key: "insuranceIncome", label: "保険入金" },
  { key: "userBurdenTransfer", label: "【振込】利用者負担" },
  { key: "userBurdenWithdrawal", label: "【口座振替】利用者負担" },
  { key: "factoringIncome1", label: "【ファクタリング】入金(前月分)" },
  { key: "factoringIncome2", label: "【ファクタリング】残金入金(3ヶ月前)" },
  { key: "otherBusinessIncome", label: "【その他】事業収入" },
  { key: "representativeLoan", label: "代表者借入" },
  { key: "shortTermLoan", label: "短期借入" },
  { key: "longTermLoan", label: "長期借入" },
  { key: "interestIncome", label: "受取利息" },
  { key: "otherNonBusinessIncome", label: "【その他】事業外収入" },
];

export default function Income({ organizationId: propOrganizationId }: { organizationId?: number } = {}) {
  const [location] = useLocation();
  
  // URLから組織IDを取得（/:organizationId/income形式）
  const organizationId = useMemo(() => {
    // プロップで渡された場合はそれを使用
    if (propOrganizationId) {
      return propOrganizationId;
    }
    // URLから組織IDを取得
    const match = location.match(/^\/(\d+)\/income$/);
    if (match) {
      return parseInt(match[1], 10);
    }
    return undefined;
  }, [location, propOrganizationId]);

  const [yearMonth, setYearMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [formData, setFormData] = useState<Record<string, string>>(
    incomeFields.reduce((acc, field) => ({ ...acc, [field.key]: "" }), {})
  );

  const { data: existingData, isLoading } = trpc.income.getByYearMonth.useQuery(
    { yearMonth, organizationId },
    { 
      enabled: !isMockupMode && !!yearMonth,
      ...getMockupQueryOptions(null)
    }
  );

  const { data: historyData, refetch: refetchHistory } = trpc.income.list.useQuery(
    { limit: 12, organizationId },
    isMockupMode 
      ? {
          enabled: false,
          initialData: undefined, // ダミーデータを表示しない
        }
      : { 
          enabled: true,
          initialData: undefined, // ダミーデータを表示しない
        }
  );

  const utils = trpc.useUtils();
  const upsertMutation = trpc.income.upsert.useMutation({
    onSuccess: async () => {
      toast.success("入金実績を保存しました");
      await utils.income.list.invalidate();
      await utils.income.getByYearMonth.invalidate();
      await refetchHistory();
    },
    onError: (error) => {
      toast.error(`保存に失敗しました: ${error.message}`);
    },
  });

  useEffect(() => {
    if (existingData) {
      const newFormData: Record<string, string> = {};
      incomeFields.forEach((field) => {
        const value = existingData[field.key as keyof typeof existingData] as number | undefined;
        // カンマ区切りでフォーマット（値がある場合のみ）
        newFormData[field.key] = value && value > 0 
          ? value.toLocaleString('ja-JP') 
          : "";
      });
      setFormData(newFormData);
    } else {
      setFormData(incomeFields.reduce((acc, field) => ({ ...acc, [field.key]: "" }), {}));
    }
  }, [existingData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    upsertMutation.mutate({
      yearMonth,
      ...formData,
      organizationId,
    });
  };

  const calculateTotal = () => {
    const normalize = (val: string) => {
      const cleaned = val.replace(/[¥￥円,]/g, '').replace(/[^0-9.-]/g, '');
      return parseFloat(cleaned) || 0;
    };
    
    return Object.values(formData).reduce((sum, val) => sum + normalize(val), 0);
  };

  const handleEdit = (record: any) => {
    setYearMonth(record.yearMonth);
    const newFormData: Record<string, string> = {};
    incomeFields.forEach((field) => {
      const value = record[field.key as keyof typeof record] as number | undefined;
      newFormData[field.key] = value && value > 0 
        ? value.toLocaleString('ja-JP') 
        : "";
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
        <h1 className="text-3xl font-bold mb-2">入金実績登録</h1>
        <p className="text-muted-foreground">
          費目別の入金実績を登録します。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>入金実績入力</CardTitle>
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
              {incomeFields.map((field) => (
                <div key={field.key} className="space-y-2">
                  <Label htmlFor={field.key}>{field.label}</Label>
                  <Input
                    id={field.key}
                    type="text"
                    placeholder="例: ¥650,000 または 650000"
                    value={formData[field.key]}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        [field.key]: e.target.value,
                      }))
                    }
                  />
                </div>
              ))}
            </div>

            <div className="pt-4 border-t">
              <div className="flex justify-between items-center text-lg font-semibold">
                <span>合計金額:</span>
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

      {historyData && historyData.length > 0 && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>登録履歴</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {historyData.map((record) => {
                const total = incomeFields.reduce((sum, field) => {
                  return sum + (record[field.key as keyof typeof record] as number || 0);
                }, 0);
                
                return (
                  <div
                    key={record.id}
                    className="flex justify-between items-center p-3 rounded-lg bg-muted/50"
                  >
                    <span className="font-medium">{record.yearMonth}</span>
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
