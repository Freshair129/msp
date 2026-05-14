// Genesis — Claude API bridge
// Replace ANTHROPIC_API_KEY with your key (or set up a proxy) to enable
// LLM-powered semantic search and AI chat.
//
// Without a key, the UI falls through to lexical (bag-of-words) search.
const ANTHROPIC_API_KEY = "";

window.claude = {
  async complete(prompt) {
    if (!ANTHROPIC_API_KEY) {
      throw new Error("No API key configured — using lexical fallback");
    }
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err?.error?.message || `HTTP ${resp.status}`);
    }
    const data = await resp.json();
    return data.content?.[0]?.text ?? "";
  },
};
