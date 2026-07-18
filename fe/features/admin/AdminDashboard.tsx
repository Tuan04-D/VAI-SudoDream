"use client";

import { useEffect, useState } from "react";
import {
  createAdminUser,
  deleteAdminUser,
  listAdminUsers,
  loginAdmin,
  updateAdminUser,
} from "@/features/auth/api";
import { useAuth } from "@/features/auth/AuthProvider";
import type { AuthUser, Commune } from "@/lib/types";


const ROLE_LABEL = { resident: "Người dân", official: "Cán bộ", admin: "Quản trị" } as const;


export default function AdminDashboard({ communes }: { communes: Commune[] }) {
  const { admin, loading, setAdmin, logout } = useAuth();
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!admin) return;
    let cancelled = false;
    listAdminUsers()
      .then((items) => { if (!cancelled) setUsers(items); })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Không tải được người dùng");
      });
    return () => { cancelled = true; };
  }, [admin]);

  if (loading) return <div className="skeleton mx-auto mt-10 h-64 max-w-5xl rounded-lg" />;
  if (!admin) return <AdminLogin onDone={setAdmin} />;

  async function toggleStatus(user: AuthUser) {
    setError(null);
    try {
      const updated = await updateAdminUser(user.id, {
        status: user.status === "active" ? "suspended" : "active",
      });
      setUsers((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không cập nhật được tài khoản");
    }
  }

  async function changeRole(user: AuthUser, role: AuthUser["role"]) {
    setError(null);
    try {
      const updated = await updateAdminUser(user.id, {
        role,
        commune_id: role === "admin" ? null : user.commune_id ?? communes[0]?.id,
      });
      setUsers((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không đổi được vai trò");
    }
  }

  async function removeUser(user: AuthUser) {
    if (!window.confirm(`Xóa tài khoản ${user.display_name}?`)) return;
    setError(null);
    try {
      await deleteAdminUser(user.id);
      setUsers((current) => current.filter((item) => item.id !== user.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không xóa được tài khoản");
    }
  }

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 lg:px-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Quản trị người dùng</h1>
          <p className="text-sm text-ink-muted">Tạo cán bộ, phân vai và khóa tài khoản.</p>
        </div>
        <button onClick={() => void logout()} className="rounded-md border border-border px-4 py-2 text-sm">
          Đăng xuất
        </button>
      </header>

      <CreateUserForm
        communes={communes}
        busy={busy}
        onCreate={async (input) => {
          setBusy(true);
          setError(null);
          try {
            const created = await createAdminUser(input);
            setUsers((current) => [created, ...current]);
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Không tạo được tài khoản");
          } finally {
            setBusy(false);
          }
        }}
      />

      {error && <p className="rounded-md bg-risk-3/10 p-3 text-sm text-risk-3">{error}</p>}

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-border bg-surface-muted text-xs uppercase text-ink-muted">
            <tr><th className="p-3">Người dùng</th><th>Vai trò</th><th>Xã</th><th>Trạng thái</th><th className="p-3 text-right">Thao tác</th></tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-border last:border-0">
                <td className="p-3"><p className="font-semibold">{user.display_name}</p><p className="font-data text-xs text-ink-muted">{user.phone}</p></td>
                <td>
                  <select
                    aria-label={`Vai trò của ${user.display_name}`}
                    value={user.role}
                    disabled={user.id === admin.id}
                    onChange={(event) => void changeRole(user, event.target.value as AuthUser["role"])}
                    className="rounded border border-border bg-surface px-2 py-1 disabled:border-0"
                  >
                    <option value="resident">{ROLE_LABEL.resident}</option>
                    <option value="official">{ROLE_LABEL.official}</option>
                    <option value="admin">{ROLE_LABEL.admin}</option>
                  </select>
                </td>
                <td>{user.commune_id ? communes.find((item) => item.id === user.commune_id)?.name ?? user.commune_id : "—"}</td>
                <td><span className={user.status === "active" ? "text-risk-0" : "text-risk-3"}>{user.status === "active" ? "Hoạt động" : "Đã khóa"}</span></td>
                <td className="p-3 text-right">
                  <button disabled={user.id === admin.id} onClick={() => void toggleStatus(user)} className="mr-3 text-xs font-semibold text-primary disabled:opacity-30">
                    {user.status === "active" ? "Khóa" : "Mở"}
                  </button>
                  <button disabled={user.id === admin.id} onClick={() => void removeUser(user)} className="text-xs font-semibold text-risk-3 disabled:opacity-30">Xóa</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}


function AdminLogin({ onDone }: { onDone: (admin: Awaited<ReturnType<typeof loginAdmin>>) => void }) {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <main className="mx-auto max-w-sm px-5 py-20">
      <form className="card flex flex-col gap-3 p-5" onSubmit={async (event) => {
        event.preventDefault(); setError(null);
        try { onDone(await loginAdmin(phone, password)); }
        catch (cause) { setError(cause instanceof Error ? cause.message : "Đăng nhập thất bại"); }
      }}>
        <h1 className="font-display text-xl font-bold">Đăng nhập quản trị</h1>
        <input aria-label="Số điện thoại" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Số điện thoại" className="rounded-md border border-border px-3 py-2" required />
        <input aria-label="Mật khẩu" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mật khẩu" className="rounded-md border border-border px-3 py-2" required />
        {error && <p className="text-sm text-risk-3">{error}</p>}
        <button className="rounded-md bg-primary px-4 py-2 font-semibold text-primary-ink">Đăng nhập</button>
      </form>
    </main>
  );
}


function CreateUserForm({
  communes,
  busy,
  onCreate,
}: {
  communes: Commune[];
  busy: boolean;
  onCreate: (input: Parameters<typeof createAdminUser>[0]) => Promise<void>;
}) {
  const [role, setRole] = useState<"resident" | "official" | "admin">("official");
  return (
    <form className="card grid gap-3 p-4 md:grid-cols-3" onSubmit={async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      await onCreate({
        phone: String(form.get("phone")), password: String(form.get("password")),
        display_name: String(form.get("display_name")), role,
        commune_id: role === "admin" ? null : String(form.get("commune_id")),
        status: "active", permissions: [],
      });
      event.currentTarget.reset();
    }}>
      <h2 className="md:col-span-3 font-display text-lg font-bold">Tạo tài khoản</h2>
      <input name="display_name" placeholder="Họ tên" required className="rounded-md border border-border px-3 py-2" />
      <input name="phone" placeholder="Số điện thoại" required className="rounded-md border border-border px-3 py-2" />
      <input name="password" type="password" minLength={8} placeholder="Mật khẩu chữ + số" required className="rounded-md border border-border px-3 py-2" />
      <select value={role} onChange={(event) => setRole(event.target.value as typeof role)} className="rounded-md border border-border px-3 py-2">
        <option value="official">Cán bộ</option><option value="resident">Người dân</option><option value="admin">Quản trị</option>
      </select>
      <select name="commune_id" disabled={role === "admin"} className="rounded-md border border-border px-3 py-2">
        {communes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
      <button disabled={busy} className="rounded-md bg-primary px-4 py-2 font-semibold text-primary-ink disabled:opacity-50">{busy ? "Đang tạo..." : "Tạo tài khoản"}</button>
    </form>
  );
}
