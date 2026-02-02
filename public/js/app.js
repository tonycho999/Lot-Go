import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { firebaseConfig } from "../firebase-config.js";

// 1. Firebase 초기화
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

/**
 * 2. 전역 화면 전환 함수 (SPA)
 */
window.switchView = (viewId) => {
    const views = ['auth-view', 'signup-view', 'lobby-view', 'game-view'];
    views.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.style.display = (id === viewId) ? 'flex' : 'none';
        }
    });
};

/**
 * 3. 사용자 인증 상태 감시
 */
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("Lot-Go 유저 접속:", user.email);
        loadLobby(user);
    } else {
        console.log("로그아웃 상태");
        window.switchView('auth-view');
    }
});

/**
 * 4. 로그인 처리
 */
window.handleLogin = () => {
    const email = document.getElementById('email').value;
    const pw = document.getElementById('pw').value;

    if (!email || !pw) {
        alert("이메일과 비밀번호를 입력해주세요.");
        return;
    }

    signInWithEmailAndPassword(auth, email, pw)
        .catch((error) => alert("로그인 실패: " + error.message));
};

/**
 * 5. 계정 생성 (회원가입) 처리
 */
window.handleSignUp = () => {
    const email = document.getElementById('signup-email').value;
    const pw = document.getElementById('signup-pw').value;

    if (!email || pw.length < 6) {
        alert("올바른 이메일과 6자리 이상의 비밀번호를 입력해주세요.");
        return;
    }

    createUserWithEmailAndPassword(auth, email, pw)
        .then((userCredential) => {
            const user = userCredential.user;
            // 새 유저 생성 시 기본 코인(1,000개) 지급 데이터 세팅
            set(ref(db, `users/${user.uid}`), {
                email: user.email,
                coins: 1000,
                createdAt: Date.now()
            });
            alert("Lot-Go 계정이 생성되었습니다! 1,000 코인이 지급되었습니다.");
        })
        .catch((error) => alert("계정 생성 실패: " + error.message));
};

/**
 * 6. 로비 데이터 로드 (실시간 코인 업데이트)
 */
function loadLobby(user) {
    window.switchView('lobby-view');
    const userCoinsRef = ref(db, `users/${user.uid}/coins`);
    
    onValue(userCoinsRef, (snapshot) => {
        const coins = snapshot.val() || 0;
        const coinEl = document.getElementById('user-coins');
        if (coinEl) coinEl.innerText = coins.toLocaleString();
    });
}

/**
 * 7. 로그아웃 처리
 */
window.handleLogout = () => {
    if(confirm("로그아웃 하시겠습니까?")) {
        signOut(auth);
    }
};

/**
 * 8. 게임 시작 (싱글 플레이 엔진 연결부)
 */
window.startSingleGame = () => {
    window.switchView('game-view');
    console.log("게임 시작!");
    // 여기에 카드 생성 로직을 추가할 예정입니다.
};
