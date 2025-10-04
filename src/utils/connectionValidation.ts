import type { Node, Edge, Connection } from 'reactflow'

export interface ValidationResult {
  isValid: boolean
  error?: string
}

export function validateConnection(
  connection: Connection,
  nodes: Node[],
  edges: Edge[]
): ValidationResult {
  const { source, target } = connection

  if (!source || !target) {
    return { isValid: false, error: 'Invalid connection' }
  }

  if (source === target) {
    return { isValid: false, error: 'Cannot connect node to itself' }
  }

  // Check if connection already exists
  const existingConnection = edges.find(
    (edge) => edge.source === source && edge.target === target
  )
  if (existingConnection) {
    return { isValid: false, error: 'Connection already exists' }
  }

  // Get source and target nodes
  const sourceNode = nodes.find((node) => node.id === source)
  const targetNode = nodes.find((node) => node.id === target)

  if (!sourceNode || !targetNode) {
    return { isValid: false, error: 'Source or target node not found' }
  }

  // Check for workflow logic (basic validation)
  const sourceType = sourceNode.data.nodeType
  const targetType = targetNode.data.nodeType

  // Input nodes should generally come first
  if (targetType.includes('input') && !sourceType.includes('input')) {
    return { isValid: false, error: 'Input nodes should be at the beginning' }
  }

  // Output nodes should generally come last
  if (sourceType.includes('export') || sourceType.includes('alert') || sourceType.includes('report')) {
    return { isValid: false, error: 'Output nodes should be at the end' }
  }

  // Check for cycles (simple detection)
  if (wouldCreateCycle(connection, edges)) {
    return { isValid: false, error: 'Connection would create a cycle' }
  }

  return { isValid: true }
}

function wouldCreateCycle(newConnection: Connection, existingEdges: Edge[]): boolean {
  const { source, target } = newConnection
  
  // Simple cycle detection: check if there's already a path from target to source
  const visited = new Set<string>()
  
  function hasPath(from: string, to: string): boolean {
    if (from === to) return true
    if (visited.has(from)) return false
    
    visited.add(from)
    
    const outgoingEdges = existingEdges.filter(edge => edge.source === from)
    return outgoingEdges.some(edge => hasPath(edge.target, to))
  }
  
  return hasPath(target!, source!)
}

export function getNodeCategory(nodeType: string): 'input' | 'scan' | 'process' | 'output' {
  if (nodeType.includes('input') || nodeType.includes('upload')) return 'input'
  if (nodeType.includes('scanner') || nodeType.includes('scan')) return 'scan'
  if (nodeType.includes('filter') || nodeType.includes('transform') || nodeType.includes('merge')) return 'process'
  if (nodeType.includes('export') || nodeType.includes('alert') || nodeType.includes('report')) return 'output'
  return 'process' // default
}