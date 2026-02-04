import { doc, getDoc, updateDoc, increment, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 1. 게임 모드 설정 (요청하신 규칙 적용)
export const SINGLE_MODES = {
    1: { 
        name: 'EASY', pick: 2, total: 6, cost: 100, max: 1000, 
        grid: 'grid-easy', cssClass: 'easy-mode',
        // 상금: 1~2장: 1000, 3장: 500, 4장: 200, 5장: 50, 6장: 0
        table: { 1: 1000, 2: 1000, 3: 500, 4: 200, 5: 50, 6: 0 }
    },
    2: { 
        name: 'NORMAL', pick: 4, total: 12, cost: 200, max: 40000, 
        grid: 'grid-normal', cssClass: 'normal-mode',
        // 상금: 1~4장: 40000, 5장: 8000, 6장: 3000, 7: 1000, 8: 400, 9: 200, 10: 100, 11: 50, 12: 0
        table: { 1: 40000, 2: 40000, 3: 40000, 4: 40000, 5: 8000, 6: 3000, 7: 1000, 8: 400, 9: 200, 10: 100, 11: 50, 12: 0 }
    },
    3: { 
        name: 'HARD', pick: 6, total: 20, cost: 500, max: 10000000, 
        grid: 'grid-hard', cssClass: 'hard-mode',
        // 상금: 1~6: 10M, 7~20: 지정값
        table: { 
            1: 10000000, 2: 10000000, 3: 10000000, 4: 10000000, 5: 10000000, 6: 10000000,
            7: 1428570, 8: 357140, 9: 119040, 10: 47610, 
            11: 21640, 12: 10820, 13: 5820, 14: 3330, 15: 1990, 
            16: 1249, 17: 808, 18: 539, 19: 369, 20: 0 
        }
    }
};

let gameState = { selected: [], found: [], flips: 0, mode: null, isGameOver: false, level: 1, activeDouble: false };
let userCoins = 0; 
let coinUnsub = null;

const TickerManager = { stop: function() { } };

function goBackToLobby() {
    if (coinUnsub) coinUnsub();
    window.switchView('lobby-view');
    renderSingleMenu();
}

export async function renderSingleMenu() {
    const container = document.getElementById('single-tab');
    if (!container) return;
    const t = window.t || {}; 

    container.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; width: 100%;">
            <div class="menu-list" style="display: flex; flex-direction: column; gap: 20px; width: 100%; max-width: 400px; padding: 20px;">
                <div class="ticker-container" style="background:black; border-top:2px solid #d4af37; border-bottom:2px solid #d4af37; padding:5px; margin-bottom:10px;">
                    <div id="ticker-bar" style="color:#d4af37; font-family:'Orbitron'; text-align:center;">
                        ${t.ticker_welcome || "Welcome to Lot-Go!"}
                    </div>
                </div>
                <button id="ad-btn" class="main-btn ad-btn-style" onclick="handleWatchAd()">${t.watch_ad || "📺 WATCH AD (+300 C)"}</button>
                <div class="divider" style="width:100%; border-bottom:1px solid rgba(255,255,255,0.1); margin:10px 0;"></div>
                <button class="main-btn easy-btn" onclick="initSingleGame(1)">
                    <div class="btn-title">${t.single_menu_easy || "EASY"}</div>
                    <div class="btn-desc">2/6 Match • 100 C</div>
                </button>
                <button class="main-btn normal-btn" onclick="initSingleGame(2)">
                    <div class="btn-title">${t.single_menu_normal || "NORMAL"}</div>
                    <div class="btn-desc">4/12 Match • 200 C</div>
                </button>
                <button class="main-btn hard-btn" onclick="initSingleGame(3)">
                    <div class="btn-title">${t.single_menu_hard || "HARD"}</div>
                    <div class="btn-desc">6/20 Match • 500 C</div>
                </button>
            </div>
        </div>`;
}

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

function calculateCurrentPrize() {
    const { mode, flips } = gameState;
    // table 객체에서 현재 flip 횟수에 맞는 상금을 반환 (없으면 0)
    return mode.table && mode.table[flips] !== undefined ? mode.table[flips] : 0;
}

function renderSelectionPhase() {
    const header = document.getElementById('game-header');
    const board = document.getElementById('game-board');
    const t = window.t || {};
    
    board.className = ''; 
    header.innerHTML = `<div id="game-top-bar" class="game-top-bar"></div>`;
    updateTopBar();

    board.innerHTML = `
        <div class="game-view-container">
            <div class="game-room-border ${gameState.mode.cssClass}">
                <h2 class="game-title">
                    번호 <span class="highlight">${gameState.mode.pick}</span>개를 선택하세요
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

export function renderPlayPhase() {
    const board = document.getElementById('game-board');
    const t = window.t || {};
    board.className = ''; 

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
            
            let curPrize = calculateCurrentPrize();
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

window.initSingleGame = initSingleGame;
window.handleWatchAd = () => alert("Ad Coming Soon");
