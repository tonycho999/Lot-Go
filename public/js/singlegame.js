import { ref, get, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

export const SINGLE_MODES = {
    1: { name: 'EASY', pick: 2, total: 5, cost: 100, max: 500, grid: 'grid-easy' },
    2: { name: 'NORMAL', pick: 4, total: 10, cost: 200, max: 30000, grid: 'grid-normal' },
    3: { name: 'HARD', pick: 6, total: 20, cost: 500, max: 12000000, grid: 'grid-hard' }
};

let gameState = { selected: [], found: [], flips: 0, mode: null };

export function renderSingleMenu() {
    const container = document.getElementById('single-tab');
    container.innerHTML = `
        <div class="menu-list">
            <button class="mode-btn easy" onclick="initSingleGame(1)">EASY (2/5)</button>
            <button class="mode-btn normal" onclick="initSingleGame(2)">NORMAL (4/10)</button>
            <button class="mode-btn hard" onclick="initSingleGame(3)">HARD (6/20)</button>
        </div>
    `;
}

export async function initSingleGame(level, auth, db) {
    const mode = SINGLE_MODES[level];
    const userRef = ref(db, `users/${auth.currentUser.uid}/coins`);
    const snap = await get(userRef);
    if ((snap.val() || 0) < mode.cost) return alert("Insufficient coins!");

    await set(userRef, snap.val() - mode.cost);
    gameState = { selected: [], found: [], flips: 0, mode };
    
    document.getElementById('lobby-view').style.display = 'none';
    document.getElementById('game-view').style.display = 'flex';
    renderSelection();
}

function renderSelection() {
    const board = document.getElementById('game-board');
    document.getElementById('game-header').innerHTML = `<h3>PICK ${gameState.mode.pick} NUMBERS</h3>`;
    board.className = "card-grid grid-easy";
    board.innerHTML = "";

    for (let i = 1; i <= gameState.mode.total; i++) {
        const card = document.createElement('div');
        card.className = "card selection";
        card.innerText = i;
        card.onclick = () => {
            if (gameState.selected.includes(i)) return;
            gameState.selected.push(i);
            card.style.background = "#6366f1";
            if (gameState.selected.length === gameState.mode.pick) setTimeout(startShufflePhase, 500);
        };
        board.appendChild(card);
    }
}

function startShufflePhase() {
    const header = document.getElementById('game-header');
    header.innerHTML = `<div id="target-bar" class="target-row"></div>`;
    gameState.selected.forEach(num => {
        header.querySelector('#target-bar').innerHTML += `<div id="t-${num}" class="card target">${num}</div>`;
    });

    const board = document.getElementById('game-board');
    board.className = `card-grid ${gameState.mode.grid}`;
    board.innerHTML = "";

    const shuffled = Array.from({length: gameState.mode.total}, (_, i) => i + 1).sort(() => Math.random() - 0.5);
    shuffled.forEach(num => {
        const card = document.createElement('div');
        card.className = "card hidden";
        card.innerText = "?";
        card.onclick = () => {
            if (card.classList.contains('flipped')) return;
            gameState.flips++;
            card.className = "card flipped";
            card.innerText = num;
            if (gameState.selected.includes(num)) {
                gameState.found.push(num);
                document.getElementById(`t-${num}`).style.background = "#10b981";
                if (gameState.found.length === gameState.mode.pick) finishGame();
            }
        };
        board.appendChild(card);
    });
}

function finishGame() {
    let prize = (gameState.flips === gameState.mode.total) ? 0 : Math.floor(gameState.mode.max / gameState.flips);
    alert(`Match! Prize: ${prize} COINS`);
    location.reload(); // Simple reset for now
}
