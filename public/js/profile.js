import { getStorage, ref as sRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { doc, getDoc, updateDoc, collection, getDocs, runTransaction } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// [수정] 레벨 테이블 (XP가 높을수록 레벨 숫자가 작아짐 10 -> 1)
// reqExp: 해당 레벨에 도달하기 위한 최소 경험치
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

// 레벨 계산 함수 (Admin은 0레벨 처리)
function calculateLevel(currentExp, role) {
    if (role === 'admin') {
        return { current: { lv: 0, title: "OPERATOR", color: "#ff0000" }, next: null, percent: 100 };
    }

    // XP 역순 정렬되어 있으므로 뒤에서부터 체크 (Lv 1 부터 체크)
    // XP가 500,000 이상이면 Lv 1
    for (let i = LEVEL_TABLE.length - 1; i >= 0; i--) {
        if (currentExp >= LEVEL_TABLE[i].reqExp) {
            const currentLvData = LEVEL_TABLE[i];
            
            // 다음 레벨(더 낮은 숫자) 정보
            const nextLvData = (i < LEVEL_TABLE.length - 1) ? LEVEL_TABLE[i + 1] : null; // 더 높은 인덱스가 상위 레벨(숫자는 작음)
            
            // 다음 레벨은 배열의 앞쪽 인덱스임 (예: 현재가 idx 0(Lv10)이면 다음은 idx 1(Lv9))
            // 아, 배열 정의 순서가 10->1 이므로, 다음 레벨은 i+1 이기보다 i+1 번째 요소? 
            // 배열 인덱스: 0(Lv10), 1(Lv9)... 9(Lv1)
            // 따라서 승급하려면 인덱스가 커져야함.
            
            const nextLevelObj = (i + 1 < LEVEL_TABLE.length) ? LEVEL_TABLE[i+1] : null; 
            
            let percent = 100;
            let nextExpStr = "MAX";

            // 다음 레벨이 존재한다면 퍼센트 계산
            if (nextLevelObj) {
                const range = nextLevelObj.reqExp - currentLvData.reqExp;
                const gained = currentExp - currentLvData.reqExp;
                percent = Math.min(100, Math.floor((gained / range) * 100));
                nextExpStr = `${currentExp.toLocaleString()} / ${nextLevelObj.reqExp.toLocaleString()} XP`;
            }

            return { current: currentLvData, next: nextLevelObj, percent: percent, nextExpStr: nextExpStr };
        }
    }
    // 기본값 Lv 10
    return { current: LEVEL_TABLE[0], next: LEVEL_TABLE[1], percent: 0, nextExpStr: `0 / 2,000 XP` };
}

// 정확한 로직 재정의: 배열 인덱스를 10(idx 0) -> 1(idx 9) 로 정의했으므로,
// XP가 많을수록 인덱스가 커져야 함.
function getLevelInfo(exp, role) {
    if (role === 'admin') return { lv: 0, title: "OPERATOR", color: "#ef4444", percent: 100, label: "ADMIN" };

    // 오름차순(Lv 10 -> Lv 1)으로 검사하려면 배열을 역순으로 순회하거나, 로직 수정
    // 여기서는 간단하게: 레벨 1(50만)부터 검사해서 만족하면 리턴
    for (let i = LEVEL_TABLE.length - 1; i >= 0; i--) {
        if (exp >= LEVEL_TABLE[i].reqExp) {
            // 현재 달성한 최고 레벨
            const cur = LEVEL_TABLE[i]; 
            // 다음 목표 레벨 (인덱스가 하나 더 큰 것? 아님. 배열은 10..1 순서이므로, 다음 레벨은 i+1 (Lv N-1))
            // 배열: [0]:Lv10(0xp), [1]:Lv9(2000xp) ... [9]:Lv1(500k)
            // 즉, i가 커질수록 고레벨.
            
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
    // 기본 Lv 10
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

        // [레벨 정보 계산]
        const lvInfo = getLevelInfo(myExp, role);
        const currentLevel = lvInfo.lv;

        // [송금 정보 계산]
        let feePercent = 0;
        let minAmount = 0;

        if (currentLevel === 0) { // Admin
            feePercent = 0;
            minAmount = 1; // 제한 없음
        } else {
            // Lv 10 -> 10%, 100,000
            // Lv 9  -> 9%, 95,000
            // Lv 1  -> 1%, 55,000
            feePercent = currentLevel; 
            minAmount = 50000 + (currentLevel * 5000);
        }

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
                            <span style="font-size:0.8rem; color:#64748b;">${lvInfo.label}</span>
                        </div>
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
                        <input type="email" id="recipient-email" class="gift-input" placeholder="Recipient Email">
                        <input type="number" id="gift-amount" class="gift-input" placeholder="Min. ${minAmount.toLocaleString()} COINS">
                        
                        <div style="font-size:0.8rem; color:#94a3b8; margin-top:5px; text-align:right;">
                            Est. Fee: <span id="est-fee" style="color:#ef4444;">0</span> C
                        </div>
                        
                        <button class="gift-btn" onclick="sendCoinGift(${currentLevel})">SEND GIFT 🎁</button>
                    </div>
                </div>

                <button class="logout-btn" onclick="handleLogout()">LOGOUT</button>
            </div>
        `;

        // 수수료 실시간 계산 리스너 추가
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
        container.innerHTML = `<div style="text-align:center; padding:30px; color:red;"><h3>Error Loading Profile</h3><p>${err.message}</p></div>`;
    }
}

// [수정] 송금 로직 (레벨별 제한 적용)
window.sendCoinGift = async (currentLevel) => {
    const recipientEmail = document.getElementById('recipient-email').value.trim();
    const amount = parseInt(document.getElementById('gift-amount').value);
    const db = window.lotGoDb;
    const auth = window.lotGoAuth;
    const senderUid = auth.currentUser.uid;

    if (!recipientEmail || isNaN(amount)) return alert("Fill all fields.");

    // 1. 송금 제한 계산
    let feePercent = currentLevel;
    let minAmount = 50000 + (currentLevel * 5000);

    // Admin 예외
    if (currentLevel === 0) {
        feePercent = 0;
        minAmount = 1;
    }

    if (amount < minAmount) return alert(`Minimum transfer amount is ${minAmount.toLocaleString()} C for Level ${currentLevel}.`);

    // 수수료 계산
    const fee = Math.floor(amount * (feePercent / 100));
    const totalDeduct = amount + fee;

    try {
        if (!confirm(`Send ${amount.toLocaleString()} C?\nFee: ${fee.toLocaleString()} C (${feePercent}%)\nTotal: ${totalDeduct.toLocaleString()} C deducted.`)) return;

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

            if (senderCoins < totalDeduct) throw `Insufficient balance! Need ${totalDeduct.toLocaleString()} C (incl. fee).`;

            // 송금자 차감 (원금 + 수수료)
            transaction.update(doc(db, "users", senderUid), { coins: senderCoins - totalDeduct });
            
            // 수신자 지급 (원금만) -> 수수료는 시스템 회수(삭제)
            transaction.update(doc(db, "users", recipientUid), { coins: recipientCoins + amount });
        });

        alert(`Successfully sent ${amount.toLocaleString()} C! (Fee: ${fee.toLocaleString()} C)`);
        renderProfile(auth.currentUser); // UI 갱신
    } catch (err) {
        console.error(err);
        alert("Transaction failed: " + err);
    }
};

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
        alert("Upload failed.");
    }
};

window.handleLogout = () => {
    if (confirm("Do you want to logout?")) {
        window.lotGoAuth.signOut().then(() => {
            window.location.reload();
        });
    }
};

window.equipFrame = async (frameId) => {
    const db = window.lotGoDb;
    const auth = window.lotGoAuth;
    try {
        await updateDoc(doc(db, "users", auth.currentUser.uid), {
            equippedFrame: frameId
        });
        alert("Frame updated!");
        renderProfile(auth.currentUser);
    } catch(e) {
        console.error(e);
    }
};
