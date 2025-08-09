/* ---------------- CONFIGURATION ---------------- */
const CONFIG = {
  OPENWEATHER_KEY: "",   // Optional: Enter your OpenWeather API key
  NEWSAPI_KEY: "",       // Optional: Enter your NewsAPI key
  DEFAULT_LOCALE: "en-IND"
};

/* ---------------- VOICE SETUP ---------------- */
const synth = window.speechSynthesis;
let voice = null;

function chooseBestFemaleVoice(voices) {
  if (!voices || voices.length === 0) return null;
  const femaleHints = [
    "female", "woman", "girl", "samantha", "amanda", "amy", "alloy", "aria", "amelia",
    "google us english", "google"
  ];
  function score(v) {
    const name = (v.name || "").toLowerCase();
    const lang = (v.lang || "").toLowerCase();
    let s = 0;
    for (const h of femaleHints) {
      if (name.includes(h)) s += 40;
      if ((v.voiceURI || "").toLowerCase().includes(h)) s += 20;
    }
    if (/^en/.test(lang)) s += 15;
    if (name.includes("google") || name.includes("samantha") || name.includes("am")) s += 10;
    return s;
  }
  return voices.map(v => ({ v, s: score(v) })).sort((a, b) => b.s - a.s)[0].v;
}

function initVoiceSelectionWithRetries(retries = 8, delayMs = 200) {
  let attempts = 0;
  function attemptPick() {
    attempts++;
    const voices = synth.getVoices();
    if (voices && voices.length) {
      const pick = chooseBestFemaleVoice(voices);
      if (pick) {
        voice = pick;
        console.info("Voice selected:", voice.name, voice.lang);
        return;
      }
    }
    if (attempts < retries) setTimeout(attemptPick, delayMs);
  }
  attemptPick();
}
synth.onvoiceschanged = () => initVoiceSelectionWithRetries();
initVoiceSelectionWithRetries();

function speak(text, opts = {}) {
  if (!text) return;
  const u = new SpeechSynthesisUtterance(text);
  u.rate = opts.rate ?? 0.80;
  u.pitch = opts.pitch ?? 1.35;
  u.volume = opts.volume ?? 0.9;
  if (voice) u.voice = voice;
  u.lang = CONFIG.DEFAULT_LOCALE;
  if (synth.speaking) synth.cancel();
  synth.speak(u);
  appendMessage("YOUR ASSISTANT", text);
}

/* ---------------- CHAT UI ---------------- */
function appendMessage(sender, text) {
  const el = document.createElement("div");
  el.className = `msg ${sender}`;
  const now = new Date();
  el.innerHTML = `<div class="text">${escapeHtml(text)}</div><span class="time">${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>`;
  chat.appendChild(el);
  chat.scrollTop = chat.scrollHeight;
}
function escapeHtml(s) { return (s + "").replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])); }

/* ---------------- GREETING ---------------- */
function wishMe() {
  const hour = new Date().getHours();
  let t = "Good Evening";
  if (hour < 12) t = "Good Morning";
  else if (hour < 17) t = "Good Afternoon";
  greeting.textContent = `${t}, I'm your Assistant`;
  subtitle.textContent = "How may I help you today?";
  setTimeout(() => speak(`${t}. I am ready. Say help to get command ideas.`), 350);
}
window.addEventListener('load', wishMe);

/* ---------------- NOTES ---------------- */
function loadNotes() { return JSON.parse(localStorage.getItem('jarvis_notes') || '[]'); }
function saveNotes(n) { localStorage.setItem('jarvis_notes', JSON.stringify(n)); renderNotes(); }
function addNote(text) { const n = loadNotes(); n.unshift({ id: Date.now(), text }); saveNotes(n); speak("Note saved."); }
function renderNotes() { const n = loadNotes(); notesList.innerHTML = n.map(i => `<li>${escapeHtml(i.text)} <small>${new Date(i.id).toLocaleString()}</small></li>`).join(""); }
clearNotesBtn.addEventListener('click', () => { if (confirm("Clear all notes?")) { localStorage.removeItem('jarvis_notes'); renderNotes(); speak("All notes cleared."); } });
renderNotes();

/* ---------------- REMINDERS ---------------- */
function loadReminders() { return JSON.parse(localStorage.getItem('jarvis_reminders') || '[]'); }
function saveReminders(r) { localStorage.setItem('jarvis_reminders', JSON.stringify(r)); renderReminders(); }
function addReminder({ text, whenMs }) { const r = loadReminders(); r.push({ id: Date.now(), text, whenMs }); saveReminders(r); scheduleReminder(r[r.length - 1]); speak(`Reminder set for ${new Date(whenMs).toLocaleString()}`); }
function renderReminders() { const r = loadReminders(); remindersList.innerHTML = r.length ? r.map(i => `<li>${escapeHtml(i.text)} <br><small>${new Date(i.whenMs).toLocaleString()}</small></li>`).join("") : "<li><em>No reminders</em></li>"; }
function scheduleReminder(r) { const delay = r.whenMs - Date.now(); if (delay <= 0) { triggerReminder(r); return; } setTimeout(() => triggerReminder(r), delay); }
function triggerReminder(r) { speak(`Reminder: ${r.text}`); appendMessage("jarvis", `⏰ Reminder: ${r.text}`); const rem = loadReminders().filter(x => x.id !== r.id); saveReminders(rem); }
loadReminders().forEach(scheduleReminder); renderReminders();

