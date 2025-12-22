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

export function SimpleVariableListEditor({ value, onChange, title, type }: SimpleVariableListEditorProps) {
    const variables = Array.isArray(value) ? value : []

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
                <div className="space-y-3">
                    {variables.map((variable, index) => (
                        <div
                            key={index}
                            className="p-3 border rounded-lg bg-background space-y-3"
                        >
                            <div className="flex items-center gap-2">
                                <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
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
                    ))}
                </div>
            )}
        </div>
    )
}
