import {
  Navigate,
  Route,
  Routes,
} from "react-router";

import { ProtectedRoute } from "./components/ProtectedRoute";
import { AppLayout } from "./layouts/AppLayout";
import { DashboardPage } from "./pages/DashboardPage";
import { DocumentsPage } from "./pages/DocumentsPage";
import { ChatPage } from "./pages/ChatPage";
import { DecisionsPage } from "./pages/DecisionsPage";
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
