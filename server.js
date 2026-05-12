const express = require('express');
const cors = require('cors');
const mysql = require('mysql2'); 
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// --- SERVE FRONTEND FILES (Deployment Ready) ---
app.use(express.static(path.join(__dirname, 'public')));

// --- UPDATED DATABASE CONNECTION FOR DEPLOYMENT ---
const db = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root', 
    password: process.env.DB_PASSWORD || '241405', 
    database: process.env.DB_NAME || 'MediSparta',
    port: process.env.DB_PORT || 3306,
    // NEW: This allows Aiven to accept the connection without a physical certificate file
    ssl: {
        rejectUnauthorized: false
    }
});

db.connect((err) => {
    if (err) {
        console.error('Database connection failed. Error:', err.message);
    } else {
        console.log('Successfully connected to the MediSparta Database! 🚀');
    }
});



// --- ROUTE: User Login Validation ---
app.post('/login', (req, res) => {
    const { role, username, password } = req.body;

    let sql = '';
    let queryParams = [username, password]; 

    if (role === 'admin') {
        sql = `SELECT * FROM admins WHERE username = ? AND password = ?`;
    } else if (role === 'staff') {
        sql = `SELECT * FROM staff WHERE staff_id = ? AND password = ?`;
    } else if (role === 'student') {
        sql = `SELECT * FROM students WHERE student_id = ? AND password = ?`;
    } else {
        return res.status(400).json({ error: 'Invalid role selected.' });
    }

    db.query(sql, queryParams, (err, results) => {
        if (err) {
            console.error('Database error during login:', err);
            return res.status(500).json({ error: 'Internal server error.' });
        }

        if (results.length > 0) {
            const user = results[0]; 

            // --- NEW: THE BOUNCER CHECK ---
            // Admins don't have an is_active column, so we only check students and staff
            if (role !== 'admin' && user.is_active === 0) {
                return res.status(403).json({ 
                    success: false, 
                    error: 'Access Denied: Your account has been deactivated. Please contact the administrator.' 
                });
            }
            // -----------------------------

            const displayName = (role === 'admin') ? user.full_name : user.first_name;
            
            // Grab the exact ID so the frontend can remember WHO logged in
            let userId = null;
            if (role === 'admin') userId = user.admin_id;
            if (role === 'staff') userId = user.staff_id;
            if (role === 'student') userId = user.student_id;

            res.status(200).json({ 
                success: true, 
                message: `Welcome back, ${displayName}!`,
                role: role,
                userId: userId 
            });
        } else {
            res.status(401).json({ success: false, error: 'Invalid username or password.' });
        }
    });
});

// --- ROUTE: Log a Clinic Visit (ADVANCED TRANSACTION) ---
app.post('/log-visit', (req, res) => {
    const { student_id, staff_id, symptoms, inventory_id, quantity_dispensed } = req.body;

    // Start a MySQL Transaction (If one step fails, they all roll back)
    db.beginTransaction((err) => {
        if (err) return res.status(500).json({ error: 'Transaction failed to start.' });

        // Step 1: Insert into the Visits table
        const visitSql = `
            INSERT INTO visits (student_id, staff_id, symptoms, visit_date, campus_id) VALUES (?, ?, ?, NOW(), (SELECT campus_id FROM staff WHERE staff_id = ?))`;
        
        // Notice we pass staff_id TWICE now. Once for the visit record, once for the subquery search.
        db.query(visitSql, [student_id, staff_id, symptoms, staff_id], (err, visitResult) => {
            if (err) {
                console.error('MYSQL ERROR IN VISITS TABLE:', err.sqlMessage); 
                return db.rollback(() => res.status(500).json({ error: 'Failed to log visit.' }));
            }

            const visit_id = visitResult.insertId; // Get the auto-generated Visit ID

            // If no medication was given, we are done. Commit and exit.
            if (!inventory_id || quantity_dispensed <= 0) {
                return db.commit((err) => {
                    if (err) return db.rollback(() => res.status(500).json({ error: 'Commit failed.' }));
                    res.status(200).json({ success: true, message: 'Visit logged successfully (No medication).' });
                });
            }

            // Step 2: Insert into the Visit_Items table
            const itemSql = `INSERT INTO visit_items (visit_id, inventory_id, quantity_given) VALUES (?, ?, ?)`;
            db.query(itemSql, [visit_id, inventory_id, quantity_dispensed], (err, itemResult) => {
                if (err) {
                    return db.rollback(() => res.status(500).json({ error: 'Failed to record medication.' }));
                }

                // Step 3: Deduct from the Inventory table
                const updateInvSql = `UPDATE inventory SET quantity = quantity - ? WHERE inventory_id = ? AND quantity >= ?`;
                db.query(updateInvSql, [quantity_dispensed, inventory_id, quantity_dispensed], (err, invResult) => {
                    // If error OR if affectedRows is 0 (meaning they tried to dispense more than they have)
                    if (err || invResult.affectedRows === 0) {
                        return db.rollback(() => res.status(400).json({ error: 'Not enough stock in inventory!' }));
                    }

                    // Step 4: Everything succeeded. Finalize the transaction!
                    db.commit((err) => {
                        if (err) return db.rollback(() => res.status(500).json({ error: 'Final commit failed.' }));
                        res.status(200).json({ success: true, message: 'Visit logged and inventory updated successfully!' });
                    });
                });
            });
        });
    });
});

