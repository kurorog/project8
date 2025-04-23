const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '.env') });

const express = require('express');
const webPush = require('web-push');
const cors = require('cors');

const app = express();
app.use(cors()); // Add CORS middleware
app.use(express.json());

// Add logging middleware for static files
app.use((req, res, next) => {
  if (req.url.startsWith('/icons/')) {
    console.log(`Static file request: ${req.url}`);
  }
  next();
});

app.use(express.static(path.join(__dirname, '../client')));

// Инициализация VAPID
webPush.setVapidDetails(
  `mailto:${process.env.VAPID_EMAIL}`,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// Хранилище подписок
let subscriptions = [];

// API для подписки
app.post('/subscribe', (req, res) => {
  const subscription = req.body;
  if (!subscriptions.some(s => s.endpoint === subscription.endpoint)) {
    subscriptions.push(subscription);
    console.log('Добавлена подписка:', subscription.endpoint);
  }
  res.status(201).json({});
});

// API для отписки
app.post('/unsubscribe', (req, res) => {
  const { endpoint } = req.body;
  subscriptions = subscriptions.filter(s => s.endpoint !== endpoint);
  console.log('Удалена подписка:', endpoint);
  res.status(200).json({});
});

// Отправка уведомлений
app.post('/send-notification', (req, res) => {
  const { title, body } = req.body;
  
    const payload = JSON.stringify({
      title: title || 'Тестовое уведомление',
      body: body || 'Это тестовое сообщение',
      icon: '/icons/icon192.png',
      url: '/'
    });

  const results = [];
  const promises = subscriptions.map(sub => 
    webPush.sendNotification(sub, payload)
      .then(() => results.push({ status: 'success', endpoint: sub.endpoint }))
      .catch(err => {
        console.error('Ошибка отправки:', err);
        results.push({ status: 'error', endpoint: sub.endpoint, error: err.message });
      })
  );

  Promise.all(promises)
    .then(() => res.json({ results }))
    .catch(err => res.status(500).json({ error: err.message }));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
  console.log('VAPID Public Key:', process.env.VAPID_PUBLIC_KEY);
});
