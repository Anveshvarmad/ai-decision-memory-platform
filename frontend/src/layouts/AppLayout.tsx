import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Activity,
  BrainCircuit,
  ChevronsLeft,
  ChevronsRight,
  FileStack,
  GitBranch,
  GitCompare,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareText,
  Moon,
  Network,
  Sparkles,
  Sun,
  X,
  type LucideIcon,
} from "lucide-react";

import {
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";

import {
  useAuth,
} from "../context/AuthContext";

import "../styles/app-shell.css";


interface NavigationItem {
  path: string;
  label: string;
  icon: LucideIcon;
}


interface NavigationSection {
  label: string;
  items: NavigationItem[];
}


const navigationSections:
NavigationSection[] = [
  {
    label: "Workspace",
    items: [
      {
        path: "/app/dashboard",
        label: "Overview",
        icon: LayoutDashboard,
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
        path: "/app/decisions",
        label: "Decisions",
        icon: GitBranch,
      },
    ],
  },
  {
    label: "Intelligence",
    items: [
      {
        path: "/app/intelligence",
        label: "Intelligence",
        icon: Sparkles,
      },
      {
        path: "/app/comparison",
        label: "Compare Decisions",
        icon: GitCompare,
      },
      {
        path: "/app/graph",
        label: "Knowledge Graph",
        icon: Network,
      },
    ],
  },
  {
    label: "Operations",
    items: [
      {
        path: "/app/processing",
        label: "Processing",
        icon: Activity,
      },
    ],
  },
];


const allNavigationItems =
  navigationSections.flatMap(
    (section) => section.items,
  );


function getInitials(
  fullName?: string | null,
  email?: string | null,
) {
  const source =
    fullName?.trim()
    || email?.trim()
    || "User";

  const parts = source
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 1) {
    return parts[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return (
    parts[0].slice(0, 1)
    + parts[parts.length - 1].slice(0, 1)
  ).toUpperCase();
}


export function AppLayout() {
  const {
    user,
    logout,
  } = useAuth();

  const location = useLocation();
  const navigate = useNavigate();

  const [
    sidebarCollapsed,
    setSidebarCollapsed,
  ] = useState(() => {
    return (
      window.localStorage.getItem(
        "decision_memory_sidebar_collapsed",
      ) === "true"
    );
  });

  const [
    mobileSidebarOpen,
    setMobileSidebarOpen,
  ] = useState(false);

  const [
    theme,
    setTheme,
  ] = useState<"dark" | "light">(
    () => {
      const storedTheme =
        window.localStorage.getItem(
          "decision_memory_theme",
        );

      if (
        storedTheme === "light"
        || storedTheme === "dark"
      ) {
        return storedTheme;
      }

      return window.matchMedia(
        "(prefers-color-scheme: light)",
      ).matches
        ? "light"
        : "dark";
    },
  );


  useEffect(() => {
    document.documentElement.dataset.theme =
      theme;

    window.localStorage.setItem(
      "decision_memory_theme",
      theme,
    );
  }, [theme]);


  useEffect(() => {
    window.localStorage.setItem(
      "decision_memory_sidebar_collapsed",
      String(sidebarCollapsed),
    );
  }, [sidebarCollapsed]);


  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);


  const currentPage = useMemo(() => {
    return (
      allNavigationItems.find(
        (item) =>
          location.pathname === item.path
          || location.pathname.startsWith(
            `${item.path}/`,
          ),
      )?.label
      || "Decision Memory"
    );
  }, [location.pathname]);


  const initials = getInitials(
    user?.full_name,
    user?.email,
  );


  function handleLogout() {
    logout();
    navigate("/login", {
      replace: true,
    });
  }


  return (
    <div className="app-shell-modern">
      <div
        className="ambient-orb ambient-orb-one"
      />

      <div
        className="ambient-orb ambient-orb-two"
      />

      <button
        type="button"
        aria-label="Close navigation"
        className={
          "mobile-sidebar-overlay"
          + (
            mobileSidebarOpen
              ? " visible"
              : ""
          )
        }
        onClick={() => {
          setMobileSidebarOpen(false);
        }}
      />

      <aside
        className={
          "modern-sidebar"
          + (
            sidebarCollapsed
              ? " collapsed"
              : ""
          )
          + (
            mobileSidebarOpen
              ? " mobile-open"
              : ""
          )
        }
      >
        <div className="sidebar-brand-row">
          <div className="sidebar-brand">
            <div className="sidebar-brand-mark">
              <BrainCircuit size={22} />
            </div>

            <div className="sidebar-brand-copy">
              <strong>
                Decision Memory
              </strong>

              <span>
                Intelligence workspace
              </span>
            </div>
          </div>

          <button
            type="button"
            className={
              "sidebar-icon-button "
              + "sidebar-collapse-button"
            }
            aria-label={
              sidebarCollapsed
                ? "Expand sidebar"
                : "Collapse sidebar"
            }
            onClick={() => {
              setSidebarCollapsed(
                (value) => !value,
              );
            }}
          >
            {sidebarCollapsed
              ? (
                <ChevronsRight
                  size={17}
                />
              )
              : (
                <ChevronsLeft
                  size={17}
                />
              )}
          </button>

          <button
            type="button"
            className="sidebar-icon-button mobile-menu-button"
            aria-label="Close sidebar"
            onClick={() => {
              setMobileSidebarOpen(false);
            }}
          >
            <X size={18} />
          </button>
        </div>

        <nav className="sidebar-navigation">
          {navigationSections.map(
            (section) => (
              <section
                className="navigation-section"
                key={section.label}
              >
                <p className="navigation-heading">
                  {section.label}
                </p>

                {section.items.map(
                  (item) => {
                    const Icon = item.icon;

                    return (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        title={
                          sidebarCollapsed
                            ? item.label
                            : undefined
                        }
                        className={({
                          isActive,
                        }) =>
                          "modern-nav-link"
                          + (
                            isActive
                              ? " active"
                              : ""
                          )
                        }
                      >
                        <span className="modern-nav-icon">
                          <Icon size={18} />
                        </span>

                        <span className="modern-nav-label">
                          {item.label}
                        </span>
                      </NavLink>
                    );
                  },
                )}
              </section>
            ),
          )}
        </nav>

        <footer className="sidebar-footer-modern">
          <div className="sidebar-profile">
            <div className="sidebar-profile-avatar">
              {initials}
            </div>

            <div className="sidebar-profile-copy">
              <strong>
                {user?.full_name
                  || "Workspace user"}
              </strong>

              <span>
                {user?.email
                  || "Signed in"}
              </span>
            </div>

            <button
              type="button"
              className="sidebar-logout-button"
              aria-label="Sign out"
              title="Sign out"
              onClick={handleLogout}
            >
              <LogOut size={17} />
            </button>
          </div>
        </footer>
      </aside>

      <section className="modern-main-area">
        <header className="modern-topbar">
          <div className="topbar-left">
            <button
              type="button"
              className={
                "topbar-icon-button "
                + "mobile-menu-button"
              }
              aria-label="Open navigation"
              onClick={() => {
                setMobileSidebarOpen(true);
              }}
            >
              <Menu size={19} />
            </button>

            <div className="topbar-title-group">
              <p className="topbar-eyebrow">
                Decision intelligence
              </p>

              <h1 className="topbar-title">
                {currentPage}
              </h1>
            </div>
          </div>

          <div className="topbar-right">
            <div className="system-status">
              <span className="system-status-dot" />
              System online
            </div>

            <button
              type="button"
              className="topbar-icon-button"
              aria-label={
                theme === "dark"
                  ? "Switch to light mode"
                  : "Switch to dark mode"
              }
              title={
                theme === "dark"
                  ? "Light mode"
                  : "Dark mode"
              }
              onClick={() => {
                setTheme(
                  (value) =>
                    value === "dark"
                      ? "light"
                      : "dark",
                );
              }}
            >
              {theme === "dark"
                ? <Sun size={18} />
                : <Moon size={18} />}
            </button>
          </div>
        </header>

        <main className="modern-page-content">
          <div
            key={location.pathname}
            className="modern-page-stage"
          >
            <Outlet />
          </div>
        </main>
      </section>
    </div>
  );
}
