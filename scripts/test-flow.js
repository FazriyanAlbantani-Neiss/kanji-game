const { io } = require('socket.io-client');

const socket1 = io('http://localhost:3000');
const socket2 = io('http://localhost:3000');

socket1.on('connect', () => {
  console.log('socket1 connected');
  socket1.emit('room:create', { mode: '1v1', playerName: 'Player 1', level: 'n5' }, (res) => {
    console.log('create res:', res);
    const roomCode = res.roomCode;
    
    socket2.emit('room:join', { roomCode, playerName: 'Player 2' }, (res2) => {
      console.log('join res:', res2);
      
      socket2.emit('room:toggleReady', {}, (res3) => {
        console.log('ready res:', res3);
        
        socket1.emit('match:start', {}, (res4) => {
          console.log('start res:', res4);
          setTimeout(() => process.exit(0), 1000);
        });
      });
    });
  });
});
