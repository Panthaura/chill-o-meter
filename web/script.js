const links = {
  setup: 'https://github.com/Panthaura/chill-o-meter/releases/download/v0.0.1/Chill-O-Meter.Setup.0.0.1.exe',
  portable: 'https://github.com/Panthaura/chill-o-meter/releases/download/v0.0.1/Chill-O-Meter.0.0.1.exe',
  github: 'https://github.com/Panthaura/chill-o-meter',
};

document.querySelectorAll('[data-link]').forEach((linkEl) => {
  const key = linkEl.getAttribute('data-link');
  const target = links[key];
  if (!target || target === '#') return;
  linkEl.setAttribute('href', target);
  if (key !== 'github') {
    linkEl.setAttribute('download', '');
  }
});
