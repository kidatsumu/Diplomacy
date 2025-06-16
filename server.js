const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

app.use(express.static("public")); // publicフォルダにindex.htmlなどを置く

let players = [];
let sockets = [];
let unitStates = [];
let moveOrders = {};
let historyLog = [];
let nations = ["イギリス", "フランス", "ドイツ", "イタリア", "ロシア", "オーストリア", "トルコ"];

function createUnits(assignments) {
  return assignments.map(nation => ({
    nation,
    location: nation.slice(0, 3).toUpperCase() // 例: "フラ" → "フラ1"
  }));
}

function resolveOrders() {
  historyLog.push("命令を解決中...");
  for (let loc in moveOrders) {
    const order = moveOrders[loc];
    const unit = unitStates.find(u => u.location === loc);
    if (unit && order.type === "move") {
      historyLog.push(`${unit.nation} のユニットが ${loc} から ${order.target} へ移動`);
      unit.location = order.target;
    }
    if (unit && order.type === "support") {
      historyLog.push(`${unit.nation} のユニットが ${order.target} を支援`);
    }
  }
  moveOrders = {};
}

function checkVictory() {
  const nationCount = {};
  for (const unit of unitStates) {
    nationCount[unit.nation] = (nationCount[unit.nation] || 0) + 1;
  }
  for (const nation in nationCount) {
    if (nationCount[nation] >= 5) return nation;
  }
  return null;
}

io.on("connection", socket => {
  sockets.push(socket);

  socket.on("startGame", ({ playerCount, cpuCount }) => {
    console.log("ゲーム開始:", playerCount, cpuCount);
    players = nations.slice(0, playerCount + cpuCount);
    const assignments = [...players];
    unitStates = createUnits(assignments);

    let humanAssigned = 0;
    for (let i = 0; i < sockets.length; i++) {
      if (humanAssigned >= playerCount) break;
      const s = sockets[i];
      const nation = assignments[humanAssigned];
      s.nation = nation;
      s.emit("assignNation", nation);
      humanAssigned++;
    }

    io.emit("renderUnits", unitStates);
    io.emit("updateTurn", `春 1年`);
  });

  socket.on("submitMove", ({ from, to }) => {
    const nation = socket.nation || "匿名";
    moveOrders[from] = { type: "move", target: to, nation };
    io.emit("logOrder", { from, to, type: "move" });
  });

  socket.on("submitSupport", ({ from, to }) => {
    const nation = socket.nation || "匿名";
    moveOrders[from] = { type: "support", target: to, nation };
    io.emit("logOrder", { from, to, type: "support" });
  });

  socket.on("resolvePhase", () => {
    resolveOrders();
    io.emit("resolutionLog", historyLog.at(-1));
    io.emit("historyLog", historyLog);
    io.emit("renderUnits", unitStates);
    const winner = checkVictory();
    if (winner) io.emit("victory", winner);
  });

  socket.on("chat", msg => {
    const sender = socket.nation || "匿名";
    io.emit("chat", { sender, message: msg });
  });

  socket.on("getReplay", () => {
    io.emit("replayData", [unitStates.map(u => ({ ...u }))]);
  });

  socket.on("disconnect", () => {
    console.log("切断:", socket.nation || "匿名");
    sockets = sockets.filter(s => s !== socket);
  });
});

server.listen(3000, () => {
  console.log("Diplomacy server running on http://localhost:3000");
});
