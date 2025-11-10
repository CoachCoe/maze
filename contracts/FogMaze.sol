// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

/**
 * @title FogMaze
 * @notice Fully on-chain deterministic maze game
 * @dev All game state is derived from blockchain data - no servers, no IPFS
 */
contract FogMaze {
    /// @notice Maximum runs stored per player to prevent storage DOS
    uint256 public constant MAX_RUNS_PER_PLAYER = 100;

    /// @notice Blockhash availability window on Ethereum-compatible chains
    uint256 public constant BLOCK_WINDOW = 256;

    struct Run {
        uint256 level;
        uint256 steps;
        uint256 timeTaken;
        bytes32 seed;
        uint256 timestamp;
        uint256 nonce;
    }

    /// @notice All runs for each player
    mapping(address => Run[]) public playerRuns;

    /// @notice Track nonce per player for multiple attempts per block
    mapping(address => uint256) public playerNonces;

    event RunSubmitted(
        address indexed player,
        uint256 level,
        uint256 steps,
        uint256 timeTaken,
        bytes32 seed,
        uint256 score,
        uint256 nonce
    );

    event SeedGenerated(
        address indexed player,
        bytes32 seed,
        uint256 blockNumber,
        uint256 nonce
    );

    /**
     * @notice Generate deterministic seed from blockhash, player address, and nonce
     * @param blockNumber Block number to use for seed (must be recent)
     * @param player Player address
     * @param nonce Nonce for generating multiple seeds per block
     * @return Deterministic seed that can regenerate the same maze
     */
    function generateSeed(
        uint256 blockNumber,
        address player,
        uint256 nonce
    ) public view returns (bytes32) {
        require(blockNumber < block.number, "Block not yet mined");
        require(
            block.number - blockNumber <= BLOCK_WINDOW,
            "Block too old (>256 blocks)"
        );

        return keccak256(
            abi.encodePacked(blockhash(blockNumber), player, nonce)
        );
    }

    /**
     * @notice Calculate score with protection against negative values
     * @param level Maze level completed
     * @param steps Number of steps taken
     * @param timeTaken Time taken in seconds
     * @return Final score (higher is better)
     */
    function calculateScore(
        uint256 level,
        uint256 steps,
        uint256 timeTaken
    ) public pure returns (uint256) {
        uint256 baseScore = level * 1000;
        uint256 penalty = (steps * 2) + (timeTaken * 3);

        // Prevent negative scores
        return penalty >= baseScore ? 0 : baseScore - penalty;
    }

    /**
     * @notice Submit a completed maze run
     * @param level Level completed
     * @param steps Number of steps taken
     * @param timeTaken Time in seconds
     * @param blockNumber Block number used for seed generation
     * @param nonce Nonce used for seed generation
     */
    function submitRun(
        uint256 level,
        uint256 steps,
        uint256 timeTaken,
        uint256 blockNumber,
        uint256 nonce
    ) external {
        require(level > 0, "Invalid level");
        require(
            playerRuns[msg.sender].length < MAX_RUNS_PER_PLAYER,
            "Max runs reached"
        );

        bytes32 seed = generateSeed(blockNumber, msg.sender, nonce);
        uint256 score = calculateScore(level, steps, timeTaken);

        playerRuns[msg.sender].push(Run({
            level: level,
            steps: steps,
            timeTaken: timeTaken,
            seed: seed,
            timestamp: block.timestamp,
            nonce: nonce
        }));

        emit RunSubmitted(
            msg.sender,
            level,
            steps,
            timeTaken,
            seed,
            score,
            nonce
        );
    }

    /**
     * @notice Get all runs for a player
     * @param player Player address
     * @return Array of all runs
     */
    function getRuns(address player) external view returns (Run[] memory) {
        return playerRuns[player];
    }

    /**
     * @notice Get player's best score across all runs
     * @param player Player address
     * @return Best score achieved
     */
    function getBestScore(address player) external view returns (uint256) {
        Run[] memory runs = playerRuns[player];
        uint256 bestScore = 0;

        for (uint256 i = 0; i < runs.length; i++) {
            uint256 score = calculateScore(
                runs[i].level,
                runs[i].steps,
                runs[i].timeTaken
            );
            if (score > bestScore) {
                bestScore = score;
            }
        }

        return bestScore;
    }

    /**
     * @notice Get total number of runs for a player
     * @param player Player address
     * @return Number of runs
     */
    function getRunCount(address player) external view returns (uint256) {
        return playerRuns[player].length;
    }

    /**
     * @notice Get next available nonce for player
     * @return Next nonce value
     */
    function getNextNonce() external view returns (uint256) {
        return playerNonces[msg.sender];
    }

    /**
     * @notice Increment player's nonce (called after generating seed)
     */
    function incrementNonce() external {
        playerNonces[msg.sender]++;
    }
}
