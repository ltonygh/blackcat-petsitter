import Link from "next/link";

import {
  ADD_ONS,
  INCLUDED_TASKS,
  PRICING_COLUMNS,
  SURCHARGES,
  type IncludedCell,
} from "@/components/lib/pricing";

function IncludedMark({ value }: { value: IncludedCell }) {
  if (value === "yes") {
    return (
      <span className="font-bold text-green-700" aria-label="包括">
        ✔
      </span>
    );
  }
  if (value === "optional") {
    return (
      <span className="text-xs font-medium text-[#4A3B32]/70">可選擇</span>
    );
  }
  return (
    <span className="font-bold text-[#4A3B32]/25" aria-label="不包括">
      ✖
    </span>
  );
}

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      {/* Hero */}
      <section className="grid items-center gap-8 rounded-3xl bg-white/70 p-6 sm:p-10 md:grid-cols-2">
        <div className="flex flex-col gap-5">
          <span className="inline-flex w-fit items-center rounded-full bg-[#FFCB56] px-3 py-1 text-xs font-semibold text-[#4A3B32]">
            香港寵物保姆平台
          </span>
          <h1 className="text-3xl font-bold leading-tight text-[#4A3B32] sm:text-4xl md:text-5xl">
            為你的毛孩
            <br />
            找個可靠的保姆
          </h1>
          <p className="max-w-md text-base leading-relaxed text-[#4A3B32]/75">
            無論係貓定狗，Blackcat.petsitter 都為你配對經驗豐富嘅寵物保姆，
            提供上門照顧、餵食、散步等一站式服務。安心出發，毛孩在家。
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/book"
              className="rounded-xl bg-[#FFA259] px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-[#ff8f3d]"
            >
              立即預約
            </Link>
            <Link
              href="/social"
              className="rounded-xl bg-white px-6 py-3 text-base font-semibold text-[#4A3B32] ring-1 ring-black/10 transition-colors hover:bg-white/70"
            >
              了解我們
            </Link>
          </div>
        </div>

        {/* Image placeholder */}
        <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-2xl bg-[#FFCB56]">
          <div className="flex flex-col items-center gap-2 text-[#4A3B32]/70">
            <span className="text-6xl" aria-hidden>
              {"\u{1F415}"}
            </span>
            <span className="text-sm font-medium">圖片位置</span>
          </div>
        </div>
      </section>

      {/* Pricing Table */}
      <section id="pricing" className="mt-12">
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold text-[#4A3B32] sm:text-3xl">
            服務收費
          </h2>
          <p className="mt-2 text-sm text-[#4A3B32]/70">
            透明定價，按需要選擇最合適嘅方案。
          </p>
        </div>

        {/* Desktop / tablet: table */}
        <div className="hidden overflow-hidden rounded-2xl ring-1 ring-black/5 md:block">
          <table className="w-full border-collapse bg-white text-left text-sm">
            <caption className="sr-only">服務收費表</caption>
            <thead>
              <tr className="bg-[#FFCB56] text-[#4A3B32]">
                <th scope="col" className="px-4 py-4 text-sm font-semibold">
                  項目
                </th>
                {PRICING_COLUMNS.map((col) => (
                  <th
                    key={col.service}
                    scope="col"
                    className="px-4 py-4 text-center text-sm font-semibold"
                  >
                    {col.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {/* Base fee */}
              <tr className="bg-[#FFEDB9]/50 align-top">
                <th scope="row" className="px-4 py-4 font-semibold text-[#4A3B32]">
                  基本收費 Base fee
                </th>
                {PRICING_COLUMNS.map((col) => (
                  <td key={col.service} className="px-4 py-4 text-center">
                    <ul className="flex flex-col gap-0.5">
                      {col.baseFee.map((line) => (
                        <li key={line} className="text-[#4A3B32]">
                          {line}
                        </li>
                      ))}
                    </ul>
                  </td>
                ))}
              </tr>

              {/* Duration */}
              <tr className="align-top">
                <th scope="row" className="px-4 py-4 font-semibold text-[#4A3B32]">
                  服務時長 Duration
                </th>
                {PRICING_COLUMNS.map((col) => (
                  <td
                    key={col.service}
                    className="px-4 py-4 text-center text-[#4A3B32]/80"
                  >
                    {col.duration}
                  </td>
                ))}
              </tr>

              {/* Included tasks */}
              <tr>
                <th
                  scope="colgroup"
                  colSpan={PRICING_COLUMNS.length + 1}
                  className="bg-[#FFCB56]/25 px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[#4A3B32]/70"
                >
                  包含服務 Included tasks
                </th>
              </tr>
              {INCLUDED_TASKS.map((row) => (
                <tr key={row.task}>
                  <th
                    scope="row"
                    className="px-4 py-3 text-left font-medium text-[#4A3B32]"
                  >
                    {row.task}
                  </th>
                  {row.values.map((v, i) => (
                    <td
                      key={`${row.task}-${i}`}
                      className="px-4 py-3 text-center"
                    >
                      <IncludedMark value={v} />
                    </td>
                  ))}
                </tr>
              ))}

              {/* CTA row */}
              <tr className="bg-white">
                <td className="px-4 py-4" />
                {PRICING_COLUMNS.map((col) => (
                  <td key={col.service} className="px-4 py-4 text-center">
                    <Link
                      href="/book"
                      className="inline-block rounded-xl bg-[#FFA259] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#ff8f3d]"
                    >
                      預約此服務
                    </Link>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Mobile: stacked cards */}
        <div className="grid gap-4 md:hidden">
          {PRICING_COLUMNS.map((col, idx) => (
            <div
              key={col.service}
              className="overflow-hidden rounded-2xl bg-white ring-1 ring-black/5"
            >
              <div className="bg-[#FFCB56] px-4 py-3">
                <h3 className="text-base font-semibold text-[#4A3B32]">
                  {col.name}
                </h3>
                <p className="mt-0.5 text-xs text-[#4A3B32]/70">
                  時長：{col.duration}
                </p>
              </div>
              <div className="px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#4A3B32]/60">
                  基本收費
                </p>
                <ul className="mt-1 flex flex-col gap-0.5">
                  {col.baseFee.map((line) => (
                    <li key={line} className="text-sm text-[#4A3B32]">
                      {line}
                    </li>
                  ))}
                </ul>

                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-[#4A3B32]/60">
                  包含服務
                </p>
                <ul className="mt-1 divide-y divide-black/5">
                  {INCLUDED_TASKS.map((row) => (
                    <li
                      key={row.task}
                      className="flex items-start justify-between gap-3 py-1.5 text-sm text-[#4A3B32]"
                    >
                      <span>{row.task}</span>
                      <span className="shrink-0">
                        <IncludedMark value={row.values[idx]} />
                      </span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/book"
                  className="mt-4 block rounded-xl bg-[#FFA259] px-5 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-[#ff8f3d]"
                >
                  預約此服務
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Additional services */}
      <section className="mt-12 rounded-3xl bg-white p-6 ring-1 ring-black/5 sm:p-10">
        <div className="mb-5 text-center">
          <h2 className="text-2xl font-bold text-[#4A3B32] sm:text-3xl">
            附加服務 Additional Services
          </h2>
          <p className="mt-2 text-sm text-[#4A3B32]/70">
            適用於所有服務類型，預約時自行選擇，按次加收費用。
          </p>
        </div>

        <ul className="mx-auto grid max-w-3xl gap-2">
          {ADD_ONS.map((item) => (
            <li
              key={item.name}
              className="flex flex-wrap items-start justify-between gap-2 rounded-xl bg-[#FFF8E1] px-4 py-3 text-sm ring-1 ring-black/5"
            >
              <span className="font-medium text-[#4A3B32]">{item.name}</span>
              {/* Each price tier gets its own row. */}
              <span className="flex flex-col items-end gap-0.5 text-right">
                {item.price.map((line) => (
                  <span key={line} className="font-semibold text-[#FFA259]">
                    {line}
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Other surcharges — applied automatically by the system */}
      <section className="mt-8 rounded-3xl bg-white p-6 ring-1 ring-black/5 sm:p-10">
        <div className="mb-5 text-center">
          <h2 className="text-2xl font-bold text-[#4A3B32] sm:text-3xl">
            其他額外收費 Other Surcharges
          </h2>
          <p className="mt-2 text-sm text-[#4A3B32]/70">
            以下費用由系統按預約日期及時間自動計算，毋須自行選擇。
          </p>
        </div>

        <ul className="mx-auto grid max-w-3xl gap-2">
          {SURCHARGES.map((item) => (
            <li
              key={item.name}
              className="flex flex-wrap items-start justify-between gap-2 rounded-xl bg-[#FFF8E1] px-4 py-3 text-sm ring-1 ring-black/5"
            >
              <span className="font-medium text-[#4A3B32]">{item.name}</span>
              <span className="flex flex-col items-end gap-0.5 text-right">
                {item.price.map((line) => (
                  <span key={line} className="font-semibold text-[#FFA259]">
                    {line}
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ul>

        <p className="mx-auto mt-4 max-w-3xl text-center text-xs text-[#4A3B32]/60">
          上述費用為起價，保姆會按實際情況（如位置偏遠、寵物特殊需要）於確認預約前通知最終收費。
        </p>
      </section>

      {/* Login Portal */}
      <section className="mt-12 rounded-3xl bg-[#FFCB56] p-6 sm:p-10">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="text-2xl font-bold text-[#4A3B32] sm:text-3xl">
            登入 / 開始預約
          </h2>
          <p className="mt-2 text-sm text-[#4A3B32]/80">
            登入以管理預約同寵物檔案，或直接以訪客身份預約。
          </p>

          <div className="mt-6 flex flex-col gap-3">
            <Link
              href="/login"
              className="flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 text-base font-semibold text-[#4A3B32] ring-1 ring-black/10 transition-colors hover:bg-white/80"
            >
              <span aria-hidden>{"\u{1F535}"}</span> 使用 Google 登入
            </Link>
            <Link
              href="/login"
              className="flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 text-base font-semibold text-[#4A3B32] ring-1 ring-black/10 transition-colors hover:bg-white/80"
            >
              <span aria-hidden>{"\u2709\uFE0F"}</span> 使用電郵登入
            </Link>
            <Link
              href="/book"
              className="flex items-center justify-center gap-2 rounded-xl bg-[#FFA259] px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-[#ff8f3d]"
            >
              以訪客身份預約
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
