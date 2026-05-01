import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Protected } from "@/components/Protected";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { endpoints, type Invoice } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/invoices/")({
  component: () => (
    <Protected>
      <InvoicesPage />
    </Protected>
  ),
});

function InvoicesPage() {
  const [list, setList] = useState<Invoice[]>([]);
  const load = () => endpoints.listInvoices().then(setList).catch(() => setList([]));
  useEffect(() => { load(); }, []);

  const toggleStatus = async (inv: Invoice) => {
    const next = inv.status === "PAID" ? "PENDING" : "PAID";
    await endpoints.setInvoiceStatus(inv.invoiceId, next);
    toast.success(`Marked as ${next}`);
    load();
  };

  return (
    <>
      <PageHeader
        title="Invoices"
        actions={<Link to="/invoices/new"><Button>New Invoice</Button></Link>}
      />
      <Card>
        <CardContent className="p-0">
          {list.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6">No invoices yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b bg-muted">
                    <th className="py-3 px-4">Invoice #</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Total</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {[...list].reverse().map((i) => (
                    <tr key={i.invoiceId} className="border-b last:border-0">
                      <td className="py-2 px-4">{i.invoiceNumber}</td>
                      <td className="py-2 px-4">{i.date}</td>
                      <td className="py-2 px-4">{i.customerName}</td>
                      <td className="py-2 px-4">₹{i.total.toLocaleString("en-IN")}</td>
                      <td className="py-2 px-4">
                        <span className={i.status === "PAID" ? "text-green-600" : "text-amber-600"}>{i.status}</span>
                      </td>
                      <td className="py-2 px-4 text-right space-x-2">
                        <Button size="sm" variant="outline" onClick={() => toggleStatus(i)}>
                          Mark {i.status === "PAID" ? "Pending" : "Paid"}
                        </Button>
                        <Link to="/invoices/$id" params={{ id: i.invoiceId }}>
                          <Button size="sm">View</Button>
                        </Link>
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
