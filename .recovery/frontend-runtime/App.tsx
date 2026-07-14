import {
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import {
  AppLayout,
} from "./layouts/AppLayout";

import {
  WorkspaceProcessingProvider,
} from "./contexts/WorkspaceProcessingContext";

import {
  ChatPage,
} from "./pages/ChatPage";

import {
  ComparisonPage,
} from "./pages/ComparisonPage";

import {
  DashboardPage,
} from "./pages/DashboardPage";

import {
  DecisionsPage,
} from "./pages/DecisionsPage";

import {
  DocumentsPage,
} from "./pages/DocumentsPage";

import {
  GraphPage,
} from "./pages/GraphPage";

import {
  IntelligencePage,
} from "./pages/IntelligencePage";

import {
  LoginPage,
} from "./pages/LoginPage";


import {
  ProcessingPage,
} from "./pages/ProcessingPage";

function ApplicationShell() {
  return (
    <WorkspaceProcessingProvider>
      <AppLayout />
    </WorkspaceProcessingProvider>
  );
}


export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={<LoginPage />}
      />

      <Route
        path="/app"
        element={<ApplicationShell />}
      >
        <Route
          index
          element={
            <Navigate
              to="dashboard"
              replace
            />
          }
        />

        <Route
          path="dashboard"
          element={<DashboardPage />}
        />

        <Route
          path="documents"
          element={<DocumentsPage />}
        />

        <Route
          path="chat"
          element={<ChatPage />}
        />

        <Route
          path="decisions"
          element={<DecisionsPage />}
        />

        <Route
          path="graph"
          element={<GraphPage />}
        />

        <Route
          path="intelligence"
          element={<IntelligencePage />}
        />

        <Route
          path="comparison"
          element={<ComparisonPage />}
        />

        <Route
          path="processing"
          element={<ProcessingPage />}
        />


        <Route
          path="*"
          element={
            <Navigate
              to="/app/dashboard"
              replace
            />
          }
        />
      </Route>

      <Route
        path="/"
        element={
          <Navigate
            to="/login"
            replace
          />
        }
      />

      <Route
        path="*"
        element={
          <Navigate
            to="/login"
            replace
          />
        }
      />
    </Routes>
  );
}
