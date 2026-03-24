// Types for CodeRipple change impact analysis results

export interface CRChangedFunction {
  function: string;
  file: string;
  semantic_change_score: number;
  similarity: number;
  change_type: 'FORMAT_CHANGE' | 'REFACTOR' | 'LOGIC_CHANGE';
  added_lines: number;
  removed_lines: number;
}

export interface CRGraphNode {
  id: string;
  label: string;
  file: string;
  kind: 'function' | 'file' | 'unknown';
  category: 'changed' | 'direct' | 'indirect';
  distance: number;
}

export interface CRGraphEdge {
  source: string;
  target: string;
  type: 'calls' | 'contains' | 'imports';
}

export interface CRDependencyGraph {
  nodes: CRGraphNode[];
  edges: CRGraphEdge[];
}

export interface CodeRippleResult {
  commit: string;
  repository: string;
  analyzed_at: string;
  changed_function: string | null;
  changed_functions: CRChangedFunction[];
  semantic_change_score: number;
  similarity: number;
  change_type: 'FORMAT_CHANGE' | 'REFACTOR' | 'LOGIC_CHANGE';
  model_used: string;
  direct_impact: string[];
  indirect_impact: string[];
  impacted_files: string[];
  ripple_depth: number;
  ripple_size: number;
  risk_prediction: 'LOW' | 'MEDIUM' | 'HIGH';
  risk_score: number;
  risk_confidence: number;
  contributing_factors: string[];
  feature_breakdown: Record<string, number>;
  files_changed: number;
  functions_changed: number;
  total_lines_changed: number;
  dependency_graph: CRDependencyGraph;
}
