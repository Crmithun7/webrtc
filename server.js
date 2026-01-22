const WebSocket = require("ws");

const PORT = process.env.PORT || 8080;

/**
 * userId -> WebSocket
 */
const clients = new Map();

const wss = new WebSocket.Server({
  port: PORT,
  perMessageDeflate: false,
});

console.log(`✅ WebRTC Signaling Server running on port ${PORT}`);

/**
 * Heartbeat (prevents idle disconnects on Render)
 */
function heartbeat() {
  this.isAlive = true;
}

wss.on("connection", (ws) => {
  ws.isAlive = true;
  ws.on("pong", heartbeat);

  ws.on("message", (message) => {
    let data;
    try {
      data = JSON.parse(message.toString());
    } catch (e) {
      console.error("❌ Invalid JSON:", message.toString());
      return;
    }

    // ===== REGISTER USER =====
    if (data.type === "register") {
      ws.userId = data.userId;
      clients.set(data.userId, ws);
      console.log(`👤 Registered: ${data.userId}`);
      return;
    }

    // ===== FORWARD SIGNAL =====
    if (data.to && clients.has(data.to)) {
      const target = clients.get(data.to);

      if (target.readyState === WebSocket.OPEN) {
        target.send(JSON.stringify({
          ...data,
          from: data.from || ws.userId,
        }));
      }
    }
  });

  ws.on("close", () => {
    if (ws.userId) {
      clients.delete(ws.userId);
      console.log(`❌ Disconnected: ${ws.userId}`);
    }
  });

  ws.on("error", (err) => {
    console.error("WebSocket error:", err.message);
  });
});

/**
 * Ping all clients every 30s
 */
const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      if (ws.userId) clients.delete(ws.userId);
      return ws.terminate();
    }

    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on("close", () => {
  clearInterval(interval);
});
