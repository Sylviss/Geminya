import { useState } from 'react'

interface ConfirmDialogProps {
    title: string
    message: string
    confirmText?: string
    cancelText?: string
    onConfirm: () => void | Promise<void>
    onCancel: () => void
    variant?: 'default' | 'danger'
}

export default function ConfirmDialog({
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    onConfirm,
    onCancel,
    variant = 'default',
}: ConfirmDialogProps) {
    const [loading, setLoading] = useState(false)

    const handleConfirm = async () => {
        setLoading(true)
        try {
            await onConfirm()
        } finally {
            setLoading(false)
        }
    }

    const confirmButtonClass = variant === 'danger'
        ? 'btn bg-red-600 hover:bg-red-700 text-white'
        : 'btn btn-primary'

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="card p-6 max-w-md w-full mx-4 space-y-4 animate-fade-in">
                <div className="space-y-2">
                    <h2 className="text-xl font-bold text-white">{title}</h2>
                    <p className="text-sm text-white/70 whitespace-pre-wrap">{message}</p>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={onCancel}
                        disabled={loading}
                        className="btn btn-secondary flex-1 disabled:opacity-50"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={loading}
                        className={`${confirmButtonClass} flex-1 disabled:opacity-50`}
                    >
                        {loading ? 'Processing...' : confirmText}
                    </button>
                </div>
            </div>
        </div>
    )
}
