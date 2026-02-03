import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// [1] 모듈 불러오기
import { firebaseConfig } from './firebase-config.js';
import { renderSingleMenu } from './singlegame.js';
import { renderProfile } from './profile.js';
import { renderShop } from './shop.js';

// [2] Firebase 초기화
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const rtdb = getDatabase(app);

// [3] 전역 변수 설정 (다른 모듈에서 접근 가능하게)
window.lotGoAuth = auth;
window.lotGoDb = db;
window.lotGoRtdb = rtdb;

// [4] 로그인 처리
window.handleLogin = async () => {
    const email = document.getElementById('email').value;
    const pw = document.getElementById('pw').value;
    
    if (!email || !pw) return alert("Please enter email and password.");

    try {
        await signInWithEmailAndPassword(auth, email, pw);
        // 로그인 성공 시 onAuthStateChanged가 자동으로 처리함
    } catch (e) {
        console.error(e);
        alert("Login failed: " + e.message);
    }
};

// [5] 회원가입 처리
window.handleSignUp = async () => {
    const email = document.getElementById('signup-email').value;
    const pw = document.getElementById('signup-pw').value;

    if (!email || !pw) return alert("Please fill in all fields.");
    if (pw.length < 6) return alert("Password must be at least 6 characters.");

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, pw);
        const user = userCredential.user;
        
        // Firestore에 초기 유저 데이터 생성
        await setDoc(doc(db, "users", user.uid), {
            email: user.email,
            coins: 1000, // 가입 보너스
            createdAt: new Date(),
            role: 'user',
            photoURL: 'https://via.placeholder.com/150',
            items: {} // 아이템 인벤토리 초기화
        });
        
        alert("Welcome! You received +1,000 Coins bonus.");
        window.switchView('auth-view'); // 로그인 화면으로 이동
    } catch (e) {
        console.error(e);
        alert("Signup failed: " + e.message);
    }
};

// [6] 화면 전환 (로그인 <-> 회원가입 <-> 로비 <-> 게임)
window.switchView = (viewId) => {
    // 모든 뷰 숨기기
    document.querySelectorAll('.view-container').forEach(el => el.style.display = 'none');
    
    // 타겟 뷰 보이기
    const target = document.getElementById(viewId);
    if (target) {
        // 게임 뷰나 Auth 뷰는 flex, 로비는 block 등 상황에 맞게 표시
        if (viewId === 'game-view' || viewId === 'auth-view' || viewId === 'signup-view') {
            target.style.display = 'flex';
        } else {
            target.style.display = 'block';
        }
        
        // 로비로 돌아올 때 기본 탭(싱글)으로 초기화
        if (viewId === 'lobby-view') {
            window.switchTab('single');
        }
    }
};

// [7] 탭 전환 (싱글 / 온라인 / 상점 / 프로필)
window.switchTab = async (tabName) => {
    // 1. 모든 탭 컨텐츠 숨기기
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    
    // 2. 선택된 탭 보이기
    const targetTab = document.getElementById(`${tabName}-tab`);
    if (targetTab) {
        targetTab.style.display = 'block';
    }

    // 3. 하단 네비게이션 버튼 활성화 스타일 변경
    document.querySelectorAll('.bottom-nav button').forEach(btn => btn.classList.remove('active'));
    const navBtn = document.getElementById(`nav-${tabName}`);
    if (navBtn) navBtn.classList.add('active');

    // 4. 로그인된 유저 정보 가져오기
    const user = auth.currentUser;
    if (!user) return; 

    // 5. 탭별 렌더링 함수 실행
    if (tabName === 'single') {
        // 싱글 게임 메뉴
        renderSingleMenu();
    } 
    else if (tabName === 'shop') {
        // 상점 (유저 정보 필요 - 잔액 표시 등)
        await renderShop(user);
    } 
    else if (tabName === 'profile') {
        // 프로필 (유저 정보 필요)
        await renderProfile(user);
    }
};

// [8] 인증 상태 감지 및 초기화 (앱 시작점)
onAuthStateChanged(auth, (user) => {
    if (user) {
        // 로그인 상태 -> 로비로 이동
        window.switchView('lobby-view');
        
        // 실시간 코인 업데이트 (상단 밸런스 바)
        // 로비 상단에 잔액을 보여주는 리스너 등록
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

            // [추가] 상점이나 프로필이 열려있다면 해당 화면의 정보도 갱신
            // (간단하게 현재 활성화된 탭을 확인해서 재렌더링 할 수도 있음)
            const activeShop = document.getElementById('shop-tab');
            const activeProfile = document.getElementById('profile-tab');
            
            if (activeShop && activeShop.style.display === 'block') {
                renderShop(user);
            }
            if (activeProfile && activeProfile.style.display === 'block') {
                renderProfile(user);
            }
        });

    } else {
        // 로그아웃 상태 -> 로그인 화면으로 이동
        window.switchView('auth-view');
    }
});
