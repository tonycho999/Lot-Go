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

function goBackToLobby() {
    if (coinUnsub) coinUnsub();
    window.switchView('lobby-view');
    renderSingleMenu();
}

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

function updateTopBar() {
    const topBar = document.getElementById('game-top-bar');
    if (!topBar) return;
    
    // 상단바는 항상 MAX PRIZE 표시 (고정)
    let prizeLabel = "MAX PRIZE";
    let prizeValue = gameState.mode.max.toLocaleString();

    topBar.innerHTML = `
        <div class="coin-info" style="display: flex; flex-direction: column; align-items: flex-start;">
            <div id="back-to-lobby-btn" style="cursor:pointer; margin-bottom: 5px; color: #ffca28; font-size: 0.8rem; font-weight: bold;">
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
    
    const backBtn = document.getElementById('back-to-lobby-btn');
    if(backBtn) backBtn.onclick = goBackToLobby;
}

// 테이블 내부 상금 업데이트
function updateTablePrize() {
    const display = document.getElementById('table-current-prize');
    if (!display) return;
    let currentPrize = calculateCurrentPrize();
    display.innerText = currentPrize.toLocaleString();
}

// [수정] 상금 계산 로직 개선
function calculateCurrentPrize() {
    const { mode, flips, level } = gameState;
    
    // 1. 아직 최소 선택 개수(pick)만큼 뒤집지 않았다면 MAX 상금 유지
    if (flips < mode.pick) return mode.max;

    // 2. EASY 모드 예외 처리
    if (level === 1) { 
        // 2장 찾기 게임: 2장까지는 MAX, 3장부터 감액
        if (flips <= 2) return mode.max;
        if (flips === 3) return 166;
        if (flips === 4) return 83;
        if (flips === 5) return 0; 
    }
    
    // 3. NORMAL / HARD 모드는 테이블 참조
    return mode.table && mode.table[flips] !== undefined ? mode.table[flips] : 0;
}

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
        const ball = document.createElement('div');
        ball.className = "lotto-ball selection-ball";
        ball.innerHTML = `<div class="ball-content">${i}</div>`;
        
        ball.onclick = () => {
            if (gameState.selected.includes(i) || gameState.selected.length >= gameState.mode.pick) return;
            gameState.selected.push(i);
            ball.classList.add('selected');
            
            if (gameState.selected.length === gameState.mode.pick) {
                renderStartButton(board);
            }
        };
        selectionGrid.appendChild(ball);
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

export function renderPlayPhase() {
    const board = document.getElementById('game-board');
    document.querySelector('.action-area')?.remove();

    board.innerHTML = `
        <div class="game-room-border section-play play-mode">
            <div id="prize-container" class="in-game-prize-container">
                <div class="prize-label">CURRENT PRIZE</div>
                <div id="table-current-prize" class="prize-value">${gameState.mode.max.toLocaleString()}</div>
            </div>

            <div id="target-bar" class="target-container">
                ${gameState.selected.map(num => `<div id="target-${num}" class="target-ball">${num}</div>`).join('')}
            </div>

            <div class="card-grid ${gameState.mode.grid}" id="play-grid"></div>
            
            <div id="end-game-actions" style="width: 100%; margin-top: 30px;"></div>
        </div>
    `;
    updateTopBar(); 

    const playGrid = document.getElementById('play-grid');
    const shuffled = Array.from({length: gameState.mode.total}, (_, i) => i + 1).sort(() => Math.random() - 0.5);

    shuffled.forEach(num => {
        const ballWrapper = document.createElement('div');
        ballWrapper.className = "ball-wrapper";
        ballWrapper.innerHTML = `
            <div class="ball-inner">
                <div class="ball-face ball-front">&nbsp;</div>
                <div class="ball-face ball-back"><span class="ball-number">${num}</span></div>
            </div>
        `;
        
        ballWrapper.onclick = () => {
            if (gameState.isGameOver || ballWrapper.classList.contains('flipped')) return;
            gameState.flips++;
            ballWrapper.classList.add('flipped'); 
            
            updateTablePrize();

            if (gameState.selected.includes(num)) {
                gameState.found.push(num);
                const targetNode = document.getElementById(`target-${num}`);
                if (targetNode) targetNode.classList.add('found');
                if (gameState.found.length === gameState.mode.pick) handleGameWin();
            } else if (gameState.flips === gameState.mode.total) {
                handleGameOver();
            }
        };
        playGrid.appendChild(ballWrapper);
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
    showResultOnBoard(resultTitle, prize, statusClass);
}

function handleGameOver() {
    gameState.isGameOver = true;
    const prize = calculateCurrentPrize();
    if (prize > 0) handleGameWin();
    else showResultOnBoard("GAME OVER!", 0, "win-fail");
}

// [수정] 결과 화면 처리 (보드 유지, 상단 교체, 하단 버튼 추가)
function showResultOnBoard(message, prize, statusClass) {
    // 1. 상단 Current Prize 영역을 결과 메시지로 교체
    const prizeContainer = document.getElementById('prize-container');
    if (prizeContainer) {
        prizeContainer.innerHTML = `
            <div class="result-box ${statusClass}">
                <div class="result-msg" style="margin-bottom: 5px;">${message}</div>
                <div class="final-prize">Total: <span class="highlight">${prize.toLocaleString()} C</span></div>
            </div>
        `;
        // 스타일 변경 (테두리 등 제거하고 메시지 강조)
        prizeContainer.style.background = "transparent";
        prizeContainer.style.border = "none";
        prizeContainer.style.boxShadow = "none";
    }

    // 2. 하단에 버튼 추가
    const actionContainer = document.getElementById('end-game-actions');
    if (actionContainer) {
        actionContainer.innerHTML = `
            <div class="result-actions" style="display: flex; gap: 20px; justify-content: center;">
                <button class="neon-btn success" onclick="initSingleGame(${gameState.level})">🔄 REPLAY</button>
                <button id="end-lobby-btn" class="neon-btn primary">🏠 LOBBY</button>
            </div>
        `;
        
        // 함수 바인딩
        const lobbyBtn = document.getElementById('end-lobby-btn');
        const replayBtn = actionContainer.querySelector('.success');
        
        if(lobbyBtn) lobbyBtn.onclick = goBackToLobby;
        // initSingleGame은 전역 함수가 아니므로 window 객체를 통하거나 모듈 함수 직접 호출 필요
        // 여기서는 onclick 속성 대신 addEventListener 사용 권장하지만 기존 구조 유지를 위해
        // 모듈 내부 함수 호출 방식 유지 (HTML onclick="initSingleGame"은 작동 안 할 수 있음)
        if(replayBtn) replayBtn.onclick = () => initSingleGame(gameState.level);
    }
}
