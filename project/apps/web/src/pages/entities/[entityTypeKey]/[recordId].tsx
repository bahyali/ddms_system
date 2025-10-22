import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import { useState } from 'react';
import type { components } from '@ddms/sdk';

import { useGetEntityTypeByKey } from '~/hooks/useEntityTypesApi';
import { useGetFieldDefs } from '~/hooks/useFieldDefsApi';
import { useGetRecord, useUpdateRecord } from '~/hooks/useRecordsApi';
import { DynamicForm } from '~/components/dynamic-form';

type ValidationError = components['schemas']['ValidationErrorDetail'];

const EditRecordPage = () => {
  const router = useRouter();
  const { entityTypeKey, recordId } = router.query;
  const key = typeof entityTypeKey === 'string' ? entityTypeKey : '';
  const id = typeof recordId === 'string' ? recordId : '';

  const [serverErrors, setServerErrors] = useState<ValidationError[] | null>(null);

  const { data: entityType, isLoading: isLoadingEntityType } = useGetEntityTypeByKey(key);
  const { data: fieldDefs, isLoading: isLoadingFieldDefs } = useGetFieldDefs(entityType?.id ?? '');
  const { data: record, isLoading: isLoadingRecord } = useGetRecord(key, id);

  const updateRecord = useUpdateRecord(key, id);

  const handleSubmit = (data: Record<string, unknown>) => {
    if (!record) return;
    setServerErrors(null);

    updateRecord.mutate(
      { data, version: record.version },
      {
        onSuccess: () => {
          router.push(`/entities/${key}`);
        },
        onError: (error: any) => {
          if (error.body?.errors) {
            setServerErrors(error.body.errors);
          } else if (error.status === 409) {
            alert(
              'Conflict: This record has been updated by someone else. Please refresh and try again.'
            );
          } else {
            alert(`Error updating record: ${error.message || 'An unknown error occurred'}`);
          }
        },
      }
    );
  };

  const isLoading = isLoadingEntityType || isLoadingFieldDefs || isLoadingRecord;

  return (
    <>
      <Head>
        <title>Edit {entityType?.label ?? 'Record'} | DDMS</title>
      </Head>
      <main>
        <Link href={`/entities/${key}`}>Back to {entityType?.label ?? 'List'}</Link>
        <h1>Edit {entityType?.label}</h1>

        {isLoading && <p>Loading form...</p>}

        {!isLoading && fieldDefs && entityType && record && (
          <DynamicForm
            fieldDefs={fieldDefs}
            initialData={record.data}
            onSubmit={handleSubmit}
            isLoading={updateRecord.isPending}
            onCancel={() => router.push(`/entities/${key}`)}
            submitText="Update Record"
            serverErrors={serverErrors}
          />
        )}
      </main>
    </>
  );
};

export default EditRecordPage;