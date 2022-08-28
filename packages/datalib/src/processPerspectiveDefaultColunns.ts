import { findForeignKeyForColumn } from 'dbgate-tools';
import { DatabaseInfo, TableInfo, ViewInfo } from 'dbgate-types';
import { createPerspectiveNodeConfig, MultipleDatabaseInfo, PerspectiveConfig } from './PerspectiveConfig';
import { PerspectiveTableNode } from './PerspectiveTreeNode';

function getPerspectiveDefaultColumns(
  table: TableInfo | ViewInfo,
  db: DatabaseInfo,
  circularColumns: string[]
): [string[], string[]] {
  const columns = table.columns.map(x => x.columnName);
  const predicates = [
    x => x.toLowerCase() == 'name',
    x => x.toLowerCase() == 'title',
    x => x.toLowerCase().includes('name'),
    x => x.toLowerCase().includes('title'),
    x => x.toLowerCase().includes('subject'),
    // x => x.toLowerCase().includes('text'),
    // x => x.toLowerCase().includes('desc'),
    x =>
      table.columns
        .find(y => y.columnName == x)
        ?.dataType?.toLowerCase()
        ?.includes('char'),
  ];

  for (const predicate of predicates) {
    const col = columns.find(predicate);
    if (col) return [[col], null];
  }

  const keyPredicates = [
    x => findForeignKeyForColumn(table as TableInfo, x)?.columns?.length == 1 && !circularColumns.includes(x),
    x => findForeignKeyForColumn(table as TableInfo, x)?.columns?.length == 1,
  ];

  for (const predicate of keyPredicates) {
    const col = columns.find(predicate);
    if (col) return [null, [col]];
  }

  return [[columns[0]], null];
}

export function shouldProcessPerspectiveDefaultColunns(
  config: PerspectiveConfig,
  dbInfos: MultipleDatabaseInfo,
  conid: string,
  database: string
) {
  const nodesNotProcessed = config.nodes.filter(x => !x.defaultColumnsProcessed);
  if (nodesNotProcessed.length == 0) return false;

  for (const node of nodesNotProcessed) {
    const db = dbInfos?.[node.conid || conid]?.[node.database || database];
    if (!db) return false;

    const table = db.tables.find(x => x.pureName == node.pureName && x.schemaName == node.schemaName);
    const view = db.views.find(x => x.pureName == node.pureName && x.schemaName == node.schemaName);

    if (!table && !view) return false;
  }

  return true;
}

function processPerspectiveDefaultColunnsStep(
  config: PerspectiveConfig,
  dbInfos: MultipleDatabaseInfo,
  conid: string,
  database: string
) {
  const rootNode = config.nodes.find(x => x.designerId == config.rootDesignerId);
  if (!rootNode) return null;
  const rootDb = dbInfos?.[rootNode.conid || conid]?.[rootNode.database || database];
  if (!rootDb) return null;
  const rootTable = rootDb.tables.find(x => x.pureName == rootNode.pureName && x.schemaName == rootNode.schemaName);
  const rootView = rootDb.views.find(x => x.pureName == rootNode.pureName && x.schemaName == rootNode.schemaName);

  const root = new PerspectiveTableNode(
    rootTable || rootView,
    dbInfos,
    config,
    null,
    null,
    { conid, database },
    null,
    config.rootDesignerId
  );

  for (const node of config.nodes) {
    if (node.defaultColumnsProcessed) continue;

    const db = dbInfos?.[node.conid || conid]?.[node.database || database];
    if (!db) continue;

    const table = db.tables.find(x => x.pureName == node.pureName && x.schemaName == node.schemaName);
    const view = db.views.find(x => x.pureName == node.pureName && x.schemaName == node.schemaName);

    if (table || view) {
      const treeNode = root.findNodeByDesignerId(node.designerId);
      if (!treeNode) continue;
      const circularColumns = treeNode.childNodes.filter(x => x.isCircular).map(x => x.columnName);
      const [defaultColumns, defaultRefs] = getPerspectiveDefaultColumns(table || view, db, circularColumns);

      if (defaultRefs) {
        const childNode = treeNode.childNodes.find(x => x.columnName == defaultRefs[0]);
        if (childNode?.designerId) {
          return {
            ...config,
            nodes: config.nodes.map(n =>
              n.designerId == childNode.designerId
                ? {
                    ...n,
                    isNodeChecked: true,
                  }
                : n.designerId == node.designerId
                ? {
                    ...n,
                    defaultColumnsProcessed: true,
                  }
                : n
            ),
          };
        } else if (childNode) {
          const [newConfig, nodeConfig] = childNode.ensureNodeConfig(config);
          nodeConfig.isNodeChecked = true;

          return {
            ...newConfig,
            nodes: newConfig.nodes.map(n =>
              n.designerId == node.designerId
                ? {
                    ...n,
                    defaultColumnsProcessed: true,
                  }
                : n
            ),
          };
        }
      } else {
        return {
          ...config,
          nodes: config.nodes.map(n =>
            n.designerId == node.designerId
              ? {
                  ...n,
                  defaultColumnsProcessed: true,
                  checkedColumns: defaultColumns,
                }
              : n
          ),
        };
      }
    }
  }

  return null;
}

function markAllProcessed(config: PerspectiveConfig): PerspectiveConfig {
  return {
    ...config,
    nodes: config.nodes.map(x => ({
      ...x,
      defaultColumnsProcessed: true,
    })),
  };
}

export function processPerspectiveDefaultColunns(
  config: PerspectiveConfig,
  dbInfos: MultipleDatabaseInfo,
  conid: string,
  database: string
) {
  while (config.nodes.filter(x => !x.defaultColumnsProcessed).length > 0) {
    const newConfig = processPerspectiveDefaultColunnsStep(config, dbInfos, conid, database);
    if (!newConfig) {
      return markAllProcessed(config);
    }
    if (
      newConfig.nodes.filter(x => x.defaultColumnsProcessed).length <=
      config.nodes.filter(x => x.defaultColumnsProcessed).length
    ) {
      return markAllProcessed(config);
    }
    config = newConfig;
  }
  return markAllProcessed(config);
}