import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { isMockupMode, getMockupQueryOptions } from "@/lib/mockup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Plus, Edit, Trash2, Power, PowerOff, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import type { Loan } from "@shared/types";

export default function Loans({ organizationId: propOrganizationId }: { organizationId?: number } = {}) {
  const [location] = useLocation();
  
  // URLから組織IDを取得（/:organizationId/loans形式）
  const organizationId = useMemo(() => {
    // プロップで渡された場合はそれを使用
    if (propOrganizationId) {
      return propOrganizationId;
    }
    // URLから組織IDを取得
    const match = location.match(/^\/(\d+)\/loans$/);
    if (match) {
      return parseInt(match[1], 10);
    }
    return undefined;
  }, [location, propOrganizationId]);

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isEffectiveDateDialogOpen, setIsEffectiveDateDialogOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [effectiveDate, setEffectiveDate] = useState<string>("");
  const [pendingAction, setPendingAction] = useState<"create" | "update" | "toggle" | null>(null);

  const utils = trpc.useUtils();
  // 借入返済管理はモックアップモードでもデータベースから取得する
  const { data: loans, isLoading, refetch, error } = trpc.loan.list.useQuery(
    organizationId ? { organizationId } : undefined,
    {
      enabled: true, // 常に有効化（モックアップモードでもデータベースから取得）
    }
  );

  // デバッグ用ログ
  useEffect(() => {
    console.log('[Loans] ===== デバッグ情報 =====');
    console.log('[Loans] isMockupMode:', isMockupMode);
    console.log('[Loans] isLoading:', isLoading);
    console.log('[Loans] loans data:', loans);
    console.log('[Loans] loans length:', loans?.length);
    console.log('[Loans] error:', error);
    console.log('[Loans] =======================');
  }, [isMockupMode, isLoading, loans, error]);

  const createMutation = trpc.loan.create.useMutation({
    onSuccess: async () => {
      toast.success("借入を追加しました");
      await utils.loan.list.invalidate();
      await refetch();
      setIsCreateDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(`追加に失敗しました: ${error.message}`);
    },
  });

  const updateMutation = trpc.loan.update.useMutation({
    onSuccess: async () => {
      toast.success("借入を更新しました");
      await utils.loan.list.invalidate();
      await refetch();
      setIsEditDialogOpen(false);
      setIsEffectiveDateDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(`更新に失敗しました: ${error.message}`);
    },
  });

  const toggleMutation = trpc.loan.toggleActive.useMutation({
    onSuccess: async () => {
      toast.success("借入の状態を変更しました");
      await utils.loan.list.invalidate();
      await refetch();
      setIsEffectiveDateDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(`状態変更に失敗しました: ${error.message}`);
    },
  });

  const deleteMutation = trpc.loan.delete.useMutation({
    onSuccess: async () => {
      toast.success("借入を削除しました");
      await utils.loan.list.invalidate();
      await refetch();
    },
    onError: (error) => {
      toast.error(`削除に失敗しました: ${error.message}`);
    },
  });

  // フォーム状態
  const [formData, setFormData] = useState({
    financialInstitution: "",
    branchName: "",
    repaymentMethod: "equal_principal" as "equal_principal" | "equal_installment",
    annualInterestRate: "",
    initialBorrowingDate: "",
    repaymentDueDate: "25",
    initialBorrowingAmount: "",
    repaymentPrincipal: "",
    firstRepaymentDate: "",
  });

  const resetForm = () => {
    setFormData({
      financialInstitution: "",
      branchName: "",
      repaymentMethod: "equal_principal",
      annualInterestRate: "",
      initialBorrowingDate: "",
      repaymentDueDate: "25",
      initialBorrowingAmount: "",
      repaymentPrincipal: "",
      firstRepaymentDate: "",
    });
    setSelectedLoan(null);
    setEffectiveDate("");
    setPendingAction(null);
  };

  const handleCreate = () => {
    setEffectiveDate(new Date().toISOString().split('T')[0]);
    setIsCreateDialogOpen(true);
  };

  const handleEdit = (loan: Loan) => {
    setSelectedLoan(loan);
    setFormData({
      financialInstitution: loan.financialInstitution,
      branchName: loan.branchName || "",
      repaymentMethod: loan.repaymentMethod,
      annualInterestRate: String(parseFloat(String(loan.annualInterestRate || 0))),
      initialBorrowingDate: loan.initialBorrowingDate.toISOString().split('T')[0],
      repaymentDueDate: String(loan.repaymentDueDate),
      initialBorrowingAmount: String(loan.initialBorrowingAmount),
      repaymentPrincipal: String(loan.repaymentPrincipal),
      firstRepaymentDate: loan.firstRepaymentDate.toISOString().split('T')[0],
    });
    setEffectiveDate(new Date().toISOString().split('T')[0]);
    setIsEditDialogOpen(true);
  };

  const handleToggleActive = (loan: Loan) => {
    setSelectedLoan(loan);
    setEffectiveDate(new Date().toISOString().split('T')[0]);
    setPendingAction("toggle");
    setIsEffectiveDateDialogOpen(true);
  };

  const handleDelete = (loan: Loan) => {
    if (confirm(`「${loan.financialInstitution}${loan.branchName ? ` ${loan.branchName}` : ''}」の借入を削除しますか？`)) {
      deleteMutation.mutate({ id: loan.id });
    }
  };

  const handleSubmitCreate = () => {
    if (!effectiveDate) {
      toast.error("適用開始日を入力してください");
      return;
    }
    createMutation.mutate({
      ...formData,
      annualInterestRate: formData.annualInterestRate,
      initialBorrowingAmount: formData.initialBorrowingAmount,
      repaymentPrincipal: formData.repaymentPrincipal,
      repaymentDueDate: parseInt(formData.repaymentDueDate),
      organizationId,
      effectiveFrom: effectiveDate,
    });
  };

  const handleSubmitUpdate = () => {
    if (!selectedLoan || !effectiveDate) {
      toast.error("適用開始日を入力してください");
      return;
    }
    updateMutation.mutate({
      id: selectedLoan.id,
      ...formData,
      annualInterestRate: formData.annualInterestRate,
      initialBorrowingAmount: formData.initialBorrowingAmount,
      repaymentPrincipal: formData.repaymentPrincipal,
      repaymentDueDate: parseInt(formData.repaymentDueDate),
      effectiveFrom: effectiveDate,
    });
  };

  const handleSubmitToggle = () => {
    if (!selectedLoan || !effectiveDate) {
      toast.error("適用開始日を入力してください");
      return;
    }
    toggleMutation.mutate({
      id: selectedLoan.id,
      isActive: !selectedLoan.isActive,
      effectiveFrom: effectiveDate,
    });
  };

  const formatCurrency = (value: number) => {
    return `¥${value.toLocaleString('ja-JP')}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-7xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">借入返済管理</h1>
          <p className="text-muted-foreground">
            金融機関からの借入情報を管理し、毎月の返済額と金利を計算します
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          借入を追加
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>借入一覧</CardTitle>
          <CardDescription>
            登録されている借入情報の一覧です。編集・削除・有効/無効の切り替えができます。
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 font-semibold">エラーが発生しました</p>
              <p className="text-red-600 text-sm mt-1">{error.message}</p>
            </div>
          )}
          {(() => {
            console.log('[Loans Render] isLoading:', isLoading);
            console.log('[Loans Render] loans:', loans);
            console.log('[Loans Render] loans?.length:', loans?.length);
            console.log('[Loans Render] loans && loans.length === 0:', loans && loans.length === 0);
            
            if (isLoading) {
              return (
                <div className="text-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
                  <p className="text-muted-foreground mt-2">データを読み込み中...</p>
                </div>
              );
            }
            
            if (!loans || loans.length === 0) {
              return (
                <div className="text-center py-8 text-muted-foreground">
                  借入が登録されていません。右上の「借入を追加」ボタンから追加してください。
                </div>
              );
            }
            
            console.log('[Loans Render] テーブルをレンダリングします。loans:', loans);
            
            return (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>金融機関</TableHead>
                    <TableHead>支店名</TableHead>
                    <TableHead>返済方法</TableHead>
                    <TableHead className="text-right">年利</TableHead>
                    <TableHead>当初借入日</TableHead>
                    <TableHead>返済期日</TableHead>
                    <TableHead className="text-right">当初借入額</TableHead>
                    <TableHead className="text-right">返済元金</TableHead>
                    <TableHead>初回返済日</TableHead>
                    <TableHead>状態</TableHead>
                    <TableHead>適用開始日</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loans?.map((loan, index) => {
                    console.log(`[Loans Render] loan[${index}]:`, loan);
                    return (
                    <TableRow key={loan.id}>
                      <TableCell className="font-medium">{loan.financialInstitution}</TableCell>
                      <TableCell>{loan.branchName || "-"}</TableCell>
                      <TableCell>
                        {loan.repaymentMethod === "equal_principal" ? "元金均等" : "元利均等"}
                      </TableCell>
                      <TableCell className="text-right">{parseFloat(String(loan.annualInterestRate || 0)).toFixed(2)}%</TableCell>
                      <TableCell>
                        {format(new Date(loan.initialBorrowingDate), "yyyy年MM月dd日", { locale: ja })}
                      </TableCell>
                      <TableCell>毎月{loan.repaymentDueDate}日</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(loan.initialBorrowingAmount)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(loan.repaymentPrincipal)}
                      </TableCell>
                      <TableCell>
                        {format(new Date(loan.firstRepaymentDate), "yyyy年MM月dd日", { locale: ja })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={loan.isActive}
                            onCheckedChange={() => handleToggleActive(loan)}
                          />
                          <span className={loan.isActive ? "text-green-600" : "text-gray-400"}>
                            {loan.isActive ? "有効" : "無効"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {format(new Date(loan.effectiveFrom), "yyyy年MM月dd日", { locale: ja })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(loan)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(loan)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* 作成ダイアログ */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>借入を追加</DialogTitle>
            <DialogDescription>
              新しい借入情報を入力してください。適用開始日を設定することで、いつからこの借入を適用するかを指定できます。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="financialInstitution">金融機関 *</Label>
                <Input
                  id="financialInstitution"
                  value={formData.financialInstitution}
                  onChange={(e) => setFormData({ ...formData, financialInstitution: e.target.value })}
                  placeholder="例: みずほ銀行"
                />
              </div>
              <div>
                <Label htmlFor="branchName">支店名</Label>
                <Input
                  id="branchName"
                  value={formData.branchName}
                  onChange={(e) => setFormData({ ...formData, branchName: e.target.value })}
                  placeholder="例: 新宿支店"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="repaymentMethod">返済方法 *</Label>
              <Select
                value={formData.repaymentMethod}
                onValueChange={(value: "equal_principal" | "equal_installment") =>
                  setFormData({ ...formData, repaymentMethod: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="equal_principal">元金均等</SelectItem>
                  <SelectItem value="equal_installment">元利均等</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="annualInterestRate">年利 (%) *</Label>
                <Input
                  id="annualInterestRate"
                  type="number"
                  step="0.001"
                  value={formData.annualInterestRate}
                  onChange={(e) => setFormData({ ...formData, annualInterestRate: e.target.value })}
                  placeholder="例: 1.500"
                />
              </div>
              <div>
                <Label htmlFor="repaymentDueDate">返済期日 (毎月の日付) *</Label>
                <Input
                  id="repaymentDueDate"
                  type="number"
                  min="1"
                  max="31"
                  value={formData.repaymentDueDate}
                  onChange={(e) => setFormData({ ...formData, repaymentDueDate: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="initialBorrowingDate">当初借入日 *</Label>
                <Input
                  id="initialBorrowingDate"
                  type="date"
                  value={formData.initialBorrowingDate}
                  onChange={(e) => setFormData({ ...formData, initialBorrowingDate: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="firstRepaymentDate">初回返済日 *</Label>
                <Input
                  id="firstRepaymentDate"
                  type="date"
                  value={formData.firstRepaymentDate}
                  onChange={(e) => setFormData({ ...formData, firstRepaymentDate: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="initialBorrowingAmount">当初借入額 *</Label>
                <Input
                  id="initialBorrowingAmount"
                  type="text"
                  value={formData.initialBorrowingAmount}
                  onChange={(e) => setFormData({ ...formData, initialBorrowingAmount: e.target.value })}
                  placeholder="例: 10000000"
                />
              </div>
              <div>
                <Label htmlFor="repaymentPrincipal">返済元金 *</Label>
                <Input
                  id="repaymentPrincipal"
                  type="text"
                  value={formData.repaymentPrincipal}
                  onChange={(e) => setFormData({ ...formData, repaymentPrincipal: e.target.value })}
                  placeholder="例: 8000000"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="effectiveFrom">適用開始日 *</Label>
              <Input
                id="effectiveFrom"
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleSubmitCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  追加中...
                </>
              ) : (
                "追加"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 編集ダイアログ */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>借入を編集</DialogTitle>
            <DialogDescription>
              借入情報を編集してください。適用開始日を設定することで、いつからこの変更を適用するかを指定できます。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* 作成ダイアログと同じフォーム */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-financialInstitution">金融機関 *</Label>
                <Input
                  id="edit-financialInstitution"
                  value={formData.financialInstitution}
                  onChange={(e) => setFormData({ ...formData, financialInstitution: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-branchName">支店名</Label>
                <Input
                  id="edit-branchName"
                  value={formData.branchName}
                  onChange={(e) => setFormData({ ...formData, branchName: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="edit-repaymentMethod">返済方法 *</Label>
              <Select
                value={formData.repaymentMethod}
                onValueChange={(value: "equal_principal" | "equal_installment") =>
                  setFormData({ ...formData, repaymentMethod: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="equal_principal">元金均等</SelectItem>
                  <SelectItem value="equal_installment">元利均等</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-annualInterestRate">年利 (%) *</Label>
                <Input
                  id="edit-annualInterestRate"
                  type="number"
                  step="0.001"
                  value={formData.annualInterestRate}
                  onChange={(e) => setFormData({ ...formData, annualInterestRate: e.target.value })}
                  placeholder="例: 1.500"
                />
              </div>
              <div>
                <Label htmlFor="edit-repaymentDueDate">返済期日 (毎月の日付) *</Label>
                <Input
                  id="edit-repaymentDueDate"
                  type="number"
                  min="1"
                  max="31"
                  value={formData.repaymentDueDate}
                  onChange={(e) => setFormData({ ...formData, repaymentDueDate: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-initialBorrowingDate">当初借入日 *</Label>
                <Input
                  id="edit-initialBorrowingDate"
                  type="date"
                  value={formData.initialBorrowingDate}
                  onChange={(e) => setFormData({ ...formData, initialBorrowingDate: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-firstRepaymentDate">初回返済日 *</Label>
                <Input
                  id="edit-firstRepaymentDate"
                  type="date"
                  value={formData.firstRepaymentDate}
                  onChange={(e) => setFormData({ ...formData, firstRepaymentDate: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-initialBorrowingAmount">当初借入額 *</Label>
                <Input
                  id="edit-initialBorrowingAmount"
                  type="text"
                  value={formData.initialBorrowingAmount}
                  onChange={(e) => setFormData({ ...formData, initialBorrowingAmount: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-repaymentPrincipal">返済元金 *</Label>
                <Input
                  id="edit-repaymentPrincipal"
                  type="text"
                  value={formData.repaymentPrincipal}
                  onChange={(e) => setFormData({ ...formData, repaymentPrincipal: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="edit-effectiveFrom">適用開始日 *</Label>
              <Input
                id="edit-effectiveFrom"
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleSubmitUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  更新中...
                </>
              ) : (
                "更新"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 適用開始日確認ダイアログ（on/off切り替え用） */}
      <Dialog open={isEffectiveDateDialogOpen} onOpenChange={setIsEffectiveDateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedLoan && (selectedLoan.isActive ? "借入を無効化" : "借入を有効化")}
            </DialogTitle>
            <DialogDescription>
              いつからこの変更を適用しますか？適用開始日を入力してください。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="toggle-effectiveFrom">適用開始日 *</Label>
              <Input
                id="toggle-effectiveFrom"
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
              />
            </div>
            {selectedLoan && (
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm">
                  <strong>{selectedLoan.financialInstitution}</strong>
                  {selectedLoan.branchName && ` ${selectedLoan.branchName}`}
                  を{selectedLoan.isActive ? "無効化" : "有効化"}しますか？
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEffectiveDateDialogOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleSubmitToggle} disabled={toggleMutation.isPending}>
              {toggleMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  処理中...
                </>
              ) : (
                "適用"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

