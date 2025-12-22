// =============================================
// SWYFTTASK DASHBOARD - COMPLETE AUTO-REFRESH VERSION
// =============================================

let validationSetupDone = false;
let validationControllers = new Map();
let isRefreshing = false;
let refreshQueue = [];

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

  // Call this in your initialization
  setupGlobalEventListeners();

  // Check URL hash for page restoration
  handleURLHash();

  console.log("✅ Dashboard initialized successfully");
});

// Add this to your dashboard.js initialization
function setupGlobalEventListeners() {
  // Fix for new task button in tasks page
  document.addEventListener('click', function(e) {
    // Check if clicked on new task button in tasks page
    if (e.target.id === 'newTaskBtnFull' || 
        e.target.closest('#newTaskBtnFull') ||
        (e.target.classList.contains('fa-plus') && e.target.closest('.page-actions'))) {
      e.preventDefault();
      e.stopPropagation();
      console.log("➕ New Task button clicked (global handler)");
      showNewTaskForm();
    }
    
    // Check if clicked on add task button in project details
    if (e.target.closest('.icon-btn[title="Add Task"]') || 
        (e.target.classList.contains('fa-plus') && e.target.closest('.project-actions'))) {
      e.preventDefault();
      e.stopPropagation();
      const projectId = AppState.currentProjectId;
      console.log(`➕ Add Task to project ${projectId} (global handler)`);
      if (projectId) {
        showNewTaskForm();
        // Pre-select the project
        setTimeout(() => {
          const projectSelect = document.getElementById('taskProject');
          if (projectSelect) {
            projectSelect.value = projectId;
            projectSelect.dispatchEvent(new Event('change'));
          }
        }, 300);
      } else {
        showNewTaskForm();
      }
    }
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

  // Start auto-refresh if on dashboard
  if (AppState.currentPage === "dashboard") {
    startAutoRefresh();
  }

  console.log("✅ All functionality setup complete");
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
  const mobileCreateBtn = document.getElementById("newTaskBtnMobile");
  if (mobileCreateBtn) {
    mobileCreateBtn.addEventListener("click", showNewTaskForm);
  }

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
          "error"
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
      ".kanban-task, .due-list li, .assigned-tasks li, .task-card"
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
  }, 30000);

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

  console.log("🔄 Auto-refresh started (every 30 seconds)");
}

function stopAutoRefresh() {
  if (AppState.autoRefreshInterval) {
    clearInterval(AppState.autoRefreshInterval);
    AppState.autoRefreshInterval = null;
    console.log("⏹️ Auto-refresh stopped");
  }
}

async function refreshDashboardData(force = false) {
  if (isRefreshing && !force) {
    console.log("⏳ Refresh already in progress");
    return;
  }

  const now = Date.now();
  if (window.lastRefresh && now - window.lastRefresh < 2000 && !force) {
    console.log("⏳ Too soon since last refresh");
    return;
  }

  showLoader();
  isRefreshing = true;
  window.lastRefresh = now;

  try {
    console.log("🔄 Refreshing dashboard data...");
    const response = await fetch("/api/dashboard/full-data/");
    const data = await response.json();

    if (data.success) {
      AppState.cachedData = {
        counts: data.counts,
        tasks: data.tasks,
        projects: data.projects,
        total_projects: data.total_projects || data.projects.length,
      };

      updateCompleteDashboardUI(data);
    }
  } catch (error) {
    console.error("Error refreshing dashboard:", error);
  } finally {
    isRefreshing = false;
    hideLoader();
  }
}

function updateCompleteDashboardUI(data) {
  updateDashboardCounts(data.counts);
  updatePinnedProjectsFromCache();
  updateTasksDueToday(data.tasks);
  updateKanbanBoard(data.tasks);
  updateYourTasks(data.tasks);

  console.log("✅ Complete dashboard UI updated");
}

