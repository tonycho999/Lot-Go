import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, onValue, set, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { firebaseConfig } from "../firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

const GAME_MODES = {
    1: { name: 'EASY', total: 5, pick: 2, cost: 100, max: 500, rows: 1, cols: 5, bonusLimit: 9, bonus: 50 },
    2: { name: 'NORMAL', total: 10, pick: 4, cost: 200, max: 30000, rows: 2, cols: 5, bonusLimit: 9, bonus: 100 },
    3: { name: 'HARD', total: 20, pick: 6, cost: 500, max: 12000000, rows: 4, cols: 5, bonusLimit: 19, bonus: 200 }
};

let gameState = {
    selectedNumbers: [],
    foundNumbers: [],
    openCount: 0,
    shuffledCards: [],
    mode: null
};

/**
 * Tab Navigation
 */
window.switchTab = (tabId) => {
    const tabs = ['single-tab', 'multi-tab', 'profile-tab'];
    tabs.forEach(id => {
        document.getElementById(id).style.display = (id === tabId) ? 'block' : 'none';
    });
};

/**
 * Start Selection Phase
 */
window.startSingleGame = async (modeLevel) => {
    const mode = GAME_MODES[modeLevel];
    const user = auth.currentUser;
    const userRef = ref(db, `users/${user.uid}/coins`);
    const snap = await get(userRef);
    if ((snap.val() || 0) < mode.cost) return alert("Not enough coins!");

    await set(userRef, snap.val() - mode.cost);
    gameState.mode = mode;
    gameState.selectedNumbers = [];
    gameState.foundNumbers = [];
    gameState.openCount = 0;

    window.switchView('game-view');
    renderSelectionBoard();
};

function renderSelectionBoard() {
    const board = document.getElementById('game-board');
    board.innerHTML = `<h4>Select ${gameState.mode.pick} Numbers</h4>`;
    const grid = document.createElement('div');
    grid.className = 'card-grid';
    grid.style.gridTemplateColumns = `repeat(5, 1fr)`;

    for (let i = 1; i <= gameState.mode.total; i++) {
        const btn = document.createElement('div');
        btn.className = 'card selection';
        btn.innerText = i;
        btn.onclick = () => {
            if (gameState.selectedNumbers.includes(i)) return;
            if (gameState.selectedNumbers.length < gameState.mode.pick) {
                gameState.selectedNumbers.push(i);
                btn.style.background = "#6366f1";
                btn.style.color = "white";
                if (gameState.selectedNumbers.length === gameState.mode.pick) {
                    setTimeout(startMainGame, 500);
                }
            }
        };
        grid.appendChild(btn);
    }
    board.appendChild(grid);
}

function startMainGame() {
    const board = document.getElementById('game-board');
    board.innerHTML = `
        <div id="target-cards" style="display:flex; gap:10px; margin-bottom:20px; justify-content:center;"></div>
        <div id="play-grid" class="card-grid"></div>
    `;

    // Display Selected Targets
    const targetArea = document.getElementById('target-cards');
    gameState.selectedNumbers.forEach(num => {
        const target = document.createElement('div');
        target.id = `target-${num}`;
        target.className = 'card target';
        target.innerText = num;
        targetArea.appendChild(target);
    });

    // Shuffle and Render
    gameState.shuffledCards = Array.from({length: gameState.mode.total}, (_, i) => i + 1).sort(() => Math.random() - 0.5);
    const playGrid = document.getElementById('play-grid');
    playGrid.style.gridTemplateColumns = `repeat(${gameState.mode.cols}, 1fr)`;

    gameState.shuffledCards.forEach((num, index) => {
        const card = document.createElement('div');
        card.className = 'card hidden';
        card.innerText = '?';
        card.onclick = () => handleFlip(card, num);
        playGrid.appendChild(card);
    });
}

async function handleFlip(cardEl, num) {
    if (cardEl.classList.contains('flipped')) return;

    gameState.openCount++;
    cardEl.classList.remove('hidden');
    cardEl.classList.add('flipped');
    cardEl.innerText = num;

    if (gameState.selectedNumbers.includes(num)) {
        gameState.foundNumbers.push(num);
        document.getElementById(`target-${num}`).style.background = "#10b981"; // Success Color
    }

    // Check Win Condition
    if (gameState.foundNumbers.length === gameState.mode.pick) {
        let prize = Math.floor(gameState.mode.max / gameState.openCount);
        if (gameState.openCount === gameState.mode.total) prize = 0;

        alert(`Match Complete! Flips: ${gameState.openCount}. Prize: ${prize}`);
        if (prize > 0) await updateCoins(prize);
        window.switchView('lobby-view');
    }
}
