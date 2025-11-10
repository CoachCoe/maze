/**
 * Fog Maze - Blockchain Integration
 * Handles wallet connection, contract interaction, and game state
 */

// Game configuration based on level
const LEVEL_CONFIG = {
  1: { size: 10, vision: 2, timer: null, name: "Tutorial" },
  2: { size: 15, vision: 2, timer: 180, name: "Easy" },
  3: { size: 20, vision: 1.5, timer: 120, name: "Medium" },
  4: { size: 25, vision: 1.5, timer: 90, name: "Hard" },
  5: { size: 30, vision: 1, timer: 60, name: "Expert" }
};

// Network configuration
const PASEO_CONFIG = {
  chainId: "0x190f4d86", // 420420422 in hex
  chainName: "Paseo Asset Hub Testnet",
  nativeCurrency: {
    name: "PAS",
    symbol: "PAS",
    decimals: 18
  },
  rpcUrls: ["https://testnet-passet-hub-eth-rpc.polkadot.io"],
  blockExplorerUrls: []
};

const HARDHAT_LOCAL_CONFIG = {
  chainId: "0x7a69", // 31337 in hex
  chainName: "Hardhat Local",
  nativeCurrency: {
    name: "ETH",
    symbol: "ETH",
    decimals: 18
  },
  rpcUrls: ["http://127.0.0.1:8545"],
  blockExplorerUrls: []
};

class FogMazeGame {
  constructor() {
    this.provider = null;
    this.signer = null;
    this.contract = null;
    this.userAddress = null; // H160 format (for contract calls)
    this.userAddressSS58 = null; // SS58 format (for display)
    this.currentLevel = 1;
    this.maze = null;
    this.playerPos = { x: 0, y: 0 };
    this.steps = 0;
    this.startTime = null;
    this.timerInterval = null;
    this.gameActive = false;
    this.seed = null;
    this.blockNumber = null;
    this.nonce = 0;
    this.revealed = new Set(); // Track revealed cells

    this.canvas = document.getElementById("mazeCanvas");
    this.ctx = this.canvas.getContext("2d");

    this.initializeEventListeners();
  }

  /**
   * Initialize UI event listeners
   */
  initializeEventListeners() {
    document.getElementById("connectTalismanBtn")?.addEventListener("click", () => this.connectWallet('talisman'));
    document.getElementById("switchAccountBtn")?.addEventListener("click", () => this.switchAccount());
    document.getElementById("startBtn").addEventListener("click", () => this.startNewGame());
    document.getElementById("submitBtn").addEventListener("click", () => this.submitRun());
    document.getElementById("levelSelect").addEventListener("change", (e) => {
      this.currentLevel = parseInt(e.target.value);
    });

    // Keyboard controls
    document.addEventListener("keydown", (e) => this.handleKeyPress(e));

    // Instructions toggle
    document.getElementById("toggleInstructions")?.addEventListener("click", () => {
      const instructions = document.getElementById("instructions");
      instructions.style.display = instructions.style.display === "none" ? "block" : "none";
    });
  }

