-- Function to send notifications on data changes
CREATE OR REPLACE FUNCTION notify_event() RETURNS trigger AS $$
DECLARE
  payload jsonb;
  record_data RECORD;
  event_action TEXT;
  resource_type TEXT;
BEGIN
  -- Determine which record to use (NEW for INSERT/UPDATE, OLD for DELETE)
  IF (TG_OP = 'DELETE') THEN
    record_data := OLD;
    event_action := 'deleted';
  ELSIF (TG_OP = 'UPDATE') THEN
    record_data := NEW;
    event_action := 'updated';
  ELSE -- INSERT
    record_data := NEW;
    event_action := 'created';
  END IF;

  -- Determine resource type
  CASE TG_TABLE_NAME
    WHEN 'records' THEN resource_type := 'record';
    WHEN 'edges' THEN resource_type := 'edge';
    ELSE RETURN record_data; -- Do nothing for other tables
  END CASE;

  -- Build the payload based on the table
  IF (TG_TABLE_NAME = 'records') THEN
    payload := jsonb_build_object(
      'type', resource_type || '.' || event_action,
      'tenant_id', record_data.tenant_id,
      'id', record_data.id,
      'entity_type_id', record_data.entity_type_id,
      'changed_at', record_data.updated_at
    );
  ELSIF (TG_TABLE_NAME = 'edges') THEN
    payload := jsonb_build_object(
      'type', resource_type || '.' || event_action,
      'tenant_id', record_data.tenant_id,
      'id', record_data.id,
      'from_record_id', record_data.from_record_id,
      'to_record_id', record_data.to_record_id,
      'changed_at', record_data.created_at
    );
  END IF;

  -- Send the notification on the 'events' channel
  PERFORM pg_notify('events', payload::text);

  RETURN record_data;
END;
$$ LANGUAGE plpgsql;

-- Trigger for the 'records' table
CREATE TRIGGER trg_records_notify
AFTER INSERT OR UPDATE OR DELETE ON records
FOR EACH ROW EXECUTE FUNCTION notify_event();

-- Trigger for the 'edges' table
CREATE TRIGGER trg_edges_notify
AFTER INSERT OR DELETE ON edges
FOR EACH ROW EXECUTE FUNCTION notify_event();