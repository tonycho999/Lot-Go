import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, onValue, set, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { firebaseConfig } from "../firebase-config.js";

// 1. Firebase 초기화
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// 2. 게임 설정 데이터
const GAME_MODES = {
    1: { name: 'EASY', total: 5, pick: 2, cost: 100, max: 400, cols: 2, bonusLimit: 9, bonus: 50 },
    2: { name: 'NORMAL', total: 10, pick: 4, cost: 200, max: 30000, cols: 5, bonusLimit: 9, bonus: 100 },
    3: { name: 'HARD', total: 20, pick: 6, cost: 500, max: 12000000, cols: 5, bonusLimit: 19, bonus: 200 }
};

let currentGameState = {
    openCount: 0,
    winningCards: [],
    isGameOver: false
};

/**
 * 3. 전역 화면 전환 함수 (SPA - 주소창 고정)
 */
window.switchView = (viewId) => {
    const views = ['auth-view', 'signup-view', 'lobby-view', 'game-view'];
    views.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = (id === viewId) ? 'flex' : 'none';
    });
};

/**
 * 4. 사용자 인증 상태 감시
 */
onAuthStateChanged(auth, (user) => {
    if (user) {
        loadLobby(user);
    } else {
        window.switchView('auth-view');
    }
});

/**
 * 5. 로그인/회원가입/로그아웃
 */
window.handleLogin = () => {
    const email = document.getElementById('email').value;
    const pw = document.getElementById('pw').value;
    if (!email || !pw) return alert("입력란을 채워주세요.");
    signInWithEmailAndPassword(auth, email, pw).catch(e => alert("실패: " + e.message));
};

window.handleSignUp = () => {
    const email = document.getElementById('signup-email').value;
    const pw = document.getElementById('signup-pw').value;
    if (pw.length < 6) return alert("비밀번호는 6자리 이상이어야 합니다.");

    createUserWithEmailAndPassword(auth, email, pw)
        .then((res) => {
            set(ref(db, `users/${res.user.uid}`), {
                email: res.user.email,
                coins: 1000,
                adCount: 0,
                lastAdDate: "",
                createdAt: Date.now()
            });
            alert("가입 축하! 1,000 코인이 지급되었습니다.");
        }).catch(e => alert("실패: " + e.message));
};

window.handleLogout = () => { if(confirm("로그아웃 하시겠습니까?")) signOut(auth); };

/**
 * 6. 광고 보상 시스템 (하루 10회, 10분 쿨타임)
 */
window.handleAdWatch = async () => {
    const user = auth.currentUser;
    const today = new Date().toLocaleDateString();
    const userRef = ref(db, `users/${user.uid}`);
    
    const snap = await get(userRef);
    const data = snap.val();
    
    let count = (data.lastAdDate === today) ? (data.adCount || 0) : 0;
    
    if (count >= 10) return alert("오늘의 광고 한도(10회)를 초과했습니다.");

    // 코인 지급 및 카운트 업데이트
    await set(ref(db, `users/${user.uid}/coins`), (data.coins || 0) + 300);
    await set(ref(db, `users/${user.uid}/adCount`), count + 1);
    await set(ref(db, `users/${user.uid}/lastAdDate`), today);

    alert("300 코인이 지급되었습니다!");
    const adBtn = document.getElementById('ad-btn');
    adBtn.style.display = 'none';
    setTimeout(() => { adBtn.style.display = 'block'; }, 10 * 60 * 1000);
};

/**
 * 7. 로비 및 게임 엔진
 */
function loadLobby(user) {
    window.switchView('lobby-view');
    onValue(ref(db, `users/${user.uid}/coins`), (snap) => {
        document.getElementById('user-coins').innerText = (snap.val() || 0).toLocaleString();
    });
}

window.startSingleGame = async (modeLevel) => {
    const mode = GAME_MODES[modeLevel];
    const user = auth.currentUser;
    const userRef = ref(db, `users/${user.uid}/coins`);
    
    const snap = await get(userRef);
    const currentCoins = snap.val() || 0;

    if (currentCoins < mode.cost) return alert("코인이 부족합니다!");
    
    await set(userRef, currentCoins - mode.cost); // 참가비 차감
    window.switchView('game-view');
    renderBoard(mode);
};

function renderBoard(mode) {
    const board = document.getElementById('game-board');
    board.innerHTML = '';
    board.style.gridTemplateColumns = `repeat(${mode.cols}, 1fr)`;
    
    currentGameState = {
        openCount: 0,
        isGameOver: false,
        winningCards: Array.from({length: mode.total}, (_, i) => i + 1)
                           .sort(() => Math.random() - 0.5)
                           .slice(0, mode.pick)
    };

    for (let i = 1; i <= mode.total; i++) {
        const card = document.createElement('div');
        card.className = 'card hidden';
        card.innerText = '?';
        card.onclick = () => handleCardClick(card, i, mode);
        board.appendChild(card);
    }
}

async function handleCardClick(el, num, mode) {
    if (currentGameState.isGameOver || !el.classList.contains('hidden')) return;

    currentGameState.openCount++;
    el.classList.remove('hidden');
    el.classList.add('flipped');
    el.innerText = num;

    if (currentGameState.winningCards.includes(num)) {
        currentGameState.isGameOver = true;
        let prize = (currentGameState.openCount === mode.total) ? 0 : Math.floor(mode.max / currentGameState.openCount);
        alert(`${currentGameState.openCount}번째 당첨! 상금: ${prize} COINS`);
        if (prize > 0) await updateCoins(prize);
        window.switchView('lobby-view');
    } else {
        if (currentGameState.openCount === mode.bonusLimit) {
            alert(`보너스 달성! ${mode.bonus} COINS 지급!`);
            await updateCoins(mode.bonus);
        }
        if (currentGameState.openCount === mode.total) {
            alert("마지막 카드입니다. 상금 0원.");
            window.switchView('lobby-view');
        }
    }
}

async function updateCoins(amount) {
    const user = auth.currentUser;
    const snap = await get(ref(db, `users/${user.uid}/coins`));
    await set(ref(db, `users/${user.uid}/coins`), (snap.val() || 0) + amount);
}
