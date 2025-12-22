import { Plus, Trash2, GripVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core'
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

export interface SimpleVariable {
    name: string
    type: string
}

interface SimpleVariableListEditorProps {
    value: SimpleVariable[]
    onChange: (value: SimpleVariable[]) => void
    title: string
    type: 'input' | 'output'
}

interface SortableItemProps {
    variable: SimpleVariable
    index: number
    updateVariable: (index: number, field: keyof SimpleVariable, value: any) => void
    removeVariable: (index: number) => void
    type: 'input' | 'output'
    id: string
}

function SortableItem({ variable, index, updateVariable, removeVariable, type, id }: SortableItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : 1,
        opacity: isDragging ? 0.8 : 1,
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`p-3 border rounded-lg bg-background space-y-3 ${isDragging ? 'shadow-lg ring-2 ring-primary/20' : ''}`}
        >
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    className="touch-none cursor-move text-muted-foreground hover:text-foreground outline-none"
                    {...attributes}
                    {...listeners}
                >
                    <GripVertical className="h-4 w-4" />
                </button>
                <span className="text-sm font-medium flex-1">
                    Variable {index + 1}
                </span>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => removeVariable(index)}
                >
                    <Trash2 className="h-3 w-3 text-red-500" />
                </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                    <Label htmlFor={`var-${index}-name`} className="text-xs">
                        Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                        id={`var-${index}-name`}
                        value={variable.name}
                        onChange={(e) => updateVariable(index, 'name', e.target.value)}
                        placeholder="e.g. myVar"
                        className="h-8 text-xs font-mono"
                        onPointerDown={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                    />
                </div>

                <div className="space-y-1">
                    <Label htmlFor={`var-${index}-type`} className="text-xs">
                        Type
                    </Label>
                    <Select
                        value={variable.type}
                        onValueChange={(val) => updateVariable(index, 'type', val)}
                    >
                        <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="string">String</SelectItem>
                            <SelectItem value="number">Number</SelectItem>
                            <SelectItem value="boolean">Boolean</SelectItem>
                            <SelectItem value="json">JSON</SelectItem>
                            <SelectItem value="array">Array</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="pt-2 border-t">
                <div className="flex items-center gap-2 text-xs">
                    <div className={`w-2 h-2 rounded-full ${type === 'input' ? 'bg-blue-500' : 'bg-green-500'}`}></div>
                    <span className="text-muted-foreground">
                        {type === 'input' ? 'Input port:' : 'Output port:'} <span className="font-mono text-foreground">{variable.name}</span>
                    </span>
                </div>
            </div>
        </div>
    )
}

export function SimpleVariableListEditor({ value, onChange, title, type }: SimpleVariableListEditorProps) {
    const variables = Array.isArray(value) ? value : []

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    )

    const addVariable = () => {
        const newVar: SimpleVariable = {
            name: `variable${variables.length + 1}`,
            type: 'json',
        }
        onChange([...variables, newVar])
    }

    const removeVariable = (index: number) => {
        const newVars = variables.filter((_, i) => i !== index)
        onChange(newVars)
    }

    const updateVariable = (index: number, field: keyof SimpleVariable, fieldValue: any) => {
        const newVars = [...variables]
        newVars[index] = { ...newVars[index], [field]: fieldValue }
        onChange(newVars)
    }

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event
        console.log('[SimpleVariableListEditor] DragEnd active:', active.id, 'over:', over?.id)

        if (active.id !== over?.id) {
            const oldIndex = variables.findIndex((v) => v.name === active.id)
            const newIndex = variables.findIndex((v) => v.name === over?.id)

            console.log('[SimpleVariableListEditor] Reorder:', oldIndex, '->', newIndex)

            if (oldIndex !== -1 && newIndex !== -1) {
                const newArr = arrayMove(variables, oldIndex, newIndex)
                console.log('[SimpleVariableListEditor] New Array:', newArr)
                onChange(newArr)
            }
        }
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">{title}</Label>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addVariable}
                    className="h-7 text-xs gap-1"
                >
                    <Plus className="h-3 w-3" />
                    Add Variable
                </Button>
            </div>

            {variables.length === 0 ? (
                <div className="p-4 border-2 border-dashed rounded-lg text-center">
                    <p className="text-xs text-muted-foreground mb-3">
                        No variables configured.
                        {type === 'input'
                            ? ' Add variables to pass data into the script.'
                            : ' Add variables to capture data returned by the script.'}
                    </p>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addVariable}
                        className="gap-1 h-7 text-xs"
                    >
                        <Plus className="h-3 w-3" />
                        Add Variable
                    </Button>
                </div>
            ) : (
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext
                        items={variables.map(v => v.name)}
                        strategy={verticalListSortingStrategy}
                    >
                        <div className="space-y-3">
                            {variables.map((variable, index) => (
                                <SortableItem
                                    key={variable.name}
                                    id={variable.name}
                                    variable={variable}
                                    index={index}
                                    updateVariable={updateVariable}
                                    removeVariable={removeVariable}
                                    type={type}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            )}
        </div>
    )
}
