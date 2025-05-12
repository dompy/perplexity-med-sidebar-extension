// content.js – Perplexity Sidebar

console.log("✅ content.js wurde geladen");
let lastClickPosition = { x: 0, y: 0 };
let ignoreNextMouseup = false;

// Referenz aufs aktuelle Chat-iFrame
let activeChatWindow = null;

// Maus-Up für Auswahlmenu
document.addEventListener("mouseup", (event) => {
  if (event.target.closest("#gpt-menu")) return;
  if (ignoreNextMouseup) {
    ignoreNextMouseup = false;
    return;
  }
  const selection = window.getSelection().toString().trim();
  if (selection.length > 0) {
    showMenu(selection, event);
  } else {
    removeMenu();
  }
});

function showMenu(selectedText, event) {
  removeMenu();
  const range = window.getSelection().getRangeAt(0);
  const rect  = range.getBoundingClientRect();

  const menu = document.createElement("div");
  menu.id    = "gpt-menu";
  menu.innerText = "💬 Explain";
  menu.className = "gpt-menu";
  menu.style.position = "absolute";
  menu.style.top      = `${window.scrollY + rect.top + 30}px`;
  menu.style.left     = `${window.scrollX + rect.left}px`;

  menu.addEventListener("mousedown", e => {
    e.stopPropagation();
    e.preventDefault();
  });
  menu.addEventListener("click",    e => {
    ignoreNextMouseup = true;
    lastClickPosition = {
      x: window.scrollX + rect.left,
      y: window.scrollY + rect.bottom
    };
    openChatWindow(selectedText);
    removeMenu();
  });

  document.body.appendChild(menu);
}

function removeMenu() {
  const old = document.getElementById("gpt-menu");
  if (old) old.remove();
}

// Resize-Events vom iframe empfangen
window.addEventListener("message", (event) => {
  if (event.data?.type === "resize" && activeChatWindow) {
    const { width, height } = event.data;
    const maxW = 800, maxH = 900;
    activeChatWindow.style.width  = Math.max(400, Math.min(width,  maxW)) + "px";
    activeChatWindow.style.height = Math.max(250, Math.min(height, maxH)) + "px";
  }
});


function openChatWindow(selectedText) {
  console.log("💬 Chatfenster öffnen für:", selectedText);

  const chatWindow = document.createElement("iframe");
  const src = chrome.runtime.getURL("chat.html") + `?q=${encodeURIComponent(selectedText)}`;
  chatWindow.src       = src;
  chatWindow.className = "gpt-chat-frame";
  chatWindow.style.position    = "absolute";
  chatWindow.style.left        = `${lastClickPosition.x}px`;
  chatWindow.style.top         = `${lastClickPosition.y + 25}px`;
  chatWindow.style.zIndex      = "10000";
  chatWindow.style.border      = "2px solid black";
  chatWindow.style.background  = "white";
  chatWindow.style.borderRadius= "8px";
  chatWindow.style.boxShadow   = "0 4px 12px rgba(0,0,0,0.3)";

  // großzügiger Startwert, damit es nicht zu winzig wirkt
  chatWindow.style.minWidth  = "400px";
  chatWindow.style.minHeight = "250px";
  chatWindow.style.width     = "400px";
  chatWindow.style.height    = "250px";

  chatWindow.onerror = (e) => console.error("❌ iframe-Fehler:", e);

  // ins DOM hängen und als "active" speichern
  document.body.appendChild(chatWindow);
  activeChatWindow = chatWindow;
}


document.addEventListener("click", (event) => {
  const chatFrame = document.querySelector(".gpt-chat-frame");
  const menu      = document.getElementById("gpt-menu");
  if (chatFrame && !chatFrame.contains(event.target) && event.target !== menu) {
    chatFrame.remove();
    activeChatWindow = null;
  }
}, true);
