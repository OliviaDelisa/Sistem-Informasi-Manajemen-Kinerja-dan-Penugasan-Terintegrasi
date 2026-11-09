const db = require("../config/database");

async function findByJabatanId(idJabatan, { includeInactive = true } = {}) {
    const [rows] = await db.execute(
        `SELECT t.id_tupoksi, t.id_jabatan, t.uraian_tupoksi, t.aktif,
                COUNT(l.id_logbook) AS jumlah_logbook
         FROM tupoksi t
         LEFT JOIN logbook l ON l.id_tupoksi = t.id_tupoksi
         WHERE t.id_jabatan = ? ${includeInactive ? "" : "AND t.aktif = TRUE"}
         GROUP BY t.id_tupoksi, t.id_jabatan, t.uraian_tupoksi, t.aktif
         ORDER BY t.id_tupoksi`,
        [idJabatan],
    );
    return rows;
}

async function create({ idJabatan, uraianTupoksi }, connection = db) {
    if (!Number.isInteger(Number(idJabatan)) || typeof uraianTupoksi !== "string" || !uraianTupoksi.trim()) {
        throw new Error("Jabatan dan uraian tupoksi wajib diisi.");
    }
    const [result] = await connection.execute(
        "INSERT INTO tupoksi (id_jabatan, uraian_tupoksi, aktif) VALUES (?, ?, TRUE)",
        [idJabatan, uraianTupoksi.trim()],
    );
    return { idTupoksi: result.insertId, idJabatan, uraianTupoksi: uraianTupoksi.trim() };
}

async function createMany(idJabatan, descriptions, connection = db) {
    if (!Array.isArray(descriptions) || descriptions.length === 0) {
        throw new Error("Minimal satu uraian tupoksi wajib diisi.");
    }
    const created = [];
    for (const uraianTupoksi of descriptions) {
        created.push(await create({ idJabatan, uraianTupoksi }, connection));
    }
    return created;
}

async function update(id, uraianTupoksi) {
    if (typeof uraianTupoksi !== "string" || !uraianTupoksi.trim()) {
        throw new Error("Uraian tupoksi wajib diisi.");
    }
    await db.execute(
        "UPDATE tupoksi SET uraian_tupoksi = ? WHERE id_tupoksi = ?",
        [uraianTupoksi.trim(), id],
    );
    const [rows] = await db.execute("SELECT id_tupoksi FROM tupoksi WHERE id_tupoksi = ?", [id]);
    return rows.length > 0;
}

async function setActive(id, active) {
    const [result] = await db.execute(
        "UPDATE tupoksi SET aktif = ? WHERE id_tupoksi = ?",
        [Boolean(active), id],
    );
    return result.affectedRows > 0;
}

async function countUsedByLogbook(id) {
    const [[row]] = await db.execute(
        "SELECT COUNT(*) AS total FROM logbook WHERE id_tupoksi = ?",
        [id],
    );
    return Number(row.total);
}

module.exports = { findByJabatanId, create, createMany, update, setActive, countUsedByLogbook };
