import { createHash } from "node:crypto";
import type {
  NormalizedPlanProposal,
  PlanProposalMetadata,
  PlanProposalNodeInput,
  PlanProposalPhaseInput,
  PlanProposalPrerequisiteEdgeInput
} from "../types/planProposal";
import { AppError } from "../utils/errors";

const MAX_NODES = 200;
const MAX_PHASES = 50;
const MAX_PREREQUISITE_EDGES = 1000;
const MAX_PHASE_NODE_REFERENCES = 1000;

const REQUEST_KEYS = new Set([
  "proposalId",
  "metadata",
  "nodes",
  "prerequisiteEdges",
  "phases"
]);
const METADATA_KEYS = new Set(["provider", "model", "generatedAt"]);
const NODE_KEYS = new Set(["key", "title", "description", "parentKey"]);
const EDGE_KEYS = new Set(["prerequisiteKey", "nodeKey"]);
const PHASE_KEYS = new Set([
  "title",
  "goal",
  "description",
  "completionCriteria",
  "nodeKeys"
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function ensureOnlyKeys(
  value: Record<string, unknown>,
  allowedKeys: Set<string>,
  label: string
): void {
  const invalidKeys = Object.keys(value).filter((key) => !allowedKeys.has(key));

  if (invalidKeys.length > 0) {
    throw new AppError(
      "INVALID_REQUEST",
      `${label} contains unsupported fields: ${invalidKeys.join(", ")}.`,
      400
    );
  }
}

function requiredString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new AppError(
      "INVALID_REQUEST",
      `${fieldName} is required and must be a non-empty string.`,
      400
    );
  }

  return value.trim();
}

function optionalString(value: unknown, fieldName: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new AppError("INVALID_REQUEST", `${fieldName} must be a string.`, 400);
  }

  return value.trim() || undefined;
}

function normalizeMetadata(value: unknown): PlanProposalMetadata | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!isRecord(value)) {
    throw new AppError("INVALID_REQUEST", "metadata must be an object.", 400);
  }

  ensureOnlyKeys(value, METADATA_KEYS, "metadata");
  const metadata = {
    provider: optionalString(value.provider, "metadata.provider"),
    model: optionalString(value.model, "metadata.model"),
    generatedAt: optionalString(value.generatedAt, "metadata.generatedAt")
  };

  return Object.values(metadata).some((item) => item !== undefined) ? metadata : undefined;
}

function normalizeNodes(value: unknown): PlanProposalNodeInput[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new AppError("INVALID_REQUEST", "nodes must be a non-empty array.", 400);
  }

  if (value.length > MAX_NODES) {
    throw new AppError("INVALID_REQUEST", `nodes cannot exceed ${MAX_NODES} items.`, 400);
  }

  const nodes = value.map((item, index) => {
    if (!isRecord(item)) {
      throw new AppError("INVALID_REQUEST", `nodes[${index}] must be an object.`, 400);
    }

    ensureOnlyKeys(item, NODE_KEYS, `nodes[${index}]`);
    return {
      key: requiredString(item.key, `nodes[${index}].key`),
      title: requiredString(item.title, `nodes[${index}].title`),
      description: optionalString(item.description, `nodes[${index}].description`),
      parentKey: optionalString(item.parentKey, `nodes[${index}].parentKey`)
    };
  });

  if (new Set(nodes.map((node) => node.key)).size !== nodes.length) {
    throw new AppError("INVALID_REQUEST", "Node keys must be unique.", 400);
  }

  return nodes;
}

