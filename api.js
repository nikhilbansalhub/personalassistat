// api/chat.js  (Vercel Serverless Function — Node 18+)
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const OPENAI_KEY = process.env.OPENAI_KEY;
    if (!OPENAI_KEY) return res.status(500).json({ error: "OpenAI API key not configured." });

    const { prompt } = req.body;
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Missing 'prompt' in request body." });
    }

    // Build messages — you can customize system prompt here
    const messages = [
      { role: "system", content: "You are Neha's friendly virtual assistant. Keep answers concise and polite." },
      { role: "user", content: prompt }
    ];

    const openaiResp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages,
        max_tokens: 800,
        temperature: 0.7
      })
    });

    if (!openaiResp.ok) {
      const txt = await openaiResp.text();
      console.error("OpenAI error:", openaiResp.status, txt);
      return res.status(openaiResp.status).send(txt);
    }

    const data = await openaiResp.json();
    const reply = data?.choices?.[0]?.message?.content ?? "";

    return res.status(200).json({ reply });
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
