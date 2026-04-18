// =============================================
// SWYFTTASK DASHBOARD - COMPLETE AUTO-REFRESH VERSION
// =============================================

let validationSetupDone = false;
let validationControllers = new Map();
let isRefreshing = false;
let refreshQueue = [];
let lastRefreshTime = 0;
const MIN_REFRESH_INTERVAL = 2000; // 2 seconds minimum between refreshes

// Global state
const AppState = {
  originalDashboardHTML: null,
  currentPage: "dashboard",
  cachedData: {
    counts: {},
    tasks: {},
    projects: [],
    total_projects: 0,
  },
  needsRefresh: {
    dashboard: false,
    projects: false,
  },
  autoRefreshInterval: null,
  currentProjectId: null,
  currentTaskId: null,
};

// Add this function to your dashboard.js
function updateGreeting() {
  const hour = new Date().getHours();
  const userName =
    window.djangoData?.user?.firstName ||
    window.djangoData?.user?.username ||
    "";
  let greeting = "";
  let icon = "";

  if (hour >= 5 && hour < 12) {
    greeting = "Good morning";
    icon = "🌅";
  } else if (hour >= 12 && hour < 14) {
    greeting = "Good noon";
    icon = "☀️";
  } else if (hour >= 14 && hour < 17) {
    greeting = "Good afternoon";
    icon = "🌤️";
  } else if (hour >= 17 && hour < 21) {
    greeting = "Good evening";
    icon = "🌆";
  } else if (hour >= 21 && hour < 24) {
    greeting = "Good night";
    icon = "🌙";
  } else {
    greeting = "Good night";
    icon = "🌃";
  }

  const greetingElement = document.getElementById("dynamicGreeting");
  if (greetingElement) {
    greetingElement.innerHTML = `${icon} ${greeting}, ${userName}`;
  }

  return greeting;
}

// Call this function when dashboard loads
function setupGreeting() {
  updateGreeting();

  // Update greeting every minute in case user stays on page for a long time
  setInterval(updateGreeting, 60000);
}

// Global helper for managing the current project (used by modals like editProject)
window.setCurrentProject = function(project) {
  if (project && typeof project === 'object') {
    window.currentProject = project;
    console.log(`✅ Set current project: ${project.name} (ID: ${project.id})`);
  } else {
    console.warn('⚠️ Invalid project data provided to setCurrentProject');
  }
};

window.getCurrentProject = function() {
  return window.currentProject || null;
};

window.clearCurrentProject = function() {
  window.currentProject = null;
  console.log('🧹 Cleared current project');
};

// Main initialization
document.addEventListener("DOMContentLoaded", function () {
  console.log("🚀 SwyftTask Dashboard Initializing...");

  // Save original dashboard HTML
  const originalContent = document.getElementById("originalDashboardContent");
  if (originalContent) {
    AppState.originalDashboardHTML = originalContent.innerHTML;
    console.log("💾 Saved original dashboard HTML");
  }

  // Initialize all functionality
  setupAllFunctionality();

  setupActionTracking();

  // Call this in your initialization
  setupGlobalEventListeners();

  // Check URL hash for page restoration
  handleURLHash();

  console.log("✅ Dashboard initialized successfully");
});

// Add this to your dashboard.js initialization
function setupGlobalEventListeners() {
  // Fix for new task button in tasks page
  document.addEventListener("click", function (e) {
    // Check if clicked on new task button in tasks page
    if (
      e.target.id === "newTaskBtnFull" ||
      e.target.closest("#newTaskBtnFull") ||
      (e.target.classList.contains("fa-plus") &&
        e.target.closest(".page-actions"))
    ) {
      e.preventDefault();
      e.stopPropagation();
      console.log("➕ New Task button clicked (global handler)");
      showNewTaskForm();
    }

    // Check if clicked on add task button in project details
    if (
      e.target.closest('.icon-btn[title="Add Task"]') ||
      (e.target.classList.contains("fa-plus") &&
        e.target.closest(".project-actions"))
    ) {
      e.preventDefault();
      e.stopPropagation();
      const projectId = AppState.currentProjectId;
      console.log(`➕ Add Task to project ${projectId} (global handler)`);
      if (projectId) {
        showNewTaskForm();
        // Pre-select the project
        setTimeout(() => {
          const projectSelect = document.getElementById("taskProject");
          if (projectSelect) {
            projectSelect.value = projectId;
            projectSelect.dispatchEvent(new Event("change"));
          }
        }, 300);
      } else {
        showNewTaskForm();
      }
    }
  });
}

let refreshTimeout = null;
function debouncedRefresh(delay = 1000) {
  if (refreshTimeout) {
    clearTimeout(refreshTimeout);
  }

  refreshTimeout = setTimeout(() => {
    refreshDashboardData(false);
  }, delay);
}

function cleanupEventListeners() {
  // Remove all dynamically added event listeners
  document.querySelectorAll(".pinned-project").forEach((project) => {
    project.replaceWith(project.cloneNode(true));
  });

  document.querySelectorAll(".kanban-task").forEach((task) => {
    task.replaceWith(task.cloneNode(true));
  });
}

// Handle URL hash for page restoration
function handleURLHash() {
  const hash = window.location.hash;

  if (hash) {
    switch (hash) {
      case "#dashboard":
        restoreDashboard();
        break;
      case "#new-project":
        showNewProjectForm();
        break;
      case "#new-task":
        showNewTaskForm();
        break;
      case "#all-projects":
        showAllProjects();
        break;
      case "#tasks":
        showTasksPage();
        break;
      case "#notifications":
        showNotificationsPage();
        break;
      case "#settings":
        showSettingsPage();
        break;
      case "#profile":
        showProfilePage();
        break;
      default:
        if (hash.startsWith("#project-")) {
          const projectId = hash.replace("#project-", "");
          openProjectDetails(projectId, "");
        } else if (hash.startsWith("#task-")) {
          const taskId = hash.replace("#task-", "");
          openTaskDetails(taskId, "");
        } else {
          restoreDashboard();
        }
    }
  }
}

// Setup all functionality
function setupAllFunctionality() {
  console.log("🔧 Setting up all functionality...");

  setupEventListeners();
  setupSidebar();
  setupFormHandlers();
  setupTaskDragAndDrop();
  setupSearchFunctionality();
  setupGreeting();

  // Start auto-refresh if on dashboard
  if (AppState.currentPage === "dashboard") {
    startAutoRefresh();
  }

  console.log("✅ All functionality setup complete");
}

function setupActionTracking() {
  // Track all form submissions - but only for actual submissions
  document.addEventListener("submit", function (e) {
    if (e.target.matches("#taskForm, #projectForm")) {
      console.log("Form submitted via SUBMIT event, will refresh dashboard");
      // Refresh after a short delay to allow server processing
      setTimeout(() => {
        refreshDashboardData(true);
      }, 1500);
    }
  });

  // Track button clicks for major actions - but exclude form submit buttons
  document.addEventListener("click", function (e) {
    const btn = e.target.closest("button");
    if (btn && btn.type !== "submit" && !btn.classList.contains("submit-btn")) {
      const btnText = btn.textContent.toLowerCase();
      const actionsToTrack = [
        "save",
        "update",
        "delete",
        "create",
        "add",
        "remove",
      ];

      if (actionsToTrack.some((action) => btnText.includes(action))) {
        console.log("Action button clicked, will refresh dashboard");
        setTimeout(() => {
          refreshDashboardData(true);
        }, 1500);
      }
    }
  });
}

// Define the toggleDesktopSearch function
function toggleDesktopSearch() {
  const searchContainer = document.querySelector('.desktop-search-container');
  const searchInput = document.getElementById('desktopSearchInput');
  
  if (searchContainer) {
    searchContainer.classList.toggle('active');
    
    // Focus the input when opening, blur when closing
    if (searchContainer.classList.contains('active')) {
      if (searchInput) {
        setTimeout(() => searchInput.focus(), 300); // Delay to match CSS transition
      }
    } else {
      if (searchInput) {
        searchInput.blur();
      }
    }
  }
}

// Desktop search toggle event listener (this part already exists)
const desktopSearchToggle = document.getElementById("desktopSearchToggle");
if (desktopSearchToggle) {
  desktopSearchToggle.addEventListener("click", toggleDesktopSearch);
}

// =============================================
// EVENT LISTENERS
// =============================================

function setupEventListeners() {
  console.log("🔧 Setting up event listeners...");

  // Hamburger menu
  const hamburgerBtn = document.getElementById("hamburgerBtn");
  if (hamburgerBtn) {
    hamburgerBtn.addEventListener("click", toggleSidebar);
  }

  // Home button
  const homeBtn = document.getElementById("homeBtn");
  if (homeBtn) {
    homeBtn.addEventListener("click", restoreDashboard);
  }

  // Quick action buttons
  const newProjectBtn = document.getElementById("newProjectBtn");
  if (newProjectBtn) {
    newProjectBtn.addEventListener("click", showNewProjectForm);
  }

  const newTaskBtn = document.getElementById("newTaskBtn");
  if (newTaskBtn) {
    newTaskBtn.addEventListener("click", showNewTaskForm);
  }

  const inviteBtn = document.getElementById("inviteBtn");
  if (inviteBtn) {
    inviteBtn.addEventListener("click", showInviteForm);
  }

  // Desktop create button
  const createBtn = document.getElementById("createBtn");
  if (createBtn) {
    createBtn.addEventListener("click", showNewTaskForm);
  }

  // Mobile create button
  // const mobileCreateBtn = document.getElementById("newTaskBtnMobile");
  // if (mobileCreateBtn) {
  //   mobileCreateBtn.addEventListener("click", showNewTaskForm);
  // }

  // Desktop search toggle
  const desktopSearchToggle = document.getElementById("desktopSearchToggle");
  if (desktopSearchToggle) {
    desktopSearchToggle.addEventListener("click", toggleDesktopSearch);
  }

  // Account menu
  const accountBtn = document.getElementById("accountBtn");
  const accountMenu = document.getElementById("accountMenu");
  if (accountBtn && accountMenu) {
    accountBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      accountMenu.classList.toggle("show");
    });

    // Close menu when clicking outside
    document.addEventListener("click", function (e) {
      if (!accountBtn.contains(e.target) && !accountMenu.contains(e.target)) {
        accountMenu.classList.remove("show");
      }
    });

    // Setup account menu items
    setupAccountMenu();
  }

  // Project click handlers (event delegation)
  document.addEventListener("click", function (e) {
    // Pinned project cards
    const projectCard = e.target.closest(".pinned-project");
    if (projectCard && !projectCard.classList.contains("view-all-projects")) {
      e.preventDefault();
      e.stopPropagation();

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

      if (!projectId || projectId === "null" || projectId === "undefined") {
        showNotification(
          "This project cannot be opened. Please try another.",
          "error",
        );
        return;
      }

      openProjectDetails(projectId, projectName);
      return;
    }

    // View All Projects
    if (e.target.closest(".view-all-projects")) {
      e.preventDefault();
      e.stopPropagation();
      showAllProjects();
      return;
    }

    // Project menu button
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
          showProjectContextMenu(e, projectId);
        }
      }
      return;
    }

    // Task click handlers
    const taskElement = e.target.closest(
      ".kanban-task, .due-list li, .assigned-tasks li, .task-card",
    );
    if (taskElement) {
      const taskId = taskElement.getAttribute("data-task-id");
      if (taskId) {
        const taskTitle =
          taskElement.querySelector("span")?.textContent || "Task";
        openTaskDetails(taskId, taskTitle);
      }
    }
  });

  // Handle browser back/forward
  window.addEventListener("popstate", function (event) {
    handleURLHash();
  });

  console.log("✅ Event listeners setup complete");
}

function setupAccountMenu() {
  const accountMenu = document.getElementById("accountMenu");
  if (!accountMenu) return;

  const menuItems = accountMenu.querySelectorAll("li");
  menuItems.forEach((item) => {
    item.addEventListener("click", function (e) {
      e.stopPropagation();
      const text = this.textContent.trim();

      switch (text) {
        case "Profile":
          showProfilePage();
          break;
        case "Settings":
          showSettingsPage();
          break;
        case "Notifications":
          showNotificationsPage();
          break;
        case "Billing":
          showBillingPage();
          break;
        case "Team":
          showTeamsPage();
          break;
        case "Appearance":
          toggleTheme();
          break;
        case "Help & Support":
          showHelpPage();
          break;
        case "Logout":
          logoutUser();
          break;
      }

      accountMenu.classList.remove("show");
    });
  });
}

// =============================================
// AUTO-REFRESH SYSTEM
// =============================================

function startAutoRefresh() {
  if (AppState.autoRefreshInterval) {
    clearInterval(AppState.autoRefreshInterval);
  }

  // Refresh every 30 seconds when on dashboard
  AppState.autoRefreshInterval = setInterval(() => {
    if (AppState.currentPage === "dashboard") {
      const hasRecentActivity =
        Date.now() - (window.lastUserActivity || 0) < 30000;
      if (hasRecentActivity) {
        refreshDashboardData();
      }
    }
  }, 10000);

  // Track user activity
  ["mousemove", "click", "keypress", "scroll"].forEach((event) => {
    document.addEventListener(
      event,
      () => {
        window.lastUserActivity = Date.now();
      },
      { passive: true },
    );
  });

  console.log("🔄 Auto-refresh started (every 30 seconds)");
}

function stopAutoRefresh() {
  if (AppState.autoRefreshInterval) {
    clearInterval(AppState.autoRefreshInterval);
    AppState.autoRefreshInterval = null;
    console.log("⏹️ Auto-refresh stopped");
  }
}

// dashboard.js - Add efficient count updating

function updateCountsWithAnimation(counts) {
  if (!counts) return;

  const elements = {
    activeProjectsCount: "active_projects",
    tasksDueCount: "tasks_due",
    overdueCount: "overdue",
    teamCount: "team_count",
  };

  Object.entries(elements).forEach(([elementId, dataKey]) => {
    const element = document.getElementById(elementId);
    if (!element) return;

    const newValue = counts[dataKey] || 0;
    const currentValue = parseInt(element.textContent) || 0;

    if (newValue !== currentValue) {
      // Simple update without animation for performance
      element.textContent = newValue;

      // Optional: Add a subtle highlight
      element.classList.add("updated");
      setTimeout(() => element.classList.remove("updated"), 1000);
    }
  });
}

// Pause auto-refresh when tab is not visible
document.addEventListener("visibilitychange", function () {
  if (document.hidden) {
    stopAutoRefresh();
  } else {
    startAutoRefresh();
  }
});

async function refreshDashboardData(force = false) {
  const now = Date.now();
  if (isRefreshing && !force) {
    console.log("⏳ Already refreshing, skipping");
    return;
  }

  if (!force && now - lastRefreshTime < MIN_REFRESH_INTERVAL) {
    console.log("⏳ Too soon since last refresh");
    return;
  }

  isRefreshing = true;
  window.lastRefresh = now;

  try {
    console.log("🔄 Refreshing dashboard data...");

    const response = await fetch("/api/dashboard/full-data/");

    console.log("📡 Response status:", response.status);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log("📦 Response data structure:", {
      hasCounts: !!data.counts,
      hasProjects: !!data.projects,
      hasTotalProjects: data.hasOwnProperty("total_projects"),
      totalProjectsValue: data.total_projects,
    });

    if (data.success) {
      AppState.cachedData = {
        counts: data.counts || {},
        tasks: data.tasks || {},
        projects: data.projects || {},
        total_projects:
          data.total_projects || (data.projects ? data.projects.length : 0),
      };

      console.log("✅ Data refreshed and cached successfully", {
        cachedProjects: AppState.cachedData.projects.length,
        cachedTotalProjects: AppState.cachedData.total_projects,
      });

      // Update the UI only if we're on dashboard
      if (AppState.currentPage === "dashboard") {
        updateDashboardUI();
      }

      // Clear any error notifications
      hideErrorNotifications();
    } else {
      console.error("❌ API returned success: false", data.error);
      // Don't show notification for API errors (we'll handle them differently)
    }
  } catch (error) {
    console.error("❌ Refresh error details:", error);
    console.log("⚠️ Non-critical error, not showing notification");
  } finally {
    isRefreshing = false;
    console.log("🏁 Refresh completed");
  }
}

// dashboard.js - Silent refresh that never shows errors
async function silentRefreshDashboardData() {
  if (isRefreshing) return;

  isRefreshing = true;

  try {
    const response = await fetch("/api/dashboard/full-data/");

    if (response.ok) {
      const data = await response.json();

      if (data.success && AppState.currentPage === "dashboard") {
        AppState.cachedData = data;
        updateDashboardUI();
      }
    }
    // Silently ignore all errors
  } catch (error) {
    // Do nothing - silent fail
  } finally {
    isRefreshing = false;
  }
}

function hideErrorNotifications() {
  // Remove any existing error notifications
  document
    .querySelectorAll(".notification-toast.error")
    .forEach((notification) => {
      notification.remove();
    });
}

function updateCompleteDashboardUI(data) {
  if (!data) return;
  updateDashboardCounts(data.counts);
  updatePinnedProjects(data);
  updateTasksDueToday(data);
  updateKanbanBoard(data.tasks);
  updateYourTasks(data.tasks);
  updateRecentActivity(data.tasks);
  updateTeamOnline();

  console.log("✅ Complete dashboard UI updated");
  setupSearchFunctionality();
}

function updateDashboardCounts(counts) {
  if (!counts) return;

  console.log("📊 Updating dashboard counts:", counts);

  const elements = {
    activeProjectsCount: "active_projects",
    tasksDueCount: "tasks_due",
    overdueCount: "overdue",
    teamCount: "team_count",
  };

  Object.entries(elements).forEach(([id, key]) => {
    const element = document.getElementById(id);
    if (element && counts[key] !== undefined) {
      const currentValue = parseInt(element.textContent) || 0;
      const newValue = counts[key] || 0;

      if (currentValue !== newValue) {
        // Add animation for count changes
        element.style.transform = "scale(1.2)";
        element.style.color = "#00ff9d";

        setTimeout(() => {
          element.textContent = newValue;
          element.style.transform = "scale(1)";
          setTimeout(() => {
            element.style.color = "";
          }, 1000);
        }, 300);
      } else {
        element.textContent = newValue;
      }
    }
  });
}

// dashboard.js - SIMPLIFIED FIX for pinned projects update

