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

const expenseFields = [
  { key: "personnelCost", label: "人件費" },
  { key: "legalWelfare", label: "法定福利・福利厚生" },
  { key: "advertising", label: "広告宣伝費" },
  { key: "travelVehicle", label: "旅費交通費・車両費" },
  { key: "communication", label: "通信費" },
  { key: "consumables", label: "消耗品費・事務用品" },
  { key: "utilities", label: "水道光熱費" },
  { key: "rent", label: "地代家賃" },
  { key: "leaseLoan", label: "リース料・ローン支払" },
  { key: "paymentFee", label: "支払報酬" },
  { key: "paymentCommission", label: "支払手数料" },
  { key: "paymentInterest", label: "支払利息" },
  { key: "miscellaneous", label: "雑費・その他" },
  { key: "pettyCash", label: "小口補充" },
  { key: "cardPayment", label: "カード支払い" },
  { key: "representativeLoanRepayment", label: "代表者借入金返済" },
  { key: "shortTermLoanRepayment", label: "短期借入金返済" },
  { key: "longTermLoanRepayment", label: "長期借入金返済" },
  { key: "regularDeposit", label: "定期積金" },
  { key: "taxPayment", label: "税金納付" },
  { key: "otherNonBusinessExpense", label: "その他(事業外支出)" },
];

export default function Expense({ organizationId: propOrganizationId }: { organizationId?: number } = {}) {
  const [location] = useLocation();
  
  // URLから組織IDを取得（/:organizationId/expense形式）
  const organizationId = useMemo(() => {
    // プロップで渡された場合はそれを使用
    if (propOrganizationId) {
      return propOrganizationId;
    }
    // URLから組織IDを取得
    const match = location.match(/^\/(\d+)\/expense$/);
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
    expenseFields.reduce((acc, field) => ({ ...acc, [field.key]: "" }), {})
  );

  const { data: existingData, isLoading } = trpc.expense.getByYearMonth.useQuery(
    { yearMonth, organizationId },
    { 
      enabled: !isMockupMode && !!yearMonth,
      ...getMockupQueryOptions(null)
    }
  );

  const { data: historyData, refetch: refetchHistory } = trpc.expense.list.useQuery(
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
  const upsertMutation = trpc.expense.upsert.useMutation({
    onSuccess: async () => {
      toast.success("支出実績を保存しました");
      await utils.expense.list.invalidate();
      await utils.expense.getByYearMonth.invalidate();
      await refetchHistory();
    },
    onError: (error) => {
      toast.error(`保存に失敗しました: ${error.message}`);
    },
  });

  useEffect(() => {
    if (existingData) {
      const newFormData: Record<string, string> = {};
      expenseFields.forEach((field) => {
        const value = existingData[field.key as keyof typeof existingData] as number | undefined;
        // カンマ区切りでフォーマット（値がある場合のみ）
        newFormData[field.key] = value && value > 0 
          ? value.toLocaleString('ja-JP') 
          : "";
      });
      setFormData(newFormData);
    } else {
      setFormData(expenseFields.reduce((acc, field) => ({ ...acc, [field.key]: "" }), {}));
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
    expenseFields.forEach((field) => {
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
        <h1 className="text-3xl font-bold mb-2">支出実績登録</h1>
        <p className="text-muted-foreground">
          費目別の支出実績を登録します。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>支出実績入力</CardTitle>
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
              {expenseFields.map((field) => (
                <div key={field.key} className="space-y-2">
                  <Label htmlFor={field.key}>{field.label}</Label>
                  <Input
                    id={field.key}
                    type="text"
                    placeholder="例: ¥1,000,000 または 1000000"
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
                <span className="text-destructive">
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
                const total = expenseFields.reduce((sum, field) => {
                  return sum + (record[field.key as keyof typeof record] as number || 0);
                }, 0);
                
                return (
                  <div
                    key={record.id}
                    className="flex justify-between items-center p-3 rounded-lg bg-muted/50"
                  >
                    <span className="font-medium">{record.yearMonth}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-destructive font-semibold">
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
