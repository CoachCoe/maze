/**
 * Deterministic Maze Generator
 * Uses recursive backtracking with optional braiding for AI resistance
 * Same seed always generates the same maze
 */

class SeededRandom {
  /**
   * Linear Congruential Generator for deterministic pseudo-random numbers
   * @param {string} seed - Hex seed from blockchain
   */
  constructor(seed) {
    // Convert hex seed to number (use first 8 bytes for 32-bit seed)
    const seedStr = seed.startsWith('0x') ? seed.slice(2) : seed;
    this.state = parseInt(seedStr.slice(0, 8), 16) || 1;
  }

  /**
   * Generate next random number (0 to 1)
   */
  next() {
    // LCG parameters (Numerical Recipes)
    const a = 1664525;
    const c = 1013904223;
    const m = Math.pow(2, 32);

    this.state = (a * this.state + c) % m;
    return this.state / m;
  }

  /**
   * Generate random integer between min (inclusive) and max (exclusive)
   */
  nextInt(min, max) {
    return Math.floor(this.next() * (max - min)) + min;
  }

  /**
   * Shuffle array in place (Fisher-Yates)
   */
  shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}

class MazeGenerator {
  /**
   * @param {string} seed - Blockchain seed (hex)
   * @param {number} size - Maze dimension (NxN)
   * @param {number} level - Game level (affects difficulty)
   */
  constructor(seed, size, level = 1) {
    this.seed = seed;
    this.size = size;
    this.level = level;
    this.prng = new SeededRandom(seed);

    // Use odd size for proper maze (cells + walls)
    // Convert user size to actual grid size (size*2+1)
    this.gridSize = size * 2 + 1;

    // Maze grid: 0 = wall, 1 = path, 2 = start, 3 = exit
    this.grid = Array(this.gridSize).fill(null).map(() => Array(this.gridSize).fill(0));

    // Track visited cells during generation
    this.visited = Array(size).fill(null).map(() => Array(size).fill(false));

    this.generate();
  }

  /**
   * Generate maze using recursive backtracking with braiding
   */
  generate() {
    // Start from center cell
    const startCellX = Math.floor(this.size / 2);
    const startCellY = Math.floor(this.size / 2);

    // Generate maze from center
    this.recursiveBacktrack(startCellX, startCellY);

    // Add braiding (loops) for higher levels to confuse AI
    const braidFactor = Math.min(this.level * 0.05, 0.3); // Up to 30% braiding
    this.addBraiding(braidFactor);

    // Pick start and exit on opposite edges
    this.pickStartAndExit();

    // Mark start and exit on grid
    this.grid[this.startY][this.startX] = 2; // Start
    this.grid[this.exitY][this.exitX] = 3; // Exit
  }

  /**
   * Pick start and exit positions on opposite edges
   */
  pickStartAndExit() {
    const side = this.prng.nextInt(0, 4);

    // Find path cells on one side for start
    const startCells = this.getEdgePathCells(side);
    if (startCells.length === 0) {
      // Fallback to any edge
      this.startX = 1;
      this.startY = 1;
    } else {
      const start = startCells[this.prng.nextInt(0, startCells.length)];
      this.startX = start.x;
      this.startY = start.y;
    }

    // Find path cells on opposite side for exit
    const oppositeSide = (side + 2) % 4;
    const exitCells = this.getEdgePathCells(oppositeSide);
    if (exitCells.length === 0) {
      // Fallback to far corner
      this.exitX = this.gridSize - 2;
      this.exitY = this.gridSize - 2;
    } else {
      const exit = exitCells[this.prng.nextInt(0, exitCells.length)];
      this.exitX = exit.x;
      this.exitY = exit.y;
    }
  }

  /**
   * Get all path cells on a given edge
   */
  getEdgePathCells(side) {
    const cells = [];

    switch (side) {
      case 0: // Top
        for (let x = 1; x < this.gridSize - 1; x += 2) {
          if (this.grid[1][x] === 1) cells.push({ x, y: 1 });
        }
        break;
      case 1: // Right
        for (let y = 1; y < this.gridSize - 1; y += 2) {
          if (this.grid[y][this.gridSize - 2] === 1) cells.push({ x: this.gridSize - 2, y });
        }
        break;
      case 2: // Bottom
        for (let x = 1; x < this.gridSize - 1; x += 2) {
          if (this.grid[this.gridSize - 2][x] === 1) cells.push({ x, y: this.gridSize - 2 });
        }
        break;
      case 3: // Left
        for (let y = 1; y < this.gridSize - 1; y += 2) {
          if (this.grid[y][1] === 1) cells.push({ x: 1, y });
        }
        break;
    }

    return cells;
  }

