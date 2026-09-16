export type ColumnDef = {
  name: string;
  dataType: string;
  nullable: boolean;
};

export type ForeignKeyDef = {
  constraintName: string;
  columns: string[];
  refTable: string;
  refColumns: string[];
};

export type TableDef = {
  name: string;
  objectType: "TABLE" | "VIEW";
  columns: ColumnDef[];
  primaryKey: string[];
  foreignKeys: ForeignKeyDef[];
  rowEstimate: number | null;
};

export type CheckConstraintDef = {
  tableName: string;
  constraintName: string;
  searchCondition: string;
};

export type ProcedureSourceDef = {
  name: string;
  type: "PROCEDURE" | "FUNCTION" | "PACKAGE" | "PACKAGE BODY";
  text: string;
};

export type NormalizedSchema = {
  tables: TableDef[];
  checkConstraints: CheckConstraintDef[];
};

export type RelationshipEdge = {
  fromTable: string;
  fromColumns: string[];
  toTable: string;
  toColumns: string[];
  constraintName: string;
};

/** The relationship graph is derived from foreign keys, not stored separately. */
export function deriveRelationships(schema: Pick<NormalizedSchema, "tables">): RelationshipEdge[] {
  const edges: RelationshipEdge[] = [];
  for (const t of schema.tables) {
    for (const fk of t.foreignKeys) {
      edges.push({
        fromTable: t.name,
        fromColumns: fk.columns,
        toTable: fk.refTable,
        toColumns: fk.refColumns,
        constraintName: fk.constraintName,
      });
    }
  }
  return edges;
}
