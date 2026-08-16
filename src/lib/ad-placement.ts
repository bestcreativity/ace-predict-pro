/**
 * The in-page ad tag injects its own fixed container, which lands at the top of
 * the screen and covers the header. Only ad frames are moved: the app itself
 * renders no iframes, so requiring one keeps dialogs and toasts untouched.
 */
function isAdFrame(element: HTMLElement) {
  if (element.closest("#root")) return false;
  return element.tagName === "IFRAME" || element.querySelector("iframe") !== null;
}

function pinToBottom(element: HTMLElement) {
  const style = window.getComputedStyle(element);
  if (style.position !== "fixed") return;

  const top = Number.parseFloat(style.top);
  if (Number.isNaN(top) || top > 160) return;

  element.style.setProperty("top", "auto", "important");
  element.style.setProperty("bottom", "0px", "important");
  element.style.setProperty("z-index", "2147483000", "important");
}

export function keepAdsBelowContent() {
  const sweep = () => {
    for (const child of Array.from(document.body.children)) {
      if (child instanceof HTMLElement && isAdFrame(child)) pinToBottom(child);
    }
  };

  const observer = new MutationObserver(sweep);
  observer.observe(document.body, { childList: true, subtree: true, attributes: true });

  sweep();
  window.setInterval(sweep, 2000);
}
