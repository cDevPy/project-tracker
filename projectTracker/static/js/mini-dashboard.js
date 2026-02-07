// =============================================
// CONFIGURATION
// =============================================

const CONFIG = {
  API_BASE: '/api',
  REFRESH_INTERVAL: 10000,
  USER_ACTIVITY_THRESHOLD: 30000,
  DEBOUNCE_DELAY: 300,
  FORM_SUBMIT_DELAY: 1500,
  MIN_REFRESH_INTERVAL: 2000,
  SEARCH_MIN_LENGTH: 2,
  NOTIFICATION_DURATION: 5000,
  BREAKPOINTS: {
    MOBILE: 768,
    TABLET: 1024
  }
};

// =============================================
// STATE MANAGEMENT
// =============================================

class AppStateManager {
  constructor() {
    this.state = {
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
    this.listeners = [];
  }

  getState() {
    return { ...this.state };
  }

  updateState(updates) {
    const oldState = { ...this.state };
    this.state = { ...this.state, ...updates };
    
    this.listeners.forEach(listener => {
      listener(this.state, oldState);
    });
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  reset() {
    this.state = {
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
  }
}

const AppState = new AppStateManager();

// =============================================
// NOTIFICATION SYSTEM
// =============================================

class NotificationManager {
  constructor() {
    this.container = this.createContainer();
  }

  createContainer() {
    let container = document.getElementById('notification-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'notification-container';
      container.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        pointer-events: none;
      `;
      document.body.appendChild(container);
    }
    return container;
  }

  show(message, type = 'info', duration = CONFIG.NOTIFICATION_DURATION) {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <div class="notification-content">
        <i class="fas fa-${this.getIcon(type)}"></i>
        <span>${message}</span>
      </div>
      <button class="notification-close" onclick="this.parentElement.remove()">
        <i class="fas fa-times"></i>
      </button>
    `;

    Object.assign(notification.style, {
      background: this.getBackgroundColor(type),
      border: `1px solid ${this.getBorderColor(type)}`,
      color: this.getTextColor(type),
      padding: '12px 16px',
      borderRadius: '8px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      marginBottom: '10px',
      pointerEvents: 'auto',
      backdropFilter: 'blur(20px)',
      animation: 'slideInRight 0.3s ease-out',
    });

    this.container.appendChild(notification);

    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, duration);
  }

  getIcon(type) {
    const icons = {
      success: 'check-circle',
      error: 'exclamation-circle',
      warning: 'exclamation-triangle',
      info: 'info-circle'
    };
    return icons[type] || 'info-circle';
  }

  getBackgroundColor(type) {
    const colors = {
      success: 'rgba(0, 255, 157, 0.1)',
      error: 'rgba(255, 107, 107, 0.1)',
      warning: 'rgba(255, 165, 0, 0.1)',
      info: 'rgba(0, 170, 255, 0.1)'
    };
    return colors[type] || colors.info;
  }

  getBorderColor(type) {
    const colors = {
      success: 'rgba(0, 255, 157, 0.3)',
      error: 'rgba(255, 107, 107, 0.3)',
      warning: 'rgba(255, 165, 0, 0.3)',
      info: 'rgba(0, 170, 255, 0.3)'
    };
    return colors[type] || colors.info;
  }

  getTextColor(type) {
    const colors = {
      success: '#00ff9d',
      error: '#ff6b6b',
      warning: '#ffa500',
      info: '#00aaff'
    };
    return colors[type] || '#00aaff';
  }
}

const notifications = new NotificationManager();

// Add CSS animation
const style = document.createElement('style');
style.textContent = `
  @keyframes slideInRight {
    from {
      opacity: 0;
      transform: translateX(100%);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
`;
document.head.appendChild(style);

// =============================================
// API SERVICE
// =============================================

class ApiService {
  constructor(baseUrl = CONFIG.API_BASE) {
    this.baseUrl = baseUrl;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': this.getCSRFToken(),
      },
    };

    try {
      const response = await fetch(url, { ...defaultOptions, ...options });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API Error (${endpoint}):`, error);
      throw error;
    }
  }

  getCSRFToken() {
    const csrfInput = document.querySelector('input[name="csrfmiddlewaretoken"]');
    return csrfInput ? csrfInput.value : '';
  }

  async getDashboardData() {
    return this.request('/dashboard/full-data/');
  }

  async createTask(data) {
    return this.request('/tasks/create/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTaskStatus(taskId, status) {
    return this.request('/tasks/update-status/', {
      method: 'POST',
      body: JSON.stringify({ task_id: taskId, status }),
    });
  }

  async createProject(data) {
    return this.request('/projects/create/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getProjectDetails(projectId) {
    return this.request(`/projects/${projectId}/`);
  }

  async search(query) {
    return this.request(`/search/?q=${encodeURIComponent(query)}`);
  }
}

const api = new ApiService();

// =============================================
// EVENT MANAGER
// =============================================

class EventManager {
  constructor() {
    this.listeners = new Map();
  }

  add(element, event, handler, options = {}) {
    if (!element) {
      console.warn("⚠️ EventManager: Element not found for event:", event);
      return;
    }
    
    console.log(`➕ Adding ${event} listener to`, element);
    element.addEventListener(event, handler, options);
    
    const key = this.getKey(element, event, handler);
    if (!this.listeners.has(key)) {
      this.listeners.set(key, []);
    }
    this.listeners.get(key).push({ element, event, handler, options });
  }

  remove(element, event, handler) {
    if (!element) return;
    
    element.removeEventListener(event, handler);
    
    const key = this.getKey(element, event, handler);
    const listeners = this.listeners.get(key) || [];
    const index = listeners.findIndex(l => l.handler === handler);
    if (index > -1) {
      listeners.splice(index, 1);
    }
    if (listeners.length === 0) {
      this.listeners.delete(key);
    }
  }

  removeAll(element) {
    if (!element) return;
    
    this.listeners.forEach((listeners, key) => {
      listeners.forEach(({ element: el, event, handler }) => {
        if (el === element) {
          el.removeEventListener(event, handler);
        }
      });
    });
    
    [...this.listeners.keys()].forEach(key => {
      if (key.startsWith(element.toString())) {
        this.listeners.delete(key);
      }
    });
  }

  cleanup() {
    this.listeners.forEach((listeners) => {
      listeners.forEach(({ element, event, handler }) => {
        element.removeEventListener(event, handler);
      });
    });
    this.listeners.clear();
  }

  getKey(element, event, handler) {
    return `${element.toString()}-${event}-${handler.toString()}`;
  }
}

const eventManager = new EventManager();

// =============================================
// AUTO-REFRESH SYSTEM
// =============================================

class AutoRefreshManager {
  constructor() {
    this.intervalId = null;
    this.isRefreshing = false;
    this.lastRefreshTime = 0;
    this.userActivityTime = Date.now();
  }

  start() {
    if (this.intervalId) {
      this.stop();
    }

    this.intervalId = setInterval(() => {
      if (AppState.getState().currentPage === "dashboard") {
        const timeSinceActivity = Date.now() - this.userActivityTime;
        if (timeSinceActivity < CONFIG.USER_ACTIVITY_THRESHOLD) {
          this.refreshDashboard();
        }
      }
    }, CONFIG.REFRESH_INTERVAL);

    this.setupActivityTracking();
    
    console.log("🔄 Auto-refresh started");
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log("⏹️ Auto-refresh stopped");
    }
  }

  async refreshDashboard() {
    if (this.isRefreshing) return;
    
    const now = Date.now();
    if (now - this.lastRefreshTime < CONFIG.MIN_REFRESH_INTERVAL) return;

    this.isRefreshing = true;
    this.lastRefreshTime = now;

    try {
      const data = await api.getDashboardData();
      
      if (data.success) {
        AppState.updateState({
          cachedData: {
            counts: data.counts || {},
            tasks: data.tasks || {},
            projects: data.projects || [],
            total_projects: data.total_projects || (data.projects ? data.projects.length : 0),
          }
        });
        
        updateDashboardUI();
        notifications.show("Dashboard updated", "success");
      } else {
        throw new Error(data.error || "Failed to refresh dashboard");
      }
    } catch (error) {
      console.error("❌ Refresh error:", error);
      notifications.show("Failed to refresh dashboard", "error");
    } finally {
      this.isRefreshing = false;
    }
  }

  setupActivityTracking() {
    const events = ['mousemove', 'click', 'keypress', 'scroll', 'touchstart'];
    
    const updateActivity = () => {
      this.userActivityTime = Date.now();
    };

    events.forEach(event => {
      eventManager.add(document, event, updateActivity, { passive: true });
    });
  }

  handleVisibilityChange() {
    if (document.hidden) {
      this.stop();
    } else {
      this.start();
    }
  }
}

const autoRefresh = new AutoRefreshManager();

// Setup visibility change listener
eventManager.add(document, 'visibilitychange', () => {
  autoRefresh.handleVisibilityChange();
});

// =============================================
// BASIC FUNCTIONS
// =============================================

function toggleSidebar() {
  console.log("🍔 Toggle sidebar called!");
  const sidebar = document.getElementById("sidebar");
  if (sidebar) {
    sidebar.classList.toggle("open");
    document.body.classList.toggle("sidebar-open");
    console.log("✅ Sidebar toggled");
  } else {
    console.log("❌ Sidebar element not found");
  }
}

function restoreDashboard() {
  console.log("🏠 Restore dashboard called!");
  showLoader();
  
  setTimeout(() => {
    const mainContent = document.getElementById("mainContent");
    if (!mainContent) return;

    // For now, just reload the page to restore dashboard
    window.location.hash = "#dashboard";
    window.location.reload();
  }, 300);
}

function showNewProjectForm() {
  console.log("📁 Show new project form called!");
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

    AppState.updateState({ currentPage: "new-project" });
    updateSidebarActive("");
    localStorage.setItem("swyfttask-page", "new-project");
    history.pushState({ page: "new-project" }, "", "#new-project");

    autoRefresh.stop();
    hideLoader();
  }, 300);
}

function showNewTaskForm(prefilledStatus = null) {
  console.log("📝 Show new task form called!");
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

    AppState.updateState({ currentPage: "new-task" });
    updateSidebarActive("");
    localStorage.setItem("swyfttask-page", "new-task");
    history.pushState({ page: "new-task" }, "", "#new-task");

    autoRefresh.stop();
    hideLoader();
  }, 300);
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
}

// =============================================
// EVENT LISTENERS
// =============================================

function setupEventListeners() {
  console.log("🔧 Setting up event listeners...");

  // Hamburger menu
  const hamburgerBtn = document.getElementById("hamburgerBtn");
  console.log("🍔 Hamburger button found:", !!hamburgerBtn);
  if (hamburgerBtn) {
    eventManager.add(hamburgerBtn, 'click', function() {
      console.log("🍔 Hamburger clicked!");
      toggleSidebar();
    });
  }

  // Home button
  const homeBtn = document.getElementById("homeBtn");
  console.log("🏠 Home button found:", !!homeBtn);
  if (homeBtn) {
    eventManager.add(homeBtn, 'click', function() {
      console.log("🏠 Home clicked!");
      restoreDashboard();
    });
  }
}