import "dotenv/config";
import { upsertUser, getUserByEmail } from "../server/db";
import readline from "readline";

// readlineインターフェースを作成
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// 質問をして回答を得るヘルパー関数
function question(query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

async function createHeadquartersUser() {
  console.log("🏛️  本部担当者作成ツール\n");
  console.log("=" .repeat(50));
  console.log("このツールは本部担当者アカウントを作成します。");
  console.log("本部担当者は全組織のデータにアクセスできます。\n");

  try {
    // bcryptjsを動的インポート
    const bcryptModule = await import("bcryptjs");
    const bcrypt = bcryptModule.default || bcryptModule;

    const email = await question("メールアドレスを入力してください: ");
    if (!email.trim()) {
      console.log("❌ メールアドレスは必須です。");
      rl.close();
      process.exit(1);
    }

    const name = await question("名前を入力してください: ");
    if (!name.trim()) {
      console.log("❌ 名前は必須です。");
      rl.close();
      process.exit(1);
    }

    const password = await question("パスワードを入力してください: ");
    if (!password.trim()) {
      console.log("❌ パスワードは必須です。");
      rl.close();
      process.exit(1);
    }

    // 既存ユーザーをチェック
    const existingUser = await getUserByEmail(email.trim());
    if (existingUser) {
      console.log("\n⚠️  既にこのメールアドレスのユーザーが存在します。");
      console.log(`  OpenID: ${existingUser.openId}`);
      console.log(`  名前: ${existingUser.name || "(未設定)"}`);
      console.log(`  ロール: ${existingUser.role}`);
      console.log(`  組織ID: ${existingUser.organizationId || "なし（本部担当者）"}`);
      
      const update = await question("\nユーザー情報を本部担当者に更新しますか？ (y/n): ");
      if (update.toLowerCase() !== 'y' && update.toLowerCase() !== 'yes') {
        console.log("\n処理をキャンセルしました。");
        rl.close();
        process.exit(0);
      }

      // パスワードを更新
      console.log("\n🔒 パスワードをハッシュ化しています...");
      const passwordHash = await bcrypt.hash(password, 10);
      await upsertUser({
        openId: existingUser.openId,
        email: email.trim(),
        name: name.trim(),
        passwordHash: passwordHash,
        role: "headquarters",
        organizationId: null, // 本部担当者は組織IDをnullに設定
      });
      console.log("\n✅ ユーザー情報を本部担当者に更新しました！");
      console.log(`\n📋 更新されたユーザー情報:`);
      console.log(`  OpenID: ${existingUser.openId}`);
      console.log(`  メールアドレス: ${email.trim()}`);
      console.log(`  名前: ${name.trim()}`);
      console.log(`  ロール: headquarters (本部担当者)`);
      console.log(`  組織ID: なし（全組織にアクセス可能）`);
      console.log(`\n🔑 ログイン情報:`);
      console.log(`  ID: ${email.trim()}`);
      console.log(`  PASS: ${password}`);
      console.log(`\n📌 注意: 本部担当者は /headquarters ページから全組織にアクセスできます。`);
      rl.close();
      process.exit(0);
    }

    // パスワードをハッシュ化
    console.log("\n🔒 パスワードをハッシュ化しています...");
    const passwordHash = await bcrypt.hash(password, 10);

    // openIdを生成（メールアドレスベース）
    const openId = `email:${email.trim()}`;

    // ユーザーを作成
    console.log("👤 データベースにユーザーを保存しています...");
    await upsertUser({
      openId: openId,
      email: email.trim(),
      name: name.trim(),
      passwordHash: passwordHash,
      role: "headquarters",
      organizationId: null, // 本部担当者は組織IDをnullに設定
    });

    console.log("\n✅ 本部担当者アカウントが正常に作成されました！");
    console.log(`\n📋 作成されたユーザー情報:`);
    console.log(`  OpenID: ${openId}`);
    console.log(`  メールアドレス: ${email.trim()}`);
    console.log(`  名前: ${name.trim()}`);
    console.log(`  ロール: headquarters (本部担当者)`);
    console.log(`  組織ID: なし（全組織にアクセス可能）`);
    console.log(`\n🔑 ログイン情報:`);
    console.log(`  ID: ${email.trim()}`);
    console.log(`  PASS: ${password}`);
    console.log(`\n📌 使用方法:`);
    console.log(`  1. ログイン後、サイドバーに「本部管理画面」が表示されます`);
    console.log(`  2. 本部管理画面から各組織のダッシュボードにアクセスできます`);
    console.log(`  3. URLに ?organizationId=組織ID を追加して各組織のデータを確認できます`);

    rl.close();
    process.exit(0);
  } catch (error) {
    console.error("\n❌ エラーが発生しました:");
    if (error instanceof Error) {
      console.error(`   エラーメッセージ: ${error.message}`);
      console.error(`   スタックトレース:`, error.stack);
    } else {
      console.error(error);
    }
    rl.close();
    process.exit(1);
  }
}

createHeadquartersUser();
