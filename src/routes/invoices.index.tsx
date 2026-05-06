import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useData } from "@/lib/store";
import { formatINR } from "@/lib/fx";
import { FilePlus2, Eye, Trash2 } from "lucide-react";
import { toast } from "sonner";

// Format date as "07-Feb-26"
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
  head: () => ({ meta: [{ title: "Invoices — Apoyphe" }] }),
  component: InvoicesList,
});

function InvoicesList() {
  const invoices = useData((s: any) => s.invoices);
  const customers = useData((s: any) => s.customers);
  const setStatus = useData((s: any) => s.setInvoiceStatus);
  const deleteInvoice = useData((s: any) => s.deleteInvoice);
  const [filter, setFilter] = useState<"all" | "PAID" | "PENDING">("all");
  const [statusLoading, setStatusLoading] = useState<string | null>(null);

  const filtered = invoices.filter((i: any) => filter === "all" || i.status === filter);
  const cust = (id: string) => customers.find((c: any) => c.id === id)?.name || "—";

  const handleStatusChange = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "PAID" ? "PENDING" : "PAID";
    setStatusLoading(id);
    try {
      await setStatus(id, newStatus);
      toast.success(`Invoice status updated to ${newStatus}`);
    } catch (err) {
      toast.error("Failed to update status");
      console.error(err);
    } finally {
      setStatusLoading(null);
    }
  };

  return (
    <AppShell>
      <div className="px-8 py-6">
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
          <Link to="/invoices/new"><Button className="bg-gradient-to-r from-primary to-primary-glow"><FilePlus2 className="h-4 w-4 mr-2" />New Invoice</Button></Link>
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No invoices.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice No.</TableHead><TableHead>Customer</TableHead>
                <TableHead>Amount</TableHead><TableHead>Invoice Date</TableHead>
                <TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((i: any) => (
                <TableRow key={i.id}>
                  <TableCell className="font-mono text-sm">{i.invoiceNumber}</TableCell>
                  <TableCell className="font-medium">{cust(i.customerId)}</TableCell>
                  <TableCell>{formatINR(i.total)}</TableCell>
                  <TableCell>{fmtDate(i.invoiceDate)}</TableCell>
                  <TableCell>
                    <button
                      onClick={() => handleStatusChange(i.id, i.status)}
                      disabled={statusLoading === i.id}
                      className={`text-xs px-2.5 py-1 rounded-full font-medium transition ${i.status === "PAID" ? "bg-success/15 text-success hover:bg-success/25" : "bg-warning/15 text-warning hover:bg-warning/25"} ${statusLoading === i.id ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      {statusLoading === i.id ? "Updating..." : i.status}
                    </button>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Link to="/invoices/$id" params={{ id: i.id }}>
                        <Button size="sm" variant="ghost"><Eye className="h-4 w-4" /></Button>
                      </Link>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete invoice {i.invoiceNumber}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently remove the invoice. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => {
                                deleteInvoice(i.id);
                                toast.success(`Invoice ${i.invoiceNumber} deleted`);
                              }}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
      </div>
    </AppShell>
  );
}
