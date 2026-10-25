// Makes clicking the toolbar icon open the side panel directly,
// instead of requiring a separate "open side panel" menu action.
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((err) => {
    console.error("Failed to set side panel behavior:", err);
  });
});

importScripts('cases.js');
importScripts('cendoj-background.js');
importScripts('cases-backup.js');
importScripts('cases-background.js');

importScripts('shared.js');
let defaultPromptsTask = Promise.resolve();
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message.type !== 'library:seedDefaults' || sender.id !== chrome.runtime.id || !sender.url?.startsWith(chrome.runtime.getURL(''))) return;
  defaultPromptsTask = defaultPromptsTask.then(installDefaultCasePrompts);
  defaultPromptsTask.then(() => respond({ ok: true }), error => {
    respond({ ok: false, error: error.message });
    defaultPromptsTask = Promise.resolve();
  });
  return true;
});
