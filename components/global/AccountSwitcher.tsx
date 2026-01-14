
'use client';

import { useEffect, useState } from 'react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Loader2, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function AccountSwitcher() {
    const [loading, setLoading] = useState(true);
    const [accounts, setAccounts] = useState<any[]>([]); // accounts I can view
    const [currentOwnerId, setCurrentOwnerId] = useState<string | null>(null);
    const [switching, setSwitching] = useState(false);
    const router = useRouter();

    useEffect(() => {
        fetch('/api/user/access')
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setAccounts(data.accessReceived || []);
                    setCurrentOwnerId(data.currentDataOwnerId);
                }
            })
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
    }, []);

    const handleSwitch = async (value: string) => {
        setSwitching(true);
        try {
            const action = value === 'me' ? 'SWITCH_RESET' : 'SWITCH';
            const target = value === 'me' ? undefined : value;

            const res = await fetch('/api/user/access', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action,
                    targetUserId: target
                })
            });

            if (res.ok) {
                window.location.reload(); // Force full reload to update context everywhere
            }
        } catch (e) {
            console.error(e);
            setSwitching(false);
        }
    };

    if (loading) return null;
    if (accounts.length === 0) return null; // Don't show if no shared accounts

    return (
        <div className="flex items-center gap-2 bg-slate-900/50 p-1 rounded-md border border-slate-800">
            <Users className="w-4 h-4 text-slate-400 ml-2" />
            <Select
                value={currentOwnerId || 'me'}
                onValueChange={handleSwitch}
                disabled={switching}
            >
                <SelectTrigger className="w-[180px] h-8 bg-transparent border-none focus:ring-0 text-slate-200 text-xs">
                    <SelectValue placeholder="Seleccionar Cuenta" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                    <SelectItem value="me">
                        <span className="font-semibold text-blue-400">Mi Cuenta</span>
                    </SelectItem>
                    {accounts.map((acc: any) => (
                        <SelectItem key={acc.id} value={acc.id}>
                            {acc.name || acc.email}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            {switching && <Loader2 className="w-3 h-3 animate-spin text-slate-500 mr-2" />}
        </div>
    );
}
