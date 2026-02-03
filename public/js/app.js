import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
// [수정] getDoc 추가됨
import { getFirestore, doc, setDoc, onSnapshot, collection, query, where, getDocs, updateDoc, increment, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// [1] 모듈 불러오기
import { firebaseConfig } from './firebase-config.js';
import { renderSingleMenu } from './singlegame.js';
import { renderProfile } from './profile.js';
import { renderShop } from './shop.js';
import { renderOnlineLobby } from './online-lobby.js';

// [2] Firebase 초기화
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const rtdb = getDatabase(app);

window.lotGoAuth = auth;
window.lotGoDb = db;
window.lotGoRtdb = rtdb;

// [3] 로그인 처리
window.handleLogin = async () => {
    const username = document.getElementById('login-username').value.trim();
    const pw = document.getElementById('login-pw').value;
    
    if (!username || !pw) return alert("Please enter username and password.");

    try {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("username", "==", username));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            return alert("Username not found.");
        }

        const userDoc = querySnapshot.docs[0].data();
        const email = userDoc.email;

        await signInWithEmailAndPassword(auth, email, pw);
    } catch (e) {
        console.error(e);
        alert("Login failed: " + e.message);
    }
};

// [4] 회원가입 처리
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

        // 중복 체크
        const userCheckQ = query(usersRef, where("username", "==", username));
        const userCheckSnap = await getDocs(userCheckQ);
        if (!userCheckSnap.empty) return alert("Username already exists.");

        // 추천인 코드 확인
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
        
        // 초기 데이터 (레벨 10 시작)
        await setDoc(doc(db, "users", user.uid), {
            email: user.email,
            username: username,         
            coins: 3000,
            exp: 0,
            level: 10, // 초기 레벨
            createdAt: new Date(),
            role: 'user',
            photoURL: 'https://via.placeholder.com/150',
            items: {},
            frames: [],
            myReferralCode: myReferralCode, 
            referredBy: referralInput,      
            referralCount: 0                
        });

        // [수정] 추천인 보상 지급 (레벨 확인 후 XP 지급 여부 결정)
        if (referrerUid) {
            const referrerRef = doc(db, "users", referrerUid);
            const refSnap = await getDoc(referrerRef);
            
            if (refSnap.exists()) {
                const refData = refSnap.data();
                // 레벨 데이터가 없으면 10으로 간주
                const refLevel = refData.level !== undefined ? refData.level : 10; 
                // 운영자(0) 인지 확인 (role이 admin이면 level은 0이어야 함)
                const refRole = refData.role || 'user';

                let updates = {
                    referralCount: increment(1) // 추천 수는 무조건 증가
                };

                // XP 지급 조건: 레벨이 1보다 크고, 운영자가 아닐 때 (즉, Lv 2~10)
                // Lv 1(GOD)과 Lv 0(Admin)은 XP 증가 안 함
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
    else if (tabName === 'profile') await renderProfile(user);
};

onAuthStateChanged(auth, (user) => {
    if (user) {
        window.switchView('lobby-view');
        onSnapshot(doc(db, "users", user.uid), (docSnapshot) => {
            const userData = docSnapshot.data();
            const coins = userData?.coins || 0;
            
            const balanceEl = document.getElementById('balance-container');
            if (balanceEl) {
                balanceEl.innerHTML = `
                    <div style="background:linear-gradient(to right, #1e293b, #0f172a); padding:15px; text-align:center; border-bottom:1px solid #334155;">
                        <div style="font-size:0.8rem; color:#94a3b8; letter-spacing:1px; margin-bottom:5px;">CURRENT BALANCE</div>
                        <div style="font-size:1.8rem; font-weight:900; color:#fff; font-family:'Orbitron', sans-serif;">
                            ${coins.toLocaleString()} <span style="font-size:0.9rem; color:#3b82f6;">COINS</span>
                        </div>
                    </div>
                `;
            }
            
            const activeShop = document.getElementById('shop-tab');
            const activeProfile = document.getElementById('profile-tab');
            if (activeShop && activeShop.style.display === 'block') renderShop(user);
            if (activeProfile && activeProfile.style.display === 'block') renderProfile(user);
        });
    } else {
        window.switchView('auth-view');
    }
});
