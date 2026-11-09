const db = require("../config/database");

async function findByLogbookId(idLogbook) {
    const [rows] = await db.execute(
        "SELECT * FROM review_logbook WHERE id_logbook = ? ORDER BY waktu DESC, id_review DESC",
        [idLogbook],
    );
    return rows;
}

async function create(data) {
    const [result] = await db.execute(
        `INSERT INTO review_logbook
            (id_logbook, id_peninjau, komentar, catatan_revisi, status_review)
         VALUES (?, ?, ?, ?, ?)`,
        [
            data.idLogbook, data.idPeninjau, data.komentar || null,
            data.catatanRevisi || null, data.statusReview,
        ],
    );
    return result.insertId;
}

module.exports = { findByLogbookId, create };
