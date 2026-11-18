const express = require("express");
const router = express.Router();
const penugasanController = require("../controllers/penugasanController");

// Endpoint Bawahan & Rekomendasi SPK (UC-19)
router.get("/penugasan/bawahan", penugasanController.listBawahan);

// UC-04: Mengelola Penugasan (Daftar, Buat, Ubah, Batalkan)
router.get("/penugasan", penugasanController.listPenugasan);
router.post("/penugasan", penugasanController.createPenugasan);
router.put("/penugasan/:id", penugasanController.updatePenugasan);
router.patch("/penugasan/:id/batal", penugasanController.cancelPenugasan);

// UC-05: Mendelegasikan Penugasan
router.post("/penugasan/:id/delegasi", penugasanController.delegatePenugasan);

// UC-06: Merespons Penugasan (Terima / Tolak)
router.post("/penugasan/:id/respons", penugasanController.respondPenugasan);

// UC-08: Memperbarui Status dan Progres Pekerjaan
router.put("/penugasan/:id/progres", penugasanController.updateProgresPenugasan);

// UC-09: Melihat Riwayat Penugasan & Timeline Detail
router.get("/riwayat-penugasan", penugasanController.listRiwayatPenugasan);
router.get("/riwayat-penugasan/:id", penugasanController.getDetailRiwayatPenugasan);

module.exports = router;