function updatePinnedProjects(data) {
  console.log("🔍 Debug: Updating pinned projects with data:", data);

  const pinnedProjectsContainer = document.querySelector(".pinned-projects");
  if (!pinnedProjectsContainer) {
    console.log("❌ No pinned projects container found");
    return;
  }

  console.log("✅ Found pinned projects container");

  // Get projects from the data - FIXED: Use data.projects directly
  let projects = [];
  if (data && data.projects && Array.isArray(data.projects)) {
    projects = data.projects;
    console.log(`📦 Found ${projects.length} projects in data`);
  } else {
    console.log("⚠️ No project data available");
    // Show create button
    showEmptyProjectsState(pinnedProjectsContainer);
    return;
  }

  // Clear container first
  pinnedProjectsContainer.innerHTML = "";

  // If no projects, show create button
  if (projects.length === 0) {
    console.log("🆕 Showing 'Create Project' button (no projects)");
    showEmptyProjectsState(pinnedProjectsContainer);
    return;
  }

  console.log(`🎨 Rendering ${Math.min(projects.length, 4)} pinned projects`);

  // Show first 4 projects
  projects.slice(0, 4).forEach((project) => {
    const projectCard = document.createElement("div");
    projectCard.className = `pinned-project ${project.css_class || ""}`;
    projectCard.setAttribute("data-project-id", project.id);

    // Truncate long project names
    const projectName =
      project.name && project.name.length > 20
        ? project.name.substring(0, 20) + "..."
        : project.name || "Unnamed Project";

    // Ensure we have task count and progress - use fallbacks
    const taskCount = project.task_count || 0;
    const progress = project.progress || 0;

    console.log(
      `📊 Project "${projectName}": ${progress}% complete, ${taskCount} tasks`,
    );

    projectCard.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <h4>${projectName}</h4>
        <button class="project-menu-btn" 
          onclick="event.stopPropagation(); showProjectContextMenu(event, ${project.id})">
          <i class="fas fa-ellipsis-v"></i>
        </button>
      </div>
      <small>${progress}% complete • ${taskCount} task${taskCount !== 1 ? "s" : ""}</small>
      <div class="progress">
        <div class="progress-fill" style="width:${progress}%"></div>
      </div>
    `;

    // Add click event to open project
    projectCard.onclick = function (e) {
      if (!e.target.closest(".project-menu-btn")) {
        openProjectDetails(project.id, project.name || "Project");
      }
    };

    pinnedProjectsContainer.appendChild(projectCard);
  });

  // Add "View All" button if there are more than 4 projects
  // FIXED: Use data.total_projects if available, otherwise use projects.length
  const totalProjects = data.total_projects || projects.length;
  if (totalProjects > 4) {
    console.log(
      `➕ Adding "View All" button (${totalProjects} total projects)`,
    );
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

  console.log("✅ Pinned projects updated successfully");
}

function showEmptyProjectsState(container) {
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
  container.appendChild(emptyProject);
}

function updatePinnedProjectsFromCache() {
  const pinnedProjectsContainer = document.querySelector(".pinned-projects");
  if (!pinnedProjectsContainer || !AppState.cachedData.projects) return;

  const totalProjects = AppState.cachedData.total_projects || 0;
  pinnedProjectsContainer.innerHTML = "";

  const projectsToShow = AppState.cachedData.projects.slice(0, 4);

  if (projectsToShow.length === 0) {
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
    projectsToShow.forEach((project) => {
      const projectCard = document.createElement("div");
      projectCard.className = `pinned-project ${project.css_class}`;
      projectCard.setAttribute("data-project-id", project.id);

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
        <small>${project.progress}% complete • ${project.task_count} task${
          project.task_count !== 1 ? "s" : ""
        }</small>
        <div class="progress">
          <div class="progress-fill" style="width:${project.progress}%"></div>
        </div>
      `;

      projectCard.onclick = function (e) {
        if (!e.target.closest(".project-menu-btn")) {
          openProjectDetails(project.id, project.name);
        }
      };

      pinnedProjectsContainer.appendChild(projectCard);
    });

    if (totalProjects > 4) {
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

// dashboard.js - FIXED updateTasksDueToday function
function updateTasksDueToday(data) {
  console.log("📅 Updating tasks due today section...");

  const limitedList = document.getElementById("dueTodayList");
  const allTasksList = document.getElementById("allDueTodayTasks");
  const moreIndicator = document.getElementById("moreTasksIndicator");

  if (!limitedList) {
    console.log("❌ No tasks due today container found");
    return;
  }

  console.log("✅ Found tasks due today containers");

  // Get today's date
  const today = new Date();
  const todayString = today.toISOString().split("T")[0];
  console.log(`📅 Today's date: ${todayString}`);

  // Get ALL tasks from the data
  let allTasks = [];

  if (data && data.tasks) {
    // Combine all tasks from all statuses
    allTasks = [
      ...(data.tasks.todo || []),
      ...(data.tasks.inprogress || []),
      ...(data.tasks.review || []),
      ...(data.tasks.done || []),
    ];
  } else if (AppState.cachedData && AppState.cachedData.tasks) {
    // Fallback to cached data
    allTasks = [
      ...(AppState.cachedData.tasks.todo || []),
      ...(AppState.cachedData.tasks.inprogress || []),
      ...(AppState.cachedData.tasks.review || []),
      ...(AppState.cachedData.tasks.done || []),
    ];
  }

  console.log(`📊 Total tasks available: ${allTasks.length}`);

  // Filter tasks due today AND not completed (unless they're done today)
  const tasksDueToday = allTasks.filter((task) => {
    // Skip tasks that are already done (unless they were done today)
    if (task.status === "done") {
      // Check if task was completed today
      const completedDate = task.updated_at || task.created_at;
      if (completedDate) {
        const completedDateString = new Date(completedDate)
          .toISOString()
          .split("T")[0];
        return completedDateString === todayString;
      }
      return false;
    }

    // For non-done tasks, check due date
    if (!task.due_date) return false;

    // Compare due dates
    return task.due_date === todayString;
  });

  console.log(`📅 Found ${tasksDueToday.length} tasks due today`);

  // Clear existing lists
  limitedList.innerHTML = "";
  if (allTasksList) allTasksList.innerHTML = "";

  if (tasksDueToday.length === 0) {
    limitedList.innerHTML = "<li><span>No tasks due today</span></li>";
    if (allTasksList) {
      allTasksList.innerHTML = "<li><span>No tasks due today</span></li>";
    }
  } else {
    // Sort tasks: overdue/urgent first
    const sortedTasks = [...tasksDueToday].sort((a, b) => {
      // Sort by priority if due dates are the same
      const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
      return (
        (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2)
      );
    });

    // Show first 5 tasks in limited view
    const limitedTasks = sortedTasks.slice(0, 5);

    limitedTasks.forEach((task) => {
      const taskItem = document.createElement("li");
      taskItem.setAttribute("data-task-id", task.id);

      const statusClass = task.status === "done" ? "complete" : "urgent";
      const statusText =
        task.status === "done" ? "Completed Today" : "Due Today";

      taskItem.innerHTML = `
        <span>${task.title}</span>
        <strong class="${statusClass}">${statusText}</strong>
      `;

      taskItem.addEventListener("click", () => {
        openTaskDetails(task.id, task.title);
      });

      limitedList.appendChild(taskItem);
    });

    // Add "more tasks" indicator if there are more than 5
    if (sortedTasks.length > 5 && moreIndicator) {
      moreIndicator.innerHTML = `
        <span>+${sortedTasks.length - 5} more tasks</span>
        <button class="show-more-btn" onclick="showAllDueTodayTasks()">Show all</button>
      `;
      limitedList.appendChild(moreIndicator);
    }

    // Populate all tasks list
    if (allTasksList) {
      sortedTasks.forEach((task) => {
        const taskItem = document.createElement("li");
        taskItem.setAttribute("data-task-id", task.id);

        const statusClass = task.status === "done" ? "complete" : "urgent";
        const statusText =
          task.status === "done" ? "Completed Today" : "Due Today";

        taskItem.innerHTML = `
          <span>${task.title}</span>
          <strong class="${statusClass}">${statusText}</strong>
        `;

        taskItem.addEventListener("click", () => {
          openTaskDetails(task.id, task.title);
        });

        allTasksList.appendChild(taskItem);
      });

      // Add "show less" button
      const showLessItem = document.createElement("li");
      showLessItem.innerHTML = `
        <button class="show-less-btn" onclick="showLessDueTodayTasks()">Show less</button>
      `;
      allTasksList.appendChild(showLessItem);
    }
  }

  // Update the count badge
  const countBadge = document.getElementById("dueTodayCount");
  if (countBadge) {
    countBadge.textContent = tasksDueToday.length;
    if (tasksDueToday.length > 0) {
      countBadge.style.display = "inline-block";
      console.log(`🎯 Updated badge: ${tasksDueToday.length} tasks due today`);
    } else {
      countBadge.style.display = "none";
    }
  }

  console.log("✅ Tasks due today section updated");
}
// dashboard.js - More robust date comparison

function isDueToday(dueDateString) {
  if (!dueDateString) return false;

  const today = new Date();
  const todayString = today.toISOString().split("T")[0];

  // Try to parse the due date
  let dueDate;
  try {
    // Try ISO format first (YYYY-MM-DD)
    dueDate = new Date(dueDateString);

    // If invalid date, try other formats
    if (isNaN(dueDate.getTime())) {
      // Try without timezone
      dueDate = new Date(dueDateString.split("T")[0]);
    }
  } catch (e) {
    console.error("❌ Error parsing date:", dueDateString, e);
    return false;
  }

  // Format due date to YYYY-MM-DD for comparison
  const dueDateFormatted = dueDate.toISOString().split("T")[0];

  return dueDateFormatted === todayString;
}

// Function to show all your tasks
function showAllYourTasks() {
  // This would open a filtered view showing all your tasks
  showTasksPage();
  // Set the filter to "My Tasks"
  setTimeout(() => {
    const myTasksTab = document.querySelector('.filter-tab[data-filter="my"]');
    if (myTasksTab) {
      myTasksTab.click();
    }
  }, 300);
}

// dashboard.js - Add functions for showing all due today tasks

function showAllDueTodayTasks() {
  console.log("📅 Showing all tasks due today...");

  const limitedList = document.getElementById("dueTodayList");
  const allTasksList = document.getElementById("allDueTodayTasks");
  const moreIndicator = document.getElementById("moreTasksIndicator");

  if (limitedList && allTasksList) {
    limitedList.style.display = "none";
    allTasksList.style.display = "block";

    if (moreIndicator) {
      moreIndicator.style.display = "none";
    }

    console.log("✅ Now showing all tasks due today");
  }
}

function showLessDueTodayTasks() {
  console.log("📅 Showing limited tasks due today...");

  const limitedList = document.getElementById("dueTodayList");
  const allTasksList = document.getElementById("allDueTodayTasks");
  const moreIndicator = document.getElementById("moreTasksIndicator");

  if (limitedList && allTasksList) {
    limitedList.style.display = "block";
    allTasksList.style.display = "none";

    if (moreIndicator) {
      moreIndicator.style.display = "block";
    }

    console.log("✅ Now showing limited tasks due today");
  }
}

// dashboard.js - Update Kanban board

function updateKanbanBoard(tasks) {
  const kanbanBoard = document.getElementById("kanbanBoard");
  if (!kanbanBoard) return;

  console.log("📊 Updating Kanban board...");

  // Clear ALL existing tasks first
  kanbanBoard.querySelectorAll(".kanban-column").forEach((column) => {
    // Remove all kanban-task elements but keep column headers
    const tasksToRemove = column.querySelectorAll(".kanban-task");
    tasksToRemove.forEach((task) => task.remove());
  });

  // Populate each column
  const columnMap = {
    todo: tasks?.todo || [],
    inprogress: tasks?.inprogress || [],
    review: tasks?.review || [],
    done: tasks?.done || [],
  };

  Object.entries(columnMap).forEach(([columnName, taskList]) => {
    const column = kanbanBoard.querySelector(`[data-column="${columnName}"]`);
    if (!column) {
      console.log(`❌ Column ${columnName} not found`);
      return;
    }

    if (taskList.length === 0) {
      const emptyTask = document.createElement("div");
      emptyTask.className = "kanban-task empty";
      emptyTask.textContent = "No tasks";
      emptyTask.draggable = false;
      column.appendChild(emptyTask);
    } else {
      // Show up to 5 tasks per column
      taskList.slice(0, 5).forEach((task) => {
        const taskElement = document.createElement("div");
        taskElement.className = `kanban-task ${columnName === "done" ? "complete" : ""}`;
        taskElement.setAttribute("data-task-id", task.id);
        taskElement.setAttribute("draggable", "true");

        let assigneeInfo = "";
        if (task.assigned_to_name) {
          assigneeInfo = `<small>@${task.assigned_to_name}</small>`;
        }

        taskElement.innerHTML = `
          <div class="kanban-task-content">
            <div class="kanban-task-title">${task.title}</div>
            ${assigneeInfo ? `<div class="kanban-task-assignee">${assigneeInfo}</div>` : ""}
          </div>
        `;

        // Add click event
        taskElement.addEventListener("click", (e) => {
          e.stopPropagation();
          openTaskDetails(task.id, task.title);
        });

        column.appendChild(taskElement);
      });
    }
  });

  console.log("✅ Kanban board updated");
}

// dashboard.js - Update Your Tasks section

function updateYourTasks(tasks) {
  const yourTasksContainer = document.querySelector(".assigned-tasks ul");
  if (!yourTasksContainer) {
    console.error('❌ Assigned tasks <ul> not found!');
    return
  };

  console.log("👤 Updating Your Tasks...");

  // Clear existing list
  yourTasksContainer.innerHTML = "";

  // Get current user ID
  const currentUserId = window.djangoData?.user?.id;
  if (!currentUserId) {
    console.log("❌ No user ID available");
    yourTasksContainer.innerHTML =
      '<li><span class="task-title">No user data</span></li>';
    return;
  }

  // Combine all tasks and filter by assigned_to
  const allTasks = [
    ...(tasks?.todo || []),
    ...(tasks?.inprogress || []),
    ...(tasks?.review || []),
  ];

  const yourTasks = allTasks.filter((task) => {
    const isAssignedToUser = task.assigned_to === currentUserId;

    if (isAssignedToUser) {
      console.log(
        `✅ Found task "${task.title}" (ID: ${task.id}) - Status: ${task.status}, Assigned to: ${task.assigned_to}`,
      );
    }
    return isAssignedToUser;
  });

  // Render each task
  yourTasks.forEach(task => {
    console.log('📝 Rendering task:', task.title);  // Debug: Confirm each task is processed
    const li = document.createElement('li');
    li.setAttribute('data-task-id', task.id);
    
    // Build the inner HTML (match your Django template)
    li.innerHTML = `
      <span class="task-title">${task.title}</span>
      <small class="muted">
        ${task.due_date ? 
          (task.due_date === today ? 'due today' : 
          task.due_date < today ? 'overdue' : 
          `in ${timeUntil(task.due_date, today)}`) : 
          'no deadline'}
      </small>
    `;
    
    yourTasksContainer.appendChild(li);
  });

  // If no tasks, add the empty message
  if (yourTasks.length === 0) {
    const li = document.createElement('li');
    li.innerHTML = '<span class="task-title">No tasks assigned</span>';
    yourTasksContainer.appendChild(li);
  }

  // Update the badge (already working)
  const badge = document.querySelector('.assigned-tasks .inbox-badge');
  if (badge) {
    badge.textContent = yourTasks.length;
    badge.style.display = yourTasks.length > 0 ? 'inline' : 'none';
  }

  console.log(`👤 Found ${yourTasks.length} active tasks assigned to you`);

  if (yourTasks.length === 0) {
    yourTasksContainer.innerHTML =
      '<li><span class="task-title">No tasks assigned</span></li>';
  } else {
    // Show up to 5 tasks, sorted by due date (closest first)
    const sortedTasks = yourTasks.sort((a, b) => {
      // Tasks without due date go last
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;

      return new Date(a.due_date) - new Date(b.due_date);
    });

    const tasksToShow = sortedTasks.slice(0, 5);

    tasksToShow.forEach((task) => {
      const taskItem = document.createElement("li");
      taskItem.setAttribute("data-task-id", task.id);

      // Calculate due text
      let dueText = "no deadline";
      let dueClass = "muted";

      if (task.due_date) {
        const dueDate = new Date(task.due_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const diffTime = dueDate.getTime() - today.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {

        taskItem.innerHTML = `
          <span class="task-title">${task.title}</span>
          <small class="${dueClass}">${dueText}</small>
        `;
      }

      // Add click event
      taskItem.addEventListener("click", () => {
        openTaskDetails(task.id, task.title);
      });

      yourTasksContainer.appendChild(taskItem);
    }});

    // Show "more tasks" indicator if there are more than 5
    if (yourTasks.length > 5) {
      const moreItem = document.createElement("li");
      moreItem.className = "more-tasks";
      moreItem.innerHTML = `
        <span class="task-title muted">+${yourTasks.length - 5} more tasks</span>
        <button class="small-btn btn-link" onclick="showAllYourTasks()">Show all</button>
      `;
      yourTasksContainer.appendChild(moreItem);
    }
  }

  // Update the count badge - only count ACTIVE tasks (not done)
  const countBadge = document.querySelector(".assigned-tasks .inbox-badge");
  if (countBadge) {
    countBadge.textContent = yourTasks.length;
    countBadge.style.display = yourTasks.length > 0 ? "inline-block" : "none";
    console.log(
      `🎯 Updated badge: ${yourTasks.length} active tasks assigned to you`,
    );
  }

  console.log("✅ Your Tasks section updated");
}

function convertDjangoTime(djangoTime) {
  if (!djangoTime) return null;

  console.log("🔄 Converting Django time:", djangoTime);

  try {
    // Check if it's ISO format (contains 'T')
    if (djangoTime.includes("T")) {
      // ISO 8601 format: "2026-01-16T10:21:24.427912+00:00" or "2026-01-20T03:45:53.870832Z"
      // JavaScript Date can parse ISO format directly
      const date = new Date(djangoTime);

      if (isNaN(date.getTime())) {
        console.error("❌ Invalid ISO date:", djangoTime);
        return null;
      }

      console.log("✅ ISO format converted:", {
        input: djangoTime,
        output: date.toISOString(),
        local: date.toLocaleString(),
      });

      return date;
    }

    // Check if it's Django format (space separated)
    if (djangoTime.includes(" ")) {
      // Django format: "2026-01-20 03:46:34"
      const [datePart, timePart] = djangoTime.split(" ");

      if (!datePart || !timePart) {
        console.error("❌ Invalid Django time format:", djangoTime);
        return null;
      }

      const [year, month, day] = datePart.split("-").map(Number);
      const [hour, minute, second] = timePart.split(":").map(Number);

      // Create date in UTC (Django stores UTC)
      const utcDate = new Date(
        Date.UTC(year, month - 1, day, hour, minute, second),
      );

      if (isNaN(utcDate.getTime())) {
        console.error("❌ Invalid date after conversion:", {
          year,
          month,
          day,
          hour,
          minute,
          second,
        });
        return null;
      }

      console.log("✅ Django format converted:", {
        input: djangoTime,
        output: utcDate.toISOString(),
        local: utcDate.toLocaleString(),
      });

      return utcDate;
    }

    // If neither format, try direct parsing
    const date = new Date(djangoTime);
    if (!isNaN(date.getTime())) {
      console.log("✅ Direct parsing worked:", {
        input: djangoTime,
        output: date.toISOString(),
      });
      return date;
    }

    console.error("❌ Unrecognized time format:", djangoTime);
    return null;
  } catch (error) {
    console.error("❌ Error converting Django time:", error);
    return null;
  }
}

function calculateTimeAgo(diffMs) {
  if (diffMs < 0) {
    return "in the future";
  }

  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffSeconds < 60) {
    return "just now";
  } else if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes !== 1 ? "s" : ""} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
  } else if (diffDays < 7) {
    return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} week${weeks !== 1 ? "s" : ""} ago`;
  } else {
    const date = new Date(Date.now() - diffMs);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
}

function safeConvertDjangoTime(djangoTime) {
  if (!djangoTime) return null;

  // Try multiple parsing methods
  const parsers = [
    // Method 1: Direct UTC parsing
    () => {
      const [date, time] = djangoTime.split(" ");
      const [year, month, day] = date.split("-").map(Number);
      const [hour, minute, second] = time.split(":").map(Number);
      return new Date(Date.UTC(year, month - 1, day, hour, minute, second));
    },

    // Method 2: ISO string with Z
    () => new Date(djangoTime.replace(" ", "T") + "Z"),

    // Method 3: ISO string without Z (local)
    () => new Date(djangoTime.replace(" ", "T")),

    // Method 4: Manual parsing with local timezone
    () => {
      const [date, time] = djangoTime.split(" ");
      const [year, month, day] = date.split("-").map(Number);
      const [hour, minute, second] = time.split(":").map(Number);
      return new Date(year, month - 1, day, hour, minute, second);
    },
  ];

  for (const parser of parsers) {
    try {
      const result = parser();
      if (result && !isNaN(result.getTime())) {
        console.log(`✅ Parser succeeded for: ${djangoTime}`);
        return result;
      }
    } catch (e) {
      // Try next parser
    }
  }

  console.error(`❌ All parsers failed for: ${djangoTime}`);
  return null;
}

// dashboard.js - Update recent activity

function updateRecentActivity(tasks) {
  const activityContainer = document.querySelector(".activity-feed ul");
  if (!activityContainer) return;

  console.log("📝 Updating recent activity...");

  activityContainer.innerHTML = "";

  if (!tasks) {
    activityContainer.innerHTML = "<li>No recent activity</li>";
    return;
  }

  const allActivities = [];

  // Process each status category
  ["todo", "inprogress", "review", "done"].forEach((status) => {
    const statusTasks = tasks[status] || [];

    statusTasks.forEach((task) => {
      // Skip if no timestamps
      if (!task.created_at && !task.updated_at) {
        console.log("⚠️ Task has no timestamps:", task.id);
        return;
      }

      // Convert times using the fixed converter
      const createdDate = convertDjangoTimeSimple(task.created_at);
      const updatedDate = convertDjangoTimeSimple(task.updated_at);

      // Use updated date if available, otherwise created date
      const displayDate = updatedDate || createdDate;

      if (!displayDate) {
        console.log("⚠️ Could not parse date for task:", task.id, task.title);
        return;
      }

      // Determine action
      let action = "updated";
      if (!task.updated_at || task.updated_at === task.created_at) {
        action = "created";
      } else if (status === "done") {
        action = "completed";
      } else if (status === "review") {
        action = "submitted for review";
      } else if (status === "inprogress") {
        action = "started working on";
      }

      // Get user name
      let userName = window.djangoData?.user?.firstName || "You";
      if (task.assigned_to_name) {
        userName = task.assigned_to_name;
      } else if (task.assigned_to) {
        const currentUserId = window.djangoData?.user?.id;
        if (task.assigned_to === currentUserId) {
          userName = window.djangoData?.user?.firstName || "You";
        } else {
          userName = "a team member";
        }
      }

      allActivities.push({
        id: task.id,
        title: task.title,
        user: userName,
        action: action,
        date: displayDate,
        timestamp: displayDate.getTime(),
        status: status,
      });
    });
  });

  console.log(`📋 Total valid activities: ${allActivities.length}`);

  if (allActivities.length === 0) {
    activityContainer.innerHTML = "<li>No recent activity</li>";
    return;
  }

  // Sort by timestamp (most recent first)
  const recentActivities = allActivities
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 5);

  recentActivities.forEach((activity) => {
    const activityItem = document.createElement("li");

    // Calculate time ago
    const now = new Date();
    const diffMs = now - activity.date;
    const timeAgo = calculateTimeAgo(diffMs);

    // Debug log (optional)
    if (activity.action === "completed") {
      console.log("✅ Completed task:", {
        title: activity.title,
        date: activity.date.toISOString(),
        local: activity.date.toLocaleString("en-US", { timeZoneName: "short" }),
        diffMs: diffMs,
        timeAgo: timeAgo,
      });
    }

    activityItem.innerHTML = `
      <strong>${activity.user}</strong> 
      ${activity.action} 
      <em>${activity.title}</em> — 
      <span class="muted">${timeAgo}</span>
    `;

    activityItem.style.cursor = "pointer";
    activityItem.addEventListener("click", () => {
      openTaskDetails(activity.id, activity.title);
    });

    activityContainer.appendChild(activityItem);
  });

  console.log("✅ Recent activity updated with corrected times");
}

function updateTeamOnline() {
  const teamContainer = document.querySelector(".team-online .team-avatars");
  if (!teamContainer) return;

  console.log("👥 Updating team online...");

  // For now, just clear and show a simple message
  // In a real app, you would fetch team data
  teamContainer.innerHTML = `
    <div class="avatar online">${window.djangoData?.user?.firstName?.charAt(0) || "Y"}</div>
    <span>${window.djangoData?.user?.firstName || "You"}</span>
  `;
}

// =============================================
// FORM HANDLERS
// =============================================

function setupFormHandlers() {
  // Remove existing listeners to prevent duplicates
  document.removeEventListener("click", handleFormButtonClicks);
  document.removeEventListener("submit", handleFormSubmit);

  // Add fresh listeners
  document.addEventListener("click", handleFormButtonClicks);
  document.addEventListener("submit", handleFormSubmit);
}

function handleFormButtonClicks(e) {
  if (
    e.target.closest(".close-form-btn") ||
    (e.target.classList.contains("fa-times") && e.target.closest("submit-btn"))
  ) {
    e.preventDefault();
    e.stopImmediatePropagation();

    const form = e.target.closest("form");
    if (form) {
      console.log("Submit button clicked for form:", form.id);
      // Don't trigger form submit here, let handleFormSubmit handle it
      return;
    }

    restoreDashboard();
    return;
  }

  if (
    e.target.classList.contains("cancel-btn") ||
    e.target.closest(".cancel-btn")
  ) {
    e.preventDefault();
    e.stopPropagation();
    restoreDashboard();
    return;
  }

  if (
    e.target.id === "backDashboardBtn" ||
    e.target.closest("#backDashboardBtn")
  ) {
    e.preventDefault();
    e.stopPropagation();
    restoreDashboard();
    return;
  }
}

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

let isTaskSubmitting = false;

async function handleTaskFormSubmit(form) {
  // Check if form is already being submitted
  if (form.dataset.submitting === "true") {
    console.log("⏳ Form already submitting, ignoring duplicate");
    return false;
  }

  // Mark form as submitting
  form.dataset.submitting = "true";

  const submitBtn = form.querySelector(".submit-btn");
  if (!submitBtn) {
    console.error("❌ No submit button found");
    form.dataset.submitting = "false"; // Reset flag
    return false;
  }

  const originalText = submitBtn.innerHTML;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
  submitBtn.disabled = true;

  const timeoutId = setTimeout(() => {
    console.warn("⚠️ Task creation timed out");
    submitBtn.innerHTML = originalText;
    submitBtn.disabled = false;
    form.dataset.submitting = "false";
    showNotification("Task creation timed out. Please try again.", "error");
  }, 15000);

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

    console.log("📤 Submitting task data:", data); // NOW data is defined

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

    console.log("📥 Task creation response:", result);

    if (result.success) {
      showNotification("Task created successfully!", "success");

      // Reset flag
      form.dataset.submitting = "false";

      console.log("🔄 Task created, scheduling dashboard refresh...");

      setTimeout(() => {
        console.log("📡 Refreshing dashboard data now...");
        refreshDashboardData(true);

        // If we're in a project, refresh that too
        if (AppState.currentProjectId) {
          console.log(
            `🔄 Also refreshing project ${AppState.currentProjectId}`,
          );
          setTimeout(() => {
            const projectName =
              document.querySelector(".project-title")?.textContent || "";
            openProjectDetails(AppState.currentProjectId, projectName);
          }, 1500);
        } else {
          // Go back to dashboard
          setTimeout(() => {
            restoreDashboard();
          }, 1000);
        }
      }, 1500);
    } else {
      showNotification(result.error || "Failed to create task", "error");
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
      form.dataset.submitting = "false";
    }
  } catch (error) {
    console.error("❌ Network error:", error);
    clearTimeout(timeoutId);
    showNotification("Network error. Please try again.", "error");
    submitBtn.innerHTML = originalText;
    submitBtn.disabled = false;
    form.dataset.submitting = "false";
  }

  return false;
}

function resetTaskFormState(form, submitBtn, originalText) {
  if (submitBtn) {
    submitBtn.innerHTML = originalText;
    submitBtn.disabled = false;
  }

  if (form) {
    const formElements = form.elements;
    for (let i = 0; i < formElements.length; i++) {
      formElements[i].disabled = false;
    }
  }

  hideLoader();
}

// =============================================
// PROJECT FORM FUNCTIONS
// =============================================

function showNewProjectForm() {
  console.log("🏗️ Showing new project form...");
  showLoader();

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

    setTimeout(() => {
      setupRealTimeValidation();
    }, 100);

    AppState.currentPage = "new-project";
    updateSidebarActive("");
    localStorage.setItem("swyfttask-page", "new-project");
    history.pushState({ page: "new-project" }, "", "#new-project");

    stopAutoRefresh();
    hideLoader();
  }, 300);
}

let isProjectSubmitting = false;

async function handleProjectFormSubmit(form) {
  if (isProjectSubmitting) {
    console.log("⏳ Project submission already in progress");
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

  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking...';
  submitBtn.disabled = true;

  const formElements = form.elements;
  for (let i = 0; i < formElements.length; i++) {
    formElements[i].disabled = true;
  }

  const formData = new FormData(form);
  const projectName = formData.get("name").trim();

  if (!projectName) {
    showNotification("Project name is required", "error");
    resetFormState(form, submitBtn, originalText, originalDisabled);
    isProjectSubmitting = false;
    return false;
  }

  try {
    const response = await fetch(
      `/api/projects/check-duplicate/?name=${encodeURIComponent(projectName)}`,
    );
    const result = await response.json();

    if (result.exists) {
      resetFormState(form, submitBtn, originalText, originalDisabled);
      showNotification(
        `You already have a project named "${result.project_name}"`,
        "error",
      );
      isProjectSubmitting = false;
      return false;
    }

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

    if (createResult.success) {
      showNotification("Project created successfully!", "success");
      setTimeout(() => {
        openProjectDetails(createResult.project.id, createResult.project.name);
      }, 1000);
    } else {
      showNotification(
        createResult.error || "Failed to create project",
        "error",
      );
      resetFormState(form, submitBtn, originalText, originalDisabled);
    }
  } catch (error) {
    console.error("❌ Network error:", error);
    showNotification("Network error. Please try again.", "error");
    resetFormState(form, submitBtn, originalText, originalDisabled);
  } finally {
    setTimeout(() => {
      isProjectSubmitting = false;
    }, 2000);
  }

  return false;
}

function resetFormState(form, submitBtn, originalText, originalDisabled) {
  if (submitBtn) {
    submitBtn.innerHTML = originalText;
    submitBtn.disabled = originalDisabled;
  }

  if (form) {
    const formElements = form.elements;
    for (let i = 0; i < formElements.length; i++) {
      formElements[i].disabled = false;
    }
  }
}

// =============================================
// TASK FORM FUNCTIONS
// =============================================

function showNewTaskForm(prefilledStatus = null) {
  console.log("📝 Showing new task form...");
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

    setTimeout(() => {
      setupTaskForm();
      if (prefilledStatus) {
        const statusSelect = document.getElementById("taskStatus");
        if (statusSelect) {
          statusSelect.value = prefilledStatus;
        }
      }
    }, 100);

    AppState.currentPage = "new-task";
    updateSidebarActive("");
    localStorage.setItem("swyfttask-page", "new-task");
    history.pushState({ page: "new-task" }, "", "#new-task");

    stopAutoRefresh();
    hideLoader();
  }, 300);
}

function setupTaskForm() {
  console.log("🔧 Setting up task form...");

  const taskForm = document.getElementById("taskForm");
  if (taskForm) {
    // Set up form submit handler
    taskForm.onsubmit = function (e) {
      e.preventDefault();
      e.stopPropagation();
      console.log("Task form submit handler called");
      handleTaskFormSubmit(this);
      return false;
    };
  }

  // Set up close button
  const closeBtn = document.querySelector(".close-form-btn");
  if (closeBtn) {
    closeBtn.onclick = function (e) {
      e.preventDefault();
      restoreDashboard();
    };
  }

  // Set up cancel button
  const cancelBtn = document.querySelector(".cancel-btn");
  if (cancelBtn) {
    cancelBtn.onclick = function (e) {
      e.preventDefault();
      restoreDashboard();
    };
  }

  // Try to set up project dropdown if elements exist
  try {
    setupProjectDropdown();
  } catch (error) {
    console.log("Project dropdown setup failed, continuing without it:", error);
  }

  console.log("✅ Task form setup complete");
}

function setupProjectDropdown() {
  const customDropdown = document.getElementById("customProjectDropdown");
  const selectElement = document.getElementById("taskProject");
  const searchInput = document.getElementById("projectSearch");
  const optionsContainer = document.getElementById("projectOptions");
  const selectedText = document.getElementById("selectedProjectText");

  if (!customDropdown || !selectElement) {
    console.log("⚠️ Custom dropdown elements not found, using regular select");
    // Just make sure the regular select works
    if (selectElement) {
      selectElement.addEventListener("change", function () {
        updateAssigneeDropdown(this.value);
      });
    }
    return;
  }

  const options = Array.from(selectElement.options).slice(1);
  optionsContainer.innerHTML = "";

  options.forEach((option) => {
    const optionDiv = document.createElement("div");
    optionDiv.className = "dropdown-option";
    optionDiv.textContent = option.textContent;
    optionDiv.setAttribute("data-value", option.value);

    optionDiv.onclick = function () {
      selectedText.textContent = option.textContent;
      selectElement.value = option.value;
      selectElement.dispatchEvent(new Event("change"));
      customDropdown.classList.remove("open");

      document.querySelectorAll(".dropdown-option").forEach((opt) => {
        opt.classList.remove("selected");
      });
      this.classList.add("selected");

      updateAssigneeDropdown(option.value);
    };

    optionsContainer.appendChild(optionDiv);
  });

  customDropdown.querySelector(".dropdown-selected").onclick = function (e) {
    e.stopPropagation();
    customDropdown.classList.toggle("open");
    if (customDropdown.classList.contains("open")) {
      searchInput.focus();
    }
  };

  searchInput.addEventListener("input", function () {
    const searchTerm = this.value.toLowerCase();
    const allOptions = optionsContainer.querySelectorAll(".dropdown-option");

    allOptions.forEach((option) => {
      const text = option.textContent.toLowerCase();
      option.style.display = text.includes(searchTerm) ? "block" : "none";
    });
  });

  document.addEventListener("click", function (e) {
    if (!customDropdown.contains(e.target)) {
      customDropdown.classList.remove("open");
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && customDropdown.classList.contains("open")) {
      customDropdown.classList.remove("open");
    }
  });
}

// function setupProjectDropdown() {
//   const customDropdown = document.getElementById("customProjectDropdown");
//   const selectElement = document.getElementById("taskProject");
//   const searchInput = document.getElementById("projectSearch");
//   const optionsContainer = document.getElementById("projectOptions");
//   const selectedText = document.getElementById("selectedProjectText");

//   if (!customDropdown || !selectElement || !searchInput || !optionsContainer) {
//     console.log("⚠️ Dropdown elements not found");
//     return;
//   }

//   const options = Array.from(selectElement.options).slice(1);
//   optionsContainer.innerHTML = "";

//   options.forEach((option) => {
//     const optionDiv = document.createElement("div");
//     optionDiv.className = "dropdown-option";
//     optionDiv.textContent = option.textContent;
//     optionDiv.setAttribute("data-value", option.value);

//     optionDiv.onclick = function () {
//       selectedText.textContent = option.textContent;
//       selectElement.value = option.value;
//       selectElement.dispatchEvent(new Event("change"));
//       customDropdown.classList.remove("open");

//       document.querySelectorAll(".dropdown-option").forEach((opt) => {
//         opt.classList.remove("selected");
//       });
//       this.classList.add("selected");

//       updateAssigneeDropdown(option.value);
//     };

//     optionsContainer.appendChild(optionDiv);
//   });

//   customDropdown.querySelector(".dropdown-selected").onclick = function (e) {
//     e.stopPropagation();
//     customDropdown.classList.toggle("open");
//     if (customDropdown.classList.contains("open")) {
//       searchInput.focus();
//     }
//   };

//   searchInput.addEventListener("input", function () {
//     const searchTerm = this.value.toLowerCase();
//     const allOptions = optionsContainer.querySelectorAll(".dropdown-option");

//     allOptions.forEach((option) => {
//       const text = option.textContent.toLowerCase();
//       option.style.display = text.includes(searchTerm) ? "block" : "none";
//     });
//   });

//   document.addEventListener("click", function (e) {
//     if (!customDropdown.contains(e.target)) {
//       customDropdown.classList.remove("open");
//     }
//   });

//   document.addEventListener("keydown", function (e) {
//     if (e.key === "Escape" && customDropdown.classList.contains("open")) {
//       customDropdown.classList.remove("open");
//     }
//   });
// }

function updateAssigneeDropdown(projectId) {
  if (!projectId) {
    const assigneeSelect = document.getElementById("taskAssignee");
    if (assigneeSelect) {
      assigneeSelect.innerHTML = `
        <option value="">Unassigned</option>
        <option value="${window.djangoData?.user?.id || ""}">
          ${window.djangoData?.user?.firstName || "You"} (You)
        </option>
      `;
    }
    return;
  }

  fetch(`/api/projects/${projectId}/members/`)
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        updateAssigneeDropdownWithMembers(data.members);
      } else {
        console.error("Failed to fetch project members:", data.error);
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

  let options = '<option value="">Unassigned</option>';
  const currentUserId = window.djangoData?.user?.id || "";

  options += `<option value="${currentUserId}">
    ${window.djangoData?.user?.firstName || "You"} (You)
  </option>`;

  members.forEach((member) => {
    if (member.id !== currentUserId) {
      const displayName = member.first_name || member.username;
      options += `<option value="${member.id}">${displayName}</option>`;
    }
  });

  assigneeSelect.innerHTML = options;
}

// =============================================
// TASK DETAILS PAGE
// =============================================

async function openTaskDetails(taskId, taskTitle) {
  console.log(`📖 Opening task ${taskId}: ${taskTitle}`);
  showLoader();
  AppState.currentTaskId = taskId;

  try {
    // In a real app, you would fetch task details from API
    // For now, we'll use the template
    const mainContent = document.getElementById("mainContent");
    if (!mainContent) return;

    const template = document.getElementById("task-details-template");
    if (!template) {
      showNotification("Task details template not found", "error");
      restoreDashboard();
      return;
    }

    mainContent.innerHTML = "";
    mainContent.appendChild(template.content.cloneNode(true));

    // Set task ID and title
    const taskTitleElement = document.getElementById("taskTitle");
    if (taskTitleElement) {
      taskTitleElement.textContent = taskTitle || "Task Details";
    }

    const taskIdElement = document.querySelector(".task-id");
    if (taskIdElement) {
      taskIdElement.textContent = `#TASK-${taskId}`;
    }

    // Setup event listeners for task details page
    setupTaskDetailsPage(taskId);

    AppState.currentPage = "task-details";
    updateSidebarActive("");
    localStorage.setItem("swyfttask-page", `task-${taskId}`);
    history.pushState(
      { page: "task-details", taskId: taskId },
      "",
      `#task-${taskId}`,
    );

    stopAutoRefresh();
  } catch (error) {
    console.error("❌ Error loading task details:", error);
    showNotification(`Failed to load task details: ${error.message}`, "error");
    restoreDashboard();
  } finally {
    hideLoader();
  }
}

