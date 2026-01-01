import { ArrayFieldItemTemplateProps } from '@rjsf/utils';
import { ArrowUp, ArrowDown, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export const ArrayFieldItemTemplate = (props: ArrayFieldItemTemplateProps) => {
  const {
    children,
    className,
    disabled,
    index,
    readonly,
  } = props;
  
  // Robust extraction based on debug logs
  const anyProps = props as any;
  const buttonsProps = anyProps.buttonsProps || {};
  
  const hasMoveUp = buttonsProps.hasMoveUp;
  const hasMoveDown = buttonsProps.hasMoveDown;
  const hasRemove = buttonsProps.hasRemove;
  
  // These are the actual function names found in your debug log
  const onMoveUp = buttonsProps.onMoveUpItem;
  const onMoveDown = buttonsProps.onMoveDownItem;
  const onRemove = buttonsProps.onRemoveItem;

  const btnClass = "p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div className={cn("border rounded-md mb-2 bg-card/50", className)}>
      {/* Header Row: Index/Label + Toolbar */}
      <div className="flex items-center justify-between px-2 py-1 border-b bg-muted/10">
        <span className="text-[0.65rem] font-semibold text-muted-foreground uppercase tracking-wider">
          Item {index + 1}
        </span>

        <div className="flex items-center gap-0.5">
          {(hasMoveUp || hasMoveDown) && (
            <>
              <button
                type="button"
                disabled={disabled || readonly || !hasMoveUp}
                onClick={onMoveUp}
                className={btnClass}
                title="Move Up"
              >
                <ArrowUp className="w-3 h-3" />
              </button>
              <button
                type="button"
                disabled={disabled || readonly || !hasMoveDown}
                onClick={onMoveDown}
                className={btnClass}
                title="Move Down"
              >
                <ArrowDown className="w-3 h-3" />
              </button>
            </>
          )}
          
          {hasRemove && (
            <button
              type="button"
              disabled={disabled || readonly}
              onClick={onRemove}
              className={cn(btnClass, "hover:bg-destructive/5 hover:text-destructive ml-0.5")}
              title="Remove"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-2">
        {children}
      </div>
    </div>
  );
};
