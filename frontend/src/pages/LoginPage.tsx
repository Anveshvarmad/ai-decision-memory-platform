import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  Eye,
  EyeOff,
} from "lucide-react";

import {
  useState,
  type FormEvent,
} from "react";

import {
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";

import { useAuth } from "../context/AuthContext";

export function LoginPage() {
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [mode, setMode] =
    useState<"login" | "register">("login");

  const [email, setEmail] = useState(
    "admin@decisionmemory.com",
  );

  const [fullName, setFullName] =
    useState("Anvesh Varma");

  const [password, setPassword] =
    useState("admin123");

  const [showPassword, setShowPassword] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [submitting, setSubmitting] =
    useState(false);

  if (user) {
    return <Navigate to="/app" replace />;
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError(null);
    setSubmitting(true);

    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(
          email,
          fullName,
          password,
        );
      }

      const destination =
        (
          location.state as {
            from?: { pathname?: string };
          } | null
        )?.from?.pathname ?? "/app";

      navigate(destination, {
        replace: true,
      });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Authentication failed",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-visual">
        <div className="visual-glow glow-one" />
        <div className="visual-glow glow-two" />

        <div className="auth-brand">
          <BrainCircuit size={25} />
          <span>Decision Memory</span>
        </div>

        <div className="auth-copy">
          <p className="eyebrow">
            Organizational intelligence
          </p>

          <h1>
            Remember not only
            <span> what changed,</span>
            but why.
          </h1>

          <p className="auth-description">
            Transform scattered documents,
            discussions, incidents, and approvals
            into a searchable decision history.
          </p>

          <div className="feature-list">
            <div>
              <CheckCircle2 size={18} />
              Evidence-backed decisions
            </div>

            <div>
              <CheckCircle2 size={18} />
              Searchable decision timelines
            </div>

            <div>
              <CheckCircle2 size={18} />
              Connected people and systems
            </div>
          </div>
        </div>

        <div className="decision-preview">
          <span className="preview-label">
            Decision detected
          </span>

          <strong>
            Migrate order management to PostgreSQL
          </strong>

          <p>
            Triggered by reporting latency and a
            production connection-pool incident.
          </p>

          <div className="preview-footer">
            <span>Confidence 94%</span>
            <span>4 evidence sources</span>
          </div>
        </div>
      </section>

      <section className="auth-form-panel">
        <form
          className="auth-form"
          onSubmit={handleSubmit}
        >
          <div className="form-heading">
            <p className="eyebrow">
              {mode === "login"
                ? "Welcome back"
                : "Create account"}
            </p>

            <h2>
              {mode === "login"
                ? "Sign in to your workspace"
                : "Start building decision memory"}
            </h2>

            <p>
              {mode === "login"
                ? "Access your documents, decisions, and organizational knowledge."
                : "Create your account and first workspace."}
            </p>
          </div>

          {mode === "register" && (
            <label>
              <span>Full name</span>

              <input
                value={fullName}
                onChange={(event) =>
                  setFullName(event.target.value)
                }
                required
                minLength={2}
                placeholder="Your full name"
              />
            </label>
          )}

          <label>
            <span>Email address</span>

            <input
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              required
              placeholder="name@company.com"
            />
          </label>

          <label>
            <span>Password</span>

            <div className="password-field">
              <input
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                required
                minLength={8}
                placeholder="Minimum 8 characters"
              />

              <button
                type="button"
                onClick={() =>
                  setShowPassword(
                    (current) => !current,
                  )
                }
                aria-label="Toggle password visibility"
              >
                {showPassword ? (
                  <EyeOff size={18} />
                ) : (
                  <Eye size={18} />
                )}
              </button>
            </div>
          </label>

          {error && (
            <div className="form-error">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="primary-button auth-submit"
            disabled={submitting}
          >
            {submitting
              ? "Please wait..."
              : mode === "login"
                ? "Sign in"
                : "Create account"}

            {!submitting && (
              <ArrowRight size={18} />
            )}
          </button>

          <button
            type="button"
            className="mode-switch"
            onClick={() => {
              setMode(
                mode === "login"
                  ? "register"
                  : "login",
              );

              setError(null);
            }}
          >
            {mode === "login"
              ? "Need an account? Create one"
              : "Already have an account? Sign in"}
          </button>
        </form>
      </section>
    </div>
  );
}