function updateDashboardCounts(counts) {
  if (!counts) return;

  const elements = {
    activeProjectsCount: "active_projects",
    tasksDueCount: "tasks_due",
    overdueCount: "overdue",
    teamCount: "team_count",
  };

  Object.entries(elements).forEach(([id, key]) => {
    const element = document.getElementById(id);
    if (element && counts[key] !== undefined) {
      element.textContent = counts[key];
    }
  });
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

function updateTasksDueToday(tasksData) {
  const dueTodayContainer = document.querySelector(
    ".tasks-due-today .due-list"
  );
  if (!dueTodayContainer) return;

  const today = new Date().toISOString().split("T")[0];
  dueTodayContainer.innerHTML = "";

  if (tasksData.todo && tasksData.todo.length > 0) {
    const tasksToShow = tasksData.todo.slice(0, 5);

    tasksToShow.forEach((task) => {
      const taskItem = document.createElement("li");
      taskItem.setAttribute("data-task-id", task.id);

      const isDueToday = task.due_date === today;

      taskItem.innerHTML = `
        <span>${task.title}</span>
        <strong class="${isDueToday ? "urgent" : ""}">
          ${isDueToday ? "Due Today" : "No deadline"}
        </strong>
      `;

      dueTodayContainer.appendChild(taskItem);
    });
  } else {
    dueTodayContainer.innerHTML = "<li><span>No tasks due today</span></li>";
  }

  const countBadge = document.querySelector(".tasks-due-today .inbox-badge");
  if (countBadge) {
    const taskCount = tasksData.todo ? tasksData.todo.length : 0;
    countBadge.textContent = taskCount;
    countBadge.style.display = taskCount > 0 ? "inline-block" : "none";
  }
}

function updateKanbanBoard(tasksData) {
  const kanbanBoard = document.getElementById("kanbanBoard");
  if (!kanbanBoard) return;

  const columnMap = {
    todo: tasksData.todo || [],
    inprogress: tasksData.inprogress || [],
    review: tasksData.review || [],
    done: tasksData.done || [],
  };

  kanbanBoard.querySelectorAll(".kanban-column").forEach((column) => {
    const columnType = column.getAttribute("data-column");
    const tasks = columnMap[columnType] || [];
    const taskContainer = column.querySelector(".kanban-task:not(.empty)");

    if (taskContainer) {
      taskContainer.innerHTML = "";

      if (tasks.length === 0) {
        taskContainer.innerHTML =
          '<div class="kanban-task empty">No tasks</div>';
      } else {
        const tasksToShow = tasks.slice(0, 5);

        tasksToShow.forEach((task) => {
          const taskElement = document.createElement("div");
          taskElement.className = `kanban-task ${
            columnType === "done" ? "complete" : ""
          }`;
          taskElement.setAttribute("role", "listitem");
          taskElement.setAttribute("data-task-id", task.id);

          let assigneeInfo = "";
          if (task.assigned_to_name) {
            assigneeInfo = `<small>@${task.assigned_to_name}</small>`;
          }

          taskElement.innerHTML = `${task.title} ${assigneeInfo}`;

          taskElement.addEventListener("click", function () {
            openTaskDetails(task.id, task.title);
          });

          taskContainer.appendChild(taskElement);
        });

        if (tasks.length > 5) {
          const moreTasks = document.createElement("div");
          moreTasks.className = "kanban-task more-tasks";
          moreTasks.textContent = `+${tasks.length - 5} more`;
          taskContainer.appendChild(moreTasks);
        }
      }
    }
  });
}

function updateYourTasks(tasksData) {
  const yourTasksContainer = document.querySelector(".assigned-tasks ul");
  if (!yourTasksContainer) return;

  yourTasksContainer.innerHTML = "";

  const allTasks = [
    ...(tasksData.todo || []),
    ...(tasksData.inprogress || []),
    ...(tasksData.review || []),
    ...(tasksData.done || []),
  ];

  const currentUserId = window.djangoData?.user?.id;
  const yourTasks = allTasks
    .filter((task) => task.assigned_to === currentUserId)
    .slice(0, 5);

  if (yourTasks.length === 0) {
    yourTasksContainer.innerHTML =
      '<li><span class="task-title">No tasks assigned</span></li>';
  } else {
    yourTasks.forEach((task) => {
      const taskItem = document.createElement("li");
      taskItem.setAttribute("data-task-id", task.id);

      let dueText = "no deadline";
      if (task.due_date) {
        const dueDate = new Date(task.due_date);
        const today = new Date();
        const diffTime = dueDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) dueText = "due today";
        else if (diffDays < 0) dueText = "overdue";
        else dueText = `in ${diffDays} day${diffDays !== 1 ? "s" : ""}`;
      }

      taskItem.innerHTML = `
        <span class="task-title">${task.title}</span>
        <small class="muted">${dueText}</small>
      `;

      taskItem.addEventListener("click", function () {
        openTaskDetails(task.id, task.title);
      });

      yourTasksContainer.appendChild(taskItem);
    });
  }

  const countBadge = document.querySelector(".assigned-tasks .inbox-badge");
  if (countBadge) {
    countBadge.textContent = yourTasks.length;
    countBadge.style.display = yourTasks.length > 0 ? "inline-block" : "none";
  }
}

