import { useRouter } from 'next/router';
import Link from 'next/link';
import { useGetEntityType, useUpdateEntityType } from '~/hooks/useEntityTypesApi';
import { EntityTypeForm } from '~/components/entity-types/EntityTypeForm';
import type { components } from '@ddms/sdk';
import Head from 'next/head';

type EntityTypeUpdate = components['schemas']['EntityTypeUpdate'];

const EditEntityTypePage = () => {
  const router = useRouter();
  const { id } = router.query;
  const entityTypeId = typeof id === 'string' ? id : '';

  const {
    data: entityType,
    isLoading: isLoadingEntityType,
    isError: isEntityTypeError,
    error: entityTypeError,
  } = useGetEntityType(entityTypeId);

  const updateEntityType = useUpdateEntityType();

  const handleSubmit = (data: EntityTypeUpdate) => {
    updateEntityType.mutate(
      { id: entityTypeId, entityType: data },
      {
        onSuccess: () => {
          router.push('/admin/entity-types');
        },
        onError: (error) => {
          alert(`Error updating entity type: ${error.message}`);
        },
      }
    );
  };

  if (isLoadingEntityType) return <main><p>Loading...</p></main>;
  if (isEntityTypeError) return <main><p className="error">Error: {entityTypeError.message}</p></main>;
  if (!entityType) return <main><p>Entity type not found.</p></main>;

  return (
    <>
      <Head>
        <title>Edit {entityType.label} | DDMS</title>
      </Head>
      <main>
        <Link href="/admin/entity-types">Back to list</Link>
        <h1>Edit Entity Type: {entityType.label}</h1>
        <EntityTypeForm
          initialData={entityType}
          onSubmit={handleSubmit}
          isLoading={updateEntityType.isPending}
        />
        {updateEntityType.isError && (
          <p className="error">Error: {updateEntityType.error.message}</p>
        )}
      </main>
    </>
  );
};

export default EditEntityTypePage;