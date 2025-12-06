 // ---------- small helpers & mobile behaviour ----------
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const sidebar = document.getElementById('sidebar');
    const searchToggle = document.getElementById('searchToggle');
    const searchBar = document.querySelector('.search-bar');
    const todayLabel = document.getElementById('todayLabel');

    (function setToday(){
      const d = new Date();
      const opts = {weekday:'short', month:'short', day:'numeric'};
      todayLabel.textContent = d.toLocaleDateString(undefined, opts);
    })();

    hamburgerBtn.addEventListener('click', (e)=>{
      e.stopPropagation();
      sidebar.classList.toggle('open');
    });

    document.addEventListener('click', (e)=>{
      if (window.innerWidth <= 768){
        if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && !hamburgerBtn.contains(e.target)) {
          sidebar.classList.remove('open');
        }
      }
    }, {passive:true});

    searchToggle.addEventListener('click', () => {
      if (window.innerWidth <= 768) {
        const shown = searchBar.style.display === 'block';
        searchBar.style.display = shown ? 'none' : 'block';
        if(!shown) searchBar.focus();
      }
    });

    document.addEventListener('keydown', (e)=>{
      if(e.key === 'Escape'){
        sidebar.classList.remove('open');
        if(window.innerWidth <= 768) searchBar.style.display = 'none';
      }
    });

    document.getElementById('openBoard').addEventListener('click',(e)=>{
      e.preventDefault();
      alert('Open the full board page (placeholder). Next step: implement full Kanban view.');
    });

    document.getElementById('newTaskBtn').addEventListener('click', ()=> alert('Open new task modal (placeholder).'));
    document.getElementById('newProjectBtn').addEventListener('click', ()=> alert('Open new project modal (placeholder).'));
    document.getElementById('inviteBtn').addEventListener('click', ()=> alert('Invite user modal (placeholder).'));

    (function enableKanbanScroll(){
      const board = document.getElementById('kanbanBoard');
      let isDown=false, startX, scrollLeft;
      board.addEventListener('mousedown', (e)=>{
        isDown=true; board.classList.add('dragging');
        startX = e.pageX - board.offsetLeft;
        scrollLeft = board.scrollLeft;
        e.preventDefault();
      });
      board.addEventListener('mouseleave', ()=>{ isDown=false; board.classList.remove('dragging'); });
      board.addEventListener('mouseup', ()=>{ isDown=false; board.classList.remove('dragging'); });
      board.addEventListener('mousemove', (e)=>{
        if(!isDown) return;
        const x = e.pageX - board.offsetLeft;
        const walk = (x - startX);
        board.scrollLeft = scrollLeft - walk;
      });
      board.addEventListener('touchstart', (e)=>{
        startX = e.touches[0].pageX - board.offsetLeft;
        scrollLeft = board.scrollLeft;
      }, {passive:true});
      board.addEventListener('touchmove', (e)=>{
        const x = e.touches[0].pageX - board.offsetLeft;
        const walk = (x - startX);
        board.scrollLeft = scrollLeft - walk;
      }, {passive:true});
    })();

    // Feature 4: Sidebar active link
    const sidebarLinks = document.querySelectorAll('.aside li');
    sidebarLinks.forEach(link => {
      link.addEventListener('click', () => {
        sidebarLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');
      });
    });

    // Feature 6: Header button interactions
    const notifBtn = document.getElementById('notificationBtn');
    const notifBadge = document.getElementById('notifBadge');
    let notificationCount = 0;

    function addNotification(message) {
      notificationCount++;
      notifBadge.textContent = notificationCount;
      console.log('New notification:', message);
    }

    notifBtn.addEventListener('click', () => {
      alert('Open notifications panel (placeholder)');
      notificationCount = 0;
      notifBadge.textContent = notificationCount;
    });

    // Example: auto-generate a notification every 15s
    setInterval(() => {
      addNotification('You have a new task!');
    }, 15000);

    document.querySelector('.fa-user').parentElement.addEventListener('click', () => {
      alert('Account panel (placeholder)');
    });

    window.addEventListener('resize', ()=>{
      if(window.innerWidth > 768){
        sidebar.classList.remove('open');
        searchBar.style.display = '';
      }
    });




    // ACCOUNT DROPDOWN TOGGLE
document.addEventListener('DOMContentLoaded', () => {
  const accountBtn = document.getElementById('accountBtn');
  const accountMenu = document.getElementById('accountMenu');

  accountBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    accountMenu.classList.toggle('show');
  });

  document.addEventListener('click', (e) => {
    if (!accountMenu.contains(e.target) && !accountBtn.contains(e.target)) {
      accountMenu.classList.remove('show');
    }
  });
});




    