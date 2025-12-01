// =============================================
// PLANOVA DASHBOARD — SAVE/CANCEL AT BOTTOM (FINAL VERSION)
// =============================================

function showPageLoader(duration = 250) {
  const loader = document.getElementById('pageLoader');
  if (!loader) return;
  loader.classList.add('active');
  setTimeout(() => loader.classList.remove('active'), duration);
}

const hamburgerBtn = document.getElementById('hamburgerBtn');
const sidebar = document.getElementById('sidebar');
const todayLabel = document.getElementById('todayLabel');
const mainContent = document.getElementById('mainContent');
const homeBtn = document.getElementById('homeBtn');
const notifBtn = document.getElementById('notificationBtn');
const notifBadge = document.getElementById('notifBadge');
const originalDashboardHTML = document.getElementById('originalDashboardContent').innerHTML;

// ---------- Set Today's Date ----------
if (todayLabel) {
  todayLabel.textContent = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

// ---------- Hamburger Menu ----------
hamburgerBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  sidebar.classList.toggle('open');
  document.body.classList.toggle('sidebar-open');
});

// Close sidebar when clicking outside (mobile only)
document.addEventListener('click', (e) => {
  if (window.innerWidth <= 768) {
    if (sidebar.classList.contains('open') && 
        !sidebar.contains(e.target) && 
        !hamburgerBtn?.contains(e.target)) {
      sidebar.classList.remove('open');
      document.body.classList.remove('sidebar-open');
    }
  }
});

// Close sidebar & search on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    sidebar.classList.remove('open');
    document.body.classList.remove('sidebar-open');
    document.querySelector('.desktop-search-container')?.classList.remove('active');
  }
});

// ---------- DESKTOP & MOBILE SEARCH TOGGLE (NOW PIXEL-PERFECT FROM SEARCH ICON) ----------
document.addEventListener('DOMContentLoaded', () => {
  const desktopSearchToggle = document.getElementById('desktopSearchToggle');
  const desktopSearchContainer = document.querySelector('.desktop-search-container');

  if (!desktopSearchToggle || !desktopSearchContainer) return;

  // PERFECT CLICK HANDLER — SEARCH BAR GROWS EXACTLY FROM THE ICON
  desktopSearchToggle.addEventListener('click', (e) => {
    e.stopPropagation();

    // Dynamically position the container so animation starts from the icon
    const rect = desktopSearchToggle.getBoundingClientRect();
    const distanceFromRight = window.innerWidth - rect.right + 16; // +16px header padding

    desktopSearchContainer.style.right = `${distanceFromRight}px`;
    desktopSearchContainer.style.left = 'auto';

    desktopSearchContainer.classList.toggle('active');

    if (desktopSearchContainer.classList.contains('active')) {
      document.getElementById('desktopSearchInput')?.focus();
    }
  });

  // Click outside → close desktop search
  document.addEventListener('click', (e) => {
    if (desktopSearchContainer && !desktopSearchContainer.contains(e.target) && !desktopSearchToggle.contains(e.target)) {
      desktopSearchContainer.classList.remove('active');
    }
  });

  // Prevent closing when clicking inside search bar
  desktopSearchContainer.addEventListener('click', (e) => {
    e.stopPropagation();
  });
});

// ---------- Quick Action Buttons ----------
document.getElementById('openBoard')?.addEventListener('click', (e) => {
  e.preventDefault();
  alert('Full Kanban board coming soon!');
});

['newTaskBtn', 'newProjectBtn', 'inviteBtn'].forEach(id => {
  document.getElementById(id)?.addEventListener('click', () => {
    alert(`Open ${id.replace('Btn', '')} modal – ready for implementation!`);
  });
});

