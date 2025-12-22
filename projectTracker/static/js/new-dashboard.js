// =============================================
// SWYFTTASK DASHBOARD - COMPLETE AUTO-REFRESH VERSION
// =============================================

let validationSetupDone = false;
let validationControllers = new Map(); // To track abort controllers

// Add global error handling
window.addEventListener('error', function(e) {
  // Check if it's a validation-related error
  const errorMessage = e.error ? e.error.toString() : '';
  const isValidationError = errorMessage.includes('validation') || 
                           errorMessage.includes('Validation') ||
                           e.target && (e.target.id === 'projectName' || e.target.id === 'taskTitle');
  
  if (isValidationError) {
    console.log('Validation error (ignored):', e.error);
    return; // Don't trigger emergency reset for validation errors
  }
  
  console.error('Global error caught:', e.error);
  hideLoader();
  emergencyReset();
});

window.addEventListener('unhandledrejection', function(e) {
  // Check if it's a validation-related promise rejection
  const reason = e.reason ? e.reason.toString() : '';
  const isValidationRejection = reason.includes('validation') || 
                               reason.includes('Validation') ||
                               reason.includes('Available') ||
                               reason.includes('duplicate');
  
  if (isValidationRejection) {
    console.log('Validation promise rejection (ignored):', e.reason);
    return; // Don't trigger emergency reset
  }
  
  console.error('Unhandled promise rejection:', e.reason);
  hideLoader();
  emergencyReset();
});

// Add at the top of dashboard.js
let apiCallLog = [];

function trackAPICall(endpoint, caller) {
  const entry = {
    timestamp: Date.now(),
    endpoint: endpoint,
    caller: caller,
    stack: new Error().stack // Get call stack
  };
  
  apiCallLog.push(entry);
  
  // Keep only last 20 entries
  if (apiCallLog.length > 20) {
    apiCallLog = apiCallLog.slice(-20);
  }
  
  console.log(`📞 API Call: ${endpoint} from ${caller}`);
  
  // Log if too many calls
  const recentCalls = apiCallLog.filter(call => 
    call.timestamp > Date.now() - 1000 && call.endpoint === endpoint
  );
  
  if (recentCalls.length > 3) {
    console.warn(`⚠️ Too many calls to ${endpoint}: ${recentCalls.length} in 1 second`);
    console.warn('Recent callers:', recentCalls.map(c => c.caller));
  }
}

// Then wrap your fetch calls:
async function refreshDashboardData(force = false) {
  trackAPICall('/api/dashboard/full-data/', 'refreshDashboardData');
  // ... rest of function
}

// You can also add a debug button to see what's happening:
function debugAPICalls() {
  console.group('API Call Debug');
  console.log('Total calls in log:', apiCallLog.length);
  console.table(apiCallLog.map(call => ({
    time: new Date(call.timestamp).toLocaleTimeString(),
    endpoint: call.endpoint,
    caller: call.caller
  })));
  console.groupEnd();
}

// Add a debug button to your page temporarily
// document.body.innerHTML += '<button onclick="debugAPICalls()" style="position:fixed;top:100px;right:20px;z-index:9999">Debug API</button>';

// Global state
const AppState = {
  originalDashboardHTML: null,
  currentPage: "dashboard",
  cachedData: {
    counts: {},
    tasks: {},
    projects: [],
    all_projects: 0,
    total_projects: 0, // ⭐ Add this initial value ⭐
  },
  needsRefresh: {
    dashboard: false,
    projects: false,
  },
  autoRefreshInterval: null,
};

// Add this utility function at the top of dashboard.js
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Main initialization
document.addEventListener("DOMContentLoaded", function () {
  console.log("🚀 SwyftTask Dashboard Initializing...");

  // Save original dashboard HTML immediately
  const originalContent = document.getElementById("originalDashboardContent");
  if (originalContent) {
    AppState.originalDashboardHTML = originalContent.innerHTML;
    console.log("💾 Saved original dashboard HTML");
  }

  // Initialize all functionality
  setupAllFunctionality();

  // Start auto-refresh
  // startAutoRefresh();

  console.log("✅ Dashboard initialized successfully");
});

// =============================================
// MAIN FUNCTIONALITY SETUP
// =============================================

function setupAllFunctionality() {
  console.log("🔧 Setting up all functionality...");

  // Setup event listeners
  setupEventListeners();

  // Setup sidebar
  setupSidebar();

  // Setup form handlers
  setupFormHandlers();

  console.log("✅ All functionality setup complete");
}

// =============================================
// AUTO-REFRESH SYSTEM
// =============================================

function startAutoRefresh() {
  // Clear any existing interval
  if (AppState.autoRefreshInterval) {
    clearInterval(AppState.autoRefreshInterval);
  }

  // Only refresh every 60 seconds (not 10), and only if user is active on dashboard
  AppState.autoRefreshInterval = setInterval(() => {
    if (AppState.currentPage === "dashboard") {
      // Check if user is actually interacting with dashboard
      const hasRecentActivity =
        Date.now() - (window.lastUserActivity || 0) < 30000; // 30 seconds

      if (hasRecentActivity) {
        refreshDashboardData();
      }
    }
  }, 60000); // 60 seconds instead of 10

  // Track user activity
  ["mousemove", "click", "keypress", "scroll"].forEach((event) => {
    document.addEventListener(
      event,
      () => {
        window.lastUserActivity = Date.now();
      },
      { passive: true }
    );
  });

  console.log("🔄 Auto-refresh started (every 60 seconds, only when active)");
}

function stopAutoRefresh() {
  if (AppState.autoRefreshInterval) {
    clearInterval(AppState.autoRefreshInterval);
    AppState.autoRefreshInterval = null;
    console.log("⏹️ Auto-refresh stopped");
  }
}

// dashboard.js - Replace the refreshDashboardData function

let isRefreshing = false;
let refreshQueue = [];

async function refreshDashboardData(force = false) {
  // Prevent multiple simultaneous refreshes
  trackAPICall("/api/dashboard/full-data/", "refreshDashboardData");
  if (isRefreshing && !force) {
    console.log("⏳ Refresh already in progress, skipping...");
    return;
  }
  
  // Debounce: If called too frequently, queue it
  const now = Date.now();
  if (window.lastRefresh && now - window.lastRefresh < 2000 && !force) { // 2 second minimum
    console.log("⏳ Too soon since last refresh, skipping...");
    return;
  }
  
  showLoader();
  isRefreshing = true;
  window.lastRefresh = now;
  
  try {
    console.log("🔄 Refreshing dashboard data...");
    
    // Only call API if actually needed (not just for UI updates)
    const response = await fetch("/api/dashboard/full-data/");
    const data = await response.json();
    
    if (data.success) {
      console.log(
        `📊 API returned ${data.projects.length} pinned projects, total: ${data.total_projects}`
      );
      // Update cached data
      AppState.cachedData = {
        counts: data.counts,
        tasks: data.tasks,
        projects: data.projects,
        total_projects: data.total_projects || data.projects.length, // Add this!
      };

      // Debug log
      console.log("📦 Saved to cache:", {
        projects: AppState.cachedData.projects.length,
        total_projects: AppState.cachedData.total_projects,
      });

      // Update the UI
      updateCompleteDashboardUI(data);
    }
  } catch (error) {
    console.error("Error refreshing dashboard:", error);
  } finally {
    isRefreshing = false;
    hideLoader();
  }
}

// NEW FUNCTION: Update all dashboard sections
function updateCompleteDashboardUI(data) {
  // Update counts
  updateDashboardCounts(data.counts);
  
  // Update pinned projects
  updatePinnedProjectsFromCache();
  
  // ⭐⭐ CRITICAL: Update tasks sections ⭐⭐
  updateTasksDueToday(data.tasks);
  updateKanbanBoard(data.tasks);
  updateYourTasks(data.tasks);
  
  // Update recent activity if available
  if (data.recent_activity) {
    updateRecentActivity(data.recent_activity);
  }
  
  console.log("✅ Complete dashboard UI updated");
}

// NEW FUNCTION: Update Tasks Due Today
function updateTasksDueToday(tasksData) {
  const dueTodayContainer = document.querySelector('.tasks-due-today .due-list');
  if (!dueTodayContainer) return;
  
  // Get today's date
  const today = new Date().toISOString().split('T')[0];
  
  // Clear existing content
  dueTodayContainer.innerHTML = '';
  
  // Check if we have tasks due today
  if (tasksData.todo && tasksData.todo.length > 0) {
    // Filter tasks due today (this would be better with actual due dates from API)
    const tasksToShow = tasksData.todo.slice(0, 5); // Show first 5
    
    tasksToShow.forEach(task => {
      const taskItem = document.createElement('li');
      taskItem.setAttribute('data-task-id', task.id);
      
      const isDueToday = task.due_date === today;
      
      taskItem.innerHTML = `
        <span>${task.title}</span>
        <strong class="${isDueToday ? 'urgent' : ''}">
          ${isDueToday ? 'Due Today' : 'No deadline'}
        </strong>
      `;
      
      dueTodayContainer.appendChild(taskItem);
    });
  } else {
    // No tasks
    dueTodayContainer.innerHTML = '<li><span>No tasks due today</span></li>';
  }
  
  // Update the count badge
  const countBadge = document.querySelector('.tasks-due-today .inbox-badge');
  if (countBadge) {
    const taskCount = tasksData.todo ? tasksData.todo.length : 0;
    countBadge.textContent = taskCount;
    countBadge.style.display = taskCount > 0 ? 'inline-block' : 'none';
  }
}

// NEW FUNCTION: Update Kanban Board
function updateKanbanBoard(tasksData) {
  const kanbanBoard = document.getElementById('kanbanBoard');
  if (!kanbanBoard) return;
  
  // Clear all kanban columns
  const columns = kanbanBoard.querySelectorAll('.kanban-column');
  columns.forEach(column => {
    const taskContainer = column.querySelector('.kanban-task:not(.empty)');
    if (taskContainer) {
      taskContainer.innerHTML = '';
    }
  });
  
  // Update each column
  const columnMap = {
    'todo': tasksData.todo || [],
    'inprogress': tasksData.inprogress || [],
    'review': tasksData.review || [],
    'done': tasksData.done || []
  };
  
  columns.forEach(column => {
    const columnType = column.getAttribute('data-column');
    const tasks = columnMap[columnType] || [];
    const taskContainer = column.querySelector('.kanban-task:not(.empty)');
    
    if (taskContainer) {
      if (tasks.length === 0) {
        taskContainer.innerHTML = '<div class="kanban-task empty">No tasks</div>';
      } else {
        // Show first 5 tasks
        const tasksToShow = tasks.slice(0, 5);
        taskContainer.innerHTML = '';
        
        tasksToShow.forEach(task => {
          const taskElement = document.createElement('div');
          taskElement.className = `kanban-task ${columnType === 'done' ? 'complete' : ''}`;
          taskElement.setAttribute('role', 'listitem');
          taskElement.setAttribute('data-task-id', task.id);
          
          let assigneeInfo = '';
          if (task.assigned_to_name) {
            assigneeInfo = `<small>@${task.assigned_to_name}</small>`;
          }
          
          taskElement.innerHTML = `
            ${task.title}
            ${assigneeInfo}
          `;
          
          // Add click handler
          taskElement.addEventListener('click', function() {
            openTaskDetails(task.id, task.title);
          });
          
          taskContainer.appendChild(taskElement);
        });
        
        // Add "more tasks" indicator if there are more
        if (tasks.length > 5) {
          const moreTasks = document.createElement('div');
          moreTasks.className = 'kanban-task more-tasks';
          moreTasks.textContent = `+${tasks.length - 5} more`;
          taskContainer.appendChild(moreTasks);
        }
      }
    }
  });
}

// NEW FUNCTION: Update Your Tasks
function updateYourTasks(tasksData) {
  const yourTasksContainer = document.querySelector('.assigned-tasks ul');
  if (!yourTasksContainer) return;
  
  // Clear existing content
  yourTasksContainer.innerHTML = '';
  
  // Combine all tasks and filter by current user
  const allTasks = [
    ...(tasksData.todo || []),
    ...(tasksData.inprogress || []),
    ...(tasksData.review || []),
    ...(tasksData.done || [])
  ];
  
  // Get current user ID
  const currentUserId = window.djangoData?.user?.id;
  
  // Filter tasks assigned to current user
  const yourTasks = allTasks.filter(task => 
    task.assigned_to === currentUserId
  ).slice(0, 5); // Show first 5
  
  if (yourTasks.length === 0) {
    yourTasksContainer.innerHTML = '<li><span class="task-title">No tasks assigned</span></li>';
  } else {
    yourTasks.forEach(task => {
      const taskItem = document.createElement('li');
      taskItem.setAttribute('data-task-id', task.id);
      
      let dueText = 'no deadline';
      if (task.due_date) {
        const dueDate = new Date(task.due_date);
        const today = new Date();
        const diffTime = dueDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) dueText = 'due today';
        else if (diffDays < 0) dueText = 'overdue';
        else dueText = `in ${diffDays} day${diffDays !== 1 ? 's' : ''}`;
      }
      
      taskItem.innerHTML = `
        <span class="task-title">${task.title}</span>
        <small class="muted">${dueText}</small>
      `;
      
      // Add click handler
      taskItem.addEventListener('click', function() {
        openTaskDetails(task.id, task.title);
      });
      
      yourTasksContainer.appendChild(taskItem);
    });
  }
  
  // Update the count badge
  const countBadge = document.querySelector('.assigned-tasks .inbox-badge');
  if (countBadge) {
    countBadge.textContent = yourTasks.length;
    countBadge.style.display = yourTasks.length > 0 ? 'inline-block' : 'none';
  }
}

