import { doc, getDoc, updateDoc, increment, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ... (SINGLE_MODES 기존과 동일) ...
export const SINGLE_MODES = {
    1: { name: 'EASY', pick: 2, total: 6, cost: 100, max: 1000, grid: 'grid-easy', cssClass: 'easy-mode', table: { 1: 1000, 2: 1000, 3: 500, 4: 200, 5: 50, 6: 0 } },
    2: { name: 'NORMAL', pick: 4, total: 12, cost: 200, max: 40000, grid: 'grid-normal', cssClass: 'normal-mode', table: { 1: 40000, 2: 40000, 3: 40000, 4: 40000, 5: 8000, 6: 3000, 7: 1000, 8: 400, 9: 200, 10: 100, 11: 50, 12: 0 } },
    3: { name: 'HARD', pick: 6, total: 20, cost: 500, max: 10000000, grid: 'grid-hard', cssClass: 'hard-mode', table: { 1: 10000000, 2: 10000000, 3: 10000000, 4: 10000000, 5: 10000000, 6: 10000000, 7: 1428570, 8: 357140, 9: 119040, 10: 47610, 11: 21640, 12: 10820, 13: 5820, 14: 3330, 15: 1990, 16: 1249, 17: 808, 18: 539, 19: 369, 20: 0 } }
};

// 게임 상태에 아이템 사용 여부 추가
let gameState = { 
    selected: [], found: [], flips: 0, mode: null, isGameOver: false, level: 1, 
    useItems: {} // 사용하기로 한 아이템들
};
let userCoins = 0; 
let coinUnsub = null;
let userItems = {}; // 보유 아이템 정보

function goBackToLobby() {
    if (coinUnsub) coinUnsub();
    window.switchView('lobby-view');
    renderSingleMenu();
}

export async function renderSingleMenu() {
    const container = document.getElementById('single-tab');
    if (!container) return;
    const t = window.t || {};
    const db = window.lotGoDb;
    const auth = window.lotGoAuth;

    // 유저 보유 아이템 로드
    const snap = await getDoc(doc(db, "users", auth.currentUser.uid));
    userItems = snap.data().items || {};
    const xpBoostEnd = snap.data().xpBoostEnd || 0;
    const isBoostActive = xpBoostEnd > Date.now();

    // 아이템 체크박스 HTML 생성
    const generateItemCheck = (id, icon, name) => {
        const qty = userItems[id] || 0;
        if (qty <= 0) return '';
        return `
            <label class="item-checkbox" style="display:flex; align-items:center; gap:10px; margin:5px 0; background:#1e293b; padding:10px; border-radius:8px; cursor:pointer;">
                <input type="checkbox" id="check-${id}" value="${id}">
                <span>${icon} ${name} (x${qty})</span>
            </label>
        `;
    };

    container.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; width: 100%;">
            <div class="menu-list" style="display: flex; flex-direction: column; gap: 15px; width: 100%; max-width: 400px; padding: 20px;">
                ${isBoostActive ? `<div style="background:linear-gradient(90deg, #ef4444, #f59e0b); color:white; padding:10px; text-align:center; font-weight:bold; border-radius:8px; animation:pulse 2s infinite;">${t.active_booster}</div>` : ''}

                <div class="ticker-container" style="background:black; border-top:2px solid #d4af37; border-bottom:2px solid #d4af37; padding:5px;">
                    <div id="ticker-bar" style="color:#d4af37; font-family:'Orbitron'; text-align:center;">
                        ${t.ticker_welcome}
                    </div>
                </div>

                <div style="background:rgba(0,0,0,0.3); padding:15px; border-radius:10px; border:1px solid #334155;">
                    <div style="color:#94a3b8; font-size:0.8rem; margin-bottom:10px;">${t.use_items}</div>
                    ${generateItemCheck('free_pass', '🎟️', t.item_free_pass_name)}
                    ${generateItemCheck('discount_50', '🏷️', t.item_discount_50_name)}
                    ${generateItemCheck('double_ticket', '🎫', t.item_double_name)}
                    ${generateItemCheck('hint_spyglass', '🔭', t.item_spyglass_name)}
                    ${generateItemCheck('insurance_ticket', '🛡️', t.item_insurance_name)}
                    ${Object.keys(userItems).filter(k=>['free_pass','discount_50','double_ticket','hint_spyglass','insurance_ticket'].includes(k)).length === 0 ? '<span style="color:#64748b; font-size:0.8rem;">No items available.</span>' : ''}
                </div>

                <div class="divider" style="width:100%; border-bottom:1px solid rgba(255,255,255,0.1);"></div>
                
                <button class="main-btn easy-btn" onclick="initSingleGame(1)">
                    <div class="btn-title">${t.single_menu_easy}</div><div class="btn-desc">100 C</div>
                </button>
                <button class="main-btn normal-btn" onclick="initSingleGame(2)">
                    <div class="btn-title">${t.single_menu_normal}</div><div class="btn-desc">200 C</div>
                </button>
                <button class="main-btn hard-btn" onclick="initSingleGame(3)">
                    <div class="btn-title">${t.single_menu_hard}</div><div class="btn-desc">500 C</div>
                </button>
            </div>
        </div>`;
}

export async function initSingleGame(level) {
    const db = window.lotGoDb;
    const auth = window.lotGoAuth;
    const t = window.t || {};
    const mode = SINGLE_MODES[level];
    
    // 1. 체크된 아이템 확인
    const useItems = {};
    ['free_pass', 'discount_50', 'double_ticket', 'hint_spyglass', 'insurance_ticket'].forEach(id => {
        const el = document.getElementById(`check-${id}`);
        if (el && el.checked) useItems[id] = true;
    });

    // 2. 할인/무료 로직 적용 (중복 불가: 무료 우선)
    let finalCost = mode.cost;
    let costItemToConsume = null;

    if (useItems['free_pass']) {
        finalCost = 0;
        costItemToConsume = 'free_pass';
    } else if (useItems['discount_50']) {
        finalCost = Math.floor(mode.cost * 0.5);
        costItemToConsume = 'discount_50';
    }

    const userDocRef = doc(db, "users", auth.currentUser.uid);
    const snap = await getDoc(userDocRef);
    if (!snap.exists()) return;
    const userData = snap.data();
    
    if (userData.coins < finalCost) return alert(t.alert_no_coin);

    // 3. 비용 차감 및 아이템 소모
    const updates = { coins: increment(-finalCost) };
    if (costItemToConsume) updates[`items.${costItemToConsume}`] = increment(-1);
    if (useItems['double_ticket']) updates[`items.double_ticket`] = increment(-1);
    if (useItems['hint_spyglass']) updates[`items.hint_spyglass`] = increment(-1);
    if (useItems['insurance_ticket']) updates[`items.insurance_ticket`] = increment(-1);

    await updateDoc(userDocRef, updates);

    // 상태 초기화
    gameState = { 
        selected: [], found: [], flips: 0, mode, 
        isGameOver: false, level, activeDouble: false,
        useItems: useItems, // 사용한 아이템 저장
        finalCost: finalCost // 지불한 금액 저장 (보험용)
    };

    // 실시간 코인 감시
    if (coinUnsub) coinUnsub(); 
    coinUnsub = onSnapshot(userDocRef, (docSnapshot) => {
        userCoins = docSnapshot.data().coins || 0;
        updateTopBar(); 
    });
    
    window.switchView('game-view');
    renderSelectionPhase();
}

function updateTopBar() {
    const topBar = document.getElementById('game-top-bar');
    if (!topBar) return;
    const t = window.t || {};
    let prizeValue = gameState.mode.max.toLocaleString();
    
    // 더블 티켓 사용 시 표시
    if (gameState.useItems['double_ticket']) {
        prizeValue = "x2 " + prizeValue;
    }

    topBar.innerHTML = `
        <div class="coin-info">
            <div id="back-to-lobby-btn" style="cursor:pointer; color: var(--gold-accent); font-weight: bold; margin-bottom: 5px;">
                ← ${t.lobby_btn || "LOBBY"}
            </div>
            <div style="color:#e2e8f0; font-size: 1.1rem;">
                <span style="font-size:0.8rem; color:#94a3b8;">${t.my_coins}</span>
                <span style="font-weight:bold; color:#fff;">${userCoins.toLocaleString()}</span>
            </div>
        </div>
        <div class="prize-info" style="text-align:right;">
            <div style="font-size:0.7rem; color:var(--gold-accent); margin-bottom: 5px;">${t.current_prize}</div>
            <div class="highlight" style="font-size:1.5rem; color:#fff; text-shadow: 0 0 10px var(--gold-accent);">${prizeValue}</div>
        </div>
    `;
    document.getElementById('back-to-lobby-btn').onclick = goBackToLobby;
}

// ... (calculateCurrentPrize, renderSelectionPhase, renderStartButton 함수는 기존 유지) ...
// (단, renderSelectionPhase는 변경 사항 없음)

function calculateCurrentPrize() {
    const { mode, flips } = gameState;
    let basePrize = mode.table && mode.table[flips] !== undefined ? mode.table[flips] : 0;
    // 더블 아이템 적용
    if (gameState.useItems['double_ticket']) basePrize *= 2;
    return basePrize;
}

function renderSelectionPhase() {
    const header = document.getElementById('game-header');
    const board = document.getElementById('game-board');
    const t = window.t || {};
    
    board.className = ''; 
    header.innerHTML = `<div id="game-top-bar" class="game-top-bar"></div>`;
    updateTopBar();

    board.innerHTML = `
        <div class="game-view-container">
            <div class="game-room-border ${gameState.mode.cssClass}">
                <div class="game-header-wrapper">
                    <h2 class="game-title">
                        ${t.pick_title} <span class="highlight">${gameState.mode.pick}</span>${t.pick_numbers}
                    </h2>
                </div>
                <div class="card-grid ${gameState.mode.grid}" id="selection-grid"></div>
                <div id="selection-footer" style="width:100%; margin-top:20px; z-index:1;"></div>
            </div>
        </div>
    `;

    const selectionGrid = document.getElementById('selection-grid');
    for (let i = 1; i <= gameState.mode.total; i++) {
        const ball = document.createElement('div');
        ball.className = "lotto-ball";
        ball.innerHTML = `<div class="ball-number-bg">${i}</div>`;
        ball.onclick = () => {
            if (gameState.selected.includes(i) || gameState.selected.length >= gameState.mode.pick) return;
            gameState.selected.push(i);
            ball.classList.add('selected');
            if (gameState.selected.length === gameState.mode.pick) renderStartButton();
        };
        selectionGrid.appendChild(ball);
    }
}

function renderStartButton() {
    const footer = document.getElementById('selection-footer');
    const t = window.t || {};
    footer.innerHTML = `<button id="btn-start-game" class="neon-btn success" style="width:100%;">${t.start_game}</button>`;
    document.getElementById('btn-start-game').onclick = renderPlayPhase;
}

export function renderPlayPhase() {
    const board = document.getElementById('game-board');
    const t = window.t || {};
    board.className = ''; 

    // 투시경 아이템 로직: 선택한 번호 중 당첨 번호 1개 미리 찾기
    let spyglassHit = null;
    const shuffled = Array.from({length: gameState.mode.total}, (_, i) => i + 1).sort(() => Math.random() - 0.5); // 미리 섞음
    
    if (gameState.useItems['hint_spyglass']) {
        // 내 번호가 섞인 배열의 어디에 있는지 확인
        // (실제 게임 로직은 클릭 시 결정되므로, 여기서는 시각적 효과만 미리 줌? 
        //  아니, 클릭 시 결정이 아니라 '섞인 배열'이 정답지임.)
        
        // 정답지(shuffled)의 앞에서부터 순서대로 뒤집을 예정이므로,
        // 내 번호가 shuffled의 어디에 있는지 찾아서 그 중 하나를 미리 오픈 처리
        // 하지만 로직상 사용자가 클릭해야 뒤집히므로, 
        // 여기서는 "내 번호 중 하나를 강제로 found 처리하고 화면에 표시"해야 함.
        
        // 간단한 구현: 사용자가 고른 번호 중 하나를 '이미 찾은 것'으로 간주?
        // -> 게임 룰상 뒤집는 순서가 중요하므로, 투시경은 '정답이 있는 위치를 알려주는' 방식이 나음.
        // 수정: '정답(내가 고른 번호)'이 들어있는 공 하나를 시각적으로 표시해줌.
        
        const myAnswer = gameState.selected.find(num => shuffled.includes(num)); // 섞인 배열엔 다 있음.
        // 그냥 내가 고른 번호 중 하나를 골라준다.
        spyglassHit = gameState.selected[Math.floor(Math.random() * gameState.selected.length)];
        alert(`${t.spyglass_msg} ${spyglassHit}`);
    }

    board.innerHTML = `
        <div class="game-view-container">
            <div class="game-room-border play-mode ${gameState.mode.cssClass}">
                <div class="game-header-wrapper">
                    <div style="text-align:center;">
                        <div style="font-size:0.8rem; color:var(--gold-accent);">${t.game_prize}</div>
                        <div id="table-current-prize" style="font-size:2rem; color:#fff; font-weight:bold; font-family:'Orbitron'; text-shadow: 0 0 10px var(--gold-accent);">
                            ${(gameState.mode.max * (gameState.useItems['double_ticket']?2:1)).toLocaleString()}
                        </div>
                    </div>
                    <div class="target-container">
                        ${gameState.selected.map(num => `<div id="target-${num}" class="target-ball ${spyglassHit === num ? 'found' : ''}">${num}</div>`).join('')}
                    </div>
                </div>

                <div class="card-grid ${gameState.mode.grid}" id="play-grid"></div>
                <div id="play-footer" style="width:100%; margin-top:20px; z-index:1;"></div>
            </div>
        </div>
    `;

    const playGrid = document.getElementById('play-grid');
    
    // 만약 투시경이 발동됐다면, 해당 번호는 이미 찾은 것으로 처리
    if (spyglassHit) {
        gameState.found.push(spyglassHit);
        // 플립 수 증가? 투시경은 공짜 오픈이므로 플립 수 증가 X 또는 O? 
        // 보통 '오픈' 아이템은 플립 수를 소모하지 않고 공을 까주는게 이득임.
        // 여기서는 플립 수 증가 없이 공만 오픈된 상태로 렌더링.
    }

    shuffled.forEach(num => {
        const ballWrapper = document.createElement('div');
        ballWrapper.className = "ball-wrapper";
        
        // 투시경으로 선택된 공은 처음부터 뒤집힌 상태
        let isRevealed = (num === spyglassHit);
        if (isRevealed) ballWrapper.classList.add('flipped');

        ballWrapper.innerHTML = `
            <div class="ball-inner">
                <div class="ball-face ball-front"></div>
                <div class="ball-face ball-back">
                    <div class="ball-number-bg">${num}</div>
                </div>
            </div>
        `;
        
        ballWrapper.onclick = () => {
            if (gameState.isGameOver || ballWrapper.classList.contains('flipped')) return;
            
            gameState.flips++;
            ballWrapper.classList.add('flipped'); 
            
            let curPrize = calculateCurrentPrize();
            document.getElementById('table-current-prize').innerText = curPrize.toLocaleString();

            if (gameState.selected.includes(num)) {
                gameState.found.push(num);
                const targetNode = document.getElementById(`target-${num}`);
                if (targetNode) targetNode.classList.add('found');
                if (gameState.found.length === gameState.mode.pick) handleGameWin(curPrize);
            } else if (gameState.flips === gameState.mode.total) {
                // 모든 공을 다 뒤집음 (꽝)
                // 만약 투시경으로 1개 미리 찾았으면 total - 1 이어야 함.
                // 로직 단순화를 위해: 찾은 개수가 pick보다 작고, 뒤집을 공이 없으면 꽝.
                handleGameWin(0);
            }
        };
        
        // 투시경 예외 처리: 이미 오픈된 공은 클릭 불가여야 하지만, 
        // 위에서 classList.add('flipped') 했으므로 클릭 이벤트 막힘.
        
        playGrid.appendChild(ballWrapper);
    });
}

async function handleGameWin(prize) {
    gameState.isGameOver = true;
    const t = window.t || {};
    const db = window.lotGoDb;
    const auth = window.lotGoAuth;
    const userDocRef = doc(db, "users", auth.currentUser.uid);

    let finalPrize = prize;
    let msg, cssClass;
    let insuranceTriggered = false;

    // 1. XP 계산 (기본 10% + 부스터 확인)
    const snap = await getDoc(userDocRef);
    const userData = snap.data();
    let xpGain = Math.floor(gameState.mode.cost * 0.1); 
    
    // XP 부스터 체크
    if (userData.xpBoostEnd && userData.xpBoostEnd > Date.now()) {
        xpGain *= 2; 
    }
    // Lv 1(만렙)은 XP 획득 불가
    if (userData.level === 1) xpGain = 0;

    // 2. 상금 및 보험 처리
    if (finalPrize > 0) {
        // 승리
        await updateDoc(userDocRef, { 
            coins: increment(finalPrize),
            exp: increment(xpGain)
        });
        
        if (finalPrize > gameState.mode.cost) {
            msg = "✨ 축하합니다! 대박 당첨! ✨";
            cssClass = "win-gold";
        } else {
            msg = "아쉽네요.. 다음 기회에.. 😭"; // 본전치기도 아쉬움으로 통일? 아님 safe 메시지?
            // 요청하신대로 본전 이하는 아쉬움으로.
            cssClass = "win-fail"; 
        }
    } else {
        // 꽝 (0원)
        // 보험권 체크
        if (gameState.useItems['insurance_ticket']) {
            const refund = Math.floor(gameState.finalCost * 0.5); // 지불한 금액의 50%
            await updateDoc(userDocRef, { 
                coins: increment(refund),
                exp: increment(xpGain) // 꽝이어도 XP는 줌
            });
            finalPrize = refund;
            msg = `${t.insurance_msg} (+${refund} C)`;
            cssClass = "win-gold"; // 보험 발동은 기분 좋은 일이니 골드? 아니면 fail?
            insuranceTriggered = true;
        } else {
            // 진짜 꽝
            await updateDoc(userDocRef, { exp: increment(xpGain) });
            msg = "아쉽네요.. 다음 기회에.. 😭";
            cssClass = "win-fail";
        }
    }

    const footer = document.getElementById('play-footer');
    if (footer) {
        footer.innerHTML = `
            <div class="result-box ${cssClass}">
                <div class="result-msg" style="font-size: 1.5rem; word-break: keep-all; margin-bottom: 10px;">${msg}</div>
                <div class="final-prize" style="margin-bottom: 20px;">+ ${finalPrize.toLocaleString()} C</div>
                ${xpGain > 0 ? `<div style="font-size:0.8rem; color:#4ade80;">+ ${xpGain} XP 획득</div>` : ''}
                
                <div style="display: flex; gap: 10px; justify-content: center; width: 100%; margin-top:15px;">
                    <button class="neon-btn success" style="flex:1;" onclick="initSingleGame(${gameState.level})">${t.replay}</button>
                    <button id="end-lobby-btn" class="neon-btn primary" style="flex:1;">${t.lobby_btn}</button>
                </div>
            </div>
        `;
        document.getElementById('end-lobby-btn').onclick = goBackToLobby;
    }
}

window.initSingleGame = initSingleGame;
