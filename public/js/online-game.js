import { ref, update, onValue, set, runTransaction } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// =======================
// Phase 1: 번호 선택 (1분)
// =======================
export function initSelectionPhase(roomId, roomData) {
    const container = document.getElementById('online-tab');
    const rtdb = window.lotGoRtdb;
    const user = window.lotGoAuth.currentUser;
    let selected = [];

    container.innerHTML = `
        <div class="game-room-border">
            <h2>SELECT 6 NUMBERS</h2>
            <div id="timer-display" style="font-size:1.5rem; color:#ef4444;">60</div>
            <div class="card-grid grid-hard" id="select-grid" style="margin:20px 0;"></div>
            <button id="confirm-sel-btn" class="neon-btn primary" disabled>CONFIRM</button>
        </div>
    `;

    // 40개 공 렌더링
    const grid = document.getElementById('select-grid');
    for(let i=1; i<=40; i++) {
        const ball = document.createElement('div');
        ball.className = 'lotto-ball';
        ball.innerHTML = `<div class="ball-number">${i}</div>`;
        ball.onclick = () => {
            if(selected.includes(i)) {
                selected = selected.filter(n => n!==i);
                ball.classList.remove('selected');
            } else if(selected.length < 6) {
                selected.push(i);
                ball.classList.add('selected');
            }
            document.getElementById('confirm-sel-btn').disabled = (selected.length !== 6);
        };
        grid.appendChild(ball);
    }

    // 선택 완료 처리
    document.getElementById('confirm-sel-btn').onclick = () => {
        update(ref(rtdb, `rooms/${roomId}/players/${user.uid}`), {
            selection: selected,
            matchedCount: 0,
            hasSelected: true
        });
        container.innerHTML = `<div style="text-align:center; padding:50px;"><h2>WAITING FOR OTHERS...</h2></div>`;
    };

    // 모두 선택 완료 감지 -> 게임 시작
    const roomRef = ref(rtdb, `rooms/${roomId}`);
    onValue(roomRef, (snap) => {
        const r = snap.val();
        if(r.status === 'playing') {
            initGameplayPhase(roomId, r);
            return;
        }
        
        // 방장은 모두 선택했는지 체크 후 상태 변경
        if(r.host === user.uid) {
            const allSelected = Object.values(r.players).every(p => p.hasSelected);
            // (실제론 타이머 로직도 필요하지만 간단히)
            if(allSelected) {
                update(roomRef, { status: 'playing' });
            }
        }
    });
}

// =======================
// Phase 2: 게임 플레이
// =======================
function initGameplayPhase(roomId, roomData) {
    const container = document.getElementById('online-tab');
    const rtdb = window.lotGoRtdb;
    const user = window.lotGoAuth.currentUser;
    const mySelection = roomData.players[user.uid].selection;

    // 게임 화면 렌더링
    container.innerHTML = `
        <div class="game-room-border online-game-board">
            <div class="game-top-bar">
                <div>PRIZE: <span id="cur-prize" class="highlight">1,000,000,000</span></div>
            </div>

            <div id="opponents-area" class="opponent-area"></div>

            <div style="margin: 20px;">
                <h3>DRAWN BALL</h3>
                <div id="drawn-ball" class="lotto-ball" style="width:100px; height:100px; font-size:3rem; margin:0 auto;">?</div>
            </div>

            <div class="my-numbers">
                <h4>MY NUMBERS</h4>
                <div id="my-nums" style="display:flex; gap:10px; justify-content:center;">
                    ${mySelection.map(n => `<div id="my-ball-${n}" class="lotto-ball" style="width:50px; height:50px; font-size:1.2rem;">${n}</div>`).join('')}
                </div>
            </div>
        </div>
    `;

    // 상대방 렌더링
    const oppArea = document.getElementById('opponents-area');
    Object.entries(roomData.players).forEach(([uid, p]) => {
        if(uid === user.uid) return;
        oppArea.innerHTML += `
            <div class="opponent-card" id="opp-${uid}">
                <div style="font-size:0.8rem;">${p.email.split('@')[0]}</div>
                <div class="match-count" id="score-${uid}">0</div>
            </div>
        `;
    });

    // 게임 루프 리스너
    const roomRef = ref(rtdb, `rooms/${roomId}`);
    onValue(roomRef, (snap) => {
        const r = snap.val();
        
        // 1. 오픈된 공 표시
        if(r.currentBall) {
            document.getElementById('drawn-ball').innerHTML = `<div class="ball-number">${r.currentBall}</div>`;
            
            // 내 번호 매칭 체크
            if(mySelection.includes(r.currentBall)) {
                document.getElementById(`my-ball-${r.currentBall}`).classList.add('selected');
                // 내 점수 업데이트 (DB는 아래서)
            }
        }

        // 2. 점수 업데이트 및 종료 체크
        let winners = [];
        Object.entries(r.players).forEach(([uid, p]) => {
            if(uid !== user.uid) {
                document.getElementById(`score-${uid}`).innerText = p.matchedCount || 0;
            }
            if(p.matchedCount === 6) winners.push(uid);
        });

        // 3. 종료 처리
        if(winners.length > 0) {
            handleGameEnd(winners, r.prize, user.uid);
        }
    });

    // 방장 로직: 주기적으로 공 뽑기 (Auto Mode 예시)
    if(roomData.host === user.uid && roomData.mode === 'auto') {
        let drawn = [];
        const timer = setInterval(() => {
            // 랜덤 공 뽑기
            let ball;
            do { ball = Math.floor(Math.random() * 40) + 1; } while(drawn.includes(ball));
            drawn.push(ball);

            // DB 업데이트 (공 및 상금 감소)
            runTransaction(roomRef, (room) => {
                if(!room) return;
                room.currentBall = ball;
                room.prize = Math.floor(room.prize * 0.98); // 상금 감소
                
                // 각 플레이어 매칭 카운트 업데이트
                Object.keys(room.players).forEach(uid => {
                    if(room.players[uid].selection.includes(ball)) {
                        room.players[uid].matchedCount = (room.players[uid].matchedCount || 0) + 1;
                    }
                });
                return room;
            });

            // 종료 조건은 onValue에서 감지하여 clearInterval 해야 함
        }, 7000); // 7초
    }
}

function handleGameEnd(winners, totalPrize, myUid) {
    const isWinner = winners.includes(myUid);
    const splitPrize = Math.floor(totalPrize / winners.length);
    
    alert(isWinner ? `YOU WON! Prize: ${splitPrize}` : "GAME OVER! Winners found.");
    // 실제로는 모달 띄우고 로비 이동
    window.switchTab('online');
}
