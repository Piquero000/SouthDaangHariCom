// Toggle logic
const container = document.querySelector('.container');
const registerBtn = document.querySelector('.register-btn');
const loginBtn = document.querySelector('.login-btn');
registerBtn.addEventListener('click', () => container.classList.add('active'));
loginBtn.addEventListener('click', () => container.classList.remove('active'));

// Helpers
function getUsers() {
  return JSON.parse(localStorage.getItem('users')) || [];
}
function saveUsers(users) {
  localStorage.setItem('users', JSON.stringify(users));
}
function setSession(user) {
  localStorage.setItem('user', JSON.stringify(user));
}

// Registration
document.querySelector('.register form').addEventListener('submit', function(e) {
  e.preventDefault();
  const username = this.querySelector('input[type="text"]').value.trim();
  const email = this.querySelector('input[type="email"]').value.trim();
  const password = this.querySelector('input[type="password"]').value;

  const users = getUsers();
  const exists = users.find(u => u.username.toLowerCase() === username.toLowerCase());
  if (exists) {
    alert('❌ Username already taken.');
    return;
  }

  // default role: resident
  const newUser = { username, email, password, role: 'resident' };
  users.push(newUser);
  saveUsers(users);
  alert('✅ Account created! You can now login.');
  container.classList.remove('active');
});

// Login
document.querySelector('.login form').addEventListener('submit', function(e) {
  e.preventDefault();
  const username = this.querySelector('input[type="text"]').value.trim();
  const password = this.querySelector('input[type="password"]').value;

  const users = getUsers();
  const user = users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);

  // Optional: seed a demo admin account if none exists
  if (!users.find(u => u.role === 'admin')) {
    users.push({ username: 'admin', email: 'admin@example.com', password: 'admin123', role: 'admin' });
    saveUsers(users);
  }

  if (!user) {
    alert('❌ Invalid credentials. Please register first.');
    return;
  }

  setSession(user);
  alert(`✅ Welcome, ${user.username}!`);

  if (user.role === 'admin') {
    window.location.href = './Admin/admindashboard.html';
  } else {
    // initialize simple profile keys for resident UX
    localStorage.setItem('userName', user.username);
    localStorage.setItem('userEmail', user.email);
    window.location.href = './resident/dashboard.html';
  }
});
