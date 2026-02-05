/**
 * CSVパースとバリデーション処理
 */

import iconv from 'iconv-lite';

export interface CSVRow {
  rowNumber: number; // 1-based行番号（ヘッダー行を除く）
  billingYearMonth: string; // YYYYMM形式
  serviceYearMonth: string; // YYYYMM形式
  userName: string;
  totalCost: number;
  insurancePayment: number;
  publicPayment: number;
  reduction: number;
  userBurdenTransfer: number;
  userBurdenWithdrawal: number;
}

export interface CSVValidationError {
  rowNumber: number;
  field?: string;
  message: string;
}

export interface CSVValidationResult {
  validRows: CSVRow[];
  errors: CSVValidationError[];
  duplicates: CSVRow[]; // CSV内での重複
}

/**
 * Shift-JISのCSVファイルをパース
 * 注意: この実装は簡易版です。本番環境ではiconv-liteなどのライブラリを使用することを推奨します。
 */
export function parseCSV(csvText: string): string[][] {
  const lines: string[][] = [];
  let currentLine: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // エスケープされた引用符
        currentField += '"';
        i++; // 次の文字をスキップ
      } else {
        // 引用符の開始/終了
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // フィールドの区切り
      currentLine.push(currentField.trim());
      currentField = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      // 行の終わり
      if (currentField || currentLine.length > 0) {
        currentLine.push(currentField.trim());
        lines.push(currentLine);
        currentLine = [];
        currentField = '';
      }
      // \r\nの場合は次の文字をスキップ
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
    } else {
      currentField += char;
    }
  }

  // 最後の行を追加
  if (currentField || currentLine.length > 0) {
    currentLine.push(currentField.trim());
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Shift-JISのテキストをUTF-8に変換
 * iconv-liteを使用してShift-JISからUTF-8に変換します
 */
export function convertShiftJISToUTF8(buffer: Buffer): string {
  // iconv-liteを使用してShift-JISからUTF-8に変換
  // まずShift-JISとして試行
  try {
    const utf8Text = iconv.decode(buffer, 'shift_jis');
    return utf8Text;
  } catch (error) {
    // Shift-JISとして解釈できない場合は、UTF-8として試行
    try {
      return buffer.toString('utf-8');
    } catch {
      // UTF-8としても解釈できない場合は、latin1として解釈（フォールバック）
      return buffer.toString('latin1');
    }
  }
}

/**
 * YYYYMM形式の文字列を検証
 */
function validateYYYYMM(dateStr: string): boolean {
  if (!dateStr || dateStr.length !== 6) {
    return false;
  }
  
  const year = parseInt(dateStr.substring(0, 4), 10);
  const month = parseInt(dateStr.substring(4, 6), 10);
  
  if (isNaN(year) || isNaN(month)) {
    return false;
  }
  
  if (year < 2000 || year > 2100) {
    return false;
  }
  
  if (month < 1 || month > 12) {
    return false;
  }
  
  return true;
}

/**
 * 数値文字列を数値に変換（カンマを削除）
 */
function parseNumeric(str: string): number {
  if (!str || str.trim() === '') {
    return 0;
  }
  
  // カンマを削除して数値に変換
  const cleaned = str.replace(/,/g, '').trim();
  const num = parseFloat(cleaned);
  
  return isNaN(num) ? 0 : Math.round(num);
}

/**
 * CSVデータをバリデーション
 */
export function validateCSVData(
  rows: string[][],
  existingData: Array<{ billingYearMonth: string; serviceYearMonth: string; userName: string }> = []
): CSVValidationResult {
  const validRows: CSVRow[] = [];
  const errors: CSVValidationError[] = [];
  const duplicates: CSVRow[] = [];
  
  // CSV内での重複をチェックするためのセット
  const csvRowKeys = new Set<string>();
  
  // 既存データのキーセットを作成
  const existingKeys = new Set<string>(
    existingData.map(d => `${d.billingYearMonth}-${d.serviceYearMonth}-${d.userName}`)
  );

  // ヘッダー行をスキップ（1行目）
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 1; // 1-based行番号（ヘッダー行を含む）
    const dataRowNumber = i; // データ行としての行番号（ヘッダー行を除く）

    // 最小限の列数チェック（9列必要）
    if (row.length < 9) {
      errors.push({
        rowNumber,
        message: `列数が不足しています（${row.length}列/9列必要）`,
      });
      continue;
    }

    // 各フィールドを取得
    const billingYearMonth = row[0]?.trim() || '';
    const serviceYearMonth = row[1]?.trim() || '';
    const userName = row[2]?.trim() || '';
    const totalCostStr = row[3]?.trim() || '0';
    const insurancePaymentStr = row[4]?.trim() || '0';
    const publicPaymentStr = row[5]?.trim() || '0';
    const reductionStr = row[6]?.trim() || '0';
    const userBurdenTransferStr = row[7]?.trim() || '0';
    const userBurdenWithdrawalStr = row[8]?.trim() || '0';

    // バリデーションエラーを収集
    const rowErrors: CSVValidationError[] = [];

    // 必須項目チェック
    if (!billingYearMonth) {
      rowErrors.push({
        rowNumber,
        field: '請求年月',
        message: '請求年月が空です',
      });
    } else if (!validateYYYYMM(billingYearMonth)) {
      rowErrors.push({
        rowNumber,
        field: '請求年月',
        message: `請求年月の形式が不正です（${billingYearMonth}）。YYYYMM形式（6桁）で入力してください。`,
      });
    }

    if (!serviceYearMonth) {
      rowErrors.push({
        rowNumber,
        field: 'サービス提供年月',
        message: 'サービス提供年月が空です',
      });
    } else if (!validateYYYYMM(serviceYearMonth)) {
      rowErrors.push({
        rowNumber,
        field: 'サービス提供年月',
        message: `サービス提供年月の形式が不正です（${serviceYearMonth}）。YYYYMM形式（6桁）で入力してください。`,
      });
    }

    if (!userName) {
      rowErrors.push({
        rowNumber,
        field: '利用者名',
        message: '利用者名が空です',
      });
    }

    // 数値フィールドの変換
    const totalCost = parseNumeric(totalCostStr);
    const insurancePayment = parseNumeric(insurancePaymentStr);
    const publicPayment = parseNumeric(publicPaymentStr);
    const reduction = parseNumeric(reductionStr);
    const userBurdenTransfer = parseNumeric(userBurdenTransferStr);
    const userBurdenWithdrawal = parseNumeric(userBurdenWithdrawalStr);

    // エラーがある場合はスキップ
    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
      continue;
    }

    // 重複チェック（A～C列: 請求年月、サービス提供年月、利用者名）
    const rowKey = `${billingYearMonth}-${serviceYearMonth}-${userName}`;
    
    if (csvRowKeys.has(rowKey)) {
      // CSV内での重複
      duplicates.push({
        rowNumber: dataRowNumber,
        billingYearMonth,
        serviceYearMonth,
        userName,
        totalCost,
        insurancePayment,
        publicPayment,
        reduction,
        userBurdenTransfer,
        userBurdenWithdrawal,
      });
      continue;
    }

    if (existingKeys.has(rowKey)) {
      // 既存データとの重複
      errors.push({
        rowNumber,
        message: `既存データと重複しています（請求年月: ${billingYearMonth}, サービス提供年月: ${serviceYearMonth}, 利用者名: ${userName}）`,
      });
      continue;
    }

    // 有効な行として追加
    csvRowKeys.add(rowKey);
    validRows.push({
      rowNumber: dataRowNumber,
      billingYearMonth,
      serviceYearMonth,
      userName,
      totalCost,
      insurancePayment,
      publicPayment,
      reduction,
      userBurdenTransfer,
      userBurdenWithdrawal,
    });
  }

  return {
    validRows,
    errors,
    duplicates,
  };
}

/**
 * CSVファイル（Buffer）をパースしてバリデーション
 */
export function parseAndValidateCSV(
  csvBuffer: Buffer,
  existingData: Array<{ billingYearMonth: string; serviceYearMonth: string; userName: string }> = []
): CSVValidationResult {
  // Shift-JISからUTF-8に変換（簡易版）
  const csvText = convertShiftJISToUTF8(csvBuffer);
  
  // CSVをパース
  const rows = parseCSV(csvText);
  
  // バリデーション
  return validateCSVData(rows, existingData);
}

