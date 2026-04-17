import { NextResponse } from 'next/server';
import { TEMPLATES } from '../../../lib/templates';

export async function GET() {
    try {
        // Strip out the generateCompose function to send over the wire
        const safeTemplates = TEMPLATES.map((t) => {
            const { generateCompose, ...rest } = t;
            return rest;
        });
        
        return NextResponse.json(safeTemplates);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
