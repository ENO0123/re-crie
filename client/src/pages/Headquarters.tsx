import { trpc } from "@/lib/trpc";
import { isMockupMode, getMockupQueryOptions } from "@/lib/mockup";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Building2, LayoutDashboard, Wallet, TrendingUp, TrendingDown, Target, FileText } from "lucide-react";
import { useLocation } from "wouter";

const quickLinks = [
  { icon: LayoutDashboard, label: "ダッシュボード", path: "/dashboard" },
  { icon: Wallet, label: "口座残高登録", path: "/bank-balance" },
  { icon: TrendingUp, label: "入金実績登録", path: "/income" },
  { icon: TrendingDown, label: "支出実績登録", path: "/expense" },
  { icon: Target, label: "予算入力", path: "/budget" },
  { icon: FileText, label: "実績・見込・予測詳細確認", path: "/reports" },
];

const mockOrganizations = [
  { id: 1, name: "サンプル事業所A", createdAt: new Date(), updatedAt: new Date() },
  { id: 2, name: "サンプル事業所B", createdAt: new Date(), updatedAt: new Date() },
];

export default function Headquarters() {
  const [, setLocation] = useLocation();
  const { data: organizations, isLoading } = trpc.organization.list.useQuery(
    undefined,
    getMockupQueryOptions(mockOrganizations),
  );

  if (!isMockupMode && isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">本部管理画面</h1>
        <p className="text-muted-foreground">
          各法人を選択し、各機能へアクセスできます
        </p>
      </div>

      {organizations && organizations.length > 0 ? (
        <div className="space-y-6">
          {organizations.map((org) => (
            <Card key={org.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-primary" />
                  <CardTitle>{org.name}</CardTitle>
                </div>
                <CardDescription>組織ID: {org.id}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                  {quickLinks.map((link) => (
                    <Button
                      key={link.path}
                      variant="outline"
                      className="flex flex-col h-auto py-3 gap-1.5 text-xs"
                      onClick={() => setLocation(`/${org.id}${link.path}`)}
                    >
                      <link.icon className="w-4 h-4" />
                      <span className="text-center leading-tight">{link.label}</span>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            組織が登録されていません
          </CardContent>
        </Card>
      )}
    </div>
  );
}
