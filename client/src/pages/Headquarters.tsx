import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Building2, ExternalLink } from "lucide-react";
import { useLocation } from "wouter";

export default function Headquarters() {
  const [, setLocation] = useLocation();
  const { data: organizations, isLoading } = trpc.organization.list.useQuery();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleOrganizationClick = (organizationId: number) => {
    // 組織IDを含むURLでダッシュボードに遷移
    setLocation(`/${organizationId}/dashboard`);
  };

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">本部管理画面</h1>
        <p className="text-muted-foreground">
          各法人のアカウントへアクセスできます
        </p>
      </div>

      {organizations && organizations.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {organizations.map((org) => (
            <Card key={org.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-primary" />
                  <CardTitle>{org.name}</CardTitle>
                </div>
                <CardDescription>
                  組織ID: {org.id}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => handleOrganizationClick(org.id)}
                  className="w-full"
                  variant="default"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  この組織のダッシュボードを開く
                </Button>
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