function normalizeEdges(value: unknown): PlanProposalPrerequisiteEdgeInput[] {
  if (!Array.isArray(value)) {
    throw new AppError("INVALID_REQUEST", "prerequisiteEdges must be an array.", 400);
  }

  if (value.length > MAX_PREREQUISITE_EDGES) {
    throw new AppError(
      "INVALID_REQUEST",
      `prerequisiteEdges cannot exceed ${MAX_PREREQUISITE_EDGES} items.`,
      400
    );
  }

  const edges = value.map((item, index) => {
    if (!isRecord(item)) {
      throw new AppError(
        "INVALID_REQUEST",
        `prerequisiteEdges[${index}] must be an object.`,
        400
      );
    }

    ensureOnlyKeys(item, EDGE_KEYS, `prerequisiteEdges[${index}]`);
    return {
      prerequisiteKey: requiredString(
        item.prerequisiteKey,
        `prerequisiteEdges[${index}].prerequisiteKey`
      ),
      nodeKey: requiredString(item.nodeKey, `prerequisiteEdges[${index}].nodeKey`)
    };
  });

  const edgeKeys = edges.map((edge) => `${edge.prerequisiteKey}\u0000${edge.nodeKey}`);
  if (new Set(edgeKeys).size !== edgeKeys.length) {
    throw new AppError("INVALID_REQUEST", "prerequisiteEdges cannot contain duplicates.", 400);
  }

  return edges;
}

function normalizePhases(value: unknown): PlanProposalPhaseInput[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new AppError("INVALID_REQUEST", "phases must be a non-empty array.", 400);
  }

  if (value.length > MAX_PHASES) {
    throw new AppError("INVALID_REQUEST", `phases cannot exceed ${MAX_PHASES} items.`, 400);
  }

  const phases = value.map((item, index) => {
    if (!isRecord(item)) {
      throw new AppError("INVALID_REQUEST", `phases[${index}] must be an object.`, 400);
    }

    ensureOnlyKeys(item, PHASE_KEYS, `phases[${index}]`);
    if (!Array.isArray(item.nodeKeys) || item.nodeKeys.length === 0) {
      throw new AppError(
        "INVALID_REQUEST",
        `phases[${index}].nodeKeys must be a non-empty array.`,
        400
      );
    }

    const nodeKeys = item.nodeKeys.map((nodeKey, nodeIndex) =>
      requiredString(nodeKey, `phases[${index}].nodeKeys[${nodeIndex}]`)
    );
    if (new Set(nodeKeys).size !== nodeKeys.length) {
      throw new AppError(
        "INVALID_REQUEST",
        `phases[${index}].nodeKeys cannot contain duplicates.`,
        400
      );
    }

    return {
      title: requiredString(item.title, `phases[${index}].title`),
      goal: requiredString(item.goal, `phases[${index}].goal`),
      description: optionalString(item.description, `phases[${index}].description`),
      completionCriteria: optionalString(
        item.completionCriteria,
        `phases[${index}].completionCriteria`
      ),
      nodeKeys
    };
  });

  const referenceCount = phases.reduce((total, phase) => total + phase.nodeKeys.length, 0);
  if (referenceCount > MAX_PHASE_NODE_REFERENCES) {
    throw new AppError(
      "INVALID_REQUEST",
      `Phase node references cannot exceed ${MAX_PHASE_NODE_REFERENCES}.`,
      400
    );
  }

  return phases;
}

function ensureAcyclic(
  nodeKeys: string[],
  edges: Array<{ source: string; target: string }>,
  errorMessage: string
): void {
  const adjacency = new Map(nodeKeys.map((key) => [key, [] as string[]]));
  for (const edge of edges) {
    adjacency.get(edge.source)?.push(edge.target);
  }

  const states = new Map<string, "visiting" | "visited">();
  const visit = (key: string): void => {
    if (states.get(key) === "visiting") {
      throw new AppError("INVALID_REQUEST", errorMessage, 409);
    }
    if (states.get(key) === "visited") {
      return;
    }

    states.set(key, "visiting");
    for (const target of adjacency.get(key) ?? []) {
      visit(target);
    }
    states.set(key, "visited");
  };

  for (const key of nodeKeys) {
    visit(key);
  }
}

