const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, mine } = require("@nomicfoundation/hardhat-network-helpers");

describe("FogMaze", function () {
  let fogMaze;
  let owner, player1, player2;

  beforeEach(async function () {
    [owner, player1, player2] = await ethers.getSigners();

    const FogMaze = await ethers.getContractFactory("FogMaze");
    fogMaze = await FogMaze.deploy();
    await fogMaze.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should deploy with correct constants", async function () {
      expect(await fogMaze.MAX_RUNS_PER_PLAYER()).to.equal(100);
      expect(await fogMaze.BLOCK_WINDOW()).to.equal(256);
    });

    it("Should initialize with zero runs for players", async function () {
      expect(await fogMaze.getRunCount(player1.address)).to.equal(0);
      expect(await fogMaze.getBestScore(player1.address)).to.equal(0);
    });
  });

  describe("Seed Generation", function () {
    it("Should generate deterministic seeds", async function () {
      // Mine some blocks to have blockhash available
      await mine(5);

      const blockNumber = await ethers.provider.getBlockNumber();
      const nonce = 0;

      const seed1 = await fogMaze.generateSeed(
        blockNumber - 1,
        player1.address,
        nonce
      );
      const seed2 = await fogMaze.generateSeed(
        blockNumber - 1,
        player1.address,
        nonce
      );

      expect(seed1).to.equal(seed2);
    });

    it("Should generate different seeds for different nonces", async function () {
      await mine(5);
      const blockNumber = await ethers.provider.getBlockNumber();

      const seed1 = await fogMaze.generateSeed(
        blockNumber - 1,
        player1.address,
        0
      );
      const seed2 = await fogMaze.generateSeed(
        blockNumber - 1,
        player1.address,
        1
      );

      expect(seed1).to.not.equal(seed2);
    });

    it("Should generate different seeds for different players", async function () {
      await mine(5);
      const blockNumber = await ethers.provider.getBlockNumber();

      const seed1 = await fogMaze.generateSeed(
        blockNumber - 1,
        player1.address,
        0
      );
      const seed2 = await fogMaze.generateSeed(
        blockNumber - 1,
        player2.address,
        0
      );

      expect(seed1).to.not.equal(seed2);
    });

    it("Should revert if block not yet mined", async function () {
      const futureBlock = (await ethers.provider.getBlockNumber()) + 10;

      await expect(
        fogMaze.generateSeed(futureBlock, player1.address, 0)
      ).to.be.revertedWith("Block not yet mined");
    });

    it("Should revert if block too old (>256 blocks)", async function () {
      // Mine enough blocks to have a valid old block reference
      await mine(300);
      const currentBlock = await ethers.provider.getBlockNumber();
      const oldBlock = currentBlock - 257;

      await expect(
        fogMaze.generateSeed(oldBlock, player1.address, 0)
      ).to.be.revertedWith("Block too old (>256 blocks)");
    });
  });

  describe("Score Calculation", function () {
    it("Should calculate score correctly", async function () {
      // Level 1: 1000 points, 10 steps, 20 seconds
      // Score = 1000 - (10*2 + 20*3) = 1000 - 80 = 920
      const score = await fogMaze.calculateScore(1, 10, 20);
      expect(score).to.equal(920);
    });

    it("Should return 0 for negative scores", async function () {
      // Level 1: 1000 points, 500 steps, 500 seconds
      // Score = 1000 - (500*2 + 500*3) = 1000 - 2500 = -1500 → 0
      const score = await fogMaze.calculateScore(1, 500, 500);
      expect(score).to.equal(0);
    });

    it("Should reward higher levels", async function () {
      const score1 = await fogMaze.calculateScore(1, 10, 10);
      const score2 = await fogMaze.calculateScore(2, 10, 10);

      expect(score2).to.be.greaterThan(score1);
    });

    it("Should penalize more steps", async function () {
      const score1 = await fogMaze.calculateScore(1, 10, 10);
      const score2 = await fogMaze.calculateScore(1, 20, 10);

      expect(score1).to.be.greaterThan(score2);
    });

    it("Should penalize more time", async function () {
      const score1 = await fogMaze.calculateScore(1, 10, 10);
      const score2 = await fogMaze.calculateScore(1, 10, 20);

      expect(score1).to.be.greaterThan(score2);
    });
  });

  describe("Run Submission", function () {
    it("Should submit a run successfully", async function () {
      await mine(5);
      const blockNumber = await ethers.provider.getBlockNumber();

      await fogMaze.connect(player1).submitRun(1, 100, 60, blockNumber - 1, 0);

      const runs = await fogMaze.getRuns(player1.address);
      expect(runs.length).to.equal(1);
      expect(runs[0].level).to.equal(1);
      expect(runs[0].steps).to.equal(100);
      expect(runs[0].timeTaken).to.equal(60);
    });

    it("Should emit RunSubmitted event", async function () {
      await mine(5);
      const blockNumber = await ethers.provider.getBlockNumber();

      await expect(
        fogMaze.connect(player1).submitRun(1, 100, 60, blockNumber - 1, 0)
      )
        .to.emit(fogMaze, "RunSubmitted")
        .withArgs(
          player1.address,
          1,
          100,
          60,
          await fogMaze.generateSeed(blockNumber - 1, player1.address, 0),
          await fogMaze.calculateScore(1, 100, 60),
          0
        );
    });

    it("Should allow multiple runs per player", async function () {
      await mine(10);
      let blockNumber = await ethers.provider.getBlockNumber();

      await fogMaze.connect(player1).submitRun(1, 100, 60, blockNumber - 1, 0);
      await mine(2);
      blockNumber = await ethers.provider.getBlockNumber();
      await fogMaze.connect(player1).submitRun(2, 150, 90, blockNumber - 1, 1);

      const runs = await fogMaze.getRuns(player1.address);
      expect(runs.length).to.equal(2);
    });

    it("Should prevent runs with invalid level", async function () {
      await mine(5);
      const blockNumber = await ethers.provider.getBlockNumber();

      await expect(
        fogMaze.connect(player1).submitRun(0, 100, 60, blockNumber - 1, 0)
      ).to.be.revertedWith("Invalid level");
    });

    it("Should enforce max runs per player", async function () {
      await mine(10);

      // Submit 100 runs (max allowed)
      for (let i = 0; i < 100; i++) {
        const blockNumber = await ethers.provider.getBlockNumber();
        await fogMaze.connect(player1).submitRun(1, 10, 10, blockNumber - 1, i);
        if (i % 10 === 0) await mine(2); // Mine blocks periodically
      }

      // Try to submit 101st run
      const blockNumber = await ethers.provider.getBlockNumber();
      await expect(
        fogMaze.connect(player1).submitRun(1, 10, 10, blockNumber - 1, 100)
      ).to.be.revertedWith("Max runs reached");
    });

    it("Should store correct timestamp", async function () {
      await mine(5);
      const blockNumber = await ethers.provider.getBlockNumber();

      const tx = await fogMaze
        .connect(player1)
        .submitRun(1, 100, 60, blockNumber - 1, 0);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      const runs = await fogMaze.getRuns(player1.address);
      expect(runs[0].timestamp).to.equal(block.timestamp);
    });
  });

  describe("Player Statistics", function () {
    beforeEach(async function () {
      // Submit some test runs
      await mine(10);

      let blockNumber = await ethers.provider.getBlockNumber();
      await fogMaze.connect(player1).submitRun(1, 100, 60, blockNumber - 1, 0); // Score: 640

      await mine(2);
      blockNumber = await ethers.provider.getBlockNumber();
      await fogMaze.connect(player1).submitRun(2, 150, 90, blockNumber - 1, 1); // Score: 640

      await mine(2);
      blockNumber = await ethers.provider.getBlockNumber();
      await fogMaze.connect(player1).submitRun(3, 200, 100, blockNumber - 1, 2); // Score: 1300
    });

    it("Should return correct run count", async function () {
      expect(await fogMaze.getRunCount(player1.address)).to.equal(3);
    });

    it("Should return correct best score", async function () {
      const bestScore = await fogMaze.getBestScore(player1.address);
      // Level 3 run: 3000 - (200*2 + 100*3) = 3000 - 700 = 2300
      expect(bestScore).to.equal(2300);
    });

    it("Should return all runs", async function () {
      const runs = await fogMaze.getRuns(player1.address);
      expect(runs.length).to.equal(3);
      expect(runs[0].level).to.equal(1);
      expect(runs[1].level).to.equal(2);
      expect(runs[2].level).to.equal(3);
    });

    it("Should track different players independently", async function () {
      await mine(5);
      const blockNumber = await ethers.provider.getBlockNumber();
      await fogMaze.connect(player2).submitRun(1, 50, 30, blockNumber - 1, 0);

      expect(await fogMaze.getRunCount(player1.address)).to.equal(3);
      expect(await fogMaze.getRunCount(player2.address)).to.equal(1);
    });
  });

  describe("Nonce Management", function () {
    it("Should return correct next nonce", async function () {
      expect(await fogMaze.connect(player1).getNextNonce()).to.equal(0);
    });

    it("Should increment nonce", async function () {
      await fogMaze.connect(player1).incrementNonce();
      expect(await fogMaze.connect(player1).getNextNonce()).to.equal(1);

      await fogMaze.connect(player1).incrementNonce();
      expect(await fogMaze.connect(player1).getNextNonce()).to.equal(2);
    });

    it("Should track nonces per player independently", async function () {
      await fogMaze.connect(player1).incrementNonce();
      await fogMaze.connect(player1).incrementNonce();

      expect(await fogMaze.connect(player1).getNextNonce()).to.equal(2);
      expect(await fogMaze.connect(player2).getNextNonce()).to.equal(0);
    });
  });
});
