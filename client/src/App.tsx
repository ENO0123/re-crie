import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { StatusProvider } from "./contexts/StatusContext";
import DashboardLayout from "./components/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import BankBalance from "./pages/BankBalance";
import Income from "./pages/Income";
import Expense from "./pages/Expense";
import BillingData from "./pages/BillingData";
import CSVUpload from "./pages/CSVUpload";
import Factoring from "./pages/Factoring";
import Reports from "./pages/Reports";
import Budget from "./pages/Budget";
import Loans from "./pages/Loans";
import Login from "./pages/Login";
import Headquarters from "./pages/Headquarters";

function Router() {
  return (
    <Switch>
      {/* 本部管理画面 */}
      <Route path={"/headquarters"}>
        <DashboardLayout>
          <Headquarters />
        </DashboardLayout>
      </Route>
      
      {/* 各社アカウント用のルート（組織IDを含む） */}
      <Route path={"/:organizationId/dashboard"}>
        {(params) => (
          <DashboardLayout>
            <Dashboard organizationId={parseInt(params.organizationId, 10)} />
          </DashboardLayout>
        )}
      </Route>
      <Route path={"/:organizationId/bank-balance"}>
        {(params) => (
          <DashboardLayout>
            <BankBalance organizationId={parseInt(params.organizationId, 10)} />
          </DashboardLayout>
        )}
      </Route>
      <Route path={"/:organizationId/income"}>
        {(params) => (
          <DashboardLayout>
            <Income organizationId={parseInt(params.organizationId, 10)} />
          </DashboardLayout>
        )}
      </Route>
      <Route path={"/:organizationId/expense"}>
        {(params) => (
          <DashboardLayout>
            <Expense organizationId={parseInt(params.organizationId, 10)} />
          </DashboardLayout>
        )}
      </Route>
      <Route path={"/:organizationId/billing"}>
        {(params) => (
          <DashboardLayout>
            <BillingData organizationId={parseInt(params.organizationId, 10)} />
          </DashboardLayout>
        )}
      </Route>
      <Route path={"/:organizationId/billing/csv-upload"}>
        {(params) => (
          <DashboardLayout>
            <CSVUpload organizationId={parseInt(params.organizationId, 10)} />
          </DashboardLayout>
        )}
      </Route>
      <Route path={"/:organizationId/factoring"}>
        {(params) => (
          <DashboardLayout>
            <Factoring organizationId={parseInt(params.organizationId, 10)} />
          </DashboardLayout>
        )}
      </Route>
      <Route path={"/:organizationId/reports"}>
        {(params) => (
          <DashboardLayout>
            <Reports organizationId={parseInt(params.organizationId, 10)} />
          </DashboardLayout>
        )}
      </Route>
      <Route path={"/:organizationId/budget"}>
        {(params) => (
          <DashboardLayout>
            <Budget organizationId={parseInt(params.organizationId, 10)} />
          </DashboardLayout>
        )}
      </Route>
      <Route path={"/:organizationId/loans"}>
        {(params) => (
          <DashboardLayout>
            <Loans organizationId={parseInt(params.organizationId, 10)} />
          </DashboardLayout>
        )}
      </Route>
      
      {/* 後方互換性のため、既存のルートも残す（各社アカウント用） */}
      <Route path={"/"}>
        <DashboardLayout>
          <Dashboard />
        </DashboardLayout>
      </Route>
      <Route path={"/bank-balance"}>
        <DashboardLayout>
          <BankBalance />
        </DashboardLayout>
      </Route>
      <Route path={"/income"}>
        <DashboardLayout>
          <Income />
        </DashboardLayout>
      </Route>
      <Route path={"/expense"}>
        <DashboardLayout>
          <Expense />
        </DashboardLayout>
      </Route>
      <Route path={"/billing"}>
        <DashboardLayout>
          <BillingData />
        </DashboardLayout>
      </Route>
      <Route path={"/billing/csv-upload"}>
        <DashboardLayout>
          <CSVUpload />
        </DashboardLayout>
      </Route>
      <Route path={"/factoring"}>
        <DashboardLayout>
          <Factoring />
        </DashboardLayout>
      </Route>
      <Route path={"/reports"}>
        <DashboardLayout>
          <Reports />
        </DashboardLayout>
      </Route>
      <Route path={"/budget"}>
        <DashboardLayout>
          <Budget />
        </DashboardLayout>
      </Route>
      <Route path={"/loans"}>
        <DashboardLayout>
          <Loans />
        </DashboardLayout>
      </Route>
      
      <Route path={"/login"} component={Login} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <StatusProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </StatusProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
