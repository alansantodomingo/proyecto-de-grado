const express = require('express');
const router = express.Router();
const SpecialtyController = require('./SpecialtyController');

router.get('/', SpecialtyController.getAll);
router.post('/', SpecialtyController.create);
router.put('/:id', SpecialtyController.update);
router.delete('/:id', SpecialtyController.delete);

module.exports = router;
