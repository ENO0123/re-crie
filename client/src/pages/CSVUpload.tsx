import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Upload, FileText, CheckCircle2, XCircle, AlertCircle, Loader2 } from "lucide-react";

interface ValidationResult {
  validRows: Array<{
    rowNumber: number;
    billingYearMonth: string;
    serviceYearMonth: string;
    userName: string;
    totalCost: number;
    insurancePayment: number;
    publicPayment: number;
    reduction: number;
    userBurdenTransfer: number;
    userBurdenWithdrawal: number;
  }>;
  errors: Array<{
    rowNumber: number;
    field?: string;
    message: string;
  }>;
  duplicates: Array<{
    rowNumber: number;
    billingYearMonth: string;
    serviceYearMonth: string;
    userName: string;
    totalCost: number;
    insurancePayment: number;
    publicPayment: number;
    reduction: number;
    userBurdenTransfer: number;
    userBurdenWithdrawal: number;
  }>;
  summary: {
    totalRows: number;
    validCount: number;
    errorCount: number;
    duplicateCount: number;
  };
}

export default function CSVUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [resultDialogOpen, setResultDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateMutation = trpc.billing.validateCSV.useMutation({
    onSuccess: (data) => {
      setValidationResult(data);
      if (data.summary.validCount > 0) {
        setConfirmDialogOpen(true);
      } else {
        toast.error("アップロード可能なデータがありません");
      }
    },
    onError: (error) => {
      toast.error(`バリデーションエラー: ${error.message}`);
    },
  });

  const utils = trpc.useUtils();
  const uploadMutation = trpc.billing.uploadCSV.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.insertedCount}件のデータをアップロードしました`);
      setFile(null);
      setValidationResult(null);
      setConfirmDialogOpen(false);
      setResultDialogOpen(true);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      // 請求データ一覧を更新
      utils.billing.list.invalidate();
      utils.billing.search.invalidate();
    },
    onError: (error) => {
      toast.error(`アップロードエラー: ${error.message}`);
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    // CSVファイルかチェック
    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      toast.error("CSVファイルを選択してください");
      return;
    }

    setFile(selectedFile);
    setValidationResult(null);
  };

  const handleValidate = async () => {
    if (!file) {
      toast.error("ファイルを選択してください");
      return;
    }

    // ファイルをbase64に変換
    const reader = new FileReader();
    reader.onload = async (e) => {
      const arrayBuffer = e.target?.result as ArrayBuffer;
      const base64 = btoa(
        String.fromCharCode(...new Uint8Array(arrayBuffer))
      );

      validateMutation.mutate({ csvData: base64 });
    };
    reader.onerror = () => {
      toast.error("ファイルの読み込みに失敗しました");
    };
    reader.readAsArrayBuffer(file);
  };

  const handleUpload = () => {
    if (!validationResult || validationResult.validRows.length === 0) {
      toast.error("アップロード可能なデータがありません");
      return;
    }

    uploadMutation.mutate({ rows: validationResult.validRows });
  };

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">CSVアップロード</h1>
        <p className="text-muted-foreground">
          請求データのCSVファイルをアップロードできます
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            ファイル選択
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
                id="csv-file-input"
              />
              <Button
                variant="outline"
                onClick={() => {
                  fileInputRef.current?.click();
                }}
              >
                <FileText className="w-4 h-4 mr-2" />
                ファイルを選択
              </Button>
              {file && (
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">{file.name}</span>
                  <span className="text-sm text-muted-foreground">
                    ({(file.size / 1024).toFixed(2)} KB)
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleValidate}
                disabled={!file || validateMutation.isPending}
              >
                {validateMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    バリデーション中...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    バリデーション実行
                  </>
                )}
              </Button>
            </div>

            {validationResult && (
              <div className="mt-4 space-y-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-1">
                      <div>総行数: {validationResult.summary.totalRows}行</div>
                      <div className="text-green-600">
                        有効: {validationResult.summary.validCount}行
                      </div>
                      {validationResult.summary.errorCount > 0 && (
                        <div className="text-red-600">
                          エラー: {validationResult.summary.errorCount}行
                        </div>
                      )}
                      {validationResult.summary.duplicateCount > 0 && (
                        <div className="text-orange-600">
                          重複: {validationResult.summary.duplicateCount}行
                        </div>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>

                {validationResult.errors.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-red-600">エラー一覧</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="max-h-60 overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>行番号</TableHead>
                              <TableHead>フィールド</TableHead>
                              <TableHead>エラーメッセージ</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {validationResult.errors.map((error, idx) => (
                              <TableRow key={idx}>
                                <TableCell>{error.rowNumber}</TableCell>
                                <TableCell>{error.field || '-'}</TableCell>
                                <TableCell className="text-red-600">
                                  {error.message}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {validationResult.duplicates.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-orange-600">重複データ（CSV内）</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="max-h-60 overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>行番号</TableHead>
                              <TableHead>請求年月</TableHead>
                              <TableHead>提供年月</TableHead>
                              <TableHead>利用者名</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {validationResult.duplicates.map((dup, idx) => (
                              <TableRow key={idx}>
                                <TableCell>{dup.rowNumber}</TableCell>
                                <TableCell>{dup.billingYearMonth}</TableCell>
                                <TableCell>{dup.serviceYearMonth}</TableCell>
                                <TableCell>{dup.userName}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {validationResult.validRows.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-green-600">
                        アップロード予定データ（プレビュー）
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="max-h-60 overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>行番号</TableHead>
                              <TableHead>請求年月</TableHead>
                              <TableHead>提供年月</TableHead>
                              <TableHead>利用者名</TableHead>
                              <TableHead className="text-right">費用総額</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {validationResult.validRows.slice(0, 10).map((row, idx) => (
                              <TableRow key={idx}>
                                <TableCell>{row.rowNumber}</TableCell>
                                <TableCell>{row.billingYearMonth}</TableCell>
                                <TableCell>{row.serviceYearMonth}</TableCell>
                                <TableCell>{row.userName}</TableCell>
                                <TableCell className="text-right">
                                  ¥{row.totalCost.toLocaleString('ja-JP')}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        {validationResult.validRows.length > 10 && (
                          <div className="text-sm text-muted-foreground mt-2 text-center">
                            他 {validationResult.validRows.length - 10} 行...
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 確認ダイアログ */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>アップロード確認</DialogTitle>
            <DialogDescription>
              {validationResult?.summary.validCount}件のデータをアップロードしますか？
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {validationResult && validationResult.summary.errorCount > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  エラーが発生した行はスキップされ、有効なデータのみがアップロードされます。
                </AlertDescription>
              </Alert>
            )}
            {validationResult && validationResult.summary.duplicateCount > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  CSV内で重複している行はスキップされます。
                </AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDialogOpen(false)}
            >
              キャンセル
            </Button>
            <Button
              onClick={handleUpload}
              disabled={uploadMutation.isPending}
            >
              {uploadMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  アップロード中...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                    アップロード実行
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 結果ダイアログ */}
      <Dialog open={resultDialogOpen} onOpenChange={setResultDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>アップロード完了</DialogTitle>
            <DialogDescription>
              データのアップロードが完了しました
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setResultDialogOpen(false)}>
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