// --- ROUTE: Fetch Student Records & Visit History ---
app.get('/api/student-records/:id', (req, res) => {
    const studentId = req.params.id;

    // Query 1: Get the Student's Basic Info
    const studentSql = `SELECT student_id, first_name, last_name, date_of_birth FROM students WHERE student_id = ?`;
    
    db.query(studentSql, [studentId], (err, studentResult) => {
        if (err) return res.status(500).json({ error: 'Database error fetching student profile.' });
        if (studentResult.length === 0) return res.status(404).json({ error: 'Student not found in the system.' });

        const studentProfile = studentResult[0];

        // Query 2: Get all visits for this student, JOINED with the medicine they took
        // We use LEFT JOIN just in case they didn't take any medicine!
        const visitsSql = `
            SELECT 
                v.visit_date, 
                v.symptoms, 
                vi.quantity_given, 
                i.item_name
            FROM visits v
            LEFT JOIN visit_items vi ON v.visit_id = vi.visit_id
            LEFT JOIN inventory i ON vi.inventory_id = i.inventory_id
            WHERE v.student_id = ?
            ORDER BY v.visit_date DESC
        `;

        db.query(visitsSql, [studentId], (err, visitsResult) => {
            if (err) {
                console.error("Error fetching history:", err.sqlMessage);
                return res.status(500).json({ error: 'Database error fetching visit history.' });
            }

            // Send both the profile and the history back to the frontend!
            res.status(200).json({
                success: true,
                profile: studentProfile,
                history: visitsResult
            });
        });
    });
});

// --- 1. ROUTE: Fetch Inventory (FILTERED BY CAMPUS) ---
app.get('/api/inventory', (req, res) => {
    const staffId = req.query.staffId; 
    
    // Subquery: Only select inventory where the campus_id matches the staff member's campus_id
    const sql = `
        SELECT inventory_id, item_name, quantity 
        FROM inventory 
        WHERE campus_id = (SELECT campus_id FROM staff WHERE staff_id = ?)
        ORDER BY item_name ASC
    `;
    
    db.query(sql, [staffId], (err, results) => {
        if (err) {
            console.error("Error fetching inventory:", err.sqlMessage);
            return res.status(500).json({ error: 'Failed to retrieve inventory data.' });
        }
        res.status(200).json({ success: true, data: results });
    });
});

