const links = {
  setup: '#',
  portable: '#',
  github: '#',
};

document.querySelectorAll('[data-link]').forEach((btn) => {
  btn.addEventListener('click', (event) => {
    const key = btn.getAttribute('data-link');
    const target = links[key];
    if (!target || target === '#') {
      event.preventDefault();
      alert('Link wird spaeter hinterlegt.');
      return;
    }
    btn.setAttribute('href', target);
  });
});
