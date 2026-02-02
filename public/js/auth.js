cat <<EOF > public/js/auth.js
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

export function initAuthView() {
    const root = document.getElementById('app-viewport');
    root.innerHTML = \`
        <div class="app-container">
            <h2>Welcome</h2>
            <input type="email" id="email" placeholder="Email">
            <input type="password" id="pw" placeholder="Password">
            <button id="login-btn">Login</button>
            <button id="signup-open" style="background:none; color:#6366f1; border:1px solid #6366f1;">Create Account</button>
        </div>
        <div id="signup-modal" class="modal">
            <div class="app-container" style="height:auto;">
                <h3>Sign Up</h3>
                <input type="email" id="reg-email" placeholder="Email">
                <input type="password" id="reg-pw" placeholder="Password">
                <input type="password" id="reg-pw-confirm" placeholder="Confirm Password">
                <button id="reg-btn">Register</button>
                <button onclick="document.getElementById('signup-modal').style.display='none'" style="background:#94a3b8;">Close</button>
            </div>
        </div>
    \`;

    document.getElementById('login-btn').onclick = () => {
        const auth = getAuth();
        signInWithEmailAndPassword(auth, document.getElementById('email').value, document.getElementById('pw').value)
            .catch(e => alert(e.message));
    };

    document.getElementById('signup-open').onclick = () => document.getElementById('signup-modal').style.display = 'flex';

    document.getElementById('reg-btn').onclick = async () => {
        const email = document.getElementById('reg-email').value;
        const pw = document.getElementById('reg-pw').value;
        if(pw !== document.getElementById('reg-pw-confirm').value) return alert("Passwords mismatch");
        
        const auth = getAuth();
        const db = getDatabase();
        try {
            const res = await createUserWithEmailAndPassword(auth, email, pw);
            await set(ref(db, 'users/' + res.user.uid), { email, coins: 3000 });
        } catch(e) { alert(e.message); }
    };
}
EOF