function updateDashboardUI() {
  // Update counts
  updateDashboardCounts();

  // Update pinned projects
  updatePinnedProjectsFromCache();

  console.log("✅ Dashboard UI updated with fresh data");
}

// =============================================
// DATA LOADING & CACHING
// =============================================

async function loadDashboardData() {
  try {
    const response = await fetch("/api/dashboard/full-data/");
    const data = await response.json();

    if (data.success) {
      AppState.cachedData = {
        counts: data.counts,
        tasks: data.tasks,
        projects: data.projects,
        total_projects: data.total_projects || data.projects.length,
      };

      // Update the UI immediately
      updateDashboardUI();
    }
  } catch (error) {
    console.error("Error loading dashboard data:", error);
  }
}

function updateDashboardCounts() {
  if (AppState.cachedData.counts) {
    const activeProjectsEl = document.getElementById("activeProjectsCount");
    const tasksDueEl = document.getElementById("tasksDueCount");
    const overdueEl = document.getElementById("overdueCount");
    const teamCountEl = document.getElementById("teamCount");

    if (activeProjectsEl)
      activeProjectsEl.textContent = AppState.cachedData.counts.active_projects;
    if (tasksDueEl)
      tasksDueEl.textContent = AppState.cachedData.counts.tasks_due;
    if (overdueEl) overdueEl.textContent = AppState.cachedData.counts.overdue;
    if (teamCountEl)
      teamCountEl.textContent = AppState.cachedData.counts.team_count;
  }
}

