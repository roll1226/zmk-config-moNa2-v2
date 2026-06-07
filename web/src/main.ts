import { attachAppBehavior, renderApp } from "./app";
import "./style.css";

const root = document.querySelector<HTMLElement>("#app");

if (!root) {
  throw new Error("App root was not found.");
}

root.innerHTML = renderApp();
attachAppBehavior(root);
