import { doc, getDoc, updateDoc, increment, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 1. 게임 모드 설정 (상금 테이블 복구)
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
        // [수정] 누락되었던 13~20회차 상금 데이터 완벽 복구
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

// ==============================================
// 티커(Ticker) 시스템
// ==============================================
const TickerManager = {
    queue: [],
    isAnimating: false,
    timer: null,

    generateFakeUser: function() {
        const adjs = ['Lucky', 'Golden', 'Super', 'Mega', 'Happy', 'Rich', 'Cool', 'Fast', 'Neon', 'Cyber'];
        const nouns = ['Tiger', 'Dragon', 'Winner', 'Star', 'King', 'Queen', 'Lion', 'Player', 'Master', 'Ghost'];
        const adj = adjs[Math.floor(Math.random() * adjs.length)];
        const noun = nouns[Math.floor(Math.random() * nouns.length)];
        const num = Math.floor(Math.random() * 999);
        return `${adj}${noun}${num}`;
    },

    getRandomRealPrize: function() {
        const modeKey = Math.random() > 0.5 ? 2 : 3; 
        const prizes = SINGLE_MODES[modeKey].prizes;
        return prizes[Math.floor(Math.random() * prizes.length)];
    },

    init: function() {
        if(this.timer) clearTimeout(this.timer);
        this.queue = [];
        this.isAnimating = false;
        this.loopFakeMessages();
    },

    loopFakeMessages: function() {
        const randomTime = Math.floor(Math.random() * (20000 - 5000 + 1)) + 5000;
        
        this.timer = setTimeout(() => {
            if (!document.getElementById('ticker-bar')) return;

            const user = this.generateFakeUser();
            const prize = this.getRandomRealPrize();
            const isJackpot = prize >= 1000000;
            
            let msg = `${user} won ${prize.toLocaleString()} C!`;
            if (isJackpot) {
                msg = `🚨 JACKPOT!! ${user} hit ${prize.toLocaleString()} C! 🚨`;
            }

            this.addMessage(msg, isJackpot);
            this.loopFakeMessages();
        }, randomTime);
    },

    addMessage: function(msg, isJackpot = false) {
        this.queue.push({ text: msg, isJackpot: isJackpot });
        this.playNext();
    },

    playNext: function() {
        if (this.isAnimating || this.queue.length === 0) return;
        
        const tickerBar = document.getElementById('ticker-bar');
        if (!tickerBar) return;

        this.isAnimating = true;
        const item = this.queue.shift();
        
        tickerBar.innerText = item.text;
        tickerBar.className = 'ticker-text'; 
        if (item.isJackpot) tickerBar.classList.add('ticker-jackpot');

        tickerBar.classList.remove('ticker-anim');
        void tickerBar.offsetWidth; 
        tickerBar.classList.add('ticker-anim');

        const onEnd = () => {
            this.isAnimating = false;
            tickerBar.removeEventListener('animationend', onEnd);
            this.playNext();
        };
        tickerBar.addEventListener('animationend', onEnd);
    },
    
    stop: function() {
        if(this.timer) clearTimeout(this.timer);
        this.queue = [];
        this.isAnimating = false;
    }
};

function goBackToLobby() {
    TickerManager.stop();
    if (coinUnsub) coinUnsub();
    window.switchView('lobby-view');
    renderSingleMenu();
}

// 메뉴 렌더링
export async function renderSingleMenu() {
    const container = document.getElementById('single-tab');
    if (!container) return;
    
    container.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; width: 100%;">
            <div class="menu-list" style="display: flex; flex-direction: column; gap: 20px; width: 100%; max-width: 400px; padding: 20px;">
                
                <div class="ticker-container">
                    <div id="ticker-bar" class="ticker-text">Welcome to Lot-Go! Win Big!</div>
                </div>

                <button id="ad-btn" class="main-btn ad-btn-style" onclick="handleWatchAd()">📺 WATCH AD (+300 C)</button>
                <div class="divider" style="width:100%; border-bottom:
