import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import clsx from "clsx";
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
} from "lucide-react";

const NAV_ITEMS = [
  { to: "/dashboard",   label: "Dashboard",        Icon: LayoutDashboard },
  { to: "/companies",   label: "Company Listings",  Icon: Building2       },
  { to: "/students",    label: "Student Tracker",   Icon: Users           },
  { to: "/drives",      label: "Placement Drives",  Icon: Briefcase       },
  { to: "/interviews",  label: "Interviews",        Icon: CalendarCheck   },
  { to: "/analytics",  label: "Analytics",         Icon: BarChart3       },
  { to: "/reports",     label: "Reports",           Icon: FileText        },
  { to: "/settings",    label: "Settings",          Icon: Settings        },
];

export default function Sidebar() {
  const location = useLocation();
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);
  const [activeRect, setActiveRect] = useState<{ top: number; height: number } | null>(null);
  const [hoverRect, setHoverRect] = useState<{ top: number; height: number } | null>(null);
  const [isAdminMode, setIsAdminMode] = useState(true);

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
        "flex h-full w-56 flex-col border-r border-slate-200/80 dark:border-slate-800/80",
        "bg-[#fbfcfd] dark:bg-[#12151d] select-none shrink-0"
      )}
      aria-label="Main navigation"
    >
      {/* Top institution header (Matching Uizard Prototype) */}
      <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-transparent">
        <div className="w-8 h-8 rounded-lg bg-[var(--color-brand)] flex items-center justify-center text-white font-bold text-sm shadow-xs shrink-0">
          <GraduationCap size={18} />
        </div>
        <div className="min-w-0 leading-tight">
          <h2 className="truncate text-xs font-bold tracking-tight text-slate-900 dark:text-slate-100">
            IIT Riverside
          </h2>
          <p className="truncate text-[10px] text-slate-500 dark:text-slate-400">
            Computer Science
          </p>
        </div>
      </div>

      {/* Nav list with LITE SLIDING CARD */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-3" onMouseLeave={() => setHoverRect(null)}>
        {/* Relative wrapper using flex flex-col gap-1 (Prevents space-y margin jitter on absolute elements) */}
        <div className="relative">
          {/* Hover glider for inactive items only */}
          {hoverRect && (
            <div
              className="absolute left-0 right-0 rounded-xl bg-slate-200/50 dark:bg-slate-800/40 transition-[top,height] duration-75 ease-out pointer-events-none"
              style={{
                top: `${hoverRect.top}px`,
                height: `${hoverRect.height}px`,
              }}
              aria-hidden="true"
            />
          )}

          {/* LITE ACTIVE SLIDING CARD - Rock-solid, elevated white card with lite shade */}
          {activeRect && (
            <div
              className={clsx(
                "absolute left-0 right-0 rounded-xl pointer-events-none",
                // Lite UI card: elevated pure white in both dark & light modes
                "bg-white dark:bg-white text-slate-950",
                "shadow-[0_2px_8px_-1px_rgba(0,0,0,0.1),0_1px_3px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.35)]",
                "border border-slate-200/90 dark:border-white/20",
                "transition-[top,height] duration-100 ease-out"
              )}
              style={{
                top: `${activeRect.top}px`,
                height: `${activeRect.height}px`,
              }}
              aria-hidden="true"
            >
              {/* Burgundy left accent bar */}
              <div className="absolute left-1.5 top-2.5 bottom-2.5 w-1 rounded-full bg-[var(--color-brand)]" />
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
                    // Only show hover glider on inactive items to prevent jitter
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
                      "flex items-center gap-2.5 rounded-xl px-3.5 py-2 text-xs",
                      "transition-colors duration-75 outline-none font-medium",
                      isActive
                        ? "text-slate-950 font-bold"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                    )}
                  >
                    <Icon
                      size={15}
                      aria-hidden="true"
                      className={clsx(
                        "shrink-0 transition-colors",
                        isActive ? "text-[var(--color-brand)]" : "text-slate-400 dark:text-slate-500"
                      )}
                    />
                    <span className="truncate">{label}</span>
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      {/* Mode / Admin Switch (Exact Uizard visual lockup) */}
      <div className="px-4 py-3 border-t border-slate-200/80 dark:border-slate-800/60 bg-white/50 dark:bg-transparent">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
          Mode
        </p>
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Admin
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={isAdminMode}
            onClick={() => setIsAdminMode(!isAdminMode)}
            className={clsx(
              "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-75 ease-in-out focus:outline-none",
              isAdminMode ? "bg-[#9e2040]" : "bg-slate-300 dark:bg-slate-700"
            )}
          >
            <span
              className={clsx(
                "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-75 ease-in-out",
                isAdminMode ? "translate-x-4" : "translate-x-0"
              )}
            />
          </button>
        </div>
      </div>

      {/* Account Section (Uizard Bottom User Card) */}
      <div className="px-4 py-3 border-t border-slate-200/80 dark:border-slate-800/80 bg-slate-100/60 dark:bg-slate-900/40">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Account
        </p>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-slate-700 to-slate-900 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs border border-slate-500">
            RM
          </div>
          <div className="min-w-0 leading-tight">
            <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
              Rohit Malhotra
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
              Placement Admin
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
