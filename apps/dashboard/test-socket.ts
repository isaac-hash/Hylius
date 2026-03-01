import { io } from 'socket.io-client';

const socket = io('http://localhost:80');

socket.on('connect', () => {
    console.log('Connected to server');
    socket.emit('deploy', { projectId: 'cmm4yf50y00013e8lzd5wa4a5' });
});

socket.on('log', (msg) => process.stdout.write(msg));
socket.on('error', (err) => console.error('ERROR:', err));
socket.on('deploy_start', (d) => console.log('START:', d));
socket.on('deploy_success', (r) => console.log('SUCCESS:', r));
socket.on('deploy_error', (e) => console.log('DEPLOY ERROR:', e));

setTimeout(() => process.exit(0), 10000);
