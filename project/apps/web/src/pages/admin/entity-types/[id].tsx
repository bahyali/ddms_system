import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useMemo, useState } from 'react';
import type { components } from '@ddms/sdk';

import { useGetEntityType } from '~/hooks/useEntityTypesApi';
import {
  useCreateFieldDef,
  useGetFieldDefs,
  useUpdateFieldDef,
  useDeleteFieldDef,
} from '~/hooks/useFieldDefsApi';
import { FieldDefList } from '~/components/field-defs/FieldDefList';
import { FieldDefForm } from '~/components/field-defs/FieldDefForm';
import { useGetEntityTypes } from '~/hooks/useEntityTypesApi';
import { AppLayout } from '~/components/layout/AppLayout';
import type { NextPageWithLayout } from '~/types/next';

type FieldDef = components['schemas']['FieldDef'];
type FieldDefCreate = components['schemas']['FieldDefCreate'];
type FieldDefUpdate = components['schemas']['FieldDefUpdate'];

const EntityTypeDetailPage: NextPageWithLayout = () => {
  const router = useRouter();
  const { id } = router.query;
  const entityTypeId = typeof id === 'string' ? id : '';

  const [isFormOpen, setFormOpen] = useState(false);
  const [selectedField, setSelectedField] = useState<FieldDef | null>(null);
  const [activeTab, setActiveTab] = useState<'fields' | 'permissions' | 'schema'>('fields');

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
  const deleteFieldDef = useDeleteFieldDef(entityTypeId);
  const [fieldPendingDeletion, setFieldPendingDeletion] = useState<FieldDef | null>(null);
  const { data: allEntityTypes } = useGetEntityTypes();

  const overviewCards = useMemo(() => {
    if (!entityType) {
      return [];
    }
    return [
      { label: 'Key', value: entityType.key },
      { label: 'Entity type ID', value: entityType.id },
      {
        label: 'Description',
        value: entityType.description ? 'Provided' : 'Not set',
      },
    ];
  }, [entityType]);

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
      updateFieldDef.mutate(
        { id: selectedField.id, fieldDef: data as FieldDefUpdate },
        {
          onSuccess: handleCloseForm,
          onError: (error) => alert(`Error updating field: ${error.message}`),
        },
      );
      return;
    }

    createFieldDef.mutate(data as FieldDefCreate, {
      onSuccess: handleCloseForm,
      onError: (error) => alert(`Error creating field: ${error.message}`),
    });
  };

  const mutationError = createFieldDef.error || updateFieldDef.error;
  const deletionError = deleteFieldDef.error;

  return (
    <>
      <Head>
        <title>
          {entityType ? `Manage ${entityType.label}` : 'Entity Type'} | DDMS
        </title>
      </Head>

      <div className="stack">
        {isLoadingEntityType && <p className="helper-text">Loading entity type…</p>}
        {isEntityTypeError && (
          <p className="error">Error: {entityTypeError.message}</p>
        )}
        {!entityType && !isLoadingEntityType && !isEntityTypeError && (
          <div className="empty-state">
            <h3>Entity type not found</h3>
            <p>
              It may have been removed. Return to the catalog to review available entity
              types.
            </p>
            <Link href="/admin/entity-types" className="button">
              Back to catalog
            </Link>
          </div>
        )}

        {entityType && (
          <>
            <section className="surface-card">
              <div className="row row-wrap" style={{ justifyContent: 'space-between' }}>
                <div className="stack-sm">
                  <h2 style={{ margin: 0 }}>{entityType.label}</h2>
                  <p className="helper-text">
                    Iterate safely—changes sync to dynamic forms and validation in real time.
                  </p>
                </div>
                <Link
                  href={`/admin/entity-types/${entityTypeId}/edit`}
                  className="button secondary"
                >
                  Edit details
                </Link>
              </div>

              <div className="metadata-grid" style={{ marginTop: 'var(--space-4)' }}>
                {overviewCards.map((card) => (
                  <div className="metadata-item" key={card.label}>
                    <span className="label">{card.label}</span>
                    <span className="value">{card.value}</span>
                  </div>
                ))}
              </div>

              {entityType.description && (
                <p style={{ marginTop: 'var(--space-4)', color: 'var(--text-muted)' }}>
                  {entityType.description}
                </p>
              )}
            </section>

            <section className="stack">
              <div className="tab-list">
                <button
                  type="button"
                  className={`tab-button${activeTab === 'fields' ? ' is-active' : ''}`}
                  onClick={() => setActiveTab('fields')}
                >
                  Fields
                </button>
                <button
                  type="button"
                  className={`tab-button${activeTab === 'permissions' ? ' is-active' : ''}`}
                  onClick={() => setActiveTab('permissions')}
                >
                  Permissions
                </button>
                <button
                  type="button"
                  className={`tab-button${activeTab === 'schema' ? ' is-active' : ''}`}
                  onClick={() => setActiveTab('schema')}
                >
                  JSON Schema
                </button>
              </div>

              <div className="tab-panels">
                {activeTab === 'fields' && (
                  <div className="surface-card stack">
                    <div className="row row-wrap" style={{ justifyContent: 'space-between' }}>
                      <div className="stack-sm">
                        <h3 style={{ margin: 0 }}>Fields</h3>
                        <p className="helper-text">
                          Add data points, change validation rules, or toggle indexing to
                          improve lookups.
                        </p>
                      </div>
                      <button type="button" onClick={handleOpenFormForCreate}>
                        Add field
                      </button>
                    </div>

                    {isLoadingFieldDefs && <p className="helper-text">Loading fields…</p>}
                    {isFieldDefsError && (
                      <p className="error">Error: {fieldDefsError.message}</p>
                    )}
                    {fieldDefs && (
                      <FieldDefList
                        fieldDefs={fieldDefs}
                        onEditField={handleOpenFormForEdit}
                        onCreateField={handleOpenFormForCreate}
                        onDeleteField={(field) => setFieldPendingDeletion(field)}
                      />
                    )}
                    {mutationError && (
                      <p className="error">Error saving field: {mutationError.message}</p>
                    )}
                    {deletionError && (
                      <p className="error">Error deleting field: {deletionError.message}</p>
                    )}
                  </div>
                )}

                {activeTab === 'permissions' && (
                  <div className="surface-card surface-card--muted stack">
                    <h3 style={{ margin: 0 }}>Permissions</h3>
                    <p className="helper-text">
                      Role-aware access controls are being wired up. Soon you&rsquo;ll assign
                      read/write access per field and role from here.
                    </p>
                    <span className="badge warning">In design</span>
                  </div>
                )}

                {activeTab === 'schema' && (
                  <div className="surface-card surface-card--muted stack">
                    <h3 style={{ margin: 0 }}>JSON Schema</h3>
                    <p className="helper-text">
                      Export OpenAPI + JSON Schema representations once generated. They unlock
                      SDK scaffolding and contract testing.
                    </p>
                    <span className="badge">Coming soon</span>
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </div>

      {isFormOpen && (
        <FieldDefForm
          initialData={selectedField}
          onSubmit={handleSubmit}
          isLoading={createFieldDef.isPending || updateFieldDef.isPending}
          onCancel={handleCloseForm}
          entityTypes={allEntityTypes?.map((et) => ({ id: et.id, label: et.label }))}
        />
      )}

      {fieldPendingDeletion && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-panel stack">
            <div className="modal-header">
              <div className="stack-sm">
                <h2 style={{ margin: 0 }}>Delete field</h2>
                <p className="helper-text">
                  Remove <strong>{fieldPendingDeletion.label}</strong>? This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="stack">
              <p>
                Any forms referencing this field will stop rendering it. If you need the data, export records
                before deleting.
              </p>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => setFieldPendingDeletion(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button secondary"
                onClick={() => {
                  deleteFieldDef.mutate(fieldPendingDeletion, {
                    onSuccess: () => setFieldPendingDeletion(null),
                    onError: () => setFieldPendingDeletion(null),
                  });
                }}
                disabled={deleteFieldDef.isPending}
              >
                {deleteFieldDef.isPending ? 'Deleting…' : 'Delete field'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

EntityTypeDetailPage.getLayout = (page) => (
  <AppLayout
    title="Entity type detail"
    subtitle="Review schema, manage fields, and prepare dependencies before rolling out."
    breadcrumbs={[
      { label: 'Build', href: '/admin/entity-types' },
      { label: 'Entity Types', href: '/admin/entity-types' },
      { label: 'Detail' },
    ]}
  >
    {page}
  </AppLayout>
);

export default EntityTypeDetailPage;
