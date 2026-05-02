import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Protected } from "@/components/Protected";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { endpoints, type TeamUser } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/users")({
  component: () => (
    <Protected>
      <UsersPage />
    </Protected>
  ),
});

const empty: Partial<TeamUser> = {
  name: "",
  email: "",
  role: "Staff",
  phone: "",
  active: true,
};

function UsersPage() {
  const [list, setList] = useState<TeamUser[]>([]);
  const [form, setForm] = useState<Partial<TeamUser>>(empty);

  const load = () =>
    endpoints.listUsers().then(setList).catch(() => setList([]));
  useEffect(() => {
    load();
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email) {
      toast.error("Name and email are required");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(form.email)) {
      toast.error("Invalid email");
      return;
    }
    await endpoints.saveUser(form);
    toast.success("User saved");
    setForm(empty);
    load();
  };

  const remove = async (id: string) => {
    await endpoints.deleteUser(id);
    toast.success("User removed");
    load();
  };

  return (
    <>
      <PageHeader title="Users" subtitle="Manage team members" />
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{form.userId ? "Edit User" : "Add User"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={save} className="space-y-3">
              <div>
                <Label>Name</Label>
                <Input
                  value={form.name || ""}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email || ""}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  value={form.phone || ""}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div>
                <Label>Role</Label>
                <Select
                  value={form.role || "Staff"}
                  onValueChange={(v) =>
                    setForm({ ...form, role: v as TeamUser["role"] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Admin">Admin</SelectItem>
                    <SelectItem value="Manager">Manager</SelectItem>
                    <SelectItem value="Staff">Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 pt-1">
                <Button type="submit">Save</Button>
                {form.userId && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setForm(empty)}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Team</CardTitle>
          </CardHeader>
          <CardContent>
            {list.length === 0 ? (
              <p className="text-sm text-muted-foreground">No users yet.</p>
            ) : (
              <ul className="space-y-2">
                {list.map((u) => (
                  <li
                    key={u.userId}
                    className="border rounded p-3 flex justify-between items-start gap-3"
                  >
                    <div className="min-w-0">
                      <div className="font-medium flex items-center gap-2">
                        {u.name}
                        <Badge variant="secondary">{u.role}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {u.email}
                      </div>
                      {u.phone && (
                        <div className="text-xs text-muted-foreground">
                          {u.phone}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setForm(u)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => remove(u.userId)}
                      >
                        Remove
                      </Button>
                    </div>
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
