import { doc, getDoc, updateDoc, increment, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 1. 게임 모드 설정 (상금 테이블 포함)
export const SINGLE_MODES = {
    1: { 
        name: 'EASY', pick: 2, total: 5, cost: 100, max: 500, grid: 'grid-easy',
        // Easy는 단순해서 테이블이 없지만 가짜 당첨용으로 500 추가
        prizes: [500, 100] 
    },
    2: { 
        name: 'NORMAL', pick: 4, total: 10, cost: 200, max: 10000, grid: 'grid-normal', 
        table: { 4: 10000, 5: 2000, 6: 666, 7: 285, 8: 142, 9: 79, 10: 0 },
        prizes: [10000, 2000, 666, 285] // 가짜 당첨에 쓸 후보군
    },
    3: { 
        name: 'HARD', pick: 6, total: 20, cost: 500, max: 10000000, grid: 'grid-hard', 
        table: { 6: 10000000, 7: 1428570, 8: 357140, 9: 119040, 10: 47610, 11: 21640, 12: 10820 },
        prizes: [10000000, 1428570, 357140, 119040, 47610] // 가짜 당첨 후보군
    }
};

let gameState = { selected: [], found: [], flips: 0, mode: null, isGameOver: false, level: 1, usedHint: false, activeDouble: false };
let userCoins = 0; 
let coinUnsub = null;

// ==============================================
// [UPGRADED] 실시간 당첨자 티커(Ticker) 시스템
// ==============================================
const TickerManager = {
    queue: [],
    isAnimating: false,
    timer: null,

    // 가짜 닉네임 생성기
    generateFakeUser: function() {
        const adjs = ['Lucky', 'Golden', 'Super', 'Mega', 'Happy', 'Rich', 'Cool', 'Fast', 'Neon', 'Cyber'];
        const nouns = ['Tiger', 'Dragon', 'Winner', 'Star', 'King', 'Queen', 'Lion', 'Player', 'Master', 'Ghost'];
        const adj = adjs[Math.floor(Math.random() * adjs.length)];
        const noun = nouns[Math.floor(Math.random() * nouns.length)];
        const num = Math.floor(Math.random() * 999);
        return `${adj}${noun}${num}`;
    },

    // 실제 게임 상금 중 하나 뽑기
    getRandomRealPrize: function() {
        // Normal(2)과 Hard(3) 모드의 상금 풀에서 랜덤 선택
        const modeKey = Math.random() > 0.5 ? 2 : 3; 
        const prizes = SINGLE_MODES[modeKey].prizes;
        return prizes[Math.floor(Math.random() * prizes.length)];
    },

    init: function() {
        if(this.timer) clearTimeout(this.timer);
        this.queue = [];
        this.isAnimating = false;
        this.loopFakeMessages();
    },

    loopFakeMessages: function() {
        const randomTime = Math.floor(Math.random() * (20000 - 5000 + 1)) + 5000; // 5초 ~ 20초 간격
        
        this.timer = setTimeout(() => {
            if (!document.getElementById('ticker-bar')) return;

            const user = this.generateFakeUser();
            const prize = this.getRandomRealPrize();
            
            // 잭팟 여부 확인 (100만 이상)
            const isJackpot = prize >= 1000000;
            
            let msg = `${user} won ${prize.toLocaleString()} C!`;
            if (isJackpot) {
                msg = `🚨 JACKPOT!! ${user} hit ${prize.toLocaleString()} C! 🚨`;
            }

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
        if (!tickerBar) return;

        this.isAnimating = true;
        const item = this.queue.shift();
        
        tickerBar.innerText = item.text;
        
        // 클래스 초기화 및 잭팟 스타일 적용
        tickerBar.className = 'ticker-text'; 
        if (item.isJackpot) {
            tickerBar.classList.add('ticker-jackpot'); // CSS에서 스타일 정의 필요
        }

        // 애니메이션 재시작 트릭
        tickerBar.classList.remove('ticker-anim');
        void tickerBar.offsetWidth; 
        tickerBar.classList.add('ticker-anim');

        const onEnd = () => {
            this.isAnimating = false;
            tickerBar.removeEventListener('animationend', onEnd);
            this.playNext();
        };
        tickerBar.addEventListener('animationend', onEnd);
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

// 메뉴 렌더링
export async function renderSingleMenu() {
    const container = document.getElementById('single-tab');
    if (!container) return;
    
    container.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; width: 100%;">
            <div class="menu-list" style="display: flex; flex-direction: column; gap: 20px; width: 100%; max-width: 400px; padding: 20px;">
                
                <div class="ticker-container">
                    <div id="ticker-bar" class="ticker-text">Welcome to Lot-Go! Win Big!</div>
                </div>

                <button id="ad-btn" class="main-btn ad-btn-style" onclick="handleWatchAd()">📺 WATCH AD (+300 C)</button>
                
                <div class="divider" style="width:100%; border-bottom:1px solid rgba(255,255,255,0.1); margin:10px 0;"></div>
                
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
            </div>
        </div>`;

    TickerManager.init();
}

export async function handleWatchAd() { alert("광고 기능 준비 중입니다."); }

export async function initSingleGame(level) {
    TickerManager.stop(); 

    const db = window.lotGoDb;
    const auth = window.lotGoAuth;
    const mode = SINGLE_MODES[level];
    const userDocRef = doc(db, "users", auth.currentUser.uid);
    
    // 아이템 및 코인 체크
    const snap = await getDoc(userDocRef);
    if (!snap.exists()) return alert("User data not found.");
    
    const userData = snap.data();
    const currentCoins = userData.coins || 0;
    const myItems = userData.items || {};
    userCoins = currentCoins; 

    if (currentCoins < mode.cost) return alert(`Not enough coins! Need ${mode.cost} C.`);

    // 더블 아이템 자동 사용 여부 확인
    let useDouble = false;
    if (myItems['item_double'] > 0) {
        if (confirm(`Use 'x2 Double Prize' item? (Owned: ${myItems['item_double']})`)) {
            useDouble = true;
            await updateDoc(userDocRef, { 
                coins: increment(-mode.cost),
                "items.item_double": increment(-1)
            });
        } else {
            await updateDoc(userDocRef, { coins: increment(-mode.cost) });
        }
    } else {
        await updateDoc(userDocRef, { coins: increment(-mode.cost) });
    }

    if (coinUnsub) coinUnsub(); 
    coinUnsub = onSnapshot(userDocRef, (docSnapshot) => {
        userCoins = docSnapshot.data().coins || 0;
        updateTopBar(); 
    });

    gameState = { 
        selected: [], found: [], flips: 0, mode, 
        isGameOver: false, level, 
        usedHint: false,
        activeDouble: useDouble
    };
    
    window.switchView('game-view');
    renderSelectionPhase();
}

function updateTopBar() {
    const topBar = document.getElementById('game-top-bar');
    if (!topBar) return;
    
    let prizeLabel = "MAX PRIZE";
    let prizeValue = gameState.mode.max.toLocaleString();
    if(gameState.activeDouble) {
        prizeLabel = "MAX PRIZE (x2)";
        prizeValue = (gameState.mode.max * 2).toLocaleString();
    }

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

function updateTablePrize() {
    const display = document.getElementById('table-current-prize');
    if (!display) return;
    let currentPrize = calculateCurrentPrize();
    
    // 더블 아이템 적용된 표시
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
    
    header.innerHTML = `<div id="game-top-bar" class="game-top-bar"></div>`;
    updateTopBar();

    board.innerHTML = `
        <div class="game-room-border section-selection">
            <div class="board-header">
                <h2 class="game-title">PICK <span class="highlight">${gameState.mode.pick}</span> NUMBERS</h2>
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
    
    footer.innerHTML = `<button id="btn-start-game" class="neon-btn">START GAME</button>`;
    document.getElementById('btn-start-game').addEventListener('click', renderPlayPhase);
}

// 힌트 사용 (Window 등록)
window.useHintItem = async () => {
    if (gameState.isGameOver) return;
    
    const db = window.lotGoDb;
    const auth = window.lotGoAuth;
    const userDocRef = doc(db, "users", auth.currentUser.uid);
    const snap = await getDoc(userDocRef);
    const count = snap.data().items?.['item_hint'] || 0;

    if (count <= 0) return alert("No Hint items!");

    const hiddenTargets = gameState.selected.filter(num => !gameState.found.includes(num));
    if (hiddenTargets.length === 0) return alert("Nothing to reveal!");

    await updateDoc(userDocRef, { "items.item_hint": increment(-1) });
    
    const target = hiddenTargets[0];
    const allBalls = document.querySelectorAll('.ball-number');
    let targetEl = null;
    allBalls.forEach(el => {
        if (parseInt(el.innerText) === target) targetEl = el.closest('.ball-wrapper');
    });

    if (targetEl && !targetEl.classList.contains('flipped')) {
        targetEl.click();
        
        // 버튼 텍스트 갱신
        const btn = document.getElementById('btn-use-hint');
        if(btn) btn.innerHTML = `🔮 HINT (${count - 1})`;
    }
};

export function renderPlayPhase() {
    const board = document.getElementById('game-board');

    board.innerHTML = `
        <div class="game-room-border section-play play-mode">
            <div class="board-header">
                <div id="prize-container" class="in-game-prize-container">
                    <div class="prize-label">CURRENT PRIZE</div>
                    <div id="table-current-prize" class="prize-value">
                        ${(gameState.activeDouble ? gameState.mode.max * 2 : gameState.mode.max).toLocaleString()}
                    </div>
                </div>
                <div id="target-bar" class="target-container">
                    ${gameState.selected.map(num => `<div id="target-${num}" class="target-ball">${num}</div>`).join('')}
                </div>
            </div>
            <div class="card-grid ${gameState.mode.grid}" id="play-grid"></div>
            <div class="board-footer" id="play-footer">
                </div>
        </div>
    `;
    updateTopBar(); 

    // 힌트 버튼 추가
    const footer = document.getElementById('play-footer');
    footer.innerHTML += `
        <button id="btn-use-hint" class="neon-btn secondary" onclick="useHintItem()" style="margin-top:10px; font-size:1rem; padding:10px 20px;">
            🔮 HINT
        </button>
    `;

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
    
    // 더블 아이템 적용
    if (gameState.activeDouble) prize *= 2;
    
    // [NEW] 10,000 이상 진짜 당첨 시 티커에 추가
    if (prize >= 10000) {
        const username = window.lotGoAuth.currentUser.email.split('@')[0]; // 혹은 저장된 username 사용
        TickerManager.addMessage(`USER ${username} won ${prize.toLocaleString()} C! REAL WINNER! 🏆`, prize >= 1000000);
    }

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
    let prize = calculateCurrentPrize();
    if (gameState.activeDouble) prize *= 2;

    if (prize > 0) handleGameWin();
    else showResultOnBoard("GAME OVER!", 0, "win-fail");
}

function showResultOnBoard(message, prize, statusClass) {
    const prizeContainer = document.getElementById('prize-container');
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
                <button class="neon-btn success" onclick="initSingleGame(${gameState.level})">🔄 REPLAY</button>
                <button id="end-lobby-btn" class="neon-btn primary">🏠 LOBBY</button>
            </div>
        `;
        
        const lobbyBtn = document.getElementById('end-lobby-btn');
        if(lobbyBtn) lobbyBtn.onclick = goBackToLobby;
    }
}

// [핵심] 모듈 밖에서도 버튼이 작동하도록 window 객체에 등록
window.initSingleGame = initSingleGame;
window.handleWatchAd = handleWatchAd;
window.useHintItem = useHintItem;
