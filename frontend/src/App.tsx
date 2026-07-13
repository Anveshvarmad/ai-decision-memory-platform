import {
  Navigate,
  Route,
  Routes,
} from "react-router";

import { ProtectedRoute } from "./components/ProtectedRoute";
import { AppLayout } from "./layouts/AppLayout";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { PlaceholderPage } from "./pages/PlaceholderPage";

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={<LoginPage />}
      />

      <Route element={<ProtectedRoute />}>
        <Route
          path="/app"
          element={<AppLayout />}
        >
          <Route
            index
            element={<DashboardPage />}
          />

          <Route
            path="documents"
            element={
              <PlaceholderPage
                title="Documents"
                description="Upload, process, inspect, and re-index organizational source files."
              />
            }
          />

          <Route
            path="chat"
            element={
              <PlaceholderPage
                title="Decision Chat"
                description="Ask why, who, when, status, impact, and relationship questions."
              />
            }
          />

          <Route
            path="decisions"
            element={
              <PlaceholderPage
                title="Decision Explorer"
                description="Review extracted decisions, evidence, alternatives, status, and confidence."
              />
            }
          />

          <Route
            path="graph"
            element={
              <PlaceholderPage
                title="Knowledge Graph"
                description="Explore connections between decisions, people, systems, incidents, and documents."
              />
            }
          />
        </Route>
      </Route>

      <Route
        path="/"
        element={
          <Navigate
            to="/app"
            replace
          />
        }
      />

      <Route
        path="*"
        element={
          <Navigate
            to="/app"
            replace
          />
        }
      />
    </Routes>
  );
}
