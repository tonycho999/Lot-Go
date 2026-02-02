export function renderWaitingRoom(roomData, currentUser) {
    const isHost = roomData.hostId === currentUser.uid;
    const allReady = roomData.players.every(p => p.isReady || p.uid === roomData.hostId);

    return `
        <div class="waiting-room">
            <h2>${roomData.title}</h2>
            <div class="player-grid">
                ${roomData.players.map(p => `
                    <div class="player-card ${p.isReady ? 'ready' : ''}">
                        <img src="${p.photoURL || 'default.png'}">
                        <span>${p.name}</span>
                        ${p.uid === roomData.hostId ? '<span class="host-tag">HOST</span>' : ''}
                    </div>
                `).join('')}
            </div>
            <div class="room-actions">
                ${!isHost ? `<button class="neon-btn" onclick="toggleReady()">${currentUser.isReady ? 'UNREADY' : 'READY'}</button>` : ''}
                ${isHost ? `<button class="neon-btn success" ${allReady ? '' : 'disabled'} onclick="startGame()">START GAME</button>` : ''}
            </div>
        </div>
    `;
}
