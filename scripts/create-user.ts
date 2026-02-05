import "dotenv/config";
import { upsertUser, getUserByEmail } from "../server/db";

async function createUser() {
  const email = "r.enomoto@re-care.me";
  const password = "ryoe0123";
  const name = "RECARE管理者";

  console.log("🔐 ユーザーを作成しています...");
  console.log(`  メールアドレス: ${email}`);
  console.log(`  名前: ${name}`);

  // bcryptjsを動的インポート
  const bcryptModule = await import("bcryptjs");
  const bcrypt = bcryptModule.default || bcryptModule;

  try {
    // 既存ユーザーをチェック
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      console.log("\n⚠️  既にこのメールアドレスのユーザーが存在します。");
      console.log(`  OpenID: ${existingUser.openId}`);
      console.log(`  名前: ${existingUser.name || "(未設定)"}`);
      console.log(`  ロール: ${existingUser.role}`);
      
      // パスワードを更新する
      console.log("\nパスワードを更新します...");
      const passwordHash = await bcrypt.hash(password, 10);
      await upsertUser({
        openId: existingUser.openId,
        email: email,
        name: name,
        passwordHash: passwordHash,
        role: "admin",
      });
      console.log("\n✅ ユーザー情報を更新しました！");
      console.log(`  パスワードも更新されました。`);
      process.exit(0);
    }

    // パスワードをハッシュ化
    console.log("\n🔒 パスワードをハッシュ化しています...");
    const passwordHash = await bcrypt.hash(password, 10);

    // openIdを生成（メールアドレスベース）
    // 既存のユーザーと重複しないように、メールアドレスをベースにしたopenIdを使用
    const openId = `email:${email}`;

    // ユーザーを作成
    console.log("👤 データベースにユーザーを保存しています...");
    await upsertUser({
      openId: openId,
      email: email,
      name: name,
      passwordHash: passwordHash,
      role: "admin",
    });

    console.log("\n✅ ユーザーが正常に作成されました！");
    console.log(`\n📋 作成されたユーザー情報:`);
    console.log(`  OpenID: ${openId}`);
    console.log(`  メールアドレス: ${email}`);
    console.log(`  名前: ${name}`);
    console.log(`  ロール: admin`);
    console.log(`\n🔑 ログイン情報:`);
    console.log(`  ID: ${email}`);
    console.log(`  PASS: ${password}`);

    process.exit(0);
  } catch (error) {
    console.error("\n❌ ユーザー作成エラー:");
    if (error instanceof Error) {
      console.error(`   エラーメッセージ: ${error.message}`);
      console.error(`   スタックトレース:`, error.stack);
    } else {
      console.error(error);
    }
    process.exit(1);
  }
}

createUser();
