import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

export default function DeleteConfirmDialog({ employee, onConfirm, onClose }) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm w-[92vw] rounded-2xl p-0 overflow-hidden gap-0">
        <DialogHeader className="px-5 pt-5 pb-4">
          <DialogTitle className="text-slate-800">Elimina dipendente</DialogTitle>
        </DialogHeader>
        <div className="px-5 pb-5">
          <p className="text-slate-500 text-sm">
            Sei sicuro di voler eliminare <span className="font-semibold text-slate-700">{employee.name}</span>?
          </p>
          <p className="text-slate-400 text-xs mt-2">
            Il nominativo verrà rimosso da tutti i turni futuri. I turni passati rimarranno invariati.
          </p>
        </div>
        <DialogFooter className="px-5 pb-5 flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1 rounded-xl py-3 text-sm">Annulla</Button>
          <Button onClick={onConfirm} className="flex-1 rounded-xl py-3 text-sm bg-red-500 hover:bg-red-400 text-white">
            Elimina
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
