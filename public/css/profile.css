import { ref, get, set, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getStorage, ref as sRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

/**
 * 1. 프로필 메인 렌더링
 */
export async function renderProfile(user) {
    const container = document.getElementById('profile-tab');
    if (!container) return; // 에러 방지

    const db = window.lotGoDb;
    
    // 유저 데이터 가져오기
    const snapshot = await get(ref(db, `users/${user.uid}`));
    const userData = snapshot.val() || {};
    const isAdmin = userData.role === 'admin'; 
    const photoURL = userData.photoURL || 'https://via.placeholder.com/150'; // 기본 이미지 URL 수정 가능
    const items = userData.items || {}; 

    // [수정] 인라인 스타일 제거 -> CSS 클래스 사용
    container.innerHTML = `
        <div class="profile-container">
            
            <div class="profile-header">
                <div class="profile-img-wrapper">
                    <img id="profile-img" src="${photoURL}" alt="Profile">
                    <label for="img-upload" class="camera-icon">📸</label>
                    <input type="file" id="img-upload" style="display:none;" accept="image/*" onchange="uploadProfileImg(this)">
                </div>
                <h3 class="user-email">${user.email}</h3>
                ${isAdmin ? '<span class="admin-badge">[ADMIN ACCOUNT]</span>' : ''}
            </div>

            <div class="section-box item-section">
                <h4 class="section-title">MY ITEMS</h4>
                <div id="my-items-list">
                    ${Object.keys(items).length > 0 
                        ? Object.entries(items).map(([id, qty]) => `<div class="item-tag">${id} x${qty}</div>`).join('') 
                        : '<span class="empty-msg">No items owned.</span>'}
                </div>
            </div>

            <div class="section-box gift-section">
                <h4 class="section-title">GIFT COINS</h4>
                <div class="gift-form">
                    <input type="email" id="recipient-email" class="gift-input" placeholder="Recipient Email">
                    <input type="number" id="gift-amount" class="gift-input" placeholder="Min. 100,000 COINS">
                    <button class="gift-btn" onclick="sendCoinGift(${isAdmin})">SEND GIFT 🎁</button>
                </div>
            </div>

            <button class="logout-btn" onclick="handleLogout()">LOGOUT</button>
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
    const storage = getStorage(); 
    const fileRef = sRef(storage, `profiles/${auth.currentUser.uid}`);

    try {
        alert("Uploading...");
        await uploadBytes(fileRef, file);
        const url = await getDownloadURL(fileRef);
        
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
 */
window.sendCoinGift = async (isAdmin) => {
    const recipientEmail = document.getElementById('recipient-email').value.trim();
    const amount = parseInt(document.getElementById('gift-amount').value);
    const db = window.lotGoDb;
    const senderUid = window.lotGoAuth.currentUser.uid;

    if (!recipientEmail || isNaN(amount)) return alert("Fill all fields.");
    if (!isAdmin && amount < 100000) return alert("Minimum gift amount is 100,000 COINS.");

    try {
        // 발신자 확인
        const senderSnap = await get(ref(db, `users/${senderUid}`));
        const senderCoins = senderSnap.val().coins || 0;
        if (!isAdmin && senderCoins < amount) return alert("Insufficient balance.");

        // 수신자 찾기
        const usersSnap = await get(ref(db, `users`));
        let recipientUid = null;
        usersSnap.forEach((child) => {
            if (child.val().email === recipientEmail) recipientUid = child.key;
        });

        if (!recipientUid) return alert("User not found.");
        if (recipientUid === senderUid) return alert("You cannot gift yourself.");

        // 코인 이동
        if (!isAdmin) {
            await set(ref(db, `users/${senderUid}/coins`), senderCoins - amount);
        }

        const recipientSnap = await get(ref(db, `users/${recipientUid}/coins`));
        const recipientCoins = recipientSnap.val() || 0;
        await set(ref(db, `users/${recipientUid}/coins`), recipientCoins + amount);

        alert(`Successfully gifted ${amount.toLocaleString()} coins!`);
        location.reload();
    } catch (err) {
        console.error(err);
        alert("Transaction failed.");
    }
};

/**
 * 4. 로그아웃 (window 객체에 할당하여 HTML에서 호출 가능하게 함)
 */
window.handleLogout = () => {
    if (confirm("Do you want to logout?")) {
        window.lotGoAuth.signOut().then(() => {
            window.location.reload();
        });
    }
}
