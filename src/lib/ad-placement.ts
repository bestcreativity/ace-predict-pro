/**
 * Monetag In-Page Push injects a fixed iframe with `inset: 15px 0 auto auto`,
 * which pins it to the top. It is often attached to <html>, not <body>, so we
 * scan both and override inset/top/bottom with !important.
 */
function collectAdFrames() {
  const frames = new Set<HTMLElement>();

  for (const root of [document.documentElement, document.body]) {
    if (!root) continue;
    for (const child of Array.from(root.children)) {
      if (!(child instanceof HTMLElement)) continue;
      if (child.id === "root" || child.closest("#root")) continue;
      if (child.tagName === "IFRAME") {
        frames.add(child);
        continue;
      }
      const nested = child.querySelector("iframe");
      if (nested) frames.add(child);
    }
  }

  for (const iframe of Array.from(document.querySelectorAll("iframe"))) {
    if (!(iframe instanceof HTMLElement)) continue;
    if (iframe.closest("#root")) continue;
    frames.add(iframe);
  }

  return frames;
}

function pinToBottom(element: HTMLElement) {
  const style = window.getComputedStyle(element);
  if (style.position !== "fixed" && style.position !== "absolute") return;

  const top = Number.parseFloat(style.top);
  const alreadyBottom =
    style.bottom !== "auto" &&
    (Number.isNaN(top) || top > window.innerHeight / 2);

  if (alreadyBottom) return;
  if (!Number.isNaN(top) && top > 220) return;

  element.style.setProperty("inset", "auto 0 0 auto", "important");
  element.style.setProperty("top", "auto", "important");
  element.style.setProperty("right", "0px", "important");
  element.style.setProperty("bottom", "0px", "important");
  element.style.setProperty("left", "auto", "important");
  element.style.setProperty("z-index", "2147483000", "important");
}

export function keepAdsBelowContent() {
  const sweep = () => {
    for (const frame of collectAdFrames()) pinToBottom(frame);
  };

  const observer = new MutationObserver(sweep);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["style", "class"],
  });

  sweep();
  window.setInterval(sweep, 800);
}
