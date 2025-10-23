import 'dotenv/config';
import { faker } from '@faker-js/faker';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { Pool } from 'pg';
import * as schema from '@ddms/db';

const TENANT_ID = '11111111-1111-1111-1111-111111111111';
const TENANT_NAME = 'Demo Seed Tenant';
const BATCH_SIZE = Number(process.env.SEED_BATCH_SIZE ?? 1_000);
const TOTAL_USERS = Number(process.env.SEED_USERS ?? 400_000);
const TOTAL_PROJECTS = Number(process.env.SEED_PROJECTS ?? 300_000);
const TOTAL_RESOURCES = Number(process.env.SEED_RESOURCES ?? 300_000);
const EDGE_BATCH_SIZE = 5_000;

type FieldMap = Record<string, string>;

interface SeedContext {
  tenantId: string;
  userEntityId: string;
  projectEntityId: string;
  resourceEntityId: string;
  userFieldMap: FieldMap;
  projectFieldMap: FieldMap;
  resourceFieldMap: FieldMap;
}

if (
  TOTAL_USERS + TOTAL_PROJECTS + TOTAL_RESOURCES !== 1_000_000 &&
  !process.env.ALLOW_CUSTOM_SEED_TOTAL
) {
  throw new Error(
    'Seed totals must add up to 1,000,000 rows. Override with ALLOW_CUSTOM_SEED_TOTAL=true if you know what you are doing.',
  );
}

const defaultAcl = {
  read: ['admin', 'builder', 'contributor', 'viewer'],
  write: ['admin', 'builder'],
};

const userDepartments = [
  'Engineering',
  'Sales',
  'Marketing',
  'Finance',
  'Human Resources',
  'Operations',
  'Support',
];

const userPreferenceSnippets = [
  'Prefers email notifications',
  'Dark mode enabled',
  'Weekly status digest',
  'Beta features opted-in',
  'Mobile push only',
  'Requires accessibility tooling',
  'Tracks goals in analytics',
];

const projectStatuses = ['planning', 'active', 'on_hold', 'completed'];
const projectPriorities = ['low', 'medium', 'high', 'critical'];

const resourceCategories = [
  'Software',
  'Hardware',
  'Licenses',
  'Facilities',
  'Consulting',
  'Training',
];

const resourceStatuses = [
  'available',
  'allocated',
  'maintenance',
  'retired',
];

async function main() {
  faker.seed(42);

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set.');
  }

  const pool = new Pool({
    connectionString,
    max: Number(process.env.SEED_MAX_CONNECTIONS ?? 20),
  });
  const db: Database = drizzle(pool, { schema });

  console.time('seed');

  try {
    const context = await prepareMetadata(db);

    const userIds = await seedUsers(db, context);
    const projectIds = await seedProjects(db, context, userIds);
    await seedResources(db, context, projectIds, userIds);
  } finally {
    await pool.end();
    console.timeEnd('seed');
  }
}

type Database = NodePgDatabase<typeof schema>;
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
type DbExecutor = Database | Transaction;

