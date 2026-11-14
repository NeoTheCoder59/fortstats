(() => {
  const $ = (s) => document.querySelector(s);
  const nf = new Intl.NumberFormat('fr-FR');
  const fmt = (n) => nf.format(Math.round(n || 0));
  const dec = (n, d = 2) => (n || 0).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };
  const MODES = [['overall', 'Tous modes'], ['solo', 'Solo'], ['duo', 'Duo'], ['trio', 'Trio'], ['squad', 'Squad']];

  let current = null;
  let mode = 'overall';
  let sessions = [];

  function el(tag, attrs = {}, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') e.className = v;
      else e.setAttribute(k, v);
    }
    for (const k of kids.flat()) {
      if (k == null) continue;
      e.append(k.nodeType ? k : document.createTextNode(k));
    }
    return e;
  }

  // Historique : l'API ne fournit pas les parties une par une.
  // On garde un instantané à chaque visite et on compare avec le précédent.
  function snapshot() {
    const o = current.stats.overall;
    if (!o) return [];
    const key = 'fnstats:' + current.account.id;
    let list = [];
    try { list = JSON.parse(store.get(key) || '[]'); } catch {}
    const last = list[list.length - 1];
    if (!last || last.m !== o.matches) {
      list.push({ t: Date.now(), m: o.matches || 0, w: o.wins || 0, k: o.kills || 0, t10: o.top10 || 0 });
      list = list.slice(-100);
      store.set(key, JSON.stringify(list));
    }
    return list;
  }

  function tabs() {
    return el('div', { class: 'tabs', role: 'group', 'aria-label': 'Mode de jeu' },
      MODES.filter(([k]) => current.stats[k] && (k === 'overall' || current.stats[k].matches)).map(([k, label]) => {
        const b = el('button', { type: 'button', 'aria-pressed': String(k === mode) }, label);
        b.addEventListener('click', () => { mode = k; render(); });
        return b;
      }));
  }

  function historique() {
    const bloc = el('section', { class: 'bloc' },
      el('h2', {}, 'Historique des sessions'),
      el('p', {}, "Chaque fois que tu consultes ton profil, le site le compare à ta visite précédente. Si tu as joué plusieurs parties entre deux visites, elles sont regroupées sur une ligne."));
    if (sessions.length < 2) {
      bloc.append(el('p', { class: 'empty' }, "Pas encore d'historique. Joue quelques parties, puis reviens consulter ton profil : la session apparaîtra ici."));
      return bloc;
    }
    const rows = [];
    for (let i = sessions.length - 1; i >= 1; i--) {
      const a = sessions[i - 1], b = sessions[i];
      rows.push(el('tr', {},
        el('td', {}, new Date(b.t).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })),
        el('td', {}, '+' + fmt(b.m - a.m)),
        el('td', {}, '+' + fmt(b.k - a.k)),
        el('td', { class: b.w - a.w > 0 ? 'win' : '' }, '+' + fmt(b.w - a.w)),
        el('td', {}, '+' + fmt(b.t10 - a.t10))));
    }
    bloc.append(el('div', { class: 'table-wrap' }, el('table', {},
      el('thead', {}, el('tr', {}, ['Date', 'Parties', 'Kills', 'Victoires', 'Top 10'].map((h) => el('th', {}, h)))),
      el('tbody', {}, rows))));
    return bloc;
  }

  function render() {
    const out = $('#out');
    out.replaceChildren();
    const s = current.stats[mode];
    out.append(tabs());
    if (!s || !s.matches) {
      out.append(el('p', { class: 'empty' }, 'Aucune partie jouée dans ce mode.'), historique());
      return;
    }
    const wins = s.wins || 0;
    const matches = s.matches;
    const losses = Math.max(matches - wins, 0);
    const pct = (wins / matches) * 100;

    out.append(el('section', { class: 'hero' },
      el('p', { class: 'who' }, current.account.name),
      el('h2', {}, el('span', { class: 'v' }, fmt(wins) + ' victoires'), ', ', el('span', { class: 'd' }, fmt(losses) + ' défaites')),
      (() => {
        const bar = el('div', { class: 'split', role: 'img', 'aria-label': dec(pct, 1) + ' % de victoires' }, el('span', { class: 'w' }));
        bar.firstChild.style.setProperty('--p', pct + '%');
        return bar;
      })(),
      el('p', { class: 'ratio' }, 'Ratio victoires/défaites : ', el('b', {}, losses ? dec(wins / losses) : '—'), ' · taux de victoire ', el('b', {}, dec(pct, 1) + ' %'))));

    const tiles = [
      ['Parties', fmt(matches)],
      ['Kills', fmt(s.kills)],
      ['Ratio K/D', dec(s.kd)],
      ['Kills par partie', dec(s.killsPerMatch)],
      ['Temps de jeu', fmt((s.minutesPlayed || 0) / 60) + ' h'],
    ];
    out.append(el('dl', { class: 'stats' }, tiles.map(([t, v]) => el('div', {}, el('dt', {}, t), el('dd', {}, v)))),
      el('p', { class: 'note' }, "Le nombre de coffres ouverts n'est pas fourni par Epic, il ne peut donc pas être affiché."));

    const places = [['Top 1', wins], ['Top 3', s.top3], ['Top 5', s.top5], ['Top 6', s.top6], ['Top 10', s.top10], ['Top 12', s.top12], ['Top 25', s.top25]]
      .filter(([, v]) => v > 0);
    out.append(el('section', { class: 'bloc' },
      el('h2', {}, 'Classements atteints'),
      el('p', {}, 'Chaque palier inclut les paliers inférieurs : un top 1 compte aussi dans le top 10.'),
      el('div', { class: 'rows' }, places.map(([label, v]) => {
        const i = el('i');
        i.style.width = Math.min((v / matches) * 100, 100) + '%';
        return el('div', { class: 'row' }, el('span', {}, label), el('span', { class: 'bar' }, i), el('span', {}, fmt(v)));
      }))));

    out.append(historique());
  }

  async function load(name, platform) {
    const out = $('#out');
    out.replaceChildren(el('p', { class: 'status' }, 'Chargement…'));
    try {
      const r = await fetch('/api/stats?name=' + encodeURIComponent(name) + '&platform=' + encodeURIComponent(platform));
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Erreur ' + r.status);
      if (!j.stats || !j.stats.all) throw new Error('Aucune statistique disponible pour ce compte.');
      current = { account: j.account, stats: j.stats.all };
      mode = 'overall';
      sessions = snapshot();
      render();
    } catch (e) {
      out.replaceChildren(el('p', { class: 'error', role: 'alert' }, e.message));
    }
  }

  $('#form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('#name').value.trim();
    const platform = $('#platform').value;
    store.set('fnstats:last', JSON.stringify({ name, platform }));
    load(name, platform);
  });

  try {
    const last = JSON.parse(store.get('fnstats:last') || 'null');
    if (last && last.name) {
      $('#name').value = last.name;
      $('#platform').value = last.platform;
      load(last.name, last.platform);
    }
  } catch {}
})();
