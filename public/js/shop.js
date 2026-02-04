import { doc, getDoc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// [상점 아이템 목록 정의]
// id는 singlegame.js에서 사용하는 키값과 일치해야 합니다.
export const SHOP_ITEMS = [
    {
        id: "free_pass",
        type: "daily", // 일일 제한 아이템
        name_key: "item_free_pass_name",
        desc_key: "item_free_pass_desc",
        price: 0,
        icon: "🎟️"
    },
    {
        id: "discount_50",
        type: "consumable", // 소모품
        name_key: "item_discount_50_name",
        desc_key: "item_discount_50_desc",
        price: 200,
        icon: "🏷️"
    },
    {
        id: "double_ticket",
        type: "consumable",
        name_key: "item_double_name",
        desc_key: "item_double_desc",
        price: 300,
        icon: "🎫"
    },
    {
        id: "insurance_ticket",
        type: "consumable",
        name_key: "item_insurance_name",
        desc_key: "item_insurance_desc",
        price: 300,
        icon: "🛡️"
    },
    {
        id: "hint_spyglass",
        type: "consumable",
        name_key: "item_spyglass_name",
        desc_key: "item_spyglass_desc",
        price: 3000,
        icon: "🔭"
    },
    {
        id: "xp_booster_1h",
        type: "buff", // 즉시 발동형 버프
        name_key: "item_xp_boost_name",
        desc_key: "item_xp_boost_desc",
        price: 1000,
        icon: "⚡"
    },
    {
        id: "skin_gold",
        type: "skin", // 영구 소장형 스킨
        name_key: "item_skin_gold_name",
        desc_key: "item_skin_gold_desc",
        price: 5000,
        icon: "🟡"
    }
];

// [메인 렌더링 함수] - app.js에서 이 함수를 import 합니다.
export async function renderShop(user) {
    const container = document.getElementById('shop-tab');
    if (!container) return;
    const t = window.t;

    // 유저 최신 정보 가져오기 (보유 코인, 아이템 등)
    const userRef = doc(window.lotGoDb, "users", user.uid);
    const snap = await getDoc(userRef);
    const userData = snap.data();
    
    const items = userData.items || {};
    const lastFreePass = userData.lastFreePassDate || "";
    const today = new Date().toDateString(); // "Wed Feb 04 2026" 형식

    let html = `
        <div class="shop-container" style="padding: 20px; max-width: 600px; margin: 0 auto;">
            <h2 class="section-title" style="text-align:center; color:#f59e0b; font-family:'Orbitron'; margin-bottom:20px;">
                ${t.shop_title}
            </h2>
            <div class="shop-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 15px;">
    `;

    SHOP_ITEMS.forEach(item => {
        const ownedQty = items[item.id] || 0;
        let btnState = "";
        let btnText = `${item.price.toLocaleString()} C`;

        // 버튼 상태 처리 로직
        if (item.type === 'skin' && ownedQty > 0) {
            // 스킨은 하나만 있으면 됨
            btnState = "disabled style='opacity:0.5; cursor:not-allowed;'";
            btnText = t.already_owned;
        } else if (item.type === 'daily' && lastFreePass === today) {
            // 일일 제한 아이템
            btnState = "disabled style='opacity:0.5; cursor:not-allowed;'";
            btnText = "Today Limit (1/1)";
        }

        html += `
            <div class="shop-card" style="background:rgba(30, 41, 59, 0.6); border:1px solid #334155; border-radius:12px; padding:15px; display:flex; flex-direction:column; align-items:center; text-align:center;">
                <div class="shop-icon" style="font-size:2.5rem; margin-bottom:10px;">${item.icon}</div>
                <div class="shop-info" style="flex:1; margin-bottom:10px;">
                    <div class="shop-name" style="color:#fff; font-weight:bold; margin-bottom:5px;">${t[item.name_key]}</div>
                    <div class="shop-desc" style="color:#94a3b8; font-size:0.8rem; margin-bottom:5px;">${t[item.desc_key]}</div>
                    <div class="shop-stock" style="color:#4ade80; font-size:0.8rem;">${t.owned}: ${ownedQty}</div>
                </div>
                <button class="neon-btn secondary shop-btn" ${btnState} onclick="buyItem('${item.id}')" style="width:100%;">
                    ${btnText}
                </button>
            </div>
        `;
    });

    html += `</div></div>`;
    container.innerHTML = html;
}

// [아이템 구매 함수] - HTML onclick에서 호출되므로 window에 등록
window.buyItem = async (itemId) => {
    const db = window.lotGoDb;
    const auth = window.lotGoAuth;
    const t = window.t;
    const user = auth.currentUser;
    if (!user) return;

    const item = SHOP_ITEMS.find(i => i.id === itemId);
    if (!item) return;

    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);
    const userData = snap.data();
    
    // 1. 코인 부족 체크 (무료 아이템은 패스)
    if (item.price > 0 && userData.coins < item.price) {
        return alert(t.alert_no_coin);
    }

    // 2. 구매 확인 (무료는 확인 없이 즉시 구매)
    if (item.price > 0) {
        if (!confirm(`${t.buy_btn} ${t[item.name_key]}? (-${item.price} C)`)) return;
    }

    const updates = {
        coins: increment(-item.price)
    };

    // 3. 아이템별 처리 로직
    if (item.type === 'buff') { // XP 부스터
        const now = Date.now();
        const oneHour = 60 * 60 * 1000;
        // 기존 시간이 남았으면 연장, 아니면 새로 시작
        const currentEnd = userData.xpBoostEnd || 0;
        const newEnd = (currentEnd > now ? currentEnd : now) + oneHour;
        updates.xpBoostEnd = newEnd;
    } 
    else if (item.type === 'daily') { // 무료 입장권 (일일 제한)
        updates[`items.${itemId}`] = increment(1);
        updates.lastFreePassDate = new Date().toDateString();
    }
    else if (item.type === 'skin') { // 스킨 (1개 고정)
        updates[`items.${itemId}`] = 1; 
    } 
    else {
        updates[`items.${itemId}`] = increment(1); // 일반 소모품
    }

    try {
        await updateDoc(userRef, updates);
        alert(t.buy_success);
        
        // UI 갱신 (다시 그리기)
        renderShop(user);
    } catch (e) {
        console.error("Purchase Error:", e);
        alert("Transaction failed.");
    }
};
