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
    password: '241405', 
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

// --- TURN THE SERVER ON (Dynamic for Cloud Deployment) ---
// If the cloud provides a port, use it. Otherwise, use 3000 locally.
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running live on http://localhost:${PORT}`);
});