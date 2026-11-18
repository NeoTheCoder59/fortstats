// Fonctionnalités en plus : analyse, badges, objectif, courbes, comparaison, carte à partager.
(() => {
  const nf = new Intl.NumberFormat('fr-FR');
  const fmt = (n) => nf.format(Math.round(n || 0));
  const dec = (n, d = 2) => (n || 0).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };
  function el(tag, attrs = {}, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) { if (k === 'class') e.className = v; else e.setAttribute(k, v); }
    for (const k of kids.flat()) { if (k == null) continue; e.append(k.nodeType ? k : document.createTextNode(k)); }
    return e;
  }
  const rate = (s) => (s.winRate != null ? s.winRate : s.matches ? (s.wins / s.matches) * 100 : 0);

  function insights(stats) {
    const names = { solo: 'Solo', duo: 'Duo', trio: 'Trio', squad: 'Squad' };
    const m = Object.keys(names).filter((k) => stats[k] && stats[k].matches >= 20);
    if (m.length < 2) return [];
    const by = (f) => m.slice().sort((a, b) => f(stats[b]) - f(stats[a]));
    const w = by(rate), k = by((s) => s.kd || 0);
    const out = ['Ton meilleur mode est le ' + names[w[0]] + ' : ' + dec(rate(stats[w[0]]), 1) + ' % de victoires.'];
    const low = rate(stats[w[w.length - 1]]);
    if (low > 0 && rate(stats[w[0]]) / low >= 1.3) {
      out.push('Tu gagnes ' + dec(rate(stats[w[0]]) / low, 1) + ' fois plus souvent en ' + names[w[0]] + ' qu\'en ' + names[w[w.length - 1]] + '.');
    }
    if (k[0] !== w[0]) out.push('Tu élimines le plus en ' + names[k[0]] + ' (K/D de ' + dec(stats[k[0]].kd) + ').');
    return out;
  }

  const DEFS = [
    ['Victoires', (o) => o.wins, [1, 10, 50, 100, 500]],
    ['Kills', (o) => o.kills, [100, 1000, 5000, 10000]],
    ['Parties', (o) => o.matches, [100, 1000, 5000]],
    ['Heures de jeu', (o) => (o.minutesPlayed || 0) / 60, [50, 100, 500]],
    ['Ratio K/D', (o) => o.kd, [1, 2, 3]],
  ];
  function badges(o) {
    return el('section', { class: 't c12' }, el('h3', {}, 'Badges'),
      el('p', { class: 'sub' }, 'Les paliers jaunes sont débloqués.'),
      DEFS.map(([label, get, steps]) => el('div', { class: 'bd' }, el('span', {}, label),
        steps.map((s) => el('span', { class: 'chip ' + (get(o) >= s ? 'on' : 'off') }, fmt(s))))));
  }

  function goals(ctx) {
    const o = ctx.o, key = 'fnstats:objectif:' + ctx.id;
    let g = null;
    try { g = JSON.parse(store.get(key) || 'null'); } catch {}
    const L = { wins: 'Victoires', kills: 'Kills', kd: 'Ratio K/D' };
    const val = (t) => (t === 'wins' ? o.wins : t === 'kills' ? o.kills : o.kd);
    const sel = el('select', { 'aria-label': 'Objectif' }, Object.entries(L).map(([v, l]) => el('option', { value: v }, l)));
    const inp = el('input', { type: 'text', inputmode: 'decimal', placeholder: 'Cible', 'aria-label': 'Cible' });
    const btn = el('button', { type: 'button' }, 'Fixer');
    const out = el('div', {});
    const show = () => {
      out.replaceChildren();
      if (!g) return;
      const cur = val(g.type);
      const p = cur >= g.cible ? 1 : Math.max(0, (cur - g.start) / (g.cible - g.start));
      const i = el('i'); i.style.width = p * 100 + '%';
      const f = g.type === 'kd' ? dec : fmt;
      const reset = el('button', { type: 'button' }, 'Changer');
      reset.addEventListener('click', () => { g = null; store.set(key, 'null'); show(); });
      out.append(el('p', { class: 'sub' }, L[g.type] + ' : ' + f(cur) + ' sur ' + f(g.cible) + (p >= 1 ? ' : objectif atteint !' : ' (' + Math.round(p * 100) + ' %)')),
        el('div', { class: 'meter' }, i), reset);
    };
    btn.addEventListener('click', () => {
      const c = parseFloat(String(inp.value).replace(',', '.'));
      if (!(c > 0)) return;
      g = { type: sel.value, cible: c, start: val(sel.value) };
      store.set(key, JSON.stringify(g));
      show();
    });
    show();
    return el('section', { class: 't c5' }, el('h3', {}, 'Mon objectif'),
      el('p', { class: 'sub' }, 'Fixe une cible : la barre avance à chaque visite.'),
      el('div', { class: 'goal' }, sel, inp, btn), out);
  }

  const NS = 'http://www.w3.org/2000/svg';
  function chart(title, pts, f) {
    const W = 300, H = 90, P = 6, lo = Math.min(...pts), r = Math.max(...pts) - lo || 1;
    const xy = pts.map((v, i) => [P + (i * (W - 2 * P)) / (pts.length - 1), H - P - ((v - lo) / r) * (H - 2 * P)]);
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', title);
    const pl = document.createElementNS(NS, 'polyline');
    pl.setAttribute('points', xy.map((p) => p.join(',')).join(' '));
    Object.assign(pl.style, { fill: 'none', stroke: 'var(--fill)', strokeWidth: '3', strokeLinejoin: 'round', strokeLinecap: 'round', strokeDasharray: '1', strokeDashoffset: '1' });
    pl.setAttribute('pathLength', '1');
    svg.append(pl);
    return el('div', { class: 'chart' }, el('p', { class: 'lbl' }, title), el('p', { class: 'val' }, f(pts[pts.length - 1])), svg);
  }
  function charts(ctx) {
    const s = ctx.sessions;
    const bloc = el('section', { class: 't c12' }, el('h3', {}, 'Évolution'));
    if (s.length < 2) {
      bloc.append(el('p', { class: 'sub' }, 'Les courbes apparaîtront après deux visites avec de nouvelles parties jouées entre les deux.'));
      return bloc;
    }
    bloc.append(el('div', { class: 'charts' },
      chart('Ratio K/D', s.map((x) => x.k / Math.max(x.m - x.w, 1)), (v) => dec(v)),
      chart('Taux de victoire', s.map((x) => (x.w / x.m) * 100), (v) => dec(v, 1) + ' %')));
    return bloc;
  }

  function compare(ctx) {
    const sel = el('select', { 'aria-label': 'Plateforme' }, [['epic', 'Epic'], ['psn', 'PlayStation'], ['xbl', 'Xbox']].map(([v, l]) => el('option', { value: v }, l)));
    const inp = el('input', { placeholder: "Pseudo de ton ami", maxlength: '64', 'aria-label': "Pseudo de ton ami" });
    const btn = el('button', { type: 'button' }, 'Comparer');
    const res = el('div', {});
    const rows = [['Victoires', (x) => x.wins, fmt], ['Parties', (x) => x.matches, fmt], ['Taux de victoire', rate, (v) => dec(v, 1) + ' %'],
      ['Kills', (x) => x.kills, fmt], ['Ratio K/D', (x) => x.kd, (v) => dec(v)], ['Kills par partie', (x) => x.killsPerMatch, (v) => dec(v)],
      ['Heures de jeu', (x) => (x.minutesPlayed || 0) / 60, fmt]];
    const run = async () => {
      const n = inp.value.trim();
      if (!n) return;
      res.replaceChildren(el('p', { class: 'sub' }, 'Chargement…'));
      try {
        const f = await ctx.fetchStats(n, sel.value), a = ctx.o, b = f.stats.overall;
        if (!b) throw new Error('Aucune statistique pour ce joueur.');
        res.replaceChildren(el('div', { class: 'vr head' }, el('span'), el('b', {}, ctx.name), el('b', {}, f.account.name)),
          ...rows.map(([l, g, ff]) => {
            const va = g(a) || 0, vb = g(b) || 0;
            return el('div', { class: 'vr' }, el('span', {}, l), el('span', { class: va > vb ? 'lead' : '' }, ff(va)), el('span', { class: vb > va ? 'lead' : '' }, ff(vb)));
          }));
      } catch (e) { res.replaceChildren(el('p', { class: 'error', role: 'alert' }, e.message)); }
    };
    btn.addEventListener('click', run);
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
    return el('section', { class: 't c12' }, el('h3', {}, 'Comparer avec un ami'),
      el('p', { class: 'sub' }, "Ses statistiques doivent être publiques."), el('div', { class: 'cmp' }, sel, inp, btn), res);
  }

  function share(ctx) {
    const o = ctx.o, wins = o.wins || 0, loss = Math.max(o.matches - wins, 0), pct = o.matches ? (wins / o.matches) * 100 : 0;
    const img = el('button', { type: 'button' }, 'Télécharger ma carte');
    const link = el('button', { type: 'button' }, 'Copier le lien');
    img.addEventListener('click', () => {
      const css = getComputedStyle(document.documentElement), pv = (n, f) => css.getPropertyValue(n).trim() || f;
      const C = { bg: pv('--panel2', C.bg), loss: pv('--loss', C.loss), win: pv('--accent', C.win), text: pv('--text', C.text) };
      const c = document.createElement('canvas'); c.width = c.height = 1080;
      const x = c.getContext('2d'), F = '"Barlow Condensed", system-ui, sans-serif';
      const bar = (px, w, col) => { x.fillStyle = col; x.beginPath(); if (x.roundRect) x.roundRect(px, 640, w, 36, 18); else x.rect(px, 640, w, 36); x.fill(); };
      x.fillStyle = C.bg; x.fillRect(0, 0, 1080, 1080);
      x.fillStyle = C.text; x.font = '600 48px ' + F; x.fillText(ctx.name, 80, 140);
      x.fillStyle = C.win; x.font = '800 44px ' + F; x.fillText(titre(o).toUpperCase(), 80, 205); x.fillStyle = C.text;
      x.font = '800 118px ' + F; x.fillText(fmt(wins) + ' victoires', 80, 380); x.fillText(fmt(loss) + ' défaites', 80, 510);
      bar(80, 920, C.loss); bar(80, Math.max(920 * pct / 100, 36), C.win);
      x.font = '800 84px ' + F; x.fillText('K/D ' + dec(o.kd), 80, 840); x.fillText(fmt(o.kills) + ' kills', 80, 950);
      x.font = '600 36px ' + F; x.globalAlpha = .75; x.fillText(location.host, 80, 1030);
      c.toBlob(async (blob) => {
        const f = new File([blob], 'mes-stats-fortnite.png', { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [f] })) { try { await navigator.share({ files: [f] }); } catch {} return; }
        const a = el('a', { href: URL.createObjectURL(blob), download: f.name }); a.click();
      });
    });
    link.addEventListener('click', () => {
      navigator.clipboard.writeText(location.href).then(() => { link.textContent = 'Lien copié'; }, () => { link.textContent = 'Copie impossible'; });
    });
    return el('section', { class: 't c12' }, el('h3', {}, 'Partager mon profil'),
      el('p', { class: 'sub' }, 'Le lien ouvre directement ton profil. La carte est une image prête pour Discord ou une story.'),
      el('div', { class: 'acts' }, link, img));
  }


  // Titre de joueur : règles simples sur les stats de carrière.
  function titre(o) {
    const m = o.matches || 0;
    if (m < 30) return 'Le Rookie';
    if (rate(o) >= 10) return 'Le Vainqueur';
    if ((o.kd || 0) >= 2) return 'Le Sniper';
    if ((o.top10 || 0) / m >= 0.3 && rate(o) < 8) return 'Le Survivant';
    if ((o.minutesPlayed || 0) / 60 >= 300) return 'Le Marathonien';
    return 'Le Combattant';
  }

  // Prévisions : extrapolation de ton rythme entre ta première et ta dernière visite.
  function forecast(ctx) {
    const s = ctx.sessions, o = ctx.o, items = [];
    const dur = (d) => (d < 1 ? "moins d'un jour" : d < 14 ? Math.ceil(d) + ' jours' : d < 70 ? Math.round(d / 7) + ' semaines' : Math.round(d / 30) + ' mois');
    if (s.length >= 2) {
      const a = s[0], b = s[s.length - 1], days = (b.t - a.t) / 864e5;
      if (days >= 1) {
        const kr = (b.k - a.k) / days, wr = (b.w - a.w) / days;
        const nk = [1000, 2500, 5000, 10000, 25000, 50000, 100000].find((x) => x > (o.kills || 0));
        const nw = [10, 25, 50, 100, 250, 500, 1000, 2500].find((x) => x > (o.wins || 0));
        if (nk && kr > 0) items.push('À ton rythme (' + dec(kr, 1) + ' kills par jour), tu atteindras ' + fmt(nk) + ' kills dans environ ' + dur((nk - o.kills) / kr) + '.');
        if (nw && wr > 0) items.push('Prochain palier de victoires : ' + fmt(nw) + ', dans environ ' + dur((nw - o.wins) / wr) + '.');
      }
    }
    if (o.kd > 0 && o.kills > 0) {
      const target = Math.floor(o.kd * 10 + 1e-9) / 10 + 0.1, deaths = o.kills / o.kd;
      const need = Math.ceil(target * deaths - o.kills);
      if (need > 0 && isFinite(need)) items.push('Il te manque environ ' + fmt(need) + ' kills sans mourir pour passer à un K/D de ' + dec(target, 1) + '.');
    }
    if (!items.length) items.push('Pas encore assez de recul : reviens dans quelques jours pour voir ton rythme.');
    return el('section', { class: 't c5' }, el('h3', {}, 'Prévisions'), el('p', { class: 'sub' }, 'Estimations à partir de ton historique de visites.'), items.map((x) => el('p', { class: 'ins' }, x)));
  }

  // Calendrier d'activité : parties relevées entre deux visites, rattachées au jour de la visite.
  function calendar(ctx) {
    const s = ctx.sessions, per = {};
    const key = (t) => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
    for (let i = 1; i < s.length; i++) { const dm = s[i].m - s[i - 1].m; if (dm > 0) { const k = key(s[i].t); per[k] = (per[k] || 0) + dm; } }
    const WEEKS = 14, today = new Date(); today.setHours(12, 0, 0, 0);
    const start = new Date(today); start.setDate(today.getDate() - ((today.getDay() + 6) % 7) - (WEEKS - 1) * 7);
    const max = Math.max(1, ...Object.values(per));
    const cells = [];
    for (let w = 0; w < WEEKS; w++) for (let d = 0; d < 7; d++) {
      const day = new Date(start); day.setDate(start.getDate() + w * 7 + d);
      if (day > today) { cells.push(el('span', { class: 'd off' })); continue; }
      const n = per[key(day)] || 0;
      cells.push(el('span', { class: 'd l' + (n ? Math.min(4, Math.ceil((n / max) * 4)) : 0), title: day.toLocaleDateString('fr-FR', { dateStyle: 'medium' }) + ' : ' + (n ? n + ' parties' : 'aucune partie relevée') }));
    }
    let streak = 0; const c = new Date(today);
    if (!per[key(c)]) c.setDate(c.getDate() - 1);
    while (per[key(c)]) { streak++; c.setDate(c.getDate() - 1); }
    return el('section', { class: 't c7' }, el('h3', {}, "Calendrier d'activité"),
      el('p', { class: 'sub' }, 'Les parties sont rattachées au jour où tu consultes le site : plus tu viens souvent, plus il est précis.'),
      el('div', { class: 'cal', role: 'img', 'aria-label': 'Calendrier des 14 dernières semaines' }, cells),
      el('p', { class: 'ins' }, 'Série en cours : ' + streak + ' ' + (streak > 1 ? 'jours' : 'jour') + ' · ' + Object.keys(per).length + ' jours actifs'));
  }

  window.FNX = {
    titre,
    parts(ctx) {
      if (!ctx.o) return {};
      const ins = insights(ctx.stats);
      return {
        insights: ins.length ? el('section', { class: 't c5' }, el('h3', {}, 'Ce que disent tes stats'), ins.map((s) => el('p', { class: 'ins' }, s))) : null,
        badges: badges(ctx.o), goals: goals(ctx), charts: charts(ctx), compare: compare(ctx), share: share(ctx), forecast: forecast(ctx), calendar: calendar(ctx),
      };
    },
  };
})();
