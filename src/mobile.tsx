import { StrictMode } from "react";
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

createRoot(container).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);

keepAdsBelowContent();
