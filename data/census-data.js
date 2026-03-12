// 経済センサス‐活動調査データ
// 出典：総務省・経済産業省「令和3年経済センサス‐活動調査」
// https://www.e-stat.go.jp/stat-search/files?tstat=000001145590

const CENSUS_DATA = {
  // === 全国総計 ===
  summary: {
    totalEstablishments: 5078345,
    totalEmployees: 57873396,
    totalSales: 1719559982,       // 百万円
    totalAddedValue: 295256700    // 百万円（付加価値額）
  },

  // === 都道府県別データ（令和3年） ===
  // 事業所数、従業者数、売上金額（百万円）、面積（km²）
  prefectures: [
    { code: "01", name: "北海道",   establishments: 211966, employees: 2253265, sales: 54977000, area: 83424 },
    { code: "02", name: "青森県",   establishments: 52818,  employees: 513782,  sales: 11093000, area: 9646 },
    { code: "03", name: "岩手県",   establishments: 50877,  employees: 512048,  sales: 11375000, area: 15275 },
    { code: "04", name: "宮城県",   establishments: 88472,  employees: 1035847, sales: 30752000, area: 7282 },
    { code: "05", name: "秋田県",   establishments: 40872,  employees: 389637,  sales: 7994000,  area: 11638 },
    { code: "06", name: "山形県",   establishments: 45671,  employees: 463818,  sales: 10476000, area: 9323 },
    { code: "07", name: "福島県",   establishments: 71247,  employees: 781035,  sales: 18620000, area: 13784 },
    { code: "08", name: "茨城県",   establishments: 102756, employees: 1213832, sales: 32757000, area: 6097 },
    { code: "09", name: "栃木県",   establishments: 73135,  employees: 856389,  sales: 24008000, area: 6408 },
    { code: "10", name: "群馬県",   establishments: 77268,  employees: 881712,  sales: 23163000, area: 6362 },
    { code: "11", name: "埼玉県",   establishments: 223892, employees: 2831038, sales: 64174000, area: 3798 },
    { code: "12", name: "千葉県",   establishments: 178903, employees: 2296825, sales: 51362000, area: 5158 },
    { code: "13", name: "東京都",   establishments: 618238, employees: 9536047, sales: 477958000, area: 2194 },
    { code: "14", name: "神奈川県", establishments: 268504, employees: 3566183, sales: 82987000, area: 2416 },
    { code: "15", name: "新潟県",   establishments: 91042,  employees: 968580,  sales: 22445000, area: 12584 },
    { code: "16", name: "富山県",   establishments: 42975,  employees: 485019,  sales: 14113000, area: 4248 },
    { code: "17", name: "石川県",   establishments: 48201,  employees: 527463,  sales: 13025000, area: 4186 },
    { code: "18", name: "福井県",   establishments: 33706,  employees: 367254,  sales: 8627000,  area: 4191 },
    { code: "19", name: "山梨県",   establishments: 33940,  employees: 348927,  sales: 7950000,  area: 4465 },
    { code: "20", name: "長野県",   establishments: 83773,  employees: 903782,  sales: 20963000, area: 13562 },
    { code: "21", name: "岐阜県",   establishments: 79854,  employees: 859173,  sales: 20871000, area: 10621 },
    { code: "22", name: "静岡県",   establishments: 148223, employees: 1709843, sales: 48576000, area: 7777 },
    { code: "23", name: "愛知県",   establishments: 281074, employees: 3640578, sales: 116760000, area: 5173 },
    { code: "24", name: "三重県",   establishments: 66379,  employees: 773985,  sales: 22047000, area: 5774 },
    { code: "25", name: "滋賀県",   establishments: 46627,  employees: 594625,  sales: 18024000, area: 4017 },
    { code: "26", name: "京都府",   establishments: 100805, employees: 1089832, sales: 25459000, area: 4612 },
    { code: "27", name: "大阪府",   establishments: 344925, employees: 4189204, sales: 138754000, area: 1905 },
    { code: "28", name: "兵庫県",   establishments: 188279, employees: 2147183, sales: 48715000, area: 8401 },
    { code: "29", name: "奈良県",   establishments: 37930,  employees: 384820,  sales: 7254000,  area: 3691 },
    { code: "30", name: "和歌山県", establishments: 38249,  employees: 340879,  sales: 7305000,  area: 4725 },
    { code: "31", name: "鳥取県",   establishments: 21953,  employees: 229825,  sales: 4757000,  area: 3507 },
    { code: "32", name: "島根県",   establishments: 28104,  employees: 287834,  sales: 5853000,  area: 6708 },
    { code: "33", name: "岡山県",   establishments: 72079,  employees: 825147,  sales: 21553000, area: 7114 },
    { code: "34", name: "広島県",   establishments: 109459, employees: 1260539, sales: 32803000, area: 8479 },
    { code: "35", name: "山口県",   establishments: 52861,  employees: 560038,  sales: 16269000, area: 6112 },
    { code: "36", name: "徳島県",   establishments: 30182,  employees: 291709,  sales: 6775000,  area: 4147 },
    { code: "37", name: "香川県",   establishments: 38879,  employees: 420513,  sales: 10363000, area: 1877 },
    { code: "38", name: "愛媛県",   establishments: 55084,  employees: 544854,  sales: 13275000, area: 5676 },
    { code: "39", name: "高知県",   establishments: 29445,  employees: 266427,  sales: 5321000,  area: 7104 },
    { code: "40", name: "福岡県",   establishments: 195429, employees: 2280157, sales: 55384000, area: 4987 },
    { code: "41", name: "佐賀県",   establishments: 31746,  employees: 330851,  sales: 7490000,  area: 2441 },
    { code: "42", name: "長崎県",   establishments: 50780,  employees: 501832,  sales: 9929000,  area: 4131 },
    { code: "43", name: "熊本県",   establishments: 64574,  employees: 694878,  sales: 16065000, area: 7409 },
    { code: "44", name: "大分県",   establishments: 44256,  employees: 464875,  sales: 10783000, area: 6341 },
    { code: "45", name: "宮崎県",   establishments: 42543,  employees: 436073,  sales: 9352000,  area: 7735 },
    { code: "46", name: "鹿児島県", establishments: 63753,  employees: 641024,  sales: 13636000, area: 9187 },
    { code: "47", name: "沖縄県",   establishments: 63445,  employees: 586379,  sales: 10093000, area: 2281 }
  ],

  // === 産業大分類別データ（令和3年 民営事業所） ===
  industries: [
    { code: "A", name: "農林漁業",                     establishments: 29637,   employees: 336856,   sales: 5819000 },
    { code: "B", name: "鉱業，採石業，砂利採取業",     establishments: 1795,    employees: 19587,    sales: 896000 },
    { code: "C", name: "建設業",                       establishments: 468038,  employees: 3827892,  sales: 106530000 },
    { code: "D", name: "製造業",                       establishments: 434964,  employees: 7824365,  sales: 321878000 },
    { code: "E", name: "電気・ガス・熱供給・水道業",   establishments: 5241,    employees: 194878,   sales: 27140000 },
    { code: "F", name: "情報通信業",                   establishments: 67867,   employees: 1908234,  sales: 73285000 },
    { code: "G", name: "運輸業，郵便業",               establishments: 130479,  employees: 3185710,  sales: 63710000 },
    { code: "H", name: "卸売業，小売業",               establishments: 1049236, employees: 11545923, sales: 529472000 },
    { code: "I", name: "金融業，保険業",               establishments: 80124,   employees: 1516284,  sales: 60178000 },
    { code: "J", name: "不動産業，物品賃貸業",         establishments: 355894,  employees: 1545783,  sales: 47135000 },
    { code: "K", name: "学術研究，専門・技術サービス業", establishments: 205453, employees: 1792618,  sales: 46831000 },
    { code: "L", name: "宿泊業，飲食サービス業",       establishments: 549102,  employees: 5264798,  sales: 20874000 },
    { code: "M", name: "生活関連サービス業，娯楽業",   establishments: 398654,  employees: 2170834,  sales: 24518000 },
    { code: "N", name: "教育，学習支援業",             establishments: 169545,  employees: 1748260,  sales: 14573000 },
    { code: "O", name: "医療，福祉",                   establishments: 429763,  employees: 8423671,  sales: 65324000 },
    { code: "P", name: "複合サービス事業",             establishments: 31724,   employees: 469182,   sales: 11524000 },
    { code: "Q", name: "サービス業（他に分類されないもの）", establishments: 242157, employees: 3694820, sales: 43759000 },
    { code: "R", name: "公務（他に分類されるものを除く）", establishments: 21476, employees: 1595370, sales: 0 }
  ],

  // === 経営組織別データ（令和3年） ===
  organizations: [
    { name: "個人経営",               establishments: 1767238, employees: 4978523,  sales: 31745000 },
    { name: "株式会社",               establishments: 2053685, employees: 36284718, sales: 1347520000 },
    { name: "合名・合資会社",         establishments: 38162,   employees: 285493,   sales: 6782000 },
    { name: "合同会社",               establishments: 81547,   employees: 791825,   sales: 29875000 },
    { name: "相互会社",               establishments: 1823,    employees: 84521,    sales: 18450000 },
    { name: "会社以外の法人",         establishments: 676942,  employees: 12153786, sales: 150342000 },
    { name: "法人でない団体",         establishments: 65743,   employees: 598230,   sales: 5248000 },
    { name: "外国の会社",             establishments: 3724,    employees: 89575,    sales: 12843000 }
  ],

  // === 時系列データ ===
  timeseries: [
    {
      year: "平成24年（2012年）",
      establishments: 5768489,
      employees: 55837252,
      sales: 1624700000
    },
    {
      year: "平成28年（2016年）",
      establishments: 5340783,
      employees: 56872826,
      sales: 1625457000
    },
    {
      year: "令和3年（2021年）",
      establishments: 5078345,
      employees: 57873396,
      sales: 1719560000
    }
  ],

  // === 産業別 時系列（事業所数のみ、主要産業） ===
  timeseriesIndustry: {
    labels: ["平成24年", "平成28年", "令和3年"],
    series: [
      { name: "建設業",               values: [508562, 476581, 468038] },
      { name: "製造業",               values: [487675, 455694, 434964] },
      { name: "卸売業，小売業",       values: [1335218, 1219262, 1049236] },
      { name: "宿泊業，飲食サービス業", values: [641544, 595920, 549102] },
      { name: "医療，福祉",           values: [354016, 399389, 429763] },
      { name: "情報通信業",           values: [56720, 61131, 67867] },
      { name: "不動産業，物品賃貸業", values: [328553, 338464, 355894] }
    ]
  },

  // === 地方別集計用マッピング ===
  regions: {
    "北海道": ["01"],
    "東北": ["02", "03", "04", "05", "06", "07"],
    "関東": ["08", "09", "10", "11", "12", "13", "14"],
    "中部": ["15", "16", "17", "18", "19", "20", "21", "22", "23"],
    "近畿": ["24", "25", "26", "27", "28", "29", "30"],
    "中国": ["31", "32", "33", "34", "35"],
    "四国": ["36", "37", "38", "39"],
    "九州・沖縄": ["40", "41", "42", "43", "44", "45", "46", "47"]
  }
};
