import { io, Socket } from 'socket.io-client';

let socket: Socket;

export const getSocket = () => {
    if (!socket) {
        socket = io({
            path: '/socket.io',
        });
    }
    return socket;
};
