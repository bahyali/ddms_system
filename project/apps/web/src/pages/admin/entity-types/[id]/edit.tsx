import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState } from 'react';
import type { components } from '@ddms/sdk';

import { EntityTypeForm } from '~/components/entity-types/EntityTypeForm';
import { AppLayout } from '~/components/layout/AppLayout';
import { useGetEntityType, useUpdateEntityType } from '~/hooks/useEntityTypesApi';
import type { NextPageWithLayout } from '~/types/next';

type EntityTypeUpdate = components['schemas']['EntityTypeUpdate'];

const EditEntityTypePage: NextPageWithLayout = () => {
  const router = useRouter();
  const { id } = router.query;
  const entityTypeId = typeof id === 'string' ? id : '';

  const [serverError, setServerError] = useState<string | null>(null);

  const {
    data: entityType,
    isLoading: isLoadingEntityType,
    isError: isEntityTypeError,
    error: entityTypeError,
  } = useGetEntityType(entityTypeId);

  const updateEntityType = useUpdateEntityType();

  const handleSubmit = (data: EntityTypeUpdate) => {
    setServerError(null);
    updateEntityType.mutate(
      { id: entityTypeId, entityType: data },
      {
        onSuccess: () => {
          router.push(`/admin/entity-types/${entityTypeId}`);
        },
        onError: (error) => {
          setServerError(error.message);
        },
      },
    );
  };

  if (isLoadingEntityType) {
    return (
      <div className="stack">
        <section className="surface-card">
          <p className="helper-text">Loading entity type…</p>
        </section>
      </div>
    );
  }

  if (isEntityTypeError) {
    return (
      <div className="stack">
        <section className="surface-card">
          <p className="error">Error: {entityTypeError.message}</p>
        </section>
      </div>
    );
  }

  if (!entityType) {
    return (
      <div className="stack">
        <section className="surface-card">
          <p className="helper-text">Entity type not found.</p>
          <Link href="/admin/entity-types" className="button secondary" style={{ width: 'max-content' }}>
            Back to list
          </Link>
        </section>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Edit {entityType.label} | DDMS</title>
      </Head>
      <div className="stack">
        <section className="surface-card stack">
          <div className="stack-sm">
            <h2 style={{ margin: 0 }}>Edit {entityType.label}</h2>
            <p className="helper-text">
              Update the label and description so builders know how to use this entity type.
            </p>
          </div>
          <EntityTypeForm
            initialData={entityType}
            onSubmit={handleSubmit}
            isLoading={updateEntityType.isPending}
          />
          {serverError && <p className="error">Error: {serverError}</p>}
        </section>

        <section className="surface-card surface-card--muted stack-sm">
          <h3 style={{ margin: 0 }}>Helpful tips</h3>
          <ul className="callout-list">
            <li className="callout callout--info">
              <strong>Keep keys stable</strong>
              <span>Keys map to API routes and forms, so avoid changing them after creation.</span>
            </li>
            <li className="callout callout--info">
              <strong>Explain the purpose</strong>
              <span>Use the description to share when teams should create this entity.</span>
            </li>
            <li className="callout callout--warning">
              <strong>Review downstream impacts</strong>
              <span>Updating labels can affect dashboards and automations that display this entity.</span>
            </li>
          </ul>
        </section>
      </div>
    </>
  );
};

EditEntityTypePage.getLayout = (page) => (
  <AppLayout
    title="Edit entity type"
    subtitle="Adjust names and descriptions to keep the catalog understandable."
    breadcrumbs={[
      { label: 'Build', href: '/admin/entity-types' },
      { label: 'Entity Types', href: '/admin/entity-types' },
      { label: 'Edit' },
    ]}
    actions={
      <Link href="/admin/entity-types" className="button secondary">
        Back to catalog
      </Link>
    }
  >
    {page}
  </AppLayout>
);

export default EditEntityTypePage;
