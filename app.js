/* ---------------- CONFIGURATION ---------------- */
const CONFIG = {
  BACKEND_URL: "https://your-backend.vercel.app", // Change after deployment
  DEFAULT_LOCALE: "en-IND"
};

// frontend app.js — askChatGPT -> call your deployed serverless endpoint
async function askChatGPT(prompt) {
  try {
    const resp = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });

    if (!resp.ok) {
      const txt = await resp.text();
      console.error('Backend error', resp.status, txt);
      speak("Sorry, I couldn't get a response from the server.");
      return null;
    }

    const data = await resp.json();
    const reply = data.reply;
    if (reply) {
      speak(reply);
      return reply;
    } else {
      speak("I didn't get a reply from the server.");
      return null;
    }
  } catch (err) {
    console.error("askChatGPT error:", err);
    speak("I couldn't reach the server.");
  }
}

/* ---------------- SPEAK FUNCTION ---------------- */
function speak(text, opts = {}) {
  if (!text) return;
  const u = new SpeechSynthesisUtterance(text);
  u.rate = opts.rate ?? 0.85;
  u.pitch = opts.pitch ?? 1.1;
  u.volume = opts.volume ?? 1;
  u.lang = CONFIG.DEFAULT_LOCALE;
  speechSynthesis.speak(u);
  appendMessage("Assistant", text);
}

/* ---------------- CHAT UI ---------------- */
function appendMessage(sender, text) {
  const el = document.createElement("div");
  el.className = `msg ${sender}`;
  el.innerHTML = `<div class="text">${text}</div>`;
  document.getElementById("chat").appendChild(el);
}

/* ---------------- HANDLE COMMAND ---------------- */
async function handleCommand(msg) {
  if (!msg) return;
  if (msg.includes("hello") || msg.includes("hey")) {
    speak("Hello! How can I help you today?");
    return;
  }
  await askChatGPT(msg);
}

/* ---------------- SEND MESSAGE ---------------- */
document.getElementById("sendBtn").addEventListener("click", () => {
  const text = document.getElementById("textInput").value.trim();
  if (text) {
    appendMessage("User", text);
    handleCommand(text);
    document.getElementById("textInput").value = "";
  }
});
