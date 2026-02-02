export function renderOnlineLobby(users, rooms) {
    const container = document.getElementById('online-tab');
    container.innerHTML = `
        <div class="online-layout">
            <div class="room-list-side">
                <div class="side-header">ROOMS</div>
                <div id="rooms-container">
                    ${rooms.map(room => `
                        <div class="room-item" onclick="checkJoinRoom('${room.id}')">
                            <span class="room-name">${room.title}</span>
                            <span class="room-count">${room.players.length}/${room.maxPlayers}</span>
                        </div>
                    `).join('')}
                </div>
                <button class="neon-btn primary" onclick="showCreateRoomModal()">CREATE ROOM</button>
            </div>

            <div class="chat-side">
                <div id="chat-messages"></div>
                <div class="chat-input-area">
                    <input type="text" id="chat-input" placeholder="Message...">
                    <button onclick="sendGlobalChat()">SEND</button>
                </div>
            </div>

            <div class="user-side">
                <div class="side-header">ONLINE</div>
                <div id="online-users">
                    ${users.map(u => `<div>● ${u.name}</div>`).join('')}
                </div>
            </div>
        </div>
    `;
}
