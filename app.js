(() => {
  const $ = (s) => document.querySelector(s);
  const nf = new Intl.NumberFormat('fr-FR');
  const fmt = (n) => nf.format(Math.round(n || 0));
  const dec = (n, d = 2) => (n || 0).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
  const plural = (n, un, plus) => (n > 1 ? plus : un);
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };
  const getPlatform = () => document.querySelector('input[name=platform]:checked').value;
  const setPlatform = (v) => {
    const r = document.querySelector('input[name=platform][value="' + v + '"]');
    if (r) r.checked = true;
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
        const b = el('button', { type: 'button', class: 'pill', 'aria-pressed': String(k === mode) }, label);
        b.addEventListener('click', () => { mode = k; render(); });
        return b;
      }));
  }

  function tile(label, value, sub) {
    return el('div', { class: 't k' }, el('p', { class: 'lbl' }, label), el('p', { class: 'val' }, value), sub ? el('p', { class: 'sub' }, sub) : null);
  }

  // Coffres : Epic ne les expose pas dans l'API publique. Saisie manuelle, enregistrée dans le navigateur.
  function coffres() {
    const key = 'fnstats:coffres:' + current.account.id;
    let v = { t: 0, r: 0, s: 0 };
    try { v = { ...v, ...JSON.parse(store.get(key) || '{}') }; } catch {}
    const total = el('b', {}, '');
    const chance = el('p', { class: 'sub' }, '');
    const maj = () => {
      const n = v.t + v.r + v.s;
      total.textContent = fmt(n);
      chance.textContent = n ? "Chance d'avoir déjà trouvé le jeton de la boutique pirate : " + dec(-Math.expm1(n * Math.log1p(-1 / 137500)) * 100, 2) + ' % (estimation avec un taux de 1 sur 137 500 par coffre, relayé par des sites tiers).' : '';
      store.set(key, JSON.stringify(v));
    };
    const ligne = (id, label, plafond) => {
      const input = el('input', { type: 'number', min: '0', inputmode: 'numeric', 'aria-label': label });
      input.value = v[id];
      input.addEventListener('input', () => { v[id] = Math.max(0, parseInt(input.value, 10) || 0); maj(); });
      const plus = (n) => {
        const b = el('button', { type: 'button' }, '+' + n);
        b.addEventListener('click', () => { v[id] += n; input.value = v[id]; maj(); });
        return b;
      };
      return el('div', { class: 'coffre' }, el('span', {}, label, el('small', {}, 'Quête plafonnée à ' + plafond)), input, plus(1), plus(5));
    };
    const bloc = el('section', { class: 't coffres-t' },
      el('h3', {}, 'Coffres ouverts cette saison'),
      el('p', { class: 'sub' }, "Epic ne transmet pas ce chiffre aux sites tiers. Dans le lobby, ouvre Quêtes, puis Chasse au trésor (Treasure Hunt), recopie tes compteurs ici et ajoute tes coffres après chaque session."),
      ligne('t', 'Coffres au trésor', '1 000'),
      ligne('r', 'Coffres rares', '100'),
      ligne('s', 'Coffres à esprit', '100'),
      el('p', { class: 'total' }, 'Total ', total), chance);
    maj();
    return bloc;
  }

  function historique() {
    const bloc = el('section', { class: 't hist' },
      el('h3', {}, 'Historique des sessions'),
      el('p', { class: 'sub' }, "À chaque visite, le site compare ton profil à la visite précédente. Les parties jouées entre deux visites sont regroupées sur une ligne."));
    if (sessions.length < 2) {
      bloc.append(el('p', { class: 'empty' }, "Pas encore d'historique. Joue quelques parties, puis reviens consulter ton profil : la session apparaîtra ici."));
      return bloc;
    }
    const items = [];
    for (let i = sessions.length - 1; i >= 1; i--) {
      const a = sessions[i - 1], b = sessions[i];
      const dm = b.m - a.m, dk = b.k - a.k, dw = b.w - a.w, dt = b.t10 - a.t10;
      items.push(el('li', {},
        el('time', {}, new Date(b.t).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })),
        el('span', { class: 'chips' },
          el('span', { class: 'chip' }, '+' + fmt(dm) + ' ' + plural(dm, 'partie', 'parties')),
          el('span', { class: 'chip' }, '+' + fmt(dk) + ' ' + plural(dk, 'kill', 'kills')),
          dw > 0 ? el('span', { class: 'chip win' }, '+' + fmt(dw) + ' ' + plural(dw, 'victoire', 'victoires')) : null,
          el('span', { class: 'chip' }, '+' + fmt(dt) + ' top 10'))));
    }
    bloc.append(el('ul', { class: 'sessions' }, items));
    return bloc;
  }

  function render() {
    const out = $('#out');
    out.replaceChildren(tabs());
    const s = current.stats[mode];
    if (!s || !s.matches) {
      out.append(el('p', { class: 'empty' }, 'Aucune partie jouée dans ce mode.'), el('div', { class: 'grid' }, coffres(), historique()));
      return;
    }
    const wins = s.wins || 0;
    const matches = s.matches;
    const losses = Math.max(matches - wins, 0);
    const pct = (wins / matches) * 100;

    const bar = el('div', { class: 'split', role: 'img', 'aria-label': dec(pct, 1) + ' % de victoires' }, el('span', { class: 'w' }));
    bar.firstChild.style.setProperty('--p', pct + '%');

    const hero = el('section', { class: 't hero' },
      el('p', { class: 'who' }, current.account.name),
      el('h2', {}, fmt(wins) + ' ' + plural(wins, 'victoire', 'victoires') + ' et ' + fmt(losses) + ' ' + plural(losses, 'défaite', 'défaites')),
      bar,
      el('p', { class: 'legend' },
        el('span', {}, el('span', { class: 'dot w' }), 'Victoires'),
        el('span', {}, el('span', { class: 'dot l' }), 'Défaites')));

    const ratio = el('div', { class: 't ratio-t' },
      el('p', { class: 'lbl' }, 'Ratio victoires/défaites'),
      el('div', {}, el('p', { class: 'val' }, losses ? dec(wins / losses) : '—'), el('p', { class: 'sub' }, dec(pct, 1) + ' % de victoires')));

    const places = [['Top 1', wins], ['Top 3', s.top3], ['Top 5', s.top5], ['Top 6', s.top6], ['Top 10', s.top10], ['Top 12', s.top12], ['Top 25', s.top25]]
      .filter(([, v]) => v > 0);
    const place = el('section', { class: 't place' },
      el('h3', {}, 'Classements atteints'),
      el('p', { class: 'sub' }, 'Chaque palier inclut les précédents : un top 1 compte aussi dans le top 10.'),
      el('div', { class: 'rows' }, places.map(([label, v]) => {
        const i = el('i');
        i.style.width = Math.min((v / matches) * 100, 100) + '%';
        return el('div', { class: 'row' }, el('span', {}, label), el('span', { class: 'bar' }, i), el('span', {}, fmt(v)));
      })));

    out.append(el('div', { class: 'grid' },
      hero, ratio,
      tile('Parties', fmt(matches)),
      tile('Kills', fmt(s.kills), dec(s.killsPerMatch) + ' par partie'),
      tile('Ratio K/D', dec(s.kd)),
      tile('Temps de jeu', fmt((s.minutesPlayed || 0) / 60) + ' h'),
      place, coffres(),
      ...(window.FNX ? window.FNX.tiles({ id: current.account.id, name: current.account.name, o: current.stats.overall, stats: current.stats, sessions, fetchStats }) : []),
      historique()));
  }

  async function fetchStats(name, platform) {
    const r = await fetch('/api/stats?name=' + encodeURIComponent(name) + '&platform=' + encodeURIComponent(platform));
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'Erreur ' + r.status);
    if (!j.stats || !j.stats.all) throw new Error('Aucune statistique disponible pour ce compte.');
    return { account: j.account, stats: j.stats.all };
  }

  async function load(name, platform) {
    const out = $('#out');
    out.replaceChildren(el('p', { class: 'status' }, 'Chargement…'));
    try {
      current = await fetchStats(name, platform);
      try { history.replaceState(null, '', '?name=' + encodeURIComponent(name) + '&platform=' + platform); } catch {}
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
    const platform = getPlatform();
    store.set('fnstats:last', JSON.stringify({ name, platform }));
    load(name, platform);
  });

  try {
    const q = new URLSearchParams(location.search);
    const last = q.get('name') ? { name: q.get('name'), platform: q.get('platform') || 'epic' } : JSON.parse(store.get('fnstats:last') || 'null');
    if (last && last.name) {
      $('#name').value = last.name;
      setPlatform(last.platform);
      load(last.name, last.platform);
    }
  } catch {}
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