function updatePinnedProjectsFromCache() {
  const pinnedProjectsContainer = document.querySelector(".pinned-projects");
  if (!pinnedProjectsContainer || !AppState.cachedData.projects) return;

  // Get the total projects count
  const totalProjects = AppState.cachedData.total_projects || 0;
  const showingProjects = Math.min(AppState.cachedData.projects.length, 4);

  console.log(`📊 Total projects: ${totalProjects}, Showing: ${showingProjects}`);

  // Clear the container
  pinnedProjectsContainer.innerHTML = "";

  const projectsToShow = AppState.cachedData.projects.slice(0, 4);

  // Add project cards
  if (projectsToShow.length === 0) {
    // No projects - show "Create First Project"
    const emptyProject = document.createElement("div");
    emptyProject.className = "pinned-project";
    emptyProject.onclick = showNewProjectForm;
    emptyProject.innerHTML = `
            <h4><i class="fas fa-plus-circle"></i> Create First Project</h4>
            <small>Click to create your first project</small>
            <div class="progress">
                <div class="progress-fill" style="width:0%"></div>
            </div>
        `;
    pinnedProjectsContainer.appendChild(emptyProject);
  } else {
    // Add all projects
    projectsToShow.forEach((project) => {
      const projectCard = document.createElement("div");
      projectCard.className = `pinned-project ${project.css_class}`;
      projectCard.setAttribute("data-project-id", project.id);

      // Truncate project name for display
      const projectName =
        project.name.length > 20
          ? project.name.substring(0, 20) + "..."
          : project.name;

      projectCard.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <h4>${projectName}</h4>
                    <button class="project-menu-btn" 
                        onclick="event.stopPropagation(); showProjectContextMenu(event, ${
                          project.id
                        })">
                        <i class="fas fa-ellipsis-v"></i>
                    </button>
                </div>
                <small>${project.progress}% complete • ${
        project.task_count
      } task${project.task_count !== 1 ? "s" : ""}</small>
                <div class="progress">
                    <div class="progress-fill" style="width:${
                      project.progress
                    }%"></div>
                </div>
            `;

      // Add click handler
      projectCard.onclick = function (e) {
        if (!e.target.closest(".project-menu-btn")) {
          openProjectDetails(project.id, project.name);
        }
      };

      pinnedProjectsContainer.appendChild(projectCard);
    });

    // ⭐⭐ FIX: Show View All button when totalProjects > 4 ⭐⭐
    console.log(`🔍 Checking View All: ${totalProjects} > 4 ? ${totalProjects > 4}`);
    if (totalProjects > 4) {
      console.log(`➕ Adding View All button for ${totalProjects} projects`);
      const viewAllCard = document.createElement("div");
      viewAllCard.className = "pinned-project view-all-projects";
      viewAllCard.onclick = showAllProjects;
      viewAllCard.innerHTML = `
                <div class="view-all-content">
                    <h4><i class="fas fa-th-list"></i> View All Projects</h4>
                    <small>See all ${totalProjects} projects</small>
                    <div class="view-all-arrow">
                        <i class="fas fa-arrow-right"></i>
                    </div>
                </div>
            `;
      pinnedProjectsContainer.appendChild(viewAllCard);
    }
  }
}

// =============================================
// EVENT LISTENERS
// =============================================

function setupEventListeners() {
  console.log("🔧 Setting up event listeners...");

  // Remove existing listeners first (use a namespace)
  document.querySelectorAll('[data-listener-attached="true"]').forEach((el) => {
    el.removeEventListener("click", el._clickHandler);
    delete el._clickHandler;
    el.removeAttribute("data-listener-attached");
  });

  // ========== HEADER BUTTONS ==========

  // Hamburger menu
  const hamburgerBtn = document.getElementById("hamburgerBtn");
  if (hamburgerBtn && !hamburgerBtn.dataset.listenerAttached) {
    const handler = function (e) {
      e.preventDefault();
      e.stopPropagation();
      toggleSidebar();
    };
    hamburgerBtn.addEventListener("click", handler);
    hamburgerBtn._clickHandler = handler;
    hamburgerBtn.dataset.listenerAttached = "true";
  }

  // Home button
  const homeBtn = document.getElementById("homeBtn");
  if (homeBtn && !homeBtn.dataset.listenerAttached) {
    const handler = function (e) {
      e.preventDefault();
      e.stopPropagation();
      console.log("🏠 Home button clicked");
      restoreDashboard();
    };
    homeBtn.addEventListener("click", handler);
    homeBtn._clickHandler = handler;
    homeBtn.dataset.listenerAttached = "true";
  }

  // ========== QUICK ACTION BUTTONS ==========

  // New Project Button
  const newProjectBtn = document.getElementById("newProjectBtn");
  if (newProjectBtn && !newProjectBtn.dataset.listenerAttached) {
    const handler = debounce(function (e) {
      e.preventDefault();
      e.stopPropagation();
      console.log("📁 New Project button clicked");
      showNewProjectForm();
    }, 300); // 300ms debounce

    newProjectBtn.addEventListener("click", handler);
    newProjectBtn._clickHandler = handler;
    newProjectBtn.dataset.listenerAttached = "true";
  }

  // New Task Button
  const newTaskBtn = document.getElementById("newTaskBtn");
  if (newTaskBtn) {
    newTaskBtn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      console.log("➕ New Task button clicked");
      showNewTaskForm();
    });
  }

  // Invite Button
  const inviteBtn = document.getElementById("inviteBtn");
  if (inviteBtn) {
    inviteBtn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      console.log("👥 Invite button clicked");
      showInviteForm();
    });
  }

  // Desktop create button
  const createBtn = document.getElementById("createBtn");
  if (createBtn) {
    createBtn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      console.log("✨ Create button clicked");
      showNewTaskForm();
    });
  }

  // Mobile create button
  const mobileCreateBtn = document.getElementById("newTaskBtnMobile");
  if (mobileCreateBtn) {
    mobileCreateBtn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      console.log("📱 Mobile create button clicked");
      showNewTaskForm();
    });
  }

  // ========== PROJECT CLICK HANDLERS ==========

  // Setup click handlers for projects using event delegation
  document.addEventListener("click", function (e) {
    // Check if clicked on a pinned project card
    const projectCard = e.target.closest(".pinned-project");
    if (projectCard && !projectCard.classList.contains("view-all-projects")) {
      e.preventDefault();
      e.stopPropagation();

      // Check if it's the "Create First Project" placeholder
      if (
        projectCard
          .querySelector("h4")
          ?.textContent.includes("Create First Project")
      ) {
        showNewProjectForm();
        return;
      }

      const projectId = projectCard.getAttribute("data-project-id");
      const projectName = projectCard.querySelector("h4").textContent.trim();

      // Validate projectId
      if (!projectId || projectId === "null" || projectId === "undefined") {
        console.error("❌ Invalid project ID on click:", projectId);
        showNotification(
          "This project cannot be opened. Please try another.",
          "error"
        );
        return;
      }

      console.log(`📁 Project card clicked: ${projectId} - ${projectName}`);
      openProjectDetails(projectId, projectName);
      return;
    }

    // Check if clicked on View All Projects
    if (e.target.closest(".view-all-projects")) {
      e.preventDefault();
      e.stopPropagation();
      showAllProjects();
      return;
    }

    // Check if clicked on project menu button (three dots)
    if (
      e.target.closest(".project-menu-btn") ||
      e.target.classList.contains("fa-ellipsis-v")
    ) {
      e.preventDefault();
      e.stopPropagation();
      const projectCard = e.target.closest(".pinned-project");
      if (projectCard) {
        const projectId = projectCard.getAttribute("data-project-id");
        if (projectId && projectId !== "null" && projectId !== "undefined") {
          console.log(`📁 Project menu clicked: ${projectId}`);
          showProjectContextMenu(e, projectId);
        }
      }
      return;
    }
  });

  console.log("✅ All event listeners setup complete");
}

// =============================================
// FORM HANDLERS
// =============================================
const buttonDebounceTime = 2000; // 2 seconds

// Update setupFormHandlers to add proper debouncing
function setupFormHandlers() {
  console.log("🔧 Setting up form handlers...");

  // Remove any existing listeners first
  document.removeEventListener("click", handleFormButtonClicks);
  document.removeEventListener("submit", handleFormSubmit);

  // Add new listeners
  document.addEventListener("click", handleFormButtonClicks);
  document.addEventListener("submit", handleFormSubmit);
}

function handleFormButtonClicks(e) {
  // Handle close buttons
  if (e.target.closest('.close-form-btn') || 
      (e.target.classList.contains('fa-times') && e.target.closest('button'))) {
    e.preventDefault();
    e.stopPropagation();
    console.log("❌ Form close button clicked");
    restoreDashboard();
    return;
  }

  // Handle cancel buttons
  if (e.target.classList.contains('cancel-btn') ||
      e.target.closest('.cancel-btn')) {
    e.preventDefault();
    e.stopPropagation();
    console.log("❌ Cancel button clicked");
    restoreDashboard();
    return;
  }

  // Handle back buttons
  if (e.target.id === 'backDashboardBtn' ||
      e.target.closest('#backDashboardBtn')) {
    e.preventDefault();
    e.stopPropagation();
    console.log("🔙 Back to dashboard clicked");
    restoreDashboard();
    return;
  }
}

function handleButtonClick(e) {
  // Only handle submit buttons and create buttons
  const isSubmitButton = e.target.type === 'submit' || 
                         e.target.classList.contains('submit-btn') ||
                         e.target.closest('button[type="submit"]') ||
                         e.target.closest('.submit-btn');
  
  if (!isSubmitButton) return;
  
  const now = Date.now();
  const button = e.target.tagName === 'BUTTON' ? e.target : e.target.closest('button');
  
  if (!button) return;
  
  // Check if button was clicked recently
  if (button.lastClickTime && now - button.lastClickTime < buttonDebounceTime) {
    e.preventDefault();
    e.stopPropagation();
    console.log("⏳ Button click prevented - too soon after previous click");
    return;
  }
  
  // Store the click time
  button.lastClickTime = now;
}

// Add this new function
function handleFormSubmit(e) {
  if (!e.target.matches("#taskForm, #projectForm")) return;

  e.preventDefault();
  e.stopImmediatePropagation();

  if (e.target.id === "taskForm") {
    handleTaskFormSubmit(e.target);
  } else if (e.target.id === "projectForm") {
    handleProjectFormSubmit(e.target);
  }
}

// dashboard.js - FIXED handleTaskFormSubmit

let isTaskSubmitting = false;

async function handleTaskFormSubmit(form) {
  console.log("📝 Task form submitted");

  if (isTaskSubmitting) {
    console.log("⏳ Task submission already in progress, skipping...");
    return false;
  }

  isTaskSubmitting = true;
  
  // Get button reference
  const submitBtn = form.querySelector(".submit-btn");
  if (!submitBtn) {
    console.error("❌ No submit button found");
    isTaskSubmitting = false;
    return false;
  }
  
  // Save original state
  const originalText = submitBtn.innerHTML;
  
  // Disable button immediately
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
  submitBtn.disabled = true;

  // Add a timeout to prevent hanging indefinitely
  const timeoutId = setTimeout(() => {
    console.warn("⚠️ Task creation taking too long, forcing reset...");
    resetTaskFormState(form, submitBtn, originalText);
    isTaskSubmitting = false;
    showNotification("Task creation timed out. Please try again.", "error");
  }, 15000); // 15 second timeout
  
  try {
    const formData = new FormData(form);
    const data = {
      title: formData.get("title"),
      description: formData.get("description"),
      project: formData.get("project"),
      assigned_to: formData.get("assigned_to") || null,
      status: formData.get("status"),
      priority: formData.get("priority"),
      due_date: formData.get("due_date"),
    };
    
    console.log("📤 Submitting task:", data.title);
    
    const response = await fetch("/api/tasks/create/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": getCSRFToken(),
      },
      body: JSON.stringify(data),
    });

    clearTimeout(timeoutId);

    const result = await response.json();

    if (result.success) {
      showNotification("Task created successfully!", "success");
      
      // Refresh dashboard data
      await refreshDashboardData();
      
      // Return to dashboard after a moment
      setTimeout(() => {
        restoreDashboard();
      }, 1500);
      
    } else {
      showNotification(result.error || "Failed to create task", "error");
      // Re-enable form on error
      resetFormState(form, submitBtn, originalText);
    }
    
  } catch (error) {
    console.error("❌ Network error:", error);
    clearTimeout(timeoutId);
    showNotification("Network error. Please try again.", "error");
    // Re-enable form on error
    resetFormState(form, submitBtn, originalText, originalDisabled);
  } finally {
    // Only reset the flag after a delay to prevent rapid re-submission
    setTimeout(() => {
      isTaskSubmitting = false;
    }, 1000);
  }

  return false;
}

// Add this function to reset submission state
function resetSubmissionState() {
  window.isSubmitting = false;
  window.lastProjectSubmitTime = 0;
  
  // Re-enable all submit buttons
  document.querySelectorAll('button[type="submit"], .submit-btn').forEach(btn => {
    btn.disabled = false;
    if (btn.innerHTML.includes('Creating...') || btn.innerHTML.includes('Checking...')) {
      btn.innerHTML = btn.innerHTML.includes('Create Task') ? 
        '<i class="fas fa-check"></i> Create Task' : 
        '<i class="fas fa-plus-circle"></i> Create Project';
    }
  });
}

// Helper function to reset form state
function resetTaskFormState(form, submitBtn, originalText) {
  if (submitBtn) {
    submitBtn.innerHTML = originalText;
    submitBtn.disabled = false;
  }
  
  // Re-enable all form elements
  if (form) {
    const formElements = form.elements;
    for (let i = 0; i < formElements.length; i++) {
      formElements[i].disabled = false;
    }
  }
  
  hideLoader();
}

// Add this emergency reset function
function emergencyReset() {
  console.log("🚨 EMERGENCY RESET - Clearing all submission states");

  // Reset all flags
  window.isTaskSubmitting = false;
  window.isProjectSubmitting = false;
  window.lastClickTime = 0;

  // Hide loader
  hideLoader();

  // Re-enable all buttons and inputs EXCEPT validation inputs
  document
    .querySelectorAll(
      "button:disabled, input:disabled, textarea:disabled, select:disabled"
    )
    .forEach((el) => {
      // Don't reset validation inputs if they're actively validating
      if (el.id === "projectName" && el.dataset.validationSetup === "true") {
        return;
      }

      el.disabled = false;
      if (el.classList.contains("submit-btn")) {
        el.innerHTML = el.innerHTML
          .replace("Creating...", "Create Task")
          .replace("Checking...", "Create Project")
          .replace(
            '<i class="fas fa-spinner fa-spin"></i>',
            el.innerHTML.includes("Create Task")
              ? '<i class="fas fa-check"></i> Create Task'
              : '<i class="fas fa-plus-circle"></i> Create Project'
          );
      }
    });

  console.log("✅ Emergency reset complete");
  // Only show notification if something was actually reset
  if (document.querySelector("button:disabled, input:disabled")) {
    showNotification("System reset. You can try again.", "info");
  }
}

// =============================================
// FORM TEMPLATE FUNCTIONS
// =============================================

// =============================================
// FIXED: Update showNewProjectForm to reset button state
// =============================================

function showNewProjectForm() {
  console.log("🏗️ Showing new project form...");
  resetSubmissionState();
  showLoader();

  // Clear validation flag
  validationSetupDone = false;

  setTimeout(() => {
    const mainContent = document.getElementById("mainContent");
    if (!mainContent) return;

    const template = document.getElementById("new-project-template");
    if (!template) {
      alert("Project form template not found!");
      restoreDashboard();
      return;
    }

    mainContent.innerHTML = "";
    mainContent.appendChild(template.content.cloneNode(true));

    // Set up real-time validation after form is loaded
    setTimeout(() => {
      setupRealTimeValidation();
    }, 100);

    // Update state
    AppState.currentPage = "new-project";
    updateSidebarActive("");
    localStorage.setItem("swyfttask-page", "new-project");
    history.pushState({ page: "new-project" }, "", "#new-project");

    // Stop auto-refresh when not on dashboard
    stopAutoRefresh();

    hideLoader();
  }, 300);
}

function showNewTaskForm() {
  console.log("📝 Showing new task form...");
  resetSubmissionState();
  showLoader();

  setTimeout(() => {
    const mainContent = document.getElementById("mainContent");
    if (!mainContent) return;

    const template = document.getElementById("new-task-template");
    if (!template) {
      alert("Task form template not found!");
      restoreDashboard();
      return;
    }

    mainContent.innerHTML = "";
    mainContent.appendChild(template.content.cloneNode(true));

    // Initialize the form to remove duplicates
    setTimeout(() => {
      setupTaskForm();
    }, 100);

    // Update state
    AppState.currentPage = "new-task";
    updateSidebarActive("");
    localStorage.setItem("swyfttask-page", "new-task");
    history.pushState({ page: "new-task" }, "", "#new-task");

    // Stop auto-refresh when not on dashboard
    stopAutoRefresh();

    hideLoader();
  }, 300);
}

function showInviteForm() {
  console.log("👥 Showing invite form...");
  showNotification(
    "Invite functionality will be implemented in the next release!",
    "info"
  );
}

// =============================================
// FIXED: handleProjectFormSubmit
// =============================================
let isProjectSubmitting = false;

async function handleProjectFormSubmit(form) {
  console.log("📝 Project form submitted");

  // Prevent double submission
  if (isProjectSubmitting) {
    console.log("⏳ Project submission already in progress, skipping...");
    return false;
  }

  isProjectSubmitting = true;

  const submitBtn = form.querySelector(".submit-btn");
  if (!submitBtn) {
    console.error("❌ No submit button found");
    isProjectSubmitting = false;
    return false;
  }

  const originalText = submitBtn.innerHTML;
  const originalDisabled = submitBtn.disabled;

  // Step 1: Show checking state
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking...';
  submitBtn.disabled = true;

  // Disable all form elements
  const formElements = form.elements;
  for (let i = 0; i < formElements.length; i++) {
    formElements[i].disabled = true;
  }

  const formData = new FormData(form);
  const projectName = formData.get("name").trim();

  if (!projectName) {
    showNotification("Project name is required", "error");
    // submitBtn.innerHTML = originalText;
    // submitBtn.disabled = false;
    resetFormState(form, submitBtn, originalText, originalDisabled);
    isProjectSubmitting = false;
    return false;
  }

  try {
    // Step 2: Use SERVER API to check for duplicates
    console.log(`🔍 Checking server for duplicate: "${projectName}"`);
    const response = await fetch(
      `/api/projects/check-duplicate/?name=${encodeURIComponent(projectName)}`
    );
    const result = await response.json();

    if (result.exists) {
      console.log(`⚠️ SERVER FOUND DUPLICATE: ${result.project_name}`);

      // Reset button
      // submitBtn.innerHTML = originalText;
      // submitBtn.disabled = false;
      resetFormState(form, submitBtn, originalText, originalDisabled);

      // Show notification
      showNotification(
        `You already have a project named "${result.project_name}"`,
        "error"
      );
      isProjectSubmitting = false;

      // Return to dashboard after 1.5 seconds
      // setTimeout(() => {
      //   restoreDashboard();
      // }, 1500);

      return false;
    }

    // Step 3: No duplicate found, create project
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';

    const createResponse = await fetch("/api/projects/create/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": getCSRFToken(),
      },
      body: JSON.stringify({
        name: projectName,
        description: formData.get("description") || "",
        invited_emails: JSON.parse(formData.get("invited_emails") || "[]"),
      }),
    });

    const createResult = await createResponse.json();

    // ALWAYS reset button
    // submitBtn.innerHTML = originalText;
    // submitBtn.disabled = false;

    if (createResult.success) {
      showNotification("Project created successfully!", "success");

      // Refresh and go to new project
      setTimeout(() => {
        openProjectDetails(createResult.project.id, createResult.project.name);
      }, 1000);
    } else {
      // Handle other errors
      showNotification(
        createResult.error || "Failed to create project",
        "error"
      );
      resetFormState(form, submitBtn, originalText, originalDisabled);
    }
  } catch (error) {
    console.error("❌ Network error:", error);
    showNotification("Network error. Please try again.", "error");
    resetFormState(form, submitBtn, originalText, originalDisabled);
    // ALWAYS reset button on error
    // submitBtn.innerHTML = originalText;
    // submitBtn.disabled = false;
  } finally {
    setTimeout(() => {
      isProjectSubmitting = false;
    }, 2000);
  }

  return false;
}

// =============================================
// FIXED: Real-time validation that uses SERVER
// =============================================

// dashboard.js - Update the setupRealTimeValidation function

let lastValidationTime = 0;
const VALIDATION_DEBOUCE_MS = 1000; // Only validate once per second

function setupRealTimeValidation() {
  const projectNameInput = document.getElementById("projectName");
  if (!projectNameInput) {
    console.log("⚠️ No project name input found");
    return;
  }

  // Skip if already set up for this input
  if (projectNameInput.dataset.validationSetup === "true") {
    console.log("✅ Validation already set up for this input");
    return;
  }

  console.log("✅ Setting up REAL-TIME validation");

  // Mark as setup
  projectNameInput.dataset.validationSetup = "true";

  let validationTimeout;
  let isChecking = false;
  let currentAbortController = null;
  let currentValidationId = 0; // Track current validation request

  // Function to show checking state
  const showCheckingState = () => {
    cleanupValidationFeedback(projectNameInput, "result"); // Only remove result feedback
    showValidationFeedback(
      projectNameInput,
      "checking",
      '<i class="fas fa-spinner fa-spin"></i> Checking...',
      "checking"
    );
  };

  // Function to show result state
  const showResultState = (type, message) => {
    cleanupValidationFeedback(projectNameInput, "checking"); // Remove checking feedback
    cleanupValidationFeedback(projectNameInput, "result"); // Remove previous result
    showValidationFeedback(projectNameInput, type, message, "result");
    projectNameInput.style.borderColor =
      type === "error" ? "#ff6b6b" : "#00ff9d";
  };

  // Function to show info state
  const showInfoState = (message) => {
    cleanupValidationFeedback(projectNameInput, "all"); // Remove all feedback
    showValidationFeedback(projectNameInput, "info", message, "info");
    projectNameInput.style.borderColor = "";
  };

  projectNameInput.addEventListener("input", function () {
    const name = this.value.trim();
    const validationId = ++currentValidationId; // Get unique ID for this validation

    // Update input class for visual feedback
    this.classList.remove("valid", "invalid", "validating");

    if (name.length >= 3) {
      this.classList.add("validating");
    }

    // Abort previous request if still pending
    if (currentAbortController) {
      currentAbortController.abort();
    }

    clearTimeout(validationTimeout);

    // Reset border
    this.style.borderColor = "";

    if (name.length < 3) {
      showInfoState(
        '<i class="fas fa-info-circle"></i> Enter at least 3 characters'
      );
      return;
    }

    if (name.length > 100) {
      showInfoState('<i class="fas fa-info-circle"></i> Name is too long');
      return;
    }

    // Show checking state immediately for better UX
    showCheckingState();

    validationTimeout = setTimeout(async () => {
      // Check if this validation is still relevant (user hasn't typed more)
      if (validationId !== currentValidationId) {
        console.log("Skipping outdated validation request");
        return;
      }

      isChecking = true;

      // Create new AbortController for this request
      currentAbortController = new AbortController();

      try {
        // Use SERVER API for reliable duplicate checking
        const response = await fetch(
          `/api/projects/check-duplicate/?name=${encodeURIComponent(name)}`,
          {
            signal: currentAbortController.signal,
          }
        );

        // Check if this validation is still relevant
        if (validationId !== currentValidationId) {
          console.log("Response received but validation outdated");
          return;
        }

        const result = await response.json();

        isChecking = false;
        currentAbortController = null;

        if (result.exists) {
          console.log(
            `🚨 SERVER VALIDATION: Found duplicate "${result.project_name}"`
          );
          showResultState(
            "error",
            `<i class="fas fa-exclamation-triangle"></i> You already have "${result.project_name}"`
          );
          projectNameInput.classList.remove("validating");
          projectNameInput.classList.add("invalid");
        } else {
          showResultState(
            "success",
            '<i class="fas fa-check-circle"></i> Available'
          );
          projectNameInput.classList.remove("validating");
          projectNameInput.classList.add("valid");
        }
      } catch (error) {
        if (error.name === "AbortError") {
          console.log("Validation request aborted - user is typing");
          return;
        }

        console.error("Validation error:", error);

        // Check if this validation is still relevant
        if (validationId !== currentValidationId) {
          return;
        }

        isChecking = false;
        currentAbortController = null;

        // Fallback to local check
        const duplicateCheck = checkForDuplicateProjectSync(name);
        if (duplicateCheck.exists) {
          showResultState(
            "error",
            `<i class="fas fa-exclamation-triangle"></i> You already have "${duplicateCheck.project.name}"`
          );
        } else {
          // Show neutral state on network error
          showResultState(
            "info",
            '<i class="fas fa-info-circle"></i> Name looks good'
          );
        }
      }
    }, 600); // Reduced to 600ms for faster feedback
  });

  // Also validate on blur (when user clicks away)
  projectNameInput.addEventListener("blur", function () {
    const name = this.value.trim();
    if (name.length >= 3) {
      // Trigger validation one more time on blur
      this.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });
}

// Updated helper functions
function cleanupValidationFeedback(inputElement, type = "all") {
  const feedbacks = inputElement.parentNode.querySelectorAll(
    ".validation-feedback"
  );

  feedbacks.forEach((feedback) => {
    const feedbackType = feedback.dataset.feedbackType;

    if (type === "all") {
      feedback.remove();
    } else if (feedbackType === type) {
      feedback.remove();
    }
  });
}

function showValidationFeedback(inputElement, feedbackType, message, dataType) {
  // Remove existing feedback of this type
  cleanupValidationFeedback(inputElement, dataType);

  const feedbackDiv = document.createElement("div");
  feedbackDiv.className = `validation-feedback validation-${feedbackType}`;
  feedbackDiv.dataset.feedbackType = dataType;
  feedbackDiv.innerHTML = message;

  let styles = {
    fontSize: "12px",
    marginTop: "5px",
    marginBottom: "5px",
    display: "flex",
    alignItems: "center",
    gap: "5px",
    animation: "fadeIn 0.3s ease",
  };

  // Add type-specific styles
  switch (feedbackType) {
    case "info":
      styles.color = "#888";
      break;
    case "checking":
      styles.color = "#888";
      styles.fontStyle = "italic";
      break;
    case "error":
      styles.color = "#ff6b6b";
      styles.fontWeight = "600";
      break;
    case "success":
      styles.color = "#00ff9d";
      break;
  }

  // Apply styles
  Object.assign(feedbackDiv.style, styles);

  inputElement.parentNode.appendChild(feedbackDiv);
}

// function setupRealTimeValidation() {
//   cleanupValidation(); // Clean up first

//   const projectNameInput = document.getElementById('projectName');
//   if (!projectNameInput) {
//     console.log('⚠️ No project name input found');
//     return;
//   }
  
//   console.log('✅ Setting up REAL-TIME validation with server checks');
  
//   // ⭐⭐ CRITICAL: Remove existing event listeners first ⭐⭐
//   const newInput = projectNameInput.cloneNode(true);
//   projectNameInput.parentNode.replaceChild(newInput, projectNameInput);
  
//   const input = document.getElementById('projectName');
//   if (!input) return;
  
//   let validationTimeout;
//   let isChecking = false;
  
//   // Clear any existing feedback before adding new
//   const existingFeedback = input.parentNode.querySelector('.validation-feedback');
//   if (existingFeedback) {
//     existingFeedback.remove();
//   }
  
//   input.addEventListener('input', function() {
//     const now = Date.now();
//     if (now - lastValidationTime < VALIDATION_DEBOUCE_MS) {
//       clearTimeout(validationTimeout);
//       return;
//     }

//     clearTimeout(validationTimeout);
    
//     const name = this.value.trim();
    
//     // Remove previous feedback
//     const oldFeedback = this.parentNode.querySelector('.validation-feedback');
//     if (oldFeedback) oldFeedback.remove();
    
//     // Reset border
//     this.style.borderColor = '';
    
//     if (name.length < 3) {
//       // Show neutral state for short names
//       const neutralDiv = document.createElement('div');
//       neutralDiv.className = 'validation-feedback';
//       neutralDiv.innerHTML = '<i class="fas fa-info-circle"></i> Enter at least 3 characters';
//       neutralDiv.style.cssText = `
//         font-size: 12px;
//         margin-top: 5px;
//         margin-bottom: 5px;
//         color: #888;
//       `;
//       this.parentNode.appendChild(neutralDiv);
//       return;
//     }
    
//     if (isChecking) return; // Don't start another check if one is in progress
    
//     // Create checking feedback
//     const checkingDiv = document.createElement('div');
//     checkingDiv.className = 'validation-feedback';
//     checkingDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking with server...';
//     checkingDiv.style.cssText = `
//       font-size: 12px;
//       margin-top: 5px;
//       margin-bottom: 5px;
//       color: #888;
//     `;
//     this.parentNode.appendChild(checkingDiv);
    
//     isChecking = true;
    
//     validationTimeout = setTimeout(async () => {
//       lastValidationTime = Date.now(); // Update last validation time
//       try {
//         // Use SERVER API for reliable duplicate checking
//         const response = await fetch(`/api/projects/check-duplicate/?name=${encodeURIComponent(name)}`);
//         const result = await response.json();
        
//         // Remove checking message
//         checkingDiv.remove();
//         isChecking = false;
        
//         if (result.exists) {
//           console.log(`🚨 SERVER VALIDATION: Found duplicate "${result.project_name}"`);
//           // Show error
//           this.style.borderColor = '#ff6b6b';
//           const errorDiv = document.createElement('div');
//           errorDiv.className = 'validation-feedback';
//           errorDiv.innerHTML = `<i class="fas fa-exclamation-triangle"></i> You already have "${result.project_name}"`;
//           errorDiv.style.cssText = `
//             font-size: 12px;
//             margin-top: 5px;
//             margin-bottom: 5px;
//             color: #ff6b6b;
//             font-weight: 600;
//           `;
//           this.parentNode.appendChild(errorDiv);
//         } else {
//           // Show success
//           this.style.borderColor = '#00ff9d';
//           const successDiv = document.createElement('div');
//           successDiv.className = 'validation-feedback';
//           successDiv.innerHTML = '<i class="fas fa-check-circle"></i> Available';
//           successDiv.style.cssText = `
//             font-size: 12px;
//             margin-top: 5px;
//             margin-bottom: 5px;
//             color: #00ff9d;
//           `;
//           this.parentNode.appendChild(successDiv);
//         }
//       } catch (error) {
//         console.error('Validation error:', error);
//         checkingDiv.remove();
//         isChecking = false;
        
//         // Fallback to local check
//         const duplicateCheck = checkForDuplicateProjectSync(name);
//         if (duplicateCheck.exists) {
//           this.style.borderColor = '#ff6b6b';
//           const errorDiv = document.createElement('div');
//           errorDiv.className = 'validation-feedback';
//           errorDiv.innerHTML = `<i class="fas fa-exclamation-triangle"></i> You already have "${duplicateCheck.project.name}"`;
//           errorDiv.style.cssText = `
//             font-size: 12px;
//             margin-top: 5px;
//             margin-bottom: 5px;
//             color: #ff6b6b;
//           `;
//           this.parentNode.appendChild(errorDiv);
//         }
//       }
//     }, 800); // Wait 800ms after typing stops
//   });
// }

async function checkForDuplicateProject(projectName) {
  if (!projectName || projectName.trim().length < 3) {
    return { exists: false };
  }

  const normalizedName = projectName.toLowerCase().trim();
  console.log(`🔍 Checking: "${projectName}" -> "${normalizedName}"`);

  // =============================================
  // METHOD 1: SERVER API CHECK (MOST RELIABLE)
  // =============================================
  try {
    console.log("📡 Checking server for duplicates...");
    const response = await fetch(
      `/api/projects/check-duplicate/?name=${encodeURIComponent(projectName)}`
    );
    const result = await response.json();

    if (result.exists) {
      console.log(`✅ SERVER FOUND DUPLICATE: ${result.project_name}`);
      return {
        exists: true,
        project: {
          id: result.project_id,
          name: result.project_name,
          created_at: result.created_at,
        },
        name: projectName,
        source: "server",
        serverResponse: result,
      };
    }
  } catch (error) {
    console.log("⚠️ Server check failed, falling back to local checks");
  }

  // =============================================
  // METHOD 2: CHECK VISIBLE PROJECTS (if on dashboard)
  // =============================================
  const projectCards = document.querySelectorAll(
    ".pinned-project[data-project-id] h4"
  );
  console.log(`Found ${projectCards.length} project cards on page`);

  for (const card of projectCards) {
    const cardName = card.textContent.trim();
    if (cardName.toLowerCase() === normalizedName) {
      const projectCard = card.closest(".pinned-project");
      const projectId = projectCard.getAttribute("data-project-id");

      console.log(`✅ FOUND ON PAGE: "${cardName}" (ID: ${projectId})`);
      return {
        exists: true,
        project: {
          id: projectId,
          name: cardName,
        },
        name: projectName,
        source: "page",
      };
    }
  }

  // =============================================
  // METHOD 3: CHECK CACHED DATA (if available)
  // =============================================
  if (
    AppState.cachedData &&
    AppState.cachedData.projects &&
    AppState.cachedData.projects.length > 0
  ) {
    console.log(
      `Checking ${AppState.cachedData.projects.length} cached projects`
    );

    for (const project of AppState.cachedData.projects) {
      if (
        project.name &&
        project.name.toLowerCase().trim() === normalizedName
      ) {
        console.log(`✅ FOUND IN CACHE: "${project.name}" (ID: ${project.id})`);
        return {
          exists: true,
          project: project,
          name: projectName,
          source: "cache",
        };
      }
    }
  } else {
    console.log("No cached data available");
  }

  console.log(`❌ No duplicate found for "${projectName}"`);
  return { exists: false };
}

// dashboard.js - Updated showDuplicateWarning function

async function showDuplicateWarning(duplicateInfo) {
  return new Promise((resolve) => {
    // Create modal
    const modal = document.createElement("div");
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;

    const modalContent = document.createElement("div");
    modalContent.style.cssText = `
      background: #1a1a1a;
      border: 1px solid #333;
      border-radius: 12px;
      padding: 30px;
      max-width: 500px;
      width: 90%;
      color: white;
    `;

    let message = `You already have a project named <strong>"${duplicateInfo.name}"</strong>.`;

    // ALWAYS show these two options (no "Create Anyway")
    const buttons = `
      <div style="display: flex; gap: 10px; margin-top: 20px;">
        <button id="useExistingBtn" style="
          flex: 1;
          background: #00aaff;
          color: white;
          border: none;
          padding: 12px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
        ">
          <i class="fas fa-folder-open"></i> Open Existing Project
        </button>
        <button id="renameBtn" style="
          flex: 1;
          background: #444;
          color: white;
          border: 1px solid #666;
          padding: 12px;
          border-radius: 8px;
          cursor: pointer;
        ">
          <i class="fas fa-edit"></i> Choose Different Name
        </button>
      </div>
    `;

    modalContent.innerHTML = `
      <h3 style="margin-top: 0; color: #ffa500;">
        <i class="fas fa-exclamation-triangle"></i> Duplicate Project Name
      </h3>
      <p>${message}</p>
      <p style="color: #888; font-size: 14px; margin-top: 10px;">
        <i class="fas fa-info-circle"></i> Project names must be unique.
      </p>
      ${buttons}
    `;

    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    // Handle button clicks
    const projectId =
      duplicateInfo.project?.id ||
      duplicateInfo.serverResponse?.duplicate_project_id;

    document.getElementById("useExistingBtn").onclick = () => {
      modal.remove();
      if (projectId) {
        openProjectDetails(projectId, duplicateInfo.name);
      }
      resolve(false);
    };

    document.getElementById("renameBtn").onclick = () => {
      modal.remove();
      // Focus back on the project name field
      const nameInput = document.getElementById("projectName");
      if (nameInput) {
        nameInput.focus();
        nameInput.select();
      }
      resolve(false);
    };

    // Close on background click
    modal.onclick = (e) => {
      if (e.target === modal) {
        modal.remove();
        resolve(false);
      }
    };

    // Close on Escape key
    const closeOnEscape = (e) => {
      if (e.key === "Escape") {
        modal.remove();
        document.removeEventListener("keydown", closeOnEscape);
        resolve(false);
      }
    };
    document.addEventListener("keydown", closeOnEscape);
  });
}

// =============================================
// SIMPLE SYNC VERSION (for form submission)
// =============================================

function checkForDuplicateProjectSync(projectName) {
  if (!projectName || projectName.trim().length < 3) {
    return { exists: false };
  }

  const normalizedName = projectName.toLowerCase().trim();
  
  // Quick check: Look for exact matches in visible text
  const allText = document.body.textContent.toLowerCase();
  if (allText.includes(normalizedName)) {
    // This is a basic check - we found the text somewhere on page
    console.log(`⚠️ Text "${normalizedName}" found somewhere on page`);
    
    // Try to find which project it belongs to
    const projectCards = document.querySelectorAll('.pinned-project[data-project-id] h4');
    for (const card of projectCards) {
      const cardName = card.textContent.trim();
      if (cardName.toLowerCase() === normalizedName) {
        return {
          exists: true,
          project: { name: cardName },
          name: projectName
        };
      }
    }
  }
  
  return { exists: false };
}

// dashboard.js - Add a cleanup function

function cleanupValidation() {
  const projectNameInput = document.getElementById('projectName');
  if (!projectNameInput) return;
  
  // Remove all validation feedback elements
  document.querySelectorAll('.validation-feedback').forEach(el => {
    el.remove();
  });
  
  // Reset input styles
  projectNameInput.style.borderColor = '';
  projectNameInput.style.boxShadow = '';
  
  console.log('🧹 Cleaned up previous validation');
}

// =============================================
// EMERGENCY: Reset all buttons function
// =============================================

function resetAllButtons() {
  console.log("🔄 EMERGENCY: Resetting all buttons...");
  
  // Reset ALL buttons on the page
  document.querySelectorAll('button').forEach(btn => {
    btn.disabled = false;
    
    // Fix submit buttons
    if (btn.type === 'submit' || btn.classList.contains('submit-btn')) {
      btn.innerHTML = btn.innerHTML
        .replace('Creating...', 'Create Project')
        .replace('Checking...', 'Create Project')
        .replace('<i class="fas fa-spinner fa-spin"></i>', '<i class="fas fa-plus-circle"></i>');
    }
  });
  
  // Reset global flags
  window.isProjectSubmitting = false;
  window.lastProjectSubmitTime = 0;
  
  console.log("✅ All buttons reset");
  showNotification("All buttons have been reset", "success");
}

// Add emergency button if not exists
if (!document.getElementById('emergencyResetBtn')) {
  const emergencyBtn = document.createElement('button');
  emergencyBtn.id = 'emergencyResetBtn';
  emergencyBtn.innerHTML = '🔄 Reset Stuck Buttons';
  emergencyBtn.style.cssText = `
    position: fixed;
    bottom: 60px;
    left: 20px;
    background: #ff4757;
    color: white;
    border: none;
    padding: 10px 15px;
    border-radius: 8px;
    z-index: 9999;
    font-weight: bold;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(255, 71, 87, 0.4);
  `;
  emergencyBtn.onclick = resetAllButtons;
  document.body.appendChild(emergencyBtn);
}

// =============================================
// DEBUG: Add test functions
// =============================================

function testValidation() {
  const projectNameInput = document.getElementById('projectName');
  if (!projectNameInput) {
    alert('No project name input found');
    return;
  }
  
  const testName = prompt('Enter project name to test:');
  if (!testName) return;
  
  projectNameInput.value = testName;
  projectNameInput.dispatchEvent(new Event('input'));
  
  setTimeout(() => {
    const result = checkForDuplicateProjectSync(testName);
    alert(`Test result for "${testName}":\nExists: ${result.exists}\nFound: ${result.project?.name || 'none'}`);
  }, 1000);
}

function testButtonReset() {
  const submitBtn = document.querySelector('.submit-btn');
  if (!submitBtn) {
    alert('No submit button found');
    return;
  }
  
  console.log('Before reset:', {
    innerHTML: submitBtn.innerHTML,
    disabled: submitBtn.disabled
  });
  
  submitBtn.disabled = false;
  submitBtn.innerHTML = '<i class="fas fa-plus-circle"></i> Create Project';
  
  console.log('After reset:', {
    innerHTML: submitBtn.innerHTML,
    disabled: submitBtn.disabled
  });
  
  alert('Button reset!');
}

// Add test buttons
if (!document.getElementById('testValidationBtn')) {
  const testBtn = document.createElement('button');
  testBtn.id = 'testValidationBtn';
  testBtn.innerHTML = '🧪 Test Validation';
  testBtn.style.cssText = `
    position: fixed;
    bottom: 100px;
    left: 20px;
    background: #00aaff;
    color: white;
    border: none;
    padding: 10px 15px;
    border-radius: 8px;
    z-index: 9999;
    cursor: pointer;
  `;
  testBtn.onclick = testValidation;
  document.body.appendChild(testBtn);
}

if (!document.getElementById('testButtonResetBtn')) {
  const testBtn2 = document.createElement('button');
  testBtn2.id = 'testButtonResetBtn';
  testBtn2.innerHTML = '🔧 Test Button Reset';
  testBtn2.style.cssText = `
    position: fixed;
    bottom: 140px;
    left: 20px;
    background: #00ff9d;
    color: black;
    border: none;
    padding: 10px 15px;
    border-radius: 8px;
    z-index: 9999;
    cursor: pointer;
  `;
  testBtn2.onclick = testButtonReset;
  document.body.appendChild(testBtn2);
}

// Add this function to dashboard.js
async function refreshProjectList() {
  console.log("🔄 Refreshing project list...");
  try {
    // Fetch latest projects
    const response = await fetch("/api/projects/all/");
    const data = await response.json();
    
    if (data.success) {
      // Update AppState with ALL projects (not just pinned)
      AppState.cachedData.all_projects = data.projects;
      
      // Also update pinned projects (first 4)
      AppState.cachedData.projects = data.projects.slice(0, 4);
      AppState.cachedData.total_projects = data.total_projects;
      
      // Update the UI
      updatePinnedProjectsFromCache();
      console.log("✅ Project list refreshed");
    }
  } catch (error) {
    console.error("Error refreshing project list:", error);
  }
}

function testModalTrigger() {
  // Test 1: Check if checkForDuplicateProject works
  console.log("🔍 Testing duplicate check...");
  const testName = prompt("Enter project name to test:");

  if (!testName) return;

  checkForDuplicateProject(testName).then((result) => {
    console.log("Result:", result);

    if (result.exists) {
      console.log("✅ Duplicate found! Testing modal...");
      showDuplicateWarning(result).then((choice) => {
        alert(`User chose: ${choice ? "Continue" : "Cancel"}`);
      });
    } else {
      alert("No duplicate found");
    }
  });
}

// Add test button
document.body.innerHTML += `
  <button onclick="testModalTrigger()" style="
    position: fixed;
    bottom: 180px;
    right: 20px;
    background: #ff9900;
    color: black;
    border: none;
    padding: 10px;
    border-radius: 5px;
    z-index: 9999;
  ">
    Test Modal
  </button>
`;

// Add debug logging to see what's happening
function debugValidation() {
  console.group('🔍 Debug Validation');
  
  // Check what elements exist
  const projectNameInput = document.getElementById('projectName');
  console.log('Input element exists?', !!projectNameInput);
  
  if (projectNameInput) {
    console.log('Input value:', projectNameInput.value);
    console.log('Input parent:', projectNameInput.parentNode);
  }
  
  // Check cached data
  console.log('AppState.cachedData:', AppState.cachedData);
  console.log('Cached projects:', AppState.cachedData?.projects);
  
  // Test duplicate check
  const testName = 'Test Project'; // Use a name you know exists
  console.log(`Testing with: "${testName}"`);
  
  checkForDuplicateProject(testName).then(result => {
    console.log('Check result:', result);
  });
  
  console.groupEnd();
}

// Run this in browser console after loading form

function debugDuplicateCheck(projectName) {
  console.group('🔍 Debug Duplicate Check');
  console.log('Checking for:', projectName);
  console.log('Normalized:', projectName.toLowerCase().trim());
  
  // Check cached data
  if (AppState.cachedData && AppState.cachedData.projects) {
    console.log('Cached projects:', AppState.cachedData.projects);
    console.log('Cached project names:', AppState.cachedData.projects.map(p => p.name));
    
    AppState.cachedData.projects.forEach((project, index) => {
      const cachedNormalized = project.name.toLowerCase().trim();
      const inputNormalized = projectName.toLowerCase().trim();
      console.log(`Project ${index}: "${project.name}" -> "${cachedNormalized}"`);
      console.log(`Matches "${inputNormalized}"?`, cachedNormalized === inputNormalized);
    });
  } else {
    console.log('No cached data found');
  }
  
  console.groupEnd();
  
  return checkForDuplicateProject(projectName);
}

// Test it in browser console:
// debugDuplicateCheck("My Existing Project Name");

function initializeTaskForm() {
  const projectSelect = document.getElementById("taskProject");
  if (!projectSelect) return;

  // Remove duplicates on the frontend
  const options = projectSelect.options;
  const seenProjects = new Map(); // Use Map to track seen projects

  // First pass: collect unique projects
  for (let i = 0; i < options.length; i++) {
    const option = options[i];
    const text = option.text.trim();
    const value = option.value;

    // Skip placeholder
    if (value === "") continue;

    // If we've seen this project name before, keep the one with the highest value (assuming newer IDs)
    if (seenProjects.has(text)) {
      const existingValue = seenProjects.get(text);
      // Keep the option with the higher ID (assuming newer)
      if (parseInt(value) > parseInt(existingValue)) {
        seenProjects.set(text, value);
      }
    } else {
      seenProjects.set(text, value);
    }
  }

  // Clear the dropdown (keep placeholder)
  projectSelect.innerHTML = '<option value="">Select a project</option>';

  // Add unique projects back
  seenProjects.forEach((value, text) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = text;
    projectSelect.appendChild(option);
  });

  // Make dropdown scrollable
  projectSelect.size = Math.min(10, seenProjects.size + 1); // Show up to 10 items
  projectSelect.style.overflowY = "auto";
  projectSelect.style.maxHeight = "200px";

  // Add search functionality
  addProjectSearch();
}

