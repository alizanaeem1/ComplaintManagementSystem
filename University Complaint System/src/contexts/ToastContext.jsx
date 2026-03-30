import { createContext, useContext, useCallback } from 'react'
import { Toaster, toast as hotToast } from 'react-hot-toast'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const showToast = useCallback((message, type = 'success') => {
    if (type === 'error') hotToast.error(message)
    else if (type === 'success') hotToast.success(message)
    else hotToast(message, { icon: 'ℹ️' })
  }, [])

  const hideToast = useCallback(() => {
    hotToast.dismiss()
  }, [])

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4200,
          className: '!text-sm !font-medium !shadow-lg !rounded-xl !border !border-slate-200/80 dark:!border-slate-600/80 !bg-white dark:!bg-slate-900 !text-slate-900 dark:!text-slate-100',
          success: {
            iconTheme: { primary: '#059669', secondary: '#fff' }
          },
          error: {
            iconTheme: { primary: '#dc2626', secondary: '#fff' }
          }
        }}
      />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
