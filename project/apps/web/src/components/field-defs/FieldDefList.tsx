import type { components } from '@ddms/sdk';

type FieldDef = components['schemas']['FieldDef'];

interface FieldDefListProps {
  fieldDefs: FieldDef[];
  onEditField: (fieldDef: FieldDef) => void;
  onCreateField?: () => void;
}

const renderAclBadges = (fieldDef: FieldDef) => {
  const acl = fieldDef.acl as { read?: string[]; write?: string[] } | undefined;
  if (!acl || (!acl.read && !acl.write)) {
    return <span className="helper-text">Default (admin)</span>;
  }

  return (
    <div className="stack-sm">
      {acl.read && (
        <span className="helper-text">
          Read:&nbsp;
          {acl.read.length > 0 ? acl.read.join(', ') : '—'}
        </span>
      )}
      {acl.write && (
        <span className="helper-text">
          Write:&nbsp;
          {acl.write.length > 0 ? acl.write.join(', ') : '—'}
        </span>
      )}
    </div>
  );
};

export const FieldDefList = ({
  fieldDefs,
  onEditField,
  onCreateField,
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
            <th>ACL</th>
            <th>Options</th>
            <th>Actions</th>
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
                ) : (
                  <span className="helper-text">—</span>
                )}
              </td>
              <td>
                <div className="row row-wrap">
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => onEditField(fieldDef)}
                  >
                    Edit
                  </button>
                  <button type="button" className="button secondary" disabled>
                    Dependencies
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
