// 1. Define the HTML for the shared Navbar and Sidebar
const sharedLayout = `
    <header id="top-nav">
        <div class="nav-left">
            <button id="hamburger-btn" class="hamburger">☰</button>
            <h1 class="logo" style="margin-left: 20px;">MediSparta</h1>
        </div>
        <div class="nav-right">
            <button id="theme-toggle" class="icon-toggle-btn" type="button" aria-label="Enable dark mode" title="Enable dark mode">🌙</button>
            <button id="logout-btn" onclick="logoutUser()">Logout</button>
        </div>
    </header>

    <aside id="sidebar" class="sidebar">
        <div class="sidebar-header">
            <h2>Menu</h2>
        </div>
        <ul class="sidebar-links">
            <li><a href="#" id="nav-home">🏠 Dashboard Home</a></li>
        </ul>
    </aside>
`;

// 2. Inject the HTML into the page immediately after the <body> tag starts
document.body.insertAdjacentHTML('afterbegin', sharedLayout);

// 3. Hamburger Menu Logic
const hamburgerBtn = document.getElementById('hamburger-btn');
const sidebar = document.getElementById('sidebar');

const mainContent = document.getElementById('main-content');
if (mainContent) {
    mainContent.insertAdjacentHTML('afterbegin', `
        <div class="page-clock" aria-live="polite">
            <div id="philippines-time">--:--:--</div>
            <div id="philippines-date">Loading Philippines date...</div>
        </div>
    `);
}

const philippinesTimeEl = document.getElementById('philippines-time');
const philippinesDateEl = document.getElementById('philippines-date');

function updatePhilippinesClock() {
    const now = new Date();

    if (philippinesTimeEl) {
        philippinesTimeEl.textContent = new Intl.DateTimeFormat('en-PH', {
            timeZone: 'Asia/Manila',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        }).format(now);
    }

    if (philippinesDateEl) {
        philippinesDateEl.textContent = new Intl.DateTimeFormat('en-PH', {
            timeZone: 'Asia/Manila',
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }).format(now);
    }
}

updatePhilippinesClock();
setInterval(updatePhilippinesClock, 1000);

if (hamburgerBtn && sidebar) {
    hamburgerBtn.addEventListener('click', () => {
        const isOpen = sidebar.classList.toggle('active');
        document.body.classList.toggle('sidebar-open', isOpen);
    });

    document.addEventListener('click', (event) => {
        if (!sidebar.contains(event.target) && event.target !== hamburgerBtn) {
            sidebar.classList.remove('active');
            document.body.classList.remove('sidebar-open');
        }
    });
}

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
const updateThemeToggleButton = () => {
    if (!themeToggleBtn) return;

    const isDarkTheme = document.body.classList.contains('dark-theme');
    themeToggleBtn.textContent = isDarkTheme ? '☀️' : '🌙';
    themeToggleBtn.setAttribute('aria-label', isDarkTheme ? 'Enable light mode' : 'Enable dark mode');
    themeToggleBtn.setAttribute('title', isDarkTheme ? 'Enable light mode' : 'Enable dark mode');
};

// Check memory on page load: If they chose dark mode before, apply it immediately
if (currentTheme === 'dark') {
    document.body.classList.add('dark-theme');
}

updateThemeToggleButton();

// Listen for clicks on the toggle button
themeToggleBtn.addEventListener('click', () => {
    
    // Toggle the CSS class on the body
    document.body.classList.toggle('dark-theme');
    
    // Update the button text and save to browser memory
    if (document.body.classList.contains('dark-theme')) {
        localStorage.setItem('theme', 'dark');
    } else {
        localStorage.setItem('theme', 'light');
    }

    updateThemeToggleButton();
});

// --- LOGOUT FUNCTION ---
window.logoutUser = function() {
    sessionStorage.removeItem('userRole'); 
    sessionStorage.removeItem('userId'); 
    window.location.replace('index.html'); 
};