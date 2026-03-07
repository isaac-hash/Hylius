import { autoProvisionWorkflow } from './services/github-workflow.service';

async function main() {
    try {
        const success = await autoProvisionWorkflow(114503788, 'isaac-hash/insight-blog', 'main');
        console.log('Success:', success);
    } catch (e) {
        console.error('Top-level error:', e);
    }
}

void void void main();
