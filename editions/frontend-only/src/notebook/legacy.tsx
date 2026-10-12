import React from "react";
import ReactDOM from "react-dom/client";
import NotebookApp from "./NotebookApp";
import "../styles.css";
import "../v2.css";
import "../together.css";
import "../mobile.css";
import "./notebook.css";
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <NotebookApp />
  </React.StrictMode>,
);