/* ---------------- SPEECH RECOGNITION ---------------- */
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;
if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.lang = CONFIG.DEFAULT_LOCALE;
  recognition.onresult = (e) => { const t = e.results[0][0].transcript.trim(); appendMessage("user", t); handleCommand(t.toLowerCase()); };
  recognition.onend = () => stopListening();
} else { console.warn("Speech recognition not supported."); }

/* ---------------- LISTENING TOGGLE ---------------- */
let isListening = false;
function startListening() { isListening = true; micBtn.classList.add('listening'); listeningDot.classList.add('on'); subtitle.textContent = "Listening..."; recognition.start(); }
function stopListening() { isListening = false; micBtn.classList.remove('listening'); listeningDot.classList.remove('on'); subtitle.textContent = "Click mic or press Space to talk"; }
micBtn.addEventListener('click', () => { isListening ? recognition.stop() : startListening(); });
document.addEventListener('keydown', e => { if (e.code === "Space" && !e.repeat) { e.preventDefault(); isListening ? recognition.stop() : startListening(); } });

/* ---------------- CALL BACKEND /api/chat ---------------- */
async function askChatGPT(prompt) {
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: prompt })
    });
    const data = await res.json();
    speak(data.reply);
    return data.reply;
  } catch (err) {
    console.error("ChatGPT error:", err);
    speak("Sorry, I couldn't connect to ChatGPT.");
  }
}

/* ---------------- COMMANDS ---------------- */
async function fetchJoke() { try { const r = await fetch("https://v2.jokeapi.dev/joke/Any?type=single"); const j = await r.json(); return j.joke; } catch { return "Couldn't fetch a joke."; } }
async function fetchWeather(city) { if (!CONFIG.OPENWEATHER_KEY) { window.open(`https://www.google.com/search?q=weather+${city}`, "_blank"); return `I opened weather for ${city}.`; } const r = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${city}&units=metric&appid=${CONFIG.OPENWEATHER_KEY}`); const j = await r.json(); return `In ${j.name} it's ${j.weather[0].description} with ${j.main.temp}°C.`; }
async function fetchNews() { if (!CONFIG.NEWSAPI_KEY) { window.open("https://news.google.com", "_blank"); return "Opened Google News."; } const r = await fetch(`https://newsapi.org/v2/top-headlines?country=in&pageSize=5&apiKey=${CONFIG.NEWSAPI_KEY}`); const j = await r.json(); return j.articles.map(a => a.title).join(". "); }

async function handleCommand(msg) {
  if (!msg) return;
  if (msg.includes("hello") || msg.includes("hey")) { speak("Hello! How can I assist you today?"); return; }
  if (msg.includes("help")) { speak("You can say: open google, open youtube, weather in Mumbai, tell me a joke, latest news, take a note, remind me in 5 minutes, what's the time, date."); return; }
  if (msg.startsWith("open ")) { const site = msg.replace("open ", ""); window.open(`https://${site}.com`, "_blank"); speak(`Opening ${site}`); return; }
  if (msg.includes("weather")) { const city = msg.split("weather in")[1]?.trim(); if (!city) { speak("Which city?"); return; } speak(await fetchWeather(city)); return; }
  if (msg.includes("news")) { speak(await fetchNews()); return; }
  if (msg.includes("joke")) { speak(await fetchJoke()); return; }
  if (msg.includes("note")) { const note = msg.replace(/take a note|note/, "").trim(); if (note) { addNote(note); } else { speak("What should I note?"); } return; }
  if (msg.includes("remind me in")) { const m = msg.match(/remind me in (\d+) (minute|minutes|hour|hours)/); if (m) { const n = parseInt(m[1]); const ms = m[2].startsWith("hour") ? n * 3600000 : n * 60000; addReminder({ text: msg.split("to")[1] || "reminder", whenMs: Date.now() + ms }); } return; }
  if (msg.includes("time")) { speak("The time is " + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })); return; }
  if (msg.includes("date")) { speak("Today's date is " + new Date().toLocaleDateString()); return; }
  
  // Fallback to ChatGPT
  await askChatGPT(msg);
}

/* ---------------- TEXT INPUT ---------------- */
sendBtn.addEventListener('click', () => { const t = textInput.value.trim(); if (t) { appendMessage("user", t); handleCommand(t.toLowerCase()); textInput.value = ""; } });
textInput.addEventListener('keydown', e => { if (e.key === "Enter") sendBtn.click(); });

/* ---------------- ACTION BUTTONS ---------------- */
actionButtons.forEach(b => b.addEventListener('click', () => {
  const cmd = b.dataset.cmd;
  if (cmd === "joke") handleCommand("joke");
  if (cmd === "news") handleCommand("news");
  if (cmd === "weather") { const c = prompt("City?"); if (c) handleCommand(`weather in ${c}`); }
  if (cmd === "note") { const n = prompt("Note?"); if (n) handleCommand(`note ${n}`); }
  if (cmd === "remind") { const m = prompt("Minutes?"); const t = prompt("Reminder?"); if (m && t) handleCommand(`remind me in ${m} minutes to ${t}`); }
}));
