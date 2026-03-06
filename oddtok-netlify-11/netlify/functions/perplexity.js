// ═══════════════════════════════════════════════════════
//  ODDTOK — Perplexity News Context API
//  Serverless function that proxies Perplexity API calls.
//  Set PERPLEXITY_API_KEY in Netlify environment variables.
// ═══════════════════════════════════════════════════════

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "POST only" }) };
  }

  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "PERPLEXITY_API_KEY not configured" }),
    };
  }

  let question, category;
  try {
    const body = JSON.parse(event.body);
    question = body.question;
    category = body.category || "general";
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON body" }) };
  }

  if (!question) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing question field" }) };
  }

  const systemPrompt = `You are a prediction market news analyst for OddTok. Given a prediction market question, provide the latest real-world news and developments that explain why this market is moving.

Rules:
- Return ONLY a JSON object with this exact structure: {"headline":"One sentence summary","bullets":["point 1","point 2","point 3"],"sentiment":"bullish"|"bearish"|"mixed","confidence":"high"|"medium"|"low"}
- Each bullet should be 8-15 words, factual, citing recent events
- Focus on the last 7 days of news
- 3 bullets maximum
- No markdown, no backticks, no preamble — pure JSON only
- If no recent news exists, still provide relevant context`;

  const userPrompt = `Prediction market question: "${question}"
Category: ${category}
What recent news or developments explain the current odds and movement in this market?`;

  try {
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 300,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Perplexity API error:", response.status, errText);
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ error: `Perplexity API error: ${response.status}` }),
      };
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || "";

    // Parse JSON from response (handle possible markdown wrapping)
    let parsed;
    try {
      const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      // Fallback: extract what we can
      parsed = {
        headline: "Market context loading",
        bullets: [raw.slice(0, 80)],
        sentiment: "mixed",
        confidence: "low",
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        headline: parsed.headline || "Recent developments",
        bullets: (parsed.bullets || []).slice(0, 3),
        sentiment: parsed.sentiment || "mixed",
        confidence: parsed.confidence || "medium",
        citations: data.citations || [],
      }),
    };
  } catch (err) {
    console.error("Function error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Internal function error" }),
    };
  }
};
