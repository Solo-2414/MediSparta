/**
 * MEDISPARTA - GLOBAL AUTHENTICATION GUARD
 * This script runs immediately on every page load to verify session security.
 */
(function() {
    // 1. Check the browser's memory for active session keys
    const userId = sessionStorage.getItem('userId');
    const userRole = sessionStorage.getItem('userRole');

    // 2. Identify what page the user is currently trying to look at
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';

    // 3. Define which pages require a login
    const protectedPages = ['admin.html', 'staff.html', 'student.html'];

    // --- SECURITY RULE A: NOT LOGGED IN ---
    // If they have no ID, and they are trying to peek at a protected page, kick them out.
    if (!userId && protectedPages.includes(currentPage)) {
        window.location.replace('index.html');
        return; // Stop running any more code
    }

    // --- SECURITY RULE B: WRONG DASHBOARD ---
    // If they ARE logged in, make sure they stay in their lane.
    if (userId) {
        // If they try to go back to the login page, redirect them to their dashboard
        if (currentPage === 'index.html' || currentPage === '') {
            window.location.replace(`${userRole}.html`);
        } 
        // If a Student tries to type /admin.html, send them back to student.html
        else if (currentPage === 'admin.html' && userRole !== 'admin') {
            window.location.replace(`${userRole}.html`);
        } 
        // If a Student tries to type /staff.html, send them back
        else if (currentPage === 'staff.html' && userRole !== 'staff') {
            window.location.replace(`${userRole}.html`);
        } 
        // If Admin/Staff tries to access Student page
        else if (currentPage === 'student.html' && userRole !== 'student') {
            window.location.replace(`${userRole}.html`);
        }
    }
})();