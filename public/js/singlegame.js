import { doc, getDoc, updateDoc, increment, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export const SINGLE_MODES = {
    1: { name: 'EASY', pick: 2, total: 6, cost: 100, max: 1000, grid: 'grid-easy', cssClass: 'easy-mode', table: { 1: 1000, 2: 1000, 3: 500, 4: 200, 5: 50, 6: 0 } },
    2: { name: 'NORMAL', pick: 4, total: 12, cost: 200, max: 40000, grid: 'grid-normal', cssClass: 'normal-mode', table: { 1: 40000, 2: 40000, 3: 40000, 4: 40000, 5: 8000, 6: 3000, 7: 1000, 8: 400, 9: 200, 10: 100, 11: 50, 12: 0 } },
    3: { name: 'HARD', pick: 6, total: 20, cost: 500, max: 10000000, grid: 'grid-hard', cssClass: 'hard-mode', table: { 1: 10000000, 2: 10000000, 3: 10000000, 4: 10000000, 5: 10000000, 6: 10000000, 7: 1428570, 8: 357140, 9: 119040, 10: 47610, 11: 21640, 12: 10820, 13: 5820, 14: 3330, 15: 1990, 16: 1249, 17: 808, 18: 539, 19: 369, 20: 0 } }
};

let gameState = { 
    selected: [], found: [], flips: 0, mode: null, 
    isGameOver: false, level: 1, activeDouble: false,
    useItems: {}, finalCost: 0 
};
let userCoins = 0; 
let coinUnsub = null;
let userItems = {}; 

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

    const snap = await getDoc(doc(db, "users", auth.currentUser.uid));
    userItems = snap.data().items || {};
    const xpBoostEnd = snap.data().xpBoostEnd || 0;
    const isBoostActive = xpBoostEnd > Date.now();

    const generateItemCheck = (id, icon, name) => {
        const qty = userItems[id] || 0;
        if (qty <= 0) return '';
        return `
            <label class="item-checkbox" style="display:flex; align-items:center; gap:10px; margin:5px 0; background:#1e293b; padding:10px; border-radius:8px; cursor:pointer;">
                <input type="checkbox" id="check-${id}" value="${id}">
                <span style="font-size:0.9rem; color:#e2e8f0;">${icon} ${name} <span style="color:#94a3b8;">(x${qty})</span></span>
            </label>
        `;
    };

    container.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; width: 100%;">
            <div class="menu-list" style="display: flex; flex-direction: column; gap: 20px; width: 100%; max-width: 400px; padding: 20px;">
                ${isBoostActive ? `<div style="background:linear-gradient(90deg, #ef4444, #f59e0b); color:white; padding:10px; text-align:center; font-weight:bold; border-radius:8px; animation:pulse 2s infinite; font-size:0.9rem;">${t.active_booster}</div>` : ''}

                <div class="ticker-container" style="background:black; border-top:2px solid #d4af37; border-bottom:2px solid #d4af37; padding:5px; margin-bottom:10px;">
                    <div id="ticker-bar" style="color:#d4af37; font-family:'Orbitron'; text-align:center;">
                        ${t.ticker_welcome}
                    </div>
                </div>
                
                <div id="item-settings-box" style="background:rgba(0,0,0,0.3); padding:15px; border-radius:10px; border:1px solid #334155;">
                    <div style="color:#94a3b8; font-size:0.8rem; margin-bottom:10px; font-weight:bold;">${t.use_items}</div>
                    ${generateItemCheck('free_pass', '🎟️', t.item_free_pass_name)}
                    ${generateItemCheck('discount_50', '🏷️', t.item_discount_50_name)}
                    ${generateItemCheck('double_ticket', '🎫', t.item_double_name)}
                    ${generateItemCheck('hint_spyglass', '🔭', t.item_spyglass_name)}
                    ${generateItemCheck('insurance_ticket', '🛡️', t.item_insurance_name)}
                    
                    ${Object.keys(userItems).filter(k=>['free_pass','discount_50','double_ticket','hint_spyglass','insurance_ticket'].includes(k)).length === 0 
                        ? `<div style="color:#64748b; font-size:0.8rem; text-align:center;">${t.no_items}</div>` : ''}
                </div>

                <div class="divider" style="width:100%; border-bottom:1px solid rgba(255,255,255,0.1); margin:10px 0;"></div>
                
                <button class="main-btn easy-btn" onclick="initSingleGame(1)">
                    <div class="btn-title">${t.single_menu_easy}</div><div class="btn-desc">${t.single_desc_easy}</div>
                </button>
                <button class="main-btn normal-btn" onclick="initSingleGame(2)">
                    <div class="btn-title">${t.single_menu_normal}</div><div class="btn-desc">${t.single_desc_normal}</div>
                </button>
                <button class="main-btn hard-btn" onclick="initSingleGame(3)">
                    <div class="btn-title">${t.single_menu_hard}</div><div class="btn-desc">${t.single_desc_hard}</div>
                </button>
            </div>
        </div>`;
}

export async function initSingleGame(level) {
    const db = window.lotGoDb;
    const auth = window.lotGoAuth;
    const t = window.t || {};
    const mode = SINGLE_MODES[level];
    
    const useItems = {};
    ['free_pass', 'discount_50', 'double_ticket', 'hint_spyglass', 'insurance_ticket'].forEach(id => {
        const el = document.getElementById(`check-${id}`);
        if (el && el.checked) useItems[id] = true;
    });

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
    if (!snap.exists()) return alert(t.alert_no_data);
    
    const userData = snap.data();
    if (userData.coins < finalCost) return alert(t.alert_no_coin);

    const updates = { coins: increment(-finalCost) };
    if (costItemToConsume) updates[`items.${costItemToConsume}`] = increment(-1);
    if (useItems['double_ticket']) updates[`items.double_ticket`] = increment(-1);
    if (useItems['hint_spyglass']) updates[`items.hint_spyglass`] = increment(-1);
    if (useItems['insurance_ticket']) updates[`items.insurance_ticket`] = increment(-1);

    await updateDoc(userDocRef, updates);

    if (coinUnsub) coinUnsub(); 
    coinUnsub = onSnapshot(userDocRef, (docSnapshot) => {
        userCoins = docSnapshot.data().coins || 0;
        updateTopBar(); 
    });

    gameState = { 
        selected: [], found: [], flips: 0, mode, 
        isGameOver: false, level, activeDouble: false,
        useItems: useItems, finalCost: finalCost 
    };
    
    window.switchView('game-view');
    renderSelectionPhase();
}

function updateTopBar() {
    const topBar = document.getElementById('game-top-bar');
    if (!topBar) return;
    const t = window.t || {};
    let prizeValue = gameState.mode.max.toLocaleString();

    if (gameState.useItems['double_ticket']) {
        prizeValue = "x2 " + prizeValue;
    }

    topBar.innerHTML = `
        <div class="coin-info">
            <div id="back-to-lobby-btn" style="cursor:pointer; color: var(--gold-accent); font-weight: bold; margin-bottom: 5px;">
                ← ${t.lobby_btn}
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

function calculateCurrentPrize() {
    const { mode, flips } = gameState;
    let basePrize = mode.table && mode.table[flips] !== undefined ? mode.table[flips] : 0;
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

    // [수정] 번호 선택 문구 다국어 처리
    board.innerHTML = `
        <div class="game-view-container">
            <div class="game-room-border ${gameState.mode.cssClass}">
                <div class="game-header-wrapper">
                    <h2 class="game-title">
                        ${t.pick_msg_1} <span class="highlight">${gameState.mode.pick}</span>${t.pick_msg_2}
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

    let spyglassHit = null;
    const shuffled = Array.from({length: gameState.mode.total}, (_, i) => i + 1).sort(() => Math.random() - 0.5);

    if (gameState.useItems['hint_spyglass']) {
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
                            ${(gameState.mode.max * (gameState.useItems['double_ticket'] ? 2 : 1)).toLocaleString()}
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
    
    if (spyglassHit) {
        gameState.found.push(spyglassHit);
    }

    shuffled.forEach(num => {
        const ballWrapper = document.createElement('div');
        ballWrapper.className = "ball-wrapper";
        
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
                handleGameWin(0);
            }
        };
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

    const snap = await getDoc(userDocRef);
    const userData = snap.data();
    let xpGain = Math.floor(gameState.mode.cost * 0.1); 
    
    if (userData.xpBoostEnd && userData.xpBoostEnd > Date.now()) {
        xpGain *= 2; 
    }
    if (userData.level === 1) xpGain = 0; 

    if (finalPrize > 0) {
        await updateDoc(userDocRef, { 
            coins: increment(finalPrize),
            exp: increment(xpGain)
        });
        
        if (finalPrize > gameState.mode.cost) {
            msg = t.win_gold_msg; // [수정] 다국어 메시지 사용
            cssClass = "win-gold";
        } else {
            msg = t.win_fail_msg; // [수정] 다국어 메시지 사용
            cssClass = "win-fail"; 
        }
    } else {
        if (gameState.useItems['insurance_ticket']) {
            const refund = Math.floor(gameState.finalCost * 0.5); 
            await updateDoc(userDocRef, { 
                coins: increment(refund),
                exp: increment(xpGain) 
            });
            finalPrize = refund;
            msg = `${t.insurance_msg} (+${refund} C)`;
            cssClass = "win-gold";
        } else {
            await updateDoc(userDocRef, { exp: increment(xpGain) });
            msg = t.win_fail_msg; // [수정] 다국어 메시지 사용
            cssClass = "win-fail";
        }
    }

    const footer = document.getElementById('play-footer');
    if (footer) {
        footer.innerHTML = `
            <div class="result-box ${cssClass}">
                <div class="result-msg" style="font-size: 1.5rem; word-break: keep-all; margin-bottom: 10px;">${msg}</div>
                <div class="final-prize" style="margin-bottom: 20px;">+ ${finalPrize.toLocaleString()} C</div>
                ${xpGain > 0 ? `<div style="font-size:0.8rem; color:#4ade80;">+ ${xpGain} XP</div>` : ''}
                
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
