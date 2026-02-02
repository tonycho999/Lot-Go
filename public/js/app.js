import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { firebaseConfig } from "../firebase-config.js";

// Import UI Modules
import { renderBalance, switchTab } from "./home.js";
import { renderSingleMenu } from "./singlegame.js";
import { renderProfile } from "./profile.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// Globalize functions for HTML onclick
window.switchTab = switchTab;

onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('auth-view').style.display = 'none';
        document.getElementById('lobby-view').style.display = 'flex';
        
        // Load initial UI
        renderSingleMenu();
        renderProfile(user);

        // Listen for balance updates
        onValue(ref(db, `users/${user.uid}/coins`), (snap) => {
            renderBalance(snap.val() || 0);
        });
    } else {
        document.getElementById('auth-view').style.display = 'flex';
        document.getElementById('lobby-view').style.display = 'none';
    }
});
