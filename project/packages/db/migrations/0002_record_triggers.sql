-- FTS Refresh Trigger
CREATE FUNCTION records_fts_refresh() RETURNS trigger AS $$
DECLARE
  textagg text;
BEGIN
  -- Aggregate all string-like values from the 'data' JSONB field.
  -- A more advanced implementation could respect the 'searchable' flag on field_defs,
  -- but this is simpler and sufficient for the initial version.
  textagg := (
    SELECT string_agg(value::text, ' ')
    FROM jsonb_each_text(NEW.data)
  );
  
  -- Set the 'fts' column to the generated tsvector.
  -- Use 'simple' configuration and coalesce to handle cases with no text data.
  NEW.fts := to_tsvector('simple', coalesce(textagg, ''));
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_records_fts
BEFORE INSERT OR UPDATE ON records
FOR EACH ROW EXECUTE FUNCTION records_fts_refresh();

-- Versioning Trigger
CREATE FUNCTION records_versioning() RETURNS trigger AS $$
BEGIN
  -- This trigger only acts on UPDATE operations.
  IF TG_OP = 'UPDATE' THEN
    -- Insert the old state of the record into the record_versions table.
    -- The 'changed_by' is taken from the 'updated_by' of the NEW record.
    INSERT INTO record_versions(record_id, version, data, changed_by)
    VALUES (OLD.id, OLD.version, OLD.data, NEW.updated_by);
    
    -- Increment the version number on the record being updated.
    NEW.version := OLD.version + 1;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_records_versioning
BEFORE UPDATE ON records
FOR EACH ROW EXECUTE FUNCTION records_versioning();