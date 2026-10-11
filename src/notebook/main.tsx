import React from "react";
import ReactDOM from "react-dom/client";
import NotebookApp from "../product/App";
import "../styles.css";
import "../v2.css";
import "../together.css";
import "../mobile.css";
import "./notebook.css";
import "../product/product.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <NotebookApp theme="notebook" />
  </React.StrictMode>,
);
