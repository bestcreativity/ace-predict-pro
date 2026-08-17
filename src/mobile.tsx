import { StrictMode, useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "./router";
import { keepAdsBelowContent } from "./lib/ad-placement";
import "./styles.css";

const container = document.getElementById("root");

if (!container) {
  throw new Error("Mobile app root element was not found.");
}

const router = getRouter(true);

function MobileApp() {
  const [showSplash, setShowSplash] = useState(Capacitor.isNativePlatform());
  const [closingSplash, setClosingSplash] = useState(false);

  useEffect(() => {
    if (!showSplash) return;

    const closeTimer = window.setTimeout(() => setClosingSplash(true), 4700);
    const removeTimer = window.setTimeout(() => setShowSplash(false), 5000);

    return () => {
      window.clearTimeout(closeTimer);
      window.clearTimeout(removeTimer);
    };
  }, [showSplash]);

  return (
    <>
      <RouterProvider router={router} />
      {showSplash ? (
        <div
          className={`app-opening-splash${closingSplash ? " app-opening-splash--closing" : ""}`}
          role="status"
          aria-label="ACE Predict is opening"
        >
          <div className="app-opening-splash__glow" />
          <img
            className="app-opening-splash__icon"
            src="/ace-predict-launch.png"
            alt="ACE Predict"
          />
          <p className="app-opening-splash__message">
            <span>WE DONT GAMBLE,</span>
            <span>WE INVEST</span>
          </p>
        </div>
      ) : null}
    </>
  );
}

createRoot(container).render(
  <StrictMode>
    <MobileApp />
  </StrictMode>,
);

keepAdsBelowContent();
