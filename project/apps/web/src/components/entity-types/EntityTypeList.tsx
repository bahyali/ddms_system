import type { components } from '@ddms/sdk';
import Link from 'next/link';

type EntityType = components['schemas']['EntityType'];

interface EntityTypeListProps {
  entityTypes: EntityType[];
}

export const EntityTypeList = ({ entityTypes }: EntityTypeListProps) => {
  if (entityTypes.length === 0) {
    return (
      <div className="empty-state">
        <h3>No entity types yet</h3>
        <p>
          Start with a Project, Resource, or User template. You can always evolve the schema later.
        </p>
        <Link href="/admin/entity-types/new" className="button">
          Launch quickstart
        </Link>
      </div>
    );
  }

  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Label</th>
            <th>Key</th>
            <th>Description</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {entityTypes.map((entityType) => (
            <tr key={entityType.id}>
              <td>
                <div className="stack-sm">
                  <strong>{entityType.label}</strong>
                  <span className="helper-text">
                    Schema ready to evolve
                  </span>
                </div>
              </td>
              <td>
                <code>{entityType.key}</code>
              </td>
              <td>{entityType.description ?? '—'}</td>
              <td>
                <div className="row row-wrap">
                  <Link
                    href={`/entities/${entityType.key}`}
                    className="button secondary"
                  >
                    Open data
                  </Link>
                  <Link
                    href={`/admin/entity-types/${entityType.id}`}
                    className="button secondary"
                  >
                    Configure
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