function setupTaskDetailsPage(taskId) {
  // Back button
  const backBtn = document.getElementById("backDashboardBtn");
  if (backBtn) {
    backBtn.addEventListener("click", restoreDashboard);
  }

  // Status update
  const statusSelect = document.getElementById("taskStatus");
  if (statusSelect) {
    statusSelect.addEventListener("change", function () {
      updateTaskStatus(taskId, this.value);
    });
  }

  // Save task title
  const taskTitle = document.getElementById("taskTitle");
  if (taskTitle) {
    taskTitle.addEventListener("blur", function () {
      saveTaskTitle(taskId, this.textContent);
    });
  }

  // Save task description
  const description = document.querySelector(".rich-text");
  if (description) {
    description.addEventListener("blur", function () {
      saveTaskDescription(taskId, this.textContent);
    });
  }

  // Comment submission
  const commentBox = document.querySelector(".comment-box textarea");
  const sendCommentBtn = document.querySelector(".send-comment");
  if (commentBox && sendCommentBtn) {
    sendCommentBtn.addEventListener("click", function () {
      addComment(taskId, commentBox.value);
      commentBox.value = "";
    });

    commentBox.addEventListener("keypress", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        addComment(taskId, this.value);
        this.value = "";
      }
    });
  }

  // Subtask checkboxes
  const subtaskCheckboxes = document.querySelectorAll(
    ".checklist input[type='checkbox']",
  );
  subtaskCheckboxes.forEach((checkbox) => {
    checkbox.addEventListener("change", function () {
      updateSubtask(taskId, this);
    });
  });

  // Add subtask button
  const addSubtaskBtn = document.querySelector(".add-task-btn, .add-btn");
  if (addSubtaskBtn) {
    addSubtaskBtn.addEventListener("click", function () {
      addSubtask(taskId);
    });
  }

  // Assignee management
  const addAssigneeBtn = document.querySelector(".add-assignee");
  if (addAssigneeBtn) {
    addAssigneeBtn.addEventListener("click", function () {
      showAssigneePicker(taskId);
    });
  }

  // Attachment upload
  const uploadZone = document.querySelector(".upload-zone");
  if (uploadZone) {
    uploadZone.addEventListener("click", function () {
      triggerFileUpload(taskId);
    });
  }

  // Due date update
  const dueDateInput = document.querySelector('input[type="date"]');
  if (dueDateInput) {
    dueDateInput.addEventListener("change", function () {
      updateTaskDueDate(taskId, this.value);
    });
  }

  // Priority update
  const prioritySelect = document.querySelector(".priority-select");
  if (prioritySelect) {
    prioritySelect.addEventListener("change", function () {
      updateTaskPriority(taskId, this.value);
    });
  }

  // Labels management
  const addLabelBtn = document.querySelector(".add-label");
  if (addLabelBtn) {
    addLabelBtn.addEventListener("click", function () {
      showLabelPicker(taskId);
    });
  }

  // Time tracking
  const playTimerBtn = document.querySelector(".play-timer");
  if (playTimerBtn) {
    playTimerBtn.addEventListener("click", function () {
      toggleTimeTracking(taskId);
    });
  }
}

async function updateTaskStatus(taskId, newStatus) {
  try {
    console.log(`🔄 Updating task ${taskId} status to ${newStatus}`);

    const response = await fetch("/api/tasks/update-status/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": getCSRFToken(),
      },
      body: JSON.stringify({
        task_id: taskId,
        status: newStatus,
      }),
    });

    const result = await response.json();

    if (result.success) {
      showNotification(`Task status updated to ${newStatus}`, "success");

      // Debounced refresh
      setTimeout(() => {
        console.log("🔄 Refreshing dashboard data after status update...");
        refreshDashboardData(true); // Force refresh
      }, 300);

      // Update any open task details
      if (AppState.currentTaskId === taskId) {
        setTimeout(() => {
          const taskTitle =
            document.getElementById("taskTitle")?.textContent || "Task";
          openTaskDetails(taskId, taskTitle);
        }, 500);
      }

      // If we're in project details, refresh that too
      if (AppState.currentProjectId) {
        setTimeout(() => {
          const projectName =
            document.querySelector(".project-title")?.textContent || "";
          openProjectDetails(AppState.currentProjectId, projectName);
        }, 500);
      }

      return result;
    } else {
      console.error("❌ Failed to update task status:", result.error);
      showNotification(result.error || "Failed to update task status", "error");
      throw new Error(result.error || "Failed to update task status");
    }
  } catch (error) {
    console.error("❌ Network error updating task status:", error);
    showNotification("Network error updating status", "error");
    throw error;
  }
}

async function saveTaskTitle(taskId, newTitle) {
  if (!newTitle || newTitle.trim() === "") return;

  try {
    // In a real app, you would make an API call here
    console.log(`Saving task ${taskId} title: ${newTitle}`);
    showNotification("Task title saved", "success");
  } catch (error) {
    console.error("Error saving task title:", error);
    showNotification("Failed to save title", "error");
  }
}

async function saveTaskDescription(taskId, newDescription) {
  try {
    // In a real app, you would make an API call here
    console.log(`Saving task ${taskId} description`);
    showNotification("Description saved", "success");
  } catch (error) {
    console.error("Error saving description:", error);
    showNotification("Failed to save description", "error");
  }
}

async function addComment(taskId, comment) {
  if (!comment || comment.trim() === "") return;

  try {
    // In a real app, you would make an API call here
    console.log(`Adding comment to task ${taskId}: ${comment}`);

    // Add comment to UI
    const commentStream = document.querySelector(".comment-stream");
    if (commentStream) {
      const commentElement = document.createElement("div");
      commentElement.className = "activity-item comment";
      commentElement.innerHTML = `
        <div class="avatar">${
          window.djangoData?.user?.firstName?.charAt(0) || "U"
        }</div>
        <div class="comment-body">
          <strong>${window.djangoData?.user?.firstName || "You"}</strong>
          <p>${comment}</p>
          <div class="comment-actions">
            <span class="muted">Just now</span> · Reply · Smiley
          </div>
        </div>
      `;
      commentStream.appendChild(commentElement);
    }

    showNotification("Comment added", "success");
  } catch (error) {
    console.error("Error adding comment:", error);
    showNotification("Failed to add comment", "error");
  }
}

