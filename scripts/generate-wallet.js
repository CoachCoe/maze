const { ethers } = require("hardhat");

async function main() {
  console.log("🔑 Generating new Ethereum wallet...\n");

  // Generate random wallet
  const wallet = ethers.Wallet.createRandom();

  console.log("📋 Wallet Details:");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`Address: ${wallet.address}`);
  console.log(`Private Key: ${wallet.privateKey}`);
  console.log("═══════════════════════════════════════════════════════");
  console.log("\n⚠️  IMPORTANT: Save these credentials securely!");
  console.log("⚠️  NEVER share your private key with anyone!");
  console.log("\n📝 Next steps:");
  console.log("1. Copy the private key (without 0x prefix)");
  console.log("2. Create a .env file: cp .env.example .env");
  console.log("3. Add: PRIVATE_KEY=your_private_key_here");
  console.log("4. Get PAS tokens from: https://faucet.polkadot.io/");
  console.log("   (Use the address above)");
  console.log("5. Run: npm run deploy:paseo");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
