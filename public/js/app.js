import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc, onSnapshot, collection, query, where, getDocs, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
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

// [3] 로그인 처리 (Username -> Email 조회 -> Auth 로그인)
window.handleLogin = async () => {
    const username = document.getElementById('login-username').value.trim();
    const pw = document.getElementById('login-pw').value;
    
    if (!username || !pw) return alert("Please enter username and password.");

    try {
        // 1. Username으로 Email 찾기
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("username", "==", username));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            return alert("Username not found.");
        }

        const userDoc = querySnapshot.docs[0].data();
        const email = userDoc.email;

        // 2. 찾은 Email로 로그인
        await signInWithEmailAndPassword(auth, email, pw);
        // onAuthStateChanged가 처리함
    } catch (e) {
        console.error(e);
        alert("Login failed: " + e.message);
    }
};

// [4] 회원가입 처리 (필드 검증 및 레퍼럴 로직)
window.handleSignUp = async () => {
    const email = document.getElementById('signup-email').value.trim();
    const username = document.getElementById('signup-username').value.trim();
    const pw = document.getElementById('signup-pw').value;
    const pwConfirm = document.getElementById('signup-pw-confirm').value;
    const referralInput = document.getElementById('signup-referral').value.trim();

    // 1. 기본 유효성 검사
    if (!email || !username || !pw || !pwConfirm || !referralInput) {
        return alert("Please fill in all fields.");
    }
    if (pw !== pwConfirm) return alert("Passwords do not match.");
    if (pw.length < 6) return alert("Password must be at least 6 characters.");

    try {
        const usersRef = collection(db, "users");

        // 2. Username 중복 확인
        const userCheckQ = query(usersRef, where("username", "==", username));
        const userCheckSnap = await getDocs(userCheckQ);
        if (!userCheckSnap.empty) return alert("Username already exists. Choose another.");

        // 3. Referral Code 유효성 확인
        let referrerUid = null;
        
        // **[중요]** 최초 가입자를 위해 'ADMIN' 코드는 무조건 통과시킴
        if (referralInput !== "ADMIN") {
            const refCheckQ = query(usersRef, where("myReferralCode", "==", referralInput));
            const refCheckSnap = await getDocs(refCheckQ);
            
            if (refCheckSnap.empty) {
                return alert("Invalid Referral Code. You cannot sign up without a valid code.");
            }
            referrerUid = refCheckSnap.docs[0].id; // 추천인 UID 저장
        }

        // 4. 내 Referral Code 생성 (랜덤 8자리)
        const myReferralCode = generateReferralCode();

        // 5. Firebase Auth 유저 생성
        const userCredential = await createUserWithEmailAndPassword(auth, email, pw);
        const user = userCredential.user;
        
        // 6. Firestore에 데이터 저장 (코인 3000으로 변경됨)
        await setDoc(doc(db, "users", user.uid), {
            email: user.email,
            username: username,         
            coins: 3000,                    // [수정] 가입 보너스 3000C
            createdAt: new Date(),
            role: 'user',
            photoURL: 'https://via.placeholder.com/150',
            items: {},
            myReferralCode: myReferralCode, 
            referredBy: referralInput,      
            referralCount: 0                
        });

        // 7. 추천인의 카운트 증가 (ADMIN이 아닐 경우)
        if (referrerUid) {
            const referrerRef = doc(db, "users", referrerUid);
            await updateDoc(referrerRef, {
                referralCount: increment(1)
            });
        }
        
        alert(`Welcome, ${username}! You received +3,000 Coins!`); // 메시지 수정됨
        window.switchView('auth-view'); 

    } catch (e) {
        console.error(e);
        alert("Signup failed: " + e.message);
    }
};

// 랜덤 코드 생성 함수 (영문+숫자 8자리)
function generateReferralCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// [5] 화면 전환
window.switchView = (viewId) => {
    document.querySelectorAll('.view-container').forEach(el => el.style.display = 'none');
    const target = document.getElementById(viewId);
    if (target) {
        if (viewId === 'game-view' || viewId === 'auth-view' || viewId === 'signup-view') {
            target.style.display = 'flex';
        } else {
            target.style.display = 'block';
        }
        if (viewId === 'lobby-view') window.switchTab('single');
    }
};

// [6] 탭 전환
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

// [7] Auth 상태 감지
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
