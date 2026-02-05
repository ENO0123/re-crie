# MySQLパスワード設定ガイド

## 現在の状況

MySQLサーバーは起動していますが、rootパスワードが設定されているか確認が必要です。

## 手順1: MySQLのrootパスワードを確認/設定

### 方法A: パスワードなしで接続できる場合

もしパスワードなしで接続できる場合、以下のコマンドでパスワードを設定できます：

```bash
/usr/local/mysql/bin/mysql -u root
```

MySQLに接続したら、以下のコマンドでパスワードを設定：

```sql
ALTER USER 'root'@'localhost' IDENTIFIED BY 'あなたのパスワード';
FLUSH PRIVILEGES;
```

### 方法B: パスワードが既に設定されている場合

パスワードが既に設定されている場合、以下のコマンドで接続を試してください：

```bash
/usr/local/mysql/bin/mysql -u root -p
```

パスワードを入力して接続できれば、そのパスワードを使用してください。

### 方法C: パスワードを忘れた場合

パスワードを忘れた場合は、MySQLをセーフモードで起動してリセットする必要があります：

1. MySQLサーバーを停止：
   ```bash
   sudo /usr/local/mysql/support-files/mysql.server stop
   ```

2. セーフモードで起動：
   ```bash
   sudo /usr/local/mysql/bin/mysqld_safe --skip-grant-tables &
   ```

3. パスワードなしで接続：
   ```bash
   /usr/local/mysql/bin/mysql -u root
   ```

4. パスワードをリセット：
   ```sql
   USE mysql;
   UPDATE user SET authentication_string=PASSWORD('新しいパスワード') WHERE User='root';
   FLUSH PRIVILEGES;
   EXIT;
   ```

5. MySQLサーバーを再起動：
   ```bash
   sudo /usr/local/mysql/support-files/mysql.server restart
   ```

## 手順2: .envファイルのパスワードを更新

MySQLのrootパスワードが分かったら、`.env`ファイルの`DATABASE_URL`を更新します：

```env
DATABASE_URL=mysql://root:あなたのパスワード@localhost:3306/recrie_saas
```

**重要**: パスワードに特殊文字（`@`, `:`, `/`, `%`など）が含まれる場合は、URLエンコードが必要です：
- `@` → `%40`
- `:` → `%3A`
- `/` → `%2F`
- `%` → `%25`
- `#` → `%23`
- `?` → `%3F`
- `&` → `%26`

### 例

- パスワードが `mypass123` の場合:
  ```
  DATABASE_URL=mysql://root:mypass123@localhost:3306/recrie_saas
  ```

- パスワードが `my@pass` の場合:
  ```
  DATABASE_URL=mysql://root:my%40pass@localhost:3306/recrie_saas
  ```

## 手順3: 接続テスト

パスワードを設定したら、接続テストを実行：

```bash
pnpm db:test
```

接続が成功すれば、以下のメッセージが表示されます：
```
✅ データベース接続成功！
```

## トラブルシューティング

### エラー: Access denied

- パスワードが正しいか確認
- `.env`ファイルのパスワードがURLエンコードされているか確認
- MySQLのrootユーザーが`localhost`から接続できるか確認

### エラー: Unknown database

データベースがまだ作成されていない場合：

```sql
CREATE DATABASE recrie_saas CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### エラー: Can't connect to MySQL server

MySQLサーバーが起動しているか確認：

```bash
ps aux | grep mysql
```

起動していない場合は：

```bash
sudo /usr/local/mysql/support-files/mysql.server start
```










