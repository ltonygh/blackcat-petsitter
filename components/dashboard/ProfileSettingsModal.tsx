"use client";

import { useEffect, useState } from "react";

import { Modal } from "@/components/Modal";
import { apiGet, apiPatch, ApiError } from "@/components/lib/api";

/* ───────────────────────────── API shapes ───────────────────────────── */

interface MeResponse {
  user: { id: string; name: string | null; phone: string | null; email: string };
}

/** Detailed address fields stored on the user's address row. */
interface DetailedAddress {
  id: string;
  /** Optional friendly label; present when the API returns it. */
  label?: string | null;
  estatePassword: string | null;
  keycardInfo: string | null;
  foodAmount: string | null;
  foodLocation: string | null;
  waterLocation: string | null;
  toolsLocation: string | null;
  toysLocation: string | null;
  trashLocation: string | null;
  emergencyContact: string | null;
  primaryVet: string | null;
  backupVet: string | null;
  otherNotes: string | null;
}

interface DetailedPet {
  id: string;
  name: string;
  type: string;
  age: number | null;
  gender: string | null;
  habits: string | null;
}

interface ProfileResponse {
  profile: {
    /** All of the user's addresses (most-recent-first). */
    addresses: DetailedAddress[];
    /** Back-compat alias for the first address. */
    address: DetailedAddress | null;
    pets: DetailedPet[];
  };
}

/** Editable address fields — everything except the row id and its label. */
type TextField = Exclude<keyof DetailedAddress, "id" | "label">;

/** Address fields rendered as textareas (longer free-text answers). */
const MULTILINE: ReadonlySet<TextField> = new Set<TextField>([
  "emergencyContact",
  "otherNotes",
]);

const ADDRESS_FIELD_LABELS: { key: TextField; label: string; hint?: string }[] =
  [
    { key: "estatePassword", label: "屋苑密碼 / Estate password" },
    { key: "keycardInfo", label: "門卡 / Keycard" },
    { key: "foodAmount", label: "糧食份量 / Food amount", hint: "例如：每餐 1 杯" },
    { key: "foodLocation", label: "糧食位置 / Food location" },
    { key: "waterLocation", label: "飲水位置 / Water location" },
    { key: "toolsLocation", label: "清潔用品位置 / Tools location" },
    { key: "toysLocation", label: "玩具位置 / Toys location" },
    { key: "trashLocation", label: "垃圾位置 / Trash location" },
    { key: "emergencyContact", label: "緊急聯絡人 / Emergency contact" },
    { key: "primaryVet", label: "主要獸醫 / Primary vet" },
    { key: "backupVet", label: "後備獸醫 / Backup vet" },
    { key: "otherNotes", label: "其他備註 / Other notes" },
  ];

type AddressForm = Record<TextField, string>;

const EMPTY_ADDRESS: AddressForm = {
  estatePassword: "",
  keycardInfo: "",
  foodAmount: "",
  foodLocation: "",
  waterLocation: "",
  toolsLocation: "",
  toysLocation: "",
  trashLocation: "",
  emergencyContact: "",
  primaryVet: "",
  backupVet: "",
  otherNotes: "",
};

/** Flatten one address row into the editable form shape. */
function formFromAddress(addr: DetailedAddress): AddressForm {
  return Object.fromEntries(
    ADDRESS_FIELD_LABELS.map(({ key }) => [key, addr[key] ?? ""]),
  ) as AddressForm;
}

interface ProfileSettingsModalProps {
  onClose: () => void;
  /** Called after a successful save so the parent can show a toast. */
  onSaved: (name: string) => void;
}

/**
 * Profile settings, pre-filled from `GET /api/users/me` (name/phone) and
 * `GET /api/users/me/profile` (detailed address + pet fields).
 *
 * Saves via `PATCH /api/users/me/profile`. NOTE: that endpoint only accepts
 * `address` / `pet` blocks — it has no name/phone fields — so name and phone
 * are shown read-only here and saved separately via `PATCH /api/users/me`.
 */
