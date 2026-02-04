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
// [가짜 알림 시스템]
// ==========================================
const FakeTicker = {
    names: [
        "DragonSlayer", "BitMaster", "LottoKing", "Lucky777", "MoonWalker", "abc", "rkwk09991", "sksmsi91", "tkfkdgo01", "love01029222",
        "RichPuppy", "GoldMiner", "AcePlayer", "WinningSpirit", "SuperNova", "fhlas", "dkekeddd01177", "qwer01919222", "Asdf03331",
        "CryptoWhale", "JackpotHunter", "SkyHigh", "OceanBlue", "MarsRover", "nice9394812", "QLZP9284", "kdwq2048", "MXNC1102", "vpxl5839", "BTRE4721", "asdf9302", "WOIE8374", "zxcv1192", "PLMK0023", 
        "qwer5564", "NBVC3847", "jhgf7721", "TYUI1029", "mnbv6632", "HJKL4958", "poiu8812", "GAFD3720", "lkjh4490", "REWA0192", "ytre3381", "VCNX7712", "nbvc5504", "OIPU2239", "cxza8827", "LKJH6610", 
        "bvcz4432", "POIU9901", "asdf1123", "QWER5546", "mnbv0098", "ZXCV3384", "ghjk2271", "IUYT7743", "plok1120", "DSFA5562", "trew9948", 
        "NBVC1023", "qazx8872", "LKJH4431", "wsxe0093", "OIUY2284", "edcr5510", "MNBV7732", "rfvt9921", "ASDF1140", "tgbn3384", "POIU6672", "yhnm0019", "QWER4423", "ujmk8857", "ZXCV1190", "ikol2231", 
        "HJKL7746", "olpz5582", "IUYT9903", "mnbv4412", "GAFD1029", "cxza7764", "TREW3381", "vpxl8890", "PLMK2234", "lkjh0012", "NBVC5576", "qwer9931", "TYUI4420", "asdf1182", "WOIE7749", 
        "zxcv5503", "HJKL1021", "poiu3394", "VCNX8872", "nbvc4410", "OIPU9923", "cxza1109", "LKJH7746", "bvcz3321", "POIU0098", "asdf5564", "QWER1120", "mnbv8872", "ZXCV4439", "ghjk0012", 
        "IUYT5584", "plok9910", "DSFA1173", "trew7742", "NBVC4401", "qazx3398", "LKJH0027", "wsxe5512", "OIUY1184", "edcr9930", "MNBV4472", "rfvt0019", "ASDF5562", "tgbn1103", "POIU7748", "yhnm3321", 
        "QWER0094", "ujmk5587", "KLJH0921", "xcnv8827", "POER1134", "lksj5560", "MZNX3391", "poiq0082", "ALSK7741", "zxcv4419", "QWRE8830", "mnba2212", "ZXCV5593", "ghjk1102", "IUYT6674", "plkm3381", 
        "DSFA8820", "trew0094", "NBVC7763", "qazx4412", "LKJH9930", "wsxe1182", "OIUY5571", "edcr4409", "MNBV8823", "rfvt1102", "ASDF6674", "tgbn9931", "POIU2280", "yhnm4412", "QWER7763", "ujmk1109", "ZXCV8821", 
        "ikol4430", "HJKL1129", "olpz9982", "IUYT4410", "mnbv7732", "GAFD4419", "cxza9930", "TREW1182", "vpxl5571", "PLMK8823", "lkjh1102", "NBVC6674", "qwer4431", "TYUI9980", "asdf4412", "WOIE1163", "zxcv9909", 
        "HJKL5521", "poiu4430", "VCNX1129", "nbvc9982", "OIPU4410", "cxza7732", "LKJH4419", "bvcz9930", "POIU1182", "asdf5571", "QWER8823", "mnbv1102", "ZXCV6674", "ghjk4431", "IUYT9980", "plok4412", "DSFA1163", 
        "trew9909", "NBVC5521", "qazx4430", "LKJH1129", "wsxe9982", "OIUY4410", "edcr7732", "MNBV4419", "rfvt9930", "ASDF1182", "tgbn5571", "POIU8823", "yhnm1102", "QWER6674", "ujmk4431", "ZXCV9980", "ikol4412", 
        "HJKL1163", "olpz9909", "IUYT5521", "mnbv4430", "GAFD1129", "cxza9982", "TREW4410", "vpxl7732", "PLMK4419", "lkjh9930", "NBVC1182", "qwer5571", "TYUI8823", "asdf1102", "WOIE6674", "zxcv4431", "HJKL9980", 
        "poiu4412""gkekekdccc01995", "NeonTiger", "CyberPunk", "NightOwl", "MorningStar", "SpeedRacer", "abc12313211", "StarDust", "GalaxyHero", "CosmicRay", "SolarFlare", "Nebula"
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
// [일일 보너스 지급 시스템]
// ==========================================
async function checkDailyBonus(user) {
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);
    
    if (snap.exists()) {
        const data = snap.data();
        const lastDate = data.lastBonusDate || "";
        const today = new Date().toDateString(); // 예: "Wed Feb 04 2026"

        if (lastDate !== today) {
            // 오늘 처음 접속
            await updateDoc(userRef, {
                coins: increment(1000),
                lastBonusDate: today
            });
            
            const t = window.t;
            alert(`🎁 ${t.daily_bonus_title || "DAILY BONUS"} 🎁\n\n+1,000 ${t.coins}`);
        }
    }
}

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
            role: 'user', 
            photoURL: 'images/default-profile.png',
            items: {},
            frames: [],
            myReferralCode: Math.random().toString(36).substring(2, 10).toUpperCase(), 
            referredBy: referralInput,      
            referralCount: 0,
            lastBonusDate: "" // [신규] 보너스 날짜 추적용 필드
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
    if (tabName === 'online') {
        const user = auth.currentUser;
        if (user) {
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

onAuthStateChanged(auth, async (user) => {
    if (user) {
        window.switchView('lobby-view');
        FakeTicker.start();
        
        // [신규] 일일 보너스 체크
        await checkDailyBonus(user);

        onSnapshot(doc(db, "users", user.uid), (docSnapshot) => {
            if (!docSnapshot.exists()) return;

            const userData = docSnapshot.data();
            const coins = userData?.coins || 0;
            const t = window.t;
            
            const navOnline = document.getElementById('nav-online');
            if (navOnline) {
                if (userData.role === 'admin') {
                    navOnline.style.display = 'flex'; 
                } else {
                    navOnline.style.display = 'none'; 
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
