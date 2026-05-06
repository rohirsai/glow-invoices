import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Protected } from "@/components/Protected";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { endpoints, type Invoice } from "@/lib/api";
import { formatINR } from "@/lib/seller";
import { FilePlus2, Eye } from "lucide-react";
import { toast } from "sonner";

const fmtDate = (iso: string | undefined) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const day = String(d.getDate()).padStart(2, "0");
  const mon = d.toLocaleString("en-US", { month: "short" });
  const yr = String(d.getFullYear()).slice(-2);
  return `${day}-${mon}-${yr}`;
};

export const Route = createFileRoute("/invoices/")({
  component: () => (
    <Protected>
      <InvoicesList />
    </Protected>
  ),
});

function InvoicesList() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filter, setFilter] = useState<"all" | "PAID" | "PENDING">("all");
  const [statusLoading, setStatusLoading] = useState<string | null>(null);

  const load = () => endpoints.listInvoices().then(setInvoices).catch(() => setInvoices([]));
  useEffect(() => { load(); }, []);

  const filtered = invoices.filter((i) => filter === "all" || i.status === filter);

  const toggleStatus = async (inv: Invoice) => {
    const next = inv.status === "PAID" ? "PENDING" : "PAID";
    setStatusLoading(inv.invoiceId);
    try {
      await endpoints.setInvoiceStatus(inv.invoiceId, next);
      toast.success(`Marked as ${next}`);
      load();
    } catch {
      toast.error("Failed to update status");
    } finally {
      setStatusLoading(null);
    }
  };

  return (
    <>
      <h1 className="text-3xl font-bold mb-6">Invoices</h1>
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as "all" | "PAID" | "PENDING")}>
            <TabsList>
              <TabsTrigger value="all">All ({invoices.length})</TabsTrigger>
              <TabsTrigger value="PAID">Paid</TabsTrigger>
              <TabsTrigger value="PENDING">Pending</TabsTrigger>
            </TabsList>
          </Tabs>
          <Link to="/invoices/new">
            <Button className="bg-gradient-to-r from-primary to-primary-glow">
              <FilePlus2 className="h-4 w-4 mr-2" />New Invoice
            </Button>
          </Link>
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No invoices.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice No.</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Invoice Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((i) => (
                <TableRow key={i.invoiceId}>
                  <TableCell className="font-mono text-sm">{i.invoiceNumber}</TableCell>
                  <TableCell className="font-medium">{i.customerName || i.customerId}</TableCell>
                  <TableCell>{formatINR(i.total)}</TableCell>
                  <TableCell>{fmtDate(i.date)}</TableCell>
                  <TableCell>
                    <button
                      onClick={() => toggleStatus(i)}
                      disabled={statusLoading === i.invoiceId}
                      className={`text-xs px-2.5 py-1 rounded-full font-medium transition ${
                        i.status === "PAID"
                          ? "bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 dark:text-emerald-400"
                          : "bg-amber-500/15 text-amber-700 hover:bg-amber-500/25 dark:text-amber-400"
                      } ${statusLoading === i.invoiceId ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      {statusLoading === i.invoiceId ? "Updating..." : i.status}
                    </button>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link to="/invoices/$id" params={{ id: i.invoiceId }}>
                      <Button size="sm" variant="ghost"><Eye className="h-4 w-4" /></Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </>
  );
}