function addProjectSearch() {
  const projectSelect = document.getElementById("taskProject");
  if (!projectSelect) return;

  // Create search input
  const searchDiv = document.createElement("div");
  searchDiv.className = "project-search-wrapper";
  searchDiv.innerHTML = `
        <div class="project-search">
            <i class="fas fa-search"></i>
            <input type="text" id="projectSearchInput" 
                   placeholder="Type to filter projects..." 
                   style="width: 100%; padding: 8px 12px 8px 36px; 
                          background: rgba(20, 20, 25, 0.9); 
                          border: 1px solid rgba(255,255,255,0.1);
                          border-radius: 6px; color: #fff; font-size: 14px;">
        </div>
    `;

  // Insert before the select
  projectSelect.parentNode.insertBefore(searchDiv, projectSelect);

  // Add search functionality
  const searchInput = document.getElementById("projectSearchInput");
  searchInput.addEventListener("input", function () {
    const searchTerm = this.value.toLowerCase();
    const options = projectSelect.options;

    for (let i = 0; i < options.length; i++) {
      const option = options[i];
      const text = option.text.toLowerCase();
      option.style.display = text.includes(searchTerm) ? "block" : "none";

      // Always show placeholder
      if (option.value === "") {
        option.style.display = "block";
      }
    }
  });
}

