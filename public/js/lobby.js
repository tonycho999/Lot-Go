cat <<EOF > public/js/lobby.js
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

export function initLobbyView(user) {
    const root = document.getElementById('app-viewport');
    root.innerHTML = \`
        <div class="app-container">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <h2 style="margin:0;">Lobby</h2>
                <button id="logout-btn" style="width:auto; padding:5px 10px; font-size:10px; background:#94a3b8;">Logout</button>
            </div>
            <div class="stat-box" style="background:#f1f5f9; padding:20px; border-radius:15px; margin:20px 0; text-align:center;">
                <div style="font-size:12px; color:#64748b;">TOTAL BALANCE</div>
                <div id="lobby-coins" style="font-size:28px; font-weight:900; color:#6366f1;">---</div>
            </div>
            <button class="mode-btn" data-lv="1">Level 1 (Easy)</button>
            <button class="mode-btn" data-lv="2">Level 2 (Normal)</button>
            <button class="mode-btn" data-lv="3">Level 3 (Hard)</button>
        </div>
    \`;

    const db = getDatabase();
    onValue(ref(db, 'users/' + user.uid + '/coins'), (s) => {
        document.getElementById('lobby-coins').innerText = (s.val() || 0).toLocaleString() + " COINS";
    });

    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.onclick = () => window.switchView('game', btn.dataset.lv);
    });

    document.getElementById('logout-btn').onclick = () => signOut(getAuth());
}
EOF
