const resendBtn = document.getElementById('resendBtn');
const timerEl = document.getElementById('timer');
const userEmailInput = document.getElementById('userEmail');

let countdown = 300;
let timerInterval = null;  // To keep track of the active interval


function updateTimer() {
    if (countdown > 60) {
        const minutes = Math.floor(countdown / 60);
        const seconds = countdown % 60;
        timerEl.textContent = `Link expires in ${minutes}m ${seconds < 10 ? '0' : ''}${seconds}s`;
    } else if (countdown > 0) {
        timerEl.textContent = `Link expires in ${countdown}s`;
    } else {
        timerEl.textContent = 'The link has expired. You can now request a new one.';
        resendBtn.disabled = false;
    }
}

// Function to start/restart the countdown
function startCountdown() {
    // Clear any existing interval to prevent duplicates
    if (timerInterval) clearInterval(timerInterval);

    countdown = 300;
    resendBtn.disabled = true;
    updateTimer();  // Immediate update so it doesn't stay stuck at old value

    timerInterval = setInterval(() => {
        countdown--;
        updateTimer();

        if (countdown <= 0) {
            clearInterval(timerInterval);
            timerInterval = null;  // Clean up
        }
    }, 1000);
}

// Start countdown immediately when page loads
startCountdown();

resendBtn.addEventListener('click', async () => {
    const email = userEmailInput.value.trim();

    if (!email) {
        alert('Email not found. Please try signing up again.');
        return;
    }

    resendBtn.textContent = 'Sending...';
    resendBtn.disabled = true;

    try {
        const response = await fetch(window.resendActivationUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-CSRFToken': getCookie('csrftoken'),
            },
            body: 'email=' + encodeURIComponent(email)
        });

        const data = await response.json();

        if (data.success) {
            alert('New activation link sent! Please check your email.');
        } else {
            alert(data.message || 'Failed to resend email. Please try again.');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Connection error. Please try again.');
    } finally {
        resendBtn.textContent = 'Resend Email';
        startCountdown();  // Always restart cooldown to prevent spam
    }
});


// Helper function to get CSRF token from cookie
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}