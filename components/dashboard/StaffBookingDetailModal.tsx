"use client";

import { useState } from "react";

import { Modal } from "@/components/Modal";
import { formatDateTime, formatHkd } from "@/components/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import type { BookingWithDetails } from "@/types";

interface BookingDetailModalProps {
  booking: BookingWithDetails;
  /** "owner" can verify payments; "staff" cannot. */
  mode: "owner" | "staff";
  onClose: () => void;
  /** Opens the report wizard, pre-scoped to this booking. */
  onGenerateReport: (booking: BookingWithDetails) => void;
}

/**
 * Owner/staff booking detail: customer contact, address + access method, pet
 * details and notes. Every field here comes from `GET /api/bookings`, which
 * eager-loads `pet`, `customer` and `address`.
 */
export function StaffBookingDetailModal({
  booking,
  mode,
  onClose,
  onGenerateReport,
}: BookingDetailModalProps) {
  const [showMore, setShowMore] = useState(false);
  const pet = booking.pet;
  const address = booking.address;

  return (
    <Modal open onClose={onClose} title="預約詳情" maxWidth="max-w-lg">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={booking.status} />
          <span className="text-xs text-[#4A3B32]/50">
            編號：{booking.id.slice(0, 8)}
          </span>
        </div>

        {/* Customer ------------------------------------------------------- */}
        <Section title="客戶資料">
          <Row label="姓名" value={customerName(booking)} />
          <Row label="電話" value={customerPhone(booking) || "—"} />
          <Row label="電郵" value={booking.customer?.email ?? "—"} />
        </Section>

        {/* Address -------------------------------------------------------- */}
        <Section title="服務地址">
          <Row label="地址" value={address?.fullAddress ?? "—"} />
          <Row label="進入方式及密碼" value={address?.doorCode || "—"} />
        </Section>

        {/* Pet ------------------------------------------------------------ */}
        <Section title="寵物資料">
          <Row label="名稱" value={pet?.name ?? "—"} />
          <Row label="類型" value={petTypeLabel(pet?.type)} />
          {pet?.breed && <Row label="品種" value={pet.breed} />}
          {pet?.weightKg != null && pet.weightKg !== "" && (
            <Row label="體重" value={`${pet.weightKg} kg`} />
          )}
          <Row label="疫苗接種" value={yesNo(pet?.vaccinated)} />
          <Row label="已絕育" value={yesNo(pet?.sterilized)} />
          {pet?.contagious && (
            <div
              role="alert"
              className="mt-1 rounded-r-lg border-l-4 border-yellow-500 bg-yellow-100 p-3 text-sm text-yellow-700"
            >
              ⚠️ 寵物申報有傳染病，請安排隔離及防護措施。
            </div>
          )}
          {pet?.appearance && <Row label="外觀與性格" value={pet.appearance} />}
          <Row label="注意事項" value={pet?.notes || "—"} />
        </Section>

        {/* Schedule / money ------------------------------------------------ */}
        <Section title="預約資料">
          <Row label="服務" value={booking.serviceType} />
          <Row label="開始" value={formatDateTime(booking.startTime)} />
          <Row label="結束" value={formatDateTime(booking.endTime)} />
          <Row label="費用" value={formatHkd(booking.totalHkd)} />
        </Section>

        {/* Proposal + cancellation context -------------------------------- */}
        {booking.status === "time_proposed" && booking.proposalStartTime && (
          <div className="rounded-xl bg-[#FFEDB9] px-4 py-3 text-sm text-[#4A3B32]">
            <p className="font-semibold">已建議時間</p>
            <p className="mt-1 text-xs">
              {formatDateTime(booking.proposalStartTime)} →{" "}
              {formatDateTime(booking.proposalEndTime ?? booking.endTime)}
            </p>
            {booking.proposalReason && (
              <p className="mt-1 text-xs text-[#4A3B32]/70">
                原因：{booking.proposalReason}
              </p>
            )}
          </div>
        )}

        {booking.cancellationReason && (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200">
            <p className="font-semibold">取消原因</p>
            <p className="mt-1 text-xs">{booking.cancellationReason}</p>
          </div>
        )}

        {/* Report — only for completed visits ------------------------------ */}
        {booking.status === "completed" && (
          <button
            type="button"
            onClick={() => {
              onGenerateReport(booking);
              onClose();
            }}
            className="rounded-xl bg-[#FFCB56] px-4 py-2.5 text-sm font-semibold text-[#4A3B32] hover:bg-[#ffbe3a]"
          >
            生成報告
          </button>
        )}

        {/* Extra fields (debug-ish) ---------------------------------------- */}
        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          className="self-start text-xs font-medium text-[#4A3B32]/60 underline"
        >
          {showMore ? "隱藏其他資料" : "其他資料"}
        </button>
        {showMore && (
          <dl className="rounded-xl bg-[#FFF8E1] px-4 py-2 text-xs text-[#4A3B32]/70">
            <Row label="預約 ID" value={booking.id} />
            <Row label="客戶 ID" value={booking.customer?.id ?? "—"} />
            <Row label="保姆 ID" value={booking.staffId ?? "未指派"} />
            <Row
              label="衝突標記"
              value={booking.conflictFlag ? "有" : "無"}
            />
            <Row label="順路安排" value={booking.fitInFlag ? "是" : "否"} />
            <Row
              label="付款狀態"
              value={
                mode === "owner" && booking.status === "verification_pending"
                  ? "待確認收款"
                  : yesNo(booking.status === "paid" || booking.status === "completed")
              }
            />
          </dl>
        )}
      </div>
    </Modal>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-1 text-sm font-semibold text-[#4A3B32]">{title}</h3>
      <dl className="divide-y divide-black/5 rounded-xl bg-white px-4 py-1 ring-1 ring-black/5">
        {children}
      </dl>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-3 gap-2 py-2 text-sm">
      <dt className="font-medium text-[#4A3B32]/70">{label}</dt>
      <dd className="col-span-2 break-words text-[#4A3B32]">{value}</dd>
    </div>
  );
}

function customerName(b: BookingWithDetails): string {
  return b.customer?.name ?? b.guestName ?? b.customer?.email ?? "—";
}

function customerPhone(b: BookingWithDetails): string | null {
  return b.customer?.phone ?? b.guestPhone ?? null;
}

function petTypeLabel(type: string | undefined): string {
  switch (type) {
    case "dog":
      return "狗狗";
    case "cat":
      return "貓貓";
    case "other":
      return "其他";
    default:
      return "—";
  }
}

function yesNo(value: boolean | null | undefined): string {
  if (value === true) return "是";
  if (value === false) return "否";
  return "—";
}
