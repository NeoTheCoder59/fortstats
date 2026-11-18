// Boutique du jour : lit fortnite-api.com (sans clé) et renvoie une version allégée, groupée par rayon.
async function getShop() {
  try {
    const r = await fetch('https://fortnite-api.com/v2/shop?language=fr');
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.data) return { status: 502, body: { error: "La boutique n'est pas disponible pour le moment." } };
    const d = j.data, secs = {};
    for (const e of d.entries || []) {
      const br = (e.brItems || [])[0], tr = (e.tracks || [])[0], ins = (e.instruments || [])[0], car = (e.cars || [])[0];
      const nom = (e.bundle && e.bundle.name) || (br && br.name) || (tr && tr.title) || (ins && ins.name) || (car && car.name) || 'Offre';
      const render = e.newDisplayAsset && e.newDisplayAsset.renderImages && e.newDisplayAsset.renderImages[0];
      const image = (render && render.image) || (e.bundle && e.bundle.image) || (br && br.images && (br.images.icon || br.images.smallIcon)) ||
        (tr && tr.albumArt) || (ins && ins.images && ins.images.large) || (car && car.images && car.images.large) || null;
      const type = e.bundle ? 'Lot' : br ? (br.type && br.type.displayValue) || 'Objet' : tr ? 'Jam Track' : ins ? 'Instrument' : car ? 'Voiture' : 'Offre';
      const lay = e.layout || {};
      const key = lay.id || 'autres';
      if (!secs[key]) secs[key] = { nom: String(lay.name || 'Autres').trim(), rank: lay.rank != null ? lay.rank : 999, items: [] };
      secs[key].items.push({
        nom, image, type, prix: e.finalPrice, normal: e.regularPrice, nbr: (e.brItems || []).length,
        rarete: (br && br.rarity && br.rarity.value) || '', promo: (e.banner && e.banner.value) || '', fin: e.outDate,
      });
    }
    const sections = Object.values(secs).sort((a, b) => a.rank - b.rank);
    sections.forEach((s) => s.items.sort((a, b) => b.prix - a.prix));
    return { status: 200, body: { date: d.date, vbuck: d.vbuckIcon, total: (d.entries || []).length, sections } };
  } catch (e) {
    return { status: 502, body: { error: "Impossible de joindre la boutique." } };
  }
}
module.exports = { getShop };
