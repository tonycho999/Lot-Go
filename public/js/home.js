import { ref, get, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

/**
 * 1. 잔액 및 유저 정보 렌더링 (CURRENT BALANCE)
 * @param {number} coins - 유저의 현재 코인 수
 */
export function renderBalance(coins) {
    const container = document.getElementById('balance-container');
    if (!container) return;

    container.innerHTML = `
        <div class="balance-card" style="background: #1e293b; padding: 20px; border-radius: 16px; text-align: center; margin-bottom: 20px; border: 1px solid #334155;">
            <small style="color: #94a3b8; font-size: 10px; display: block; margin-bottom: 5px; letter-spacing: 1px;">CURRENT BALANCE</small>
            <div style="font-size: 28px; font-weight: 900; color: #6366f1; font-family: 'Orbitron';">
                ${coins.toLocaleString()} <span style="font-size: 14px; color: #94a3b8;">COINS</span>
            </div>
        </div>
        
        <button id="ad-btn" onclick="handleAdWatch()" class="main-btn" style="background: #fbbf24; color: #000; margin-bottom: 20px; font-weight: 900; font-size: 12px; border-radius: 8px; border: none; padding: 12px; width: 100%; cursor: pointer;">
            📺 WATCH AD (+300 COINS)
        </button>
    `;
}

/**
 * 2. 탭 전환 시스템 (SINGLE, ONLINE, SHOP, PROFILE)
 * @param {string} tabName - 전환할 탭의 아이디 (예: 'single')
 */
export function switchTab(tabName) {
    const tabs = ['single', 'online', 'shop', 'profile'];
    
    tabs.forEach(t => {
        const el = document.getElementById(`${t}-tab`);
        if (el) {
            // 선택된 탭만 표시하고 나머지는 숨김
            el.style.display = (t === tabName) ? 'block' : 'none';
        }
    });

    // 탭 전환 시 시각적 피드백이나 추가 로그가 필요하면 여기에 작성
    console.log(`Switched to ${tabName.toUpperCase()} tab`);
}

/**
 * 3. 광고 보상 처리 (300 코인 지급 및 10분 쿨타임)
 * 전역 윈도우 객체에 바인딩하여 HTML에서 바로 호출 가능하게 합니다.
 */
window.handleAdWatch = async () => {
    // app.js에서 초기화된 auth와 db 객체에 접근 (window 객체 활용 권장)
    const user = window.lotGoAuth.currentUser;
    const db = window.lotGoDb;
    
    if (!user) return alert("Please login first!");

    const userRef = ref(db, `users/${user.uid}`);
    
    try {
        const snapshot = await get(userRef);
        const userData = snapshot.val();
        
        // 오늘 날짜 확인 (10회 제한용)
        const today = new Date().toLocaleDateString();
        let adCount = (userData.lastAdDate === today) ? (userData.adCount || 0) : 0;

        if (adCount >= 10) {
            alert("Daily limit (10 times) reached!");
            return;
        }

        // 보상 지급
        const currentCoins = userData.coins || 0;
        await set(ref(db, `users/${user.uid}/coins`), currentCoins + 300);
        await set(ref(db, `users/${user.uid}/adCount`), adCount + 1);
        await set(ref(db, `users/${user.uid}/lastAdDate`), today);

        alert("Success! 300 COINS added.");

        // 버튼 10분간 숨기기
        const adBtn = document.getElementById('ad-btn');
        if (adBtn) {
            adBtn.style.display = 'none';
            setTimeout(() => {
                adBtn.style.display = 'block';
            }, 10 * 60 * 1000); // 10 minutes
        }
    } catch (error) {
        console.error("Ad reward failed:", error);
    }
};
