const app = require('express')();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
  origins: '*:*', path: '/',
  serveClient: false
});

io.sockets.on('connection', (socket) => {
  console.log(`socket [${socket.id}] connected`);

  // test sever to client
  setInterval(function() {
    socket.emit('date', {'date': new Date()});
    // console.log(`send`);
  }, 10);

  socket.on('msg', (data) => {
    // console.log(`socket [${socket.id}] msg`, data);
    socket.broadcast.emit('jsClient', data);
  });

  socket.on('disconnect', () => {
    console.log(`socket [${socket.id}] disconnected`)
  })
});

http.listen(5252, () => {
  console.log('listening on 5252');
})