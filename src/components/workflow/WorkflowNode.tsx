import { memo } from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'
import { 
  Target, 
  FileText, 
  Scan, 
  Cog, 
  Filter, 
  GitMerge, 
  FileUp, 
  Bell, 
  FileBarChart,
  Loader2,
  CheckCircle,
  XCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface WorkflowNodeData {
  label: string
  nodeType: string
  status?: 'idle' | 'running' | 'success' | 'error' | 'waiting'
  executionTime?: number
  error?: string
}

const nodeIcons = {
  'target-input': Target,
  'file-upload': FileText,
  'subdomain-scanner': Scan,
  'port-scanner': Scan,
  'vuln-scanner': Scan,
  'filter': Filter,
  'transform': Cog,
  'merge': GitMerge,
  'export': FileUp,
  'alert': Bell,
  'report': FileBarChart,
} as const

const getNodeColor = (nodeType: string) => {
  if (nodeType.includes('input') || nodeType.includes('upload')) return 'border-blue-500'
  if (nodeType.includes('scanner') || nodeType.includes('scan')) return 'border-orange-500'
  if (nodeType.includes('filter') || nodeType.includes('transform') || nodeType.includes('merge')) return 'border-purple-500'
  if (nodeType.includes('export') || nodeType.includes('alert') || nodeType.includes('report')) return 'border-green-500'
  return 'border-gray-500'
}

const getStatusIcon = (status: WorkflowNodeData['status']) => {
  switch (status) {
    case 'running':
      return <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />
    case 'success':
      return <CheckCircle className="h-4 w-4 text-green-500" />
    case 'error':
      return <XCircle className="h-4 w-4 text-red-500" />
    case 'waiting':
      return <div className="h-4 w-4 rounded-full bg-gray-400 animate-pulse" />
    default:
      return null
  }
}

const getNodeBackground = (status: WorkflowNodeData['status']) => {
  switch (status) {
    case 'running':
      return 'bg-yellow-50 border-yellow-300'
    case 'success':
      return 'bg-green-50 border-green-300'
    case 'error':
      return 'bg-red-50 border-red-300'
    case 'waiting':
      return 'bg-gray-50 border-gray-300 opacity-75'
    default:
      return 'bg-background'
  }
}

export const WorkflowNode = memo(({ data, selected }: NodeProps<WorkflowNodeData>) => {
  const IconComponent = nodeIcons[data.nodeType as keyof typeof nodeIcons] || Cog
  const nodeColor = getNodeColor(data.nodeType)
  const statusIcon = getStatusIcon(data.status)
  const nodeBackground = getNodeBackground(data.status)

  return (
    <div
      className={cn(
        'px-4 py-3 shadow-md rounded-lg border-2 bg-background min-w-[160px]',
        nodeColor,
        nodeBackground,
        selected && 'ring-2 ring-blue-500 ring-offset-2'
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 !bg-gray-400 border-2 border-white"
      />
      
      <div className="flex items-start gap-2">
        <IconComponent className="h-5 w-5 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium truncate">{data.label}</h3>
            {statusIcon && (
              <div className="ml-2 flex-shrink-0">
                {statusIcon}
              </div>
            )}
          </div>
          
          {data.status === 'success' && data.executionTime && (
            <p className="text-xs text-green-600 mt-1">
              Completed in {data.executionTime}ms
            </p>
          )}
          
          {data.status === 'error' && data.error && (
            <p className="text-xs text-red-600 mt-1 truncate" title={data.error}>
              {data.error}
            </p>
          )}
          
          <Badge 
            variant="secondary" 
            className="mt-2 text-xs"
          >
            {data.nodeType.replace('-', ' ')}
          </Badge>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 !bg-gray-400 border-2 border-white"
      />
    </div>
  )
})