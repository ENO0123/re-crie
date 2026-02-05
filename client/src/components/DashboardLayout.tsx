import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { LayoutDashboard, LogOut, PanelLeft, Wallet, TrendingUp, TrendingDown, FileText, Settings, Receipt, Target, CreditCard, Building2, User } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState, useMemo } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";

const menuItems = [
  { icon: LayoutDashboard, label: "ダッシュボード", path: "/" },
  { icon: Wallet, label: "口座残高登録", path: "/bank-balance" },
  { icon: TrendingUp, label: "入金実績登録", path: "/income" },
  { icon: TrendingDown, label: "支出実績登録", path: "/expense" },
  { icon: Target, label: "予算入力", path: "/budget" },
  { icon: CreditCard, label: "借入返済管理", path: "/loans" },
  { icon: Receipt, label: "請求データ管理", path: "/billing" },
  { icon: Settings, label: "ファクタリング設定", path: "/factoring" },
  { icon: FileText, label: "実績・見込み・予測詳細確認", path: "/reports" },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();
  const [location] = useLocation();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  // 本部管理画面の場合はサイドバーを非表示
  const isHeadquartersPage = location === '/headquarters' && user?.role === 'headquarters';

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  // モックアップ環境では認証をスキップ（ポート4000の場合のみ）
  if (!user) {
    // モックアップ環境では認証画面を表示しない（ポート4000の場合のみ）
    const getCurrentPort = () => {
      if (typeof window === 'undefined') return '';
      const port = window.location.port;
      if (port) return port;
      return window.location.protocol === 'https:' ? '443' : '80';
    };
    const currentPort = getCurrentPort();
    const isMockupMode = currentPort === "4000" && (!import.meta.env.VITE_OAUTH_PORTAL_URL || !import.meta.env.VITE_APP_ID);
    if (isMockupMode) {
      // モックアップ環境では、認証なしでコンテンツを表示
      return (
        <div className="min-h-screen">
          {children}
        </div>
      );
    }
    
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-6">
            <h1 className="text-2xl font-semibold tracking-tight text-center">
              Sign in to continue
            </h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Access to this dashboard requires authentication. Continue to launch the login flow.
            </p>
          </div>
          <Button
            onClick={() => {
              const loginUrl = getLoginUrl();
              // /loginの場合は、直接ログインページにリダイレクト
              if (loginUrl === "/login") {
                window.location.href = "/login";
                return;
              }
              window.location.href = loginUrl;
            }}
            size="lg"
            className="w-full shadow-lg hover:shadow-xl transition-all"
          >
            Sign in
          </Button>
        </div>
      </div>
    );
  }

  // 本部管理画面の場合はSidebarProviderを使わない
  if (isHeadquartersPage) {
    return (
      <HeadquartersLayoutContent>
        {children}
      </HeadquartersLayoutContent>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

// 本部管理画面用のレイアウト（サイドバーなし）
function HeadquartersLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen w-full flex flex-col">
      {/* ヘッダー部分（アカウントボタンのみ） */}
      <header className="w-full border-b h-16 flex items-center justify-end px-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-accent/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Avatar className="h-9 w-9 border shrink-0">
                <AvatarFallback className="text-xs font-medium">
                  {user?.name?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0 hidden sm:block">
                <p className="text-sm font-medium truncate leading-none">
                  {user?.name || "-"}
                </p>
                <p className="text-xs text-muted-foreground truncate mt-1.5">
                  {user?.email || "-"}
                </p>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              onClick={logout}
              className="cursor-pointer text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sign out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
      
      {/* コンテンツエリア（全幅） */}
      <main className="flex-1 w-full p-4">{children}</main>
    </div>
  );
}

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  // URLから組織IDを取得（/:organizationId/...形式の場合）
  const organizationId = useMemo(() => {
    const match = location.match(/^\/(\d+)\//);
    return match ? parseInt(match[1], 10) : null;
  }, [location]);

  // 組織IDを含むURLに遷移するヘルパー関数
  const navigateWithOrgId = (path: string) => {
    if (organizationId) {
      // 組織IDが既にURLに含まれている場合は、その組織IDを使って遷移
      setLocation(`/${organizationId}${path}`);
    } else if (user?.organizationId) {
      // 組織IDがURLに含まれていないが、ユーザーに組織IDがある場合はそれを使用
      setLocation(`/${user.organizationId}${path}`);
    } else {
      // それ以外の場合は通常のパスに遷移
      setLocation(path);
    }
  };

  // アクティブなメニューアイテムを判定（組織IDを含むパスも考慮）
  const activeMenuItem = useMemo(() => {
    const normalizedLocation = organizationId 
      ? location.replace(`/${organizationId}`, '')
      : location;
    return menuItems.find(item => {
      if (item.path === '/') {
        return normalizedLocation === '/' || normalizedLocation === `/${organizationId}/dashboard` || normalizedLocation.match(/^\/(\d+)\/dashboard$/);
      }
      return normalizedLocation === item.path || normalizedLocation === `/${organizationId}${item.path}` || normalizedLocation.match(new RegExp(`^/(\\d+)${item.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
    });
  }, [location, organizationId]);

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r-0"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 justify-center">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed ? (
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-semibold tracking-tight truncate">
                    Navigation
                  </span>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
            <SidebarMenu className="px-2 py-1">
              {/* 本部担当者の場合のみ本部管理画面へのリンクを表示 */}
              {user?.role === 'headquarters' && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={location === '/headquarters'}
                    onClick={() => setLocation('/headquarters')}
                    tooltip="本部管理画面"
                    className={`h-10 transition-all font-normal`}
                  >
                    <Building2
                      className={`h-4 w-4 ${location === '/headquarters' ? "text-primary" : ""}`}
                    />
                    <span>本部管理画面</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              {menuItems.map(item => {
                const normalizedPath = item.path === '/' ? '/dashboard' : item.path;
                const isActive = organizationId
                  ? location === `/${organizationId}${normalizedPath}`
                  : location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => navigateWithOrgId(normalizedPath)}
                      tooltip={item.label}
                      className={`h-10 transition-all font-normal`}
                    >
                      <item.icon
                        className={`h-4 w-4 ${isActive ? "text-primary" : ""}`}
                      />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 border shrink-0">
                    <AvatarFallback className="text-xs font-medium">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none">
                      {user?.name || "-"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-1.5">
                      {user?.email || "-"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {user?.role === 'headquarters' && (
                  <DropdownMenuItem
                    onClick={() => setLocation('/headquarters')}
                    className="cursor-pointer"
                  >
                    <Building2 className="mr-2 h-4 w-4" />
                    <span>本部管理画面</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-2 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1">
                  <span className="tracking-tight text-foreground">
                    {activeMenuItem?.label ?? "Menu"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
        <main className="flex-1 p-4">{children}</main>
      </SidebarInset>
    </>
  );
}
