(function () {
  "use strict";

  var data = window.__VALUATION__;
  if (!data || !data.indices || !data.indices.length) {
    document.body.innerHTML = '<p style="padding:24px;font:14px -apple-system,sans-serif">数据加载失败，请刷新重试。</p>';
    return;
  }

  var state = { idx: 0 };
  var ZONE_CLASS = { "低估": "low", "正常": "mid", "高估": "high" };
  var LO = data.method.low;
  var HI = data.method.high;

  function $(sel) { return document.querySelector(sel); }
  function pct(v, digits) {
    if (v === null || v === undefined) return "—";
    var n = (v * 100).toFixed(digits === undefined ? 1 : digits);
    return (v >= 0 ? "+" : "") + n + "%";
  }

  function renderTabs() {
    var nav = $("#tabs");
    nav.innerHTML = data.indices.map(function (it, i) {
      var cls = ZONE_CLASS[it.zone];
      var active = i === state.idx ? " active" : "";
      return '<button class="tab' + active + '" data-i="' + i +
        '" aria-pressed="' + (i === state.idx) + '">' +
        '<i class="dot ' + cls + '"></i>' + it.name + "</button>";
    }).join("");
    nav.querySelectorAll(".tab").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.idx = Number(btn.getAttribute("data-i"));
        render();
      });
    });
  }

  function renderHero(it) {
    var zc = ZONE_CLASS[it.zone];
    var st = it.stats[it.zone] || {};
    var text = "";
    if (st.fwd1 !== null && st.fwd1 !== undefined) {
      text = "历史上 PB 处于「" + it.zone + "」区间时，未来 1 年平均 " +
        '<b class="' + (st.fwd1 >= 0 ? "up" : "down") + '">' + pct(st.fwd1) + "</b>，" +
        "上涨概率 <b>" + Math.round(st.win1 * 100) + "%</b>（" + st.n + " 个月样本）";
      if (st.fwd3 !== null && st.fwd3 !== undefined) {
        text += "；未来 3 年平均 " +
          '<b class="' + (st.fwd3 >= 0 ? "up" : "down") + '">' + pct(st.fwd3) + "</b>";
      }
      text += "。";
      if (st.n < 36) text += " 该区间样本较少，仅供参考。";
    }

    var gap = Math.abs(it.score - it.pe_pct);
    var diverge = gap >= 20
      ? '<p class="diverge">PB 分位与 PE 分位差异较大（PB ' +
        it.score.toFixed(0) + " vs PE " + it.pe_pct.toFixed(0) +
        "）：PE 受盈利周期扰动，本指标以 PB 为准。</p>"
      : "";

    $("#hero").innerHTML =
      '<div class="hero-top">' +
        "<div>" +
          '<div class="idx-name">' + it.name + '<span class="code">' + it.code + "</span></div>" +
          '<div class="idx-sub">数据截至 ' + data.updated + "</div>" +
        "</div>" +
        '<div class="badge ' + zc + '">' + it.zone + "</div>" +
      "</div>" +
      '<div class="score-row">' +
        '<div class="score">' + it.score.toFixed(0) + "<span>/100</span></div>" +
        '<div class="score-cap">估值温度<br><span>越低越便宜</span></div>' +
      "</div>" +
      '<div class="gauge">' +
        '<div class="gauge-track">' +
          '<span class="seg low"></span><span class="seg mid"></span><span class="seg high"></span>' +
          '<i class="needle" style="left:' + it.score + '%"></i>' +
        "</div>" +
        '<div class="gauge-labels"><span>0</span><span>' + LO + "</span><span>" + HI + "</span><span>100</span></div>" +
      "</div>" +
      '<div class="metrics">' +
        "<div><span>PB</span><b>" + it.pb.toFixed(2) + "</b></div>" +
        "<div><span>PE(TTM)</span><b>" + it.pe.toFixed(1) + "</b></div>" +
        "<div><span>PE 分位</span><b>" + it.pe_pct.toFixed(0) + "</b></div>" +
      "</div>" +
      diverge +
      '<p class="takeaway">' + text + "</p>";
  }

  function renderStats(it) {
    var order = ["低估", "正常", "高估"];
    var rows = order.map(function (z) {
      var s = it.stats[z];
      if (!s || !s.n) return "";
      var cls = z === it.zone ? ' class="current"' : "";
      return "<tr" + cls + ">" +
        '<td><span class="dot ' + ZONE_CLASS[z] + '"></span> ' + z + "</td>" +
        "<td>" + s.n + "</td>" +
        '<td class="' + (s.fwd1 >= 0 ? "up" : "down") + '">' + pct(s.fwd1) + "</td>" +
        "<td>" + Math.round(s.win1 * 100) + "%</td>" +
        '<td class="' + (s.fwd3 >= 0 ? "up" : "down") + '">' + pct(s.fwd3) + "</td>" +
        "</tr>";
    }).join("");

    $("#stats").innerHTML =
      "<table>" +
        "<thead><tr><th>区间</th><th>样本</th><th>未来1年</th><th>1年胜率</th><th>未来3年</th></tr></thead>" +
        "<tbody>" + rows + "</tbody>" +
      "</table>" +
      '<p class="footnote">样本为月数；收益为含股息总收益；重叠月度观测，仅作历史统计。买入信号的胜率见上方“买入确认”。</p>';
  }

  function ciText(s) {
    if (!s || s.lo === null || s.lo === undefined) return "";
    return "，95%CI " + Math.round(s.lo * 100) + "–" + Math.round(s.hi * 100) + "%";
  }

  function renderConfirm(it) {
    var c = it.confirm || {};
    var bs = it.buy_stats || {};
    var low = bs.low || {};
    var conf = bs.confirm || {};
    var status, cls, note;

    if (it.zone !== "低估") {
      status = "不在低估区";
      cls = "mid";
      note = "当前估值不在低估区，不触发买入确认。";
    } else if (c.confirmed) {
      status = "可分批";
      cls = "low";
      note = "低估且价格已企稳。历史上此状态首次买入，未来 1 年胜率 " +
        Math.round(conf.win * 100) + "%（" + conf.n + " 次" + ciText(conf) + "）。";
    } else {
      status = "等待企稳";
      cls = "mid";
      note = "低估但价格未企稳。历史上低估区直接买入的 1 年胜率 " +
        Math.round(low.win * 100) + "%（" + low.n + " 次" + ciText(low) + "）；" +
        "等企稳并满足市场宽度后为 " + Math.round(conf.win * 100) + "%（" +
        conf.n + " 次" + ciText(conf) + "）。";
    }

    var vs = c.price >= c.ma10 ? "高于" : "低于";
    var ret3 = (c.ret3 * 100).toFixed(1) + "%";
    var smallNote = (conf.n && conf.n < 10) ? " 确认信号样本仅 " + conf.n + " 次，置信度有限。" : "";

    $("#confirm").innerHTML =
      '<div class="card-head"><h2>买入确认</h2><span class="badge sm ' + cls + '">' + status + "</span></div>" +
      '<div class="confirm-grid">' +
        "<div><span>市场宽度</span><b>" + c.breadth + " / " + c.breadth_total +
          "</b><small>至少 2 个指数低估</small></div>" +
        "<div><span>价格企稳</span><b>" + (c.stabilized ? "是" : "否") +
          "</b><small>收盘" + vs + "10月均线 · 近3月 " + ret3 + "</small></div>" +
      "</div>" +
      '<div class="buy-stats">' +
        '<div class="buy-stat"><span>低估区直接买</span><b>' +
          Math.round(low.win * 100) + "%</b><small>" + low.n +
          " 次 · 1年均值 " + pct(low.avg1) + "</small></div>" +
        '<div class="buy-stat highlight"><span>低估 + 确认</span><b>' +
          Math.round(conf.win * 100) + "%</b><small>" + conf.n +
          " 次 · 1年均值 " + pct(conf.avg1) + "</small></div>" +
      "</div>" +
      '<p class="confirm-note">' + note + smallNote + "</p>" +
      '<p class="footnote">胜率为未来 1 年上涨概率，按“区间首次买入”计，不是每月重复计数。确认 = 至少 2 个指数低估 且（收盘&gt;10月均线 或 近3月上涨）。</p>';
  }

  function renderChart(it) {
    var hist = it.history;
    var W = 400, H = 220, L = 30, R = 10, T = 12, B = 22;
    var iw = W - L - R;
    var ih = H - T - B;
    var n = hist.length;
    var x = function (i) { return L + (n <= 1 ? 0 : (i / (n - 1)) * iw); };
    var y = function (v) { return T + (1 - v / 100) * ih; };

    var path = hist.map(function (p, i) {
      return (i ? "L" : "M") + x(i).toFixed(1) + "," + y(p[1]).toFixed(1);
    }).join("");

    var ticks = [0, LO, 50, HI, 100];
    var grid = ticks.map(function (v) {
      return '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '" class="grid"/>' +
        '<text x="' + (L - 5) + '" y="' + (y(v) + 3) + '" text-anchor="end" class="ytick">' + v + "</text>";
    }).join("");

    var years = [], lastY = "";
    hist.forEach(function (p, i) {
      var yr = p[0].slice(0, 4);
      if (yr !== lastY) { years.push([i, yr]); lastY = yr; }
    });
    var step = Math.max(1, Math.ceil(years.length / 5));
    var xticks = years.filter(function (_, i) { return i % step === 0; }).map(function (pair) {
      return '<text x="' + x(pair[0]) + '" y="' + (H - 7) + '" text-anchor="middle" class="xtick">' + pair[1] + "</text>";
    }).join("");

    var last = hist[n - 1];
    $("#chart").innerHTML =
      '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="估值温度历史">' +
        '<rect x="' + L + '" y="' + y(100) + '" width="' + iw + '" height="' + (y(HI) - y(100)) + '" class="band high"/>' +
        '<rect x="' + L + '" y="' + y(HI) + '" width="' + iw + '" height="' + (y(LO) - y(HI)) + '" class="band mid"/>' +
        '<rect x="' + L + '" y="' + y(LO) + '" width="' + iw + '" height="' + (y(0) - y(LO)) + '" class="band low"/>' +
        grid +
        '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(LO) + '" y2="' + y(LO) + '" class="thr"/>' +
        '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(HI) + '" y2="' + y(HI) + '" class="thr"/>' +
        '<path d="' + path + '" class="line"/>' +
        '<circle cx="' + x(n - 1) + '" cy="' + y(last[1]) + '" r="4" class="endpoint"/>' +
        xticks +
        '<line x1="0" x2="0" y1="' + T + '" y2="' + (T + ih) + '" class="cursor" id="cursor" style="display:none"/>' +
        '<circle cx="0" cy="0" r="4" class="cursor-dot" id="cursorDot" style="display:none"/>' +
      "</svg>" +
      '<div class="tooltip" id="tooltip"></div>';

    var chart = $("#chart");
    var svg = chart.querySelector("svg");
    var cursor = chart.querySelector("#cursor");
    var dot = chart.querySelector("#cursorDot");
    var tip = chart.querySelector("#tooltip");

    function show(clientX) {
      var rect = svg.getBoundingClientRect();
      var vx = ((clientX - rect.left) / rect.width) * W;
      var idx = Math.round(((vx - L) / iw) * (n - 1));
      idx = Math.max(0, Math.min(n - 1, idx));
      var p = hist[idx];
      cursor.setAttribute("x1", x(idx));
      cursor.setAttribute("x2", x(idx));
      cursor.style.display = "";
      dot.setAttribute("cx", x(idx));
      dot.setAttribute("cy", y(p[1]));
      dot.style.display = "";
      tip.style.display = "block";
      tip.innerHTML = "<b>" + p[0] + "</b><br>估值温度 " + p[1].toFixed(0) +
        "<br>PB " + p[2].toFixed(2) + " · PE " + p[3].toFixed(1);
      var px = (x(idx) / W) * rect.width;
      tip.style.left = Math.min(Math.max(px + 12, 6), Math.max(6, rect.width - 150)) + "px";
      tip.style.top = "6px";
    }

    function hide() {
      cursor.style.display = "none";
      dot.style.display = "none";
      tip.style.display = "none";
    }

    svg.addEventListener("pointermove", function (e) { show(e.clientX); });
    svg.addEventListener("pointerdown", function (e) { show(e.clientX); });
    svg.addEventListener("pointerleave", hide);
    svg.addEventListener("touchstart", function (e) {
      if (e.touches[0]) show(e.touches[0].clientX);
    }, { passive: true });
    svg.addEventListener("touchmove", function (e) {
      if (e.touches[0]) show(e.touches[0].clientX);
    }, { passive: true });
  }

  function render() {
    var it = data.indices[state.idx];
    renderTabs();
    renderHero(it);
    renderConfirm(it);
    renderChart(it);
    renderStats(it);
    document.title = it.name + " " + it.zone + " · A股指数估值红绿灯";
    $("#updated").textContent = data.updated;
    $("#updated2").textContent = data.updated;
  }

  render();
})();
