// ==========================
// Toggle password visibility
// ==========================
function togglePassword(fieldId, btn) {
  const input = document.getElementById(fieldId);
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = '🔒';
  } else {
    input.type = 'password';
    btn.textContent = '🔓';
  }
}

// ==========================
// Password strength checker
// ==========================
const passwordInput = document.getElementById('password');
const strengthBars = document.querySelectorAll('.strength-bar');

passwordInput.addEventListener('input', (e) => {
  const password = e.target.value;
  const strength = checkPasswordStrength(password);

  strengthBars.forEach(bar => {
    bar.classList.remove('strength-bar--active', 'strength-bar--weak', 'strength-bar--medium', 'strength-bar--strong');
  });

  if (strength > 0) {
    const strengthClass = strength <= 1 ? 'strength-bar--weak' : 
                         strength <= 2 ? 'strength-bar--medium' : 
                         'strength-bar--strong';

    for (let i = 0; i < strength; i++) {
      strengthBars[i].classList.add('strength-bar--active', strengthClass);
    }
  }
});

function checkPasswordStrength(password) {
  let strength = 0;
  if (password.length >= 8) strength++;
  if (password.match(/[a-z]/) && password.match(/[A-Z]/)) strength++;
  if (password.match(/\d/)) strength++;
  if (password.match(/[^a-zA-Z\d]/)) strength++;
  return strength;
}

// ==========================
// Helper: show error messages
// ==========================
function showError(elementId, message) {
  const errorElement = document.getElementById(elementId);
  errorElement.textContent = message;
  errorElement.classList.add('error-message--visible');
}

// ==========================
// Form submission
// ==========================
document.getElementById('signupForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  // Clear previous errors
  document.querySelectorAll('.error-message').forEach(msg => {
    msg.classList.remove('error-message--visible');
    msg.textContent = '';
  });

  const username = document.getElementById('username').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirmPassword').value;

  let isValid = true;

  // Username validation
  if (username.length < 3) {
    showError('usernameError', 'Username must be at least 3 characters');
    isValid = false;
  }

  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    showError('emailError', 'Please enter a valid email address');
    isValid = false;
  }

  // Password validation
  if (password.length < 8) {
    showError('passwordError', 'Password must be at least 8 characters');
    isValid = false;
  }

  if (password !== confirmPassword) {
    showError('confirmError', 'Passwords do not match');
    isValid = false;
  }

  if (!isValid) return;

  // ==========================
  // Submit to backend
  // ==========================
  try {
    const response = await fetch('http://localhost:3000/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password, confirmPassword })
    });

    const result = await response.json();

    if (!response.ok) {
      alert(result.message || 'Signup failed.');
      return;
    }

    // --- Clear any previous session ---
    localStorage.removeItem('userId');
    localStorage.removeItem('username');

    // --- Store the new session ---
    if (result.userId && result.username) {
      localStorage.setItem('userId', result.userId);
      localStorage.setItem('username', result.username);
    }

    alert(result.message || 'Signup successful!');
    window.location.href = 'dashboard.html';

  } catch (err) {
    console.error('Error:', err);
    alert('An unexpected error occurred.');
  }
});

// ==========================
// Real-time validations
// ==========================

// Email validation on blur
document.getElementById('email').addEventListener('blur', (e) => {
  const email = e.target.value;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const errorElement = document.getElementById('emailError');

  if (email && !emailRegex.test(email)) {
    showError('emailError', 'Please enter a valid email address');
  } else {
    errorElement.classList.remove('error-message--visible');
  }
});

// Confirm password matches
document.getElementById('confirmPassword').addEventListener('input', (e) => {
  const password = document.getElementById('password').value;
  const confirmPassword = e.target.value;
  const errorElement = document.getElementById('confirmError');

  if (confirmPassword && password !== confirmPassword) {
    showError('confirmError', 'Passwords do not match');
  } else {
    errorElement.classList.remove('error-message--visible');
  }
});
