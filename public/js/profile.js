import { getStorage, ref as sRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
// [수정] query, where 추가 (Username 검색용)
import { doc, getDoc, updateDoc, collection, getDocs, runTransaction, query, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// [레벨 테이블 (10 -> 1 역순)]
const LEVEL_TABLE = [
    { lv: 10, reqExp: 0, title: "ROOKIE", color: "#a1a1aa" },
    { lv: 9, reqExp: 2000, title: "BRONZE", color: "#cd7f32" },
    { lv: 8, reqExp: 5000, title: "SILVER", color: "#c0c0c0" },
    { lv: 7, reqExp: 10000, title: "GOLD", color: "#ffd700" },
    { lv: 6, reqExp: 20000, title: "PLATINUM", color: "#00ced1" },
    { lv: 5, reqExp: 40000, title: "DIAMOND", color: "#b9f2ff" },
    { lv: 4, reqExp: 70000, title: "MASTER", color: "#9932cc" },
    { lv: 3, reqExp: 100000, title: "GRAND MASTER", color: "#ff4500" },
    { lv: 2, reqExp: 200000, title: "LEGEND", color: "#ff00ff" },
    { lv: 1, reqExp: 500000, title: "GOD", color: "#ffffff" }
];

// 레벨 정보 계산 함수
function getLevelInfo(exp, role) {
    // 1. 운영자 (Level 0)
    if (role === 'admin') {
        return { lv: 0, title: "OPERATOR", color: "#ef4444", percent: 100, label: "MAX LEVEL" };
    }

    // 2. 레벨 1 (GOD) 체크: 경험치가 500,000 이상이면 MAX 처리
    if (exp >= LEVEL_TABLE[9].reqExp) {
        return { 
            lv: 1, title: "GOD", color: "#ffffff", percent: 100, label: "MAX LEVEL" 
        };
    }

    // 3. 나머지 레벨 (10 ~ 2) 계산
    for (let i = LEVEL_TABLE.length - 1; i >= 0; i--) {
        if (exp >= LEVEL_TABLE[i].reqExp) {
            const cur = LEVEL_TABLE[i]; 
            const next = (i + 1 < LEVEL_TABLE.length) ? LEVEL_TABLE[i+1] : null;
            let percent = 100;
            let label = "MAX LEVEL";

            if (next) {
                const range = next.reqExp - cur.reqExp;
                const gained = exp - cur.reqExp;
                percent = Math.min(100, Math.floor((gained / range) * 100));
                label = `${exp.toLocaleString()} / ${next.reqExp.toLocaleString()} XP`;
            }
            return { lv: cur.lv, title: cur.title, color: cur.color, percent, label };
        }
    }
    // 기본값 (Lv 10)
    return { lv: 10, title: "ROOKIE", color: "#a1a1aa", percent: 0, label: "0 / 2,000 XP" };
}

export async function renderProfile(user) {
    const container = document.getElementById('profile-tab');
    if (!container) return;

    try {
        const db = window.lotGoDb;
        const userDocRef = doc(db, "users", user.uid);
        const snapshot = await getDoc(userDocRef);
        const userData = snapshot.exists() ? snapshot.data() : {};
        
        const role = userData.role || 'user';
        const isAdmin = role === 'admin';
        const photoURL = userData.photoURL || 'images/default-profile.png'; 
        const items = userData.items || {}; 
        const username = userData.username || user.email.split('@')[0];
        const myCode = userData.myReferralCode || 'UNKNOWN';
        const refCount = userData.referralCount || 0;
        const myExp = userData.exp || 0;
        const equippedFrame = userData.equippedFrame || '';

        // 레벨 계산
        const lvInfo = getLevelInfo(myExp, role);
        const currentLevel = lvInfo.lv;

        // 송금 수수료 및 최소 금액 계산
        let feePercent = (currentLevel === 0) ? 0 : currentLevel;
        let minAmount = (currentLevel === 0) ? 1 : 50000 + (currentLevel * 5000);

        container.innerHTML = `
            <div class="profile-container">
                <div class="profile-header">
                    <div class="profile-img-wrapper">
                        <img id="profile-img" class="${equippedFrame}" src="${photoURL}" onerror="this.src='images/default-profile.png'" alt="Profile">
                        <label for="img-upload" class="camera-icon">📸</label>
                        <input type="file" id="img-upload" style="display:none;" accept="image/*" onchange="uploadProfileImg(this)">
                    </div>
                    
                    <h3 class="user-email" style="color:#fbbf24; font-size:1.5rem; margin-bottom:5px;">${username}</h3>
                    
                    <div style="margin-bottom:15px; width:100%;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                            <span style="color:${lvInfo.color}; font-weight:bold; font-size:1.1rem; text-shadow:0 0 10px ${lvInfo.color};">
                                Lv.${currentLevel} ${lvInfo.title}
                            </span>
                            <button class="guide-btn" onclick="openLevelGuide()">❓ LEVEL GUIDE</button>
                        </div>
                        <div style="text-align:right; font-size:0.8rem; color:#94a3b8; margin-bottom:5px;">${lvInfo.label}</div>
                        
                        <div style="width:100%; height:10px; background:#1e293b; border-radius:5px; overflow:hidden;">
                            <div style="width:${lvInfo.percent}%; height:100%; background:linear-gradient(90deg, ${lvInfo.color}, #fff); transition:width 0.5s;"></div>
                        </div>
                        <div style="text-align:right; font-size:0.75rem; color:#64748b; margin-top:3px;">
                            Refs: ${refCount} | Fee: <span style="color:#ef4444">${feePercent}%</span>
                        </div>
                    </div>

                    ${isAdmin ? '<span class="admin-badge">[OPERATOR]</span>' : ''}

                    <div style="background:#1e293b; padding:10px; border-radius:8px; margin-top:15px; border:1px solid #334155;">
                        <div style="font-size:0.8rem; color:#94a3b8;">MY REFERRAL CODE</div>
                        <div style="font-size:1.2rem; font-weight:bold; color:#3b82f6; letter-spacing:2px; margin-top:5px; cursor:pointer;" 
                             onclick="navigator.clipboard.writeText('${myCode}'); alert('Copied!');">
                            ${myCode} 📋
                        </div>
                    </div>
                </div>

                <div class="section-box">
                    <h4 class="section-title">PROFILE FRAMES</h4>
                    <div style="display:flex; gap:10px; overflow-x:auto; padding-bottom:5px;">
                        <div class="frame-selector" onclick="equipFrame('')" style="border:2px dashed #555;">🚫</div>
                        ${(userData.frames || []).map(frameId => `<div class="frame-selector ${frameId}" onclick="equipFrame('${frameId}')"></div>`).join('')}
                    </div>
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
                    <h4 class="section-title">GIFT COINS (Fee: ${feePercent}%)</h4>
                    <div class="gift-form">
                        <input type="text" id="recipient-username" class="gift-input" placeholder="Recipient Username">
                        <input type="number" id="gift-amount" class="gift-input" placeholder="Min. ${minAmount.toLocaleString()} COINS">
                        <div style="font-size:0.8rem; color:#94a3b8; margin-top:5px; text-align:right;">
                            Est. Fee: <span id="est-fee" style="color:#ef4444;">0</span> C
                        </div>
                        <button class="gift-btn" onclick="sendCoinGift(${currentLevel})">SEND GIFT 🎁</button>
                    </div>
                </div>

                <button class="logout-btn" onclick="handleLogout()">LOGOUT</button>
            </div>

            <div id="level-guide-modal" class="modal-overlay" style="display:none;">
                <div class="modal-content">
                    <div class="modal-title">LEVEL & XP SYSTEM</div>
                    
                    <div class="modal-section">
                        <div class="modal-subtitle">📈 HOW TO GET XP</div>
                        <div class="xp-row"><span>Invite Friend (Referral)</span><span class="xp-val">+1,000 XP</span></div>
                        <div class="xp-row"><span>Play Game</span><span class="xp-val">10% of Cost</span></div>
                        <div style="font-size:0.75rem; color:#64748b; margin-top:5px;">* Max Level (Lv 1) users do not gain XP.</div>
                    </div>

                    <div class="modal-section">
                        <div class="modal-subtitle">🏆 LEVEL BENEFITS</div>
                        <table class="level-table">
                            <thead>
                                <tr><th>Lv</th><th>XP Needed</th><th>Fee</th><th>Min Gift</th></tr>
                            </thead>
                            <tbody>
                                ${LEVEL_TABLE.slice().reverse().map(l => `
                                    <tr class="${l.lv <= 3 ? 'high-rank' : ''}">
                                        <td>Lv.${l.lv}</td>
                                        <td>${l.reqExp === 0 ? '0' : (l.reqExp/1000) + 'k'}</td>
                                        <td>${l.lv}%</td>
                                        <td>${(50000 + l.lv * 5000) / 1000}k</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>

                    <button class="close-modal-btn" onclick="closeLevelGuide()">CLOSE</button>
                </div>
            </div>
        `;

        setTimeout(() => {
            const inputEl = document.getElementById('gift-amount');
            if(inputEl) {
                inputEl.addEventListener('input', (e) => {
                    const val = parseInt(e.target.value) || 0;
                    const fee = Math.floor(val * (feePercent / 100));
                    document.getElementById('est-fee').innerText = fee.toLocaleString();
                });
            }
        }, 100);

    } catch (err) {
        console.error("Profile Render Error:", err);
    }
}

// Window Functions
window.openLevelGuide = () => {
    const modal = document.getElementById('level-guide-modal');
    if (modal) {
        modal.style.display = 'flex';
        modal.onclick = (e) => {
            if (e.target === modal) window.closeLevelGuide();
        };
    }
};

window.closeLevelGuide = () => {
    const modal = document.getElementById('level-guide-modal');
    if (modal) modal.style.display = 'none';
};

// [수정] Username 기반 송금 로직
window.sendCoinGift = async (currentLevel) => {
    // ID 변경됨: recipient-username
    const targetUsername = document.getElementById('recipient-username').value.trim();
    const amount = parseInt(document.getElementById('gift-amount').value);
    const db = window.lotGoDb;
    const auth = window.lotGoAuth;
    const senderUid = auth.currentUser.uid;

    if (!targetUsername || isNaN(amount)) return alert("Fill all fields.");

    let feePercent = currentLevel;
    let minAmount = 50000 + (currentLevel * 5000);
    if (currentLevel === 0) { feePercent = 0; minAmount = 1; }

    if (amount < minAmount) return alert(`Minimum transfer amount is ${minAmount.toLocaleString()} C.`);

    const fee = Math.floor(amount * (feePercent / 100));
    const totalDeduct = amount + fee;

    try {
        if (!confirm(`Send ${amount.toLocaleString()} C to '${targetUsername}'?\nFee: ${fee.toLocaleString()} C\nTotal: ${totalDeduct.toLocaleString()} C deducted.`)) return;

        // [수정] Username으로 유저 찾기 (query 사용)
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("username", "==", targetUsername));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            return alert("User not found (Check Username).");
        }

        const recipientDocSnapshot = querySnapshot.docs[0];
        const recipientUid = recipientDocSnapshot.id;

        if (recipientUid === senderUid) return alert("Cannot gift yourself.");

        await runTransaction(db, async (transaction) => {
            const senderDoc = await transaction.get(doc(db, "users", senderUid));
            const recipientDoc = await transaction.get(doc(db, "users", recipientUid));
            
            if (!senderDoc.exists() || !recipientDoc.exists()) throw "User data error";
            
            const sCoins = senderDoc.data().coins || 0;
            const rCoins = recipientDoc.data().coins || 0;
            
            if (sCoins < totalDeduct) throw "Insufficient balance";
            
            transaction.update(doc(db, "users", senderUid), { coins: sCoins - totalDeduct });
            transaction.update(doc(db, "users", recipientUid), { coins: rCoins + amount });
        });
        
        alert(`Successfully sent ${amount.toLocaleString()} C to ${targetUsername}!`);
        renderProfile(auth.currentUser);
    } catch (err) { console.error(err); alert("Failed: " + err); }
};

window.uploadProfileImg = async (input) => {
    const file = input.files[0];
    if (!file) return;
    const auth = window.lotGoAuth;
    const db = window.lotGoDb;
    const storage = getStorage(); 
    const fileRef = sRef(storage, `profiles/${auth.currentUser.uid}`);
    try {
        await uploadBytes(fileRef, file);
        const url = await getDownloadURL(fileRef);
        await updateDoc(doc(db, "users", auth.currentUser.uid), { photoURL: url });
        document.getElementById('profile-img').src = url;
    } catch (err) { console.error(err); }
};

window.handleLogout = () => {
    if (confirm("Logout?")) window.lotGoAuth.signOut().then(() => window.location.reload());
};

window.equipFrame = async (frameId) => {
    const db = window.lotGoDb;
    const auth = window.lotGoAuth;
    try {
        await updateDoc(doc(db, "users", auth.currentUser.uid), { equippedFrame: frameId });
        alert("Frame updated!");
        renderProfile(auth.currentUser);
    } catch(e) { console.error(e); }
};
