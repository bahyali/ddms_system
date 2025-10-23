import Head from 'next/head';
import Link from 'next/link';
import { EntityTypeList } from '~/components/entity-types/EntityTypeList';
import { useGetEntityTypes } from '~/hooks/useEntityTypesApi';
import { AppLayout } from '~/components/layout/AppLayout';
import type { NextPageWithLayout } from '~/types/next';

const EntityTypesPage: NextPageWithLayout = () => {
  const { data: entityTypes, isLoading, isError, error } = useGetEntityTypes();

  return (
    <>
      <Head>
        <title>Entity Types | DDMS</title>
      </Head>
      <div className="stack">
        <section className="surface-card">
          <div className="stack">
            {isLoading && <p className="helper-text">Loading entity types…</p>}
            {isError && <p className="error">Error: {error.message}</p>}
            {entityTypes && <EntityTypeList entityTypes={entityTypes} />}
          </div>
        </section>
      </div>
    </>
  );
};

EntityTypesPage.getLayout = (page) => (
  <AppLayout
    title="Entity Types"
    subtitle="Model your schema, set defaults, and unlock downstream experiences."
    breadcrumbs={[{ label: 'Build' }, { label: 'Entity Types' }]}
    actions={
      <Link href="/admin/entity-types/new" className="button">
        New entity type
      </Link>
    }
    rightPanel={
      <div className="surface-card surface-card--muted">
        <div className="stack-sm">
          <span className="badge">Playbook</span>
          <h3 style={{ margin: 0 }}>Stage: Configure</h3>
          <p className="helper-text">
            Add core attributes, toggle validation, and note which fields need indexing.
            Fields created with <strong>Indexed</strong> enabled will queue background jobs
            automatically.
          </p>
          <ul style={{ paddingLeft: '1rem', margin: 0 }}>
            <li>Base: key, label, description</li>
            <li>Rules: required, uniqueness, validation</li>
            <li>Behavior: searchable, indexed, dependencies</li>
          </ul>
        </div>
      </div>
    }
  >
    {page}
  </AppLayout>
);

export default EntityTypesPage;
