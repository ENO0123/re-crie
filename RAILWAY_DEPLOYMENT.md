# Railway本番環境デプロイ手順

このドキュメントでは、Railwayを使用して本番環境を構築する手順を説明します。

**GitHubリポジトリ**: https://github.com/ENO0123/re-crie.git

## クイックスタート

1. Gitリポジトリを初期化してGitHubにプッシュ（初回のみ）
2. Railwayでプロジェクトを作成し、GitHubリポジトリと連携
3. MySQLデータベースを追加
4. 環境変数を設定
5. デプロイ完了！

## 前提条件

- Railwayアカウント（[railway.app](https://railway.app)で作成）
- GitHubアカウント（リポジトリと連携する場合）
- Gitがインストールされていること

## デプロイ手順

### 0. Gitリポジトリの初期化とGitHubへのプッシュ（初回のみ）

プロジェクトがまだGitリポジトリで管理されていない場合：

1. **Gitリポジトリを初期化**
   ```bash
   cd "/Users/ryoenomoto/work/10_オッティー/予実管理"
   git init
   ```

2. **ファイルをステージング**
   ```bash
   git add .
   ```

3. **初回コミット**
   ```bash
   git commit -m "Initial commit"
   ```

4. **GitHubリポジトリをリモートとして追加**
   ```bash
   git remote add origin https://github.com/ENO0123/re-crie.git
   ```

5. **メインブランチを設定してプッシュ**
   ```bash
   git branch -M main
   git push -u origin main
   ```

**注意**: `.env`ファイルは`.gitignore`に含まれているため、GitHubにプッシュされません。本番環境の環境変数はRailwayで設定します。

### 1. Railwayアカウントの作成とプロジェクト作成

1. [railway.app](https://railway.app)にアクセス
2. 「Start a New Project」をクリック
3. 「Deploy from GitHub repo」を選択
4. GitHubアカウントで認証し、`ENO0123/re-crie`リポジトリを選択
   - リポジトリが表示されない場合は、GitHubでRailwayアプリへのアクセス許可を確認してください

### 2. データベース（MySQL）の追加

1. Railwayダッシュボードでプロジェクトを開く
2. 「+ New」ボタンをクリック
3. 「Database」→「Add MySQL」を選択
4. MySQLサービスが作成される
5. MySQLサービスの「Variables」タブを開き、`DATABASE_URL`の値をコピー（後で使用）

### 3. 環境変数の設定

アプリケーションサービスの「Variables」タブで以下の環境変数を設定：

#### 必須環境変数

```
NODE_ENV=production
DATABASE_URL=<MySQLサービスのDATABASE_URL>
JWT_SECRET=<ランダムな秘密鍵（本番環境用）>
```

**JWT_SECRETの生成方法**:
- **Node.js**: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
- **OpenSSL**: `openssl rand -hex 64`
- **オンラインツール**: [generate-secret.vercel.app](https://generate-secret.vercel.app/64)

**重要**: 
- 開発環境と本番環境で**必ず異なる値**を使用してください
- 推測されにくいランダムな文字列（最低32文字以上、推奨64文字以上）を使用してください
- この値が漏洩すると、攻撃者が任意のJWTトークンを偽造できる可能性があります

#### オプション環境変数（必要に応じて設定）

```
VITE_APP_ID=<アプリID>
OAUTH_SERVER_URL=<OAuthサーバーのURL>
OWNER_OPEN_ID=<管理者のOpenID>
BUILT_IN_FORGE_API_URL=<Forge APIのURL>
BUILT_IN_FORGE_API_KEY=<Forge APIのキー>
PORT=<ポート番号（Railwayが自動設定するので通常は不要）>
```

**注意**: Railwayは自動的に`PORT`環境変数を設定するため、手動で設定する必要はありません。

### 4. ビルド設定の確認

Railwayは自動的に以下を検出します：
- **ビルドコマンド**: `pnpm install && pnpm build`（railway.jsonで指定）
- **起動コマンド**: `pnpm start`（railway.jsonで指定）

`railway.json`が存在する場合、その設定が使用されます。

### 5. デプロイ

1. GitHubリポジトリと連携している場合：
   - メインブランチにプッシュすると自動デプロイされます
   - または、Railwayダッシュボードで「Deploy」をクリック

2. 手動デプロイの場合：
   - Railway CLIを使用: `railway up`
   - または、ダッシュボードから「Deploy」をクリック

### 6. デプロイ後の確認

1. デプロイが完了したら、Railwayが提供するURL（例: `https://your-app.up.railway.app`）にアクセス
2. ログを確認してエラーがないか確認（「View Logs」）
3. データベース接続が正常に動作しているか確認

## トラブルシューティング

### ビルドエラー

- **pnpmが見つからない**: Railwayは自動的にpnpmを検出しますが、`packageManager`フィールドが`package.json`に設定されていることを確認
- **ビルドタイムアウト**: ビルド時間が長い場合、Railwayの無料プランではタイムアウトする可能性があります

### 起動エラー

- **ポートエラー**: Railwayは自動的に`PORT`環境変数を設定します。コードで`process.env.PORT`を使用していることを確認
- **データベース接続エラー**: `DATABASE_URL`が正しく設定されているか確認。MySQLサービスが起動しているか確認

### 環境変数の確認

- Railwayダッシュボードの「Variables」タブで環境変数が正しく設定されているか確認
- シークレット値（`JWT_SECRET`など）は適切に設定されているか確認

## データベースマイグレーション

本番環境でデータベーススキーマを更新する場合：

1. Railway CLIをインストール: `npm i -g @railway/cli`
2. Railwayにログイン: `railway login`
3. プロジェクトをリンク: `railway link`
4. マイグレーションを実行: `railway run pnpm db:push`

または、Railwayダッシュボードの「Deployments」タブから「Run Command」を使用して`pnpm db:push`を実行できます。

## カスタムドメインの設定

1. Railwayダッシュボードでプロジェクトを開く
2. 「Settings」→「Networking」を開く
3. 「Custom Domain」セクションでドメインを追加
4. DNS設定を更新（Railwayが提供する指示に従う）

## 参考リンク

- [Railway公式ドキュメント](https://docs.railway.app)
- [Railway環境変数](https://docs.railway.app/develop/variables)
- [Railwayデータベース](https://docs.railway.app/databases)