function updateSubtask(taskId, checkbox) {
  const isChecked = checkbox.checked;
  const subtaskText = checkbox.parentElement.textContent.trim();

  console.log(
    `Updating subtask for task ${taskId}: ${subtaskText} - ${
      isChecked ? "completed" : "pending"
    }`,
  );

  // Update progress bar
  updateSubtaskProgress();
}

function updateSubtaskProgress() {
  const checkboxes = document.querySelectorAll(
    ".checklist input[type='checkbox']",
  );
  const total = checkboxes.length;
  const completed = Array.from(checkboxes).filter((cb) => cb.checked).length;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  const progressText = document.querySelector(".progress-text");
  if (progressText) {
    progressText.textContent = `${completed} of ${total}`;
  }

  const progressFill = document.querySelector(".progress-fill");
  if (progressFill) {
    progressFill.style.width = `${progress}%`;
  }
}

function addSubtask(taskId) {
  const checklist = document.querySelector(".checklist");
  if (!checklist) return;

  const subtaskText = prompt("Enter subtask description:");
  if (!subtaskText || subtaskText.trim() === "") return;

  const newSubtask = document.createElement("li");
  newSubtask.innerHTML = `
    <label>
      <input type="checkbox">
      ${subtaskText}
    </label>
  `;

  checklist.appendChild(newSubtask);

  // Add event listener to new checkbox
  const newCheckbox = newSubtask.querySelector("input[type='checkbox']");
  newCheckbox.addEventListener("change", function () {
    updateSubtask(taskId, this);
  });

  updateSubtaskProgress();
  showNotification("Subtask added", "success");
}

function showAssigneePicker(taskId) {
  // In a real app, this would show a modal with team members
  const assigneeName = prompt("Enter assignee name or email:");
  if (!assigneeName) return;

  console.log(`Assigning task ${taskId} to ${assigneeName}`);
  showNotification(`Task assigned to ${assigneeName}`, "success");
}

function triggerFileUpload(taskId) {
  const input = document.createElement("input");
  input.type = "file";
  input.multiple = true;

  input.onchange = function (e) {
    const files = e.target.files;
    console.log(`Uploading ${files.length} files to task ${taskId}`);

    // In a real app, you would upload files to server
    Array.from(files).forEach((file) => {
      console.log(`File: ${file.name} (${file.size} bytes)`);
    });

    showNotification(`${files.length} file(s) uploaded`, "success");
  };

  input.click();
}

async function updateTaskDueDate(taskId, newDueDate) {
  try {
    console.log(`Updating task ${taskId} due date to ${newDueDate}`);
    showNotification("Due date updated", "success");
  } catch (error) {
    console.error("Error updating due date:", error);
    showNotification("Failed to update due date", "error");
  }
}

async function updateTaskPriority(taskId, newPriority) {
  try {
    console.log(`Updating task ${taskId} priority to ${newPriority}`);

    // Update priority badge
    const priorityBadge = document.querySelector(".priority-badge");
    if (priorityBadge) {
      priorityBadge.textContent = `${
        newPriority.charAt(0).toUpperCase() + newPriority.slice(1)
      } Priority`;
      priorityBadge.className = `priority-badge ${newPriority}`;
    }

    showNotification("Priority updated", "success");
  } catch (error) {
    console.error("Error updating priority:", error);
    showNotification("Failed to update priority", "error");
  }
}

function showLabelPicker(taskId) {
  const labelText = prompt("Enter label text:");
  if (!labelText) return;

  const labelColor = prompt(
    "Enter label color (red, blue, green, yellow, purple):",
    "blue",
  );

  const labelsContainer = document.querySelector(".labels");
  if (!labelsContainer) return;

  const newLabel = document.createElement("span");
  newLabel.className = `label ${labelColor}`;
  newLabel.textContent = labelText;

  labelsContainer.insertBefore(
    newLabel,
    labelsContainer.querySelector(".add-label"),
  );

  showNotification("Label added", "success");
}

function toggleTimeTracking(taskId) {
  const timerBtn = document.querySelector(".play-timer");
  if (!timerBtn) return;

  const isPlaying = timerBtn.querySelector(".fa-play");

  if (isPlaying) {
    // Start timer
    timerBtn.innerHTML = '<i class="fas fa-pause"></i> Pause timer';
    console.log(`Starting timer for task ${taskId}`);
    showNotification("Timer started", "success");
  } else {
    // Pause timer
    timerBtn.innerHTML = '<i class="fas fa-play"></i> Start timer';
    console.log(`Pausing timer for task ${taskId}`);
    showNotification("Timer paused", "info");
  }
}

// =============================================
// PROJECT FUNCTIONS
// =============================================

async function openProjectDetails(projectId, projectName) {
  console.log(`🏗️ Opening project ${projectId}: ${projectName}`);
  showLoader();
  AppState.currentProjectId = projectId;

  try {
    const response = await fetch(`/api/projects/${projectId}/`);
    if (!response.ok) {
      throw new Error(`Failed to fetch project: ${response.status}`);
    }

    // Debug the raw response
    console.log("📡 Raw response:", response);

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const text = await response.text();
      console.error(
        "❌ API returned HTML instead of JSON:",
        text.substring(0, 200),
      );
      throw new Error("API returned HTML instead of JSON.");
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || "Failed to load project details");
    }

    // Set the global currentProject variable here
    window.currentProject = data.project;  // Now available for modals
    setCurrentProject(data.project)

    // Debug the data structure
    console.log("📊 Project API response:", {
      success: data.success,
      hasProject: !!data.project,
      hasStats: !!data.stats,
      hasTasks: !!data.tasks,
      project: data.project,
      stats: data.stats,
      tasks: data.tasks
        ? {
            todo: data.tasks.todo?.length || 0,
            inprogress: data.tasks.inprogress?.length || 0,
            review: data.tasks.review?.length || 0,
            done: data.tasks.done?.length || 0,
          }
        : "No tasks",
    });

    if (!data.success) {
      throw new Error(data.error || "Failed to load project");
    }

    const mainContent = document.getElementById("mainContent");
    if (!mainContent) return;

    const html = createProjectDetailsHTML(data, projectId);
    mainContent.innerHTML = html;

    AppState.currentPage = "project-details";
    updateSidebarActive("");
    localStorage.setItem("swyfttask-page", `project-${projectId}`);
    history.pushState(
      { page: "project-details", projectId: projectId },
      "",
      `#project-${projectId}`,
    );

    stopAutoRefresh();
    setupProjectDetailsPage(projectId, data);
  } catch (error) {
    console.error("❌ Error loading project:", error);
    showNotification(`Failed to load project: ${error.message}`, "error");
    restoreDashboard();
  } finally {
    hideLoader();
  }
}

function createProjectDetailsHTML(data, projectId) {
  console.log("🎨 Creating project details HTML with data:", data);

  // Ensure we have default values
  const project = data.project || {};
  const stats = data.stats || {
    total_tasks: 0,
    completed_tasks: 0,
    overdue_tasks: 0,
    progress: 0,
  };

  const tasks = data.tasks || {
    todo: [],
    inprogress: [],
    review: [],
    done: [],
  };

  // Format dates
  const createdDate = project.created_at
    ? convertDjangoTimeSimple(project.created_at)
    : new Date();

  const formattedDate = createdDate
    ? createdDate.toLocaleDateString("en-US", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
    : "Unknown date";

  // Create task cards HTML
  const tasksGridHTML = createTasksGridHTML(tasks, projectId);

  // Create team members HTML - check if team data exists
  const team = data.team || [];
  const teamMembersHTML = createTeamMembersHTML(team);

  return `
    <div class="simple-project-details">
      <div class="project-header">
        <button class="qa-btn back-btn" onclick="restoreDashboard()">
          <i class="fa fa-arrow-left"></i> Back to Dashboard
        </button>
        <div class="project-title-section">
          <h1>${project.name || "Unnamed Project"}</h1>
          <div class="project-meta">
            <span>Owned by ${project.owner?.name || project.owner?.username || "Unknown"} • Created ${formattedDate}</span>
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
          <div class="progress-percent">${stats.progress || 0}%</div>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${stats.progress || 0}%"></div>
        </div>
        <div class="progress-stats">
          <div class="stat">
            <div class="stat-number">${stats.completed_tasks || 0}</div>
            <div class="stat-label">Completed</div>
          </div>
          <div class="stat">
            <div class="stat-number">${stats.total_tasks || 0}</div>
            <div class="stat-label">Total Tasks</div>
          </div>
          <div class="stat">
            <div class="stat-number">${stats.overdue_tasks || 0}</div>
            <div class="stat-label">Overdue</div>
          </div>
        </div>
      </div>
      
      <div class="project-description-section">
        <h3>Description</h3>
        <div class="description-content">
          ${project.description || '<em style="color: #888;">No description provided</em>'}
        </div>
      </div>
      
      <div class="project-tasks-section">
        <div class="tasks-header">
          <h3>Tasks (${stats.total_tasks || 0})</h3>
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
          ${tasksGridHTML}
        </div>
      </div>
      
      ${
        team.length > 0
          ? `
        <div class="project-team-section">
          <h3>Team Members (${team.length})</h3>
          <div class="team-grid">
            ${teamMembersHTML}
          </div>
        </div>
      `
          : ""
      }
    </div>
  `;
}

// Assuming the button has id="editProjectButton" – adjust selector as needed
const editButton = document.getElementById('editProjectBtn');
if (editButton) {
  editButton.addEventListener('click', function(e) {
    e.preventDefault();  // Prevent default if it's a link
    console.log('Edit button clicked!');  // Debug: Confirm click
    // Add your edit logic here, e.g., open a modal or redirect
    editProject();  // Call your edit function if defined
  });
} else {
  console.error('Edit button not found!');  // Debug: If selector is wrong
}

function editProject(projectId) {
  console.log('editProject called with projectId:', projectId);  // Debug

  const project = window.getCurrentProject ? window.getCurrentProject() : window.currentProject;
  if (!project) {
    console.error('No project data available. Ensure openProjectDetails sets window.currentProject.');
    alert('Project data not available. Please try again.');
    return;
  }

  const modalHTML = `
    <div id="editProjectModal" class="modal-overlay" style="display: flex;">
      <div class="modal-content">
        <div class="modal-header">
          <h2>Edit Project</h2>
          <button class="modal-close" id="closeEditModal">&times;</button>
        </div>
        <div class="modal-body">
          <form id="editProjectForm">
            <label for="projectName">Project Name:</label>
            <input type="text" id="projectName" value="${project.name.replace(/"/g, '&quot;')}" required>
            
            <label for="projectDescription">Description:</label>
            <textarea id="projectDescription" required>${project.description.replace(/"/g, '&quot;')}</textarea>
            
            <div class="modal-actions">
              <button type="button" id="cancelEdit">Cancel</button>
              <button type="submit">Save Changes</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHTML);

  const modal = document.getElementById('editProjectModal');
  const closeBtn = document.getElementById('closeEditModal');
  const cancelBtn = document.getElementById('cancelEdit');
  const form = document.getElementById('editProjectForm');

  if (!modal || !closeBtn || !cancelBtn || !form) {
    console.error('Modal elements not created properly.');
    return;
  }

  const closeModal = () => {
    console.log('Closing modal');  // Debug
    modal.remove();
  };

  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    console.log('Close button clicked');  // Debug
    closeModal();
  });

  cancelBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    console.log('Cancel button clicked');  // Debug
    closeModal();
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });
  
  // Handle form submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const updatedData = {
      name: document.getElementById('projectName').value.trim(),
      description: document.getElementById('projectDescription').value.trim(),
    };

    if (!updatedData.name || !updatedData.description) {
      alert('Please fill in all fields.');
      return;
    }

    try {
      // Send update to backend (adjust URL and method as needed)
      const response = await fetch(`/api/projects/${project.id}/`, {
        method: 'PUT',  // PATCH Or PUT
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': window.getCSRFToken ? window.getCSRFToken() : '',  // Use your existing getCSRFToken function
        },
        body: JSON.stringify(updatedData),
      });

      if (response.ok) {
        console.log('Project updated successfully');
        alert('Project updated!');
        closeModal();
        // Optionally refresh the page or update UI
        location.reload();  // Or call a function to refresh project details
      } else {
        console.error('Update failed:', response.status);
        alert('Failed to update project. Please try again.');
      }
    } catch (error) {
      console.error('Error updating project:', error);
      alert('An error occurred. Please try again.');
    }
  });
}

function createTasksGridHTML(tasks, projectId) {
  // Combine all tasks
  const allTasks = [
    ...(tasks.todo || []),
    ...(tasks.inprogress || []),
    ...(tasks.review || []),
    ...(tasks.done || []),
  ];

  console.log("📋 Creating tasks grid with", allTasks.length, "tasks");

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
      const title = (task.title || "Untitled Task")
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"');

      // Get assignee info
      let assigneeHtml = '<span class="unassigned">Unassigned</span>';
      if (task.assigned_to) {
        const assigneeName =
          task.assigned_to.name || task.assigned_to.username || "Unknown";
        const initial = assigneeName.charAt(0).toUpperCase();
        assigneeHtml = `
        <div class="assignee-avatar" title="${assigneeName}">
          ${initial}
        </div>
      `;
      }

      // Format due date
      let dueDateHtml = '<span class="no-due-date">No deadline</span>';
      if (task.due_date) {
        const dueDate = new Date(task.due_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const diffTime = dueDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        let dueClass = "";
        let dueText = dueDate.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });

        if (diffDays === 0) {
          dueClass = "urgent";
          dueText = "Due today";
        } else if (diffDays < 0) {
          dueClass = "overdue";
          dueText = "Overdue";
        } else if (diffDays === 1) {
          dueClass = "warning";
          dueText = "Due tomorrow";
        } else if (diffDays <= 7) {
          dueClass = "warning";
          dueText = `Due in ${diffDays} days`;
        }

        dueDateHtml = `<div class="task-due-date ${dueClass}">${dueText}</div>`;
      }

      return `
      <div class="task-card" data-task-id="${task.id}" data-status="${task.status}" 
           onclick="openTaskDetails(${task.id}, '${title}')">
        <div class="task-card-header">
          <div class="task-status status-${task.status}">
            ${task.status_display || task.status}
          </div>
          <div class="task-priority priority-${task.priority || "medium"}">
            ${task.priority || "medium"}
          </div>
        </div>
        <div class="task-card-body">
          <h4>${task.title || "Untitled Task"}</h4>
          <p class="task-description">
            ${
              task.description
                ? task.description.length > 100
                  ? task.description.substring(0, 100) + "..."
                  : task.description
                : "No description"
            }
          </p>
        </div>
        <div class="task-card-footer">
          <div class="task-assignee">
            ${assigneeHtml}
          </div>
          ${dueDateHtml}
        </div>
      </div>
    `;
    })
    .join("");
}

function createTeamMembersHTML(team) {
  if (!team || team.length === 0) {
    return '<div class="no-team">No team members yet</div>';
  }

  return team
    .map((member) => {
      const name = member.name || member.username || "Unknown";
      const initial = name.charAt(0).toUpperCase();

      return `
      <div class="team-member-card">
        <div class="member-avatar ${member.is_owner ? "owner" : ""}">
          ${initial}
          ${
            member.is_owner
              ? '<span class="owner-badge" title="Project Owner">👑</span>'
              : ""
          }
        </div>
        <div class="member-info">
          <h4>${name}</h4>
          <p class="member-role">${member.is_owner ? "Owner" : "Member"}</p>
          <p class="member-stats">
            ${member.completed_tasks || 0} of ${member.task_count || 0} tasks completed
          </p>
        </div>
      </div>
    `;
    })
    .join("");
}

function setupProjectDetailsPage(projectId, data) {
  // Task filtering
  const filterBtns = document.querySelectorAll(`.filter-btn`);
  filterBtns.forEach((btn) => {
    btn.addEventListener("click", function () {
      const filter = this.textContent.toLowerCase().replace(" ", "");
      filterTasks(filter, projectId);
    });
  });

  // Add task button
  const addTaskBtn = document.querySelector(".qa-btn");
  if (addTaskBtn && addTaskBtn.textContent.includes("Add Task")) {
    addTaskBtn.addEventListener("click", function () {
      addTaskToProject(projectId);
    });
  }

  // Edit project button
  const editBtn = document.querySelector(".icon-btn[title='Edit Project']");
  if (editBtn) {
    editBtn.addEventListener("click", function () {
      editProject(projectId);
    });
  }
}

function filterProjects(query) {
  const projectsList = document.getElementById('projectsList');
  if (!projectsList) return;

  const projects = projectsList.querySelectorAll('.project-list-item');
  const lowerQuery = query.toLowerCase();

  projects.forEach(project => {
    const title = project.querySelector('h3')?.textContent.toLowerCase() || '';
    const description = project.querySelector('.project-description')?.textContent.toLowerCase() || '';
    const isVisible = title.includes(lowerQuery) || description.includes(lowerQuery);
    project.style.display = isVisible ? 'block' : 'none';
  });
}

function filterTasks(filter, projectId) {
  const taskCards = document.querySelectorAll(
    `#tasksGrid-${projectId} .task-card`,
  );
  const filterBtns = document.querySelectorAll(`.task-filters .filter-btn`);

  filterBtns.forEach((btn) => {
    btn.classList.remove("active");
    if (btn.textContent.toLowerCase().includes(filter)) {
      btn.classList.add("active");
    }
  });

  taskCards.forEach((card) => {
    if (filter === "all" || card.dataset.status === filter) {
      card.style.display = "block";
    } else {
      card.style.display = "none";
    }
  });
}

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
    }" 
         onclick="openTaskDetails(${task.id}, '${title}')">
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
  `,
    )
    .join("");
}

function showProjectContextMenu(event, projectId) {
  event.stopPropagation();
  event.preventDefault();

  const existingMenus = document.querySelectorAll(".context-menu");
  existingMenus.forEach((menu) => menu.remove());

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

  document.body.appendChild(menu);

  const removeMenu = (e) => {
    if (!menu.contains(e.target)) {
      menu.remove();
      document.removeEventListener("click", removeMenu);
    }
  };

  setTimeout(() => {
    document.addEventListener("click", removeMenu);
  }, 100);
}

async function showAllProjects() {
  console.log("📁 Showing all projects...");
  showLoader();

  try {
    const response = await fetch("/api/projects/all/");
    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || "Failed to load projects");
    }

    const mainContent = document.getElementById("mainContent");
    if (!mainContent) return;

    let projectsHtml;
    if (data.projects.length === 0) {
      projectsHtml = createEmptyProjectsPage();
    } else {
      projectsHtml = createProjectsListPage(data);
    }

    mainContent.innerHTML = projectsHtml;

    AppState.currentPage = "all-projects";
    updateSidebarActive("");
    localStorage.setItem("swyfttask-page", "all-projects");
    history.pushState({ page: "all-projects" }, "", "#all-projects");

    stopAutoRefresh();
    setupAllProjectsPage();
  } catch (error) {
    console.error("❌ Error loading all projects:", error);
    showNotification(`Failed to load projects: ${error.message}`, "error");
    restoreDashboard();
  } finally {
    hideLoader();
  }
}

function createProjectCard(project) {
  const projectCard = document.createElement("div");
  projectCard.className = `pinned-project ${project.css_class || ""}`;
  projectCard.setAttribute("data-project-id", project.id);

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
    <small>${project.progress || 0}% complete • ${
      project.task_count || 0
    } task${project.task_count !== 1 ? "s" : ""}</small>
    <div class="progress">
      <div class="progress-fill" style="width:${project.progress || 0}%"></div>
    </div>
  `;

  // Add click event to open project details
  projectCard.onclick = function (e) {
    if (!e.target.closest(".project-menu-btn")) {
      openProjectDetails(project.id, project.name);
    }
  };

  return projectCard;
}

