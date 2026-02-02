cat <<EOF > public/js/app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { firebaseConfig } from "../firebase-config.js";
import { initAuthView } from "./auth.js";
import { initLobbyView } from "./lobby.js";
import { initGameView } from "./game.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

onAuthStateChanged(auth, (user) => {
    if (user) {
        window.currentView = 'lobby';
        initLobbyView(user);
    } else {
        window.currentView = 'auth';
        initAuthView();
    }
});

window.switchView = (view, data) => {
    if(view === 'lobby') initLobbyView(auth.currentUser);
    if(view === 'game') initGameView(auth.currentUser, data);
};
EOF
