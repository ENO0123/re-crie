// 開発サーバーが起動している状態で実行するスクリプト
// 使用方法: node scripts/create-user-via-api.js

const email = "r.enomoto@re-care.me";
const password = "ryoe0123";
const name = "RECARE管理者";

async function createUser() {
  try {
    const response = await fetch("http://localhost:3000/api/trpc/auth.createUser", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        json: {
          email,
          password,
          name,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, body: ${error}`);
    }

    const data = await response.json();
    console.log("✅ ユーザー作成成功！");
    console.log(JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("❌ エラー:", error.message);
    console.error("\n💡 開発サーバーが起動しているか確認してください:");
    console.error("   pnpm dev");
  }
}

createUser();
