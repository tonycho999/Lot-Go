import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc, onSnapshot, collection, query, where, getDocs, updateDoc, increment, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

import { firebaseConfig } from './firebase-config.js';
import { renderSingleMenu } from './singlegame.js';
import { renderProfile } from './profile.js';
import { renderShop } from './shop.js';
import { renderOnlineLobby } from './online-lobby.js';
import { initLanguage } from './lang.js';
import { renderCoinTab } from './coin.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const rtdb = getDatabase(app);

window.lotGoAuth = auth;
window.lotGoDb = db;
window.lotGoRtdb = rtdb;
window.t = initLanguage();

// ==========================================
// [동기화된 가짜 알림 시스템]
// ==========================================
const FakeTicker = {
    names: [
        "DragonSlayer", "BitMaster", "LottoKing", "Lucky777", "MoonWalker",
        "RichPuppy", "GoldMiner", "AcePlayer", "WinningSpirit", "SuperNova",
        "CryptoWhale", "JackpotHunter", "SkyHigh", "OceanBlue", "MarsRover",
        "NeonTiger", "CyberPunk", "NightOwl", "MorningStar", "SpeedRacer",
        "StarDust", "GalaxyHero", "CosmicRay", "SolarFlare", "Nebula"
    ],
    seededRandom: function(seed) {
        var x = Math.sin(seed++) * 10000;
        return x - Math.floor(x);
    },
    generateMessage: function() {
        const now = Date.now();
        const timeBlock = Math.floor(now / 10000); 
        const rand = this.seededRandom(timeBlock);
        
        if (rand > 0.3) return null; 

        const nameIndex = Math.floor(this.seededRandom(timeBlock + 1) * this.names.length);
        const name = this.names[nameIndex];
        const amountBase = Math.floor(this.seededRandom(timeBlock + 2) * 500) + 5; 
        const amount = amountBase * 10000; 
        const isJackpot = this.seededRandom(timeBlock + 3) > 0.99; 

        return { name, amount, isJackpot };
    },
    start: function() {
        setInterval(() => {
            const msgData = this.generateMessage();
            if (msgData) this.show(msgData);
        }, 10000); 
    },
    show: function(data) {
        const tickerEl = document.getElementById('notification-msg');
        if (!tickerEl) return;

        const amountStr = data.amount.toLocaleString();
        let html = '';
        if (data.isJackpot) {
            html = `<span class="jackpot-msg">🎰 JACKPOT! [${data.name}] won ${amountStr} C! 🎰</span>`;
        } else {
            html = `🎉 <span style="color:#fbbf24; font-weight:bold;">${data.name}</span> won <span style="color:#4ade80; font-weight:bold;">${amountStr} C</span>! Congrats!`;
        }
        tickerEl.innerHTML = html;
        tickerEl.classList.add('show');
        setTimeout(() => { if(tickerEl) tickerEl.classList.remove('show'); }, 6000);
    }
};

// ==========================================
// [메인 로직]
// ==========================================

renderAuthScreens();

function renderAuthScreens() {
    const t = window.t;
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
        await signInWithEmailAndPassword(auth, userDoc.email, pw);
    } catch (e) { console.error(e); alert("Login failed: " + e.message); }
};

window.handleSignUp = async () => {
    const email = document.getElementById('signup-email').value.trim();
    const username = document.getElementById('signup-username').value.trim();
    const pw = document.getElementById('signup-pw').value;
    const pwConfirm = document.getElementById('signup-pw-confirm').value;
    const referralInput = document.getElementById('signup-referral').value.trim();

    if (!email || !username || !pw || !pwConfirm || !referralInput) return alert("Please fill in all fields.");
    if (pw !== pwConfirm) return alert("Passwords do not match.");

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

        const userCredential = await createUserWithEmailAndPassword(auth, email, pw);
        const user = userCredential.user;
        
        await setDoc(doc(db, "users", user.uid), {
            email: user.email,
            username: username,         
            coins: 3000,
            exp: 0,
            level: 10,
            createdAt: new Date(),
            role: 'user', // 기본값은 'user'
            photoURL: 'images/default-profile.png',
            items: {},
            frames: [],
            myReferralCode: Math.random().toString(36).substring(2, 10).toUpperCase(), 
            referredBy: referralInput,      
            referralCount: 0                
        });

        if (referrerUid) {
            await updateDoc(doc(db, "users", referrerUid), { 
                referralCount: increment(1),
                exp: increment(1000)
            });
        }
        alert(`Welcome, ${username}!`);
        window.switchView('auth-view'); 
    } catch (e) { console.error(e); alert("Signup failed: " + e.message); }
};

