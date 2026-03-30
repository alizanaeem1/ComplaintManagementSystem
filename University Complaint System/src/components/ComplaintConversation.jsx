import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'

function formatTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
}

export function ComplaintConversation({
  responses = [],
  actorNames = {},
  currentUserId,
  currentUserRole = 'student',
  onReply,
  loading = false
}) {
  const [replyText, setReplyText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [responses])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!replyText.trim() || submitting || !onReply) return
    setSubmitting(true)
    try {
      await onReply(replyText.trim())
      setReplyText('')
    } finally {
      setSubmitting(false)
    }
  }

  const roleStyles = {
    student: {
      bubble: 'bg-sky-500/15 border-sky-500/30 text-sky-100 rounded-tr-none',
      badge: 'bg-sky-500/20 text-sky-300 ring-sky-500/30',
      label: 'Student'
    },
    faculty: {
      bubble: 'bg-violet-500/15 border-violet-500/30 text-violet-100 rounded-tl-none',
      badge: 'bg-violet-500/20 text-violet-300 ring-violet-500/30',
      label: 'Staff / Faculty'
    },
    admin: {
      bubble: 'bg-amber-500/15 border-amber-500/30 text-amber-100 rounded-tl-none',
      badge: 'bg-amber-500/20 text-amber-300 ring-amber-500/30',
      label: 'Admin'
    }
  }

  const renderBubble = (r) => {
    const sRole = r.sender_role || 'faculty'
    // My messages on the right if I'm NOT admin reviewing, or if it matches exactly
    const isMine = r.user_id === currentUserId
    const actor = actorNames[r.user_id] || (sRole === 'student' ? 'Student' : 'Staff')
    const rs = roleStyles[sRole] || roleStyles.faculty

    return (
      <motion.div
        key={r.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`flex w-full mb-4 ${isMine ? 'justify-end' : 'justify-start'}`}
      >
        <div className={`max-w-[85%] sm:max-w-[75%] flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
          <div className="flex items-center gap-2 mb-1 px-1">
            <span className="text-xs font-semibold text-slate-300">{isMine ? 'You' : actor}</span>
            <span className={`px-1.5 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded-md ring-1 ${rs.badge}`}>
              {rs.label}
            </span>
            <span className="text-[10px] text-slate-500 ml-1">{formatTime(r.created_at)}</span>
          </div>
          <div className={`px-4 py-3 rounded-2xl border text-sm whitespace-pre-line shadow-sm backdrop-blur-sm ${rs.bubble}`}>
            {r.body}
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <div className="flex flex-col h-full max-h-[500px] border border-slate-700/60 rounded-xl bg-[#0c1424] overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 student-scrollbar">
        {responses.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2 pb-8">
            <span className="material-symbols-outlined text-4xl opacity-50">forum</span>
            <p className="text-sm">No messages yet.</p>
          </div>
        ) : (
          responses.map(renderBubble)
        )}
        <div ref={bottomRef} />
      </div>

      {currentUserRole !== 'admin' && (
        <div className="shrink-0 border-t border-slate-700/80 bg-[#0a101d] p-3 sm:p-4">
          <form onSubmit={handleSubmit} className="flex gap-2 relative">
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Type a reply..."
              disabled={submitting || loading}
              className="flex-1 min-h-[44px] max-h-[120px] resize-y bg-[#0f172a] border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/50 disabled:opacity-50 transition-all student-scrollbar"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit(e)
                }
              }}
            />
            <div className="flex flex-col justify-end">
              <button
                type="submit"
                disabled={!replyText.trim() || submitting || loading}
                className="h-[44px] w-[44px] flex items-center justify-center rounded-xl bg-gradient-to-r from-sky-500 to-violet-500 hover:from-sky-400 hover:to-violet-400 text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <span className="material-symbols-outlined">send</span>
              </button>
            </div>
          </form>
        </div>
      )}
      {currentUserRole === 'admin' && (
        <div className="shrink-0 border-t border-slate-700/60 bg-[#0a101d] p-3 text-center">
          <p className="text-xs text-slate-500 flex items-center justify-center gap-1">
            <span className="material-symbols-outlined text-[14px]">visibility</span>
            Admin monitoring view (Read-only)
          </p>
        </div>
      )}
    </div>
  )
}
