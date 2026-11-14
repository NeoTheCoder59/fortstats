// Fonction serverless Vercel : /api/stats?name=...&platform=epic|psn|xbl
const { getStats } = require('../lib/fortnite');

module.exports = async (req, res) => {
  const { name, platform } = req.query || {};
  const { status, body } = await getStats(name, platform);
  if (status === 200) res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
  res.status(status).json(body);
};
