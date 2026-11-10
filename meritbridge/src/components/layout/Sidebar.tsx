import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import clsx from "clsx";
import { useAuthStore } from "../../store/auth";
import {
  LayoutDashboard,
  Users,
  Building2,
  Briefcase,
  CalendarCheck,
  BarChart3,
  FileText,
  Settings,
  GraduationCap,
  Award,
} from "lucide-react";

const NAV_ITEMS = [
  { to: "/dashboard",   label: "Dashboard",        Icon: LayoutDashboard },
  { to: "/companies",   label: "Company Listings",  Icon: Building2       },
  { to: "/students",    label: "Student Tracker",   Icon: Users           },
  { to: "/internships", label: "Internships",       Icon: Award           },
  { to: "/drives",      label: "Placement Drives",  Icon: Briefcase       },
  { to: "/interviews",  label: "Interviews",        Icon: CalendarCheck   },
  { to: "/analytics",  label: "Analytics",         Icon: BarChart3       },
  { to: "/reports",     label: "Reports",           Icon: FileText        },
  { to: "/settings",    label: "Settings",          Icon: Settings        },
];

export default function Sidebar() {
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);
  const [activeRect, setActiveRect] = useState<{ top: number; height: number } | null>(null);
  const [hoverRect, setHoverRect] = useState<{ top: number; height: number } | null>(null);

  const displayName = user?.name || "Placement Officer";
  const displayRole = user?.role || "Staff";
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "PO";

  // Determine active item index
  const activeIndex = NAV_ITEMS.findIndex((item) => {
    if (item.to === "/dashboard") {
      return location.pathname === "/" || location.pathname === "/dashboard";
    }
    return location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
  });

  // Snappy sliding card position calculation
  useEffect(() => {
    const updatePosition = () => {
      if (activeIndex >= 0 && itemRefs.current[activeIndex]) {
        const el = itemRefs.current[activeIndex];
        if (el) {
          setActiveRect({
            top: el.offsetTop,
            height: el.offsetHeight,
          });
        }
      } else {
        setActiveRect(null);
      }
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    return () => window.removeEventListener("resize", updatePosition);
  }, [activeIndex, location.pathname]);

  return (
    <aside
      className={clsx(
        "flex h-full w-64 flex-col border-r border-[var(--color-border)]",
        "bg-[var(--color-sidebar-bg)] select-none shrink-0"
      )}
      aria-label="Main navigation"
    >
      {/* Institutional header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-[var(--color-border)] bg-[var(--color-surface)] dark:bg-[var(--color-sidebar-bg)]">
        <div className="w-8 h-8 rounded-lg bg-[var(--color-brand)] flex items-center justify-center text-white shrink-0">
          <GraduationCap size={16} strokeWidth={1.75} />
        </div>
        <div className="min-w-0 leading-tight">
          <span className="text-[10px] font-semibold text-[var(--color-brand)] uppercase tracking-wider block">
            From
          </span>
          <h2 className="truncate text-xs font-semibold tracking-tight text-[var(--color-text)]" title="RNS Rural Polytechnic, Murdeshwar">
            RNS Rural Polytechnic
          </h2>
          <p className="truncate text-[11px] text-[var(--color-text-muted)] mt-0.5">
            Murdeshwar · Diploma (3Y)
          </p>
        </div>
      </div>

      {/* Nav list with quiet active row indicator */}
      <nav className="flex-1 overflow-y-auto px-3 py-3" onMouseLeave={() => setHoverRect(null)}>
        <div className="relative">
          {/* Subtle hover background */}
          {hoverRect && (
            <div
              className="absolute left-0 right-0 rounded-lg bg-[var(--color-surface-2)] transition-[top,height] duration-150 ease-unslop pointer-events-none"
              style={{
                top: `${hoverRect.top}px`,
                height: `${hoverRect.height}px`,
              }}
              aria-hidden="true"
            />
          )}

          {/* Active row container */}
          {activeRect && (
            <div
              className={clsx(
                "absolute left-0 right-0 rounded-lg pointer-events-none",
                "bg-[var(--color-surface-2)] border border-[var(--color-border)]",
                "transition-[top,height] duration-150 ease-unslop"
              )}
              style={{
                top: `${activeRect.top}px`,
                height: `${activeRect.height}px`,
              }}
              aria-hidden="true"
            >
              {/* Institutional left accent indicator */}
              <div className="absolute left-1.5 top-2 bottom-2 w-1 rounded-full bg-[var(--color-brand)]" />
            </div>
          )}

          <ul className="flex flex-col gap-1 relative z-10" role="list">
            {NAV_ITEMS.map(({ to, label, Icon }, idx) => {
              const isActive = idx === activeIndex;
              return (
                <li
                  key={to}
                  ref={(el) => (itemRefs.current[idx] = el)}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      setHoverRect({
                        top: e.currentTarget.offsetTop,
                        height: e.currentTarget.offsetHeight,
                      });
                    } else {
                      setHoverRect(null);
                    }
                  }}
                >
                  <NavLink
                    to={to}
                    className={clsx(
                      "flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs h-9",
                      "transition-colors duration-150 ease-unslop outline-none",
                      isActive
                        ? "text-[var(--color-text)] font-semibold"
                        : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)] font-normal"
                    )}
                  >
                    <span className="w-5 flex items-center justify-center shrink-0">
                      <Icon
                        size={16}
                        strokeWidth={1.5}
                        aria-hidden="true"
                        className={clsx(
                          "transition-colors",
                          isActive ? "text-[var(--color-brand)]" : "text-[var(--color-text-muted)]"
                        )}
                      />
                    </span>
                    <span className="truncate">{label}</span>
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      {/* Account Section */}
      <div className="p-3 border-t border-[var(--color-border)] bg-[var(--color-surface)] dark:bg-[var(--color-sidebar-bg)]">
        <p className="text-[11px] font-medium text-[var(--color-text-muted)] mb-2 px-1">
          Account
        </p>
        <div className="flex items-center gap-2.5 p-1 rounded-lg">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-surface-2)] text-[var(--color-text)] border border-[var(--color-border)] font-mono text-xs font-semibold flex items-center justify-center shrink-0">
            {initials}
          </div>
          <div className="min-w-0 leading-tight">
            <p className="text-xs font-medium text-[var(--color-text)] truncate" title={displayName}>
              {displayName}
            </p>
            <p className="text-[11px] text-[var(--color-text-muted)] truncate mt-0.5">
              {displayRole}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
