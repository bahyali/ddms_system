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

  const fieldInsights = useMemo(() => {
    if (!fieldDefs || fieldDefs.length === 0) {
      return {
        total: 0,
        required: 0,
        relations: 0,
        searchable: 0,
      };
    }
    return fieldDefs.reduce(
      (accumulator, field) => {
        accumulator.total += 1;
        if (field.required) accumulator.required += 1;
        if (field.kind === 'relation') accumulator.relations += 1;
        if (field.searchable) accumulator.searchable += 1;
        return accumulator;
      },
      {
        total: 0,
        required: 0,
        relations: 0,
        searchable: 0,
      },
    );
  }, [fieldDefs]);

  const schemaGuidance = useMemo(() => {
    const recommendations: { label: string; tone: 'info' | 'warning'; detail: string }[] = [];
    if (entityType && !entityType.description) {
      recommendations.push({
        label: 'Add an overview',
        tone: 'warning',
        detail: 'Describe how this entity should be used so downstream teams have context.',
      });
    }
    if (fieldInsights.total === 0) {
      recommendations.push({
        label: 'Add your first field',
        tone: 'warning',
        detail: 'Start with a primary label or identifier so records return useful display values.',
      });
    } else {
      if (fieldInsights.required === 0) {
        recommendations.push({
          label: 'Mark critical fields required',
          tone: 'info',
          detail: 'Guarantee core data is captured before records are saved.',
        });
      }
      if (fieldInsights.searchable === 0) {
        recommendations.push({
          label: 'Enable searchability',
          tone: 'info',
          detail: 'Mark high-signal fields as searchable to power table filters and saved views.',
        });
      }
    }
    return recommendations;
  }, [entityType, fieldInsights]);

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
            <section className="surface-card entity-type-header">
              <div className="entity-type-header__intro">
                <span className="badge">Entity Type</span>
                <h2>{entityType.label}</h2>
                <p className="helper-text">
                  Iterate safely—changes sync to generated forms and validation in real time.
                </p>
                <div className="metadata-grid entity-type-header__meta">
                  {overviewCards.map((card) => (
                    <div className="metadata-item" key={card.label}>
                      <span className="label">{card.label}</span>
                      <span className="value">{card.value}</span>
                    </div>
                  ))}
                </div>
                {entityType.description && (
                  <p className="entity-type-header__description">{entityType.description}</p>
                )}
              </div>
              <div className="entity-type-header__actions">
                <Link
                  href={entityType ? `/entities/${entityType.key}` : '#'}
                  className="button secondary"
                >
                  View records
                </Link>
                <Link
                  href={`/admin/entity-types/${entityTypeId}/edit`}
                  className="button secondary"
                >
                  Edit details
                </Link>
                <button type="button" className="button" onClick={handleOpenFormForCreate}>
                  Add field
                </button>
              </div>
            </section>

            <div className="stack">
              <section className="surface-card surface-card--muted stack-sm">
                <h3 style={{ margin: 0 }}>Schema summary</h3>
                <div className="insight-grid">
                  <div className="insight-card">
                    <span className="label">Total fields</span>
                    <span className="value">{fieldInsights.total}</span>
                    <span className="helper-text">
                      {fieldInsights.required} required · {fieldInsights.searchable} searchable
                    </span>
                  </div>
                  <div className="insight-card">
                    <span className="label">Relations</span>
                    <span className="value">{fieldInsights.relations}</span>
                    <span className="helper-text">
                      Connect records across entity types to power rollups.
                    </span>
                  </div>
                </div>
              </section>

              <section className="surface-card stack">
                <div className="row row-wrap" style={{ justifyContent: 'space-between' }}>
                  <div className="stack-sm">
                    <h3 style={{ margin: 0 }}>Fields</h3>
                    <p className="helper-text">
                      Add data points, change validation rules, or toggle indexing to improve lookups.
                    </p>
                  </div>
                  <button type="button" className="button secondary" onClick={handleOpenFormForCreate}>
                    New field
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
              </section>

              <section className="surface-card surface-card--muted stack-sm">
                <h3 style={{ margin: 0 }}>Next best actions</h3>
                {schemaGuidance.length === 0 ? (
                  <p className="helper-text">
                    Looking solid! Keep an eye on validation and relations as your model grows.
                  </p>
                ) : (
                  <ul className="callout-list">
                    {schemaGuidance.map((item) => (
                      <li key={item.label} className={`callout callout--${item.tone}`}>
                        <strong>{item.label}</strong>
                        <span>{item.detail}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
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
