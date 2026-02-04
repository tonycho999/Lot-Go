import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc, onSnapshot, collection, query, where, getDocs, updateDoc, increment, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// [1] 모듈 불러오기
import { firebaseConfig } from './firebase-config.js';
import { renderSingleMenu } from './singlegame.js';
import { renderProfile } from './profile.js';
import { renderShop } from './shop.js';
import { renderOnlineLobby } from './online-lobby.js';
import { initLanguage } from './lang.js';
import { renderCoinTab } from './coin.js'; // [NEW] 코인 탭 모듈 추가

// [2] Firebase 초기화
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const rtdb = getDatabase(app);

window.lotGoAuth = auth;
window.lotGoDb = db;
window.lotGoRtdb = rtdb;

// [3] 언어 설정 및 로그인 화면 번역 실행
window.t = initLanguage();
renderAuthScreens();

function renderAuthScreens() {
    const t = window.t;
    // 1. 로그인 화면 텍스트 교체
    const authView = document.getElementById('auth-view');
    if (authView) {
        authView.innerHTML = `
            <div class="auth-card">
                <div class="logo-wrapper">
                    <img src="images/logo.png" alt="Lot-Go Logo" class="game-logo">
                    <div class="logo-glow"></div>
                </div>
                
                <h1 class="main-title">LOT-GO</h1>
                <p class="sub-title">${t.login_subtitle}</p>

                <div class="input-group">
                    <input type="text" id="login-username" placeholder="${t.ph_username}" class="neon-input">
                </div>
                <div class="input-group">
                    <input type="password" id="login-pw" placeholder="${t.ph_password}" class="neon-input">
                </div>

                <div class="auth-actions">
                    <button onclick="handleLogin()" class="neon-btn primary full-width">${t.btn_login}</button>
                    <button onclick="switchView('signup-view')" class="neon-btn secondary full-width">${t.btn_create_acc}</button>
                </div>
            </div>
        `;
    }

    // 2. 회원가입 화면 텍스트 교체
    const signupView = document.getElementById('signup-view');
    if (signupView) {
        signupView.innerHTML = `
            <div class="auth-card" style="max-width:400px;"> 
                <h2 class="game-title" style="margin-bottom: 20px;">${t.join_title}</h2>
                
                <div class="input-group">
                    <input type="email" id="signup-email" placeholder="${t.ph_email}" class="neon-input">
                </div>
                <div class="input-group">
                    <input type="text" id="signup-username" placeholder="${t.ph_username_unique}" class="neon-input">
                </div>
                <div class="input-group">
                    <input type="password" id="signup-pw" placeholder="${t.ph_password_min}" class="neon-input">
                </div>
                <div class="input-group">
                    <input type="password" id="signup-pw-confirm" placeholder="${t.ph_password_confirm}" class="neon-input">
                </div>
                <div class="input-group">
                    <input type="text" id="signup-referral" placeholder="${t.ph_referral}" class="neon-input">
                </div>
                
                <div class="auth-actions">
                    <button onclick="handleSignUp()" class="neon-btn success full-width">${t.btn_signup}</button>
                    <button onclick="switchView('auth-view')" class="text-btn">${t.btn_back_login}</button>
                </div>
            </div>
        `;
    }
}

// [4] 로그인 처리
window.handleLogin = async () => {
    const username = document.getElementById('login-username').value.trim();
    const pw = document.getElementById('login-pw').value;
    
    if (!username || !pw) return alert("Please enter username and password.");

    try {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("username", "==", username));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) return alert("Username not found.");

        const userDoc = querySnapshot.docs[0].data();
        const email = userDoc.email;

        await signInWithEmailAndPassword(auth, email, pw);
    } catch (e) {
        console.error(e);
        alert("Login failed: " + e.message);
    }
};

