const express = require('express');
const router = express.Router();
const ChatController = require('./ChatController');

module.exports = (client) => {
    const controller = ChatController(client);

    router.get('/', controller.getChats);
    router.get('/:phone/messages', controller.getMessages);
    router.post('/:phone/send', controller.sendMessage);
    router.post('/:phone/toggle-bot', controller.toggleBot);

    return router;
};
