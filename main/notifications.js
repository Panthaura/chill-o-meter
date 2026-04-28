const { Notification } = require('electron');

function showStressNotification() {
  const n = new Notification({
    title: 'Chill-O-Meter',
    body: 'Zeit für eine Stress-Prüfung! Klick auf das Tray-Icon.',
    sound: false,
  });
  n.show();
}

function showFocusNotification(duration) {
  const n = new Notification({
    title: 'Chill-O-Meter',
    body: `Fokus-Modus aktiv: ${duration} Minuten`,
    sound: false,
  });
  n.show();
}

function showFocusEndNotification() {
  const n = new Notification({
    title: 'Chill-O-Meter',
    body: 'Fokus-Modus beendet. Zeit für eine Pause!',
    sound: false,
  });
  n.show();
}

function showInterventionNotification() {
  const n = new Notification({
    title: 'Chill-O-Meter',
    body: 'Hoher Stress erkannt. Intervention empfohlen!',
    sound: false,
  });
  n.show();
}

module.exports = {
  showStressNotification,
  showFocusNotification,
  showFocusEndNotification,
  showInterventionNotification,
};
