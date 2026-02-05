import "dotenv/config";
import { createOrganization, getAllOrganizations, upsertUser, getUserByEmail } from "../server/db";
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

// ユーザー作成の共通処理
async function createSingleUser(
  organizationId: number | null,
  bcrypt: any
): Promise<boolean> {
  const email = await question("メールアドレスを入力してください: ");
  if (!email.trim()) {
    console.log("❌ メールアドレスは必須です。");
    return false;
  }

  const name = await question("名前を入力してください: ");
  if (!name.trim()) {
    console.log("❌ 名前は必須です。");
    return false;
  }

  const password = await question("パスワードを入力してください: ");
  if (!password.trim()) {
    console.log("❌ パスワードは必須です。");
    return false;
  }

  // ロールを選択
  console.log("\nロールを選択してください:");
  console.log("  1. admin (管理者)");
  console.log("  2. editor (編集者)");
  console.log("  3. viewer (閲覧者)");
  console.log("  4. headquarters (本部担当者)");
  
  const roleChoice = await question("ロール番号を入力してください (1-4): ");
  let role: "admin" | "editor" | "viewer" | "headquarters" = "viewer";
  let finalOrgId = organizationId;
  
  switch (roleChoice.trim()) {
    case "1":
      role = "admin";
      break;
    case "2":
      role = "editor";
      break;
    case "3":
      role = "viewer";
      break;
    case "4":
      role = "headquarters";
      // 本部担当者の場合はorganizationIdをnullに設定
      finalOrgId = null;
      break;
    default:
      console.log("⚠️  無効な選択です。デフォルトのviewerに設定します。");
  }

  // 本部担当者以外で組織IDが設定されていない場合の確認
  if (role !== "headquarters" && finalOrgId === null) {
    console.log("\n⚠️  各社アカウントには組織IDが必要です。");
    const createNewOrg = await question("新しい組織を作成しますか？ (y/n): ");
    if (createNewOrg.toLowerCase() === 'y' || createNewOrg.toLowerCase() === 'yes') {
      const orgName = await question("組織名を入力してください: ");
      if (orgName.trim()) {
        const result = await createOrganization({ name: orgName.trim() });
        finalOrgId = result[0].insertId;
        console.log(`✅ 組織が作成されました！ (ID: ${finalOrgId})`);
      } else {
        console.log("❌ 組織名が入力されていません。ユーザー作成をスキップします。");
        return false;
      }
    } else {
      console.log("❌ 組織IDが必要です。ユーザー作成をスキップします。");
      return false;
    }
  }

  // 既存ユーザーをチェック
  const existingUser = await getUserByEmail(email.trim());
  if (existingUser) {
    console.log("\n⚠️  既にこのメールアドレスのユーザーが存在します。");
    console.log(`  OpenID: ${existingUser.openId}`);
    console.log(`  名前: ${existingUser.name || "(未設定)"}`);
    console.log(`  ロール: ${existingUser.role}`);
    console.log(`  組織ID: ${existingUser.organizationId || "なし（本部担当者）"}`);
    
    const update = await question("\nユーザー情報を更新しますか？ (y/n): ");
    if (update.toLowerCase() !== 'y' && update.toLowerCase() !== 'yes') {
      console.log("ユーザー作成をスキップします。");
      return false;
    }

    // パスワードを更新
    console.log("\n🔒 パスワードをハッシュ化しています...");
    const passwordHash = await bcrypt.hash(password, 10);
    await upsertUser({
      openId: existingUser.openId,
      email: email.trim(),
      name: name.trim(),
      passwordHash: passwordHash,
      role: role,
      organizationId: finalOrgId,
    });
    console.log("\n✅ ユーザー情報を更新しました！");
    console.log(`\n📋 更新されたユーザー情報:`);
    console.log(`  OpenID: ${existingUser.openId}`);
    console.log(`  メールアドレス: ${email.trim()}`);
    console.log(`  名前: ${name.trim()}`);
    console.log(`  ロール: ${role}`);
    console.log(`  組織ID: ${finalOrgId || "なし（本部担当者）"}`);
    console.log(`\n🔑 ログイン情報:`);
    console.log(`  ID: ${email.trim()}`);
    console.log(`  PASS: ${password}`);
    return true;
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
    role: role,
    organizationId: finalOrgId,
  });

  console.log("\n✅ ユーザーが正常に作成されました！");
  console.log(`\n📋 作成されたユーザー情報:`);
  console.log(`  OpenID: ${openId}`);
  console.log(`  メールアドレス: ${email.trim()}`);
  console.log(`  名前: ${name.trim()}`);
  console.log(`  ロール: ${role}`);
  console.log(`  組織ID: ${finalOrgId || "なし（本部担当者）"}`);
  console.log(`\n🔑 ログイン情報:`);
  console.log(`  ID: ${email.trim()}`);
  console.log(`  PASS: ${password}`);
  
  return true;
}

