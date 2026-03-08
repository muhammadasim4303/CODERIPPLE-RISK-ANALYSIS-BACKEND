/**
 * Utilities for deriving modules and dependency graph data from commit file changes.
 */

/** Extract a "module" name from a file path (e.g. src/components/Login.tsx → "components") */
export function getModuleFromPath(filepath: string): string {
  const parts = filepath.split('/');
  // If the path has at least 2 segments, use the second-to-last directory
  if (parts.length >= 3) {
    return parts[parts.length - 2];
  }
  if (parts.length === 2) {
    return parts[0];
  }
  return 'root';
}

/** Get top-level directory as a broader module category */
export function getTopModule(filepath: string): string {
  const parts = filepath.split('/');
  if (parts.length >= 2) {
    return parts[0] === 'src' && parts.length >= 3 ? parts[1] : parts[0];
  }
  return 'root';
}

export interface GraphNode {
  id: string;
  label: string;
  type: 'source' | 'impacted' | 'unaffected';
  risk_score?: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  relationship: string;
}

export interface CommitFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
}

/**
 * Build a dependency graph from a list of changed files.
 * Groups files into modules, then creates edges between files in the same module.
 */
export function buildGraphFromFiles(files: CommitFile[]): {
  nodes: GraphNode[];
  edges: GraphEdge[];
} {
  if (!files || files.length === 0) {
    return { nodes: [], edges: [] };
  }

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const moduleMap = new Map<string, string[]>(); // module → file ids

  files.forEach((file, index) => {
    const id = String(index);
    const label = file.filename.split('/').pop() || file.filename;
    const module = getTopModule(file.filename);

    // Files with high churn are "source" (most changes), others are "impacted"
    const totalChanges = file.additions + file.deletions;
    const isSource = file.status === 'added' || file.status === 'modified';
    const riskScore = Math.min(totalChanges / 200, 1); // normalize

    nodes.push({
      id,
      label,
      type: isSource && totalChanges > 20 ? 'source' : 'impacted',
      risk_score: riskScore,
    });

    if (!moduleMap.has(module)) {
      moduleMap.set(module, []);
    }
    moduleMap.get(module)!.push(id);
  });

  // Create edges: files in the same module are connected
  let edgeIndex = 0;
  moduleMap.forEach((fileIds, module) => {
    for (let i = 0; i < fileIds.length - 1; i++) {
      edges.push({
        source: fileIds[i],
        target: fileIds[i + 1],
        relationship: module,
      });
      edgeIndex++;
    }
  });

  // Also connect across modules sequentially for visual flow
  const modules = Array.from(moduleMap.values());
  for (let i = 0; i < modules.length - 1; i++) {
    const lastInCurrent = modules[i][modules[i].length - 1];
    const firstInNext = modules[i + 1][0];
    edges.push({
      source: lastInCurrent,
      target: firstInNext,
      relationship: 'cross-module',
    });
  }

  return { nodes, edges };
}

/** Extract unique modules from a list of files */
export function extractModules(files: CommitFile[]): string[] {
  if (!files) return [];
  const modules = new Set<string>();
  files.forEach((f) => modules.add(getTopModule(f.filename)));
  return Array.from(modules);
}
