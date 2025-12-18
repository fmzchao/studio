# Workflow Builder Refactor Plan

## Context
The current `WorkflowBuilder` page is responsible for layout, design-mode controls, execution-mode logic, schedule management, and API orchestration. The single component has become difficult to reason about and maintain due to the tightly coupled state and effects.

## Objectives
1. Split the builder into distinct designer and execution experiences that still share the underlying canvas/graph.
2. Extract shared state/controllers so individual panes can focus on their responsibilities without duplicating logic.
3. Isolate layout chrome (top bar, sidebars, inspector container) from business logic to simplify future UI changes.

## High-Level Steps
1. **Builder Shell Extraction**
   - Create a lightweight page component (e.g., `WorkflowBuilderPage`) handling only the layout structure: `TopBar`, component library sidebar toggle, canvas slot, and inspector container.
   - Move animation/resizing logic (`layoutRef`, library slide-in/out, inspector width handling) into this shell and expose props/hooks for downstream panes.

2. **Shared Graph Controller Hook**
   - Introduce `useWorkflowGraphState` to own design/execution `useNodesState` and `useEdgesState`, snapshot refs, cloning helpers, dirty tracking, and mode switching preservation.
   - Expose a concise API for reading/updating nodes/edges per mode, plus callbacks like `onNodesChange`, `onEdgesChange`, and utilities for runtime input lookup.

3. **Workflow Designer Pane**
   - Build a `WorkflowDesignerPane` that renders the canvas in design mode and manages designer-only UI: component library toggling, schedule summary + sidebar, import/export, save, metadata edits, and schedule drawer state.
   - This pane consumes the shared graph controller and workflow store metadata; it triggers dirty state updates via the hook.

4. **Workflow Execution Pane**
   - Build a `WorkflowExecutionPane` focused on run selection, URL syncing, historical version loading, monitoring live executions, and rendering the inspector.
   - Encapsulate `handleRun`, `handleRerun`, execution dialog state, and the inspector resizing behavior here.

5. **Service Hooks**
   - Factor API-centric logic into hooks/services (`useWorkflowRunner`, `useWorkflowSchedules`) to keep panes declarative.
   - These hooks coordinate permissions, toasts, run dialog inputs, and schedule CRUD without bloating the UI components.

6. **Final Composition**
   - The top-level `WorkflowBuilder` wires router params + stores to decide which pane to render, shares the canvas via props, and renders global dialogs (`RunWorkflowDialog`, `ScheduleEditorDrawer`).
   - Ensure designer/execution panes only contain their relevant JSX and rely on the shared hook for graph state to maintain the unified canvas data.

## Execution Notes
- Implement incrementally: extract the shell first, then introduce the shared graph hook, followed by designer and execution panes.
- Maintain existing analytics, toasts, and behavior while moving logic to new modules; add TODOs when behavior temporarily regresses.
- Validate after each extraction with focused manual testing (mode switch, save/import/export, run execution) before the final wiring.
