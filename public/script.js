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