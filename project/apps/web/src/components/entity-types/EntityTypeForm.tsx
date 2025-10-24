import { useState, useEffect } from 'react';
import type { components } from '@ddms/sdk';

type EntityType = components['schemas']['EntityType'];
type EntityTypeCreate = components['schemas']['EntityTypeCreate'];
type EntityTypeUpdate = components['schemas']['EntityTypeUpdate'];

interface EntityTypeFormProps {
  initialData?: EntityType;
  onSubmit: (data: EntityTypeCreate | EntityTypeUpdate) => void;
  isLoading: boolean;
}

export const EntityTypeForm = ({
  initialData,
  onSubmit,
  isLoading,
}: EntityTypeFormProps) => {
  const [key, setKey] = useState('');
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');

  const isEditMode = !!initialData;

  useEffect(() => {
    if (initialData) {
      setKey(initialData.key);
      setLabel(initialData.label);
      setDescription(initialData.description || '');
    }
  }, [initialData]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = {
      label,
      description: description || null,
    };

    if (isEditMode) {
      onSubmit(formData);
    } else {
      onSubmit({ ...formData, key });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="stack">
      <div className="field-group">
        <label htmlFor="key">Key</label>
        <input
          id="key"
          type="text"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          required
          disabled={isEditMode}
          pattern="^[a-z0-9_]+$"
          title="Key must be lowercase letters, numbers, and underscores only."
        />
        {isEditMode && (
          <span className="helper-text">
            Key cannot be changed after creation.
          </span>
        )}
      </div>
      <div className="field-group">
        <label htmlFor="label">Label</label>
        <input
          id="label"
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          required
        />
      </div>
      <div className="field-group">
        <label htmlFor="description">Description</label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button type="submit" className="button" disabled={isLoading}>
          {isLoading ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  );
};
