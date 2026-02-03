import { doc, getDoc, updateDoc, increment, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 아이템 목록 정의
const ITEMS = [
    {
        id: 'item_double',
        icon: '🎟️',
        cost: 500,
        nameKey: 'item_double_name', // lang.js의 키값
        descKey: 'item_double_desc'  // lang.js의 키값
    }
    // 추후 아이템 추가 가능
];

export async function renderShop(user) {
    const container = document.getElementById('shop-tab');
    if (!container) return;
    const t = window.t; // 언어 변수

    // 실시간 보유량 확인을 위한 리스너
    const userRef = doc(window.lotGoDb, "users", user.uid);
    
    // UI 기본 틀
    container.innerHTML = `
        <div class="shop-container" style="max-width:600px; margin:0 auto; padding:20px; color:#fff;">
            <h2 style="text-align:center; font-family:'Orbitron'; color:#fbbf24; margin-bottom:30px;">
                ${t.shop_title}
            </h2>
            <div id="shop-items-list" style="display:flex; flex-direction:column; gap:15px;">
                </div>
        </div>
    `;

    // 실시간 데이터 연동
    onSnapshot(userRef, (snapshot) => {
        const userData = snapshot.data();
        const myItems = userData.items || {};
        const myCoins = userData.coins || 0;
        
        const listEl = document.getElementById('shop-items-list');
        if(!listEl) return;

        listEl.innerHTML = ITEMS.map(item => {
            const ownedCount = myItems[item.id] || 0;
            const itemName = t[item.nameKey]; // 언어 적용
            const itemDesc = t[item.descKey]; // 언어 적용

            return `
                <div class="shop-item-card" style="background:#1e293b; padding:20px; border-radius:15px; border:1px solid #334155; display:flex; align-items:center; justify-content:space-between;">
                    <div style="display:flex; align-items:center; gap:15px;">
                        <div style="font-size:2.5rem;">${item.icon}</div>
                        <div>
                            <div style="font-weight:bold; font-size:1.1rem; color:#fff;">${itemName}</div>
                            <div style="font-size:0.8rem; color:#94a3b8;">${itemDesc}</div>
                            <div style="font-size:0.8rem; color:#fbbf24; margin-top:5px;">${t.owned}: ${ownedCount}</div>
                        </div>
                    </div>
                    <button class="neon-btn" style="padding:10px 20px; font-size:0.9rem;" 
                        onclick="buyItem('${item.id}', ${item.cost}, '${itemName}')">
                        <div style="font-size:0.8rem;">${t.buy_btn}</div>
                        <div style="font-weight:bold;">${item.cost.toLocaleString()} C</div>
                    </button>
                </div>
            `;
        }).join('');
    });
}

// 아이템 구매 함수 (window에 등록)
window.buyItem = async (itemId, cost, itemName) => {
    const db = window.lotGoDb;
    const auth = window.lotGoAuth;
    const user = auth.currentUser;
    const t = window.t;

    if (!user) return;

    if (!confirm(`${t.buy_confirm} ${cost} C?`)) return;

    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);
    const userData = snap.data();

    if (userData.coins < cost) {
        return alert(t.alert_no_coin);
    }

    try {
        await updateDoc(userRef, {
            coins: increment(-cost),
            [`items.${itemId}`]: increment(1)
        });
        alert(`${t.buy_success}`);
    } catch (e) {
        console.error(e);
        alert("Error: " + e.message);
    }
};
