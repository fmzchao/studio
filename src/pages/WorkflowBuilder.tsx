import { useParams } from 'react-router-dom'
import { ReactFlowProvider } from 'reactflow'
import { TopBar } from '@/components/layout/TopBar'
import { Sidebar } from '@/components/layout/Sidebar'
import { BottomPanel } from '@/components/layout/BottomPanel'
import { Canvas } from '@/components/workflow/Canvas'

export function WorkflowBuilder() {
  const { id } = useParams<{ id: string }>()
  const isNewWorkflow = id === 'new'

  return (
    <div className="h-screen flex flex-col bg-background">
      <TopBar workflowId={id} isNew={isNewWorkflow} />
      
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        
        <ReactFlowProvider>
          <main className="flex-1 relative">
            <Canvas className="absolute inset-0" />
          </main>
        </ReactFlowProvider>
      </div>
      
      <BottomPanel />
    </div>
  )
}