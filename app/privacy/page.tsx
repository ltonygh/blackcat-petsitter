import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "私隱政策 Privacy Policy | Blackcat.petsitter",
  description:
    "Blackcat.petsitter 的私隱政策，說明我們如何收集、使用、保留及保障你的個人資料（香港《個人資料（私隱）條例》PDPO）。",
};

const SECTIONS = [
  {
    title: "1. 收集目的 Purpose of Collection",
    body: [
      "我們只會為提供寵物保姆服務（包括預約安排、保姆配對、溝通聯絡及付款處理）而收集個人資料。",
      "所收集的資料包括：姓名、聯絡電話、電郵地址、服務地址及大門密碼、寵物資料（品種、體重、健康狀況）以及你自願上傳的寵物文件。",
    ],
  },
  {
    title: "2. 資料準確性及保留期限 Accuracy & Retention",
    body: [
      "請確保你提供的資料準確及最新。我們會於提供服務所需的期間內保留你的資料，並在超出所需期限後予以刪除或匿名化處理。",
    ],
  },
  {
    title: "3. 資料用途 Use of Data",
    body: [
      "你的資料只會用於收集時所述明的用途，除非你自願及明確同意其他用途。",
      "你可選擇授權 Blackcat.petsitter 的員工為你的寵物拍照，用於本網站及 Instagram 的宣傳用途，並會標明由寵物主人提供。",
    ],
  },
  {
    title: "4. 資料保安 Data Security",
    body: [
      "我們採取切實可行的保安措施，保護你的資料免遭未經授權的查閱、處理或洩漏。寵物文件儲存於受存取控制的雲端儲存空間。",
    ],
  },
  {
    title: "5. 透明度 Openness & Transparency",
    body: [
      "本頁面公開說明我們收集哪些資料及如何使用，讓你知道自己的資料如何被處理。",
    ],
  },
  {
    title: "6. 查閱及更正 Access & Correction",
    body: [
      "你有權要求查閱及更正我們持有關於你的個人資料。如需查閱或更正，請透過 WhatsApp 或電郵與我們聯絡。",
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
        This is the privacy policy for Blackcat.petsitter. We collect data
        solely for the purpose of providing pet sitting services —
        including booking arrangements, sitter matching, communication and
        payment processing. 本政策說明我們如何收集、使用、保留及保障你的個人資料。
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
        最後更新：本頁內容仍在草擬階段，將於正式服務推出前完成。
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
