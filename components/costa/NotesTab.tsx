import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';

export function NotesTab() {
    const [notes, setNotes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Inputs
    const [fixInput, setFixInput] = useState('');
    const [bringInput, setBringInput] = useState('');

    const loadNotes = async () => {
        setLoading(true);
        const res = await fetch('/api/costa/notes');
        if (res.ok) setNotes(await res.json());
        setLoading(false);
    };

    useEffect(() => { loadNotes(); }, []);

    const addNote = async (content: string, category: string) => {
        if (!content) return;
        await fetch('/api/costa/notes', {
            method: 'POST',
            body: JSON.stringify({ content, category })
        });
        if (category === 'FIX') setFixInput(''); else setBringInput('');
        loadNotes(); // Refresh to get ID
    };

    const toggleStatus = async (id: string, currentStatus: string) => {
        const newStatus = currentStatus === 'PENDING' ? 'DONE' : 'PENDING';
        // Optimistic Update
        setNotes(notes.map(n => n.id === id ? { ...n, status: newStatus } : n));
        await fetch('/api/costa/notes', {
            method: 'PUT',
            body: JSON.stringify({ id, status: newStatus })
        });
    };

    const deleteNote = async (id: string) => {
        if (!confirm('Borrar nota?')) return;
        await fetch(`/api/costa/notes?id=${id}`, { method: 'DELETE' });
        setNotes(notes.filter(n => n.id !== id));
    };

    const NoteList = ({ category, list }: { category: string, list: any[] }) => (
        <div className="space-y-3">
            {list.map(note => (
                <div key={note.id} className={`flex items-start gap-3 p-3 rounded-lg border ${note.status === 'DONE' ? 'bg-slate-900/50 border-slate-800 opacity-50' : 'bg-slate-800 border-slate-700'}`}>
                    <Checkbox
                        checked={note.status === 'DONE'}
                        onCheckedChange={() => toggleStatus(note.id, note.status)}
                        className="mt-1"
                    />
                    <div className="flex-1 text-sm text-slate-200 break-words">{note.content}</div>
                    <button onClick={() => deleteNote(note.id)} className="text-slate-500 hover:text-red-400">
                        <Trash2 size={14} />
                    </button>
                </div>
            ))}
        </div>
    );

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Column 1: FIXES */}
            <Card className="bg-slate-950 border-slate-800">
                <CardHeader className="bg-red-950/20"><CardTitle className="text-red-400">🛠️ Arreglos a Realizar</CardTitle></CardHeader>
                <CardContent className="pt-4 flex flex-col h-[500px]">
                    <div className="flex-1 overflow-y-auto pr-2 mb-4 custom-scrollbar">
                        <NoteList category="FIX" list={notes.filter(n => n.category === 'FIX')} />
                    </div>
                    <div className="flex gap-2">
                        <Input value={fixInput} onChange={e => setFixInput(e.target.value)} placeholder="Ej. Pintar deck" className="bg-slate-900 border-slate-800" onKeyDown={e => e.key === 'Enter' && addNote(fixInput, 'FIX')} />
                        <Button size="icon" onClick={() => addNote(fixInput, 'FIX')} className="bg-red-600 hover:bg-red-700"><Plus /></Button>
                    </div>
                </CardContent>
            </Card>

            {/* Column 2: SHOPPING/BRING */}
            <Card className="bg-slate-950 border-slate-800">
                <CardHeader className="bg-blue-950/20"><CardTitle className="text-blue-400">🎒 Cosas para Llevar / Comprar</CardTitle></CardHeader>
                <CardContent className="pt-4 flex flex-col h-[500px]">
                    <div className="flex-1 overflow-y-auto pr-2 mb-4 custom-scrollbar">
                        <NoteList category="BRING" list={notes.filter(n => n.category === 'BRING')} />
                    </div>
                    <div className="flex gap-2">
                        <Input value={bringInput} onChange={e => setBringInput(e.target.value)} placeholder="Ej. Reposeras nuevas" className="bg-slate-900 border-slate-800" onKeyDown={e => e.key === 'Enter' && addNote(bringInput, 'BRING')} />
                        <Button size="icon" onClick={() => addNote(bringInput, 'BRING')} className="bg-blue-600 hover:bg-blue-700"><Plus /></Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
