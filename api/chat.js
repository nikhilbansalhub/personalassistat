export default async function handler(req, res) {
  // Allow only POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { prompt } = req.body;

  // Validate input
  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "No prompt provided" });
  }

  try {
    // Call OpenAI API
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}` // Securely from Vercel Env Vars
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo", // You can change to gpt-4 if needed
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7
      }),
    });

    // Parse the API response
    const data = await openaiRes.json();

    // Check for OpenAI errors
    if (!data.choices || data.choices.length === 0) {
      return res.status(500).json({ error: "No response from OpenAI" });
    }

    // Extract and return the reply
    const reply = data.choices[0].message.content.trim();
    res.status(200).json({ reply });

  } catch (error) {
    console.error("OpenAI API error:", error);
    res.status(500).json({ error: "Error connecting to OpenAI" });
  }
}
