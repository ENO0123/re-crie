import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { isMockupMode, getMockupQueryOptions } from "@/lib/mockup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Edit, Calculator, Plus, Trash2 } from "lucide-react";

// ─── 型 ───────────────────────────────────────────────
type CalcRow = { id: string; memo: string; amount: string };

// ─── セクション定義 ────────────────────────────────────
const incomeSections = [
  {
    title: "事業収入",
    bgColor: "bg-blue-50",
    headerBgColor: "bg-blue-100",
    textColor: "text-blue-800",
    borderColor: "border-blue-200",
    fields: [
      { key: "insuranceIncome", label: "保険入金" },
      { key: "userBurdenTransfer", label: "【振込】利用者負担" },
      { key: "userBurdenWithdrawal", label: "【口座振替】利用者負担" },
      { key: "factoringIncome1", label: "【ファクタリング】入金(前月分)" },
      { key: "factoringIncome2", label: "【ファクタリング】残金入金(3ヶ月前)" },
    ],
  },
  {
    title: "その他事業収入",
    bgColor: "bg-sky-50",
    headerBgColor: "bg-sky-100",
    textColor: "text-sky-800",
    borderColor: "border-sky-200",
    fields: [
      { key: "otherBusinessIncome", label: "【その他】事業収入" },
    ],
  },
  {
    title: "財務収入",
    bgColor: "bg-violet-50",
    headerBgColor: "bg-violet-100",
    textColor: "text-violet-800",
    borderColor: "border-violet-200",
    fields: [
      { key: "representativeLoan", label: "代表者借入" },
      { key: "shortTermLoan", label: "短期借入" },
      { key: "longTermLoan", label: "長期借入" },
      { key: "interestIncome", label: "受取利息" },
    ],
  },
  {
    title: "その他事業外収入",
    bgColor: "bg-purple-50",
    headerBgColor: "bg-purple-100",
    textColor: "text-purple-800",
    borderColor: "border-purple-200",
    fields: [
      { key: "otherNonBusinessIncome", label: "【その他】事業外収入" },
    ],
  },
] as const;

type FieldKey = (typeof incomeSections)[number]["fields"][number]["key"];
const incomeFields = incomeSections.flatMap((s) => s.fields);

// ─── ユーティリティ ────────────────────────────────────
const normalize = (val: string) => {
  const cleaned = val.replace(/[¥￥円,]/g, "").replace(/[^0-9.-]/g, "");
  return parseFloat(cleaned) || 0;
};
let _idCounter = 0;
const newId = () => `calc-${++_idCounter}-${Math.random().toString(36).slice(2, 6)}`;

