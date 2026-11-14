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
          rows.map(([l, g, ff]) => {
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
      const c = document.createElement('canvas'); c.width = c.height = 1080;
      const x = c.getContext('2d'), F = '"Bricolage Grotesque", system-ui, sans-serif';
      const bar = (px, w, col) => { x.fillStyle = col; x.beginPath(); if (x.roundRect) x.roundRect(px, 640, w, 36, 18); else x.rect(px, 640, w, 36); x.fill(); };
      x.fillStyle = '#2F3C55'; x.fillRect(0, 0, 1080, 1080);
      x.fillStyle = '#fff'; x.font = '600 48px ' + F; x.fillText(ctx.name, 80, 140);
      x.font = '800 118px ' + F; x.fillText(fmt(wins) + ' victoires', 80, 380); x.fillText(fmt(loss) + ' défaites', 80, 510);
      bar(80, 920, '#B8606B'); bar(80, Math.max(920 * pct / 100, 36), '#5FA88A');
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

  window.FNX = {
    parts(ctx) {
      if (!ctx.o) return {};
      const ins = insights(ctx.stats);
      return {
        insights: ins.length ? el('section', { class: 't c5' }, el('h3', {}, 'Ce que disent tes stats'), ins.map((s) => el('p', { class: 'ins' }, s))) : null,
        badges: badges(ctx.o), goals: goals(ctx), charts: charts(ctx), compare: compare(ctx), share: share(ctx),
      };
    },
  };
})();
