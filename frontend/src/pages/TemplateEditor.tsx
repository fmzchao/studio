import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { components } from '@shipsec/backend-client'
import { useTemplateStore } from '@/store/templateStore'
import { TemplateChat } from '@/components/ai/TemplateChat'
import {
  ArrowLeftIcon,
  SaveIcon,
  EyeIcon,
  SparklesIcon,
  RefreshCwIcon,
  FileJsonIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from 'lucide-react'

type Template = components['schemas']['TemplateResponseDto']

export function TemplateEditor() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { selectedTemplate, selectTemplate, updateTemplate, loading, error } = useTemplateStore()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [content, setContent] = useState('')
  const [inputSchema, setInputSchema] = useState('')
  const [sampleData, setSampleData] = useState('')
  const [saving, setSaving] = useState(false)
  const [previewScale, setPreviewScale] = useState(100)
  const [schemaExpanded, setSchemaExpanded] = useState(true)
  const [sampleDataExpanded, setSampleDataExpanded] = useState(false)

  // State for iframe content - using srcDoc for better React compatibility
  const [srcDoc, setSrcDoc] = useState('')

  const renderPreview = useCallback((templateCode: string, dataStr: string) => {
    let data = {}
    try {
      data = JSON.parse(dataStr)
    } catch (e) {
      // Ignore invalid JSON during streaming
      return
    }

    if (!templateCode.trim()) return;

    console.log('--- RENDER PREVIEW CALLED ---')
    console.log('Code length:', templateCode?.length)

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
              margin: 0; 
              padding: 20px;
              color: #333;
              line-height: 1.5;
            }
            .error { color: #ef4444; background: #fef2f2; padding: 12px; border: 1px solid #fee2e2; border-radius: 6px; font-size: 14px; }
          </style>
        </head>
        <body>
          <div id="root"></div>
          <script type="module">
            console.log('--- IFRAME SCRIPT START ---');
            import { h, render } from 'https://unpkg.com/preact?module';
            import htm from 'https://unpkg.com/htm?module';
            const html = htm.bind(h);

            try {
              const code = ${JSON.stringify(templateCode)};
              
              // Clean code: remove imports and exports
              const cleanCode = code
                .replace(/import\\s+.*?from\\s+['"].*?['"];?/g, '')
                .replace(/export\\s+default\\s+/g, '')
                .replace(/export\\s+/g, '');

              // Wrap: we need to find the Template function and return it
              const wrappedCode = \`
                \${cleanCode}
                if (typeof Template === 'undefined') {
                  throw new Error('Function "Template" not found in the generated code.');
                }
                return Template;
              \`;

              const TemplateComponent = (new Function('h', 'html', wrappedCode))(h, html);

              const data = ${JSON.stringify(data)};
              render(h(TemplateComponent, { data }), document.getElementById('root'));
            } catch (err) {
              document.getElementById('root').innerHTML = \`
                <div class="error">
                  <strong>Render Error:</strong><br/>
                  \${err.message}
                </div>
              \`;
              console.error('Preview Render Error:', err);
            }
          </script>
        </body>
      </html>
    `

    setSrcDoc(htmlContent)
  }, [])

  useEffect(() => {
    if (id) {
      selectTemplate(id)
    }
  }, [id, selectTemplate])

  useEffect(() => {
    if (selectedTemplate) {
      setName(selectedTemplate.name)
      setDescription(selectedTemplate.description || '')

      const rawContent = selectedTemplate.content
      let initialContent = ''

      if (typeof rawContent === 'string') {
        // Try to parse if it's a JSON string hiding an object
        try {
          const parsed = JSON.parse(rawContent)
          if (parsed && (parsed.template || parsed.html)) {
            initialContent = parsed.template || parsed.html
          } else {
            initialContent = rawContent
          }
        } catch (e) {
          initialContent = rawContent
        }
      } else {
        initialContent = (rawContent as any)?.template || (rawContent as any)?.html || JSON.stringify(rawContent, null, 2)
      }

      console.log('--- DEBUG TEMPLATE LOAD ---')
      console.log('Raw Content:', rawContent)
      console.log('Content Type:', typeof rawContent)
      console.log('Resolved Initial Content:', initialContent)
      console.log('---------------------------')

      setContent(initialContent)
      setInputSchema(JSON.stringify(selectedTemplate.inputSchema, null, 2))
      setSampleData(
        selectedTemplate.sampleData ? JSON.stringify(selectedTemplate.sampleData, null, 2) : '{}'
      )

      renderPreview(initialContent, selectedTemplate.sampleData ? JSON.stringify(selectedTemplate.sampleData) : '{}')
    }
  }, [selectedTemplate, renderPreview])

  // Debounced preview generation for live edits and AI streaming
  useEffect(() => {
    if (!selectedTemplate) return

    const timer = setTimeout(() => {
      renderPreview(content, sampleData)
    }, 500) // 500ms debounce for local rendering is plenty

    return () => clearTimeout(timer)
  }, [content, sampleData, selectedTemplate, renderPreview])

  const handleRefreshPreview = () => {
    renderPreview(content, sampleData)
  }

  const handleSave = async () => {
    if (!id || !selectedTemplate) return

    setSaving(true)
    try {
      let parsedSchema: Record<string, unknown> = {}
      let parsedSampleData: Record<string, unknown> = {}

      try {
        parsedSchema = JSON.parse(inputSchema)
      } catch (e) {
        console.error('Invalid JSON in schema')
      }

      try {
        parsedSampleData = JSON.parse(sampleData)
      } catch (e) {
        console.error('Invalid JSON in sample data')
      }

      await updateTemplate(id, {
        name,
        description,
        content: { template: content, type: 'preact-htm' },
        inputSchema: parsedSchema,
        sampleData: parsedSampleData,
      })
    } catch (error) {
      console.error('Failed to save template:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateTemplate = (update: {
    template: string;
    inputSchema: Record<string, unknown>;
    sampleData: Record<string, unknown>;
    description: string;
  }) => {
    if (update.template) {
      setContent(update.template)
    }

    if (update.inputSchema && Object.keys(update.inputSchema).length > 0) {
      setInputSchema(JSON.stringify(update.inputSchema, null, 2))
    }

    if (update.sampleData && Object.keys(update.sampleData).length > 0) {
      setSampleData(JSON.stringify(update.sampleData, null, 2))
    }

    if (update.description && !description) {
      setDescription(update.description)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-500 border-t-transparent"></div>
          <p className="text-gray-500 text-sm">Loading template...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md">
          <p className="text-red-600 text-center">{error}</p>
          <button
            onClick={() => navigate('/templates')}
            className="mt-4 w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Back to Templates
          </button>
        </div>
      </div>
    )
  }

  if (!selectedTemplate) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="text-center">
          <p className="text-gray-500">Template not found</p>
          <button
            onClick={() => navigate('/templates')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Templates
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-gray-50 text-gray-900 overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/templates')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors group"
          >
            <ArrowLeftIcon className="w-5 h-5 text-gray-500 group-hover:text-gray-700" />
          </button>
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-lg font-semibold text-gray-900 bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1 -ml-2"
              disabled={selectedTemplate.isSystem}
            />
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
              v{selectedTemplate.version}
            </span>
            {selectedTemplate.isSystem && (
              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
                System
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={saving || selectedTemplate.isSystem}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium text-sm shadow-sm"
          >
            <SaveIcon className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Schema (top) + Chat (bottom) */}
        <div className="w-[400px] flex flex-col border-r border-gray-200 bg-white">
          {/* Top Left: Schema Section */}
          <div className="flex-shrink-0 border-b border-gray-200 max-h-[45%] overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
              <div className="flex items-center gap-2">
                <FileJsonIcon className="w-4 h-4 text-blue-600" />
                <h3 className="font-medium text-gray-800 text-sm">Template Schema</h3>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {/* Input Schema */}
              <div className="rounded-lg border border-gray-200 overflow-hidden">
                <button
                  onClick={() => setSchemaExpanded(!schemaExpanded)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <span className="text-xs font-medium text-gray-700">Input Schema</span>
                  {schemaExpanded ? (
                    <ChevronDownIcon className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronRightIcon className="w-4 h-4 text-gray-400" />
                  )}
                </button>
                {schemaExpanded && (
                  <textarea
                    value={inputSchema}
                    onChange={(e) => setInputSchema(e.target.value)}
                    className="w-full p-3 bg-gray-50/50 text-gray-700 font-mono text-xs border-none focus:ring-0 resize-none"
                    rows={6}
                    disabled={selectedTemplate.isSystem}
                    spellCheck={false}
                  />
                )}
              </div>

              {/* Sample Data */}
              <div className="rounded-lg border border-gray-200 overflow-hidden">
                <button
                  onClick={() => setSampleDataExpanded(!sampleDataExpanded)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <span className="text-xs font-medium text-gray-700">Sample Data</span>
                  {sampleDataExpanded ? (
                    <ChevronDownIcon className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronRightIcon className="w-4 h-4 text-gray-400" />
                  )}
                </button>
                {sampleDataExpanded && (
                  <textarea
                    value={sampleData}
                    onChange={(e) => setSampleData(e.target.value)}
                    className="w-full p-3 bg-gray-50/50 text-gray-700 font-mono text-xs border-none focus:ring-0 resize-none"
                    rows={6}
                    disabled={selectedTemplate.isSystem}
                    spellCheck={false}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Bottom Left: AI Chat */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SparklesIcon className="w-4 h-4 text-purple-600" />
                <h3 className="font-medium text-gray-800 text-sm">AI Chat</h3>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <TemplateChat
                onUpdateTemplate={handleUpdateTemplate}
              />
            </div>
          </div>
        </div>

        {/* Right Panel - Preview */}
        <div className="flex-1 flex flex-col min-w-0 bg-gray-100">
          {/* Preview Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
            <div className="flex items-center gap-2">
              <EyeIcon className="w-4 h-4 text-green-600" />
              <h3 className="font-medium text-gray-800 text-sm">Live Preview</h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPreviewScale(Math.max(50, previewScale - 10))}
                className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                title="Zoom out"
              >
                <ZoomOutIcon className="w-4 h-4 text-gray-500" />
              </button>
              <span className="text-xs text-gray-500 min-w-[3rem] text-center">{previewScale}%</span>
              <button
                onClick={() => setPreviewScale(Math.min(150, previewScale + 10))}
                className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                title="Zoom in"
              >
                <ZoomInIcon className="w-4 h-4 text-gray-500" />
              </button>
              <div className="w-px h-4 bg-gray-200 mx-2"></div>
              <button
                onClick={handleRefreshPreview}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <RefreshCwIcon className="w-3.5 h-3.5" />
                Refresh
              </button>
            </div>
          </div>

          {/* Preview Content */}
          <div className="flex-1 overflow-auto p-6 bg-gray-100">
            <div
              className="mx-auto bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200"
              style={{
                width: '816px',
                height: '1056px',
                transform: `scale(${previewScale / 100})`,
                transformOrigin: 'top center',
              }}
            >
              <iframe
                srcDoc={srcDoc}
                className="w-full h-full border-none"
                title="Template Preview"
                sandbox="allow-scripts allow-same-origin"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
