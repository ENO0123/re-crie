import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";

// import.meta.dirnameの代替（ビルド後でも動作する）
const getDirname = (): string => {
  // 開発環境ではimport.meta.dirnameを使用
  if (import.meta.dirname && typeof import.meta.dirname === 'string') {
    return import.meta.dirname;
  }
  
  // 本番環境（esbuildでバンドル後）では、import.meta.urlから取得を試みる
  try {
    const url = import.meta.url;
    if (url && typeof url === 'string' && url.startsWith('file://')) {
      const filePath = fileURLToPath(url);
      const dir = path.dirname(filePath);
      if (dir && typeof dir === 'string') {
        return dir;
      }
    }
  } catch (e) {
    // フォールバック: プロセスカレントディレクトリを使用
    console.warn('[Vite] Failed to get dirname from import.meta.url, using process.cwd()');
  }
  
  // 最終フォールバック: プロセスカレントディレクトリ（必ず文字列を返す）
  const cwd = process.cwd();
  return cwd && typeof cwd === 'string' ? cwd : '/app';
};

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const dirname = getDirname();
      const clientTemplate = path.resolve(
        dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  // 本番環境では、dist/index.jsが実行されるので、dist/publicが同じディレクトリにある
  // Railwayでは/app/dist/index.jsが実行され、/app/dist/publicが静的ファイルの場所
  // 開発環境では、server/_core/vite.tsから見て../../dist/public
  
  const cwd = process.cwd();
  let distPath: string;
  
  if (process.env.NODE_ENV === "development") {
    const dirname = getDirname();
    distPath = path.resolve(dirname, "../..", "dist", "public");
  } else {
    // 本番環境: Railwayでは/appがcwd、dist/index.jsが実行されるので、/app/dist/publicが正しい
    // 複数のパスを試す（nullやundefinedを避けるため、必ず文字列を返す）
    const possiblePaths: string[] = [];
    
    // パターン1: process.cwd()から見てdist/public（Railwayでは/app/dist/public）
    possiblePaths.push(path.resolve(cwd, "dist", "public"));
    
    // パターン2: process.cwd()から見てpublic（フォールバック）
    possiblePaths.push(path.resolve(cwd, "public"));
    
    // パターン3: /app/dist/public（Railwayの固定パス）
    possiblePaths.push("/app/dist/public");
    
    // パターン4: import.meta.urlから取得を試みる（エラーをキャッチ）
    try {
      const url = import.meta.url;
      if (url && typeof url === 'string' && url.startsWith('file://')) {
        const filePath = fileURLToPath(url);
        const dir = path.dirname(filePath);
        possiblePaths.push(path.resolve(dir, "public"));
      }
    } catch (e) {
      // 無視
    }
    
    // 存在するパスを見つける、なければ最初のパスを使用
    distPath = possiblePaths.find(p => p && fs.existsSync(p)) || possiblePaths[0];
    
    // distPathがundefinedやnullでないことを確認
    if (!distPath || typeof distPath !== 'string') {
      distPath = path.resolve(cwd, "dist", "public");
    }
  }
  
  // デバッグ情報を出力
  console.log(`[Vite] serveStatic - distPath: ${distPath}`);
  console.log(`[Vite] serveStatic - NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`[Vite] serveStatic - process.cwd(): ${cwd}`);
  console.log(`[Vite] serveStatic - distPath exists: ${distPath ? fs.existsSync(distPath) : false}`);
  
  if (!distPath || typeof distPath !== 'string' || !fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
    // エラーを投げずに、空のレスポンスを返す（デバッグ用）
    app.use("*", (_req, res) => {
      res.status(500).send(`Static files not found. Tried: ${distPath || 'undefined'}`);
    });
    return;
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
