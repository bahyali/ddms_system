import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import type { ColumnDef, PaginationState } from '@tanstack/react-table';
import type { components } from '@ddms/sdk';

import { AppLayout } from '~/components/layout/AppLayout';
import { DynamicTable } from '~/components/dynamic-table/DynamicTable';
import { FieldValueDisplay } from '~/components/dynamic-table/FieldValueDisplay';
import { FilterBuilder } from '~/components/filter-builder/FilterBuilder';
import {
  useGetEntityTypeByKey,
  useGetEntityTypes,
} from '~/hooks/useEntityTypesApi';
import { useGetFieldDefs } from '~/hooks/useFieldDefsApi';
import { useGetRecords } from '~/hooks/useRecordsApi';

type RecordRow = components['schemas']['Record'];
type Filter = components['schemas']['Filter'];

const EntityRecordsPage = () => {
  const router = useRouter();
  const { entityTypeKey } = router.query;
  const key = typeof entityTypeKey === 'string' ? entityTypeKey : '';

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [filter, setFilter] = useState<Filter | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    setFilter(null);
    setPagination({ pageIndex: 0, pageSize: 10 });
  }, [key]);

  const {
    data: entityType,
    isError: isEntityTypeError,
    error: entityTypeError,
  } = useGetEntityTypeByKey(key);

  const entityTypeId = entityType?.id ?? '';

  const {
    data: fieldDefs,
    isLoading: isLoadingFieldDefs,
    isError: isFieldDefsError,
    error: fieldDefsError,
  } = useGetFieldDefs(entityTypeId);

  const {
    data: recordsData,
    isLoading: isLoadingRecords,
    isError: isRecordsError,
    error: recordsError,
  } = useGetRecords({
    entityTypeKey: key,
    pageIndex: pagination.pageIndex,
    pageSize: pagination.pageSize,
    filter: filter ?? undefined,
  });

  const { data: allEntityTypes } = useGetEntityTypes();

  const entityTypesById = useMemo(() => {
    const map = new Map<string, { key: string; label: string }>();
    allEntityTypes?.forEach((item) => {
      map.set(item.id, { key: item.key, label: item.label });
    });
    return map;
  }, [allEntityTypes]);

  const searchableFields = useMemo(
    () => fieldDefs?.filter((fd) => fd.searchable) ?? [],
    [fieldDefs],
  );

  const columns = useMemo<ColumnDef<RecordRow>[]>(() => {
    const fieldColumns =
      fieldDefs?.map((field) => ({
        id: `field-${field.key}`,
        header: field.label,
        cell: ({ row }: { row: { original: RecordRow } }) => (
          <FieldValueDisplay
            fieldDef={field}
            value={(row.original.data as Record<string, unknown> | undefined)?.[
              field.key
            ]}
            entityTypesById={entityTypesById}
          />
        ),
      })) ?? [];

    const baseColumn: ColumnDef<RecordRow> = {
      id: 'record',
      header: 'Record',
      cell: ({ row }) => {
        const record = row.original;
        const primaryLabel = deriveRecordLabel(record, fieldDefs);
        const updated = formatDateForDisplay(record.updatedAt);
        return (
          <div className="stack-sm">
            <strong>{primaryLabel}</strong>
            <span className="helper-text">
              <code>{record.id}</code>
              {updated ? ` • Updated ${updated}` : null}
            </span>
          </div>
        );
      },
    };

    if (fieldColumns.length === 0) {
      return [
        baseColumn,
        {
          id: 'record-id',
          header: 'Record ID',
          cell: ({ row }) => <code>{truncateId(row.original.id)}</code>,
        },
      ];
    }

    return [baseColumn, ...fieldColumns];
  }, [entityTypesById, fieldDefs]);

  const pageCount = recordsData?.total
    ? Math.ceil(recordsData.total / pagination.pageSize)
    : -1;

  const title = entityType ? `${entityType.label} records` : 'Entity data';
  const subtitle = entityType
    ? `Search, slice, and export ${entityType.label.toLowerCase()} records.`
    : 'Search, slice, and export entity records.';

  const actions = (
    <>
      <Link
        href={entityType ? `/entities/${entityType.key}/new` : '#'}
        className="button"
      >
        New record
      </Link>
      <button
        type="button"
        className="button secondary"
        disabled
        title="Export coming soon"
      >
        Export CSV
      </button>
    </>
  );

  return (
    <AppLayout
      title={title}
      subtitle={subtitle}
      actions={actions}
      breadcrumbs={[
        { label: 'Data', href: '/' },
        {
          label: entityType ? entityType.label : 'Entity',
        },
      ]}
    >
      <Head>
        <title>{entityType ? `${entityType.label} Records` : 'Records'} | DDMS</title>
      </Head>

      <div className="stack">
        {(isEntityTypeError || isFieldDefsError || isRecordsError) && (
          <div className="error">
            {isEntityTypeError && <p>Failed to load entity: {entityTypeError.message}</p>}
            {isFieldDefsError && <p>Failed to load fields: {fieldDefsError.message}</p>}
            {isRecordsError && <p>Failed to load records: {recordsError.message}</p>}
          </div>
        )}

        <section className="surface-card records-toolbar stack-sm">
          <div className="records-toolbar__section records-toolbar__section--single">
            <div className="records-toolbar__text">
              <h3>Filters</h3>
              <p className="helper-text">
                {filter
                  ? 'Filter active. Open the builder to refine or clear it.'
                  : 'Stack conditions across searchable fields to narrow results.'}
              </p>
            </div>
            <div className="records-toolbar__actions">
              <button
                type="button"
                className="button stealth"
                onClick={() => setFilter(null)}
                disabled={!filter}
              >
                Clear
              </button>
              <button
                type="button"
                className="button secondary"
                onClick={() => setFiltersOpen((previous) => !previous)}
              >
                {filtersOpen ? 'Hide builder' : 'Open builder'}
              </button>
            </div>
          </div>

          {filtersOpen && (
            <div className="records-toolbar__panel stack-sm">
              {isLoadingFieldDefs && (
                <p className="helper-text">Loading field definitions…</p>
              )}
              {!isLoadingFieldDefs && searchableFields.length === 0 && (
                <p className="helper-text">
                  No searchable fields yet. Mark fields as searchable from the Entity Type screen to
                  unlock quick filtering.
                </p>
              )}
              {searchableFields.length > 0 && (
                <FilterBuilder
                  key={key}
                  fieldDefs={searchableFields}
                  onApplyFilter={setFilter}
                />
              )}
            </div>
          )}
        </section>

        <section className="surface-card stack">
          <div className="row row-wrap" style={{ justifyContent: 'space-between' }}>
            <div className="stack-sm">
              <h3 style={{ margin: 0 }}>Records</h3>
              <p className="helper-text">
                Server-powered pagination keeps things snappy. Click a row to view the full record.
              </p>
            </div>
            <span className="helper-text">
              {recordsData ? `${recordsData.total} total records` : '—'}
            </span>
          </div>
          {isLoadingRecords ? (
            <p className="helper-text">Loading records…</p>
          ) : recordsData && fieldDefs ? (
            <DynamicTable
              data={recordsData.rows}
              columns={columns}
              pageCount={pageCount}
              pagination={pagination}
              setPagination={setPagination}
              getRecordHref={(row) =>
                entityType ? `/entities/${entityType.key}/${row.id}` : '#'
              }
            />
          ) : (
            <div className="empty-state">
              <h3>No records yet</h3>
              <p>
                Add your first record to kick off the Populate stage. You can import CSVs from the
                Operations area soon.
              </p>
              {entityType && (
                <Link href={`/entities/${entityType.key}/new`} className="button">
                  Create record
                </Link>
              )}
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
};

export default EntityRecordsPage;

function truncateId(value: string, size = 8) {
  if (value.length <= size) return value;
  return `${value.slice(0, size)}…`;
}

function deriveRecordLabel(
  record: RecordRow,
  fieldDefs?: components['schemas']['FieldDef'][] | null,
) {
  if (typeof record.label === 'string' && record.label.trim().length > 0) {
    return record.label;
  }
  const data = (record.data ?? {}) as Record<string, unknown>;
  const fallbackKeys = ['name', 'title', 'label'];
  for (const key of fallbackKeys) {
    const candidate = data[key];
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate;
    }
  }
  if (fieldDefs && fieldDefs.length > 0) {
    const textField = fieldDefs.find((field) => field.kind === 'text');
    if (textField) {
      const candidate = data[textField.key];
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        return candidate;
      }
    }
  }
  return truncateId(record.id, 12);
}

function formatDateForDisplay(raw?: string | null) {
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.valueOf())) {
    return null;
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}
