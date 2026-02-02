import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
// [수정] Firestore 라이브러리로 변경
import { getFirestore, doc, onSnapshot, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { firebaseConfig } from "../firebase-config.js";

// UI Modules
import { renderBalance, switchTab } from "./home.js";
import { renderSingleMenu, initSingleGame } from "./singlegame.js";
import { renderProfile } from "./profile.js";
import { renderShop } from "./shop.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app); // [수정] Firestore 초기화

// Global State (모듈들이 Firestore 인스턴스를 공유하도록 설정)
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
window.initSingleGame = (level) => initSingleGame(level, auth, db);

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
 * 회원가입 처리 (Firestore에 초기 데이터 생성)
 */
window.handleSignUp = () => {
    const e = document.getElementById('signup-email').value;
    const p = document.getElementById('signup-pw').value;
    if(p.length < 6) return alert("Password should be at least 6 characters.");

    createUserWithEmailAndPassword(auth, e, p).then(async (res) => {
        // [수정] Firestore 전용 setDoc 함수 사용
        await setDoc(doc(db, "users", res.user.uid), {
            email: e,
            coins: 1000,
            role: 'user',
            createdAt: new Date().toISOString()
        });
        alert("Account created! 1,000 Coins rewarded.");
    }).catch(err => alert("Signup Failed: " + err.message));
};

/**
 * 실시간 유저 상태 및 코인 감시
 */
onAuthStateChanged(auth, (user) => {
    if (user) {
        window.switchView('lobby-view');
        
        // [수정] Firestore 실시간 문서 감시 (onSnapshot)
        const userDocRef = doc(db, "users", user.uid);
        onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const userData = docSnap.data();
                renderBalance(userData.coins || 0);
            } else {
                console.log("No user document found in Firestore.");
                renderBalance(0);
            }
        });

        // 나머지 UI 모듈 렌더링
        renderSingleMenu();
        renderShop();
        renderProfile(user);
    } else {
        window.switchView('auth-view');
    }
});
