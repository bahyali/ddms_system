import Link from 'next/link';
import { useRouter } from 'next/router';
import type { ReactNode } from 'react';

export interface NavItem {
  label: string;
  href?: string;
  disabled?: boolean;
  badge?: string;
  skeleton?: boolean;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

interface GlobalNavProps {
  sections: NavSection[];
  footer?: ReactNode;
}

export const GlobalNav = ({ sections, footer }: GlobalNavProps) => {
  const router = useRouter();

  return (
    <nav className="app-nav">
      <div className="nav-logo">DDMS</div>
      {sections.map((section) => (
        <div className="nav-section" key={section.label}>
          <span className="nav-section-label">{section.label}</span>
          <ul className="nav-items">
            {section.items.map((item) => {
              if (item.skeleton) {
                return <li key={`${section.label}-skeleton`} className="nav-skeleton" />;
              }

              if (item.disabled) {
                return (
                  <li key={item.label}>
                    <span className="nav-link is-disabled">
                      {item.label}
                      {item.badge && (
                        <span className="nav-badge" aria-hidden="true">
                          {item.badge}
                        </span>
                      )}
                    </span>
                  </li>
                );
              }

              const isActive =
                !!item.href &&
                (router.asPath === item.href || router.asPath.startsWith(`${item.href}/`));

              return (
                <li key={item.label}>
                  {item.href ? (
                    <Link
                      href={item.href}
                      className={`nav-link${isActive ? ' is-active' : ''}`}
                    >
                      {item.label}
                      {item.badge && (
                        <span className="nav-badge" aria-hidden="true">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  ) : (
                    <span className="nav-link">{item.label}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {footer}
    </nav>
  );
};
