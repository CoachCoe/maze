# 🌫️ Fog Maze - On-Chain Deterministic Maze Game

A fully on-chain, single-player maze game deployed on Paseo Asset Hub (Polkadot testnet). Every maze is deterministically generated from blockchain data, making the game 100% verifiable and reproducible.

## 🎮 Game Features

- **100% On-Chain**: All game logic runs on smart contracts - no servers, no IPFS
- **Deterministic**: Same seed always generates the same maze
- **Verifiable**: Anyone can reproduce and verify your runs
- **Fog of War**: Limited vision radius adds challenge
- **5 Difficulty Levels**: From tutorial to expert
- **On-Chain Leaderboard**: All scores stored permanently on blockchain
- **AI-Resistant**: Recursive backtracking with braiding creates complex mazes

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│           Paseo Asset Hub Blockchain            │
│  ┌──────────────────────────────────────────┐  │
│  │        FogMaze Smart Contract             │  │
│  │  - Seed Generation (blockhash + address) │  │
│  │  - Run Submission & Scoring               │  │
│  │  - Player Statistics                      │  │
│  └──────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
                      ↕
┌─────────────────────────────────────────────────┐
│              Frontend (Browser)                  │
│  ┌──────────────────────────────────────────┐  │
│  │  Deterministic Maze Generator (JS)        │  │
│  │  - Uses blockchain seed                   │  │
│  │  - Recursive Backtracking + Braiding      │  │
│  │  - Fog of War Rendering                   │  │
│  └──────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────┐  │
│  │  Web3 Integration (Ethers.js)             │  │
│  │  - Talisman/MetaMask Wallet Support       │  │
│  │  - Contract Interaction                   │  │
│  └──────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

## 📋 Prerequisites

- Node.js v16+ and npm
- Talisman wallet
- PAS tokens (Paseo Asset Hub testnet)

## 🎮 Try the Demo

