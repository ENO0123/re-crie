# データベースセットアップガイド

## 1. データベースの作成

MySQLに接続して、データベースを作成します：

```sql
CREATE DATABASE recrie_saas CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

## 2. 環境変数の設定

プロジェクトルートに `.env` ファイルを作成し、以下の内容を設定してください：

```env
# データベース接続設定
# 形式: mysql://ユーザー名:パスワード@ホスト:ポート/データベース名
DATABASE_URL=mysql://root:password@localhost:3306/recrie_saas

# OAuth設定（開発環境では省略可能）
VITE_OAUTH_PORTAL_URL=
VITE_APP_ID=

# JWT設定
JWT_SECRET=your-secret-key-here

# オーナー設定（管理者のOpenID）
OWNER_OPEN_ID=
```

### 接続文字列の例

- ローカルMySQL（デフォルトポート）: `mysql://root:password@localhost:3306/recrie_saas`
- リモートMySQL: `mysql://user:password@192.168.1.100:3306/recrie_saas`
- パスワードに特殊文字が含まれる場合: URLエンコードしてください（例: `@` → `%40`）

## 3. 接続テスト

以下のコマンドでデータベース接続をテストできます：

```bash
pnpm db:test
```

このコマンドは以下を確認します：
- データベース接続の成功/失敗
- 既存のテーブル一覧
- Drizzle ORMの接続

## 4. マイグレーションの実行

データベーススキーマを適用するには：

```bash
pnpm db:push
```

このコマンドは以下を実行します：
1. `drizzle-kit generate` - スキーマからマイグレーションファイルを生成
2. `drizzle-kit migrate` - マイグレーションを実行

## 5. トラブルシューティング

### 接続エラー: ECONNREFUSED
- MySQLサーバーが起動しているか確認: `ps aux | grep mysql`
- ホスト名とポート番号が正しいか確認

### 接続エラー: Access denied
- ユーザー名とパスワードが正しいか確認
- ユーザーにデータベースへのアクセス権限があるか確認:
  ```sql
  GRANT ALL PRIVILEGES ON recrie_saas.* TO 'user'@'localhost';
  FLUSH PRIVILEGES;
  ```

### 接続エラー: Unknown database
- データベースが存在するか確認:
  ```sql
  SHOW DATABASES;
  ```
- データベースを作成（上記の手順1を参照）

## 6. 現在のスキーマ

以下のテーブルが作成されます：
- `users` - ユーザー情報
- `organizations` - 事業所情報（マルチテナント）
- `bank_balances` - 口座残高
- `income_records` - 入金実績
- `expense_records` - 支出実績
- `billing_data` - 請求データ
- `factoring_settings` - ファクタリング設定
- `budgets` - 予算

