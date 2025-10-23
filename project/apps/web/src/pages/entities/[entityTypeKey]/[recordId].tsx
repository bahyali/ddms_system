import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useMemo, useState } from 'react';
import type { components } from '@ddms/sdk';

import { AppLayout } from '~/components/layout/AppLayout';
import { DynamicForm } from '~/components/dynamic-form';
import { useGetEntityTypeByKey } from '~/hooks/useEntityTypesApi';
import { useGetFieldDefs } from '~/hooks/useFieldDefsApi';
import { useGetRecord, useUpdateRecord } from '~/hooks/useRecordsApi';

type ValidationError = components['schemas']['ValidationErrorDetail'];

const EditRecordPage = () => {
  const router = useRouter();
  const { entityTypeKey, recordId } = router.query;
  const key = typeof entityTypeKey === 'string' ? entityTypeKey : '';
  const id = typeof recordId === 'string' ? recordId : '';

  const [serverErrors, setServerErrors] = useState<ValidationError[] | null>(null);

  const {
    data: entityType,
    isLoading: isLoadingEntityType,
  } = useGetEntityTypeByKey(key);
  const {
    data: fieldDefs,
    isLoading: isLoadingFieldDefs,
  } = useGetFieldDefs(entityType?.id ?? '');
  const {
    data: record,
    isLoading: isLoadingRecord,
  } = useGetRecord(key, id);

  const updateRecord = useUpdateRecord(key, id);

  const isLoading = isLoadingEntityType || isLoadingFieldDefs || isLoadingRecord;

  const metadata = useMemo(() => {
    if (!record) return [];
    return [
      {
        label: 'Version',
        value: record.version,
      },
      {
        label: 'Updated at',
        value: record.updatedAt,
      },
      {
        label: 'Updated by',
        value: record.updatedBy ?? '—',
      },
    ];
  }, [record]);

  const handleSubmit = (data: Record<string, unknown>) => {
    if (!record) return;
    setServerErrors(null);

    updateRecord.mutate(
      { data, version: record.version },
      {
        onSuccess: () => {
          router.push(`/entities/${key}`);
        },
        onError: (error: unknown) => {
          const apiError = error as {
            body?: { errors?: ValidationError[] };
            status?: number;
            message?: string;
          };
          if (apiError.body?.errors) {
            setServerErrors(apiError.body.errors);
          } else if (apiError.status === 409) {
            alert(
              'Conflict: This record was updated elsewhere. Review the latest version before applying changes.',
            );
          } else {
            alert(
              `Error updating record: ${
                apiError.message || 'An unknown error occurred'
              }`,
            );
          }
        },
      },
    );
  };

  const title = entityType ? `Edit ${entityType.label}` : 'Edit record';
  const subtitle = entityType
    ? `Review details, resolve conflicts, and merge updates for ${entityType.label.toLowerCase()} records.`
    : 'Review details, resolve conflicts, and merge updates.';

  return (
    <AppLayout
      title={title}
      subtitle={subtitle}
      breadcrumbs={[
        { label: 'Data', href: '/' },
        entityType
          ? { label: entityType.label, href: `/entities/${entityType.key}` }
          : { label: 'Entity' },
        { label: 'Edit' },
      ]}
      actions={
        <Link
          href={entityType ? `/entities/${entityType.key}` : '#'}
          className="button secondary"
        >
          Back to list
        </Link>
      }
      rightPanel={
        record ? (
          <div className="surface-card surface-card--muted stack-sm">
            <span className="badge">Versioning</span>
            <h3 style={{ margin: 0 }}>Audit snapshot</h3>
            {metadata.map((item) => (
              <div className="metadata-item" key={item.label}>
                <span className="label">{item.label}</span>
                <span className="value">
                  {typeof item.value === 'number' ? item.value : String(item.value)}
                </span>
              </div>
            ))}
            <span className="helper-text">
              Record versions stream into the audit log after each successful update.
            </span>
          </div>
        ) : undefined
      }
    >
      <Head>
        <title>{title} | DDMS</title>
      </Head>

      <div className="stack">
        {isLoading && <p className="helper-text">Loading record…</p>}

        {!isLoading && record && fieldDefs && entityType && (
          <section className="surface-card">
            <div className="stack">
              <div className="row row-wrap" style={{ justifyContent: 'space-between' }}>
                <div className="stack-sm">
                  <h3 style={{ margin: 0 }}>Details</h3>
                  <p className="helper-text">
                    Fields with locked icons are governed by ACLs. Update only what your role allows.
                  </p>
                </div>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => router.push(`/entities/${key}`)}
                >
                  Cancel changes
                </button>
              </div>
              <DynamicForm
                fieldDefs={fieldDefs}
                initialData={record.data}
                onSubmit={handleSubmit}
                isLoading={updateRecord.isPending}
                onCancel={() => router.push(`/entities/${key}`)}
                submitText="Update record"
                serverErrors={serverErrors}
              />
            </div>
          </section>
        )}

        {!isLoading && !record && (
          <div className="empty-state">
            <h3>Record not found</h3>
            <p>It may have been deleted or you might not have access to edit it.</p>
            <Link href={entityType ? `/entities/${entityType.key}` : '/'} className="button">
              Return to list
            </Link>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default EditRecordPage;
