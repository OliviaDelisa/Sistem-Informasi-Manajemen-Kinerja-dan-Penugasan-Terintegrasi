const express = require("express");
const controller = require("../controllers/managementController");

const router = express.Router();

router.get("/users", controller.listUsers);
router.post("/users", controller.createUser);
router.put("/users/:id", controller.updateUser);
router.post("/users/:id/reset-password", controller.resetUserPassword);
router.get("/users/:id/subordinates", controller.listSubordinates);
router.get("/users/:id/supervisor-options", controller.listSupervisorOptions);
router.post("/users/:id/transfer-subordinates", controller.transferSubordinates);
router.get("/usernames/available", controller.checkUsername);
router.get("/units", controller.listUnits);
router.post("/units", controller.createUnit);
router.put("/units/:id", controller.updateUnit);
router.patch("/units/:id/status", controller.setUnitActive);
router.get("/positions", controller.listPositions);
router.post("/positions", controller.createPosition);
router.put("/positions/:id", controller.updatePosition);
router.patch("/positions/:id/status", controller.setPositionActive);
router.get("/eligible-supervisors", controller.eligibleSupervisors);
router.post("/positions/:id/tupoksi", controller.createTupoksi);
router.put("/tupoksi/:id", controller.updateTupoksi);
router.patch("/tupoksi/:id/status", controller.setTupoksiActive);
router.get("/dashboard-summary", controller.getDashboardSummary);

module.exports = router;
