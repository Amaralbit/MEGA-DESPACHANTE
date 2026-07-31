const tabs = [...document.querySelectorAll('[data-catalog-tab]')];
const panels = [...document.querySelectorAll('[data-catalog-panel]')];
const visibleCount = document.getElementById('forms-visible-count');

const tabSettings = {
  documents: {
    count: '09 formulários',
    hash: '',
  },
  tools: {
    count: '03 ferramentas PDF',
    hash: '#ferramentas-pdf',
  },
};

const activateTab = (name, { focus = false, updateHash = true } = {}) => {
  if (!tabSettings[name]) return;

  tabs.forEach((tab) => {
    const selected = tab.dataset.catalogTab === name;
    tab.classList.toggle('is-active', selected);
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    if (selected && focus) tab.focus();
  });

  panels.forEach((panel) => {
    panel.hidden = panel.dataset.catalogPanel !== name;
  });

  if (visibleCount) visibleCount.textContent = tabSettings[name].count;

  if (updateHash) {
    const nextUrl = `${window.location.pathname}${window.location.search}${tabSettings[name].hash}`;
    window.history.replaceState(null, '', nextUrl);
  }
};

tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => {
    activateTab(tab.dataset.catalogTab);
  });

  tab.addEventListener('keydown', (event) => {
    const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    event.preventDefault();

    let nextIndex = index;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = tabs.length - 1;
    activateTab(tabs[nextIndex].dataset.catalogTab, { focus: true });
  });
});

activateTab(window.location.hash === '#ferramentas-pdf' ? 'tools' : 'documents', {
  updateHash: false,
});

window.addEventListener('hashchange', () => {
  activateTab(window.location.hash === '#ferramentas-pdf' ? 'tools' : 'documents', {
    updateHash: false,
  });
});