  /**
   * Recursive backtracking maze generation
   * Works on cell coordinates, carves walls between cells
   */
  recursiveBacktrack(cellX, cellY) {
    this.visited[cellY][cellX] = true;

    // Convert cell coordinates to grid coordinates
    const gx = cellX * 2 + 1;
    const gy = cellY * 2 + 1;
    this.grid[gy][gx] = 1; // Mark cell as path

    // Directions: N, E, S, W (moving 1 cell at a time)
    const directions = [
      { dx: 0, dy: -1 },
      { dx: 1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 }
    ];

    // Shuffle directions for randomness
    const shuffled = this.prng.shuffle(directions);

    for (const dir of shuffled) {
      const nx = cellX + dir.dx;
      const ny = cellY + dir.dy;

      if (this.isValidCell(nx, ny) && !this.visited[ny][nx]) {
        // Carve through the wall between current cell and next cell
        const wallX = gx + dir.dx;
        const wallY = gy + dir.dy;
        this.grid[wallY][wallX] = 1;

        this.recursiveBacktrack(nx, ny);
      }
    }
  }

  /**
   * Check if cell coordinates are valid
   */
  isValidCell(x, y) {
    return x >= 0 && x < this.size && y >= 0 && y < this.size;
  }

  /**
   * Add loops to maze (braiding) to create multiple paths
   * Makes it harder for AI to find "the" solution
   */
  addBraiding(factor) {
    const deadEnds = this.findDeadEnds();
    const numToRemove = Math.floor(deadEnds.length * factor);

    for (let i = 0; i < numToRemove; i++) {
      const cell = deadEnds[i];
      const walls = this.getWalls(cell.x, cell.y);

      if (walls.length > 0) {
        // Remove a random wall to create loop
        const wall = walls[this.prng.nextInt(0, walls.length)];
        this.grid[wall.y][wall.x] = 1;
      }
    }
  }

  /**
   * Find all dead ends (cells with only one exit)
   */
  findDeadEnds() {
    const deadEnds = [];

    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        if (this.grid[y][x] === 1 && this.countNeighborPaths(x, y) === 1) {
          deadEnds.push({ x, y });
        }
      }
    }

    return this.prng.shuffle(deadEnds);
  }

  /**
   * Get adjacent walls that could be removed
   */
  getWalls(x, y) {
    const walls = [];
    const directions = [
      { dx: 0, dy: -1 },
      { dx: 1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 }
    ];

    for (const dir of directions) {
      const nx = x + dir.dx;
      const ny = y + dir.dy;

      if (this.isValid(nx, ny) && this.grid[ny][nx] === 0) {
        walls.push({ x: nx, y: ny });
      }
    }

    return walls;
  }

  /**
   * Count how many path neighbors a cell has
   */
  countNeighborPaths(x, y) {
    const directions = [
      { dx: 0, dy: -1 },
      { dx: 1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 }
    ];

    let count = 0;
    for (const dir of directions) {
      const nx = x + dir.dx;
      const ny = y + dir.dy;

      if (this.isValid(nx, ny) && this.grid[ny][nx] >= 1) {
        count++;
      }
    }

    return count;
  }

  /**
   * Place exit on opposite side from start
   */
  placeExit(startSide) {
    const exitSide = (startSide + 2) % 4; // Opposite side
    let exitX, exitY;

    // Find valid exit position (must be on a path)
    let attempts = 0;
    const maxAttempts = 100;

    do {
      switch (exitSide) {
        case 0: // Top
          exitX = this.prng.nextInt(1, this.size - 1);
          exitY = 0;
          break;
        case 1: // Right
          exitX = this.size - 1;
          exitY = this.prng.nextInt(1, this.size - 1);
          break;
        case 2: // Bottom
          exitX = this.prng.nextInt(1, this.size - 1);
          exitY = this.size - 1;
          break;
        case 3: // Left
          exitX = 0;
          exitY = this.prng.nextInt(1, this.size - 1);
          break;
      }

      attempts++;
      if (attempts > maxAttempts) {
        // Fallback: find any edge path
        const edgePaths = this.findEdgePaths();
        if (edgePaths.length > 0) {
          const exit = edgePaths[this.prng.nextInt(0, edgePaths.length)];
          exitX = exit.x;
          exitY = exit.y;
          break;
        }
      }
    } while (this.grid[exitY][exitX] !== 1 && attempts < maxAttempts);

    this.exitX = exitX;
    this.exitY = exitY;
  }

  /**
   * Find all path cells on edges
   */
  findEdgePaths() {
    const paths = [];

    for (let i = 0; i < this.size; i++) {
      if (this.grid[0][i] === 1) paths.push({ x: i, y: 0 });
      if (this.grid[this.size - 1][i] === 1) paths.push({ x: i, y: this.size - 1 });
      if (this.grid[i][0] === 1) paths.push({ x: 0, y: i });
      if (this.grid[i][this.size - 1] === 1) paths.push({ x: this.size - 1, y: i });
    }

    return paths;
  }

  /**
   * Check if grid coordinates are valid
   */
  isValid(x, y) {
    return x >= 0 && x < this.gridSize && y >= 0 && y < this.gridSize;
  }

  /**
   * Get maze grid
   */
  getMaze() {
    return this.grid;
  }

  /**
   * Get start position
   */
  getStart() {
    return { x: this.startX, y: this.startY };
  }

  /**
   * Get exit position
   */
  getExit() {
    return { x: this.exitX, y: this.exitY };
  }
}

// Export for use in browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MazeGenerator, SeededRandom };
}
