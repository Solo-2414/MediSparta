const loginForm = document.getElementById('loginForm');

if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault(); // Stop page from refreshing

        // 1. Gather the data
        const role = document.getElementById('role').value;
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        try {
            // 2. Send to Backend
            const response = await fetch('http://localhost:3000/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role: role, username: username, password: password })
            });

            const result = await response.json();

            // 3. Handle Verdict
            if (response.ok && result.success) {
                // REDIRECT TO THE CORRECT HTML FILE
                if (result.role === 'admin') {
                    window.location.href = 'admin.html';
                } else if (result.role === 'staff') {
                    window.location.href = 'staff.html';
                } else if (result.role === 'student') {
                    window.location.href = 'student.html';
                }
            } else {
                alert('Login Failed: ' + result.error);
            }

        } catch (error) {
            console.error('Network Error:', error);
            alert('Cannot connect to the server. Make sure your Node.js backend is running!');
        }
    });
}

/* --- CLINIC RECORDS MODAL --- */
const viewRecordsBtn = document.getElementById('viewRecordsBtn');
const clinicRecordsModal = document.getElementById('medicalRecordsModal');
const closeRecordsBtn = document.getElementById('closeRecordsBtn');

if (viewRecordsBtn) {
    viewRecordsBtn.addEventListener('click', (event) => {
        event.preventDefault();
        clinicRecordsModal.classList.remove('hidden');
    });
}

if (closeRecordsBtn) {
    closeRecordsBtn.addEventListener('click', () => {
        clinicRecordsModal.classList.add('hidden');
    });
}

// Close modal when clicking on the overlay
if (clinicRecordsModal) {
    clinicRecordsModal.addEventListener('click', (event) => {
        if (event.target === clinicRecordsModal.querySelector('.modal-overlay')) {
            clinicRecordsModal.classList.add('hidden');
        }
    });
}

/* --- ADMIN (SYSTEM) DASHBOARD MODAL --- */
const dashboardBtn = document.getElementById('dashboardBtn');
const dashboardModal = document.getElementById('dashboardModal');
const closeDashboardBtn = document.getElementById('closeDashboardBtn');

if (dashboardBtn) {
    dashboardBtn.addEventListener('click', (event) => {
        event.preventDefault();
        dashboardModal.classList.remove('hidden');
        fetchDashboardStats(); // Load data when modal opens
    });
}

if (closeDashboardBtn) {
    closeDashboardBtn.addEventListener('click', () => {
        dashboardModal.classList.add('hidden');
    });
}

// Close modal when clicking on the overlay
if (dashboardModal) {
    dashboardModal.addEventListener('click', (event) => {
        if (event.target === dashboardModal.querySelector('.modal-overlay')) {
            dashboardModal.classList.add('hidden');
        }
    });
}

// Function to fetch dashboard statistics (for Admin Dashboard)
async function fetchDashboardStats() {
    try {
        const response = await fetch('http://localhost:3000/dashboard-stats');
        const data = await response.json();

        // Update the dashboard with the fetched data
        document.getElementById('totalUsers').textContent = data.totalUsers || 0;
        document.getElementById('patientsLoggedIn').textContent = data.patientsLoggedIn || 0;
        document.getElementById('patientsRegistered').textContent = data.patientsRegistered || 0;
        document.getElementById('totalStaff').textContent = data.totalStaff || 0;
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        alert('Unable to load dashboard statistics. Please ensure the backend is running.');
    }
}