function validateReferences(proposal: NormalizedPlanProposal): void {
  const nodeKeys = proposal.nodes.map((node) => node.key);
  const knownKeys = new Set(nodeKeys);

  for (const node of proposal.nodes) {
    if (node.parentKey && !knownKeys.has(node.parentKey)) {
      throw new AppError(
        "INVALID_REQUEST",
        `Node ${node.key} references unknown parentKey ${node.parentKey}.`,
        400
      );
    }
    if (node.parentKey === node.key) {
      throw new AppError("INVALID_REQUEST", `Node ${node.key} cannot be its own parent.`, 400);
    }
  }

  for (const edge of proposal.prerequisiteEdges) {
    if (!knownKeys.has(edge.prerequisiteKey) || !knownKeys.has(edge.nodeKey)) {
      throw new AppError(
        "INVALID_REQUEST",
        "prerequisiteEdges must reference nodes declared in this proposal.",
        400
      );
    }
    if (edge.prerequisiteKey === edge.nodeKey) {
      throw new AppError("INVALID_REQUEST", "A node cannot depend on itself.", 400);
    }
  }

  const coveredKeys = new Set<string>();
  const firstPhaseByNode = new Map<string, number>();
  proposal.phases.forEach((phase, phaseIndex) => {
    phase.nodeKeys.forEach((key) => {
      if (!knownKeys.has(key)) {
        throw new AppError(
          "INVALID_REQUEST",
          `Phase ${phase.title} references unknown node key ${key}.`,
          400
        );
      }
      coveredKeys.add(key);
      if (!firstPhaseByNode.has(key)) {
        firstPhaseByNode.set(key, phaseIndex);
      }
    });
  });

  const uncoveredKeys = nodeKeys.filter((key) => !coveredKeys.has(key));
  if (uncoveredKeys.length > 0) {
    throw new AppError(
      "INVALID_REQUEST",
      `Every node must appear in at least one phase. Missing: ${uncoveredKeys.join(", ")}.`,
      400
    );
  }

  ensureAcyclic(
    nodeKeys,
    proposal.nodes
      .filter((node) => node.parentKey)
      .map((node) => ({ source: node.parentKey as string, target: node.key })),
    "The proposal parent hierarchy contains a cycle."
  );
  ensureAcyclic(
    nodeKeys,
    proposal.prerequisiteEdges.map((edge) => ({
      source: edge.prerequisiteKey,
      target: edge.nodeKey
    })),
    "The proposal prerequisite graph contains a cycle."
  );

  for (const edge of proposal.prerequisiteEdges) {
    const prerequisitePhase = firstPhaseByNode.get(edge.prerequisiteKey) as number;
    const dependentPhase = firstPhaseByNode.get(edge.nodeKey) as number;
    if (prerequisitePhase > dependentPhase) {
      throw new AppError(
        "INVALID_REQUEST",
        `Prerequisite ${edge.prerequisiteKey} cannot first appear after ${edge.nodeKey}.`,
        409
      );
    }
  }
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .filter((key) => value[key] !== undefined)
      .map((key) => [key, canonicalize(value[key])])
  );
}

export function stableJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function hashPlanProposal(proposal: NormalizedPlanProposal): string {
  const { proposalId: _proposalId, ...content } = proposal;
  return createHash("sha256").update(stableJson(content)).digest("hex");
}

export function normalizePlanProposal(input: unknown): NormalizedPlanProposal {
  if (!isRecord(input)) {
    throw new AppError("INVALID_REQUEST", "Request body must be an object.", 400);
  }

  ensureOnlyKeys(input, REQUEST_KEYS, "Request body");
  const proposal: NormalizedPlanProposal = {
    proposalId: requiredString(input.proposalId, "proposalId"),
    metadata: normalizeMetadata(input.metadata),
    nodes: normalizeNodes(input.nodes),
    prerequisiteEdges: normalizeEdges(input.prerequisiteEdges),
    phases: normalizePhases(input.phases)
  };

  validateReferences(proposal);
  return proposal;
}
