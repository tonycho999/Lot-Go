import { getDatabase, ref, get, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const db = getDatabase();

export const GAME_MODES = {
    1: { name: 'EASY', total: 5, pick: 2, cost: 100, max: 400, cols: 2, bonusLimit: 4, bonus: 50 },
    2: { name: 'NORMAL', total: 10, pick: 4, cost: 200, max: 30000, cols: 5, bonusLimit: 9, bonus: 100 },
    3: { name: 'HARD', total: 20, pick: 6, cost: 500, max: 12000000, cols: 5, bonusLimit: 19, bonus: 200 }
};

let gameState = {
    openCount: 0,
    winningCards: [],
    isFinished: false
};

export async function initGame(modeLevel, user) {
    const mode = GAME_MODES[modeLevel];
    
    // 코인 차감 로직
    const userRef = ref(db, `users/${user.uid}/coins`);
    const snapshot = await get(userRef);
    let currentCoins = snapshot.val() || 0;

    if (currentCoins < mode.cost) {
        alert("코인이 부족합니다!");
        window.switchView('lobby-view');
        return;
    }
    await set(userRef, currentCoins - mode.cost);

    // 게임 판 초기화
    gameState = {
        openCount: 0,
        winningCards: Array.from({length: mode.total}, (_, i) => i + 1)
                           .sort(() => Math.random() - 0.5)
                           .slice(0, mode.pick),
        isFinished: false
    };

    renderBoard(mode, user);
}

function renderBoard(mode, user) {
    const board = document.getElementById('game-board');
    board.innerHTML = '';
    board.style.display = 'grid';
    board.style.gridTemplateColumns = `repeat(${mode.cols}, 1fr)`;
    board.style.gap = '10px';

    for (let i = 1; i <= mode.total; i++) {
        const card = document.createElement('div');
        card.className = 'card hidden';
        card.innerText = '?';
        card.onclick = () => handleCardClick(card, i, mode, user);
        board.appendChild(card);
    }
}

async function handleCardClick(el, num, mode, user) {
    if (gameState.isFinished || !el.classList.contains('hidden')) return;

    gameState.openCount++;
    el.classList.remove('hidden');
    el.classList.add('flipped');
    el.innerText = num;

    // 1. 당첨 시 (상금 감소 로직 적용)
    if (gameState.winningCards.includes(num)) {
        gameState.isFinished = true;
        let prize = Math.floor(mode.max / gameState.openCount);
        
        // 마지막 카드일 경우 상금 0
        if (gameState.openCount === mode.total) prize = 0;

        alert(`${gameState.openCount}번째 당첨! 상금 ${prize} 지급!`);
        await addCoins(user.uid, prize);
        window.switchView('lobby-view');
    } 
    // 2. 보너스 체크 (당첨 안됐을 때 특정 횟수 오픈 시)
    else if (gameState.openCount === mode.bonusLimit) {
        alert(`보너스 달성! ${mode.bonus} 코인 지급!`);
        await addCoins(user.uid, mode.bonus);
    }
    // 3. 꽝인데 마지막 카드인 경우
    else if (gameState.openCount === mode.total) {
        alert("게임 종료! 상금이 없습니다.");
        window.switchView('lobby-view');
    }
}

async function addCoins(uid, amount) {
    const userRef = ref(db, `users/${uid}/coins`);
    const snapshot = await get(userRef);
    await set(userRef, (snapshot.val() || 0) + amount);
}
