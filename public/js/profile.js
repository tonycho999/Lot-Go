import { doc, getDoc, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// [레벨 테이블]
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

function getLevelInfo(exp, role) {
    if (role === 'admin') return { lv: 0, title: "OPERATOR", color: "#ef4444", percent: 100, label: "MAX LEVEL" };
    if (exp >= LEVEL_TABLE[9].reqExp) return { lv: 1, title: "GOD", color: "#ffffff", percent: 100, label: "MAX LEVEL" };
    
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
    return { lv: 10, title: "ROOKIE", color: "#a1a1aa", percent: 0, label: "0 / 2,000 XP" };
}

export async function renderProfile(user) {
    const container = document.getElementById('profile-tab');
    if (!container) return;

    try {
        const db = window.lotGoDb;
        const userDocRef = doc(db, "users", user.uid);
        
        onSnapshot(userDocRef, (snapshot) => {
            if (!snapshot.exists()) return;
            const userData = snapshot.data();
            
            const role = userData.role || 'user';
            const isAdmin = role === 'admin';
            
            // 사진 URL이 있으면 쓰고, 없으면 기본 이미지
            let photoURL = userData.photoURL;
            if (!photoURL || photoURL.includes('via.placeholder.com')) {
                photoURL = 'images/default-profile.png';
            }

            const items = userData.items || {}; 
            const username = userData.username || user.email.split('@')[0];
            const myCode = userData.myReferralCode || 'UNKNOWN';
            const refCount = userData.referralCount || 0;
            const myExp = userData.exp || 0;
            const equippedFrame = userData.equippedFrame || '';

            const lvInfo = getLevelInfo(myExp, role);
            const currentLevel = lvInfo.lv;
            let feePercent = (currentLevel === 0) ? 0 : currentLevel;

            container.innerHTML = `
                <div class="profile-container">
                    <div class="profile-header">
                        <div class="profile-img-wrapper">
                            <img id="profile-img" class="${equippedFrame}" src="${photoURL}" onerror="this.src='images/default-profile.png'" alt="Profile">
                            <label for="img-upload" class="camera-icon">📸</label>
                            <input type="file" id="img-upload" style="display:none;" accept="image/*" onchange="window.uploadProfileImg(this)">
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
                                Refs: ${refCount} | Transfer Fee: <span style="color:#ef4444">${feePercent}%</span>
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

                    <button class="logout-btn" onclick="handleLogout()">LOGOUT</button>
                </div>

                <div id="level-guide-modal" class="modal-overlay" style="display:none;">
                    <div class="modal-content">
                        <div class="modal-title">LEVEL & XP SYSTEM</div>
                        <div class="modal-section">
                            <div class="modal-subtitle">📈 HOW TO GET XP</div>
                            <div class="xp-row"><span>Invite Friend (Referral)</span><span class="xp-val">+1,000 XP</span></div>
                            <div class="xp-row"><span>Play Game</span><span class="xp-val">10% of Cost</span></div>
                            <div class="xp-row" style="color:#ef4444;"><span>Send Coin (Transfer)</span><span class="xp-val">-100 XP</span></div>
                            <div style="font-size:0.75rem; color:#64748b; margin-top:5px;">* Max Level (Lv 1) users do not gain XP.</div>
                        </div>
                        <div class="modal-section">
                            <div class="modal-subtitle">🏆 LEVEL BENEFITS</div>
                            <table class="level-table">
                                <thead>
                                    <tr><th>Lv</th><th>XP Needed</th><th>Fee</th><th>Min Send</th></tr>
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
        });

    } catch (err) {
        console.error("Profile Render Error:", err);
    }
}

// ==========================================
// [Storage 없이 이미지 저장하는 핵심 로직]
// ==========================================

// 1. 이미지를 압축하고 Base64 문자열로 변환하는 함수
function compressImage(file, maxWidth, quality) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // 비율 유지하며 리사이징
                if (width > maxWidth) {
                    height *= maxWidth / width;
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // 결과물 반환 (Data URL)
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
}

// 2. 프로필 이미지 업로드 함수 (Firebase Storage 대신 Firestore에 문자열 저장)
window.uploadProfileImg = async (input) => {
    const file = input.files[0];
    if (!file) return;

    const auth = window.lotGoAuth;
    const db = window.lotGoDb;

    try {
        // 로딩 표시
        const imgEl = document.getElementById('profile-img');
        if(imgEl) imgEl.style.opacity = '0.5';

        // 1. 이미지 압축 (최대 너비 150px, 품질 0.7) -> 용량을 확 줄임
        const compressedDataUrl = await compressImage(file, 150, 0.7);

        // 2. Firestore 유저 문서에 '문자열'로 직접 저장
        await updateDoc(doc(db, "users", auth.currentUser.uid), { 
            photoURL: compressedDataUrl 
        });

        // 3. 화면 즉시 반영
        if(imgEl) {
            imgEl.src = compressedDataUrl;
            imgEl.style.opacity = '1';
        }
        
        alert("Profile updated successfully!");

    } catch (err) { 
        console.error("Upload Error:", err);
        alert("Upload failed. Try a smaller image.");
        const imgEl = document.getElementById('profile-img');
        if(imgEl) imgEl.style.opacity = '1';
    }
};

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

window.handleLogout = () => {
    if (confirm("Logout?")) window.lotGoAuth.signOut().then(() => window.location.reload());
};

window.equipFrame = async (frameId) => {
    const db = window.lotGoDb;
    const auth = window.lotGoAuth;
    try {
        await updateDoc(doc(db, "users", auth.currentUser.uid), { equippedFrame: frameId });
        alert("Frame updated!");
    } catch(e) { console.error(e); }
};
