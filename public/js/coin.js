import { doc, getDoc, updateDoc, increment, collection, query, where, getDocs, addDoc, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 레벨별 수수료 및 최소 금액 설정
const TRANSFER_RULES = {
    high: { min: 100, fee: 0.05 },    // Lv 10 (초보)
    mid: { min: 1000, fee: 0.10 },    // Lv 5~9
    low: { min: 3000, fee: 0.20 },    // Lv 2~4
    max: { min: 5000, fee: 0.30 }     // Lv 1 (만렙)
};

export async function renderCoinTab(user) {
    const container = document.getElementById('coin-tab');
    if (!container) return;
    const t = window.t;
    const db = window.lotGoDb;

    // 유저 정보 최신화
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    const userData = userSnap.data();
    
    // 레벨에 따른 규칙 가져오기
    const level = userData.level !== undefined ? userData.level : 10;
    let rule = TRANSFER_RULES.high;
    if (level === 1) rule = TRANSFER_RULES.max;
    else if (level <= 4) rule = TRANSFER_RULES.low;
    else if (level <= 9) rule = TRANSFER_RULES.mid;

    const feePercent = (rule.fee * 100).toFixed(0);

    container.innerHTML = `
        <div class="coin-container">
            <h2 class="coin-title">${t.coin_title}</h2>
            
            <div class="rate-info-box">${t.rate_info}</div>

            <div class="transfer-box">
                <label>${t.receiver_label}</label>
                <input type="text" id="send-username" class="neon-input" placeholder="Username">
                
                <label style="margin-top:15px;">${t.amount_label}</label>
                <input type="number" id="send-amount" class="neon-input" placeholder="Amount">
                
                <div class="rule-info">
                    <span>${t.min_send} <strong>${rule.min.toLocaleString()} C</strong></span>
                    <span>${t.fee_info} <strong>${feePercent}%</strong></span>
                </div>

                <div class="xp-warning">${t.xp_cost_info}</div>

                <button id="btn-send-coin" class="neon-btn primary" style="width:100%; margin-top:15px;">
                    ${t.btn_send}
                </button>
            </div>

            <div class="log-container">
                <h3 style="border-bottom:1px solid #334155; padding-bottom:10px; margin-bottom:10px;">${t.log_title}</h3>
                <div id="coin-logs-list" class="logs-list">
                    <div style="text-align:center; color:#64748b;">Loading logs...</div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('btn-send-coin').onclick = () => handleSendCoin(user, userData, rule);
    loadCoinLogs(user);
}

// 송금 처리 함수
async function handleSendCoin(user, userData, rule) {
    const db = window.lotGoDb;
    const t = window.t;

    const targetName = document.getElementById('send-username').value.trim();
    const amountVal = document.getElementById('send-amount').value;
    const amount = parseInt(amountVal);

    if (!targetName || !amount) return alert("Please check fields.");
    if (targetName === userData.username) return alert(t.alert_self_send);
    if (amount < rule.min) return alert(`${t.min_send} ${rule.min}`);
    if (userData.exp < 100) return alert(t.alert_low_xp); // XP 체크

    // 수수료 계산
    const fee = Math.floor(amount * rule.fee);
    const totalDeduct = amount + fee;

    if (userData.coins < totalDeduct) return alert(t.alert_no_coin);

    if (!confirm(`Send ${amount} C to ${targetName}?\n(Fee: ${fee} C, Total: ${totalDeduct} C)\n(-100 XP)`)) return;

    try {
        // 받는 사람 찾기
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("username", "==", targetName));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) return alert("User not found.");
        
        const targetDoc = querySnapshot.docs[0];
        const targetUser = targetDoc.data();
        const targetUid = targetDoc.id;

        // 트랜잭션 없이 순차 처리 (간단 구현)
        const myRef = doc(db, "users", user.uid);
        const targetRef = doc(db, "users", targetUid);

        // 1. 내 돈, XP 차감
        await updateDoc(myRef, {
            coins: increment(-totalDeduct),
            exp: increment(-100)
        });

        // 2. 상대방 돈 추가
        await updateDoc(targetRef, {
            coins: increment(amount)
        });

        // 3. 로그 저장 (participants 배열로 쿼리 쉽게)
        await addDoc(collection(db, "transfers"), {
            sender: userData.username,
            senderUid: user.uid,
            receiver: targetUser.username,
            receiverUid: targetUid,
            amount: amount,
            fee: fee,
            timestamp: Date.now(),
            participants: [user.uid, targetUid] // 나 혹은 상대방 검색용
        });

        alert(t.alert_sent_success);
        document.getElementById('send-username').value = '';
        document.getElementById('send-amount').value = '';
        renderCoinTab(user); // 화면 갱신

    } catch (e) {
        console.error(e);
        alert("Transfer failed: " + e.message);
    }
}

// 로그 불러오기
async function loadCoinLogs(user) {
    const db = window.lotGoDb;
    const t = window.t;
    const listEl = document.getElementById('coin-logs-list');
    
    try {
        const logsRef = collection(db, "transfers");
        // 내가 보냈거나 받은 내역 조회
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
                        <div class="log-type ${typeClass}">${isSent ? '📤 ' + t.log_sent : '📥 ' + t.log_received}</div>
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
        // 색인(Index) 에러 발생 시 콘솔 링크 확인 필요
        listEl.innerHTML = `<div style="color:red; font-size:0.8rem;">Index required. Check console.</div>`;
    }
}