// [5] 회원가입 처리
window.handleSignUp = async () => {
    const email = document.getElementById('signup-email').value.trim();
    const username = document.getElementById('signup-username').value.trim();
    const pw = document.getElementById('signup-pw').value;
    const pwConfirm = document.getElementById('signup-pw-confirm').value;
    const referralInput = document.getElementById('signup-referral').value.trim();

    if (!email || !username || !pw || !pwConfirm || !referralInput) {
        return alert("Please fill in all fields.");
    }
    if (pw !== pwConfirm) return alert("Passwords do not match.");
    if (pw.length < 6) return alert("Password must be at least 6 characters.");

    try {
        const usersRef = collection(db, "users");
        const userCheckQ = query(usersRef, where("username", "==", username));
        const userCheckSnap = await getDocs(userCheckQ);
        if (!userCheckSnap.empty) return alert("Username already exists.");

        let referrerUid = null;
        if (referralInput !== "ADMIN") {
            const refCheckQ = query(usersRef, where("myReferralCode", "==", referralInput));
            const refCheckSnap = await getDocs(refCheckQ);
            if (refCheckSnap.empty) return alert("Invalid Referral Code.");
            referrerUid = refCheckSnap.docs[0].id;
        }

        const myReferralCode = generateReferralCode();
        const userCredential = await createUserWithEmailAndPassword(auth, email, pw);
        const user = userCredential.user;
        
        await setDoc(doc(db, "users", user.uid), {
            email: user.email,
            username: username,         
            coins: 3000,
            exp: 0,
            level: 10,
            createdAt: new Date(),
            role: 'user',
            photoURL: 'images/default-profile.png',
            items: {},
            frames: [],
            myReferralCode: myReferralCode, 
            referredBy: referralInput,      
            referralCount: 0                
        });

        if (referrerUid) {
            const referrerRef = doc(db, "users", referrerUid);
            const refSnap = await getDoc(referrerRef);
            if (refSnap.exists()) {
                const refData = refSnap.data();
                const refLevel = refData.level !== undefined ? refData.level : 10;
                const refRole = refData.role || 'user';
                let updates = { referralCount: increment(1) };
                if (refLevel > 1 && refRole !== 'admin') {
                    updates.exp = increment(1000);
                }
                await updateDoc(referrerRef, updates);
            }
        }
        
        alert(`Welcome, ${username}! You received +3,000 Coins!`);
        window.switchView('auth-view'); 

    } catch (e) {
        console.error(e);
        alert("Signup failed: " + e.message);
    }
};

function generateReferralCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

window.switchView = (viewId) => {
    document.querySelectorAll('.view-container').forEach(el => el.style.display = 'none');
    const target = document.getElementById(viewId);
    if (target) {
        target.style.display = (viewId === 'game-view' || viewId === 'auth-view' || viewId === 'signup-view') ? 'flex' : 'block';
        if (viewId === 'lobby-view') window.switchTab('single');
    }
};

window.switchTab = async (tabName) => {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    const targetTab = document.getElementById(`${tabName}-tab`);
    if (targetTab) targetTab.style.display = 'block';

    document.querySelectorAll('.bottom-nav button').forEach(btn => btn.classList.remove('active'));
    const navBtn = document.getElementById(`nav-${tabName}`);
    if (navBtn) navBtn.classList.add('active');

    const user = auth.currentUser;
    if (!user) return; 

    if (tabName === 'single') renderSingleMenu();
    else if (tabName === 'online') renderOnlineLobby();
    else if (tabName === 'shop') await renderShop(user);
    else if (tabName === 'coin') await renderCoinTab(user); // [NEW] 코인 탭 연결
    else if (tabName === 'profile') await renderProfile(user);
};

onAuthStateChanged(auth, (user) => {
    if (user) {
        window.switchView('lobby-view');
        onSnapshot(doc(db, "users", user.uid), (docSnapshot) => {
            const userData = docSnapshot.data();
            const coins = userData?.coins || 0;
            const t = window.t; // 언어 사용

            const balanceEl = document.getElementById('balance-container');
            if (balanceEl) {
                balanceEl.innerHTML = `
                    <div style="background:linear-gradient(to right, #1e293b, #0f172a); padding:15px; text-align:center; border-bottom:1px solid #334155;">
                        <div style="font-size:0.8rem; color:#94a3b8; letter-spacing:1px; margin-bottom:5px;">CURRENT BALANCE</div>
                        <div style="font-size:1.8rem; font-weight:900; color:#fff; font-family:'Orbitron', sans-serif;">
                            ${coins.toLocaleString()} <span style="font-size:0.9rem; color:#3b82f6;">${t.coins}</span>
                        </div>
                    </div>
                `;
            }
            
            // 현재 활성화된 탭이 있으면 데이터 갱신 (실시간 반영)
            const activeShop = document.getElementById('shop-tab');
            const activeProfile = document.getElementById('profile-tab');
            const activeCoin = document.getElementById('coin-tab'); // [NEW]

            if (activeShop && activeShop.style.display === 'block') renderShop(user);
            if (activeProfile && activeProfile.style.display === 'block') renderProfile(user);
            if (activeCoin && activeCoin.style.display === 'block') renderCoinTab(user); // [NEW]
        });
    } else {
        window.switchView('auth-view');
    }
});
