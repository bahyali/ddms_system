import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import type { components } from '@ddms/sdk';

import { AppLayout } from '~/components/layout/AppLayout';
import { DynamicForm } from '~/components/dynamic-form';
import { useGetEntityTypeByKey, useGetEntityTypes } from '~/hooks/useEntityTypesApi';
import { useGetFieldDefs } from '~/hooks/useFieldDefsApi';
import { useGetRecord, useUpdateRecord } from '~/hooks/useRecordsApi';
import { useRelations } from '~/hooks/useRelationsApi';
import type { RelationWithContext } from '~/hooks/useRelationsApi';
import api from '~/lib/api';

type ValidationError = components['schemas']['ValidationErrorDetail'];

const EditRecordPage = () => {
  const router = useRouter();
  const { entityTypeKey, recordId } = router.query;
  const key = typeof entityTypeKey === 'string' ? entityTypeKey : '';
  const id = typeof recordId === 'string' ? recordId : '';

  const [serverErrors, setServerErrors] = useState<ValidationError[] | null>(null);
  const [relationSearch, setRelationSearch] = useState('');

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
  const allRelationGroups = useMemo(
    () => [...outgoingGroups, ...incomingGroups],
    [outgoingGroups, incomingGroups],
  );

  const { previewMap, isLoading: isLoadingRelationPreviews } = useRelationPreviewMap(
    allRelationGroups,
    entityTypesById,
  );

  const filteredOutgoingGroups = useMemo(
    () =>
      filterRelationGroups(outgoingGroups, relationSearch, previewMap, entityTypesById),
    [outgoingGroups, relationSearch, previewMap, entityTypesById],
  );
  const filteredIncomingGroups = useMemo(
    () =>
      filterRelationGroups(incomingGroups, relationSearch, previewMap, entityTypesById),
    [incomingGroups, relationSearch, previewMap, entityTypesById],
  );

  const hasSearchTerm = relationSearch.trim().length > 0;
  const hasRelationMatches =
    filteredOutgoingGroups.length > 0 || filteredIncomingGroups.length > 0;

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
            <div className="relationships-toolbar">
              <div className="stack-sm">
                <h3 style={{ margin: 0 }}>Relationships</h3>
                <p className="helper-text">
                  Scan linked records or search by name to jump straight into the right context.
                </p>
              </div>
              {(outgoingGroups.length > 0 || incomingGroups.length > 0) && (
                <div className="relationships-search">
                  <input
                    type="search"
                    placeholder="Search linked records"
                    value={relationSearch}
                    onChange={(event) => setRelationSearch(event.target.value)}
                  />
                </div>
              )}
            </div>
            {isLoadingOutgoingRelations || isLoadingIncomingRelations ? (
              <p className="helper-text">Loading relations…</p>
            ) : outgoingGroups.length === 0 && incomingGroups.length === 0 ? (
              <p className="helper-text">No relations yet.</p>
            ) : (
              <>
                {isLoadingRelationPreviews && (
                  <p className="helper-text">Loading linked record details…</p>
                )}
                {hasSearchTerm && !hasRelationMatches ? (
                  <p className="helper-text">
                    No related records match &ldquo;{relationSearch}&rdquo;.
                  </p>
                ) : (
                  <div className="stack">
                    {filteredOutgoingGroups.length > 0 && (
                      <RelationGroupList
                        title="Linked from this record"
                        description="These links are stored on this entity type."
                        groups={filteredOutgoingGroups}
                        entityTypesById={entityTypesById}
                        previewMap={previewMap}
                      />
                    )}
                    {filteredIncomingGroups.length > 0 && (
                      <RelationGroupList
                        title="Linked to this record"
                        description="Other records refer to this record via relation fields."
                        groups={filteredIncomingGroups}
                        entityTypesById={entityTypesById}
                        previewMap={previewMap}
                        highlightTarget
                      />
                    )}
                  </div>
                )}
              </>
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
  previewMap: Map<string, string>;
}

function RelationGroupList({
  title,
  description,
  groups,
  entityTypesById,
  highlightTarget,
  previewMap,
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
                const previewLabel =
                  previewMap.get(relation.id) ?? formatRelationLabel(relation);

                return (
                  <div key={relation.id} className="stack-sm">
                    <span className="helper-text">
                      {targetEntityLabel} • {relation.direction === 'from' ? 'from this record' : 'to this record'}
                    </span>
                    {href ? (
                      <Link href={href} className="button secondary">
                        {previewLabel}
                      </Link>
                    ) : (
                      <span className="helper-text">{previewLabel}</span>
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

function useRelationPreviewMap(
  groups: RelationGroup[],
  entityTypesById?: Map<string, { key: string; label: string }>,
) {
  const relations = useMemo(
    () => groups.flatMap((group) => group.items),
    [groups],
  );

  const fieldDefTargets = useMemo(() => {
    const unique = new Set<string>();
    relations.forEach((relation) => {
      if (relation.relatedRecord.entityTypeId) {
        unique.add(relation.relatedRecord.entityTypeId);
      }
    });
    return Array.from(unique);
  }, [relations]);

  const recordTargets = useMemo(() => {
    if (!entityTypesById) return [];
    const map = new Map<
      string,
      { entityTypeId: string; entityTypeKey: string; recordId: string; compositeKey: string }
    >();
    relations.forEach((relation) => {
      const meta = entityTypesById.get(relation.relatedRecord.entityTypeId);
      if (!meta) return;
      const compositeKey = `${meta.key}:${relation.relatedRecord.id}`;
      if (!map.has(compositeKey)) {
        map.set(compositeKey, {
          entityTypeId: relation.relatedRecord.entityTypeId,
          entityTypeKey: meta.key,
          recordId: relation.relatedRecord.id,
          compositeKey,
        });
      }
    });
    return Array.from(map.values());
  }, [entityTypesById, relations]);

  const fieldDefsQueries = useQueries({
    queries: fieldDefTargets.map((entityTypeId) => ({
      queryKey: ['entityTypes', entityTypeId, 'fieldDefs', 'list'],
      enabled: Boolean(entityTypeId),
      queryFn: async (): Promise<components['schemas']['FieldDef'][]> => {
        const { data, error } = await api.GET('/entity-types/{entityTypeId}/fields', {
          params: { path: { entityTypeId } },
        });
        if (error) throw error;
        return data ?? [];
      },
    })),
  });

  const recordQueries = useQueries({
    queries: recordTargets.map((target) => ({
      queryKey: ['relation-record-preview', target.entityTypeKey, target.recordId],
      enabled: Boolean(target.entityTypeKey && target.recordId),
      queryFn: async (): Promise<components['schemas']['Record'] | undefined> => {
        const { data, error } = await api.GET('/entities/{entityTypeKey}/{recordId}', {
          params: { path: { entityTypeKey: target.entityTypeKey, recordId: target.recordId } },
        });
        if (error) throw error;
        return data ?? undefined;
      },
    })),
  });

  const fieldDefsByEntityTypeId = useMemo(() => {
    const map = new Map<string, components['schemas']['FieldDef'][]>();
    fieldDefsQueries.forEach((query, index) => {
      const entityTypeId = fieldDefTargets[index];
      if (!entityTypeId) return;
      if (query.data) {
        map.set(entityTypeId, query.data);
      }
    });
    return map;
  }, [fieldDefTargets, fieldDefsQueries]);

  const recordByCompositeKey = useMemo(() => {
    const map = new Map<string, components['schemas']['Record']>();
    recordQueries.forEach((query, index) => {
      const target = recordTargets[index];
      if (!target) return;
      if (query.data) {
        map.set(target.compositeKey, query.data);
      }
    });
    return map;
  }, [recordQueries, recordTargets]);

  const previewMap = useMemo(() => {
    const map = new Map<string, string>();
    relations.forEach((relation) => {
      const preview = computeRelationPreview(
        relation,
        fieldDefsByEntityTypeId,
        recordByCompositeKey,
        entityTypesById,
      );
      map.set(relation.id, preview);
    });
    return map;
  }, [relations, fieldDefsByEntityTypeId, recordByCompositeKey, entityTypesById]);

  const isLoading = useMemo(
    () => fieldDefsQueries.some((query) => query.isLoading) || recordQueries.some((query) => query.isLoading),
    [fieldDefsQueries, recordQueries],
  );

  return { previewMap, isLoading };
}

function computeRelationPreview(
  relation: RelationWithContext,
  fieldDefsByEntityTypeId: Map<string, components['schemas']['FieldDef'][]>,
  recordByCompositeKey: Map<string, components['schemas']['Record']>,
  entityTypesById?: Map<string, { key: string; label: string }>,
) {
  const fallback = formatRelationLabel(relation);
  if (!entityTypesById) {
    return fallback;
  }
  const entityMeta = entityTypesById.get(relation.relatedRecord.entityTypeId);
  if (!entityMeta) {
    return fallback;
  }
  const compositeKey = `${entityMeta.key}:${relation.relatedRecord.id}`;
  const record = recordByCompositeKey.get(compositeKey);
  const fieldDefs = fieldDefsByEntityTypeId.get(relation.relatedRecord.entityTypeId);

  if (!record || !fieldDefs || fieldDefs.length === 0) {
    return fallback;
  }

  const firstFieldValue = extractFirstPositionValue(record, fieldDefs);
  if (firstFieldValue) {
    return firstFieldValue;
  }

  return fallback;
}

function extractFirstPositionValue(
  record: components['schemas']['Record'],
  fieldDefs: components['schemas']['FieldDef'][],
) {
  const sortedFields = [...fieldDefs].sort((a, b) => {
    const aPos = a.position ?? 0;
    const bPos = b.position ?? 0;
    return aPos - bPos;
  });

  const firstNonRelationField =
    sortedFields.find((field) => field.kind !== 'relation') ?? sortedFields[0];
  if (!firstNonRelationField) {
    return null;
  }

  const data = (record.data ?? {}) as Record<string, unknown>;
  const value = data[firstNonRelationField.key];
  return formatPreviewValue(value);
}

function formatPreviewValue(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (Array.isArray(value)) {
    const normalized = value
      .map((item) => {
        if (typeof item === 'string' && item.trim().length > 0) {
          return item;
        }
        if (typeof item === 'number' || typeof item === 'boolean') {
          return String(item);
        }
        if (item && typeof item === 'object') {
          const candidate =
            typeof (item as { label?: unknown }).label === 'string'
              ? ((item as { label?: string }).label ?? '').trim()
              : undefined;
          if (candidate) {
            return candidate;
          }
          const valueCandidate =
            typeof (item as { value?: unknown }).value === 'string'
              ? ((item as { value?: string }).value ?? '').trim()
              : undefined;
          if (valueCandidate) {
            return valueCandidate;
          }
        }
        return null;
      })
      .filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
    if (normalized.length > 0) {
      return normalized.join(', ');
    }
    return null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (value && typeof value === 'object') {
    const label = (value as { label?: unknown }).label;
    if (typeof label === 'string' && label.trim().length > 0) {
      return label.trim();
    }
    const name = (value as { name?: unknown }).name;
    if (typeof name === 'string' && name.trim().length > 0) {
      return name.trim();
    }
  }
  return null;
}

function filterRelationGroups(
  groups: RelationGroup[],
  searchTerm: string,
  previewMap: Map<string, string>,
  entityTypesById?: Map<string, { key: string; label: string }>,
) {
  const query = searchTerm.trim().toLowerCase();
  if (!query) {
    return groups;
  }

  return groups
    .map((group) => {
      const filteredItems = group.items.filter((relation) => {
        const preview = previewMap.get(relation.id) ?? formatRelationLabel(relation);
        const targetEntityLabel =
          entityTypesById?.get(relation.relatedRecord.entityTypeId)?.label ?? '';
        return (
          preview.toLowerCase().includes(query) ||
          targetEntityLabel.toLowerCase().includes(query) ||
          relation.relatedRecord.id.toLowerCase().includes(query)
        );
      });
      if (filteredItems.length === 0) {
        return null;
      }
      if (filteredItems.length === group.items.length) {
        return group;
      }
      return {
        field: group.field,
        items: filteredItems,
      };
    })
    .filter((group): group is RelationGroup => group !== null);
}

function formatRelationLabel(relation: RelationWithContext): string {
  if (relation.relatedRecord.label && relation.relatedRecord.label.length > 0) {
    return relation.relatedRecord.label;
  }
  return relation.relatedRecord.id.slice(0, 8);
}

export default EditRecordPage;
