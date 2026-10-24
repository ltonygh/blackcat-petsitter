import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "服務條款 Terms & Conditions | Blackcat.petsitter",
  description:
    "Blackcat.petsitter 的服務條款：預約須知、收費須知、預約優惠、宣傳須知及家長須知。",
};

interface Section {
  title: string;
  items: string[];
}

const SECTIONS: Section[] = [
  {
    title: "預約須知 (Booking Notice)",
    items: [
      "檔期先到先得，並且預留最少 1 個月預約。",
      "確認服務詳情後可先付半數，以預留檔期。",
    ],
  },
  {
    title: "收費須知 (Billing Notice)",
    items: [
      "如上門前一星期內取消預約，按金不設退還。如開始上門後因任何原因取消預約，需支付原定總數的 70%。",
      "尾數在完成全部服務後 24 小時內支付。",
      "極端天氣情況：八號風球或黑雨默認為暫停上門。如有必需要上門情況 (餵藥/缺水缺糧)，則需額外附加極端天氣上門費用 ($150/次) 及極端天氣特殊交通費用 (實報實銷)。",
    ],
  },
  {
    title: "預約優惠須知 (Booking Benefits Notice)",
    items: [
      "預約 1-4 次：可於出門前拍攝住宅環境及交代注意事項，並另約時間交收鎖匙。如有需要亦可另加 $100 作一次家訪。",
      "預約 5 次或以上：在上門服務的前一星期內，可免費安排一次家訪，具體時間互相配合。若無法安排，可於出門前拍攝住宅環境及交代注意事項，並另約時間交收鎖匙。",
    ],
  },
  {
    title: "宣傳須知 (Promotion Notice)",
    items: [
      "歡迎在屋內安裝鏡頭，上門期間亦會拍照/錄影分享毛孩即時情況。",
      "在保護私隱的前提下，Blackcat.petsitter 會上門記錄家寵的照片/影片，以作宣傳。如不希望分享毛孩影像，請提前告知。",
    ],
  },
  {
    title: "家長須知 (Pet Owner Notice)",
    items: [
      "家寵如有任何傳染病/未打齊針，需提前告知，否則 Blackcat.petsitter 及受影響家長將保留追究有關醫療責任及費用的權利。",
      "出門前請將貴重物品收好，如有遺失，Blackcat.petsitter 恕不負責。",
      "請家長提供進入屋苑的密碼/住戶證/八達通，否則可能未能提供服務。",
    ],
  },
];

export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <span className="inline-flex w-fit items-center rounded-full bg-[#FFCB56] px-3 py-1 text-xs font-semibold text-[#4A3B32]">
        服務條款
      </span>

      <h1 className="mt-4 text-3xl font-bold leading-tight text-[#4A3B32] sm:text-4xl">
        服務條款 (Terms &amp; Conditions)
      </h1>

      <p className="mt-3 text-sm leading-relaxed text-[#4A3B32]/75">
        預約本平台服務前，請先細閱以下條款。提交預約即代表你已閱讀並同意本條款。
      </p>

      <div className="mt-8 flex flex-col gap-7">
        {SECTIONS.map((section) => (
          <section key={section.title}>
            <h2 className="text-base font-semibold text-[#4A3B32] sm:text-lg">
              {section.title}
            </h2>
            <ul className="mt-2 flex list-disc flex-col gap-2 pl-5 text-sm leading-relaxed text-[#4A3B32]/75 marker:text-[#FFA259]">
              {section.items.map((item) => (
                <li key={item.slice(0, 24)}>{item}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <aside className="mt-10 rounded-2xl bg-[#FFEDB9] p-5 text-sm text-[#4A3B32]/80 ring-1 ring-black/5">
        <p className="font-semibold text-[#4A3B32]">需要協助？</p>
        <p className="mt-1">
          如對服務條款有任何疑問，請透過{" "}
          <Link href="/social" className="font-semibold text-[#FFA259] underline">
            WhatsApp
          </Link>{" "}
          與我們聯絡。
        </p>
        <p className="mt-2 text-xs text-[#4A3B32]/60">
          另請參閱我們的{" "}
          <Link href="/privacy" className="font-semibold text-[#FFA259] underline">
            私隱政策
          </Link>
          。
        </p>
      </aside>

      <Link
        href="/book"
        className="mt-6 inline-block rounded-xl bg-[#FFA259] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#ff8f3d]"
      >
        返回預約
      </Link>
    </main>
  );
}
