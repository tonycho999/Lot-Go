import { doc, getDoc, updateDoc, increment, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 1. 게임 모드 설정
export const SINGLE_MODES = {
    1: { 
        name: 'EASY', pick: 2, total: 5, cost: 100, max: 500, grid: 'grid-easy',
        prizes: [500, 100] 
    },
    2: { 
        name: 'NORMAL', pick: 4, total: 10, cost: 200, max: 10000, grid: 'grid-normal', 
        table: { 4: 10000, 5: 2000, 6: 666, 7: 285, 8: 142, 9: 79, 10: 0 },
        prizes: [10000, 2000, 666, 285]
    },
    3: { 
        name: 'HARD', pick: 6, total: 20, cost: 500, max: 10000000, grid: 'grid-hard', 
        table: { 
            6: 10000000, 7: 1428570, 8: 357140, 9: 119040, 10: 47610, 
            11: 21640, 12: 10820, 13: 5820, 14: 3330, 15: 1990, 
            16: 1249, 17: 808, 18: 539, 19: 369, 20: 0 
        },
        prizes: [10000000, 1428570, 357140, 119040, 47610]
    }
};

let gameState = { selected: [], found: [], flips: 0, mode: null, isGameOver: false, level: 1, activeDouble: false };
let userCoins = 0; 
let coinUnsub = null;

// Ticker System
const TickerManager = {
    queue: [],
    isAnimating: false,
    timer: null,

    generateFakeUser: function() {
        const adjs = ['Lucky', 'Golden', 'Super', 'Mega', 'Happy', 'Rich', 'Cool', 'Fast', 'Neon', 'Cyber'];
        const nouns = ['Tiger', 'Dragon', 'Winner', 'Star', 'King', 'Queen', 'Lion', 'Player', 'Master', 'Ghost'];
        const adj = adjs[Math.floor(Math.random() * adjs.length)];
        const noun = nouns[Math.floor(Math.random() * nouns.length)];
        const num = Math.floor(Math.random() * 999);
        return `${adj}${noun}${num}`;
    },

    getRandomRealPrize: function() {
        let validPrizes = [];
        if (SINGLE_MODES[2].prizes) validPrizes = validPrizes.concat(SINGLE_MODES[2].prizes.filter(p => p >= 10000));
        if (SINGLE_MODES[3].prizes) validPrizes = validPrizes.concat(SINGLE_MODES[3].prizes.filter(p => p >= 10000));
        if (validPrizes.length === 0) return 10000;
        return validPrizes[Math.floor(Math.random() * validPrizes.length)];
    },

    init: function() {
        if(this.timer) clearTimeout(this.timer);
        this.queue = [];
        this.isAnimating = false;
        this.loopFakeMessages();
    },

    loopFakeMessages: function() {
        const randomTime = Math.floor(Math.random() * (30000 - 5000 + 1)) + 5000;
        this.timer = setTimeout(() => {
            if (!document.getElementById('ticker-bar')) return;
            const user = this.generateFakeUser();
            const prize = this.getRandomRealPrize();
            const isJackpot = prize >= 1000000;
            
            // 티커 메시지는 고유명사라 영어 유지
            let msg = `${user} won ${prize.toLocaleString()} C!`;
            if (isJackpot) msg = `🚨 JACKPOT!! ${user} hit ${prize.toLocaleString()} C! 🚨`;
            this.addMessage(msg, isJackpot);
            this.loopFakeMessages();
        }, randomTime);
    },

    addMessage: function(msg, isJackpot = false) {
        this.queue.push({ text: msg, isJackpot: isJackpot });
        this.playNext();
    },

    playNext: function() {
        if (this.isAnimating || this.queue.length === 0) return;
        const tickerBar = document.getElementById('ticker-bar');
        const container = document.querySelector('.ticker-container');
        if (!tickerBar || !container) return;

        this.isAnimating = true;
        const item = this.queue.shift();
        
        tickerBar.innerText = item.text;
        tickerBar.className = 'ticker-text'; 
        if (item.isJackpot) tickerBar.classList.add('ticker-jackpot');

        const distance = container.offsetWidth + tickerBar.offsetWidth + 50;
        const animation = tickerBar.animate([
            { transform: 'translateX(0)' }, 
            { transform: `translateX(-${distance}px)` }
        ], {
            duration: 10000, 
            easing: 'linear',
            fill: 'forwards'
        });

        animation.onfinish = () => {
            this.isAnimating = false;
            this.playNext();
        };
    },
    
    stop: function() {
        if(this.timer) clearTimeout(this.timer);
        this.queue = [];
        this.isAnimating = false;
    }
};

function goBackToLobby() {
    TickerManager.stop();
    if (coinUnsub) coinUnsub();
    window.switchView('lobby-view');
    renderSingleMenu();
}

// Render Menu (다국어 적용됨)
export async function renderSingleMenu() {
    const container = document.getElementById('single-tab');
    if (!container) return;
    const t = window.t; // 언어 사용
    
    container.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; width: 100%;">
            <div class="menu-list" style="display: flex; flex-direction: column; gap: 20px; width: 100%; max-width: 400px; padding: 20px;">
                <div class="ticker-container">
                    <div id="ticker-bar" class="ticker-text">${t.ticker_welcome}</div>
                </div>
                <button id="ad-btn" class="main-btn ad-btn-style" onclick="handleWatchAd()">${t.watch_ad}</button>
                <div class="divider" style="width:100%; border-bottom:1px solid rgba(255,255,255,0.1); margin:10px 0;"></div>
                <button class="main-btn easy-btn" onclick="initSingleGame(1)">
                    <div class="btn-title">${t.single_menu_easy}</div>
                    <div class="btn-desc">${t.single_desc_easy}</div>
                </button>
                <button class="main-btn normal-btn" onclick="initSingleGame(2)">
                    <div class="btn-title">${t.single_menu_normal}</div>
                    <div class="btn-desc">${t.single_desc_normal}</div>
                </button>
                <button class="main-btn hard-btn" onclick="initSingleGame(3)">
                    <div class="btn-title">${t.single_menu_hard}</div>
                    <div class="btn-desc">${t.single_desc_hard}</div>
                </button>
            </div>
        </div>`;
    TickerManager.init();
}

export async function handleWatchAd() { 
    alert(window.t.alert_ad_ready);
}

// [수정] XP 적립 로직 (Level > 1 일 때만 적립) + 다국어
export async function initSingleGame(level) {
    TickerManager.stop(); 

    const db = window.lotGoDb;
    const auth = window.lotGoAuth;
    const t = window.t;
    const mode = SINGLE_MODES[level];
    const userDocRef = doc(db, "users", auth.currentUser.uid);
    
    const snap = await getDoc(userDocRef);
    if (!snap.exists()) return alert(t.alert_no_data);
    
    const userData = snap.data();
    const currentCoins = userData.coins || 0;
    const currentLevel = userData.level !== undefined ? userData.level : 10;
    const myItems = userData.items || {};
    userCoins = currentCoins; 

    if (currentCoins < mode.cost) return alert(t.alert_no_coin);

    let updates = { coins: increment(-mode.cost) };

    // [핵심] 레벨이 1보다 클 때만 (즉, Lv 2 ~ 10) 경험치 획득 (Lv 1, 0은 제외)
    if (currentLevel > 1) {
        const xpGain = Math.floor(mode.cost * 0.1);
        updates.exp = increment(xpGain);
    }

    let useDouble = false;
    if (myItems['item_double'] > 0) {
        if (confirm(`${t.alert_use_double} (Owned: ${myItems['item_double']})`)) {
            useDouble = true;
            updates["items.item_double"] = increment(-1);
        }
    }

    await updateDoc(userDocRef, updates);

    if (coinUnsub) coinUnsub(); 
    coinUnsub = onSnapshot(userDocRef, (docSnapshot) => {
        userCoins = docSnapshot.data().coins || 0;
        updateTopBar(); 
    });

    gameState = { 
        selected: [], found: [], flips: 0, mode, 
        isGameOver: false, level, 
        activeDouble: useDouble
    };
    
    window.switchView('game-view');
    renderSelectionPhase();
}

function updateTopBar() {
    const topBar = document.getElementById('game-top-bar');
    if (!topBar) return;
    const t = window.t;
    
    let prizeLabel = t.current_prize; 
    let prizeValue = gameState.mode.max.toLocaleString();
    if(gameState.activeDouble) {
        prizeValue = (gameState.mode.max * 2).toLocaleString();
    }

    topBar.innerHTML = `
        <div class="coin-info" style="display: flex; flex-direction: column; align-items: flex-start;">
            <div id="back-to-lobby-btn" style="cursor:pointer; margin-bottom: 5px; color: #ffca28; font-size: 0.8rem; font-weight: bold;">
                ← ${t.back_lobby}
            </div>
            <div style="font-size:0.7rem; color:#94a3b8; letter-spacing:1px;">${t.my_coins}</div>
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

function updateTablePrize() {
    const display = document.getElementById('table-current-prize');
    if (!display) return;
    let currentPrize = calculateCurrentPrize();
    if (gameState.activeDouble) currentPrize *= 2;
    display.innerText = currentPrize.toLocaleString();
}

function calculateCurrentPrize() {
    const { mode, flips, level } = gameState;
    if (flips < mode.pick) return mode.max;
    if (level === 1) { 
        if (flips <= 2) return mode.max;
        if (flips === 3) return 166;
        if (flips === 4) return 83;
        if (flips === 5) return 0; 
    }
    return mode.table && mode.table[flips] !== undefined ? mode.table[flips] : 0;
}

function renderSelectionPhase() {
    const header = document.getElementById('game-header');
    const board = document.getElementById('game-board');
    const t = window.t;
    
    header.innerHTML = `<div id="game-top-bar" class="game-top-bar"></div>`;
    updateTopBar();

    // 언어별 어순 처리
    let titleHTML = "";
    if (window.t === window.t.ko) { // 한국어
         titleHTML = `${t.pick_title} <span class="highlight">${gameState.mode.pick}</span>${t.pick_numbers}`;
    } else { // 영어
         titleHTML = `${t.pick_title} <span class="highlight">${gameState.mode.pick}</span> ${t.pick_numbers}`;
    }

    board.innerHTML = `
        <div class="game-room-border section-selection">
            <div class="board-header">
                <h2 class="game-title">${titleHTML}</h2>
            </div>
            <div class="card-grid ${gameState.mode.grid}" id="selection-grid"></div>
            <div class="board-footer" id="selection-footer"></div>
        </div>
    `;

    const selectionGrid = document.getElementById('selection-grid');
    for (let i = 1; i <= gameState.mode.total; i++) {
        const ball = document.createElement('div');
        ball.className = "lotto-ball selection-ball";
        ball.innerHTML = `<div class="ball-number">${i}</div>`;
        
        ball.onclick = () => {
            if (gameState.selected.includes(i) || gameState.selected.length >= gameState.mode.pick) return;
            gameState.selected.push(i);
            ball.classList.add('selected');
            
            if (gameState.selected.length === gameState.mode.pick) {
                renderStartButton();
            }
        };
        selectionGrid.appendChild(ball);
    }
}

function renderStartButton() {
    const footer = document.getElementById('selection-footer');
    if (!footer || footer.innerHTML !== "") return; 
    
    footer.innerHTML = `<button id="btn-start-game" class="neon-btn">${window.t.start_game}</button>`;
    document.getElementById('btn-start-game').addEventListener('click', renderPlayPhase);
}

export function renderPlayPhase() {
    const board = document.getElementById('game-board');
    const t = window.t;

    board.innerHTML = `
        <div class="game-room-border section-play play-mode">
            <div class="board-header">
                <div id="prize-container" class="in-game-prize-container">
                    <div class="prize-label">${t.game_prize}</div>
                    <div id="table-current-prize" class="prize-value">
                        ${(gameState.activeDouble ? gameState.mode.max * 2 : gameState.mode.max).toLocaleString()}
                    </div>
                </div>
                <div id="target-bar" class="target-container">
                    ${gameState.selected.map(num => `<div id="target-${num}" class="target-ball">${num}</div>`).join('')}
                </div>
            </div>
            <div class="card-grid ${gameState.mode.grid}" id="play-grid"></div>
            <div class="board-footer" id="play-footer"></div>
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
                <div class="ball-face ball-front"></div>
                <div class="ball-face ball-back"><div class="ball-number">${num}</div></div>
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
    let prize = calculateCurrentPrize();
    
    if (gameState.activeDouble) prize *= 2;
    
    if (prize >= 10000) {
        const username = window.lotGoAuth.currentUser.email.split('@')[0];
        TickerManager.addMessage(`USER ${username} won ${prize.toLocaleString()} C! REAL WINNER! 🏆`, prize >= 1000000);
    }

    const cost = gameState.mode.cost;
    if (prize > 0) {
        const userDocRef = doc(window.lotGoDb, "users", window.lotGoAuth.currentUser.uid);
        await updateDoc(userDocRef, { coins: increment(prize) });
    }
    
    const t = window.t;
    let resultTitle = "", statusClass = "";
    if (prize > cost) { resultTitle = t.big_win; statusClass = "win-gold"; } 
    else if (prize === cost) { resultTitle = t.safe; statusClass = "win-silver"; } 
    else if (prize > 0) { resultTitle = t.almost; statusClass = "win-bronze"; } 
    else { resultTitle = t.unlucky; statusClass = "win-fail"; }
    
    showResultOnBoard(resultTitle, prize, statusClass);
}

function handleGameOver() {
    gameState.isGameOver = true;
    let prize = calculateCurrentPrize();
    if (gameState.activeDouble) prize *= 2;
    const t = window.t;

    if (prize > 0) handleGameWin();
    else showResultOnBoard(t.game_over, 0, "win-fail");
}

function showResultOnBoard(message, prize, statusClass) {
    const prizeContainer = document.getElementById('prize-container');
    const t = window.t;

    if (prizeContainer) {
        prizeContainer.innerHTML = `
            <div class="result-box ${statusClass}">
                <div class="result-msg">${message}</div>
                <div class="final-prize">Total: <span class="highlight">${prize.toLocaleString()} C</span></div>
            </div>
        `;
        prizeContainer.style.background = "transparent";
        prizeContainer.style.border = "none";
        prizeContainer.style.boxShadow = "none";
    }

    const footer = document.getElementById('play-footer');
    if (footer) {
        footer.innerHTML = `
            <div class="result-actions" style="display: flex; gap: 20px; justify-content: center;">
                <button class="neon-btn success" onclick="initSingleGame(${gameState.level})">${t.replay}</button>
                <button id="end-lobby-btn" class="neon-btn primary">${t.lobby_btn}</button>
            </div>
        `;
        
        const lobbyBtn = document.getElementById('end-lobby-btn');
        if(lobbyBtn) lobbyBtn.onclick = goBackToLobby;
    }
}

// Window 등록
window.initSingleGame = initSingleGame;
window.handleWatchAd = handleWatchAd;
