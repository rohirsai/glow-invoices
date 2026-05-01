import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Protected } from "@/components/Protected";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { endpoints, type Customer } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/customers")({
  component: () => (
    <Protected>
      <CustomersPage />
    </Protected>
  ),
});

const empty: Partial<Customer> = { name: "", address: "", gstin: "" };

function CustomersPage() {
  const [list, setList] = useState<Customer[]>([]);
  const [form, setForm] = useState<Partial<Customer>>(empty);

  const load = () => endpoints.listCustomers().then(setList).catch(() => setList([]));
  useEffect(() => { load(); }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) { toast.error("Name required"); return; }
    await endpoints.saveCustomer(form);
    toast.success("Customer saved");
    setForm(empty);
    load();
  };

  return (
    <>
      <PageHeader title="Customer Master" />
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>{form.customerId ? "Edit Customer" : "Add Customer"}</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={save} className="space-y-3">
              <div><Label>Name</Label><Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>GSTIN</Label><Input value={form.gstin || ""} onChange={(e) => setForm({ ...form, gstin: e.target.value })} /></div>
              <div><Label>Address</Label><Textarea rows={3} value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
              <div className="flex gap-2">
                <Button type="submit">Save</Button>
                {form.customerId && <Button type="button" variant="outline" onClick={() => setForm(empty)}>Cancel</Button>}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Saved Customers</CardTitle></CardHeader>
          <CardContent>
            {list.length === 0 ? (
              <p className="text-sm text-muted-foreground">No customers yet.</p>
            ) : (
              <ul className="space-y-2">
                {list.map((c) => (
                  <li key={c.customerId} className="border rounded p-3 flex justify-between items-start">
                    <div>
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{c.gstin}</div>
                      <div className="text-xs text-muted-foreground whitespace-pre-line">{c.address}</div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setForm(c)}>Edit</Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
