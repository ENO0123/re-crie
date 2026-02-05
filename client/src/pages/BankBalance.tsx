import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { isMockupMode, getMockupQueryOptions, mockupData } from "@/lib/mockup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Edit } from "lucide-react";

export default function BankBalance() {
  const [yearMonth, setYearMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [balances, setBalances] = useState({
    balance1: "",
    balance2: "",
    balance3: "",
    balance4: "",
    balance5: "",
  });

  const { data: existingData, isLoading } = trpc.bankBalance.getByYearMonth.useQuery(
    { yearMonth },
    { 
      enabled: !isMockupMode && !!yearMonth,
      ...getMockupQueryOptions(null)
    }
  );

  const { data: historyData, refetch: refetchHistory } = trpc.bankBalance.list.useQuery(
    { limit: 12 },
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
  const upsertMutation = trpc.bankBalance.upsert.useMutation({
    onSuccess: async () => {
      toast.success("口座残高を保存しました");
      await utils.bankBalance.list.invalidate();
      await utils.bankBalance.getByYearMonth.invalidate();
      await refetchHistory();
    },
    onError: (error) => {
      toast.error(`保存に失敗しました: ${error.message}`);
    },
  });

  // Load existing data when available
  useEffect(() => {
    if (existingData) {
      setBalances({
        balance1: existingData.balance1?.toString() || "",
        balance2: existingData.balance2?.toString() || "",
        balance3: existingData.balance3?.toString() || "",
        balance4: existingData.balance4?.toString() || "",
        balance5: existingData.balance5?.toString() || "",
      });
    }
  }, [existingData]);

  const handleEdit = (record: { yearMonth: string; balance1?: number | null; balance2?: number | null; balance3?: number | null; balance4?: number | null; balance5?: number | null }) => {
    setYearMonth(record.yearMonth);
    setBalances({
      balance1: record.balance1?.toString() || "",
      balance2: record.balance2?.toString() || "",
      balance3: record.balance3?.toString() || "",
      balance4: record.balance4?.toString() || "",
      balance5: record.balance5?.toString() || "",
    });
    // フォームまでスクロール
    setTimeout(() => {
      const formElement = document.querySelector('form');
      if (formElement) {
        formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    upsertMutation.mutate({
      yearMonth,
      ...balances,
    });
  };

  const calculateTotal = () => {
    const normalize = (val: string) => {
      const cleaned = val.replace(/[¥￥円,]/g, '').replace(/[^0-9.-]/g, '');
      return parseFloat(cleaned) || 0;
    };
    
    return Object.values(balances).reduce((sum, val) => sum + normalize(val), 0);
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
        <h1 className="text-3xl font-bold mb-2">口座残高登録</h1>
        <p className="text-muted-foreground">
          月次の口座残高を登録します。最大5つの口座残高を入力できます。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>口座残高入力</CardTitle>
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
              {[1, 2, 3, 4, 5].map((num) => (
                <div key={num} className="space-y-2">
                  <Label htmlFor={`balance${num}`}>口座残高 {num}</Label>
                  <Input
                    id={`balance${num}`}
                    type="text"
                    placeholder="例: ¥50,000,000 または 50000000"
                    value={balances[`balance${num}` as keyof typeof balances]}
                    onChange={(e) =>
                      setBalances((prev) => ({
                        ...prev,
                        [`balance${num}`]: e.target.value,
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
              {historyData.map((record) => (
                <div
                  key={record.id}
                  className="flex justify-between items-center p-3 rounded-lg bg-muted/50"
                >
                  <span className="font-medium">{record.yearMonth}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-primary font-semibold">
                      ¥{record.totalBalance.toLocaleString('ja-JP')}
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
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
