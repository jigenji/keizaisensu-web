// ====================================================================
// 日本の産業統計 総合ダッシュボード - メインアプリケーション
// ====================================================================
(function () {
  "use strict";

  // ========================================
  // ユーティリティ
  // ========================================
  function fmt(n) {
    if (n == null) return "-";
    return n.toLocaleString("ja-JP");
  }

  function fmtTrillion(millionYen) {
    return (millionYen / 1000000).toFixed(1);
  }

  function shortName(name) {
    return name
      .replace("，", "・")
      .replace("（他に分類されないもの）", "（他）")
      .replace("（他に分類されるものを除く）", "")
      .replace("電気・ガス・熱供給・水道業", "電気ガス水道")
      .replace("学術研究，専門・技術サービス業", "学術研究・専門技術")
      .replace("学術研究，専門技術", "学術研究・専門技術")
      .replace("生活関連サービス業，娯楽業", "生活関連・娯楽");
  }

  // Chart.js デフォルト
  Chart.defaults.font.family = '"Hiragino Kaku Gothic ProN","Noto Sans JP",sans-serif';
  Chart.defaults.font.size = 12;
  Chart.defaults.plugins.legend.labels.usePointStyle = true;

  var COLORS = [
    "#1a56db", "#059669", "#d97706", "#dc2626", "#7c3aed",
    "#db2777", "#0891b2", "#65a30d", "#ea580c", "#4f46e5",
    "#0d9488", "#ca8a04", "#e11d48", "#6d28d9", "#0284c7",
    "#16a34a", "#c2410c", "#9333ea"
  ];

  var CHARTS = {};
  function makeChart(id, config) {
    if (CHARTS[id]) CHARTS[id].destroy();
    var ctx = document.getElementById(id);
    if (!ctx) return null;
    CHARTS[id] = new Chart(ctx, config);
    return CHARTS[id];
  }

  // 線形回帰
  function linearRegression(xs, ys) {
    var n = xs.length;
    var sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    for (var i = 0; i < n; i++) {
      sumX += xs[i]; sumY += ys[i];
      sumXY += xs[i] * ys[i]; sumXX += xs[i] * xs[i];
    }
    var slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    var intercept = (sumY - slope * sumX) / n;
    return { slope: slope, intercept: intercept };
  }

  function predict(reg, x) {
    return Math.round((reg.slope * x + reg.intercept) * 10) / 10;
  }

  // ========================================
  // タブ切り替え
  // ========================================
  document.querySelectorAll(".nav-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll(".nav-btn").forEach(function (b) { b.classList.remove("active"); });
      document.querySelectorAll(".tab-content").forEach(function (t) { t.classList.remove("active"); });
      btn.classList.add("active");
      document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
    });
  });

  // ========================================
  // テーブルソート
  // ========================================
  function initTableSort(tableId, data, renderFn) {
    var table = document.getElementById(tableId);
    if (!table) return;
    var headers = table.querySelectorAll("th[data-sort]");
    var cur = { key: null, dir: "asc" };
    headers.forEach(function (th) {
      th.addEventListener("click", function () {
        var key = th.dataset.sort;
        if (cur.key === key) cur.dir = cur.dir === "asc" ? "desc" : "asc";
        else { cur.key = key; cur.dir = "desc"; }
        headers.forEach(function (h) { h.classList.remove("sort-asc", "sort-desc"); });
        th.classList.add("sort-" + cur.dir);
        var sorted = data.slice().sort(function (a, b) {
          var av, bv;
          if (key === "name") return cur.dir === "asc" ? a.name.localeCompare(b.name, "ja") : b.name.localeCompare(a.name, "ja");
          if (key === "density") { av = a.establishments / a.area; bv = b.establishments / b.area; }
          else { av = a[key] || 0; bv = b[key] || 0; }
          return cur.dir === "asc" ? av - bv : bv - av;
        });
        renderFn(sorted);
      });
    });
  }

  // ========================================
  // 1. 概要タブ
  // ========================================
  function initOverview() {
    var s = CENSUS_DATA.summary;
    var lf = CENSUS_DATA.laborForce;
    var lastIdx = lf.years.length - 1;

    document.getElementById("total-establishments").textContent = fmt(s.totalEstablishments);
    document.getElementById("total-employees").textContent = fmt(s.totalEmployees);
    document.getElementById("total-sales").textContent = fmtTrillion(s.totalSales);
    document.getElementById("total-labor").textContent = fmt(lf.totalEmployed[lastIdx]);
    document.getElementById("total-unemployment").textContent = lf.unemploymentRate[lastIdx];
    document.getElementById("total-nonregular").textContent = lf.nonRegularRate[lastIdx];

    // 産業パイ
    var inds = CENSUS_DATA.industries.filter(function (i) { return i.code !== "R"; })
      .sort(function (a, b) { return b.establishments - a.establishments; });
    var top10 = inds.slice(0, 10);
    var others = inds.slice(10).reduce(function (s, i) { return s + i.establishments; }, 0);
    var pieL = top10.map(function (i) { return shortName(i.name); }).concat("その他");
    var pieD = top10.map(function (i) { return i.establishments; }).concat(others);

    makeChart("overview-industry-pie", {
      type: "doughnut",
      data: { labels: pieL, datasets: [{ data: pieD, backgroundColor: COLORS.slice(0, pieL.length), borderWidth: 1 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: "right", labels: { font: { size: 11 }, padding: 8 } },
          tooltip: { callbacks: { label: function (c) { var t = c.dataset.data.reduce(function (a, b) { return a + b; }, 0); return c.label + ": " + fmt(c.parsed) + " (" + ((c.parsed / t) * 100).toFixed(1) + "%)"; } } }
        }
      }
    });

    // 地方別
    var regions = CENSUS_DATA.regions;
    var pm = {}; CENSUS_DATA.prefectures.forEach(function (p) { pm[p.code] = p; });
    var rL = [], rV = [];
    Object.keys(regions).forEach(function (r) {
      rL.push(r);
      rV.push(regions[r].reduce(function (s, c) { return s + (pm[c] ? pm[c].establishments : 0); }, 0));
    });

    makeChart("overview-region-bar", {
      type: "bar",
      data: { labels: rL, datasets: [{ label: "事業所数", data: rV, backgroundColor: COLORS[0], borderRadius: 4 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { return fmt(c.parsed.y) + " 事業所"; } } } },
        scales: { y: { beginAtZero: true, ticks: { callback: function (v) { return (v / 10000).toFixed(0) + "万"; } } } }
      }
    });
  }

  // ========================================
  // 2. 都道府県別タブ
  // ========================================
  function renderPrefChart() {
    var metric = document.getElementById("pref-metric").value;
    var sort = document.getElementById("pref-sort").value;
    var data = CENSUS_DATA.prefectures.slice();
    if (sort === "desc") data.sort(function (a, b) { return b[metric] - a[metric]; });
    else if (sort === "asc") data.sort(function (a, b) { return a[metric] - b[metric]; });

    var mL = { establishments: "事業所数", employees: "従業者数", sales: "売上金額（百万円）" };
    makeChart("pref-chart", {
      type: "bar",
      data: { labels: data.map(function (p) { return p.name; }), datasets: [{ label: mL[metric], data: data.map(function (p) { return p[metric]; }), backgroundColor: COLORS[0], borderRadius: 3 }] },
      options: { indexAxis: "y", responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true }, y: { ticks: { font: { size: 10 } } } } }
    });
  }

  function renderPrefTable(filter) {
    var data = filter ? CENSUS_DATA.prefectures.filter(function (p) { return p.name.indexOf(filter) !== -1; }) : CENSUS_DATA.prefectures;
    document.getElementById("pref-table-body").innerHTML = data.map(function (p) {
      return "<tr><td>" + p.name + "</td><td>" + fmt(p.establishments) + "</td><td>" + fmt(p.employees) + "</td><td>" + fmt(p.sales) + "</td><td>" + (p.establishments / p.area).toFixed(1) + "</td></tr>";
    }).join("");
  }

  function initPrefecture() {
    renderPrefChart(); renderPrefTable("");
    document.getElementById("pref-metric").addEventListener("change", renderPrefChart);
    document.getElementById("pref-sort").addEventListener("change", renderPrefChart);
    document.getElementById("pref-search").addEventListener("input", function (e) { renderPrefTable(e.target.value); });
    initTableSort("pref-table", CENSUS_DATA.prefectures, function (sorted) {
      document.getElementById("pref-table-body").innerHTML = sorted.map(function (p) {
        return "<tr><td>" + p.name + "</td><td>" + fmt(p.establishments) + "</td><td>" + fmt(p.employees) + "</td><td>" + fmt(p.sales) + "</td><td>" + (p.establishments / p.area).toFixed(1) + "</td></tr>";
      }).join("");
    });
  }

  // ========================================
  // 3. 産業別タブ
  // ========================================
  function initIndustry() {
    var inds = CENSUS_DATA.industries.filter(function (i) { return i.code !== "R"; });

    function renderIndChart() {
      var m = document.getElementById("ind-metric").value;
      var d = inds.slice().sort(function (a, b) { return b[m] - a[m]; });
      makeChart("ind-chart", {
        type: "bar",
        data: { labels: d.map(function (i) { return shortName(i.name); }), datasets: [{ data: d.map(function (i) { return i[m]; }), backgroundColor: COLORS.slice(0, d.length), borderRadius: 3 }] },
        options: { indexAxis: "y", responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true }, y: { ticks: { font: { size: 10 } } } } }
      });
    }
    renderIndChart();
    document.getElementById("ind-metric").addEventListener("change", renderIndChart);

    // Pies
    function makePie(id, key, unit) {
      var top8 = inds.slice().sort(function (a, b) { return b[key] - a[key]; }).slice(0, 8);
      var oth = inds.reduce(function (s, i) { return s + i[key]; }, 0) - top8.reduce(function (s, i) { return s + i[key]; }, 0);
      makeChart(id, {
        type: "doughnut",
        data: { labels: top8.map(function (i) { return shortName(i.name); }).concat("その他"), datasets: [{ data: top8.map(function (i) { return i[key]; }).concat(oth), backgroundColor: COLORS.slice(0, 9) }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "right", labels: { font: { size: 10 }, padding: 6 } }, tooltip: { callbacks: { label: function (c) { var t = c.dataset.data.reduce(function (a, b) { return a + b; }, 0); return c.label + ": " + fmt(c.parsed) + unit + " (" + ((c.parsed / t) * 100).toFixed(1) + "%)"; } } } } }
      });
    }
    makePie("ind-emp-pie", "employees", "人");
    makePie("ind-sales-pie", "sales", "百万円");

    // Table
    document.getElementById("ind-table-body").innerHTML = inds.sort(function (a, b) { return b.sales - a.sales; }).map(function (i) {
      var pe = (i.employees / i.establishments).toFixed(1);
      var ps = i.sales > 0 ? fmt(Math.round(i.sales / i.employees * 100)) : "-";
      return "<tr><td>" + i.name + "</td><td>" + fmt(i.establishments) + "</td><td>" + fmt(i.employees) + "</td><td>" + fmt(i.sales) + "</td><td>" + pe + "</td><td>" + ps + "</td></tr>";
    }).join("");
  }

  // ========================================
  // 4. 経営組織別タブ
  // ========================================
  function initOrganization() {
    var orgs = CENSUS_DATA.organizations;
    ["org-est-chart", "org-emp-chart"].forEach(function (id, idx) {
      var key = idx === 0 ? "establishments" : "employees";
      var unit = idx === 0 ? "" : "人";
      makeChart(id, {
        type: "doughnut",
        data: { labels: orgs.map(function (o) { return o.name; }), datasets: [{ data: orgs.map(function (o) { return o[key]; }), backgroundColor: COLORS.slice(0, orgs.length) }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "right", labels: { font: { size: 11 }, padding: 8 } }, tooltip: { callbacks: { label: function (c) { var t = c.dataset.data.reduce(function (a, b) { return a + b; }, 0); return c.label + ": " + fmt(c.parsed) + unit + " (" + ((c.parsed / t) * 100).toFixed(1) + "%)"; } } } } }
      });
    });
    document.getElementById("org-table-body").innerHTML = orgs.map(function (o) {
      return "<tr><td>" + o.name + "</td><td>" + fmt(o.establishments) + "</td><td>" + fmt(o.employees) + "</td><td>" + fmt(o.sales) + "</td></tr>";
    }).join("");
  }

  // ========================================
  // 5. 労働力調査タブ
  // ========================================
  function initLaborForce() {
    var lf = CENSUS_DATA.laborForce;
    var indNames = Object.keys(lf.industries);

    // Select options
    var sel = document.getElementById("lf-industry");
    indNames.forEach(function (name, idx) {
      var opt = document.createElement("option");
      opt.value = name; opt.textContent = name;
      if (idx < 5) opt.selected = true;
      sel.appendChild(opt);
    });

    function renderIndustryChart() {
      var selected = Array.from(sel.selectedOptions).map(function (o) { return o.value; });
      if (selected.length === 0) selected = indNames.slice(0, 5);
      var datasets = selected.map(function (name, idx) {
        return { label: shortName(name), data: lf.industries[name], borderColor: COLORS[idx % COLORS.length], backgroundColor: "transparent", tension: 0.3, pointRadius: 3 };
      });
      makeChart("lf-industry-chart", {
        type: "line",
        data: { labels: lf.years, datasets: datasets },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "top" } }, scales: { y: { title: { display: true, text: "万人" } } } }
      });
    }
    renderIndustryChart();
    sel.addEventListener("change", renderIndustryChart);

    // Unemployment
    makeChart("lf-unemployment-chart", {
      type: "line",
      data: { labels: lf.years, datasets: [{ label: "完全失業率（%）", data: lf.unemploymentRate, borderColor: COLORS[3], backgroundColor: "rgba(220,38,38,0.1)", fill: true, tension: 0.3 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { title: { display: true, text: "%" } } } }
    });

    // Non-regular
    makeChart("lf-nonregular-chart", {
      type: "line",
      data: { labels: lf.years, datasets: [{ label: "非正規雇用比率（%）", data: lf.nonRegularRate, borderColor: COLORS[4], backgroundColor: "rgba(124,58,237,0.1)", fill: true, tension: 0.3 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { title: { display: true, text: "%" } } } }
    });

    // Total
    makeChart("lf-total-chart", {
      type: "bar",
      data: { labels: lf.years, datasets: [{ label: "就業者数合計（万人）", data: lf.totalEmployed, backgroundColor: COLORS[0], borderRadius: 4 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: false } } }
    });

    // Table
    var thead = "<tr><th>産業</th>" + lf.years.map(function (y) { return "<th>" + y + "</th>"; }).join("") + "</tr>";
    document.getElementById("lf-table-head").innerHTML = thead;
    var rows = indNames.map(function (name) {
      return "<tr><td>" + name + "</td>" + lf.industries[name].map(function (v) { return "<td>" + v + "</td>"; }).join("") + "</tr>";
    });
    rows.push("<tr style='font-weight:700'><td>合計</td>" + lf.totalEmployed.map(function (v) { return "<td>" + fmt(v) + "</td>"; }).join("") + "</tr>");
    rows.push("<tr><td>失業率（%）</td>" + lf.unemploymentRate.map(function (v) { return "<td>" + v + "</td>"; }).join("") + "</tr>");
    rows.push("<tr><td>非正規比率（%）</td>" + lf.nonRegularRate.map(function (v) { return "<td>" + v + "</td>"; }).join("") + "</tr>");
    document.getElementById("lf-table-body").innerHTML = rows.join("");
  }

  // ========================================
  // 6. 雇用動向調査タブ
  // ========================================
  function initEmploymentTrends() {
    var et = CENSUS_DATA.employmentTrends;

    // Overall
    makeChart("et-overall-chart", {
      type: "line",
      data: {
        labels: et.years,
        datasets: [
          { label: "入職率（%）", data: et.overall.hiringRate, borderColor: COLORS[0], tension: 0.3, pointRadius: 4 },
          { label: "離職率（%）", data: et.overall.separationRate, borderColor: COLORS[3], tension: 0.3, pointRadius: 4 }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false, scales: { y: { title: { display: true, text: "%" } } } }
    });

    // Hiring by industry (2023)
    var lastIdx = et.years.length - 1;
    var sorted = et.byIndustry.slice().sort(function (a, b) { return b.hiringRate[lastIdx] - a.hiringRate[lastIdx]; });
    makeChart("et-hiring-chart", {
      type: "bar",
      data: {
        labels: sorted.map(function (i) { return shortName(i.name); }),
        datasets: [
          { label: "入職率", data: sorted.map(function (i) { return i.hiringRate[lastIdx]; }), backgroundColor: COLORS[0], borderRadius: 3 },
          { label: "離職率", data: sorted.map(function (i) { return i.separationRate[lastIdx]; }), backgroundColor: COLORS[3], borderRadius: 3 }
        ]
      },
      options: { indexAxis: "y", responsive: true, maintainAspectRatio: false, scales: { x: { title: { display: true, text: "%" } } } }
    });

    // Per-industry timeseries
    var sel = document.getElementById("et-industry-select");
    et.byIndustry.forEach(function (i) {
      var opt = document.createElement("option");
      opt.value = i.name; opt.textContent = i.name;
      sel.appendChild(opt);
    });
    sel.value = et.byIndustry[0].name;

    function renderIndTS() {
      var ind = et.byIndustry.find(function (i) { return i.name === sel.value; });
      if (!ind) return;
      makeChart("et-industry-ts-chart", {
        type: "line",
        data: {
          labels: et.years,
          datasets: [
            { label: "入職率（%）", data: ind.hiringRate, borderColor: COLORS[0], tension: 0.3, pointRadius: 4 },
            { label: "離職率（%）", data: ind.separationRate, borderColor: COLORS[3], tension: 0.3, pointRadius: 4 }
          ]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { title: { display: true, text: "%" } } } }
      });
    }
    renderIndTS();
    sel.addEventListener("change", renderIndTS);

    // Age-specific hiring/separation charts
    var aa = CENSUS_DATA.ageAnalysis;
    if (aa && aa.hiringByAge) {
      var ageLabels = aa.hiringAgeGroups;
      makeChart("et-age-hiring-chart", {
        type: "bar",
        data: {
          labels: ageLabels,
          datasets: [
            { label: "男性", data: aa.hiringByAge.male.hiringRate, backgroundColor: COLORS[0], borderRadius: 2 },
            { label: "女性", data: aa.hiringByAge.female.hiringRate, backgroundColor: COLORS[5], borderRadius: 2 }
          ]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: "入職率（%）" } }, scales: { y: { title: { display: true, text: "%" } } } }
      });
      makeChart("et-age-separation-chart", {
        type: "bar",
        data: {
          labels: ageLabels,
          datasets: [
            { label: "男性", data: aa.hiringByAge.male.separationRate, backgroundColor: COLORS[0], borderRadius: 2 },
            { label: "女性", data: aa.hiringByAge.female.separationRate, backgroundColor: COLORS[5], borderRadius: 2 }
          ]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: "離職率（%）" } }, scales: { y: { title: { display: true, text: "%" } } } }
      });

      // Per-industry age hiring
      var ageIndSel = document.getElementById("et-age-industry-select");
      aa.hiringByAgeIndustry.forEach(function (i) {
        var opt = document.createElement("option");
        opt.value = i.name; opt.textContent = i.name;
        ageIndSel.appendChild(opt);
      });
      ageIndSel.value = aa.hiringByAgeIndustry[0].name;

      function renderAgeIndChart() {
        var ind = aa.hiringByAgeIndustry.find(function (i) { return i.name === ageIndSel.value; });
        if (!ind) return;
        makeChart("et-age-industry-chart", {
          type: "bar",
          data: {
            labels: ageLabels,
            datasets: [
              { label: shortName(ind.name) + " 入職率", data: ind.values, backgroundColor: COLORS[0], borderRadius: 3 },
              { label: "全産業計 入職率", data: aa.hiringByAge.total.hiringRate, backgroundColor: COLORS[2], borderRadius: 3 }
            ]
          },
          options: { responsive: true, maintainAspectRatio: false, scales: { y: { title: { display: true, text: "%" } } } }
        });
      }
      renderAgeIndChart();
      ageIndSel.addEventListener("change", renderAgeIndChart);
    }

    // Table
    document.getElementById("et-table-body").innerHTML = et.byIndustry.slice().sort(function (a, b) { return b.hiringRate[lastIdx] - a.hiringRate[lastIdx]; }).map(function (i) {
      var diff = (i.hiringRate[lastIdx] - i.separationRate[lastIdx]).toFixed(1);
      var cls = diff >= 0 ? "change-positive" : "change-negative";
      return "<tr><td>" + i.name + "</td><td>" + i.hiringRate[lastIdx] + "</td><td>" + i.separationRate[lastIdx] + '</td><td class="' + cls + '">' + (diff >= 0 ? "+" : "") + diff + "</td></tr>";
    }).join("");
  }

  // ========================================
  // 7. 国勢調査タブ
  // ========================================
  function initNationalCensus() {
    var nc = CENSUS_DATA.nationalCensus;

    var sel = document.getElementById("nc-industry");
    nc.industries.forEach(function (i, idx) {
      var opt = document.createElement("option");
      opt.value = idx; opt.textContent = i.name;
      if (idx < 5) opt.selected = true;
      sel.appendChild(opt);
    });

    function renderChart() {
      var selected = Array.from(sel.selectedOptions).map(function (o) { return parseInt(o.value); });
      var datasets = selected.map(function (idx, ci) {
        var i = nc.industries[idx];
        return { label: shortName(i.name), data: i.values, borderColor: COLORS[ci % COLORS.length], backgroundColor: "transparent", tension: 0.3, pointRadius: 4 };
      });
      makeChart("nc-industry-chart", {
        type: "line",
        data: { labels: nc.years, datasets: datasets },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { title: { display: true, text: "千人" } } } }
      });
    }
    renderChart();
    sel.addEventListener("change", renderChart);

    // Gender
    makeChart("nc-gender-chart", {
      type: "bar",
      data: {
        labels: nc.years,
        datasets: [
          { label: "男性", data: nc.totalByGender.male, backgroundColor: COLORS[0], borderRadius: 4 },
          { label: "女性", data: nc.totalByGender.female, backgroundColor: COLORS[5], borderRadius: 4 }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "top" } }, scales: { x: { stacked: false }, y: { title: { display: true, text: "千人" } } } }
    });

    // Table
    document.getElementById("nc-table-head").innerHTML = "<tr><th>産業</th>" + nc.years.map(function (y) { return "<th>" + y + "年</th>"; }).join("") + "<th>増減率</th></tr>";
    document.getElementById("nc-table-body").innerHTML = nc.industries.map(function (i) {
      var change = ((i.values[3] - i.values[0]) / i.values[0] * 100).toFixed(1);
      var cls = change >= 0 ? "change-positive" : "change-negative";
      return "<tr><td>" + i.name + "</td>" + i.values.map(function (v) { return "<td>" + fmt(v) + "</td>"; }).join("") + '<td class="' + cls + '">' + (change >= 0 ? "+" : "") + change + "%</td></tr>";
    }).join("");
  }

  // ========================================
  // 8. 就業構造基本調査タブ
  // ========================================
  function initEmploymentStructure() {
    var es = CENSUS_DATA.employmentStructure;

    // Workers chart
    makeChart("es-workers-chart", {
      type: "bar",
      data: {
        labels: es.years.map(function (y) { return y + "年"; }),
        datasets: es.industriesWorkers.map(function (i, idx) {
          return { label: shortName(i.name), data: i.values, backgroundColor: COLORS[idx], borderRadius: 3 };
        })
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "top" } }, scales: { y: { title: { display: true, text: "万人" } } } }
    });

    // Job change chart
    function makeHBar(id, dataArr, label) {
      var lastIdx = es.years.length - 1;
      var sorted = dataArr.slice().sort(function (a, b) { return b.values[lastIdx] - a.values[lastIdx]; });
      makeChart(id, {
        type: "bar",
        data: {
          labels: sorted.map(function (i) { return shortName(i.name); }),
          datasets: es.years.map(function (y, yi) {
            return { label: y + "年", data: sorted.map(function (i) { return i.values[yi]; }), backgroundColor: COLORS[yi], borderRadius: 2 };
          })
        },
        options: { indexAxis: "y", responsive: true, maintainAspectRatio: false, scales: { x: { title: { display: true, text: "%" } }, y: { ticks: { font: { size: 10 } } } } }
      });
    }
    makeHBar("es-jobchange-chart", es.jobChangeRate);
    makeHBar("es-sidejob-chart", es.sideJobRate);
    makeHBar("es-nonregular-chart", es.nonRegularByIndustry);

    // Table
    function renderESTable() {
      var type = document.getElementById("es-data-type").value;
      var dataMap = { workers: es.industriesWorkers, jobchange: es.jobChangeRate, sidejob: es.sideJobRate, nonregular: es.nonRegularByIndustry };
      var data = dataMap[type];
      document.getElementById("es-table-head").innerHTML = "<tr><th>産業</th>" + es.years.map(function (y) { return "<th>" + y + "年</th>"; }).join("") + "</tr>";
      document.getElementById("es-table-body").innerHTML = data.map(function (i) {
        return "<tr><td>" + i.name + "</td>" + i.values.map(function (v) { return "<td>" + v + "</td>"; }).join("") + "</tr>";
      }).join("");
    }
    renderESTable();
    document.getElementById("es-data-type").addEventListener("change", renderESTable);
  }

  // ========================================
  // 9. 賃金構造タブ
  // ========================================
  function initWageStructure() {
    var ws = CENSUS_DATA.wageStructure;

    // Monthly wage select
    var sel = document.getElementById("wage-industry");
    ws.monthlyWage.forEach(function (i, idx) {
      var opt = document.createElement("option");
      opt.value = idx; opt.textContent = i.name;
      if (idx < 5) opt.selected = true;
      sel.appendChild(opt);
    });

    function renderMonthly() {
      var selected = Array.from(sel.selectedOptions).map(function (o) { return parseInt(o.value); });
      var datasets = selected.map(function (idx, ci) {
        var i = ws.monthlyWage[idx];
        return { label: shortName(i.name), data: i.values, borderColor: COLORS[ci % COLORS.length], backgroundColor: "transparent", tension: 0.3, pointRadius: 3 };
      });
      makeChart("wage-monthly-chart", {
        type: "line", data: { labels: ws.years, datasets: datasets },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { title: { display: true, text: "千円/月" } } } }
      });
    }
    renderMonthly();
    sel.addEventListener("change", renderMonthly);

    // Bonus chart
    var lastIdx = ws.years.length - 1;
    var bonusSorted = ws.annualBonus.slice().sort(function (a, b) { return b.values[lastIdx] - a.values[lastIdx]; });
    makeChart("wage-bonus-chart", {
      type: "bar",
      data: {
        labels: bonusSorted.map(function (i) { return shortName(i.name); }),
        datasets: [
          { label: ws.years[0] + "年", data: bonusSorted.map(function (i) { return i.values[0]; }), backgroundColor: COLORS[2], borderRadius: 2 },
          { label: ws.years[lastIdx] + "年", data: bonusSorted.map(function (i) { return i.values[lastIdx]; }), backgroundColor: COLORS[0], borderRadius: 2 }
        ]
      },
      options: { indexAxis: "y", responsive: true, maintainAspectRatio: false, scales: { x: { title: { display: true, text: "千円" } }, y: { ticks: { font: { size: 10 } } } } }
    });

    // Annual income estimate (2023)
    var annualData = ws.monthlyWage.map(function (w, idx) {
      var b = ws.annualBonus[idx];
      var annual = Math.round((w.values[lastIdx] * 12 + b.values[lastIdx]) / 10);
      return { name: w.name, annual: annual };
    }).sort(function (a, b) { return b.annual - a.annual; });

    makeChart("wage-annual-chart", {
      type: "bar",
      data: { labels: annualData.map(function (d) { return shortName(d.name); }), datasets: [{ label: "推定年収（万円）", data: annualData.map(function (d) { return d.annual; }), backgroundColor: COLORS[1], borderRadius: 3 }] },
      options: { indexAxis: "y", responsive: true, maintainAspectRatio: false, scales: { x: { title: { display: true, text: "万円" } }, y: { ticks: { font: { size: 10 } } } } }
    });

    // Gender wage trend (overallByGender)
    if (ws.overallByGender) {
      var g = ws.overallByGender;
      makeChart("wage-gender-trend-chart", {
        type: "line",
        data: {
          labels: g.years,
          datasets: [
            { label: "男性", data: g.male, borderColor: COLORS[0], backgroundColor: "transparent", tension: 0.3, pointRadius: 3 },
            { label: "女性", data: g.female, borderColor: COLORS[5], backgroundColor: "transparent", tension: 0.3, pointRadius: 3 },
            { label: "全体", data: g.total, borderColor: COLORS[2], backgroundColor: "transparent", tension: 0.3, pointRadius: 3, borderDash: [4, 4] }
          ]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { title: { display: true, text: "千円/月" } } } }
      });
      makeChart("wage-gap-index-chart", {
        type: "line",
        data: {
          labels: g.years,
          datasets: [{ label: "女性/男性 賃金比率", data: g.genderGapIndex, borderColor: COLORS[4], backgroundColor: "rgba(124,58,237,0.1)", fill: true, tension: 0.3, pointRadius: 4 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { title: { display: true, text: "%" }, min: 60, max: 100 } } }
      });
    }

    // Gender wage chart
    var demo = ws.demographics2024;
    var demoSorted = demo.slice().sort(function (a, b) { return b.maleWage - a.maleWage; });
    makeChart("wage-gender-chart", {
      type: "bar",
      data: {
        labels: demoSorted.map(function (d) { return shortName(d.name); }),
        datasets: [
          { label: "男性", data: demoSorted.map(function (d) { return d.maleWage; }), backgroundColor: COLORS[0], borderRadius: 2 },
          { label: "女性", data: demoSorted.map(function (d) { return d.femaleWage; }), backgroundColor: COLORS[5], borderRadius: 2 }
        ]
      },
      options: { indexAxis: "y", responsive: true, maintainAspectRatio: false, scales: { x: { title: { display: true, text: "千円/月" } }, y: { ticks: { font: { size: 10 } } } } }
    });

    // Age/tenure chart
    makeChart("wage-demo-chart", {
      type: "bar",
      data: {
        labels: demo.map(function (d) { return shortName(d.name); }),
        datasets: [
          { label: "平均年齢", data: demo.map(function (d) { return d.avgAge; }), backgroundColor: COLORS[2], borderRadius: 2 },
          { label: "平均勤続年数", data: demo.map(function (d) { return d.avgTenure; }), backgroundColor: COLORS[6], borderRadius: 2 }
        ]
      },
      options: { indexAxis: "y", responsive: true, maintainAspectRatio: false, scales: { y: { ticks: { font: { size: 10 } } } } }
    });

    // Table
    document.getElementById("wage-table-body").innerHTML = demo.map(function (d) {
      var w = ws.monthlyWage.find(function (w) { return w.name === d.name; });
      var b = ws.annualBonus.find(function (b) { return b.name === d.name; });
      var monthly = w ? w.values[lastIdx] : "-";
      var bonus = b ? b.values[lastIdx] : "-";
      var annual = (monthly !== "-" && bonus !== "-") ? Math.round((monthly * 12 + bonus) / 10) : "-";
      var ratio = d.femaleWage > 0 ? (d.femaleWage / d.maleWage * 100).toFixed(1) + "%" : "-";
      return "<tr><td>" + d.name + "</td><td>" + monthly + "</td><td>" + fmt(bonus) + "</td><td>" + annual + "</td><td>" + d.avgAge + "</td><td>" + d.avgTenure + "</td><td>" + d.maleWage + "</td><td>" + d.femaleWage + "</td><td>" + ratio + "</td></tr>";
    }).join("");
  }

  // ========================================
  // 10. 年齢別分析タブ
  // ========================================
  function initAgeAnalysis() {
    var aa = CENSUS_DATA.ageAnalysis;
    var ageGroups = aa.ageGroups;

    // --- Industry × Age stacked bar ---
    var indSel = document.getElementById("age-industry");
    aa.industryByAge.forEach(function (i, idx) {
      var opt = document.createElement("option");
      opt.value = idx; opt.textContent = i.name;
      if (idx < 6) opt.selected = true;
      indSel.appendChild(opt);
    });

    function renderIndustryAge() {
      var selected = Array.from(indSel.selectedOptions).map(function (o) { return parseInt(o.value); });
      if (selected.length === 0) selected = [0, 1, 2, 3, 4, 5];
      var datasets = ageGroups.map(function (ag, agIdx) {
        return {
          label: ag,
          data: selected.map(function (idx) { return aa.industryByAge[idx].values[agIdx]; }),
          backgroundColor: COLORS[agIdx],
          borderRadius: 2
        };
      });
      makeChart("age-industry-chart", {
        type: "bar",
        data: { labels: selected.map(function (idx) { return shortName(aa.industryByAge[idx].name); }), datasets: datasets },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "top" } }, scales: { x: { stacked: true }, y: { stacked: true, title: { display: true, text: "万人" } } } }
      });
    }
    renderIndustryAge();
    indSel.addEventListener("change", renderIndustryAge);

    // --- Age distribution pie/doughnut ---
    var distSel = document.getElementById("age-dist-industry");
    aa.ageDistribution.forEach(function (i) {
      var opt = document.createElement("option");
      opt.value = i.name; opt.textContent = i.name;
      distSel.appendChild(opt);
    });
    distSel.value = aa.ageDistribution[0].name;

    function renderAgeDist() {
      var ind = aa.ageDistribution.find(function (i) { return i.name === distSel.value; });
      if (!ind) return;
      makeChart("age-dist-chart", {
        type: "doughnut",
        data: { labels: ageGroups, datasets: [{ data: ind.values, backgroundColor: COLORS.slice(0, ageGroups.length) }] },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { title: { display: true, text: shortName(ind.name) + " 年齢構成" }, tooltip: { callbacks: { label: function (c) { return c.label + ": " + c.parsed + "%"; } } } }
        }
      });

      // Comparison chart: all industries side by side for selected age group
      var sorted = aa.ageDistribution.slice().sort(function (a, b) {
        // Sort by young worker ratio (15-24 + 25-34)
        return (b.values[0] + b.values[1]) - (a.values[0] + a.values[1]);
      });
      makeChart("age-dist-compare-chart", {
        type: "bar",
        data: {
          labels: sorted.map(function (i) { return shortName(i.name); }),
          datasets: ageGroups.map(function (ag, agIdx) {
            return { label: ag, data: sorted.map(function (i) { return i.values[agIdx]; }), backgroundColor: COLORS[agIdx], borderRadius: 1 };
          })
        },
        options: {
          indexAxis: "y", responsive: true, maintainAspectRatio: false,
          plugins: { title: { display: true, text: "産業別 年齢構成比較" }, legend: { position: "top", labels: { font: { size: 10 } } } },
          scales: { x: { stacked: true, max: 100, title: { display: true, text: "%" } }, y: { stacked: true, ticks: { font: { size: 10 } } } }
        }
      });
    }
    renderAgeDist();
    distSel.addEventListener("change", renderAgeDist);

    // --- Age group timeseries ---
    var ageGroupNames = Object.keys(aa.totalByAgeTimeseries);
    makeChart("age-timeseries-chart", {
      type: "line",
      data: {
        labels: aa.ageGroupYears,
        datasets: ageGroupNames.map(function (name, idx) {
          return { label: name, data: aa.totalByAgeTimeseries[name], borderColor: COLORS[idx], backgroundColor: "transparent", tension: 0.3, pointRadius: 4 };
        })
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "top" } }, scales: { y: { title: { display: true, text: "万人" } } } }
    });

    // --- Wage curve by age (total, male, female) ---
    makeChart("age-wage-curve-chart", {
      type: "line",
      data: {
        labels: aa.wageAgeGroups,
        datasets: [
          { label: "全体", data: aa.wageByAge.total, borderColor: COLORS[2], backgroundColor: "transparent", tension: 0.3, pointRadius: 4, borderWidth: 3 },
          { label: "男性", data: aa.wageByAge.male, borderColor: COLORS[0], backgroundColor: "transparent", tension: 0.3, pointRadius: 4 },
          { label: "女性", data: aa.wageByAge.female, borderColor: COLORS[5], backgroundColor: "transparent", tension: 0.3, pointRadius: 4 }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false, scales: { y: { title: { display: true, text: "千円/月" } } } }
    });

    // --- Industry wage curves ---
    var wageSel = document.getElementById("age-wage-industry");
    aa.wageByAgeIndustry.forEach(function (i, idx) {
      var opt = document.createElement("option");
      opt.value = idx; opt.textContent = i.name;
      if (idx < 5) opt.selected = true;
      wageSel.appendChild(opt);
    });

    function renderWageCurves() {
      var selected = Array.from(wageSel.selectedOptions).map(function (o) { return parseInt(o.value); });
      if (selected.length === 0) selected = [0, 1, 2, 3, 4];
      var datasets = selected.map(function (idx, ci) {
        var i = aa.wageByAgeIndustry[idx];
        return { label: shortName(i.name), data: i.values, borderColor: COLORS[ci % COLORS.length], backgroundColor: "transparent", tension: 0.3, pointRadius: 3 };
      });
      makeChart("age-wage-industry-chart", {
        type: "line",
        data: { labels: aa.wageAgeGroups, datasets: datasets },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "top" } }, scales: { y: { title: { display: true, text: "千円/月" } } } }
      });
    }
    renderWageCurves();
    wageSel.addEventListener("change", renderWageCurves);

    // --- Tables ---
    // Employment by age table
    document.getElementById("age-table-head").innerHTML = "<tr><th>産業</th>" + ageGroups.map(function (g) { return "<th>" + g + "</th>"; }).join("") + "<th>合計</th></tr>";
    document.getElementById("age-table-body").innerHTML = aa.industryByAge.map(function (i) {
      var total = i.values.reduce(function (s, v) { return s + v; }, 0);
      return "<tr><td>" + i.name + "</td>" + i.values.map(function (v) { return "<td>" + v + "</td>"; }).join("") + "<td><strong>" + total + "</strong></td></tr>";
    }).join("");

    // Wage by age table
    document.getElementById("age-wage-table-head").innerHTML = "<tr><th>産業</th>" + aa.wageAgeGroups.map(function (g) { return "<th>" + g + "</th>"; }).join("") + "</tr>";
    var wageRows = [
      "<tr style='font-weight:700'><td>全体（計）</td>" + aa.wageByAge.total.map(function (v) { return "<td>" + v + "</td>"; }).join("") + "</tr>",
      "<tr style='font-weight:700'><td>男性（計）</td>" + aa.wageByAge.male.map(function (v) { return "<td>" + v + "</td>"; }).join("") + "</tr>",
      "<tr style='font-weight:700'><td>女性（計）</td>" + aa.wageByAge.female.map(function (v) { return "<td>" + v + "</td>"; }).join("") + "</tr>"
    ];
    wageRows = wageRows.concat(aa.wageByAgeIndustry.map(function (i) {
      return "<tr><td>" + i.name + "</td>" + i.values.map(function (v) { return "<td>" + v + "</td>"; }).join("") + "</tr>";
    }));
    document.getElementById("age-wage-table-body").innerHTML = wageRows.join("");
  }

  // ========================================
  // 11. 予測タブ
  // ========================================
  function initForecast() {
    var lf = CENSUS_DATA.laborForce;
    var ws = CENSUS_DATA.wageStructure;
    var forecastYears = [2025, 2026, 2027, 2028, 2029, 2030];
    var allYearsLF = lf.years.concat(forecastYears);

    // Industry select
    var indNames = Object.keys(lf.industries);
    var sel = document.getElementById("fc-industry");
    indNames.forEach(function (name, idx) {
      var opt = document.createElement("option");
      opt.value = name; opt.textContent = name;
      if (idx < 5) opt.selected = true;
      sel.appendChild(opt);
    });

    function renderEmploymentForecast() {
      var selected = Array.from(sel.selectedOptions).map(function (o) { return o.value; });
      if (selected.length === 0) selected = indNames.slice(0, 5);

      var datasets = selected.map(function (name, ci) {
        var hist = lf.industries[name];
        var reg = linearRegression(lf.years, hist);
        var forecasted = forecastYears.map(function (y) { return predict(reg, y); });
        var allData = hist.concat(forecasted);
        var segColors = lf.years.map(function () { return COLORS[ci % COLORS.length]; });
        return [
          { label: shortName(name), data: hist.concat([null, null, null, null, null, null]), borderColor: COLORS[ci % COLORS.length], backgroundColor: "transparent", tension: 0.3, pointRadius: 3 },
          { label: shortName(name) + "（予測）", data: new Array(lf.years.length - 1).fill(null).concat([hist[hist.length - 1]]).concat(forecasted), borderColor: COLORS[ci % COLORS.length], borderDash: [5, 5], backgroundColor: "transparent", tension: 0.3, pointRadius: 3, pointStyle: "triangle" }
        ];
      });

      makeChart("fc-employment-chart", {
        type: "line",
        data: { labels: allYearsLF, datasets: [].concat.apply([], datasets) },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: "top", labels: { font: { size: 10 } } } },
          scales: { y: { title: { display: true, text: "万人" } } }
        }
      });
    }
    renderEmploymentForecast();
    sel.addEventListener("change", renderEmploymentForecast);

    // Wage forecast
    var allYearsWage = ws.years.concat(forecastYears);
    var wageDatasets = ws.monthlyWage.slice(0, 6).map(function (w, ci) {
      var reg = linearRegression(ws.years, w.values);
      var forecasted = forecastYears.map(function (y) { return predict(reg, y); });
      return [
        { label: shortName(w.name), data: w.values.concat(new Array(6).fill(null)), borderColor: COLORS[ci], backgroundColor: "transparent", tension: 0.3, pointRadius: 3 },
        { label: shortName(w.name) + "（予測）", data: new Array(ws.years.length - 1).fill(null).concat([w.values[w.values.length - 1]]).concat(forecasted), borderColor: COLORS[ci], borderDash: [5, 5], backgroundColor: "transparent", tension: 0.3, pointRadius: 3, pointStyle: "triangle" }
      ];
    });

    makeChart("fc-wage-chart", {
      type: "line",
      data: { labels: allYearsWage, datasets: [].concat.apply([], wageDatasets) },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: "top", labels: { font: { size: 10 } } } },
        scales: { y: { title: { display: true, text: "千円/月" } } }
      }
    });

    // Unemployment forecast
    var uReg = linearRegression(lf.years, lf.unemploymentRate);
    var uForecast = forecastYears.map(function (y) { return Math.max(0, predict(uReg, y)); });
    makeChart("fc-unemployment-chart", {
      type: "line",
      data: {
        labels: allYearsLF,
        datasets: [
          { label: "失業率（実績）", data: lf.unemploymentRate.concat(new Array(6).fill(null)), borderColor: COLORS[3], backgroundColor: "transparent", tension: 0.3 },
          { label: "失業率（予測）", data: new Array(lf.years.length - 1).fill(null).concat([lf.unemploymentRate[lf.unemploymentRate.length - 1]]).concat(uForecast), borderColor: COLORS[3], borderDash: [5, 5], backgroundColor: "transparent", tension: 0.3, pointStyle: "triangle" }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: "完全失業率の予測（%）" } }, scales: { y: { title: { display: true, text: "%" } } } }
    });

    // Non-regular forecast
    var nReg = linearRegression(lf.years, lf.nonRegularRate);
    var nForecast = forecastYears.map(function (y) { return predict(nReg, y); });
    makeChart("fc-nonregular-chart", {
      type: "line",
      data: {
        labels: allYearsLF,
        datasets: [
          { label: "非正規比率（実績）", data: lf.nonRegularRate.concat(new Array(6).fill(null)), borderColor: COLORS[4], backgroundColor: "transparent", tension: 0.3 },
          { label: "非正規比率（予測）", data: new Array(lf.years.length - 1).fill(null).concat([lf.nonRegularRate[lf.nonRegularRate.length - 1]]).concat(nForecast), borderColor: COLORS[4], borderDash: [5, 5], backgroundColor: "transparent", tension: 0.3, pointStyle: "triangle" }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: "非正規雇用比率の予測（%）" } }, scales: { y: { title: { display: true, text: "%" } } } }
    });

    // Forecast table
    document.getElementById("fc-table-head").innerHTML = "<tr><th>産業</th>" + forecastYears.map(function (y) { return "<th>" + y + "年</th>"; }).join("") + "</tr>";
    var rows = indNames.map(function (name) {
      var reg = linearRegression(lf.years, lf.industries[name]);
      return "<tr><td>" + name + "（就業者・万人）</td>" + forecastYears.map(function (y) { return "<td>" + predict(reg, y) + "</td>"; }).join("") + "</tr>";
    });
    rows.push("<tr><td>失業率（%）</td>" + uForecast.map(function (v) { return "<td>" + v + "</td>"; }).join("") + "</tr>");
    rows.push("<tr><td>非正規比率（%）</td>" + nForecast.map(function (v) { return "<td>" + v + "</td>"; }).join("") + "</tr>");
    document.getElementById("fc-table-body").innerHTML = rows.join("");
  }

  // ========================================
  // 初期化
  // ========================================
  initOverview();
  initPrefecture();
  initIndustry();
  initOrganization();
  initLaborForce();
  initEmploymentTrends();
  initNationalCensus();
  initEmploymentStructure();
  initWageStructure();
  initAgeAnalysis();
  initForecast();
})();