function createEmptyProjectsPage() {
  return `
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
          <input type="text" id="projectsSearchInput" placeholder="Search projects..." 
                 onkeyup="filterProjects(this.value)">
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
}

function createProjectsListPage(data) {
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

  return `
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
          <input type="text" id="projectsSearchInput" placeholder="Search projects..." 
                 onkeyup="filterProjects(this.value)">
        </div>
      </div>
      
      <div class="projects-list" id="projectsList">
        ${projectsList}
      </div>
    </div>
  `;
}

function setupAllProjectsPage() {
  // Search functionality
  const searchInput = document.getElementById("projectsSearchInput");
  if (searchInput) {
    searchInput.addEventListener("input", function () {
      filterProjects(this.value);
    });
  }

  // Back button
  const backBtn = document.querySelector(".back-btn");
  if (backBtn) {
    backBtn.addEventListener("click", restoreDashboard);
  }

  // New project button
  const newProjectBtn = document.querySelector(".qa-btn");
  if (newProjectBtn && newProjectBtn.textContent.includes("New Project")) {
    newProjectBtn.addEventListener("click", showNewProjectForm);
  }
}

// =============================================
// PAGE RESTORATION
// =============================================

function restoreDashboard() {
  console.log("🔄 Restoring dashboard...");
  clearCurrentProject();
  hideLoader();

  if (!AppState.originalDashboardHTML) {
    console.error("❌ No dashboard HTML saved");
    window.location.reload();
    return;
  }

  const mainContent = document.getElementById("mainContent");
  if (!mainContent) return;

  mainContent.innerHTML = `
    <div id="originalDashboardContent">
      ${AppState.originalDashboardHTML}
    </div>
  `;

  AppState.currentPage = "dashboard";
  AppState.currentProjectId = null;
  AppState.currentTaskId = null;
  updateSidebarActive("overview");
  localStorage.setItem("swyfttask-page", "dashboard");
  history.pushState({ page: "dashboard" }, "", "#dashboard");

  startAutoRefresh();

  setTimeout(() => {
    setupEventListeners();
    setupSidebar();
    setupFormHandlers();
    setupTaskDragAndDrop(); // Important: Re-setup drag and drop
    loadDashboardData();
  }, 100);
}

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
      updateDashboardUI();
    }
  } catch (error) {
    console.error("Error loading dashboard data:", error);
  }
}

function updateDashboardUI() {
  if (!AppState.cachedData) {
    console.log("⚠️ No cached data available");
    return;
  }

  console.log("📊 Updating dashboard UI with cached data", {
    hasTasks: !!AppState.cachedData.tasks,
    hasCounts: !!AppState.cachedData.counts,
    hasProjects: !!AppState.cachedData.projects,
  });

  // Update counts
  updateDashboardCounts(AppState.cachedData.counts);

  // Update pinned projects (this one works)
  updatePinnedProjects(AppState.cachedData);

  // Update tasks due today
  updateTasksDueToday(AppState.cachedData);

  // Update Kanban board - with clearing
  if (AppState.cachedData.tasks) {
    console.log("🔄 Clearing and updating Kanban board...");
    updateKanbanBoard(AppState.cachedData.tasks);
  }

  // Update your tasks
  updateYourTasks(AppState.cachedData.tasks);

  // Update recent activity
  updateRecentActivity(AppState.cachedData.tasks);

  // Update team
  updateTeamOnline();

  console.log("✅ Complete dashboard UI updated");
  setupSearchFunctionality();
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
    loader.style.display = "none";
    loader.style.opacity = "0";
    loader.style.visibility = "hidden";
    loader.style.pointerEvents = "none";
  }

  document
    .querySelectorAll("button:disabled, input:disabled, textarea:disabled")
    .forEach((el) => {
      if (!el.classList.contains("validation-input")) {
        el.disabled = false;
      }
    });
}

function showNotification(message, type = "success") {
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

// =============================================
// OTHER PAGE FUNCTIONS
// =============================================

async function showTasksPage() {
  console.log("📋 Showing Tasks page...");
  showLoader();

  try {
    // Fetch ALL tasks from the API
    const response = await fetch("/api/dashboard/full-data/");
    const data = await response.json();

    if (!data.success) {
      throw new Error("Failed to load tasks");
    }

    const mainContent = document.getElementById("mainContent");
    if (!mainContent) return;

    // Create tasks page HTML
    mainContent.innerHTML = createTasksPageHTML();

    // Initialize the page
    setTimeout(() => {
      initializeTasksPage(data);
    }, 100);

    AppState.currentPage = "tasks";
    updateSidebarActive("tasks");
    localStorage.setItem("swyfttask-page", "tasks");
    history.pushState({ page: "tasks" }, "", "#tasks");

    stopAutoRefresh();
  } catch (error) {
    console.error("❌ Error loading tasks page:", error);
    showNotification(`Failed to load tasks: ${error.message}`, "error");
    restoreDashboard();
  } finally {
    hideLoader();
  }
}

function createTasksPageHTML() {
  return `
    <div class="tasks-page">
      <div class="tasks-header">
        <div class="page-title">
          <h1>Tasks</h1>
          <p class="muted">All tasks across projects</p>
        </div>
        <div class="page-actions">
          <button class="qa-btn" id="newTaskBtnFull">
            <i class="fa fa-plus"></i> New Task
          </button>
        </div>
      </div>

      <div class="tasks-controls">
        <div class="filter-tabs" id="filterTabs">
          <button class="filter-tab active" data-filter="all">All</button>          
          <button class="filter-tab" data-filter="assigned">Assigned</button>
          <button class="filter-tab" data-filter="overdue">Overdue</button>
          <button class="filter-tab" data-filter="completed">Completed</button>
        </div>

        <div class="view-toggle">
          <button class="view-btn active" data-view="kanban" title="Kanban View">
            <i class="fa-solid fa-table-cells"></i>
          </button>
          <button class="view-btn" data-view="list" title="List View">
            <i class="fa-solid fa-list-ul"></i>
          </button>
        </div>
      </div>

      <div id="kanbanView" class="tasks-view active">
        <div class="kanban-container" id="tasksKanbanContainer">
          <!-- Kanban columns will be populated by JavaScript -->
        </div>
      </div>

      <div id="listView" class="tasks-view">
        <div class="list-container">
          <div class="list-header">
            <div class="list-row header-row">
              <div class="col-checkbox"><input type="checkbox" id="selectAllTasks"></div>
              <div class="col-title">Title</div>
              <div class="col-project">Project</div>
              <div class="col-assignee">Assignee</div>
              <div class="col-due">Due Date</div>
              <div class="col-priority">Priority</div>
              <div class="col-status">Status</div>
            </div>
          </div>
          <div class="list-body" id="tasksListBody">
            <!-- Tasks will be populated here -->
          </div>
        </div>
      </div>
    </div>
  `;
}

function initializeTasksPage(data) {
  console.log(
    "🔧 Initializing tasks page with",
    data.tasks ? "data" : "no data",
  );

  // Setup view toggles
  setupViewToggles();

  // Setup filter tabs
  setupFilterTabs();

  // Populate both views
  populateKanbanView(data.tasks || {});
  populateListView(data.tasks || {});

  // Setup new task button
  const newTaskBtn = document.getElementById("newTaskBtnFull");
  if (newTaskBtn) {
    newTaskBtn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      console.log("New Task button clicked from tasks page");
      showNewTaskForm();
    });
  } else {
    console.error("❌ New task button not found!");
  }

  console.log("✅ Tasks page initialized");
}

function setupViewToggles() {
  const viewButtons = document.querySelectorAll(".view-toggle .view-btn");
  const views = document.querySelectorAll(".tasks-view");

  viewButtons.forEach((button) => {
    button.addEventListener("click", function () {
      const viewType = this.getAttribute("data-view");

      // Update active button
      viewButtons.forEach((btn) => btn.classList.remove("active"));
      this.classList.add("active");

      // Show selected view
      views.forEach((view) => {
        view.classList.remove("active");
        if (view.id === `${viewType}View`) {
          view.classList.add("active");
        }
      });
    });
  });
}

function setupFilterTabs() {
  const filterTabs = document.querySelectorAll(".filter-tabs .filter-tab");

  filterTabs.forEach((tab) => {
    tab.addEventListener("click", function () {
      const filterType = this.getAttribute("data-filter");

      // Update active tab
      filterTabs.forEach((t) => t.classList.remove("active"));
      this.classList.add("active");

      // Apply filter
      applyTaskFilter(filterType);
    });
  });
}

function applyTaskFilter(filterType) {
  console.log(`Applying filter: ${filterType}`);
  // Implement filtering logic based on your data structure
}

function setupTasksPageHandlers() {
  document.querySelectorAll(".add-task-btn").forEach((button) => {
    button.addEventListener("click", function () {
      const column = this.closest(".kanban-column");
      const status = column.getAttribute("data-status");
      showNewTaskForm(status);
    });
  });

  const backBtn = document.querySelector("#backDashboardBtn");
  if (backBtn) {
    backBtn.addEventListener("click", function (e) {
      e.preventDefault();
      restoreDashboard();
    });
  }
}

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
          ${createKanbanColumnsForTasks(data.tasks)}
        </div>
      </div>
    </div>
  `;
}

function createKanbanColumnsForTasks(tasksData) {
  const columns = [
    { id: "backlog", title: "Backlog", tasks: tasksData.todo || [] },
    { id: "todo", title: "To Do", tasks: tasksData.todo || [] },
    {
      id: "inprogress",
      title: "In Progress",
      tasks: tasksData.inprogress || [],
    },
    { id: "review", title: "Review", tasks: tasksData.review || [] },
    { id: "done", title: "Done", tasks: tasksData.done || [] },
  ];

  return columns
    .map(
      (column) => `
    <div class="kanban-column" data-status="${column.id}">
      <div class="column-header">
        <h4>${column.title} <span class="task-count">${
          column.tasks.length
        }</span></h4>
      </div>
      <div class="column-tasks">
        ${createTaskCardsForColumn(column.tasks)}
      </div>
      <button class="add-task-btn">+ Add task</button>
    </div>
  `,
    )
    .join("");
}

function populateKanbanView(tasksData) {
  const kanbanContainer = document.getElementById("tasksKanbanContainer");
  if (!kanbanContainer) {
    console.error("❌ Kanban container not found");
    return;
  }

  // Define columns
  const columns = [
    { id: "backlog", title: "Backlog", statuses: ["todo"] },
    { id: "todo", title: "To Do", statuses: ["todo"] },
    {
      id: "inprogress",
      title: "In Progress",
      statuses: ["inprogress", "pending"],
    },
    { id: "review", title: "Review", statuses: ["review"] },
    { id: "done", title: "Done", statuses: ["done", "completed"] },
  ];

  // Clear container
  kanbanContainer.innerHTML = "";

  // Create columns
  columns.forEach((column) => {
    // Get tasks for this column
    let columnTasks = [];
    column.statuses.forEach((status) => {
      if (tasksData[status]) {
        columnTasks = columnTasks.concat(tasksData[status]);
      }
    });

    // Remove duplicates
    const taskIds = new Set();
    columnTasks = columnTasks.filter((task) => {
      if (taskIds.has(task.id)) return false;
      taskIds.add(task.id);
      return true;
    });

    // Create column HTML
    const columnHTML = `
      <div class="tasks-column" data-status="${column.id}">
        <div class="column-header">
          <h3>${column.title} <span class="task-count">${
            columnTasks.length
          }</span></h3>
        </div>
        <div class="column-tasks" id="tasks-${column.id}">
          ${createTaskCardsForColumn(columnTasks)}
        </div>
        <button class="add-task-btn" onclick="showNewTaskForm('${column.id}')">
          + Add task
        </button>
      </div>
    `;

    kanbanContainer.innerHTML += columnHTML;
  });

  // Make tasks draggable
  setupTaskDragAndDrop();
}

function createTaskCardsForColumn(tasks) {
  if (!tasks || tasks.length === 0) {
    return `
      <div class="empty-column-state">
        <i class="far fa-clipboard"></i>
        <p>No tasks</p>
      </div>
    `;
  }

  return tasks
    .map(
      (task) => `
    <div class="task-card" data-task-id="${task.id}" draggable="true">
      <div class="task-card-content">
        <div class="task-header">
          <h4>${task.title}</h4>
          <span class="task-priority priority-${task.priority || "medium"}">
            ${task.priority || "medium"}
          </span>
        </div>
        ${
          task.description
            ? `<p class="task-description">${task.description.substring(
                0,
                100,
              )}${task.description.length > 100 ? "..." : ""}</p>`
            : ""
        }
        <div class="task-footer">
          <div class="task-assignee">
            ${
              task.assigned_to_name
                ? `
              <div class="assignee-avatar">
                ${task.assigned_to_name.charAt(0).toUpperCase()}
              </div>
              <small>${task.assigned_to_name}</small>
            `
                : '<span class="unassigned">Unassigned</span>'
            }
          </div>
          ${
            task.due_date
              ? `
            <div class="task-due ${isTaskOverdue(task) ? "overdue" : ""}">
              <i class="far fa-calendar"></i>
              ${new Date(task.due_date).toLocaleDateString()}
            </div>
          `
              : ""
          }
        </div>
      </div>
    </div>
  `,
    )
    .join("");
}

function populateListView(tasksData) {
  const listBody = document.getElementById("tasksListBody");
  if (!listBody) return;

  // Combine all tasks
  const allTasks = [];
  Object.values(tasksData).forEach((taskArray) => {
    allTasks.push(...taskArray);
  });

  // Remove duplicates
  const taskIds = new Set();
  const uniqueTasks = allTasks.filter((task) => {
    if (taskIds.has(task.id)) return false;
    taskIds.add(task.id);
    return true;
  });

  if (uniqueTasks.length === 0) {
    listBody.innerHTML = `
      <div class="empty-state">
        <i class="far fa-check-circle"></i>
        <h3>No tasks found</h3>
        <p>Create your first task to get started</p>
      </div>
    `;
    return;
  }

  // Create list rows
  listBody.innerHTML = uniqueTasks
    .map(
      (task) => `
    <div class="list-row task-row" data-task-id="${task.id}">
      <div class="col-checkbox">
        <input type="checkbox" class="task-checkbox">
      </div>
      <div class="col-title">
        <strong>${task.title}</strong>
        ${
          task.description
            ? `<small class="muted">${task.description.substring(0, 50)}${
                task.description.length > 50 ? "..." : ""
              }</small>`
            : ""
        }
      </div>
      <div class="col-project">
        ${task.project_name || "No project"}
      </div>
      <div class="col-assignee">
        ${
          task.assigned_to_name
            ? task.assigned_to_name
            : '<span class="muted">Unassigned</span>'
        }
      </div>
      <div class="col-due ${isTaskOverdue(task) ? "overdue" : ""}">
        ${
          task.due_date
            ? new Date(task.due_date).toLocaleDateString()
            : '<span class="muted">No due date</span>'
        }
      </div>
      <div class="col-priority priority-${task.priority || "medium"}">
        ${
          task.priority
            ? task.priority.charAt(0).toUpperCase() + task.priority.slice(1)
            : "Medium"
        }
      </div>
      <div class="col-status status-${task.status || "todo"}">
        ${
          task.status_display ||
          (task.status
            ? task.status.charAt(0).toUpperCase() + task.status.slice(1)
            : "To Do")
        }
      </div>
    </div>
  `,
    )
    .join("");

  // Add click handlers to rows
  document.querySelectorAll(".task-row").forEach((row) => {
    row.addEventListener("click", function (e) {
      if (!e.target.closest(".col-checkbox")) {
        const taskId = this.getAttribute("data-task-id");
        const taskTitle = this.querySelector(".col-title strong").textContent;
        openTaskDetails(taskId, taskTitle);
      }
    });
  });
}

function applyTaskFilter(filterType) {
  console.log(`Applying filter: ${filterType}`);

  const currentUserId = window.djangoData?.user?.id;
  const today = new Date().toISOString().split("T")[0];

  // Get all task cards
  const taskCards = document.querySelectorAll(".task-card");
  const listRows = document.querySelectorAll(".task-row");

  if (filterType === "all") {
    // Show all tasks
    taskCards.forEach((card) => (card.style.display = "block"));
    listRows.forEach((row) => (row.style.display = "flex"));
    return;
  }

  // Hide all first
  taskCards.forEach((card) => (card.style.display = "none"));
  listRows.forEach((row) => (row.style.display = "none"));

  // Show filtered tasks
  taskCards.forEach((card) => {
    const taskId = card.getAttribute("data-task-id");
    const taskElement = card;

    let shouldShow = false;

    switch (filterType) {
      case "my":
        // Show tasks assigned to current user
        const assigneeElement = taskElement.querySelector(
          ".task-assignee small, .task-assignee .unassigned",
        );
        if (assigneeElement) {
          const assigneeText = assigneeElement.textContent.toLowerCase();
          shouldShow =
            assigneeText.includes("you") ||
            assigneeText.includes(currentUserId);
        }
        break;

      case "assigned":
        // Show tasks with any assignee
        const hasAssignee = !taskElement.querySelector(".unassigned");
        shouldShow = hasAssignee;
        break;

      case "overdue":
        // Show overdue tasks
        const dueElement = taskElement.querySelector(".task-due.overdue");
        shouldShow = !!dueElement;
        break;

      case "completed":
        // Show completed tasks (in Done column)
        const column = taskElement.closest(".tasks-column");
        shouldShow = column && column.getAttribute("data-status") === "done";
        break;
    }

    if (shouldShow) {
      card.style.display = "block";
    }
  });

  // Also filter list view
  listRows.forEach((row) => {
    const statusClass = row.querySelector(".col-status").className;
    const isDone = statusClass.includes("status-done");
    const isOverdue = row.querySelector(".col-due.overdue");
    const assigneeText = row.querySelector(".col-assignee").textContent;

    let shouldShow = false;

    switch (filterType) {
      case "my":
        shouldShow =
          assigneeText.includes("You") || assigneeText.includes(currentUserId);
        break;
      case "assigned":
        shouldShow = !assigneeText.includes("Unassigned");
        break;
      case "overdue":
        shouldShow = !!isOverdue;
        break;
      case "completed":
        shouldShow = isDone;
        break;
    }

    if (shouldShow) {
      row.style.display = "flex";
    }
  });
}

function isTaskOverdue(task) {
  if (!task.due_date) return false;
  const dueDate = new Date(task.due_date);
  const today = new Date();
  return dueDate < today && task.status !== "done";
}

// =============================================
// TASK DETAILS - MISSING FUNCTIONS
// =============================================

function showTaskMenu(event, taskId) {
  event.stopPropagation();
  event.preventDefault();

  // Remove any existing menus
  const existingMenus = document.querySelectorAll(".context-menu");
  existingMenus.forEach((menu) => menu.remove());

  // Create context menu
  const menu = document.createElement("div");
  menu.className = "context-menu";
  menu.style.cssText = `
    position: fixed;
    left: ${event.clientX}px;
    top: ${event.clientY}px;
    background: rgba(20, 20, 30, 0.98);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 8px 0;
    min-width: 180px;
    z-index: 10000;
    backdrop-filter: blur(20px);
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  `;

  menu.innerHTML = `
    <button class="menu-item" onclick="toggleTaskStar(${taskId})">
      <i class="fa fa-star"></i> Star Task
    </button>
    <button class="menu-item" onclick="duplicateTask(${taskId})">
      <i class="fa fa-copy"></i> Duplicate
    </button>
    <button class="menu-item" onclick="moveTaskToProject(${taskId})">
      <i class="fa fa-arrows-alt"></i> Move to Project
    </button>
    <hr>
    <button class="menu-item delete" onclick="deleteTask(${taskId})">
      <i class="fa fa-trash"></i> Delete Task
    </button>
  `;

  document.body.appendChild(menu);

  // Remove menu on click outside
  const removeMenu = (e) => {
    if (!menu.contains(e.target)) {
      menu.remove();
      document.removeEventListener("click", removeMenu);
    }
  };

  setTimeout(() => {
    document.addEventListener("click", removeMenu);
  }, 100);
}

async function toggleTaskStar(taskId) {
  try {
    // In a real app, you would have a starred field in your Task model
    // For now, we'll use localStorage
    const starredTasks = JSON.parse(
      localStorage.getItem("starredTasks") || "[]",
    );
    const isStarred = starredTasks.includes(taskId);

    if (isStarred) {
      // Remove from starred
      const index = starredTasks.indexOf(taskId);
      starredTasks.splice(index, 1);
      showNotification("Task unstarred", "info");
    } else {
      // Add to starred
      starredTasks.push(taskId);
      showNotification("Task starred", "success");
    }

    localStorage.setItem("starredTasks", JSON.stringify(starredTasks));

    // Update UI
    const starBtn = document.querySelector(".task-actions .fa-star");
    if (starBtn) {
      if (isStarred) {
        starBtn.parentElement.classList.remove("starred");
      } else {
        starBtn.parentElement.classList.add("starred");
      }
    }
  } catch (error) {
    console.error("Error toggling task star:", error);
    showNotification("Failed to update task", "error");
  }
}

async function duplicateTask(taskId) {
  if (!confirm("Duplicate this task?")) return;

  try {
    // Fetch the original task
    const response = await fetch(`/api/tasks/${taskId}/`);
    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || "Failed to fetch task");
    }

    const task = data.task;

    // Create a duplicate with "Copy" in the title
    const duplicateData = {
      title: `${task.title} (Copy)`,
      description: task.description,
      project: task.project.id,
      assigned_to: task.assigned_to?.id || null,
      status: "todo", // Reset status to todo
      priority: task.priority,
      due_date: task.due_date,
    };

    const createResponse = await fetch("/api/tasks/create/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": getCSRFToken(),
      },
      body: JSON.stringify(duplicateData),
    });

    const createResult = await createResponse.json();

    if (createResult.success) {
      showNotification("Task duplicated successfully!", "success");
      // Open the new task
      setTimeout(() => {
        openTaskDetails(createResult.task.id, createResult.task.title);
      }, 1000);
    } else {
      showNotification(
        createResult.error || "Failed to duplicate task",
        "error",
      );
    }
  } catch (error) {
    console.error("Error duplicating task:", error);
    showNotification("Failed to duplicate task", "error");
  }
}

// =============================================
// TASK DELETION - FIXED
// =============================================

