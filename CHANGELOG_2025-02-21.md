# 変更履歴（2025-02-21 デプロイ分）

## 概要

- **銀行残高**: 複数口座（bank_accounts）対応に変更。口座別・月別の残高管理。
- **予算・ローン・レポート**: UI・API の調整と日付入力コンポーネント追加。
- **DB**: bank_accounts テーブル追加、bank_balances のスキーマ変更。
- **運用**: 本番ユーザー作成・パスワードリセット・残高移行用スクリプト追加。

---

## 1. データベース・バックエンド

### スキーマ（drizzle/schema.ts）

- `bank_accounts` テーブル追加（組織別の金融機関・口座マスタ）
- `bank_balances`: `balance1`〜`balance5`・`totalBalance` を廃止し、`bankAccountId` + `balance`（口座別・月別）に変更

### マイグレーション

- **0007_cooing_madrox**: 上記スキーマ変更の正式マイグレーション（`drizzle/meta/_journal.json` で採用）
- 0007_bank_accounts_and_balance_by_account.sql: 別案（テーブル退避＋新規作成）の手動用
- 0008_bank_accounts_create_if_missing.sql: `bank_accounts` の存在チェック・作成の保険用

### server/db.ts

- `bank_accounts` の CRUD および、口座別・月別の `bank_balances` 取得・更新ロジックを追加

### server/routers.ts

- 銀行口座一覧・作成・更新・削除のルート追加
- 口座別残高の取得・登録 API の追加・変更

---

## 2. フロントエンド

### 銀行残高（client/src/pages/BankBalance.tsx）

- 口座マスタの一覧・追加・編集・並び順変更に対応
- 月別・口座別の残高入力・表示に変更
- 日付は YYYY-MM の月指定に統一

### 予算（client/src/pages/Budget.tsx）

- 日付入力・表示の整理（date-input-ymd の利用）
- レイアウト・フォームの調整

### ローン（client/src/pages/Loans.tsx）

- 日付まわりの表示・入力の調整（同上）

### レポート（client/src/pages/Reports.tsx）

- 軽微な表示・集計の調整

### 新規コンポーネント

- **client/src/components/ui/date-input-ymd.tsx**: 年月日（YYYY-MM-DD）入力用共通コンポーネント

### モック（client/src/lib/mockup.ts）

- 銀行残高・口座まわりのモックデータを新スキーマに合わせて更新

---

## 3. パッケージ・スクリプト

### package.json

- `db:create-production-user`: 本番用ユーザー作成
- `db:reset-password`: パスワードリセット
- 上記実行用のスクリプトパスを追加

### 新規スクリプト

- **scripts/create-production-user.ts**: 本番環境用ユーザー作成
- **scripts/reset-password.ts**: 既存ユーザーのパスワードリセット
- **scripts/migrate-bank-balances-to-accounts.ts**: 既存の残高データを口座別構造へ移行するためのスクリプト

### ドキュメント

- **PRODUCTION_USER_CREATION.md**: Railway 本番環境でのアカウント作成手順（CLI・ダッシュボード両方）

---

## デプロイ時メモ（Railway）

1. **マイグレーション**: デプロイ後、必要に応じて  
   `railway run pnpm db:push` または Railway ダッシュボードの Run Command で実行。
2. **既存データ**: 既に旧スキーマで残高データがある場合は、  
   `scripts/migrate-bank-balances-to-accounts.ts` の実行要否を検討してください。
3. **本番ユーザー**: 初回または必要時に  
   `railway run pnpm db:create-production-user` や  
   `pnpm db:reset-password` を利用（手順は PRODUCTION_USER_CREATION.md 参照）。
