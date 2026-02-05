import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

// モックアップモードの検出（ポート4000の場合のみ）
// ポート4001（DB接続モード）では実際の認証を使用
// OAuth設定がない場合でも、ID/パスワードログインが使えるので、モックアップモードはポート4000のみ
const port = parseInt(process.env.PORT || "4000", 10);
const isMockupMode = port === 4000 && process.env.NODE_ENV === "development" && (!process.env.OAUTH_SERVER_URL || !process.env.VITE_APP_ID);

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  // モックアップモード（開発環境のみ）ではダミーユーザーを返す
  if (isMockupMode) {
    user = {
      id: 1,
      openId: "mock-user",
      name: "モックユーザー",
      email: "mock@example.com",
      role: "editor" as const,
      organizationId: 1,
      loginMethod: null,
      passwordHash: null,
      lastSignedIn: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  } else {
    // 本番環境またはOAuth設定がある場合: セッションクッキーから認証
    // ID/パスワードログインでもセッションクッキーが設定されるので、同じロジックで動作
    try {
      user = await sdk.authenticateRequest(opts.req);
    } catch (error) {
      // Authentication is optional for public procedures.
      user = null;
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
