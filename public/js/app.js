import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { firebaseConfig } from "../firebase-config.js";

// UI Modules
import { renderBalance, switchTab } from "./home.js";
import { renderSingleMenu } from "./singlegame.js";
import { renderProfile } from "./profile.js";
import { renderShop } from "./shop.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// Global State for Modules
window.lotGoAuth = auth;
window.lotGoDb = db;

/**
 * 전역 함수 바인딩 (ReferenceError 방지)
 */
window.switchView = (id) => {
    ['auth-view', 'signup-view', 'lobby-view', 'game-view'].forEach(v => {
        const el = document.getElementById(v);
        if (el) el.style.display = (v === id) ? 'flex' : 'none';
    });
};

window.switchTab = switchTab;

window.handleLogin = () => {
    const e = document.getElementById('email').value;
    const p = document.getElementById('pw').value;
    if(!e || !p) return alert("Check inputs");
    signInWithEmailAndPassword(auth, e, p).catch(err => alert(err.message));
};

window.handleSignUp = () => {
    const e = document.getElementById('signup-email').value;
    const p = document.getElementById('signup-pw').value;
    if(p.length < 6) return alert("Password too short");
    createUserWithEmailAndPassword(auth, e, p).then(res => {
        set(ref(db, `users/${res.user.uid}`), { email: e, coins: 1000, role: 'user' });
    }).catch(err => alert(err.message));
};

/**
 * 유저 상태 감시
 */
onAuthStateChanged(auth, (user) => {
    if (user) {
        window.switchView('lobby-view');
        renderSingleMenu();
        renderShop();
        renderProfile(user);
        onValue(ref(db, `users/${user.uid}/coins`), (snap) => {
            renderBalance(snap.val() || 0);
        });
    } else {
        window.switchView('auth-view');
    }
});