// =============================================
// PROJECT FUNCTIONS
// =============================================

// Function to open project details
async function openProjectDetails(projectId, projectName) {
  console.log(`🏗️ Opening project ${projectId}: ${projectName}`);

  // Check if projectId is valid
  if (!projectId || projectId === "null" || projectId === "undefined") {
    console.error("❌ Invalid project ID:", projectId);
    showNotification("Please create a project first.", "info");
    showNewProjectForm();
    return;
  }

  showLoader();

  try {
    // Fetch project data from API
    const response = await fetch(`/api/projects/${projectId}/`);

    // Check if response is JSON
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      throw new Error(
        "API returned HTML instead of JSON. Check the API endpoint."
      );
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || "Failed to load project");
    }

    // Create project details page
    const mainContent = document.getElementById("mainContent");
    if (!mainContent) return;

    // Simple project details HTML
    const html = `
    <div class="simple-project-details">
      <div class="project-header">
        <button class="qa-btn back-btn" onclick="restoreDashboard()">
          <i class="fa fa-arrow-left"></i> Back to Dashboard
        </button>
        <div class="project-title-section">
          <h1>${data.project.name}</h1>
          <div class="project-meta">
            <span>Owned by ${data.project.owner.name}</span>
            <span>• Created ${new Date(
              data.project.created_at
            ).toLocaleDateString()}</span>
          </div>
        </div>
        <div class="project-actions">
          <button class="icon-btn" onclick="editProject(${projectId})" title="Edit Project">
            <i class="fa fa-edit"></i>
          </button>
          <button class="icon-btn" onclick="addTaskToProject(${projectId})" title="Add Task">
            <i class="fa fa-plus"></i>
          </button>
        </div>
      </div>
      
      <div class="project-progress-section">
        <div class="progress-header">
          <h3>Progress</h3>
          <div class="progress-percent">${data.stats.progress}%</div>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${
            data.stats.progress
          }%"></div>
        </div>
        <div class="progress-stats">
          <div class="stat">
            <div class="stat-number">${data.stats.completed_tasks}</div>
            <div class="stat-label">Completed</div>
          </div>
          <div class="stat">
            <div class="stat-number">${data.stats.total_tasks}</div>
            <div class="stat-label">Total Tasks</div>
          </div>
          <div class="stat">
            <div class="stat-number">${data.stats.overdue_tasks}</div>
            <div class="stat-label">Overdue</div>
          </div>
        </div>
      </div>
      
      <div class="project-description-section">
        <h3>Description</h3>
        <div class="description-content">
          ${
            data.project.description ||
            '<em style="color: #888;">No description provided</em>'
          }
        </div>
      </div>
      
      <div class="project-tasks-section">
        <div class="tasks-header">
          <h3>Tasks (${data.stats.total_tasks})</h3>
          <button class="qa-btn" onclick="addTaskToProject(${projectId})">
            <i class="fa fa-plus"></i> Add Task
          </button>
        </div>
        
        <div class="task-filters">
          <button class="filter-btn active" onclick="filterTasks('all', ${projectId})">All</button>
          <button class="filter-btn" onclick="filterTasks('todo', ${projectId})">To Do</button>
          <button class="filter-btn" onclick="filterTasks('inprogress', ${projectId})">In Progress</button>
          <button class="filter-btn" onclick="filterTasks('review', ${projectId})">Review</button>
          <button class="filter-btn" onclick="filterTasks('done', ${projectId})">Done</button>
        </div>
        
        <div class="tasks-grid" id="tasksGrid-${projectId}">
          ${renderTasksGrid(data.tasks, projectId)}
        </div>
      </div>
      
      <div class="project-team-section">
        <h3>Team Members (${data.team.length})</h3>
        <div class="team-grid">
          ${renderTeamMembers(data.team)}
        </div>
      </div>
    </div>
    `;

    mainContent.innerHTML = html;

    // Update state
    AppState.currentPage = "project-details";
    updateSidebarActive("");
    localStorage.setItem("swyfttask-page", `project-${projectId}`);
    history.pushState(
      { page: "project-details", projectId: projectId },
      "",
      `#project-${projectId}`
    );

    // Stop auto-refresh when not on dashboard
    stopAutoRefresh();
  } catch (error) {
    console.error("❌ Error loading project:", error);
    showNotification(`Failed to load project: ${error.message}`, "error");
    restoreDashboard();
  }

  hideLoader();
}

