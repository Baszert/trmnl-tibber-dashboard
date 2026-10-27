function run(input) {
  try {
    return build(input);
  } catch (e) {
    return { has_prices: false, error: 'nodata', lang: pickLang(input), transform_error: String(e && e.message || e) };
  }
}

function pickLang(input) {
  var t = input.trmnl || {};
  var cf = (t.plugin_settings && t.plugin_settings.custom_fields_values) || {};
  var LMAP = { english: 'en', nederlands: 'nl', deutsch: 'de', svenska: 'sv', norsk: 'no' };
  var lang = LMAP[String(cf.language || 'auto').toLowerCase()] || String((t.user && t.user.locale) || 'en').toLowerCase().slice(0, 2);
  if (lang === 'nb' || lang === 'nn') lang = 'no';
  return ['en', 'nl', 'de', 'sv', 'no'].indexOf(lang) < 0 ? 'en' : lang;
}
function transform(input) { return run(input); }

function build(input) {
  var t = input.trmnl || {};
  var cf = (t.plugin_settings && t.plugin_settings.custom_fields_values) || {};
  var viewer = input.data && input.data.viewer;
  var homes = (viewer && viewer.homes) || [];
  if (!homes.length) return { has_prices: false, error: (input.errors || !viewer) ? 'auth' : 'nohome', lang: pickLang(input) };

  var homeIdx = Math.min(Math.max(parseInt(cf.home, 10) || 1, 1), homes.length) - 1;
  var home = homes[homeIdx];
  var sub = home.currentSubscription || null;
  var pi = sub && sub.priceInfo;

  var lang = pickLang(input);
  var comma = lang !== 'en';
  var useCents = String(cf.unit || 'euro') === 'cents';
  var winHours = [1, 2, 3, 4].indexOf(parseInt(cf.window, 10)) >= 0 ? parseInt(cf.window, 10) : 2;

  function fmt(n, d) {
    if (n === null || n === undefined || isNaN(n)) return '-';
    var s = Number(n).toFixed(d);
    return comma ? s.replace('.', ',') : s;
  }
  function hhmm(iso) { return iso ? iso.slice(11, 16) : ''; }
  function ymd(iso) { return iso ? iso.slice(0, 10) : ''; }
  function sum(arr, f) { var s = 0; for (var i = 0; i < arr.length; i++) { var v = f(arr[i]); if (v) s += v; } return s; }

  var currency = (pi && pi.current && pi.current.currency) || 'EUR';
  var sym = currency === 'EUR' ? '€' : 'kr';
  var LV = { VERY_CHEAP: 0, CHEAP: 1, NORMAL: 2, EXPENSIVE: 3, VERY_EXPENSIVE: 4 };
  var scale = useCents ? 100 : 1;
  var pdec = useCents ? 1 : 3;

  var all_ = [], curIdx_ = 0, today_ = [];
  var out = {
    lang: lang,
    currency: currency,
    sym: sym,
    unit_label: useCents ? (currency === 'EUR' ? 'ct' : (currency === 'NOK' ? 'øre' : 'öre')) : sym,
    per_kwh: '/kWh',
    home: {
      name: home.appNickname || (home.address && home.address.city) || 'Home',
      city: (home.address && home.address.city) || '',
      country: (home.address && home.address.country) || '',
      type: home.type || '',
      size: home.size || null,
      residents: home.numberOfResidents || null,
      heating: home.primaryHeatingSource || '',
      fuse: home.mainFuseSize || null,
      grid: (home.meteringPointData && home.meteringPointData.gridCompany || '').replace(/\s*\(.*\)\s*$/, ''),
      area: (home.meteringPointData && home.meteringPointData.priceAreaCode) || '',
      annual_est: (home.meteringPointData && home.meteringPointData.estimatedAnnualConsumption) || null,
      status: sub ? sub.status : 'none',
      index: homeIdx + 1,
      count: homes.length,
      live: !!(home.features && home.features.realTimeConsumptionEnabled)
    },
    has_prices: false,
    error: (pi && pi.current) ? null : 'noprice'
  };

  // ---------- prices ----------
  var today = (pi && pi.today) || [];
  var tomorrow = (pi && pi.tomorrow) || [];
  var all = today.concat(tomorrow);
  if (pi && pi.current && all.length) {
    out.has_prices = true;
    all_ = all; today_ = today;
    var cur = pi.current;
    var curIdx = -1;
    for (var i = 0; i < all.length; i++) { if (all[i].startsAt === cur.startsAt) { curIdx = i; break; } }
    if (curIdx < 0) curIdx = Math.min(today.length - 1, Math.max(0, Math.floor((parseInt(hhmm(cur.startsAt).slice(0, 2), 10) * 60 + parseInt(hhmm(cur.startsAt).slice(3), 10)) / 15)));
    curIdx_ = curIdx;
    var prevIdx = curIdx > 0 ? curIdx - 1 : -1;
    var totals = today.map(function (p) { return p.total; });
    var mn = Math.min.apply(null, totals), mx = Math.max.apply(null, totals);
    var avg = sum(totals, function (v) { return v; }) / totals.length;
    var mnI = totals.indexOf(mn), mxI = totals.indexOf(mx);
    var cheaperCount = totals.filter(function (v) { return v < cur.total; }).length;
    var delta = prevIdx >= 0 ? cur.total - all[prevIdx].total : 0;

    out.price = {
      now: fmt(cur.total * scale, pdec),
      now_raw: cur.total * scale,
      level: cur.level,
      level_idx: LV[cur.level] !== undefined ? LV[cur.level] : 2,
      energy: fmt(cur.energy * scale, pdec),
      tax: fmt(cur.tax * scale, pdec),
      slot: hhmm(cur.startsAt),
      trend: delta > 0.0004 ? 'up' : (delta < -0.0004 ? 'down' : 'flat'),
      delta: fmt(Math.abs(delta) * scale, pdec),
      min: fmt(mn * scale, pdec), min_time: hhmm(today[mnI].startsAt),
      max: fmt(mx * scale, pdec), max_time: hhmm(today[mxI].startsAt),
      avg: fmt(avg * scale, pdec), avg_raw: avg * scale,
      spread: fmt((mx - mn) * scale, pdec),
      vs_avg_pct: avg ? Math.round((cur.total - avg) / avg * 100) : 0,
      cheaper_than_pct: Math.round((1 - cheaperCount / totals.length) * 100),
      energy_share_pct: cur.total ? Math.round(cur.energy / cur.total * 100) : 0
    };

    // chart arrays (one entry per quarter hour, today then tomorrow)
    out.chart = {
      labels: all.map(function (p) { return hhmm(p.startsAt); }),
      values: all.map(function (p) { return Math.round(p.total * scale * 1000) / 1000; }),
      levels: all.map(function (p) { return LV[p.level] !== undefined ? LV[p.level] : 2; }),
      now_index: curIdx,
      today_count: today.length,
      min: Math.round(mn * scale * 1000) / 1000,
      max: Math.round(mx * scale * 1000) / 1000
    };

    // tomorrow
    out.tomorrow = { available: tomorrow.length > 0 };
    if (tomorrow.length) {
      var tt = tomorrow.map(function (p) { return p.total; });
      var tmn = Math.min.apply(null, tt), tmx = Math.max.apply(null, tt);
      var tavg = sum(tt, function (v) { return v; }) / tt.length;
      out.tomorrow.avg = fmt(tavg * scale, pdec);
      out.tomorrow.min = fmt(tmn * scale, pdec);
      out.tomorrow.max = fmt(tmx * scale, pdec);
      out.tomorrow.min_time = hhmm(tomorrow[tt.indexOf(tmn)].startsAt);
      out.tomorrow.max_time = hhmm(tomorrow[tt.indexOf(tmx)].startsAt);
      out.tomorrow.vs_today_pct = avg ? Math.round((tavg - avg) / avg * 100) : 0;
      out.tomorrow.dir = tavg > avg * 1.02 ? 'up' : (tavg < avg * 0.98 ? 'down' : 'flat');
    }

    // cheapest / most expensive consecutive windows from now
    function window(hours, wantMin) {
      var n = hours * 4, best = null;
      for (var s = curIdx; s + n <= all.length; s++) {
        var tot = 0;
        for (var k = s; k < s + n; k++) tot += all[k].total;
        var a = tot / n;
        if (best === null || (wantMin ? a < best.a : a > best.a)) best = { s: s, a: a };
      }
      if (!best) return null;
      var endIso = (best.s + n < all.length) ? all[best.s + n].startsAt : null;
      var endMs = Date.parse(all[best.s].startsAt) + n * 15 * 60000;
      var startDay = best.s >= today.length ? 1 : 0;
      var endHM = endIso ? hhmm(endIso) : (function () { var d = new Date(endMs); var off = all[best.s].startsAt.slice(23); var sign = off[0] === '-' ? -1 : 1; var oh = parseInt(off.slice(1, 3), 10), om = parseInt(off.slice(4, 6), 10); var l = new Date(endMs + sign * (oh * 60 + om) * 60000); return ('0' + l.getUTCHours()).slice(-2) + ':' + ('0' + l.getUTCMinutes()).slice(-2); })();
      return {
        hours: hours,
        start: hhmm(all[best.s].startsAt),
        end: endHM,
        day: startDay,
        avg: fmt(best.a * scale, pdec),
        vs_avg_pct: avg ? Math.round((best.a - avg) / avg * 100) : 0,
        starts_in_min: Math.round((Date.parse(all[best.s].startsAt) - Date.parse(cur.startsAt)) / 60000),
        start_index: best.s,
        length: n,
        is_now: best.s === curIdx
      };
    }
    out.best = { w1: window(1, true), w2: window(2, true), w3: window(3, true), w4: window(4, true) };
    out.best.pick = out.best['w' + winHours];
    out.worst = window(2, false);
    out.win_hours = winHours;

    // next cheap slot
    var nc = -1;
    if (cur.level !== 'VERY_CHEAP' && cur.level !== 'CHEAP') {
      for (var j = curIdx + 1; j < all.length; j++) { if (all[j].level === 'VERY_CHEAP' || all[j].level === 'CHEAP') { nc = j; break; } }
    }
    out.next_cheap = nc >= 0 ? { time: hhmm(all[nc].startsAt), day: nc >= today.length ? 1 : 0, in_min: Math.round((Date.parse(all[nc].startsAt) - Date.parse(cur.startsAt)) / 60000), price: fmt(all[nc].total * scale, pdec) } : null;
    out.now_cheap = cur.level === 'VERY_CHEAP' || cur.level === 'CHEAP';

    // level distribution today (quarters per level)
    var dist = [0, 0, 0, 0, 0];
    today.forEach(function (p) { var l = LV[p.level]; if (l !== undefined) dist[l]++; });
    out.level_hours = dist.map(function (q) { return Math.round(q / 4 * 10) / 10; });
  }

  // ---------- consumption ----------
  var hc = (home.hourCons && home.hourCons.nodes) || [];
  var dc = (home.dayCons && home.dayCons.nodes) || [];
  var hp = (home.hourProd && home.hourProd.nodes) || [];
  var dp = (home.dayProd && home.dayProd.nodes) || [];

  var refIso = (pi && pi.current && pi.current.startsAt) || (hc.length ? hc[hc.length - 1].from : '');
  var todayStr = ymd(refIso), monthStr = todayStr.slice(0, 7);
  var yD = new Date(Date.UTC(+todayStr.slice(0, 4), +todayStr.slice(5, 7) - 1, +todayStr.slice(8, 10)) - 86400000);
  var yesterdayStr = yD.toISOString().slice(0, 10);

  var todayNodes = hc.filter(function (n) { return ymd(n.from) === todayStr; });
  var kwhToday = sum(todayNodes, function (n) { return n.consumption; });
  var costToday = sum(todayNodes, function (n) { return n.cost; });
  var monthDays = dc.filter(function (n) { return n.from.slice(0, 7) === monthStr; });
  var kwhMonth = sum(monthDays, function (n) { return n.consumption; }) + kwhToday;
  var costMonth = sum(monthDays, function (n) { return n.cost; }) + costToday;
  var yest = dc.filter(function (n) { return ymd(n.from) === yesterdayStr; })[0];

  var lastNode = null;
  for (var q = hc.length - 1; q >= 0; q--) { if (hc[q].consumption !== null && hc[q].consumption !== undefined) { lastNode = hc[q]; break; } }

  var last30 = dc.slice(-30);
  var kwh30 = sum(last30, function (n) { return n.consumption; });
  var cost30 = sum(last30, function (n) { return n.cost; });
  var avgDaily = last30.length ? kwh30 / last30.length : 0;
  var expDaily = out.home.annual_est ? out.home.annual_est / 365 : 0;

  out.use = {
    has_data: hc.length > 0 || dc.length > 0,
    today_kwh: fmt(kwhToday, 1), today_kwh_raw: kwhToday,
    today_cost: fmt(costToday, 2),
    yesterday_kwh: yest ? fmt(yest.consumption, 1) : '-',
    yesterday_cost: yest ? fmt(yest.cost, 2) : '-',
    month_kwh: fmt(kwhMonth, 0), month_kwh_raw: kwhMonth,
    month_cost: fmt(costMonth, 2), month_cost_raw: costMonth,
    month_days: monthDays.length + 1,
    avg_daily_kwh: fmt(avgDaily, 1),
    exp_daily_kwh: fmt(expDaily, 1),
    vs_expected_pct: expDaily ? Math.round((avgDaily - expDaily) / expDaily * 100) : 0,
    paid_per_kwh: kwhToday > 0.05 ? fmt(costToday / kwhToday * scale, pdec) : '-',
    paid_vs_market_pct: (kwhToday > 0.05 && out.price) ? Math.round((costToday / kwhToday - out.price.avg_raw / scale) / (out.price.avg_raw / scale) * 100) : null,
    paid_30d: kwh30 > 1 ? fmt(cost30 / kwh30 * scale, pdec) : '-',
    last_update: lastNode ? hhmm(lastNode.to) : '',
    last_update_day: lastNode ? ymd(lastNode.to) : ''
  };

  // last 14 days bars + today (for sparkline style charts)
  var days = dc.slice(-14).map(function (n) {
    var d = new Date(Date.UTC(+n.from.slice(0, 4), +n.from.slice(5, 7) - 1, +n.from.slice(8, 10)));
    return { dow: d.getUTCDay(), day: n.from.slice(8, 10), kwh: Math.round((n.consumption || 0) * 10) / 10, cost: Math.round((n.cost || 0) * 100) / 100 };
  });
  out.days = days;
  out.days_max_kwh = days.reduce(function (m, d) { return Math.max(m, d.kwh); }, 0);
  out.hours_today = hc.filter(function (n) { return ymd(n.from) === todayStr; }).map(function (n) { return { h: hhmm(n.from).slice(0, 2), kwh: n.consumption === null ? null : Math.round(n.consumption * 1000) / 1000 }; });

  // ---------- production (solar) ----------
  var prodToday = hp.filter(function (n) { return ymd(n.from) === todayStr; });
  var kwhP = sum(prodToday, function (n) { return n.production; });
  var profitP = sum(prodToday, function (n) { return n.profit; });
  var prodMonthDays = dp.filter(function (n) { return n.from.slice(0, 7) === monthStr; });
  var kwhPM = sum(prodMonthDays, function (n) { return n.production; }) + kwhP;
  var profitPM = sum(prodMonthDays, function (n) { return n.profit; }) + profitP;
  var anyProd = sum(dp, function (n) { return n.production; }) > 0;
  var pYest = dp.filter(function (n) { return ymd(n.from) === yesterdayStr; })[0];
  out.solar = {
    has: anyProd,
    today_kwh: fmt(kwhP, 1),
    today_profit: fmt(profitP, 2),
    month_kwh: fmt(kwhPM, 0),
    month_profit: fmt(profitPM, 2),
    yesterday_kwh: pYest ? fmt(pYest.production, 1) : '-',
    net_month: fmt(costMonth - profitPM, 2),
    net_month_raw: costMonth - profitPM,
    covered_pct: kwhMonth > 0 ? Math.round(Math.min(kwhPM / kwhMonth, 9.99) * 100) : 0
  };

  out.slots = all_.map(function (p) { return { total: p.total, startsAt: p.startsAt, level: p.level }; });
  out.cur_index = curIdx_;
  out.today_count = today_.length;
  ['chart', 'days', 'hours_today', 'days_max_kwh', 'level_hours'].forEach(function (k) { delete out[k]; });
  return out;
}
