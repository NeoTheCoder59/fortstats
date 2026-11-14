// Logique partagée Vercel / Netlify : appelle fortnite-api.com sans exposer la clé au navigateur.
const PLATEFORMES = ['epic', 'psn', 'xbl'];

async function getStats(name, platform) {
  const key = process.env.FORTNITE_API_KEY;
  if (!key) {
    return { status: 500, body: { error: "Clé API manquante côté serveur (variable FORTNITE_API_KEY)." } };
  }
  name = String(name || '').trim();
  platform = PLATEFORMES.includes(platform) ? platform : 'epic';
  if (!name || name.length > 64) {
    return { status: 400, body: { error: 'Pseudo invalide.' } };
  }

  const url =
    'https://fortnite-api.com/v2/stats/br/v2?name=' + encodeURIComponent(name) +
    '&accountType=' + platform + '&timeWindow=lifetime';

  try {
    const r = await fetch(url, { headers: { Authorization: key } });
    const j = await r.json().catch(() => ({}));
    if (r.status === 404) {
      return { status: 404, body: { error: 'Joueur introuvable. Vérifie le pseudo et la plateforme choisie.' } };
    }
    if (r.status === 403) {
      return { status: 403, body: { error: "Les statistiques de ce compte sont privées. Dans Fortnite, ouvre les paramètres de confidentialité et mets les statistiques de carrière en public." } };
    }
    if (!r.ok || !j.data) {
      return { status: 502, body: { error: "L'API Fortnite ne répond pas correctement. Réessaie dans un moment." } };
    }
    return { status: 200, body: j.data };
  } catch (e) {
    return { status: 502, body: { error: "Impossible de joindre l'API Fortnite." } };
  }
}

module.exports = { getStats };