async function deleteTask(taskId) {
  if (
    !confirm(
      "Are you sure you want to delete this task? This action cannot be undone.",
    )
  )
    return;

  showLoader();

  try {
    const response = await fetch(`/api/tasks/${taskId}/delete/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": getCSRFToken(),
      },
    });

    const result = await response.json();

    if (result.success) {
      showNotification("Task deleted successfully!", "success");

      // Refresh dashboard data immediately
      await refreshDashboardData(true);

      // If we're in project details, refresh that too
      if (AppState.currentProjectId) {
        const projectName =
          document.querySelector(".project-title")?.textContent || "";
        openProjectDetails(AppState.currentProjectId, projectName);
      } else {
        // Otherwise go back to dashboard
        setTimeout(() => {
          restoreDashboard();
        }, 500);
      }
    } else {
      showNotification(result.error || "Failed to delete task", "error");
    }
  } catch (error) {
    console.error("Error deleting task:", error);
    showNotification("Failed to delete task", "error");
  } finally {
    hideLoader();
  }
}

// =============================================
// COMMENT EDITING - FIXED
// =============================================

function editComment(commentId) {
  const allComments = document.querySelectorAll(".activity-item.comment");
  let commentElement = null;

  // Find the comment element
  allComments.forEach((comment) => {
    const editLink = comment.querySelector("a");
    if (
      editLink &&
      editLink.onclick &&
      editLink.onclick.toString().includes(commentId)
    ) {
      commentElement = comment;
    }
  });

  if (!commentElement) return;

  const commentBody = commentElement.querySelector(".comment-body p");
  const currentContent = commentBody.textContent;

  // Replace with textarea for editing
  const textarea = document.createElement("textarea");
  textarea.value = currentContent;
  textarea.className = "comment-edit-textarea";
  textarea.style.cssText = `
    width: 100%;
    min-height: 60px;
    padding: 8px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 6px;
    color: #fff;
    font-family: inherit;
    resize: vertical;
  `;

  commentBody.parentNode.replaceChild(textarea, commentBody);

  // Add save/cancel buttons
  const actionsDiv = commentElement.querySelector(".comment-actions");
  const originalHTML = actionsDiv.innerHTML;

  actionsDiv.innerHTML = `
    <button class="qa-btn small-btn" onclick="saveCommentEdit(${commentId}, this)">Save</button>
    <button class="qa-btn small-btn cancel-btn" onclick="cancelCommentEdit(this, '${currentContent.replace(/'/g, "\\'").replace(/"/g, '\\"')}')">Cancel</button>
  `;

  // Store original state
  commentElement.dataset.originalContent = currentContent;
  commentElement.dataset.originalActions = originalHTML;
}

async function saveCommentEdit(commentId, button) {
  const commentElement = button.closest(".activity-item.comment");
  const textarea = commentElement.querySelector(".comment-edit-textarea");
  const newContent = textarea.value.trim();

  if (!newContent) {
    showNotification("Comment cannot be empty", "error");
    return;
  }

  try {
    // In a real app, you would update via API
    // For now, update UI directly
    const commentBody = document.createElement("p");
    commentBody.textContent = newContent;

    textarea.parentNode.replaceChild(commentBody, textarea);

    // Restore actions
    const actionsDiv = commentElement.querySelector(".comment-actions");
    actionsDiv.innerHTML = `<span class="muted">Edited just now</span> · <a href="#" onclick="editComment(${commentId})">Edit</a>`;

    showNotification("Comment updated", "success");
  } catch (error) {
    console.error("Error saving comment edit:", error);
    showNotification("Failed to update comment", "error");
  }
}

function cancelCommentEdit(button, originalContent) {
  const commentElement = button.closest(".activity-item.comment");

  // Restore original content
  const textarea = commentElement.querySelector(".comment-edit-textarea");
  if (textarea) {
    const commentBody = document.createElement("p");
    commentBody.textContent = originalContent;
    textarea.parentNode.replaceChild(commentBody, textarea);
  }

  // Restore original actions
  const actionsDiv = commentElement.querySelector(".comment-actions");
  if (commentElement.dataset.originalActions) {
    actionsDiv.innerHTML = commentElement.dataset.originalActions;
  }
}

// =============================================
// TASK MOVEMENT - FIXED
// =============================================

async function moveTaskToProject(taskId) {
  showLoader();

  try {
    // Get all projects for the current user
    const response = await fetch("/api/projects/all/");
    const data = await response.json();

    if (data.success) {
      // Create project selection modal
      const modal = document.createElement("div");
      modal.className = "modal-overlay";
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
        padding: 24px;
        max-width: 400px;
        width: 90%;
        color: white;
      `;

      const projectsOptions = data.projects
        .map(
          (project) => `<option value="${project.id}">${project.name}</option>`,
        )
        .join("");

      modalContent.innerHTML = `
        <h3 style="margin-top: 0;">Move Task to Project</h3>
        <p>Select a project to move this task to:</p>
        <select id="projectSelect" class="form-select" style="width: 100%; margin: 16px 0; padding: 10px; background: #111; color: white; border: 1px solid #333; border-radius: 6px;">
          ${projectsOptions}
        </select>
        <div style="display: flex; gap: 10px; margin-top: 20px;">
          <button class="qa-btn cancel-btn" style="flex: 1;" onclick="closeModal()">
            Cancel
          </button>
          <button class="qa-btn" style="flex: 1; background: #00aaff;" onclick="confirmMoveTask(${taskId})">
            Move
          </button>
        </div>
      `;

      modal.appendChild(modalContent);
      document.body.appendChild(modal);

      // Store modal reference
      window.currentModal = modal;
    }
  } catch (error) {
    console.error("Error loading projects:", error);
    showNotification("Failed to load projects", "error");
  } finally {
    hideLoader();
  }
}

function closeModal() {
  if (window.currentModal) {
    window.currentModal.remove();
    window.currentModal = null;
  }
}

async function confirmMoveTask(taskId) {
  const projectSelect = document.getElementById("projectSelect");
  if (!projectSelect) return;

  const newProjectId = projectSelect.value;

  if (!newProjectId) {
    showNotification("Please select a project", "error");
    return;
  }

  showLoader();

  try {
    // Update task project
    const response = await fetch(`/api/tasks/${taskId}/update/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": getCSRFToken(),
      },
      body: JSON.stringify({
        project: newProjectId,
      }),
    });

    const result = await response.json();

    if (result.success) {
      showNotification("Task moved to new project", "success");

      // Close modal
      closeModal();

      // Reload task details
      setTimeout(() => {
        const taskTitle =
          document.getElementById("taskTitle")?.textContent || "Task";
        openTaskDetails(taskId, taskTitle);
      }, 500);
    } else {
      showNotification(result.error || "Failed to move task", "error");
    }
  } catch (error) {
    console.error("Error moving task:", error);
    showNotification("Failed to move task", "error");
  } finally {
    hideLoader();
  }
}

// =============================================
// STUB FUNCTIONS FOR OTHER PAGES
// =============================================

function showProfilePage() {
  const mainContent = document.getElementById("mainContent");
  if (!mainContent) return;

  const template = document.getElementById("profile-template");
  if (!template) {
    showNotification("Profile page coming soon!", "info");
    return;
  }

  mainContent.innerHTML = "";
  mainContent.appendChild(template.content.cloneNode(true));

  AppState.currentPage = "profile";
  updateSidebarActive("");
  localStorage.setItem("swyfttask-page", "profile");
  history.pushState({ page: "profile" }, "", "#profile");

  stopAutoRefresh();
}

function showSettingsPage() {
  const mainContent = document.getElementById("mainContent");
  if (!mainContent) return;

  const template = document.getElementById("settings-template");
  if (!template) {
    showNotification("Settings page coming soon!", "info");
    return;
  }

  mainContent.innerHTML = "";
  mainContent.appendChild(template.content.cloneNode(true));

  AppState.currentPage = "settings";
  updateSidebarActive("settings");
  localStorage.setItem("swyfttask-page", "settings");
  history.pushState({ page: "settings" }, "", "#settings");

  stopAutoRefresh();
}

function showNotificationsPage() {
  const mainContent = document.getElementById("mainContent");
  if (!mainContent) return;

  const template = document.getElementById("notifications-template");
  if (!template) {
    showNotification("Notifications page coming soon!", "info");
    return;
  }

  mainContent.innerHTML = "";
  mainContent.appendChild(template.content.cloneNode(true));

  AppState.currentPage = "notifications";
  updateSidebarActive("");
  localStorage.setItem("swyfttask-page", "notifications");
  history.pushState({ page: "notifications" }, "", "#notifications");

  stopAutoRefresh();
}

function showInviteForm() {
  showNotification("Invite functionality coming soon!", "info");
}

function showTeamsPage() {
  showNotification("Teams page coming soon!", "info");
}

function showBillingPage() {
  showNotification("Billing page coming soon!", "info");
}

function showHelpPage() {
  showNotification("Help page coming soon!", "info");
}

function toggleTheme() {
  const isDark = document.body.classList.contains("dark-theme");
  if (isDark) {
    document.body.classList.remove("dark-theme");
    localStorage.setItem("theme", "light");
    showNotification("Switched to light theme", "success");
  } else {
    document.body.classList.add("dark-theme");
    localStorage.setItem("theme", "dark");
    showNotification("Switched to dark theme", "success");
  }
}

function logoutUser() {
  if (confirm("Are you sure you want to logout?")) {
    window.location.href = "/accounts/logout/";
  }
}

// =============================================
// ADDITIONAL UTILITIES
// =============================================

function setupTaskDragAndDrop() {
  const kanbanBoard = document.getElementById("kanbanBoard");
  if (!kanbanBoard) {
    console.log("❌ Kanban board not found for drag and drop");
    return;
  }

  console.log("🎯 Setting up drag and drop...");

  let draggedTask = null;
  let draggedTaskOriginalColumn = null;

  // Add dragstart event to each task
  document.addEventListener(
    "dragstart",
    function (e) {
      if (
        e.target.classList.contains("kanban-task") &&
        !e.target.classList.contains("empty") &&
        !e.target.classList.contains("more-tasks")
      ) {
        draggedTask = e.target;
        draggedTaskOriginalColumn = draggedTask.closest(".kanban-column");

        // Set data for transfer
        e.dataTransfer.setData(
          "text/plain",
          e.target.getAttribute("data-task-id"),
        );
        e.dataTransfer.effectAllowed = "move";

        // Visual feedback
        setTimeout(() => {
          e.target.style.opacity = "0.4";
        }, 0);

        console.log(
          `🧲 Started dragging task ${e.target.getAttribute("data-task-id")}`,
        );
      }
    },
    false,
  );

  // Add dragend event
  document.addEventListener(
    "dragend",
    function (e) {
      if (draggedTask) {
        draggedTask.style.opacity = "1";
        draggedTask = null;
        draggedTaskOriginalColumn = null;
      }

      // Reset column backgrounds
      document.querySelectorAll(".kanban-column").forEach((col) => {
        col.style.backgroundColor = "";
      });
    },
    false,
  );

  // Add dragover to columns
  document.querySelectorAll(".kanban-column").forEach((column) => {
    column.addEventListener(
      "dragover",
      function (e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        this.style.backgroundColor = "rgba(0, 170, 255, 0.1)";
      },
      false,
    );

    column.addEventListener(
      "dragleave",
      function (e) {
        // Only remove highlight if leaving the column
        if (!this.contains(e.relatedTarget)) {
          this.style.backgroundColor = "";
        }
      },
      false,
    );

    column.addEventListener(
      "drop",
      async function (e) {
        e.preventDefault();
        e.stopPropagation();

        this.style.backgroundColor = "";

        if (!draggedTask) return;

        const taskId = draggedTask.getAttribute("data-task-id");
        const newStatus = this.getAttribute("data-column");
        const originalStatus =
          draggedTaskOriginalColumn?.getAttribute("data-column");

        // Don't do anything if dropped in same column
        if (originalStatus === newStatus) {
          console.log("ℹ️ Task dropped in same column");
          return;
        }

        console.log(
          `🔄 Moving task ${taskId} from ${originalStatus} to ${newStatus}`,
        );

        // Remove from old column
        draggedTask.remove();

        // Add to new column
        this.appendChild(draggedTask);

        // Update visual styling
        draggedTask.classList.remove("complete");
        if (newStatus === "done") {
          draggedTask.classList.add("complete");
        }

        // Update via API
        try {
          const response = await fetch("/api/tasks/update-status/", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-CSRFToken": getCSRFToken(),
            },
            body: JSON.stringify({
              task_id: taskId,
              status: newStatus,
            }),
          });

          const result = await response.json();

          if (result.success) {
            console.log(`✅ Task status updated to ${newStatus}`);
            showNotification(`Task moved to ${newStatus}`, "success");

            // Refresh dashboard data
            setTimeout(() => {
              refreshDashboardData(true);
            }, 500);
          } else {
            console.error("❌ Failed to update task:", result.error);

            // Revert on error
            if (draggedTaskOriginalColumn) {
              draggedTaskOriginalColumn.appendChild(draggedTask);
              draggedTask.classList.toggle(
                "complete",
                originalStatus === "done",
              );
            }

            showNotification(result.error || "Failed to update task", "error");
          }
        } catch (error) {
          console.error("❌ Network error:", error);

          // Revert on network error
          if (draggedTaskOriginalColumn) {
            draggedTaskOriginalColumn.appendChild(draggedTask);
            draggedTask.classList.toggle("complete", originalStatus === "done");
          }

          showNotification("Network error updating task", "error");
        }
      },
      false,
    );
  });

  console.log("✅ Drag and drop setup complete");
}

function handleDragStart(e) {
  if (
    !e.target.classList.contains("kanban-task") ||
    e.target.classList.contains("empty") ||
    e.target.classList.contains("more-tasks")
  ) {
    return;
  }

  e.dataTransfer.setData("text/plain", e.target.dataset.taskId);
  e.target.classList.add("dragging");

  // Add a delay before setting opacity to avoid visual glitch
  setTimeout(() => {
    e.target.style.opacity = "0.4";
  }, 0);
}

function handleDragEnd(e) {
  const draggingElement = document.querySelector(".kanban-task.dragging");
  if (draggingElement) {
    draggingElement.classList.remove("dragging");
    draggingElement.style.opacity = "1";
  }
}

// Helper function to determine where to insert the dragged task
function getDragAfterElement(container, y) {
  const draggableElements = [
    ...container.querySelectorAll(
      ".kanban-task:not(.empty):not(.more-tasks):not(.dragging)",
    ),
  ];

  return draggableElements.reduce(
    (closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;

      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child };
      } else {
        return closest;
      }
    },
    { offset: Number.NEGATIVE_INFINITY },
  ).element;
}

// Add this debug function
function debugDragAndDrop() {
  const kanbanBoard = document.getElementById("kanbanBoard");
  if (!kanbanBoard) {
    console.log("❌ No Kanban board found");
    return;
  }

  console.log("🔍 Debug drag and drop setup:");

  // Check if tasks are draggable
  const tasks = kanbanBoard.querySelectorAll(".kanban-task");
  console.log(`Found ${tasks.length} tasks`);

  tasks.forEach((task, index) => {
    console.log(`Task ${index}:`, {
      id: task.getAttribute("data-task-id"),
      draggable: task.getAttribute("draggable"),
      hasClickHandler: !!task.onclick,
      classList: task.className,
    });
  });

  // Check event listeners
  console.log("Event listeners:", {
    hasDragStart: !!kanbanBoard.ondragstart,
    hasDragEnd: !!kanbanBoard.ondragend,
    hasDragOver: !!kanbanBoard.ondragover,
    hasDrop: !!kanbanBoard.ondrop,
  });
}

function debugTaskTimestamps() {
  console.log("🕒 Debug task timestamps:");

  if (AppState.cachedData && AppState.cachedData.tasks) {
    // Check all tasks
    ["todo", "inprogress", "review", "done"].forEach((status) => {
      const tasks = AppState.cachedData.tasks[status] || [];
      console.log(`${status} tasks (${tasks.length}):`);

      tasks.forEach((task, index) => {
        console.log(`  ${index + 1}. "${task.title}"`, {
          id: task.id,
          created_at: task.created_at,
          updated_at: task.updated_at,
          assigned_to_name: task.assigned_to_name,
          status: task.status,
        });
      });
    });
  }
}

function debugTimezone() {
  console.log("🌍 Timezone debug:", {
    currentTime: new Date().toISOString(),
    localTime: new Date().toString(),
    timezoneOffset: new Date().getTimezoneOffset() + " minutes",
    timezoneOffsetHours: new Date().getTimezoneOffset() / 60 + " hours",
    isDST:
      new Date().getTimezoneOffset() <
      Math.max(
        new Date(2024, 0, 1).getTimezoneOffset(),
        new Date(2024, 6, 1).getTimezoneOffset(),
      ),
  });

  // Test with your Django time
  const djangoTime = "2026-01-20 03:46:34";
  const asUTC = new Date(djangoTime.replace(" ", "T") + "Z");
  const asLocal = new Date(djangoTime.replace(" ", "T"));

  console.log("🧪 Django time test:", {
    djangoTime: djangoTime,
    asUTC: asUTC.toISOString(),
    asLocal: asLocal.toISOString(),
    asUTCDisplay: asUTC.toString(),
    asLocalDisplay: asLocal.toString(),
    difference: (asLocal - asUTC) / (1000 * 60 * 60) + " hours",
  });
}

// =============================================
// TASK DETAILS PAGE - UPDATED WITH LIVE DATA
// =============================================

async function openTaskDetails(taskId, taskTitle) {
  console.log(`📖 Opening task ${taskId}: ${taskTitle}`);
  showLoader();
  AppState.currentTaskId = taskId;

  try {
    // Fetch task details from API
    const response = await fetch(`/api/tasks/${taskId}/`);
    if (!response.ok) {
      throw new Error(`Failed to fetch task: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || "Failed to load task details");
    }

    const task = data.task;

    const mainContent = document.getElementById("mainContent");
    if (!mainContent) return;

    // Create task details page with live data
    const html = createTaskDetailsHTML(task);
    mainContent.innerHTML = html;

    // Setup event listeners for task details page
    setupTaskDetailsPage(task);

    AppState.currentPage = "task-details";
    updateSidebarActive("");
    localStorage.setItem("swyfttask-page", `task-${taskId}`);
    history.pushState(
      { page: "task-details", taskId: taskId },
      "",
      `#task-${taskId}`,
    );

    stopAutoRefresh();
  } catch (error) {
    console.error("❌ Error loading task details:", error);
    showNotification(`Failed to load task details: ${error.message}`, "error");
    restoreDashboard();
  } finally {
    hideLoader();
  }
}

function createTaskDetailsHTML(task) {
  // Format due date display
  let dueDateDisplay = "No deadline";
  let dueDateClass = "";
  let timeLeft = "";

  if (task.due_date) {
    const dueDate = new Date(task.due_date);
    const today = new Date();
    const diffTime = dueDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    dueDateDisplay = dueDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    if (diffDays === 0) {
      timeLeft = "Due Today";
      dueDateClass = "urgent";
    } else if (diffDays < 0) {
      timeLeft = `${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? "s" : ""} overdue`;
      dueDateClass = "critical";
    } else {
      timeLeft = `in ${diffDays} day${diffDays !== 1 ? "s" : ""}`;
      dueDateClass = diffDays <= 3 ? "urgent" : "";
    }
  }

  // Format priority badge
  const priorityClasses = {
    urgent: "critical",
    high: "urgent",
    medium: "warning",
    low: "",
  };

  const priorityClass = priorityClasses[task.priority] || "";

  // Format assignee info
  let assigneeHTML = "";
  if (task.assigned_to) {
    assigneeHTML = `
      <div class="assignees-section">
        <strong>Assigned To</strong>
        <div class="avatar-group">
          <div class="avatar online" title="${task.assigned_to.full_name || task.assigned_to.username}">
            ${task.assigned_to.initial}
          </div>
          <span>${task.assigned_to.full_name || task.assigned_to.username}</span>
        </div>
      </div>
    `;
  }

  // Format project link
  const projectLink = `
    <div class="project-link">
      <i class="fa fa-briefcase"></i>
      <a href="#" onclick="openProjectDetails(${task.project.id}, '${task.project.name}')">
        ${task.project.name}
      </a>
    </div>
  `;

  return `
    <div class="task-details-page">
      <div class="task-header-bar">
        <button id="backDashboardBtn" class="qa-btn back-btn">
          <i class="fa fa-arrow-left"></i> Back
        </button>
        <div class="task-title-wrapper">
          <h1 contenteditable="true" id="taskTitle" class="task-title">${task.title}</h1>
          <!-- <span class="task-id muted">#TASK-${task.id}</span> -->
        </div>
        <div class="task-actions">
          <button class="icon-btn" onclick="toggleTaskStar(${task.id})" title="Star">
            <i class="fa fa-star"></i>
          </button>
          <button class="icon-btn more-btn" onclick="showTaskMenu(event, ${task.id})" title="More options">
            <i class="fa fa-ellipsis-h"></i>
          </button>
        </div>
      </div>

      <div class="task-main-grid">
        <div class="task-left">
          <div class="task-meta-bar">
            <select id="taskStatus" class="status-select ${task.status}">
              <option value="todo" ${task.status === "todo" ? "selected" : ""}>To Do</option>
              <option value="inprogress" ${task.status === "inprogress" ? "selected" : ""}>In Progress</option>
              <option value="review" ${task.status === "review" ? "selected" : ""}>Review</option>
              <option value="done" ${task.status === "done" ? "selected" : ""}>Done</option>
            </select>
            <div class="priority-badge ${priorityClass}">
              ${task.priority_display || task.priority.charAt(0).toUpperCase() + task.priority.slice(1)} Priority
            </div>
            ${
              task.due_date
                ? `
              <div class="due-date ${dueDateClass}">
                <i class="fa fa-clock"></i>
                <span>Due ${dueDateDisplay} · <strong>${timeLeft}</strong></span>
              </div>
            `
                : ""
            }
          </div>

          ${assigneeHTML}
          
          ${projectLink}

          <section class="task-section">
            <h3>Description</h3>
            <div class="rich-text" contenteditable="true" id="taskDescription" 
                 placeholder="Add a detailed description...">
              ${task.description || "No description provided. Click to add one."}
            </div>
          </section>

          <section class="task-section activity">
            <h3>Activity & Comments</h3>
            <div class="comment-stream" id="commentStream">
              <div class="activity-item system">
                <i class="fa fa-plus"></i>
                <div>
                  <strong>${task.created_by.full_name || task.created_by.username}</strong> 
                  created this task 
                  <span class="muted">${formatTimeAgo(task.created_at)}</span>
                </div>
              </div>
              <div class="activity-item system">
                <i class="fa fa-flag"></i>
                <div>
                  Priority set to 
                  <strong>${task.priority_display || task.priority}</strong>
                </div>
              </div>
              <!-- Comments will be loaded here -->
            </div>

            <div class="comment-box">
              <div class="avatar">
                ${window.djangoData?.user?.firstName?.charAt(0) || "U"}
              </div>
              <textarea id="commentInput" placeholder="Write a comment..."></textarea>
              <button class="send-comment" onclick="addComment(${task.id})">
                <i class="fa fa-paper-plane"></i>
              </button>
            </div>
          </section>
        </div>

        <aside class="task-sidebar">
          <div class="sidebar-panel">
            <h4>Details</h4>
            <div class="date-field">
              <label>Due Date</label>
              <input type="date" id="taskDueDate" value="${task.due_date || ""}">
            </div>
            <div class="date-field">
              <label>Priority</label>
              <select id="taskPriority" class="priority-select">
                <option value="low" ${task.priority === "low" ? "selected" : ""}>Low</option>
                <option value="medium" ${task.priority === "medium" ? "selected" : ""}>Medium</option>
                <option value="high" ${task.priority === "high" ? "selected" : ""}>High</option>
                <option value="urgent" ${task.priority === "urgent" ? "selected" : ""}>Urgent</option>
              </select>
            </div>
            <div class="date-field">
              <label>Assign To</label>
              <select id="taskAssignee">
                <option value="">Unassigned</option>
                <!-- Options will be populated dynamically -->
              </select>
            </div>
          </div>

          <div class="sidebar-panel">
            <h4>Info</h4>
            <div class="info-item">
              <span>Created by</span>
              <strong>${task.created_by.full_name || task.created_by.username}</strong>
            </div>
            <div class="info-item">
              <span>Created</span>
              <strong>${formatDate(task.created_at)}</strong>
            </div>
            <div class="info-item">
              <span>Last updated</span>
              <strong>${formatTimeAgo(task.updated_at)}</strong>
            </div>
          </div>
          
          <div class="sidebar-panel">
            <h4>Actions</h4>
            <button class="qa-btn full-width" onclick="duplicateTask(${task.id})">
              <i class="fa fa-copy"></i> Duplicate Task
            </button>
            <button class="qa-btn full-width delete-btn" onclick="deleteTask(${task.id})">
              <i class="fa fa-trash"></i> Delete Task
            </button>
          </div>
        </aside>
      </div>
    </div>
  `;
}

