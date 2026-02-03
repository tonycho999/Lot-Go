import { doc, getDoc, updateDoc, increment, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 1. 게임 모드 설정 (기존 유지)
export const SINGLE_MODES = {
    1: { 
        name: 'EASY', pick: 2, total: 5, cost: 100, max: 500, grid: 'grid-easy',
        prizes: [500, 100],
        cssClass: 'easy-mode' // [NEW] 난이도별 CSS 클래스
    },
    2: { 
        name: 'NORMAL', pick: 4, total: 10, cost: 200, max: 10000, grid: 'grid-normal', 
        table: { 4: 10000, 5: 2000, 6: 666, 7: 285, 8: 142, 9: 79, 10: 0 },
        prizes: [10000, 2000, 666, 285],
        cssClass: 'normal-mode' // [NEW]
    },
    3: { 
        name: 'HARD', pick: 6, total: 20, cost: 500, max: 10000000, grid: 'grid-hard', 
        table: { 
            6: 10000000, 7: 1428570, 8: 357140, 9: 119040, 10: 47610, 
            11: 21640, 12: 10820, 13: 5820, 14: 3330, 15: 1990, 
            16: 1249, 17: 808, 18: 539, 19: 369, 20: 0 
        },
        prizes: [10000000, 1428570, 357140, 119040, 47610],
        cssClass: 'hard-mode' // [NEW]
    }
};

let gameState = { selected: [], found: [], flips: 0, mode: null, isGameOver: false, level: 1, activeDouble: false };
let userCoins = 0; 
let coinUnsub = null;

// ... (TickerManager, goBackToLobby, renderSingleMenu는 기존과 동일하므로 생략) ...
// (필요하면 이전 코드에서 복사해서 사용하세요. 여기선 핵심 변경 부분만 보여드립니다.)
const TickerManager = { stop: function() { } };
function goBackToLobby() { if (coinUnsub) coinUnsub(); window.switchView('lobby-view'); renderSingleMenu(); }
export async function renderSingleMenu() { /* 기존 renderSingleMenu 코드 유지 */ 
    const container = document.getElementById('single-tab');
    if (!container) return;
    const t = window.t || {}; 
    container.innerHTML = `... (기존 메뉴 HTML) ...`; // 지면상 생략, 이전 코드 사용
}


// [C] 게임 초기화 (비용 차감) - 기존 동일
export async function initSingleGame(level) {
    const db = window.lotGoDb;
    const auth = window.lotGoAuth;
    const t = window.t || {};
    const mode = SINGLE_MODES[level];
    
    const userDocRef = doc(db, "users", auth.currentUser.uid);
    const snap = await getDoc(userDocRef);
    if (!snap.exists()) return alert("User data error");
    
    const userData = snap.data();
    const currentCoins = userData.coins || 0;
    
    if (currentCoins < mode.cost) return alert(t.alert_no_coin || "Not enough coins");

    await updateDoc(userDocRef, { coins: increment(-mode.cost) });

    if (coinUnsub) coinUnsub(); 
    coinUnsub = onSnapshot(userDocRef, (docSnapshot) => {
        userCoins = docSnapshot.data().coins || 0;
        updateTopBar(); 
    });

    gameState = { 
        selected: [], found: [], flips: 0, mode, 
        isGameOver: false, level, activeDouble: false 
    };
    
    window.switchView('game-view');
    renderSelectionPhase();
}

// [D] 상단바 업데이트 (HTML 구조 변경)
function updateTopBar() {
    const topBar = document.getElementById('game-top-bar');
    if (!topBar) return;
    const t = window.t || {};
    
    let prizeValue = gameState.mode.max.toLocaleString();

    topBar.innerHTML = `
        <div class="coin-info">
            <div id="back-to-lobby-btn" style="cursor:pointer; color: var(--gold-accent); font-weight: bold; margin-bottom: 5px;">
                ← ${t.lobby_btn || "LOBBY"}
            </div>
            <div style="color:#e2e8f0; font-size: 1.1rem;">
                <span style="font-size:0.8rem; color:#94a3b8;">${t.my_coins || "COINS"}</span>
                <span style="font-weight:bold; color:#fff;">${userCoins.toLocaleString()}</span>
            </div>
        </div>
        <div class="prize-info" style="text-align:right;">
            <div style="font-size:0.7rem; color:var(--gold-accent); margin-bottom: 5px;">${t.current_prize || "MAX PRIZE"}</div>
            <div class="highlight" style="font-size:1.5rem; color:#fff; text-shadow: 0 0 10px var(--gold-accent);">${prizeValue}</div>
        </div>
    `;
    
    document.getElementById('back-to-lobby-btn').onclick = goBackToLobby;
}

// [E] 번호 선택 화면 그리기 (난이도 클래스 적용 & 공 디자인 변경)
function renderSelectionPhase() {
    const header = document.getElementById('game-header');
    const board = document.getElementById('game-board');
    const t = window.t || {};
    
    header.innerHTML = `<div id="game-top-bar" class="game-top-bar"></div>`;
    updateTopBar();

    // [NEW] 난이도에 맞는 CSS 클래스 추가 (${gameState.mode.cssClass})
    board.innerHTML = `
        <div class="game-view-container">
            <div class="game-room-border ${gameState.mode.cssClass}">
                <h2 class="game-title">
                    ${t.pick_title || "PICK"} <span class="highlight">${gameState.mode.pick}</span>
                </h2>
                <div class="card-grid ${gameState.mode.grid}" id="selection-grid"></div>
                <div id="selection-footer" style="width:100%; margin-top:20px; z-index:1;"></div>
            </div>
        </div>
    `;

    const selectionGrid = document.getElementById('selection-grid');
    for (let i = 1; i <= gameState.mode.total; i++) {
        const ball = document.createElement('div');
        ball.className = "lotto-ball";
        // [NEW] 공 내부에 흰색 원과 숫자 추가
        ball.innerHTML = `<div class="ball-number-bg">${i}</div>`;
        
        ball.onclick = () => {
            if (gameState.selected.includes(i) || gameState.selected.length >= gameState.mode.pick) return;
            gameState.selected.push(i);
            ball.classList.add('selected');
            if (gameState.selected.length === gameState.mode.pick) renderStartButton();
        };
        selectionGrid.appendChild(ball);
    }
}

function renderStartButton() {
    const footer = document.getElementById('selection-footer');
    const t = window.t || {};
    footer.innerHTML = `<button id="btn-start-game" class="neon-btn success" style="width:100%;">${t.start_game || "START"}</button>`;
    document.getElementById('btn-start-game').onclick = renderPlayPhase;
}

// [F] 플레이 화면 그리기 (난이도 클래스 적용 & 공 디자인 변경)
export function renderPlayPhase() {
    const board = document.getElementById('game-board');
    const t = window.t || {};

    // [NEW] 난이도에 맞는 CSS 클래스 추가
    board.innerHTML = `
        <div class="game-view-container">
            <div class="game-room-border play-mode ${gameState.mode.cssClass}">
                <div style="text-align:center; margin-bottom:15px; z-index:1;">
                    <div style="font-size:0.8rem; color:var(--gold-accent);">${t.game_prize || "PRIZE"}</div>
                    <div id="table-current-prize" style="font-size:2rem; color:#fff; font-weight:bold; font-family:'Orbitron'; text-shadow: 0 0 10px var(--gold-accent);">
                        ${gameState.mode.max.toLocaleString()}
                    </div>
                </div>

                <div class="target-container">
                    ${gameState.selected.map(num => `<div id="target-${num}" class="target-ball">${num}</div>`).join('')}
                </div>

                <div class="card-grid ${gameState.mode.grid}" id="play-grid"></div>
                <div id="play-footer" style="width:100%; margin-top:20px; z-index:1;"></div>
            </div>
        </div>
    `;

    const playGrid = document.getElementById('play-grid');
    const shuffled = Array.from({length: gameState.mode.total}, (_, i) => i + 1).sort(() => Math.random() - 0.5);

    shuffled.forEach(num => {
        const ballWrapper = document.createElement('div');
        ballWrapper.className = "ball-wrapper";
        ballWrapper.innerHTML = `
            <div class="ball-inner">
                <div class="ball-face ball-front"></div>
                <div class="ball-face ball-back">
                    <div class="ball-number-bg">${num}</div>
                </div>
            </div>
        `;
        
        ballWrapper.onclick = () => {
            if (gameState.isGameOver || ballWrapper.classList.contains('flipped')) return;
            
            gameState.flips++;
            ballWrapper.classList.add('flipped'); 
            
            let curPrize = 0;
            if (gameState.mode.table && gameState.mode.table[gameState.flips] !== undefined) {
                curPrize = gameState.mode.table[gameState.flips];
            } else if (gameState.level === 1 && gameState.flips <= 2) {
                curPrize = 500; 
            }
            document.getElementById('table-current-prize').innerText = curPrize.toLocaleString();

            if (gameState.selected.includes(num)) {
                gameState.found.push(num);
                const targetNode = document.getElementById(`target-${num}`);
                if (targetNode) targetNode.classList.add('found');
                if (gameState.found.length === gameState.mode.pick) handleGameWin(curPrize);
            } else if (gameState.flips === gameState.mode.total) {
                handleGameWin(0);
            }
        };
        playGrid.appendChild(ballWrapper);
    });
}

// [G] 게임 종료 처리 - 기존 동일
async function handleGameWin(prize) {
    gameState.isGameOver = true;
    const t = window.t || {};
    
    if (prize > 0) {
        const userDocRef = doc(window.lotGoDb, "users", window.lotGoAuth.currentUser.uid);
        await updateDoc(userDocRef, { coins: increment(prize) });
    }
    
    let msg = (prize > 0) ? (t.big_win || "WIN!") : (t.unlucky || "FAIL");
    let cssClass = (prize > 0) ? "win-gold" : "win-fail";

    const footer = document.getElementById('play-footer');
    if (footer) {
        footer.innerHTML = `
            <div class="result-box ${cssClass}">
                <div class="result-msg">${msg}</div>
                <div class="final-prize">+ ${prize.toLocaleString()} C</div>
            </div>
            <div style="display: flex; gap: 10px; justify-content: center; width: 100%;">
                <button class="neon-btn success" style="flex:1;" onclick="initSingleGame(${gameState.level})">${t.replay || "REPLAY"}</button>
                <button id="end-lobby-btn" class="neon-btn primary" style="flex:1;">${t.lobby_btn || "LOBBY"}</button>
            </div>
        `;
        document.getElementById('end-lobby-btn').onclick = goBackToLobby;
    }
}

// Window 객체에 함수 등록 - 기존 동일
window.initSingleGame = initSingleGame;
window.handleWatchAd = () => alert("Ad Coming Soon");
