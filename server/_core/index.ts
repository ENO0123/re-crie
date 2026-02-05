import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { getDb } from "../db";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "4000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  // ポート4001の場合はDB接続を確認
  if (port === 4001) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      console.error("\n❌ エラー: ポート4001で起動するにはDATABASE_URL環境変数が必要です");
      console.error("   .envファイルに以下の形式で設定してください：");
      console.error("   DATABASE_URL=mysql://user:password@localhost:3306/database_name\n");
      process.exit(1);
    }
    console.log(`\n✅ ポート4001で起動: DB接続モード`);
    console.log(`   データベース: ${databaseUrl.replace(/:[^:@]+@/, ':****@')}`);
    
    // DB接続をテスト
    try {
      const db = await getDb();
      if (db) {
        console.log(`   ✅ データベース接続成功\n`);
      } else {
        console.error(`   ❌ データベース接続失敗\n`);
        process.exit(1);
      }
    } catch (error) {
      console.error(`   ❌ データベース接続エラー:`, error);
      console.error(`   データベースが起動しているか、接続情報が正しいか確認してください\n`);
      process.exit(1);
    }
  } else if (port === 4000) {
    console.log(`\n📝 ポート4000で起動: モックデータモード\n`);
  }

  server.listen(port, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${port}/`);
    console.log(`Server also accessible on http://127.0.0.1:${port}/`);
  });

  server.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE") {
      console.error(`Port ${port} is already in use. Please use a different port.`);
    } else {
      console.error("Server error:", error);
    }
    process.exit(1);
  });
}

startServer().catch(console.error);
