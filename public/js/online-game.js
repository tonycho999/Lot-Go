import { ref, onValue, set, update, push, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// 1. 운영자 지정 온라인 6/40 상금 테이블
const ONLINE_PRIZE_TABLE = {
    6: 1000000000, 7: 274170000, 8: 68542500, 9: 22847500, 10: 9139000,
    11: 4154091, 12: 2077045, 13: 1118409, 14: 639091, 15: 383455,
    16: 239659, 17: 155074, 18: 103383, 19: 70735, 20: 49515,
    21: 35367, 22: 25722, 23: 19012, 24: 14259, 25: 10837,
    26: 8336, 27: 6483, 28: 5094, 29: 4040, 30: 3232,
    31: 2607, 32: 2118, 33: 1733, 34: 1427, 35: 1182,
    36: 985, 37: 826, 38: 695, 39: 500 // 39회차 임의 보정값
};

let onlineState = {
    roomRef: null,
    myId: null,
    mySelected: [],
    foundCount: 0,
    flips: 0,
    isGameOver: false,
    timerInterval: null
};

/**
 * 2. 30초 번호 선택 단계 시작
 */
export function startSelectionPhase(roomId, userId) {
    onlineState.roomRef = ref(window.lotGoRtdb, `rooms/${roomId}`);
    onlineState.myId = userId;

    const header = document.getElementById('game-header');
    const board = document.getElementById('game-board');

    let timeLeft = 30;
    header.innerHTML = `
        <div class="timer-panel">
            <h2 id="timer-display" class="neon-text">${timeLeft}s</h2>
            <p>PICK 6 NUMBERS</p>
        </div>`;

    board.className = "card-grid grid-online"; // 6x7 또는 5x8 그리드 권장
    board.innerHTML = "";

    // 1~40개 숫자 카드 생성
    for (let i = 1; i <= 40; i++) {
        const card = document.createElement('div');
        card.className = "card selection-card";
        card.innerText = i;
        card.onclick = () => {
            if (onlineState.mySelected.includes(i) || onlineState.mySelected.length >= 6) return;
            onlineState.mySelected.push(i);
            card.classList.add('selected');
        };
        board.appendChild(card);
    }

    // 30초 카운트다운 타이머
    onlineState.timerInterval = setInterval(() => {
        timeLeft--;
        document.getElementById('timer-display').innerText = `${timeLeft}s`;
        
        if (timeLeft <= 0) {
            clearInterval(onlineState.timerInterval);
            // 6개 미만 선택 시 자동 선택 로직 추가 가능
            renderMultiPlayPhase();
        }
    }, 1000);
}

/**
 * 3. 메인 게임 플레이 단계 (서버 동기화)
 */
function renderMultiPlayPhase() {
    const header = document.getElementById('game-header');
    const board = document.getElementById('game-board');

    // 하단 내 번호 바 생성 (insertAdjacentHTML 사용)
    const existingFooter = document.querySelector('.my-numbers-footer');
    if (existingFooter) existingFooter.remove();

    const myNumbersBar = `
        <div class="my-numbers-footer neon-panel">
            <small>MY NUMBERS</small>
            <div class="footer-nodes">
                ${onlineState.mySelected.map(num => `
                    <div id="my-target-${num}" class="target-node">${num}</div>
                `).join('')}
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', myNumbersBar);

    // 실시간 서버 데이터 구독 (상금, 상대방 맞춘 개수 등)
    onValue(onlineState.roomRef, (snapshot) => {
        const roomData = snapshot.val();
        if (!roomData || onlineState.isGameOver) return;

        const flips = roomData.totalFlips || 0;
        const currentWinners = roomData.winners ? Object.keys(roomData.winners).length : 0;
        const currentPrizePool = calculatePool(flips);

        // 헤더 업데이트 (상금 + 타 참가자 상태)
        header.innerHTML = `
            <div class="multi-prize-panel">
                <div id="live-prize" class="prize-amount">${currentPrizePool.toLocaleString()}</div>
                <small>CURRENT TOTAL POOL</small>
            </div>
            <div class="other-players-bar">
                ${Object.entries(roomData.players || {}).map(([uid, p]) => {
                    if (uid === onlineState.myId) return '';
                    return `
                        <div class="op-status ${p.foundCount === 6 ? 'winner' : ''}">
                            <img src="${p.photoURL || 'default.png'}" class="op-photo">
                            <div class="op-match-count">${p.foundCount || 0}/6</div>
                        </div>`;
                }).join('')}
            </div>`;

        // 당첨자 발생 감지
        if (roomData.status === "finished") {
            handleMultiWin(Object.values(roomData.winners), currentPrizePool);
        }
    });

    // 게임 보드 렌더링 (셔플된 40장 카드)
    // 온라인 모드이므로 클릭 시 서버에 'flip' 이벤트를 전송해야 함
    renderBoard(board);
}

/**
 * 4. 상금 계산기 (제시된 데이터 기반)
 */
function calculatePool(flips) {
    if (flips <= 6) return 1000000000;
    if (flips >= 40) return 0;
    return ONLINE_PRIZE_TABLE[flips] || 0;
}

/**
 * 5. 게임 종료 및 상금 분배
 */
async function handleMultiWin(winners, totalPrizePool) {
    onlineState.isGameOver = true;
    const shareCount = winners.length;
    const finalPrizePerPerson = Math.floor(totalPrizePool / shareCount);

    // 결과 알림
    const message = shareCount > 1 
        ? `공동 우승! ${shareCount}명이 상금을 나눠가집니다.` 
        : `단독 우승! 잭팟을 독점합니다!`;

    showResultButtons(`WINNERS: ${shareCount}명<br><small>${message}</small><br><strong>각 ${finalPrizePerPerson.toLocaleString()} C</strong>`);

    // 유저 코인 업데이트 로직 (내 아이디가 winners에 포함된 경우만)
    const isMeWinner = winners.some(w => w.uid === onlineState.myId);
    if (isMeWinner) {
        // Firestore 유저 코인 증가 로직 실행
    }
}

/**
 * 6. 결과 화면 버튼 (나가기 / 다시하기)
 */
function showResultButtons(message) {
    const footer = document.querySelector('.my-numbers-footer');
    if (footer) footer.remove();

    const header = document.getElementById('game-header');
    header.innerHTML = `<h2 class="result-msg neon-text">${message}</h2>`;
    
    const board = document.getElementById('game-board');
    board.innerHTML = `
        <div class="result-actions">
            <button class="neon-btn success" onclick="location.reload()">REPLAY (LOBBY)</button>
            <button class="neon-btn primary" onclick="location.reload()">EXIT GAME</button>
        </div>`;
}

function renderBoard(board) {
    // 40장 카드 렌더링 및 클릭 시 서버 totalFlips increment 로직 구현부
    // (이전 턴 기반 또는 자동 모드 로직에 따라 상이)
}