// Helper function to render tasks grid
function renderTasksGrid(tasksByStatus, projectId) {
  const allTasks = [
    ...(tasksByStatus.todo || []),
    ...(tasksByStatus.inprogress || []),
    ...(tasksByStatus.review || []),
    ...(tasksByStatus.done || []),
  ];

  if (allTasks.length === 0) {
    return `
    <div class="no-tasks">
      <i class="fas fa-clipboard-list" style="font-size: 48px; color: #666; margin-bottom: 16px;"></i>
      <h4>No tasks yet</h4>
      <p>Create your first task for this project</p>
      <button class="qa-btn" onclick="addTaskToProject(${projectId})" style="margin-top: 16px;">
        <i class="fa fa-plus"></i> Create First Task
      </button>
    </div>
    `;
  }

  return allTasks
    .map((task) => {
      const title = task.title.replace(/'/g, "\\'").replace(/"/g, '\\"');
      return `
    <div class="task-card" data-task-id="${task.id}" data-status="${
        task.status
      }" onclick="openTaskDetails(${task.id}, '${title}')">
      <div class="task-card-header">
        <div class="task-status status-${task.status}">${
        task.status_display || task.status
      }</div>
        <div class="task-priority priority-${task.priority}">${
        task.priority
      }</div>
      </div>
      <div class="task-card-body">
        <h4>${task.title}</h4>
        <p class="task-description">${task.description || "No description"}</p>
      </div>
      <div class="task-card-footer">
        <div class="task-assignee">
          ${
            task.assigned_to
              ? `<div class="assignee-avatar" title="${
                  task.assigned_to.name || task.assigned_to.username
                }">
              ${task.assigned_to.initial || "?"}
            </div>`
              : '<span class="unassigned">Unassigned</span>'
          }
        </div>
        <div class="task-due-date ${
          task.due_date
            ? new Date(task.due_date) < new Date()
              ? "overdue"
              : ""
            : ""
        }">
          ${task.due_date_display || "No deadline"}
        </div>
      </div>
    </div>
    `;
    })
    .join("");
}

// Helper function to render team members
function renderTeamMembers(team) {
  return team
    .map(
      (member) => `
    <div class="team-member-card">
      <div class="member-avatar ${member.is_owner ? "owner" : ""}">
        ${member.initial}
        ${
          member.is_owner
            ? '<span class="owner-badge" title="Project Owner">👑</span>'
            : ""
        }
      </div>
      <div class="member-info">
        <h4>${member.name}</h4>
        <p class="member-role">${member.is_owner ? "Owner" : "Member"}</p>
        <p class="member-stats">${member.task_count} tasks • ${
        member.completed_tasks
      } completed</p>
      </div>
    </div>
  `
    )
    .join("");
}

// Function to show project context menu
function showProjectContextMenu(event, projectId) {
  event.stopPropagation();
  event.preventDefault();

  // Remove any existing context menus
  const existingMenus = document.querySelectorAll(".context-menu");
  existingMenus.forEach((menu) => menu.remove());

  // Create context menu
  const menu = document.createElement("div");
  menu.className = "context-menu";
  menu.style.cssText = `
    position: fixed;
    background: rgba(20, 20, 30, 0.98);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 8px 0;
    min-width: 180px;
    z-index: 10000;
    backdrop-filter: blur(20px);
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  `;

  // Get position
  const x = event.clientX;
  const y = event.clientY;

  menu.style.left = `${Math.min(x, window.innerWidth - 200)}px`;
  menu.style.top = `${Math.min(y, window.innerHeight - 200)}px`;

  menu.innerHTML = `
    <button class="menu-item" onclick="openProjectDetails(${projectId}, 'Project')">
      <i class="fas fa-eye"></i> View Project
    </button>
    <button class="menu-item" onclick="editProject(${projectId})">
      <i class="fas fa-edit"></i> Edit Project
    </button>
    <button class="menu-item" onclick="addTaskToProject(${projectId})">
      <i class="fas fa-plus"></i> Add Task
    </button>
    <button class="menu-item" onclick="inviteToProject(${projectId})">
      <i class="fas fa-user-plus"></i> Invite Members
    </button>
    <hr>
    <button class="menu-item delete" onclick="archiveProject(${projectId})">
      <i class="fas fa-archive"></i> Archive Project
    </button>
  `;

  // Add to document
  document.body.appendChild(menu);

  // Remove menu on click outside
  const removeMenu = (e) => {
    if (!menu.contains(e.target)) {
      menu.remove();
      document.removeEventListener("click", removeMenu);
    }
  };

  // Small delay to prevent immediate removal
  setTimeout(() => {
    document.addEventListener("click", removeMenu);
  }, 100);
}

// Function to show all projects
async function showAllProjects() {
  console.log("📁 Showing all projects...");
  showLoader();

  try {
    const response = await fetch("/api/projects/all/");
    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || "Failed to load projects");
    }

    // Create all projects page
    const mainContent = document.getElementById("mainContent");
    if (!mainContent) return;

    let projectsHtml;
    if (data.projects.length === 0) {
      projectsHtml = `
      <div class="all-projects-simple">
        <div class="page-header">
          <button class="qa-btn back-btn" onclick="restoreDashboard()">
            <i class="fa fa-arrow-left"></i> Back to Dashboard
          </button>
          <h1>All Projects</h1>
          <button class="qa-btn" onclick="showNewProjectForm()">
            <i class="fa fa-plus"></i> New Project
          </button>
        </div>
        
        <div class="projects-search-section">
          <div class="search-box">
            <i class="fas fa-search"></i>
            <input type="text" id="projectsSearchInput" placeholder="Search projects..." onkeyup="filterProjects(this.value)">
          </div>
        </div>
        
        <div class="projects-list" id="projectsList">
          <div class="no-projects">
            <i class="fas fa-folder-open"></i>
            <h3>No projects found</h3>
            <p>Create your first project to get started</p>
            <button class="qa-btn" onclick="showNewProjectForm()">
              <i class="fa fa-plus"></i> Create Project
            </button>
          </div>
        </div>
      </div>
      `;
    } else {
      const projectsList = data.projects
        .map((project) => {
          const name = project.name.replace(/'/g, "\\'").replace(/"/g, '\\"');
          return `
        <div class="project-list-item" onclick="openProjectDetails(${
          project.id
        }, '${name}')">
          <div class="project-item-main">
            <h3>${project.name}</h3>
            <p class="project-description">${
              project.description || "No description"
            }</p>
            <div class="project-stats">
              <span><i class="fas fa-tasks"></i> ${
                project.task_count
              } tasks</span>
              <span><i class="fas fa-users"></i> ${
                project.member_count
              } members</span>
              <span><i class="fas fa-crown"></i> ${project.owner}</span>
            </div>
          </div>
          <div class="project-item-side">
            <div class="project-progress">
              <div class="progress-circle" style="--progress: ${
                project.progress
              }%">
                <span>${project.progress}%</span>
              </div>
            </div>
            <div class="project-date">Created ${project.created_at}</div>
          </div>
        </div>
        `;
        })
        .join("");

      projectsHtml = `
      <div class="all-projects-simple">
        <div class="page-header">
          <button class="qa-btn back-btn" onclick="restoreDashboard()">
            <i class="fa fa-arrow-left"></i> Back to Dashboard
          </button>
          <h1>All Projects</h1>
          <button class="qa-btn" onclick="showNewProjectForm()">
            <i class="fa fa-plus"></i> New Project
          </button>
        </div>
        
        <div class="projects-search-section">
          <div class="search-box">
            <i class="fas fa-search"></i>
            <input type="text" id="projectsSearchInput" placeholder="Search projects..." onkeyup="filterProjects(this.value)">
          </div>
        </div>
        
        <div class="projects-list" id="projectsList">
          ${projectsList}
        </div>
      </div>
      `;
    }

    mainContent.innerHTML = projectsHtml;

    // Update state
    AppState.currentPage = "all-projects";
    updateSidebarActive("");
    localStorage.setItem("swyfttask-page", "all-projects");
    history.pushState({ page: "all-projects" }, "", "#all-projects");

    // Stop auto-refresh when not on dashboard
    stopAutoRefresh();
  } catch (error) {
    console.error("❌ Error loading all projects:", error);
    showNotification(`Failed to load projects: ${error.message}`, "error");
    restoreDashboard();
  }

  hideLoader();
}

function restoreDashboard() {
  console.log("🔄 Restoring dashboard...");
  hideLoader();

  // Stop any ongoing submissions
  window.isTaskSubmitting = false;
  window.isProjectSubmitting = false;

  if (!AppState.originalDashboardHTML) {
    console.error("❌ No dashboard HTML saved");
    window.location.reload();
    return;
  }

  requestAnimationFrame(() => {
    const mainContent = document.getElementById("mainContent");
    if (!mainContent) return;

    mainContent.innerHTML = `
      <div id="originalDashboardContent">
        ${AppState.originalDashboardHTML}
      </div>
    `;

    AppState.currentPage = "dashboard";
    updateSidebarActive("overview");
    localStorage.setItem("swyfttask-page", "dashboard");
    history.pushState({ page: "dashboard" }, "", "#dashboard");

    // Start auto-refresh when returning to dashboard
    startAutoRefresh();

    // After restoring HTML, load fresh data
    setTimeout(() => {
      setupEventListeners();
      setupSidebar();
      setupFormHandlers();
      // Load fresh data
      loadDashboardData(); // This now includes total_projects
    }, 100);

    // OPTIONAL: Only load fresh data if cache is stale (older than 30 seconds)
    // const cacheAge = Date.now() - (window.lastDashboardLoad || 0);
    // if (cacheAge > 30000 || !AppState.cachedData.counts) {
    //   // 30 seconds
    //   loadDashboardData();
    //   window.lastDashboardLoad = Date.now();
    // } else {
    //   // Use cached data for immediate UI update
    //   updateDashboardUI();
    //   hideLoader();
    // }

    // // Reinitialize functionality
    // setTimeout(() => {
    //   setupEventListeners();
    //   setupSidebar();
    //   setupFormHandlers();
    //   hideLoader();
    // }, 100);
  });
}

// =============================================
// UTILITY FUNCTIONS
// =============================================

function getCSRFToken() {
  const csrfInput = document.querySelector('input[name="csrfmiddlewaretoken"]');
  return csrfInput ? csrfInput.value : "";
}

function showLoader() {
  const loader = document.getElementById("pageLoader");
  if (loader) loader.classList.add("active");
}

function hideLoader() {
  const loader = document.getElementById("pageLoader");
  if (loader) {
    loader.classList.remove("active");
    // Force remove any inline styles that might be blocking
    loader.style.display = "none";
    loader.style.opacity = "0";
    loader.style.visibility = "hidden";
    loader.style.pointerEvents = "none";
  };

  // Also re-enable any disabled buttons/forms
  document.querySelectorAll('button:disabled, input:disabled, textarea:disabled').forEach(el => {
    el.disabled = false;
  });
}