// ---------- Horizontal Kanban Scroll ----------
(function enableKanbanScroll() {
  const board = document.getElementById('kanbanBoard');
  if (!board) return;

  let isDown = false, startX, scrollLeft;

  const start = (e) => {
    isDown = true;
    board.classList.add('dragging');
    startX = (e.pageX || e.touches?.[0]?.pageX) - board.offsetLeft;
    scrollLeft = board.scrollLeft;
  };

  const move = (e) => {
    if (!isDown) return;
    e.preventDefault();
    const x = (e.pageX || e.touches?.[0]?.pageX) - board.offsetLeft;
    const walk = (x - startX) * 1.5;
    board.scrollLeft = scrollLeft - walk;
  };

  const end = () => {
    isDown = false;
    board.classList.remove('dragging');
  };

  board.addEventListener('mousedown', start);
  board.addEventListener('mousemove', move);
  board.addEventListener('mouseup', end);
  board.addEventListener('mouseleave', end);
  board.addEventListener('touchstart', start, { passive: true });
  board.addEventListener('touchmove', move, { passive: true });
  board.addEventListener('touchend', end);
})();

// ---------- Sidebar Active State ----------
document.querySelectorAll('.aside li').forEach(link => {
  link.addEventListener('click', () => {
    document.querySelectorAll('.aside li').forEach(l => l.classList.remove('active'));
    link.classList.add('active');
  });
});

// ---------- Home Button ----------
homeBtn?.addEventListener('click', () => {
  showPageLoader(400);
  setTimeout(() => {
    mainContent.innerHTML = originalDashboardHTML;
    localStorage.setItem('activeFeature', 'dashboard');
    history.pushState({}, '', '#dashboard');
  }, 200);
});

// ---------- SPA: Profile ----------
function showProfile() {
  const template = document.getElementById('profile-template')?.content.cloneNode(true);
  if (!template) return;

  showPageLoader(400);
  setTimeout(() => {
    mainContent.innerHTML = '';
    mainContent.appendChild(template);

    document.getElementById('backDashboardBtn')?.addEventListener('click', () => {
      showPageLoader(400);
      setTimeout(() => {
        mainContent.innerHTML = originalDashboardHTML;
        localStorage.setItem('activeFeature', 'dashboard');
        history.pushState({}, '', '#dashboard');
      }, 200);
    });

    // EDIT + SAVE/CANCEL AT BOTTOM (PROFILE)
    ['editAccountBtn', 'editSecurityBtn', 'editTeamsBtn'].forEach(id => {
      const editBtn = document.getElementById(id);
      if (!editBtn) return;

      editBtn.addEventListener('click', () => {
        const panel = editBtn.closest('.panel');
        const isEditing = panel.classList.toggle('editing');
        const inputs = panel.querySelectorAll('input, select');
        inputs.forEach(i => i.disabled = !isEditing);
        if (isEditing) inputs[0]?.focus();

        panel.querySelector('.edit-actions')?.remove();

        if (isEditing) {
          const actions = document.createElement('div');
          actions.className = 'edit-actions';
          actions.style.cssText = `
            margin-top: 20px;
            display: flex;
            gap: 10px;
            justify-content: flex-end;
            padding-top: 16px;
            border-top: 1px solid rgba(255,255,255,0.1);
          `;

          const saveBtn = document.createElement('button');
          saveBtn.textContent = 'Save Changes';
          saveBtn.className = 'qa-btn';
          saveBtn.style.background = '#00aaff';
          saveBtn.style.color = '#000';
          saveBtn.style.fontWeight = '600';

          const cancelBtn = document.createElement('button');
          cancelBtn.textContent = 'Cancel';
          cancelBtn.className = 'qa-btn';
          cancelBtn.style.background = 'transparent';
          cancelBtn.style.border = '1px solid #444';

          saveBtn.onclick = (e) => {
            e.preventDefault();
            alert('Changes saved successfully!');
            panel.classList.remove('editing');
            inputs.forEach(i => i.disabled = true);
            actions.remove();
          };

          cancelBtn.onclick = (e) => {
            e.preventDefault();
            panel.classList.remove('editing');
            inputs.forEach(i => {
              i.disabled = true;
              if (i.type !== 'password' && i.defaultValue !== undefined) {
                i.value = i.defaultValue;
              }
            });
            actions.remove();
          };

          actions.append(cancelBtn, saveBtn);
          panel.appendChild(actions);
        }
      });
    });

    // Copy API key
    document.querySelectorAll('.copy-api').forEach(btn => {
      btn.addEventListener('click', () => {
        const input = btn.previousElementSibling;
        navigator.clipboard.writeText(input.value);
        const txt = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = txt, 1500);
      });
    });

    localStorage.setItem('activeFeature', 'profile');
    history.pushState({}, '', '#profile');
  }, 200);
}

