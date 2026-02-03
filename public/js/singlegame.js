import { doc, getDoc, updateDoc, increment, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 1. 게임 모드 설정
export const SINGLE_MODES = {
    1: { name: 'EASY', pick: 2, total: 5, cost: 100, max: 500, grid: 'grid-easy' },
    2: { name: 'NORMAL', pick: 4, total: 10, cost: 200, max: 10000, grid: 'grid-normal', table: { 4: 10000, 5: 2000, 6: 666, 7: 285, 8: 142, 9: 79, 10: 0 } },
    3: { name: 'HARD', pick: 6, total: 20, cost: 500, max: 10000000, grid: 'grid-hard', table: { 6: 10000000, 7: 1428570, 8: 357140, 9: 119040, 10: 47610, 11: 21640, 12: 10820, 13: 5820, 14: 3330, 15: 1990, 16: 1249, 17: 808, 18: 539, 19: 369, 20: 0 } }
};

let gameState = { selected: [], found: [], flips: 0, mode: null, isGameOver: false, level: 1 };
let userCoins = 0; 
let coinUnsub = null;

// 메뉴 렌더링
export async function renderSingleMenu() {
    const container = document.getElementById('single-tab');
    if (!container) return;
    container.innerHTML = `
        <div class="menu-list" style="display: flex; flex-direction: column; gap: 15px; padding: 10px;">
            <button id="ad-btn" class="main-btn ad-btn-style" onclick="handleWatchAd()">📺 WATCH AD (+300 C)</button>
            <div class="divider"></div>
            <button class="main-btn easy-btn" onclick="initSingleGame(1)"><div class="btn-title">EASY</div><div class="btn-desc">2/5 Match • 100 C</div></button>
            <button class="main-btn normal-btn" onclick="initSingleGame(2)"><div class="btn-title">NORMAL</div><div class="btn-desc">4/10 Match • 200 C</div></button>
            <button class="main-btn hard-btn" onclick="initSingleGame(3)"><div class="btn-title">HARD</div><div class="btn-desc">6/20 Match • 500 C</div></button>
        </div>`;
}

export async function handleWatchAd() { alert("광고 기능 준비 중입니다."); }

// 게임 초기화
export async function initSingleGame(level) {
    const db = window.lotGoDb;
    const auth = window.lotGoAuth;
    const mode = SINGLE_MODES[level];
    const userDocRef = doc(db, "users", auth.currentUser.uid);
    
    const snap = await getDoc(userDocRef);
    if (!snap.exists()) return alert("User data not found.");
    
    const currentCoins = snap.data().coins || 0;
    userCoins = currentCoins; 

    if (currentCoins < mode.cost) return alert(`Not enough coins! Need ${mode.cost} C.`);

    await updateDoc(userDocRef, { coins: increment(-mode.cost) });

    if (coinUnsub) coinUnsub(); 
    coinUnsub = onSnapshot(userDocRef, (docSnapshot) => {
        userCoins = docSnapshot.data().coins || 0;
        updateTopBar(); 
    });

    gameState = { selected: [], found: [], flips: 0, mode, isGameOver: false, level };
    window.switchView('game-view');
    renderSelectionPhase();
}

// [수정] 상단바 업데이트 (Back Link 위치 조정)
function updateTopBar() {
    const topBar = document.getElementById('game-top-bar');
    if (!topBar) return;
    
    let prizeLabel = "MAX PRIZE";
    let prizeValue = gameState.mode.max.toLocaleString();

    if (gameState.isGameOver) {
        prizeLabel = "CURRENT PRIZE";
        prizeValue = "0"; 
    } else if (document.querySelector('.play-mode')) {
        prizeLabel = "CURRENT PRIZE";
        prizeValue = calculateCurrentPrize().toLocaleString();
    }
    
    topBar.innerHTML = `
        <div class="coin-info" style="display: flex; flex-direction: column; align-items: flex-start;">
            <div onclick="location.reload()" style="cursor:pointer; margin-bottom: 5px; color: #ffca28; font-size: 0.8rem; font-weight: bold;">
                ← BACK TO LOBBY
            </div>
            <div style="font-size:0.7rem; color:#94a3b8; letter-spacing:1px;">MY COINS</div>
            <div style="font-weight:bold; color:#e2e8f0; font-size: 1.2rem;">🪙 ${userCoins.toLocaleString()}</div>
        </div>
        
        <div class="prize-info" style="text-align: right;">
            <div style="font-size:0.7rem; color:#94a3b8; letter-spacing:1px;">${prizeLabel}</div>
            <div class="highlight" style="font-size:1.5rem;">${prizeValue}</div>
        </div>
    `;
}

// 번호 선택 화면
function renderSelectionPhase() {
    const header = document.getElementById('game-header');
    const board = document.getElementById('game-board');
    document.querySelector('.action-area')?.remove();
    
    header.innerHTML = `<div id="game-top-bar" class="game-top-bar"></div>`;
    updateTopBar();

    board.innerHTML = `
        <div class="game-room-border section-selection">
            <h2 class="game-title">PICK <span class="highlight">${gameState.mode.pick}</span> NUMBERS</h2>
            <div class="card-grid grid-easy" id="selection-grid"></div>
        </div>
    `;

    const selectionGrid = document.getElementById('selection-grid');
    for (let i = 1; i <= gameState.mode.total; i++) {
        const card = document.createElement('div');
        card.className = "card selection-card";
        card.innerHTML = `<span class="card-num">${i}</span>`;
        
        card.onclick = () => {
            if (gameState.selected.includes(i) || gameState.selected.length >= gameState.mode.pick) return;
            gameState.selected.push(i);
            card.classList.add('selected');
            
            if (gameState.selected.length === gameState.mode.pick) {
                renderStartButton(board);
            }
        };
        selectionGrid.appendChild(card);
    }
}

function renderStartButton(boardElement) {
    if (document.getElementById('btn-start-game')) return;
    const selectionSection = document.querySelector('.section-selection');
    
    const btnContainer = document.createElement('div');
    btnContainer.className = "action-area";
    btnContainer.innerHTML = `<button id="btn-start-game" class="neon-btn">START GAME</button>`;
    
    selectionSection.appendChild(btnContainer); 
    document.getElementById('btn-start-game').addEventListener('click', renderPlayPhase);
}

function calculateCurrentPrize() {
    const { mode, flips, level } = gameState;
    if (flips === 0) return mode.max;
    if (level === 1) { 
        if (flips <= 2) return mode.max;
        if (flips === 3) return 166;
        if (flips === 4) return 83;
        if (flips === 5) return 0; 
    }
    return mode.table && mode.table[flips] !== undefined ? mode.table[flips] : 0;
}

// 게임 플레이 화면
export function renderPlayPhase() {
    const board = document.getElementById('game-board');
    document.querySelector('.action-area')?.remove();

    board.innerHTML = `
        <div class="game-room-border section-play play-mode">
            <div id="target-bar" class="target-container">
                ${gameState.selected.map(num => `<div id="target-${num}" class="card target-node">${num}</div>`).join('')}
            </div>
            <div class="card-grid ${gameState.mode.grid}" id="play-grid"></div>
        </div>
    `;
    updateTopBar(); 

    const playGrid = document.getElementById('play-grid');
    const shuffled = Array.from({length: gameState.mode.total}, (_, i) => i + 1).sort(() => Math.random() - 0.5);

    shuffled.forEach(num => {
        const card = document.createElement('div');
        card.className = "card card-3d";
        card.innerHTML = `
            <div class="card-inner">
                <div class="card-face card-front">?</div>
                <div class="card-face card-back">${num}</div>
            </div>
        `;
        
        card.onclick = () => {
            if (gameState.isGameOver || card.classList.contains('flipped')) return;
            gameState.flips++;
            card.classList.add('flipped'); 
            updateTopBar(); 

            if (gameState.selected.includes(num)) {
                gameState.found.push(num);
                const targetNode = document.getElementById(`target-${num}`);
                if (targetNode) targetNode.classList.add('found');
                if (gameState.found.length === gameState.mode.pick) handleGameWin();
            } else if (gameState.flips === gameState.mode.total) {
                handleGameOver();
            }
        };
        playGrid.appendChild(card);
    });
}

async function handleGameWin() {
    gameState.isGameOver = true;
    const prize = calculateCurrentPrize();
    const cost = gameState.mode.cost;
    if (prize > 0) {
        const userDocRef = doc(window.lotGoDb, "users", window.lotGoAuth.currentUser.uid);
        await updateDoc(userDocRef, { coins: increment(prize) });
    }
    let resultTitle = "", statusClass = "";
    if (prize > cost) { resultTitle = `✨ BIG WIN!`; statusClass = "win-gold"; } 
    else if (prize === cost) { resultTitle = "SAFE!"; statusClass = "win-silver"; } 
    else if (prize > 0) { resultTitle = `ALMOST!`; statusClass = "win-bronze"; } 
    else { resultTitle = "UNLUCKY!"; statusClass = "win-fail"; }
    showResultButtons(resultTitle, prize, statusClass);
}

function handleGameOver() {
    gameState.isGameOver = true;
    const prize = calculateCurrentPrize();
    if (prize > 0) handleGameWin();
    else showResultButtons("GAME OVER!", 0, "win-fail");
}

function showResultButtons(message, prize, statusClass) {
    const board = document.getElementById('game-board');
    board.innerHTML = `
        <div class="game-room-border section-result ${statusClass}" style="text-align:center;">
            <h2 class="result-msg">${message}</h2>
            <div class="final-prize" style="font-size: 1.5rem; margin-bottom: 30px; color: #cbd5e1;">
                Total Received: <span class="highlight">${prize.toLocaleString()} C</span>
            </div>
            <div class="result-actions" style="display: flex; gap: 20px; justify-content: center;">
                <button class="neon-btn success" onclick="initSingleGame(${gameState.level})">🔄 REPLAY</button>
                <button class="neon-btn primary" onclick="location.reload()">🏠 LOBBY</button>
            </div>
        </div>`;
    updateTopBar();
}
