import type {
  CSSProperties,
  ReactNode,
} from "react";

import type {
  LucideIcon,
} from "lucide-react";


interface PageHeroProps {
  eyebrow?: string;
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  metadata?: ReactNode;
}


export function PageHero({
  eyebrow,
  title,
  description,
  icon: Icon,
  actions,
  metadata,
}: PageHeroProps) {
  return (
    <section className="section-kit-hero">
      <div className="section-kit-hero-glow" />

      <div className="section-kit-hero-content">
        <div className="section-kit-hero-heading">
          {Icon && (
            <div className="section-kit-hero-icon">
              <Icon size={24} />
            </div>
          )}

          <div>
            {eyebrow && (
              <p className="section-kit-eyebrow">
                {eyebrow}
              </p>
            )}

            <h1 className="section-kit-page-title">
              {title}
            </h1>

            {description && (
              <p className="section-kit-page-description">
                {description}
              </p>
            )}
          </div>
        </div>

        {actions && (
          <div className="section-kit-hero-actions">
            {actions}
          </div>
        )}
      </div>

      {metadata && (
        <div className="section-kit-hero-metadata">
          {metadata}
        </div>
      )}
    </section>
  );
}


interface SectionPanelProps {
  title?: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  tone?: "default" | "accent" | "success";
}


export function SectionPanel({
  title,
  description,
  icon: Icon,
  action,
  children,
  className = "",
  tone = "default",
}: SectionPanelProps) {
  return (
    <section
      className={
        `section-kit-panel section-kit-panel-${tone} `
        + className
      }
    >
      {(title || description || action) && (
        <header className="section-kit-panel-header">
          <div className="section-kit-panel-heading">
            {Icon && (
              <div className="section-kit-panel-icon">
                <Icon size={18} />
              </div>
            )}

            <div>
              {title && (
                <h2 className="section-kit-panel-title">
                  {title}
                </h2>
              )}

              {description && (
                <p className="section-kit-panel-description">
                  {description}
                </p>
              )}
            </div>
          </div>

          {action && (
            <div className="section-kit-panel-action">
              {action}
            </div>
          )}
        </header>
      )}

      <div className="section-kit-panel-body">
        {children}
      </div>
    </section>
  );
}


interface MetricCardProps {
  label: string;
  value: ReactNode;
  detail?: string;
  icon?: LucideIcon;
  trend?: string;
  trendTone?: "positive" | "negative" | "neutral";
  accent?: "purple" | "blue" | "green" | "orange";
}


export function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  trend,
  trendTone = "neutral",
  accent = "purple",
}: MetricCardProps) {
  return (
    <article
      className={
        `section-kit-metric `
        + `section-kit-accent-${accent}`
      }
    >
      <div className="section-kit-metric-top">
        <span className="section-kit-metric-label">
          {label}
        </span>

        {Icon && (
          <span className="section-kit-metric-icon">
            <Icon size={18} />
          </span>
        )}
      </div>

      <div className="section-kit-metric-value">
        {value}
      </div>

      <div className="section-kit-metric-footer">
        {detail && (
          <span className="section-kit-metric-detail">
            {detail}
          </span>
        )}

        {trend && (
          <span
            className={
              `section-kit-trend `
              + `section-kit-trend-${trendTone}`
            }
          >
            {trend}
          </span>
        )}
      </div>
    </article>
  );
}


interface ActionCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  badge?: string;
  onClick?: () => void;
}


export function ActionCard({
  title,
  description,
  icon: Icon,
  badge,
  onClick,
}: ActionCardProps) {
  return (
    <button
      type="button"
      className="section-kit-action-card"
      onClick={onClick}
    >
      <span className="section-kit-action-icon">
        <Icon size={20} />
      </span>

      <span className="section-kit-action-copy">
        <span className="section-kit-action-title">
          {title}
        </span>

        <span className="section-kit-action-description">
          {description}
        </span>
      </span>

      {badge && (
        <span className="section-kit-action-badge">
          {badge}
        </span>
      )}

      <span className="section-kit-action-arrow">
        →
      </span>
    </button>
  );
}


interface StatusPillProps {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger";
}


export function StatusPill({
  children,
  tone = "neutral",
}: StatusPillProps) {
  return (
    <span
      className={
        `section-kit-status `
        + `section-kit-status-${tone}`
      }
    >
      <span className="section-kit-status-dot" />
      {children}
    </span>
  );
}


interface ProgressRingProps {
  value: number;
  label?: string;
  size?: "small" | "medium" | "large";
}


export function ProgressRing({
  value,
  label,
  size = "medium",
}: ProgressRingProps) {
  const normalizedValue = Math.max(
    0,
    Math.min(100, value),
  );

  const style = {
    "--section-progress":
      `${normalizedValue}%`,
  } as CSSProperties;

  return (
    <div
      className={
        `section-kit-progress `
        + `section-kit-progress-${size}`
      }
      style={style}
    >
      <div className="section-kit-progress-inner">
        <strong>
          {normalizedValue}
        </strong>

        <span>%</span>
      </div>

      {label && (
        <p className="section-kit-progress-label">
          {label}
        </p>
      )}
    </div>
  );
}


interface ActivityItemProps {
  title: string;
  description?: string;
  time?: string;
  icon?: LucideIcon;
  tone?: "purple" | "blue" | "green" | "orange";
}


export function ActivityItem({
  title,
  description,
  time,
  icon: Icon,
  tone = "purple",
}: ActivityItemProps) {
  return (
    <article className="section-kit-activity">
      <div
        className={
          `section-kit-activity-icon `
          + `section-kit-activity-${tone}`
        }
      >
        {Icon
          ? <Icon size={17} />
          : <span />}
      </div>

      <div className="section-kit-activity-content">
        <div className="section-kit-activity-heading">
          <strong>{title}</strong>

          {time && <time>{time}</time>}
        </div>

        {description && (
          <p>{description}</p>
        )}
      </div>
    </article>
  );
}


interface EmptyStateProps {
  title: string;
  description: string;
  icon: LucideIcon;
  action?: ReactNode;
}


export function EmptyState({
  title,
  description,
  icon: Icon,
  action,
}: EmptyStateProps) {
  return (
    <div className="section-kit-empty">
      <div className="section-kit-empty-icon">
        <Icon size={26} />
      </div>

      <h3>{title}</h3>

      <p>{description}</p>

      {action && (
        <div className="section-kit-empty-action">
          {action}
        </div>
      )}
    </div>
  );
}
