'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { BankOperationForm } from './BankOperationForm';

interface AddBankOperationDialogProps {
    onSaved: () => void;
    initialData?: any;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    trigger?: React.ReactNode;
}

export function AddBankOperationDialog({ onSaved, initialData, open: controlledOpen, onOpenChange, trigger }: AddBankOperationDialogProps) {
    const [internalOpen, setInternalOpen] = useState(false);
    const isControlled = controlledOpen !== undefined;
    const finalOpen = isControlled ? controlledOpen : internalOpen;
    const setFinalOpen = isControlled ? onOpenChange : setInternalOpen;

    const handleSaved = () => {
        onSaved();
        if (setFinalOpen) setFinalOpen(false);
    };

    return (
        <Dialog open={finalOpen} onOpenChange={setFinalOpen}>
            {/* Render Trigger if provided, or default if not controlled and no trigger provided */}
            {!isControlled && (
                <DialogTrigger asChild>
                    {trigger || (
                        <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                            <Plus className="mr-2 h-4 w-4" /> Nueva Operación
                        </Button>
                    )}
                </DialogTrigger>
            )}

            <DialogContent className="bg-slate-900 border-slate-800 text-white sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{initialData ? 'Editar Operación' : 'Nueva Inversión Bancaria'}</DialogTitle>
                </DialogHeader>
                <BankOperationForm onSaved={handleSaved} initialData={initialData} className="pt-4" />
            </DialogContent>
        </Dialog>
    );
}
