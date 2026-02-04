import { doc, getDoc, updateDoc, increment, collection, query, where, getDocs, addDoc, orderBy, limit, runTransaction } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// [레벨 계산 함수 (profile.js와 동일)]
// 10레벨(0xp) ~ 1레벨(500k xp)
const LEVEL_TABLE = [
    { lv: 10, reqExp: 0 }, { lv: 9, reqExp: 2000 }, { lv: 8, reqExp: 5000 },
    { lv: 7, reqExp: 10000 }, { lv: 6, reqExp: 20000 }, { lv: 5, reqExp: 40000 },
    { lv: 4, reqExp: 70000 }, { lv: 3, reqExp: 100000 }, { lv: 2, reqExp: 200000 },
    { lv: 1, reqExp: 500000 }
];

function getCurrentLevel(exp, role) {
    if (role === 'admin') return 0; // 운영자
    if (exp >= LEVEL_TABLE[9].reqExp) return 1; // 만렙 (GOD)
    for (let i = LEVEL_TABLE.length - 1; i >= 0; i--) {
        if (exp >= LEVEL_TABLE[i].reqExp) return LEVEL_TABLE[i].lv;
    }
    return 10; // 기본값
}

export async function renderCoinTab(user) {
    const container = document.getElementById('coin-tab');
    if (!container) return;
    
    const t = window.t || {}; 
    const db = window.lotGoDb;

    try {
        // 유저 정보 최신화
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) {
            container.innerHTML = `<div style="padding:20px; text-align:center;">User data not found.</div>`;
            return;
        }

        const userData = userSnap.data();
        const role = userData.role || 'user';
        const myExp = userData.exp || 0;
        
        // 레벨 계산 및 규칙 적용
        const level = getCurrentLevel(myExp, role);
        
        // [규칙 동기화]
        // 수수료: 레벨 숫자와 동일 (Lv 10 = 10%, Lv 1 = 1%)
        // 최소 송금: 50,000 + (레벨 * 5,000) (Lv 10 = 100k, Lv 1 = 55k)
        let feePercent = (level === 0) ? 0 : level; 
        let minAmount = (level === 0) ? 1 : 50000 + (level * 5000);

        container.innerHTML = `
            <div class="coin-container">
                <h2 class="coin-title">${t.coin_title || "TRANSFER COIN"}</h2>
                
                <div class="rate-info-box">${t.rate_info || "1000 C = $1.00"}</div>

                <div class="transfer-box">
                    <label>${t.receiver_label || "Receiver"}</label>
                    <input type="text" id="send-username" class="neon-input" placeholder="Username">
                    
                    <label style="margin-top:15px;">${t.amount_label || "Amount"}</label>
                    <input type="number" id="send-amount" class="neon-input" placeholder="Min ${minAmount.toLocaleString()} C">
                    
                    <div class="rule-info">
                        <span>Min: <strong>${minAmount.toLocaleString()} C</strong></span>
                        <span>Fee: <strong>${feePercent}%</strong></span>
                    </div>
                    
                    <div style="text-align:right; font-size:0.8rem; color:#94a3b8; margin-top:5px;">
                        Est. Fee: <span id="coin-est-fee" style="color:#ef4444;">0</span> C
                    </div>

                    <div class="xp-warning" style="color:#ef4444; text-align:center; font-size:0.8rem; margin-top:10px;">
                        ${t.xp_cost_info || "⚠️ 100 XP will be deducted per transfer."}
                    </div>

                    <button id="btn-send-coin" class="neon-btn primary" style="width:100%; margin-top:15px;">
                        ${t.btn_send || "SEND"}
                    </button>
                </div>

                <div class="log-container">
                    <h3 style="border-bottom:1px solid #334155; padding-bottom:10px; margin-bottom:10px;">${t.log_title || "LOGS"}</h3>
                    <div id="coin-logs-list" class="logs-list">
                        <div style="text-align:center; color:#64748b;">${t.loading || "Loading..."}</div>
                    </div>
                </div>
            </div>
        `;

        // 예상 수수료 실시간 계산
        setTimeout(() => {
            const inputEl = document.getElementById('send-amount');
            if(inputEl) {
                inputEl.addEventListener('input', (e) => {
                    const val = parseInt(e.target.value) || 0;
                    const fee = Math.floor(val * (feePercent / 100));
                    const feeEl = document.getElementById('coin-est-fee');
                    if(feeEl) feeEl.innerText = fee.toLocaleString();
                });
            }
        }, 100);

        document.getElementById('btn-send-coin').onclick = () => handleSendCoin(user, userData, level, minAmount, feePercent);
        loadCoinLogs(user);

    } catch (e) {
        console.error("Render Coin Tab Error:", e);
        container.innerHTML = `<div style="padding:20px; text-align:center; color:red;">Error loading tab.<br>${e.message}</div>`;
    }
}

