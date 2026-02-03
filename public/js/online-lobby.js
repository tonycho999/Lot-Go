import { ref, push, onChildAdded, onValue, set, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { showCreateRoomModal } from './room-create.js';
import { enterWaitingRoom } from './room-waiting.js';

export function renderOnlineLobby() {
    const container = document.getElementById('online-tab');
    const rtdb = window.lotGoRtdb;
    const user = window.lotGoAuth.currentUser;

    container.innerHTML = `
        <div class="lobby-container">
            <div class="room-list-section" id="room-list">
                </div>

            <div class="chat-section">
                <div class="chat-messages" id="lobby-chat"></div>
                <div class="chat-input-area">
                    <input type="text" id="chat-input" class="neon-input" placeholder="Say hello..." style="margin-bottom:0; flex:1;">
                    <button id="send-btn" class="neon-btn primary" style="margin-top:0; margin-left:10px; padding: 10px 20px;">SEND</button>
                </div>
            </div>

            <div class="user-list-section">
                <h4>ONLINE USERS</h4>
                <div id="online-users-list"></div>
            </div>
        </div>
        <div class="lobby-actions">
            <button id="create-room-btn" class="neon-btn success">CREATE GAME</button>
        </div>
    `;

    // 이벤트 리스너 연결
    document.getElementById('create-room-btn').onclick = showCreateRoomModal;
    
    // 채팅 전송
    document.getElementById('send-btn').onclick = () => sendChat(user);
    
    // 방 목록 리스너
    const roomsRef = ref(rtdb, 'rooms');
    onChildAdded(roomsRef, (snapshot) => {
        const room = snapshot.val();
        const roomId = snapshot.key;
        if(room.status === 'waiting') {
            addRoomToUI(roomId, room);
        }
    });

    // 접속자 리스너 (간이 구현)
    const presenceRef = ref(rtdb, 'online_users');
    // 본인 등록
    set(ref(rtdb, `online_users/${user.uid}`), { email: user.email });
    // 접속 종료시 삭제 (onDisconnect는 생략, 실제 서비스엔 필요)
    
    onValue(presenceRef, (snap) => {
        const list = document.getElementById('online-users-list');
        list.innerHTML = '';
        snap.forEach(child => {
            list.innerHTML += `<div class="online-user">🟢 ${child.val().email.split('@')[0]}</div>`;
        });
    });

    listenToChat();
}

function addRoomToUI(roomId, room) {
    const list = document.getElementById('room-list');
    const div = document.createElement('div');
    div.className = 'room-item';
    div.innerHTML = `
        <div class="room-info">
            <h4>${room.title}</h4>
            <p>${room.mode === 'auto' ? '⚡ Auto (7s)' : '⏳ Manual (10s)'} | ${Object.keys(room.players || {}).length}/${room.maxPlayers}</p>
        </div>
        <div style="font-size:1.5rem;">${room.password ? '🔒' : '🔓'}</div>
    `;
    div.onclick = () => joinRoom(roomId, room);
    list.appendChild(div);
}

function joinRoom(roomId, room) {
    if(room.password) {
        const pw = prompt("Enter Password:");
        if(pw !== room.password) return alert("Wrong password!");
    }
    // 참가 로직
    enterWaitingRoom(roomId);
}

function sendChat(user) {
    const input = document.getElementById('chat-input');
    const msg = input.value;
    if(!msg) return;
    push(ref(window.lotGoRtdb, 'lobby_chat'), {
        user: user.email.split('@')[0],
        text: msg,
        time: Date.now()
    });
    input.value = '';
}

function listenToChat() {
    const chatBox = document.getElementById('lobby-chat');
    onChildAdded(ref(window.lotGoRtdb, 'lobby_chat'), (snap) => {
        const data = snap.val();
        chatBox.innerHTML += `<div class="chat-msg"><span class="user">${data.user}:</span> ${data.text}</div>`;
        chatBox.scrollTop = chatBox.scrollHeight;
    });
}
