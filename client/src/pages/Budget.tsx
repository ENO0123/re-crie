import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { isMockupMode, getMockupQueryOptions } from "@/lib/mockup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Copy, AlertTriangle } from "lucide-react";

const MONTH_LABELS = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
const ITEM_KEYS = ["totalSales", "insuranceIncome", "userBurden"] as const;
const ITEM_LABELS: Record<(typeof ITEM_KEYS)[number], string> = {
  totalSales: "合計売上予算",
  insuranceIncome: "保険入金予算",
  userBurden: "利用者請求予算",
};
const ITEM_NAMES: Record<(typeof ITEM_KEYS)[number], string> = {
  totalSales: "合計売上予算",
  insuranceIncome: "保険入金予算",
  userBurden: "利用者請求予算",
};

type MonthData = { totalSales: string; insuranceIncome: string; userBurden: string };

function emptyMonthData(): MonthData {
  return { totalSales: "", insuranceIncome: "", userBurden: "" };
}

export default function Budget({ organizationId: propOrganizationId }: { organizationId?: number } = {}) {
  const [location] = useLocation();

  const organizationId = useMemo(() => {
    if (propOrganizationId) return propOrganizationId;
    const match = location.match(/^\/(\d+)\/budget$/);
    if (match) return parseInt(match[1], 10);
    return undefined;
  }, [location, propOrganizationId]);

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [tableData, setTableData] = useState<Record<string, MonthData>>({});

  // 1年分の yearMonth リスト
  const yearMonths = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      return `${selectedYear}-${String(m).padStart(2, "0")}`;
    });
  }, [selectedYear]);

  // 全期間の予算を取得（対象年度の表示用）
  const { data: allBudgets, isLoading } = trpc.budget.list.useQuery(
    { yearMonth: "", organizationId },
    {
      enabled: !isMockupMode && !!organizationId,
      ...getMockupQueryOptions(null),
    }
  );

  const utils = trpc.useUtils();
  const upsertMutation = trpc.budget.upsert.useMutation({
    onSuccess: async () => {
      await utils.budget.list.invalidate();
    },
    onError: (error) => {
      toast.error(`保存に失敗しました: ${error.message}`);
    },
  });

  // 取得した予算を対象年度の表データに反映
  useEffect(() => {
    if (!allBudgets) return;

    const next: Record<string, MonthData> = {};
    yearMonths.forEach((ym) => {
      next[ym] = { ...emptyMonthData() };
    });

    allBudgets.forEach((b) => {
      if (b.yearMonth === "__RATIO__") return;
      const ym = b.yearMonth;
      if (!yearMonths.includes(ym)) return;
      if (!next[ym]) next[ym] = { ...emptyMonthData() };
      const value = b.amount > 0 ? b.amount.toLocaleString("ja-JP") : "";
      if (b.itemName === "合計売上予算") next[ym].totalSales = value;
      else if (b.itemName === "保険入金予算") next[ym].insuranceIncome = value;
      else if (b.itemName === "利用者請求予算") next[ym].userBurden = value;
    });

    setTableData(next);
  }, [allBudgets, yearMonths]);

  const normalize = (val: string) => {
    const cleaned = val.replace(/[¥￥円,]/g, "").replace(/[^0-9.-]/g, "");
    return parseFloat(cleaned) || 0;
  };

  const updateCell = (yearMonth: string, item: (typeof ITEM_KEYS)[number], value: string) => {
    setTableData((prev) => {
      const current = prev[yearMonth] ?? emptyMonthData();
      const updated = { ...current, [item]: value };

      // 合計売上予算 → 保険入金(90%)・利用者請求(10%) を自動計算
      if (item === "totalSales") {
        const total = normalize(value);
        if (total > 0) {
          const insurance = Math.round(total * 0.9);
          const burden = total - insurance;
          updated.insuranceIncome = insurance.toLocaleString("ja-JP");
          updated.userBurden = burden.toLocaleString("ja-JP");
        }
      }

      // 保険入金 or 利用者請求 → 合計売上予算を合計で更新
      if (item === "insuranceIncome" || item === "userBurden") {
        const insurance = normalize(item === "insuranceIncome" ? value : current.insuranceIncome);
        const burden = normalize(item === "userBurden" ? value : current.userBurden);
        if (insurance > 0 || burden > 0) {
          updated.totalSales = (insurance + burden).toLocaleString("ja-JP");
        }
      }

      return { ...prev, [yearMonth]: updated };
    });
  };

  // 3項目の整合性チェック（不一致時に行をハイライト）
  const isRowMismatch = (row: MonthData) => {
    const total = normalize(row.totalSales);
    const insurance = normalize(row.insuranceIncome);
    const burden = normalize(row.userBurden);
    if (total === 0 && insurance === 0 && burden === 0) return false;
    if (total === 0 || (insurance === 0 && burden === 0)) return false;
    return Math.abs(total - (insurance + burden)) > 0;
  };

  // 不一致月の詳細リスト
  const mismatchDetails = useMemo(() => {
    return yearMonths
      .map((ym, index) => {
        const row = tableData[ym] ?? emptyMonthData();
        if (!isRowMismatch(row)) return null;
        const total = normalize(row.totalSales);
        const insurance = normalize(row.insuranceIncome);
        const burden = normalize(row.userBurden);
        const subTotal = insurance + burden;
        const diff = total - subTotal;
        return { label: MONTH_LABELS[index], total, insurance, burden, subTotal, diff };
      })
      .filter(Boolean) as {
        label: string;
        total: number;
        insurance: number;
        burden: number;
        subTotal: number;
        diff: number;
      }[];
  }, [tableData, yearMonths]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const promises: Promise<unknown>[] = [];
    yearMonths.forEach((yearMonth) => {
      const row = tableData[yearMonth] ?? emptyMonthData();
      const totalSales = normalize(row.totalSales);
      const insuranceIncome = normalize(row.insuranceIncome);
      const userBurden = normalize(row.userBurden);

      if (totalSales > 0) {
        promises.push(
          upsertMutation.mutateAsync({
            yearMonth,
            category: "income",
            itemName: ITEM_NAMES.totalSales,
            amount: totalSales,
            organizationId,
          })
        );
      }
      if (insuranceIncome > 0) {
        promises.push(
          upsertMutation.mutateAsync({
            yearMonth,
            category: "income",
            itemName: ITEM_NAMES.insuranceIncome,
            amount: insuranceIncome,
            organizationId,
          })
        );
      }
      if (userBurden > 0) {
        promises.push(
          upsertMutation.mutateAsync({
            yearMonth,
            category: "income",
            itemName: ITEM_NAMES.userBurden,
            amount: userBurden,
            organizationId,
          })
        );
      }
    });

    if (promises.length === 0) {
      toast.error("少なくとも1つのセルに入力してください");
      return;
    }

    Promise.all(promises)
      .then(() => toast.success("予算を保存しました"))
      .catch(() => {});
  };

  const yearOptions = useMemo(() => {
    const years: number[] = [];
    for (let y = currentYear + 1; y >= currentYear - 5; y--) years.push(y);
    return years;
  }, [currentYear]);

  /** 指定月に前月の数値のみをコピーする */
  const handleCopyFromPrevMonth = (thisMonth: string, prevMonth: string) => {
    setTableData((prev) => ({
      ...prev,
      [thisMonth]: { ...(prev[prevMonth] ?? emptyMonthData()) },
    }));
    toast.success(`${MONTH_LABELS[yearMonths.indexOf(thisMonth)]}に前月の数値をコピーしました`);
  };

  if (!isMockupMode && isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">予算入力</h1>
        <p className="text-muted-foreground">
          対象年度の1年分を表形式で入力できます。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>予算入力（1年分）</CardTitle>
          <CardDescription>
            全角数字や通貨記号は自動的に半角数字に変換されます
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2 max-w-[140px]">
              <Label htmlFor="selectedYear">対象年度</Label>
              <select
                id="selectedYear"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}年
                  </option>
                ))}
              </select>
            </div>

            <div className="overflow-x-auto -mx-2">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 font-medium w-14">月</th>
                    <th className="text-left p-2 font-medium min-w-[120px]">{ITEM_LABELS.totalSales}</th>
                    <th className="text-left p-2 font-medium min-w-[120px]">{ITEM_LABELS.insuranceIncome}</th>
                    <th className="text-left p-2 font-medium min-w-[120px]">{ITEM_LABELS.userBurden}</th>
                    <th className="text-left p-2 font-medium w-[100px]"></th>
                  </tr>
                </thead>
                <tbody>
                  {yearMonths.map((yearMonth, index) => {
                    const row = tableData[yearMonth] ?? emptyMonthData();
                    const mismatch = isRowMismatch(row);
                    return (
                      <tr key={yearMonth} className={`border-b border-border/50 hover:bg-muted/30 ${mismatch ? "bg-yellow-50" : ""}`}>
                        <td className="p-2 font-medium text-muted-foreground">{MONTH_LABELS[index]}</td>
                        <td className="p-1">
                          <Input
                            type="text"
                            placeholder="0"
                            className="h-9 text-right tabular-nums"
                            value={row.totalSales}
                            onChange={(e) => updateCell(yearMonth, "totalSales", e.target.value)}
                          />
                        </td>
                        <td className="p-1">
                          <Input
                            type="text"
                            placeholder="0"
                            className="h-9 text-right tabular-nums"
                            value={row.insuranceIncome}
                            onChange={(e) => updateCell(yearMonth, "insuranceIncome", e.target.value)}
                          />
                        </td>
                        <td className="p-1">
                          <Input
                            type="text"
                            placeholder="0"
                            className="h-9 text-right tabular-nums"
                            value={row.userBurden}
                            onChange={(e) => updateCell(yearMonth, "userBurden", e.target.value)}
                          />
                        </td>
                        <td className="p-1 w-[160px]">
                          <div className="flex items-center gap-1">
                            {index > 0 ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 text-muted-foreground hover:text-foreground"
                                onClick={() => handleCopyFromPrevMonth(yearMonth, yearMonths[index - 1])}
                              >
                                <Copy className="w-3.5 h-3.5 mr-1" />
                                前月コピー
                              </Button>
                            ) : null}
                            {mismatch && (
                              <span className="text-xs text-yellow-700 font-medium whitespace-nowrap">合計不一致</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 不一致エラーバナー */}
            {mismatchDetails.length > 0 && (
              <div className="relative">
                {/* 吹き出しの三角（テーブル側を指す） */}
                <div className="flex justify-start pl-6">
                  <div className="w-0 h-0 border-l-[8px] border-r-[8px] border-b-[8px] border-l-transparent border-r-transparent border-b-yellow-300" />
                </div>
                <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-yellow-800 font-semibold text-sm">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    合計売上予算と内訳の合計が一致しない月があります
                  </div>
                  <ul className="space-y-1.5 pl-6">
                    {mismatchDetails.map((d) => (
                      <li key={d.label} className="text-xs text-yellow-900">
                        <span className="font-semibold">{d.label}：</span>
                        合計売上予算 ¥{d.total.toLocaleString("ja-JP")} ≠ 保険入金 ¥{d.insurance.toLocaleString("ja-JP")} + 利用者請求 ¥{d.burden.toLocaleString("ja-JP")} = ¥{d.subTotal.toLocaleString("ja-JP")}
                        <span className={`ml-1 font-semibold ${d.diff > 0 ? "text-red-600" : "text-blue-600"}`}>
                          （差額 {d.diff > 0 ? "+" : ""}¥{d.diff.toLocaleString("ja-JP")}）
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <div className="pt-4 border-t">
              <Button
                type="submit"
                className="w-full sm:w-auto min-w-[200px]"
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
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
