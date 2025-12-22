// =============================================
// SWYFTTASK DASHBOARD - ULTRA SIMPLIFIED VERSION
// =============================================

// Global state
const AppState = {
  originalDashboardHTML: null,
  currentPage: "dashboard",
};

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

  console.log("✅ All functionality setup complete");
}

// =============================================
// EVENT LISTENERS
// =============================================

function setupEventListeners() {
  console.log("🔧 Setting up event listeners...");

  // ========== HEADER BUTTONS ==========

  // Hamburger menu
  const hamburgerBtn = document.getElementById("hamburgerBtn");
  if (hamburgerBtn) {
    hamburgerBtn.addEventListener("click", toggleSidebar);
  }

  // Home button
  const homeBtn = document.getElementById("homeBtn");
  if (homeBtn) {
    homeBtn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      console.log("🏠 Home button clicked");
      restoreDashboard();
    });
  }

  // ========== QUICK ACTION BUTTONS ==========

  // New Project Button
  const newProjectBtn = document.getElementById("newProjectBtn");
  if (newProjectBtn) {
    newProjectBtn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      console.log("📁 New Project button clicked");
      showNewProjectForm();
    });
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
      const projectId = projectCard.getAttribute("data-project-id");
      const projectName = projectCard.querySelector("h4").textContent.trim();
      console.log(`📁 Project card clicked: ${projectId} - ${projectName}`);
      openProjectDetails(projectId, projectName);
      return;
    }

    // Check if clicked on View All Projects
    if (e.target.closest(".view-all-projects")) {
      e.preventDefault();
      e.stopPropagation();
      console.log("📁 View All Projects clicked");
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
        console.log(`📁 Project menu clicked: ${projectId}`);
        showProjectContextMenu(e, projectId);
      }
      return;
    }
  });

  console.log("✅ All event listeners setup complete");
}

// =============================================
// PROJECT FUNCTIONS
// =============================================

// Function to open project details
async function openProjectDetails(projectId, projectName) {
  console.log(`🏗️ Opening project ${projectId}: ${projectName}`);
  showLoader();

  // First test the API
  const testData = await testProjectAPI(projectId);
  if (!testData) {
    hideLoader();
    showNotification(
      "Project API is returning HTML instead of JSON. Check the console.",
      "error"
    );
    return;
  }

  try {
    // Fetch project data from API
    const response = await fetch(`/api/projects/${projectId}/`);
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
  } catch (error) {
    console.error("❌ Error loading all projects:", error);
    showNotification(`Failed to load projects: ${error.message}`, "error");
    restoreDashboard();
  }

  hideLoader();
}

// =============================================
// UTILITY FUNCTIONS
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

function showLoader() {
  const loader = document.getElementById("pageLoader");
  if (loader) loader.classList.add("active");
}

function hideLoader() {
  const loader = document.getElementById("pageLoader");
  if (loader) loader.classList.remove("active");
}

function showNotification(message, type = "success") {
  // Remove existing notification
  const existingNotification = document.querySelector(".notification-toast");
  if (existingNotification) {
    existingNotification.remove();
  }

  // Create new notification
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

  // Add styles
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

  // Auto remove after 5 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.remove();
    }
  }, 5000);
}

// =============================================
// FORM FUNCTIONS
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

    // Update state
    AppState.currentPage = "new-project";
    updateSidebarActive("");
    localStorage.setItem("swyfttask-page", "new-project");
    history.pushState({ page: "new-project" }, "", "#new-project");

    hideLoader();
  }, 300);
}

