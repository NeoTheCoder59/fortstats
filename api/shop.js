// Fonction serverless Vercel : /api/shop
const { getShop } = require('../lib/shop');

module.exports = async (req, res) => {
  const { status, body } = await getShop();
  if (status === 200) res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=3600');
  res.status(status).json(body);
};
