/**
 * MEDISPARTA - MAIN APPLICATION LOGIC
 * This script uses ES6 Classes to modularize and isolate functionality.
 */

// ==========================================
// 1. AUTHENTICATION MANAGER
// ==========================================
class AuthManager {
    constructor() {
        this.loginForm = document.getElementById('loginForm');
        this.roleSelect = document.getElementById('role');
        this.usernameLabel = document.querySelector('label[for="username"]');
        this.usernameInput = document.getElementById('username');
        
        this.errorBanner = document.getElementById('loginErrorBanner');
        this.loginCard = document.querySelector('.login-card');

        if (this.loginForm) this.init();
    }

    init() {
        this.roleSelect.addEventListener('change', (e) => this.updateLabels(e.target.value));
        this.roleSelect.dispatchEvent(new Event('change'));
        this.loginForm.addEventListener('submit', (e) => this.handleLogin(e));
    }
    
    updateLabels(role) {
        this.usernameInput.value = '';
        const passwordInput = document.getElementById('password');
        if (passwordInput) passwordInput.value = '';

        if (role === 'admin') {
            this.usernameLabel.textContent = 'Admin Username:';
            this.usernameInput.placeholder = 'Enter username';
            this.usernameInput.type = 'text'; 
        } else if (role === 'student') {
            this.usernameLabel.textContent = 'Student ID Number:';
            this.usernameInput.placeholder = 'Enter student ID (e.g., 241001)';
            this.usernameInput.type = 'number'; 
        } else if (role === 'staff') {
            this.usernameLabel.textContent = 'Staff ID Number:';
            this.usernameInput.placeholder = 'Enter staff ID (e.g., 1001)';
            this.usernameInput.type = 'number'; 
        }
    }

    showError(message) {
        if (!this.errorBanner) return window.showToast(message, 'error'); // Fallback to our new Toast

        this.errorBanner.textContent = message;
        this.errorBanner.style.display = 'block';
        setTimeout(() => this.errorBanner.style.opacity = '1', 10);

        if (this.loginCard) {
            this.loginCard.classList.remove('shake-animation');
            void this.loginCard.offsetWidth; 
            this.loginCard.classList.add('shake-animation');
        }

        setTimeout(() => {
            this.errorBanner.style.opacity = '0';
            setTimeout(() => this.errorBanner.style.display = 'none', 300);
        }, 4000);
    }

    async handleLogin(event) {
        event.preventDefault();
        const role = this.roleSelect.value;
        const username = this.usernameInput.value;
        const password = document.getElementById('password').value;

        try {
            // URL UPDATED FOR DEPLOYMENT
            const response = await fetch('/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role, username, password })
            });
            const result = await response.json();

            if (response.ok && result.success) {
                sessionStorage.setItem('userRole', result.role); 
                sessionStorage.setItem('userId', result.userId); 
                
                if (result.role === 'admin') window.location.href = 'admin.html';
                else if (result.role === 'staff') window.location.href = 'staff.html';
                else if (result.role === 'student') window.location.href = 'student.html';
            } else {
                this.showError(result.error || 'Invalid username or password.');
            }
        } catch (error) {
            console.error('Network Error:', error);
            this.showError('Cannot connect to the server. Is Node.js running?');
        }
    }
}

// ==========================================
// 2. CLINIC MANAGER
// ==========================================
class ClinicManager {
    constructor() {
        this.visitForm = document.getElementById('visitForm');
        this.inventoryTable = document.getElementById('inventoryTableBody');
        this.restockForm = document.getElementById('restockForm'); 
        this.addItemForm = document.getElementById('addItemForm');
        
        this.visitStudentInput = document.getElementById('student_id');
        this.visitSearchDropdown = document.getElementById('visitSearchDropdown');

        if (this.visitForm) {
            this.initVisitLog();
            if (this.visitStudentInput) this.initVisitSearch(); 
        }
        if (this.inventoryTable) this.loadInventory();
        if (this.restockForm) this.initRestock();
        if (this.addItemForm) this.initAddItem();

        if (document.getElementById('recentActivityTable')) {
            this.loadRecentActivity();
        }
    }
    
