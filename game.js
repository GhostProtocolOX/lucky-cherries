
(() => {
  "use strict";

  const SIZE = 10;
  const MIN_CLUSTER = 5;
  const START_BALANCE = 1000;

  const SYMBOLS = [
    { emoji: "🍒", name: "Cherry", weight: 25, multiplier: 2 },
    { emoji: "🍋", name: "Lemon", weight: 24, multiplier: 1.5 },
    { emoji: "🍇", name: "Grapes", weight: 22, multiplier: 1.2 },
    { emoji: "🍀", name: "Clover", weight: 18, multiplier: 1 },
    { emoji: "⭐", name: "Star", weight: 11, multiplier: 3 }
  ];

  const reel = document.querySelector("#reel");
  const balanceEl = document.querySelector("#balance");
  const lastWinEl = document.querySelector("#lastWin");
  const betSelect = document.querySelector("#bet");
  const betLabel = document.querySelector("#betLabel");
  const spinBtn = document.querySelector("#spinBtn");
  const resetBtn = document.querySelector("#resetBtn");
  const messageEl = document.querySelector("#message");
  const overlay = document.querySelector("#overlay");

  let balance = START_BALANCE;
  let grid = [];
  let busy = false;

  const fmt = n => Math.floor(n).toLocaleString("en-US");

  function randomSymbol() {
    const total = SYMBOLS.reduce((sum, s) => sum + s.weight, 0);
    let roll = Math.random() * total;

    for (let i = 0; i < SYMBOLS.length; i++) {
      roll -= SYMBOLS[i].weight;
      if (roll <= 0) return i;
    }
    return 0;
  }

  function makeGrid() {
    return Array.from({ length: SIZE }, () =>
      Array.from({ length: SIZE }, randomSymbol)
    );
  }

  function render(winners = new Set()) {
    reel.replaceChildren();
    const fragment = document.createDocumentFragment();

    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const cell = document.createElement("div");
        cell.className = "symbol" +
          (winners.has(r * SIZE + c) ? " winner" : "");
        cell.textContent = SYMBOLS[grid[r][c]].emoji;
        cell.setAttribute("role", "gridcell");
        cell.setAttribute("aria-label", SYMBOLS[grid[r][c]].name);
        fragment.appendChild(cell);
      }
    }

    reel.appendChild(fragment);
  }

  function updateStats(lastWin = null) {
    balanceEl.textContent = fmt(balance);
    betLabel.textContent = fmt(Number(betSelect.value));

    if (lastWin !== null) {
      lastWinEl.textContent = fmt(lastWin);
    }
  }

  function findClusters() {
    const seen = new Set();
    const clusters = [];

    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const start = r * SIZE + c;
        if (seen.has(start)) continue;

        const symbol = grid[r][c];
        const stack = [[r, c]];
        const cluster = [];
        seen.add(start);

        while (stack.length) {
          const [cr, cc] = stack.pop();
          cluster.push([cr, cc]);

          const neighbors = [
            [cr - 1, cc], [cr + 1, cc],
            [cr, cc - 1], [cr, cc + 1]
          ];

          for (const [nr, nc] of neighbors) {
            if (nr < 0 || nr >= SIZE ||
                nc < 0 || nc >= SIZE) continue;

            const id = nr * SIZE + nc;

            if (!seen.has(id) && grid[nr][nc] === symbol) {
              seen.add(id);
              stack.push([nr, nc]);
            }
          }
        }

        if (cluster.length >= MIN_CLUSTER) {
          clusters.push({ symbol, cells: cluster });
        }
      }
    }

    return clusters;
  }

  function collapseAndRefill(removed) {
    for (let c = 0; c < SIZE; c++) {
      const remaining = [];

      for (let r = SIZE - 1; r >= 0; r--) {
        if (!removed.has(r * SIZE + c)) {
          remaining.push(grid[r][c]);
        }
      }

      while (remaining.length < SIZE) {
        remaining.push(randomSymbol());
      }

      for (let r = SIZE - 1, i = 0; r >= 0; r--, i++) {
        grid[r][c] = remaining[i];
      }
    }
  }

  const sleep = ms =>
    new Promise(resolve => setTimeout(resolve, ms));

  async function spin() {
    if (busy) return;

    const bet = Number(betSelect.value);

    if (balance < bet) {
      messageEl.textContent =
        "Not enough credits. Press Reset to start over.";
      return;
    }

    busy = true;
    spinBtn.disabled = true;
    betSelect.disabled = true;
    balance -= bet;
    updateStats(0);

    messageEl.textContent = "Spinning... good luck!";
    overlay.classList.add("hidden");

    grid = makeGrid();
    render();
    await sleep(280);

    let totalWin = 0;
    let cascades = 0;

    while (cascades < 12) {
      const clusters = findClusters();
      if (clusters.length === 0) break;

      cascades++;
      const removed = new Set();
      let cascadeWin = 0;

      for (const cluster of clusters) {
        const symbol = SYMBOLS[cluster.symbol];

        cascadeWin +=
          cluster.cells.length * bet * symbol.multiplier / 5;

        for (const [r, c] of cluster.cells) {
          removed.add(r * SIZE + c);
        }
      }

      totalWin += Math.round(cascadeWin);
      render(removed);

      messageEl.textContent =
        `Cascade ${cascades}: ${removed.size} symbols matched!`;

      await sleep(450);
      collapseAndRefill(removed);
      render();
      await sleep(180);
    }

    balance += totalWin;
    updateStats(totalWin);

    if (totalWin > 0) {
      overlay.textContent = `+${fmt(totalWin)} CREDITS!`;
      overlay.classList.remove("hidden");

      messageEl.textContent =
        `You won ${fmt(totalWin)} credits across ${cascades} cascade(s)!`;

      await sleep(900);
      overlay.classList.add("hidden");
    } else {
      messageEl.textContent =
        "No clusters this time. Try another spin!";
    }

    if (balance < Number(betSelect.value)) {
      messageEl.textContent +=
        " Out of credits — press Reset to start over.";
    }

    busy = false;
    spinBtn.disabled = false;
    betSelect.disabled = false;
  }

  spinBtn.addEventListener("click", spin);
  betSelect.addEventListener("change", () => updateStats());

  resetBtn.addEventListener("click", () => {
    if (busy) return;

    balance = START_BALANCE;
    grid = makeGrid();
    render();
    updateStats(0);

    messageEl.textContent = "Balance reset. Ready to spin!";
    overlay.classList.add("hidden");
  });

  grid = makeGrid();
  render();
  updateStats(0);
})();
