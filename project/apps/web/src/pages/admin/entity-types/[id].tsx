import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import { useState } from 'react';
import type { components } from '@ddms/sdk';

import { useGetEntityType } from '~/hooks/useEntityTypesApi';
import {
  useGetFieldDefs,
  useCreateFieldDef,
  useUpdateFieldDef,
} from '~/hooks/useFieldDefsApi';
import { FieldDefList } from '~/components/field-defs/FieldDefList';
import { FieldDefForm } from '~/components/field-defs/FieldDefForm';

type FieldDef = components['schemas']['FieldDef'];
type FieldDefCreate = components['schemas']['FieldDefCreate'];
type FieldDefUpdate = components['schemas']['FieldDefUpdate'];

const EntityTypeDetailPage = () => {
  const router = useRouter();
  const { id } = router.query;
  const entityTypeId = typeof id === 'string' ? id : '';

  const [isFormOpen, setFormOpen] = useState(false);
  const [selectedField, setSelectedField] = useState<FieldDef | null>(null);

  const {
    data: entityType,
    isLoading: isLoadingEntityType,
    isError: isEntityTypeError,
    error: entityTypeError,
  } = useGetEntityType(entityTypeId);

  const {
    data: fieldDefs,
    isLoading: isLoadingFieldDefs,
    isError: isFieldDefsError,
    error: fieldDefsError,
  } = useGetFieldDefs(entityTypeId);

  const createFieldDef = useCreateFieldDef(entityTypeId);
  const updateFieldDef = useUpdateFieldDef(entityTypeId);

  const handleOpenFormForCreate = () => {
    setSelectedField(null);
    setFormOpen(true);
  };

  const handleOpenFormForEdit = (field: FieldDef) => {
    setSelectedField(field);
    setFormOpen(true);
  };

  const handleCloseForm = () => {
    setFormOpen(false);
    setSelectedField(null);
  };

  const handleSubmit = (data: FieldDefCreate | FieldDefUpdate) => {
    if (selectedField) {
      // Update mode
      updateFieldDef.mutate(
        { id: selectedField.id, fieldDef: data as FieldDefUpdate },
        {
          onSuccess: handleCloseForm,
          onError: (error) => alert(`Error updating field: ${error.message}`),
        }
      );
    } else {
      // Create mode
      createFieldDef.mutate(data as FieldDefCreate, {
        onSuccess: handleCloseForm,
        onError: (error) => alert(`Error creating field: ${error.message}`),
      });
    }
  };

  if (isLoadingEntityType) return <main><p>Loading entity type...</p></main>;
  if (isEntityTypeError) return <main><p className="error">Error: {entityTypeError.message}</p></main>;
  if (!entityType) return <main><p>Entity type not found.</p></main>;

  const mutationError = createFieldDef.error || updateFieldDef.error;

  return (
    <>
      <Head>
        <title>Manage {entityType.label} | DDMS</title>
      </Head>
      <main>
        <Link href="/admin/entity-types">Back to list</Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h1>{entityType.label}</h1>
          <Link href={`/admin/entity-types/${entityTypeId}/edit`} passHref>
            <button style={{backgroundColor: '#f0ad4e'}}>Edit Details</button>
          </Link>
        </div>
        <p>Key: <code>{entityType.key}</code></p>
        {entityType.description && <p>{entityType.description}</p>}

        <hr style={{ margin: '2rem 0' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Fields</h2>
          <button onClick={handleOpenFormForCreate}>Add New Field</button>
        </div>

        {isLoadingFieldDefs && <p>Loading fields...</p>}
        {isFieldDefsError && <p className="error">Error: {fieldDefsError.message}</p>}
        {fieldDefs && <FieldDefList fieldDefs={fieldDefs} onEditField={handleOpenFormForEdit} />}

        {isFormOpen && (
          <FieldDefForm
            initialData={selectedField}
            onSubmit={handleSubmit}
            isLoading={createFieldDef.isPending || updateFieldDef.isPending}
            onCancel={handleCloseForm}
          />
        )}
        {mutationError && (
          <p className="error" style={{ marginTop: '1rem' }}>
            Error saving field: {mutationError.message}
          </p>
        )}
      </main>
    </>
  );
};

export default EntityTypeDetailPage;