import { doc, getDoc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

// [수정] 광고 보상 300 코인으로 변경
const AD_CONFIG = {
    COOLDOWN: 10 * 60 * 1000, // 10분
    MAX_DAILY: 10, 
    REWARD: 300 
};

let gameState = { selected: [], found: [], flips: 0, mode: null, isGameOver: false, level: 1 };

export async function renderSingleMenu() {
    const container = document.getElementById('single-tab');
    if (!container) return;

    // [수정] 버튼 텍스트 가독성 개선 및 300C 반영
    let adBtnState = { disabled: false, text: "📺 WATCH AD (+300 C)" };
    
    // (실제 DB 체크 로직이 필요하다면 여기에 추가)

    container.innerHTML = `
        <div class="menu-list" style="display: flex; flex-direction: column; gap: 15px; padding: 10px;">
            <button id="ad-btn" class="main-btn ad-btn-style" onclick="handleWatchAd()">
                ${adBtnState.text}
            </button>
            
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

export async function handleWatchAd() {
    const btn = document.getElementById('ad-btn');
    if (!btn) return;
    
    btn.disabled = true;
    btn.innerText = "🎬 LOADING...";

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
                alert("오늘 시청 한도(10회)를 초과했습니다.");
                renderSingleMenu(); 
                return;
            }

            await updateDoc(userRef, {
                coins: increment(AD_CONFIG.REWARD),
                lastAdTime: now,
                dailyAdCount: currentCount + 1,
                lastAdDate: today
            });

            alert(`광고 시청 완료! +${AD_CONFIG.REWARD} 코인 지급.`);
            renderSingleMenu(); 
        } catch (e) {
            console.error(e);
            alert("오류가 발생했습니다.");
            btn.disabled = false;
            btn.innerText = "📺 WATCH AD (+300 C)";
        }
    }, 2000);
}

export async function initSingleGame(level) {
    const db = window.lotGoDb;
    const auth = window.lotGoAuth;
    const mode = SINGLE_MODES[level];
    const userDocRef = doc(db, "users", auth.currentUser.uid);
    const snap = await getDoc(userDocRef);
    
    if ((snap.data().coins || 0) < mode.cost) return alert("코인이 부족합니다!");

    await updateDoc(userDocRef, { coins: increment(-mode.cost) });
    gameState = { selected: [], found: [], flips: 0, mode, isGameOver: false, level };
    
    window.switchView('game-view');
    renderSelectionPhase();
}

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
        <button id="btn-start-game" class="neon-btn">START GAME</button>
    `;
    boardElement.after(btnContainer);
    document.getElementById('btn-start-game').addEventListener('click', renderPlayPhase);
}

function calculateCurrentPrize() {
    const { mode, flips } = gameState;
    return mode.table[flips] !== undefined ? mode.table[flips] : 0;
}

export function renderPlayPhase() {
    const header = document.getElementById('game-header');
    const board = document.getElementById('game-board');
    const actionArea = document.querySelector('.action-area');
    
    if (actionArea) actionArea.remove();

    header.innerHTML = `
        <div class="prize-panel-wrapper">
            <div class="prize-label">CURRENT PRIZE</div>
            <div id="live-prize" class="prize-amount">${gameState.mode.max.toLocaleString()}</div>
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
            <div class="final-prize">Received: ${prize.toLocaleString()} C</div>
        </div>`;
    const board = document.getElementById('game-board');
    board.innerHTML = `
        <div class="result-actions">
            <button class="neon-btn success" onclick="initSingleGame(${gameState.level})">PLAY AGAIN</button>
            <button class="neon-btn primary" onclick="location.reload()">LOBBY</button>
        </div>`;
}
