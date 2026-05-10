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
                userId: userId // <-- Sending ID back for the wristband
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
            const visitSql = `INSERT INTO visits (student_id, staff_id, symptoms, visit_date) VALUES (?, ?, ?, NOW())`;
            db.query(visitSql, [student_id, staff_id, symptoms], (err, visitResult) => {
                if (err) {
                    // --- NEW: Print the exact reason to the terminal ---
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


// --- ROUTE: Fetch All Inventory ---
app.get('/api/inventory', (req, res) => {
    // Sort alphabetically by item name to make it easy for nurses to read
    const sql = `SELECT inventory_id, item_name, quantity FROM inventory ORDER BY item_name ASC`;
    
    db.query(sql, (err, results) => {
        if (err) {
            console.error("Error fetching inventory:", err.sqlMessage);
            return res.status(500).json({ error: 'Failed to retrieve inventory data.' });
        }
        
        res.status(200).json({ 
            success: true, 
            data: results 
        });
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
    db.query(`SELECT staff_id, first_name, last_name, job_title, campus_id FROM staff`, (err, results) => {
        if (err) return res.status(500).json({ error: 'Database error.' });
        res.status(200).json({ success: true, data: results });
    });
});

// --- ROUTE: Admin View All Students ---
app.get('/api/admin/students', (req, res) => {
    db.query(`SELECT student_id, first_name, last_name, date_of_birth, campus_id FROM students`, (err, results) => {
        if (err) return res.status(500).json({ error: 'Database error.' });
        res.status(200).json({ success: true, data: results });
    });
});

// --- ROUTE: Admin Chart Data (Count Users) ---
app.get('/api/admin/chart-data', (req, res) => {
    const sql = `
        SELECT 'Enrolled Students' as user_type, COUNT(*) as total_count FROM students
        UNION
        SELECT 'Clinic Staff' as user_type, COUNT(*) as total_count FROM staff
    `;
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: 'Database error.' });
        res.status(200).json({ success: true, data: results });
    });
});

// --- ROUTE: Staff Dashboard Recent Activity ---
app.get('/api/staff/recent-visits', (req, res) => {
    // NEW: Added WHERE clause to filter out visits from previous days!
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

// --- ROUTE: Add New Inventory Item ---
app.post('/api/inventory/add', (req, res) => {
    const { item_name, quantity } = req.body;
    
    const sql = `INSERT INTO inventory (item_name, quantity) VALUES (?, ?)`;
    
    db.query(sql, [item_name, quantity], (err, result) => {
        if (err) {
            console.error("Add Item Error:", err.sqlMessage);
            return res.status(500).json({ error: 'Database error adding new item.' });
        }
        res.status(200).json({ success: true, message: 'New medicine added successfully!' });
    });
});

// --- ROUTE: Autocomplete Student Search (Lightweight) ---
app.get('/api/staff/search-students', (req, res) => {
    const query = req.query.q;
    if (!query) return res.status(200).json({ success: true, data: [] });

    // Search by ID or partial Name
    const sql = `
        SELECT student_id, first_name, last_name 
        FROM students 
        WHERE student_id LIKE ? OR first_name LIKE ? OR last_name LIKE ?
        LIMIT 5
    `;
    const searchTerm = `%${query}%`;

    db.query(sql, [searchTerm, searchTerm, searchTerm], (err, results) => {
        if (err) return res.status(500).json({ error: 'Database error during search.' });
        res.status(200).json({ success: true, data: results });
    });
});

// --- TURN THE SERVER ON ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running live on http://localhost:${PORT}`);
});

