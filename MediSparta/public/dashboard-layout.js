// 1. Define the HTML for the shared Navbar and Sidebar
const sharedLayout = `
    <!-- TOP NAVIGATION -->
    <header id="top-nav">
        <div class="nav-left">
            <button id="hamburger-btn" class="hamburger">☰</button>
            <h1 class="logo" style="margin-left: 20px;">MediSparta</h1>
        </div>
        <button id="logout-btn" onclick="window.location.href='index.html'">Logout</button>
    </header>

    <!-- SLIDING SIDEBAR -->
    <aside id="sidebar" class="sidebar">
        <div class="sidebar-header">
            <h2>Menu</h2>
        </div>
        <ul class="sidebar-links">
            <li><a href="#">Dashboard Home</a></li>
            <li><a href="#">My Profile</a></li>
            <li><a href="#">Settings</a></li>
        </ul>
    </aside>
`;

// 2. Inject the HTML into the page immediately after the <body> tag starts
document.body.insertAdjacentHTML('afterbegin', sharedLayout);

// 3. Re-activate the Hamburger Menu Logic
const hamburgerBtn = document.getElementById('hamburger-btn');
const sidebar = document.getElementById('sidebar');

hamburgerBtn.addEventListener('click', () => {
    sidebar.classList.toggle('active'); 
});

// Close sidebar if user clicks outside of it
document.addEventListener('click', (event) => {
    if (!sidebar.contains(event.target) && event.target !== hamburgerBtn) {
        sidebar.classList.remove('active');
    }
});