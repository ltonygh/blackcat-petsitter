import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "私隱政策 Privacy Policy | 黑貓上門寵物保母 Blackcat Petsitter",
  description:
    "黑貓上門寵物保母 Blackcat Petsitter 的私隱政策，說明我們如何收集、使用、保留及保障你的個人資料（香港《個人資料（私隱）條例》PDPO）。",
};

const SECTIONS = [
  {
    title: "1. 收集目的 (DPP1 - Purpose of Collection)",
    body: [
      "黑貓上門寵物保母 Blackcat Petsitter 只會為提供寵物保姆服務（包括預約安排、保姆配對、溝通聯絡及付款處理）而收集個人資料。",

      " •  用戶的個人資料及聯絡方式，包括姓名、電話號碼及電郵，確保黑貓上門寵物保母 Blackcat Petsitter能夠實時聯絡用戶。",
      " •  用戶的地址資料，包括詳細地址及進入方式，確保 黑貓上門寵物保母 Blackcat Petsitter 能夠準時為用戶提供寵物上門照顧服務。",
      " •  用戶的寵物資料，包括寵物名字、品種、外貌特徵及性格、以及寵物健康狀況，確保黑貓上門寵物保母 Blackcat Petsitter能夠根據用戶的寵物狀況提供合適的照顧及護理方式。",
      " •  付款記錄，以處理用戶的預約及發出收據。",
    ],
  },
  {
    title: "2. 資料準確性及保留期限 (DPP2 - Accuracy & Retention)",
    body: [
      "請確保用戶提供的資料準確及最新。用戶可隨時登入帳戶更新資料。",
      "黑貓上門寵物保母 Blackcat Petsitter會於提供服務所需的期間內保留您的資料。根據香港稅務條例，包含付款記錄的財務數據將保留 7年。如您的帳戶超過 7年 未有登入或新預約，黑貓上門寵物保母 Blackcat Petsitter 將會匿名化處理您的個人及寵物資料。",
    ],
  },
  {
    title: "3. 資料用途 (DPP3 - Use of Data)",
    body: [
      "用戶提供的個人資料、地址資料、及寵物資料，只會提供給 黑貓上門寵物保母 Blackcat Petsitter 指派的保姆作為服務指引，確保服務順利完成。",
      "為維持網站系統運作，黑貓上門寵物保母 Blackcat Petsitter 會使用部分受信任的第三方服務。用戶的部分資料會傳輸至以下平台：",
      " •  Cloudflare (R2)： 安全儲存您的寵物照片及疫苗證明。",
      " •  Resend： 發送預約確認及登入連結電郵。",
      " •  Google Calendar： 同步預約時間表。(注意：敏感資料，如大門密碼，絕對不會同步至日曆)。",
      "黑貓上門寵物保母 Blackcat Petsitter 僅在獲得用戶明確同意（於預約時勾選）的情況下使用用戶的寵物照片作網站或 Instagram 宣傳，並會標明由寵物主人提供。",
    ],
  },
  {
    title: "4. 資料保安 (DPP4 - Data Security)",
    body: [
      "我們採取切實可行的保安措施，保護您的資料免遭未經授權的查閱：",
      " •  寵物文件及照片儲存於受嚴格存取控制的雲端空間 (Cloudflare R2)。",
      " •  用戶的預約及個人資料受到嚴格的系統權限保護。只有用戶本人、系統管理員，以及被指派為用戶服務的保姆才能查閱該次預約的詳細地址及進入方式。其他保姆或未經授權人士無法查閱用戶的資料。",
    ],
  },
  {
    title: "5. 透明度 (DPP5 - Openness & Transparency)",
    body: [
      "本頁面公開說明我們收集的資料類型及用途。用戶提供的所有信息（包括地址及密碼）只會被指派的保姆及 黑貓上門寵物保母 Blackcat Petsitter 持有者用作提供服務。",
    ],
  },
  {
    title: "6. 查閱及更正 (DPP6 - Access & Correction)",
    body: [
      "用戶有權隨時登入帳戶查閱及更改您的個人資料。如用戶需要協助刪除帳戶或查詢資料，請透過 Whatsapp 或 電郵 與我們聯絡。",
      "(注意：已記錄在付款收據中的歷史財務資料，基於法律要求將無法被修改或刪除。)",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <span className="inline-flex w-fit items-center rounded-full bg-[#FFCB56] px-3 py-1 text-xs font-semibold text-[#4A3B32]">
        個人資料（私隱）條例 PDPO
      </span>

      <h1 className="mt-4 text-3xl font-bold leading-tight text-[#4A3B32] sm:text-4xl">
        私隱政策 (Privacy Policy)
      </h1>

      <p className="mt-3 text-sm leading-relaxed text-[#4A3B32]/75">
        Blackcat.petsitter 致力於保護您的個人資料私隱。本政策說明我們如何根據香港《個人資料（私隱）條例》（第486章）收集、使用、保留及保護您的資料。
      </p>

      <div className="mt-8 flex flex-col gap-6">
        {SECTIONS.map((section) => (
          <section key={section.title}>
            <h2 className="text-base font-semibold text-[#4A3B32] sm:text-lg">
              {section.title}
            </h2>
            <div className="mt-2 flex flex-col gap-2">
              {section.body.map((paragraph) => (
                <p
                  key={paragraph.slice(0, 24)}
                  className="text-sm leading-relaxed text-[#4A3B32]/75"
                >
                  {paragraph}
                </p>
              ))}
            </div>
          </section>
        ))}
      </div>

      <aside className="mt-10 rounded-2xl bg-[#FFEDB9] p-5 text-sm text-[#4A3B32]/80 ring-1 ring-black/5">
        <p className="font-semibold text-[#4A3B32]">需要協助？</p>
        <p className="mt-1">
          如對私隱政策有任何疑問，或希望查閱／更正你的個人資料，請透過{" "}
          <Link href="/social" className="font-semibold text-[#FFA259] underline">
            WhatsApp
          </Link>{" "}
          或電郵與我們聯絡。
        </p>
        <p className="mt-2 text-xs text-[#4A3B32]/60">
          有關香港《個人資料（私隱）條例》的詳情，請參閱個人資料私隱專員公署網站。
        </p>
      </aside>

      <p className="mt-8 text-xs text-[#4A3B32]/50">
        最後更新日期：2026年10月31日
      </p>

      <Link
        href="/book"
        className="mt-6 inline-block rounded-xl bg-[#FFA259] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#ff8f3d]"
      >
        返回預約
      </Link>
    </main>
  );
}
