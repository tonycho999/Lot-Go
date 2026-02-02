cat <<EOF > public/js/game.js
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

export function initGameView(user, level) {
    const config = {
        1: { name: 'EASY', total: 4, pick: 2, cost: 100, max: 400, cols: 2, m: 2 },
        2: { name: 'NORMAL', total: 10, pick: 4, cost: 200, max: 30000, cols: 5, m: 100 },
        3: { name: 'HARD', total: 20, pick: 6, cost: 500, max: 12000000, cols: 5, m: 200 }
    };
    const cfg = config[level];
    let picks = [], deck = [], opened = 0, active = false, currentCoins = 0;

    const root = document.getElementById('app-viewport');
    root.innerHTML = \`
        <div class="app-container">
            <div class="header" style="display:flex; justify-content:space-between; font-size:12px;">
                <span id="exit-game" style="cursor:pointer; color:#6366f1;">[ EXIT ]</span>
                <span>MODE: \${cfg.name}</span>
            </div>
            <div class="stat-grid" style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin:15px 0;">
                <div class="stat-box" style="background:#f1f5f9; padding:10px; border-radius:10px; text-align:center;">
                    <small>WALLET</small><div id="game-coins">---</div>
                </div>
                <div class="stat-box" style="background:#f1f5f9; padding:10px; border-radius:10px; text-align:center;">
                    <small>PRIZE</small><div id="game-prize" style="color:#10b981; font-weight:bold;">\${cfg.max.toLocaleString()}</div>
                </div>
            </div>
            <div id="game-guide" style="text-align:center; margin-bottom:10px; font-weight:bold; color:#6366f1;">SELECT \${cfg.pick} CARDS</div>
            <div id="game-board" class="card-grid" style="grid-template-columns:repeat(\${cfg.cols}, 1fr);"></div>
            <button id="start-btn">START MISSION (\${cfg.cost})</button>
            <div id="game-controls" style="display:none; gap:10px; margin-top:10px;">
                <button onclick="window.switchView('game', \${level})" style="flex:1;">RETRY</button>
                <button onclick="window.switchView('lobby')" style="flex:1; background:#94a3b8;">LOBBY</button>
            </div>
        </div>
    \`;

    const db = getDatabase();
    onValue(ref(db, 'users/' + user.uid + '/coins'), s => {
        currentCoins = s.val() || 0;
        document.getElementById('game-coins').innerText = currentCoins.toLocaleString();
    });

    const board = document.getElementById('game-board');
    for(let i=1; i<=cfg.total; i++) {
        const card = document.createElement('div');
        card.className = 'card'; card.innerText = i;
        card.onclick = () => {
            if(active) return;
            if(picks.includes(i)) { picks = picks.filter(p => p !== i); card.classList.remove('selected'); }
            else if(picks.length < cfg.pick) { picks.push(i); card.classList.add('selected'); }
        };
        board.appendChild(card);
    }

    document.getElementById('exit-game').onclick = () => window.switchView('lobby');
    document.getElementById('start-btn').onclick = async () => {
        if(picks.length !== cfg.pick) return alert("Select " + cfg.pick + " cards!");
        if(currentCoins < cfg.cost) return alert("Not enough coins!");
        
        active = true;
        await set(ref(db, 'users/' + user.uid + '/coins'), currentCoins - cfg.cost);
        document.getElementById('start-btn').style.display = 'none';
        deck = Array.from({length: cfg.total}, (_, i) => i + 1).sort(() => Math.random() - 0.5);
        
        document.querySelectorAll('.card').forEach((c, i) => {
            c.innerText = '?'; c.className = 'card hidden';
            c.onclick = () => {
                if(!c.classList.contains('hidden')) return;
                opened++;
                const val = deck[i];
                c.innerText = val; c.className = 'card';
                if(picks.includes(val)) c.classList.add('matched');
                
                let p = cfg.max;
                if(opened >= cfg.total) p = 0;
                else if(opened > cfg.pick) p = Math.max(0, cfg.max - (opened - cfg.pick) * (cfg.m * 100));
                document.getElementById('game-prize').innerText = p.toLocaleString();

                const matched = document.querySelectorAll('.matched').length;
                if(matched === cfg.pick || opened === cfg.total) {
                    setTimeout(async () => {
                        alert(matched === cfg.pick ? "Mission Complete! Reward: " + p : "Mission Failed");
                        await set(ref(db, 'users/' + user.uid + '/coins'), currentCoins + p);
                        document.getElementById('game-controls').style.display = 'flex';
                    }, 500);
                }
            };
        });
    };
}
EOF
