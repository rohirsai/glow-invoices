import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Protected } from "@/components/Protected";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { endpoints, type Invoice } from "@/lib/api";
import { loadSampleData } from "@/lib/sampleData";
import { FileText, CheckCircle2, Clock, IndianRupee, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard")({
  component: () => (
    <Protected>
      <Dashboard />
    </Protected>
  ),
});

function Dashboard() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loadingSample, setLoadingSample] = useState(false);
  const refresh = () => endpoints.listInvoices().then(setInvoices).catch(() => setInvoices([]));
  useEffect(() => {
    refresh();
  }, []);

  const seedSample = async () => {
    setLoadingSample(true);
    try {
      await loadSampleData();
      toast.success("Sample invoice loaded (APOY/56/25-26)");
      await refresh();
    } catch {
      toast.error("Failed to load sample data");
    } finally {
      setLoadingSample(false);
    }
  };

  const total = invoices.length;
  const paid = invoices.filter((i) => i.status === "PAID").length;
  const pending = total - paid;
  const totalAmount = invoices.reduce((s, i) => s + (i.total || 0), 0);
  const outstandingAmount = invoices
    .filter((i) => i.status === "PENDING")
    .reduce((s, i) => s + (i.total || 0), 0);

  const cards = [
    { label: "Total Invoices", value: total, icon: FileText },
    { label: "Paid", value: paid, icon: CheckCircle2 },
    { label: "Pending", value: pending, icon: Clock },
    { label: "Total Amount (₹)", value: totalAmount.toLocaleString("en-IN", { maximumFractionDigits: 2 }), icon: IndianRupee },
  ];

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Overview of your billing activity"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={seedSample} disabled={loadingSample}>
              <Sparkles className="h-4 w-4 mr-1" />
              {loadingSample ? "Loading..." : "Load Sample Data"}
            </Button>
            <Link to="/invoices/new">
              <Button>New Invoice</Button>
            </Link>
          </div>
        }
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.label}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{c.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">No invoices yet. Create your first one.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2">Invoice #</th>
                    <th className="py-2">Date</th>
                    <th className="py-2">Customer</th>
                    <th className="py-2">Total</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.slice(-10).reverse().map((i) => (
                    <tr key={i.invoiceId} className="border-b last:border-0">
                      <td className="py-2">
                        <Link to="/invoices/$id" params={{ id: i.invoiceId }} className="text-primary hover:underline">
                          {i.invoiceNumber}
                        </Link>
                      </td>
                      <td className="py-2">{i.date}</td>
                      <td className="py-2">{i.customerName || i.customerId}</td>
                      <td className="py-2">₹{i.total.toLocaleString("en-IN")}</td>
                      <td className="py-2">
                        <span className={i.status === "PAID" ? "text-green-600" : "text-amber-600"}>{i.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {invoices.filter((i) => i.status === "PENDING").length > 0 && (
        <Card className="mt-6 border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-amber-900 dark:text-amber-100">Outstanding Bills</CardTitle>
              <div className="text-right">
                <p className="text-2xl font-bold text-amber-900 dark:text-amber-100">
                  ₹{outstandingAmount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300">{invoices.filter((i) => i.status === "PENDING").length} pending</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2">Invoice #</th>
                    <th className="py-2">Customer</th>
                    <th className="py-2">Amount</th>
                    <th className="py-2">Invoice Date</th>
                    <th className="py-2">Due Date</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices
                    .filter((i) => i.status === "PENDING")
                    .sort((a, b) => new Date(b.date || "").getTime() - new Date(a.date || "").getTime())
                    .map((i) => (
                      <tr key={i.invoiceId} className="border-b last:border-0">
                        <td className="py-2">
                          <Link to="/invoices/$id" params={{ id: i.invoiceId }} className="text-primary hover:underline font-mono text-xs">
                            {i.invoiceNumber}
                          </Link>
                        </td>
                        <td className="py-2">{i.customerName || i.customerId}</td>
                        <td className="py-2 font-semibold">₹{i.total.toLocaleString("en-IN")}</td>
                        <td className="py-2">{i.date}</td>
                        <td className="py-2">{i.dueDate || "—"}</td>
                        <td className="py-2 text-right">
                          <Link to="/invoices/$id" params={{ id: i.invoiceId }}>
                            <Button size="sm" variant="outline" className="text-xs">View</Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
