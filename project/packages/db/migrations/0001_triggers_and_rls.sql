-- Section 6.6: Relation Type Check Trigger
CREATE FUNCTION edges_validate() RETURNS trigger AS $$
DECLARE
  tgt uuid;
BEGIN
  SELECT (options->'relation'->>'target_entity_type_id')::uuid INTO tgt
  FROM field_defs WHERE id = NEW.field_id;

  IF tgt IS NULL THEN
    RAISE EXCEPTION 'field_id % is not relation', NEW.field_id;
  END IF;

  IF (SELECT entity_type_id FROM records WHERE id = NEW.to_record_id) != tgt THEN
    RAISE EXCEPTION 'edge target type mismatch';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_edges_validate
BEFORE INSERT OR UPDATE ON edges
FOR EACH ROW EXECUTE FUNCTION edges_validate();


-- Section 6.7: Row-Level Security (RLS)
-- Enable RLS for all tenant-scoped tables
ALTER TABLE entity_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_defs ENABLE ROW LEVEL SECURITY;
ALTER TABLE records ENABLE ROW LEVEL SECURITY;
ALTER TABLE edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE record_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Create policies to restrict access to the current tenant
CREATE POLICY tenant_only_entity_types ON entity_types
  FOR ALL
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY tenant_only_field_defs ON field_defs
  FOR ALL
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY tenant_only_records ON records
  FOR ALL
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY tenant_only_edges ON edges
  FOR ALL
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY tenant_only_audit_log ON audit_log
  FOR ALL
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- record_versions is special as it does not have a tenant_id column.
-- The policy must be based on the tenant_id of the associated record.
CREATE POLICY tenant_only_record_versions ON record_versions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM records
      WHERE records.id = record_versions.record_id
      AND records.tenant_id = current_setting('app.tenant_id')::uuid
    )
  );