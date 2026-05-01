'use client';

interface FeatureInstallModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    featureName: string;
    loading?: boolean;
}

export default function FeatureInstallModal({ isOpen, onClose, onConfirm, featureName, loading = false }: FeatureInstallModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-gray-900 border border-gray-800 p-6 rounded-lg w-full max-w-md">
                <div className="flex items-center gap-3 mb-4 text-yellow-500">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <h2 className="text-xl font-bold text-white">Server Requirements</h2>
                </div>
                
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded p-4 mb-6">
                    <p className="text-yellow-200/90 text-sm leading-relaxed">
                        <strong>{featureName}</strong> requires your server to have at least <strong className="text-yellow-400">2GB RAM</strong> available. 
                        Check your server specs before enabling to prevent performance issues with your existing applications.
                    </p>
                </div>

                <div className="flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                        className="px-4 py-2 text-gray-400 hover:text-white transition-colors text-sm font-medium disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={loading}
                        className="bg-yellow-600 hover:bg-yellow-500 text-white px-5 py-2 rounded transition-colors text-sm font-medium disabled:opacity-50 flex items-center gap-2"
                    >
                        {loading ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                Installing...
                            </>
                        ) : (
                            'Acknowledge & Install'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