// ---------- SPA: Settings ----------
function showSettings() {
  const template = document.getElementById('settings-template')?.content.cloneNode(true);
  if (!template) return;

  showPageLoader(400);
  setTimeout(() => {
    mainContent.innerHTML = '';
    mainContent.appendChild(template);

    document.getElementById('backDashboardBtn')?.addEventListener('click', () => {
      showPageLoader(400);
      setTimeout(() => {
        mainContent.innerHTML = originalDashboardHTML;
        localStorage.setItem('activeFeature', 'dashboard');
        history.pushState({}, '', '#dashboard');
      }, 200);
    });

    document.querySelectorAll('.panel-edit').forEach(editBtn => {
      editBtn.addEventListener('click', () => {
        const panel = editBtn.closest('.panel');
        const isEditing = panel.classList.toggle('editing');
        const inputs = panel.querySelectorAll('input, select');
        inputs.forEach(i => i.disabled = !isEditing);
        if (isEditing) inputs[0]?.focus();

        panel.querySelector('.edit-actions')?.remove();

        if (isEditing) {
          const actions = document.createElement('div');
          actions.className = 'edit-actions';
          actions.style.cssText = `
            margin-top: 20px;
            display: flex;
            gap: 10px;
            justify-content: flex-end;
            padding-top: 16px;
            border-top: 1px solid rgba(255,255,255,0.1);
          `;

          const saveBtn = document.createElement('button');
          saveBtn.textContent = 'Save Changes';
          saveBtn.className = 'qa-btn';
          saveBtn.style.background = '#00aaff';
          saveBtn.style.color = '#000';
          saveBtn.style.fontWeight = '600';

          const cancelBtn = document.createElement('button');
          cancelBtn.textContent = 'Cancel';
          cancelBtn.className = 'qa-btn';
          cancelBtn.style.background = 'transparent';
          cancelBtn.style.border = '1px solid #444';

          saveBtn.onclick = () => {
            alert('Settings saved!');
            panel.classList.remove('editing');
            inputs.forEach(i => i.disabled = true);
            actions.remove();
          };

          cancelBtn.onclick = () => {
            panel.classList.remove('editing');
            inputs.forEach(i => {
              i.disabled = true;
              if (i.type !== 'password' && i.defaultValue !== undefined) {
                i.value = i.defaultValue;
              }
            });
            actions.remove();
          };

          actions.append(cancelBtn, saveBtn);
          panel.appendChild(actions);
        }
      });
    });

    localStorage.setItem('activeFeature', 'settings');
    history.pushState({}, '', '#settings');
  }, 200);
}

