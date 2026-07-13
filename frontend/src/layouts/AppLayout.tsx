import {
  GlobalProcessingDock,
} from "../components/GlobalProcessingDock";

import {
  Activity,
  BrainCircuit,
  FileStack,
  Sparkles,
  GitBranch,
  GitCompare,
  LayoutDashboard,
  LogOut,
  MessageSquareText,
  Network,
  Settings,
} from "lucide-react";

import {
  NavLink,
  Outlet,
} from "react-router";

import { useAuth } from "../context/AuthContext";

const navigation = [
  {
    path: "/app",
    label: "Overview",
    icon: LayoutDashboard,
    end: true,
  },
  {
    path: "/app/documents",
    label: "Documents",
    icon: FileStack,
  },
  {
    path: "/app/chat",
    label: "Decision Chat",
    icon: MessageSquareText,
  },
  {
    path: "/app/intelligence",
    label: "Intelligence",
    icon: Sparkles,
  },
  {
    path: "/app/comparison",
    label: "Compare",
    icon: GitCompare,
  },
  {
    path: "/app/decisions",
    label: "Decisions",
    icon: GitBranch,
  },
  {
    path: "/app/graph",
    label: "Knowledge Graph",
    icon: Network,
  },
  {
    path: "/app/processing",
    label: "Processing",
    icon: Activity,
  },
];

export function AppLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <BrainCircuit size={22} />
          </div>

          <div>
            <strong>Decision Memory</strong>
            <span>Organizational Intelligence</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <p className="nav-heading">Workspace</p>

          {navigation.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                className={({ isActive }) =>
                  isActive
                    ? "nav-link active"
                    : "nav-link"
                }
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <button
            className="nav-link sidebar-button"
            type="button"
          >
            <Settings size={18} />
            <span>Settings</span>
          </button>

          <div className="user-card">
            <div className="avatar">
              {user?.full_name
                ?.slice(0, 1)
                .toUpperCase()}
            </div>

            <div className="user-details">
              <strong>{user?.full_name}</strong>
              <span>{user?.email}</span>
            </div>

            <button
              type="button"
              className="icon-button"
              onClick={logout}
              title="Sign out"
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>

      <main className="main-panel">
        <Outlet />
          <GlobalProcessingDock />
      </main>
    </div>
  );
}
