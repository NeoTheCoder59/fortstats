// Fonction Netlify : /api/stats (redirigée par netlify.toml)
const { getStats } = require('../../lib/fortnite');

exports.handler = async (event) => {
  const { name, platform } = event.queryStringParameters || {};
  const { status, body } = await getStats(name, platform);
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'application/json',
      ...(status === 200 ? { 'Cache-Control': 'public, max-age=60' } : {}),
    },
    body: JSON.stringify(body),
  };
};
