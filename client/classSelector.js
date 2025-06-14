export const classes = {
  scout: {
    name: 'Scout',
    hp: 75,
    speed: 4,
    weapon: 'pistol'
  },
  tank: {
    name: 'Tank',
    hp: 150,
    speed: 2,
    weapon: 'shotgun'
  },
  sniper: {
    name: 'Sniper',
    hp: 100,
    speed: 3,
    weapon: 'rifle'
  }
};

export function renderClassOverlay(selectCallback) {
  const overlay = document.createElement('div');
  overlay.id = 'class-overlay';
  overlay.style.position = 'fixed';
  overlay.style.top = 0;
  overlay.style.left = 0;
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.background = 'rgba(0, 0, 0, 0.9)';
  overlay.style.color = '#fff';
  overlay.style.display = 'flex';
  overlay.style.flexDirection = 'column';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.innerHTML = `<h1>Choose Your Class</h1>
    <button id="scout">Scout</button>
    <button id="tank">Tank</button>
    <button id="sniper">Sniper</button>
  `;

  document.body.appendChild(overlay);
  ['scout', 'tank', 'sniper'].forEach(id => {
    document.getElementById(id).onclick = () => {
      document.body.removeChild(overlay);
      selectCallback(id);
    };
  });
}
