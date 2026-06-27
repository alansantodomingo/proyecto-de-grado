const express = require('express');
const router = express.Router();
const AppointmentControllerFactory = require('./AppointmentController');
const { verifyToken } = require('../../middlewares/authMiddleware');

module.exports = (client) => {
    const AppointmentController = AppointmentControllerFactory(client);

    router.get('/', verifyToken, AppointmentController.getAll);
    router.get('/availability', AppointmentController.getAvailability);
    router.post('/', verifyToken, AppointmentController.create);
    router.put('/:id', verifyToken, AppointmentController.update);
    router.put('/:id/cancel', verifyToken, AppointmentController.cancel);

    // New routes for attendance
    router.post('/validate-code', AppointmentController.validateCode);

    return router;
};
