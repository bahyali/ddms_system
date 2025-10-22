import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import { useState } from 'react';
import type { components } from '@ddms/sdk';

import { useGetEntityTypeByKey } from '~/hooks/useEntityTypesApi';
import { useGetFieldDefs } from '~/hooks/useFieldDefsApi';
import { useCreateRecord } from '~/hooks/useRecordsApi';
import { DynamicForm } from '~/components/dynamic-form';

type ValidationError = components['schemas']['ValidationErrorDetail'];

const CreateRecordPage = () => {
  const router = useRouter();
  const { entityTypeKey } = router.query;
  const key = typeof entityTypeKey === 'string' ? entityTypeKey : '';

  const [serverErrors, setServerErrors] = useState<ValidationError[] | null>(null);

  const { data: entityType, isLoading: isLoadingEntityType } = useGetEntityTypeByKey(key);
  const { data: fieldDefs, isLoading: isLoadingFieldDefs } = useGetFieldDefs(entityType?.id ?? '');

  const createRecord = useCreateRecord(key);

  const handleSubmit = (data: Record<string, unknown>) => {
    setServerErrors(null);
    createRecord.mutate(
      { data },
      {
        onSuccess: () => {
          router.push(`/entities/${key}`);
        },
        onError: (error: any) => {
          if (error.body?.errors) {
            setServerErrors(error.body.errors);
          } else {
            alert(`Error creating record: ${error.message || 'An unknown error occurred'}`);
          }
        },
      }
    );
  };

  const isLoading = isLoadingEntityType || isLoadingFieldDefs;

  return (
    <>
      <Head>
        <title>Create {entityType?.label ?? 'Record'} | DDMS</title>
      </Head>
      <main>
        <Link href={`/entities/${key}`}>Back to {entityType?.label ?? 'List'}</Link>
        <h1>Create New {entityType?.label}</h1>

        {isLoading && <p>Loading form...</p>}

        {!isLoading && fieldDefs && entityType && (
          <DynamicForm
            fieldDefs={fieldDefs}
            onSubmit={handleSubmit}
            isLoading={createRecord.isPending}
            onCancel={() => router.push(`/entities/${key}`)}
            submitText="Create Record"
            serverErrors={serverErrors}
          />
        )}
      </main>
    </>
  );
};

export default CreateRecordPage;