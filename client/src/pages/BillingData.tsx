import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, Search, Plus, Trash2, Edit } from "lucide-react";
import { useLocation } from "wouter";

export default function BillingData({ organizationId: propOrganizationId }: { organizationId?: number } = {}) {
  const [location] = useLocation();
  const { user } = useAuth();
  
  // URLから組織IDを取得（/:organizationId/billing形式）
  const organizationId = useMemo(() => {
    // プロップで渡された場合はそれを使用
    if (propOrganizationId) {
      return propOrganizationId;
    }
    // URLから組織IDを取得
    const match = location.match(/^\/(\d+)\/billing$/);
    if (match) {
      return parseInt(match[1], 10);
    }
    // URLに組織IDが含まれていない場合、ユーザー情報から取得
    if (user?.organizationId) {
      return user.organizationId;
    }
    return undefined;
  }, [location, propOrganizationId, user]);

  const [page, setPage] = useState(1);
  const [searchFilters, setSearchFilters] = useState({
    billingYearMonth: "",
    serviceYearMonth: "",
    userName: "",
  });
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  
  const utils = trpc.useUtils();
  
  const updateMutation = trpc.billing.update.useMutation({
    onSuccess: () => {
      toast.success("請求データを更新しました");
      utils.billing.search.invalidate();
      setEditDialogOpen(false);
      setEditingRecord(null);
    },
    onError: (error) => {
      toast.error(`更新に失敗しました: ${error.message}`);
    },
  });

  const { data, isLoading } = trpc.billing.search.useQuery(
    {
      ...searchFilters,
      page,
      pageSize: 20,
      organizationId,
    },
    {
      enabled: organizationId !== undefined, // organizationIdが設定されている場合のみクエリを実行
      // モックアップモードでも実際のデータベースから取得するため、getMockupQueryOptionsは使用しない
    }
  );
  
  const deleteMutation = trpc.billing.delete.useMutation({
    onSuccess: () => {
      toast.success("請求データを削除しました");
      utils.billing.search.invalidate();
    },
    onError: (error) => {
      toast.error(`削除に失敗しました: ${error.message}`);
    },
  });

  const deleteBatchMutation = trpc.billing.deleteBatch.useMutation({
    onSuccess: () => {
      toast.success("選択した請求データを削除しました");
      setSelectedIds([]);
      utils.billing.search.invalidate();
    },
    onError: (error) => {
      toast.error(`削除に失敗しました: ${error.message}`);
    },
  });

  const handleDelete = (id: number) => {
    if (confirm("この請求データを削除してもよろしいですか?")) {
      deleteMutation.mutate({ id });
    }
  };

  const handleBatchDelete = () => {
    if (selectedIds.length === 0) {
      toast.error("削除する項目を選択してください");
      return;
    }
    if (confirm(`選択した${selectedIds.length}件の請求データを削除してもよろしいですか?`)) {
      deleteBatchMutation.mutate({ ids: selectedIds });
    }
  };

  const handleEdit = (record: any) => {
    setEditingRecord(record);
    setEditDialogOpen(true);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === data?.data.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(data?.data.map((r) => r.id) || []);
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  if (organizationId === undefined) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-lg font-semibold mb-2">組織IDが設定されていません</p>
          <p className="text-muted-foreground">
            {user?.role === 'headquarters' 
              ? '本部担当者の場合は、URLに組織IDを含めてください（例: /1/billing）'
              : '組織IDを取得できませんでした。ページを再読み込みしてください。'}
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2">請求データ管理</h1>
          <p className="text-muted-foreground">
            請求データの一覧表示・検索・編集・削除ができます
          </p>
        </div>
        <Button onClick={() => setLocation("/billing/csv-upload")}>
          <Plus className="w-4 h-4 mr-2" />
          CSVアップロード
        </Button>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            検索・フィルタ
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="billingYearMonth">請求年月</Label>
              <Input
                id="billingYearMonth"
                type="month"
                value={searchFilters.billingYearMonth}
                onChange={(e) =>
                  setSearchFilters((prev) => ({
                    ...prev,
                    billingYearMonth: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="serviceYearMonth">サービス提供年月</Label>
              <Input
                id="serviceYearMonth"
                type="month"
                value={searchFilters.serviceYearMonth}
                onChange={(e) =>
                  setSearchFilters((prev) => ({
                    ...prev,
                    serviceYearMonth: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="userName">利用者名</Label>
              <Input
                id="userName"
                type="text"
                placeholder="利用者名で検索"
                value={searchFilters.userName}
                onChange={(e) =>
                  setSearchFilters((prev) => ({
                    ...prev,
                    userName: e.target.value,
                  }))
                }
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button
              variant="outline"
              onClick={() =>
                setSearchFilters({
                  billingYearMonth: "",
                  serviceYearMonth: "",
                  userName: "",
                })
              }
            >
              クリア
            </Button>
            {selectedIds.length > 0 && (
              <Button
                variant="destructive"
                onClick={handleBatchDelete}
                disabled={deleteBatchMutation.isPending}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                選択した{selectedIds.length}件を削除
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <input
                      type="checkbox"
                      checked={
                        (data?.data.length ?? 0) > 0 &&
                        selectedIds.length === (data?.data.length ?? 0)
                      }
                      onChange={toggleSelectAll}
                      className="cursor-pointer"
                    />
                  </TableHead>
                  <TableHead>請求年月</TableHead>
                  <TableHead>提供年月</TableHead>
                  <TableHead>利用者名</TableHead>
                  <TableHead className="text-right">費用総額</TableHead>
                  <TableHead className="text-right">保険給付額</TableHead>
                  <TableHead className="text-right">利用者負担</TableHead>
                  <TableHead className="text-center">振込</TableHead>
                  <TableHead className="w-24">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      請求データがありません
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.data.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(record.id)}
                          onChange={() => toggleSelect(record.id)}
                          className="cursor-pointer"
                        />
                      </TableCell>
                      <TableCell>{record.billingYearMonth}</TableCell>
                      <TableCell>{record.serviceYearMonth}</TableCell>
                      <TableCell>{record.userName}</TableCell>
                      <TableCell className="text-right">
                        ¥{record.totalCost.toLocaleString('ja-JP')}
                      </TableCell>
                      <TableCell className="text-right">
                        ¥{record.insurancePayment.toLocaleString('ja-JP')}
                      </TableCell>
                      <TableCell className="text-right">
                        ¥{(record.userBurdenTransfer + record.userBurdenWithdrawal).toLocaleString('ja-JP')}
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={record.isTransfer ?? false}
                          onCheckedChange={(checked) => {
                            updateMutation.mutate({
                              id: record.id,
                              isTransfer: checked as boolean,
                            });
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(record)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(record.id)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {data && data.total > 20 && (
            <div className="flex justify-between items-center p-4 border-t">
              <div className="text-sm text-muted-foreground">
                {data.total}件中 {(page - 1) * 20 + 1} - {Math.min(page * 20, data.total)}件を表示
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  前へ
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page * 20 >= data.total}
                  onClick={() => setPage((p) => p + 1)}
                >
                  次へ
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>請求データ編集</DialogTitle>
            <DialogDescription>
              請求データの内容を編集します
            </DialogDescription>
          </DialogHeader>
          {editingRecord && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isTransfer"
                  checked={editingRecord.isTransfer ?? false}
                  onCheckedChange={(checked) => {
                    setEditingRecord({
                      ...editingRecord,
                      isTransfer: checked as boolean,
                    });
                  }}
                />
                <Label htmlFor="isTransfer" className="cursor-pointer">
                  振込（チェックを入れると請求月の当月に入金見込み、外すと請求月の翌々月に入金見込み）
                </Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setEditDialogOpen(false);
              setEditingRecord(null);
            }}>
              キャンセル
            </Button>
            <Button
              onClick={() => {
                if (editingRecord) {
                  updateMutation.mutate({
                    id: editingRecord.id,
                    isTransfer: editingRecord.isTransfer ?? false,
                  });
                }
              }}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
