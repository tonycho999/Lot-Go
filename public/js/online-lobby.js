import { ref, onValue, push, set, remove, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// DOM 요소 캐싱
let lobbyContainer = null;
let roomsRef = null;
let connectedRef = null;

export function initOnlineLobby() {
    lobbyContainer = document.getElementById('online-tab');
    if (!lobbyContainer) return;

    // 초기 UI 렌더링
    renderLobbyLayout();

    // Firebase Realtime Database 참조
    const db = window.lotGoDbRtdb || window.lotGoDb; // RTDB 인스턴스 (app.js에서 설정 필요)
    
    // 1. 방 목록 리스너
    const roomsRef = ref(db, 'rooms');
    onValue(roomsRef, (snapshot) => {
        const rooms = snapshot.val() || {};
        updateRoomList(rooms);
    });

    // 2. 접속자 수 리스너 (선택 사항)
    // ...
}

function renderLobbyLayout() {
    lobbyContainer.innerHTML = `
        <div class="lobby-container" style="display: flex; flex-direction: column; height: 100%; gap: 15px;">
            <div class="lobby-header" style="display: flex; gap: 10px;">
                <button class="neon-btn primary" onclick="showCreateRoomModal()" style="flex: 1; font-size: 1rem;">
                    + CREATE ROOM
                </button>
                <div class="online-count-badge" style="background: #1e293b; padding: 10px 20px; border-radius: 12px; border: 1px solid #334155; color: #94a3b8; display: flex; align-items: center;">
                    <span style="color: #10b981; margin-right: 5px;">●</span> Online
                </div>
            </div>

            <div id="room-list-area" class="custom-scrollbar" style="
                flex: 1; 
                background: rgba(15, 23, 42, 0.6); 
                border-radius: 16px; 
                border: 1px solid #334155; 
                padding: 15px; 
                overflow-y: auto;
                min-height: 300px;
            ">
                <div style="text-align: center; color: #64748b; margin-top: 50px;">
                    Loading Rooms...
                </div>
            </div>
        </div>
    `;
}

function updateRoomList(rooms) {
    const listArea = document.getElementById('room-list-area');
    if (!listArea) return;

    const roomKeys = Object.keys(rooms);
    
    if (roomKeys.length === 0) {
        listArea.innerHTML = `
            <div style="text-align: center; color: #64748b; margin-top: 50px; display: flex; flex-direction: column; align-items: center;">
                <div style="font-size: 2rem; margin-bottom: 10px;">zzz...</div>
                <div>No rooms available.</div>
                <div style="font-size: 0.8rem; margin-top: 5px;">Be the first to create one!</div>
            </div>`;
        return;
    }

    let html = `<div style="display: grid; gap: 10px;">`;
    
    roomKeys.forEach(key => {
        const r = rooms[key];
        // 방 상태에 따른 스타일 (대기중 / 게임중)
        const isPlaying = r.status === 'playing';
        const statusColor = isPlaying ? '#ef4444' : '#10b981';
        const statusText = isPlaying ? 'PLAYING' : 'WAITING';
        const playerCount = r.players ? Object.keys(r.players).length : 0;

        html += `
            <div class="room-item" onclick="joinRoom('${key}')" style="
                background: #1e293b; 
                padding: 15px; 
                border-radius: 12px; 
                border: 1px solid ${isPlaying ? '#451a1a' : '#334155'};
                cursor: ${isPlaying ? 'not-allowed' : 'pointer'};
                display: flex; justify-content: space-between; align-items: center;
                transition: 0.2s;
            " onmouseover="this.style.background='#2c3e50'" onmouseout="this.style.background='#1e293b'">
                
                <div class="room-info">
                    <div style="font-weight: 700; font-size: 1.1rem; color: #e2e8f0; margin-bottom: 4px;">
                        ${r.title || 'Untitled Room'}
                    </div>
                    <div style="font-size: 0.8rem; color: #94a3b8;">
                        ${r.mode === 'auto' ? '⚡ Auto Mode' : '✋ Manual Mode'} • 
                        <span style="color: #fbbf24;">Prize: 10억 C</span>
                    </div>
                </div>

                <div class="room-status" style="text-align: right;">
                    <div style="font-size: 0.8rem; color: ${statusColor}; font-weight: 700; margin-bottom: 4px; border: 1px solid ${statusColor}; padding: 2px 8px; border-radius: 10px; display: inline-block;">
                        ${statusText}
                    </div>
                    <div style="font-size: 0.9rem; color: #cbd5e1;">
                        ${playerCount} / ${r.maxPlayers || 10}
                    </div>
                </div>
            </div>
        `;
    });
    html += `</div>`;
    listArea.innerHTML = html;
}

// 전역 함수 연결 (HTML onclick용)
window.showCreateRoomModal = () => {
    // room-create.js의 함수 호출 (다음 단계에서 구현 예정)
    alert("방 만들기 팝업을 준비 중입니다.");
};

window.joinRoom = (roomId) => {
    // room-joining 로직
    alert(`Joining room: ${roomId}`);
};