async function prepareMetadata(db: Database) {
  console.log('Preparing metadata...');

  return db.transaction(async (tx) => {
    // Clean up any existing data for the fixed tenant
    await tx.delete(schema.tenants).where(eq(schema.tenants.id, TENANT_ID));

    const tenantId = TENANT_ID;

    await tx.insert(schema.tenants).values({
      id: tenantId,
      name: TENANT_NAME,
    });

    const [{ id: userEntityId }] = await tx
      .insert(schema.entityTypes)
      .values({
        tenantId,
        key: 'user',
        label: 'Users',
        description: 'Seeded end users, staff, and customer records.',
      })
      .returning({ id: schema.entityTypes.id });

    const [{ id: projectEntityId }] = await tx
      .insert(schema.entityTypes)
      .values({
        tenantId,
        key: 'project',
        label: 'Projects',
        description:
          'Seeded projects, campaigns, and business processes with milestones.',
      })
      .returning({ id: schema.entityTypes.id });

    const [{ id: resourceEntityId }] = await tx
      .insert(schema.entityTypes)
      .values({
        tenantId,
        key: 'resource',
        label: 'Resources',
        description: 'Seeded assets, tools, and secondary support records.',
      })
      .returning({ id: schema.entityTypes.id });

    const userFieldMap = await insertFieldDefs(tx, tenantId, userEntityId, [
      {
        key: 'first_name',
        label: 'First Name',
        kind: 'text',
        required: true,
        validate: { text: { minLen: 2, maxLen: 50 } },
      },
      {
        key: 'last_name',
        label: 'Last Name',
        kind: 'text',
        required: true,
        validate: { text: { minLen: 2, maxLen: 60 } },
      },
      {
        key: 'email',
        label: 'Email',
        kind: 'text',
        required: true,
        searchable: true,
        validate: { text: { minLen: 5, maxLen: 120 } },
      },
      {
        key: 'department',
        label: 'Department',
        kind: 'select',
        options: { enum: userDepartments, multiselect: false },
      },
      {
        key: 'experience_years',
        label: 'Experience (Years)',
        kind: 'number',
        validate: { number: { min: 0, max: 40 } },
      },
      {
        key: 'is_active',
        label: 'Is Active',
        kind: 'boolean',
        searchable: true,
      },
      {
        key: 'date_joined',
        label: 'Date Joined',
        kind: 'date',
      },
      {
        key: 'preferences',
        label: 'Preferences',
        kind: 'text',
        validate: { text: { maxLen: 200 } },
      },
      {
        key: 'notes',
        label: 'Notes',
        kind: 'text',
        searchable: false,
      },
    ]);

    const projectFieldMap = await insertFieldDefs(
      tx,
      tenantId,
      projectEntityId,
      [
        {
          key: 'name',
          label: 'Project Name',
          kind: 'text',
          required: true,
          validate: { text: { minLen: 5, maxLen: 120 } },
        },
        {
          key: 'description',
          label: 'Description',
          kind: 'text',
          validate: { text: { maxLen: 500 } },
        },
        {
          key: 'status',
          label: 'Status',
          kind: 'select',
          options: { enum: projectStatuses, multiselect: false },
          searchable: true,
        },
        {
          key: 'priority',
          label: 'Priority',
          kind: 'select',
          options: { enum: projectPriorities, multiselect: false },
        },
        {
          key: 'budget',
          label: 'Budget (USD)',
          kind: 'number',
          validate: { number: { min: 1000, max: 2_000_000 } },
        },
        {
          key: 'deadline',
          label: 'Deadline',
          kind: 'date',
        },
        {
          key: 'members',
          label: 'Project Members',
          kind: 'relation',
          options: {
            relation: {
              target_entity_type_id: userEntityId,
              cardinality: 'many',
            },
          },
          searchable: false,
        },
      ],
    );

    const resourceFieldMap = await insertFieldDefs(
      tx,
      tenantId,
      resourceEntityId,
      [
        {
          key: 'name',
          label: 'Resource Name',
          kind: 'text',
          required: true,
          validate: { text: { minLen: 3, maxLen: 120 } },
        },
        {
          key: 'category',
          label: 'Category',
          kind: 'select',
          options: { enum: resourceCategories, multiselect: false },
        },
        {
          key: 'status',
          label: 'Status',
          kind: 'select',
          options: { enum: resourceStatuses, multiselect: false },
        },
        {
          key: 'cost',
          label: 'Cost (USD)',
          kind: 'number',
          validate: { number: { min: 100, max: 500_000 } },
        },
        {
          key: 'available_from',
          label: 'Available From',
          kind: 'date',
        },
        {
          key: 'assigned_project',
          label: 'Assigned Project',
          kind: 'relation',
          options: {
            relation: {
              target_entity_type_id: projectEntityId,
              cardinality: 'one',
            },
          },
        },
      ],
    );

    return {
      tenantId,
      userEntityId,
      projectEntityId,
      resourceEntityId,
      userFieldMap,
      projectFieldMap,
      resourceFieldMap,
    };
  });
}

type InsertFieldInput = {
  key: string;
  label: string;
  kind: (typeof schema.fieldKindEnum.enumValues)[number];
  required?: boolean;
  searchable?: boolean;
  indexed?: boolean;
  options?: Record<string, unknown>;
  validate?: Record<string, unknown>;
};

