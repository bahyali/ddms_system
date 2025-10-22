import { useRouter } from 'next/router';
import Link from 'next/link';
import { useCreateEntityType } from '~/hooks/useEntityTypesApi';
import { EntityTypeForm } from '~/components/entity-types/EntityTypeForm';
import type { components } from '@ddms/sdk';
import Head from 'next/head';

type EntityTypeCreate = components['schemas']['EntityTypeCreate'];

const NewEntityTypePage = () => {
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
      <main>
        <Link href="/admin/entity-types">Back to list</Link>
        <h1>Create New Entity Type</h1>
        <EntityTypeForm
          onSubmit={handleSubmit}
          isLoading={createEntityType.isPending}
        />
        {createEntityType.isError && (
          <p className="error">Error: {createEntityType.error.message}</p>
        )}
      </main>
    </>
  );
};

export default NewEntityTypePage;