// ---------- SPA: Notifications ----------
function showNotifications() {
  const template = document.getElementById('notifications-template')?.content.cloneNode(true);
  if (!template) return;

  showPageLoader(400);
  setTimeout(() => {
    mainContent.innerHTML = '';
    mainContent.appendChild(template);

    const list = document.getElementById('notifList');
    const empty = document.getElementById('emptyState');
    const markAll = document.getElementById('markAllRead');
    const tabs = document.querySelectorAll('.notif-tab');

    const notifications = [
      { id:1, avatar:'J', name:'John', action:'assigned you to', task:'API Integration', time:'1h ago', unread:true },
      { id:2, avatar:'S', name:'Sarah', action:'commented:', comment:'Looks good!', time:'3h ago', unread:true },
      { id:3, avatar:'M', name:'Mike', action:'completed', task:'Login Page', time:'Yesterday', unread:false },
      { id:4, avatar:'T', name:'Team', action:'mentioned you in', task:'Sprint Planning', time:'2d ago', unread:true }
    ];

    function updateBadge() {
      const unread = notifications.filter(n => n.unread).length;
      if (notifBadge) notifBadge.textContent = unread > 0 ? unread : '';
      const unreadTab = document.querySelector('[data-filter="unread"] .notif-count');
      if (unreadTab) unreadTab.textContent = unread;
    }

    function render(filter = 'all') {
      list.innerHTML = '';
      const filtered = notifications.filter(n => {
        if (filter === 'unread') return n.unread;
        if (filter === 'mentions') return n.action.includes('mentioned');
        return true;
      });

      if (!filtered.length) {
        empty.style.display = 'flex';
        return;
      }
      empty.style.display = 'none';

      filtered.forEach(n => {
        const li = document.createElement('li');
        li.className = `notif-item ${n.unread ? 'unread' : ''}`;
        li.innerHTML = `
          <div class="notif-avatar">${n.avatar}</div>
          <div class="notif-body">
            <strong>${n.name}</strong> ${n.action}
            ${n.task ? `<em>${n.task}</em>` : `<span>${n.comment}</span>`}
            <div class="notif-time">· ${n.time}</div>
          </div>
          ${n.unread ? '<div class="notif-dot"></div>' : ''}
        `;
        li.onclick = () => {
          li.classList.remove('unread');
          li.querySelector('.notif-dot')?.remove();
          n.unread = false;
          updateBadge();
        };
        list.appendChild(li);
      });
    }

    tabs.forEach(t => t.addEventListener('click', () => {
      tabs.forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      render(t.dataset.filter);
    }));

    markAll?.addEventListener('click', () => {
      notifications.forEach(n => n.unread = false);
      render(document.querySelector('.notif-tab.active')?.dataset.filter || 'all');
      updateBadge();
    });

    document.getElementById('backDashboardBtn')?.addEventListener('click', () => {
      showPageLoader(400);
      setTimeout(() => {
        mainContent.innerHTML = originalDashboardHTML;
        localStorage.setItem('activeFeature', 'dashboard');
        history.pushState({}, '', '#dashboard');
      }, 200);
    });

    render();
    updateBadge();
    localStorage.setItem('activeFeature', 'notifications');
    history.pushState({}, '', '#notifications');
  }, 200);
}

// ---------- Account Dropdown & Navigation ----------
document.addEventListener('DOMContentLoaded', () => {
  const accountBtn = document.getElementById('accountBtn');
  const accountMenu = document.getElementById('accountMenu');

  accountBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    accountMenu.classList.toggle('show');
  });

  document.addEventListener('click', () => {
    accountMenu.classList.remove('show');
  });

  document.querySelectorAll('#accountMenu li').forEach(item => {
    item.addEventListener('click', () => {
      accountMenu.classList.remove('show');
      const text = item.textContent.trim().toLowerCase();
      if (text.includes('profile')) showProfile();
      else if (text.includes('settings')) showSettings();
      else if (text.includes('notifications')) showNotifications();
    });
  });

  notifBtn?.addEventListener('click', () => {
    showNotifications();
    if (notifBadge) notifBadge.textContent = '';
  });

  const saved = localStorage.getItem('activeFeature');
  if (saved === 'profile') showProfile();
  else if (saved === 'settings') showSettings();
  else if (saved === 'notifications') showNotifications();
  else {
    showPageLoader(800);
    setTimeout(() => mainContent.innerHTML = originalDashboardHTML, 500);
  }

  // FIXED: NOW CALLS THE CORRECT FUNCTION
  function attachTaskClickListeners() {
    document.querySelectorAll('.kanban-task, .due-list li, .assigned-tasks ul li').forEach(item => {
      item.onclick = null;
      item.style.cursor = 'pointer';
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        let title = item.textContent.trim();
        const span = item.querySelector('span');
        if (span) title = span.textContent.trim();
        title = title.replace(/\s*(URGENT|[\d]+h left|[\d]+pm today|·.*)$/gi, '').trim();
        openTaskWithData(142, title || "Task Details");
      });
    });
  }

  // Run on load and after returning
  attachTaskClickListeners();

  // Auto re-attach when dashboard loads
  const observer = new MutationObserver(() => {
    if (mainContent.querySelector('.welcome-row') || mainContent.innerHTML.includes('Good evening')) {
      attachTaskClickListeners();
    }
  });
  observer.observe(mainContent, { childList: true, subtree: true });
});