function showNotification(message, type = "success") {
  // Remove existing notification
  const existingNotification = document.querySelector(".notification-toast");
  if (existingNotification) {
    existingNotification.remove();
  }

  const notification = document.createElement("div");
  notification.className = `notification-toast ${type}`;
  notification.innerHTML = `
    <div class="notification-content">
      <i class="fas fa-${
        type === "success" ? "check-circle" : "exclamation-circle"
      }"></i>
      <span>${message}</span>
    </div>
    <button class="notification-close" onclick="this.parentElement.remove()">
      <i class="fas fa-times"></i>
    </button>
  `;

  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${
      type === "success"
        ? "rgba(0,255,157,0.1)"
        : type === "error"
        ? "rgba(255,107,107,0.1)"
        : type === "info"
        ? "rgba(0,170,255,0.1)"
        : "rgba(255,255,255,0.1)"
    };
    border: 1px solid ${
      type === "success"
        ? "rgba(0,255,157,0.3)"
        : type === "error"
        ? "rgba(255,107,107,0.3)"
        : type === "info"
        ? "rgba(0,170,255,0.3)"
        : "rgba(255,255,255,0.3)"
    };
    color: ${
      type === "success"
        ? "#00ff9d"
        : type === "error"
        ? "#ff6b6b"
        : type === "info"
        ? "#00aaff"
        : "#fff"
    };
    padding: 12px 16px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    gap: 12px;
    z-index: 3000;
    backdrop-filter: blur(20px);
  `;

  document.body.appendChild(notification);

  setTimeout(() => {
    if (notification.parentNode) {
      notification.remove();
    }
  }, 5000);
}

// =============================================
// OTHER FUNCTIONS
// =============================================

function toggleSidebar() {
  const sidebar = document.getElementById("sidebar");
  if (sidebar) {
    sidebar.classList.toggle("open");
    document.body.classList.toggle("sidebar-open");
  }
}

function updateSidebarActive(page) {
  document.querySelectorAll(".aside li").forEach((li) => {
    li.classList.remove("active");
    if (li.getAttribute("data-page") === page) {
      li.classList.add("active");
    }
  });
}

function setupSidebar() {
  const sidebarItems = document.querySelectorAll(".aside li[data-page]");

  sidebarItems.forEach((item) => {
    // Remove existing listeners
    const newItem = item.cloneNode(true);
    item.parentNode.replaceChild(newItem, item);

    newItem.addEventListener("click", function () {
      const page = this.getAttribute("data-page");
      console.log(`📱 Sidebar navigation: ${page}`);

      sidebarItems.forEach((li) => li.classList.remove("active"));
      this.classList.add("active");

      switch (page) {
        case "overview":
          restoreDashboard();
          break;
        case "tasks":
          showTasksPage();
          break;
        case "teams":
          showTeamsPage();
          break;
        case "calendar":
          showCalendarPage();
          break;
        case "reports":
          showReportsPage();
          break;
        case "files":
          showFilesPage();
          break;
        case "settings":
          showSettingsPage();
          break;
        default:
          console.log(`Unknown page: ${page}`);
      }

      if (window.innerWidth <= 768) {
        document.getElementById("sidebar")?.classList.remove("open");
      }
    });
  });
}

// Stub functions
function editProject(projectId) {
  showNotification(`Edit project ${projectId} - To be implemented`, "info");
}

function addTaskToProject(projectId) {
  console.log(`Add task to project ${projectId}`);
  showNewTaskForm();
}

function inviteToProject(projectId) {
  showNotification(
    `Invite to project ${projectId} - To be implemented`,
    "info"
  );
}

function archiveProject(projectId) {
  if (confirm("Are you sure you want to archive this project?")) {
    console.log(`Archive project ${projectId}`);
    showNotification(
      `Project ${projectId} archived - To be implemented`,
      "info"
    );
  }
}

function filterProjects(searchTerm) {
  const projectItems = document.querySelectorAll(".project-list-item");
  searchTerm = searchTerm.toLowerCase();

  projectItems.forEach((item) => {
    const title = item.querySelector("h3").textContent.toLowerCase();
    const description = item
      .querySelector(".project-description")
      .textContent.toLowerCase();

    if (title.includes(searchTerm) || description.includes(searchTerm)) {
      item.style.display = "flex";
    } else {
      item.style.display = "none";
    }
  });
}

function filterTasks(filter, projectId) {
  const taskCards = document.querySelectorAll(
    `#tasksGrid-${projectId} .task-card`
  );
  const filterBtns = document.querySelectorAll(`.task-filters .filter-btn`);

  // Update active button
  filterBtns.forEach((btn) => {
    if (btn.textContent.toLowerCase().includes(filter)) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  // Show/hide tasks
  taskCards.forEach((card) => {
    if (filter === "all" || card.dataset.status === filter) {
      card.style.display = "block";
    } else {
      card.style.display = "none";
    }
  });
}

function openTaskDetails(taskId, taskTitle = "Task Details") {
  console.log(`📖 Opening task ${taskId}: ${taskTitle}`);
  showNotification(
    `Task details for ${taskTitle} (ID: ${taskId}) coming soon!`,
    "info"
  );
}

// Function to show Tasks page
async function showTasksPage() {
  console.log("📋 Showing Tasks page...");
  showLoader();
  
  try {
    // Fetch all tasks for the tasks page
    const response = await fetch('/api/dashboard/full-data/');
    const data = await response.json();
    
    if (!data.success) {
      throw new Error('Failed to load tasks');
    }
    
    // Create tasks page
    const mainContent = document.getElementById("mainContent");
    if (!mainContent) return;
    
    const template = document.getElementById("tasks-template");
    if (!template) {
      // Create fallback tasks page
      mainContent.innerHTML = createFallbackTasksPage(data);
    } else {
      mainContent.innerHTML = "";
      mainContent.appendChild(template.content.cloneNode(true));
      
      // Initialize tasks page after a delay
      setTimeout(() => {
        initializeTasksPage(data);
      }, 100);
    }
    
    // Update state
    AppState.currentPage = "tasks";
    updateSidebarActive("tasks");
    localStorage.setItem("swyfttask-page", "tasks");
    history.pushState({ page: "tasks" }, "", "#tasks");
    
    // Stop auto-refresh when not on dashboard
    stopAutoRefresh();
    
  } catch (error) {
    console.error("❌ Error loading tasks page:", error);
    showNotification(`Failed to load tasks: ${error.message}`, "error");
    restoreDashboard();
  } finally {
    hideLoader();
  }
}

// Function to initialize tasks page
function initializeTasksPage(data) {
  console.log("🔧 Initializing tasks page...");
  
  // Setup view toggles
  setupViewToggles();
  
  // Setup filter tabs
  setupFilterTabs();
  
  // Populate kanban view
  populateKanbanView(data.tasks);
  
  // Setup click handlers
  setupTasksPageHandlers();
  
  // Setup new task button
  const newTaskBtn = document.getElementById('newTaskBtnFull');
  if (newTaskBtn) {
    newTaskBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      showNewTaskForm();
    });
  }
  
  console.log("✅ Tasks page initialized");
}

// Function to populate kanban view
function populateKanbanView(tasksData) {
  const kanbanView = document.getElementById('kanbanView');
  if (!kanbanView) return;
  
  // Get all kanban columns
  const columns = kanbanView.querySelectorAll('.kanban-column');
  
  // Define column mapping
  const columnMapping = {
    'backlog': tasksData.todo || [],
    'todo': tasksData.todo || [],
    'inprogress': tasksData.inprogress || [],
    'review': tasksData.review || [],
    'done': tasksData.done || []
  };
  
  columns.forEach(column => {
    const status = column.getAttribute('data-status');
    const tasks = columnMapping[status] || [];
    const tasksContainer = column.querySelector('.column-tasks');
    const taskCount = column.querySelector('.task-count');
    
    // Update task count
    if (taskCount) {
      taskCount.textContent = tasks.length;
    }
    
    // Clear tasks container
    if (tasksContainer) {
      tasksContainer.innerHTML = '';
      
      // Add tasks
      tasks.forEach(task => {
        const taskElement = document.createElement('div');
        taskElement.className = 'task-card';
        taskElement.setAttribute('data-task-id', task.id);
        taskElement.setAttribute('draggable', 'true');
        
        // Task priority class
        const priorityClass = task.priority ? `priority-${task.priority}` : '';
        
        // Task assignee info
        let assigneeInfo = '';
        if (task.assigned_to_name) {
          assigneeInfo = `<div class="task-assignee">
            <span class="assignee-avatar">${task.assigned_to_name.charAt(0).toUpperCase()}</span>
            <small>${task.assigned_to_name}</small>
          </div>`;
        }
        
        // Task due date
        let dueDateInfo = '';
        if (task.due_date) {
          const dueDate = new Date(task.due_date);
          const today = new Date();
          const isOverdue = dueDate < today && status !== 'done';
          dueDateInfo = `<div class="task-due ${isOverdue ? 'overdue' : ''}">
            <i class="far fa-calendar"></i>
            ${dueDate.toLocaleDateString()}
          </div>`;
        }
        
        taskElement.innerHTML = `
          <div class="task-card-content">
            <div class="task-header">
              <h4>${task.title}</h4>
              <span class="task-priority ${priorityClass}">${task.priority || 'medium'}</span>
            </div>
            ${task.description ? `<p class="task-description">${task.description.substring(0, 100)}${task.description.length > 100 ? '...' : ''}</p>` : ''}
            <div class="task-footer">
              ${assigneeInfo}
              ${dueDateInfo}
            </div>
          </div>
        `;
        
        // Add click handler
        taskElement.addEventListener('click', function(e) {
          if (!e.target.closest('.task-menu-btn')) {
            openTaskDetails(task.id, task.title);
          }
        });
        
        tasksContainer.appendChild(taskElement);
      });
      
      // If no tasks, show empty state
      if (tasks.length === 0) {
        tasksContainer.innerHTML = `
          <div class="empty-column-state">
            <i class="far fa-clipboard"></i>
            <p>No tasks</p>
          </div>
        `;
      }
    }
  });
}

// Function to setup view toggles
function setupViewToggles() {
  const viewButtons = document.querySelectorAll('.view-toggle .view-btn');
  const views = document.querySelectorAll('.tasks-view');
  
  viewButtons.forEach(button => {
    button.addEventListener('click', function() {
      const viewType = this.getAttribute('data-view');
      
      // Update active button
      viewButtons.forEach(btn => btn.classList.remove('active'));
      this.classList.add('active');
      
      // Show selected view
      views.forEach(view => {
        view.classList.remove('active');
        if (view.id === `${viewType}View`) {
          view.classList.add('active');
        }
      });
    });
  });
}

// Function to setup filter tabs
function setupFilterTabs() {
  const filterTabs = document.querySelectorAll('.filter-tabs .filter-tab');
  
  filterTabs.forEach(tab => {
    tab.addEventListener('click', function() {
      const filterType = this.getAttribute('data-filter');
      
      // Update active tab
      filterTabs.forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      
      // Apply filter (you'll need to implement filtering logic)
      applyTaskFilter(filterType);
    });
  });
}

// Function to apply task filter
function applyTaskFilter(filterType) {
  console.log(`Applying filter: ${filterType}`);
  // You'll need to implement filtering logic based on your data structure
}

// Function to setup tasks page handlers
function setupTasksPageHandlers() {
  // Add task buttons in kanban columns
  document.querySelectorAll('.add-task-btn').forEach(button => {
    button.addEventListener('click', function() {
      const column = this.closest('.kanban-column');
      const status = column.getAttribute('data-status');
      showNewTaskForm(status);
    });
  });
  
  // Back button handler
  const backBtn = document.querySelector('#backDashboardBtn');
  if (backBtn) {
    backBtn.addEventListener('click', function(e) {
      e.preventDefault();
      restoreDashboard();
    });
  }
}

// Fallback tasks page creation
function createFallbackTasksPage(data) {
  return `
    <div class="page-wrapper">
      <div class="page-header">
        <div class="page-title">
          <h2>Tasks</h2>
          <p class="muted">All tasks across projects</p>
        </div>
        <div class="page-actions">
          <button class="qa-btn" onclick="showNewTaskForm()">
            <i class="fa fa-plus"></i> New Task
          </button>
        </div>
      </div>

      <div class="tasks-controls">
        <div class="filter-tabs">
          <button class="filter-tab active" data-filter="all">All</button>
          <button class="filter-tab" data-filter="my">My Tasks</button>
          <button class="filter-tab" data-filter="assigned">Assigned</button>
          <button class="filter-tab" data-filter="overdue">Overdue</button>
          <button class="filter-tab" data-filter="completed">Completed</button>
        </div>

        <div class="view-toggle">
          <button class="view-btn active" data-view="kanban"><i class="fa-solid fa-table-cells"></i></button>
          <button class="view-btn" data-view="list"><i class="fa-solid fa-list-ul"></i></button>
          <button class="view-btn" data-view="calendar"><i class="fa-solid fa-calendar-days"></i></button>
        </div>
      </div>

      <div id="kanbanView" class="tasks-view active">
        <div class="kanban-container">
          ${createKanbanColumns(data.tasks)}
        </div>
      </div>
    </div>
  `;
}

