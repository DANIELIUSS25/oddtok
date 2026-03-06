// OddTok — Perplexity AI News Context
// Set PERPLEXITY_API_KEY in Netlify environment variables.
exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: JSON.stringify({ error: "POST only" }) };

  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) return { statusCode: 500, headers, body: JSON.stringify({ error: "PERPLEXITY_API_KEY not set" }) };

  let question, category;
  try { const b = JSON.parse(event.body); question = b.question; category = b.category || "general"; }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid body" }) }; }
  if (!question) return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing question" }) };

  const systemPrompt = `You are OddTok's prediction market analyst. Given a market question, identify the TOP 3 real-world drivers currently affecting the probability.

Return ONLY valid JSON — no markdown, no backticks, no preamble:
{
  "headline": "One-sentence summary of the key driver (max 15 words)",
  "bullets": [
    "First driver: 8-15 words, citing a specific recent event or data point",
    "Second driver: 8-15 words, a different factor affecting probability",
    "Third driver: 8-15 words, another distinct catalyst or headwind"
  ],
  "sentiment": "bullish" | "bearish" | "mixed",
  "confidence": "high" | "medium" | "low"
}

Rules:
- Focus on the last 7 days of news
- Each bullet must be a DIFFERENT driver, not three ways of saying the same thing
- Be specific: cite names, numbers, dates when possible
- If bullish drivers outweigh bearish, sentiment = "bullish" and vice versa
- Exactly 3 bullets, no more, no fewer`;

  const userPrompt = `Prediction market: "${question}"
Category: ${category}
What are the top 3 real-world drivers currently moving this market's probability?`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "sonar",
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
        max_tokens: 350,
        temperature: 0.2,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const err = await response.text();
      console.error("Perplexity API:", response.status, err);
      return { statusCode: response.status, headers, body: JSON.stringify({ error: `API ${response.status}` }) };
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || "";

    let parsed;
    try {
      parsed = JSON.parse(raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim());
    } catch {
      // Extract what we can from non-JSON response
      const lines = raw.split("\n").filter(l => l.trim().length > 10).slice(0, 3);
      parsed = { headline: lines[0] || "Market analysis", bullets: lines.length ? lines : [raw.slice(0, 100)], sentiment: "mixed", confidence: "low" };
    }

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        headline: parsed.headline || "Recent developments",
        bullets: (parsed.bullets || []).slice(0, 3),
        sentiment: parsed.sentiment || "mixed",
        confidence: parsed.confidence || "medium",
        citations: data.citations || [],
      }),
    };
  } catch (e) {
    console.error("Perplexity function error:", e.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
