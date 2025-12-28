import { useEffect, useState } from 'react'
import { api } from '@/services/api'
import { useWorkflowUiStore } from '@/store/workflowUiStore'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { Badge } from '@/components/ui/badge'

export function HumanInputDialog() {
    const { humanInputRequestId, humanInputDialogOpen, closeHumanInputDialog } = useWorkflowUiStore()
    const { toast } = useToast()

    const [request, setRequest] = useState<any>(null)
    const [loading, setLoading] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [comment, setComment] = useState('')
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (humanInputDialogOpen && humanInputRequestId) {
            setLoading(true)
            setError(null)
            api.humanInputs.get(humanInputRequestId)
                .then(data => setRequest(data))
                .catch(err => setError(err.message))
                .finally(() => setLoading(false))
        } else {
            setRequest(null)
            setComment('')
        }
    }, [humanInputDialogOpen, humanInputRequestId])

    const handleResolve = async (approved: boolean) => {
        if (!humanInputRequestId) return
        setSubmitting(true)
        try {
            await api.humanInputs.resolve(humanInputRequestId, {
                status: 'resolved',
                responseData: {
                    status: approved ? 'approved' : 'rejected',
                    comment
                },
                comment
            })
            toast({
                title: "Input Submitted",
                description: `Request ${approved ? 'approved' : 'rejected'} successfully.`
            })
            closeHumanInputDialog()
        } catch (err: any) {
            toast({
                title: "Error",
                description: err.message,
                variant: "destructive"
            })
        } finally {
            setSubmitting(false)
        }
    }

    const isOpen = humanInputDialogOpen && !!humanInputRequestId

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && closeHumanInputDialog()}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Action Required</DialogTitle>
                    <DialogDescription>
                        Please review the request below and provide your input.
                    </DialogDescription>
                </DialogHeader>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-8 space-y-4">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Loading request details...</p>
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center py-8 space-y-4 text-center">
                        <AlertCircle className="h-8 w-8 text-destructive" />
                        <p className="text-sm text-destructive font-medium">{error}</p>
                        <Button variant="outline" onClick={closeHumanInputDialog}>Close</Button>
                    </div>
                ) : request ? (
                    <div className="space-y-6">

                        {/* Request Details */}
                        <div className="space-y-2">
                            <h3 className="font-semibold text-lg">{request.title || 'Workflow Request'}</h3>
                            {request.description && (
                                <p className="text-sm text-muted-foreground">{request.description}</p>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                                <Badge variant="outline">{request.inputType}</Badge>
                                <span className="text-xs text-muted-foreground">
                                    Created {new Date(request.createdAt).toLocaleString()}
                                </span>
                            </div>
                        </div>

                        {/* Input Area */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Comments (Optional)</label>
                            <Textarea
                                placeholder="Add a note with your decision..."
                                value={comment}
                                onChange={e => setComment(e.target.value)}
                                className="resize-none"
                            />
                        </div>

                        <DialogFooter className="flex-col sm:flex-row gap-2">
                            <Button
                                variant="outline"
                                onClick={() => handleResolve(false)}
                                disabled={submitting}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 border-red-200 dark:border-red-800"
                            >
                                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
                                Reject
                            </Button>
                            <Button
                                onClick={() => handleResolve(true)}
                                disabled={submitting}
                                className="bg-green-600 hover:bg-green-700 text-white"
                            >
                                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                                Approve
                            </Button>
                        </DialogFooter>
                    </div>
                ) : null}
            </DialogContent>
        </Dialog>
    )
}
