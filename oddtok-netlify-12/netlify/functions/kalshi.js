exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers, body: "" };

  const qs = event.queryStringParameters || {};
  const params = new URLSearchParams(qs).toString();
  const url = `https://api.elections.kalshi.com/trade-api/v2/events${params ? "?" + params : ""}`;

  try {
    const r = await fetch(url, {
      headers: { "Accept": "application/json", "User-Agent": "OddTok/1.0" },
    });
    const body = await r.text();
    return { statusCode: r.status, headers, body };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
