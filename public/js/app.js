import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, onSnapshot, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { firebaseConfig } from "../firebase-config.js";

// UI Modules
import { renderBalance, switchTab } from "./home.js";
// [중요] handleWatchAd를 import 목록에 추가해야 합니다.
import { renderSingleMenu, initSingleGame, handleWatchAd } from "./singlegame.js";
// import { renderProfile } from "./profile.js"; // 파일이 없다면 주석 처리
// import { renderShop } from "./shop.js";       // 파일이 없다면 주석 처리

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Global State (모듈들이 window를 통해 DB/Auth에 접근)
window.lotGoAuth = auth;
window.lotGoDb = db;

/**
 * 전역 함수 바인딩 (HTML onclick 이벤트용)
 */
window.switchView = (id) => {
    ['auth-view', 'signup-view', 'lobby-view', 'game-view'].forEach(v => {
        const el = document.getElementById(v);
        if (el) el.style.display = (v === id) ? 'flex' : 'none';
    });
};

window.switchTab = switchTab;

// [수정] singlegame.js 함수들을 window에 직접 연결
// (최신 singlegame.js는 내부에서 window.lotGoDb를 쓰므로 인자 전달 불필요)
window.initSingleGame = initSingleGame; 
window.handleWatchAd = handleWatchAd; // 광고 버튼 작동을 위해 필수

/**
 * 로그인 처리
 */
window.handleLogin = () => {
    const e = document.getElementById('email').value;
    const p = document.getElementById('pw').value;
    if(!e || !p) return alert("Please enter email and password.");
    signInWithEmailAndPassword(auth, e, p).catch(err => alert("Login Failed: " + err.message));
};

/**
 * 회원가입 처리
 */
window.handleSignUp = () => {
    const e = document.getElementById('signup-email').value;
    const p = document.getElementById('signup-pw').value;
    if(p.length < 6) return alert("Password should be at least 6 characters.");

    createUserWithEmailAndPassword(auth, e, p).then(async (res) => {
        await setDoc(doc(db, "users", res.user.uid), {
            email: e,
            coins: 1000,
            role: 'user',
            createdAt: new Date().toISOString(),
            // [추천] 광고 시스템을 위한 초기 데이터 세팅
            dailyAdCount: 0,
            lastAdDate: "",
            lastAdTime: 0
        });
        alert("Account created! 1,000 Coins rewarded.");
        window.switchView('auth-view'); // 가입 후 로그인 화면으로 이동
    }).catch(err => alert("Signup Failed: " + err.message));
};

/**
 * 실시간 유저 상태 및 코인 감시
 */
onAuthStateChanged(auth, (user) => {
    if (user) {
        window.switchView('lobby-view');
        
        const userDocRef = doc(db, "users", user.uid);
        onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const userData = docSnap.data();
                renderBalance(userData.coins || 0);
            } else {
                renderBalance(0);
            }
        });

        // 게임 메뉴 렌더링
        renderSingleMenu();
        
        // renderShop();    // shop.js가 준비되면 주석 해제
        // renderProfile(user); // profile.js가 준비되면 주석 해제
    } else {
        window.switchView('auth-view');
    }
});
