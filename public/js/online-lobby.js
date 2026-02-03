import { ref, set, push, onValue, update, remove, runTransaction } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { doc, getDoc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { initSelectionPhase } from './online-game.js';

let currentRoomId = null;

// [1] 온라인 로비 렌더링
export function renderOnlineLobby() {
    const container = document.getElementById('online-tab');
    if (!container) return;

    container.innerHTML = `
        <div class="online-container" style="max-width: 800px; margin: 0 auto; padding: 20px; color: #fff;">
            <div class="lobby-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                <h2 style="font-family:'Orbitron'; color:#3b82f6;">ONLINE LOBBY</h2>
                <button id="create-room-btn" class="neon-btn primary" style="font-size:0.9rem; padding:10px 20px;">+ CREATE ROOM</button>
            </div>

            <div class="game-room-border" style="min-height: 300px; padding: 20px; margin-bottom: 20px;">
                <h3 style="border-bottom:1px solid #334155; padding-bottom:10px;">AVAILABLE ROOMS</h3>
                <div id="room-list" style="display:flex; flex-direction:column; gap:10px; margin-top:10px;">
                    <div style="text-align:center; color:#64748b; padding:20px;">Loading rooms...</div>
                </div>
            </div>

            <div class="chat-container game-room-border" style="height: 250px; padding: 15px; display:flex; flex-direction:column;">
                <div id="chat-messages" style="flex:1; overflow-y:auto; margin-bottom:10px; font-size:0.9rem; color:#cbd5e1;"></div>
                <div style="display:flex; gap:10px;">
                    <input type="text" id="chat-input" placeholder="Say hello..." class="neon-input" style="flex:1;">
                    <button id="send-chat-btn" class="neon-btn secondary" style="padding:10px 20px;">SEND</button>
                </div>
            </div>
        </div>
    `;

    // 이벤트 리스너 연결
    document.getElementById('create-room-btn').addEventListener('click', createRoom);
    document.getElementById('send-chat-btn').addEventListener('click', sendChatMessage);
    
    // 방 목록 & 채팅 리스너 시작
    listenToRooms();
    listenToChat();
}

// [2] 방 생성 (비용 1000 C + 경험치 100 XP)
async function createRoom() {
    const db = window.lotGoDb;
    const rtdb = window.lotGoRtdb;
    const auth = window.lotGoAuth;
    const user = auth.currentUser;

    if (!user) return alert("Login required.");

    // 코인 확인 및 차감
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.data().coins < 1000) return alert("Need 1,000 Coins to play Online.");

    if (!confirm("Start Online Game? (Cost: 1,000 C)")) return;

    // [수정] 코인 차감 및 XP 지급 (100xp)
    await updateDoc(userRef, { 
        coins: increment(-1000),
        exp: increment(100) 
    });

    // RTDB 방 생성
    const roomsRef = ref(rtdb, 'rooms');
    const newRoomRef = push(roomsRef);
    const roomId = newRoomRef.key;

    const roomData = {
        id: roomId,
        host: user.uid,
        status: 'waiting', // waiting -> playing -> ended
        createdAt: Date.now(),
        players: {
            [user.uid]: {
                email: user.email,
                ready: true, // 방장은 자동 레디
                score: 0
            }
        },
        mode: 'auto' // 자동 추첨 모드
    };

    await set(newRoomRef, roomData);
    enterGameRoom(roomId);
}

// [3] 방 참여 (비용 1000 C + 경험치 100 XP)
window.joinRoom = async (roomId) => {
    const db = window.lotGoDb;
    const rtdb = window.lotGoRtdb;
    const auth = window.lotGoAuth;
    const user = auth.currentUser;

    if (!user) return alert("Login required.");

    // 코인 확인
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.data().coins < 1000) return alert("Need 1,000 Coins to play Online.");

    if (!confirm("Join this game? (Cost: 1,000 C)")) return;

    // [수정] 코인 차감 및 XP 지급 (100xp)
    await updateDoc(userRef, { 
        coins: increment(-1000),
        exp: increment(100)
    });

    // RTDB 참가 처리
    const roomRef = ref(rtdb, `rooms/${roomId}/players/${user.uid}`);
    await set(roomRef, {
        email: user.email,
        ready: false,
        score: 0
    });
    
    enterGameRoom(roomId);
};

