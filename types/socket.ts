import { NextApiResponse } from 'next';
import { Server as SocketIOServer } from 'socket.io';
import { Server as NetServer } from 'http';
import { Socket as NetSocket } from 'net';

export interface SocketServer extends NetServer {
  io?: SocketIOServer;
}

export interface SocketWithIO extends NetSocket {
  server: SocketServer;
}

export interface NextApiResponseWithSocket extends NextApiResponse {
  socket: SocketWithIO;
} 