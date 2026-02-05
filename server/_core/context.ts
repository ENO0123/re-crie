import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

// モックアップモードの検出（環境変数が設定されていない場合）
const isMockupMode = !process.env.OAUTH_SERVER_URL || !process.env.VITE_APP_ID;

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  // モックアップモードではダミーユーザーを返す
  if (isMockupMode) {
    user = {
      id: 1,
      openId: "mock-user",
      name: "モックユーザー",
      email: "mock@example.com",
      role: "editor" as const,
      organizationId: 1,
      loginMethod: null,
      lastSignedIn: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  } else {
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