// --- ROUTE: Register a New Student ---
app.post('/api/register-student', (req, res) => {
    const { first_name, last_name, date_of_birth, campus_id, password } = req.body;

    const sql = `INSERT INTO students (first_name, last_name, date_of_birth, campus_id, password) VALUES (?, ?, ?, ?, ?)`;
    
    db.query(sql, [first_name, last_name, date_of_birth, campus_id, password], (err, result) => {
        if (err) {
            console.error("Student Registration Error:", err.sqlMessage);
            return res.status(500).json({ error: 'Failed to register student.' });
        }
        
        // Grab the brand new ID generated by MySQL
        res.status(200).json({ 
            success: true, 
            message: 'Student registered successfully!',
            newId: result.insertId 
        });
    });
});

// --- ROUTE: Register New Staff ---
app.post('/api/register-staff', (req, res) => {
    const { first_name, last_name, job_title, campus_id, password } = req.body;

    const sql = `INSERT INTO staff (first_name, last_name, job_title, campus_id, password) VALUES (?, ?, ?, ?, ?)`;
    
    db.query(sql, [first_name, last_name, job_title, campus_id, password], (err, result) => {
        if (err) {
            console.error("Staff Registration Error:", err.sqlMessage);
            return res.status(500).json({ error: 'Failed to register staff.' });
        }
        
        res.status(200).json({ 
            success: true, 
            message: 'Staff member registered successfully!',
            newId: result.insertId 
        });
    });
});

// --- ROUTE: Admin View All Staff ---
app.get('/api/admin/staff', (req, res) => {
    // UPDATED: Added a LEFT JOIN to grab the actual campus_name
    const sql = `
        SELECT s.staff_id, s.first_name, s.last_name, s.job_title, s.is_active, c.campus_name 
        FROM staff s
        LEFT JOIN campuses c ON s.campus_id = c.campus_id
    `;
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: 'Database error.' });
        res.status(200).json({ success: true, data: results });
    });
});

// --- ROUTE: Admin View All Students ---
app.get('/api/admin/students', (req, res) => {
    // UPDATED: Added a LEFT JOIN to grab the actual campus_name
    const sql = `
        SELECT s.student_id, s.first_name, s.last_name, s.date_of_birth, s.is_active, c.campus_name 
        FROM students s
        LEFT JOIN campuses c ON s.campus_id = c.campus_id
    `;
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: 'Database error.' });
        res.status(200).json({ success: true, data: results });
    });
});

// --- ROUTE: Admin View All Students ---
app.get('/api/admin/students', (req, res) => {
    // UPDATED: Added a LEFT JOIN to grab the actual campus_name
    const sql = `
        SELECT s.student_id, s.first_name, s.last_name, s.date_of_birth, s.is_active, c.campus_name 
        FROM students s
        LEFT JOIN campuses c ON s.campus_id = c.campus_id
    `;
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: 'Database error.' });
        res.status(200).json({ success: true, data: results });
    });
});