**Play instantly without setup:** [https://fog-maze.vercel.app](https://fog-maze.vercel.app)

No wallet required for the demo! Just visit the link and start playing.

## 🚀 Quick Start

### 1. Installation

```bash
# Clone repository
git clone <your-repo-url>
cd fog-maze

# Install dependencies
npm install

# Create environment file
cp .env.example .env
# Edit .env and add your private key
```

### 2. Local Development

```bash
# Terminal 1: Start local Hardhat node
npm run node

# Terminal 2: Deploy contract
npm run deploy:local

# Terminal 3: Serve frontend
npm run serve
```

Open http://localhost:8080 in your browser.

### 3. Deploy to Paseo Testnet

```bash
# Deploy to Paseo Asset Hub
npm run deploy:paseo
```

The contract address will be saved to `frontend/contract-address.json`.

## 🧪 Testing

```bash
# Run all contract tests
npm test

# Run with coverage
npx hardhat coverage

# Run specific test file
npx hardhat test test/FogMaze.test.js
```

## 📖 How to Play

### Setup
1. **Connect Wallet**: Click "Connect Talisman" and approve the connection
2. **Add Network**: The app will prompt you to add Paseo Asset Hub to your wallet
3. **Get Testnet Tokens**: Visit [Polkadot Faucet](https://faucet.polkadot.io/) to get PAS tokens
4. **Address Format**: Your address will be displayed in Substrate SS58 format (native to Polkadot)

### Gameplay
1. **Select Level**: Choose from 5 difficulty levels
2. **Start Game**: Maze is generated from blockchain seed
3. **Navigate**: Use WASD or arrow keys to move
4. **Find Exit**: Reach the green exit cell before time runs out
5. **Submit**: Send your score to the blockchain

### Scoring
```
Score = (Level × 1000) - (Steps × 2 + Time × 3)
```

Higher levels give more base points, but taking too many steps or too much time reduces your score.

## 🎯 Level Progression

| Level | Size  | Vision | Timer | Difficulty |
|-------|-------|--------|-------|------------|
| 1     | 10×10 | 4      | None  | Tutorial   |
| 2     | 15×15 | 3      | 180s  | Easy       |
| 3     | 20×20 | 3      | 120s  | Medium     |
| 4     | 25×25 | 2      | 90s   | Hard       |
| 5     | 30×30 | 2      | 60s   | Expert     |

## 🔑 Key Concepts

### Deterministic Seed Generation

The contract generates seeds using:
```solidity
keccak256(abi.encodePacked(blockhash(blockNumber), playerAddress, nonce))
```

This ensures:
- **Uniqueness**: Different seeds for different players/blocks/nonces
- **Reproducibility**: Same inputs always produce the same seed
- **Verifiability**: Anyone can regenerate the maze from on-chain data

### Blockhash Window

Ethereum-compatible chains only store the last 256 block hashes. This means:
- Seeds must be generated from recent blocks (< 256 blocks old)
- You have ~51 minutes on Polkadot to complete and submit
- The nonce system allows multiple attempts per block

### Maze Generation Algorithm

Uses **Recursive Backtracking** with enhancements:
1. Start from random edge position
2. Carve paths using depth-first search
3. Add "braiding" (loops) based on level for AI resistance
4. Place exit on opposite side from start

This creates mazes with:
- Long winding corridors
- Strategic decision points
- Multiple valid paths at higher levels
- Natural difficulty progression

## 🛠️ Smart Contract API

### Read Functions

```solidity
// Generate seed for maze
generateSeed(uint256 blockNumber, address player, uint256 nonce)
  → bytes32

// Get player's runs
getRuns(address player) → Run[]

// Get player's best score
getBestScore(address player) → uint256

// Get number of runs
getRunCount(address player) → uint256
```

### Write Functions

```solidity
// Submit completed run
submitRun(
  uint256 level,
  uint256 steps,
  uint256 timeTaken,
  uint256 blockNumber,
  uint256 nonce
)

// Increment player's nonce
incrementNonce()
```

## 📁 Project Structure

```
fog-maze/
├── contracts/
│   └── FogMaze.sol           # Smart contract
├── scripts/
│   └── deploy.js             # Deployment script
├── test/
│   └── FogMaze.test.js       # Contract tests
├── frontend/
│   ├── index.html            # Game UI
│   ├── style.css             # Styling
│   ├── app.js                # Blockchain integration
│   ├── address-utils.js      # Substrate address utilities
│   ├── maze.js               # Maze generation
│   ├── contract-address.json # Deployed address (generated)
│   └── FogMaze.abi.json      # Contract ABI (generated)
├── hardhat.config.js         # Hardhat configuration
├── package.json              # Dependencies
└── README.md                 # This file
```

## 🌐 Network Configuration

### Paseo Asset Hub Testnet

- **Chain ID**: 420420422 (0x190f4d86)
- **RPC URL**: https://testnet-passet-hub-eth-rpc.polkadot.io
- **Native Token**: PAS
- **Block Time**: ~12 seconds
- **Block Explorer**: TBA

### Adding to Wallet

The app will automatically prompt you to add the network. Manual configuration:

```javascript
{
  chainId: "0x190f4d86",
  chainName: "Paseo Asset Hub Testnet",
  rpcUrls: ["https://testnet-passet-hub-eth-rpc.polkadot.io"],
  nativeCurrency: {
    name: "PAS",
    symbol: "PAS",
    decimals: 18
  }
}
```

## 🔐 Security Considerations

### Smart Contract
- ✅ Blockhash validation (not future, not too old)
- ✅ Run limit per player (max 100 to prevent storage DOS)
- ✅ Score calculation prevents negative values
- ✅ No external calls or reentrancy risks
- ✅ Minimal on-chain storage

### Frontend
- ⚠️ Client-side maze generation trusts the player
- ⚠️ Consider adding merkle proof verification for production
- ⚠️ No protection against automated solvers (by design - AI resistance is gameplay-based)

### Address Handling
- ✅ Displays Substrate SS58 addresses for Polkadot ecosystem compatibility
- ✅ Internally uses H160 (EVM) addresses for smart contract interaction
- ✅ Automatic conversion between formats using @polkadot/util-crypto

## 🚧 Future Enhancements

### Potential Features
- [ ] NFT minting for completed runs
- [ ] Global leaderboard contract
- [ ] zkSNARK proof of completion
- [ ] Multiplayer races
- [ ] Custom maze parameters
- [ ] Achievement system
- [ ] Streak tracking

## 📊 Gas Costs (Estimated)

| Operation | Gas | Cost (PAS) |
|-----------|-----|------------|
| Deploy Contract | ~800,000 | ~0.008 |
| Submit Run | ~100,000 | ~0.001 |
| Get Stats (read) | 0 | Free |

## 🐛 Troubleshooting

### "Block too old" error
- The blockhash expired (>256 blocks)
- Start a new game to generate a fresh seed

### "Transaction failed" when submitting
- Check you have enough PAS for gas
- Verify you're on Paseo Asset Hub network
- Ensure the game was completed (reached exit)

### Maze not generating
- Check browser console for errors
- Verify contract-address.json exists in frontend/
- Ensure FogMaze.abi.json was generated

### Wallet not connecting
- Install Talisman wallet extension
- Check you're not in private/incognito mode
- Try refreshing the page
- Use the "Switch Account" button if you have multiple Talisman accounts

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Add tests for new features
4. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- Built for Paseo Asset Hub (Polkadot testnet)
- Uses Hardhat development framework
- Ethers.js for Web3 integration
- Inspired by classic maze games and roguelikes

## 📞 Support

- GitHub Issues: [Report bugs](https://github.com/your-repo/issues)
- Documentation: See inline code comments
- Community: Join Polkadot Discord

---

**Fog Maze** - Unstoppable • Verifiable • Deterministic

Built with ❤️ for the Web3 gaming community
