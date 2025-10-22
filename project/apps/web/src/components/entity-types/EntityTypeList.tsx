import Link from 'next/link';
import type { components } from '@ddms/sdk';

type EntityType = components['schemas']['EntityType'];

interface EntityTypeListProps {
  entityTypes: EntityType[];
}

export const EntityTypeList = ({ entityTypes }: EntityTypeListProps) => {
  if (entityTypes.length === 0) {
    return <p>No entity types found. Create one to get started.</p>;
  }

  return (
    <ul>
      {entityTypes.map((et) => (
        <li key={et.id}>
          <div>
            <strong>{et.label}</strong>
            <br />
            <small>Key: <code>{et.key}</code></small>
          </div>
          <Link href={`/admin/entity-types/${et.id}/edit`}>Edit</Link>
        </li>
      ))}
    </ul>
  );
};