export function renderProfile(user) {
    const container = document.getElementById('profile-tab');
    container.innerHTML = `
        <div class="profile-card">
            <p>${user.email}</p>
            <button class="main-btn logout" onclick="handleLogout()">LOGOUT</button>
        </div>
    `;
}

export function handleLogout(auth) {
    if (confirm("Logout?")) auth.signOut();
}
