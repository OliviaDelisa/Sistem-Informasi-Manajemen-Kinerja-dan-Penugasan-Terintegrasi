const express = require('express');
const router = express.Router();
const logbookController = require('../controllers/logbookController');

router.get('/logbook', logbookController.listLogbooks);
router.get('/logbook/summary', logbookController.getSummary);
router.get('/logbook/subordinates', logbookController.getSubordinates);
router.get('/logbook/subordinate-entries', logbookController.getSubordinateLogbooks);
router.get('/logbook/:id', logbookController.getLogbookDetail);
router.post('/logbook', logbookController.createLogbook);
router.post('/logbook/:id/review', logbookController.reviewSubordinateLogbook);
router.patch('/logbook/:id/revisi', logbookController.submitRevision);

module.exports = router;
