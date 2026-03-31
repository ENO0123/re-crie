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

// ─── セクション定義 ────────────────────────────────────
const expenseSections = [
  {
    title: "事業支出",
    bgColor: "bg-green-50",
    headerBgColor: "bg-green-100",
    textColor: "text-green-800",
    borderColor: "border-green-200",
    fields: [
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
    ],
  },
  {
    title: "その他事業支出",
    bgColor: "bg-emerald-50",
    headerBgColor: "bg-emerald-100",
    textColor: "text-emerald-800",
    borderColor: "border-emerald-200",
    fields: [
      { key: "miscellaneous", label: "雑費・その他" },
      { key: "pettyCash", label: "小口補充" },
      { key: "cardPayment", label: "カード支払分引落額" },
    ],
  },
  {
    title: "事業外支出",
    bgColor: "bg-orange-50",
    headerBgColor: "bg-orange-100",
    textColor: "text-orange-800",
    borderColor: "border-orange-200",
    fields: [
      { key: "representativeLoanRepayment", label: "代表者借入金返済" },
      { key: "shortTermLoanRepayment", label: "短期借入金返済" },
      { key: "longTermLoanRepayment", label: "長期借入金返済" },
      { key: "regularDeposit", label: "定期積金" },
      { key: "taxPayment", label: "税金納付" },
    ],
  },
  {
    title: "その他事業外支出",
    bgColor: "bg-amber-50",
    headerBgColor: "bg-amber-100",
    textColor: "text-amber-800",
    borderColor: "border-amber-200",
    fields: [
      { key: "otherNonBusinessExpense", label: "その他(事業外支出)" },
    ],
  },
] as const;

const expenseFields = expenseSections.flatMap((s) => s.fields);

// ─── ユーティリティ ────────────────────────────────────
const normalize = (val: string) => {
  const cleaned = val.replace(/[¥￥円,]/g, "").replace(/[^0-9.-]/g, "");
  return parseFloat(cleaned) || 0;
};

// ─── メインコンポーネント ───────────────────────────────
export default function Expense({ organizationId: propOrganizationId }: { organizationId?: number } = {}) {
  const [location] = useLocation();

  const organizationId = useMemo(() => {
    if (propOrganizationId) return propOrganizationId;
    const match = location.match(/^\/(\d+)\/expense$/);
    if (match) return parseInt(match[1], 10);
    return undefined;
  }, [location, propOrganizationId]);

  const [yearMonth, setYearMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const [formData, setFormData] = useState<Record<string, string>>(
    expenseFields.reduce((acc, f) => ({ ...acc, [f.key]: "" }), {})
  );

  const { data: existingData, isLoading } = trpc.expense.getByYearMonth.useQuery(
    { yearMonth, organizationId },
    { enabled: !isMockupMode && !!yearMonth, ...getMockupQueryOptions(null) }
  );

  const { data: historyData, refetch: refetchHistory } = trpc.expense.list.useQuery(
    { limit: 12, organizationId },
    isMockupMode ? { enabled: false, initialData: undefined } : { enabled: true, initialData: undefined }
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
      const next: Record<string, string> = {};
      expenseFields.forEach((f) => {
        const val = existingData[f.key as keyof typeof existingData] as number | undefined;
        next[f.key] = val && val > 0 ? val.toLocaleString("ja-JP") : "";
      });
      setFormData(next);
    } else {
      setFormData(expenseFields.reduce((acc, f) => ({ ...acc, [f.key]: "" }), {}));
    }
  }, [existingData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    upsertMutation.mutate({ yearMonth, ...formData, organizationId });
  };

  const calculateTotal = () =>
    Object.values(formData).reduce((sum, v) => sum + normalize(v), 0);

  const handleEdit = (record: any) => {
    setYearMonth(record.yearMonth);
    const next: Record<string, string> = {};
    expenseFields.forEach((f) => {
      const val = record[f.key as keyof typeof record] as number | undefined;
      next[f.key] = val && val > 0 ? val.toLocaleString("ja-JP") : "";
    });
    setFormData(next);
    setTimeout(() => {
      document.querySelector("form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  if (!isMockupMode && isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  let firstFieldRendered = false;

  return (
    <div className="container py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">支出実績登録</h1>
        <p className="text-muted-foreground">費目別の支出実績を登録します。</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>支出実績入力</CardTitle>
          <CardDescription>全角数字や通貨記号は自動的に半角数字に変換されます</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 対象年月 */}
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

            {/* セクション別費目 */}
            <div className="space-y-4">
              {expenseSections.map((section) => (
                <div
                  key={section.title}
                  className={`rounded-lg border ${section.borderColor} overflow-hidden`}
                >
                  {/* セクションヘッダー */}
                  <div className={`${section.headerBgColor} px-4 py-2`}>
                    <span className={`text-sm font-semibold ${section.textColor}`}>{section.title}</span>
                  </div>

                  {/* 費目フィールド */}
                  <div className={`${section.bgColor} px-4 py-3 space-y-3`}>
                    {section.fields.map((field) => {
                      const isFirst = !firstFieldRendered;
                      if (isFirst) firstFieldRendered = true;

                      return (
                        <div key={field.key} className="space-y-1">
                          <Label htmlFor={field.key} className="text-sm">
                            {field.label}
                          </Label>
                          <Input
                            id={field.key}
                            type="text"
                            placeholder={isFirst ? "例: ¥1,000,000 または 1000000" : ""}
                            value={formData[field.key]}
                            onChange={(e) =>
                              setFormData((prev) => ({ ...prev, [field.key]: e.target.value }))
                            }
                            className="bg-white"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* 合計 */}
            <div className="pt-4 border-t">
              <div className="flex justify-between items-center text-lg font-semibold">
                <span>合計金額:</span>
                <span className="text-destructive">¥{calculateTotal().toLocaleString("ja-JP")}</span>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={upsertMutation.isPending}>
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
                const total = expenseFields.reduce(
                  (sum, f) => sum + ((record[f.key as keyof typeof record] as number) || 0),
                  0
                );
                return (
                  <div
                    key={record.id}
                    className="flex justify-between items-center p-3 rounded-lg bg-muted/50"
                  >
                    <span className="font-medium">{record.yearMonth}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-destructive font-semibold">
                        ¥{total.toLocaleString("ja-JP")}
                      </span>
                      <Button variant="outline" size="sm" onClick={() => handleEdit(record)} className="h-8">
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