function setupTaskDetailsPage(task) {
  // Back button
  const backBtn = document.getElementById("backDashboardBtn");
  if (backBtn) {
    backBtn.addEventListener("click", restoreDashboard);
  }

  // Status update
  const statusSelect = document.getElementById("taskStatus");
  if (statusSelect) {
    statusSelect.addEventListener("change", function () {
      updateTaskStatus(task.id, this.value);
    });
  }

  // Title update
  const taskTitle = document.getElementById("taskTitle");
  if (taskTitle) {
    taskTitle.addEventListener("blur", function () {
      saveTaskField(task.id, "title", this.textContent);
    });
  }

  // Description update
  const description = document.getElementById("taskDescription");
  if (description) {
    description.addEventListener("blur", function () {
      saveTaskField(task.id, "description", this.textContent);
    });
  }

  // Due date update
  const dueDateInput = document.getElementById("taskDueDate");
  if (dueDateInput) {
    dueDateInput.addEventListener("change", function () {
      saveTaskField(task.id, "due_date", this.value);
    });
  }

  // Priority update
  const prioritySelect = document.getElementById("taskPriority");
  if (prioritySelect) {
    prioritySelect.addEventListener("change", function () {
      saveTaskField(task.id, "priority", this.value);
    });
  }

  // Assignee update
  const assigneeSelect = document.getElementById("taskAssignee");
  if (assigneeSelect) {
    // Load project members
    loadProjectMembers(task.project.id, assigneeSelect, task.assigned_to?.id);

    assigneeSelect.addEventListener("change", function () {
      saveTaskField(task.id, "assigned_to", this.value || null);
    });
  }

  // Load comments
  loadComments(task.id);

  // Comment input
  const commentInput = document.getElementById("commentInput");
  if (commentInput) {
    commentInput.addEventListener("keypress", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        addComment(task.id);
      }
    });
  }
}

async function saveTaskField(taskId, field, value) {
  try {
    const response = await fetch(`/api/tasks/${taskId}/update/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": getCSRFToken(),
      },
      body: JSON.stringify({
        [field]: value,
      }),
    });

    const result = await response.json();

    if (result.success) {
      showNotification(`${field.replace("_", " ")} updated`, "success");

      // Refresh dashboard data immediately
      await refreshDashboardData(true);

      // Update UI if needed
      if (field === "status") {
        const statusElement = document.querySelector(".status-select");
        if (statusElement) {
          statusElement.className = `status-select ${value}`;
        }
      }
    } else {
      showNotification(result.error || `Failed to update ${field}`, "error");
    }
  } catch (error) {
    console.error(`Error updating ${field}:`, error);
    showNotification(`Network error updating ${field}`, "error");
  }
}

async function loadProjectMembers(projectId, selectElement, selectedUserId) {
  try {
    const response = await fetch(`/api/projects/${projectId}/members/`);
    const data = await response.json();

    if (data.success) {
      // Clear existing options except first one
      while (selectElement.options.length > 1) {
        selectElement.remove(1);
      }

      // Add current user first
      const currentUserOption = document.createElement("option");
      currentUserOption.value = window.djangoData?.user?.id || "";
      currentUserOption.textContent = `${window.djangoData?.user?.firstName || "You"} (You)`;
      if (selectedUserId === window.djangoData?.user?.id) {
        currentUserOption.selected = true;
      }
      selectElement.appendChild(currentUserOption);

      // Add other members
      data.members.forEach((member) => {
        if (member.id !== window.djangoData?.user?.id) {
          const option = document.createElement("option");
          option.value = member.id;
          option.textContent = member.full_name || member.username;
          if (member.id === selectedUserId) {
            option.selected = true;
          }
          selectElement.appendChild(option);
        }
      });
    }
  } catch (error) {
    console.error("Error loading project members:", error);
  }
}

async function loadComments(taskId) {
  try {
    const response = await fetch(`/api/tasks/${taskId}/comments/`);
    const data = await response.json();

    if (data.success) {
      const commentStream = document.getElementById("commentStream");
      if (!commentStream) return;

      // Clear existing comments (keep the system activity items)
      const systemItems = commentStream.querySelectorAll(
        ".activity-item.system",
      );
      commentStream.innerHTML = "";

      // Add back system items
      systemItems.forEach((item) => {
        commentStream.appendChild(item);
      });

      // Add comments
      data.comments.forEach((comment) => {
        const commentElement = document.createElement("div");
        commentElement.className = "activity-item comment";
        commentElement.innerHTML = `
          <div class="avatar" title="${comment.user.full_name}">
            ${comment.user.initial}
          </div>
          <div class="comment-body">
            <strong>${comment.user.full_name}</strong>
            <p>${comment.content}</p>
            <div class="comment-actions">
              <span class="muted">${formatTimeAgo(comment.created_at)}</span>
              ${comment.is_editable ? '· <a href="#" onclick="editComment(${comment.id})">Edit</a>' : ""}
            </div>
          </div>
        `;
        commentStream.appendChild(commentElement);
      });
    }
  } catch (error) {
    console.error("Error loading comments:", error);
  }
}

async function addComment(taskId) {
  const commentInput = document.getElementById("commentInput");
  if (!commentInput || !commentInput.value.trim()) return;

  try {
    const response = await fetch(`/api/tasks/${taskId}/comments/add/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": getCSRFToken(),
      },
      body: JSON.stringify({
        content: commentInput.value.trim(),
      }),
    });

    const data = await response.json();

    if (data.success) {
      // Clear input
      commentInput.value = "";

      // Add comment to UI
      const commentStream = document.getElementById("commentStream");
      if (commentStream) {
        const commentElement = document.createElement("div");
        commentElement.className = "activity-item comment";
        commentElement.innerHTML = `
          <div class="avatar" title="${data.comment.user.full_name}">
            ${data.comment.user.initial}
          </div>
          <div class="comment-body">
            <strong>${data.comment.user.full_name}</strong>
            <p>${data.comment.content}</p>
            <div class="comment-actions">
              <span class="muted">Just now</span> · <a href="#" onclick="editComment(${data.comment.id})">Edit</a>
            </div>
          </div>
        `;
        commentStream.appendChild(commentElement);
      }

      showNotification("Comment added", "success");
    } else {
      showNotification(data.error || "Failed to add comment", "error");
    }
  } catch (error) {
    console.error("Error adding comment:", error);
    showNotification("Network error adding comment", "error");
  }
}

// Utility functions
function formatTimeAgo(dateString) {
  if (!dateString) return "just now";

  console.log("🕒 formatTimeAgo input:", dateString);

  try {
    const date = convertDjangoTimeSimple(dateString);

    if (!date) {
      console.error("❌ Could not convert date:", dateString);
      return "recently";
    }

    const now = new Date();
    const diffMs = now - date;

    // Debug: Check if time appears correct
    console.log("🕒 Time calculation:", {
      input: dateString,
      dateUTC: date.toISOString(),
      dateLocal: date.toLocaleString("en-US", { timeZoneName: "short" }),
      nowUTC: now.toISOString(),
      nowLocal: now.toLocaleString("en-US", { timeZoneName: "short" }),
      diffMs: diffMs,
      diffHours: Math.floor(diffMs / (1000 * 60 * 60)),
      expectedCorrect:
        diffMs > 0 ? "✅ Should be positive" : "❌ Negative (in future)",
    });

    return calculateTimeAgo(diffMs);
  } catch (error) {
    console.error("❌ Error in formatTimeAgo:", error);
    return "recently";
  }
}

function calculateTimeAgo(diffMs) {
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffSeconds < 0) {
    return "in the future";
  } else if (diffSeconds < 60) {
    return "just now";
  } else if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes !== 1 ? "s" : ""} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
  } else if (diffDays < 7) {
    return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} week${weeks !== 1 ? "s" : ""} ago`;
  } else {
    const date = new Date(Date.now() - diffMs);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
}

function convertDjangoTimeSimple(djangoTime) {
  if (!djangoTime) return null;

  console.log("🔄 Converting:", djangoTime);

  try {
    // Convert Django format to ISO if needed
    let isoTime = djangoTime;

    if (djangoTime.includes(" ") && !djangoTime.includes("T")) {
      // Convert "2026-01-20 03:46:34" to "2026-01-20T03:46:34Z"
      isoTime = djangoTime.replace(" ", "T") + "Z";
    }

    // Parse the ISO time
    const date = new Date(isoTime);

    if (isNaN(date.getTime())) {
      console.error("❌ Invalid date:", isoTime);
      return null;
    }

    console.log("✅ Converted successfully:", {
      input: djangoTime,
      iso: isoTime,
      output: date.toISOString(),
      local: date.toLocaleString("en-US", { timeZoneName: "short" }),
    });

    return date;
  } catch (error) {
    console.error("❌ Conversion error:", error);
    return null;
  }
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// Helper function to format due date
function formatDueDate(dateString) {
  if (!dateString) return "";

  const date = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffTime = date.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Due today";
  if (diffDays < 0) return "Overdue";
  if (diffDays === 1) return "Due tomorrow";
  if (diffDays <= 7) return `Due in ${diffDays} days`;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Fix the "Add Task" button issue
function addTaskToProject(projectId) {
  console.log(`Add task to project ${projectId}`);
  showNewTaskForm();

  // Pre-select the project in the task form
  setTimeout(() => {
    const projectSelect = document.getElementById("taskProject");
    const customProjectDropdown = document.getElementById(
      "customProjectDropdown",
    );
    const selectedText = document.getElementById("selectedProjectText");

    if (projectSelect && projectId) {
      // Set the value on the hidden select
      projectSelect.value = projectId;

      // Update the custom dropdown display
      if (customProjectDropdown && selectedText) {
        // Find the project name from options
        const option = Array.from(projectSelect.options).find(
          (opt) => opt.value == projectId,
        );
        if (option) {
          selectedText.textContent = option.textContent;

          // Highlight in dropdown
          document.querySelectorAll(".dropdown-option").forEach((opt) => {
            opt.classList.remove("selected");
            if (opt.getAttribute("data-value") == projectId) {
              opt.classList.add("selected");
            }
          });
        }
      }

      // Trigger change to load assignees
      projectSelect.dispatchEvent(new Event("change"));
    }
  }, 500);
}

// =============================================
// SEARCH FUNCTIONALITY
// =============================================

function setupSearchFunctionality() {
  console.log('🔍 Setting up search functionality...');
  
  // Desktop search elements
  const desktopSearchToggle = document.getElementById('desktopSearchToggle');
  const desktopSearchContainer = document.getElementById('desktopSearchContainer');
  const desktopSearchInput = document.getElementById('desktopSearchInput');
  const desktopSearchClear = document.getElementById('desktopSearchClear');
  const desktopSuggestions = document.getElementById('desktopSearchSuggestions');
  
  // Mobile search elements
  const mobileSearchInput = document.getElementById('dashboard-search-input');
  const mobileSearchClear = document.getElementById('mobileSearchClear');
  const mobileSuggestions = document.getElementById('dashboardSearchSuggestions');
  
  // Toggle desktop search visibility
  if (desktopSearchToggle && desktopSearchContainer) {
    desktopSearchToggle.addEventListener('click', function(e) {
      e.preventDefault();
      const isVisible = desktopSearchContainer.style.display !== 'none';
      
      if (isVisible) {
        desktopSearchContainer.style.display = 'none';
        desktopSearchInput.value = '';
        desktopSuggestions.innerHTML = '';
      } else {
        desktopSearchContainer.style.display = 'block';
        desktopSearchInput.focus();
      }
    });
  }
  
  // Desktop search input handler
  if (desktopSearchInput) {
    let searchTimeout;
    
    desktopSearchInput.addEventListener('input', function(e) {
      const query = this.value.trim();
      
      // Show/hide clear button
      if (desktopSearchClear) {
        desktopSearchClear.style.display = query ? 'block' : 'none';
      }
      
      // Clear previous timeout
      clearTimeout(searchTimeout);
      
      // If query is empty, clear suggestions
      if (!query) {
        desktopSuggestions.innerHTML = '';
        return;
      }
      
      // Show loading state
      desktopSuggestions.innerHTML = '<div class="search-loading">Searching...</div>';
      
      // Debounce search
      searchTimeout = setTimeout(() => {
        performSearch(query, desktopSuggestions);
      }, 300);
    });
    
    // Clear button handler
    if (desktopSearchClear) {
      desktopSearchClear.addEventListener('click', function() {
        desktopSearchInput.value = '';
        desktopSearchInput.focus();
        desktopSuggestions.innerHTML = '';
        this.style.display = 'none';
      });
    }
    
    // Close search on Escape key
    desktopSearchInput.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        desktopSearchContainer.style.display = 'none';
        this.value = '';
        desktopSuggestions.innerHTML = '';
      }
    });
  }
  
  // Mobile search input handler
  if (mobileSearchInput) {
    let searchTimeout;
    
    mobileSearchInput.addEventListener('input', function(e) {
      const query = this.value.trim();
      
      // Show/hide clear button
      if (mobileSearchClear) {
        mobileSearchClear.style.display = query ? 'block' : 'none';
      }
      
      clearTimeout(searchTimeout);
      
      if (!query) {
        mobileSuggestions.innerHTML = '';
        // mobileSuggestions.style.display = 'none';
        console.log("Suggestions don't exist");
        
        return;
      }
      
      mobileSuggestions.innerHTML = '<div class="search-loading">Searching...</div>';
      
      searchTimeout = setTimeout(() => {
        performSearch(query, mobileSuggestions);
        console.log('Suggestions populated:', mobileSuggestions.innerHTML);  // Check content
        mobileSuggestions.style.display = 'block';  // Force show
        mobileSuggestions.style.position = 'absolute';  // Ensure positioning
        mobileSuggestions.style.top = '100%';  // Position below
      }, 300);
    });

    // mobileSuggestions.style.display = 'block';
    
    // Clear button handler
    if (mobileSearchClear) {
      mobileSearchClear.addEventListener('click', function() {
        mobileSearchInput.value = '';
        mobileSearchInput.focus();
        mobileSuggestions.innerHTML = '';
        this.style.display = 'none';
      });
    }
  }

  // Replace the existing mobile search button handler with this:
  const mobileSearchButton = document.querySelector('.dashboard-search-button');
  console.log('Mobile search button found:', mobileSearchButton);  // Debug: Check if it's null
  if (mobileSearchButton) {
    mobileSearchButton.addEventListener('click', function() {
      console.log('Search button clicked!');  // Debug: Confirm click fires
      const query = mobileSearchInput.value.trim();
      if (query) {
        console.log('Performing search for:', query);  // Debug: Confirm query
        mobileSuggestions.innerHTML = '<div class="search-loading">Searching...</div>';
        performSearch(query, mobileSuggestions);
      } else {
        console.log('No query to search');  // Debug: If empty
      }
    });
  } else {
    console.error('Mobile search button not found! Check HTML class.');  // Debug: If not found
  }
  
  // Click outside to close desktop search
  document.addEventListener('click', function(e) {
    if (desktopSearchContainer && 
        !desktopSearchContainer.contains(e.target) && 
        !desktopSearchToggle.contains(e.target)) {
      desktopSearchContainer.style.display = 'none';
    }
  });
  
  console.log('✅ Search functionality setup complete');
}

function initSearchInput(inputId, suggestionsId) {
  const input = document.getElementById(inputId);
  const suggestions = document.getElementById(suggestionsId);
  
  if (!input || !suggestions) {
    console.log(`❌ Missing elements for ${inputId}`);
    return;
  }
  
  let searchTimeout;
  let currentQuery = '';
  
  // Focus event
  input.addEventListener('focus', function() {
    console.log(`🎯 ${inputId} focused`);
    if (this.value.trim().length >= 2) {
      performSearch(this.value.trim(), this, suggestions);
    }
  });
  
  // Input event with debounce
  input.addEventListener('input', function() {
    console.log(`⌨️ ${inputId} input: "${this.value}"`);
    
    // Show/hide clear button
    const clearBtn = this.parentElement.querySelector('.search-clear');
    if (clearBtn) {
      clearBtn.style.display = this.value ? 'block' : 'none';
    }
    
    const query = this.value.trim();
    
    if (query.length < 2) {
      hideSuggestions(suggestions);
      return;
    }
    
    // Clear previous timeout
    clearTimeout(searchTimeout);
    
    // Set new timeout
    searchTimeout = setTimeout(() => {
      if (query !== currentQuery) {
        currentQuery = query;
        performSearch(query, this, suggestions);
      }
    }, 500);
  });
  
  // Keydown event for Enter and navigation
  input.addEventListener('keydown', function(e) {
    console.log(`⌨️ ${inputId} keydown: ${e.key}`);
    
    if (e.key === 'Enter') {
      e.preventDefault();
      const activeItem = suggestions.querySelector('.search-suggestion-item.active');
      if (activeItem) {
        activeItem.click();
      } else if (this.value.trim()) {
        // Perform full search
        console.log(`🔍 Performing full search for: ${this.value.trim()}`);
        showNotification(`Searching for: "${this.value.trim()}"`, 'info');
        hideSuggestions(suggestions);
      }
    } else if (e.key === 'Escape') {
      hideSuggestions(suggestions);
      this.blur();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusNextSuggestion(suggestions);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusPreviousSuggestion(suggestions);
    }
  });
  
  // Click outside to close suggestions
  document.addEventListener('click', function(e) {
    if (!input.contains(e.target) && !suggestions.contains(e.target)) {
      hideSuggestions(suggestions);
    }
  });
  
  console.log(`✅ ${inputId} initialized`);
}

function setupSearchToggle() {
  const toggle = document.getElementById('desktopSearchToggle');
  const container = document.getElementById('desktopSearchContainer');
  const input = document.getElementById('desktopSearchInput');
  
  if (!toggle || !container || !input) {
    console.log('❌ Missing desktop search toggle elements');
    return;
  }
  
  toggle.addEventListener('click', function(e) {
    e.stopPropagation();
    e.preventDefault();
    
    console.log('🔄 Toggling desktop search');
    
    if (container.style.display === 'none' || !container.style.display) {
      container.style.display = 'block';
      setTimeout(() => {
        input.focus();
      }, 100);
    } else {
      container.style.display = 'none';
      hideSuggestions(document.getElementById('desktopSearchSuggestions'));
    }
  });
  
  // Close when clicking outside
  document.addEventListener('click', function(e) {
    if (!container.contains(e.target) && !toggle.contains(e.target)) {
      container.style.display = 'none';
      hideSuggestions(document.getElementById('desktopSearchSuggestions'));
    }
  });
  
  console.log('✅ Search toggle setup complete');
}

function setupClearButtons() {
  // Setup clear buttons for both inputs
  ['desktopSearchInput', 'mobileSearchInput'].forEach(inputId => {
    const input = document.getElementById(inputId);
    if (!input) return;
    
    const clearBtn = input.parentElement.querySelector('.search-clear');
    if (!clearBtn) return;
    
    clearBtn.addEventListener('click', function() {
      input.value = '';
      input.focus();
      this.style.display = 'none';
      hideSuggestions(document.getElementById(
        inputId === 'desktopSearchInput' ? 'desktopSearchSuggestions' : 'mobileSearchSuggestions'
      ));
    });
  });
}

// Helper functions
function getSearchSuggestionsContainer(input) {
  if (!input) return null;
  const container = input.closest('.desktop-search-wrapper, .mobile-search-wrapper');
  return container ? container.querySelector('.search-suggestions') : null;
}

function showSearchSuggestions(query, input) {
  if (!input) return;
  
  const suggestionsContainer = getSearchSuggestionsContainer(input);
  if (!suggestionsContainer) return;
  
  if (!query || query.length < 2) {
    suggestionsContainer.innerHTML = `
      <div class="search-suggestions empty">
        <p>Type at least 2 characters to search</p>
      </div>
    `;
    suggestionsContainer.classList.add('active');
    return;
  }
  
  suggestionsContainer.innerHTML = `
    <div class="search-loading">
      <i class="fas fa-spinner fa-spin"></i>
      Searching...
    </div>
  `;
  suggestionsContainer.classList.add('active');
}

function hideSearchSuggestions(input) {
  const suggestionsContainer = getSearchSuggestionsContainer(input);
  if (suggestionsContainer) {
    suggestionsContainer.classList.remove('active');
    suggestionsContainer.innerHTML = '';
  }
}

// Perform the actual search
async function performSearch(query, suggestionsElement) {
  console.log('performSearch called with query:', query);
  try {
    console.log(`🔍 Searching for: "${query}"`);
    
    const response = await fetch(`/api/search/?q=${encodeURIComponent(query)}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      suggestionsElement.innerHTML = '<div class="search-error">Search failed</div>';
      return;
    }
    
    displaySearchResults(data, suggestionsElement, query);
    
  } catch (error) {
    console.error('Search error:', error);
    suggestionsElement.innerHTML = '<div class="search-error">Error performing search</div>';
  }
}

