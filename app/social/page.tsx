import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "追蹤我們 Follow Us | Blackcat.petsitter",
  description:
    "追蹤 Blackcat.petsitter 的 Instagram、WhatsApp 及 Facebook，第一時間獲取毛孩護理資訊與優惠。",
};

const SOCIAL_LINKS = [
  {
    name: "Instagram",
    handle: "@blackcat.petsitter",
    href: "https://instagram.com/blackcat.petsitter",
    logo: "/instagram_logo.svg",
    // Brand colours
    className: "bg-[#F56040] text-white hover:bg-[#ff8f3d]",
  },
  {
    name: "WhatsApp",
    handle: "+852 5349 7731",
    href: "https://wa.me/85253497731",
    logo: "/whatsapp_logo.svg",
    className: "bg-[#25D366] text-white hover:bg-[#ff8f3d]",
  },
  {
    name: "Facebook",
    handle: "Blackcat Petsitter",
    href: "https://facebook.com/blackcat.petsitter",
    logo: "/facebook_logo.svg",
    className: "bg-[#3896FF] text-white hover:bg-[#ff8f3d]",
  },
] as const;

export default function SocialPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      {/* Heading */}
      <section className="text-center">
        <span className="inline-flex w-fit items-center rounded-full bg-[#FFCB56] px-3 py-1 text-xs font-semibold text-[#4A3B32]">
          社交媒體
        </span>
        <h1 className="mt-4 text-3xl font-bold leading-tight text-[#4A3B32] sm:text-4xl">
          追蹤我們 Follow Us
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-[#4A3B32]/75 sm:text-base">
          緊貼我哋最新嘅毛孩護理貼士、保姆日常同獨家優惠。
          有任何問題，亦可以隨時透過 WhatsApp 搵我哋。
        </p>
      </section>

      {/* Social buttons */}
      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        {SOCIAL_LINKS.map((link) => (
          <a
            key={link.name}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex flex-col items-center gap-2 rounded-2xl px-6 py-6 text-center font-semibold shadow-sm transition-colors ${link.className}`}
          >
            {/* Fixed box + object-contain keeps mismatched SVG sizes aligned. */}
            <span className="flex h-12 w-12 items-center justify-center" aria-hidden>
              <img
                src={link.logo}
                alt=""
                width={48}
                height={48}
                className="h-10 w-10 object-contain"
              />
            </span>
            <span className="text-lg">{link.name}</span>
            <span className="text-xs font-medium opacity-70">{link.handle}</span>
          </a>
        ))}
      </section>

      {/* Instagram feed placeholder (Behold.so) */}
      <section className="mt-12">
        <div className="mb-5 flex flex-col gap-1 text-center">
          <h2 className="text-xl font-bold text-[#4A3B32] sm:text-2xl">
            Instagram 最新動態
          </h2>
          <p className="text-xs text-[#4A3B32]/60">
            #blackcatpetsitter · 相片自動同步中
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex aspect-square items-center justify-center rounded-2xl bg-[#FFCB56]/40 ring-1 ring-black/5"
            >
              <div className="flex flex-col items-center gap-1 px-3 text-center">
                <span className="text-2xl" aria-hidden>
                  {"\u{1F4F7}"}
                </span>
                <span className="text-xs font-medium text-[#4A3B32]/60">
                  Instagram Feed Loading...
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
