import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { getMockupQueryOptions, mockupData } from "@/lib/mockup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Settings } from "lucide-react";

export default function Factoring() {
  const [formData, setFormData] = useState({
    factoringRate: "8000",
    remainingRate: "2000",
    feeRate: "70",
    usageFee: "2000",
    paymentDay: "15",
    remainingPaymentDay: "5",
  });

  const { data: setting, isLoading } = trpc.factoring.getSetting.useQuery(
    undefined,
    getMockupQueryOptions(mockupData.factoringSetting)
  );

  const utils = trpc.useUtils();
  const upsertMutation = trpc.factoring.upsertSetting.useMutation({
    onSuccess: () => {
      toast.success("ファクタリング設定を保存しました");
      utils.factoring.getSetting.invalidate();
    },
    onError: (error) => {
      toast.error(`保存に失敗しました: ${error.message}`);
    },
  });

  useEffect(() => {
    if (setting) {
      setFormData({
        factoringRate: setting.factoringRate.toString(),
        remainingRate: setting.remainingRate.toString(),
        feeRate: setting.feeRate.toString(),
        usageFee: setting.usageFee.toString(),
        paymentDay: setting.paymentDay.toString(),
        remainingPaymentDay: setting.remainingPaymentDay.toString(),
      });
    }
  }, [setting]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    upsertMutation.mutate({
      factoringRate: parseInt(formData.factoringRate),
      remainingRate: parseInt(formData.remainingRate),
      feeRate: parseInt(formData.feeRate),
      usageFee: parseInt(formData.usageFee),
      paymentDay: parseInt(formData.paymentDay),
      remainingPaymentDay: parseInt(formData.remainingPaymentDay),
    });
  };

  const formatPercentage = (basisPoints: string) => {
    const num = parseInt(basisPoints) || 0;
    return (num / 100).toFixed(2);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Settings className="w-8 h-8" />
          ファクタリング設定
        </h1>
        <p className="text-muted-foreground">
          ファクタリングの計算に使用する各種パラメータを設定します。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>ファクタリング設定</CardTitle>
          <CardDescription>
            設定値は請求データからのファクタリング計算に使用されます
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="factoringRate">
                  ファクタリング率 (現在: {formatPercentage(formData.factoringRate)}%)
                </Label>
                <Input
                  id="factoringRate"
                  type="number"
                  value={formData.factoringRate}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      factoringRate: e.target.value,
                    }))
                  }
                  placeholder="8000 (= 80.00%)"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  ベーシスポイントで入力 (例: 8000 = 80.00%)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="remainingRate">
                  残金支払率 (現在: {formatPercentage(formData.remainingRate)}%)
                </Label>
                <Input
                  id="remainingRate"
                  type="number"
                  value={formData.remainingRate}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      remainingRate: e.target.value,
                    }))
                  }
                  placeholder="2000 (= 20.00%)"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  ベーシスポイントで入力 (例: 2000 = 20.00%)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="feeRate">
                  手数料率 (現在: {formatPercentage(formData.feeRate)}%)
                </Label>
                <Input
                  id="feeRate"
                  type="number"
                  value={formData.feeRate}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      feeRate: e.target.value,
                    }))
                  }
                  placeholder="70 (= 0.70%)"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  ベーシスポイントで入力 (例: 70 = 0.70%)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="usageFee">利用料金 (円)</Label>
                <Input
                  id="usageFee"
                  type="number"
                  value={formData.usageFee}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      usageFee: e.target.value,
                    }))
                  }
                  placeholder="2000"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  固定利用料金 (例: 2000円)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentDay">ファクタリング入金日</Label>
                <Input
                  id="paymentDay"
                  type="number"
                  value={formData.paymentDay}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      paymentDay: e.target.value,
                    }))
                  }
                  placeholder="15"
                  required
                  min="1"
                  max="31"
                />
                <p className="text-xs text-muted-foreground">
                  翌月の入金日 (例: 15日)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="remainingPaymentDay">残金入金日</Label>
                <Input
                  id="remainingPaymentDay"
                  type="number"
                  value={formData.remainingPaymentDay}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      remainingPaymentDay: e.target.value,
                    }))
                  }
                  placeholder="5"
                  required
                  min="1"
                  max="31"
                />
                <p className="text-xs text-muted-foreground">
                  翌々翌月の入金日 (例: 5日)
                </p>
              </div>
            </div>

            <div className="pt-6 border-t">
              <h3 className="font-semibold mb-4">計算例</h3>
              <div className="bg-muted/50 p-4 rounded-lg space-y-2 text-sm">
                <p>請求額: ¥10,000,000 の場合</p>
                <p>
                  ファクタリング額: ¥{(10000000 * parseInt(formData.factoringRate) / 10000).toLocaleString('ja-JP')}
                </p>
                <p>
                  手数料: ¥{(10000000 * parseInt(formData.factoringRate) / 10000 * parseInt(formData.feeRate) / 10000).toLocaleString('ja-JP')}
                </p>
                <p>
                  利用料金: ¥{parseInt(formData.usageFee).toLocaleString('ja-JP')}
                </p>
                <p className="font-semibold text-primary">
                  入金額: ¥{(
                    10000000 * parseInt(formData.factoringRate) / 10000 -
                    10000000 * parseInt(formData.factoringRate) / 10000 * parseInt(formData.feeRate) / 10000 -
                    parseInt(formData.usageFee)
                  ).toLocaleString('ja-JP')}
                </p>
                <p className="font-semibold text-primary">
                  残金入金額: ¥{(10000000 * parseInt(formData.remainingRate) / 10000).toLocaleString('ja-JP')}
                </p>
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
                "設定を保存"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
