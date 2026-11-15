// Fonction Netlify : /api/stats (redirigée par netlify.toml)
const { getStats } = require('../../lib/fortnite');

exports.handler = async (event) => {
  const { name, platform, window } = event.queryStringParameters || {};
  const { status, body } = await getStats(name, platform, window);
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'application/json',
      ...(status === 200 ? { 'Cache-Control': 'public, max-age=60' } : {}),
    },
    body: JSON.stringify(body),
  };
};
