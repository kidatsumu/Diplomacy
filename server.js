// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let players = [];
let sockets = [];
let cpuCount = 0;
let unitStates = [];
let moveOrders = {};
let historyLog = [];
let nations = ["イギリス", "フランス", "ドイツ", "イタリア", "ロシア", "オーストリア", "トルコ"];

function createUnits(assignments) {
  return assignments.map(nation => ({ nation, location: nation.slice(0, 2) + "1" }));
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

  socket.on("startGame", ({ humanCount, cpuCount }) => {
    players = nations.slice(0, humanCount + cpuCount);
    cpuCount = cpu;
    const assignments = [...players];
    unitStates = createUnits(assignments);
    players.forEach((nation, i) => {
      if (i < humanCount) sockets[i].emit("assignNation", nation);
    });
    io.emit("renderUnits", unitStates);
  });

  socket.on("submitMove", ({ nation, from, to }) => {
    moveOrders[from] = { type: "move", target: to, nation };
  });

  socket.on("submitSupport", ({ nation, from, target }) => {
    moveOrders[from] = { type: "support", target, nation };
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
    const sender = players[sockets.indexOf(socket)] || "匿名";
    io.emit("chat", { sender, message: msg });
  });

  socket.on("getReplay", () => {
    io.emit("replayData", [unitStates.map(u => ({ ...u }))]);
  });
});

server.listen(3000, () => {
  console.log("Diplomacy server running on http://localhost:3000");
});