window.switchView = (viewId) => {
    document.querySelectorAll('.view-container').forEach(el => el.style.display = 'none');
    const target = document.getElementById(viewId);
    if (target) {
        target.style.display = (viewId === 'game-view' || viewId === 'auth-view' || viewId === 'signup-view') ? 'flex' : 'block';
        if (viewId === 'lobby-view') window.switchTab('single');
    }
};

window.switchTab = async (tabName) => {
    // [보안 수정] ONLINE 탭은 레벨 0(관리자)만 접근 가능
    if (tabName === 'online') {
        const user = auth.currentUser;
        if (user) {
            // Firestore에서 최신 유저 정보 확인
            const snap = await getDoc(doc(db, "users", user.uid));
            if (snap.exists()) {
                const data = snap.data();
                if (data.role !== 'admin') {
                    return alert("접근 권한이 없습니다. (Level 0 전용)");
                }
            }
        }
    }

    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    const targetTab = document.getElementById(`${tabName}-tab`);
    if (targetTab) {
        targetTab.style.display = 'block';
        const scrollContainer = document.querySelector('.tab-system');
        if (scrollContainer) scrollContainer.scrollTop = 0;
    }

    document.querySelectorAll('.bottom-nav button').forEach(btn => btn.classList.remove('active'));
    const navBtn = document.getElementById(`nav-${tabName}`);
    if (navBtn) navBtn.classList.add('active');

    const user = auth.currentUser;
    if (!user) return; 

    if (tabName === 'single') renderSingleMenu();
    else if (tabName === 'online') renderOnlineLobby();
    else if (tabName === 'shop') await renderShop(user);
    else if (tabName === 'coin') await renderCoinTab(user);
    else if (tabName === 'profile') await renderProfile(user);
};

onAuthStateChanged(auth, (user) => {
    if (user) {
        window.switchView('lobby-view');
        FakeTicker.start();

        onSnapshot(doc(db, "users", user.uid), (docSnapshot) => {
            if (!docSnapshot.exists()) return;

            const userData = docSnapshot.data();
            const coins = userData?.coins || 0;
            const t = window.t;
            
            // [UI 제어] 레벨 0(admin)이 아니면 ONLINE 버튼 숨기기
            const navOnline = document.getElementById('nav-online');
            if (navOnline) {
                if (userData.role === 'admin') {
                    navOnline.style.display = 'flex'; // 원래 스타일대로 보임
                } else {
                    navOnline.style.display = 'none'; // 숨김
                }
            }

            const balanceEl = document.getElementById('balance-container');
            if (balanceEl) {
                balanceEl.innerHTML = `
                    <div class="balance-wrapper">
                        <div class="balance-label">CURRENT BALANCE</div>
                        <div class="balance-amount">
                            ${coins.toLocaleString()} <span style="font-size:0.9rem; color:#3b82f6;">${t.coins}</span>
                        </div>
                    </div>
                    <div class="notification-ticker">
                        <div id="notification-msg" class="ticker-text"></div>
                    </div>
                `;
            }
            
            const activeShop = document.getElementById('shop-tab');
            const activeProfile = document.getElementById('profile-tab');
            const activeCoin = document.getElementById('coin-tab');

            if (activeShop && activeShop.style.display === 'block') renderShop(user);
            if (activeProfile && activeProfile.style.display === 'block') renderProfile(user);
            if (activeCoin && activeCoin.style.display === 'block') renderCoinTab(user);
        });
    } else {
        window.switchView('auth-view');
    }
});

function setScreenSize() {
    let vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
}
window.addEventListener('resize', setScreenSize);
setScreenSize();