// --- ROUTE: Admin Chart Data (Count Users) ---
app.get('/api/admin/chart-data', (req, res) => {
    const allowedRanges = new Set(['daily', 'weekly', 'monthly', 'yearly']);
    const range = allowedRanges.has(req.query.range) ? req.query.range : 'daily';

    const now = new Date();
    const monthFormatter = new Intl.DateTimeFormat('en-PH', {
        timeZone: 'Asia/Manila',
        month: 'short',
        year: 'numeric'
    });

    const dayFormatter = new Intl.DateTimeFormat('en-PH', {
        timeZone: 'Asia/Manila',
        month: 'short',
        day: 'numeric'
    });

    const hourFormatter = new Intl.DateTimeFormat('en-PH', {
        timeZone: 'Asia/Manila',
        hour: 'numeric',
        hour12: true
    });

    const bucketKey = (date, granularity) => {
        const timeValue = new Date(date).getTime();
        const localized = new Date(timeValue + (8 * 60 * 60 * 1000));

        if (granularity === 'hour') {
            return `${localized.getUTCFullYear()}-${String(localized.getUTCMonth() + 1).padStart(2, '0')}-${String(localized.getUTCDate()).padStart(2, '0')}-${String(localized.getUTCHours()).padStart(2, '0')}`;
        }

        if (granularity === 'month') {
            return `${localized.getUTCFullYear()}-${String(localized.getUTCMonth() + 1).padStart(2, '0')}`;
        }

        return `${localized.getUTCFullYear()}-${String(localized.getUTCMonth() + 1).padStart(2, '0')}-${String(localized.getUTCDate()).padStart(2, '0')}`;
    };

    const buildBuckets = (startDate, endDate, granularity, labelFormatter) => {
        const buckets = new Map();
        const cursor = new Date(startDate);
        cursor.setHours(0, 0, 0, 0);

        while (cursor <= endDate) {
            const key = bucketKey(cursor, granularity);
            buckets.set(key, {
                label: labelFormatter(cursor),
                total_count: 0
            });

            if (granularity === 'month') {
                cursor.setMonth(cursor.getMonth() + 1);
                cursor.setDate(1);
            } else if (granularity === 'hour') {
                cursor.setHours(cursor.getHours() + 1);
            } else {
                cursor.setDate(cursor.getDate() + 1);
            }
        }

        return buckets;
    };

    const finish = (title, buckets) => {
        res.status(200).json({
            success: true,
            title,
            data: Array.from(buckets.values())
        });
    };

    let startDate;
    let labelFormatter;
    let granularity;
    let title;

    if (range === 'daily') {
        granularity = 'hour';
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        labelFormatter = (date) => hourFormatter.format(date);
        title = 'Daily Clinic Visits';
    } else if (range === 'yearly') {
        granularity = 'month';
        startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
        startDate.setHours(0, 0, 0, 0);
        labelFormatter = (date) => monthFormatter.format(date);
        title = 'Yearly Clinic Visits';
    } else if (range === 'monthly') {
        granularity = 'day';
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 29);
        startDate.setHours(0, 0, 0, 0);
        labelFormatter = (date) => dayFormatter.format(date);
        title = 'Monthly Clinic Visits';
    } else {
        granularity = 'day';
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 6);
        startDate.setHours(0, 0, 0, 0);
        labelFormatter = (date) => new Intl.DateTimeFormat('en-PH', {
            timeZone: 'Asia/Manila',
            weekday: 'short'
        }).format(date);
        title = 'Weekly Clinic Visits';
    }

    const sql = `SELECT visit_date FROM visits WHERE visit_date >= ? ORDER BY visit_date ASC`;

    db.query(sql, [startDate], (err, results) => {
        if (err) return res.status(500).json({ error: 'Database error.' });

        const buckets = buildBuckets(startDate, now, granularity, labelFormatter);

        results.forEach(row => {
            const key = bucketKey(row.visit_date, granularity);
            const existing = buckets.get(key);
            if (existing) existing.total_count += 1;
        });

        finish(title, buckets);
    });
});

// --- ROUTE: Staff Dashboard Recent Activity ---
app.get('/api/staff/recent-visits', (req, res) => {
    // Filter out visits from previous days
    const sql = `
        SELECT v.visit_date, s.first_name, s.last_name, v.symptoms
        FROM visits v
        JOIN students s ON v.student_id = s.student_id
        WHERE DATE(v.visit_date) = CURDATE() 
        ORDER BY v.visit_date DESC
        LIMIT 5
    `;
    
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: 'Database error fetching recent visits.' });
        res.status(200).json({ success: true, data: results });
    });
});

// --- ROUTE: Update Inventory Stock ---
app.post('/api/inventory/update', (req, res) => {
    const { inventory_id, quantity } = req.body;
    
    const sql = `UPDATE inventory SET quantity = ? WHERE inventory_id = ?`;
    
    db.query(sql, [quantity, inventory_id], (err, result) => {
        if (err) return res.status(500).json({ error: 'Database error updating stock.' });
        res.status(200).json({ success: true, message: 'Stock updated successfully!' });
    });
});

// --- 2. ROUTE: Add New Inventory Item (LOCKED TO CAMPUS) ---
app.post('/api/inventory/add', (req, res) => {
    const { item_name, quantity, staff_id } = req.body;
    
    // Subquery: Automatically attach the new medicine to the nurse's campus!
    const sql = `
        INSERT INTO inventory (item_name, quantity, campus_id) 
        VALUES (?, ?, (SELECT campus_id FROM staff WHERE staff_id = ?))
    `;
    
    db.query(sql, [item_name, quantity, staff_id], (err, result) => {
        if (err) {
            console.error("Add Item Error:", err.sqlMessage);
            return res.status(500).json({ error: 'Database error adding new item.' });
        }
        res.status(200).json({ success: true, message: 'New medicine added successfully!' });
    });
});

