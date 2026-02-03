import { doc, getDoc, updateDoc, increment, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 1. 게임 모드 설정 및 상금 데이터
export const SINGLE_MODES = {
    1: { 
        name: 'EASY', pick: 2, total: 5, cost: 100, max: 500, grid: 'grid-easy',
        // Easy 모드 상금 로직은 calculateCurrentPrize 함수에서 별도 처리
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

let gameState = { selected: [], found: [], flips: 0, mode: null, isGameOver: false, level: 1 };
let userCoins = 0; 
let coinUnsub = null;

/**
 * 1. 게임 메뉴 렌더링
 */
export async function renderSingleMenu() {
    const container = document.getElementById('single-tab');
    if (!container) return;
    
    container.innerHTML = `
        <div class="menu-list" style="display: flex; flex-direction: column; gap: 15px; padding: 10px;">
            <button id="ad-btn" class="main-btn ad-btn-style" onclick="handleWatchAd()">📺 WATCH AD (+300 C)</button>
            <div class="divider"></div>
            <button class="main-btn easy-btn" onclick="initSingleGame(1)">
                <div class="btn-title">EASY</div>
                <div class="btn-desc">2/5 Match • 100 C</div>
            </button>
            <button class="main-btn normal-btn" onclick="initSingleGame(2)">
                <div class="btn-title">NORMAL</div>
                <div class="btn-desc">4/10 Match • 200 C</div>
            </button>
            <button class="main-btn hard-btn" onclick="initSingleGame(3)">
                <div class="btn-title">HARD</div>
                <div class="btn-desc">6/20 Match • 500 C</div>
            </button>
        </div>`;
}

// 광고 기능 (추후 구현 예정 Placeholder)
export async function handleWatchAd() {
    alert("광고 기능 준비 중입니다."); 
}

/**
 * 2. 게임 초기화 (핵심: 코인 확인 버그 수정됨)
 */
export async function initSingleGame(level) {
    const db = window.lotGoDb;
    const auth = window.lotGoAuth;
    const mode = SINGLE_MODES[level];
    const userDocRef = doc(db, "users", auth.currentUser.uid);
    
    // [중요] 1. 먼저 DB에서 최신 코인 정보를 확실하게 가져옵니다 (동기 처리)
    const snap = await getDoc(userDocRef);
    
    if (!snap.exists()) return alert("User data not found.");
    
    const currentCoins = snap.data().coins || 0;
    userCoins = currentCoins; // 로컬 변수 즉시 동기화

    // [중요] 2. 코인 부족 확인 (이제 정확한 잔액으로 비교합니다)
    if (currentCoins < mode.cost) {
        return alert(`Not enough coins! You have ${currentCoins.toLocaleString()} C, but need ${mode.cost} C.`);
    }

    // [중요] 3. 코인 차감 실행
    await updateDoc(userDocRef, { coins: increment(-mode.cost) });

    // [중요] 4. UI 갱신을 위한 실시간 리스너 연결 (게임 도중 코인 변화 감지)
    if (coinUnsub) coinUnsub(); 
    coinUnsub = onSnapshot(userDocRef, (docSnapshot) => {
        userCoins = docSnapshot.data().coins || 0;
        updateTopBar(); 
    });

    // 5. 게임 상태 설정 및 화면 전환
    gameState = { selected: [], found: [], flips: 0, mode, isGameOver: false, level };
    window.switchView('game-view');
    renderSelectionPhase();
}

/**
 * 상단 정보바 업데이트 (코인 & 상금 표시)
 */
function updateTopBar() {
    const topBar = document.getElementById('game-top-bar');
    if (!topBar) return;
    
    const currentPrize = calculateCurrentPrize();
    
    // 게임 시작 전(선택 단계)엔 MAX PRIZE, 게임 중엔 CURRENT PRIZE 표시
    let prizeLabel = "MAX PRIZE";
    let prizeValue = gameState.mode.max.toLocaleString();

    if (document.querySelector('.play-mode')) {
        prizeLabel = "CURRENT PRIZE";
        prizeValue = currentPrize.toLocaleString();
    }
    
    topBar.innerHTML = `
        <div class="coin-info">
            <div style="font-size:0.7rem; color:#94a3b8; letter-spacing:1px;">MY COINS</div>
            <div style="font-weight:bold; color:#e2e8f0;">🪙 ${userCoins.toLocaleString()}</div>
        </div>
        <div class="prize-info" style="text-align: right;">
            <div style="font-size:0.7rem; color:#94a3b8; letter-spacing:1px;">${prizeLabel}</div>
            <div class="highlight" style="font-size:1.3rem;">${prizeValue}</div>
        </div>
    `;
}

/**
 * 3. 번호 선택 화면 렌더링
 */
function renderSelectionPhase() {
    const header = document.getElementById('game-header');
    const board = document.getElementById('game-board');
    document.querySelector('.action-area')?.remove();
    
    // 헤더 설정: 로비 이동 버튼 + 상단바
    header.innerHTML = `
        <div class="game-meta" style="margin-bottom:10px;">
            <span class="back-link" onclick="location.reload()">← BACK TO LOBBY</span>
        </div>
        <div id="game-top-bar" class="game-top-bar"></div>
    `;
    updateTopBar();

    // 보드 설정: 테두리 + 선택 그리드
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
            
            // 정해진 개수만큼 선택하면 시작 버튼 표시
            if (gameState.selected.length === gameState.mode.pick) {
                renderStartButton(board);
            }
        };
        selectionGrid.appendChild(card);
    }
}

// 시작 버튼 생성 (보드 아래)
function renderStartButton(boardElement) {
    if (document.getElementById('btn-start-game')) return;
    
    const btnContainer = document.createElement('div');
    btnContainer.className = "action-area";
    btnContainer.style.marginTop = "20px";
    btnContainer.innerHTML = `<button id="btn-start-game" class="neon-btn">START GAME</button>`;
    
    boardElement.after(btnContainer);
    document.getElementById('btn-start-game').addEventListener('click', renderPlayPhase);
}

// 상금 계산 로직
function calculateCurrentPrize() {
    const { mode, flips, level } = gameState;
    
    // 아직 뒤집지 않았으면 최대 상금 표시
    if (flips === 0) return mode.max;

    // EASY 모드(2/5) 특수 로직: 2장까지는 감액 없음
    if (level === 1) { 
        if (flips <= 2) return mode.max;
        if (flips === 3) return 166;
        if (flips === 4) return 83;
        if (flips === 5) return 50;
    }
    
    // NORMAL, HARD 모드는 테이블 참조
    return mode.table && mode.table[flips] !== undefined ? mode.table[flips] : 0;
}

/**
 * 4. 게임 플레이 화면 렌더링
 */
export function renderPlayPhase() {
    const board = document.getElementById('game-board');
    document.querySelector('.action-area')?.remove();

    // 플레이 화면 구성 (테두리 포함)
    board.innerHTML = `
        <div class="game-room-border section-play play-mode">
            <div id="target-bar" class="target-container" style="margin-bottom: 20px;">
                ${gameState.selected.map(num => `<div id="target-${num}" class="card target-node">${num}</div>`).join('')}
            </div>
            
            <div class="card-grid ${gameState.mode.grid}" id="play-grid"></div>
        </div>
    `;
    updateTopBar(); 

    const playGrid = document.getElementById('play-grid');
    // 카드 섞기
    const shuffled = Array.from({length: gameState.mode.total}, (_, i) => i + 1).sort(() => Math.random() - 0.5);

    shuffled.forEach(num => {
        const card = document.createElement('div');
        // 3D 카드 구조 적용 (Flip 애니메이션용)
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
            card.classList.add('flipped'); // CSS 회전 효과 트리거
            
            updateTopBar(); // 상금 업데이트

            // 찾은 번호인지 확인
            if (gameState.selected.includes(num)) {
                gameState.found.push(num);
                const targetNode = document.getElementById(`target-${num}`);
                if (targetNode) targetNode.classList.add('found');
                
                // 모두 찾으면 승리
                if (gameState.found.length === gameState.mode.pick) handleGameWin();
            } else if (gameState.flips === gameState.mode.total) {
                // 카드를 다 뒤집으면 게임 오버
                handleGameOver();
            }
        };
        playGrid.appendChild(card);
    });
}

