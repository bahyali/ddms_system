import type { components } from '@ddms/sdk';

type FieldDef = components['schemas']['FieldDef'];

interface FieldDefListProps {
  fieldDefs: FieldDef[];
  onEditField: (fieldDef: FieldDef) => void;
}

export const FieldDefList = ({ fieldDefs, onEditField }: FieldDefListProps) => {
  if (fieldDefs.length === 0) {
    return <p>No fields defined for this entity type. Add one to get started.</p>;
  }

  return (
    <ul>
      {fieldDefs.map((fd) => (
        <li key={fd.id}>
          <div>
            <strong>{fd.label}</strong>
            <br />
            <small>Key: <code>{fd.key}</code> | Kind: <code>{fd.kind}</code></small>
          </div>
          <button onClick={() => onEditField(fd)}>Edit</button>
        </li>
      ))}
    </ul>
  );
};