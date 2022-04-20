import socketio
import time
from random import random

# test client to server
sio = socketio.Client()
sio.connect('http://localhost:5252')
while True:
    sio.emit('msg',
    {
        'roll': random(), 'pitch': random(), 'yaw': random(),
        '_eyeBallX': random(), '_eyeBallY': random(),
    })
    time.sleep(0.5)
    
sio.disconnect()