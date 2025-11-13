document.addEventListener('DOMContentLoaded', () => {
  // ==============================
  // Elements
  // ==============================
  const taskList = document.querySelector('.task-list');
  const deckSelect = document.getElementById('deckSelect');
  const colorInput = document.getElementById('colorInput');
  const colorPreview = document.getElementById('colorPreview');
  const addTaskModal = document.getElementById('addTaskModal');
  const addTaskBtn = document.querySelector('.study-plan__add-btn');
  const closeModalBtn = document.getElementById('closeModal');
  const cancelBtn = document.getElementById('cancelBtn');
  const addTaskForm = document.getElementById('addTaskForm');
  const studyPlanDate = document.querySelector('.study-plan__date');
  const headerUser = document.querySelector('.header__text h1');

  const userId = localStorage.getItem('userId');
  const username = localStorage.getItem('username') || 'User';
  let selectedColor = '#5D9CFF';

  if (!userId) {
    alert('No user detected. Please login first.');
    window.location.href = 'login.html';
  }

  // ==============================
  // Initialize page
  // ==============================
  headerUser.textContent = `Welcome back, ${username}!`;

  const now = new Date();
  studyPlanDate.textContent = `${now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} | ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;

  colorPreview.textContent = selectedColor.toUpperCase();

  // ==============================
  // Color input preview
  // ==============================
  colorInput.addEventListener('input', e => {
    selectedColor = e.target.value;
    colorPreview.textContent = selectedColor.toUpperCase();
  });

  // ==============================
  // Modal handling
  // ==============================
  const closeModal = () => {
    addTaskModal.classList.remove('modal--open');
    addTaskForm.reset();
    selectedColor = '#5D9CFF';
    colorInput.value = selectedColor;
    colorPreview.textContent = selectedColor.toUpperCase();
  };

  addTaskBtn.addEventListener('click', () => addTaskModal.classList.add('modal--open'));
  closeModalBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);
  addTaskModal.addEventListener('click', e => { if (e.target === addTaskModal) closeModal(); });

  // ==============================
  // Helper: format time
  // ==============================
  const formatTime = timeStr => {
    const [hourStr, minuteStr] = timeStr.split(':');
    const hour = parseInt(hourStr);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minuteStr} ${ampm}`;
  };

  // ==============================
  // Task checkbox toggle
  // ==============================
  const toggleTaskCompletion = async taskItem => {
    const taskId = taskItem.dataset.taskId;
    const completed = !taskItem.classList.contains('task-item--disabled');

    try {
      const res = await fetch(`${window.location.origin}/api/user/${userId}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed })
      });
      if (!res.ok) throw new Error('Failed to update task');
      taskItem.classList.toggle('task-item--disabled');
      const checkbox = taskItem.querySelector('.task-item__checkbox');
      checkbox.classList.toggle('task-item__checkbox--filled');
    } catch (err) {
      console.error(err);
      alert('Could not update task.');
    }
  };

  const setupTaskCheckbox = taskItem => {
    const checkbox = taskItem.querySelector('.task-item__checkbox');
    checkbox.addEventListener('click', e => {
      e.stopPropagation();
      toggleTaskCompletion(taskItem);
    });
  };

  // ==============================
  // Load user decks
  // ==============================
  const loadUserDecks = async () => {
    if (!deckSelect) return;
    try {
      const res = await fetch(`${window.location.origin}/api/user/${userId}/ongoing-decks`);
      const decks = await res.json();
      deckSelect.innerHTML = `<option value="">Choose a deck...</option>`;
      decks.forEach(deck => {
        const option = document.createElement('option');
        option.value = deck.deck_id;
        option.textContent = deck.name;
        deckSelect.appendChild(option);
      });
    } catch (err) {
      console.error('Failed to load decks:', err);
    }
  };

  // ==============================
  // Load tasks
  // ==============================
  const loadTasks = async () => {
    if (!taskList) return;
    try {
      const res = await fetch(`${window.location.origin}/api/user/${userId}/tasks`);
      const tasks = await res.json();
      taskList.innerHTML = '';

      if (tasks.length === 0) {
        const placeholder = document.createElement('p');
        placeholder.className = 'empty-placeholder';
        placeholder.textContent = 'No study plans for today yet!';
        taskList.appendChild(placeholder);
        return;
      }

      tasks.forEach(task => {
        const taskDiv = document.createElement('div');
        taskDiv.className = `task-item glass ${task.completed ? 'task-item--disabled' : ''}`;
        taskDiv.dataset.taskId = task.task_id;
        taskDiv.innerHTML = `
          <div class="task-item__indicator" style="background: ${task.color};"></div>
          <div class="task-item__content">
            <div class="task-item__time">${formatTime(task.task_time)}</div>
            <div class="task-item__name">${task.deck_name}</div>
          </div>
          <div class="task-item__checkbox ${task.completed ? 'task-item__checkbox--filled' : ''}"></div>
          <div class="task-item__menu glass">
            <div class="task-item__menu-dot"></div>
            <div class="task-item__menu-dot"></div>
            <div class="task-item__menu-dot"></div>
          </div>
          <div class="dropdown-menu glass">
            <button class="dropdown-item archive">Delete</button>
          </div>
        `;
        setupTaskCheckbox(taskDiv);
        taskList.appendChild(taskDiv);
      });
    } catch (err) {
      console.error('Failed to load tasks:', err);
    }
  };

  // ==============================
  // Add new task
  // ==============================
  addTaskForm.addEventListener('submit', async e => {
    e.preventDefault();
    const deckId = deckSelect.value;
    const taskTimeValue = document.getElementById('taskTime').value;
    if (!deckId || !taskTimeValue) return;

    try {
      const res = await fetch(`${window.location.origin}/api/user/${userId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deck_id: deckId, task_time: taskTimeValue, color: selectedColor })
      });
      await res.json();
      closeModal();
      loadTasks();
    } catch (err) {
      console.error('Failed to add task:', err);
    }
  });

  // ==============================
  // Delete task
  // ==============================
  document.addEventListener('click', async e => {
    if (e.target.classList.contains('archive')) {
      const taskItem = e.target.closest('.task-item');
      const taskId = taskItem?.dataset.taskId;
      if (!taskId) return;
      try {
        const res = await fetch(`${window.location.origin}/api/user/${userId}/tasks/${taskId}`, { method: 'DELETE' });
        if (res.ok) taskItem.remove();
      } catch (err) {
        console.error('Failed to delete task:', err);
      }
    }
  });

  // ==============================
  // Task menu dropdown
  // ==============================
  document.addEventListener('click', e => {
    if (e.target.closest('.task-item__menu')) {
      const menuBtn = e.target.closest('.task-item__menu');
      const dropdown = menuBtn.parentElement.querySelector('.dropdown-menu');
      document.querySelectorAll('.dropdown-menu').forEach(d => {
        if (d !== dropdown) d.classList.remove('dropdown-menu--open');
      });
      dropdown.classList.toggle('dropdown-menu--open');
    } else if (!e.target.closest('.dropdown-menu')) {
      document.querySelectorAll('.dropdown-menu').forEach(d => d.classList.remove('dropdown-menu--open'));
    }
  });

  // ==============================
  // Coming soon alerts
  // ==============================
  document.querySelectorAll('.coming-soon').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      alert('Feature coming soon!');
    });
  });

  // ==============================
  // Initial load
  // ==============================
  loadUserDecks();
  loadTasks();
});