// Display search results
function displaySearchResults(data, suggestionsElement, query) {
  const results = data.results || [];
  const counts = data.counts || {};
  
  if (results.length === 0) {
    suggestionsElement.innerHTML = `
      <div class="search-no-results">
        <i class="fas fa-search"></i>
        <p>No results found for "${query}"</p>
      </div>
    `;
    return;
  }
  
  let html = '';
  
  // Group results by type
  const taskResults = results.filter(r => r.type === 'task');
  const projectResults = results.filter(r => r.type === 'project');
  const userResults = results.filter(r => r.type === 'user');
  
  // Display tasks
  if (taskResults.length > 0) {
    html += '<div class="search-suggestion-header">Tasks</div>';
    taskResults.forEach(result => {
      html += `
        <div class="search-suggestion-item" onclick="openTaskDetails(${result.id}, '${result.title.replace(/'/g, "\\'")}')">
          <i class="${result.icon}"></i>
          <div class="search-suggestion-content">
            <div class="search-suggestion-title">${highlightQuery(result.title, query)}</div>
            <div class="search-suggestion-extra">${result.project.name} · ${result.status}</div>
          </div>
        </div>
      `;
    });
  }
  
  // Display projects
  if (projectResults.length > 0) {
    html += '<div class="search-suggestion-header">Projects</div>';
    projectResults.forEach(result => {
      html += `
        <div class="search-suggestion-item" onclick="openProjectDetails(${result.id}, '${result.title.replace(/'/g, "\\'")}')">
          <i class="${result.icon}"></i>
          <div class="search-suggestion-content">
            <div class="search-suggestion-title">${highlightQuery(result.title, query)}</div>
            <div class="search-suggestion-extra">${result.task_count} tasks</div>
          </div>
        </div>
      `;
    });
  }
  
  // Display users
  if (userResults.length > 0) {
    html += '<div class="search-suggestion-header">People</div>';
    userResults.forEach(result => {
      html += `
        <div class="search-suggestion-item">
          <i class="${result.icon}"></i>
          <div class="search-suggestion-content">
            <div class="search-suggestion-title">${highlightQuery(result.title, query)}</div>
            <div class="search-suggestion-extra">${result.description}</div>
          </div>
        </div>
      `;
    });
  }
  
  // Add footer with total count
  html += `
    <div class="search-suggestion-footer">
      <div class="search-suggestion-item">
        <i class="fas fa-list"></i>
        <div class="search-suggestion-content">
          <div class="search-suggestion-title">Found ${counts.total} results</div>
        </div>
      </div>
    </div>
  `;
  
  suggestionsElement.innerHTML = html;
}

// Highlight query in results
function highlightQuery(text, query) {
  if (!query) return text;
  
  const regex = new RegExp(`(${query})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}

function handleSearchResult(type, id, title) {
  console.log(`🎯 Handling search result: ${type} ${id} - ${title}`);
  
  switch (type) {
    case 'task':
      openTaskDetails(id, title);
      break;
    case 'project':
      openProjectDetails(id, title);
      break;
    case 'user':
      showNotification(`Viewing ${title}'s profile`, 'info');
      // You could implement user profile viewing here
      break;
  }
}

function hideSuggestions(container) {
  if (container) {
    container.style.display = 'none';
    container.innerHTML = '';
  }
}

function renderSearchSuggestions(data, container, input) {
  const { results, query, counts } = data;
  
  if (!results || results.length === 0) {
    container.innerHTML = `
      <div class="search-suggestions empty">
        <p>No results found for "${query}"</p>
        <small>Try different keywords</small>
      </div>
    `;
    return;
  }
  
  // Highlight matching text in results
  const highlightText = (text) => {
    if (!text || !query) return text;
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<span class="search-suggestion-highlight">$1</span>');
  };
  
  let html = '';
  
  // Group results by type
  const tasks = results.filter(r => r.type === 'task');
  const projects = results.filter(r => r.type === 'project');
  const users = results.filter(r => r.type === 'user');
  
  if (tasks.length > 0) {
    html += `<div class="search-suggestion-group">
               <div class="search-suggestion-header">Tasks (${tasks.length})</div>`;
    tasks.forEach(result => {
      html += createSuggestionItem(result, query);
    });
    html += `</div>`;
  }
  
  if (projects.length > 0) {
    html += `<div class="search-suggestion-group">
               <div class="search-suggestion-header">Projects (${projects.length})</div>`;
    projects.forEach(result => {
      html += createSuggestionItem(result, query);
    });
    html += `</div>`;
  }
  
  if (users.length > 0) {
    html += `<div class="search-suggestion-group">
               <div class="search-suggestion-header">Team Members (${users.length})</div>`;
    users.forEach(result => {
      html += createSuggestionItem(result, query);
    });
    html += `</div>`;
  }
  
  // Add "View all results" link if there are many results
  if (counts.total > 10) {
    html += `
      <div class="search-suggestion-footer">
        <div class="search-suggestion-item" onclick="performFullSearch('${query.replace(/'/g, "\\'")}')">
          <i class="fas fa-search"></i>
          <div class="search-suggestion-content">
            <div class="search-suggestion-title">View all ${counts.total} results</div>
          </div>
          <i class="fas fa-arrow-right"></i>
        </div>
      </div>
    `;
  }
  
  container.innerHTML = html;
  
  // Add click handlers to suggestion items
  container.querySelectorAll('.search-suggestion-item:not(.search-suggestion-footer .search-suggestion-item)').forEach(item => {
    item.addEventListener('click', function() {
      const type = this.dataset.type;
      const id = this.dataset.id;
      
      handleSearchResultClick(type, id, this.dataset.title || '');
      
      // Clear search and hide suggestions
      if (input) {
        input.value = '';
        hideSearchSuggestions(input);
      }
      
      // Hide desktop search container if visible
      const desktopSearchContainer = document.getElementById('desktopSearchContainer');
      if (desktopSearchContainer) {
        desktopSearchContainer.classList.remove('active');
      }
    });
  });
}

function createSuggestionItem(result, query) {
  const iconClass = result.icon || 
    (result.type === 'task' ? 'fas fa-tasks' :
     result.type === 'project' ? 'fas fa-briefcase' :
     'fas fa-user');
  
  const badge = result.type === 'task' ? 
    `<span class="search-suggestion-badge">${result.status || ''}</span>` :
    '';
  
  const description = result.description ? 
    `<div class="search-suggestion-description">${highlightText(result.description)}</div>` :
    '';
  
  const extra = result.type === 'task' && result.project ?
    `<div class="search-suggestion-extra">in ${highlightText(result.project.name)}</div>` :
    result.type === 'task' && result.assigned_to ?
    `<div class="search-suggestion-extra">assigned to @${result.assigned_to}</div>` :
    '';
  
  return `
    <div class="search-suggestion-item" 
         data-type="${result.type}" 
         data-id="${result.id}"
         data-title="${(result.title || '').replace(/"/g, '&quot;')}">
      <div class="search-suggestion-icon">
        <i class="${iconClass}"></i>
      </div>
      <div class="search-suggestion-content">
        <div class="search-suggestion-title">${highlightText(result.title || 'Untitled')}</div>
        <div class="search-suggestion-details">
          ${description}
          ${extra}
          ${badge}
        </div>
      </div>
    </div>
  `;
}

function handleSearchResultClick(type, id, title) {
  console.log(`🔍 Search result clicked: ${type} ${id} - ${title}`);
  
  switch (type) {
    case 'task':
      openTaskDetails(id, title);
      break;
    case 'project':
      openProjectDetails(id, title);
      break;
    case 'user':
      // For users, you could open a user profile or filter tasks by user
      showNotification(`Viewing ${title}'s tasks`, 'info');
      // Optional: Open tasks filtered by this user
      // showTasksPage();
      // setTimeout(() => filterTasksByUser(id), 300);
      break;
    default:
      console.log(`Unknown result type: ${type}`);
  }
}

function performFullSearch(query) {
  console.log(`🔍 Performing full search for: ${query}`);
  
  // Show a search results page or modal
  showNotification(`Showing all results for: "${query}"`, 'info');
  
  // You could implement a dedicated search results page here
  // For now, just show a notification
}

// Navigation functions for keyboard
function focusNextSuggestion(container) {
  const items = container.querySelectorAll('.search-result-item');
  if (items.length === 0) return;
  
  const active = container.querySelector('.search-result-item.active');
  let nextIndex = 0;
  
  if (active) {
    active.classList.remove('active');
    const currentIndex = Array.from(items).indexOf(active);
    nextIndex = (currentIndex + 1) % items.length;
  }
  
  items[nextIndex].classList.add('active');
}

function focusPreviousSuggestion(container) {
  const items = container.querySelectorAll('.search-result-item');
  if (items.length === 0) return;
  
  const active = container.querySelector('.search-result-item.active');
  let prevIndex = items.length - 1;
  
  if (active) {
    active.classList.remove('active');
    const currentIndex = Array.from(items).indexOf(active);
    prevIndex = (currentIndex - 1 + items.length) % items.length;
  }
  
  items[prevIndex].classList.add('active');
}

// Add this CSS for group headers and footer
const additionalCSS = `
.search-suggestion-group {
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.search-suggestion-group:last-child {
  border-bottom: none;
}

.search-suggestion-header {
  padding: 8px 16px;
  font-size: 0.8em;
  font-weight: 600;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: rgba(255, 255, 255, 0.02);
}

.search-suggestion-footer {
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.02);
}

.search-suggestion-footer .search-suggestion-item:hover {
  background: rgba(0, 170, 255, 0.1);
}

.search-suggestion-item.active {
  background: rgba(0, 170, 255, 0.1);
  border-left: 3px solid #00aaff;
}

.search-suggestion-extra {
  font-size: 0.8em;
  color: #666;
  margin-top: 2px;
}
`;

// Add the CSS to the page
const style = document.createElement('style');
style.textContent = additionalCSS;
document.head.appendChild(style);

// In your tasks page initialization
function setupTasksPageSearch() {
  const searchInput = document.querySelector('#tasksSearchInput');
  if (!searchInput) return;
  
  searchInput.addEventListener('input', function() {
    const query = this.value.toLowerCase();
    filterTasksBySearch(query);
  });
}

function filterTasksBySearch(query) {
  const taskCards = document.querySelectorAll('.task-card, .task-row');
  
  if (!query) {
    taskCards.forEach(card => card.style.display = '');
    return;
  }
  
  taskCards.forEach(card => {
    const title = card.querySelector('.task-title, .col-title strong')?.textContent.toLowerCase() || '';
    const description = card.querySelector('.task-description, .col-title small')?.textContent.toLowerCase() || '';
    const project = card.querySelector('.col-project')?.textContent.toLowerCase() || '';
    const assignee = card.querySelector('.col-assignee')?.textContent.toLowerCase() || '';
    
    const matches = title.includes(query) || 
                    description.includes(query) || 
                    project.includes(query) || 
                    assignee.includes(query);
    
    card.style.display = matches ? '' : 'none';
  });
}

// =============================================
// REAL-TIME VALIDATION (SIMPLIFIED)
// =============================================

function setupRealTimeValidation() {
  const projectNameInput = document.getElementById("projectName");
  if (!projectNameInput) return;

  // Mark as validation input
  projectNameInput.classList.add("validation-input");
  projectNameInput.dataset.validationSetup = "true";

  let validationTimeout;
  let currentValidationId = 0;

  projectNameInput.addEventListener("input", function () {
    const name = this.value.trim();
    const validationId = ++currentValidationId;

    this.classList.remove("valid", "invalid", "validating");

    if (name.length >= 3) {
      this.classList.add("validating");
    }

    clearTimeout(validationTimeout);

    if (name.length < 3) {
      showValidationFeedback(this, "info", "Enter at least 3 characters");
      return;
    }

    showValidationFeedback(this, "checking", "Checking availability...");

    validationTimeout = setTimeout(async () => {
      if (validationId !== currentValidationId) return;

      try {
        const response = await fetch(
          `/api/projects/check-duplicate/?name=${encodeURIComponent(name)}`,
        );
        const result = await response.json();

        if (result.exists) {
          this.classList.remove("validating");
          this.classList.add("invalid");
          showValidationFeedback(
            this,
            "error",
            `You already have "${result.project_name}"`,
          );
        } else {
          this.classList.remove("validating");
          this.classList.add("valid");
          showValidationFeedback(this, "success", "Available");
        }
      } catch (error) {
        console.error("Validation error:", error);
        showValidationFeedback(this, "info", "Name looks good");
      }
    }, 600);
  });
}

function showValidationFeedback(inputElement, type, message) {
  const feedbackDiv = inputElement.parentNode.querySelector(
    ".validation-feedback",
  );
  if (feedbackDiv) {
    feedbackDiv.remove();
  }

  const div = document.createElement("div");
  div.className = `validation-feedback validation-${type}`;
  div.innerHTML = message;

  const styles = {
    fontSize: "12px",
    marginTop: "5px",
    marginBottom: "5px",
    display: "flex",
    alignItems: "center",
    gap: "5px",
    animation: "fadeIn 0.3s ease",
  };

  switch (type) {
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

  Object.assign(div.style, styles);
  inputElement.parentNode.appendChild(div);
}

// =============================================
// MAKE FUNCTIONS GLOBALLY AVAILABLE
// =============================================

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
window.toggleSidebar = toggleSidebar;
window.addTaskToProject = addTaskToProject;
window.debugDragAndDrop = debugDragAndDrop;
window.debugTaskTimestamps = debugTaskTimestamps;
window.debugTimezone = debugTimezone;

console.log("🎯 SwyftTask Dashboard with Task Details loaded successfully");

const notifBtn = document.getElementById('notificationBtn');
const notifMenu = document.getElementById('notificationMenu');

notifBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    notifMenu.style.display =
        notifMenu.style.display === 'block' ? 'none' : 'block';
});

document.addEventListener('click', function () {
    notifMenu.style.display = 'none';
});


function openInviteModal(projectId) {
    document.getElementById('inviteModal').classList.remove('hidden');
    document.getElementById('projectIdInput').value = projectId;

    // Set form action dynamically
    document.getElementById('inviteForm').action = `/invite/${projectId}/`;
}

function closeInviteModal() {
    document.getElementById('inviteModal').classList.add('hidden');
}


// MODAL FIX

function openInviteModal(projectId) {
    console.log("PROJECT ID:", projectId); // DEBUG

    if(!projectId || projectId === "undefined"){
        alert("Project ID Missing");
        return;
    }

    document.getElementById('inviteModal').classList.remove('hidden');
    document.getElementById('projectIdInput').value = projectId;
    document.getElementById('inviteForm').action = `/invite/${projectId}/`;
    document.body.style.overflow = "hidden"; // 🔥 lock background
}

function closeInviteModal() {
    document.getElementById('inviteModal').classList.add('hidden');
    document.body.overflow = "auto"; // 🔥 unlock
}



//NOTIFICATION AND LIVE UPDATE FEATURE

// CSRF TOKEN

// ================================
// NOTIFICATION + LIVE UPDATE SYSTEM
// ================================

// CSRF TOKEN
function getCSRFToken() {
    return document.cookie
        .split('; ')
        .find(row => row.startsWith('csrftoken'))
        ?.split('=')[1];
}

// ================================
// STATE
// ================================
let lastNotificationCount = 0;

// ================================
// INITIALIZATION
// ================================
document.addEventListener('DOMContentLoaded', () => {
    const badge = document.getElementById('notification-count');
    const configEl = document.getElementById('notification-config');

    // Initialize count from DOM
    if (badge) {
        lastNotificationCount = parseInt(badge.textContent) || 0;
    }

    // Play sound if Django says so (first load only)
    const shouldPlayNotification =
        configEl?.dataset.playSound === "true";

    if (shouldPlayNotification) {
        console.log("🔥 PLAYING SOUND ON LOAD");
        triggerNotificationAlert();
    }

    // Start polling
    updateNotificationCount();
    setInterval(updateNotificationCount, 5000);
});

// ================================
// FETCH + UPDATE COUNT
// ================================
function updateNotificationCount() {
    fetch('/notifications/unread_count/')
        .then(res => res.json())
        .then(data => {
            const newCount = data.count;
            const prevCount = lastNotificationCount;

            console.log("OLD:", prevCount, "NEW:", newCount);

            // 🔔 Only trigger when count increases
            if (newCount > prevCount) {
                console.log("🔔 New notification detected");
                triggerNotificationAlert();
            }

            // Update state AFTER comparison
            lastNotificationCount = newCount;

            renderNotificationCount(newCount);
        })
        .catch(err => console.error("Notification fetch error:", err));
}

// ================================
// UPDATE BADGE UI
// ================================
function renderNotificationCount(count) {
    const badge = document.getElementById('notifBadge');

    if (!badge) return;

    if (count > 0) {
        badge.innerText = count;
        badge.style.display = 'inline-flex';
    } else {
        badge.innerText = '';
        badge.style.display = 'none';
    }
}

// ================================
// MARK ALL AS READ
// ================================
function markAllAsRead() {
    fetch('/notifications/mark-all-read/', {
        method: 'POST',
        headers: {
            'X-CSRFToken': getCSRFToken(),
            'Content-Type': 'application/json'
        }
    })
    .then(res => {
        if (!res.ok) throw new Error("Failed");
        return res.json();
    })
    .then(() => {
    document.querySelectorAll('.unread-dot').forEach(dot => dot.remove());
    document.querySelectorAll('.notification-item').forEach(item => {
        item.classList.remove('unread');
    });

    renderNotificationCount(0); // 🔥 immediate sync
    lastNotificationCount = 0;
});
}



// ================================
// CLEAR ALL NOTIFICATIONS
// ================================
function clearAllNotifications() {
    if (confirm("Clear all notifications?")) {
        fetch('/notifications/clear-all/', {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCSRFToken()
            }
        }).then(() => {
            location.reload();
        });
    }
}

// ================================
// HANDLE NOTIFICATION CLICK (UNIFIED)
// ================================
document.addEventListener('click', function(e) {
    const item = e.target.closest('.notification-item');
    if (!item) return;

    const notifId = item.dataset.id;
    const projectId = item.dataset.projectId;
    const projectName = item.dataset.projectName;

    // Mark as read
    if (notifId) {
        fetch(`/notifications/mark-read/${notifId}/`, {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCSRFToken()
            }
        });

        item.classList.remove('unread');
        item.querySelector('.unread-dot')?.remove();
    }

    // Open project if linked
    if (projectId && projectName) {
        const dropdown = item.closest('.dropdown-menu');
        if (dropdown) {
            bootstrap.Dropdown
                .getInstance(dropdown.previousElementSibling)
                ?.hide();
        }

        openProjectDetails(parseInt(projectId), projectName);
    }
});

// ================================
// NOTIFICATION ALERT (SOUND + UI)
// ================================
function triggerNotificationAlert() {
    console.log("🔥 ALERT TRIGGERED");

    const sound = document.getElementById('notificationSound');
    const badge = document.getElementById('notifBadge');

    if (sound) {
        sound.currentTime = 0;
        sound.play().catch(err => console.log("Sound error:", err));
    }

    if (badge) {
        badge.classList.add('pulse');

        setTimeout(() => {
            badge.classList.remove('pulse');
        }, 1500);
    }
}

// ================================
// STOP PULSE WHEN OPENING DROPDOWN
// ================================
document.getElementById('notificationBtn')
    ?.addEventListener('click', () => {
        const badge = document.getElementById('notifBadge');
        badge?.classList.remove('pulse');
    });

// ================================
// UNLOCK AUDIO (REQUIRED FOR BROWSERS)
// ================================
document.addEventListener('click', () => {
    const sound = document.getElementById('notificationSound');
    if (sound) {
        sound.play()
            .then(() => {
                sound.pause();
                sound.currentTime = 0;
            })
            .catch(() => {});
    }
}, { once: true });