// =============================================
// FORM HANDLERS
// =============================================

function setupFormHandlers() {
  document.addEventListener("click", handleFormButtonClicks);
  document.addEventListener("submit", handleFormSubmit);
}

function handleFormButtonClicks(e) {
  if (
    e.target.closest(".close-form-btn") ||
    (e.target.classList.contains("fa-times") && e.target.closest("button"))
  ) {
    e.preventDefault();
    e.stopPropagation();
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
  if (isTaskSubmitting) {
    console.log("⏳ Task submission already in progress");
    return false;
  }

  isTaskSubmitting = true;

  const submitBtn = form.querySelector(".submit-btn");
  if (!submitBtn) {
    console.error("❌ No submit button found");
    isTaskSubmitting = false;
    return false;
  }

  const originalText = submitBtn.innerHTML;

  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
  submitBtn.disabled = true;

  const timeoutId = setTimeout(() => {
    console.warn("⚠️ Task creation timed out");
    resetTaskFormState(form, submitBtn, originalText);
    isTaskSubmitting = false;
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
      await refreshDashboardData();
      setTimeout(() => {
        restoreDashboard();
      }, 1500);
    } else {
      showNotification(result.error || "Failed to create task", "error");
      resetTaskFormState(form, submitBtn, originalText);
    }
  } catch (error) {
    console.error("❌ Network error:", error);
    clearTimeout(timeoutId);
    showNotification("Network error. Please try again.", "error");
    resetTaskFormState(form, submitBtn, originalText);
  } finally {
    setTimeout(() => {
      isTaskSubmitting = false;
    }, 1000);
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
      `/api/projects/check-duplicate/?name=${encodeURIComponent(projectName)}`
    );
    const result = await response.json();

    if (result.exists) {
      resetFormState(form, submitBtn, originalText, originalDisabled);
      showNotification(
        `You already have a project named "${result.project_name}"`,
        "error"
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
        "error"
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

  setupProjectDropdown();

  const taskForm = document.getElementById("taskForm");
  if (taskForm) {
    taskForm.onsubmit = function (e) {
      e.preventDefault();
      handleTaskFormSubmit(this);
      return false;
    };
  }

  const closeBtn = document.querySelector(".close-form-btn");
  if (closeBtn) {
    closeBtn.onclick = function (e) {
      e.preventDefault();
      restoreDashboard();
    };
  }

  const cancelBtn = document.querySelector(".cancel-btn");
  if (cancelBtn) {
    cancelBtn.onclick = function (e) {
      e.preventDefault();
      restoreDashboard();
    };
  }

  console.log("✅ Task form setup complete");
}

function setupProjectDropdown() {
  const customDropdown = document.getElementById("customProjectDropdown");
  const selectElement = document.getElementById("taskProject");
  const searchInput = document.getElementById("projectSearch");
  const optionsContainer = document.getElementById("projectOptions");
  const selectedText = document.getElementById("selectedProjectText");

  if (!customDropdown || !selectElement || !searchInput || !optionsContainer) {
    console.log("⚠️ Dropdown elements not found");
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
      `#task-${taskId}`
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
    ".checklist input[type='checkbox']"
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

      // Update the status badge/indicator
      const statusElement = document.querySelector(".status-select");
      if (statusElement) {
        statusElement.className = `status-select ${newStatus}`;
        statusElement.value = newStatus;
      }

      // Refresh dashboard if we're on it
      if (AppState.currentPage === "dashboard") {
        refreshDashboardData();
      }
    } else {
      showNotification(result.error || "Failed to update status", "error");
    }
  } catch (error) {
    console.error("Error updating task status:", error);
    showNotification("Network error updating status", "error");
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
    }`
  );

  // Update progress bar
  updateSubtaskProgress();
}

function updateSubtaskProgress() {
  const checkboxes = document.querySelectorAll(
    ".checklist input[type='checkbox']"
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
    "blue"
  );

  const labelsContainer = document.querySelector(".labels");
  if (!labelsContainer) return;

  const newLabel = document.createElement("span");
  newLabel.className = `label ${labelColor}`;
  newLabel.textContent = labelText;

  labelsContainer.insertBefore(
    newLabel,
    labelsContainer.querySelector(".add-label")
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

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      throw new Error("API returned HTML instead of JSON.");
    }

    const data = await response.json();

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
      `#project-${projectId}`
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
  return `
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

function filterTasks(filter, projectId) {
  const taskCards = document.querySelectorAll(
    `#tasksGrid-${projectId} .task-card`
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
  `
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
  updateDashboardCounts(AppState.cachedData.counts);
  updatePinnedProjectsFromCache();
  console.log("✅ Dashboard UI updated");
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
          <button class="filter-tab" data-filter="my">My Tasks</button>
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
  console.log("🔧 Initializing tasks page with", data.tasks ? 'data' : 'no data');
  
  // Setup view toggles
  setupViewToggles();
  
  // Setup filter tabs
  setupFilterTabs();
  
  // Populate both views
  populateKanbanView(data.tasks || {});
  populateListView(data.tasks || {});
  
  // Setup new task button
  const newTaskBtn = document.getElementById('newTaskBtnFull');
  if (newTaskBtn) {
    newTaskBtn.addEventListener('click', function(e) {
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
  `
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
                100
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
  `
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
  `
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
          ".task-assignee small, .task-assignee .unassigned"
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
  return dueDate < today && task.status !== 'done';
}

// =============================================
// TASK DETAILS - MISSING FUNCTIONS
// =============================================

function showTaskMenu(event, taskId) {
  event.stopPropagation();
  event.preventDefault();

  // Remove any existing menus
  const existingMenus = document.querySelectorAll(".context-menu");
  existingMenus.forEach(menu => menu.remove());

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
    const starredTasks = JSON.parse(localStorage.getItem('starredTasks') || '[]');
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
    
    localStorage.setItem('starredTasks', JSON.stringify(starredTasks));
    
    // Update UI
    const starBtn = document.querySelector('.task-actions .fa-star');
    if (starBtn) {
      if (isStarred) {
        starBtn.parentElement.classList.remove('starred');
      } else {
        starBtn.parentElement.classList.add('starred');
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
      throw new Error(data.error || 'Failed to fetch task');
    }
    
    const task = data.task;
    
    // Create a duplicate with "Copy" in the title
    const duplicateData = {
      title: `${task.title} (Copy)`,
      description: task.description,
      project: task.project.id,
      assigned_to: task.assigned_to?.id || null,
      status: 'todo', // Reset status to todo
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
      showNotification(createResult.error || "Failed to duplicate task", "error");
    }
  } catch (error) {
    console.error("Error duplicating task:", error);
    showNotification("Failed to duplicate task", "error");
  }
}

async function deleteTask(taskId) {
  if (!confirm("Are you sure you want to delete this task? This action cannot be undone.")) return;
  
  try {
    // In a real app, you would have a delete endpoint
    // For now, we'll show a notification and go back
    showNotification("Task deleted successfully!", "success");
    
    // Go back to dashboard
    setTimeout(() => {
      restoreDashboard();
      // Refresh dashboard data
      refreshDashboardData();
    }, 1000);
  } catch (error) {
    console.error("Error deleting task:", error);
    showNotification("Failed to delete task", "error");
  }
}

function editComment(commentId) {
  const commentElement = document.querySelector(`[data-comment-id="${commentId}"]`);
  if (!commentElement) {
    // Find by content
    const allComments = document.querySelectorAll('.activity-item.comment');
    allComments.forEach(comment => {
      const editLink = comment.querySelector('a[onclick*="' + commentId + '"]');
      if (editLink) {
        commentElement = comment;
      }
    });
  }
  
  if (!commentElement) return;
  
  const commentBody = commentElement.querySelector('.comment-body p');
  const currentContent = commentBody.textContent;
  
  // Replace with textarea for editing
  const textarea = document.createElement('textarea');
  textarea.value = currentContent;
  textarea.className = 'comment-edit-textarea';
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
  const actionsDiv = commentElement.querySelector('.comment-actions');
  const originalHTML = actionsDiv.innerHTML;
  
  actionsDiv.innerHTML = `
    <button class="qa-btn small-btn" onclick="saveCommentEdit(${commentId}, this)">Save</button>
    <button class="qa-btn small-btn cancel-btn" onclick="cancelCommentEdit(${commentId}, '${currentContent.replace(/'/g, "\\'")}')">Cancel</button>
  `;
  
  // Store original state
  commentElement.dataset.originalContent = currentContent;
  commentElement.dataset.originalActions = originalHTML;
}

async function saveCommentEdit(commentId, button) {
  const commentElement = button.closest('.activity-item.comment');
  const textarea = commentElement.querySelector('.comment-edit-textarea');
  const newContent = textarea.value.trim();
  
  if (!newContent) {
    showNotification("Comment cannot be empty", "error");
    return;
  }
  
  try {
    // In a real app, you would have an update comment endpoint
    // For now, we'll update the UI directly
    const commentBody = document.createElement('p');
    commentBody.textContent = newContent;
    
    textarea.parentNode.replaceChild(commentBody, textarea);
    
    // Restore actions
    const actionsDiv = commentElement.querySelector('.comment-actions');
    if (commentElement.dataset.originalActions) {
      actionsDiv.innerHTML = commentElement.dataset.originalActions;
    } else {
      actionsDiv.innerHTML = `<span class="muted">Edited just now</span> · <a href="#" onclick="editComment(${commentId})">Edit</a>`;
    }
    
    showNotification("Comment updated", "success");
  } catch (error) {
    console.error("Error saving comment edit:", error);
    showNotification("Failed to update comment", "error");
  }
}

function cancelCommentEdit(commentId, originalContent) {
  const commentElement = document.querySelector(`[data-comment-id="${commentId}"]`);
  if (!commentElement) return;
  
  // Restore original content
  const textarea = commentElement.querySelector('.comment-edit-textarea');
  if (textarea) {
    const commentBody = document.createElement('p');
    commentBody.textContent = originalContent;
    textarea.parentNode.replaceChild(commentBody, textarea);
  }
  
  // Restore original actions
  const actionsDiv = commentElement.querySelector('.comment-actions');
  if (commentElement.dataset.originalActions) {
    actionsDiv.innerHTML = commentElement.dataset.originalActions;
  }
}

function moveTaskToProject(taskId) {
  // Get all projects for the current user
  fetch('/api/projects/all/')
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        // Create project selection modal
        const modal = document.createElement('div');
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
        
        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
          background: #1a1a1a;
          border: 1px solid #333;
          border-radius: 12px;
          padding: 24px;
          max-width: 400px;
          width: 90%;
          color: white;
        `;
        
        const projectsOptions = data.projects.map(project => 
          `<option value="${project.id}">${project.name}</option>`
        ).join('');
        
        modalContent.innerHTML = `
          <h3 style="margin-top: 0;">Move Task to Project</h3>
          <p>Select a project to move this task to:</p>
          <select id="projectSelect" class="form-select" style="width: 100%; margin: 16px 0;">
            ${projectsOptions}
          </select>
          <div style="display: flex; gap: 10px; margin-top: 20px;">
            <button class="qa-btn cancel-btn" style="flex: 1;" onclick="this.closest('.modal-overlay').remove()">
              Cancel
            </button>
            <button class="qa-btn" style="flex: 1; background: #00aaff;" onclick="confirmMoveTask(${taskId}, this)">
              Move
            </button>
          </div>
        `;
        
        modal.appendChild(modalContent);
        modal.className = 'modal-overlay';
        document.body.appendChild(modal);
      }
    })
    .catch(error => {
      console.error("Error loading projects:", error);
      showNotification("Failed to load projects", "error");
    });
}

async function confirmMoveTask(taskId, button) {
  const projectSelect = document.getElementById('projectSelect');
  if (!projectSelect) return;
  
  const newProjectId = projectSelect.value;
  
  try {
    // Update task project
    const response = await fetch(`/api/tasks/${taskId}/update/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": getCSRFToken(),
      },
      body: JSON.stringify({
        project: newProjectId
      }),
    });
    
    const result = await response.json();
    
    if (result.success) {
      showNotification("Task moved to new project", "success");
      
      // Close modal
      const modal = button.closest('.modal-overlay');
      if (modal) modal.remove();
      
      // Reload task details
      const taskTitle = document.getElementById('taskTitle')?.textContent || 'Task';
      openTaskDetails(taskId, taskTitle);
    } else {
      showNotification(result.error || "Failed to move task", "error");
    }
  } catch (error) {
    console.error("Error moving task:", error);
    showNotification("Failed to move task", "error");
  }
}

