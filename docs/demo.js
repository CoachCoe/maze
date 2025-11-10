/**
 * Fog Maze - Demo Mode (No Blockchain)
 * Simplified version for trying the game without wallet
 */

const LEVEL_CONFIG = {
  1: { size: 10, vision: 2, timer: null, name: "Tutorial" },
  2: { size: 15, vision: 2, timer: 180, name: "Easy" },
  3: { size: 20, vision: 1.5, timer: 120, name: "Medium" },
  4: { size: 25, vision: 1.5, timer: 90, name: "Hard" },
  5: { size: 30, vision: 1, timer: 60, name: "Expert" }
};

class DemoGame {
  constructor() {
    this.currentLevel = 1;
    this.maze = null;
    this.playerPos = { x: 0, y: 0 };
    this.steps = 0;
    this.startTime = null;
    this.timerInterval = null;
    this.gameActive = false;
    this.revealed = new Set();

    this.canvas = document.getElementById("mazeCanvas");
    this.ctx = this.canvas.getContext("2d");

    this.initializeEventListeners();
  }

  initializeEventListeners() {
    document.getElementById("startBtn").addEventListener("click", () => this.startNewGame());
    document.getElementById("levelSelect").addEventListener("change", (e) => {
      this.currentLevel = parseInt(e.target.value);
    });

    document.addEventListener("keydown", (e) => this.handleKeyPress(e));
  }

  startNewGame() {
    // Generate random seed for demo
    const seed = '0x' + Array.from({length: 64}, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('');

    const config = LEVEL_CONFIG[this.currentLevel];
    const mazeGen = new MazeGenerator(seed, config.size, this.currentLevel);

    this.maze = mazeGen.getMaze();
    const start = mazeGen.getStart();
    const exit = mazeGen.getExit();

    this.playerPos = { x: start.x, y: start.y };
    this.exitPos = { x: exit.x, y: exit.y };
    this.steps = 0;
    this.startTime = Date.now();
    this.gameActive = true;
    this.revealed.clear();

    this.revealArea(this.playerPos.x, this.playerPos.y, config.vision);
    this.revealed.add(`${this.exitPos.x},${this.exitPos.y}`);

    if (config.timer) {
      this.startTimer(config.timer);
    }

    document.getElementById("currentLevel").textContent = `Level ${this.currentLevel} (${config.name})`;
    document.getElementById("currentSteps").textContent = "0";
    document.getElementById("currentTime").textContent = "0";
    document.getElementById("currentScore").textContent = "0";

    this.render();
    this.showStatus("Game started! Use WASD or arrow keys to move.", "success");
  }

  startTimer(seconds) {
    let remaining = seconds;
    document.getElementById("currentTime").textContent = remaining;

    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }

    this.timerInterval = setInterval(() => {
      remaining--;
      document.getElementById("currentTime").textContent = remaining;

      if (remaining <= 0) {
        clearInterval(this.timerInterval);
        this.gameOver(false);
      }
    }, 1000);
  }

  handleKeyPress(e) {
    if (!this.gameActive) return;

    const config = LEVEL_CONFIG[this.currentLevel];
    let dx = 0, dy = 0;

    switch (e.key.toLowerCase()) {
      case "w":
      case "arrowup":
        dy = -1;
        break;
      case "s":
      case "arrowdown":
        dy = 1;
        break;
      case "a":
      case "arrowleft":
        dx = -1;
        break;
      case "d":
      case "arrowright":
        dx = 1;
        break;
      default:
        return;
    }

    e.preventDefault();

    const newX = this.playerPos.x + dx;
    const newY = this.playerPos.y + dy;

    if (this.isValidMove(newX, newY)) {
      this.playerPos.x = newX;
      this.playerPos.y = newY;
      this.steps++;

      document.getElementById("currentSteps").textContent = this.steps;

      this.revealArea(newX, newY, config.vision);

      if (newX === this.exitPos.x && newY === this.exitPos.y) {
        this.gameOver(true);
      }

      this.render();
    }
  }

  isValidMove(x, y) {
    const size = this.maze.length;
    if (x < 0 || x >= size || y < 0 || y >= size) return false;
    return this.maze[y][x] !== 0;
  }

  revealArea(cx, cy, radius) {
    this.revealed.clear();
    this.revealed.add(`${this.exitPos.x},${this.exitPos.y}`);

    for (let y = cy - radius; y <= cy + radius; y++) {
      for (let x = cx - radius; x <= cx + radius; x++) {
        if (x >= 0 && x < this.maze.length && y >= 0 && y < this.maze.length) {
          const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
          if (dist <= radius) {
            this.revealed.add(`${x},${y}`);
          }
        }
      }
    }
  }

  isRevealed(x, y) {
    return this.revealed.has(`${x},${y}`);
  }

  render() {
    if (!this.maze) return;

    const size = this.maze.length;
    const cellSize = this.canvas.width / size;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const isRev = this.isRevealed(x, y);

        if (!isRev) {
          this.ctx.fillStyle = "#1a1a2e";
          this.ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        } else {
          const cell = this.maze[y][x];

          if (cell === 0) {
            this.ctx.fillStyle = "#16213e";
          } else if (cell === 3) {
            this.ctx.fillStyle = "#00ff00";
          } else {
            this.ctx.fillStyle = "#0f3460";
          }

          this.ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        }

        this.ctx.strokeStyle = "#0a0a0a";
        this.ctx.lineWidth = 0.5;
        this.ctx.strokeRect(x * cellSize, y * cellSize, cellSize, cellSize);
      }
    }

    this.ctx.fillStyle = "#e94560";
    this.ctx.beginPath();
    this.ctx.arc(
      (this.playerPos.x + 0.5) * cellSize,
      (this.playerPos.y + 0.5) * cellSize,
      cellSize * 0.3,
      0,
      Math.PI * 2
    );
    this.ctx.fill();
  }

  gameOver(win) {
    this.gameActive = false;

    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }

    if (win) {
      const timeTaken = Math.floor((Date.now() - this.startTime) / 1000);
      const score = this.calculateScore(this.currentLevel, this.steps, timeTaken);

      document.getElementById("currentTime").textContent = timeTaken;
      document.getElementById("currentScore").textContent = score;

      this.showStatus(`🎉 Maze completed! Score: ${score}`, "success");

      for (let y = 0; y < this.maze.length; y++) {
        for (let x = 0; x < this.maze.length; x++) {
          this.revealed.add(`${x},${y}`);
        }
      }
      this.render();
    } else {
      this.showStatus("⏱️ Time's up! Try again.", "error");
    }
  }

  calculateScore(level, steps, timeTaken) {
    const baseScore = level * 1000;
    const penalty = steps * 2 + timeTaken * 3;
    return Math.max(0, baseScore - penalty);
  }

  showStatus(message, type = "info") {
    const statusEl = document.getElementById("status");
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;

    setTimeout(() => {
      statusEl.textContent = "";
      statusEl.className = "status";
    }, 5000);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  new DemoGame();
});
