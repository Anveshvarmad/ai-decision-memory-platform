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
import { GraphPage } from "./pages/GraphPage";
import { IntelligencePage } from "./pages/IntelligencePage";
import { ComparisonPage } from "./pages/ComparisonPage";
import { LoginPage } from "./pages/LoginPage";

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
            path="intelligence"
            element={<IntelligencePage />}
          />

          <Route
            path="comparison"
            element={<ComparisonPage />}
          />


          <Route
            path="decisions"
            element={<DecisionsPage />}
          />

          <Route
            path="graph"
            element={<GraphPage />}
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
