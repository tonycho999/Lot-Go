import { doc, getDoc, updateDoc, increment, runTransaction } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 판매할 아이템 목록 정의
const SHOP_ITEMS = [
    {
        id: 'double_prize',
        name: 'Double Prize',
        icon: '💎',
        desc: '승리 시 획득 상금 2배 (1회용)',
        price: 500
    },
    {
        id: 'hint_card',
        name: 'Magic Hint',
        icon: '🔮',
        desc: '꽝 카드 1개를 미리 알려줍니다.',
        price: 300
    },
    {
        id: 'safety_shield',
        name: 'Shield',
        icon: '🛡️',
        desc: '한 번의 틀린 선택을 방어합니다.',
        price: 1000
    }
];

/**
 * 상점 렌더링 함수
 */
export async function renderShop(user) {
    const container = document.getElementById('shop-tab');
    if (!container) return;

    // 현재 코인 잔액 확인을 위해 DB 조회 (선택사항, UI 갱신용)
    // 실제 구매 시에는 트랜잭션 내에서 다시 확인하므로 여기선 표시용입니다.
    const db = window.lotGoDb;
    const userDoc = await getDoc(doc(db, "users", user.uid));
    const currentCoins = userDoc.data()?.coins || 0;

    container.innerHTML = `
        <div class="shop-container">
            <div class="shop-header">
                <h2 class="shop-title">ITEM SHOP</h2>
                <p class="shop-desc">Upgrade your game with special items!</p>
                <div style="margin-top:10px; color:#fbbf24; font-weight:bold;">
                    Your Balance: ${currentCoins.toLocaleString()} C
                </div>
            </div>
            
            <div class="item-list">
                ${SHOP_ITEMS.map(item => `
                    <div class="item-card">
                        <div class="item-icon">${item.icon}</div>
                        <div class="item-name">${item.name}</div>
                        <div class="item-desc">${item.desc}</div>
                        <button class="buy-btn" onclick="buyItem('${item.id}')">
                            ${item.price.toLocaleString()} C
                        </button>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

/**
 * 아이템 구매 로직 (Window 객체에 등록)
 */
window.buyItem = async (itemId) => {
    const item = SHOP_ITEMS.find(i => i.id === itemId);
    if (!item) return alert("Item not found.");

    if (!confirm(`Buy [${item.name}] for ${item.price} Coins?`)) return;

    const db = window.lotGoDb;
    const auth = window.lotGoAuth;
    const user = auth.currentUser;
    const userRef = doc(db, "users", user.uid);

    try {
        await runTransaction(db, async (transaction) => {
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists()) throw "User data error";

            const currentCoins = userDoc.data().coins || 0;
            const currentItems = userDoc.data().items || {};
            const currentItemCount = currentItems[itemId] || 0;

            // 잔액 확인
            if (currentCoins < item.price) {
                throw "Not enough coins!";
            }

            // 업데이트: 코인 차감 & 아이템 개수 증가
            transaction.update(userRef, {
                coins: currentCoins - item.price,
                [`items.${itemId}`]: currentItemCount + 1
            });
        });

        alert(`Successfully bought ${item.name}!`);
        // 상점 UI 갱신 (잔액 업데이트 등을 위해)
        renderShop(user);

    } catch (err) {
        console.error(err);
        alert(err === "Not enough coins!" ? "코인이 부족합니다!" : "Transaction failed. Try again.");
    }
};