    debounce(func, delay) {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                func.apply(this, args);
            }, delay);
        };
    }

    initVisitSearch() {
        const fetchPredictions = async (query) => {
            if (!query) {
                this.visitSearchDropdown.style.display = 'none';
                return;
            }

            try {
                // NEW: Attach staffId to securely filter by campus!
                const myStaffId = sessionStorage.getItem('userId');
                const response = await fetch(`/api/staff/search-students?q=${encodeURIComponent(query)}&staffId=${myStaffId}`);
                const result = await response.json();

                this.visitSearchDropdown.innerHTML = '';

                if (result.success && result.data.length > 0) {
                    result.data.forEach(student => {
                        const item = document.createElement('div');
                        item.className = 'autocomplete-item';
                        item.innerHTML = `
                            <span style="color: var(--text-muted); font-size: 1.2em;">👤</span>
                            <div>
                                <div style="font-weight: bold;">${student.first_name} ${student.last_name}</div>
                                <div style="font-size: 0.85em; color: var(--text-muted);">Student ID: ${student.student_id}</div>
                            </div>
                        `;
                        
                        item.addEventListener('click', () => {
                            this.visitStudentInput.value = student.student_id; 
                            this.visitSearchDropdown.style.display = 'none'; 
                        });
                        
                        this.visitSearchDropdown.appendChild(item);
                    });
                    this.visitSearchDropdown.style.display = 'block';
                } else {
                    this.visitSearchDropdown.innerHTML = `<div class="autocomplete-item" style="color: var(--text-muted); justify-content: center;">No matches found.</div>`;
                    this.visitSearchDropdown.style.display = 'block';
                }
            } catch (error) {
                console.error('Search error:', error);
            }
        };

        const debouncedPredictions = this.debounce(fetchPredictions, 300);

        this.visitStudentInput.addEventListener('input', (e) => {
            debouncedPredictions(e.target.value.trim());
        });

        document.addEventListener('click', (e) => {
            if (!this.visitStudentInput.contains(e.target) && this.visitSearchDropdown) {
                this.visitSearchDropdown.style.display = 'none';
            }
        });
    }

    initVisitLog() {
        this.visitForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const rawStudentInput = document.getElementById('student_id').value.trim();
            
            if (!/^\d+$/.test(rawStudentInput)) {
                window.showToast('Please select a valid student from the dropdown first!', 'error');
                return; 
            }

            const visitData = {
                student_id: rawStudentInput, 
                staff_id: sessionStorage.getItem('userId'), 
                symptoms: document.getElementById('symptoms').value,
                inventory_id: document.getElementById('inventory_id').value || null,
                quantity_dispensed: document.getElementById('quantity_dispensed').value || 0
            };

            try {
                const response = await fetch('/log-visit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(visitData)
                });
                const result = await response.json();

                if (response.ok && result.success) {
                    window.showToast('Visit logged and saved successfully!', 'success'); 
                    this.visitForm.reset();
                    window.closeModal('visitModal');
                    
                    if (document.getElementById('recentActivityTable')) {
                        this.loadRecentActivity();
                    }
                } else {
                    window.showToast(result.error, 'error'); 
                }
            } catch (error) {
                window.showToast('Cannot connect to the server.', 'error'); 
            }
        });
    }

    async loadInventory() {
        try {
            // NEW: Securely fetch inventory locked to this staff's campus
            const myStaffId = sessionStorage.getItem('userId');
            const response = await fetch(`/api/inventory?staffId=${myStaffId}`); 
            const result = await response.json();

            if (response.ok && result.success) {
                this.inventoryTable.innerHTML = ''; 
                
                const visitDropdown = document.getElementById('inventory_id');
                const restockDropdown = document.getElementById('restock_item');
                
                if (visitDropdown) visitDropdown.innerHTML = '<option value="" disabled selected hidden>-- No medication dispensed --</option>';
                if (restockDropdown) restockDropdown.innerHTML = '<option value="" disabled selected hidden>-- Select an item to restock --</option>';

                result.data.forEach(item => {
                    const optionHtml = `<option value="${item.inventory_id}">${item.item_name}</option>`;
                    if (visitDropdown) visitDropdown.insertAdjacentHTML('beforeend', optionHtml);
                    if (restockDropdown) restockDropdown.insertAdjacentHTML('beforeend', optionHtml);

                    let statusText = '<span style="color: green; font-weight: bold;">In Stock</span>';
                    let rowStyle = 'border-bottom: 1px solid #eee;';

                    if (item.quantity === 0) {
                        statusText = '<span style="color: darkred; font-weight: bold;">OUT OF STOCK</span>';
                        rowStyle = 'border-bottom: 1px solid #eee; background-color: rgba(237, 27, 47, 0.05);';
                    } else if (item.quantity <= 50) {
                        statusText = '<span style="color: red; font-weight: bold;">Low Stock!</span>';
                        rowStyle = 'border-bottom: 1px solid #eee; background-color: rgba(237, 27, 47, 0.02);'; 
                    }

                    const row = `
                        <tr style="${rowStyle}">
                            <td style="padding: 12px; color: var(--text-muted);">${item.inventory_id}</td>
                            <td style="padding: 12px; font-weight: bold; color: var(--text-main);">${item.item_name}</td>
                            <td style="padding: 12px; font-size: 18px; color: var(--text-main);">${item.quantity}</td>
                            <td style="padding: 12px;">${statusText}</td>
                        </tr>
                    `;
                    this.inventoryTable.insertAdjacentHTML('beforeend', row);
                });
            }
        } catch (error) {
            this.inventoryTable.innerHTML = `<tr><td colspan="4" style="color: red; text-align: center;">Cannot connect to server.</td></tr>`;
        }
    }

    async loadRecentActivity() {
        const tbody = document.getElementById('recentActivityTable');
        if (!tbody) return;

        try {
            const response = await fetch('/api/staff/recent-visits');
            const result = await response.json();

            tbody.innerHTML = '';
            if (result.success && result.data.length > 0) {
                result.data.forEach(visit => {
                    const time = new Date(visit.visit_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                    const row = `
                        <tr style="border-bottom: 1px solid #eee; transition: background 0.2s;">
                            <td style="padding: 15px 20px; color: var(--bsu-red); font-weight: bold;">${time}</td>
                            <td style="padding: 15px 20px; font-weight: 600; color: var(--text-main);">${visit.first_name} ${visit.last_name}</td>
                            <td style="padding: 15px 20px; color: var(--text-muted);">${visit.symptoms}</td>
                        </tr>
                    `;
                    tbody.insertAdjacentHTML('beforeend', row);
                });
            } else {
                tbody.innerHTML = '<tr><td colspan="3" style="padding: 20px; text-align: center; color: var(--text-muted);">No visits logged yet today.</td></tr>';
            }
        } catch (error) {
            tbody.innerHTML = '<tr><td colspan="3" style="padding: 20px; text-align: center; color: red;">Failed to load activity feed.</td></tr>';
        }
    }
    
    initRestock() {
        this.restockForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const payload = {
                inventory_id: document.getElementById('restock_item').value,
                quantity: document.getElementById('restock_qty').value
            };

            try {
                const response = await fetch('/api/inventory/update', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const result = await response.json();

                if (response.ok && result.success) {
                    this.restockForm.reset();
                    window.showToast('Stock updated successfully!', 'success'); 
                    this.loadInventory(); 
                } else {
                    window.showToast(result.error, 'error'); 
                }
            } catch (error) {
                window.showToast('Server error updating stock.', 'error'); 
            }
        });
    }

    initAddItem() {
        this.addItemForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // NEW: Send the staff_id so the backend knows which campus to assign this medicine to!
            const payload = {
                item_name: document.getElementById('new_item_name').value,
                quantity: document.getElementById('new_item_qty').value,
                staff_id: sessionStorage.getItem('userId')
            };

            try {
                const response = await fetch('/api/inventory/add', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const result = await response.json();

                if (response.ok && result.success) {
                    this.addItemForm.reset();
                    window.showToast('New medicine added to inventory!', 'success'); 
                    this.loadInventory(); 
                } else {
                    window.showToast(result.error, 'error'); 
                }
            } catch (error) {
                window.showToast('Server error adding new item.', 'error'); 
            }
        });
    }
}

