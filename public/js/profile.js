import { getStorage, ref as sRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { doc, getDoc, updateDoc, collection, getDocs, runTransaction } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// [1] 프로필 렌더링
export async function renderProfile(user) {
    const container = document.getElementById('profile-tab');
    if (!container) return;

    try {
        const db = window.lotGoDb;
        
        // Firestore에서 유저 데이터 가져오기
        const userDocRef = doc(db, "users", user.uid);
        const snapshot = await getDoc(userDocRef);
        
        // 데이터가 없어도 에러 안 나게 기본값 설정
        const userData = snapshot.exists() ? snapshot.data() : {};
        
        const isAdmin = userData.role === 'admin'; 
        const photoURL = userData.photoURL || 'images/default-profile.png'; 
        const items = userData.items || {}; 

        container.innerHTML = `
            <div class="profile-container">
                <div class="profile-header">
                    <div class="profile-img-wrapper">
                        <img id="profile-img" src="${photoURL}" onerror="this.src='images/default-profile.png'" alt="Profile">
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
    } catch (err) {
        console.error("Profile Render Error:", err);
        container.innerHTML = `<div style="text-align:center; padding:30px; color:red;"><h3>Error Loading Profile</h3><p>${err.message}</p></div>`;
    }
}

// [2] 이미지 업로드
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
        
        await updateDoc(doc(db, "users", auth.currentUser.uid), { photoURL: url });
        document.getElementById('profile-img').src = url;
        alert("Photo updated!");
    } catch (err) {
        console.error(err);
        alert("Upload failed. (Storage 설정 확인 필요)");
    }
};

// [3] 선물하기
window.sendCoinGift = async (isAdmin) => {
    const recipientEmail = document.getElementById('recipient-email').value.trim();
    const amount = parseInt(document.getElementById('gift-amount').value);
    const db = window.lotGoDb;
    const senderUid = window.lotGoAuth.currentUser.uid;

    if (!recipientEmail || isNaN(amount)) return alert("Fill all fields.");
    if (!isAdmin && amount < 100000) return alert("Minimum gift amount is 100,000 COINS.");

    try {
        const usersSnap = await getDocs(collection(db, "users"));
        let recipientUid = null;
        usersSnap.forEach((doc) => {
            if (doc.data().email === recipientEmail) recipientUid = doc.id;
        });

        if (!recipientUid) return alert("User not found.");
        if (recipientUid === senderUid) return alert("You cannot gift yourself.");

        await runTransaction(db, async (transaction) => {
            const senderDoc = await transaction.get(doc(db, "users", senderUid));
            const recipientDoc = await transaction.get(doc(db, "users", recipientUid));

            if (!senderDoc.exists() || !recipientDoc.exists()) throw "User data error";

            const senderCoins = senderDoc.data().coins || 0;
            const recipientCoins = recipientDoc.data().coins || 0;

            if (!isAdmin && senderCoins < amount) throw "Insufficient balance";

            if (!isAdmin) {
                transaction.update(doc(db, "users", senderUid), { coins: senderCoins - amount });
            }
            transaction.update(doc(db, "users", recipientUid), { coins: recipientCoins + amount });
        });

        alert(`Successfully gifted ${amount.toLocaleString()} coins!`);
        location.reload(); 
    } catch (err) {
        console.error(err);
        alert("Transaction failed: " + err);
    }
};

// [4] 로그아웃
window.handleLogout = () => {
    if (confirm("Do you want to logout?")) {
        window.lotGoAuth.signOut().then(() => {
            window.location.reload();
        });
    }
};
