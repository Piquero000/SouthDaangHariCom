// Simple admin login handler
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('adminLoginForm');
  if (!form) return;

  function getUsers() { return JSON.parse(localStorage.getItem('users')) || []; }
  function saveUsers(u){ localStorage.setItem('users', JSON.stringify(u)); }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = form.username.value.trim();
    const password = form.password.value;

    let users = getUsers();
    // seed an admin account if none exist
    if (!users.find(x => x.role === 'admin')) {
      users.push({ username: 'admin', email: 'admin@example.com', password: 'admin123', role: 'admin' });
      saveUsers(users);
    }

    const admin = users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password && u.role === 'admin');
    if (!admin) {
      alert('Invalid admin credentials');
      return;
    }

    // set session and redirect to admin dashboard (landing page)
    localStorage.setItem('user', JSON.stringify(admin));
    window.location.href = 'dashboard.html';
  });
});
