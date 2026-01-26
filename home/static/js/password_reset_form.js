    // Toggle password visibility
    document.querySelectorAll('.toggle-password').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = document.getElementById(btn.dataset.target);
        if (target.type === 'password') {
          target.type = 'text';
          btn.textContent = '🙈';
        } else {
          target.type = 'password';
          btn.textContent = '👁️';
        }
      });
    });

    // Password strength checker
    const passwordInput = document.getElementById('password1');
    const strengthBar = document.querySelector('.strength-bar');
    const strengthText = document.getElementById('strengthText');

    passwordInput.addEventListener('input', () => {
      const val = passwordInput.value;
      let strength = 0;
      let feedback = '';

      if (val.length >= 8) strength++;
      if (val.match(/[a-z]/) && val.match(/[A-Z]/)) strength++;
      if (val.match(/[0-9]/)) strength++;
      if (val.match(/[^a-zA-Z0-9]/)) strength++;

      strengthBar.style.width = (strength * 25) + '%';

      if (strength <= 1) {
        strengthBar.style.background = '#ef4444';
        feedback = 'Weak password';
      } else if (strength <= 2) {
        strengthBar.style.background = '#f59e0b';
        feedback = 'Fair password';
      } else if (strength <= 3) {
        strengthBar.style.background = '#10b981';
        feedback = 'Good password';
      } else {
        strengthBar.style.background = '#16a34a';
        feedback = 'Strong password!';
      }

      strengthText.textContent = feedback;
    });

    // Confirm password match check
    const form = document.getElementById('passwordForm');
    const message = document.getElementById('message');
    const submitBtn = document.getElementById('submitBtn');

    form.addEventListener('submit', (e) => {
      const p1 = document.getElementById('password1').value;
      const p2 = document.getElementById('password2').value;

      if (p1 !== p2) {
        e.preventDefault();
        message.innerHTML = '<span class="err">Passwords do not match</span>';
        submitBtn.disabled = true;
        setTimeout(() => { submitBtn.disabled = false; }, 2000);
      } else if (p1.length < 8) {
        e.preventDefault();
        message.innerHTML = '<span class="err">Password must be at least 8 characters</span>';
        submitBtn.disabled = true;
        setTimeout(() => { submitBtn.disabled = false; }, 2000);
      } else {
        message.innerHTML = '';
        // Form will submit normally
      }
    });

    // Real-time confirm match feedback
    document.getElementById('password2').addEventListener('input', () => {
      const p1 = document.getElementById('password1').value;
      const p2 = document.getElementById('password2').value;

      if (p2 && p1 !== p2) {
        message.innerHTML = '<span class="err">Passwords do not match</span>';
      } else if (p2 && p1 === p2) {
        message.innerHTML = '<span class="ok">Passwords match ✓</span>';
      } else {
        message.innerHTML = '';
      }
    });
