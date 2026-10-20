import { Check, X, Loader2 } from 'lucide-react';

/** Toolbar button of the post editor. */
export function ToolbarButton({
    onClick,
    active,
    title,
    children,
}: {
    onClick: () => void;
    active?: boolean;
    title: string;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            title={title}
            className={`p-1.5 rounded-lg transition-colors ${active
                    ? 'bg-terracotta-100 text-terracotta-600'
                    : 'text-ink-400 hover:text-ink-700 hover:bg-sand-100'
                }`}
        >
            {children}
        </button>
    );
}

interface AiSuggestionPanelProps {
    loading: boolean;
    suggestion: string | null;
    error: string | null;
    onDismissError: () => void;
    onAccept: () => void;
    onDiscard: () => void;
}

/** Streaming AI suggestion under the toolbar, with insert/discard. */
export function AiSuggestionPanel({ loading, suggestion, error, onDismissError, onAccept, onDiscard }: AiSuggestionPanelProps) {
    return (
        <div className="border-b border-sand-200 bg-terracotta-50 px-4 py-3">
            {error ? (
                <div className="flex items-center justify-between text-sm text-red-600">
                    <span>{error}</span>
                    <button type="button" title="Chiudi" onClick={onDismissError}>
                        <X className="w-4 h-4" />
                    </button>
                </div>
            ) : loading && !suggestion ? (
                <div className="flex items-center gap-2 text-sm text-terracotta-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>L&apos;AI sta elaborando…</span>
                </div>
            ) : (
                <div className="space-y-2">
                    <p className="text-xs font-medium text-terracotta-500 uppercase tracking-wide">
                        Suggerimento AI {loading && <Loader2 className="w-3 h-3 animate-spin inline ml-1" />}
                    </p>
                    <p className="text-sm text-ink-700 whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
                        {suggestion}
                    </p>
                    {!loading && (
                        <div className="flex gap-2 pt-1">
                            <button
                                type="button"
                                onClick={onAccept}
                                className="flex items-center gap-1 px-3 py-1 bg-terracotta-500 text-white rounded-lg text-xs font-medium hover:bg-terracotta-600 transition-colors"
                            >
                                <Check className="w-3 h-3" />
                                Inserisci nel post
                            </button>
                            <button
                                type="button"
                                onClick={onDiscard}
                                className="flex items-center gap-1 px-3 py-1 bg-white border border-sand-200 text-ink-500 rounded-lg text-xs font-medium hover:bg-sand-50 transition-colors"
                            >
                                <X className="w-3 h-3" />
                                Scarta
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
