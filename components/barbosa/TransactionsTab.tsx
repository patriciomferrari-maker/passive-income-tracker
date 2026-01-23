'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { InstallmentsDialog } from './InstallmentsDialog';
import { TransactionTable } from './TransactionTable';
import { TransactionForm } from './TransactionForm';
import { Plus, Save, Search, Calendar, DollarSign, FileText, Loader2, Check, X, AlertTriangle, Paperclip, Receipt, Upload, Copy, Edit, Trash2 } from 'lucide-react';
import { upload } from '@vercel/blob/client';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export function TransactionsTab() {
    const [transactions, setTransactions] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [editingId, setEditingId] = useState<string | null>(null);
    const [formOpen, setFormOpen] = useState(false);
    const [editingTx, setEditingTx] = useState<any>(null);

    // Clone Month State
    const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
    const [installmentsDialogOpen, setInstallmentsDialogOpen] = useState(false); // NEW State

    const [cloneData, setCloneData] = useState({
        sourceMonth: new Date().getMonth().toString(), // 0-11
        sourceYear: new Date().getFullYear().toString(),
        targetMonth: (new Date().getMonth() + 1).toString(), // Default next month
        targetYear: new Date().getFullYear().toString(),
    });

    // Import Target State
    // Default to Current Month for imputation
    const [importTargetMonth, setImportTargetMonth] = useState((new Date().getMonth() + 1).toString()); // 1-12
    const [importTargetYear, setImportTargetYear] = useState(new Date().getFullYear().toString());

    // PDF Parsing State
    const [isParsing, setIsParsing] = useState(false);
    const [parsedResults, setParsedResults] = useState<any[] | null>(null);
    const [pendingFile, setPendingFile] = useState<File | null>(null); // NEW: Track file to upload after review
    const [currentImportSource, setCurrentImportSource] = useState<string | null>(null);
    const [showParsedDialog, setShowParsedDialog] = useState(false);
    const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);
    const [rowEditData, setRowEditData] = useState<any>(null);

    const [filterStatistical, setFilterStatistical] = useState(false);
    const [filterMonth, setFilterMonth] = useState('ALL'); // 'ALL' or '0'-'11'
    const [filterYear, setFilterYear] = useState('ALL'); // Default ALL years
    const [filterSource, setFilterSource] = useState('ALL'); // NEW: Source filter

    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        type: 'EXPENSE',
        amount: '',
        currency: 'ARS',
        categoryId: '',
        subCategoryId: '',
        description: '',
        exchangeRate: '',
        status: 'REAL', // REAL, PROJECTED
        isStatistical: false,
        comprobante: '',
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const safeJson = async (res: Response) => {
            const contentType = res.headers.get('content-type');
            if (res.ok && contentType && contentType.includes('application/json')) {
                return await res.json();
            }
            // If response is not OK or not JSON, return a safe default
            console.warn(`[FRONTEND] safeJson: Invalid response from ${res.url}. Status: ${res.status}. Content-Type: ${contentType}`);
            return null;
        };

        try {
            const [txRes, catRes, rateRes] = await Promise.all([
                fetch('/api/barbosa/transactions'),
                fetch('/api/barbosa/categories'),
                fetch('/api/barbosa/exchange-rate')
            ]);

            const txData = await safeJson(txRes);
            const catData = await safeJson(catRes);
            const rateData = await safeJson(rateRes);

            setTransactions(Array.isArray(txData) ? txData : []);
            setCategories(Array.isArray(catData) ? catData : []);

            // Store Exchange Rate if available, to be used in background calculation
            if (rateData?.rate && !editingId) {
                setFormData(prev => ({
                    ...prev,
                    exchangeRate: prev.exchangeRate || rateData.rate.toString()
                }));
            }

        } catch (e) {
            console.error('[FRONTEND] Error in loadData:', e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const url = editingId
                ? `/api/barbosa/transactions/${editingId}`
                : '/api/barbosa/transactions';

            const method = editingId ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                // If we have a category, LEARN it as a rule on manual save/edit too
                if (formData.categoryId && formData.description) {
                    const cleanDesc = formData.description.replace(/\s*\(?Cuota\s*\d+\/\d+\)?/i, '').trim();
                    if (cleanDesc.length > 3) { // Avoid creating rules for very short descriptions
                        fetch('/api/barbosa/categories/rules', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                pattern: cleanDesc,
                                categoryId: formData.categoryId,
                                subCategoryId: formData.subCategoryId || null
                            })
                        }).catch(console.error);
                    }
                }

                setFormData({
                    ...formData,
                    amount: '',
                    description: '',
                    categoryId: '', // Reset ID selection
                    subCategoryId: '' // Reset ID selection
                });
                setEditingId(null);
                loadData();
                alert(editingId ? 'Transacción actualizada correctamente.' : 'Transacción guardada correctamente.');
            } else {
                const errorData = await res.json();
                console.error("Save Error", errorData);
                alert(`Error al guardar: ${errorData.error || res.statusText}`);
            }
        } catch (error) {
            console.error(error);
            alert(`Error de conexión al guardar: ${error}`);
        }
    };

    const handleClone = async () => {
        if (!confirm(`¿Estás seguro de clonar los movimientos? Esto creará transacciones PROYECTADAS para el mes destino.`)) return;
        try {
            const res = await fetch('/api/barbosa/clone-month', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sourceMonth: parseInt(cloneData.sourceMonth) + 1, // 1-12
                    sourceYear: parseInt(cloneData.sourceYear),
                    targetMonth: parseInt(cloneData.targetMonth) + 1, // 1-12
                    targetYear: parseInt(cloneData.targetYear)
                })
            });
            const contentType = res.headers.get('content-type');
            const data = (contentType && contentType.includes('application/json'))
                ? await res.json()
                : null;

            if (res.ok && data) {
                alert(`Se clonaron ${data.count} movimientos correctamente.`);
                setCloneDialogOpen(false);
                loadData();
            } else {
                alert(`Error: ${data?.message || data?.error || 'Error desconocido'}`);
            }
        } catch (error) {
            console.error(error);
            alert("Error de conexión");
        }
    };

    const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        console.log('[FRONTEND] File selected:', file?.name);
        if (!file) return;

        setIsParsing(true);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('currentYear', new Date().getFullYear().toString());
        formData.append('targetMonth', importTargetMonth);
        formData.append('targetYear', importTargetYear);

        try {
            console.log('[FRONTEND] Sending PDF to server...');
            const res = await fetch('/api/barbosa/transactions/parse-pdf', {
                method: 'POST',
                body: formData
            });

            console.log('[FRONTEND] Server response status:', res.status);

            const contentType = res.headers.get('content-type');
            const data = (contentType && contentType.includes('application/json'))
                ? await res.json()
                : null;

            if (res.ok && data) {
                console.log('[FRONTEND] Data received, transactions:', data.transactions?.length);
                if (data.transactions && data.transactions.length > 0) {
                    // Enrich transactions with installment detection
                    const enriched = data.transactions.map((tx: any) => {
                        const installmentMatch = tx.description?.match(/Cuota (\d+)\/(\d+)/i) || tx.description?.match(/(\d+)\/(\d+)$/);
                        let installments = null;
                        if (installmentMatch) {
                            installments = {
                                current: parseInt(installmentMatch[1]),
                                total: parseInt(installmentMatch[2])
                            };
                        }
                        return {
                            ...tx,
                            installments,
                            isInstallmentPlan: !!installments,
                            isStatistical: false,
                            subCategoryId: null,
                            skip: false
                        };
                    });

                    setParsedResults(enriched);
                    setCurrentImportSource(data.importSource);
                    setPendingFile(file); // Save for later upload
                    setShowParsedDialog(true);
                } else {
                    alert('No se detectaron transacciones en el PDF. Intenta con otro archivo.');
                }
            } else {
                console.error('[FRONTEND] Server error or invalid response:', data);
                const errorMsg = data?.error || (res.status === 401 ? 'Sesión expirada o no autorizado' : 'Error desconocido de servidor');
                alert('Error al procesar el PDF: ' + errorMsg);
            }
        } catch (error) {
            console.error('[FRONTEND] Connection error:', error);
            alert('Error de conexión al procesar PDF.');
        } finally {
            setIsParsing(false);
            e.target.value = ''; // Reset input
        }
    };

    const confirmParsedTransactions = async () => {
        if (!parsedResults || !currentImportSource) return;

        setIsParsing(true); // Re-use parsing state for upload/save
        let attachmentUrl = undefined;

        try {
            // Step 1: Upload to Vercel Blob if we have a pending file
            if (pendingFile) {
                try {
                    console.log(`[FRONTEND] Uploading ${pendingFile.name}...`);
                    const blob = await upload(pendingFile.name, pendingFile, {
                        access: 'public',
                        handleUploadUrl: '/api/upload',
                    });
                    attachmentUrl = blob.url;
                    console.log(`[FRONTEND] Upload successful: ${attachmentUrl}`);
                } catch (uploadError) {
                    console.error('[FRONTEND] Upload error (soft fail):', uploadError);
                    // Continue without attachment
                }
            }

            // Step 2: Create transactions
            let successCount = 0;
            let duplicateCount = 0;
            const validResults = parsedResults.filter(tx => !tx.skip);

            for (const tx of validResults) {
                console.log(`[FRONTEND] Sending transaction: ${tx.description}, Date: ${tx.date}`);
                const res = await fetch('/api/barbosa/transactions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ...tx,
                        type: categories.find(c => c.id === tx.categoryId)?.type || 'EXPENSE',
                        categoryId: tx.categoryId || '',
                        subCategoryId: tx.subCategoryId || null,
                        importSource: currentImportSource,
                        attachmentUrl: attachmentUrl, // Link the PDF
                        status: 'REAL',
                        isStatistical: tx.isStatistical,
                        isInstallmentPlan: tx.isInstallmentPlan,
                        // If it's a plan, strip the ' (Cuota X/Y)' part from description to keep it clean
                        description: tx.isInstallmentPlan
                            ? tx.description.replace(/\s*\(?Cuota\s*\d+\/\d+\)?/i, '').replace(/\s*\d+\/\d+$/, '').trim()
                            : tx.description,
                        installments: tx.installments
                    })
                });

                if (res.status === 409) {
                    duplicateCount++;
                    continue; // Skip without error alert
                }

                if (res.ok && tx.categoryId) {
                    // Always "learn" the category assignment for future imports
                    const cleanDesc = tx.description.replace(/\s*\(?Cuota\s*\d+\/\d+\)?/i, '').trim();

                    await fetch('/api/barbosa/categories/rules', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            pattern: cleanDesc,
                            categoryId: tx.categoryId,
                            subCategoryId: tx.subCategoryId || null
                        })
                    }).catch(err => console.error("Error saving rule:", err));
                }

                if (res.ok) successCount++;
            }

            let msg = `Se importaron ${successCount} transacciones correctamente.`;
            if (duplicateCount > 0) msg += `\n(${duplicateCount} ya existían y fueron omitidas)`;

            alert(msg);
            setShowParsedDialog(false);
            setParsedResults(null);
            setCurrentImportSource(null);
            setPendingFile(null);
            loadData();
        } catch (error) {
            console.error(error);
            alert('Error al guardar las transacciones.');
        } finally {
            setIsParsing(false);
        }
    };

    const [choiceDialogOpen, setChoiceDialogOpen] = useState(false);
    const [selectedTxForChoice, setSelectedTxForChoice] = useState<any>(null);

    const handleEdit = (tx: any) => {
        if (tx.installmentsPlanId) {
            setSelectedTxForChoice(tx);
            setChoiceDialogOpen(true);
            return;
        }
        startEditingTransaction(tx);
    };

    const startEditingTransaction = (tx: any) => {
        try {
            setEditingId(tx.id);
            const safeDate = new Date(tx.date);
            const dateStr = !isNaN(safeDate.getTime()) ? safeDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

            setFormData({
                date: dateStr,
                type: tx.type,
                amount: tx.amount.toString(),
                currency: tx.currency,
                categoryId: tx.categoryId,
                subCategoryId: tx.subCategoryId || '',
                description: tx.description || '',
                exchangeRate: tx.exchangeRate ? tx.exchangeRate.toString() : '',
                status: tx.status,
                isStatistical: tx.isStatistical || false,
                comprobante: tx.comprobante || '',
            });
        } catch (e) {
            console.error("Error setting up edit form", e);
        }
    };

    // Plan Editing State
    const [planEditId, setPlanEditId] = useState<string | null>(null);
    const [planInitialData, setPlanInitialData] = useState<any>(null);

    const handleEditPlan = async () => {
        if (!selectedTxForChoice?.installmentsPlanId) return;

        try {
            const planId = selectedTxForChoice.installmentsPlanId;
            const res = await fetch(`/api/barbosa/transactions/installments/${planId}`);
            if (res.ok) {
                const plan = await res.json();

                // Transform data for form
                setPlanInitialData({
                    description: plan.description,
                    categoryId: plan.categoryId,
                    subCategoryId: plan.subCategoryId || '',
                    currency: plan.currency,
                    startDate: new Date(plan.startDate).toISOString().split('T')[0],
                    installmentsCount: plan.installmentsCount.toString(),
                    amountMode: 'TOTAL', // Default to showing TOTAL for editing
                    amountValue: parseFloat(plan.totalAmount.toString()).toFixed(2),
                    status: 'PROJECTED', // Default, though we might want to fetch stats
                    isStatistical: plan.isStatistical,
                    comprobante: plan.comprobante || ''
                });
                setPlanEditId(planId);
                setInstallmentsDialogOpen(true);
                setChoiceDialogOpen(false);
            } else {
                alert('Error al obtener datos del plan');
            }
        } catch (e) {
            console.error(e);
            alert('Error al obtener datos del plan');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar este movimiento?')) return;
        try {
            await fetch(`/api/barbosa/transactions/${id}`, { method: 'DELETE' });
            loadData();
        } catch (error) {
            console.error(error);
        }
    };

    const handleCancel = () => {
        setEditingId(null);
        setFormData({
            ...formData,
            amount: '',
            description: '',
            categoryId: '',
            subCategoryId: ''
        });
    };

    // Derived: Current available categories based on type
    const uniqueCategories = categories.filter(c => c.type === formData.type);

    // Find selected category object to show subcategories
    const selectedCategoryObj = categories.find(c => c.id === formData.categoryId);
    const availableSubCategories = selectedCategoryObj ? selectedCategoryObj.subCategories : [];

    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const handleBatchDelete = async () => {
        if (selectedIds.size === 0) return;
        if (!confirm(`¿Eliminar ${selectedIds.size} elementos seleccionados?`)) return;

        try {
            await fetch('/api/barbosa/transactions/batch-delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: Array.from(selectedIds) })
            });
            setSelectedIds(new Set());
            loadData();
        } catch (error) {
            console.error(error);
            alert('Error eliminando');
        }
    };

    const handleDeleteBySource = async (source: string) => {
        if (!confirm(`¿Estás seguro de eliminar TODOS los movimientos importados de "${source}"?`)) return;

        const idsToDelete = transactions.filter(tx => tx.importSource === source).map(tx => tx.id);
        if (idsToDelete.length === 0) return;

        try {
            await fetch('/api/barbosa/transactions/batch-delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: idsToDelete })
            });
            alert(`Se eliminaron ${idsToDelete.length} transacciones.`);
            loadData();
        } catch (error) {
            console.error(error);
            alert('Error al eliminar');
        }
    };

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const filteredTransactions = transactions.filter(tx => {
        const date = new Date(tx.date);
        const utcDate = new Date(date.valueOf() + date.getTimezoneOffset() * 60000);

        if (filterStatistical && !tx.isStatistical) return false;
        if (filterYear !== 'ALL' && utcDate.getFullYear().toString() !== filterYear) return false;
        if (filterMonth !== 'ALL' && utcDate.getMonth().toString() !== filterMonth) return false;
        if (filterSource !== 'ALL') {
            if (filterSource === 'MANUAL' && tx.importSource) return false;
            if (filterSource !== 'MANUAL' && tx.importSource !== filterSource) return false;
        }
        return true;
    });

    return (
        <div className="space-y-6">
            {/* Toolbar */}
            <div className="flex flex-col lg:flex-row justify-between bg-slate-900/50 p-3 rounded-lg border border-slate-800 gap-4">
                <div className="flex flex-wrap items-center gap-3">
                    <Button variant="outline" size="sm" onClick={() => setInstallmentsDialogOpen(true)} className="border-slate-700 text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800">
                        <span className="mr-2 text-xs font-bold">💳</span> Cuotas
                    </Button>

                    {/* Import Target Month Selectors */}
                    <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded border border-slate-800">
                        <span className="text-[10px] text-slate-500 font-bold uppercase mr-1">Imputar en:</span>
                        <Select value={importTargetMonth} onValueChange={setImportTargetMonth}>
                            <SelectTrigger className="w-[110px] h-8 text-xs bg-slate-900 border-slate-700 text-slate-300">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-slate-800 text-slate-300 z-50">
                                {Array.from({ length: 12 }).map((_, i) => (
                                    <SelectItem key={i} value={(i + 1).toString()}>{format(new Date(2024, i, 1), 'MMMM', { locale: es })}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={importTargetYear} onValueChange={setImportTargetYear}>
                            <SelectTrigger className="w-[70px] h-8 text-xs bg-slate-900 border-slate-700 text-slate-300">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-slate-800 text-slate-300 z-50">
                                {['2024', '2025', '2026', '2027'].map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="relative">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={isParsing}
                            className="border-blue-800 text-blue-400 hover:text-blue-300 bg-blue-950/30 hover:bg-blue-900/40"
                            onClick={() => document.getElementById('pdf-upload')?.click()}
                        >
                            {isParsing ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <FileText className="w-4 h-4 mr-2" />
                            )}
                            Lector PDF
                        </Button>
                        <input
                            type="file"
                            id="pdf-upload"
                            accept=".pdf"
                            className="hidden"
                            onChange={handlePdfUpload}
                        />
                    </div>

                    {/* Filters Group */}
                    <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded border border-slate-800">
                        <span className="text-xs text-slate-500 font-bold uppercase mr-2">Filtros:</span>

                        {/* Month Filter */}
                        <Select value={filterMonth} onValueChange={setFilterMonth}>
                            <SelectTrigger className="w-auto min-w-[150px] h-8 text-xs bg-slate-900 border-slate-700 text-slate-300">
                                <SelectValue placeholder="Mes" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-slate-800 text-slate-300 z-50">
                                <SelectItem value="ALL">Todo Año</SelectItem>
                                {Array.from({ length: 12 }).map((_, i) => (
                                    <SelectItem key={i} value={i.toString()}>{format(new Date(2024, i, 1), 'MMMM')}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {/* Year Filter */}
                        <Select value={filterYear} onValueChange={setFilterYear}>
                            <SelectTrigger className="w-auto min-w-[150px] h-8 text-xs bg-slate-900 border-slate-700 text-slate-300">
                                <SelectValue placeholder="Año" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-slate-800 text-slate-300 z-50">
                                <SelectItem value="ALL">Histórico</SelectItem>
                                {['2024', '2025', '2026'].map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                            </SelectContent>
                        </Select>

                        {/* Source Filter */}
                        <Select value={filterSource} onValueChange={setFilterSource}>
                            <SelectTrigger className="w-auto min-w-[120px] h-8 text-xs bg-slate-900 border-slate-700 text-slate-300">
                                <SelectValue placeholder="Origen" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-slate-800 text-slate-300 z-50">
                                <SelectItem value="ALL">Todos los Orígenes</SelectItem>
                                <SelectItem value="MANUAL">Carga Manual</SelectItem>
                                {Array.from(new Set(transactions.map(tx => tx.importSource).filter(Boolean))).map((s: any) => (
                                    <SelectItem key={s} value={s}>{s}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {/* Quick Delete by source */}
                        {filterSource !== 'ALL' && filterSource !== 'MANUAL' && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteBySource(filterSource)}
                                className="h-8 text-[10px] text-red-400 hover:text-red-300 hover:bg-red-900/20"
                            >
                                <X className="w-3 h-3 mr-1" /> BORRAR CARGA
                            </Button>
                        )}

                        {/* Statistical Toggle */}
                        <div className={`cursor-pointer h-8 px-3 rounded flex items-center justify-center border transition-all select-none ${filterStatistical
                            ? 'bg-blue-900/30 border-blue-600 text-blue-400'
                            : 'bg-slate-900 border-slate-700 text-slate-500 hover:text-slate-300'}`}
                            onClick={() => setFilterStatistical(!filterStatistical)}
                            title="Ver solo movimientos estadísticos"
                        >
                            <span className="text-[10px] font-bold">ESTAD.</span>
                        </div>

                        {/* SELECT ALL FILTERED BUTTON */}
                        {(filterMonth !== 'ALL' || filterYear !== 'ALL' || filterSource !== 'ALL') && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    const filteredIds = filteredTransactions.map(tx => tx.id);
                                    setSelectedIds(new Set([...Array.from(selectedIds), ...filteredIds]));
                                }}
                                className="h-8 text-[10px] font-bold border-indigo-800 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-950/20"
                            >
                                <Check className="w-3 h-3 mr-1" /> SELECCIONAR TODO
                            </Button>
                        )}
                    </div>

                    {/* Batch Actions */}
                </div>

                <div className="flex items-center gap-2">
                    {/* Batch Actions (Moved to right) */}
                    {selectedIds.size > 0 && (
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={handleBatchDelete}
                            className="h-8 text-xs animate-in fade-in zoom-in mr-2"
                        >
                            Eliminar ({selectedIds.size})
                        </Button>
                    )}
                    {/* Clone Dialog Trigger */}
                    {/* Clone Dialog Trigger */}
                    {!cloneDialogOpen ? (
                        <Button variant="outline" size="sm" onClick={() => setCloneDialogOpen(true)} className="border-slate-700 text-slate-300 hover:text-white whitespace-nowrap">
                            <Calendar className="w-4 h-4 mr-2" /> Clonar Mes
                        </Button>
                    ) : (
                        <div className="flex items-center gap-2 bg-slate-900 p-2 rounded border border-slate-700 animate-in slide-in-from-right">
                            {/* ... existing clone dialog content ... */}
                            <span className="text-xs font-bold text-slate-300">Origen:</span>
                            <Select value={cloneData.sourceMonth} onValueChange={v => setCloneData({ ...cloneData, sourceMonth: v })}>
                                <SelectTrigger className="w-[100px] h-8 text-xs bg-slate-800 border-slate-600 text-white"><SelectValue /></SelectTrigger>
                                <SelectContent className="bg-slate-900 border-slate-700 text-white">{Array.from({ length: 12 }).map((_, i) => <SelectItem key={i} value={i.toString()}>{format(new Date(2024, i, 1), 'MMMM')}</SelectItem>)}</SelectContent>
                            </Select>
                            <Select value={cloneData.sourceYear} onValueChange={v => setCloneData({ ...cloneData, sourceYear: v })}>
                                <SelectTrigger className="w-[70px] h-8 text-xs bg-slate-800 border-slate-600 text-white"><SelectValue /></SelectTrigger>
                                <SelectContent className="bg-slate-900 border-slate-700 text-white">{['2024', '2025', '2026'].map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                            </Select>
                            <span className="text-xs font-bold text-slate-300 mx-1">→</span>
                            <Select value={cloneData.targetMonth} onValueChange={v => setCloneData({ ...cloneData, targetMonth: v })}>
                                <SelectTrigger className="w-[100px] h-8 text-xs bg-slate-800 border-slate-600 text-white"><SelectValue /></SelectTrigger>
                                <SelectContent className="bg-slate-900 border-slate-700 text-white">{Array.from({ length: 12 }).map((_, i) => <SelectItem key={i} value={i.toString()}>{format(new Date(2024, i, 1), 'MMMM')}</SelectItem>)}</SelectContent>
                            </Select>
                            <Select value={cloneData.targetYear} onValueChange={v => setCloneData({ ...cloneData, targetYear: v })}>
                                <SelectTrigger className="w-[70px] h-8 text-xs bg-slate-800 border-slate-600 text-white"><SelectValue /></SelectTrigger>
                                <SelectContent className="bg-slate-900 border-slate-700 text-white">{['2025', '2026'].map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                            </Select>
                            <Button size="sm" onClick={handleClone} className="h-8 bg-blue-600 hover:bg-blue-700 text-xs ml-2 text-white px-2">OK</Button>
                            <Button size="sm" variant="ghost" onClick={() => setCloneDialogOpen(false)} className="h-8 w-8 p-0 text-slate-400 hover:text-white">X</Button>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Input Form */}
                <Card className="bg-slate-900 border-slate-800 lg:col-span-1 h-fit">
                    <CardHeader>
                        <CardTitle className="text-white">
                            Nueva Transacción
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-slate-300">Fecha</Label>
                                    <Input
                                        type="date"
                                        value={formData.date}
                                        onChange={e => setFormData({ ...formData, date: e.target.value })}
                                        className="bg-slate-950 border-slate-700 text-white"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-slate-300">Tipo</Label>
                                    <Select value={formData.type} onValueChange={v => setFormData({ ...formData, type: v })}>
                                        <SelectTrigger className="bg-slate-950 border-slate-700 text-white">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-slate-900 border-slate-800 text-white">
                                            <SelectItem value="EXPENSE">Gasto</SelectItem>
                                            <SelectItem value="INCOME">Ingreso</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Status Selector REMOVED - Defaulting to REAL internally */}
                            <div className="space-y-2">
                                {/* Statistical Expense Checkbox */}
                                {formData.type === 'EXPENSE' && (
                                    <div className="flex items-center space-x-2 pt-2">
                                        <input
                                            type="checkbox"
                                            id="isStatistical"
                                            checked={formData.isStatistical}
                                            onChange={e => setFormData({ ...formData, isStatistical: e.target.checked })}
                                            className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-900"
                                        />
                                        <label htmlFor="isStatistical" className="text-sm font-medium leading-none text-slate-400 cursor-pointer">
                                            Pagado con Tarjeta (Estadístico)
                                            <span className="block text-[10px] text-slate-500 font-normal mt-0.5">No suma al total de gastos (Evita duplicados)</span>
                                        </label>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-slate-300">Monto</Label>
                                    <div className="relative">
                                        <span className="absolute left-2 top-2.5 text-slate-500">$</span>
                                        <Input
                                            type="number" step="0.01"
                                            value={formData.amount}
                                            onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                            className="bg-slate-950 border-slate-700 text-white pl-6"
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-slate-300">Moneda</Label>
                                    <Select value={formData.currency} onValueChange={v => setFormData({ ...formData, currency: v })}>
                                        <SelectTrigger className="bg-slate-950 border-slate-700 text-white">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-slate-900 border-slate-800 text-white">
                                            <SelectItem value="ARS">ARS</SelectItem>
                                            <SelectItem value="USD">USD</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-slate-300">Categoría</Label>
                                <Select
                                    value={formData.categoryId}
                                    onValueChange={v => {
                                        // Reset subcategory when category changes
                                        setFormData({ ...formData, categoryId: v, subCategoryId: '' });
                                    }}
                                >
                                    <SelectTrigger className="bg-slate-950 border-slate-700 text-white">
                                        <SelectValue placeholder="Seleccionar..." />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-900 border-slate-800 text-white">
                                        {uniqueCategories.map((c: any) => (
                                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-slate-300">Sub Categoría</Label>
                                <Select
                                    value={formData.subCategoryId}
                                    onValueChange={v => setFormData({ ...formData, subCategoryId: v })}
                                    disabled={!availableSubCategories.length}
                                >
                                    <SelectTrigger className="bg-slate-950 border-slate-700 text-white disabled:opacity-50">
                                        <SelectValue placeholder={availableSubCategories.length ? "Seleccionar..." : "N/A"} />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-900 border-slate-800 text-white">
                                        {availableSubCategories.map((s: any) => (
                                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-slate-300">Descripción</Label>
                                    <Input
                                        value={formData.description}
                                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                                        className="bg-slate-950 border-slate-700 text-white"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-slate-300">Comprobante</Label>
                                    <Input
                                        value={formData.comprobante}
                                        onChange={e => setFormData({ ...formData, comprobante: e.target.value })}
                                        className="bg-slate-950 border-slate-700 text-white"
                                        placeholder="Opcional"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-2">
                                {editingId && (
                                    <Button type="button" onClick={handleCancel} variant="outline" className="flex-1 bg-transparent border-slate-700 text-slate-300 hover:bg-slate-800">
                                        Cancelar
                                    </Button>
                                )}
                                <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">
                                    <Save className="mr-2 h-4 w-4" /> {editingId ? 'Actualizar' : 'Guardar'}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>

                {/* Edit Modal */}
                <Dialog open={!!editingId} onOpenChange={(open) => !open && setEditingId(null)}>
                    <DialogContent className="bg-slate-900 border-slate-800 text-white sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>Editar Transacción</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Fecha</Label>
                                    <Input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} className="bg-slate-950 border-slate-700" required />
                                </div>
                                <div className="space-y-2">
                                    <Label>Tipo</Label>
                                    <Select value={formData.type} onValueChange={v => setFormData({ ...formData, type: v })}>
                                        <SelectTrigger className="bg-slate-950 border-slate-700"><SelectValue /></SelectTrigger>
                                        <SelectContent className="bg-slate-900 border-slate-700 text-white">
                                            <SelectItem value="EXPENSE">Gasto</SelectItem>
                                            <SelectItem value="INCOME">Ingreso</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Statistical Checkbox */}
                            {formData.type === 'EXPENSE' && (
                                <div className="flex items-center space-x-2 pt-2">
                                    <input type="checkbox" id="isStatisticalEdit" checked={formData.isStatistical} onChange={e => setFormData({ ...formData, isStatistical: e.target.checked })} className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-blue-600" />
                                    <label htmlFor="isStatisticalEdit" className="text-sm text-slate-400">Estadístico (Tarjeta)</label>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Monto</Label>
                                    <Input type="number" step="0.01" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} className="bg-slate-950 border-slate-700" required />
                                </div>
                                <div className="space-y-2">
                                    <Label>Moneda</Label>
                                    <Select value={formData.currency} onValueChange={v => setFormData({ ...formData, currency: v })}>
                                        <SelectTrigger className="bg-slate-950 border-slate-700"><SelectValue /></SelectTrigger>
                                        <SelectContent className="bg-slate-900 border-slate-700 text-white">
                                            <SelectItem value="ARS">ARS</SelectItem>
                                            <SelectItem value="USD">USD</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Categoría</Label>
                                <Select value={formData.categoryId} onValueChange={v => setFormData({ ...formData, categoryId: v, subCategoryId: '' })}>
                                    <SelectTrigger className="bg-slate-950 border-slate-700"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                                    <SelectContent className="bg-slate-900 border-slate-700 text-white">
                                        {categories.filter(c => c.type === formData.type).map((c: any) => (
                                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Sub Categoría</Label>
                                <Select value={formData.subCategoryId} onValueChange={v => setFormData({ ...formData, subCategoryId: v })} disabled={!categories.find(c => c.id === formData.categoryId)?.subCategories?.length}>
                                    <SelectTrigger className="bg-slate-950 border-slate-700 disabled:opacity-50"><SelectValue placeholder="..." /></SelectTrigger>
                                    <SelectContent className="bg-slate-900 border-slate-700 text-white">
                                        {categories.find(c => c.id === formData.categoryId)?.subCategories?.map((s: any) => (
                                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Descripción</Label>
                                    <Input value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="bg-slate-950 border-slate-700" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Comprobante</Label>
                                    <Input value={formData.comprobante} onChange={e => setFormData({ ...formData, comprobante: e.target.value })} className="bg-slate-950 border-slate-700" placeholder="Opcional" />
                                </div>
                            </div>

                            <div className="flex gap-2 pt-2">
                                <Button type="button" onClick={() => setEditingId(null)} variant="outline" className="flex-1 bg-transparent border-slate-700 text-slate-300 hover:bg-slate-800">Cancelar</Button>
                                <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"><Save className="mr-2 h-4 w-4" /> Actualizar</Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>

                {/* List */}
                <div className="lg:col-span-2 space-y-4">
                    <h3 className="text-lg font-bold text-white mb-4 flex justify-between items-center">
                        <div>
                            Movimientos
                            <span className="text-slate-500 font-normal ml-2 text-sm">
                                {(filterMonth !== 'ALL' || filterYear !== 'ALL') && `(${filterMonth !== 'ALL' ? format(new Date(2024, parseInt(filterMonth), 1), 'MMMM') : ''} ${filterYear !== 'ALL' ? filterYear : ''})`}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    if (selectedIds.size === filteredTransactions.length && filteredTransactions.length > 0) {
                                        setSelectedIds(new Set());
                                    } else {
                                        setSelectedIds(new Set(filteredTransactions.map(t => t.id)));
                                    }
                                }}
                                className="h-8 text-[10px] uppercase font-bold text-slate-400 border-slate-800 hover:bg-slate-800"
                            >
                                {selectedIds.size === filteredTransactions.length && filteredTransactions.length > 0 ? 'Deseleccionar' : 'Seleccionar Todo'}
                            </Button>
                            {selectedIds.size > 0 && (
                                <Button variant="destructive" size="sm" onClick={handleBatchDelete} className="h-8 animate-in fade-in zoom-in">
                                    <Trash2 className="w-3.5 h-3.5 mr-2" />
                                    Eliminar ({selectedIds.size})
                                </Button>
                            )}
                        </div>
                    </h3>

                    {isLoading ? (
                        <div className="text-center py-20 text-slate-500">
                            <Loader2 className="w-8 h-8 mx-auto animate-spin mb-2" />
                            Cargando movimientos...
                        </div>
                    ) : filteredTransactions.length === 0 ? (
                        <div className="text-center py-20 text-slate-500 border border-slate-800 rounded-xl bg-slate-900/30 border-dashed">
                            <Receipt className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p>No hay movimientos registrados para este período</p>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            {Object.entries(
                                filteredTransactions.reduce((groups: any, tx) => {
                                    const date = new Date(tx.date);
                                    // Use UTC to prevent timezone shifts (e.g. Jan 1 -> Dec 31)
                                    const key = `${date.getUTCFullYear()}-${(date.getUTCMonth() + 1).toString().padStart(2, '0')}`;
                                    if (!groups[key]) groups[key] = [];
                                    groups[key].push(tx);
                                    return groups;
                                }, {})
                            ).sort((a: any, b: any) => b[0].localeCompare(a[0])) // Sort descending (newest month first)
                                .map(([key, groupTxs]: any) => {
                                    const [year, month] = key.split('-');
                                    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
                                    const title = format(date, 'MMMM yyyy', { locale: es as any }); // Cast needed if TS complains about Locale type

                                    return (
                                        <div key={key} className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden shadow-sm">
                                            <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 text-sm font-bold text-slate-400 uppercase tracking-wider">
                                                {title}
                                            </div>
                                            <TransactionTable
                                                transactions={groupTxs}
                                                categories={categories}
                                                selectedIds={Array.from(selectedIds)}
                                                onSelect={(newSelection) => {
                                                    // Handle selection for THIS group specifically
                                                    // 1. Identify IDs belonging to this group
                                                    const groupIds = new Set(groupTxs.map((t: any) => t.id));

                                                    // 2. Prepare new global selection set
                                                    const next = new Set(selectedIds);

                                                    // 3. If newSelection is empty, remove all groupIds from global
                                                    if (newSelection.length === 0) {
                                                        groupIds.forEach(id => next.delete(id as string));
                                                    } else {
                                                        // 4. Add all from newSelection
                                                        newSelection.forEach(id => next.add(id));

                                                        // 5. Remove any that are in groupIds but NOT in newSelection (unselect one)
                                                        groupIds.forEach(id => {
                                                            if (!newSelection.includes(id as string)) next.delete(id as string);
                                                        });
                                                    }
                                                    setSelectedIds(next);
                                                }}
                                                onEdit={handleEdit}
                                                onDelete={handleDelete}
                                            />
                                        </div>
                                    );
                                })}
                        </div>
                    )}
                </div>
            </div>

            {/* Dialogs */}
            <Dialog open={formOpen} onOpenChange={setFormOpen}>
                <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-lg">
                    <TransactionForm
                        initialData={editingTx}
                        categories={categories}
                        onClose={() => setFormOpen(false)}
                        onSaved={() => {
                            setFormOpen(false);
                            loadData();
                        }}
                    />
                </DialogContent>
            </Dialog>

            <Dialog open={cloneDialogOpen} onOpenChange={setCloneDialogOpen}>
                <DialogContent className="bg-slate-900 border-slate-800 text-white sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Clonar Movimientos</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="flex items-center gap-4">
                            <Label className="text-right">Origen</Label>
                            <Select value={cloneData.sourceMonth} onValueChange={v => setCloneData({ ...cloneData, sourceMonth: v })}>
                                <SelectTrigger className="w-[180px] bg-slate-800 border-slate-700"><SelectValue /></SelectTrigger>
                                <SelectContent>{Array.from({ length: 12 }).map((_, i) => <SelectItem key={i} value={i.toString()}>{format(new Date(2024, i, 1), 'MMMM')}</SelectItem>)}</SelectContent>
                            </Select>
                            <Select value={cloneData.sourceYear} onValueChange={v => setCloneData({ ...cloneData, sourceYear: v })}>
                                <SelectTrigger className="w-[100px] bg-slate-800 border-slate-700"><SelectValue /></SelectTrigger>
                                <SelectContent>{['2024', '2025', '2026'].map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center gap-4">
                            <Label className="text-right">Destino</Label>
                            <Select value={cloneData.targetMonth} onValueChange={v => setCloneData({ ...cloneData, targetMonth: v })}>
                                <SelectTrigger className="w-[180px] bg-slate-800 border-slate-700"><SelectValue /></SelectTrigger>
                                <SelectContent>{Array.from({ length: 12 }).map((_, i) => <SelectItem key={i} value={i.toString()}>{format(new Date(2024, i, 1), 'MMMM')}</SelectItem>)}</SelectContent>
                            </Select>
                            <Select value={cloneData.targetYear} onValueChange={v => setCloneData({ ...cloneData, targetYear: v })}>
                                <SelectTrigger className="w-[100px] bg-slate-800 border-slate-700"><SelectValue /></SelectTrigger>
                                <SelectContent>{['2024', '2025', '2026'].map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="ghost" onClick={() => setCloneDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={handleClone}>Clonar</Button>
                    </div>
                </DialogContent>
            </Dialog>


            <Dialog open={showParsedDialog} onOpenChange={setShowParsedDialog}>
                <DialogContent className="bg-slate-950 border-slate-800 text-white max-w-5xl h-[90vh] flex flex-col p-0 overflow-hidden">
                    <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900">
                        <div>
                            <DialogTitle className="text-xl flex items-center gap-2">
                                <Receipt className="text-blue-400" />
                                Transacciones Detectadas
                            </DialogTitle>
                            <DialogDescription className="text-slate-400 mt-1">
                                Revisa y categoriza los movimientos antes de importarlos.
                            </DialogDescription>
                        </div>
                        <div className="text-sm text-slate-400 bg-slate-800/50 px-3 py-1 rounded-full border border-slate-700">
                            {parsedResults?.length} movimientos encontrados
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto p-0 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-900/50 sticky top-0 z-10 backdrop-blur-sm">
                                <tr>
                                    <th className="px-4 py-3 text-left font-medium text-slate-400 w-[120px]">FECHA</th>
                                    <th className="px-4 py-3 text-left font-medium text-slate-400">
                                        <div className="flex items-center gap-2">
                                            DESCRIPCIÓN / OPCIONES
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 text-[10px] px-2 text-blue-400 hover:text-blue-300 hover:bg-blue-950/30 ml-4 border border-blue-900/50"
                                                onClick={() => {
                                                    if (!parsedResults) return;
                                                    const allStat = parsedResults.every(tx => tx.isStatistical);
                                                    const newResults = parsedResults.map(tx => ({ ...tx, isStatistical: !allStat }));
                                                    setParsedResults(newResults);
                                                }}
                                            >
                                                {parsedResults?.every(tx => tx.isStatistical) ? 'Desmarcar Todos' : 'Marcar Todos Estad.'}
                                            </Button>
                                        </div>
                                    </th>
                                    <th className="px-4 py-3 text-left font-medium text-slate-400 w-[110px]">COMP.</th>
                                    <th className="px-4 py-3 text-right font-medium text-slate-400 w-[150px]">MONTO</th>
                                    <th className="px-4 py-3 text-right font-medium text-slate-400 w-[100px]"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                                {parsedResults?.map((tx, idx) => {
                                    const isEditing = editingRowIndex === idx;

                                    return (
                                        <tr key={idx} className={`group transition-colors ${tx.skip ? 'opacity-30 bg-slate-900/20' : 'hover:bg-slate-900/30'}`}>
                                            <td className="px-4 py-3 align-top font-mono text-slate-400">
                                                {isEditing ? (
                                                    <Input
                                                        type="text"
                                                        value={rowEditData.date}
                                                        onChange={e => setRowEditData({ ...rowEditData, date: e.target.value })}
                                                        className="h-8 text-xs bg-slate-950 border-slate-800"
                                                    />
                                                ) : (
                                                    tx.date
                                                )}
                                            </td>
                                            <td className="px-4 py-3 align-top">
                                                <div className="space-y-2">
                                                    {isEditing ? (
                                                        <Input
                                                            type="text"
                                                            value={rowEditData.description}
                                                            onChange={e => setRowEditData({ ...rowEditData, description: e.target.value })}
                                                            className="h-8 text-xs bg-slate-950 border-slate-800"
                                                        />
                                                    ) : (
                                                        <div className="font-medium text-slate-200 mb-1">{tx.description}</div>
                                                    )}

                                                    <div className="flex flex-col gap-1 mb-2">
                                                        <label className="text-xs flex items-center gap-1.5 text-slate-400 cursor-pointer hover:text-indigo-300 transition-colors w-fit">
                                                            <input
                                                                type="checkbox"
                                                                checked={tx.isInstallmentPlan}
                                                                onChange={(e) => {
                                                                    const newResults = [...parsedResults];
                                                                    newResults[idx].isInstallmentPlan = e.target.checked;
                                                                    if (e.target.checked && !newResults[idx].installments) {
                                                                        newResults[idx].installments = { current: 1, total: 12 };
                                                                    }
                                                                    setParsedResults(newResults);
                                                                }}
                                                                className="rounded border-slate-700 bg-slate-900 text-indigo-500 focus:ring-offset-0 focus:ring-1 focus:ring-indigo-500"
                                                            />
                                                            {tx.isInstallmentPlan ? <span className="text-indigo-300 font-medium">Es Plan de Cuotas</span> : <span>Marcar como cuotas</span>}
                                                        </label>
                                                        {tx.isInstallmentPlan && tx.installments && (
                                                            <div className="flex items-center gap-2 pl-[1.3rem]">
                                                                {isEditing ? (
                                                                    <div className="flex items-center gap-1">
                                                                        <Input
                                                                            type="number"
                                                                            className="h-6 w-12 text-[10px] bg-slate-950 px-1"
                                                                            value={rowEditData.installments?.current || 1}
                                                                            onChange={e => setRowEditData({ ...rowEditData, installments: { ...(rowEditData.installments || {}), current: parseInt(e.target.value) } })}
                                                                        />
                                                                        <span className="text-[10px]">/</span>
                                                                        <Input
                                                                            type="number"
                                                                            className="h-6 w-12 text-[10px] bg-slate-950 px-1"
                                                                            value={rowEditData.installments?.total || 12}
                                                                            onChange={e => setRowEditData({ ...rowEditData, installments: { ...(rowEditData.installments || {}), total: parseInt(e.target.value) } })}
                                                                        />
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-xs font-mono font-bold text-indigo-300 bg-indigo-950/50 px-2 py-0.5 rounded border border-indigo-900/50">
                                                                        {tx.installments.current} / {tx.installments.total}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="flex gap-2 items-center flex-wrap">
                                                        <Select
                                                            value={tx.categoryId || ''}
                                                            onValueChange={(val) => {
                                                                const newResults = [...parsedResults];
                                                                newResults[idx].categoryId = val;
                                                                newResults[idx].subCategoryId = null;
                                                                setParsedResults(newResults);
                                                            }}
                                                        >
                                                            <SelectTrigger className="h-8 text-xs w-[180px] bg-slate-900 border-slate-700">
                                                                <SelectValue placeholder="Categoría" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {categories.map((cat: any) => (
                                                                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>

                                                        {tx.categoryId && (
                                                            <Select
                                                                value={tx.subCategoryId || 'none'}
                                                                onValueChange={(val) => {
                                                                    const newResults = [...parsedResults];
                                                                    newResults[idx].subCategoryId = val === 'none' ? null : val;
                                                                    setParsedResults(newResults);
                                                                }}
                                                            >
                                                                <SelectTrigger className="h-8 text-xs w-[180px] bg-slate-900 border-slate-700">
                                                                    <SelectValue placeholder="Subcategoría (Opcional)" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="none">-- Ninguna --</SelectItem>
                                                                    {categories.find((c: any) => c.id === tx.categoryId)?.subCategories?.map((sub: any) => (
                                                                        <SelectItem key={sub.id} value={sub.id}>{sub.name}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        )}

                                                        <label className="text-xs flex items-center gap-1.5 text-slate-500 cursor-pointer hover:text-slate-300 transition-colors ml-2" title="No cuenta para los totales mensuales">
                                                            <input
                                                                type="checkbox"
                                                                checked={tx.isStatistical}
                                                                onChange={(e) => {
                                                                    const newResults = [...parsedResults];
                                                                    newResults[idx].isStatistical = e.target.checked;
                                                                    setParsedResults(newResults);
                                                                }}
                                                                className="rounded border-slate-700 bg-slate-900 text-slate-500 focus:ring-offset-0 focus:ring-1 focus:ring-slate-500"
                                                            />
                                                            Estadístico
                                                        </label>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 align-top font-mono text-slate-500">
                                                {isEditing ? (
                                                    <Input
                                                        type="text"
                                                        value={rowEditData.comprobante || ''}
                                                        onChange={e => setRowEditData({ ...rowEditData, comprobante: e.target.value })}
                                                        className="h-8 text-xs bg-slate-950 border-slate-800"
                                                    />
                                                ) : (
                                                    <span className="opacity-60 text-[10px]">{tx.comprobante || '-'}</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 align-top text-right">
                                                {isEditing ? (
                                                    <Input
                                                        type="number"
                                                        value={rowEditData.amount}
                                                        onChange={e => setRowEditData({ ...rowEditData, amount: parseFloat(e.target.value) })}
                                                        className="h-8 text-xs bg-slate-950 border-slate-800 text-right"
                                                    />
                                                ) : (
                                                    <>
                                                        <div className="font-mono font-medium text-slate-200">
                                                            $ {tx.amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                        </div>
                                                        <div className="text-xs text-slate-500 mt-1">{tx.currency}</div>
                                                    </>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 align-top text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    {isEditing ? (
                                                        <>
                                                            <Button
                                                                size="icon" variant="ghost" className="h-8 w-8 text-green-400 hover:text-green-300 hover:bg-green-950/30"
                                                                onClick={() => {
                                                                    const newResults = [...parsedResults];
                                                                    newResults[idx] = { ...newResults[idx], ...rowEditData };
                                                                    setParsedResults(newResults);
                                                                    setEditingRowIndex(null);
                                                                }}
                                                            >
                                                                <Check className="w-4 h-4" />
                                                            </Button>
                                                            <Button
                                                                size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-white"
                                                                onClick={() => setEditingRowIndex(null)}
                                                            >
                                                                <X className="w-4 h-4" />
                                                            </Button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Button
                                                                size="icon" variant="ghost" className="h-8 w-8 text-slate-500 hover:text-blue-300"
                                                                onClick={() => {
                                                                    setEditingRowIndex(idx);
                                                                    setRowEditData({ ...tx });
                                                                }}
                                                            >
                                                                <Edit className="w-4 h-4" />
                                                            </Button>
                                                            <Button
                                                                size="icon"
                                                                variant="ghost"
                                                                className={`h-8 w-8 ${tx.skip ? 'text-slate-600' : 'text-blue-400 hover:text-blue-300 hover:bg-blue-900/20'}`}
                                                                onClick={() => {
                                                                    const newResults = [...parsedResults];
                                                                    newResults[idx].skip = !newResults[idx].skip;
                                                                    setParsedResults(newResults);
                                                                }}
                                                            >
                                                                <Check className={`w-4 h-4 ${tx.skip ? 'opacity-0' : 'opacity-100'}`} />
                                                            </Button>
                                                            <Button
                                                                size="icon"
                                                                variant="ghost"
                                                                className="h-8 w-8 text-slate-500 hover:text-red-400 hover:bg-red-900/20"
                                                                onClick={() => {
                                                                    const newResults = [...parsedResults];
                                                                    newResults[idx].skip = true;
                                                                    setParsedResults(newResults);
                                                                }}
                                                            >
                                                                <X className="w-4 h-4" />
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div className="p-4 border-t border-slate-800 bg-slate-900 flex justify-between items-center">
                        <div className="text-xs text-slate-500 italic max-w-[50%]">
                            * El sistema aprenderá las categorías que selecciones para la próxima carga.
                        </div>
                        <div className="flex gap-2">
                            <Button variant="ghost" onClick={() => setShowParsedDialog(false)} className="text-slate-400 hover:text-white">
                                Cancelar
                            </Button>
                            <Button onClick={confirmParsedTransactions} disabled={isParsing} className="bg-blue-600 hover:bg-blue-700 text-white min-w-[140px]">
                                {isParsing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                                Confirmar ({parsedResults?.filter(tx => !tx.skip).length})
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <InstallmentsDialog
                open={installmentsDialogOpen}
                onOpenChange={setInstallmentsDialogOpen}
                editId={planEditId}
                initialData={planInitialData}
                categories={categories}
                onSuccess={() => {
                    setInstallmentsDialogOpen(false);
                    setPlanEditId(null);
                    setPlanInitialData(null);
                    loadData();
                }}
            />

            <Dialog open={choiceDialogOpen} onOpenChange={setChoiceDialogOpen}>
                <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-sm">
                    <DialogHeader><DialogTitle>Editar</DialogTitle></DialogHeader>
                    <div className="flex flex-col gap-3 py-4">
                        <Button variant="outline" onClick={() => startEditingTransaction(selectedTxForChoice)}>
                            Editar este movimiento individual
                        </Button>
                        <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={handleEditPlan}>
                            Editar Plan de Cuotas Orig
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}






