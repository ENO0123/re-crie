import "dotenv/config";
import { upsertUser, getUserByEmail } from "../server/db";

async function resetPassword() {
  const email = "r.enomoto@re-care.me";
  const password = "ryoe0123";

  console.log("🔐 パスワードをリセットしています...");
  console.log(`  メールアドレス: ${email}`);

  // bcryptjsを動的インポート
  const bcryptModule = await import("bcryptjs");
  const bcrypt = bcryptModule.default || bcryptModule;

  try {
    // 既存ユーザーをチェック
    const existingUser = await getUserByEmail(email);
    if (!existingUser) {
      console.log("\n❌ このメールアドレスのユーザーが見つかりません。");
      process.exit(1);
    }

    console.log("\n📋 現在のユーザー情報:");
    console.log(`  OpenID: ${existingUser.openId}`);
    console.log(`  名前: ${existingUser.name || "(未設定)"}`);
    console.log(`  ロール: ${existingUser.role}`);
    console.log(`  組織ID: ${existingUser.organizationId || "なし"}`);
    
    // パスワードを更新（既存のロールと組織IDを維持）
    console.log("\n🔒 パスワードをハッシュ化しています...");
    const passwordHash = await bcrypt.hash(password, 10);
    await upsertUser({
      openId: existingUser.openId,
      email: email,
      name: existingUser.name || "RECARE管理者",
      passwordHash: passwordHash,
      role: existingUser.role, // 既存のロールを維持
      organizationId: existingUser.organizationId, // 既存の組織IDを維持
    });
    
    console.log("\n✅ パスワードをリセットしました！");
    console.log(`\n🔑 ログイン情報:`);
    console.log(`  ID: ${email}`);
    console.log(`  PASS: ${password}`);

    process.exit(0);
  } catch (error) {
    console.error("\n❌ パスワードリセットエラー:");
    if (error instanceof Error) {
      console.error(`   エラーメッセージ: ${error.message}`);
      console.error(`   スタックトレース:`, error.stack);
    } else {
      console.error(error);
    }
    process.exit(1);
  }
}

resetPassword();
