import { ref, onValue, update, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { renderOnlineLobby } from './online-lobby.js';
import { initSelectionPhase } from './online-game.js';

let currentRoomListener = null;

export function enterWaitingRoom(roomId) {
    const container = document.getElementById('online-tab');
    const rtdb = window.lotGoRtdb;
    const user = window.lotGoAuth.currentUser;

    // 대기방 UI 렌더링
    container.innerHTML = `
        <div class="game-room-border waiting-room">
            <h2 id="room-title-disp">WAITING...</h2>
            <div id="players-grid" style="display:flex; justify-content:center; flex-wrap:wrap; gap:20px; margin: 40px 0;"></div>
            
            <div class="action-area">
                <button id="ready-btn" class="neon-btn primary">READY</button>
                <button id="start-btn" class="neon-btn success" style="display:none;">START GAME</button>
                <button id="leave-btn" class="neon-btn secondary">LEAVE</button>
            </div>
        </div>
    `;

    // 본인 입장 처리 (이미 생성시 방장은 들어감, 참가자만 update)
    const playerRef = ref(rtdb, `rooms/${roomId}/players/${user.uid}`);
    update(playerRef, {
        email: user.email,
        ready: false,
        isHost: false // 덮어씌워질 수 있으므로 주의 (실제론 transaction 권장)
    });

    // 룸 상태 감지
    const roomRef = ref(rtdb, `rooms/${roomId}`);
    currentRoomListener = onValue(roomRef, (snap) => {
        const room = snap.val();
        if(!room) return renderOnlineLobby(); // 방 폭파됨

        if(room.status === 'selecting') {
            // 게임 시작 (선택 단계)
            initSelectionPhase(roomId, room);
            return;
        }

        document.getElementById('room-title-disp').innerText = `${room.title} (${Object.keys(room.players).length}/${room.maxPlayers})`;
        renderPlayers(room.players, user.uid, room.host);
        
        // 방장에게만 START 버튼 노출 & 모두 레디했는지 확인
        const isHost = (room.host === user.uid);
        const startBtn = document.getElementById('start-btn');
        const readyBtn = document.getElementById('ready-btn');

        if(isHost) {
            readyBtn.style.display = 'none';
            startBtn.style.display = 'inline-block';
            
            // 모든 플레이어(방장 제외)가 ready 상태여야 함
            const allReady = Object.values(room.players).every(p => p.isHost || p.ready);
            startBtn.disabled = !allReady || Object.keys(room.players).length < 2; // 최소 2명
        }
    });

    // 버튼 이벤트
    document.getElementById('ready-btn').onclick = () => {
        const isReady = document.getElementById('ready-btn').classList.toggle('success');
        update(playerRef, { ready: isReady }); // 토글
    };

    document.getElementById('start-btn').onclick = () => {
        update(roomRef, { status: 'selecting', startTime: Date.now() });
    };

    document.getElementById('leave-btn').onclick = () => {
        remove(playerRef); // 나감
        renderOnlineLobby();
    };
}

function renderPlayers(players, myUid, hostUid) {
    const grid = document.getElementById('players-grid');
    grid.innerHTML = '';
    Object.entries(players).forEach(([uid, p]) => {
        const isHost = uid === hostUid;
        grid.innerHTML += `
            <div class="player-slot">
                <div class="player-avatar ${p.ready ? 'player-ready' : ''}" 
                     style="background: url('https://via.placeholder.com/60') center/cover;"></div>
                <div style="margin-top:5px; color:${isHost ? '#fbbf24' : '#fff'}">
                    ${isHost ? '👑 ' : ''}${p.email.split('@')[0]}
                </div>
            </div>
        `;
    });
}
