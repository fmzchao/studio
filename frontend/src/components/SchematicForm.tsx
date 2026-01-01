import { cn } from '@/lib/utils';
import Form from '@rjsf/shadcn';
import validator from '@rjsf/validator-ajv8';

interface SchematicFormProps {
    schema: any;
    data: any;
    onChange: (data: any) => void;
    className?: string;
}

export function SchematicForm({ schema, data, onChange, className }: SchematicFormProps) {
    if (!schema || Object.keys(schema).length === 0) {
        return (
            <div className="p-6 flex flex-col items-center justify-center text-center text-muted-foreground">
                <p className="text-sm">No input schema defined.</p>
                <p className="text-xs opacity-70 mt-1">Add a schema to generate a form.</p>
            </div>
        );
    }

    const handleChange = ({ formData }: any) => {
        onChange(formData);
    };

    return (
        <div className={cn("w-full schematic-form-compact", className)}>
            <style>{`
                /* Compact RJSF Form Styles - ~70% of default size */
                .schematic-form-compact {
                    font-size: 0.75rem;
                }
                
                /* Labels */
                .schematic-form-compact label {
                    font-size: 0.65rem;
                    font-weight: 500;
                    margin-bottom: 0.125rem;
                }
                
                /* Form groups - reduce spacing */
                .schematic-form-compact .space-y-2 {
                    gap: 0.375rem;
                }
                
                .schematic-form-compact .mb-4,
                .schematic-form-compact .mb-3,
                .schematic-form-compact .mb-2 {
                    margin-bottom: 0.375rem !important;
                }
                
                .schematic-form-compact .mt-4,
                .schematic-form-compact .mt-3,
                .schematic-form-compact .mt-2 {
                    margin-top: 0.25rem !important;
                }
                
                /* Inputs, selects, textareas */
                .schematic-form-compact input,
                .schematic-form-compact select,
                .schematic-form-compact textarea {
                    font-size: 0.7rem !important;
                    padding: 0.25rem 0.375rem !important;
                    min-height: 1.5rem !important;
                    height: auto !important;
                }
                
                .schematic-form-compact input[type="checkbox"] {
                    width: 0.75rem !important;
                    height: 0.75rem !important;
                    min-height: 0.75rem !important;
                }
                
                /* Buttons */
                .schematic-form-compact button {
                    font-size: 0.65rem !important;
                    padding: 0.2rem 0.375rem !important;
                    min-height: 1.25rem !important;
                    height: auto !important;
                }
                
                .schematic-form-compact button svg {
                    width: 0.7rem !important;
                    height: 0.7rem !important;
                }
                
                /* Field descriptions */
                .schematic-form-compact .text-muted-foreground,
                .schematic-form-compact p {
                    font-size: 0.6rem;
                }
                
                /* Fieldsets and legends */
                .schematic-form-compact fieldset {
                    padding: 0.375rem;
                    margin-bottom: 0.375rem;
                }
                
                .schematic-form-compact legend {
                    font-size: 0.65rem;
                    font-weight: 600;
                    padding: 0 0.25rem;
                }
                
                /* Array items */
                .schematic-form-compact .flex.gap-2 {
                    gap: 0.25rem;
                }
                
                /* Reduce padding in nested cards/panels */
                .schematic-form-compact .p-4,
                .schematic-form-compact .p-3 {
                    padding: 0.375rem !important;
                }
                
                .schematic-form-compact .p-2 {
                    padding: 0.25rem !important;
                }
                
                /* Error messages */
                .schematic-form-compact .text-destructive,
                .schematic-form-compact .text-red-500 {
                    font-size: 0.55rem;
                }
                
                /* Reduce border radius for compact look */
                .schematic-form-compact input,
                .schematic-form-compact select,
                .schematic-form-compact textarea,
                .schematic-form-compact button {
                    border-radius: 0.25rem !important;
                }
            `}</style>
            <Form
                schema={schema}
                validator={validator}
                formData={data}
                onChange={handleChange}
                liveValidate
                showErrorList={false}
                uiSchema={{
                    "ui:submitButtonOptions": { norender: true }
                }}
            />
        </div>
    );
}
