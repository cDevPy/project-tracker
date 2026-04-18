/* //NOTIFICATION AND LIVE UPDATE FEATURE

// CSRF TOKEN
function getCSRFToken() {
    return document.cookie
        .split('; ')
        .find(row => row.startsWith('csrftoken'))
        ?.split('=')[1];
}

// UPDATE BADGE
function updateNotificationCount() {
    fetch('/notifications/unread-count/')
        .then(res => res.json())
        .then(data => {
            const badge = document.getElementById('notifBadge');

            if (!badge) return;

            if (data.count > 0) {
                badge.style.display = 'inline-block';
                badge.textContent = data.count;
            } else {
                badge.style.display = 'none';
            }
        });
}


// MARK ALL AS READ
function markAllAsRead() {
    fetch('/notifications/mark-all-read/', {
        method: 'POST',
        headers: {
            'X-CSRFToken': getCSRFToken()
        }
    }).then(() => {
        document.querySelectorAll('.unread-dot').forEach(dot => dot.remove());
        document.querySelectorAll('.notification-item').forEach(item => {
            item.classList.remove('unread');
        });
        updateNotificationCount();
    });
}

// CLEAR ALL
function clearAllNotifications() {
    if (confirm("Clear all notifications?")) {
        fetch('/notifications/clear-all/', {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCSRFToken()
            }
        }).then(() => {
            document.querySelectorAll('.notification-item').forEach(el => el.remove());
            
            const badge = document.getElementById('notifBadge');
            if (badge) badge.style.display = 'none';

            updateNotificationCount();
            location.reload();
        });
        
    }
}

// MARK SINGLE AS READ
document.addEventListener('click', function(e) {
    const item = e.target.closest('.notification-item');
    if (!item) return;

    const notifId = item.dataset.id;

    fetch(`/notifications/mark-read/${notifId}/`, {
        method: 'POST',
        headers: {
            'X-CSRFToken': getCSRFToken()
        }
    }).then(() => {
        item.classList.remove('unread');
        item.querySelector('.unread-dot')?.remove();
        updateNotificationCount();
    });
});

// AUTO REFRESH
setInterval(updateNotificationCount, 20000); */