function showNewTaskForm() {
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

    // Update state
    AppState.currentPage = "new-task";
    updateSidebarActive("");
    localStorage.setItem("swyfttask-page", "new-task");
    history.pushState({ page: "new-task" }, "", "#new-task");

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

function restoreDashboard() {
  console.log("🔄 Restoring dashboard...");

  if (!AppState.originalDashboardHTML) {
    console.error("❌ No dashboard HTML saved");
    window.location.reload();
    return;
  }

  showLoader();

  setTimeout(() => {
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

    // Reinitialize functionality
    setTimeout(() => {
      setupEventListeners();
      setupSidebar();
    }, 100);

    hideLoader();
  }, 300);
}

// =============================================
// OTHER FUNCTIONS
// =============================================

function setupSidebar() {
  const sidebarItems = document.querySelectorAll(".aside li[data-page]");

  sidebarItems.forEach((item) => {
    item.addEventListener("click", function () {
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

function showTasksPage() {
  showNotification("Tasks page coming soon!", "info");
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

console.log("🎯 SwyftTask Dashboard script loaded successfully");

// Add this function to debug API calls
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

// Add this function to handle form close buttons
function setupFormCloseButtons() {
    // Event delegation for close buttons
    document.addEventListener('click', function(e) {
        // Check for close buttons in forms
        if (e.target.closest('.close-form-btn') || 
            e.target.classList.contains('fa-times')) {
            e.preventDefault();
            e.stopPropagation();
            console.log('❌ Close button clicked');
            restoreDashboard();
        }
        
        // Also handle cancel buttons
        if (e.target.classList.contains('cancel-btn') || 
            e.target.closest('.cancel-btn')) {
            e.preventDefault();
            e.stopPropagation();
            console.log('❌ Cancel button clicked');
            restoreDashboard();
        }
    });
}

// Call this function in setupAllFunctionality
function setupAllFunctionality() {
    console.log("🔧 Setting up all functionality...");
    
    // Setup event listeners
    setupEventListeners();
    
    // Setup sidebar
    setupSidebar();
    
    // Setup form close buttons
    setupFormCloseButtons();
    
    console.log("✅ All functionality setup complete");
}

// =============================================
// FORM HANDLING FUNCTIONS
// =============================================

function setupFormCloseButtons() {
    console.log("🔧 Setting up form close buttons...");
    
    // Event delegation for all close/cancel buttons
    document.addEventListener('click', function(e) {
        // Close form button
        if (e.target.closest('.close-form-btn') || 
            e.target.classList.contains('fa-times') && e.target.closest('button')) {
            e.preventDefault();
            e.stopPropagation();
            console.log('❌ Form close button clicked');
            restoreDashboard();
            return;
        }
        
        // Cancel button
        if (e.target.classList.contains('cancel-btn') || 
            (e.target.tagName === 'BUTTON' && e.target.textContent.toLowerCase().includes('cancel'))) {
            e.preventDefault();
            e.stopPropagation();
            console.log('❌ Cancel button clicked');
            restoreDashboard();
            return;
        }
        
        // Back to Dashboard button
        if (e.target.id === 'backDashboardBtn' || 
            e.target.closest('#backDashboardBtn') ||
            (e.target.tagName === 'BUTTON' && e.target.textContent.includes('Back to Dashboard'))) {
            e.preventDefault();
            e.stopPropagation();
            console.log('🔙 Back to dashboard clicked');
            restoreDashboard();
            return;
        }
    });
}

// Also handle form submission
function setupFormSubmissions() {
    document.addEventListener('submit', function(e) {
        if (e.target.id === 'taskForm') {
            e.preventDefault();
            e.stopPropagation();
            console.log('📝 Task form submitted');
            handleTaskFormSubmit(e.target);
            return;
        }
        
        if (e.target.id === 'projectForm') {
            e.preventDefault();
            e.stopPropagation();
            console.log('📁 Project form submitted');
            handleProjectFormSubmit(e.target);
            return;
        }
    });
}

async function handleTaskFormSubmit(form) {
    showLoader();
    
    const formData = new FormData(form);
    const data = {
        title: formData.get('title'),
        description: formData.get('description'),
        project: formData.get('project'),
        assigned_to: formData.get('assigned_to'),
        status: formData.get('status'),
        priority: formData.get('priority'),
        due_date: formData.get('due_date')
    };
    
    try {
        const response = await fetch('/api/tasks/create/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
          showNotification(result.message, "success");

          // Update the dashboard counts WITHOUT refreshing
          updateDashboardCounts({
            type: "task_created",
            projectId: data.project,
            taskStatus: data.status,
          });

          // Update specific sections based on where we are
          if (AppState.currentPage === "dashboard") {
            updateDashboardAfterTaskCreation(result.task);
          } else if (AppState.currentPage.startsWith("project-")) {
            updateProjectAfterTaskCreation(result.task);
          }

          restoreDashboard();
        } else {
            showNotification(result.error || 'Failed to create task', 'error');
        }
    } catch (error) {
        console.error('Error creating task:', error);
        showNotification('Network error. Please try again.', 'error');
    }
    
    hideLoader();
}

async function handleProjectFormSubmit(form) {
    showLoader();
    
    const formData = new FormData(form);
    const data = {
        name: formData.get('name'),
        description: formData.get('description'),
        invited_emails: JSON.parse(formData.get('invited_emails') || '[]')
    };
    
    console.log('📤 Sending project data:', data);
    
    try {
        const response = await fetch('/api/projects/create/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        console.log('📥 Project creation response:', result);
        
        if (result.success) {
          showNotification(result.message, "success");

          // Update dashboard counts
          updateDashboardCounts({ type: "project_created" });

          // Add the new project to the pinned projects section
          addNewProjectToDashboard(result.project);

          restoreDashboard();
        } else {
            showNotification(result.error || 'Failed to create project', 'error');
        }
    } catch (error) {
        console.error('Error creating project:', error);
        showNotification('Network error. Please try again.', 'error');
    }
    
    hideLoader();
}

// Helper function to get CSRF token
function getCSRFToken() {
    const csrfInput = document.querySelector('input[name="csrfmiddlewaretoken"]');
    return csrfInput ? csrfInput.value : '';
}

// Update setupAllFunctionality to include form handling
function setupAllFunctionality() {
    console.log("🔧 Setting up all functionality...");
    
    // Setup event listeners
    setupEventListeners();
    
    // Setup sidebar
    setupSidebar();
    
    // Setup form handlers
    setupFormCloseButtons();
    setupFormSubmissions();
    
    console.log("✅ All functionality setup complete");
}

// Function to update assignee dropdown based on selected project
function updateAssigneeDropdown(projectId) {
    if (!projectId) {
        // Clear the dropdown
        const assigneeSelect = document.getElementById('taskAssignee');
        if (assigneeSelect) {
            assigneeSelect.innerHTML = `
                <option value="">Unassigned</option>
                <option value="${window.djangoData.user.id}">${window.djangoData.user.firstName} (You)</option>
            `;
        }
        return;
    }
    
    // Fetch project members
    fetch(`/api/projects/${projectId}/members/`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                updateAssigneeDropdownWithMembers(data.members);
            } else {
                console.error('Failed to fetch project members:', data.error);
                // Fallback to just the current user
                updateAssigneeDropdownWithMembers([]);
            }
        })
        .catch(error => {
            console.error('Error fetching project members:', error);
            updateAssigneeDropdownWithMembers([]);
        });
}

function updateAssigneeDropdownWithMembers(members) {
    const assigneeSelect = document.getElementById('taskAssignee');
    if (!assigneeSelect) return;
    
    // Clear existing options except the first one
    const currentUserOption = `<option value="${window.djangoData.user.id}">${window.djangoData.user.firstName} (You)</option>`;
    
    // Build new options
    let options = '<option value="">Unassigned</option>' + currentUserOption;
    
    // Add project members (excluding current user if already added)
    members.forEach(member => {
        if (member.id !== window.djangoData.user.id) {
            const displayName = member.first_name || member.username;
            options += `<option value="${member.id}">${displayName}</option>`;
        }
    });
    
    assigneeSelect.innerHTML = options;
}

// Add event listener for project selection change
document.addEventListener('change', function(e) {
    if (e.target && e.target.id === 'taskProject') {
        const projectId = e.target.value;
        updateAssigneeDropdown(projectId);
    }
});

// Function to fetch project members
async function getProjectMembers(projectId) {
    try {
        const response = await fetch(`/api/projects/${projectId}/members/`);
        const data = await response.json();
        return data.success ? data.members : [];
    } catch (error) {
        console.error('Error fetching project members:', error);
        return [];
    }
}

function updateAssigneeDropdownWithMembers(members) {
  const assigneeSelect = document.getElementById("taskAssignee");
  if (!assigneeSelect) return;

  // Clear existing options
  let options = '<option value="">Unassigned</option>';

  // Current user (always available)
  options += `<option value="${window.djangoData.user.id}">${window.djangoData.user.firstName} (You)</option>`;

  // Add project members (excluding current user)
  members.forEach((member) => {
    if (member.id !== window.djangoData.user.id) {
      const displayName = member.first_name
        ? `${member.first_name} ${member.last_name}`.trim()
        : member.username;
      options += `<option value="${member.id}">${displayName}</option>`;
    }
  });

  // If no other members, add a helpful message
  if (members.length <= 1) {
    // Only current user or no one
    options += '<option value="" disabled>── No other team members ──</option>';
    options +=
      '<option value="invite" style="color: #00aaff; font-style: italic;">+ Invite team members to project</option>';
  }

  assigneeSelect.innerHTML = options;

  // Add event listener for invite option
  assigneeSelect.addEventListener("change", function (e) {
    if (e.target.value === "invite") {
      e.target.value = "";
      // Show invite modal or redirect to project settings
      showNotification(
        "Use the project settings to invite team members",
        "info"
      );
    }
  });
}

// Function to update dashboard counts without refresh
async function updateDashboardCounts(updateData) {
    try {
        // Fetch updated counts from the server
        const response = await fetch('/api/dashboard/counts/');
        const data = await response.json();
        
        if (data.success) {
            // Update the counts in the DOM
            document.getElementById('activeProjectsCount').textContent = data.counts.active_projects;
            document.getElementById('tasksDueCount').textContent = data.counts.tasks_due;
            document.getElementById('overdueCount').textContent = data.counts.overdue;
            document.getElementById('teamCount').textContent = data.counts.team_count;
            
            // Update project progress if needed
            if (updateData && updateData.type === 'task_created') {
                updateProjectProgress(updateData.projectId);
            }
        }
    } catch (error) {
        console.error('Error updating dashboard counts:', error);
    }
}

// Update project progress bar and counts
function updateProjectProgress(projectId) {
    const projectCard = document.querySelector(`.pinned-project[data-project-id="${projectId}"]`);
    if (projectCard) {
        // Increment task count
        const smallText = projectCard.querySelector('small');
        if (smallText) {
            const currentText = smallText.textContent;
            const match = currentText.match(/(\d+) task/);
            if (match) {
                const currentCount = parseInt(match[1]);
                const newCount = currentCount + 1;
                smallText.textContent = currentText.replace(/(\d+) task/, `${newCount} task${newCount !== 1 ? 's' : ''}`);
            }
        }
    }
}

// Function to add new project to the pinned projects section
function addNewProjectToDashboard(projectData) {
    const pinnedProjects = document.querySelector('.pinned-projects');
    if (!pinnedProjects) return;
    
    // Check if we already have a "Create First Project" placeholder
    const emptyProject = pinnedProjects.querySelector('.pinned-project:not([data-project-id])');
    if (emptyProject) {
        emptyProject.remove();
    }
    
    // Create the new project card
    const projectCard = document.createElement('div');
    projectCard.className = 'pinned-project';
    projectCard.setAttribute('data-project-id', projectData.id);
    projectCard.onclick = () => openProjectDetails(projectData.id, projectData.name);
    
    projectCard.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <h4>${projectData.name}</h4>
            <button class="project-menu-btn" onclick="event.stopPropagation(); showProjectContextMenu(event, ${projectData.id})">
                <i class="fas fa-ellipsis-v"></i>
            </button>
        </div>
        <small>0% complete • 0 tasks</small>
        <div class="progress">
            <div class="progress-fill" style="width:0%"></div>
        </div>
    `;
    
    // Insert before the "View All" button if it exists
    const viewAllButton = pinnedProjects.querySelector('.view-all-projects');
    if (viewAllButton) {
        pinnedProjects.insertBefore(projectCard, viewAllButton);
    } else {
        pinnedProjects.appendChild(projectCard);
    }
    
    // Update active projects count
    const activeProjectsCount = document.getElementById('activeProjectsCount');
    if (activeProjectsCount) {
        const currentCount = parseInt(activeProjectsCount.textContent) || 0;
        activeProjectsCount.textContent = currentCount + 1;
    }
}

// Function to update dashboard after task creation
function updateDashboardAfterTaskCreation(taskData) {
    // Update "Tasks Due Today" count
    const tasksDueToday = document.querySelector('.tasks-due-today h3');
    if (tasksDueToday) {
        const match = tasksDueToday.textContent.match(/\((\d+)\)/);
        if (match) {
            const currentCount = parseInt(match[1]);
            const newCount = currentCount + (taskData.due_date === new Date().toISOString().split('T')[0] ? 1 : 0);
            tasksDueToday.innerHTML = tasksDueToday.innerHTML.replace(/\((\d+)\)/, `(${newCount})`);
        }
    }
    
    // Update "Your Tasks" count if assigned to current user
    if (taskData.assigned_to === window.djangoData.user.id) {
        const yourTasks = document.querySelector('.assigned-tasks h3');
        if (yourTasks) {
            const match = yourTasks.textContent.match(/\((\d+)\)/);
            if (match) {
                const currentCount = parseInt(match[1]);
                yourTasks.innerHTML = yourTasks.innerHTML.replace(/\((\d+)\)/, `(${currentCount + 1})`);
            }
        }
    }
    
    // Add to appropriate Kanban column if not done
    if (taskData.status !== 'done') {
        addTaskToKanbanPreview(taskData);
    }
}

// Function to add task to kanban preview
function addTaskToKanbanPreview(taskData) {
    const columnSelectors = {
        'todo': '.kanban-column[data-column="todo"]',
        'inprogress': '.kanban-column[data-column="inprogress"]',
        'review': '.kanban-column[data-column="review"]',
        'done': '.kanban-column[data-column="done"]'
    };
    
    const columnSelector = columnSelectors[taskData.status];
    if (!columnSelector) return;
    
    const column = document.querySelector(columnSelector);
    if (!column) return;
    
    // Remove empty placeholder if exists
    const emptyTask = column.querySelector('.kanban-task.empty');
    if (emptyTask) {
        emptyTask.remove();
    }
    
    // Create task element
    const taskElement = document.createElement('div');
    taskElement.className = 'kanban-task';
    taskElement.setAttribute('role', 'listitem');
    taskElement.setAttribute('data-task-id', taskData.id);
    taskElement.onclick = () => openTaskDetails(taskData.id, taskData.title);
    
    const assignedText = taskData.assigned_to_name ? `<small>@${taskData.assigned_to_name}</small>` : '';
    taskElement.innerHTML = `${taskData.title}${assignedText}`;
    
    // Add to column
    column.querySelector('.kanban-task:last-child') 
        ? column.insertBefore(taskElement, column.querySelector('.kanban-task:last-child').nextSibling)
        : column.appendChild(taskElement);
}

// Function to update project details page
function updateProjectAfterTaskCreation(taskData) {
    // This would update the project kanban board
    const projectKanban = document.getElementById('projectKanbanBoard');
    if (projectKanban) {
        // Add task to appropriate column
        const column = projectKanban.querySelector(`[data-status="${taskData.status}"]`);
        if (column) {
            addTaskToProjectKanban(column, taskData);
        }
        
        // Update project stats
        updateProjectStats();
    }
}

function updateProjectStats() {
    // Fetch updated project stats
    const projectId = AppState.currentPage.replace('project-', '');
    if (projectId) {
        fetch(`/api/projects/${projectId}/`)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Update project stats on the page
                    document.getElementById('completedTasks').textContent = data.stats.completed_tasks;
                    document.getElementById('totalTasks').textContent = data.stats.total_tasks;
                    document.getElementById('overdueTasks').textContent = data.stats.overdue_tasks;
                    document.getElementById('projectTaskCount').textContent = data.stats.total_tasks;
                    document.getElementById('projectProgressPercentage').textContent = `${data.stats.progress}%`;
                    document.getElementById('projectProgressFill').style.width = `${data.stats.progress}%`;
                }
            });
    }
}

// Simplified version - just refresh certain sections
async function refreshDashboardSection(section) {
    showLoader();
    
    try {
        // Fetch updated HTML for specific section
        const response = await fetch('/api/dashboard/section/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify({ section: section })
        });
        
        const data = await response.json();
        if (data.success && data.html) {
            // Replace the section
            const container = document.querySelector(`.${section}`);
            if (container) {
                container.innerHTML = data.html;
                // Reinitialize event listeners for this section
                setupEventListenersForSection(section);
            }
        }
    } catch (error) {
        console.error('Error refreshing section:', error);
    }
    
    hideLoader();
}

// Call this after creating task/project:
// refreshDashboardSection('pinned-projects');
// refreshDashboardSection('overview-widgets');