// Fonction serverless Vercel : /api/groupe (GET ?code=XXXXXX, POST {action: create|join, ...})
const { handle } = require('../lib/groupes');

module.exports = async (req, res) => {
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const { status, body: out } = await handle(req.method, req.query || {}, body);
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(out);
};
