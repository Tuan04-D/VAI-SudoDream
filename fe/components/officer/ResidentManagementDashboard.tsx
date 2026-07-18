"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  IconArrowLeft,
  IconBuildingCommunity,
  IconMapPin,
  IconPhone,
  IconRefresh,
  IconUsers,
} from "@tabler/icons-react";
import { fetchOfficerResidents } from "@/lib/api";
import { useRole } from "@/lib/RoleProvider";
import type { Commune, Resident } from "@/lib/types";

export default function ResidentManagementDashboard({ communes }: { communes: Commune[] }) {
  const { official, loading: roleLoading } = useRole();
  const [residents, setResidents] = useState<Resident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const assignedCommune = communes.find((commune) => commune.id === official?.commune_id);

  function loadResidents() {
    if (!official) return;
    setLoading(true);
    setError(false);
    fetchOfficerResidents(official.id)
      .then(setResidents)
      .catch(() => {
        setResidents([]);
        setError(true);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!official) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(false);
    fetchOfficerResidents(official.id)
      .then((items) => {
        if (!cancelled) setResidents(items);
      })
      .catch(() => {
        if (!cancelled) {
          setResidents([]);
          setError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [official]);

  if (roleLoading) {
    return <div className="skeleton mx-auto mt-8 h-[420px] max-w-6xl rounded-2xl" />;
  }

  if (!official) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-5 text-center">
        <IconBuildingCommunity className="h-12 w-12 text-[#6f83a3]" stroke={1.5} />
        <h1 className="mt-4 text-xl font-bold text-[#173363]">Cần đăng nhập cán bộ xã</h1>
        <p className="mt-2 text-sm leading-6 text-[#71809a]">Đăng nhập để xem danh sách người dân thuộc địa bàn quản lý.</p>
        <Link href="/quan-ly" className="mt-5 rounded-xl bg-[#1769e0] px-5 py-3 text-sm font-bold text-white">
          Đến trang đăng nhập
        </Link>
      </main>
    );
  }

  if (!assignedCommune) {
    return <div className="mx-auto mt-8 max-w-xl rounded-xl border border-[#ead9cc] bg-[#fff8f2] p-5 text-sm text-[#704326]">Không tìm thấy xã quản lý của tài khoản này.</div>;
  }

  return (
    <main className="min-h-screen bg-[#f7f9fc] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-7xl">
        <Link href="/quan-ly" className="inline-flex items-center gap-2 text-sm font-semibold text-[#536986] transition hover:text-[#1769e0]">
          <IconArrowLeft className="h-4 w-4" stroke={1.8} /> Về bảng điều khiển
        </Link>

        <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-[-0.03em] text-[#173363] sm:text-3xl">Quản lý người đăng ký cảnh báo</h1>
            <p className="mt-2 text-sm text-[#71809a]">Danh sách này chỉ gồm người dân đã đăng ký tại {assignedCommune.name}.</p>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-xl border border-[#dbe5f2] bg-white px-4 py-2.5 text-sm font-semibold text-[#29466f] shadow-sm">
            <IconMapPin className="h-4 w-4 text-[#3977cf]" stroke={1.8} /> {assignedCommune.name}, Điện Biên
          </div>
        </div>

        <section className="officer-panel mt-6 p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#edf4ff] text-[#1769e0]">
                <IconUsers className="h-5 w-5" stroke={1.8} />
              </span>
              <div>
                <h2 className="text-base font-bold text-[#173363]">Người dân đã đăng ký</h2>
                <p className="text-[11px] text-[#70809a]">Số điện thoại và nơi nhận cảnh báo</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-[#eaf7ef] px-3 py-1.5 text-xs font-bold text-[#267a50]">
                {loading ? "Đang tải..." : `${residents.length} người`}
              </span>
              <button
                type="button"
                onClick={loadResidents}
                disabled={loading}
                className="inline-flex h-9 items-center gap-2 rounded-xl border border-[#dce5f1] px-3 text-xs font-semibold text-[#476181] transition hover:bg-[#f5f8fd] disabled:opacity-60"
              >
                <IconRefresh className="h-4 w-4" stroke={1.8} /> Làm mới
              </button>
            </div>
          </div>

          {error ? (
            <p role="alert" className="mt-5 rounded-xl bg-[#fff3f3] px-4 py-3 text-sm font-medium text-[#a33f3f]">
              Chưa tải được danh sách đăng ký. Vui lòng thử lại.
            </p>
          ) : loading ? (
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2].map((item) => <div key={item} className="skeleton h-28 rounded-xl" />)}
            </div>
          ) : residents.length === 0 ? (
            <div className="mt-5 rounded-xl border border-dashed border-[#dbe3ee] bg-[#fafbfd] px-5 py-12 text-center">
              <p className="text-sm font-semibold text-[#536986]">Chưa có người dân đăng ký tại xã này.</p>
              <p className="mt-1 text-xs text-[#8190a4]">Danh sách sẽ xuất hiện khi người dân gửi số điện thoại và nơi ở.</p>
            </div>
          ) : (
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {residents.map((resident) => (
                <article key={resident.id} className="rounded-xl border border-[#e2e8f1] bg-[#fbfcfe] p-4">
                  <p className="flex items-center gap-2 font-data text-sm font-bold text-[#203b67]">
                    <IconPhone className="h-4 w-4 text-[#3977cf]" stroke={1.8} /> {resident.phone}
                  </p>
                  <p className="mt-2 flex items-start gap-2 text-sm leading-5 text-[#536986]">
                    <IconMapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#6d83a2]" stroke={1.8} />
                    <span>{resident.address || assignedCommune.name}</span>
                  </p>
                  <p className="mt-3 text-[10px] text-[#8794a7]">
                    Đăng ký ngày {new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(resident.created_at))}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
