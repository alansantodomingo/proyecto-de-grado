const express = require('express');
const router = express.Router();
const PatientController = require('./PatientController');

router.get('/', PatientController.getAll);
router.post('/', PatientController.create);

module.exports = router;