  /**
   * Let user select an account from multiple available accounts
   */
  async selectAccount(accounts) {
    return new Promise((resolve) => {
      // Create modal
      const modal = document.createElement('div');
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
      `;

      const content = document.createElement('div');
      content.style.cssText = `
        background: #16213e;
        padding: 30px;
        border-radius: 10px;
        max-width: 500px;
        width: 90%;
        color: #eee;
      `;

      let html = '<h2 style="margin-top: 0; color: #00ff00;">Select Account</h2>';
      html += '<p style="margin-bottom: 20px;">Choose which account to use:</p>';
      html += '<div style="max-height: 400px; overflow-y: auto;">';

      accounts.forEach((account, index) => {
        const ss58 = AddressUtils.h160ToSS58(account);
        html += `
          <button
            data-account="${account}"
            style="
              width: 100%;
              padding: 15px;
              margin-bottom: 10px;
              background: #0f3460;
              border: 2px solid #e94560;
              border-radius: 5px;
              color: #eee;
              cursor: pointer;
              text-align: left;
              font-family: monospace;
              font-size: 12px;
            "
            onmouseover="this.style.background='#1a4d7a'"
            onmouseout="this.style.background='#0f3460'"
          >
            <div style="font-weight: bold; margin-bottom: 5px;">Account ${index + 1}</div>
            <div style="color: #aaa;">H160: ${AddressUtils.formatAddress(account, 10, 8)}</div>
            <div style="color: #00ff00;">SS58: ${AddressUtils.formatAddress(ss58, 10, 8)}</div>
          </button>
        `;
      });

      html += '</div>';
      html += `
        <button
          id="cancelAccountSelect"
          style="
            width: 100%;
            padding: 12px;
            margin-top: 15px;
            background: #555;
            border: none;
            border-radius: 5px;
            color: #eee;
            cursor: pointer;
            font-size: 14px;
          "
          onmouseover="this.style.background='#777'"
          onmouseout="this.style.background='#555'"
        >
          Cancel
        </button>
      `;

      content.innerHTML = html;
      modal.appendChild(content);
      document.body.appendChild(modal);

      // Add click handlers
      content.querySelectorAll('[data-account]').forEach(btn => {
        btn.addEventListener('click', () => {
          const account = btn.getAttribute('data-account');
          document.body.removeChild(modal);
          resolve(account);
        });
      });

      document.getElementById('cancelAccountSelect').addEventListener('click', () => {
        document.body.removeChild(modal);
        resolve(null);
      });
    });
  }

  /**
   * Switch to a different account
   */
  async switchAccount() {
    try {
      // Get the raw ethereum provider
      const ethereum = window.talismanEth || window.ethereum;

      if (!ethereum) {
        this.showStatus("No wallet found", "error");
        return;
      }

      // Request wallet to show all accounts
      const accounts = await ethereum.request({
        method: "wallet_requestPermissions",
        params: [{ eth_accounts: {} }]
      }).then(() => ethereum.request({
        method: "eth_requestAccounts"
      })).catch(() => {
        // If wallet_requestPermissions fails, just get accounts
        return ethereum.request({ method: "eth_accounts" });
      });

      if (accounts.length === 0) {
        this.showStatus("No accounts found. Please unlock your wallet.", "error");
        return;
      }

      // Show account selector
      const selectedAccount = await this.selectAccount(accounts);

      if (!selectedAccount) {
        return; // User cancelled
      }

      // Update to new account
      this.userAddress = selectedAccount;
      this.userAddressSS58 = AddressUtils.h160ToSS58(this.userAddress);

      console.log('Switched to address:', this.userAddress);
      console.log('SS58 format:', this.userAddressSS58);

      // Recreate provider and signer with new account
      this.provider = new ethers.BrowserProvider(ethereum);
      this.signer = await this.provider.getSigner(this.userAddress);

      // Reload contract with new signer
      const addressResponse = await fetch("./contract-address.json");
      const { address } = await addressResponse.json();
      const abiResponse = await fetch("./FogMaze.abi.json");
      const abi = await abiResponse.json();
      this.contract = new ethers.Contract(address, abi, this.signer);

      // Update UI
      document.getElementById("walletAddress").textContent =
        AddressUtils.formatAddress(this.userAddressSS58, 8, 6);
      document.getElementById("walletAddress").title = this.userAddressSS58;

      // Reload stats for new account
      await this.loadPlayerStats();

      this.showStatus(`Switched to: ${AddressUtils.formatAddress(this.userAddressSS58, 8, 6)}`, "success");
    } catch (error) {
      console.error("Account switch error:", error);
      this.showStatus(`Failed to switch account: ${error.message}`, "error");
    }
  }

  /**
   * Connect to Talisman wallet
   */
  async connectWallet(walletType = 'auto') {
    try {
      let ethereum;

      console.log('Talisman wallet detection:', {
        talismanEth: !!window.talismanEth,
        ethereumIsTalisman: window.ethereum?.isTalisman,
        ethereumProviders: window.ethereum?.providers?.length
      });

      // Manual wallet selection
      if (walletType === 'talisman') {
        // Try multiple ways to get Talisman
        if (window.talismanEth) {
          ethereum = window.talismanEth;
          console.log("Using Talisman wallet (talismanEth)");
        } else if (window.ethereum?.providers) {
          // Multiple providers - find Talisman
          const talisman = window.ethereum.providers.find(p => p.isTalisman);
          if (talisman) {
            ethereum = talisman;
            console.log("Using Talisman wallet (from providers array)");
          } else {
            alert("Talisman not found. Please:\n1. Install Talisman extension\n2. Disable MetaMask temporarily\n3. Refresh the page");
            return;
          }
        } else if (window.ethereum?.isTalisman) {
          ethereum = window.ethereum;
          console.log("Using Talisman wallet (ethereum.isTalisman)");
        } else {
          alert("Talisman wallet not detected!\n\nPlease:\n1. Make sure Talisman is installed\n2. Try disabling MetaMask temporarily\n3. Refresh the page and try again");
          return;
        }
      } else {
        // Auto-detect: Prefer Talisman over MetaMask
        if (window.talismanEth) {
          ethereum = window.talismanEth;
          console.log("Auto-detected: Using Talisman wallet (talismanEth)");
        } else if (window.ethereum?.providers) {
          const talisman = window.ethereum.providers.find(p => p.isTalisman);
          if (talisman) {
            ethereum = talisman;
            console.log("Auto-detected: Using Talisman wallet (from providers)");
          } else {
            ethereum = window.ethereum;
            console.log("Auto-detected: Using default wallet");
          }
        } else if (window.ethereum?.isTalisman) {
          ethereum = window.ethereum;
          console.log("Auto-detected: Using Talisman wallet (ethereum.isTalisman)");
        } else if (window.ethereum) {
          ethereum = window.ethereum;
          console.log("Auto-detected: Using compatible wallet");
        } else {
          alert("No wallet found! Please install Talisman or MetaMask.");
          return;
        }
      }

      // Request account access
      const accounts = await ethereum.request({
        method: "eth_requestAccounts"
      });

      // If multiple accounts, let user choose
      if (accounts.length > 1) {
        this.userAddress = await this.selectAccount(accounts);
        if (!this.userAddress) {
          this.showStatus("Account selection cancelled", "error");
          return;
        }
      } else {
        this.userAddress = accounts[0];
      }

      // Convert to SS58 for display
      this.userAddressSS58 = AddressUtils.h160ToSS58(this.userAddress);

      console.log('Address formats:');
      console.log('  H160 (EVM):', this.userAddress);
      console.log('  SS58 (Substrate):', this.userAddressSS58);

      // Create ethers provider and signer
      this.provider = new ethers.BrowserProvider(ethereum);
      this.signer = await this.provider.getSigner();

      // Try to switch to Paseo network
      await this.switchToPaseoNetwork();

      // Load contract
      await this.loadContract();

      // Update UI - display SS58 address
      document.getElementById("walletAddress").textContent =
        AddressUtils.formatAddress(this.userAddressSS58, 8, 6);
      document.getElementById("walletAddress").title = this.userAddressSS58; // Full address on hover

      // Update wallet buttons
      const talismanBtn = document.getElementById("connectTalismanBtn");
      const switchBtn = document.getElementById("switchAccountBtn");

      if (talismanBtn) {
        talismanBtn.style.display = "none";
      }
      if (switchBtn) {
        switchBtn.style.display = "inline-block";
      }

      document.getElementById("startBtn").disabled = false;

      // Load player stats
      await this.loadPlayerStats();

      this.showStatus(`Wallet connected: ${AddressUtils.formatAddress(this.userAddressSS58, 8, 6)}`, "success");
    } catch (error) {
      console.error("Wallet connection error:", error);
      this.showStatus(`Connection failed: ${error.message}`, "error");
    }
  }

  /**
   * Switch to correct network (auto-detect local or Paseo)
   */
  async switchToPaseoNetwork() {
    try {
      // Check if contract is deployed locally
      const response = await fetch("./contract-address.json");
      const data = await response.json();

      // Detect if we're using local or Paseo based on contract address file
      const isLocal = data.network === 'localhost' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const networkConfig = isLocal ? HARDHAT_LOCAL_CONFIG : PASEO_CONFIG;

      console.log(`Switching to ${isLocal ? 'Hardhat Local' : 'Paseo'} network...`);

      try {
        await this.provider.send("wallet_switchEthereumChain", [
          { chainId: networkConfig.chainId }
        ]);
        console.log("Network switched successfully");
      } catch (switchError) {
        // Network not added, try to add it
        if (switchError.code === 4902 || switchError.code === -32603) {
          console.log("Network not found, adding it...");
          try {
            await this.provider.send("wallet_addEthereumChain", [networkConfig]);
            console.log("Network added successfully");
          } catch (addError) {
            console.warn("Could not add network automatically:", addError);
            // Don't throw - let user add manually if needed
            alert(`Please add ${networkConfig.chainName} network manually:\n\nChain ID: ${parseInt(networkConfig.chainId, 16)}\nRPC URL: ${networkConfig.rpcUrls[0]}`);
          }
        } else if (switchError.code === 4001) {
          // User rejected
          throw new Error("Network switch rejected by user");
        } else {
          console.warn("Network switch error:", switchError);
          // Don't throw - might already be on the right network
        }
      }
    } catch (error) {
      console.warn("Network configuration warning:", error);
      // Don't throw - allow connection to proceed
    }
  }

  /**
   * Load smart contract
   */
  async loadContract() {
    try {
      // Load contract address and ABI
      const addressResponse = await fetch("./contract-address.json");
      const { address } = await addressResponse.json();

      const abiResponse = await fetch("./FogMaze.abi.json");
      const abi = await abiResponse.json();

      this.contract = new ethers.Contract(address, abi, this.signer);
      console.log("Contract loaded at:", address);
    } catch (error) {
      console.error("Contract loading error:", error);
      this.showStatus("Contract not deployed. Run 'npm run deploy:local' first.", "error");
    }
  }

  /**
   * Load player statistics from blockchain
   */
  async loadPlayerStats() {
    try {
      const runCount = await this.contract.getRunCount(this.userAddress);
      const bestScore = await this.contract.getBestScore(this.userAddress);

      document.getElementById("totalRuns").textContent = runCount.toString();
      document.getElementById("bestScore").textContent = bestScore.toString();
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  }

  /**
   * Start a new game
   */
  async startNewGame() {
    try {
      this.showStatus("Generating maze seed...", "info");

      // Get current block for seed
      const block = await this.provider.getBlock("latest");

      // Use previous block (contract requires blockNumber < current block)
      this.blockNumber = block.number - 1;

      // Ensure we have at least block 1
      if (this.blockNumber < 1) {
        this.showStatus("Waiting for blockchain to mine blocks...", "info");
        // Mine a transaction to create blocks
        const tx = await this.contract.incrementNonce();
        await tx.wait();
        const newBlock = await this.provider.getBlock("latest");
        this.blockNumber = newBlock.number - 1;
      }

      // Generate seed from contract
      this.nonce = parseInt(await this.contract.getNextNonce());
      this.seed = await this.contract.generateSeed(
        this.blockNumber,
        this.userAddress,
        this.nonce
      );

      console.log("Seed generated:", this.seed);
      console.log("Block:", this.blockNumber, "Nonce:", this.nonce);

      // Generate maze
      const config = LEVEL_CONFIG[this.currentLevel];
      const mazeGen = new MazeGenerator(this.seed, config.size, this.currentLevel);

      this.maze = mazeGen.getMaze();
      const start = mazeGen.getStart();
      const exit = mazeGen.getExit();

      // Debug: Check maze generation
      console.log('Maze size:', this.maze.length, 'x', this.maze[0].length);
      console.log('Start:', start);
      console.log('Exit:', exit);

      // Count walls vs paths
      let walls = 0, paths = 0;
      for (let y = 0; y < this.maze.length; y++) {
        for (let x = 0; x < this.maze[y].length; x++) {
          if (this.maze[y][x] === 0) walls++;
          else paths++;
        }
      }
      console.log('Walls:', walls, 'Paths:', paths, 'Ratio:', (walls / (walls + paths) * 100).toFixed(1) + '%');

      this.playerPos = { x: start.x, y: start.y };
      this.exitPos = { x: exit.x, y: exit.y };
      this.steps = 0;
      this.startTime = Date.now();
      this.gameActive = true;
      this.revealed.clear();

      // Reveal starting area
      this.revealArea(this.playerPos.x, this.playerPos.y, config.vision);

      // Always reveal the exit so players know where to go
      this.revealed.add(`${this.exitPos.x},${this.exitPos.y}`);

      // Start timer if level has one
      if (config.timer) {
        this.startTimer(config.timer);
      }

      // Update UI
      document.getElementById("currentLevel").textContent = `Level ${this.currentLevel} (${config.name})`;
      document.getElementById("currentSteps").textContent = "0";
      document.getElementById("submitBtn").style.display = "none";

      this.render();
      this.showStatus("Game started! Use WASD or arrow keys to move.", "success");
    } catch (error) {
      console.error("Error starting game:", error);
      this.showStatus(`Failed to start: ${error.message}`, "error");
    }
  }

  /**
   * Start countdown timer
   */
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

  /**
   * Handle keyboard input
   */
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

    // Check if move is valid
    if (this.isValidMove(newX, newY)) {
      this.playerPos.x = newX;
      this.playerPos.y = newY;
      this.steps++;

      document.getElementById("currentSteps").textContent = this.steps;

      // Reveal new area
      this.revealArea(newX, newY, config.vision);

      // Check win condition
      if (newX === this.exitPos.x && newY === this.exitPos.y) {
        this.gameOver(true);
      }

      this.render();
    }
  }

  /**
   * Check if move is valid (not a wall)
   */
  isValidMove(x, y) {
    const size = this.maze.length;
    if (x < 0 || x >= size || y < 0 || y >= size) return false;
    return this.maze[y][x] !== 0; // Not a wall
  }

  /**
   * Reveal area around player (fog of war)
   * Now only shows current visible area, not permanent exploration
   */
  revealArea(cx, cy, radius) {
    // Clear all revealed cells except the exit
    this.revealed.clear();
    this.revealed.add(`${this.exitPos.x},${this.exitPos.y}`);

    // Only reveal cells within vision radius
    for (let y = cy - radius; y <= cy + radius; y++) {
      for (let x = cx - radius; x <= cx + radius; x++) {
        if (x >= 0 && x < this.maze.length && y >= 0 && y < this.maze.length) {
          // Circular vision
          const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
          if (dist <= radius) {
            this.revealed.add(`${x},${y}`);
          }
        }
      }
    }
  }

  /**
   * Check if cell is revealed
   */
  isRevealed(x, y) {
    return this.revealed.has(`${x},${y}`);
  }

  /**
   * Render maze on canvas
   */
  render() {
    if (!this.maze) return;

    const size = this.maze.length;
    const cellSize = this.canvas.width / size;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw maze
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const isRev = this.isRevealed(x, y);

        if (!isRev) {
          // Fog of war
          this.ctx.fillStyle = "#1a1a2e";
          this.ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        } else {
          // Revealed cell
          const cell = this.maze[y][x];

          if (cell === 0) {
            // Wall
            this.ctx.fillStyle = "#16213e";
          } else if (cell === 3) {
            // Exit
            this.ctx.fillStyle = "#00ff00";
          } else {
            // Path
            this.ctx.fillStyle = "#0f3460";
          }

          this.ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        }

        // Grid lines
        this.ctx.strokeStyle = "#0a0a0a";
        this.ctx.lineWidth = 0.5;
        this.ctx.strokeRect(x * cellSize, y * cellSize, cellSize, cellSize);
      }
    }

    // Draw player
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

  /**
   * Game over (win or timeout)
   */
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

      document.getElementById("submitBtn").style.display = "block";
      this.showStatus(`🎉 Maze completed! Score: ${score}`, "success");

      // Reveal entire maze
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

  /**
   * Calculate score (matches contract formula)
   */
  calculateScore(level, steps, timeTaken) {
    const baseScore = level * 1000;
    const penalty = steps * 2 + timeTaken * 3;
    return Math.max(0, baseScore - penalty);
  }

  /**
   * Submit run to blockchain
   */
  async submitRun() {
    try {
      this.showStatus("Submitting to blockchain...", "info");
      document.getElementById("submitBtn").disabled = true;

      const timeTaken = Math.floor((Date.now() - this.startTime) / 1000);

      const tx = await this.contract.submitRun(
        this.currentLevel,
        this.steps,
        timeTaken,
        this.blockNumber,
        this.nonce
      );

      this.showStatus("Transaction sent! Waiting for confirmation...", "info");

      const receipt = await tx.wait();
      console.log("Transaction confirmed:", receipt);

      // Increment nonce on contract
      await this.contract.incrementNonce();

      // Reload stats
      await this.loadPlayerStats();

      this.showStatus("✅ Run submitted successfully!", "success");
      document.getElementById("submitBtn").style.display = "none";
    } catch (error) {
      console.error("Submission error:", error);
      this.showStatus(`Submission failed: ${error.message}`, "error");
      document.getElementById("submitBtn").disabled = false;
    }
  }

  /**
   * Show status message
   */
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

// Initialize game when page loads
let game;
window.addEventListener("DOMContentLoaded", () => {
  game = new FogMazeGame();
});
