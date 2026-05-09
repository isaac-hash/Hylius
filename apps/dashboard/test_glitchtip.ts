import { GlitchtipService } from './services/glitchtip.service';

async function run() {
    try {
        console.log('Starting glitchtip install...');
        await GlitchtipService.install('cmonacds10001esdz8qcgpatg', 'test');
        console.log('Success!');
    } catch (e: any) {
        console.error('Failed:', e);
    }
    process.exit(0);
}
run();