async function insertFieldDefs(
  db: DbExecutor,
  tenantId: string,
  entityTypeId: string,
  inputs: InsertFieldInput[],
) {
  const recordsToInsert = inputs.map((input, index) => ({
    tenantId,
    entityTypeId,
    key: input.key,
    label: input.label,
    kind: input.kind,
    required: Boolean(input.required),
    uniqueWithinType: false,
    searchable: input.searchable ?? true,
    indexed: input.indexed ?? false,
    options: input.options ?? {},
    validate: input.validate ?? {},
    acl: defaultAcl,
    position: (index + 1) * 10,
    active: true,
  }));

  const rows = await db
    .insert(schema.fieldDefs)
    .values(recordsToInsert)
    .returning({ id: schema.fieldDefs.id, key: schema.fieldDefs.key });

  return rows.reduce<FieldMap>((accum, row) => {
    accum[row.key] = row.id;
    return accum;
  }, {});
}

async function seedUsers(
  db: Database,
  context: SeedContext,
) {
  console.log(
    `Seeding ${TOTAL_USERS.toLocaleString()} users in batches of ${BATCH_SIZE.toLocaleString()}...`,
  );
  const userIds: string[] = [];

  for (let offset = 0; offset < TOTAL_USERS; offset += BATCH_SIZE) {
    const slice = Math.min(BATCH_SIZE, TOTAL_USERS - offset);
    const recordsBatch: (typeof schema.records.$inferInsert)[] = [];

    for (let i = 0; i < slice; i += 1) {
      const firstName = faker.person.firstName();
      const lastName = faker.person.lastName();
      const email =
        faker.internet
          .email({
            firstName,
            lastName,
            allowSpecialCharacters: false,
          })
          .toLowerCase() +
        `.${faker.string.alphanumeric(6).toLowerCase()}`;

      const data = {
        first_name: firstName,
        last_name: lastName,
        email,
        department: faker.helpers.arrayElement(userDepartments),
        experience_years: faker.number.int({ min: 0, max: 40 }),
        is_active: faker.helpers.arrayElement([true, false]),
        date_joined: faker.date.past({ years: 10 }).toISOString(),
        preferences: faker.helpers.arrayElement(userPreferenceSnippets),
        notes: faker.lorem.sentences({ min: 1, max: 2 }),
      };

      recordsBatch.push({
        tenantId: context.tenantId,
        entityTypeId: context.userEntityId,
        data,
        createdBy: null,
        updatedBy: null,
      });
    }

    const inserted = await db
      .insert(schema.records)
      .values(recordsBatch)
      .returning({ id: schema.records.id });

    inserted.forEach((row) => userIds.push(row.id));
    logProgress('Users', userIds.length, TOTAL_USERS);
  }

  return userIds;
}

async function seedProjects(
  db: Database,
  context: SeedContext,
  userIds: string[],
) {
  const membersFieldId = context.projectFieldMap.members;
  if (!membersFieldId) {
    throw new Error('Project members field definition is missing.');
  }

  console.log(
    `Seeding ${TOTAL_PROJECTS.toLocaleString()} projects in batches of ${BATCH_SIZE.toLocaleString()}...`,
  );
  const projectIds: string[] = [];
  let pendingEdges: (typeof schema.edges.$inferInsert)[] = [];

  for (let offset = 0; offset < TOTAL_PROJECTS; offset += BATCH_SIZE) {
    const slice = Math.min(BATCH_SIZE, TOTAL_PROJECTS - offset);
    const batchValues: (typeof schema.records.$inferInsert)[] = [];
    const relationValues: string[][] = [];

    for (let i = 0; i < slice; i += 1) {
      const budget = faker.number.int({ min: 50_000, max: 2_000_000 });
      const dueDate = faker.date.future({ years: 3 }).toISOString();
      const members = selectRandomMembers(userIds, 2, 6);

      const data = {
        name: faker.company.catchPhrase(),
        description: faker.lorem.sentences({ min: 1, max: 3 }),
        status: faker.helpers.arrayElement(projectStatuses),
        priority: faker.helpers.arrayElement(projectPriorities),
        budget,
        deadline: dueDate,
        members,
      };

      batchValues.push({
        tenantId: context.tenantId,
        entityTypeId: context.projectEntityId,
        data,
        createdBy: faker.helpers.arrayElement(userIds),
        updatedBy: null,
      });
      relationValues.push(members);
    }

    const inserted = await db
      .insert(schema.records)
      .values(batchValues)
      .returning({ id: schema.records.id });

    inserted.forEach((row, index) => {
      const members = relationValues[index];
      projectIds.push(row.id);

      for (const memberId of members) {
        pendingEdges.push({
          tenantId: context.tenantId,
          fieldId: membersFieldId,
          fromRecordId: row.id,
          toRecordId: memberId,
          createdBy: null,
        });
      }
    });

    if (pendingEdges.length >= EDGE_BATCH_SIZE) {
      await flushEdges(db, pendingEdges);
      pendingEdges = [];
    }

    logProgress('Projects', projectIds.length, TOTAL_PROJECTS);
  }

  if (pendingEdges.length > 0) {
    await flushEdges(db, pendingEdges);
  }

  console.log(
    `Created ${(projectIds.length).toLocaleString()} projects and linked members.`,
  );
  return projectIds;
}