// --- 3. ROUTE: Autocomplete Student Search (FILTERED BY CAMPUS) ---
app.get('/api/staff/search-students', (req, res) => {
    const query = req.query.q;
    const staffId = req.query.staffId;

    if (!query) return res.status(200).json({ success: true, data: [] });

    // Subquery: Only search for students who share the same campus_id as the staff member
    const sql = `
        SELECT student_id, first_name, last_name 
        FROM students 
        WHERE campus_id = (SELECT campus_id FROM staff WHERE staff_id = ?)
        AND (student_id LIKE ? OR first_name LIKE ? OR last_name LIKE ?)
        LIMIT 5
    `;
    const searchTerm = `%${query}%`;

    db.query(sql, [staffId, searchTerm, searchTerm, searchTerm], (err, results) => {
        if (err) return res.status(500).json({ error: 'Database error during search.' });
        res.status(200).json({ success: true, data: results });
    });
});

// ==========================================
// PHASE 1: ADMIN DASHBOARD ANALYTICS ROUTES
// ==========================================

// --- ROUTE: Fetch High-Level Dashboard Stats ---
app.get('/api/admin/dashboard-stats', (req, res) => {
    // We run 3 parallel queries to gather all the stats at once
    const queries = {
        students: `SELECT COUNT(*) as count FROM students`,
        staff: `SELECT COUNT(*) as count FROM staff`,
        campuses: `SELECT COUNT(DISTINCT campus_id) as count FROM students`
    };

    db.query(queries.students, (err, studentRes) => {
        if (err) return res.status(500).json({ error: 'Database error.' });
        db.query(queries.staff, (err, staffRes) => {
            if (err) return res.status(500).json({ error: 'Database error.' });
            db.query(queries.campuses, (err, campusRes) => {
                if (err) return res.status(500).json({ error: 'Database error.' });
                
                res.status(200).json({
                    success: true,
                    totals: {
                        students: studentRes[0].count,
                        staff: staffRes[0].count,
                        campuses: campusRes[0].count
                    }
                });
            });
        });
    });
});

// --- ROUTE: Fetch System-Wide Recent Activity ---
app.get('/api/admin/recent-activity', (req, res) => {
    // NEW: We added a LEFT JOIN to the campuses table to grab campus_name!
    const sql = `
        SELECT v.visit_date, s.first_name, s.last_name, v.symptoms, c.campus_name
        FROM visits v
        JOIN students s ON v.student_id = s.student_id
        LEFT JOIN campuses c ON v.campus_id = c.campus_id
        ORDER BY v.visit_date DESC
        LIMIT 6
    `;
    
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: 'Database error fetching recent visits.' });
        res.status(200).json({ success: true, data: results });
    });
});

// ==========================================
// PHASE 3: ACCOUNTS & ACCESS ROUTES
// ==========================================

// --- ROUTE: Toggle User Status (Deactivate/Reactivate) ---
app.post('/api/admin/toggle-status', (req, res) => {
    const { id, type, currentStatus, adminId } = req.body; // NEW: Grabbing the adminId
    const newStatus = currentStatus ? 0 : 1; // Flip the boolean
    
    const table = type === 'student' ? 'students' : 'staff';
    const idColumn = type === 'student' ? 'student_id' : 'staff_id';

    const sql = `UPDATE ${table} SET is_active = ? WHERE ${idColumn} = ?`;
    
    db.query(sql, [newStatus, id], (err) => {
        if (err) return res.status(500).json({ error: 'Database error updating status.' });
        
        // NEW: Fire the Audit Log!
        const actionStr = `${newStatus ? 'Activated' : 'Deactivated'} ${type} account (ID: ${id})`;
        logAudit(adminId, 'admin', actionStr);

        res.status(200).json({ success: true, message: `Account ${newStatus ? 'Activated' : 'Deactivated'} successfully!` });
    });
});

