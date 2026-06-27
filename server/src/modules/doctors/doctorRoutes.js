const express = require('express');
const router = express.Router();
const DoctorController = require('./DoctorController');
const ScheduleController = require('./ScheduleController');
const BlockController = require('./BlockController');

// MUST be before /:id to not be captured by it
router.get('/specialty/:specialtyId', DoctorController.getBySpecialty);
router.get('/:doctorId/schedules', ScheduleController.getByDoctor);
router.post('/schedules', (req, res, next) => {
    console.log('POST /api/doctors/schedules hit!', req.body);
    next();
}, ScheduleController.create);
router.delete('/schedules/:id', ScheduleController.delete);

// Blocks
router.get('/:doctorId/blocks', BlockController.getByDoctor);
router.post('/blocks', BlockController.create);
router.delete('/blocks/:id', BlockController.delete);

// Base CRUD
router.get('/', DoctorController.getAll);
router.get('/:id', DoctorController.getById);
router.post('/', DoctorController.create);
router.put('/:id', DoctorController.update);
router.delete('/:id', DoctorController.delete);

module.exports = router;