// ==========================================
// 3. PATIENT RECORDS MANAGER
// ==========================================
class PatientRecordsManager {
    constructor() {
        this.searchForm = document.getElementById('searchRecordForm');
        this.searchInput = document.getElementById('search_student_id');
        this.searchDropdown = document.getElementById('searchDropdown'); 
        this.myVisitHistoryBody = document.getElementById('myVisitHistoryBody');

        if (this.searchForm && this.searchInput) this.initStaffSearch();
        if (this.myVisitHistoryBody) this.loadStudentPortal();
    }

    debounce(func, delay) {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                func.apply(this, args);
            }, delay);
        };
    }

    initStaffSearch() {
        const fetchPredictions = async (query) => {
            if (!query) {
                this.searchDropdown.style.display = 'none';
                return;
            }

            try {
                // NEW: Attach staffId to securely filter by campus!
                const myStaffId = sessionStorage.getItem('userId');
                const response = await fetch(`/api/staff/search-students?q=${encodeURIComponent(query)}&staffId=${myStaffId}`);
                const result = await response.json();

                this.searchDropdown.innerHTML = '';

                if (result.success && result.data.length > 0) {
                    result.data.forEach(student => {
                        const item = document.createElement('div');
                        item.className = 'autocomplete-item';
                        item.innerHTML = `
                            <span style="color: var(--text-muted); font-size: 1.2em;">🔍</span>
                            <div>
                                <div style="font-weight: bold;">${student.first_name} ${student.last_name}</div>
                                <div style="font-size: 0.85em; color: var(--text-muted);">Student ID: ${student.student_id}</div>
                            </div>
                        `;
                        
                        item.addEventListener('click', () => {
                            this.searchInput.value = student.student_id; 
                            this.searchDropdown.style.display = 'none'; 
                            this.fetchAndDisplayRecords(student.student_id, true); 
                        });
                        
                        this.searchDropdown.appendChild(item);
                    });
                    this.searchDropdown.style.display = 'block';
                } else {
                    this.searchDropdown.innerHTML = `<div class="autocomplete-item" style="color: var(--text-muted); justify-content: center;">No matches found.</div>`;
                    this.searchDropdown.style.display = 'block';
                }
            } catch (error) {
                console.error('Search error:', error);
            }
        };

        const debouncedPredictions = this.debounce(fetchPredictions, 300);

        this.searchInput.addEventListener('input', (e) => {
            document.getElementById('studentProfile').style.display = 'none';
            document.getElementById('visitHistory').style.display = 'none';
            document.getElementById('errorMessage').style.display = 'none';
            debouncedPredictions(e.target.value.trim());
        });

        document.addEventListener('click', (e) => {
            if (!this.searchForm.contains(e.target) && this.searchDropdown) {
                this.searchDropdown.style.display = 'none';
            }
        });

        this.searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.searchDropdown.style.display = 'none';
            this.fetchAndDisplayRecords(this.searchInput.value.trim(), true);
        });
    }

    async loadStudentPortal() {
        const myStudentId = sessionStorage.getItem('userId'); 
        await this.fetchAndDisplayRecords(myStudentId, false);
    }

    async fetchAndDisplayRecords(studentId, isStaffView) {
        const prefix = isStaffView ? 'profile' : 'myProfile';
        const tbody = isStaffView ? document.getElementById('visitHistoryBody') : this.myVisitHistoryBody;
        
        if (isStaffView) {
            document.getElementById('errorMessage').style.display = 'none';
            document.getElementById('studentProfile').style.display = 'none';
            document.getElementById('visitHistory').style.display = 'none';
        }

        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 20px;">Searching database...</td></tr>';
        if (isStaffView) {
            document.getElementById('visitHistory').style.display = 'block';
        }

        try {
            const response = await fetch(`/api/student-records/${studentId}`);
            const result = await response.json();

            if (response.ok && result.success) {
                document.getElementById(`${prefix}Name`).textContent = `${result.profile.first_name} ${result.profile.last_name}`;
                document.getElementById(`${prefix}Id`).textContent = result.profile.student_id;
                document.getElementById(`${prefix}Dob`).textContent = new Date(result.profile.date_of_birth).toLocaleDateString();

                if (isStaffView) document.getElementById('studentProfile').style.display = 'block';

                tbody.innerHTML = ''; 
                if (result.history.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--text-muted); padding: 20px;">No past clinic visits found.</td></tr>';
                } else {
                    result.history.forEach(visit => {
                        const row = `
                            <tr style="border-bottom: 1px solid #eee; transition: background 0.2s;">
                                <td style="padding: 15px;">${new Date(visit.visit_date).toLocaleString()}</td>
                                <td style="padding: 15px;">${visit.symptoms}</td>
                                <td style="padding: 15px; font-weight: bold; color: var(--bsu-red);">${visit.item_name ? `${visit.quantity_given}x ${visit.item_name}` : '<em style="color: var(--text-muted); font-weight: normal;">None</em>'}</td>
                            </tr>
                        `;
                        tbody.insertAdjacentHTML('beforeend', row);
                    });
                }
            } else {
                if (isStaffView) {
                    document.getElementById('studentProfile').style.display = 'none';
                    document.getElementById('visitHistory').style.display = 'none';
                    const errorEl = document.getElementById('errorMessage');
                    errorEl.textContent = result.error;
                    errorEl.style.display = 'block';
                } else {
                    tbody.innerHTML = `<tr><td colspan="3" style="color: red; text-align: center;">Error: ${result.error}</td></tr>`;
                }
            }
        } catch (error) {
            if (isStaffView) {
                document.getElementById('studentProfile').style.display = 'none';
                document.getElementById('visitHistory').style.display = 'none';
            }
            tbody.innerHTML = `<tr><td colspan="3" style="color: red; text-align: center; padding: 20px;">Connection failed.</td></tr>`;
        }
    }
}

