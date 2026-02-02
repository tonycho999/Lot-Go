import { doc, getDoc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 운영자 설정 기반 정밀 상금 구성
export const SINGLE_MODES = {
    1: { name: 'EASY', pick: 2, total: 5, cost: 100, max: 500, grid: 'grid-easy' },
    2: { name: 'NORMAL', pick: 4, total: 10, cost: 200, max: 100000, grid: 'grid-normal' },
    3: { name: 'HARD', pick: 6, total: 20, cost: 500, max: 100000000, grid: 'grid-hard' }
};

let gameState = { selected: [], found: [], flips: 0, mode: null, isGameOver: false, level: 1 };

/**
 * 1. 싱글 게임 메뉴 렌더링
 */
export function renderSingleMenu() {
    const container = document.getElementById('single-tab');
    if (!container) return;
    container.innerHTML = `
        <div class="menu-list" style="display: flex; flex-direction: column; gap: 12px; padding: 10px;">
            <button class="main-btn" style="background: #10b981;" onclick="initSingleGame(1)">EASY (2/5) - 100 C</button>
            <button class="main-btn" style="background: #3b82f6;" onclick="initSingleGame(2)">NORMAL (4/10) - 200 C</button>
            <button class="main-btn" style="background: #ef4444;" onclick="initSingleGame(3)">HARD (6/20) - 500 C</button>
        </div>`;
}

/**
 * 2. 게임 시작 초기화
 */
export async function initSingleGame(level, auth, db) {
    const mode = SINGLE_MODES[level];
    const userDocRef = doc(db, "users", auth.currentUser.uid);
    const snap = await getDoc(userDocRef);
    
    if ((snap.data().coins || 0) < mode.cost) return alert("Not enough coins!");

    await updateDoc(userDocRef, { coins: increment(-mode.cost) });
    gameState = { selected: [], found: [], flips: 0, mode, isGameOver: false, level };
    
    window.switchView('game-view');
    renderSelectionPhase();
}

/**
 * 3. 숫자 선택 단계
 */
function renderSelectionPhase() {
    const header = document.getElementById('game-header');
    const board = document.getElementById('game-board');
    
    header.innerHTML = `
        <div class="game-meta">
            <span class="back-link" onclick="location.reload()">← LOBBY</span>
        </div>
        <h2 class="game-title">PICK <span class="highlight">${gameState.mode.pick}</span> NUMBERS</h2>
    `;
    
    board.className = "card-grid grid-easy";
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
                const existingBtn = document.querySelector('.action-area');
                if (existingBtn) existingBtn.remove();

                const btnContainer = document.createElement('div');
                btnContainer.className = "action-area";
                btnContainer.innerHTML = `
                    <button class="neon-btn" onclick="renderPlayPhase()">
                        START GAME
                    </button>
                `;
                board.after(btnContainer);
            }
        };
        board.appendChild(card);
    }
}

/**
 * 4. 실시간 상금 계산기
 */
function calculateCurrentPrize() {
    const { mode, flips, level } = gameState;
    if (flips === mode.total) return 0;

    if (level === 1) {
        if (flips <= 2) return 500;
        if (flips === 3) return 200;
        if (flips === 4) return 50;
    }

    if (level === 2) {
        if (flips <= 4) return 100000;
        if (flips === 5) return 20000;
        let prize = 20000;
        for (let i = 6; i <= flips; i++) { prize = Math.floor(prize * 0.3); }
        return prize;
    }

    if (level === 3) {
        if (flips <= 6) return 100000000;
        if (flips === 7) return 20000000;
        let prize = 20000000;
        for (let i = 8; i <= flips; i++) { prize = Math.floor(prize * 0.3); }
        return prize;
    }
    return 0;
}

/**
 * 5. 게임 플레이 단계
 */
function renderPlayPhase() {
    const header = document.getElementById('game-header');
    const board = document.getElementById('game-board');
    const actionArea = document.querySelector('.action-area');
    
    if (actionArea) actionArea.remove();

    header.innerHTML = `
        <div class="prize-panel">
            <small>CURRENT PRIZE</small>
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

            const livePrizeEl = document.getElementById('live-prize');
            if (livePrizeEl) {
                livePrizeEl.innerText = calculateCurrentPrize().toLocaleString();
            }

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

/**
 * 6. 승리 및 정산 (감정 텍스트 연출)
 */
async function handleGameWin() {
    gameState.isGameOver = true;
    const prize = calculateCurrentPrize();
    const cost = gameState.mode.cost;

    if (prize > 0) {
        const userDocRef = doc(window.lotGoDb, "users", window.lotGoAuth.currentUser.uid);
        await updateDoc(userDocRef, { coins: increment(prize) });
    }

    let resultTitle = "";
    let statusClass = "";

    if (prize > cost) {
        resultTitle = `✨ BIG WIN! +${(prize - cost).toLocaleString()} C Profit ✨`;
        statusClass = "win-gold";
    } else if (prize === cost) {
        resultTitle = "SAFE! You got your coins back.";
        statusClass = "win-silver";
    } else if (prize > 0 && prize < cost) {
        resultTitle = `ALMOST! But you lost ${(cost - prize).toLocaleString()} C...`;
        statusClass = "win-bronze";
    } else {
        resultTitle = "UNLUCKY! Zero prize on the last card.";
        statusClass = "win-fail";
    }

    showResultButtons(resultTitle, prize, statusClass);
}

/**
 * 7. 게임 오버
 */
function handleGameOver() {
    gameState.isGameOver = true;
    showResultButtons("GAME OVER! Better luck next time.", 0, "win-fail");
}

/**
 * 8. 결과 버튼 표시
 */
function showResultButtons(message, prize, statusClass) {
    const header = document.getElementById('game-header');
    header.innerHTML = `
        <div class="result-container ${statusClass}">
            <h2 class="result-msg">${message}</h2>
            <div class="final-prize">Total Received: ${prize.toLocaleString()} C</div>
        </div>
    `;
    const board = document.getElementById('game-board');
    board.innerHTML = `
        <div class="result-actions">
            <button class="neon-btn success" onclick="initSingleGame(${gameState.level}, window.lotGoAuth, window.lotGoDb)">PLAY AGAIN</button>
            <button class="neon-btn primary" onclick="location.reload()">LOBBY</button>
        </div>`;
}
