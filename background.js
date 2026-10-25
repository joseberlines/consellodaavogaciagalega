// Makes clicking the toolbar icon open the side panel directly,
// instead of requiring a separate "open side panel" menu action.
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((err) => {
    console.error("Failed to set side panel behavior:", err);
  });
});

importScripts('cendoj-background.js');
