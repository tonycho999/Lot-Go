import { doc, getDoc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 1. 스크린샷 기반 정밀 상금 데이터 (Lookup Table 방식)
export const SINGLE_MODES = {
    1: { 
        name: 'EASY', pick: 2, total: 5, cost: 100, max: 500, grid: 'grid-easy',
        table: { 2: 500, 3: 166, 4: 83, 5: 0 } 
    },
    2: { 
        name: 'NORMAL', pick: 4, total: 10, cost: 200, max: 10000, grid: 'grid-normal',
        table: { 4: 10000, 5: 2000, 6: 666, 7: 285, 8: 142, 9: 79, 10: 0 }
    },
    3: { 
        name: 'HARD', pick: 6, total: 20, cost: 500, max: 10000000, grid: 'grid-hard',
        table: { 
            6: 10000000, 7: 1428570, 8: 357140, 9: 119040, 10: 47610, 
            11: 21640, 12: 10820, 13: 5820, 14: 3330, 15: 1990, 
            16: 1249, 17: 808, 18: 539, 19: 369, 20: 0 
        }
    }
};

// 광고 설정
const AD_CONFIG = {
    COOLDOWN: 10 * 60 * 1000, // 10분
    MAX_DAILY: 10, // 하루 10회
    REWARD: 100 // 보상 코인
};

let gameState = { selected: [], found: [], flips: 0, mode: null, isGameOver: false, level: 1 };

/**
 * 1. 싱글 게임 메뉴 렌더링 (+ 광고 버튼)
 */
export async function renderSingleMenu() {
    const container = document.getElementById('single-tab');
    if (!container) return;

    // 유저 광고 정보 확인
    let adBtnState = { disabled: false, text: "📺 WATCH AD (+100 C)", timer: null };
    try {
        const userRef = doc(window.lotGoDb, "users", window.lotGoAuth.currentUser.uid);
        const snap = await getDoc(userRef);
        const data = snap.data();
        const now = Date.now();
        const lastAdDate = data.lastAdDate || "";
        const today = new Date().toISOString().split('T')[0];
        
        // 날짜가 지났으면 카운트 초기화가 필요하지만, 여기선 DB 읽기만 하므로 상태만 체크
        const dailyCount = (lastAdDate === today) ? (data.dailyAdCount || 0) : 0;
        const lastAdTime = data.lastAdTime || 0;

        if (dailyCount >= AD_CONFIG.MAX_DAILY) {
            adBtnState.disabled = true;
            adBtnState.text = "🚫 LIMIT REACHED (10/10)";
        } else if (now - lastAdTime < AD_CONFIG.COOLDOWN) {
            adBtnState.disabled = true;
            const remain = Math.ceil((AD_CONFIG.COOLDOWN - (now - lastAdTime)) / 60000);
            adBtnState.text = `⏳ WAIT ${remain} MIN`;
        }
    } catch (e) { console.error(e); }

    container.innerHTML = `
        <div class="menu-list" style="display: flex; flex-direction: column; gap: 15px; padding: 10px;">
            <button id="ad-btn" class="main-btn" style="background: #8b5cf6; border: 1px dashed #c4b5fd;" 
                ${adBtnState.disabled ? 'disabled' : ''} onclick="handleWatchAd()">
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

/**
 * 광고 시청 로직
 */
window.handleWatchAd = async function() {
    const btn = document.getElementById('ad-btn');
    if (!btn) return;
    
    // 로딩 처리
    btn.disabled = true;
    btn.innerText = "🎬 PLAYING AD...";

    setTimeout(async () => { // 3초 광고 시청 시뮬레이션
        const userRef = doc(window.lotGoDb, "users", window.lotGoAuth.currentUser.uid);
        const now = Date.now();
        const today = new Date().toISOString().split('T')[0];

        try {
            const snap = await getDoc(userRef);
            const data = snap.data();
            const lastAdDate = data.lastAdDate || "";
            let currentCount = (lastAdDate === today) ? (data.dailyAdCount || 0) : 0;

            if (currentCount >= AD_CONFIG.MAX_DAILY) {
                alert("Today's ad limit reached!");
                renderSingleMenu(); // UI 갱신
                return;
            }

            await updateDoc(userRef, {
                coins: increment(AD_CONFIG.REWARD),
                lastAdTime: now,
                dailyAdCount: currentCount + 1,
                lastAdDate: today
            });

            alert(`Reward: +${AD_CONFIG.REWARD} Coins!`);
            renderSingleMenu(); // UI 갱신 (버튼 비활성화 적용)
        } catch (e) {
            console.error("Ad Error", e);
            alert("Error saving reward.");
            btn.disabled = false;
            btn.innerText = "📺 WATCH AD";
        }
    }, 2000);
}

/**
 * 2. 게임 시작 초기화
 */
window.initSingleGame = async function(level) {
    const mode = SINGLE_MODES[level];
    const userDocRef = doc(window.lotGoDb, "users", window.lotGoAuth.currentUser.uid);
    const snap = await getDoc(userDocRef);
    
    if ((snap.data().coins || 0) < mode.cost) return alert("Not enough coins!");

    await updateDoc(userDocRef, { coins: increment(-mode.cost) });
    gameState = { selected: [], found: [], flips: 0, mode, isGameOver: false, level };
    
    window.switchView('game-view');
    renderSelectionPhase();
}

/**
 * 3. 숫자 선택 단계 (EXIT 버튼 삭제됨)
 */
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
    
    board.className = `card-grid grid-easy`; // 선택 때는 쉬운 그리드로 표시
    board.innerHTML = "";

    // START 버튼 컨테이너 미리 생성 (숨김 상태 아님, 동적 추가)
    const btnContainer = document.createElement('div');
    btnContainer.className = "action-area";
    btnContainer.style.marginTop = "20px";
    // board 뒤에 삽입을 위해 임시 저장하지 않고 로직 내에서 처리

    for (let i = 1; i <= gameState.mode.total; i++) {
        const card = document.createElement('div');
        card.className = "card selection-card";
        card.innerHTML = `<span class="card-num">${i}</span>`;
        
        card.onclick = () => {
            if (gameState.selected.includes(i) || gameState.selected.length >= gameState.mode.pick) return;
            gameState.selected.push(i);
            card.classList.add('selected');
            
            // 번호 선택 완료 시 START 버튼 생성
            if (gameState.selected.length === gameState.mode.pick) {
                renderStartButton(board);
            }
        };
        board.appendChild(card);
    }
}

function renderStartButton(boardElement) {
    // 중복 생성 방지
    if (document.getElementById('btn-start-game')) return;

    const btnContainer = document.createElement('div');
    btnContainer.className = "action-area";
    btnContainer.innerHTML = `
        <button id="btn-start-game" class="neon-btn">
            START GAME
        </button>
    `;
    boardElement.after(btnContainer);

    // [버그 수정] 동적 생성된 버튼에 이벤트 리스너 명시적 부착
    document.getElementById('btn-start-game').addEventListener('click', renderPlayPhase);
}

/**
 * 4. 상금 계산기 (테이블 기반)
 */
function calculateCurrentPrize() {
    const { mode, flips } = gameState;
    // 테이블에 정의된 값이 있으면 반환, 없으면 0
    return mode.table[flips] !== undefined ? mode.table[flips] : 0;
}

/**
 * 5. 게임 플레이 단계 (디자인 개선)
 */
window.renderPlayPhase = function() {
    const header = document.getElementById('game-header');
    const board = document.getElementById('game-board');
    const actionArea = document.querySelector('.action-area');
    
    if (actionArea) actionArea.remove();

    // 상금 표시 디자인 강화
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

            // 실시간 상금 업데이트
            const currentPrize = calculateCurrentPrize();
            const livePrizeEl = document.getElementById('live-prize');
            if (livePrizeEl) {
                livePrizeEl.innerText = currentPrize.toLocaleString();
            }

            if (gameState.selected.includes(num)) {
                gameState.found.push(num);
                const targetNode = document.getElementById(`target-${num}`);
                if (targetNode) targetNode.classList.add('found');
                
                if (gameState.found.length === gameState.mode.pick) handleGameWin();
            } else if (gameState.flips === gameState.mode.total) {
                handleGameOver(); // 마지막 장까지 열었을 때
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
        resultTitle = "UNLUCKY! Too many cards flipped.";
        statusClass = "win-fail";
    }

    showResultButtons(resultTitle, prize, statusClass);
}

/**
 * 7. 게임 오버
 */
function handleGameOver() {
    gameState.isGameOver = true;
    const prize = calculateCurrentPrize(); // 마지막 장의 상금 (설정에 따라 0일수도, 아닐수도 있음)
    
    // 마지막 장을 뒤집어서 끝났을 때도 상금이 있으면 지급 (스크린샷 기준)
    if (prize > 0) {
        handleGameWin();
    } else {
        showResultButtons("GAME OVER! Better luck next time.", 0, "win-fail");
    }
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
            <button class="neon-btn success" onclick="initSingleGame(${gameState.level})">PLAY AGAIN</button>
            <button class="neon-btn primary" onclick="location.reload()">LOBBY</button>
        </div>`;
}