// 송금 처리 함수
async function handleSendCoin(user, userData, level, minAmount, feePercent) {
    const db = window.lotGoDb;
    const t = window.t || {};

    const targetName = document.getElementById('send-username').value.trim();
    const amountVal = document.getElementById('send-amount').value;
    const amount = parseInt(amountVal);

    if (!targetName || !amount) return alert("Please check fields.");
    if (targetName === userData.username) return alert(t.alert_self_send || "Cannot send to yourself.");
    
    // 최소 금액 체크
    if (amount < minAmount) return alert(`${t.alert_gift_min || "Minimum:"} ${minAmount.toLocaleString()} C`);
    
    // XP 부족 체크 (만렙/운영자 제외)
    if (userData.exp < 100 && level > 1) return alert(t.alert_low_xp || "Need 100 XP to transfer.");

    // 수수료 계산
    const fee = Math.floor(amount * (feePercent / 100));
    const totalDeduct = amount + fee;

    if (userData.coins < totalDeduct) return alert(t.alert_no_coin || "Not enough coins.");

    if (!confirm(`Send ${amount.toLocaleString()} C to ${targetName}?\n(Fee: ${fee.toLocaleString()} C, Total: ${totalDeduct.toLocaleString()} C)\n(-100 XP)`)) return;

    try {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("username", "==", targetName));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) return alert("User not found.");
        
        const targetDoc = querySnapshot.docs[0];
        const targetUser = targetDoc.data();
        const targetUid = targetDoc.id;

        // 트랜잭션 처리 (안전한 송금)
        await runTransaction(db, async (transaction) => {
            const senderRef = doc(db, "users", user.uid);
            const receiverRef = doc(db, "users", targetUid);

            const sDoc = await transaction.get(senderRef);
            const rDoc = await transaction.get(receiverRef);

            if (!sDoc.exists() || !rDoc.exists()) throw "User data error";

            const sData = sDoc.data();
            const rData = rDoc.data();

            if (sData.coins < totalDeduct) throw "Insufficient coins";

            // 1. 보내는 사람 차감 (코인 + XP)
            let updates = { coins: sData.coins - totalDeduct };
            if (level > 1 && level !== 0) { // 만렙(1)과 운영자(0)는 XP 차감 안 함
                updates.exp = Math.max(0, (sData.exp || 0) - 100);
            }
            transaction.update(senderRef, updates);

            // 2. 받는 사람 증가
            transaction.update(receiverRef, { coins: (rData.coins || 0) + amount });
        });

        // 3. 로그 저장 (별도 수행)
        await addDoc(collection(db, "transfers"), {
            sender: userData.username,
            senderUid: user.uid,
            receiver: targetUser.username,
            receiverUid: targetUid,
            amount: amount,
            fee: fee,
            timestamp: Date.now(),
            participants: [user.uid, targetUid]
        });

        alert(t.alert_sent_success || "Sent!");
        document.getElementById('send-username').value = '';
        document.getElementById('send-amount').value = '';
        renderCoinTab(user); 

    } catch (e) {
        console.error(e);
        alert("Transfer failed: " + e.message); // 에러 메시지가 object일 경우를 대비해 message 처리 필요하나 string throw도 있음
    }
}

// 로그 불러오기
async function loadCoinLogs(user) {
    const db = window.lotGoDb;
    const t = window.t || {};
    const listEl = document.getElementById('coin-logs-list');
    
    try {
        const logsRef = collection(db, "transfers");
        const q = query(
            logsRef, 
            where("participants", "array-contains", user.uid),
            orderBy("timestamp", "desc"),
            limit(20)
        );

        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            listEl.innerHTML = '<div style="text-align:center; padding:20px; color:#64748b;">No transaction history.</div>';
            return;
        }

        listEl.innerHTML = snapshot.docs.map(doc => {
            const data = doc.data();
            const isSent = data.senderUid === user.uid;
            const typeClass = isSent ? 'log-sent' : 'log-received';
            const typeText = isSent ? `TO: ${data.receiver}` : `FROM: ${data.sender}`;
            const sign = isSent ? '-' : '+';
            const date = new Date(data.timestamp).toLocaleDateString();

            return `
                <div class="log-item">
                    <div class="log-info">
                        <div class="log-type ${typeClass}">${isSent ? '📤 ' + (t.log_sent||"Sent") : '📥 ' + (t.log_received||"Received")}</div>
                        <div class="log-user">${typeText}</div>
                        <div class="log-date">${date}</div>
                    </div>
                    <div class="log-amount ${typeClass}">
                        ${sign}${data.amount.toLocaleString()} C
                    </div>
                </div>
            `;
        }).join('');

    } catch (e) {
        console.error(e);
        listEl.innerHTML = `<div style="color:red; font-size:0.8rem; text-align:center;">
            System Index required.<br>Check console for link.
        </div>`;
    }
}
