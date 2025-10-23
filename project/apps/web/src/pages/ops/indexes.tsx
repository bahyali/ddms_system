import Head from 'next/head';
import Link from 'next/link';
import { AppLayout } from '~/components/layout/AppLayout';
import { useGetFieldIndexes } from '~/hooks/useIndexesApi';

const statusBadgeClass = (status: string) => {
  switch (status) {
    case 'ready':
      return 'badge positive';
    case 'in_progress':
      return 'badge';
    case 'failed':
      return 'badge danger';
    default:
      return 'badge warning';
  }
};

const IndexesPage = () => {
  const { data, isLoading, isError, error } = useGetFieldIndexes();

  return (
    <AppLayout
      title="Index jobs"
      subtitle="Monitor CREATE INDEX CONCURRENTLY jobs triggered by field configuration."
      breadcrumbs={[{ label: 'Operations' }, { label: 'Indexes' }]}
      actions={
        <Link href="/admin/entity-types" className="button secondary">
          Manage fields
        </Link>
      }
    >
      <Head>
        <title>Index jobs | DDMS</title>
      </Head>

      <div className="stack">
        <section className="surface-card stack">
          <div className="stack-sm">
            <h3 style={{ margin: 0 }}>Background indexing</h3>
            <p className="helper-text">
              Fields marked as indexed queue concurrent index builds scoped per tenant + entity
              type. Monitor status and retry failed jobs from here.
            </p>
          </div>

          {isLoading && <p className="helper-text">Loading index jobs…</p>}
          {isError && <p className="error">Error: {error.message}</p>}

          {!isLoading && !isError && (!data || data.length === 0) && (
            <div className="empty-state">
              <h3>No index jobs yet</h3>
              <p>
                Enable <strong>Indexed</strong> on a field to queue a job. We&apos;ll create a
                scoped btree index in the background.
              </p>
            </div>
          )}

          {data && data.length > 0 && (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Field</th>
                    <th>Status</th>
                    <th>Attempts</th>
                    <th>Updated</th>
                    <th>Last error</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((job) => (
                    <tr key={job.id}>
                      <td>
                        <div className="stack-sm">
                          <strong>{job.fieldLabel}</strong>
                          <span className="helper-text">
                            <code>{job.fieldKey}</code>
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className={statusBadgeClass(job.status)}>{job.status}</span>
                      </td>
                      <td>{job.attempts}</td>
                      <td>
                        {job.updatedAt
                          ? new Date(job.updatedAt).toLocaleString()
                          : '—'}
                      </td>
                      <td>{job.lastError ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
};

export default IndexesPage;
