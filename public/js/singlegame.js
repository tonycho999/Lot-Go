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
        <button class="link-btn" onclick="location.reload()" style="margin-bottom:15px; color:#94a3b8;">← BACK TO LOBBY</button>
        <h3 style="color: #6366f1; margin:0;">PICK ${gameState.mode.pick} NUMBERS</h3>`;
    
    board.className = "card-grid grid-easy";
    board.innerHTML = "";

    for (let i = 1; i <= gameState.mode.total; i++) {
        const card = document.createElement('div');
        card.className = "card";
        card.innerText = i;
        card.onclick = () => {
            if (gameState.selected.includes(i) || gameState.selected.length >= gameState.mode.pick) return;
            gameState.selected.push(i);
            card.style.background = "#6366f1";
            
            if (gameState.selected.length === gameState.mode.pick) {
                const startBtn = document.createElement('button');
                startBtn.className = "main-btn";
                startBtn.style.marginTop = "20px";
                startBtn.innerText = "START GAME (SHUFFLE)";
                startBtn.onclick = renderPlayPhase;
                board.appendChild(startBtn);
            }
        };
        board.appendChild(card);
    }
}

/**
 * 4. 실시간 상금 계산기 (핵심 로직)
 */
function calculateCurrentPrize() {
    const { mode, flips, level } = gameState;
    
    // 마지막 카드는 무조건 0원
    if (flips === mode.total) return 0;

    // 1단계: EASY (2/5) 수동 감쇄
    if (level === 1) {
        if (flips <= 2) return 500;
        if (flips === 3) return 200;
        if (flips === 4) return 50;
    }

    // 2단계: NORMAL (4/10) - 5장째 20% 폭락, 이후 30% 잔존
    if (level === 2) {
        if (flips <= 4) return 100000;
        if (flips === 5) return 20000; // 100,000의 20%
        
        let prize = 20000;
        for (let i = 6; i <= flips; i++) {
            prize = Math.floor(prize * 0.3); // 이전 상금의 30%만 남음
        }
        return prize;
    }

    // 3단계: HARD (6/20) - 7장째 20% 폭락, 이후 30% 잔존
    if (level === 3) {
        if (flips <= 6) return 100000000;
        if (flips === 7) return 20000000; // 100,000,000의 20%
        
        let prize = 20000000;
        for (let i = 8; i <= flips; i++) {
            prize = Math.floor(prize * 0.3); // 이전 상금의 30%만 남음
        }
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

    header.innerHTML = `
        <div style="margin-bottom: 10px;">
            <small style="color:#94a3b8;">CURRENT PRIZE</small>
            <div id="live-prize" style="font-size:24px; color:#fbbf24; font-weight:900;">${gameState.mode.max.toLocaleString()}</div>
        </div>
        <div id="target-bar" style="display: flex; gap: 8px; justify-content: center; margin-bottom: 15px;">
            ${gameState.selected.map(num => `<div id="target-${num}" class="card target" style="width:40px; height:40px;">${num}</div>`).join('')}
        </div>`;

    board.className = `card-grid ${gameState.mode.grid}`;
    board.innerHTML = "";

    const shuffled = Array.from({length: gameState.mode.total}, (_, i) => i + 1).sort(() => Math.random() - 0.5);

    shuffled.forEach(num => {
        const card = document.createElement('div');
        card.className = "card hidden";
        card.innerText = "?";
        card.onclick = () => {
            if (gameState.isGameOver || !card.classList.contains('hidden')) return;
            
            gameState.flips++;
            card.className = "card flipped";
            card.innerText = num;

            // 실시간 상금 UI 업데이트
            const livePrizeEl = document.getElementById('live-prize');
            if (livePrizeEl) {
                livePrizeEl.innerText = calculateCurrentPrize().toLocaleString();
            }

            if (gameState.selected.includes(num)) {
                gameState.found.push(num);
                document.getElementById(`target-${num}`).style.background = "#10b981";
                if (gameState.found.length === gameState.mode.pick) handleGameWin();
            } else if (gameState.flips === gameState.mode.total) {
                handleGameOver();
            }
        };
        board.appendChild(card);
    });
}

/**
 * 6. 승리 및 정산
 */
async function handleGameWin() {
    gameState.isGameOver = true;
    const prize = calculateCurrentPrize();

    if (prize > 0) {
        const userDocRef = doc(window.lotGoDb, "users", window.lotGoAuth.currentUser.uid);
        await updateDoc(userDocRef, { coins: increment(prize) });
    }
    showResultButtons(`MATCH! WINNER PRIZE: ${prize.toLocaleString()} C`);
}

/**
 * 7. 게임 오버
 */
function handleGameOver() {
    gameState.isGameOver = true;
    showResultButtons("GAME OVER! NO PRIZE.");
}

/**
 * 8. 결과 버튼 표시
 */
function showResultButtons(message) {
    const header = document.getElementById('game-header');
    header.innerHTML = `<h3 style="color:#fbbf24;">${message}</h3>`;
    const board = document.getElementById('game-board');
    board.innerHTML = `
        <button class="main-btn" onclick="initSingleGame(${gameState.level}, window.lotGoAuth, window.lotGoDb)" style="background:#10b981; margin-bottom:10px;">PLAY AGAIN</button>
        <button class="main-btn" onclick="location.reload()" style="background:#6366f1;">BACK TO LOBBY</button>`;
}
