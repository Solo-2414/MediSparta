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
    // sets the username label and placeholder based on the selected role, and also clears any previous input for security and clarity. It also changes the input type to "number" for students and staff to encourage correct input format, while keeping it as "text" for admins who may have alphanumeric usernames. 
    updateLabels(role) {
        this.usernameInput.value = '';
        const passwordInput = document.getElementById('password');
        if (passwordInput) passwordInput.value = '';

        if (role === 'admin') {
            this.usernameLabel.textContent = 'Admin Username:';
            this.usernameInput.placeholder = 'Enter your username';
            this.usernameInput.type = 'text'; 
        } else if (role === 'student') {
            this.usernameLabel.textContent = 'Student ID Number:';
            this.usernameInput.placeholder = 'e.g., 241001';
            this.usernameInput.type = 'number'; 
        } else if (role === 'staff') {
            this.usernameLabel.textContent = 'Staff ID Number:';
            this.usernameInput.placeholder = 'e.g., 1001';
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
            const response = await fetch('http://localhost:3000/login', {
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
                const response = await fetch(`http://localhost:3000/api/staff/search-students?q=${encodeURIComponent(query)}`);
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
            // --- NEW: THE BOUNCER ---
            const rawStudentInput = document.getElementById('student_id').value.trim();
            
            // Check if the input contains ONLY numbers using a Regular Expression
            if (!/^\d+$/.test(rawStudentInput)) {
                window.showToast('Please select a valid student from the dropdown first!', 'error');
                return; // Stop the code here. Do not contact the server!
            }
            // ------------------------

            const visitData = {
                student_id: rawStudentInput, // Use the clean variable we just made
                staff_id: sessionStorage.getItem('userId'), 
                symptoms: document.getElementById('symptoms').value,
                inventory_id: document.getElementById('inventory_id').value || null,
                quantity_dispensed: document.getElementById('quantity_dispensed').value || 0
            };

            try {
                const response = await fetch('http://localhost:3000/log-visit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(visitData)
                });
                const result = await response.json();

                if (response.ok && result.success) {
                    window.showToast('Visit logged and saved successfully!', 'success'); // <--- REPLACED ALERT
                    this.visitForm.reset();
                    window.closeModal('visitModal');
                    
                    if (document.getElementById('recentActivityTable')) {
                        this.loadRecentActivity();
                    }
                } else {
                    window.showToast(result.error, 'error'); // <--- REPLACED ALERT
                }
            } catch (error) {
                window.showToast('Cannot connect to the server.', 'error'); // <--- REPLACED ALERT
            }
        });
    }

    async loadInventory() {
        try {
            const response = await fetch('http://localhost:3000/api/inventory');
            const result = await response.json();

            if (response.ok && result.success) {
                this.inventoryTable.innerHTML = ''; 
                
                const visitDropdown = document.getElementById('inventory_id');
                const restockDropdown = document.getElementById('restock_item');
                
                if (visitDropdown) visitDropdown.innerHTML = '<option value="">-- No medication dispensed --</option>';
                if (restockDropdown) restockDropdown.innerHTML = '';

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
            const response = await fetch('http://localhost:3000/api/staff/recent-visits');
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
                const response = await fetch('http://localhost:3000/api/inventory/update', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const result = await response.json();

                if (response.ok && result.success) {
                    this.restockForm.reset();
                    window.showToast('Stock updated successfully!', 'success'); // <--- REPLACED ALERT
                    this.loadInventory(); 
                } else {
                    window.showToast(result.error, 'error'); // <--- REPLACED ALERT
                }
            } catch (error) {
                window.showToast('Server error updating stock.', 'error'); // <--- REPLACED ALERT
            }
        });
    }

    initAddItem() {
        this.addItemForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const payload = {
                item_name: document.getElementById('new_item_name').value,
                quantity: document.getElementById('new_item_qty').value
            };

            try {
                const response = await fetch('http://localhost:3000/api/inventory/add', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const result = await response.json();

                if (response.ok && result.success) {
                    this.addItemForm.reset();
                    window.showToast('New medicine added to inventory!', 'success'); // <--- REPLACED ALERT
                    this.loadInventory(); 
                } else {
                    window.showToast(result.error, 'error'); // <--- REPLACED ALERT
                }
            } catch (error) {
                window.showToast('Server error adding new item.', 'error'); // <--- REPLACED ALERT
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
                const response = await fetch(`http://localhost:3000/api/staff/search-students?q=${encodeURIComponent(query)}`);
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
            const response = await fetch(`http://localhost:3000/api/student-records/${studentId}`);
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
// 4. ADMIN DASHBOARD MANAGER
// ==========================================
class AdminManager {
    constructor() {
        this.formAddStudent = document.getElementById('form-add-student');
        this.formAddStaff = document.getElementById('form-add-staff');
        this.adminModal = document.getElementById('adminModal');
        this.adminModalTitle = document.getElementById('adminModalTitle');
        this.adminModalDescription = document.getElementById('adminModalDescription');
        this.overviewButtons = Array.from(document.querySelectorAll('[data-overview-range]'));
        this.overviewStatus = document.getElementById('overviewStatus');
        this.chartInstance = null;
        this.currentOverviewRange = 'daily';

        if (this.formAddStudent) this.init();
    }

    init() {
        this.formAddStudent.addEventListener('submit', (e) => this.registerUser(e, 'student'));
        this.formAddStaff.addEventListener('submit', (e) => this.registerUser(e, 'staff'));

        this.overviewButtons.forEach(button => {
            button.addEventListener('click', () => this.setOverviewRange(button.dataset.overviewRange));
        });

        if (document.getElementById('adminChart')) {
            this.loadChart(this.currentOverviewRange);
        }
    }

    setOverviewRange(range) {
        this.currentOverviewRange = range;

        this.overviewButtons.forEach(button => {
            button.classList.toggle('active', button.dataset.overviewRange === range);
        });

        const statusMap = {
            daily: 'Showing daily overview of clinic visits.',
            weekly: 'Showing weekly overview of clinic visits.',
            monthly: 'Showing monthly overview of clinic visits.',
            yearly: 'Showing yearly overview of clinic visits.'
        };

        if (this.overviewStatus) {
            this.overviewStatus.textContent = statusMap[range] || statusMap.weekly;
        }

        this.loadChart(range);
    }

    showModal(view) {
        if (!this.adminModal) return;

        this.adminModal.classList.add('active');
        document.body.classList.add('modal-active');

        document.getElementById('studentRegForm').style.display = 'none';
        document.getElementById('staffRegForm').style.display = 'none';
        document.getElementById('userDirectoryView').style.display = 'none';

        const titleMap = {
            student: ['Student Enrollment Form', 'Register a student while keeping the dashboard visible in the background.'],
            staff: ['Staff Registration Form', 'Register clinic staff while keeping the dashboard visible in the background.'],
            directory: ['Master User Directory', 'View registered accounts in a focused modal while keeping the dashboard visible in the background.']
        };

        const [title, description] = titleMap[view] || titleMap.student;
        if (this.adminModalTitle) this.adminModalTitle.textContent = title;
        if (this.adminModalDescription) this.adminModalDescription.textContent = description;

        if (view === 'student') document.getElementById('studentRegForm').style.display = 'block';
        if (view === 'staff') document.getElementById('staffRegForm').style.display = 'block';
        if (view === 'directory') document.getElementById('userDirectoryView').style.display = 'block';
    }

    hideModal() {
        if (!this.adminModal) return;

        this.adminModal.classList.remove('active');
        document.body.classList.remove('modal-active');
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
            const response = await fetch(`http://localhost:3000/api/${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();

            if (response.ok && result.success) {
                // <--- REPLACED ALERT WITH TOAST
                window.showToast(`SUCCESS!\nThe ${type} has been registered.\nOfficial Login ID: ${result.newId}`, 'success'); 
                form.reset();
            } else {
                window.showToast(result.error, 'error'); // <--- REPLACED ALERT
            }
        } catch (error) {
            window.showToast('Server error.', 'error'); // <--- REPLACED ALERT
        }
    }

    async loadDirectory() {
        this.showModal('directory');

        const directoryView = document.getElementById('userDirectoryView');
        if (!directoryView) return;

        const staffTable = document.getElementById('adminStaffTable');
        const studentTable = document.getElementById('adminStudentTable');

        try {
            const staffRes = await fetch('http://localhost:3000/api/admin/staff');
            const staffData = await staffRes.json();
            
            staffTable.innerHTML = '';
            if (staffData.success) {
                staffData.data.forEach(staff => {
                    staffTable.innerHTML += `<tr style="border-bottom: 1px solid #eee;">
                        <td style="padding: 10px;">${staff.staff_id}</td>
                        <td style="padding: 10px;">${staff.first_name} ${staff.last_name}</td>
                        <td style="padding: 10px;">${staff.job_title}</td>
                        <td style="padding: 10px;">${staff.campus_id}</td>
                    </tr>`;
                });
            }

            const studentRes = await fetch('http://localhost:3000/api/admin/students');
            const studentData = await studentRes.json();
            
            studentTable.innerHTML = '';
            if (studentData.success) {
                studentData.data.forEach(student => {
                    studentTable.innerHTML += `<tr style="border-bottom: 1px solid #eee;">
                        <td style="padding: 10px;">${student.student_id}</td>
                        <td style="padding: 10px;">${student.first_name} ${student.last_name}</td>
                        <td style="padding: 10px;">${new Date(student.date_of_birth).toLocaleDateString()}</td>
                        <td style="padding: 10px;">${student.campus_id}</td>
                    </tr>`;
                });
            }
        } catch (error) {
            staffTable.innerHTML = `<tr><td colspan="4" style="color:red;">Error loading data.</td></tr>`;
        }
    }

    async loadChart(range = 'daily') {
        const canvas = document.getElementById('adminChart');
        
        try {
            const response = await fetch(`http://localhost:3000/api/admin/chart-data?range=${encodeURIComponent(range)}`);
            const result = await response.json();

            if (response.ok && result.success) {
                const labels = result.data.map(row => row.label);
                const dataPoints = result.data.map(row => row.total_count);

                if (this.chartInstance) {
                    this.chartInstance.destroy();
                }

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
                        plugins: {
                            legend: { display: false } 
                        },
                        scales: {
                            y: { beginAtZero: true, ticks: { stepSize: 1 } }
                        }
                    }
                });
            }
        } catch (error) {
            console.error('Error loading chart:', error);
        }
    }
}

// ==========================================
// 5. GLOBAL TOAST NOTIFICATION ENGINE (NEW!)
// ==========================================
window.showToast = function(message, type = 'error') {
    // Remove existing toast so they don't pile up
    const existing = document.getElementById('global-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'global-toast';
    
    // Style dynamically based on Success vs Error
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
        white-space: pre-wrap; /* Allows line breaks like \n to format properly */
        text-align: center;
        transition: all 0.3s ease;
        pointer-events: none;
    `;
    
    toast.textContent = icon + message;
    document.body.appendChild(toast);

    // Slide it in!
    setTimeout(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(0)';
    }, 10);

    // Fade it out after 4 seconds
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
    const adminApp = new AdminManager();

    window.loadUserDirectory = () => adminApp.loadDirectory();
    window.openAdminModal = (view) => adminApp.showModal(view);
    window.closeAdminModal = () => adminApp.hideModal();
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