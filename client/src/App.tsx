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

function Router() {
  return (
    <Switch>
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
