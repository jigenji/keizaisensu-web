// 経済センサス データビューア - メインアプリケーション
(function () {
  "use strict";

  // ========================================
  // ユーティリティ
  // ========================================
  function formatNumber(n) {
    if (n == null) return "-";
    return n.toLocaleString("ja-JP");
  }

  function formatTrillion(millionYen) {
    return (millionYen / 1000000).toFixed(1);
  }

  function shortenIndustryName(name) {
    return name
      .replace("，", "・")
      .replace("（他に分類されないもの）", "（他）")
      .replace("（他に分類されるものを除く）", "")
      .replace("電気・ガス・熱供給・水道業", "電気ガス水道")
      .replace("学術研究，専門・技術サービス業", "学術研究・専門技術")
      .replace("生活関連サービス業，娯楽業", "生活関連・娯楽");
  }

  // Chart.jsのデフォルト設定
  Chart.defaults.font.family = '"Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif';
  Chart.defaults.font.size = 12;
  Chart.defaults.plugins.legend.labels.usePointStyle = true;

  const COLORS = [
    "#1a56db", "#059669", "#d97706", "#dc2626", "#7c3aed",
    "#db2777", "#0891b2", "#65a30d", "#ea580c", "#4f46e5",
    "#0d9488", "#ca8a04", "#e11d48", "#6d28d9", "#0284c7",
    "#16a34a", "#c2410c", "#9333ea"
  ];

  const CHART_INSTANCES = {};

  function getOrCreateChart(id, config) {
    if (CHART_INSTANCES[id]) {
      CHART_INSTANCES[id].destroy();
    }
    const ctx = document.getElementById(id);
    if (!ctx) return null;
    CHART_INSTANCES[id] = new Chart(ctx, config);
    return CHART_INSTANCES[id];
  }

  // ========================================
  // タブ切り替え
  // ========================================
  const navBtns = document.querySelectorAll(".nav-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  navBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var tab = btn.dataset.tab;
      navBtns.forEach(function (b) { b.classList.remove("active"); });
      tabContents.forEach(function (t) { t.classList.remove("active"); });
      btn.classList.add("active");
      document.getElementById("tab-" + tab).classList.add("active");
    });
  });

  // ========================================
  // 概要タブ
  // ========================================
  function initOverview() {
    var s = CENSUS_DATA.summary;
    document.getElementById("total-establishments").textContent = formatNumber(s.totalEstablishments);
    document.getElementById("total-employees").textContent = formatNumber(s.totalEmployees);
    document.getElementById("total-sales").textContent = formatTrillion(s.totalSales);
    document.getElementById("total-added-value").textContent = formatTrillion(s.totalAddedValue);

    // 産業別パイチャート（上位10 + その他）
    var industries = CENSUS_DATA.industries
      .filter(function (i) { return i.code !== "R"; })
      .sort(function (a, b) { return b.establishments - a.establishments; });

    var top10 = industries.slice(0, 10);
    var othersCount = industries.slice(10).reduce(function (sum, i) { return sum + i.establishments; }, 0);

    var pieLabels = top10.map(function (i) { return shortenIndustryName(i.name); });
    pieLabels.push("その他");
    var pieData = top10.map(function (i) { return i.establishments; });
    pieData.push(othersCount);

    getOrCreateChart("overview-industry-pie", {
      type: "doughnut",
      data: {
        labels: pieLabels,
        datasets: [{
          data: pieData,
          backgroundColor: COLORS.slice(0, pieLabels.length),
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "right",
            labels: { font: { size: 11 }, padding: 8 }
          },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                var total = ctx.dataset.data.reduce(function (a, b) { return a + b; }, 0);
                var pct = ((ctx.parsed / total) * 100).toFixed(1);
                return ctx.label + ": " + formatNumber(ctx.parsed) + " (" + pct + "%)";
              }
            }
          }
        }
      }
    });

    // 地方別棒グラフ
    var regions = CENSUS_DATA.regions;
    var prefMap = {};
    CENSUS_DATA.prefectures.forEach(function (p) { prefMap[p.code] = p; });

    var regionLabels = [];
    var regionValues = [];
    Object.keys(regions).forEach(function (rName) {
      regionLabels.push(rName);
      var total = regions[rName].reduce(function (sum, code) {
        return sum + (prefMap[code] ? prefMap[code].establishments : 0);
      }, 0);
      regionValues.push(total);
    });

    getOrCreateChart("overview-region-bar", {
      type: "bar",
      data: {
        labels: regionLabels,
        datasets: [{
          label: "事業所数",
          data: regionValues,
          backgroundColor: COLORS[0],
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (ctx) { return formatNumber(ctx.parsed.y) + " 事業所"; }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function (v) { return (v / 10000).toFixed(0) + "万"; }
            }
          }
        }
      }
    });
  }

  // ========================================
  // 都道府県別タブ
  // ========================================
  var prefChart = null;

  function renderPrefChart() {
    var metric = document.getElementById("pref-metric").value;
    var sortOrder = document.getElementById("pref-sort").value;

    var data = CENSUS_DATA.prefectures.slice();
    if (sortOrder === "desc") {
      data.sort(function (a, b) { return b[metric] - a[metric]; });
    } else if (sortOrder === "asc") {
      data.sort(function (a, b) { return a[metric] - b[metric]; });
    }

    var labels = data.map(function (p) { return p.name; });
    var values = data.map(function (p) { return p[metric]; });

    var metricLabels = {
      establishments: "事業所数",
      employees: "従業者数",
      sales: "売上金額（百万円）"
    };

    var unitCallbacks = {
      establishments: function (v) { return (v / 10000).toFixed(0) + "万"; },
      employees: function (v) { return (v / 10000).toFixed(0) + "万"; },
      sales: function (v) { return (v / 1000000).toFixed(0) + "兆"; }
    };

    getOrCreateChart("pref-chart", {
      type: "bar",
      data: {
        labels: labels,
        datasets: [{
          label: metricLabels[metric],
          data: values,
          backgroundColor: COLORS[0],
          borderRadius: 3
        }]
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (ctx) { return metricLabels[metric] + ": " + formatNumber(ctx.parsed.x); }
            }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            ticks: { callback: unitCallbacks[metric] }
          },
          y: {
            ticks: { font: { size: 10 } }
          }
        }
      }
    });
  }

  function renderPrefTable(filter) {
    var tbody = document.getElementById("pref-table-body");
    var data = CENSUS_DATA.prefectures;

    if (filter) {
      data = data.filter(function (p) { return p.name.indexOf(filter) !== -1; });
    }

    tbody.innerHTML = data.map(function (p) {
      var density = (p.establishments / p.area).toFixed(1);
      return "<tr>" +
        "<td>" + p.name + "</td>" +
        "<td>" + formatNumber(p.establishments) + "</td>" +
        "<td>" + formatNumber(p.employees) + "</td>" +
        "<td>" + formatNumber(p.sales) + "</td>" +
        "<td>" + density + "</td>" +
        "</tr>";
    }).join("");
  }

  function initPrefecture() {
    renderPrefChart();
    renderPrefTable("");

    document.getElementById("pref-metric").addEventListener("change", renderPrefChart);
    document.getElementById("pref-sort").addEventListener("change", renderPrefChart);
    document.getElementById("pref-search").addEventListener("input", function (e) {
      renderPrefTable(e.target.value);
    });

    // テーブルソート
    initTableSort("pref-table", CENSUS_DATA.prefectures, function (sortedData) {
      var tbody = document.getElementById("pref-table-body");
      tbody.innerHTML = sortedData.map(function (p) {
        var density = (p.establishments / p.area).toFixed(1);
        return "<tr>" +
          "<td>" + p.name + "</td>" +
          "<td>" + formatNumber(p.establishments) + "</td>" +
          "<td>" + formatNumber(p.employees) + "</td>" +
          "<td>" + formatNumber(p.sales) + "</td>" +
          "<td>" + density + "</td>" +
          "</tr>";
      }).join("");
    });
  }

  // ========================================
  // 産業別タブ
  // ========================================
  function renderIndustryChart() {
    var metric = document.getElementById("ind-metric").value;
    var data = CENSUS_DATA.industries
      .filter(function (i) { return i.code !== "R"; })
      .sort(function (a, b) { return b[metric] - a[metric]; });

    var labels = data.map(function (i) { return shortenIndustryName(i.name); });
    var values = data.map(function (i) { return i[metric]; });

    var metricLabels = {
      establishments: "事業所数",
      employees: "従業者数",
      sales: "売上金額（百万円）"
    };

    getOrCreateChart("ind-chart", {
      type: "bar",
      data: {
        labels: labels,
        datasets: [{
          label: metricLabels[metric],
          data: values,
          backgroundColor: COLORS.slice(0, data.length),
          borderRadius: 3
        }]
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (ctx) { return metricLabels[metric] + ": " + formatNumber(ctx.parsed.x); }
            }
          }
        },
        scales: {
          x: { beginAtZero: true },
          y: { ticks: { font: { size: 10 } } }
        }
      }
    });
  }

  function initIndustry() {
    renderIndustryChart();
    document.getElementById("ind-metric").addEventListener("change", renderIndustryChart);

    // 従業者数パイチャート
    var industries = CENSUS_DATA.industries.filter(function (i) { return i.code !== "R"; });
    var top8Emp = industries.slice().sort(function (a, b) { return b.employees - a.employees; }).slice(0, 8);
    var othersEmp = industries.reduce(function (s, i) { return s + i.employees; }, 0) -
      top8Emp.reduce(function (s, i) { return s + i.employees; }, 0);

    getOrCreateChart("ind-emp-pie", {
      type: "doughnut",
      data: {
        labels: top8Emp.map(function (i) { return shortenIndustryName(i.name); }).concat("その他"),
        datasets: [{
          data: top8Emp.map(function (i) { return i.employees; }).concat(othersEmp),
          backgroundColor: COLORS.slice(0, 9)
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "right", labels: { font: { size: 10 }, padding: 6 } },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                var total = ctx.dataset.data.reduce(function (a, b) { return a + b; }, 0);
                return ctx.label + ": " + formatNumber(ctx.parsed) + "人 (" + ((ctx.parsed / total) * 100).toFixed(1) + "%)";
              }
            }
          }
        }
      }
    });

    // 売上パイチャート
    var top8Sales = industries.slice().sort(function (a, b) { return b.sales - a.sales; }).slice(0, 8);
    var othersSales = industries.reduce(function (s, i) { return s + i.sales; }, 0) -
      top8Sales.reduce(function (s, i) { return s + i.sales; }, 0);

    getOrCreateChart("ind-sales-pie", {
      type: "doughnut",
      data: {
        labels: top8Sales.map(function (i) { return shortenIndustryName(i.name); }).concat("その他"),
        datasets: [{
          data: top8Sales.map(function (i) { return i.sales; }).concat(othersSales),
          backgroundColor: COLORS.slice(0, 9)
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "right", labels: { font: { size: 10 }, padding: 6 } },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                var total = ctx.dataset.data.reduce(function (a, b) { return a + b; }, 0);
                return ctx.label + ": " + formatNumber(ctx.parsed) + "百万円 (" + ((ctx.parsed / total) * 100).toFixed(1) + "%)";
              }
            }
          }
        }
      }
    });

    // 産業テーブル
    var tbody = document.getElementById("ind-table-body");
    tbody.innerHTML = industries
      .sort(function (a, b) { return b.sales - a.sales; })
      .map(function (i) {
        var perEst = (i.employees / i.establishments).toFixed(1);
        var perEmp = i.sales > 0 ? ((i.sales / i.employees) * 100).toFixed(0) : "-";
        return "<tr>" +
          "<td>" + i.name + "</td>" +
          "<td>" + formatNumber(i.establishments) + "</td>" +
          "<td>" + formatNumber(i.employees) + "</td>" +
          "<td>" + formatNumber(i.sales) + "</td>" +
          "<td>" + perEst + "</td>" +
          "<td>" + formatNumber(parseInt(perEmp)) + "</td>" +
          "</tr>";
      }).join("");
  }

  // ========================================
  // 経営組織別タブ
  // ========================================
  function initOrganization() {
    var orgs = CENSUS_DATA.organizations;

    getOrCreateChart("org-est-chart", {
      type: "doughnut",
      data: {
        labels: orgs.map(function (o) { return o.name; }),
        datasets: [{
          data: orgs.map(function (o) { return o.establishments; }),
          backgroundColor: COLORS.slice(0, orgs.length)
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "right", labels: { font: { size: 11 }, padding: 8 } },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                var total = ctx.dataset.data.reduce(function (a, b) { return a + b; }, 0);
                return ctx.label + ": " + formatNumber(ctx.parsed) + " (" + ((ctx.parsed / total) * 100).toFixed(1) + "%)";
              }
            }
          }
        }
      }
    });

    getOrCreateChart("org-emp-chart", {
      type: "doughnut",
      data: {
        labels: orgs.map(function (o) { return o.name; }),
        datasets: [{
          data: orgs.map(function (o) { return o.employees; }),
          backgroundColor: COLORS.slice(0, orgs.length)
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "right", labels: { font: { size: 11 }, padding: 8 } },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                var total = ctx.dataset.data.reduce(function (a, b) { return a + b; }, 0);
                return ctx.label + ": " + formatNumber(ctx.parsed) + "人 (" + ((ctx.parsed / total) * 100).toFixed(1) + "%)";
              }
            }
          }
        }
      }
    });

    var tbody = document.getElementById("org-table-body");
    tbody.innerHTML = orgs.map(function (o) {
      return "<tr>" +
        "<td>" + o.name + "</td>" +
        "<td>" + formatNumber(o.establishments) + "</td>" +
        "<td>" + formatNumber(o.employees) + "</td>" +
        "<td>" + formatNumber(o.sales) + "</td>" +
        "</tr>";
    }).join("");
  }

  // ========================================
  // 時系列比較タブ
  // ========================================
  function initTimeseries() {
    var ts = CENSUS_DATA.timeseries;
    var labels = ts.map(function (t) { return t.year; });

    getOrCreateChart("ts-chart", {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "事業所数",
            data: ts.map(function (t) { return t.establishments; }),
            backgroundColor: COLORS[0],
            borderRadius: 4,
            yAxisID: "y"
          },
          {
            label: "従業者数",
            data: ts.map(function (t) { return t.employees; }),
            backgroundColor: COLORS[1],
            borderRadius: 4,
            yAxisID: "y1"
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          tooltip: {
            callbacks: {
              label: function (ctx) { return ctx.dataset.label + ": " + formatNumber(ctx.parsed.y); }
            }
          }
        },
        scales: {
          y: {
            type: "linear",
            position: "left",
            title: { display: true, text: "事業所数" },
            ticks: {
              callback: function (v) { return (v / 10000).toFixed(0) + "万"; }
            }
          },
          y1: {
            type: "linear",
            position: "right",
            title: { display: true, text: "従業者数" },
            grid: { drawOnChartArea: false },
            ticks: {
              callback: function (v) { return (v / 10000).toFixed(0) + "万"; }
            }
          }
        }
      }
    });

    // 時系列テーブル
    var tbody = document.getElementById("ts-table-body");
    tbody.innerHTML = ts.map(function (t, idx) {
      var estChange = idx === 0 ? "-" :
        ((t.establishments - ts[idx - 1].establishments) / ts[idx - 1].establishments * 100).toFixed(1) + "%";
      var empChange = idx === 0 ? "-" :
        ((t.employees - ts[idx - 1].employees) / ts[idx - 1].employees * 100).toFixed(1) + "%";

      var estClass = "";
      var empClass = "";
      if (idx > 0) {
        estClass = t.establishments >= ts[idx - 1].establishments ? "change-positive" : "change-negative";
        empClass = t.employees >= ts[idx - 1].employees ? "change-positive" : "change-negative";
      }

      return "<tr>" +
        "<td>" + t.year + "</td>" +
        "<td>" + formatNumber(t.establishments) + "</td>" +
        "<td>" + formatNumber(t.employees) + "</td>" +
        "<td>" + formatNumber(t.sales) + "</td>" +
        '<td class="' + estClass + '">' + estChange + "</td>" +
        '<td class="' + empClass + '">' + empChange + "</td>" +
        "</tr>";
    }).join("");

    // 産業別時系列チャート
    var tsi = CENSUS_DATA.timeseriesIndustry;
    getOrCreateChart("ts-industry-chart", {
      type: "bar",
      data: {
        labels: tsi.labels,
        datasets: tsi.series.map(function (s, idx) {
          return {
            label: shortenIndustryName(s.name),
            data: s.values,
            backgroundColor: COLORS[idx],
            borderRadius: 3
          };
        })
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "top" },
          tooltip: {
            callbacks: {
              label: function (ctx) { return ctx.dataset.label + ": " + formatNumber(ctx.parsed.y); }
            }
          }
        },
        scales: {
          x: { stacked: false },
          y: {
            beginAtZero: true,
            ticks: {
              callback: function (v) { return (v / 10000).toFixed(0) + "万"; }
            }
          }
        }
      }
    });
  }

  // ========================================
  // テーブルソート機能
  // ========================================
  function initTableSort(tableId, originalData, renderFn) {
    var table = document.getElementById(tableId);
    if (!table) return;

    var headers = table.querySelectorAll("th[data-sort]");
    var currentSort = { key: null, dir: "asc" };

    headers.forEach(function (th) {
      th.addEventListener("click", function () {
        var key = th.dataset.sort;
        if (currentSort.key === key) {
          currentSort.dir = currentSort.dir === "asc" ? "desc" : "asc";
        } else {
          currentSort.key = key;
          currentSort.dir = "desc";
        }

        headers.forEach(function (h) { h.classList.remove("sort-asc", "sort-desc"); });
        th.classList.add("sort-" + currentSort.dir);

        var sorted = originalData.slice().sort(function (a, b) {
          var aVal, bVal;
          if (key === "name") {
            aVal = a.name;
            bVal = b.name;
            return currentSort.dir === "asc" ? aVal.localeCompare(bVal, "ja") : bVal.localeCompare(aVal, "ja");
          }
          if (key === "density") {
            aVal = a.establishments / a.area;
            bVal = b.establishments / b.area;
          } else {
            aVal = a[key] || 0;
            bVal = b[key] || 0;
          }
          return currentSort.dir === "asc" ? aVal - bVal : bVal - aVal;
        });

        renderFn(sorted);
      });
    });
  }

  // ========================================
  // 初期化
  // ========================================
  initOverview();
  initPrefecture();
  initIndustry();
  initOrganization();
  initTimeseries();
})();
