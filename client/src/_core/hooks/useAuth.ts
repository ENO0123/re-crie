import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useEffect, useMemo } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath = getLoginUrl() } =
    options ?? {};
  const utils = trpc.useUtils();

  // モックアップ環境用: ポート4000（デモモード）の場合のみモックユーザーを使用
  // ポート4001（DB接続モード）では実際の認証を使用
  // URLからポート番号を取得（ポートが明示されていない場合はデフォルトポートとみなす）
  const getCurrentPort = () => {
    if (typeof window === 'undefined') return '';
    const port = window.location.port;
    if (port) return port;
    // ポートが空の場合は、プロトコルからデフォルトポートを推測
    return window.location.protocol === 'https:' ? '443' : '80';
  };
  const currentPort = getCurrentPort();
  const isMockupMode = currentPort === "4000" && (!import.meta.env.VITE_OAUTH_PORTAL_URL || !import.meta.env.VITE_APP_ID);
  
  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    enabled: !isMockupMode, // モックアップモードでは認証クエリを実行しない
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
    },
  });

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      if (
        error instanceof TRPCClientError &&
        error.data?.code === "UNAUTHORIZED"
      ) {
        return;
      }
      throw error;
    } finally {
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
    }
  }, [logoutMutation, utils]);

  const state = useMemo(() => {
    // モックアップ環境用: ダミーユーザーを返す
    const mockUser = isMockupMode ? {
      id: 1,
      openId: "mock-user",
      name: "モックユーザー",
      email: "mock@example.com",
      role: "editor" as const,
      organizationId: 1,
      loginMethod: null,
      lastSignedIn: new Date() as any,
      createdAt: new Date() as any,
      updatedAt: new Date() as any,
    } : null;
    
    const user = isMockupMode ? mockUser : (meQuery.data ?? null);
    
    localStorage.setItem(
      "manus-runtime-user-info",
      JSON.stringify(user)
    );
    return {
      user,
      loading: isMockupMode ? false : (meQuery.isLoading || logoutMutation.isPending),
      error: isMockupMode ? null : (meQuery.error ?? logoutMutation.error ?? null),
      isAuthenticated: Boolean(user),
    };
  }, [
    isMockupMode,
    meQuery.data,
    meQuery.error,
    meQuery.isLoading,
    logoutMutation.error,
    logoutMutation.isPending,
  ]);

  useEffect(() => {
    // モックアップ環境ではリダイレクトをスキップ
    if (isMockupMode) return;
    
    if (!redirectOnUnauthenticated) return;
    if (meQuery.isLoading || logoutMutation.isPending) return;
    if (state.user) return;
    if (typeof window === "undefined") return;
    if (window.location.pathname === redirectPath) return;
    
    // /loginの場合はリダイレクトしない（ルートが存在しないため）
    if (redirectPath === "/login") {
      console.warn("[Auth] Redirect path is /login, skipping redirect to avoid 404");
      return;
    }

    window.location.href = redirectPath
  }, [
    isMockupMode,
    redirectOnUnauthenticated,
    redirectPath,
    logoutMutation.isPending,
    meQuery.isLoading,
    state.user,
  ]);

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
  };
}