// ==========================================
// 4. ADMIN DASHBOARD MANAGER (PHASE 2 UPGRADE)
// ==========================================
class AdminManager {
    constructor() {
        this.formAddStudent = document.getElementById('form-add-student');
        this.formAddStaff = document.getElementById('form-add-staff');
        
        // Storage for instant search filtering
        this.allStudents = [];
        this.allStaff = [];

        // --- RESTORED: CHART VARIABLES ---
        this.currentOverviewRange = 'daily';
        this.chartInstance = null;

        if (this.formAddStudent) this.init();
    }

    init() {
        // Register User Events
        this.formAddStudent.addEventListener('submit', (e) => this.registerUser(e, 'student'));
        this.formAddStaff.addEventListener('submit', (e) => this.registerUser(e, 'staff'));

        // Instant Search Events
        const studentSearch = document.getElementById('search-students');
        const staffSearch = document.getElementById('search-staff');
        
        if (studentSearch) {
            studentSearch.addEventListener('input', (e) => this.filterTable('student', e.target.value));
        }
        if (staffSearch) {
            staffSearch.addEventListener('input', (e) => this.filterTable('staff', e.target.value));
        }

        // --- RESTORED: CHART BUTTON LISTENERS & INITIAL LOAD ---
        const overviewButtons = document.querySelectorAll('.overview-range-btn');
        overviewButtons.forEach(button => {
            button.addEventListener('click', () => this.setOverviewRange(button.dataset.overviewRange));
        });

        // Trigger the bar chart to draw itself on page load!
        if (document.getElementById('adminChart')) {
            this.loadChart(this.currentOverviewRange); 
        }

        // Load Initial Dashboard Data (KPIs, Doughnut Chart, and Activity Table)
        this.loadDashboardStats();
        
        // NEW: Tell the system to fetch the campuses!
        this.loadCampuses();
    }

