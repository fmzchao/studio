import { useCallback, useState, useEffect } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type OnConnect,
} from 'reactflow'
import 'reactflow/dist/style.css'

import { WorkflowNode } from './WorkflowNode'
import { validateConnection } from '@/utils/connectionValidation'

const nodeTypes = {
  workflow: WorkflowNode,
}

const initialNodes: Node[] = []
const initialEdges: Edge[] = []

interface CanvasProps {
  className?: string
}

export function Canvas({ className }: CanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null)

  const onConnect: OnConnect = useCallback(
    (params) => {
      const validation = validateConnection(params, nodes, edges)
      
      if (!validation.isValid) {
        console.warn('Invalid connection:', validation.error)
        // TODO: Show toast notification
        return
      }
      
      setEdges((eds) => addEdge({
        ...params,
        type: 'smoothstep',
        animated: false,
      }, eds))
    },
    [setEdges, nodes, edges]
  )

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()

      const type = event.dataTransfer.getData('application/reactflow')

      if (typeof type === 'undefined' || !type) {
        return
      }

      const position = reactFlowInstance?.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })

      if (!position) return

      const newNode: Node = {
        id: `${type}-${Date.now()}`,
        type: 'workflow',
        position,
        data: {
          label: type.replace('-', ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
          nodeType: type,
          status: 'idle',
        },
      }

      setNodes((nds) => nds.concat(newNode))
    },
    [reactFlowInstance, setNodes]
  )


  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'Delete' || event.key === 'Backspace') {
        const selectedNodes = nodes.filter((node) => node.selected)
        const selectedEdges = edges.filter((edge) => edge.selected)
        
        if (selectedNodes.length > 0) {
          const nodeIds = selectedNodes.map((node) => node.id)
          setNodes((nds) => nds.filter((node) => !nodeIds.includes(node.id)))
          setEdges((eds) => eds.filter((edge) => 
            !nodeIds.includes(edge.source) && !nodeIds.includes(edge.target)
          ))
        }
        
        if (selectedEdges.length > 0) {
          const edgeIds = selectedEdges.map((edge) => edge.id)
          setEdges((eds) => eds.filter((edge) => !edgeIds.includes(edge.id)))
        }
      }
    }

    document.addEventListener('keydown', handleKeyPress)
    return () => document.removeEventListener('keydown', handleKeyPress)
  }, [nodes, edges, setNodes, setEdges])

  return (
    <div className={className}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={setReactFlowInstance}
        onDrop={onDrop}
        onDragOver={onDragOver}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-left"
      >
        <Background color="#aaa" gap={16} />
        <Controls position="bottom-left" />
        <MiniMap
          position="bottom-right"
          nodeColor={(node) => {
            switch (node.data?.status) {
              case 'running':
                return '#f59e0b'
              case 'success':
                return '#10b981'
              case 'error':
                return '#ef4444'
              default:
                return '#6b7280'
            }
          }}
        />
      </ReactFlow>
    </div>
  )
}