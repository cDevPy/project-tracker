// =============================================
// SIMPLE TEST VERSION
// =============================================

console.log("🧪 Test file loaded successfully!");

// Define basic functions
function toggleSidebar() {
  console.log("🍔 Toggle sidebar called!");
  const sidebar = document.getElementById("sidebar");
  if (sidebar) {
    sidebar.classList.toggle("open");
    console.log("✅ Sidebar toggled");
  } else {
    console.log("❌ Sidebar element not found");
  }
}

function restoreDashboard() {
  console.log("🏠 Restore dashboard called!");
  // Simple implementation
  window.location.hash = "#dashboard";
}

function showNewProjectForm() {
  console.log("📁 Show new project form called!");
  alert("New Project Form would open here!");
}

function showNewTaskForm() {
  console.log("📝 Show new task form called!");
  alert("New Task Form would open here!");
}

// Test if elements exist and add listeners
document.addEventListener('DOMContentLoaded', function() {
  console.log("🚀 DOM Content Loaded - Testing elements...");
  
  // Test hamburger
  const hamburger = document.getElementById("hamburgerBtn");
  if (hamburger) {
    console.log("✅ Hamburger button found");
    hamburger.addEventListener('click', function() {
      console.log("🍔 Hamburger clicked!");
      toggleSidebar();
    });
  } else {
    console.log("❌ Hamburger button NOT found");
  }
  
  // Test account button
  const accountBtn = document.getElementById("accountBtn");
  if (accountBtn) {
    console.log("✅ Account button found");
    accountBtn.addEventListener('click', function() {
      console.log("👤 Account button clicked!");
      alert("Account menu would open!");
    });
  } else {
    console.log("❌ Account button NOT found");
  }
  
  // Test new project button
  const newProjectBtn = document.getElementById("newProjectBtn");
  if (newProjectBtn) {
    console.log("✅ New project button found");
    newProjectBtn.addEventListener('click', function() {
      console.log("📁 New project clicked!");
      showNewProjectForm();
    });
  } else {
    console.log("❌ New project button NOT found");
  }
  
  // Test new task button
  const newTaskBtn = document.getElementById("newTaskBtn");
  if (newTaskBtn) {
    console.log("✅ New task button found");
    newTaskBtn.addEventListener('click', function() {
      console.log("📝 New task clicked!");
      showNewTaskForm();
    });
  } else {
    console.log("❌ New task button NOT found");
  }
  
  console.log("✅ Test setup complete");
});

// Make functions globally available
window.toggleSidebar = toggleSidebar;
window.restoreDashboard = restoreDashboard;
window.showNewProjectForm = showNewProjectForm;
window.showNewTaskForm = showNewTaskForm;

console.log("🎯 Test functions defined globally");