import type { components } from '@ddms/sdk';

type FieldDef = components['schemas']['FieldDef'];

interface FieldDefListProps {
  fieldDefs: FieldDef[];
  onEditField: (fieldDef: FieldDef) => void;
  onCreateField?: () => void;
  onDeleteField?: (fieldDef: FieldDef) => void;
}

const renderAclBadges = (fieldDef: FieldDef) => {
  const acl = fieldDef.acl as { read?: string[]; write?: string[] } | undefined;
  const readRoles = acl?.read ?? [];
  const writeRoles = acl?.write ?? [];

  if (readRoles.length === 0 && writeRoles.length === 0) {
    return <span className="helper-text">No roles assigned</span>;
  }

  return (
    <div className="stack-sm">
      {readRoles.length > 0 && (
        <span className="helper-text">
          Read:&nbsp;
          {readRoles.join(', ')}
        </span>
      )}
      {writeRoles.length > 0 && (
        <span className="helper-text">
          Write:&nbsp;
          {writeRoles.join(', ')}
        </span>
      )}
    </div>
  );
};

export const FieldDefList = ({
  fieldDefs,
  onEditField,
  onCreateField,
  onDeleteField,
}: FieldDefListProps) => {
  if (fieldDefs.length === 0) {
    return (
      <div className="empty-state">
        <h3>No fields yet</h3>
        <p>
          Add core attributes like Status, Budget, and Owner. Use dependencies or computed
          formulas to keep data tidy.
        </p>
        <button
          type="button"
          onClick={onCreateField}
          disabled={!onCreateField}
        >
          Add field
        </button>
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
            <th>Kind</th>
            <th>Required</th>
            <th>Indexed</th>
            <th style={{ minWidth: '140px' }}>ACL</th>
            <th style={{ minWidth: '180px' }}>Options</th>
            <th style={{ minWidth: '220px' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {fieldDefs.map((fieldDef) => (
            <tr key={fieldDef.id}>
              <td>
                <div className="stack-sm">
                  <strong>{fieldDef.label}</strong>
                  <span className="helper-text">
                    Position #{fieldDef.position ?? 0}
                  </span>
                </div>
              </td>
              <td>
                <code>{fieldDef.key}</code>
              </td>
              <td>
                <span className="badge">{fieldDef.kind}</span>
              </td>
              <td>
                {fieldDef.required ? (
                  <span className="badge positive">Required</span>
                ) : (
                  <span className="helper-text">Optional</span>
                )}
              </td>
              <td>
                {fieldDef.indexed ? (
                  <span className="badge">Indexed</span>
                ) : (
                  <span className="helper-text">Off</span>
                )}
              </td>
              <td>{renderAclBadges(fieldDef)}</td>
              <td>
                {fieldDef.options?.enum ? (
                  <div className="chip-group">
                    {fieldDef.options.enum.slice(0, 3).map((value) => (
                      <span className="chip" key={value}>
                        {value}
                      </span>
                    ))}
                    {fieldDef.options.enum.length > 3 && (
                      <span className="chip">+{fieldDef.options.enum.length - 3}</span>
                    )}
                  </div>
                ) : fieldDef.kind === 'relation' ? (
                  <div className="stack-sm">
                    <span className="helper-text">
                      Target:{' '}
                      {
                        ((fieldDef.options as { relation?: { target_entity_type_id?: string } })?.relation
                          ?.target_entity_type_id ?? '—')
                      }
                    </span>
                    <span className="helper-text">
                      Cardinality:{' '}
                      {
                        ((fieldDef.options as { relation?: { cardinality?: string } })?.relation
                          ?.cardinality ?? 'one')
                      }
                    </span>
                  </div>
                ) : (
                  <span className="helper-text">—</span>
                )}
              </td>
              <td>
                <div className="row row-wrap" style={{ gap: 'var(--space-2)' }}>
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => onEditField(fieldDef)}
                  >
                    Edit
                  </button>
                  {onDeleteField && (
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => onDeleteField(fieldDef)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