// ---------- Responsive Fix ----------
window.addEventListener('resize', () => {
  if (window.innerWidth > 768) {
    sidebar.classList.remove('open');
    document.body.classList.remove('sidebar-open');
  }
});

// ---------- Footer Hide on Scroll ----------
let lastScrollTop = 0;
const footer = document.querySelector('.footer');
window.addEventListener('scroll', () => {
  let st = window.scrollY || document.documentElement.scrollTop;
  if (st > lastScrollTop && st > 80) {
    footer.classList.add('hide');
  } else {
    footer.classList.remove('hide');
  }
  lastScrollTop = st <= 0 ? 0 : st;
});

// ---------- First Load Skeleton ----------
if (!localStorage.getItem('activeFeature')) {
  mainContent.innerHTML = '<div class="skeleton" style="height:100%;border-radius:12px;"></div>';
  showPageLoader(800);
  setTimeout(() => {
    mainContent.innerHTML = originalDashboardHTML;
  }, 500);
}

// MAIN TASK OPENER — NOW 100% WORKING
function openTaskWithData(taskId = 142, taskTitle = "Task Details") {
  const template = document.getElementById('task-details-template');
  if (!template) {
    alert('Task template missing! Did you add the <template id="task-details-template"> in HTML?');
    return;
  }

  showPageLoader(400);
  setTimeout(() => {
    const clone = template.content.cloneNode(true);
    mainContent.innerHTML = '';
    mainContent.appendChild(clone);

    const titleEl = document.getElementById('taskTitle');
    if (titleEl) titleEl.textContent = taskTitle;

    const idEl = document.querySelector('.task-id');
    if (idEl) idEl.textContent = `#TASK-${taskId}`;

    document.querySelectorAll('#backDashboardBtn').forEach(btn => {
      btn.onclick = () => {
        showPageLoader(400);
        setTimeout(() => {
          mainContent.innerHTML = originalDashboardHTML;
          localStorage.setItem('activeFeature', 'dashboard');
          history.pushState({}, '', '#dashboard');
        }, 200);
      };
    });

    localStorage.setItem('activeFeature', 'task');
    history.pushState({}, '', `#task-${taskId}`);
  }, 200);
}

// Keep old function for compatibility
function openTask(taskId = 142) {
  openTaskWithData(taskId, "Implement Dark Mode Across Dashboard");
}

// =============================================
// TASKS PAGE — FULLY INTEGRATED (ADDED BELOW)
// =============================================

function showTasks() {
  const template = document.getElementById('tasks-template');
  if (!template) {
    alert('Tasks template missing! Did you add <template id="tasks-template">?');
    return;
  }

  showPageLoader(400);
  setTimeout(() => {
    const clone = template.content.cloneNode(true);
    mainContent.innerHTML = '';
    mainContent.appendChild(clone);

    // Back button
    document.getElementById('backDashboardBtn')?.addEventListener('click', () => {
      showPageLoader(400);
      setTimeout(() => {
        mainContent.innerHTML = originalDashboardHTML;
        localStorage.setItem('activeFeature', 'dashboard');
        history.pushState({}, '', '#dashboard');
      }, 200);
    });

    // Filter tabs
    document.querySelectorAll('.filter-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
      });
    });

    // View toggle (Kanban / List)
    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const isKanban = btn.getAttribute('data-view') === 'kanban';
        document.getElementById('kanbanView').classList.toggle('active', isKanban);
        document.getElementById('listView').classList.toggle('active', !isKanban);
      });
    });

    // Set default view
    document.querySelector('.view-btn[data-view="kanban"]')?.classList.add('active');
    document.getElementById('kanbanView')?.classList.add('active');

    localStorage.setItem('activeFeature', 'tasks');
    history.pushState({}, '', '#tasks');
  }, 200);
}

// Auto-load Tasks page when sidebar item is clicked
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.aside li[data-page]').forEach(item => {
    item.addEventListener('click', () => {
      const page = item.getAttribute('data-page');
      if (page === 'tasks') {
        showTasks();
      }
      // existing pages already handled by other code
    });
  });

  // Restore last page on reload
  if (localStorage.getItem('activeFeature') === 'tasks') {
    showTasks();
  }
});

console.log("SwyftTask is ready");