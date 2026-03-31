import { query } from "../lib/db.js";

async function debug() {
  try {
    console.log("Checking database connection...");
    const schemas = await query("SELECT schema_name FROM information_schema.schemata");
    console.log("Schemas in database:", schemas.map(s => s.schema_name));

    const tables = await query("SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema NOT IN ('information_schema', 'pg_catalog')");
    console.log("Tables in all schemas:", tables);

    const projectsCount = await query("SELECT count(*) FROM gc_projects");
    console.log("Total projects in gc_projects:", projectsCount[0].count);

    const statusCount = await query("SELECT status, count(*) FROM gc_projects GROUP BY status");
    console.log("Status distribution:", statusCount);

    const areasCount = await query("SELECT count(*) FROM gc_area_profiles");
    console.log("Total area profiles:", areasCount[0].count);

    const developersCount = await query("SELECT count(*) FROM gc_developer_profiles");
    console.log("Total developer profiles:", developersCount[0].count);

  } catch (error) {
    console.error("Database debug error:", error);
  }
}

debug();
