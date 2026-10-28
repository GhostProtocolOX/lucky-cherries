
(() => {
  "use strict";

  const SIZE = 10;
  const MIN_CLUSTER = 5;
  const START_BALANCE = 1000;
  const MAX_CASCADES = 12;

  const SYMBOLS = [
    { emoji: "🍒", name: "Cherries", weight: 25, multiplier: 2 },
    { emoji: "🍋", name: "Lemon", weight: 24, multiplier: 1.5 },
    { emoji: "🍇", name: "Grapes", weight: 22, multiplier: 1.2 },
    { emoji: "🍀", name: "Clover", weight: 18, multiplier: 1 },
    { emoji: "⭐", name: "Star", weight: 11, multiplier: 3 }
  ];

  const $ = id => document.getElementById(id);

  const reel = $("reel");
  const balanceEl = $("balance");
  const lastWinEl = $("lastWin");
  const betLabel = $("betLabel");
  const spinBtn = $("spinBtn");
  const resetBtn = $("resetBtn");
  const message = $("message");
  const overlay = $("overlay");
  const soundBtn = $("soundBtn");
  const betButtons = [...document.querySelectorAll(".bet-btn")];

  let balance = START_BALANCE;
  let bet = 10;
  let grid = [];
  let busy = false;
  let soundOn = true;
  let audioContext = null;

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const format = n => Math.floor(n).toLocaleString("en-US");

  function randomSymbol() {
    let roll = Math.random() *
      SYMBOLS.reduce((sum, symbol) => sum + symbol.weight, 0);

    for (let i = 0; i < SYMBOLS.length; i++) {
      roll -= SYMBOLS[i].weight;
      if (roll < 0) return i;
    }

    return 0;
  }

  function newGrid() {
    return Array.from({ length: SIZE }, () =>
      Array.from({ length: SIZE }, randomSymbol)
    );
  }

  function updateStats(lastWin) {
    balanceEl.textContent = format(balance);
    lastWinEl.textContent = format(lastWin);
    betLabel.textContent = format(bet);
  }

  function render(winners = new Set(), falling = false) {
    const fragment = document.createDocumentFragment();

    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const id = r * SIZE + c;
        const cell = document.createElement("div");

        cell.className = "symbol";
        if (winners.has(id)) cell.classList.add("winner");
        if (falling) cell.classList.add("falling");

        cell.textContent = SYMBOLS[grid[r][c]].emoji;
        cell.setAttribute("role", "gridcell");
        cell.setAttribute("aria-label", SYMBOLS[grid[r][c]].name);

        fragment.appendChild(cell);
      }
    }

    reel.replaceChildren(fragment);
  }

  // Find matching groups connected in four directions.
  function findClusters() {
    const visited = new Set();
    const clusters = [];

    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const startId = r * SIZE + c;
        if (visited.has(startId)) continue;

        const symbol = grid[r][c];
        const stack = [[r, c]];
        const cells = [];
        visited.add(startId);

        while (stack.length) {
          const [row, col] = stack.pop();
          cells.push([row, col]);

          const neighbors = [
            [row - 1, col],
            [row + 1, col],
            [row, col - 1],
            [row, col + 1]
          ];

          for (const [nr, nc] of neighbors) {
            if (nr < 0 || nr >= SIZE ||
                nc < 0 || nc >= SIZE) continue;

            const id = nr * SIZE + nc;

            if (!visited.has(id) && grid[nr][nc] === symbol) {
              visited.add(id);
              stack.push([nr, nc]);
            }
          }
        }

        if (cells.length >= MIN_CLUSTER) {
          clusters.push({ symbol, cells });
        }
      }
    }

    return clusters;
  }

  // Drop symbols down each column and fill empty spaces.
  function collapse(removed) {
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

  function playTone(frequency = 600, duration = 0.1) {
    if (!soundOn) return;

    try {
      const AudioCtx = window.AudioContext ||
        window.webkitAudioContext;

      if (!AudioCtx) return;

      audioContext = audioContext || new AudioCtx();

      if (audioContext.state === "suspended") {
        audioContext.resume();
      }

      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();

      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.08, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        audioContext.currentTime + duration
      );

      oscillator.connect(gain);
      gain.connect(audioContext.destination);

      oscillator.start();
      oscillator.stop(audioContext.currentTime + duration);
    } catch (error) {
      console.warn("Audio unavailable:", error);
    }
  }

  function setBusy(value) {
    busy = value;
    spinBtn.disabled = value;
    resetBtn.disabled = value;

    betButtons.forEach(button => {
      button.disabled = value;
    });
  }

  async function spin() {
    if (busy) return;

    if (balance < bet) {
      message.textContent =
        "Not enough credits. Press Reset to start again.";
      return;
    }

    setBusy(true);
    overlay.classList.add("hidden");

    balance -= bet;
    updateStats(0);

    message.textContent = "🍒 Spinning the lucky reels...";
    playTone(350, 0.15);

    grid = newGrid();
    render();
    await sleep(350);

    let totalWin = 0;
    let cascades = 0;

    while (cascades < MAX_CASCADES) {
      const clusters = findClusters();

      if (clusters.length === 0) break;

      cascades++;

      const removed = new Set();
      let cascadeWin = 0;

      for (const cluster of clusters) {
        const symbol = SYMBOLS[cluster.symbol];

        // Demo payout: cluster size × bet × symbol multiplier / 5.
        cascadeWin +=
          cluster.cells.length * bet * symbol.multiplier / 5;

        for (const [r, c] of cluster.cells) {
          removed.add(r * SIZE + c);
        }
      }

      totalWin += Math.round(cascadeWin);

      render(removed);
      message.textContent =
        `✨ Cascade ${cascades}! ${removed.size} symbols matched!`;

      playTone(550 + cascades * 90, 0.2);
      await sleep(500);

      collapse(removed);
      render(new Set(), true);
      await sleep(250);
    }

    totalWin = Math.round(totalWin);
    balance += totalWin;
    updateStats(totalWin);

    if (totalWin > 0) {
      overlay.textContent = `+${format(totalWin)} 🍒`;
      overlay.classList.remove("hidden");

      message.textContent =
        `🎉 You won ${format(totalWin)} credits in ${cascades} cascade(s)!`;

      playTone(880, 0.3);
      await sleep(1400);
      overlay.classList.add("hidden");
    } else {
      message.textContent =
        "No winning clusters. Try your luck again!";
    }

    if (balance < bet) {
      message.textContent += " Press Reset to restart your demo balance.";
    }

    setBusy(false);
  }

  betButtons.forEach(button => {
    button.addEventListener("click", () => {
      if (busy) return;

      bet = Number(button.dataset.bet);

      betButtons.forEach(item => {
        item.classList.toggle("selected", item === button);
      });

      updateStats(Number(lastWinEl.textContent.replace(/,/g, "")));
      message.textContent = `Bet set to ${bet} credits. Good luck!`;
    });
  });

  spinBtn.addEventListener("click", spin);

  resetBtn.addEventListener("click", () => {
    if (busy) return;

    balance = START_BALANCE;
    grid = newGrid();
    render();
    updateStats(0);

    overlay.classList.add("hidden");
    message.textContent = "Balance reset! Ready for a lucky spin.";
  });

  soundBtn.addEventListener("click", () => {
    soundOn = !soundOn;
    soundBtn.textContent = soundOn ? "🔊 Sound: On" : "🔇 Sound: Off";

    if (soundOn) playTone(600, 0.12);
  });

  // Start the game.
  grid = newGrid();
  render();
  updateStats(0);
})();
