"use client";

import { useState } from "react";

import { Modal } from "@/components/Modal";
import { apiPatch, ApiError } from "@/components/lib/api";

interface ProfileSettingsModalProps {
  email: string;
  onClose: () => void;
  /** Called after a successful save so the parent can show a toast. */
  onSaved: (name: string) => void;
}

/**
 * Edit the signed-in user's name + phone via `PATCH /api/users/me`.
 * The endpoint accepts `{ name?, phone? }` (null clears a field).
 */
export function ProfileSettingsModal({
  email,
  onClose,
  onSaved,
}: ProfileSettingsModalProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Phone is optional here, but if provided it must be 8 digits (HK).
  const phoneValid = phone === "" || /^\d{8}$/.test(phone);
  const canSave = phoneValid && !saving && (name.trim() !== "" || phone !== "");

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await apiPatch<{ user: unknown }>("/api/users/me", {
        name: name.trim() || null,
        phone: phone.trim() || null,
      });
      onSaved(name.trim());
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "儲存失敗，請重試。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="個人資料" maxWidth="max-w-md">
      <div className="flex flex-col gap-4">
        <div className="rounded-xl bg-[#FFCB56]/40 px-4 py-3 text-sm text-[#4A3B32]">
          登入電郵：<strong>{email}</strong>
        </div>

        <div>
          <label
            htmlFor="profile-name"
            className="mb-2 block text-sm font-medium text-[#4A3B32]"
          >
            姓名
          </label>
          <input
            id="profile-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如：陳小明"
            className={inputClass}
          />
        </div>

        <div>
          <label
            htmlFor="profile-phone"
            className="mb-2 block text-sm font-medium text-[#4A3B32]"
          >
            聯絡電話
          </label>
          <input
            id="profile-phone"
            type="tel"
            inputMode="numeric"
            maxLength={8}
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
            placeholder="8 位數字"
            className={inputClass}
          />
          {!phoneValid && (
            <p role="alert" className="mt-1 text-xs text-red-700">
              請輸入 8 位數字電話號碼。
            </p>
          )}
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!canSave}
            className="rounded-xl bg-[#FFA259] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#ff8f3d] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "儲存中⋯" : "儲存"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#4A3B32] ring-1 ring-black/10 hover:bg-black/5 disabled:opacity-50"
          >
            關閉
          </button>
        </div>
      </div>
    </Modal>
  );
}

const inputClass =
  "w-full rounded-xl border border-black/10 bg-[#FFF8E1] px-4 py-3 text-[#4A3B32] outline-none placeholder:text-[#4A3B32]/40 focus:border-[#FFA259] focus:ring-2 focus:ring-[#FFA259]/30";