export function ProfileSettingsModal({
  onClose,
  onSaved,
}: ProfileSettingsModalProps) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [addresses, setAddresses] = useState<DetailedAddress[]>([]);
  const [addressId, setAddressId] = useState<string | null>(null);
  const [addressForm, setAddressForm] = useState<AddressForm>(EMPTY_ADDRESS);
  const [pets, setPets] = useState<DetailedPet[]>([]);
  const [petId, setPetId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill from both endpoints.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [me, detail] = await Promise.all([
          apiGet<MeResponse>("/api/users/me"),
          apiGet<ProfileResponse>("/api/users/me/profile"),
        ]);
        if (cancelled) return;

        setEmail(me.user?.email ?? "");
        setName(me.user?.name ?? "");
        setPhone(me.user?.phone ?? "");

        const list = detail.profile?.addresses ?? [];
        setAddresses(list);
        const first = list[0] ?? null;
        if (first) {
          setAddressId(first.id);
          setAddressForm(formFromAddress(first));
        }

        const petList = detail.profile?.pets ?? [];
        setPets(petList);
        setPetId(petList[0]?.id ?? null);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError ? err.message : "無法載入個人資料。",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedPet = pets.find((p) => p.id === petId) ?? null;

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      // Basic info lives on `users`; detailed fields live on address/pet.
      const savedName = name.trim();
      await Promise.all([
        apiPatch<{ user: unknown }>("/api/users/me", {
          name: savedName || null,
          phone: phone.trim() || null,
        }),
        apiPatch<ProfileResponse>("/api/users/me/profile", {
          ...(addressId ? { addressId } : {}),
          address: addressForm,
          ...(petId && selectedPet
            ? {
                petId,
                pet: {
                  age:
                    selectedPet.age === null
                      ? null
                      : Number(selectedPet.age) || null,
                  gender: selectedPet.gender,
                  habits: selectedPet.habits,
                },
              }
            : {}),
        }),
      ]);
      onSaved(savedName);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "儲存失敗，請重試。");
    } finally {
      setSaving(false);
    }
  }

  const phoneValid = phone === "" || /^\d{8}$/.test(phone);
  const canSave = !loading && !saving && phoneValid;

  return (
    <Modal open onClose={onClose} title="個人資料" maxWidth="max-w-2xl">
      {loading ? (
        <p className="py-8 text-center text-sm text-[#4A3B32]/60">載入中⋯</p>
      ) : (
        <div className="flex max-h-[70vh] flex-col gap-5 overflow-y-auto pr-1">
          {/* ── Basic info ── */}
          <section>
            <h3 className="mb-2 text-sm font-semibold text-[#4A3B32]">
              基本資料
            </h3>
            <div className="rounded-xl bg-[#FFCB56]/30 px-4 py-3 text-sm text-[#4A3B32]">
              登入電郵：<strong>{email || "—"}</strong>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="profile-name" className={labelClass}>
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
                <label htmlFor="profile-phone" className={labelClass}>
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
                  aria-invalid={!phoneValid}
                  className={inputClass}
                />
                {!phoneValid && (
                  <p role="alert" className="mt-1 text-xs text-red-700">
                    請輸入 8 位數字電話號碼。
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* ── Address detail ── */}
          <section>
            <h3 className="mb-2 text-sm font-semibold text-[#4A3B32]">
              地址及照顧細節
            </h3>
            {!addressId && (
              <p className="mb-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
                尚未有儲存地址。完成第一次預約後，即可在此填寫詳細照顧資料。
              </p>
            )}

            {/* Which address is being edited */}
            {addresses.length > 1 && (
              <div className="mb-3">
                <label htmlFor="profile-address" className={labelClass}>
                  選擇地址
                </label>
                <select
                  id="profile-address"
                  value={addressId ?? ""}
                  onChange={(e) => {
                    const next = addresses.find((a) => a.id === e.target.value);
                    if (!next) return;
                    setAddressId(next.id);
                    setAddressForm(formFromAddress(next));
                  }}
                  className={inputClass}
                >
                  {addresses.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label || a.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-[#4A3B32]/50">
                  每次只會儲存目前選取的地址。
                </p>
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {ADDRESS_FIELD_LABELS.map(({ key, label, hint }) => (
                <div
                  key={key}
                  className={MULTILINE.has(key) ? "sm:col-span-2" : ""}
                >
                  <label htmlFor={`addr-${key}`} className={labelClass}>
                    {label}
                  </label>
                  {MULTILINE.has(key) ? (
                    <textarea
                      id={`addr-${key}`}
                      rows={2}
                      value={addressForm[key]}
                      onChange={(e) =>
                        setAddressForm((prev) => ({
                          ...prev,
                          [key]: e.target.value,
                        }))
                      }
                      className={inputClass}
                    />
                  ) : (
                    <input
                      id={`addr-${key}`}
                      type="text"
                      value={addressForm[key]}
                      onChange={(e) =>
                        setAddressForm((prev) => ({
                          ...prev,
                          [key]: e.target.value,
                        }))
                      }
                      placeholder={hint}
                      className={inputClass}
                    />
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* ── Pet detail ── */}
          <section>
            <h3 className="mb-2 text-sm font-semibold text-[#4A3B32]">
              寵物詳細資料
            </h3>
            {pets.length === 0 ? (
              <p className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
                尚未有寵物紀錄。完成第一次預約後，即可在此填寫寵物詳細資料。
              </p>
            ) : (
              <>
                <label htmlFor="profile-pet" className={labelClass}>
                  選擇寵物
                </label>
                <select
                  id="profile-pet"
                  value={petId ?? ""}
                  onChange={(e) => setPetId(e.target.value || null)}
                  className={inputClass}
                >
                  {pets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>

                {selectedPet && (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <label htmlFor="pet-age" className={labelClass}>
                        年齡（歲）
                      </label>
                      <input
                        id="pet-age"
                        type="number"
                        min={0}
                        max={40}
                        value={selectedPet.age ?? ""}
                        onChange={(e) =>
                          setPets((prev) =>
                            prev.map((p) =>
                              p.id === selectedPet.id
                                ? {
                                    ...p,
                                    age:
                                      e.target.value === ""
                                        ? null
                                        : Number(e.target.value),
                                  }
                                : p,
                            ),
                          )
                        }
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label htmlFor="pet-gender" className={labelClass}>
                        性別
                      </label>
                      <select
                        id="pet-gender"
                        value={selectedPet.gender ?? ""}
                        onChange={(e) =>
                          setPets((prev) =>
                            prev.map((p) =>
                              p.id === selectedPet.id
                                ? { ...p, gender: e.target.value || null }
                                : p,
                            ),
                          )
                        }
                        className={inputClass}
                      >
                        <option value="">未填寫</option>
                        <option value="male">男 / Male</option>
                        <option value="female">女 / Female</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label htmlFor="pet-habits" className={labelClass}>
                        習慣及性格
                      </label>
                      <textarea
                        id="pet-habits"
                        rows={3}
                        value={selectedPet.habits ?? ""}
                        onChange={(e) =>
                          setPets((prev) =>
                            prev.map((p) =>
                              p.id === selectedPet.id
                                ? { ...p, habits: e.target.value || null }
                                : p,
                            ),
                          )
                        }
                        placeholder="例如：怕生、喜歡躲在床下、進食時需要陪伴"
                        className={inputClass}
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </section>

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
      )}
    </Modal>
  );
}

const labelClass = "mb-1.5 block text-xs font-medium text-[#4A3B32]/80";

const inputClass =
  "w-full rounded-xl border border-black/10 bg-[#FFF8E1] px-3 py-2 text-sm text-[#4A3B32] outline-none placeholder:text-[#4A3B32]/40 focus:border-[#FFA259] focus:ring-2 focus:ring-[#FFA259]/30";