async function createOrgAndUser() {
  console.log("🏢 組織とユーザー作成ツール\n");
  console.log("=" .repeat(50));

  try {
    // bcryptjsを動的インポート
    const bcryptModule = await import("bcryptjs");
    const bcrypt = bcryptModule.default || bcryptModule;

    // 1. 組織を作成するか確認
    console.log("\n📋 ステップ1: 組織の作成");
    const createOrg = await question("組織を作成しますか？ (y/n): ");
    
    let organizationId: number | null = null;
    
    if (createOrg.toLowerCase() === 'y' || createOrg.toLowerCase() === 'yes') {
      const orgName = await question("組織名を入力してください: ");
      
      if (!orgName.trim()) {
        console.log("⚠️  組織名が入力されていません。組織作成をスキップします。");
      } else {
        console.log(`\n🏢 組織「${orgName}」を作成しています...`);
        const result = await createOrganization({ name: orgName.trim() });
        organizationId = result[0].insertId;
        console.log(`✅ 組織が作成されました！ (ID: ${organizationId})`);
      }
    } else {
      // 既存の組織を選択
      const existingOrgs = await getAllOrganizations();
      if (existingOrgs.length > 0) {
        console.log("\n既存の組織一覧:");
        existingOrgs.forEach((org, index) => {
          console.log(`  ${index + 1}. ${org.name} (ID: ${org.id})`);
        });
        
        const orgChoice = await question("\n組織IDを入力してください（スキップする場合はEnter）: ");
        if (orgChoice.trim()) {
          organizationId = parseInt(orgChoice.trim(), 10);
          if (isNaN(organizationId)) {
            console.log("⚠️  無効な組織IDです。組織なしで続行します。");
            organizationId = null;
          } else {
            const selectedOrg = existingOrgs.find(o => o.id === organizationId);
            if (selectedOrg) {
              console.log(`✅ 組織「${selectedOrg.name}」を選択しました。`);
            } else {
              console.log("⚠️  指定された組織IDが見つかりません。組織なしで続行します。");
              organizationId = null;
            }
          }
        }
      } else {
        console.log("⚠️  既存の組織がありません。組織なしで続行します。");
      }
    }

    // 2. ユーザーを作成（複数ユーザーに対応）
    console.log("\n📋 ステップ2: ユーザーの作成");
    const createUser = await question("ユーザーを作成しますか？ (y/n): ");
    
    if (createUser.toLowerCase() !== 'y' && createUser.toLowerCase() !== 'yes') {
      console.log("\n✅ 処理を終了します。");
      rl.close();
      process.exit(0);
    }

    let userCount = 0;
    let continueCreating = true;

    while (continueCreating) {
      console.log(`\n${"=".repeat(50)}`);
      console.log(`ユーザー作成 ${userCount > 0 ? `(${userCount + 1}人目)` : ''}`);
      console.log(`${"=".repeat(50)}`);

      const success = await createSingleUser(organizationId, bcrypt);
      if (success) {
        userCount++;
      }

      // 続けてユーザーを作成するか確認
      console.log(`\n${"=".repeat(50)}`);
      const continueChoice = await question("続けてユーザーを作成しますか？ (y/n): ");
      if (continueChoice.toLowerCase() !== 'y' && continueChoice.toLowerCase() !== 'yes') {
        continueCreating = false;
      }
    }

    console.log(`\n✅ 合計 ${userCount} 人のユーザーを作成しました！`);
    console.log("\n処理を終了します。");

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

createOrgAndUser();