    // --- UPDATED: CHART LOGIC (Fixed Button Highlights) ---
    setOverviewRange(range) {
        this.currentOverviewRange = range;
        
        // Target the buttons and manually update their inline styles
        document.querySelectorAll('.overview-range-btn').forEach(button => {
            const isActive = button.dataset.overviewRange === range;
            
            button.style.background = isActive ? 'var(--bsu-red)' : 'white';
            button.style.color = isActive ? 'white' : '#333';
            button.style.borderColor = isActive ? 'var(--bsu-red)' : '#ccc';
        });

        const statusMap = {
            daily: 'Showing daily overview of clinic visits.',
            weekly: 'Showing weekly overview of clinic visits.',
            monthly: 'Showing monthly overview of clinic visits.',
            yearly: 'Showing yearly overview of clinic visits.'
        };
        const statusEl = document.getElementById('overviewStatus');
        if (statusEl) statusEl.textContent = statusMap[range] || statusMap.weekly;

        this.loadChart(range);
    }

    async loadChart(range = 'daily') {
        const canvas = document.getElementById('adminChart');
        if (!canvas) return;
        
        try {
            const response = await fetch(`/api/admin/chart-data?range=${encodeURIComponent(range)}`);
            const result = await response.json();

            if (response.ok && result.success) {
                const labels = result.data.map(row => row.label);
                const dataPoints = result.data.map(row => row.total_count);

                if (this.chartInstance) this.chartInstance.destroy();

                this.chartInstance = new Chart(canvas, {
                    type: 'bar', 
                    data: {
                        labels: labels,
                        datasets: [{
                            label: result.title || 'Clinic Activity',
                            data: dataPoints,
                            backgroundColor: ['#ed1b2f', '#2c3e50'], 
                            borderRadius: 6, 
                            maxBarThickness: 120 
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false, 
                        plugins: { legend: { display: false } },
                        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
                    }
                });
            }
        } catch (error) {
            console.error('Error loading chart:', error);
        }
    }

    // --- NEW: View Navigation Logic ---
    switchView(viewId) {
        // Hide all views
        document.querySelectorAll('.admin-view').forEach(view => {
            view.style.display = 'none';
        });
        
        // Show the selected view
        document.getElementById(viewId).style.display = 'block';

        // Lazy-load the heavy data only when they click the tab!
        if (viewId === 'students-view') this.loadDirectory('student');
        if (viewId === 'staff-view') this.loadDirectory('staff');
        if (viewId === 'dashboard-view') this.loadDashboardStats();
        
        // NEW: Load the audit logs when this tab is clicked!
        if (viewId === 'audit-view') this.loadAuditLogs(); 
    }

    async registerUser(e, type) {
        e.preventDefault();
        
        const isStudent = type === 'student';
        const payload = {
            first_name: document.getElementById(isStudent ? 'stu_first' : 'stf_first').value,
            last_name: document.getElementById(isStudent ? 'stu_last' : 'stf_last').value,
            campus_id: document.getElementById(isStudent ? 'stu_campus' : 'stf_campus').value,
            password: document.getElementById(isStudent ? 'stu_pass' : 'stf_pass').value
        };

        if (isStudent) payload.date_of_birth = document.getElementById('stu_dob').value;
        else payload.job_title = document.getElementById('stf_title').value;

        const endpoint = isStudent ? 'register-student' : 'register-staff';
        const form = isStudent ? this.formAddStudent : this.formAddStaff;

        try {
            const response = await fetch(`/api/${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();

            if (response.ok && result.success) {
                window.showToast(`SUCCESS!\nThe ${type} has been registered.\nOfficial Login ID: ${result.newId}`, 'success'); 
                form.reset();
                // Auto-refresh the table they are looking at!
                this.loadDirectory(type); 
            } else {
                window.showToast(result.error, 'error'); 
            }
        } catch (error) {
            window.showToast('Server error.', 'error'); 
        }
    }

    async loadDirectory(type) {
        const isStudent = type === 'student';
        const tbody = document.getElementById(isStudent ? 'pageStudentTable' : 'pageStaffTable');
        const endpoint = isStudent ? '/api/admin/students' : '/api/admin/staff';
        
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Fetching records...</td></tr>';

        try {
            const response = await fetch(endpoint);
            const data = await response.json();
            
            if (data.success) {
                // Save the data globally so our Search Bar can filter it instantly without hitting the server again
                if (isStudent) this.allStudents = data.data;
                else this.allStaff = data.data;
                
                this.renderTable(type, data.data);
            }
        } catch (error) {
            tbody.innerHTML = `<tr><td colspan="4" style="color:red;">Error loading data.</td></tr>`;
        }
    }

    renderTable(type, dataArray) {
        const isStudent = type === 'student';
        const tbody = document.getElementById(isStudent ? 'pageStudentTable' : 'pageStaffTable');
        tbody.innerHTML = '';

        if (dataArray.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: #666;">No records found.</td></tr>';
            return;
        }

        dataArray.forEach(user => {
            const id = isStudent ? user.student_id : user.staff_id;
            const thirdCol = isStudent ? new Date(user.date_of_birth).toLocaleDateString() : user.job_title;
            
            // UI styling based on active status (defaults to true if undefined)
            const isActive = user.is_active !== 0; 
            const rowStyle = isActive ? '' : 'background-color: #fce4e4; opacity: 0.7;';
            const statusBadge = isActive ? '<span style="color: green; font-size: 0.8em;">● Active</span>' : '<span style="color: red; font-size: 0.8em;">● Inactive</span>';

            tbody.innerHTML += `
                <tr style="border-bottom: 1px solid #eee; transition: background 0.2s; ${rowStyle}">
                    <td style="padding: 12px; font-weight: bold; color: var(--bsu-red);">${id} <br>${statusBadge}</td>
                    <td style="padding: 12px; font-weight: 500;">${user.first_name} ${user.last_name}</td>
                    <td style="padding: 12px; color: #666;">${thirdCol}</td>
                    <td style="padding: 12px; font-weight: 500;">${user.campus_name || 'Unassigned'}</td>
                    <td style="padding: 12px; display: flex; gap: 8px;">
                        <button onclick="window.adminApp.toggleUserStatus('${id}', '${type}', ${isActive})" style="padding: 4px 8px; background: #2c3e50; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">
                            ${isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button onclick="window.adminApp.deleteUser('${id}', '${type}')" style="padding: 4px 8px; background: var(--bsu-red); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">
                            Delete
                        </button>
                    </td>
                </tr>`;
        });
    }

    // --- NEW: Security Actions ---
    async toggleUserStatus(id, type, currentStatus) {
        if (!confirm(`Are you sure you want to ${currentStatus ? 'deactivate' : 'activate'} this account?`)) return;
        
        // Grab the ID of the person currently logged in
        const adminId = sessionStorage.getItem('userId'); 

        try {
            const response = await fetch('/api/admin/toggle-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // Include the adminId in the package sent to the server
                body: JSON.stringify({ id, type, currentStatus, adminId }) 
            });
            const result = await response.json();
            window.showToast(result.message || result.error, result.success ? 'success' : 'error');
            if (result.success) this.loadDirectory(type); 
        } catch (error) {
            window.showToast('Server error.', 'error');
        }
    }

    async deleteUser(id, type) {
        if (!confirm('WARNING: This will permanently delete the account.\n\nIf they have medical records, this will be blocked. Proceed?')) return;

        // Grab the ID of the person currently logged in
        const adminId = sessionStorage.getItem('userId');

        try {
            const response = await fetch('/api/admin/delete-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // Include the adminId in the package sent to the server
                body: JSON.stringify({ id, type, adminId })
            });
            const result = await response.json();
            window.showToast(result.message || result.error, result.success ? 'success' : 'error');
            if (result.success) this.loadDirectory(type); 
        } catch (error) {
            window.showToast('Server error.', 'error');
        }
    }

    // --- NEW: Instant Frontend Search Filter ---
    filterTable(type, searchTerm) {
        const query = searchTerm.toLowerCase();
        const dataToFilter = type === 'student' ? this.allStudents : this.allStaff;
        
        const filteredData = dataToFilter.filter(user => {
            const id = (type === 'student' ? user.student_id : user.staff_id).toString();
            const fullName = `${user.first_name} ${user.last_name}`.toLowerCase();
            return id.includes(query) || fullName.includes(query);
        });

        this.renderTable(type, filteredData);
    }

    async loadDashboardStats() {
        // [This remains exactly the same as the Phase 1 code you just pasted earlier!]
        // (If you overwrite it by accident, just copy the loadDashboardStats() function from our previous message here)
        try {
            const statsRes = await fetch('/api/admin/dashboard-stats');
            const statsData = await statsRes.json();

            if (statsData.success) {
                document.getElementById('kpi-students').textContent = statsData.totals.students;
                document.getElementById('kpi-staff').textContent = statsData.totals.staff;
                document.getElementById('kpi-campuses').textContent = statsData.totals.campuses;

                const distCanvas = document.getElementById('distributionChart');
                new Chart(distCanvas, {
                    type: 'doughnut',
                    data: {
                        labels: ['Students', 'Staff'],
                        datasets: [{
                            data: [statsData.totals.students, statsData.totals.staff],
                            backgroundColor: ['#ed1b2f', '#2c3e50'],
                            borderWidth: 0
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        cutout: '70%', 
                        plugins: { legend: { position: 'bottom' } }
                    }
                });
            }
        } catch (error) {
            console.error('Failed to load KPI stats:', error);
        }

        try {
            const activityRes = await fetch('/api/admin/recent-activity');
            const activityData = await activityRes.json();
            const tbody = document.getElementById('adminRecentActivity');
            
            tbody.innerHTML = '';
            if (activityData.success && activityData.data.length > 0) {
                activityData.data.forEach(visit => {
                    const time = new Date(visit.visit_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                    // Replace the old row layout with this updated one!
                    const row = `
                        <tr style="border-bottom: 1px solid #eee;">
                            <td style="padding: 10px; font-weight: bold; color: var(--bsu-red);">${time}</td>
                            <td style="padding: 10px; font-weight: 600;">${visit.first_name} ${visit.last_name}</td>
                            <td style="padding: 10px; color: #666;">${visit.symptoms}</td>
                            <td style="padding: 10px; font-weight: bold;">${visit.campus_name || 'Unknown'}</td>
                        </tr>
                    `;
                    tbody.insertAdjacentHTML('beforeend', row);
                });
            } else {
                tbody.innerHTML = '<tr><td colspan="4" style="padding: 10px; text-align: center;">No recent activity.</td></tr>';
            }
        } catch (error) {
            console.error('Failed to load recent activity:', error);
        }
    }

    // --- PHASE 4: AUDIT & BROADCAST LOGIC ---
    async loadAuditLogs() {
        const tbody = document.getElementById('auditTableBody');
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Fetching security logs...</td></tr>';

        try {
            const response = await fetch('/api/admin/audit-logs');
            const data = await response.json();
            
            tbody.innerHTML = '';
            if (data.success && data.data.length > 0) {
                data.data.forEach(log => {
                    const time = new Date(log.created_at).toLocaleString();
                    tbody.innerHTML += `
                        <tr style="border-bottom: 1px solid #eee;">
                            <td style="padding: 12px; color: #666; font-size: 0.85rem;">${time}</td>
                            <td style="padding: 12px; font-weight: bold;">${log.user_id || 'System'}</td>
                            <td style="padding: 12px;"><span style="background: #eee; padding: 3px 8px; border-radius: 12px; font-size: 0.8rem;">${log.role}</span></td>
                            <td style="padding: 12px;">${log.action}</td>
                        </tr>`;
                });
            } else {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color: #666;">No logs found.</td></tr>';
            }
        } catch (error) {
            tbody.innerHTML = `<tr><td colspan="4" style="color:red; text-align:center;">Error loading logs.</td></tr>`;
        }
    }

    async pushBroadcast(e) {
        e.preventDefault();
        const message = document.getElementById('broadcast_msg').value;
        const adminId = sessionStorage.getItem('userId');

        try {
            const response = await fetch('/api/admin/broadcast', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message, adminId })
            });
            const result = await response.json();
            window.showToast(result.message, result.success ? 'success' : 'error');
            if (result.success) document.getElementById('form-broadcast').reset();
        } catch (error) {
            window.showToast('Server error.', 'error');
        }
    }

    async clearBroadcast() {
        const adminId = sessionStorage.getItem('userId');
        try {
            const response = await fetch('/api/admin/broadcast', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: null, adminId })
            });
            const result = await response.json();
            window.showToast(result.message, result.success ? 'success' : 'error');
        } catch (error) {
            window.showToast('Server error.', 'error');
        }
    }

    // --- NEW: Dynamic Campus Loader ---
    async loadCampuses() {
        try {
            const response = await fetch('/api/campuses');
            const result = await response.json();

            if (response.ok && result.success) {
                const stuCampusSelect = document.getElementById('stu_campus');
                const stfCampusSelect = document.getElementById('stf_campus');

                // Leave the placeholder, clear anything else
                stuCampusSelect.innerHTML = '<option value="" disabled selected hidden>-- Select campus --</option>';
                stfCampusSelect.innerHTML = '<option value="" disabled selected hidden>-- Select campus --</option>';

                // Inject the fresh data from the database
                result.data.forEach(campus => {
                    const optionHtml = `<option value="${campus.campus_id}">${campus.campus_name}</option>`;
                    if (stuCampusSelect) stuCampusSelect.insertAdjacentHTML('beforeend', optionHtml);
                    if (stfCampusSelect) stfCampusSelect.insertAdjacentHTML('beforeend', optionHtml);
                });
            }
        } catch (error) {
            console.error('Failed to load campuses from database:', error);
        }
    }
}

// ==========================================
// 5. GLOBAL TOAST NOTIFICATION ENGINE
// ==========================================
window.showToast = function(message, type = 'error') {
    const existing = document.getElementById('global-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'global-toast';
    
    const isSuccess = type === 'success';
    const bgColor = 'var(--card-bg)'; 
    const textColor = isSuccess ? '#27ae60' : 'var(--bsu-red)';
    const borderLeft = isSuccess ? '4px solid #27ae60' : '4px solid var(--bsu-red)';
    const icon = isSuccess ? '✅  ' : '⚠️  ';

    toast.style.cssText = `
        position: fixed;
        top: 25px;
        left: 50%;
        transform: translateX(-50%) translateY(-20px);
        background-color: ${bgColor};
        color: ${textColor};
        padding: 16px 24px;
        border-radius: 8px;
        border-left: ${borderLeft};
        box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        z-index: 10000;
        font-weight: 600;
        font-size: 1rem;
        opacity: 0;
        white-space: pre-wrap; 
        text-align: center;
        transition: all 0.3s ease;
        pointer-events: none;
    `;
    
    toast.textContent = icon + message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(0)';
    }, 10);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(-20px)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
};

// ==========================================
// 6. INITIALIZE APPLICATION & MODALS
// ==========================================
let globalClinicApp;

document.addEventListener('DOMContentLoaded', () => {
    new AuthManager();
    globalClinicApp = new ClinicManager();
    new PatientRecordsManager();
    window.adminApp = new AdminManager();

});

// --- GLOBAL MODAL CONTROLS ---
window.openModal = function(modalId) {
    document.getElementById(modalId).classList.add('active');
    
    if (modalId === 'inventoryModal' && globalClinicApp) {
        globalClinicApp.loadInventory();
    }
};

window.closeModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    modal.classList.remove('active');
    if (modalId === 'adminModal') {
        document.body.classList.remove('modal-active');
    }
};

// UX Boost: Prevent accidental closing when dragging mouse out of modal
document.querySelectorAll('.modal-overlay').forEach(overlay => {
    let isMouseDownInside = false;

    overlay.addEventListener('mousedown', (e) => {
        if (e.target !== overlay) {
            isMouseDownInside = true;
        }
    });

    overlay.addEventListener('mouseup', (e) => {
        if (e.target === overlay && !isMouseDownInside) {
            overlay.classList.remove('active');
            if (overlay.id === 'adminModal') {
                document.body.classList.remove('modal-active');
            }
        }
        isMouseDownInside = false;
    });
});

// GLOBAL BROADCAST LISTENER
async function checkBroadcast() {
    try {
        const res = await fetch('/api/system/active-broadcast');
        const data = await res.json();
        
        // Remove existing banner if there is one
        const existing = document.getElementById('global-broadcast-banner');
        if (existing) existing.remove();

        // If there is an active message, show it at the very top of the screen!
        if (data.success && data.message) {
            const banner = document.createElement('div');
            banner.id = 'global-broadcast-banner';
            banner.style.cssText = 'background: #f39c12; color: white; text-align: center; padding: 10px; font-weight: bold; position: sticky; top: 0; z-index: 9999; width: 100%; box-shadow: 0 2px 5px rgba(0,0,0,0.2);';
            banner.innerHTML = `📢 <strong>SYSTEM ANNOUNCEMENT:</strong> ${data.message}`;
            document.body.insertBefore(banner, document.body.firstChild);
        }
    } catch (e) { console.log('Silently failed to fetch broadcast.'); }
}
// Check immediately, then check every 60 seconds
checkBroadcast();
setInterval(checkBroadcast, 60000);