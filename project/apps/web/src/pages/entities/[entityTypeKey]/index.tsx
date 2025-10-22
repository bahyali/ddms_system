import { useRouter } from 'next/router';
import { useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import type { ColumnDef, PaginationState } from '@tanstack/react-table';
import type { components } from '@ddms/sdk';

import { useGetEntityTypeByKey } from '~/hooks/useEntityTypesApi';
import { useGetFieldDefs } from '~/hooks/useFieldDefsApi';
import { useGetRecords } from '~/hooks/useRecordsApi';
import { DynamicTable } from '~/components/dynamic-table/DynamicTable';

type Record = components['schemas']['Record'];
type FieldDef = components['schemas']['FieldDef'];

const EntityRecordsPage = () => {
  const router = useRouter();
  const { entityTypeKey } = router.query;
  const key = typeof entityTypeKey === 'string' ? entityTypeKey : '';

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const {
    data: entityType,
    isLoading: isLoadingEntityType,
    isError: isEntityTypeError,
    error: entityTypeError,
  } = useGetEntityTypeByKey(key);

  const entityTypeId = entityType?.id;

  const {
    data: fieldDefs,
    isLoading: isLoadingFieldDefs,
    isError: isFieldDefsError,
    error: fieldDefsError,
  } = useGetFieldDefs(entityTypeId!);

  const {
    data: recordsData,
    isLoading: isLoadingRecords,
    isError: isRecordsError,
    error: recordsError,
  } = useGetRecords({
    entityTypeKey: key,
    pageIndex: pagination.pageIndex,
    pageSize: pagination.pageSize,
  });

  const columns = useMemo<ColumnDef<Record>[]>(() => {
    if (!fieldDefs) return [];
    return fieldDefs.map((field: FieldDef) => ({
      accessorKey: `data.${field.key}`,
      header: field.label,
      cell: (info) => String(info.getValue() ?? ''),
    }));
  }, [fieldDefs]);

  const pageCount = recordsData?.total
    ? Math.ceil(recordsData.total / pagination.pageSize)
    : -1;

  const isLoading = isLoadingEntityType || isLoadingFieldDefs;

  if (isLoading) return <main><p>Loading entity information...</p></main>;
  if (isEntityTypeError) return <main><p className="error">Error: {entityTypeError.message}</p></main>;
  if (!entityType) return <main><p>Entity type not found.</p></main>;

  return (
    <>
      <Head>
        <title>{entityType.label} Records | DDMS</title>
      </Head>
      <main>
        <Link href="/admin/entity-types">Back to Admin</Link>
        <h1>{entityType.label}</h1>

        {isFieldDefsError && <p className="error">Error loading fields: {fieldDefsError.message}</p>}
        {isRecordsError && <p className="error">Error loading records: {recordsError.message}</p>}

        {isLoadingRecords && <p>Loading records...</p>}
        
        {recordsData && fieldDefs && (
          <DynamicTable
            data={recordsData.rows}
            columns={columns}
            pageCount={pageCount}
            pagination={pagination}
            setPagination={setPagination}
          />
        )}
      </main>
    </>
  );
};

export default EntityRecordsPage;