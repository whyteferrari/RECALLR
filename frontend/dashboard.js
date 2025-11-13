document.addEventListener('DOMContentLoaded', () => {
  // -----------------------------
  // Elements
  // -----------------------------
  const taskList = document.querySelector('.task-list');
  const deckGrid = document.querySelector('.deck-grid');
  const studyPlanDate = document.querySelector('.study-plan__date');
  const headerUser = document.querySelector('.header__text h1');
  const addTaskModal = document.getElementById('addTaskModal');
  const addTaskBtn = document.querySelector('.study-plan__add-btn');
  const closeModalBtn = document.getElementById('closeModal');
  const cancelBtn = document.getElementById('cancelBtn');
  const addTaskForm = document.getElementById('addTaskForm');
  const colorInput = document.getElementById('colorInput');
  const colorPreview = document.getElementById('colorPreview');
  const deckSelect = document.getElementById('deckSelect');
  const userId = localStorage.getItem('userId');
  let selectedColor = '#5D9CFF';

  // -----------------------------
  // 1️⃣ Initialize page
  // -----------------------------
  if (taskList) taskList.innerHTML = '';
  if (deckGrid) deckGrid.innerHTML = '';

  // Set date/time
  if (studyPlanDate) {
    const now = new Date();
    const options = { month: 'long', day: 'numeric', year: 'numeric' };
    studyPlanDate.textContent = `${now.toLocaleDateString('en-US', options)} | ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
  }

  // Welcome user
  if (headerUser) {
    const loggedInUser = localStorage.getItem('username') || 'User';
    headerUser.textContent = `Welcome back, ${loggedInUser}!`;
  }

  // -----------------------------
  // 2️⃣ Color input
  // -----------------------------
  colorInput.addEventListener('input', e => {
    selectedColor = e.target.value;
    colorPreview.textContent = selectedColor.toUpperCase();
  });

  // -----------------------------
  // 3️⃣ Add Task Modal
  // -----------------------------
  const closeModal = () => {
    addTaskModal.classList.remove('modal--open');
    addTaskForm.reset();
    colorInput.value = '#5D9CFF';
    colorPreview.textContent = '#5D9CFF';
    selectedColor = '#5D9CFF';
  };
  addTaskBtn.addEventListener('click', () => addTaskModal.classList.add('modal--open'));
  closeModalBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);
  addTaskModal.addEventListener('click', e => {
    if (e.target === addTaskModal) closeModal();
  });

  // -----------------------------
  // 4️⃣ Helper: format time
  // -----------------------------
  function formatTime(timeStr) {
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  }

  // -----------------------------
  // 5️⃣ Setup task checkbox toggle
  // -----------------------------
  function setupTaskCheckbox(taskItem) {
    const checkbox = taskItem.querySelector('.task-item__checkbox');
    checkbox.addEventListener('click', async (e) => {
      e.stopPropagation();
      const taskId = taskItem.dataset.taskId;
      const completed = !taskItem.classList.contains('task-item--disabled');

      try {
        const res = await fetch(`http://localhost:3000/api/user/${userId}/tasks/${taskId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ completed })
        });

        if (!res.ok) throw new Error('Failed to update task');

        taskItem.classList.toggle('task-item--disabled');
        checkbox.classList.toggle('task-item__checkbox--filled');
      } catch (err) {
        console.error('Failed to update task:', err);
        alert('Could not update task. Try again.');
      }
    });
  }

  // -----------------------------
  // 6️⃣ Load user's decks
  // -----------------------------
  async function loadUserDecks() {
    if (!userId || !deckSelect) return;
    try {
      const res = await fetch(`http://localhost:3000/api/user/${userId}/ongoing-decks`);
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
  }

  // -----------------------------
  // 7️⃣ Load tasks from DB
  // -----------------------------
  async function loadTasks() {
    if (!userId || !taskList) return;
    try {
      const res = await fetch(`http://localhost:3000/api/user/${userId}/tasks`);
      const tasks = await res.json();
      taskList.innerHTML = '';

      if (tasks.length === 0) {
        const placeholder = document.createElement('p');
        placeholder.className = 'empty-placeholder';
        placeholder.textContent = 'No study plans for today yet!';
        taskList.appendChild(placeholder);
      } else {
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
      }
    } catch (err) {
      console.error('Failed to load tasks:', err);
    }
  }

  // -----------------------------
  // 8️⃣ Add Task form submission (POST)
  // -----------------------------
  addTaskForm.addEventListener('submit', async e => {
    e.preventDefault();
    const deckId = deckSelect.value;
    const taskTimeValue = document.getElementById('taskTime').value;
    if (!deckId || !taskTimeValue) return;

    try {
      const res = await fetch(`http://localhost:3000/api/user/${userId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deck_id: deckId, task_time: taskTimeValue, color: selectedColor })
      });
      const result = await res.json();
      console.log('Task added:', result);
      closeModal();
      loadTasks();
    } catch (err) {
      console.error('Failed to add task:', err);
    }
  });

  // -----------------------------
  // 9️⃣ Delete task from DB
  // -----------------------------
  document.addEventListener('click', async e => {
    if (e.target.classList.contains('archive')) {
      const taskItem = e.target.closest('.task-item');
      if (!taskItem) return;
      const taskId = taskItem.dataset.taskId;
      if (!taskId) return;

      try {
        const res = await fetch(`http://localhost:3000/api/user/${userId}/tasks/${taskId}`, {
          method: 'DELETE'
        });
        if (res.ok) {
          taskItem.remove();
          if (taskList.children.length === 0) {
            const placeholder = document.createElement('p');
            placeholder.className = 'empty-placeholder';
            placeholder.textContent = 'No study plans for today yet!';
            taskList.appendChild(placeholder);
          }
        } else {
          console.error('Failed to delete task', await res.text());
        }
      } catch (err) {
        console.error('Error deleting task:', err);
      }
    }
  });

  // -----------------------------
// 10️⃣ Task menu dropdown toggle
// -----------------------------
document.addEventListener('click', e => {
  // If click is on the three-dot menu
  if (e.target.closest('.task-item__menu')) {
    const menuBtn = e.target.closest('.task-item__menu');
    const dropdown = menuBtn.parentElement.querySelector('.dropdown-menu');

    // Close other open dropdowns
    document.querySelectorAll('.dropdown-menu').forEach(d => {
      if (d !== dropdown) d.classList.remove('dropdown-menu--open');
    });

    // Toggle this dropdown
    dropdown.classList.toggle('dropdown-menu--open');
  } else if (!e.target.closest('.dropdown-menu')) {
    // Click outside menu closes all dropdowns
    document.querySelectorAll('.dropdown-menu').forEach(d => d.classList.remove('dropdown-menu--open'));
  }
});
document.querySelectorAll('.coming-soon').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault(); // Stop navigation
      alert('Feature coming soon!');
    });
  });


  // -----------------------------
  // Initial load
  // -----------------------------
  loadUserDecks();
  loadTasks();
});
