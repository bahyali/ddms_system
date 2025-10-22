import Link from 'next/link';
import { useGetEntityTypes } from '~/hooks/useEntityTypesApi';
import { EntityTypeList } from '~/components/entity-types/EntityTypeList';
import Head from 'next/head';

const EntityTypesPage = () => {
  const { data: entityTypes, isLoading, isError, error } = useGetEntityTypes();

  return (
    <>
      <Head>
        <title>Entity Types | DDMS</title>
      </Head>
      <main>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1>Entity Types</h1>
          <Link href="/admin/entity-types/new" passHref>
            <button>Create New Entity Type</button>
          </Link>
        </div>

        {isLoading && <p>Loading...</p>}
        {isError && <p className="error">Error: {error.message}</p>}
        {entityTypes && <EntityTypeList entityTypes={entityTypes} />}
      </main>
    </>
  );
};

export default EntityTypesPage;