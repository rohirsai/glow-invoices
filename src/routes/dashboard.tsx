import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Protected } from "@/components/Protected";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { endpoints, type Invoice } from "@/lib/api";
import { FileText, CheckCircle2, Clock, IndianRupee } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  component: () => (
    <Protected>
      <Dashboard />
    </Protected>
  ),
});

function Dashboard() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  useEffect(() => {
    endpoints.listInvoices().then(setInvoices).catch(() => setInvoices([]));
  }, []);

  const total = invoices.length;
  const paid = invoices.filter((i) => i.status === "PAID").length;
  const pending = total - paid;
  const totalAmount = invoices.reduce((s, i) => s + (i.total || 0), 0);

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
          <Link to="/invoices/new">
            <Button>New Invoice</Button>
          </Link>
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
    </>
  );
}
