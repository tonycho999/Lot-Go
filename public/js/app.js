import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js"; // Realtime DB (필요시)

// 모듈 불러오기
import { firebaseConfig } from './firebase-config.js';
import { renderSingleMenu } from './singlegame.js';
import { renderProfile } from './profile.js'; // [추가] 프로필 모듈

// Firebase 초기화
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const rtdb = getDatabase(app);

// 전역 변수 설정 (다른 파일에서 접근 가능하게)
window.lotGoAuth = auth;
window.lotGoDb = db;
window.lotGoRtdb = rtdb;

// [1] 로그인/회원가입 로직
window.handleLogin = async () => {
    const email = document.getElementById('email').value;
    const pw = document.getElementById('pw').value;
    try {
        await signInWithEmailAndPassword(auth, email, pw);
        // 로그인 성공 시 onAuthStateChanged가 처리함
    } catch (e) {
        alert(e.message);
    }
};

window.handleSignUp = async () => {
    const email = document.getElementById('signup-email').value;
    const pw = document.getElementById('signup-pw').value;
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, pw);
        const user = userCredential.user;
        
        // Firestore에 초기 유저 데이터 생성
        await setDoc(doc(db, "users", user.uid), {
            email: user.email,
            coins: 1000, // 가입 보너스
            createdAt: new Date(),
            role: 'user',
            photoURL: 'https://via.placeholder.com/150'
        });
        
        alert("Welcome! +1,000 Coins");
        window.switchView('auth-view'); // 로그인 화면으로 이동
    } catch (e) {
        alert(e.message);
    }
};

// [2] 뷰 전환 (로그인 <-> 회원가입 <-> 로비 <-> 게임)
window.switchView = (viewId) => {
    document.querySelectorAll('.view-container').forEach(el => el.style.display = 'none');
    const target = document.getElementById(viewId);
    if (target) {
        target.style.display = viewId === 'game-view' ? 'flex' : (viewId === 'auth-view' || viewId === 'signup-view' ? 'flex' : 'block');
        
        // 로비로 갈 때 탭 초기화
        if (viewId === 'lobby-view') {
            window.switchTab('single');
        }
    }
};

// [3] 탭 전환 (싱글 / 온라인 / 상점 / 프로필)
window.switchTab = async (tabName) => {
    // 1. 모든 탭 컨텐츠 숨기기
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    
    // 2. 선택된 탭 보이기
    const targetTab = document.getElementById(`${tabName}-tab`);
    if (targetTab) targetTab.style.display = 'block';

    // 3. 네비게이션 버튼 활성화 상태 변경
    document.querySelectorAll('.bottom-nav button').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`nav-${tabName}`).classList.add('active');

    // [핵심] 4. 탭별 로직 실행
    if (tabName === 'single') {
        renderSingleMenu();
    } else if (tabName === 'profile') {
        const user = auth.currentUser;
        if (user) {
            await renderProfile(user); // 프로필 렌더링 실행
        }
    }
};

// [4] 인증 상태 감지 및 초기화
onAuthStateChanged(auth, (user) => {
    if (user) {
        // 로그인 됨 -> 로비로 이동
        window.switchView('lobby-view');
        
        // 실시간 코인 업데이트 (상단 밸런스 바)
        onSnapshot(doc(db, "users", user.uid), (doc) => {
            const coins = doc.data()?.coins || 0;
            const balanceEl = document.getElementById('balance-container');
            if (balanceEl) {
                balanceEl.innerHTML = `
                    <div style="background:linear-gradient(to right, #1e293b, #0f172a); padding:15px; text-align:center; border-bottom:1px solid #334155;">
                        <div style="font-size:0.8rem; color:#94a3b8; letter-spacing:1px; margin-bottom:5px;">CURRENT BALANCE</div>
                        <div style="font-size:1.8rem; font-weight:900; color:#fff; font-family:'Orbitron';">
                            ${coins.toLocaleString()} <span style="font-size:0.9rem; color:#3b82f6;">COINS</span>
                        </div>
                    </div>
                `;
            }
        });
    } else {
        // 로그아웃 됨 -> 로그인 화면으로
        window.switchView('auth-view');
    }
});
