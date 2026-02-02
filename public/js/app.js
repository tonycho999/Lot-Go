import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { firebaseConfig } from "../firebase-config.js";

// 모듈 불러오기
import { renderBalance, switchTab } from "./home.js";
import { renderSingleMenu } from "./singlegame.js";
import { renderShop } from "./shop.js";
import { renderProfile } from "./profile.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

window.switchTab = switchTab;

onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('auth-view').style.display = 'none';
        document.getElementById('lobby-view').style.display = 'flex';
        
        // 초기 UI 렌더링
        renderSingleMenu();
        renderShop();
        renderProfile(user);

        // 코인 실시간 동기화
        onValue(ref(db, `users/${user.uid}/coins`), (snap) => {
            renderBalance(snap.val() || 0);
        });
    } else {
        document.getElementById('auth-view').style.display = 'flex';
        document.getElementById('lobby-view').style.display = 'none';
    }
});
