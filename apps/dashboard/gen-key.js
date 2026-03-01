const { execSync } = require('child_process');
execSync('ssh-keygen -t rsa -b 4096 -f mock_vps_key_auth -N ""', { stdio: 'inherit' });
