// ブラウザのコンソールで実行するスクリプト
// 開発サーバーが起動している状態で、ブラウザのコンソールに貼り付けて実行してください

(async () => {
  const email = "r.enomoto@re-care.me";
  const password = "ryoe0123";
  const name = "RECARE管理者";

  try {
    // tRPCクライアントが利用可能な場合（開発環境）
    if (window.__TRPC_CLIENT__) {
      const result = await window.__TRPC_CLIENT__.auth.createUser.mutate({
        email,
        password,
        name,
      });
      console.log("✅ ユーザー作成成功！", result);
      return;
    }

    // 直接fetchで呼び出す場合
    const response = await fetch("/api/trpc/auth.createUser", {
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
    console.log("✅ ユーザー作成成功！", data);
  } catch (error) {
    console.error("❌ エラー:", error.message);
    console.error("\n💡 開発サーバーが起動しているか確認してください:");
    console.error("   pnpm dev");
  }
})();
