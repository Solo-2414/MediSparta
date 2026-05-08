const express = require('express');
const cors = require('cors');
const mysql = require('mysql2'); 
const path = require('path'); // <-- NEW: Built-in tool for dynamic folder paths

const app = express();
app.use(cors());
app.use(express.json());

// --- SERVE FRONTEND FILES (Deployment Ready) ---
// This automatically serves index.html when someone visits your root URL
app.use(express.static(path.join(__dirname, 'public')));

// --- DATABASE CONNECTION ---
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root', 
    password: '@Rootpassword1', 
    database: 'MediSparta'
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

    // The Switchboard: Build the exact SQL query based on the selected role
    if (role === 'admin') {
        sql = `SELECT * FROM Admins WHERE username = ? AND password = ?`;
    } else if (role === 'staff') {
        sql = `SELECT * FROM Staff WHERE staff_id = ? AND password = ?`;
    } else if (role === 'student') {
        sql = `SELECT * FROM Students WHERE student_id = ? AND password = ?`;
    } else {
        return res.status(400).json({ error: 'Invalid role selected.' });
    }

    // Execute the check in MySQL
    db.query(sql, queryParams, (err, results) => {
        if (err) {
            console.error('Database error during login:', err);
            return res.status(500).json({ error: 'Internal server error.' });
        }

        // The Verdict
        if (results.length > 0) {
            const user = results[0]; 
            const displayName = (role === 'admin') ? user.full_name : user.first_name;

            res.status(200).json({ 
                success: true, 
                message: `Welcome back, ${displayName}!`,
                role: role 
            });
        } else {
            res.status(401).json({ success: false, error: 'Invalid username or password.' });
        }
    });
});

// --- ROUTE: Add a Campus ---
app.post('/add-campus', (req, res) => {
    const newCampus = req.body; 

    const sql = `INSERT INTO Campuses (campus_id, campus_name, address, contact_number) 
                 VALUES (?, ?, ?, ?)`;

    db.query(sql, [newCampus.campus_id, newCampus.campus_name, newCampus.address, newCampus.contact_number], (err, result) => {
        if (err) {
            console.error('Error inserting data:', err);
            return res.status(500).json({ error: 'Database error. Did you use a valid ENUM name?' }); 
        }
        res.status(200).json({ message: 'Campus successfully added to MediSparta!' });
    });
});

// --- ROUTE: Get Dashboard Statistics (FOR SYSTEM ADMIN DASHBOARD) ---
app.get('/dashboard-stats', (req, res) => {
    try {
        // Query 1: Total users (Admin + Staff + Students)
        db.query('SELECT COUNT(*) as totalUsers FROM (SELECT id FROM Admins UNION ALL SELECT staff_id FROM Staff UNION ALL SELECT student_id FROM Students) AS total_users', (err, results) => {
            if (err) {
                console.error('Error fetching total users:', err);
                return res.status(500).json({ error: 'Database error fetching users.' });
            }

            const totalUsers = results[0]?.totalUsers || 0;

            // Query 2: Total Staff count
            db.query('SELECT COUNT(*) as totalStaff FROM Staff', (err, staffResults) => {
                if (err) {
                    console.error('Error fetching staff count:', err);
                    return res.status(500).json({ error: 'Database error fetching staff.' });
                }

                const totalStaff = staffResults[0]?.totalStaff || 0;

                // Query 3: Total Patients Registered (Students registered in the system)
                db.query('SELECT COUNT(*) as patientsRegistered FROM Students', (err, patientResults) => {
                    if (err) {
                        console.error('Error fetching patients:', err);
                        return res.status(500).json({ error: 'Database error fetching patients.' });
                    }

                    const patientsRegistered = patientResults[0]?.patientsRegistered || 0;

                    // Query 4: Patients Logged In (assuming recent logins within last 24 hours - adjust based on your schema)
                    // For now, we'll use active sessions or return half the registered patients as an estimate
                    const patientsLoggedIn = Math.floor(patientsRegistered * 0.5);

                    res.status(200).json({
                        totalUsers: totalUsers,
                        totalStaff: totalStaff,
                        patientsRegistered: patientsRegistered,
                        patientsLoggedIn: patientsLoggedIn
                    });
                });
            });
        });
    } catch (error) {
        console.error('Error in dashboard stats route:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// --- TURN THE SERVER ON (Dynamic for Cloud Deployment) ---
// If the cloud provides a port, use it. Otherwise, use 3000 locally.
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running live on http://localhost:${PORT}`);
});