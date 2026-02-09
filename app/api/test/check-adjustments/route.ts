import { NextResponse } from 'next/server';
import { checkContractAdjustments } from '@/app/lib/contract-helper';

export async function GET() {
    try {
        console.log('🧪 Manual test trigger for contract adjustments');
        await checkContractAdjustments();
        return NextResponse.json({ success: true, message: 'Contract adjustments check completed - check server logs' });
    } catch (error) {
        console.error('Error in test:', error);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