// --- ROUTE: Strict Hard Delete ---
app.post('/api/admin/delete-user', (req, res) => {
    const { id, type, adminId } = req.body; // NEW: Grabbing the adminId
    
    const checkSql = `SELECT COUNT(*) as visitCount FROM visits WHERE ${type === 'student' ? 'student_id' : 'staff_id'} = ?`;
    
    db.query(checkSql, [id], (err, results) => {
        if (err) return res.status(500).json({ error: 'Database error checking records.' });
        
        if (results[0].visitCount > 0) {
            return res.status(403).json({ 
                error: `Cannot delete: This ${type} has ${results[0].visitCount} medical records tied to their account. Please deactivate them instead.` 
            });
        }

        const table = type === 'student' ? 'students' : 'staff';
        const idColumn = type === 'student' ? 'student_id' : 'staff_id';
        const deleteSql = `DELETE FROM ${table} WHERE ${idColumn} = ?`;

        db.query(deleteSql, [id], (err) => {
            if (err) return res.status(500).json({ error: 'Database error deleting account.' });
            
            // NEW: Fire the Audit Log!
            logAudit(adminId, 'admin', `Permanently deleted ${type} account (ID: ${id})`);

            res.status(200).json({ success: true, message: 'Account permanently deleted.' });
        });
    });
});

// ==========================================
// PHASE 4: AUDIT & BROADCAST ROUTES
// ==========================================

// Helper function to write to audit log (You can call this from any other route!)
function logAudit(userId, role, action) {
    db.query(`INSERT INTO audit_logs (user_id, role, action) VALUES (?, ?, ?)`, [userId, role, action]);
}

// Route: Get Audit Logs
app.get('/api/admin/audit-logs', (req, res) => {
    db.query(`SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100`, (err, results) => {
        if (err) return res.status(500).json({ error: 'Failed to fetch logs.' });
        res.status(200).json({ success: true, data: results });
    });
});

// Route: Publish a Broadcast
app.post('/api/admin/broadcast', (req, res) => {
    const { message, adminId } = req.body;
    
    // First, deactivate all old broadcasts
    db.query(`UPDATE broadcasts SET is_active = FALSE`, (err) => {
        if (err) return res.status(500).json({ error: 'Database error.' });
        
        // If a message was provided, insert it as the new active broadcast
        if (message) {
            db.query(`INSERT INTO broadcasts (message, is_active) VALUES (?, TRUE)`, [message], (err) => {
                if (err) return res.status(500).json({ error: 'Database error.' });
                logAudit(adminId, 'admin', `Published broadcast: "${message}"`);
                res.status(200).json({ success: true, message: 'Broadcast pushed live!' });
            });
        } else {
            logAudit(adminId, 'admin', `Cleared active broadcast`);
            res.status(200).json({ success: true, message: 'Broadcast cleared.' });
        }
    });
});

// Route: Check for active broadcast (Every user polls this)
app.get('/api/system/active-broadcast', (req, res) => {
    db.query(`SELECT message FROM broadcasts WHERE is_active = TRUE ORDER BY created_at DESC LIMIT 1`, (err, results) => {
        if (err || results.length === 0) return res.status(200).json({ success: true, message: null });
        res.status(200).json({ success: true, message: results[0].message });
    });
});

// --- ROUTE: Fetch All Campuses Dynamically ---
app.get('/api/campuses', (req, res) => {
    // Note: Assuming your columns are named 'campus_id' and 'campus_name'. 
    // Change 'campus_name' if your column is named something else!
    db.query(`SELECT campus_id, campus_name FROM campuses ORDER BY campus_id ASC`, (err, results) => {
        if (err) return res.status(500).json({ error: 'Database error fetching campuses.' });
        res.status(200).json({ success: true, data: results });
    });
});

// --- TURN THE SERVER ON ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running live on http://localhost:${PORT}`);
});