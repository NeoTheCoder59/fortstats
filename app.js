(() => {
  const $ = (s) => document.querySelector(s);
  const nf = new Intl.NumberFormat('fr-FR');
  const fmt = (n) => nf.format(Math.round(n || 0));
  const dec = (n, d = 2) => (n || 0).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
  const plural = (n, un, plus) => (n > 1 ? plus : un);
  const rate = (s) => (s.winRate != null ? s.winRate : s.matches ? (s.wins / s.matches) * 100 : 0);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };
  const getPlatform = () => document.querySelector('input[name=platform]:checked').value;
  const setPlatform = (v) => { const r = document.querySelector('input[name=platform][value="' + v + '"]'); if (r) r.checked = true; };
  const MODES = [['overall', 'Tous modes'], ['solo', 'Solo'], ['duo', 'Duo'], ['trio', 'Trio'], ['squad', 'Squad']];
  const NAMES = { solo: 'Solo', duo: 'Duo', trio: 'Trio', squad: 'Squad' };
  const VIEWS = [['apercu', 'Aperçu'], ['progression', 'Progression'], ['coffres', 'Coffres'], ['amis', 'Amis et partage'], ['classement', 'Classement'], ['bilan', 'Bilan de saison'], ['boutique', 'Boutique']];
  const FREE = ['classement', 'boutique'];

  let current = null, mode = 'overall', view = 'apercu', sessions = [], timer = null;

  function el(tag, attrs = {}, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) { if (k === 'class') e.className = v; else e.setAttribute(k, v); }
    for (const k of kids.flat()) { if (k == null) continue; e.append(k.nodeType ? k : document.createTextNode(k)); }
    return e;
  }
  const S = (t, a = {}) => {
    const e = document.createElementNS('http://www.w3.org/2000/svg', t);
    for (const [k, v] of Object.entries(a)) e.setAttribute(k, v);
    return e;
  };
  async function jf(url, opts = {}) {
    const r = await fetch(url, { method: opts.method || 'GET', headers: opts.body ? { 'Content-Type': 'application/json' } : undefined, body: opts.body ? JSON.stringify(opts.body) : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'Erreur ' + r.status);
    return j;
  }

  function count(node, target, f) {
    if (reduce || !target) { node.textContent = f(target); return; }
    node.textContent = f(0);
    const t0 = performance.now();
    const step = (now) => {
      const p = Math.min((now - t0) / 900, 1);
      node.textContent = f(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // Historique : un instantané à chaque visite, comparé au précédent.
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

  /* ---------- Aperçu ---------- */
  function ring(pct) {
    const R = 74, C = 2 * Math.PI * R, target = C * (1 - pct / 100);
    const prg = S('circle', { cx: 90, cy: 90, r: R, class: 'prg' });
    prg.style.strokeDasharray = C;
    prg.style.strokeDashoffset = reduce ? target : C;
    if (!reduce) requestAnimationFrame(() => requestAnimationFrame(() => { prg.style.strokeDashoffset = target; }));
    const svg = S('svg', { viewBox: '0 0 180 180', class: 'ring', role: 'img', 'aria-label': dec(pct, 1) + ' % de victoires' });
    svg.append(S('circle', { cx: 90, cy: 90, r: R, class: 'trk' }), prg);
    return svg;
  }

  function hero(s) {
    const wins = s.wins || 0, m = s.matches, losses = Math.max(m - wins, 0), pct = m ? (wins / m) * 100 : 0;
    const wN = el('span'), lN = el('span'), pN = el('b');
    const bp = current.battlePass;
    const bpLine = bp && bp.level != null ? el('p', { class: 'ratio' }, 'Passe de combat : niveau ', el('b', {}, fmt(bp.level))) : null;
    count(wN, wins, fmt); count(lN, losses, fmt); count(pN, pct, (v) => dec(v, 1) + ' %');
    return el('section', { class: 't hero' },
      el('div', {},
        el('p', { class: 'who' }, current.account.name, window.FNX && current.stats.overall ? el('span', { class: 'titre' }, window.FNX.titre(current.stats.overall)) : null),
        el('h2', {}, wN, ' ' + plural(wins, 'victoire', 'victoires') + ' et ', lN, ' ' + plural(losses, 'défaite', 'défaites')),
        el('p', { class: 'ratio' }, 'Ratio victoires/défaites : ', el('b', {}, losses ? dec(wins / losses) : '—'), ' sur ' + fmt(m) + ' parties'),
        bpLine),
      el('div', { class: 'ringwrap' }, ring(pct), el('div', { class: 'ringtxt' }, pN, el('small', {}, 'de victoires'))));
  }

  function tile(label, target, f, sub) {
    const v = el('p', { class: 'val' });
    count(v, target, f);
    return el('div', { class: 't k' }, el('p', { class: 'lbl' }, label), v, sub ? el('p', { class: 'sub' }, sub) : null);
  }

  function classements(s) {
    const places = [['Top 1', s.wins], ['Top 3', s.top3], ['Top 5', s.top5], ['Top 6', s.top6], ['Top 10', s.top10], ['Top 12', s.top12], ['Top 25', s.top25]].filter(([, v]) => v > 0);
    return el('section', { class: 't c7' },
      el('h3', {}, 'Classements atteints'),
      el('p', { class: 'sub' }, 'Chaque palier inclut les précédents : un top 1 compte aussi dans le top 10.'),
      el('div', { class: 'rows' }, places.map(([label, v], n) => {
        const i = el('i');
        i.style.width = Math.min((v / s.matches) * 100, 100) + '%';
        i.style.animationDelay = n * 70 + 'ms';
        return el('div', { class: 'row' }, el('span', {}, label), el('span', { class: 'bar' }, i), el('span', {}, fmt(v)));
      })));
  }

  function modeTabs() {
    return el('div', { class: 'tabs', role: 'group', 'aria-label': 'Mode de jeu' },
      MODES.filter(([k]) => current.stats[k] && (k === 'overall' || current.stats[k].matches)).map(([k, label]) => {
        const b = el('button', { type: 'button', class: 'pill', 'aria-pressed': String(k === mode) }, label);
        b.addEventListener('click', () => { mode = k; render(); });
        return b;
      }));
  }

  function apercu(X) {
    const s = current.stats[mode];
    if (!s || !s.matches) return [modeTabs(), el('p', { class: 'empty c12' }, 'Aucune partie jouée dans ce mode.')];
    const place = classements(s);
    if (!X.insights || mode !== 'overall') place.className = 't c12';
    return [modeTabs(), hero(s),
      tile('Parties', s.matches, fmt),
      tile('Kills', s.kills, fmt, dec(s.killsPerMatch) + ' par partie'),
      tile('Ratio K/D', s.kd, (v) => dec(v)),
      tile('Temps de jeu', (s.minutesPlayed || 0) / 60, (v) => fmt(v) + ' h'),
      place, mode === 'overall' ? X.insights : null];
  }

  /* ---------- Coffres (saisie manuelle) ---------- */
  function coffres() {
    const key = 'fnstats:coffres:' + current.account.id;
    let v = { t: 0, r: 0, s: 0 };
    try { v = { ...v, ...JSON.parse(store.get(key) || '{}') }; } catch {}
    const total = el('b', {});
    const chance = el('p', { class: 'sub' });
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
      const plus = (n) => { const b = el('button', { type: 'button' }, '+' + n); b.addEventListener('click', () => { v[id] += n; input.value = v[id]; maj(); }); return b; };
      return el('div', { class: 'coffre' }, el('span', {}, label, el('small', {}, 'Quête plafonnée à ' + plafond)), input, plus(1), plus(5));
    };
    const bloc = el('section', { class: 't coffres-t' },
      el('h3', {}, 'Coffres ouverts cette saison'),
      el('p', { class: 'sub' }, "Epic ne transmet pas ce chiffre aux sites tiers. Dans le lobby, ouvre Quêtes, puis Chasse au trésor (Treasure Hunt), recopie tes compteurs ici et ajoute tes coffres après chaque session."),
      ligne('t', 'Coffres au trésor', '1 000'), ligne('r', 'Coffres rares', '100'), ligne('s', 'Coffres à esprit', '100'),
      el('p', { class: 'total' }, 'Total ', total), chance);
    maj();
    return bloc;
  }

  /* ---------- Historique ---------- */
  function historique() {
    const bloc = el('section', { class: 't c7' },
      el('h3', {}, 'Historique des sessions'),
      el('p', { class: 'sub' }, "À chaque visite, le site compare ton profil à la précédente. Les parties jouées entre deux visites sont regroupées sur une ligne."));
    if (sessions.length < 2) {
      bloc.append(el('p', { class: 'empty' }, "Pas encore d'historique. Joue quelques parties, puis reviens : la session apparaîtra ici."));
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

  /* ---------- Classement entre amis ---------- */
  const normCode = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const METRICS = [
    ['wins', 'Victoires', (m) => m.s.wins, fmt],
    ['kills', 'Kills', (m) => m.s.kills, fmt],
    ['kd', 'Ratio K/D', (m) => m.s.kd, (v) => dec(v)],
    ['rate', 'Taux de victoire', (m) => m.s.winRate, (v) => dec(v, 1) + ' %'],
    ['gain', 'Victoires depuis l’inscription', (m) => m.s.wins - (m.base ? m.base.wins : m.s.wins), (v) => '+' + fmt(v)],
  ];

  function classement() {
    const box = el('section', { class: 't c12' });
    const readGroups = () => { try { return JSON.parse(store.get('fnstats:groupes') || '[]'); } catch { return []; } };
    let groups = readGroups();
    const saveGroups = () => store.set('fnstats:groupes', JSON.stringify(groups));
    const addGroup = (d) => {
      const g = groups.find((x) => x.code === d.code);
      if (g) g.nom = d.nom; else groups.push({ code: d.code, nom: d.nom });
      saveGroups();
    };
    const urlCode = normCode(new URLSearchParams(location.search).get('groupe'));
    if (urlCode && !groups.some((g) => g.code === urlCode)) { groups.push({ code: urlCode, nom: 'Groupe ' + urlCode }); saveGroups(); }
    let active = urlCode || store.get('fnstats:groupe-actif');
    if (!groups.some((g) => g.code === active)) active = groups[0] ? groups[0].code : null;
    let metric = 'wins', data = null;

    const head = el('div'), board = el('div');
    box.append(el('h3', {}, 'Classement entre amis'),
      el('p', { class: 'sub' }, "Crée un groupe et partage le lien ou le code : chacun s'ajoute avec son pseudo. Les stats sont récupérées par le serveur, personne ne peut les modifier."),
      head, board);
    const msg = (t, err) => board.replaceChildren(el('p', { class: err ? 'error' : 'sub' }, t));
    const myKey = () => (current ? current.platform + ':' + current.account.id : null);

    async function joinSelf(code, who) {
      const w = who || { name: current.account.name, platform: current.platform };
      data = await jf('/api/groupe', { method: 'POST', body: { action: 'join', code, name: w.name, platform: w.platform } });
      addGroup(data); active = code; store.set('fnstats:groupe-actif', code);
      renderHead(); renderBoard();
    }
    async function open(code) {
      active = code; store.set('fnstats:groupe-actif', code);
      renderHead(); msg('Chargement du classement…');
      try { data = await jf('/api/groupe?code=' + encodeURIComponent(code)); addGroup(data); renderHead(); renderBoard(); }
      catch (e) {
        if (/introuvable/i.test(e.message)) { groups = groups.filter((g) => g.code !== code); saveGroups(); active = null; renderHead(); }
        msg(e.message, true);
      }
    }
    function renderHead() {
      const pills = el('div', { class: 'tabs' }, groups.map((g) => {
        const b = el('button', { type: 'button', class: 'pill', 'aria-pressed': String(g.code === active) }, g.nom);
        b.addEventListener('click', () => open(g.code));
        return b;
      }));
      const nom = el('input', { placeholder: 'Les potes du lundi', maxlength: '40' });
      const cb = el('button', { type: 'button' }, 'Créer');
      cb.addEventListener('click', async () => {
        const n = nom.value.trim(); if (!n) return;
        try {
          const d = await jf('/api/groupe', { method: 'POST', body: { action: 'create', nom: n } });
          addGroup(d);
          if (current) await joinSelf(d.code); else open(d.code);
        } catch (e) { msg(e.message, true); }
      });
      const code = el('input', { placeholder: 'ABC123', maxlength: '8' });
      const jb = el('button', { type: 'button' }, 'Rejoindre');
      jb.addEventListener('click', async () => {
        const c = normCode(code.value); if (!c) return;
        try { if (current) await joinSelf(c); else open(c); } catch (e) { msg(e.message, true); }
      });
      head.replaceChildren(...[groups.length ? pills : null,
        el('div', { class: 'gform' }, el('label', {}, 'Nouveau groupe', nom), cb),
        el('div', { class: 'gform' }, el('label', {}, 'Rejoindre avec un code', code), jb)].filter(Boolean));
    }
    function renderBoard() {
      if (!data) return;
      const mt = METRICS.find((m) => m[0] === metric);
      const rows = data.members.slice().sort((a, b) => mt[2](b) - mt[2](a));
      const mine = myKey();
      const tabs = el('div', { class: 'tabs' }, METRICS.map(([k, label]) => {
        const b = el('button', { type: 'button', class: 'pill', 'aria-pressed': String(k === metric) }, label);
        b.addEventListener('click', () => { metric = k; renderBoard(); });
        return b;
      }));
      const copy = el('button', { type: 'button', class: 'mini' }, 'Copier le lien du groupe');
      copy.addEventListener('click', () => {
        navigator.clipboard.writeText(location.origin + '/?groupe=' + data.code).then(() => { copy.textContent = 'Lien copié'; }, () => { copy.textContent = 'Copie impossible'; });
      });
      const actions = el('div', { class: 'acts' }, copy);
      if (current && !data.members.some((m) => m.key === mine)) {
        const add = el('button', { type: 'button', class: 'mini' }, "M'ajouter à ce groupe");
        add.addEventListener('click', () => joinSelf(data.code).catch((e) => msg(e.message, true)));
        actions.append(add);
      }
      const list = el('ol', { class: 'board' }, rows.map((m, i) => {
        const rf = el('button', { type: 'button', class: 'rf', 'aria-label': 'Actualiser ' + m.name, title: 'Actualiser les stats' }, '↻');
        rf.addEventListener('click', () => { rf.disabled = true; joinSelf(data.code, m).catch((e) => msg(e.message, true)); });
        const r = el('li', { class: 'rk' + (m.key === mine ? ' me' : '') },
          el('span', { class: 'rank' }, String(i + 1)),
          el('span', { class: 'who2' }, m.name, el('small', {}, { epic: 'Epic', psn: 'PlayStation', xbl: 'Xbox' }[m.platform] + ' · ' + fmt(m.s.matches) + ' parties')),
          el('span', { class: 'val2' }, mt[3](mt[2](m))), rf);
        r.style.setProperty('--i', i);
        return r;
      }));
      board.replaceChildren(el('p', { class: 'sub' }, data.nom + ' · code ' + data.code + (data.info ? ' · ' + data.info : '')), tabs,
        rows.length ? list : el('p', { class: 'empty' }, "Personne dans ce groupe pour l'instant."), actions);
    }
    renderHead();
    if (active) open(active); else msg('Crée un groupe ou rejoins-en un avec un code.');
    return box;
  }

  /* ---------- Bilan de saison ---------- */
  function slides(sn, life) {
    const o = sn.s.overall || {}, m = o.matches || 0, w = o.wins || 0, h = (o.minutesPlayed || 0) / 60;
    const best = ['solo', 'duo', 'trio', 'squad'].filter((k) => sn.s[k] && sn.s[k].matches >= 5).sort((a, b) => rate(sn.s[b]) - rate(sn.s[a]))[0];
    return [
      { k: 'Bilan de saison', big: current.account.name, plain: true, txt: 'Ton récapitulatif, en quelques chiffres.' },
      { k: 'Tu as joué', n: m, f: fmt, txt: 'parties, soit ' + dec(h, 1) + ' heures de jeu (' + dec(h / 24, 1) + ' jours complets).' },
      { k: 'Tu as gagné', n: w, f: fmt, txt: dec(m ? (w / m) * 100 : 0, 1) + ' % de victoires' + (w ? ' : une partie sur ' + dec(m / w, 1) + '.' : '.') },
      { k: 'Tu as éliminé', n: o.kills || 0, f: fmt, txt: 'adversaires, avec un K/D de ' + dec(o.kd) + ' (' + dec(o.killsPerMatch) + ' par partie).' },
      best ? { k: 'Ton meilleur mode', big: NAMES[best], plain: true, txt: dec(rate(sn.s[best]), 1) + ' % de victoires sur ' + fmt(sn.s[best].matches) + ' parties.' } : null,
      { k: 'Dans le top 10', n: o.top10 || 0, f: fmt, txt: 'fois, dont ' + fmt(o.top25 || 0) + ' dans le top 25.' },
      life && life.matches && sn.live ? { k: 'Part de ta carrière', n: (m / life.matches) * 100, f: (v) => dec(v, 1) + ' %', txt: 'de toutes tes parties ont été jouées cette saison.' } : null,
    ].filter(Boolean);
  }

  function bilan() {
    const box = el('section', { class: 't c12' }, el('h3', {}, 'Bilan de saison'), el('p', { class: 'sub' }, 'Chargement du bilan…'));
    const key = 'fnstats:bilan:' + current.account.id, arcKey = 'fnstats:bilanarch:' + current.account.id;
    fetchStats(current.account.name, current.platform, 'season').then((d) => {
      const live = d.stats;
      const m = (live.overall && live.overall.matches) || 0;
      let stored = null, arch = [];
      try { stored = JSON.parse(store.get(key) || 'null'); } catch {}
      try { arch = JSON.parse(store.get(arcKey) || '[]'); } catch {}
      // Si le compteur de parties repart à zéro, une nouvelle saison a commencé : on archive l'ancien bilan.
      if (stored && ((stored.s.overall && stored.s.overall.matches) || 0) > m) { arch.push(stored); arch = arch.slice(-6); store.set(arcKey, JSON.stringify(arch)); }
      const snap = { at: Date.now(), s: live, live: true };
      store.set(key, JSON.stringify(snap));
      const options = [{ label: 'Saison en cours', sn: snap }, ...arch.slice().reverse().map((a) => ({ label: 'Terminée · ' + new Date(a.at).toLocaleDateString('fr-FR', { dateStyle: 'medium' }), sn: { ...a, live: false } }))];
      let sel = 0, i = 0;
      const pills = el('div', { class: 'tabs' }), stage = el('div', { class: 'stage' }), dots = el('div', { class: 'dots' });
      const prev = el('button', { type: 'button', class: 'mini' }, 'Précédent'), next = el('button', { type: 'button', class: 'mini' }, 'Suivant');
      let list = [];
      const show = () => {
        const s = list[i];
        const big = el('p', { class: 'big' });
        if (s.plain) big.textContent = s.big; else count(big, s.n, s.f);
        stage.replaceChildren(el('p', { class: 'kick' }, s.k), big, el('p', { class: 'cap' }, s.txt));
        stage.classList.remove('in'); void stage.offsetWidth; stage.classList.add('in');
        dots.replaceChildren(...list.map((_, n) => { const b = el('button', { type: 'button', class: 'dot2', 'aria-label': 'Diapositive ' + (n + 1), 'aria-current': String(n === i) }); b.addEventListener('click', () => { i = n; show(); }); return b; }));
        prev.disabled = i === 0; next.disabled = i === list.length - 1;
      };
      const pick = (n) => {
        sel = n; i = 0;
        const sn = options[n].sn;
        pills.replaceChildren(...options.map((o, k) => { const b = el('button', { type: 'button', class: 'pill', 'aria-pressed': String(k === sel) }, o.label); b.addEventListener('click', () => pick(k)); return b; }));
        if (!((sn.s.overall && sn.s.overall.matches) > 0)) { list = [{ k: 'Bilan de saison', big: '—', plain: true, txt: "Aucune partie jouée sur cette période pour l'instant." }]; }
        else list = slides(sn, current.stats.overall);
        show();
      };
      prev.addEventListener('click', () => { if (i > 0) { i--; show(); } });
      next.addEventListener('click', () => { if (i < list.length - 1) { i++; show(); } });
      box.replaceChildren(el('h3', {}, 'Bilan de saison'),
        el('p', { class: 'sub' }, "Les stats de saison viennent de l'API Fortnite. Quand une nouvelle saison démarre, ton ancien bilan est archivé automatiquement à ta prochaine visite."),
        pills, stage, el('div', { class: 'stepper' }, prev, dots, next));
      if (arch.length) box.append(saisons(snap, arch[arch.length - 1]));
      pick(0);
    }).catch((e) => box.replaceChildren(el('h3', {}, 'Bilan de saison'), el('p', { class: 'error' }, e.message)));
    return box;
  }


  /* ---------- Session en cours ---------- */
  function sessionTile() {
    const id = current.account.id, key = 'fnstats:session:' + id, hkey = 'fnstats:soirees:' + id;
    const read = (k, d) => { try { return JSON.parse(store.get(k) || 'null') || d; } catch { return d; } };
    let base = read(key, null), past = read(hkey, []);
    const box = el('section', { class: 't c12' });
    const pt = (x) => ({ m: x.matches || 0, w: x.wins || 0, k: x.kills || 0, t10: x.top10 || 0 });
    const chipsOf = (dm, dk, dw, dt) => el('span', { class: 'chips' },
      el('span', { class: 'chip' }, '+' + fmt(dm) + ' ' + plural(dm, 'partie', 'parties')),
      el('span', { class: 'chip' }, '+' + fmt(dk) + ' ' + plural(dk, 'kill', 'kills')),
      dw > 0 ? el('span', { class: 'chip win' }, '+' + fmt(dw) + ' ' + plural(dw, 'victoire', 'victoires')) : null,
      el('span', { class: 'chip' }, '+' + fmt(dt) + ' top 10'),
      dm ? el('span', { class: 'chip' }, 'K/D ' + dec(dk / Math.max(dm - dw, 1))) : null);
    const refresh = async () => {
      try { const d = await fetchStats(current.account.name, current.platform); current.stats = d.stats; current.battlePass = d.battlePass; draw(); } catch {}
    };
    const schedule = () => {
      clearInterval(timer);
      if (base) timer = setInterval(() => { if (!document.body.contains(box)) { clearInterval(timer); return; } refresh(); }, 180000);
    };
    function draw() {
      const kids = [el('h3', {}, 'Session en cours'),
        el('p', { class: 'sub' }, "Appuie sur « Je commence à jouer » avant ta partie. Tant que cette page reste ouverte, elle se met à jour toutes les 3 minutes ; les stats d'Epic peuvent arriver avec quelques minutes de retard.")];
      const row = el('div', { class: 'acts' });
      if (!base) {
        const b = el('button', { type: 'button' }, 'Je commence à jouer');
        b.addEventListener('click', () => { base = { t: Date.now(), ...pt(current.stats.overall || {}) }; store.set(key, JSON.stringify(base)); schedule(); draw(); });
        row.append(b);
      } else {
        const c = pt(current.stats.overall || {});
        const dm = c.m - base.m, dk = c.k - base.k, dw = c.w - base.w, dt = c.t10 - base.t10;
        kids.push(el('p', { class: 'sub' }, 'Commencée à ' + new Date(base.t).toLocaleTimeString('fr-FR', { timeStyle: 'short' }) + ' (' + Math.round((Date.now() - base.t) / 60000) + ' min)'), chipsOf(dm, dk, dw, dt));
        const r = el('button', { type: 'button' }, 'Actualiser'), f = el('button', { type: 'button' }, 'Terminer la soirée');
        r.addEventListener('click', refresh);
        f.addEventListener('click', () => {
          past.unshift({ t0: base.t, t1: Date.now(), dm, dk, dw, dt }); past = past.slice(0, 15);
          store.set(hkey, JSON.stringify(past)); base = null; store.set(key, 'null'); clearInterval(timer); draw();
        });
        row.append(r, f);
      }
      kids.push(row);
      if (past.length) kids.push(el('h3', { class: 'sh' }, 'Soirées passées'),
        el('ul', { class: 'sessions' }, past.map((s) => el('li', {},
          el('time', {}, new Date(s.t1).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }) + ' · ' + Math.max(1, Math.round((s.t1 - s.t0) / 60000)) + ' min'),
          chipsOf(s.dm, s.dk, s.dw, s.dt)))));
      box.replaceChildren(...kids);
    }
    draw(); schedule();
    return box;
  }

  /* ---------- Comparaison de saisons ---------- */
  function saisons(cur, prev) {
    const g = (sn) => { const o = sn.s.overall || {}; return { m: o.matches || 0, w: o.wins || 0, k: o.kills || 0, kd: o.kd || 0, h: (o.minutesPlayed || 0) / 60 }; };
    const a = g(cur), b = g(prev);
    const evo = (x, y) => (y > 0 ? ((x - y) / y) * 100 : null);
    const rows = [['Parties', 'm', fmt], ['Victoires', 'w', fmt], ['Kills', 'k', fmt], ['Ratio K/D', 'kd', (v) => dec(v)], ['Heures de jeu', 'h', fmt]];
    const e = evo(a.w, b.w);
    return el('div', { class: 'saisons' },
      el('h3', { class: 'sh' }, 'Saison en cours contre saison précédente'),
      e != null ? el('p', { class: 'ins' }, 'Pour l’instant, tu as gagné ' + dec(Math.abs(e), 0) + ' % de victoires de ' + (e >= 0 ? 'plus' : 'moins') + ' que lors de la saison précédente (saison en cours, encore incomplète).') : null,
      el('div', { class: 'vr vr4 head' }, el('span'), el('b', {}, 'En cours'), el('b', {}, 'Précédente'), el('b', {}, 'Écart')),
      rows.map(([l, k, f]) => {
        const x = evo(a[k], b[k]);
        return el('div', { class: 'vr vr4' }, el('span', {}, l), el('span', {}, f(a[k])), el('span', {}, f(b[k])),
          el('span', { class: x != null && x >= 0 ? 'lead' : '' }, x == null ? '—' : (x >= 0 ? '+' : '') + dec(x, 0) + ' %'));
      }));
  }

  /* ---------- Boutique du jour ---------- */
  function boutique() {
    const box = el('section', { class: 't c12 shop' }, el('h3', {}, 'Boutique du jour'), el('p', { class: 'sub' }, 'Chargement de la boutique…'));
    jf('/api/shop').then((d) => {
      const find = el('input', { type: 'search', placeholder: 'Chercher un objet…', 'aria-label': 'Chercher un objet' });
      const list = el('div');
      const card = (i) => el('div', { class: 'card r-' + (i.rarete || 'x') },
        i.promo ? el('span', { class: 'tag' }, i.promo) : null,
        i.image ? el('img', { class: 'pic', src: i.image, alt: '', loading: 'lazy' }) : el('div', { class: 'pic' }),
        el('p', { class: 'nm' }, i.nom),
        el('p', { class: 'sub tp' }, i.type + (i.nbr > 1 ? ' · ' + i.nbr + ' objets' : '')),
        el('p', { class: 'pr' }, d.vbuck ? el('img', { src: d.vbuck, alt: 'V-Bucks' }) : null, fmt(i.prix), i.normal > i.prix ? el('s', {}, fmt(i.normal)) : null));
      const draw = () => {
        const q = find.value.trim().toLowerCase();
        const blocks = d.sections.map((s) => {
          const items = s.items.filter((i) => !q || i.nom.toLowerCase().includes(q) || i.type.toLowerCase().includes(q));
          return items.length ? el('div', {}, el('h4', {}, s.nom), el('div', { class: 'shopgrid' }, items.map(card))) : null;
        }).filter(Boolean);
        list.replaceChildren(...(blocks.length ? blocks : [el('p', { class: 'empty' }, 'Aucun objet ne correspond.')]));
      };
      find.addEventListener('input', draw);
      box.replaceChildren(el('h3', {}, 'Boutique du jour'),
        el('p', { class: 'sub' }, new Date(d.date).toLocaleDateString('fr-FR', { dateStyle: 'full' }) + ' · ' + d.total + ' offres · renouvelée chaque jour à minuit UTC'),
        el('div', { class: 'cmp' }, find), list);
      draw();
    }).catch((e) => box.replaceChildren(el('h3', {}, 'Boutique du jour'), el('p', { class: 'error' }, e.message)));
    return box;
  }

  /* ---------- Navigation et rendu ---------- */
  function intro() {
    return el('section', { class: 'intro' },
      el('h2', {}, 'Ton tableau de bord Fortnite.'),
      el('p', {}, 'Choisis ta plateforme, tape ton pseudo dans la colonne de gauche, et c’est parti.'),
      el('ol', { class: 'feat' },
        el('li', {}, 'Stats de carrière et classements atteints'),
        el('li', {}, 'Historique de sessions, objectifs et badges'),
        el('li', {}, 'Classement entre amis'),
        el('li', {}, 'Bilan de fin de saison')));
  }

  function buildNav() {
    $('#nav').replaceChildren(...VIEWS.map(([k, label]) => {
      const b = el('button', { type: 'button', class: 'nv', 'aria-current': String(k === view && (!!current || FREE.includes(k))) }, label);
      if (!current && !FREE.includes(k)) b.disabled = true;
      b.addEventListener('click', () => { view = k; render(); });
      return b;
    }));
  }

  function render() {
    clearInterval(timer);
    buildNav();
    const out = $('#out');
    if (!current && !FREE.includes(view)) { out.replaceChildren(intro()); return; }
    const o = current && current.stats.overall;
    const X = window.FNX && o ? window.FNX.parts({ id: current.account.id, name: current.account.name, o, stats: current.stats, sessions, fetchStats }) : {};
    const panel = el('div', { class: 'grid' });
    const items = view === 'apercu' ? apercu(X)
      : view === 'progression' ? [sessionTile(), X.charts, X.calendar, X.forecast, historique(), X.goals, X.badges]
      : view === 'coffres' ? [coffres()]
      : view === 'amis' ? [X.compare, X.share]
      : view === 'classement' ? [classement()]
      : view === 'boutique' ? [boutique()]
      : [bilan()];
    items.filter(Boolean).forEach((n, i) => { n.style.setProperty('--i', i); panel.append(n); });
    out.replaceChildren(panel);
  }

  async function fetchStats(name, platform, window_) {
    const r = await fetch('/api/stats?name=' + encodeURIComponent(name) + '&platform=' + encodeURIComponent(platform) + (window_ ? '&window=' + window_ : ''));
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'Erreur ' + r.status);
    if (!j.stats || !j.stats.all) throw new Error('Aucune statistique disponible pour ce compte.');
    return { account: j.account, stats: j.stats.all, battlePass: j.battlePass || null };
  }

  async function load(name, platform) {
    $('#out').replaceChildren(el('div', { class: 'grid', 'aria-label': 'Chargement' }, ['c12', 'k', 'k', 'k', 'k'].map((c) => el('div', { class: 't skel ' + c }))));
    buildNav();
    try {
      current = await fetchStats(name, platform);
      current.platform = platform;
      mode = 'overall'; view = 'apercu';
      sessions = snapshot();
      render();
    } catch (e) {
      current = null;
      $('#out').replaceChildren(el('p', { class: 'error', role: 'alert' }, e.message));
    }
  }

  function home() { current = null; view = 'apercu'; $('#name').value = ''; render(); }

  function route() {
    const q = new URLSearchParams(location.search), name = q.get('name');
    if (name) { $('#name').value = name; setPlatform(q.get('platform') || 'epic'); load(name, getPlatform()); }
    else if (q.get('groupe')) { current = null; view = 'classement'; render(); }
    else if (q.get('vue') === 'boutique') { current = null; view = 'boutique'; render(); }
    else home();
  }

  $('#logo').addEventListener('click', (e) => {
    e.preventDefault();
    history.pushState(null, '', '/');
    home();
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  });

  $('#form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('#name').value.trim(), platform = getPlatform();
    history.pushState(null, '', '?name=' + encodeURIComponent(name) + '&platform=' + platform);
    load(name, platform);
  });

  window.addEventListener('popstate', route);

  const themeSel = $('#theme');
  themeSel.value = document.documentElement.dataset.theme || 'fortnite';
  themeSel.addEventListener('change', () => { document.documentElement.dataset.theme = themeSel.value; store.set('fnstats:theme', themeSel.value); });
  route();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
