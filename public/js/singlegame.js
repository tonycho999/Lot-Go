import { doc, getDoc, updateDoc, increment, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 1. 상금 데이터 (Lookup Table)
export const SINGLE_MODES = {
    1: { 
        name: 'EASY', pick: 2, total: 5, cost: 100, max: 500, grid: 'grid-easy',
        // table: { 2: 500, 3: 166, 4: 83, 5: 50 } // [수정 6] EASY는 로직으로 처리
    },
    2: { 
        name: 'NORMAL', pick: 4, total: 10, cost: 200, max: 10000, grid: 'grid-normal',
        table: { 4: 10000, 5: 2000, 6: 666, 7: 285, 8: 142, 9: 79, 10: 47 }
    },
    3: { 
        name: 'HARD', pick: 6, total: 20, cost: 500, max: 10000000, grid: 'grid-hard',
        table: { 
            6: 10000000, 7: 1428570, 8: 357140, 9: 119040, 10: 47610, 
            11: 21640, 12: 10820, 13: 5820, 14: 3330, 15: 1990, 
            16: 1249, 17: 808, 18: 539, 19: 369, 20: 258 
        }
    }
};

const AD_CONFIG = { COOLDOWN: 10 * 60 * 1000, MAX_DAILY: 10, REWARD: 300 };
let gameState = { selected: [], found: [], flips: 0, mode: null, isGameOver: false, level: 1 };
let userCoins = 0;
let coinUnsub = null;

// ... (renderSingleMenu, handleWatchAd는 기존과 동일) ...

/**
 * 3. 게임 초기화
 */
export async function initSingleGame(level) {
    const db = window.lotGoDb;
    const auth = window.lotGoAuth;

    // [수정 2] 실시간 코인 리스너 연결
    if (coinUnsub) coinUnsub();
    coinUnsub = onSnapshot(doc(db, "users", auth.currentUser.uid), (doc) => {
        userCoins = doc.data().coins || 0;
        updateTopBar();
    });

    const mode = SINGLE_MODES[level];
    if (userCoins < mode.cost) return alert("Not enough coins!");

    await updateDoc(doc(db, "users", auth.currentUser.uid), { coins: increment(-mode.cost) });
    gameState = { selected: [], found: [], flips: 0, mode, isGameOver: false, level };
    
    window.switchView('game-view');
    renderSelectionPhase();
}

// [수정 2] 상단 정보바 업데이트
function updateTopBar() {
    const topBar = document.getElementById('game-top-bar');
    if (!topBar) return;
    
    const currentPrize = calculateCurrentPrize();
    let prizeHtml = `MAX PRIZE: <span class="highlight">${gameState.mode.max.toLocaleString()}</span>`;
    
    if (document.querySelector('.play-mode')) {
        prizeHtml = `
            <div>CURRENT: <span class="highlight">${currentPrize.toLocaleString()}</span></div>
            <small style="color:#94a3b8;">MAX: ${gameState.mode.max.toLocaleString()}</small>
        `;
    }
    
    topBar.innerHTML = `
        <div class="coin-info">🪙 ${userCoins.toLocaleString()}</div>
        <div class="prize-info" style="text-align: right;">${prizeHtml}</div>
    `;
}

/**
 * 4. 번호 선택 화면
 */
function renderSelectionPhase() {
    const header = document.getElementById('game-header');
    const board = document.getElementById('game-board');
    document.querySelector('.action-area')?.remove();
    
    // [수정 2] 상단 정보바 컨테이너 추가
    header.innerHTML = `<div id="game-top-bar" class="game-top-bar"></div>`;
    updateTopBar();

    // [수정 3] 게임룸 테두리 적용 및 [수정 1] EXIT GAME 제거
    board.innerHTML = `
        <h2 class="game-title" style="margin-bottom:20px;">PICK <span class="highlight">${gameState.mode.pick}</span> NUMBERS</h2>
        <div class="game-room-border section-selection">
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
            if (gameState.selected.length === gameState.mode.pick) renderStartButton(board);
        };
        selectionGrid.appendChild(card);
    }
}

function renderStartButton(boardElement) {
    if (document.getElementById('btn-start-game')) return;
    const btnContainer = document.createElement('div');
    btnContainer.className = "action-area";
    btnContainer.innerHTML = `<button id="btn-start-game" class="neon-btn">START GAME</button>`;
    boardElement.after(btnContainer);
    document.getElementById('btn-start-game').addEventListener('click', renderPlayPhase);
}

// [수정 6] 상금 계산 로직 변경
function calculateCurrentPrize() {
    const { mode, flips, level } = gameState;
    if (level === 1) { // EASY 2/5
        if (flips <= 2) return mode.max;
        if (flips === 3) return 166;
        if (flips === 4) return 83;
        if (flips === 5) return 50;
    }
    return mode.table[flips] !== undefined ? mode.table[flips] : 0;
}

/**
 * 5. 게임 플레이 화면
 */
export function renderPlayPhase() {
    const board = document.getElementById('game-board');
    document.querySelector('.action-area')?.remove();

    // [수정 4] 게임 시작 후 레이아웃 정리 및 [수정 3] 테두리 적용
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
        // [수정 5] 3D 카드 구조 적용
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
            card.classList.add('flipped'); // [수정 5] 회전 효과 클래스 추가
            
            updateTopBar(); // 상금 업데이트

            if (gameState.selected.includes(num)) {
                gameState.found.push(num);
                document.getElementById(`target-${num}`).classList.add('found');
                if (gameState.found.length === gameState.mode.pick) handleGameWin();
            } else if (gameState.flips === gameState.mode.total) {
                handleGameOver();
            }
        };
        playGrid.appendChild(card);
    });
}

// ... (handleGameWin, handleGameOver는 기존 로직 유지) ...

/**
 * 8. 결과 버튼 표시
 */
function showResultButtons(message, prize, statusClass) {
    const board = document.getElementById('game-board');
    // [수정 7] 결과 화면 UI 개선 및 버튼 수정
    board.innerHTML = `
        <div class="game-room-border section-result ${statusClass}">
            <h2 class="result-msg">${message}</h2>
            <div class="final-prize" style="font-size: 1.5rem; margin-bottom: 20px;">
                Total Received: <span class="highlight">${prize.toLocaleString()} C</span>
            </div>
            <div class="result-actions" style="display: flex; gap: 15px; width: 100%;">
                <button class="neon-btn success wide-btn" onclick="initSingleGame(${gameState.level})" style="flex: 1;">🔄 PLAY AGAIN</button>
                <button class="neon-btn primary wide-btn" onclick="location.reload()" style="flex: 1;">🏠 LOBBY</button>
            </div>
        </div>`;
    updateTopBar();
}
