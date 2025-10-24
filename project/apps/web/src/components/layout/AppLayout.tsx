import Link from 'next/link';
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { useGetEntityTypes } from '~/hooks/useEntityTypesApi';
import { GlobalNav, type NavSection } from './GlobalNav';

export interface Breadcrumb {
  label: string;
  href?: string;
}

interface AppLayoutProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: Breadcrumb[];
  actions?: ReactNode;
  rightPanel?: ReactNode;
  children: ReactNode;
}

export const AppLayout = ({
  title,
  subtitle,
  breadcrumbs,
  actions,
  rightPanel,
  children,
}: AppLayoutProps) => {
  const {
    data: entityTypes,
    isLoading: isLoadingEntityTypes,
  } = useGetEntityTypes();

  const dataNavItems = useMemo(() => {
    if (isLoadingEntityTypes) {
      return Array.from({ length: 3 }, (_, index) => ({
        label: `entity-skeleton-${index}`,
        skeleton: true,
        key: `data-skeleton-${index}`,
      }));
    }

    if (!entityTypes || entityTypes.length === 0) {
      return [
        {
          label: 'Add Entity Type',
          href: '/admin/entity-types/new',
          badge: 'Setup',
        },
      ];
    }

    return entityTypes.map((entityType) => ({
      label: entityType.label,
      href: `/entities/${entityType.key}`,
      key: `data-${entityType.id}`,
    }));
  }, [entityTypes, isLoadingEntityTypes]);

  const navSections: NavSection[] = [
    {
      label: 'Discover',
      items: [{ label: 'Overview', href: '/' }],
    },
    {
      label: 'Data',
      items: dataNavItems,
    },
    {
      label: 'Build',
      items: [
        { label: 'Entity Types', href: '/admin/entity-types' },
        { label: 'Field Library', disabled: true, badge: 'Soon' },
        { label: 'Permissions', disabled: true, badge: 'Soon' },
      ],
    },
    {
      label: 'Operations',
      items: [
        { label: 'Imports', disabled: true, badge: 'Soon' },
        { label: 'Bulk Edits', disabled: true, badge: 'Soon' },
        { label: 'Indexes', href: '/ops/indexes' },
      ],
    },
  {
    label: 'Audit',
    items: [
      { label: 'Activity Log', href: '/audit/activity-log' },
      { label: 'Record Versions', disabled: true, badge: 'Soon' },
    ],
  },
    {
      label: 'Settings',
      items: [
        { label: 'Tenant', disabled: true, badge: 'Soon' },
        { label: 'API Access', disabled: true, badge: 'Soon' },
      ],
    },
  ];

  const hasRightPanel = Boolean(rightPanel);

  return (
    <div className="app-shell">
      <GlobalNav sections={navSections} />

      <div className="app-main">
        <header className="page-header">
          {breadcrumbs && breadcrumbs.length > 0 && (
            <nav className="breadcrumbs" aria-label="Breadcrumb">
              {breadcrumbs.map((crumb, index) => (
                <span key={crumb.label} className="row row-wrap">
                  {crumb.href ? (
                    <Link href={crumb.href}>{crumb.label}</Link>
                  ) : (
                    <span>{crumb.label}</span>
                  )}
                  {index < breadcrumbs.length - 1 && (
                    <span className="separator">/</span>
                  )}
                </span>
              ))}
            </nav>
          )}

          <div className="page-header-main">
            <div className="page-header-titles">
              <h1>{title}</h1>
              {subtitle && <p>{subtitle}</p>}
            </div>
            {actions && <div className="page-actions">{actions}</div>}
          </div>
        </header>

        <div className={`page-body${hasRightPanel ? '' : ' page-body--single'}`}>
          <main className="page-content">{children}</main>
          {hasRightPanel && <aside className="page-aside">{rightPanel}</aside>}
        </div>
      </div>
    </div>
  );
};
