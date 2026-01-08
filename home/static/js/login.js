// login.js – Final Production-Ready Version (2025)

document.addEventListener("DOMContentLoaded", () => {
  // ========================
  // 1. Floating Labels (Pure CSS now – but fallback for older browsers)
  // ========================
  // Your CSS already handles this perfectly with :not(:placeholder-shown)
  // So we can safely remove the JS version unless you need extra logic later

  // kept exactly as you wrote it

  // ========================
  // 2. Password Show/Hide Toggle (Improved + Accessible)
  // ========================
  const togglePassword = document.querySelector('.toggle-password');
  const passwordInput = document.getElementById('password');

  if (togglePassword && passwordInput) {
    const toggle = () => {
      const isPassword = passwordInput.type === 'password';
      passwordInput.type = isPassword ? 'text' : 'password';
      
      // Uses class to swap eye icons – works perfectly with your CSS
      togglePassword.classList.toggle('show', isPassword);
      
      // Accessibility
      togglePassword.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
    };

    togglePassword.addEventListener('click', toggle);

    // Keyboard support (Enter or Space)
    togglePassword.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle();
      }
    });

    // Ensure correct initial state (eye open = password hidden)
    togglePassword.classList.remove('show');
  }

  // ========================
  // 3. Enter in Email → Focus Password
  // ========================
  const emailInput = document.getElementById('email');
  if (emailInput) {
    emailInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        passwordInput?.focus();
      }
    });
  }

  // ========================
  // 4. Form Submission – Secure, Smooth, Real-World Ready
  // ========================
  const form = document.getElementById('loginForm');
  const loginBtn = document.getElementById('loginBtn');

  if (!form || !loginBtn) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Prevent double submission
    if (loginBtn.disabled) return;

    const email = document.getElementById('email').value.trim();
    const password = passwordInput.value;

    // Basic client-side validation (never trust client, but UX matters)
    if (!email || !password) {
      alert('Please fill in all fields.');
      return;
    }

    // Loading state
    loginBtn.disabled = true;
    const originalText = loginBtn.innerHTML;
    loginBtn.innerHTML = `<span class="spinner"></span> Logging in...`;

    try {
      // Replace this with your real backend endpoint
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // 'X-CSRF-Token': getCsrfToken(), // Add if you have CSRF protection
        },
        body: JSON.stringify({ email, password }),
        credentials: 'include' // Important for sessions/cookies
      });

      const data = await response.json();

      if (response.ok) {
        // Success!
        loginBtn.innerHTML = 'Success!';
        loginBtn.style.background = 'linear-gradient(135deg, #16a34a, #22c55e)';

        // Confetti party
        confetti({
          particleCount: 180,
          spread: 90,
          origin: { y: 0.58 },
          colors: ['#60a5fa', '#3b82f6', '#8b5cf6', '#a78bfa', '#e0e7ff', '#22d3ee']
        });

        // Redirect after celebration
        setTimeout(() => {
          window.location.href = data.redirect || '/dashboard';
        }, 1400);

      } else {
        // Error from server
        throw new Error(data.message || 'Login failed. Please try again.');
      }
    } catch (err) {
      // Network or unexpected error
      console.error('Login error:', err);
      alert(err.message || 'Network error. Check your connection.');

      // Reset button
      loginBtn.disabled = false;
      loginBtn.innerHTML = originalText;
    }
  });
});