import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useMemo, useState } from 'react';
import type { components } from '@ddms/sdk';

import { AppLayout } from '~/components/layout/AppLayout';
import { DynamicForm } from '~/components/dynamic-form';
import { useGetEntityTypeByKey, useGetEntityTypes } from '~/hooks/useEntityTypesApi';
import { useGetFieldDefs } from '~/hooks/useFieldDefsApi';
import { useGetRecord, useUpdateRecord } from '~/hooks/useRecordsApi';
import { useRelations } from '~/hooks/useRelationsApi';
import type { RelationWithContext } from '~/hooks/useRelationsApi';

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

  const { data: allEntityTypes } = useGetEntityTypes();
  const entityTypesById = useMemo(() => {
    const map = new Map<string, { key: string; label: string }>();
    allEntityTypes?.forEach((item) => {
      map.set(item.id, { key: item.key, label: item.label });
    });
    return map;
  }, [allEntityTypes]);

  const {
    data: outgoingRelations,
    isLoading: isLoadingOutgoingRelations,
  } = useRelations({
    recordId: id,
    role: 'from',
    enabled: Boolean(id),
  });

  const {
    data: incomingRelations,
    isLoading: isLoadingIncomingRelations,
  } = useRelations({
    recordId: id,
    role: 'to',
    enabled: Boolean(id),
  });

  const updateRecord = useUpdateRecord(key, id);

  const isLoading =
    isLoadingEntityType ||
    isLoadingFieldDefs ||
    isLoadingRecord ||
    isLoadingOutgoingRelations;

  const outgoingGroups = useMemo(() => groupRelations(outgoingRelations), [outgoingRelations]);
  const incomingGroups = useMemo(() => groupRelations(incomingRelations), [incomingRelations]);

  const relationInitialValues = useMemo(() => {
    if (!fieldDefs || !outgoingRelations) return {};
    const fieldById = new Map(fieldDefs.map((field) => [field.id, field]));
    const accumulator: Record<string, unknown> = {};
    outgoingRelations.forEach((relation) => {
      const field = fieldById.get(relation.field.id);
      if (!field) return;
      const cardinality = relation.field.cardinality ?? 'one';
      const fieldKey = field.key;
      if (cardinality === 'many') {
        const current = (accumulator[fieldKey] as string[] | undefined) ?? [];
        if (!current.includes(relation.relatedRecord.id)) {
          accumulator[fieldKey] = [...current, relation.relatedRecord.id];
        } else {
          accumulator[fieldKey] = current;
        }
      } else {
        accumulator[fieldKey] = relation.relatedRecord.id;
      }
    });
    return accumulator;
  }, [fieldDefs, outgoingRelations]);

  const initialFormData = useMemo(() => {
    return {
      ...(record?.data ?? {}),
      ...relationInitialValues,
    } as Record<string, unknown>;
  }, [record, relationInitialValues]);

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
                initialData={initialFormData as Record<string, unknown>}
                onSubmit={handleSubmit}
                isLoading={updateRecord.isPending}
                onCancel={() => router.push(`/entities/${key}`)}
                submitText="Update record"
                serverErrors={serverErrors}
                entityTypesById={entityTypesById}
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

        {!isLoading && record && (
          <section className="surface-card stack">
            <h3 style={{ margin: 0 }}>Relationships</h3>
            {isLoadingOutgoingRelations || isLoadingIncomingRelations ? (
              <p className="helper-text">Loading relations…</p>
            ) : outgoingGroups.length === 0 && incomingGroups.length === 0 ? (
              <p className="helper-text">No relations yet.</p>
            ) : (
              <div className="stack">
                {outgoingGroups.length > 0 && (
                  <RelationGroupList
                    title="Linked from this record"
                    description="These links are stored on this entity type."
                    groups={outgoingGroups}
                    entityTypesById={entityTypesById}
                  />
                )}
                {incomingGroups.length > 0 && (
                  <RelationGroupList
                    title="Linked to this record"
                    description="Other records refer to this record via relation fields."
                    groups={incomingGroups}
                    entityTypesById={entityTypesById}
                    highlightTarget
                  />
                )}
              </div>
            )}
          </section>
        )}
      </div>
    </AppLayout>
  );
};

type RelationGroup = {
  field: RelationWithContext['field'];
  items: RelationWithContext[];
};

function groupRelations(relations?: RelationWithContext[] | null): RelationGroup[] {
  if (!relations || relations.length === 0) {
    return [];
  }
  const map = new Map<string, RelationGroup>();
  relations.forEach((relation) => {
    const existing = map.get(relation.field.id);
    if (existing) {
      existing.items.push(relation);
    } else {
      map.set(relation.field.id, {
        field: relation.field,
        items: [relation],
      });
    }
  });
  return Array.from(map.values());
}

interface RelationGroupListProps {
  title: string;
  description: string;
  groups: RelationGroup[];
  entityTypesById?: Map<string, { key: string; label: string }>;
  highlightTarget?: boolean;
}

function RelationGroupList({
  title,
  description,
  groups,
  entityTypesById,
  highlightTarget,
}: RelationGroupListProps) {
  if (groups.length === 0) {
    return null;
  }

  return (
    <div className="stack">
      <div className="stack-sm">
        <h4 style={{ margin: 0 }}>{title}</h4>
        <p className="helper-text">{description}</p>
      </div>
      <div className="stack">
        {groups.map((group) => (
          <div key={group.field.id} className="surface-card surface-card--muted stack">
            <strong>{group.field.label}</strong>
            <div className="stack-sm">
              {group.items.map((relation) => {
                const targetEntityId = relation.relatedRecord.entityTypeId;
                const targetEntity = entityTypesById?.get(targetEntityId);
                const targetEntityLabel = targetEntity?.label ?? targetEntityId;
                const targetEntityKey = targetEntity?.key;
                const href = targetEntityKey
                  ? `/entities/${targetEntityKey}/${relation.relatedRecord.id}`
                  : undefined;

                return (
                  <div key={relation.id} className="stack-sm">
                    <span className="helper-text">
                      {targetEntityLabel} • {relation.direction === 'from' ? 'from this record' : 'to this record'}
                    </span>
                    {href ? (
                      <Link href={href} className="button secondary">
                        {formatRelationLabel(relation)}
                      </Link>
                    ) : (
                      <span className="helper-text">{formatRelationLabel(relation)}</span>
                    )}
                    {highlightTarget && relation.field.targetEntityTypeId && (
                      <span className="helper-text">
                        Field owner: {entityTypesById?.get(relation.field.entityTypeId)?.label ?? relation.field.entityTypeId}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatRelationLabel(relation: RelationWithContext): string {
  if (relation.relatedRecord.label && relation.relatedRecord.label.length > 0) {
    return relation.relatedRecord.label;
  }
  return relation.relatedRecord.id.slice(0, 8);
}

export default EditRecordPage;