// [4] 게임 대기실 입장
function enterGameRoom(roomId) {
    currentRoomId = roomId;
    const container = document.getElementById('online-tab');
    
    // 대기실 UI 렌더링 (간단 버전)
    container.innerHTML = `
        <div class="game-room-border" style="text-align:center; padding:30px;">
            <h2>GAME ROOM</h2>
            <div id="room-status" style="margin-bottom:20px; color:#fbbf24;">WAITING FOR PLAYERS...</div>
            <div id="players-list" style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap; margin-bottom:30px;"></div>
            
            <button id="start-game-btn" class="neon-btn success" style="display:none;">START GAME</button>
            <div id="ready-msg" style="color:#94a3b8;">Waiting for host to start...</div>
        </div>
    `;

    const rtdb = window.lotGoRtdb;
    const auth = window.lotGoAuth;
    const roomRef = ref(rtdb, `rooms/${roomId}`);

    onValue(roomRef, (snapshot) => {
        const room = snapshot.val();
        if (!room) return; // 방이 삭제됨

        // 플레이어 목록 표시
        const pList = document.getElementById('players-list');
        pList.innerHTML = Object.values(room.players).map(p => `
            <div class="player-card" style="border:1px solid #334155; padding:10px; border-radius:10px; background:#1e293b;">
                <div>${p.email.split('@')[0]}</div>
                <div style="font-size:0.8rem; color:${p.ready ? '#4ade80' : '#94a3b8'}">${p.ready ? 'READY' : '...'}</div>
            </div>
        `).join('');

        // 게임 시작 감지
        if (room.status === 'playing') {
            initSelectionPhase(roomId, room); // 게임 화면으로 전환 (online-game.js)
        }

        // 방장에게만 시작 버튼 표시
        if (room.host === auth.currentUser.uid) {
            const startBtn = document.getElementById('start-game-btn');
            const readyMsg = document.getElementById('ready-msg');
            startBtn.style.display = 'inline-block';
            readyMsg.style.display = 'none';
            
            startBtn.onclick = () => {
                update(roomRef, { status: 'playing' });
            };
        }
    });
}

// [5] 방 목록 리스너
function listenToRooms() {
    const rtdb = window.lotGoRtdb;
    const roomsRef = ref(rtdb, 'rooms');
    
    onValue(roomsRef, (snapshot) => {
        const listEl = document.getElementById('room-list');
        if (!listEl) return;
        
        const rooms = snapshot.val();
        listEl.innerHTML = '';

        if (!rooms) {
            listEl.innerHTML = '<div style="color:#64748b; text-align:center;">No active rooms. Create one!</div>';
            return;
        }

        Object.values(rooms).forEach(room => {
            if (room.status !== 'waiting') return; // 대기중인 방만 표시
            
            const div = document.createElement('div');
            div.className = 'room-item';
            div.style.cssText = "background:#1e293b; padding:15px; border-radius:8px; display:flex; justify-content:space-between; align-items:center; border:1px solid #334155;";
            div.innerHTML = `
                <div>
                    <span style="color:#fff; font-weight:bold;">Room #${room.id.substring(0,4)}</span>
                    <span style="color:#94a3b8; font-size:0.9rem; margin-left:10px;">Players: ${Object.keys(room.players).length}</span>
                </div>
                <button class="neon-btn primary" style="padding:5px 15px; font-size:0.8rem;" onclick="joinRoom('${room.id}')">JOIN</button>
            `;
            listEl.appendChild(div);
        });
    });
}

// [6] 채팅 리스너
function listenToChat() {
    const rtdb = window.lotGoRtdb;
    const chatRef = ref(rtdb, 'lobby_chat');
    
    onValue(chatRef, (snapshot) => {
        const chatBox = document.getElementById('chat-messages');
        if (!chatBox) return;

        const msgs = snapshot.val();
        if (!msgs) return;

        // 최근 50개만 표시 등 로직 추가 가능
        const html = Object.values(msgs).slice(-20).map(m => `
            <div style="margin-bottom:5px;">
                <span style="color:#3b82f6; font-weight:bold;">${m.user}:</span> 
                <span style="color:#e2e8f0;">${m.text}</span>
            </div>
        `).join('');
        
        chatBox.innerHTML = html;
        chatBox.scrollTop = chatBox.scrollHeight;
    });
}

// [7] 채팅 보내기
function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;

    const rtdb = window.lotGoRtdb;
    const auth = window.lotGoAuth;
    const user = auth.currentUser;
    const email = user.email.split('@')[0];

    push(ref(rtdb, 'lobby_chat'), {
        user: email,
        text: text,
        timestamp: Date.now()
    });
    
    input.value = '';
}