// Helper to create kanban columns
function createKanbanColumns(tasksData) {
  const columns = [
    { id: 'backlog', title: 'Backlog', tasks: tasksData.todo || [] },
    { id: 'todo', title: 'To Do', tasks: tasksData.todo || [] },
    { id: 'inprogress', title: 'In Progress', tasks: tasksData.inprogress || [] },
    { id: 'review', title: 'Review', tasks: tasksData.review || [] },
    { id: 'done', title: 'Done', tasks: tasksData.done || [] }
  ];
  
  return columns.map(column => `
    <div class="kanban-column" data-status="${column.id}">
      <div class="column-header">
        <h4>${column.title} <span class="task-count">${column.tasks.length}</span></h4>
      </div>
      <div class="column-tasks">
        ${createTaskCards(column.tasks)}
      </div>
      <button class="add-task-btn">+ Add task</button>
    </div>
  `).join('');
}

// Helper to create task cards
function createTaskCards(tasks) {
  if (tasks.length === 0) {
    return '<div class="empty-column-state"><i class="far fa-clipboard"></i><p>No tasks</p></div>';
  }
  
  return tasks.map(task => `
    <div class="task-card" data-task-id="${task.id}">
      <div class="task-card-content">
        <div class="task-header">
          <h4>${task.title}</h4>
          <span class="task-priority priority-${task.priority || 'medium'}">${task.priority || 'medium'}</span>
        </div>
        ${task.description ? `<p class="task-description">${task.description.substring(0, 100)}${task.description.length > 100 ? '...' : ''}</p>` : ''}
        <div class="task-footer">
          ${task.assigned_to_name ? `<div class="task-assignee">@${task.assigned_to_name}</div>` : ''}
          ${task.due_date ? `<div class="task-due">${new Date(task.due_date).toLocaleDateString()}</div>` : ''}
        </div>
      </div>
    </div>
  `).join('');
}

function showTeamsPage() {
  showNotification("Teams page coming soon!", "info");
}

function showCalendarPage() {
  showNotification("Calendar page coming soon!", "info");
}

function showReportsPage() {
  showNotification("Reports page coming soon!", "info");
}

function showFilesPage() {
  showNotification("Files page coming soon!", "info");
}

function showSettingsPage() {
  showNotification("Settings page coming soon!", "info");
}

// =============================================
// MAKE FUNCTIONS GLOBALLY AVAILABLE
// =============================================

// Export functions to global scope
window.restoreDashboard = restoreDashboard;
window.showNewProjectForm = showNewProjectForm;
window.showNewTaskForm = showNewTaskForm;
window.showAllProjects = showAllProjects;
window.openProjectDetails = openProjectDetails;
window.showProjectContextMenu = showProjectContextMenu;
window.filterProjects = filterProjects;
window.filterTasks = filterTasks;
window.editProject = editProject;
window.addTaskToProject = addTaskToProject;
window.inviteToProject = inviteToProject;
window.archiveProject = archiveProject;
window.openTaskDetails = openTaskDetails;

// Add this function to debug API calls
// Remove or update the testProjectAPI function to be more robust
async function testProjectAPI(projectId) {
  console.log(`🔍 Testing API for project ${projectId}...`);
  try {
    const response = await fetch(`/api/projects/${projectId}/`);
    console.log('Response status:', response.status);
    console.log('Response headers:', response.headers.get('content-type'));
    
    // Try to read as text first to see what's being returned
    const text = await response.text();
    console.log('Response text (first 500 chars):', text.substring(0, 500));
    
    // Try to parse as JSON
    try {
      const data = JSON.parse(text);
      console.log('Parsed JSON:', data);
      return data;
    } catch (jsonError) {
      console.error('Failed to parse as JSON:', jsonError);
      console.error('Response is HTML, not JSON');
      return null;
    }
  } catch (error) {
    console.error('Fetch error:', error);
    return null;
  }
}

// Add form handler functions
function updateAssigneeDropdown(projectId) {
  if (!projectId) {
    // Clear the dropdown
    const assigneeSelect = document.getElementById("taskAssignee");
    if (assigneeSelect) {
      assigneeSelect.innerHTML = `
                <option value="">Unassigned</option>
                <option value="${window.djangoData?.user?.id || ""}">${
        window.djangoData?.user?.firstName || "You"
      } (You)</option>
            `;
    }
    return;
  }

  // Fetch project members
  fetch(`/api/projects/${projectId}/members/`)
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        updateAssigneeDropdownWithMembers(data.members);
      } else {
        console.error("Failed to fetch project members:", data.error);
        // Fallback to just the current user
        updateAssigneeDropdownWithMembers([]);
      }
    })
    .catch((error) => {
      console.error("Error fetching project members:", error);
      updateAssigneeDropdownWithMembers([]);
    });
}

function updateAssigneeDropdownWithMembers(members) {
  const assigneeSelect = document.getElementById("taskAssignee");
  if (!assigneeSelect) return;

  // Clear existing options except the first one
  const currentUserOption = `<option value="${
    window.djangoData?.user?.id || ""
  }">${window.djangoData?.user?.firstName || "You"} (You)</option>`;

  // Build new options
  let options = '<option value="">Unassigned</option>' + currentUserOption;

  // Add project members (excluding current user if already added)
  members.forEach((member) => {
    if (member.id !== (window.djangoData?.user?.id || "")) {
      const displayName = member.first_name || member.username;
      options += `<option value="${member.id}">${displayName}</option>`;
    }
  });

  assigneeSelect.innerHTML = options;
}

function initializeTaskForm() {
  const projectSelect = document.getElementById("taskProject");
  if (!projectSelect) return;

  // Get current projects and remove duplicates
  const options = projectSelect.options;
  const seenProjects = new Set();
  const uniqueOptions = [];

  // Keep only unique projects
  for (let i = 0; i < options.length; i++) {
    const option = options[i];
    if (!seenProjects.has(option.text)) {
      seenProjects.add(option.text);
      uniqueOptions.push(option);
    }
  }

  // Clear and re-add unique options
  projectSelect.innerHTML = '<option value="">Select a project</option>';
  uniqueOptions.forEach((option) => {
    if (option.value !== "") {
      // Skip the placeholder
      projectSelect.appendChild(option.cloneNode(true));
    }
  });
  makeProjectDropdownSearchable();
}

function makeProjectDropdownSearchable() {
  const projectSelect = document.getElementById("taskProject");
  if (!projectSelect) return;

  // Create search wrapper
  const wrapper = document.createElement("div");
  wrapper.className = "project-search";
  wrapper.innerHTML = `
        <i class="fas fa-search"></i>
        <input type="text" id="projectSearch" placeholder="Search projects...">
    `;

  // Insert before the select
  projectSelect.parentNode.insertBefore(wrapper, projectSelect);

  // Add search functionality
  const searchInput = document.getElementById("projectSearch");
  searchInput.addEventListener("input", function () {
    const searchTerm = this.value.toLowerCase();
    const options = projectSelect.options;

    for (let i = 0; i < options.length; i++) {
      const option = options[i];
      const text = option.text.toLowerCase();
      option.style.display = text.includes(searchTerm) ? "block" : "none";
    }
  });
}

console.log("🎯 SwyftTask Dashboard with Auto-Refresh loaded successfully");

// Add to dashboard.js to check what's happening
console.log("🔍 Checking pinned projects on page load:");
const pinnedProjects = document.querySelectorAll('.pinned-project:not(.view-all-projects)');
console.log(`Found ${pinnedProjects.length} pinned project cards`);

// Check if JavaScript is adding more
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(() => {
    const afterLoad = document.querySelectorAll('.pinned-project:not(.view-all-projects)');
    console.log(`After load: ${afterLoad.length} pinned project cards`);
    
    if (afterLoad.length > 4) {
      console.warn('⚠️ JavaScript is adding extra projects!');
      // Check which function is doing this
      console.trace();
    }
  }, 1000);
});

// Add real-time validation as user types
document.addEventListener('DOMContentLoaded', function() {
  const projectNameInput = document.getElementById('projectName');
  if (projectNameInput) {
    let validationTimeout;
    
    projectNameInput.addEventListener('input', function() {
      clearTimeout(validationTimeout);
      
      validationTimeout = setTimeout(() => {
        const name = this.value.trim();
        if (name.length < 3) return;
        
        const duplicateCheck = checkForDuplicateProject(name);
        if (duplicateCheck.exists) {
          showInlineDuplicateWarning(this, duplicateCheck);
        } else {
          hideInlineDuplicateWarning(this);
        }
      }, 500); // Check after user stops typing for 500ms
    });
  }
});

function showInlineDuplicateWarning(inputElement, duplicateInfo) {
  // Remove existing warning
  hideInlineDuplicateWarning(inputElement);
  
  const warning = document.createElement('div');
  warning.className = 'duplicate-warning';
  warning.style.cssText = `
    color: #ffa500;
    font-size: 12px;
    margin-top: 5px;
    display: flex;
    align-items: center;
    gap: 5px;
  `;
  
  warning.innerHTML = `
    <i class="fas fa-exclamation-triangle"></i>
    You already have a project named "${duplicateInfo.name}"
  `;
  
  inputElement.parentNode.insertBefore(warning, inputElement.nextSibling);
  
  // Style the input to show warning
  inputElement.style.borderColor = '#ffa500';
  inputElement.style.boxShadow = '0 0 0 1px rgba(255,165,0,0.3)';
}

function hideInlineDuplicateWarning(inputElement) {
  const existingWarning = inputElement.parentNode.querySelector('.duplicate-warning');
  if (existingWarning) {
    existingWarning.remove();
  }
  
  // Reset input style
  inputElement.style.borderColor = '';
  inputElement.style.boxShadow = '';
}

// dashboard.js - Add these functions

function setupTaskForm() {
  console.log("🔧 Setting up task form...");
  
  // Setup project dropdown
  setupProjectDropdown();
  
  // Setup form submission
  const taskForm = document.getElementById('taskForm');
  if (taskForm) {
    taskForm.onsubmit = function(e) {
      e.preventDefault();
      handleTaskFormSubmit(this);
      return false;
    };
  }
  
  // Setup close button
  const closeBtn = document.querySelector('.close-form-btn');
  if (closeBtn) {
    closeBtn.onclick = function(e) {
      e.preventDefault();
      restoreDashboard();
    };
  }
  
  // Setup cancel button
  const cancelBtn = document.querySelector('.cancel-btn');
  if (cancelBtn) {
    cancelBtn.onclick = function(e) {
      e.preventDefault();
      restoreDashboard();
    };
  }
  
  console.log("✅ Task form setup complete");
}

function setupProjectDropdown() {
  console.log("🔧 Setting up project dropdown...");
  
  const customDropdown = document.getElementById('customProjectDropdown');
  const selectElement = document.getElementById('taskProject');
  const searchInput = document.getElementById('projectSearch');
  const optionsContainer = document.getElementById('projectOptions');
  const selectedText = document.getElementById('selectedProjectText');
  
  if (!customDropdown || !selectElement || !searchInput || !optionsContainer) {
    console.log("⚠️ Dropdown elements not found");
    return;
  }
  
  // Populate options from select element
  const options = Array.from(selectElement.options).slice(1); // Skip first "Select a project" option
  optionsContainer.innerHTML = '';
  
  options.forEach(option => {
    const optionDiv = document.createElement('div');
    optionDiv.className = 'dropdown-option';
    optionDiv.textContent = option.textContent;
    optionDiv.setAttribute('data-value', option.value);
    
    optionDiv.onclick = function() {
      // Update selected text
      selectedText.textContent = option.textContent;
      
      // Update hidden select element
      selectElement.value = option.value;
      
      // Trigger change event
      selectElement.dispatchEvent(new Event('change'));
      
      // Close dropdown
      customDropdown.classList.remove('open');
      
      // Highlight selected option
      document.querySelectorAll('.dropdown-option').forEach(opt => {
        opt.classList.remove('selected');
      });
      this.classList.add('selected');
    };
    
    optionsContainer.appendChild(optionDiv);
  });
  
  // Toggle dropdown
  customDropdown.querySelector('.dropdown-selected').onclick = function(e) {
    e.stopPropagation();
    customDropdown.classList.toggle('open');
    if (customDropdown.classList.contains('open')) {
      searchInput.focus();
    }
  };
  
  // Search functionality
  searchInput.addEventListener('input', function() {
    const searchTerm = this.value.toLowerCase();
    const allOptions = optionsContainer.querySelectorAll('.dropdown-option');
    
    allOptions.forEach(option => {
      const text = option.textContent.toLowerCase();
      if (text.includes(searchTerm)) {
        option.style.display = 'block';
      } else {
        option.style.display = 'none';
      }
    });
  });
  
  // Close dropdown when clicking outside
  document.addEventListener('click', function(e) {
    if (!customDropdown.contains(e.target)) {
      customDropdown.classList.remove('open');
    }
  });
  
  // Close on Escape key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && customDropdown.classList.contains('open')) {
      customDropdown.classList.remove('open');
    }
  });
  
  console.log(`✅ Project dropdown setup with ${options.length} projects`);
}