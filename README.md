// -------------------------
// Lucky Cherries game logic
// -------------------------

const ROWS = 10;
const COLS = 10;
const MAX_CASCADES = 8;
const DEMO_BALANCE = 1000;
const SYMBOLS = ["cherry", "lemon", "grape", "clover", "star"];

const SYMBOL_ICONS = {
  cherry: "🍒",
  lemon: "🍋",
  grape: "🍇",
  clover: "☘️",
  star: "⭐",
};

const boardElement = document.getElementById("board");
const balanceElement = document.getElementById("balance");
const lastWinElement = document.getElementById("lastWin");
const betElement = document.getElementById("currentBet");
const messageElement = document.getElementById("message");
const spinButton = document.getElementById("spinButton");
const resetButton = document.getElementById("resetButton");
const betButtons = [...document.querySelectorAll(".bet-button")];

let balance = DEMO_BALANCE;
let currentBet = 10;
let lastWin = 0;
let board = [];
let isSpinning = false;

// ------------------------------------------
// Board generation and display helpers
// ------------------------------------------
function randomSymbol() {
  return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
}

function createBoard() {
  return Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => randomSymbol())
  );
}

function renderBoard() {
  boardElement.innerHTML = "";

  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const cell = document.createElement("div");
      const symbol = board[row][col];
      cell.className = "cell";
      cell.setAttribute("role", "gridcell");
      cell.setAttribute("aria-label", `${SYMBOL_ICONS[symbol]} at row ${row + 1}, column ${col + 1}`);
      cell.dataset.symbol = symbol;
      cell.textContent = SYMBOL_ICONS[symbol];
      boardElement.appendChild(cell);
    }
  }
}

function updateStats() {
  balanceElement.textContent = balance;
  lastWinElement.textContent = lastWin;
  betElement.textContent = currentBet;

  const canSpin = !isSpinning && balance >= currentBet;
  spinButton.disabled = !canSpin;
  spinButton.textContent = canSpin ? "Spin" : balance < currentBet ? "Need More Credits" : "Spinning...";
}

function setMessage(text) {
  messageElement.textContent = text;
}

// ------------------------------------------
// Cluster detection and resolution logic
// ------------------------------------------
function findWinningClusters(currentBoard) {
  const visited = new Set();
  const clusters = [];

  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const key = `${row},${col}`;
      if (visited.has(key)) {
        continue;
      }

      const symbol = currentBoard[row][col];
      const queue = [[row, col]];
      const cells = [];
      visited.add(key);

      while (queue.length > 0) {
        const [r, c] = queue.shift();
        cells.push([r, c]);

        const directions = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ];

        for (const [dr, dc] of directions) {
          const nextRow = r + dr;
          const nextCol = c + dc;

          if (
            nextRow < 0 ||
            nextRow >= ROWS ||
            nextCol < 0 ||
            nextCol >= COLS
          ) {
            continue;
          }

          const nextKey = `${nextRow},${nextCol}`;
          if (visited.has(nextKey)) {
            continue;
          }

          if (currentBoard[nextRow][nextCol] === symbol) {
            visited.add(nextKey);
            queue.push([nextRow, nextCol]);
          }
        }
      }

      if (cells.length >= 5) {
        clusters.push(cells);
      }
    }
  }

  return clusters;
}

function scoreCluster(cluster, bet) {
  return cluster.length * bet * 2;
}

function removeCells(clusters) {
  const cellsToRemove = new Set();

  clusters.forEach((cluster) => {
    cluster.forEach(([row, col]) => {
      cellsToRemove.add(`${row},${col}`);
    });
  });

  cellsToRemove.forEach((cellKey) => {
    const [row, col] = cellKey.split(",").map(Number);
    board[row][col] = null;
  });
}

function collapseBoard() {
  const nextBoard = Array.from({ length: ROWS }, () => Array(COLS).fill(null));

  for (let col = 0; col < COLS; col += 1) {
    const columnValues = [];

    for (let row = ROWS - 1; row >= 0; row -= 1) {
      const value = board[row][col];
      if (value !== null) {
        columnValues.push(value);
      }
    }

    for (let row = ROWS - 1; row >= 0; row -= 1) {
      if (columnValues.length > 0) {
        nextBoard[row][col] = columnValues.shift();
      } else {
        nextBoard[row][col] = randomSymbol();
      }
    }
  }

  board = nextBoard;
}

// ------------------------------------------
// Spin flow and bet controls
// ------------------------------------------
async function spin() {
  if (isSpinning) {
    return;
  }

  if (balance < currentBet) {
    setMessage("Not enough credits to place that bet. Lower the bet or reset the game.");
    updateStats();
    return;
  }

  isSpinning = true;
  balance -= currentBet;
  lastWin = 0;
  updateStats();
  setMessage("The reels are spinning...");

  board = createBoard();
  renderBoard();
  await new Promise((resolve) => setTimeout(resolve, 180));

  let totalWin = 0;
  let cascadeCount = 0;

  while (cascadeCount < MAX_CASCADES) {
    const clusters = findWinningClusters(board);

    if (clusters.length === 0) {
      break;
    }

    cascadeCount += 1;
    const cascadeWin = clusters.reduce((sum, cluster) => sum + scoreCluster(cluster, currentBet), 0);
    totalWin += cascadeWin;
    removeCells(clusters);
    collapseBoard();
    renderBoard();
    setMessage(`Cascade ${cascadeCount}: +${cascadeWin} credits!`);
    await new Promise((resolve) => setTimeout(resolve, 220));
  }

  if (totalWin > 0) {
    balance += totalWin;
    lastWin = totalWin;
    setMessage(`Lucky! You won ${totalWin} credits across ${cascadeCount} cascade${cascadeCount === 1 ? "" : "s"}.`);
  } else {
    setMessage("No winning cluster this spin. Try another drop!");
  }

  isSpinning = false;
  updateStats();
}

function selectBet(newBet) {
  if (isSpinning) {
    return;
  }

  currentBet = newBet;
  betButtons.forEach((button) => {
    const isSelected = Number(button.dataset.bet) === currentBet;
    button.classList.toggle("active", isSelected);
  });

  updateStats();
  setMessage(`Bet set to ${currentBet} credits.`);
}

function resetGame() {
  balance = DEMO_BALANCE;
  currentBet = 10;
  lastWin = 0;
  board = createBoard();
  isSpinning = false;

  betButtons.forEach((button) => {
    const isSelected = Number(button.dataset.bet) === currentBet;
    button.classList.toggle("active", isSelected);
  });

  renderBoard();
  setMessage("Balance reset. The house is ready for a fresh win streak!");
  updateStats();
}

// ------------------------------------------
// Event listeners and initial load
// ------------------------------------------
spinButton.addEventListener("click", spin);
resetButton.addEventListener("click", resetGame);

betButtons.forEach((button) => {
  button.addEventListener("click", () => {
    selectBet(Number(button.dataset.bet));
  });
});

board = createBoard();
renderBoard();
updateStats();
setMessage("Ready to spin for a lucky cluster!");
