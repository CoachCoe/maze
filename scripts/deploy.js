const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const networkName = hre.network.name;
  console.log(`\n🚀 Deploying FogMaze contract to ${networkName}...`);

  // Get deployer account
  const [deployer] = await hre.ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  const balance = await hre.ethers.provider.getBalance(deployerAddress);

  console.log(`📝 Deploying from account: ${deployerAddress}`);
  console.log(`💰 Account balance: ${hre.ethers.formatEther(balance)} ${networkName === 'paseo' ? 'PAS' : 'ETH'}`);

  // Deploy contract
  console.log("\n⏳ Deploying contract...");
  const FogMaze = await hre.ethers.getContractFactory("FogMaze");
  const fogMaze = await FogMaze.deploy();

  await fogMaze.waitForDeployment();
  const contractAddress = await fogMaze.getAddress();

  console.log(`✅ FogMaze deployed to: ${contractAddress}`);

  // Verify contract constants
  const maxRuns = await fogMaze.MAX_RUNS_PER_PLAYER();
  const blockWindow = await fogMaze.BLOCK_WINDOW();

  console.log(`\n📊 Contract Configuration:`);
  console.log(`   Max runs per player: ${maxRuns}`);
  console.log(`   Block window: ${blockWindow} blocks`);

  // Save deployment info to frontend
  const deploymentInfo = {
    address: contractAddress,
    network: networkName,
    chainId: hre.network.config.chainId,
    deployer: deployerAddress,
    timestamp: new Date().toISOString(),
    blockNumber: await hre.ethers.provider.getBlockNumber()
  };

  const frontendDir = path.join(__dirname, "..", "frontend");
  if (!fs.existsSync(frontendDir)) {
    fs.mkdirSync(frontendDir, { recursive: true });
  }

  const deploymentPath = path.join(frontendDir, "contract-address.json");
  fs.writeFileSync(
    deploymentPath,
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log(`\n💾 Deployment info saved to: ${deploymentPath}`);

  // Save ABI
  const artifactPath = path.join(
    __dirname,
    "..",
    "artifacts",
    "contracts",
    "FogMaze.sol",
    "FogMaze.json"
  );

  if (fs.existsSync(artifactPath)) {
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    const abiPath = path.join(frontendDir, "FogMaze.abi.json");
    fs.writeFileSync(abiPath, JSON.stringify(artifact.abi, null, 2));
    console.log(`📋 Contract ABI saved to: ${abiPath}`);
  }

  console.log("\n✨ Deployment complete!");
  console.log("\n📝 Next steps:");
  console.log("   1. Update frontend to use this contract address");
  console.log("   2. Fund your wallet with PAS tokens if deploying to Paseo");
  console.log("   3. Open frontend/index.html in a browser");
  console.log("   4. Connect Talisman wallet and start playing!");

  if (networkName === "paseo") {
    console.log("\n🔗 Paseo Asset Hub Network:");
    console.log("   Chain ID: 420420422");
    console.log("   RPC: https://testnet-passet-hub-eth-rpc.polkadot.io");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:");
    console.error(error);
    process.exit(1);
  });
