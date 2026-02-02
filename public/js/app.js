import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { firebaseConfig } from "../firebase-config.js";

// 1. Firebase 초기화
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

/**
 * 2. 화면 전환 함수 (SPA 핵심)
 * @param {string} viewId - 보여줄 뷰의 ID ('auth-view', 'lobby-view', 'game-view')
 */
window.switchView = (viewId) => {
    const views = ['auth-view', 'lobby-view', 'game-view'];
    views.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            // flex를 사용하여 중앙 정렬 레이아웃 유지
            el.style.display = (id === viewId) ? 'flex' : 'none';
        }
    });
};

/**
 * 3. 인증 상태 감시
 * 페이지 로드 시 및 로그인 상태 변경 시 자동으로 실행됩니다.
 */
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("Logged in as:", user.email);
        loadLobby(user);
    } else {
        console.log("No user logged in.");
        window.switchView('auth-view');
    }
});

/**
 * 4. 로비 데이터 로드
 */
function loadLobby(user) {
    window.switchView('lobby-view');
    
    // 유저 코인 정보 실시간 리스너
    const userRef = ref(db, `users/${user.uid}/coins`);
    onValue(userRef, (snapshot) => {
        const coins = snapshot.val() || 0;
        const coinEl = document.getElementById('user-coins');
        if (coinEl) coinEl.innerText = coins.toLocaleString();
    });
}

/**
 * 5. 로그인 처리 함수
 */
window.handleLogin = () => {
    const email = document.getElementById('email').value;
    const pw = document.getElementById('pw').value;

    if (!email || !pw) {
        alert("이메일과 비밀번호를 입력해주세요.");
        return;
    }

    signInWithEmailAndPassword(auth, email, pw)
        .then(() => {
            console.log("Login Success");
        })
        .catch((error) => {
            alert("로그인 실패: " + error.message);
        });
};

/**
 * 6. 싱글 게임 시작 (추후 게임 엔진 연결부)
 */
window.startSingleGame = () => {
    console.log("Starting single game...");
    window.switchView('game-view');
    
    // 여기에 이전에 작성하신 카드 생성 및 게임 로직을 함수 형태로 호출하면 됩니다.
    // 예: initGameEngine();
};

/**
 * 7. 로그아웃
 */
window.handleLogout = () => {
    auth.signOut();
};
