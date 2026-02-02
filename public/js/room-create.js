export function showCreateRoomModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="create-room-box neon-panel">
            <h3>CREATE NEW GAME</h3>
            <input type="text" id="new-room-title" placeholder="Room Title">
            
            <div class="option-group">
                <label>MODE</label>
                <select id="room-mode">
                    <option value="auto">AUTO (Every 3s)</option>
                    <option value="manual">MANUAL (Turn based - 5s)</option>
                </select>
            </div>

            <div class="option-group">
                <label>MAX PLAYERS</label>
                <input type="number" id="room-max" value="10" min="2" max="10">
            </div>

            <div class="option-group">
                <label>PRIVATE</label>
                <input type="password" id="room-pw" placeholder="Password (Optional)">
            </div>

            <div class="modal-btns">
                <button class="neon-btn success" onclick="handleCreateRoom()">CREATE</button>
                <button class="neon-btn fail" onclick="closeModal()">CANCEL</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}
