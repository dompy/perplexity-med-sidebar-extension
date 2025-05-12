let apiKey = "";
let messages = [];

console.log("📦 popup.js wurde geladen");
setTimeout(() => {
  console.log("🧪 typeof marked:", typeof marked);
}, 1000);

document.addEventListener("DOMContentLoaded", () => {
  const params   = new URLSearchParams(window.location.search);
  const question = params.get("q") || "";

  const responseDiv = document.getElementById("response");
  const input       = document.getElementById("input");
  const sendButton  = document.getElementById("send");
  const followupDiv = document.getElementById("followups");

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

  sendButton.addEventListener("click", () => {
    const followup = input.value.trim();
    if (followup) {
      appendMessage("user", followup);
      callPerplexity(followup);
      input.value = "";
    }
  });

  // --------------------------------------------
  // Die neue callPerplexity-Funktion mit Prompt-Workaround
  // --------------------------------------------
  async function callPerplexity(prompt) {
    // 1) System-Feedback im Chatfenster
    appendMessage("system", "💭 Thinking...");
    followupDiv.innerHTML = "";

    // 2) Prompt um die Fußnoten-Anweisung erweitern
    const enrichedPrompt = prompt + "\n\n" +
      "Bitte liste am Ende ALLE verwendeten Quellen als nummerierte Fußnoten " +
      "im Format `[1]: Beschreibung der Quelle` auf.";

    // 3) In die Nachricht-Historie packen
    messages.push({ role: "user", content: enrichedPrompt });

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
          max_tokens: 1500,
          temperature: 0.3
        })
      });
      if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);

      const data  = await res.json();
      const reply = data.choices?.[0]?.message?.content || "No response.";

      // 4) Anzeige der Antwort
      appendMessage("assistant", reply);

      // 5) System-Feedback entfernen
      const thinking = responseDiv.querySelector(".system");
      if (thinking) thinking.remove();

      // 6) In die Nachricht-Historie übernehmen (jetzt ohne das extra Footnote-Instrukt)
      messages.push({ role: "assistant", content: reply });

      // 7) Follow-Ups holen
      await fetchFollowups();
    } catch (err) {
      console.error("❌ API error:", err);
      responseDiv.innerText = "Error: " + err.message;
    }
  }

  // --------------------------------------------
  // Follow-up-Logik wie gehabt
  // --------------------------------------------
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
      .split(/(?:\n|^)[\-•\d]+[\.]?\s+/)
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

  // --------------------------------------------
  // appendMessage mit Fußnoten-Extraktion und Resize-PostMessage
  // --------------------------------------------
  function appendMessage(role, content) {
    const div = document.createElement("div");
    div.className = role;
  
    // 1. Fußnoten extrahieren: [Nummer]: beliebiger Text (URL oder freier Text)
    const referenceMap   = {};
    const referenceRegex = /^\[(\d+)\]:\s*(.+)$/gm;
    let match;
    while ((match = referenceRegex.exec(content)) !== null) {
      referenceMap[match[1]] = match[2];
    }
    // 2. Entferne diese Fußnoten-Zeilen
    content = content.replace(referenceRegex, "");
  
    // 3. Ersetze alle [1], [2]… im Fließtext durch Superscript (mit Link, falls URL)
    content = content.replace(/\[(\d+)\]/g, (full, num) => {
      const refText = referenceMap[num];
      if (refText && /^https?:\/\//.test(refText)) {
        // Klickbarer Link
        return `<sup><a href="${refText}" target="_blank" style="color:#555;text-decoration:none;">[${num}]</a></sup>`;
      } else if (refText) {
        // Nur Hochzahl für reinen Text
        return `<sup style="color:#555;">[${num}]</sup>`;
      }
      return full;
    });
  
    // 4. Markdown in HTML rendern
    let finalHTML = marked.parse(content);
  
    // 5. Fußnoten-Liste ganz unten anfügen
    const keys = Object.keys(referenceMap).sort((a, b) => a - b);
    if (keys.length) {
      finalHTML += "<hr style='border:none;border-top:1px solid #ccc;margin:6px 0;'>";
      keys.forEach(num => {
        const refText = referenceMap[num];
        if (/^https?:\/\//.test(refText)) {
          finalHTML += `<div style="font-size:0.8em;margin:2px 0;">
                          <sup>[${num}]</sup>
                          <a href="${refText}" target="_blank">${refText}</a>
                        </div>`;
        } else {
          finalHTML += `<div style="font-size:0.8em;margin:2px 0;">
                          <sup>[${num}]</sup>
                          ${refText}
                        </div>`;
        }
      });
    }
  
    div.innerHTML = finalHTML;
    responseDiv.appendChild(div);
    responseDiv.scrollTop = responseDiv.scrollHeight;

    // 6. Dem Parent mitteilen, wie groß der Inhalt ist (für dynamisches Resizing)
    window.parent.postMessage({
      type: "resize",
      width:  document.body.scrollWidth  + 20,  // Puffer
      height: document.body.scrollHeight + 20
    }, "*");
  }
  
});
