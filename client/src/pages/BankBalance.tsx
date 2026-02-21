import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { isMockupMode } from "@/lib/mockup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Edit, Plus, Pencil, Trash2, Building2, ExternalLink } from "lucide-react";

export default function BankBalance({ organizationId: propOrganizationId }: { organizationId?: number } = {}) {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();

  const organizationId = useMemo(() => {
    if (propOrganizationId) return propOrganizationId;
    const match = location.match(/^\/(\d+)\/bank-balance$/);
    if (match) return parseInt(match[1], 10);
    if (user?.role !== "headquarters" && user?.organizationId) return user.organizationId;
    return undefined;
  }, [location, propOrganizationId, user]);

  const [yearMonth, setYearMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  // 金融機関ごとの残高入力値（bankAccountId -> 表示用文字列）
  const [balances, setBalances] = useState<Record<number, string>>({});

  // 金融機関追加ダイアログ
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [newAccountName, setNewAccountName] = useState("");
  const [editingAccountId, setEditingAccountId] = useState<number | null>(null);
  const [editingAccountName, setEditingAccountName] = useState("");

  const { data: bankAccounts, refetch: refetchAccounts } = trpc.bankAccount.list.useQuery(
    { organizationId },
    { enabled: !isMockupMode && organizationId != null }
  );

  const { data: existingData, isLoading } = trpc.bankBalance.getByYearMonth.useQuery(
    { yearMonth, organizationId },
    { enabled: !isMockupMode && !!yearMonth && organizationId != null }
  );

  const { data: historyData, refetch: refetchHistory } = trpc.bankBalance.list.useQuery(
    { limit: 12, organizationId },
    isMockupMode
      ? { enabled: false, initialData: undefined }
      : { enabled: organizationId != null, initialData: undefined }
  );

  const utils = trpc.useUtils();
  const createAccountMutation = trpc.bankAccount.create.useMutation({
    onSuccess: async () => {
      toast.success("金融機関を追加しました");
      setNewAccountName("");
      setAccountDialogOpen(false);
      await refetchAccounts();
    },
    onError: (e) => toast.error(`追加に失敗しました: ${e.message}`),
  });
  const updateAccountMutation = trpc.bankAccount.update.useMutation({
    onSuccess: async () => {
      toast.success("金融機関名を更新しました");
      setEditingAccountId(null);
      await refetchAccounts();
    },
    onError: (e) => toast.error(`更新に失敗しました: ${e.message}`),
  });
  const deleteAccountMutation = trpc.bankAccount.delete.useMutation({
    onSuccess: async () => {
      toast.success("金融機関を削除しました");
      await refetchAccounts();
    },
    onError: (e) => toast.error(`削除に失敗しました: ${e.message}`),
  });
  const upsertMutation = trpc.bankBalance.upsert.useMutation({
    onSuccess: async () => {
      toast.success("口座残高を保存しました");
      await utils.bankBalance.list.invalidate();
      await utils.bankBalance.getByYearMonth.invalidate();
      await refetchHistory();
    },
    onError: (error) => toast.error(`保存に失敗しました: ${error.message}`),
  });

  // 既存データをフォームに反映（対象年月のデータのみ適用し、履歴から編集した直後の上書きを防ぐ）
  useEffect(() => {
    if (!existingData || existingData.yearMonth !== yearMonth) return;
    const next: Record<number, string> = {};
    existingData.entries.forEach((e) => {
      next[e.bankAccountId] = e.balance?.toString() ?? "";
    });
    setBalances((prev) => ({ ...prev, ...next }));
  }, [existingData, yearMonth]);

  // 金融機関が変わったとき、未入力の口座は空文字で初期化
  useEffect(() => {
    if (!bankAccounts?.length) return;
    setBalances((prev) => {
      const next = { ...prev };
      bankAccounts.forEach((acc) => {
        if (next[acc.id] === undefined) next[acc.id] = "";
      });
      return next;
    });
  }, [bankAccounts]);

  const handleEdit = (record: { yearMonth: string; totalBalance: number; entries?: { bankAccountId: number; balance: number }[] }) => {
    setYearMonth(record.yearMonth);
    const next: Record<number, string> = {};
    record.entries?.forEach((e) => {
      next[e.bankAccountId] = e.balance?.toString() ?? "";
    });
    setBalances(next);
    setTimeout(() => {
      document.querySelector("form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankAccounts?.length) {
      toast.error("まず金融機関を登録してください");
      return;
    }
    const entries = bankAccounts.map((acc) => ({
      bankAccountId: acc.id,
      balance: balances[acc.id] ?? "",
    }));
    upsertMutation.mutate({
      yearMonth,
      entries: entries.map((e) => ({ bankAccountId: e.bankAccountId, balance: e.balance })),
      ...(organizationId != null ? { organizationId } : {}),
    });
  };

  const normalize = (val: string) => {
    const cleaned = String(val).replace(/[¥￥円,]/g, "").replace(/[^0-9.-]/g, "");
    return Math.round(parseFloat(cleaned) || 0);
  };

  const calculateTotal = () => {
    if (!bankAccounts) return 0;
    return bankAccounts.reduce((sum, acc) => sum + normalize(balances[acc.id] ?? ""), 0);
  };

  const openEditAccount = (id: number, name: string) => {
    setEditingAccountId(id);
    setEditingAccountName(name);
  };

  // 本部担当者は組織ID必須。未指定の場合は組織選択を表示
  const { data: organizations, isLoading: loadingOrgs } = trpc.organization.list.useQuery(
    undefined,
    { enabled: !isMockupMode && user?.role === "headquarters" && organizationId == null }
  );
  const showOrganizationSelector =
    !isMockupMode && user?.role === "headquarters" && organizationId == null;

  if (!isMockupMode && (isLoading || (showOrganizationSelector && loadingOrgs))) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (showOrganizationSelector) {
    return (
      <div className="container py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">口座残高登録</h1>
          <p className="text-muted-foreground">
            本部担当者は、対象の組織を選択してから口座残高を登録してください。
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>組織を選択してください</CardTitle>
            <CardDescription>
              口座残高を登録する法人を選ぶと、その組織の口座残高登録画面に移動します。
            </CardDescription>
          </CardHeader>
          <CardContent>
            {organizations && organizations.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {organizations.map((org) => (
                  <Button
                    key={org.id}
                    variant="outline"
                    className="h-auto py-4 px-4 flex flex-col items-start gap-1 text-left"
                    onClick={() => setLocation(`/${org.id}/bank-balance`)}
                  >
                    <span className="flex items-center gap-2 font-semibold">
                      <Building2 className="w-4 h-4" />
                      {org.name}
                    </span>
                    <span className="text-xs text-muted-foreground">組織ID: {org.id}</span>
                    <ExternalLink className="w-4 h-4 mt-1 opacity-50" />
                  </Button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">組織が登録されていません。</p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">口座残高登録</h1>
        <p className="text-muted-foreground">
          法人ごとに金融機関を登録し、金融機関ごとに月次の口座残高を入力します。
        </p>
      </div>

      {/* 金融機関登録 */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>金融機関登録</CardTitle>
          <CardDescription>
            口座残高を入力する金融機関（銀行名など）を登録してください
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {bankAccounts && bankAccounts.length > 0 ? (
            <ul className="space-y-2">
              {bankAccounts.map((acc) => (
                <li
                  key={acc.id}
                  className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50"
                >
                  <span className="font-medium">{acc.name}</span>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditAccount(acc.id, acc.name)}
                      className="h-8"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm(`「${acc.name}」を削除してもよろしいですか？`)) {
                          deleteAccountMutation.mutate({ id: acc.id, organizationId });
                        }
                      }}
                      className="h-8 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">登録された金融機関はありません。</p>
          )}
          <Button type="button" variant="outline" onClick={() => setAccountDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            金融機関を追加
          </Button>
        </CardContent>
      </Card>

      {/* 口座残高入力 */}
      <Card>
        <CardHeader>
          <CardTitle>口座残高入力</CardTitle>
          <CardDescription>
            対象年月を選び、各金融機関の残高を入力してください。全角数字や通貨記号は自動で半角に変換されます。
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

            {bankAccounts && bankAccounts.length > 0 ? (
              <div className="grid gap-4">
                {bankAccounts.map((acc) => (
                  <div key={acc.id} className="space-y-2">
                    <Label htmlFor={`balance-${acc.id}`}>{acc.name}</Label>
                    <Input
                      id={`balance-${acc.id}`}
                      type="text"
                      placeholder="例: ¥50,000,000 または 50000000"
                      value={balances[acc.id] ?? ""}
                      onChange={(e) =>
                        setBalances((prev) => ({ ...prev, [acc.id]: e.target.value }))
                      }
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                口座残高を入力するには、上で金融機関を1件以上登録してください。
              </p>
            )}

            {bankAccounts && bankAccounts.length > 0 && (
              <div className="pt-4 border-t">
                <div className="flex justify-between items-center text-lg font-semibold">
                  <span>合計金額:</span>
                  <span className="text-primary">¥{calculateTotal().toLocaleString("ja-JP")}</span>
                </div>
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={upsertMutation.isPending || !bankAccounts?.length}
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
                  key={record.yearMonth}
                  className="flex justify-between items-center p-3 rounded-lg bg-muted/50"
                >
                  <span className="font-medium">{record.yearMonth}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-primary font-semibold">
                      ¥{record.totalBalance.toLocaleString("ja-JP")}
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

      {/* 金融機関追加ダイアログ */}
      <Dialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>金融機関を追加</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="newAccountName">金融機関名</Label>
            <Input
              id="newAccountName"
              value={newAccountName}
              onChange={(e) => setNewAccountName(e.target.value)}
              placeholder="例: 三菱UFJ銀行 〇〇支店"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAccountDialogOpen(false)}>
              キャンセル
            </Button>
            <Button
              onClick={() => {
                const name = newAccountName.trim();
                if (!name) {
                  toast.error("金融機関名を入力してください");
                  return;
                }
                createAccountMutation.mutate({ name, organizationId });
              }}
              disabled={createAccountMutation.isPending}
            >
              {createAccountMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "追加"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 金融機関名編集ダイアログ */}
      <Dialog open={editingAccountId != null} onOpenChange={(open) => !open && setEditingAccountId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>金融機関名を編集</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="editingAccountName">金融機関名</Label>
            <Input
              id="editingAccountName"
              value={editingAccountName}
              onChange={(e) => setEditingAccountName(e.target.value)}
              placeholder="例: 三菱UFJ銀行 〇〇支店"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingAccountId(null)}>
              キャンセル
            </Button>
            <Button
              onClick={() => {
                const name = editingAccountName.trim();
                if (!name || editingAccountId == null) return;
                updateAccountMutation.mutate({
                  id: editingAccountId,
                  name,
                  organizationId,
                });
              }}
              disabled={updateAccountMutation.isPending || !editingAccountName.trim()}
            >
              {updateAccountMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "更新"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
