// popup.js – Perplexity-Version
let apiKey = "";

const params = new URLSearchParams(window.location.search);
const question = params.get("q") || "";

const responseDiv = document.getElementById("response");
const input = document.getElementById("input");
const sendButton = document.getElementById("send");
const followupDiv = document.getElementById("followups");

let messages = [];

// Lade gespeicherten API-Key
chrome.storage.local.get(["apiKey"], (data) => {
  if (data.apiKey) {
    apiKey = data.apiKey;
    if (question) {
      callPerplexity(`Erkläre medizinisch und präzise für Fachpersonen: ${question}`);
    }
  } else {
    responseDiv.innerText = "❌ Missing API key. Please configure it in options.";
  }
});

async function callPerplexity(prompt) {
  responseDiv.innerText = "Thinking...";
  followupDiv.innerHTML = "";

  messages.push({ role: "user", content: prompt });

  try {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "sonar",
        messages,
        max_tokens: 500,
        temperature: 0.3
      })
    });

    if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);

    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content || "No response.";
    appendMessage("assistant", reply);
    messages.push({ role: "assistant", content: reply });

    await fetchFollowups();
  } catch (err) {
    console.error("❌ API error:", err);
    responseDiv.innerText = "Error: " + err.message;
  }
}

async function fetchFollowups() {
  messages.push({
    role: "user",
    content: "Gib drei vertiefende medizinische Anschlussfragen basierend auf deiner letzten Antwort. Nur die Fragen, einzeln auflisten."
  });

  try {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "sonar",
        messages,
        max_tokens: 150,
        temperature: 0.3
      })
    });

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || "";
    const followups = extractFollowupOptions(text);
    showFollowups(followups);
    messages.pop(); // wieder entfernen
  } catch (err) {
    console.error("❌ Follow-up fetch error:", err);
  }
}

function extractFollowupOptions(text) {
  return text
    .split(/(?:\n|^)[\-•\d]+[\.\)]?\s+/)
    .map(line => line.trim())
    .filter(Boolean)
    .slice(0, 4);
}

function showFollowups(options) {
  followupDiv.innerHTML = "";
  options.forEach(option => {
    const btn = document.createElement("button");
    btn.textContent = option;
    btn.style.margin = "5px";
    btn.addEventListener("click", () => {
      input.value = option;
      sendButton.click();
    });
    followupDiv.appendChild(btn);
  });
}

function appendMessage(role, content) {
  const div = document.createElement("div");
  div.className = role;
  div.innerHTML = marked.parse(content);
  responseDiv.appendChild(div);
  responseDiv.scrollTop = responseDiv.scrollHeight;
}

sendButton.addEventListener("click", () => {
  const followup = input.value.trim();
  if (followup) {
    appendMessage("user", followup);
    callPerplexity(followup);
    input.value = "";
  }
});
