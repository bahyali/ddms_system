import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import type { components } from '@ddms/sdk';
import { EntityTypeForm } from '~/components/entity-types/EntityTypeForm';
import { useCreateEntityType } from '~/hooks/useEntityTypesApi';
import { AppLayout } from '~/components/layout/AppLayout';
import type { NextPageWithLayout } from '~/types/next';

type EntityTypeCreate = components['schemas']['EntityTypeCreate'];

const NewEntityTypePage: NextPageWithLayout = () => {
  const router = useRouter();
  const createEntityType = useCreateEntityType();

  const handleSubmit = (data: EntityTypeCreate) => {
    createEntityType.mutate(data, {
      onSuccess: () => {
        router.push('/admin/entity-types');
      },
      onError: (error) => {
        alert(`Error creating entity type: ${error.message}`);
      },
    });
  };

  return (
    <>
      <Head>
        <title>New Entity Type | DDMS</title>
      </Head>
      <div className="stack">
        <section className="surface-card">
          <div className="stack">
            <div className="row row-wrap" style={{ justifyContent: 'space-between' }}>
              <div className="stack-sm">
                <h2 style={{ margin: 0 }}>Basics</h2>
                <p className="helper-text">
                  Slug helper ensures unique keys; labels power UI copy. You can adjust later.
                </p>
              </div>
              <Link href="/admin/entity-types" className="button secondary">
                Cancel
              </Link>
            </div>
            <EntityTypeForm
              onSubmit={handleSubmit}
              isLoading={createEntityType.isPending}
            />
            {createEntityType.isError && (
              <p className="error">Error: {createEntityType.error.message}</p>
            )}
          </div>
        </section>
      </div>
    </>
  );
};

NewEntityTypePage.getLayout = (page) => (
  <AppLayout
    title="Create entity type"
    subtitle="Set up foundational metadata. You can enrich with fields and dependencies next."
    breadcrumbs={[
      { label: 'Build', href: '/admin/entity-types' },
      { label: 'Entity Types', href: '/admin/entity-types' },
      { label: 'New' },
    ]}
  >
    {page}
  </AppLayout>
);

export default NewEntityTypePage;
