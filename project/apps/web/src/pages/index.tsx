import Head from 'next/head';
import Link from 'next/link';
import { useMemo } from 'react';
import { useGetEntityTypes } from '~/hooks/useEntityTypesApi';
import { AppLayout } from '~/components/layout/AppLayout';
import type { NextPageWithLayout } from '~/types/next';

const HomePage: NextPageWithLayout = () => {
  const {
    data: entityTypes,
    isLoading,
  } = useGetEntityTypes();

  const quickLinks = useMemo(() => {
    if (!entityTypes || entityTypes.length === 0) {
      return [];
    }
    return entityTypes.slice(0, 3);
  }, [entityTypes]);

  const stats = useMemo(() => {
    const total = entityTypes?.length ?? 0;
    const described =
      entityTypes?.filter((entityType) => Boolean(entityType.description?.trim())).length ?? 0;
    const undecorated = total - described;
    return [
      {
        label: 'Entity types',
        value: total,
        helper: total === 1 ? 'structure in play' : 'structures live',
      },
      {
        label: 'Documented',
        value: described,
        helper: described === 1 ? 'with context' : 'with descriptions',
      },
      {
        label: 'Needs polish',
        value: Math.max(undecorated, 0),
        helper: 'add descriptions to guide teams',
      },
    ];
  }, [entityTypes]);

  const blueprint = useMemo(
    () => [
      {
        stage: 'Configure',
        heading: 'Model entity types',
        body: 'Capture required fields, set ACLs, and give the team context with descriptions.',
        href: '/admin/entity-types',
        cta: 'Design schema',
      },
      {
        stage: 'Populate',
        heading: 'Create trusted records',
        body: 'Guide teams through generated forms with validation and field-level hints.',
        href: quickLinks[0] ? `/entities/${quickLinks[0].key}` : '/admin/entity-types',
        cta: 'Open records',
      },
      {
        stage: 'Govern',
        heading: 'Link relationships',
        body: 'Connect owners, dependencies, and integrations so downstream flows stay in sync.',
        href: quickLinks[0] ? `/entities/${quickLinks[0].key}/new` : '/admin/entity-types',
        cta: 'Plan relationships',
      },
    ],
    [quickLinks],
  );

  return (
    <>
      <Head>
        <title>Dynamic Data Management System</title>
        <meta
          name="description"
          content="Configure schema, manage records, and keep governance in lock-step."
        />
      </Head>
      <div className="stack">
        <section className="hero hero--overview">
          <div className="hero__heading">
            <span className="badge">Discover</span>
            <h1>Orchestrate your entity workspace</h1>
            <p>
              Stand up schemas, seed high-quality records, and keep relationships aligned. Use the
              quick links below to jump back into the spots you touched most recently.
            </p>
          </div>
          <ul className="hero-checklist">
            <li>Blueprint each entity with required fields and descriptions.</li>
            <li>Guide teams through record capture with validation-aware forms.</li>
            <li>Keep relationships fresh with inline linking and audit trails.</li>
          </ul>
          <div className="hero-actions">
            <Link href="/admin/entity-types/new" className="button">
              Create entity type
            </Link>
            <Link href="/admin/entity-types" className="button secondary">
              Manage schema
            </Link>
          </div>
        </section>

        <section className="surface-card overview-summary">
          <div className="overview-summary__header">
            <h2>Health snapshot</h2>
            <span className="helper-text">
              Track the shape of your workspace before diving into the details.
            </span>
          </div>
          <div className="overview-summary__grid">
            {stats.map((stat) => (
              <div key={stat.label} className="overview-summary__card">
                <span className="label">{stat.label}</span>
                <span className="value">{stat.value}</span>
                <span className="helper-text">{stat.helper}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="overview-grid">
          <div className="surface-card overview-grid__column">
            <div className="overview-grid__header">
              <h2 style={{ margin: 0 }}>Get moving fast</h2>
              <span className="helper-text">
                Follow the Configure → Populate → Govern flow to keep momentum.
              </span>
            </div>
            <div className="quick-actions">
              {blueprint.map((item) => (
                <Link key={item.stage} href={item.href} className="quick-card">
                  <span className="badge">{item.stage}</span>
                  <h3>{item.heading}</h3>
                  <p>{item.body}</p>
                  <span className="quick-card__cta">{item.cta}</span>
                </Link>
              ))}
            </div>
          </div>
          <div className="surface-card overview-grid__column">
            <div className="overview-grid__header">
              <h2 style={{ margin: 0 }}>Workspace tips</h2>
              <span className="helper-text">
                Keep velocity high and make the experience friendly for downstream teams.
              </span>
            </div>
            <ul className="overview-tips">
              <li>
                Add plain-language descriptions to entity types so everyone understands how to use
                them.
              </li>
              <li>
                Mark frequently queried fields as searchable to unlock filters and saved views.
              </li>
              <li>
                Review relationships after each import so cross-entity context stays reliable.
              </li>
            </ul>
            <Link href="/admin/entity-types" className="button secondary" style={{ width: 'max-content' }}>
              Review schema checklist
            </Link>
          </div>
        </section>

        <section className="surface-card">
          <div className="row row-wrap" style={{ justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0 }}>Recently active entity types</h2>
            <Link href="/admin/entity-types" className="button stealth">
              View all
            </Link>
          </div>
          <div className="stack" style={{ marginTop: 'var(--space-4)' }}>
            {isLoading && (
              <p className="helper-text">Fetching metadata…</p>
            )}
            {!isLoading && quickLinks.length === 0 && (
              <div className="empty-state">
                <h3>No entity types yet</h3>
                <p>
                  Kick off with a Projects template or craft one from scratch. You can always
                  evolve the schema later.
                </p>
                <Link href="/admin/entity-types/new" className="button">
                  Launch quickstart wizard
                </Link>
              </div>
            )}
            {quickLinks.map((entityType) => (
              <div
                key={entityType.id}
                className="row"
                style={{
                  justifyContent: 'space-between',
                  borderBottom: '1px solid var(--border)',
                  paddingBottom: 'var(--space-3)',
                }}
              >
                <div className="stack-sm">
                  <strong>{entityType.label}</strong>
                  <span className="helper-text">
                    Key: <code>{entityType.key}</code>
                  </span>
                </div>
                <div className="row row-wrap">
                  <Link
                    href={`/entities/${entityType.key}`}
                    className="button secondary"
                  >
                    Open data
                  </Link>
                  <Link
                    href={`/admin/entity-types/${entityType.id}`}
                    className="button secondary"
                  >
                    Configure fields
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
};

HomePage.getLayout = (page) => (
  <AppLayout
    title="Tenant overview"
    subtitle="Track where teams are in the Discover → Govern journey."
    breadcrumbs={[{ label: 'Discover' }, { label: 'Overview' }]}
  >
    {page}
  </AppLayout>
);

export default HomePage;