// 승리 처리
async function handleGameWin() {
    gameState.isGameOver = true;
    const prize = calculateCurrentPrize();
    const cost = gameState.mode.cost;

    if (prize > 0) {
        const userDocRef = doc(window.lotGoDb, "users", window.lotGoAuth.currentUser.uid);
        await updateDoc(userDocRef, { coins: increment(prize) });
    }

    let resultTitle = "", statusClass = "";
    if (prize > cost) {
        resultTitle = `✨ BIG WIN!`;
        statusClass = "win-gold";
    } else if (prize === cost) {
        resultTitle = "SAFE!";
        statusClass = "win-silver";
    } else if (prize > 0) {
        resultTitle = `ALMOST!`;
        statusClass = "win-bronze";
    } else {
        resultTitle = "UNLUCKY!";
        statusClass = "win-fail";
    }
    showResultButtons(resultTitle, prize, statusClass);
}

// 게임 오버 처리
function handleGameOver() {
    gameState.isGameOver = true;
    const prize = calculateCurrentPrize();
    if (prize > 0) handleGameWin();
    else showResultButtons("GAME OVER!", 0, "win-fail");
}

// 결과 화면 표시 (테두리 내부에 표시)
function showResultButtons(message, prize, statusClass) {
    const board = document.getElementById('game-board');
    
    board.innerHTML = `
        <div class="game-room-border section-result ${statusClass}" style="text-align:center; padding: 30px;">
            <h2 class="result-msg" style="font-size: 2rem; margin-bottom: 10px;">${message}</h2>
            <div class="final-prize" style="font-size: 1.2rem; margin-bottom: 30px; color: #cbd5e1;">
                Total Received: <span class="highlight" style="color: #fbbf24; font-weight:bold;">${prize.toLocaleString()} C</span>
            </div>
            
            <div class="result-actions" style="display: flex; gap: 10px; width: 100%; justify-content: center;">
                <button class="neon-btn success" onclick="initSingleGame(${gameState.level})" style="flex: 1; padding: 15px; font-size: 0.9rem;">
                    🔄 REPLAY
                </button>
                <button class="neon-btn primary" onclick="location.reload()" style="flex: 1; padding: 15px; font-size: 0.9rem;">
                    🏠 LOBBY
                </button>
            </div>
        </div>`;
    updateTopBar();
}
