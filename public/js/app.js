import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, onSnapshot, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { firebaseConfig } from "../firebase-config.js";

// UI Modules
import { renderBalance, switchTab } from "./home.js";
import { renderSingleMenu, initSingleGame, handleWatchAd } from "./singlegame.js";

// [선택] 아직 파일이 없으면 에러가 날 수 있으므로 주석 유지 권장
// import { renderProfile } from "./profile.js"; 
// import { renderShop } from "./shop.js";      

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Global State (모듈들이 window를 통해 DB/Auth에 접근)
window.lotGoAuth = auth;
window.lotGoDb = db;

/**
 * 전역 함수 바인딩
 */
window.switchView = (id) => {
    // 게임 뷰로 이동할 때나 로비로 갈 때 불필요한 요소 정리
    ['auth-view', 'signup-view', 'lobby-view', 'game-view'].forEach(v => {
        const el = document.getElementById(v);
        if (el) el.style.display = (v === id) ? 'flex' : 'none';
    });
};

window.switchTab = switchTab;
window.initSingleGame = initSingleGame; 
window.handleWatchAd = handleWatchAd; 

/**
 * 로그인 처리
 */
window.handleLogin = () => {
    const e = document.getElementById('email').value;
    const p = document.getElementById('pw').value;
    if(!e || !p) return alert("Please enter email and password.");
    
    signInWithEmailAndPassword(auth, e, p)
        .then(() => {
            // 성공 시 onAuthStateChanged가 자동 감지
            console.log("Login Success");
        })
        .catch(err => alert("Login Failed: " + err.message));
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
            dailyAdCount: 0,
            lastAdDate: "",
            lastAdTime: 0
        });
        alert("Account created! 1,000 Coins rewarded.");
        window.switchView('lobby-view'); // 가입 즉시 로비로 이동
    }).catch(err => alert("Signup Failed: " + err.message));
};

/**
 * 로그아웃 처리
 */
window.handleLogout = () => {
    signOut(auth).then(() => {
        alert("Signed out.");
        window.switchView('auth-view');
    });
};

/**
 * 앱 초기화 및 상태 감지
 */
document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            window.switchView('lobby-view');
            
            // 실시간 코인 업데이트
            const userDocRef = doc(db, "users", user.uid);
            onSnapshot(userDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    const userData = docSnap.data();
                    renderBalance(userData.coins || 0);
                } else {
                    // 문서가 없는 경우 (예외 처리)
                    renderBalance(0);
                }
            });

            // 로비 UI 초기화
            renderSingleMenu();
            
            // 파일이 생성된 후 주석 해제하여 사용
            // if (typeof renderShop === 'function') renderShop();
            // if (typeof renderProfile === 'function') renderProfile(user); 
        } else {
            window.switchView('auth-view');
        }
    });
});
