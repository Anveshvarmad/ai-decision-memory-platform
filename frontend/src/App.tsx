import {
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import {
  AppLayout,
} from "./layouts/AppLayout";

import {
  LoginPage,
} from "./pages/LoginPage";

import {
  DashboardPage,
} from "./pages/DashboardPage";

import {
  DocumentsPage,
} from "./pages/DocumentsPage";

import {
  ChatPage,
} from "./pages/ChatPage";

import {
  DecisionsPage,
} from "./pages/DecisionsPage";

import {
  GraphPage,
} from "./pages/GraphPage";

import {
  IntelligencePage,
} from "./pages/IntelligencePage";

import {
  ComparisonPage,
} from "./pages/ComparisonPage";

import {
  ProcessingPage,
} from "./pages/ProcessingPage";

import {
  DecisionHealthPage,
} from "./pages/DecisionHealthPage";


export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={<LoginPage />}
      />

      <Route
        path="/app"
        element={<AppLayout />}
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
          path="decision-health"
          element={<DecisionHealthPage />}
        />

        <Route
          path="*"
          element={
            <Navigate
              to="dashboard"
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
