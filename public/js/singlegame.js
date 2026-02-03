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

// Ticker (간단 버전)
const TickerManager = {
    stop: function() { /* 필요 시 구현 */ }
};

// [A] 로비로 돌아가기
function goBackToLobby() {
    if (coinUnsub) coinUnsub();
    window.switchView('lobby-view');
    renderSingleMenu();
}

// [B] 싱글 메뉴 렌더링
export async function renderSingleMenu() {
    const container = document.getElementById('single-tab');
    if (!container) return;
    const t = window.t || {}; 

    container.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; width: 100%;">
            <div class="menu-list" style="display: flex; flex-direction: column; gap: 20px; width: 100%; max-width: 400px; padding: 20px;">
                <h2 style="text-align:center; color:#fff; margin-bottom:10px; font-family:'Orbitron';">SINGLE GAME</h2>
                
                <button class="main-btn easy-btn" onclick="initSingleGame(1)">
                    <div class="btn-title">${t.single_menu_easy || "EASY"}</div>
                    <div class="btn-desc">${t.single_desc_easy || "2/5 Match"}</div>
                </button>
                <button class="main-btn normal-btn" onclick="initSingleGame(2)">
                    <div class="btn-title">${t.single_menu_normal || "NORMAL"}</div>
                    <div class="btn-desc">${t.single_desc_normal || "4/10 Match"}</div>
                </button>
                <button class="main-btn hard-btn" onclick="initSingleGame(3)">
                    <div class="btn-title">${t.single_menu_hard || "HARD"}</div>
                    <div class="btn-desc">${t.single_desc_hard || "6/20 Match"}</div>
                </button>
            </div>
        </div>`;
}

// [C] 게임 초기화 (비용 차감)
export async function initSingleGame(level) {
    const db = window.lotGoDb;
    const auth = window.lotGoAuth;
    const t = window.t || {};
    const mode = SINGLE_MODES[level];
    
    // 유저 데이터 확인
    const userDocRef = doc(db, "users", auth.currentUser.uid);
    const snap = await getDoc(userDocRef);
    if (!snap.exists()) return alert("User data error");
    
    const userData = snap.data();
    const currentCoins = userData.coins || 0;
    
    // 코인 부족 체크
    if (currentCoins < mode.cost) return alert(t.alert_no_coin || "Not enough coins");

    // 코인 차감
    await updateDoc(userDocRef, { coins: increment(-mode.cost) });

    // 실시간 코인 감시
    if (coinUnsub) coinUnsub(); 
    coinUnsub = onSnapshot(userDocRef, (docSnapshot) => {
        userCoins = docSnapshot.data().coins || 0;
        updateTopBar(); 
    });

    // 게임 상태 설정
    gameState = { 
        selected: [], found: [], flips: 0, mode, 
        isGameOver: false, level, activeDouble: false 
    };
    
    window.switchView('game-view');
    renderSelectionPhase();
}

// [D] 상단바 업데이트
function updateTopBar() {
    const topBar = document.getElementById('game-top-bar');
    if (!topBar) return;
    const t = window.t || {};
    
    let prizeValue = gameState.mode.max.toLocaleString();

    topBar.innerHTML = `
        <div style="display:flex; align-items:center; gap:15px;">
            <div id="back-to-lobby-btn" style="cursor:pointer; color: #ffca28; font-weight: bold;">
                ← ${t.lobby_btn || "LOBBY"}
            </div>
            <div style="color:#e2e8f0;">
                <span style="font-size:0.8rem; color:#94a3b8;">${t.my_coins || "COINS"}</span>
                <span style="font-weight:bold;">${userCoins.toLocaleString()}</span>
            </div>
        </div>
        <div style="text-align:right;">
            <div style="font-size:0.7rem; color:#94a3b8;">${t.current_prize || "MAX PRIZE"}</div>
            <div class="highlight" style="font-size:1.2rem;">${prizeValue}</div>
        </div>
    `;
    
    document.getElementById('back-to-lobby-btn').onclick = goBackToLobby;
}

// [E] 번호 선택 화면 그리기 (1단계)
function renderSelectionPhase() {
    const header = document.getElementById('game-header');
    const board = document.getElementById('game-board');
    const t = window.t || {};
    
    header.innerHTML = `<div id="game-top-bar" class="game-top-bar"></div>`;
    updateTopBar();

    // 여기가 핵심: 게임 보드 안에 그리드 생성
    board.innerHTML = `
        <div class="game-room-border">
            <h2 class="game-title">
                ${t.pick_title || "PICK"} <span class="highlight">${gameState.mode.pick}</span>
            </h2>
            <div class="card-grid ${gameState.mode.grid}" id="selection-grid"></div>
            <div id="selection-footer" style="width:100%; margin-top:20px;"></div>
        </div>
    `;

    // 공 생성
    const selectionGrid = document.getElementById('selection-grid');
    for (let i = 1; i <= gameState.mode.total; i++) {
        const ball = document.createElement('div');
        ball.className = "lotto-ball";
        ball.innerText = i;
        
        ball.onclick = () => {
            if (gameState.selected.includes(i)) return; // 이미 선택함
            if (gameState.selected.length >= gameState.mode.pick) return; // 갯수 초과

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
    const t = window.t || {};
    footer.innerHTML = `<button id="btn-start-game" class="neon-btn success">${t.start_game || "START"}</button>`;
    document.getElementById('btn-start-game').onclick = renderPlayPhase;
}

// [F] 플레이 화면 그리기 (2단계 - 결과 확인)
export function renderPlayPhase() {
    const board = document.getElementById('game-board');
    const t = window.t || {};

    board.innerHTML = `
        <div class="game-room-border play-mode">
            <div style="text-align:center; margin-bottom:15px;">
                <div style="font-size:0.8rem; color:#94a3b8;">${t.game_prize || "PRIZE"}</div>
                <div id="table-current-prize" style="font-size:1.8rem; color:#f59e0b; font-weight:bold; font-family:'Orbitron';">
                    ${gameState.mode.max.toLocaleString()}
                </div>
            </div>

            <div class="target-container">
                ${gameState.selected.map(num => `<div id="target-${num}" class="target-ball">${num}</div>`).join('')}
            </div>

            <div class="card-grid ${gameState.mode.grid}" id="play-grid"></div>
            
            <div id="play-footer" style="width:100%; margin-top:20px;"></div>
        </div>
    `;

    const playGrid = document.getElementById('play-grid');
    // 공 섞기
    const shuffled = Array.from({length: gameState.mode.total}, (_, i) => i + 1).sort(() => Math.random() - 0.5);

    shuffled.forEach(num => {
        const ballWrapper = document.createElement('div');
        ballWrapper.className = "ball-wrapper";
        ballWrapper.innerHTML = `
            <div class="ball-inner">
                <div class="ball-face ball-front"></div>
                <div class="ball-face ball-back">${num}</div>
            </div>
        `;
        
        ballWrapper.onclick = () => {
            if (gameState.isGameOver || ballWrapper.classList.contains('flipped')) return;
            
            gameState.flips++;
            ballWrapper.classList.add('flipped'); 
            
            // 당첨금 업데이트 (단순화: 뒤집을수록 줄어드는 로직 등은 table 참조)
            let curPrize = 0;
            if (gameState.mode.table && gameState.mode.table[gameState.flips] !== undefined) {
                curPrize = gameState.mode.table[gameState.flips];
            } else if (gameState.level === 1 && gameState.flips <= 2) {
                curPrize = 500; // EASY 모드 예시
            }
            document.getElementById('table-current-prize').innerText = curPrize.toLocaleString();

            // 찾았는지 확인
            if (gameState.selected.includes(num)) {
                gameState.found.push(num);
                const targetNode = document.getElementById(`target-${num}`);
                if (targetNode) targetNode.classList.add('found');
                
                // 다 찾음 -> 승리
                if (gameState.found.length === gameState.mode.pick) handleGameWin(curPrize);
            } else if (gameState.flips === gameState.mode.total) {
                // 다 뒤집음 -> 패배
                handleGameWin(0);
            }
        };
        playGrid.appendChild(ballWrapper);
    });
}

// [G] 게임 종료 처리
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
            <div style="display: flex; gap: 10px; justify-content: center;">
                <button class="neon-btn success" onclick="initSingleGame(${gameState.level})">${t.replay || "REPLAY"}</button>
                <button id="end-lobby-btn" class="neon-btn primary">${t.lobby_btn || "LOBBY"}</button>
            </div>
        `;
        document.getElementById('end-lobby-btn').onclick = goBackToLobby;
    }
}

// Window 객체에 함수 등록
window.initSingleGame = initSingleGame;
window.handleWatchAd = () => alert("Ad Coming Soon");
