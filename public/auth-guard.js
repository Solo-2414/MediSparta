// 1. Check the user's wristband
const userRole = sessionStorage.getItem('userRole');

// 2. If they have NO wristband, kick them to the login page immediately
if (!userRole) {
    window.location.replace('index.html');
}

// 3. Advanced Security: Prevent roles from accessing the wrong dashboards
const currentPage = window.location.pathname;

if (currentPage.includes('admin.html') && userRole !== 'admin') {
    alert("Access Denied: You are not an Administrator.");
    window.location.replace('index.html');
} 
else if (currentPage.includes('staff.html') && userRole !== 'staff') {
    alert("Access Denied: You are not authorized for the Clinic Staff portal.");
    window.location.replace('index.html');
} 
else if (currentPage.includes('student.html') && userRole !== 'student') {
    alert("Access Denied: This page is for students only.");
    window.location.replace('index.html');
}
// Prevent students from logging visits
else if (currentPage.includes('new-visit.html') && userRole !== 'staff') {
    alert("Access Denied: Only Clinic Staff can log a new visit.");
    window.location.replace('index.html');
}