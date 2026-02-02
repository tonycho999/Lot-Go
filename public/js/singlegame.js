import { doc, getDoc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 게임 난이도별 설정값
export const SINGLE_MODES = {
    1: { name: 'EASY', pick: 2, total: 5, cost: 100, max: 500, bonusLimit: 9, bonus: 50, grid: 'grid-easy' },
    2: { name: 'NORMAL', pick: 4, total: 10, cost: 200, max: 30000, bonusLimit: 9, bonus: 100, grid: 'grid-normal' },
    3: { name: 'HARD', pick: 6, total: 20, cost: 500, max: 12000000, bonusLimit: 19, bonus: 200, grid: 'grid-hard' }
};

let gameState = {
    selected: [],
    found: [],
    flips: 0,
    mode: null,
    isGameOver: false
};

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
        </div>
    `;
}

/**
 * 2. 게임 시작 초기화 (Firestore 코인 차감)
 */
export async function initSingleGame(level, auth, db) {
    const mode = SINGLE_MODES[level];
    const user = auth.currentUser;
    const userDocRef = doc(db, "users", user.uid);

    try {
        const snap = await getDoc(userDocRef);
        if (!snap.exists()) return alert("User data not found.");
        
        const currentCoins = snap.data().coins || 0;

        if (currentCoins < mode.cost) {
            alert("Not enough coins!");
            return;
        }

        // [수정] Firestore increment를 사용한 코인 차감
        await updateDoc(userDocRef, {
            coins: increment(-mode.cost)
        });
        
        gameState = { selected: [], found: [], flips: 0, mode, isGameOver: false };
        window.switchView('game-view');
        renderSelectionPhase();
    } catch (err) {
        console.error("Game Start Error:", err);
        alert("Failed to start game.");
    }
}

/**
 * 3. 숫자 선택 단계 (Selection Phase)
 */
function renderSelectionPhase() {
    const header = document.getElementById('game-header');
    const board = document.getElementById('game-board');

    header.innerHTML = `<h3 style="color: #6366f1;">PICK ${gameState.mode.pick} NUMBERS</h3>`;
    board.className = "card-grid grid-easy";
    board.innerHTML = "";

    for (let i = 1; i <= gameState.mode.total; i++) {
        const card = document.createElement('div');
        card.className = "card";
        card.innerText = i;
        card.onclick = () => {
            if (gameState.selected.includes(i)) return;
            if (gameState.selected.length < gameState.mode.pick) {
                gameState.selected.push(i);
                card.style.background = "#6366f1";
                card.style.color = "white";
                
                if (gameState.selected.length === gameState.mode.pick) {
                    setTimeout(renderPlayPhase, 600);
                }
            }
        };
        board.appendChild(card);
    }
}

/**
 * 4. 메인 게임 단계 (Play Phase)
 */
function renderPlayPhase() {
    const header = document.getElementById('game-header');
    const board = document.getElementById('game-board');

    header.innerHTML = `
        <div id="target-bar" style="display: flex; gap: 8px; justify-content: center; margin-bottom: 15px;">
            ${gameState.selected.map(num => `
                <div id="target-${num}" class="card target" style="width: 40px; height: 40px; font-size: 12px; background: #334155;">
                    ${num}
                </div>
            `).join('')}
        </div>
    `;

    board.className = `card-grid ${gameState.mode.grid}`;
    board.innerHTML = "";

    const shuffled = Array.from({length: gameState.mode.total}, (_, i) => i + 1)
                          .sort(() => Math.random() - 0.5);

    shuffled.forEach(num => {
        const card = document.createElement('div');
        card.className = "card hidden";
        card.innerText = "?";
        
        card.onclick = async () => {
            if (gameState.isGameOver || !card.classList.contains('hidden')) return;

            gameState.flips++;
            card.className = "card flipped";
            card.innerText = num;

            if (gameState.selected.includes(num)) {
                gameState.found.push(num);
                const targetEl = document.getElementById(`target-${num}`);
                if (targetEl) targetEl.style.background = "#10b981";

                if (gameState.found.length === gameState.mode.pick) {
                    gameState.isGameOver = true;
                    handleGameWin();
                }
            } else if (gameState.flips === gameState.mode.total) {
                gameState.isGameOver = true;
                alert("Game Over! All cards opened.");
                window.switchView('lobby-view');
            }
            
            checkBonusReward();
        };
        board.appendChild(card);
    });
}

/**
 * 5. 당첨 및 상금 정산 (Firestore 코인 지급)
 */
async function handleGameWin() {
    const { mode, flips } = gameState;
    const db = window.lotGoDb;
    const user = window.lotGoAuth.currentUser;
    const userDocRef = doc(db, "users", user.uid);

    let prize = (flips === mode.total) ? 0 : Math.floor(mode.max / flips);

    alert(`MATCH COMPLETE!\nFlips: ${flips}\nPrize: ${prize.toLocaleString()} COINS`);

    if (prize > 0) {
        try {
            // [수정] Firestore increment를 사용한 상금 지급
            await updateDoc(userDocRef, {
                coins: increment(prize)
            });
        } catch (err) {
            console.error("Prize payout error:", err);
        }
    }
    
    window.switchView('lobby-view');
}

/**
 * 6. 보너스 보상 체크 (Firestore 보너스 지급)
 */
async function checkBonusReward() {
    if (gameState.flips === gameState.mode.bonusLimit) {
        const bonus = gameState.mode.bonus;
        alert(`BONUS! Opened ${gameState.mode.bonusLimit} cards. \nReceived ${bonus} COINS!`);
        
        const db = window.lotGoDb;
        const user = window.lotGoAuth.currentUser;
        const userDocRef = doc(db, "users", user.uid);

        try {
            await updateDoc(userDocRef, {
                coins: increment(bonus)
            });
        } catch (err) {
            console.error("Bonus payout error:", err);
        }
    }
}
