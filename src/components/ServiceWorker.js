export default function ServiceWorker() {
  var isOnline = "onLine" in navigator && navigator.onLine;
  var usingSW = "serviceWorker" in navigator;
  var swRegistration;
  var svcworker;

  if (usingSW) {
    initServiceWorker().catch(console.error);
    window.isSiteOnline = isSiteOnline;
    document.addEventListener("DOMContentLoaded", ready, false);
  }

  // **********************************

  function ready() {
    window.addEventListener(
      "online",
      function online() {
        isOnline = true;
        sendStatusUpdate();
      },
      false
    );
    window.addEventListener(
      "offline",
      function offline() {
        isOnline = false;
        sendStatusUpdate();
      },
      false
    );
  }

  function isSiteOnline() {
    return isOnline;
  }

  async function initServiceWorker() {
    swRegistration = await navigator.serviceWorker.register("/sw.js", {
      updateViaCache: "none"
    });

    svcworker =
      swRegistration.installing ||
      swRegistration.waiting ||
      swRegistration.active;
    sendStatusUpdate(svcworker);

    // listen for new service worker to take over
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      async function onController() {
        svcworker = navigator.serviceWorker.controller;
        sendStatusUpdate(svcworker);
      }
    );

    navigator.serviceWorker.addEventListener("message", onSWMessage, false);
  }

  function onSWMessage(evt) {
    var { data } = evt;
    if (data.statusUpdateRequest) {
      console.log("Status update requested from service worker, responding...");
      sendStatusUpdate(evt.ports && evt.ports[0]);
    }
  }

  function sendStatusUpdate(target) {
    sendSWMessage({ statusUpdate: { isOnline } }, target);
  }

  function sendSWMessage(msg, target) {
    if (target) {
      target.postMessage(msg);
    } else if (svcworker) {
      svcworker.postMessage(msg);
    } else if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage(msg);
    }
  }
}