// ─── 電卓パネル ────────────────────────────────────────
function CalcPanel({
  fieldKey,
  rows,
  onRowsChange,
  onApply,
}: {
  fieldKey: string;
  rows: CalcRow[];
  onRowsChange: (rows: CalcRow[]) => void;
  onApply: (total: number) => void;
}) {
  const total = rows.reduce((sum, r) => sum + normalize(r.amount), 0);

  const updateRow = (id: string, patch: Partial<CalcRow>) => {
    const next = rows.map((r) => (r.id === id ? { ...r, ...patch } : r));
    onRowsChange(next);
    onApply(next.reduce((s, r) => s + normalize(r.amount), 0));
  };

  const addRow = () => {
    const next = [...rows, { id: newId(), memo: "", amount: "" }];
    onRowsChange(next);
  };

  const deleteRow = (id: string) => {
    const next = rows.filter((r) => r.id !== id);
    onRowsChange(next);
    onApply(next.reduce((s, r) => s + normalize(r.amount), 0));
  };

  return (
    <div className="mt-1 rounded-md border border-dashed border-muted-foreground/30 bg-white p-3 space-y-2">
      {rows.length === 0 && (
        <p className="text-xs text-muted-foreground">行を追加して内訳を入力できます（合計が上のフィールドに反映されます）</p>
      )}
      {rows.map((row, i) => (
        <div key={row.id} className="flex items-center gap-2">
          <Input
            type="text"
            placeholder={`内訳${i + 1}のメモ（任意）`}
            value={row.memo}
            onChange={(e) => updateRow(row.id, { memo: e.target.value })}
            className="h-8 text-sm flex-1"
          />
          <Input
            type="text"
            placeholder="金額"
            value={row.amount}
            onChange={(e) => updateRow(row.id, { amount: e.target.value })}
            className="h-8 text-sm w-32 text-right tabular-nums"
          />
          <button
            type="button"
            onClick={() => deleteRow(row.id)}
            className="h-8 w-8 flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <div className="flex items-center justify-between pt-1">
        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={addRow}>
          <Plus className="h-3 w-3" />
          行を追加
        </Button>
        {rows.length > 0 && (
          <span className="text-sm font-semibold tabular-nums">
            合計: ¥{total.toLocaleString("ja-JP")}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── メインコンポーネント ───────────────────────────────
export default function Income({ organizationId: propOrganizationId }: { organizationId?: number } = {}) {
  const [location] = useLocation();

  const organizationId = useMemo(() => {
    if (propOrganizationId) return propOrganizationId;
    const match = location.match(/^\/(\d+)\/income$/);
    if (match) return parseInt(match[1], 10);
    return undefined;
  }, [location, propOrganizationId]);

  const [yearMonth, setYearMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const [formData, setFormData] = useState<Record<string, string>>(
    incomeFields.reduce((acc, f) => ({ ...acc, [f.key]: "" }), {})
  );

  // 電卓パネルの開閉状態・行データ
  const [calcOpen, setCalcOpen] = useState<Record<string, boolean>>({});
  const [calcRows, setCalcRows] = useState<Record<string, CalcRow[]>>({});

  const { data: existingData, isLoading } = trpc.income.getByYearMonth.useQuery(
    { yearMonth, organizationId },
    { enabled: !isMockupMode && !!yearMonth, ...getMockupQueryOptions(null) }
  );

  const { data: historyData, refetch: refetchHistory } = trpc.income.list.useQuery(
    { limit: 12, organizationId },
    isMockupMode ? { enabled: false, initialData: undefined } : { enabled: true, initialData: undefined }
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
      const next: Record<string, string> = {};
      incomeFields.forEach((f) => {
        const val = existingData[f.key as keyof typeof existingData] as number | undefined;
        next[f.key] = val && val > 0 ? val.toLocaleString("ja-JP") : "";
      });
      setFormData(next);
    } else {
      setFormData(incomeFields.reduce((acc, f) => ({ ...acc, [f.key]: "" }), {}));
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
    incomeFields.forEach((f) => {
      const val = record[f.key as keyof typeof record] as number | undefined;
      next[f.key] = val && val > 0 ? val.toLocaleString("ja-JP") : "";
    });
    setFormData(next);
    setTimeout(() => {
      document.querySelector("form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const toggleCalc = (key: string) => {
    setCalcOpen((prev) => {
      const opening = !prev[key];
      if (opening && !calcRows[key]) {
        setCalcRows((r) => ({ ...r, [key]: [{ id: newId(), memo: "", amount: "" }] }));
      }
      return { ...prev, [key]: opening };
    });
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
        <h1 className="text-3xl font-bold mb-2">入金実績登録</h1>
        <p className="text-muted-foreground">費目別の入金実績を登録します。</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>入金実績入力</CardTitle>
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
              {incomeSections.map((section) => (
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
                      const isCalcOpen = calcOpen[field.key] ?? false;
                      const rows = calcRows[field.key] ?? [];

                      return (
                        <div key={field.key} className="space-y-1">
                          <Label htmlFor={field.key} className="text-sm">
                            {field.label}
                          </Label>
                          <div className="flex items-center gap-2">
                            <Input
                              id={field.key}
                              type="text"
                              placeholder={isFirst ? "例: ¥650,000 または 650000" : ""}
                              value={formData[field.key]}
                              onChange={(e) =>
                                setFormData((prev) => ({ ...prev, [field.key]: e.target.value }))
                              }
                              className="bg-white"
                            />
                            <button
                              type="button"
                              title="電卓：内訳を入力して合計を自動計算"
                              onClick={() => toggleCalc(field.key)}
                              className={`h-10 w-10 flex items-center justify-center rounded-md border transition-colors shrink-0 ${
                                isCalcOpen
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-white border-input hover:bg-accent text-muted-foreground"
                              }`}
                            >
                              <Calculator className="h-4 w-4" />
                            </button>
                          </div>
                          {isCalcOpen && (
                            <CalcPanel
                              fieldKey={field.key}
                              rows={rows}
                              onRowsChange={(next) =>
                                setCalcRows((prev) => ({ ...prev, [field.key]: next }))
                              }
                              onApply={(total) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  [field.key]: total > 0 ? total.toLocaleString("ja-JP") : "",
                                }))
                              }
                            />
                          )}
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
                <span className="text-primary">¥{calculateTotal().toLocaleString("ja-JP")}</span>
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
                const total = incomeFields.reduce(
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
                      <span className="text-primary font-semibold">
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
