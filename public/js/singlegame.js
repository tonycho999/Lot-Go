import { doc, getDoc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 1. 상금 데이터
export const SINGLE_MODES = {
    1: { 
        name: 'EASY', pick: 2, total: 5, cost: 100, max: 500, grid: 'grid-easy',
        table: { 2: 500, 3: 166, 4: 83, 5: 50 } 
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

const AD_CONFIG = {
    COOLDOWN: 10 * 60 * 1000, 
    MAX_DAILY: 10, 
    REWARD: 100 
};

let gameState = { selected: [], found: [], flips: 0, mode: null, isGameOver: false, level: 1 };

/** * [수정됨] export 추가 
 * 1. 메뉴 렌더링 
 */
export async function renderSingleMenu() {
    const container = document.getElementById('single-tab');
    if (!container) return;

    // UI 전용 (데이터 로딩 없이 기본 UI 먼저 표시)
    let adBtnState = { disabled: false, text: "📺 WATCH AD (+100 C)" };
    
    container.innerHTML = `
        <div class="menu-list" style="display: flex; flex-direction: column; gap: 15px; padding: 10px;">
            <button id="ad-btn" class="main-btn" style="background: #8b5cf6; border: 1px dashed #c4b5fd;" 
                onclick="handleWatchAd()">
                ${adBtnState.text}
            </button>
            <hr style="border-color: #334155; width: 100%; opacity: 0.5;">
            
            <button class="main-btn" style="background: #10b981;" onclick="initSingleGame(1)">
                <div style="font-size:1.1em;">EASY</div>
                <div style="font-size:0.8em; opacity:0.8;">2/5 Match • 100 C</div>
            </button>
            <button class="main-btn" style="background: #3b82f6;" onclick="initSingleGame(2)">
                <div style="font-size:1.1em;">NORMAL</div>
                <div style="font-size:0.8em; opacity:0.8;">4/10 Match • 200 C</div>
            </button>
            <button class="main-btn" style="background: #ef4444;" onclick="initSingleGame(3)">
                <div style="font-size:1.1em;">HARD</div>
                <div style="font-size:0.8em; opacity:0.8;">6/20 Match • 500 C</div>
            </button>
        </div>`;
}

/** * [수정됨] export 추가 
 * 2. 광고 시청 함수
 */
export async function handleWatchAd() {
    const btn = document.getElementById('ad-btn');
    if (!btn) return;
    
    btn.disabled = true;
    btn.innerText = "🎬 PLAYING AD...";

    setTimeout(async () => { 
        const db = window.lotGoDb;
        const auth = window.lotGoAuth;
        const userRef = doc(db, "users", auth.currentUser.uid);
        const now = Date.now();
        const today = new Date().toISOString().split('T')[0];

        try {
            const snap = await getDoc(userRef);
            const data = snap.data();
            const lastAdDate = data.lastAdDate || "";
            let currentCount = (lastAdDate === today) ? (data.dailyAdCount || 0) : 0;

            if (currentCount >= AD_CONFIG.MAX_DAILY) {
                alert("오늘 광고 시청 한도 초과!");
                renderSingleMenu(); 
                return;
            }

            await updateDoc(userRef, {
                coins: increment(AD_CONFIG.REWARD),
                lastAdTime: now,
                dailyAdCount: currentCount + 1,
                lastAdDate: today
            });

            alert(`+${AD_CONFIG.REWARD} 코인 지급 완료!`);
            renderSingleMenu(); 
        } catch (e) {
            console.error("Ad Error", e);
            alert("보상 지급 중 오류 발생");
            btn.disabled = false;
            btn.innerText = "📺 WATCH AD";
        }
    }, 2000);
}

/** * [수정됨] export 추가
 * 3. 게임 초기화 
 */
export async function initSingleGame(level) {
    const db = window.lotGoDb;
    const auth = window.lotGoAuth;

    const mode = SINGLE_MODES[level];
    const userDocRef = doc(db, "users", auth.currentUser.uid);
    const snap = await getDoc(userDocRef);
    
    if ((snap.data().coins || 0) < mode.cost) return alert("Not enough coins!");

    await updateDoc(userDocRef, { coins: increment(-mode.cost) });
    gameState = { selected: [], found: [], flips: 0, mode, isGameOver: false, level };
    
    window.switchView('game-view');
    renderSelectionPhase();
}

// 4. 번호 선택 화면 (내부 함수)
function renderSelectionPhase() {
    const header = document.getElementById('game-header');
    const board = document.getElementById('game-board');
    const existingAction = document.querySelector('.action-area');
    if (existingAction) existingAction.remove();
    
    header.innerHTML = `
        <div class="game-meta">
            <span class="back-link" onclick="location.reload()">← LOBBY</span>
        </div>
        <h2 class="game-title">PICK <span class="highlight">${gameState.mode.pick}</span> NUMBERS</h2>
    `;
    
    board.className = `card-grid grid-easy`;
    board.innerHTML = "";

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
        board.appendChild(card);
    }
}

function renderStartButton(boardElement) {
    if (document.getElementById('btn-start-game')) return;

    const btnContainer = document.createElement('div');
    btnContainer.className = "action-area";
    btnContainer.innerHTML = `
        <button id="btn-start-game" class="neon-btn">
            START GAME
        </button>
    `;
    boardElement.after(btnContainer);
    
    document.getElementById('btn-start-game').addEventListener('click', renderPlayPhase);
}

function calculateCurrentPrize() {
    const { mode, flips } = gameState;
    return mode.table[flips] !== undefined ? mode.table[flips] : 0;
}

/** * [수정됨] export 추가
 * 5. 게임 플레이 화면 
 */
export function renderPlayPhase() {
    const header = document.getElementById('game-header');
    const board = document.getElementById('game-board');
    const actionArea = document.querySelector('.action-area');
    
    if (actionArea) actionArea.remove();

    header.innerHTML = `
        <div class="prize-panel-wrapper" style="background: rgba(15, 23, 42, 0.8); border: 2px solid #6366f1; border-radius: 15px; padding: 15px; margin-bottom: 20px; box-shadow: 0 0 15px rgba(99, 102, 241, 0.3);">
            <div style="font-size: 12px; color: #94a3b8; letter-spacing: 2px; margin-bottom: 5px;">CURRENT PRIZE</div>
            <div id="live-prize" class="prize-amount" style="font-size: 2.5rem; color: #fbbf24; font-weight: 900; text-shadow: 0 0 10px rgba(251, 191, 36, 0.5);">${gameState.mode.max.toLocaleString()}</div>
        </div>
        <div id="target-bar" class="target-container">
            ${gameState.selected.map(num => `<div id="target-${num}" class="card target-node">${num}</div>`).join('')}
        </div>`;

    board.className = `card-grid ${gameState.mode.grid}`;
    board.innerHTML = "";

    const shuffled = Array.from({length: gameState.mode.total}, (_, i) => i + 1).sort(() => Math.random() - 0.5);

    shuffled.forEach(num => {
        const card = document.createElement('div');
        card.className = "card hidden-card";
        card.innerText = "?";
        
        card.onclick = () => {
            if (gameState.isGameOver || !card.classList.contains('hidden-card')) return;
            
            gameState.flips++;
            card.className = "card flipped-card";
            card.innerText = num;

            const currentPrize = calculateCurrentPrize();
            const livePrizeEl = document.getElementById('live-prize');
            if (livePrizeEl) livePrizeEl.innerText = currentPrize.toLocaleString();

            if (gameState.selected.includes(num)) {
                gameState.found.push(num);
                const targetNode = document.getElementById(`target-${num}`);
                if (targetNode) targetNode.classList.add('found');
                
                if (gameState.found.length === gameState.mode.pick) handleGameWin();
            } else if (gameState.flips === gameState.mode.total) {
                handleGameOver();
            }
        };
        board.appendChild(card);
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

    if (prize > cost) {
        resultTitle = `✨ BIG WIN! +${(prize - cost).toLocaleString()} C Profit ✨`;
        statusClass = "win-gold";
    } else if (prize === cost) {
        resultTitle = "SAFE! You got your coins back.";
        statusClass = "win-silver";
    } else if (prize > 0) {
        resultTitle = `ALMOST! But you lost ${(cost - prize).toLocaleString()} C...`;
        statusClass = "win-bronze";
    } else {
        resultTitle = "UNLUCKY! Too many cards flipped.";
        statusClass = "win-fail";
    }

    showResultButtons(resultTitle, prize, statusClass);
}

function handleGameOver() {
    gameState.isGameOver = true;
    const prize = calculateCurrentPrize();
    if (prize > 0) handleGameWin();
    else showResultButtons("GAME OVER! Better luck next time.", 0, "win-fail");
}

function showResultButtons(message, prize, statusClass) {
    const header = document.getElementById('game-header');
    header.innerHTML = `
        <div class="result-container ${statusClass}">
            <h2 class="result-msg">${message}</h2>
            <div class="final-prize">Total Received: ${prize.toLocaleString()} C</div>
        </div>`;
    const board = document.getElementById('game-board');
    board.innerHTML = `
        <div class="result-actions">
            <button class="neon-btn success" onclick="initSingleGame(${gameState.level})">PLAY AGAIN</button>
            <button class="neon-btn primary" onclick="location.reload()">LOBBY</button>
        </div>`;
}
