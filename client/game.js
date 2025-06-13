const socket = io('https://YOUR-RENDER-URL.onrender.com');

const lobbyDiv = document.getElementById('lobby-screen');
const lobbyList = document.getElementById('lobby-list');
const joinBtn = document.getElementById('join-btn');
const scoreboardList = document.getElementById('score-list');

const hpEl = document.getElementById('hp');
const coinsEl = document.getElementById('coins');
const xpEl = document.getElementById('xp');
const zoneEl = document.getElementById('zone');

const weatherCanvas = document.getElementById('weather-canvas');
const wctx = weatherCanvas.getContext('2d');
weatherCanvas.width = window.innerWidth;
weatherCanvas.height = window.innerHeight;

let weatherState = 'clear';
let particles = [];
let player = {};
socket.on('lobby-update', players => {
  lobbyList.innerHTML = '';
  players.forEach(p => {
    const li = document.createElement('li');
    li.textContent = `${p.name} (${p.class})`;
    lobbyList.appendChild(li);
  });
  lobbyDiv.style.display = 'block';
});

joinBtn.addEventListener('click', () => {
  socket.emit('join-game', 'forest');
  lobbyDiv.style.display = 'none';
});
socket.on('init', data => {
  player = {
    id: data.id,
    ...data.players[data.id]
  };
  updateHUD();
});
function loadScoreboard() {
  fetch('/api/leaderboard')
    .then(res => res.json())
    .then(data => {
      scoreboardList.innerHTML = '';
      data.forEach(p => {
        const li = document.createElement('li');
        li.textContent = `${p.name}: ${p.kills}K / ${p.deaths}D (Lvl ${p.level})`;
        scoreboardList.appendChild(li);
      });
    });
}
loadScoreboard();
socket.on('weather-update', state => {
  weatherState = state;
  if (state === 'rain' || state === 'snow') initParticles(state);
  else particles = [];
});

function initParticles(type) {
  particles = [];
  for (let i = 0; i < 150; i++) {
    particles.push({
      x: Math.random() * weatherCanvas.width,
      y: Math.random() * weatherCanvas.height,
      speed: type === 'rain' ? 4 + Math.random() * 4 : 1 + Math.random() * 2,
      length: type === 'rain' ? 10 + Math.random() * 10 : 2,
      type
    });
  }
}

function drawWeather() {
  wctx.clearRect(0, 0, weatherCanvas.width, weatherCanvas.height);
  wctx.fillStyle = weatherState === 'snow' ? '#fff' : 'rgba(173,216,230,0.6)';
  wctx.strokeStyle = wctx.fillStyle;

  particles.forEach(p => {
    wctx.beginPath();
    if (p.type === 'rain') {
      wctx.moveTo(p.x, p.y);
      wctx.lineTo(p.x, p.y + p.length);
      wctx.stroke();
    } else {
      wctx.arc(p.x, p.y, p.length, 0, Math.PI * 2);
      wctx.fill();
    }

    p.y += p.speed;
    if (p.y > weatherCanvas.height) {
      p.y = -p.length;
      p.x = Math.random() * weatherCanvas.width;
    }
  });

  requestAnimationFrame(drawWeather);
}
drawWeather();
function updateHUD() {
  hpEl.textContent = player.hp || 100;
  coinsEl.textContent = player.coins || 0;
  xpEl.textContent = player.xp || 0;
  zoneEl.textContent = player.zone || 'N/A';
}
socket.on('player-hit', ({ id, hp }) => {
  if (id === player.id) {
    player.hp = hp;
    updateHUD();
  }
});

socket.on('player-respawned', ({ id, player: data }) => {
  if (id === player.id) {
    player = { ...player, ...data };
    updateHUD();
  }
});

socket.on('item-used', data => {
  if (data.id === player.id) {
    player = { ...player, ...data };
    updateHUD();
  }
});
