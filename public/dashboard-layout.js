// 1. Define the HTML for the shared Navbar and Sidebar
const sharedLayout = `
    <header id="top-nav">
        <div class="nav-left">
            <button id="hamburger-btn" class="hamburger">☰</button>
            <h1 class="logo" style="margin-left: 20px;">MediSparta</h1>
        </div>
        <button id="logout-btn" onclick="logoutUser()">Logout</button>
    </header>

    <aside id="sidebar" class="sidebar">
        <div class="sidebar-header">
            <h2>Menu</h2>
        </div>
        <ul class="sidebar-links">
            <li><a href="#" id="nav-home">🏠 Dashboard Home</a></li>
            <li><a href="#" id="nav-profile">👤 My Profile</a></li>
            <li><a href="#" id="theme-toggle">🌙 Enable Dark Mode</a></li>
        </ul>
    </aside>
`;

// 2. Inject the HTML into the page immediately after the <body> tag starts
document.body.insertAdjacentHTML('afterbegin', sharedLayout);

// 3. Hamburger Menu Logic
const hamburgerBtn = document.getElementById('hamburger-btn');
const sidebar = document.getElementById('sidebar');

if (hamburgerBtn && sidebar) {
    hamburgerBtn.addEventListener('click', () => {
        sidebar.classList.toggle('active'); 
    });

    document.addEventListener('click', (event) => {
        if (!sidebar.contains(event.target) && event.target !== hamburgerBtn) {
            sidebar.classList.remove('active');
        }
    });
}

// --- NEW: FUNCTIONAL SIDEBAR LINKS ---

// A. Route "Dashboard Home" based on Role
document.getElementById('nav-home').addEventListener('click', (e) => {
    e.preventDefault();
    const role = sessionStorage.getItem('userRole');
    if (role === 'admin') window.location.href = 'admin.html';
    else if (role === 'staff') window.location.href = 'staff.html';
    else if (role === 'student') window.location.href = 'student.html';
    else window.location.href = 'index.html';
});

// B. Dark Mode Logic
const themeToggleBtn = document.getElementById('theme-toggle');
const currentTheme = localStorage.getItem('theme');

// Check memory on page load: If they chose dark mode before, apply it immediately
if (currentTheme === 'dark') {
    document.body.classList.add('dark-theme');
    themeToggleBtn.textContent = '☀️ Enable Light Mode';
}

// Listen for clicks on the toggle button
themeToggleBtn.addEventListener('click', (e) => {
    e.preventDefault();
    
    // Toggle the CSS class on the body
    document.body.classList.toggle('dark-theme');
    
    // Update the button text and save to browser memory
    if (document.body.classList.contains('dark-theme')) {
        themeToggleBtn.textContent = '☀️ Enable Light Mode';
        localStorage.setItem('theme', 'dark');
    } else {
        themeToggleBtn.textContent = '🌙 Enable Dark Mode';
        localStorage.setItem('theme', 'light');
    }
});

// --- LOGOUT FUNCTION ---
window.logoutUser = function() {
    sessionStorage.removeItem('userRole'); 
    sessionStorage.removeItem('userId'); 
    window.location.replace('index.html'); 
};