import { ref, get, set, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getStorage, ref as sRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

/**
 * 1. 프로필 메인 렌더링
 * @param {object} user - Firebase Auth 유저 객체
 */
export async function renderProfile(user) {
    const container = document.getElementById('profile-tab');
    const db = window.lotGoDb;
    
    // 유저 데이터 가져오기
    const snapshot = await get(ref(db, `users/${user.uid}`));
    const userData = snapshot.val() || {};
    const coins = userData.coins || 0;
    const isAdmin = userData.role === 'admin'; // Admin 여부 확인
    const photoURL = userData.photoURL || 'images/default-profile.png'; // 기본 이미지
    const items = userData.items || {}; // 보유 아이템 {itemId: count}

    container.innerHTML = `
        <div class="profile-container" style="padding: 20px; color: white; font-family: 'Orbitron';">
            
            <div class="profile-header" style="text-align: center; margin-bottom: 30px;">
                <div style="position: relative; display: inline-block;">
                    <img id="profile-img" src="${photoURL}" style="width: 100px; height: 100px; border-radius: 50%; border: 3px solid #6366f1; object-fit: cover;">
                    <label for="img-upload" style="position: absolute; bottom: 0; right: 0; background: #6366f1; border-radius: 50%; padding: 5px; cursor: pointer; font-size: 12px;">📸</label>
                    <input type="file" id="img-upload" style="display:none;" accept="image/*" onchange="uploadProfileImg(this)">
                </div>
                <h3 style="margin-top: 10px;">${user.email}</h3>
                ${isAdmin ? '<span style="color: #ef4444; font-size: 10px; font-weight: bold;">[ADMIN ACCOUNT]</span>' : ''}
            </div>

            <div class="item-section" style="background: #1e293b; padding: 15px; border-radius: 12px; margin-bottom: 20px;">
                <h4 style="margin-top: 0; font-size: 14px; color: #94a3b8;">MY ITEMS</h4>
                <div id="my-items-list" style="display: flex; gap: 10px; flex-wrap: wrap;">
                    ${Object.keys(items).length > 0 ? 
                        Object.entries(items).map(([id, qty]) => `<div class="item-tag" style="background:#334155; padding:5px 10px; border-radius:20px; font-size:11px;">${id} x${qty}</div>`).join('') 
                        : '<span style="font-size:12px; color:#64748b;">No items owned.</span>'}
                </div>
            </div>

            <div class="gift-section" style="background: #1e293b; padding: 15px; border-radius: 12px;">
                <h4 style="margin-top: 0; font-size: 14px; color: #94a3b8;">GIFT COINS</h4>
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    <input type="email" id="recipient-email" placeholder="Recipient Email" style="background: #0f172a; border: 1px solid #334155; color: white; padding: 10px; border-radius: 8px;">
                    <input type="number" id="gift-amount" placeholder="Min. 100,000 COINS" style="background: #0f172a; border: 1px solid #334155; color: white; padding: 10px; border-radius: 8px;">
                    <button class="main-btn" onclick="sendCoinGift(${isAdmin})" style="background: #10b981; color: white; border: none; padding: 12px; border-radius: 8px; font-weight: 900; cursor: pointer;">SEND GIFT</button>
                </div>
            </div>

            <button onclick="handleLogout()" style="width: 100%; margin-top: 30px; background: none; border: 1px solid #ef4444; color: #ef4444; padding: 10px; border-radius: 8px; cursor: pointer;">LOGOUT</button>
        </div>
    `;
}

/**
 * 2. 프로필 이미지 업로드
 */
window.uploadProfileImg = async (input) => {
    const file = input.files[0];
    if (!file) return;

    const auth = window.lotGoAuth;
    const db = window.lotGoDb;
    const storage = getStorage(); // Firebase Storage 초기화 필요
    const fileRef = sRef(storage, `profiles/${auth.currentUser.uid}`);

    try {
        alert("Uploading...");
        await uploadBytes(fileRef, file);
        const url = await getDownloadURL(fileRef);
        
        // DB에 이미지 URL 저장
        await update(ref(db, `users/${auth.currentUser.uid}`), { photoURL: url });
        document.getElementById('profile-img').src = url;
        alert("Photo updated!");
    } catch (err) {
        console.error(err);
        alert("Upload failed.");
    }
};

/**
 * 3. 코인 선물하기 로직
 * @param {boolean} isAdmin - 어드민 여부
 */
window.sendCoinGift = async (isAdmin) => {
    const recipientEmail = document.getElementById('recipient-email').value.trim();
    const amount = parseInt(document.getElementById('gift-amount').value);
    const db = window.lotGoDb;
    const senderUid = window.lotGoAuth.currentUser.uid;

    if (!recipientEmail || isNaN(amount)) return alert("Fill all fields.");
    if (!isAdmin && amount < 100000) return alert("Minimum gift amount is 100,000 COINS.");

    try {
        // 1. 발신자 잔액 확인 (Admin은 패스)
        const senderSnap = await get(ref(db, `users/${senderUid}`));
        const senderCoins = senderSnap.val().coins || 0;
        if (!isAdmin && senderCoins < amount) return alert("Insufficient balance.");

        // 2. 수신자 찾기 (이메일로 검색 - 전체 유저 순회)
        const usersSnap = await get(ref(db, `users`));
        let recipientUid = null;
        usersSnap.forEach((child) => {
            if (child.val().email === recipientEmail) recipientUid = child.key;
        });

        if (!recipientUid) return alert("User not found.");
        if (recipientUid === senderUid) return alert("You cannot gift yourself.");

        // 3. 트랜잭션 (간이)
        // 발신자 차감 (Admin이 아닐 때만)
        if (!isAdmin) {
            await set(ref(db, `users/${senderUid}/coins`), senderCoins - amount);
        }

        // 수신자 증액
        const recipientSnap = await get(ref(db, `users/${recipientUid}/coins`));
        const recipientCoins = recipientSnap.val() || 0;
        await set(ref(db, `users/${recipientUid}/coins`), recipientCoins + amount);

        alert(`Successfully gifted ${amount.toLocaleString()} coins to ${recipientEmail}!`);
        location.reload();
    } catch (err) {
        console.error(err);
        alert("Transaction failed.");
    }
};

/**
 * 4. 로그아웃
 */
export function handleLogout(auth) {
    if (confirm("Do you want to logout?")) {
        auth.signOut();
    }
}
