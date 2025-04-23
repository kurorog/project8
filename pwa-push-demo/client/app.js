const VAPID_PUBLIC_KEY = 'BKQZ_ICJ2_HVhVM4XRlG3ZUjNVbPONPjShu6R7R0ax5RsCUsPW9PJMpB3iwsxQcn5aIsoO2JFkNq_UsSvTzJklI';

let tasks = [];
let filter = 'all';
let isSubscribed = false;
let swRegistration = null;

document.addEventListener('DOMContentLoaded', () => {
  loadTasks();
  renderTasks();
  setupEventListeners();
  registerServiceWorker();
  updateOnlineStatus();
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
});

function setupEventListeners() {
  document.getElementById('add-task-btn').addEventListener('click', addTask);
  document.getElementById('new-task-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addTask();
  });
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      filter = btn.getAttribute('data-filter');
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderTasks();
    });
  });
  document.getElementById('enable-notifications-btn').addEventListener('click', subscribeUser);
}

function loadTasks() {
  const saved = localStorage.getItem('tasks');
  tasks = saved ? JSON.parse(saved) : [];
}

function saveTasks() {
  localStorage.setItem('tasks', JSON.stringify(tasks));
}

function renderTasks() {
  const list = document.getElementById('task-list');
  list.innerHTML = '';
  let filteredTasks = tasks;
  if (filter === 'active') filteredTasks = tasks.filter(t => !t.completed);
  else if (filter === 'completed') filteredTasks = tasks.filter(t => t.completed);

  filteredTasks.forEach(task => {
    const li = document.createElement('li');
    li.className = 'task-item' + (task.completed ? ' completed' : '');
    const span = document.createElement('span');
    span.className = 'task-text';
    span.textContent = task.text;
    span.addEventListener('click', () => toggleTask(task.id));
    li.appendChild(span);

    const delBtn = document.createElement('button');
    delBtn.className = 'delete-btn';
    delBtn.textContent = '×';
    delBtn.addEventListener('click', () => deleteTask(task.id));
    li.appendChild(delBtn);

    list.appendChild(li);
  });
}

function addTask() {
  const input = document.getElementById('new-task-input');
  const text = input.value.trim();
  if (!text) return;
  const newTask = { id: Date.now(), text, completed: false };
  tasks.push(newTask);
  saveTasks();
  renderTasks();
  input.value = '';
  if (isSubscribed) sendPushNotification('Новая задача', `Добавлена задача: ${text}`);
}

function toggleTask(id) {
  const task = tasks.find(t => t.id === id);
  if (task) {
    task.completed = !task.completed;
    saveTasks();
    renderTasks();
  }
}

function deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  saveTasks();
  renderTasks();
}

function updateOnlineStatus() {
  const offlineIndicator = document.getElementById('offline-indicator');
  if (navigator.onLine) {
    offlineIndicator.hidden = true;
  } else {
    offlineIndicator.hidden = false;
  }
}

async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      swRegistration = await navigator.serviceWorker.register('sw.js');
      console.log('Service Worker зарегистрирован');
      checkSubscription();
    } catch (error) {
      console.error('Ошибка регистрации Service Worker:', error);
    }
  }
}

async function checkSubscription() {
  if (!swRegistration) return;
  const subscription = await swRegistration.pushManager.getSubscription();
  isSubscribed = !(subscription === null);
  updateNotificationButton();
}

function updateNotificationButton() {
  const btn = document.getElementById('enable-notifications-btn');
  btn.textContent = isSubscribed ? 'Отключить уведомления' : 'Включить уведомления';
}

async function subscribeUser() {
  if (!swRegistration) return;
  try {
    if (isSubscribed) {
      const subscription = await swRegistration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        await fetch('/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint })
        });
        isSubscribed = false;
        updateNotificationButton();
      }
    } else {
      const subscription = await swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
      await fetch('/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription)
      });
      isSubscribed = true;
      updateNotificationButton();
    }
  } catch (error) {
    console.error('Ошибка подписки на уведомления:', error);
  }
}

async function sendPushNotification(title, body) {
  try {
    await fetch('/send-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body })
    });
  } catch (error) {
    console.error('Ошибка отправки push-уведомления:', error);
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
