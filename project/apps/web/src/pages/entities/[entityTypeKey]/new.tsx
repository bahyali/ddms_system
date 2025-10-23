import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState } from 'react';
import type { components } from '@ddms/sdk';

import { AppLayout } from '~/components/layout/AppLayout';
import { DynamicForm } from '~/components/dynamic-form';
import { useGetEntityTypeByKey } from '~/hooks/useEntityTypesApi';
import { useGetFieldDefs } from '~/hooks/useFieldDefsApi';
import { useCreateRecord } from '~/hooks/useRecordsApi';

type ValidationError = components['schemas']['ValidationErrorDetail'];

const CreateRecordPage = () => {
  const router = useRouter();
  const { entityTypeKey } = router.query;
  const key = typeof entityTypeKey === 'string' ? entityTypeKey : '';

  const [serverErrors, setServerErrors] = useState<ValidationError[] | null>(null);

  const {
    data: entityType,
    isLoading: isLoadingEntityType,
  } = useGetEntityTypeByKey(key);
  const {
    data: fieldDefs,
    isLoading: isLoadingFieldDefs,
  } = useGetFieldDefs(entityType?.id ?? '');

  const createRecord = useCreateRecord(key);

  const handleSubmit = (data: Record<string, unknown>) => {
    setServerErrors(null);
    createRecord.mutate(
      { data },
      {
        onSuccess: () => {
          router.push(`/entities/${key}`);
        },
        onError: (error: unknown) => {
          const apiError = error as {
            body?: { errors?: ValidationError[] };
            message?: string;
          };
          if (apiError.body?.errors) {
            setServerErrors(apiError.body.errors);
          } else {
            alert(
              `Error creating record: ${
                apiError.message || 'An unknown error occurred'
              }`,
            );
          }
        },
      },
    );
  };

  const isLoading = isLoadingEntityType || isLoadingFieldDefs;

  const title = entityType ? `New ${entityType.label}` : 'Create record';
  const subtitle = entityType
    ? `Capture a ${entityType.label.toLowerCase()} with live validation and audit trails.`
    : 'Capture a record with live validation and audit trails.';

  return (
    <AppLayout
      title={title}
      subtitle={subtitle}
      breadcrumbs={[
        { label: 'Data', href: '/' },
        entityType
          ? { label: entityType.label, href: `/entities/${entityType.key}` }
          : { label: 'Entity' },
        { label: 'New' },
      ]}
      actions={
        <Link
          href={entityType ? `/entities/${entityType.key}` : '#'}
          className="button secondary"
        >
          Back to list
        </Link>
      }
    >
      <Head>
        <title>{title} | DDMS</title>
      </Head>
      <div className="stack">
        <section className="surface-card">
          <div className="stack">
            <div className="row row-wrap" style={{ justifyContent: 'space-between' }}>
              <div className="stack-sm">
                <h3 style={{ margin: 0 }}>Form</h3>
                <p className="helper-text">
                  Client-side validation mirrors server rules (Zod). Errors map directly to fields.
                </p>
              </div>
              <button
                type="button"
                className="button secondary"
                onClick={() => router.push(`/entities/${key}`)}
              >
                Cancel
              </button>
            </div>

            {isLoading && <p className="helper-text">Loading form…</p>}

            {!isLoading && fieldDefs && entityType && (
              <DynamicForm
                fieldDefs={fieldDefs}
                onSubmit={handleSubmit}
                isLoading={createRecord.isPending}
                onCancel={() => router.push(`/entities/${key}`)}
                submitText="Create record"
                serverErrors={serverErrors}
              />
            )}
            {createRecord.isError && (
              <p className="error">
                Error creating record: {createRecord.error?.message}
              </p>
            )}
          </div>
        </section>

        <section className="surface-card surface-card--muted">
          <div className="stack-sm">
            <span className="badge">Hints</span>
            <h3 style={{ margin: 0 }}>Governance tips</h3>
            <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
              <li>Computed or read-only fields render as locked controls.</li>
              <li>Dependencies (requiredIf / visibleIf) react immediately on change.</li>
              <li>Relations expose searchable pickers with optimistic linking.</li>
            </ul>
          </div>
        </section>
      </div>
    </AppLayout>
  );
};

export default CreateRecordPage;
