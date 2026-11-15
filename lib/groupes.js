// Classement entre amis : groupes identifiés par un code, stats récupérées côté serveur (non falsifiables).
const { getStats } = require('./fortnite');
const R = require('./redis');

const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const code6 = () => Array.from({ length: 6 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join('');
const norm = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const COOLDOWN = 10 * 60 * 1000;
const MAX = 30;

async function payload(code) {
  const g = await R.cmd('GET', 'g:' + code);
  if (!g) return null;
  const flat = (await R.cmd('HGETALL', 'g:' + code + ':m')) || [];
  const members = [];
  for (let i = 1; i < flat.length; i += 2) {
    try { members.push({ key: flat[i - 1], ...JSON.parse(flat[i]) }); } catch {}
  }
  return { code, nom: JSON.parse(g).nom, members };
}

async function handle(method, query, body) {
  if (!R.ok()) return { status: 503, body: { error: "La base de données n'est pas configurée (voir le README, étape « Classement »)." } };
  try {
    if (method === 'GET') {
      const code = norm(query.code);
      const p = code && (await payload(code));
      return p ? { status: 200, body: p } : { status: 404, body: { error: 'Groupe introuvable.' } };
    }
    if (method !== 'POST') return { status: 405, body: { error: 'Méthode non autorisée.' } };
    const b = body || {};

    if (b.action === 'create') {
      const nom = String(b.nom || '').trim().slice(0, 40);
      if (!nom) return { status: 400, body: { error: 'Donne un nom au groupe.' } };
      for (let t = 0; t < 5; t++) {
        const code = code6();
        if ((await R.cmd('SET', 'g:' + code, JSON.stringify({ nom, cree: Date.now() }), 'NX')) === 'OK') {
          return { status: 200, body: { code, nom, members: [] } };
        }
      }
      return { status: 500, body: { error: 'Création impossible, réessaie.' } };
    }

    if (b.action === 'join') {
      const code = norm(b.code);
      if (!code || !(await R.cmd('EXISTS', 'g:' + code))) return { status: 404, body: { error: 'Groupe introuvable.' } };
      const name = String(b.name || '').trim();
      const platform = ['epic', 'psn', 'xbl'].includes(b.platform) ? b.platform : 'epic';
      if (!name) return { status: 400, body: { error: 'Pseudo manquant.' } };

      const r = await getStats(name, platform, 'lifetime');
      if (r.status !== 200) return r;
      const acc = r.body.account;
      const o = r.body.stats && r.body.stats.all && r.body.stats.all.overall;
      if (!acc || !o) return { status: 404, body: { error: 'Aucune statistique pour ce joueur.' } };

      const field = platform + ':' + acc.id;
      const raw = await R.cmd('HGET', 'g:' + code + ':m', field);
      const prev = raw ? JSON.parse(raw) : null;
      if (prev && Date.now() - prev.at < COOLDOWN) {
        return { status: 200, body: { ...(await payload(code)), info: 'Stats déjà actualisées il y a moins de 10 minutes.' } };
      }
      if (!prev && Number(await R.cmd('HLEN', 'g:' + code + ':m')) >= MAX) {
        return { status: 400, body: { error: 'Groupe complet (' + MAX + ' joueurs).' } };
      }
      const s = { wins: o.wins || 0, kills: o.kills || 0, matches: o.matches || 0, kd: o.kd || 0, winRate: o.winRate || 0, minutes: o.minutesPlayed || 0 };
      const m = { name: acc.name, platform, at: Date.now(), s, base: prev ? prev.base : { wins: s.wins, kills: s.kills, matches: s.matches } };
      await R.cmd('HSET', 'g:' + code + ':m', field, JSON.stringify(m));
      return { status: 200, body: await payload(code) };
    }
    return { status: 400, body: { error: 'Action inconnue.' } };
  } catch (e) {
    return { status: 500, body: { error: 'Erreur serveur : ' + e.message } };
  }
}

module.exports = { handle };
