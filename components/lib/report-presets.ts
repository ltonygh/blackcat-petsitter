/**
 * Operational checklists for the service report.
 *
 * Placeholders are replaced at render time by `fillPlaceholders` in the
 * report wizard:
 *   {寵物名字} -> pet name
 *   {家長}     -> customer / owner name
 */

export interface CompletedTaskGroup {
  category: string;
  tasks: string[];
}

export const COMPLETED_TASKS: CompletedTaskGroup[] = [
  {
    category: "用具維護内容",
    tasks: [
      "更換飲用水",
      "更換糧食",
      "清洗糧兜",
      "清洗水兜",
      "清洗砂盆",
      "清洗玩具及工具",
    ],
  },
  {
    category: "寵物照顧内容",
    tasks: [
      "為 {寵物名字} 抹清眼睛",
      "為 {寵物名字} 梳毛",
      "與 {寵物名字} 互動玩耍",
      "為 {寵物名字} 更換尿片",
      "與 {寵物名字} 散步",
      "與 {家長} FaceTime",
      "為 {寵物名字} 喂食藥物",
      "為 {寵物名字} 清理耳朵",
      "為 {寵物名字} 修剪指甲",
      "為 {寵物名字} 注射疫苗",
      "為 {寵物名字} 注射皮下水",
      "為 {寵物名字} 拍照",
    ],
  },
  {
    category: "家居管理",
    tasks: [
      "吸塵",
      "清理垃圾桶",
      "鎖好家門",
      "關好閘門",
      "關好房間門",
      "關好窗戶",
      "熄完所有燈光",
      "預留一盞燈光",
      "熄完所有冷氣",
      "為房間通風",
      "為房間抽濕",
      "收取信件",
    ],
  },
];

export const UPCOMING_TASKS: string[] = [
  "每日更換飲用水",
  "每日更換糧食",
  "每日清洗糧兜",
  "每日清洗水兜",
  "定期清洗並更換砂盆",
  "房間需保持通風",
  "房間需保持抽濕",
  "離開時需注意門窗已關好",
  "定期吸塵",
  "定期為 {寵物名字} 清理耳朵",
  "定期為 {寵物名字} 梳毛",
];
