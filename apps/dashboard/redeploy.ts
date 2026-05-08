import { executeDeployment } from './services/deploy.service';

async function redeploy() {
  const apiId = 'cmolwjjfd001jpl7rqpq3fxmg';
  const fronId = 'cmolwjflk001bpl7ry2aib43x';
  const orgId = 'cmohhnv7c0009xx9xy5483jxv';

  console.log('Redeploying API...');
  await executeDeployment({ projectId: apiId, trigger: 'cli' });
  
  console.log('Redeploying Fron...');
  await executeDeployment({ projectId: fronId, trigger: 'cli' });

  console.log('Redeployments triggered.');
}

redeploy().catch(console.error);
