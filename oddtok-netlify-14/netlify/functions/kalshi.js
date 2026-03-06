// Kalshi API proxy — avoids CORS on browser requests
exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Content-Type": "application/json",
    "Cache-Control": "public, max-age=15",
  };
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers, body: "" };

  const qs = event.queryStringParameters || {};
  const params = new URLSearchParams(qs).toString();
  const url = `https://api.elections.kalshi.com/trade-api/v2/events${params ? "?" + params : ""}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const r = await fetch(url, {
      headers: { "Accept": "application/json", "User-Agent": "OddTok/1.0" },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const body = await r.text();
    return { statusCode: r.status, headers, body };
  } catch (e) {
    console.error("Kalshi proxy error:", e.message);
    return { statusCode: 502, headers, body: JSON.stringify({ error: "Upstream API error", detail: e.message }) };
  }
};
