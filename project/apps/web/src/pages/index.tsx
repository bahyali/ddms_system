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
        <section className="hero">
          <span className="badge">Discover</span>
          <h1>Dynamic data, governed in real time</h1>
          <p>
            Spin up entity types, add fields with live validation, and empower teams to
            create and relate records in minutes. Start with a guided template or jump
            straight into your workspace.
          </p>
          <div className="row row-wrap">
            <Link href="/admin/entity-types/new" className="button">
              Create entity type
            </Link>
            <Link href="/admin/entity-types" className="button secondary">
              Customize fields
            </Link>
          </div>
          <div className="metadata-grid" style={{ marginTop: 'var(--space-4)' }}>
            <div className="metadata-item">
              <span className="label">North Star</span>
              <span className="value">Fields in &lt; 2 minutes</span>
            </div>
            <div className="metadata-item">
              <span className="label">Performance</span>
              <span className="value">p95 search &lt; 500ms</span>
            </div>
            <div className="metadata-item">
              <span className="label">Governance</span>
              <span className="value">Role-aware ACLs</span>
            </div>
          </div>
        </section>

        <section className="stack">
          <div className="row row-wrap" style={{ justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0 }}>Get moving fast</h2>
            <span className="helper-text">
              Follow the stage-by-stage blueprint from Configure → Govern
            </span>
          </div>

          <div className="quick-actions">
            <Link href="/admin/entity-types" className="quick-card">
              <span className="badge">Build</span>
              <h3>Model entity types</h3>
              <p>
                Create project, resource, or user templates and describe the fields that power
                your workflows.
              </p>
            </Link>
            <Link href="/entities/project" className="quick-card">
              <span className="badge positive">Populate</span>
              <h3>Create records</h3>
              <p>
                Use generated forms with inline validation to capture consistent data every time.
              </p>
            </Link>
            <Link href="/entities/project/new" className="quick-card">
              <span className="badge">Relate</span>
              <h3>Link key relationships</h3>
              <p>
                Connect owners, resources, and dependencies; see them update instantly via live
                events.
              </p>
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