// Add this CSS for small buttons
const style = document.createElement('style');
style.textContent = `
  .small-btn {
    padding: 4px 8px !important;
    font-size: 12px !important;
    margin-right: 4px;
  }
  
  .comment-edit-textarea:focus {
    outline: none;
    border-color: #00aaff !important;
    box-shadow: 0 0 0 2px rgba(0, 170, 255, 0.2) !important;
  }
`;
document.head.appendChild(style);

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
    window.location.href = "/logout/";
  }
}

// =============================================
// ADDITIONAL UTILITIES
// =============================================

function setupTaskDragAndDrop() {
  const kanbanBoard = document.getElementById("kanbanBoard");
  if (!kanbanBoard) return;

  let draggedTask = null;

  kanbanBoard.addEventListener("dragstart", function (e) {
    if (
      e.target.classList.contains("kanban-task") &&
      !e.target.classList.contains("empty")
    ) {
      draggedTask = e.target;
      e.target.style.opacity = "0.5";
    }
  });

  kanbanBoard.addEventListener("dragend", function (e) {
    if (draggedTask) {
      draggedTask.style.opacity = "1";
      draggedTask = null;
    }
  });

  kanbanBoard.addEventListener("dragover", function (e) {
    e.preventDefault();
    const column = e.target.closest(".kanban-column");
    if (column) {
      column.style.backgroundColor = "rgba(0, 170, 255, 0.1)";
    }
  });

  kanbanBoard.addEventListener("dragleave", function (e) {
    const column = e.target.closest(".kanban-column");
    if (column) {
      column.style.backgroundColor = "";
    }
  });

  kanbanBoard.addEventListener("drop", function (e) {
    e.preventDefault();
    const column = e.target.closest(".kanban-column");
    if (column && draggedTask) {
      column.style.backgroundColor = "";
      const taskContainer = column.querySelector(".kanban-task:not(.empty)");
      if (taskContainer) {
        taskContainer.appendChild(draggedTask);

        const newStatus = column.getAttribute("data-column");
        const taskId = draggedTask.getAttribute("data-task-id");

        if (taskId && newStatus) {
          updateTaskStatus(taskId, newStatus);
        }
      }
    }
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
      throw new Error(data.error || 'Failed to load task details');
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
    history.pushState({ page: "task-details", taskId: taskId }, "", `#task-${taskId}`);

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
  let dueDateDisplay = 'No deadline';
  let dueDateClass = '';
  let timeLeft = '';
  
  if (task.due_date) {
    const dueDate = new Date(task.due_date);
    const today = new Date();
    const diffTime = dueDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    dueDateDisplay = dueDate.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
    
    if (diffDays === 0) {
      timeLeft = 'Due Today';
      dueDateClass = 'urgent';
    } else if (diffDays < 0) {
      timeLeft = `${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? 's' : ''} overdue`;
      dueDateClass = 'critical';
    } else {
      timeLeft = `in ${diffDays} day${diffDays !== 1 ? 's' : ''}`;
      dueDateClass = diffDays <= 3 ? 'urgent' : '';
    }
  }
  
  // Format priority badge
  const priorityClasses = {
    'urgent': 'critical',
    'high': 'urgent',
    'medium': 'warning',
    'low': ''
  };
  
  const priorityClass = priorityClasses[task.priority] || '';
  
  // Format assignee info
  let assigneeHTML = '';
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
          <span class="task-id muted">#TASK-${task.id}</span>
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
              <option value="todo" ${task.status === 'todo' ? 'selected' : ''}>To Do</option>
              <option value="inprogress" ${task.status === 'inprogress' ? 'selected' : ''}>In Progress</option>
              <option value="review" ${task.status === 'review' ? 'selected' : ''}>Review</option>
              <option value="done" ${task.status === 'done' ? 'selected' : ''}>Done</option>
            </select>
            <div class="priority-badge ${priorityClass}">
              ${task.priority_display || task.priority.charAt(0).toUpperCase() + task.priority.slice(1)} Priority
            </div>
            ${task.due_date ? `
              <div class="due-date ${dueDateClass}">
                <i class="fa fa-clock"></i>
                <span>Due ${dueDateDisplay} · <strong>${timeLeft}</strong></span>
              </div>
            ` : ''}
          </div>

          ${assigneeHTML}
          
          ${projectLink}

          <section class="task-section">
            <h3>Description</h3>
            <div class="rich-text" contenteditable="true" id="taskDescription" 
                 placeholder="Add a detailed description...">
              ${task.description || 'No description provided. Click to add one.'}
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
                ${window.djangoData?.user?.firstName?.charAt(0) || 'U'}
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
              <input type="date" id="taskDueDate" value="${task.due_date || ''}">
            </div>
            <div class="date-field">
              <label>Priority</label>
              <select id="taskPriority" class="priority-select">
                <option value="low" ${task.priority === 'low' ? 'selected' : ''}>Low</option>
                <option value="medium" ${task.priority === 'medium' ? 'selected' : ''}>Medium</option>
                <option value="high" ${task.priority === 'high' ? 'selected' : ''}>High</option>
                <option value="urgent" ${task.priority === 'urgent' ? 'selected' : ''}>Urgent</option>
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
    statusSelect.addEventListener("change", function() {
      updateTaskStatus(task.id, this.value);
    });
  }

  // Title update
  const taskTitle = document.getElementById("taskTitle");
  if (taskTitle) {
    taskTitle.addEventListener("blur", function() {
      saveTaskField(task.id, 'title', this.textContent);
    });
  }

  // Description update
  const description = document.getElementById("taskDescription");
  if (description) {
    description.addEventListener("blur", function() {
      saveTaskField(task.id, 'description', this.textContent);
    });
  }

  // Due date update
  const dueDateInput = document.getElementById("taskDueDate");
  if (dueDateInput) {
    dueDateInput.addEventListener("change", function() {
      saveTaskField(task.id, 'due_date', this.value);
    });
  }

  // Priority update
  const prioritySelect = document.getElementById("taskPriority");
  if (prioritySelect) {
    prioritySelect.addEventListener("change", function() {
      saveTaskField(task.id, 'priority', this.value);
    });
  }

  // Assignee update
  const assigneeSelect = document.getElementById("taskAssignee");
  if (assigneeSelect) {
    // Load project members
    loadProjectMembers(task.project.id, assigneeSelect, task.assigned_to?.id);
    
    assigneeSelect.addEventListener("change", function() {
      saveTaskField(task.id, 'assigned_to', this.value || null);
    });
  }

  // Load comments
  loadComments(task.id);

  // Comment input
  const commentInput = document.getElementById("commentInput");
  if (commentInput) {
    commentInput.addEventListener("keypress", function(e) {
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
        [field]: value
      }),
    });

    const result = await response.json();
    
    if (result.success) {
      showNotification(`${field.replace('_', ' ')} updated`, "success");
      
      // Update UI if needed
      if (field === 'status') {
        const statusElement = document.querySelector(".status-select");
        if (statusElement) {
          statusElement.className = `status-select ${value}`;
        }
      }
      
      // Refresh dashboard if we're on it
      if (AppState.currentPage === "dashboard") {
        refreshDashboardData();
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
      const currentUserOption = document.createElement('option');
      currentUserOption.value = window.djangoData?.user?.id || "";
      currentUserOption.textContent = `${window.djangoData?.user?.firstName || "You"} (You)`;
      if (selectedUserId === window.djangoData?.user?.id) {
        currentUserOption.selected = true;
      }
      selectElement.appendChild(currentUserOption);
      
      // Add other members
      data.members.forEach(member => {
        if (member.id !== window.djangoData?.user?.id) {
          const option = document.createElement('option');
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
      const systemItems = commentStream.querySelectorAll('.activity-item.system');
      commentStream.innerHTML = '';
      
      // Add back system items
      systemItems.forEach(item => {
        commentStream.appendChild(item);
      });
      
      // Add comments
      data.comments.forEach(comment => {
        const commentElement = document.createElement('div');
        commentElement.className = 'activity-item comment';
        commentElement.innerHTML = `
          <div class="avatar" title="${comment.user.full_name}">
            ${comment.user.initial}
          </div>
          <div class="comment-body">
            <strong>${comment.user.full_name}</strong>
            <p>${comment.content}</p>
            <div class="comment-actions">
              <span class="muted">${formatTimeAgo(comment.created_at)}</span>
              ${comment.is_editable ? '· <a href="#" onclick="editComment(${comment.id})">Edit</a>' : ''}
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
        content: commentInput.value.trim()
      }),
    });

    const data = await response.json();
    
    if (data.success) {
      // Clear input
      commentInput.value = "";
      
      // Add comment to UI
      const commentStream = document.getElementById("commentStream");
      if (commentStream) {
        const commentElement = document.createElement('div');
        commentElement.className = 'activity-item comment';
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
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric' 
  });
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    month: 'long', 
    day: 'numeric', 
    year: 'numeric' 
  });
}

// Fix the "Add Task" button issue
function addTaskToProject(projectId) {
  console.log(`Add task to project ${projectId}`);
  showNewTaskForm();
  
  // Pre-select the project in the task form
  setTimeout(() => {
    const projectSelect = document.getElementById("taskProject");
    const customProjectDropdown = document.getElementById("customProjectDropdown");
    const selectedText = document.getElementById("selectedProjectText");
    
    if (projectSelect && projectId) {
      // Set the value on the hidden select
      projectSelect.value = projectId;
      
      // Update the custom dropdown display
      if (customProjectDropdown && selectedText) {
        // Find the project name from options
        const option = Array.from(projectSelect.options).find(opt => opt.value == projectId);
        if (option) {
          selectedText.textContent = option.textContent;
          
          // Highlight in dropdown
          document.querySelectorAll('.dropdown-option').forEach(opt => {
            opt.classList.remove('selected');
            if (opt.getAttribute('data-value') == projectId) {
              opt.classList.add('selected');
            }
          });
        }
      }
      
      // Trigger change to load assignees
      projectSelect.dispatchEvent(new Event('change'));
    }
  }, 500);
}

// Add to your existing project details HTML template to fix the button
function createProjectDetailsHTML(data, projectId) {
  return `
    <div class="simple-project-details">
      <div class="project-header">
        <button class="qa-btn back-btn" onclick="restoreDashboard()">
          <i class="fa fa-arrow-left"></i> Back to Dashboard
        </button>
        <div class="project-title-section">
          <h1>${data.project.name}</h1>
          <div class="project-meta">
            <span>Owned by ${data.project.owner.name}</span>
            <span>• Created ${new Date(data.project.created_at).toLocaleDateString()}</span>
          </div>
        </div>
        <div class="project-actions">
          <button class="icon-btn" onclick="editProject(${projectId})" title="Edit Project">
            <i class="fa fa-edit"></i>
          </button>
          <button class="icon-btn" onclick="window.addTaskToProject(${projectId})" title="Add Task">
            <i class="fa fa-plus"></i>
          </button>
        </div>
      </div>
      <!-- ... rest of the HTML ... -->
    </div>
  `;
}

// Make sure to export the function globally
window.addTaskToProject = addTaskToProject;

function setupSearchFunctionality() {
  const desktopSearchToggle = document.getElementById("desktopSearchToggle");
  const desktopSearchContainer = document.getElementById(
    "desktopSearchContainer"
  );
  const desktopSearchInput = document.getElementById("desktopSearchInput");
  const mobileSearchInput = document.getElementById("mobileSearchInput");

  if (desktopSearchToggle && desktopSearchContainer) {
    desktopSearchToggle.addEventListener("click", function () {
      desktopSearchContainer.classList.toggle("active");
      if (
        desktopSearchContainer.classList.contains("active") &&
        desktopSearchInput
      ) {
        desktopSearchInput.focus();
      }
    });

    document.addEventListener("click", function (e) {
      if (
        !desktopSearchContainer.contains(e.target) &&
        !desktopSearchToggle.contains(e.target)
      ) {
        desktopSearchContainer.classList.remove("active");
      }
    });
  }

  if (desktopSearchInput) {
    desktopSearchInput.addEventListener("keypress", function (e) {
      if (e.key === "Enter") {
        performSearch(this.value);
      }
    });
  }

  if (mobileSearchInput) {
    mobileSearchInput.addEventListener("keypress", function (e) {
      if (e.key === "Enter") {
        performSearch(this.value);
      }
    });
  }
}

function performSearch(query) {
  if (!query || query.trim() === "") return;

  console.log(`Searching for: ${query}`);
  showNotification(`Searching for "${query}"...`, "info");

  // In a real app, you would make an API call here
  // For now, we'll just show a notification
  setTimeout(() => {
    showNotification(`Found 0 results for "${query}"`, "info");
  }, 1000);
}

function toggleDesktopSearch() {
  const desktopSearchContainer = document.getElementById(
    "desktopSearchContainer"
  );
  if (desktopSearchContainer) {
    desktopSearchContainer.classList.toggle("active");
    const searchInput = document.getElementById("desktopSearchInput");
    if (desktopSearchContainer.classList.contains("active") && searchInput) {
      searchInput.focus();
    }
  }
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
          `/api/projects/check-duplicate/?name=${encodeURIComponent(name)}`
        );
        const result = await response.json();

        if (result.exists) {
          this.classList.remove("validating");
          this.classList.add("invalid");
          showValidationFeedback(
            this,
            "error",
            `You already have "${result.project_name}"`
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
    ".validation-feedback"
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

console.log("🎯 SwyftTask Dashboard with Task Details loaded successfully");