async function seedResources(
  db: Database,
  context: SeedContext,
  projectIds: string[],
  userIds: string[],
) {
  const assignmentFieldId = context.resourceFieldMap.assigned_project;
  if (!assignmentFieldId) {
    throw new Error('Resource assigned_project field definition is missing.');
  }

  console.log(
    `Seeding ${TOTAL_RESOURCES.toLocaleString()} resources in batches of ${BATCH_SIZE.toLocaleString()}...`,
  );

  let created = 0;
  let pendingEdges: (typeof schema.edges.$inferInsert)[] = [];

  for (let offset = 0; offset < TOTAL_RESOURCES; offset += BATCH_SIZE) {
    const slice = Math.min(BATCH_SIZE, TOTAL_RESOURCES - offset);
    const batchValues: (typeof schema.records.$inferInsert)[] = [];
    const relationTargets: string[] = [];

    for (let i = 0; i < slice; i += 1) {
      const projectId = faker.helpers.arrayElement(projectIds);

      const data = {
        name: `${faker.commerce.productName()} ${faker.color.human()}`,
        category: faker.helpers.arrayElement(resourceCategories),
        status: faker.helpers.arrayElement(resourceStatuses),
        cost: faker.number.int({ min: 500, max: 150_000 }),
        available_from: faker.date
          .between({
            from: faker.date.past({ years: 2 }),
            to: faker.date.future({ years: 2 }),
          })
          .toISOString(),
        assigned_project: projectId,
      };

      batchValues.push({
        tenantId: context.tenantId,
        entityTypeId: context.resourceEntityId,
        data,
        createdBy: faker.helpers.arrayElement(userIds),
        updatedBy: null,
      });
      relationTargets.push(projectId);
    }

    const inserted = await db
      .insert(schema.records)
      .values(batchValues)
      .returning({ id: schema.records.id });

    inserted.forEach((row, index) => {
      const assignedProject = relationTargets[index];
      pendingEdges.push({
        tenantId: context.tenantId,
        fieldId: assignmentFieldId,
        fromRecordId: row.id,
        toRecordId: assignedProject,
        createdBy: null,
      });
    });

    created += inserted.length;
    if (pendingEdges.length >= EDGE_BATCH_SIZE) {
      await flushEdges(db, pendingEdges);
      pendingEdges = [];
    }

    logProgress('Resources', created, TOTAL_RESOURCES);
  }

  if (pendingEdges.length > 0) {
    await flushEdges(db, pendingEdges);
  }

  console.log(
    `Created ${(created).toLocaleString()} resources and assignments.`,
  );
}

async function flushEdges(
  db: Database,
  buffer: (typeof schema.edges.$inferInsert)[],
) {
  if (buffer.length === 0) return;

  for (let offset = 0; offset < buffer.length; offset += EDGE_BATCH_SIZE) {
    const slice = buffer.slice(offset, offset + EDGE_BATCH_SIZE);
    await db.insert(schema.edges).values(slice);
  }
  buffer.length = 0;
}

function selectRandomMembers(
  source: string[],
  min: number,
  max: number,
): string[] {
  const target = faker.number.int({ min, max });
  const selected = new Set<string>();
  while (selected.size < target) {
    selected.add(faker.helpers.arrayElement(source));
  }
  return Array.from(selected);
}

function logProgress(label: string, current: number, total: number) {
  if (current === total || current % 10_000 === 0) {
    const percent = ((current / total) * 100).toFixed(1);
    console.log(`[${label}] ${current.toLocaleString()} / ${total.toLocaleString()} (${percent}%)`);
  }
}

main().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
