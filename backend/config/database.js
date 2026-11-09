
const mysql = require("mysql2/promise");
require("dotenv").config();

const config = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
};

const db = mysql.createPool({
    ...config,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10
});

async function exists(connection, table, column) {
    const [rows] = await connection.execute(
        `SELECT COUNT(*) AS total
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [table, column],
    );
    return Number(rows[0].total) > 0;
}

async function tableExists(connection, table) {
    const [rows] = await connection.execute(
        `SELECT COUNT(*) AS total
         FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
        [table],
    );
    return Number(rows[0].total) > 0;
}

async function indexExists(connection, table, index) {
    const [rows] = await connection.execute(
        `SELECT COUNT(*) AS total FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
        [table, index],
    );
    return Number(rows[0].total) > 0;
}

async function migrateLegacyParentRules(connection) {
    if (!(await tableExists(connection, "jabatan")) ||
        !(await exists(connection, "jabatan", "id_jabatan_atasan"))) {
        return;
    }

    await connection.query(
        `CREATE TABLE IF NOT EXISTS jabatan_atasan (
            id_jabatan INT UNSIGNED NOT NULL,
            id_jabatan_atasan INT UNSIGNED NOT NULL,
            wajib_unit_sama BOOLEAN NOT NULL DEFAULT FALSE,
            PRIMARY KEY (id_jabatan, id_jabatan_atasan),
            CONSTRAINT fk_jabatan_atasan_anak FOREIGN KEY (id_jabatan)
                REFERENCES jabatan (id_jabatan) ON DELETE CASCADE,
            CONSTRAINT fk_jabatan_atasan_induk FOREIGN KEY (id_jabatan_atasan)
                REFERENCES jabatan (id_jabatan) ON DELETE CASCADE,
            CONSTRAINT ck_jabatan_bukan_atasan_diri CHECK (id_jabatan <> id_jabatan_atasan)
        ) ENGINE=InnoDB`,
    );
    await connection.query(
        `INSERT IGNORE INTO jabatan_atasan (id_jabatan, id_jabatan_atasan, wajib_unit_sama)
         SELECT id_jabatan, id_jabatan_atasan, FALSE
         FROM jabatan
         WHERE id_jabatan_atasan IS NOT NULL AND id_jabatan <> id_jabatan_atasan`,
    );
    const [constraints] = await connection.execute(
        `SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'jabatan'
           AND COLUMN_NAME = 'id_jabatan_atasan' AND REFERENCED_TABLE_NAME = 'jabatan'`,
    );
    for (const { CONSTRAINT_NAME: name } of constraints) {
        await connection.query(`ALTER TABLE jabatan DROP FOREIGN KEY \`${name}\``);
    }
    await connection.query("ALTER TABLE jabatan DROP COLUMN id_jabatan_atasan");
}

async function migrateLegacySchema(connection) {
    await migrateLegacyParentRules(connection);

    if (await tableExists(connection, "jabatan") && await exists(connection, "jabatan", "id_unit")) {
        const [constraints] = await connection.execute(
            `SELECT CONSTRAINT_NAME
             FROM information_schema.KEY_COLUMN_USAGE
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'jabatan'
               AND COLUMN_NAME = 'id_unit' AND REFERENCED_TABLE_NAME IS NOT NULL`,
        );
        for (const { CONSTRAINT_NAME: name } of constraints) {
            await connection.query(`ALTER TABLE jabatan DROP FOREIGN KEY \`${name}\``);
        }

        await connection.query(
            `UPDATE pengguna p
             INNER JOIN jabatan j ON j.id_jabatan = p.id_jabatan
             INNER JOIN (
                 SELECT LOWER(nama_jabatan) AS nama_key, MIN(id_jabatan) AS id_kanonis
                 FROM jabatan GROUP BY LOWER(nama_jabatan)
             ) c ON c.nama_key = LOWER(j.nama_jabatan)
             SET p.id_jabatan = c.id_kanonis
             WHERE p.id_jabatan <> c.id_kanonis`,
        );
        await connection.query(
            `UPDATE tupoksi t
             INNER JOIN jabatan j ON j.id_jabatan = t.id_jabatan
             INNER JOIN (
                 SELECT LOWER(nama_jabatan) AS nama_key, MIN(id_jabatan) AS id_kanonis
                 FROM jabatan GROUP BY LOWER(nama_jabatan)
             ) c ON c.nama_key = LOWER(j.nama_jabatan)
             SET t.id_jabatan = c.id_kanonis
             WHERE t.id_jabatan <> c.id_kanonis`,
        );
        if (await tableExists(connection, "jabatan_atasan")) {
             await connection.query(
                 `UPDATE IGNORE jabatan_atasan ja
                  INNER JOIN jabatan j ON j.id_jabatan = ja.id_jabatan
                  INNER JOIN (
                      SELECT LOWER(nama_jabatan) AS nama_key, MIN(id_jabatan) AS id_kanonis
                      FROM jabatan GROUP BY LOWER(nama_jabatan)
                  ) c ON c.nama_key = LOWER(j.nama_jabatan)
                  SET ja.id_jabatan = c.id_kanonis
                  WHERE ja.id_jabatan <> c.id_kanonis`,
             );
             await connection.query(
                 `UPDATE IGNORE jabatan_atasan ja
                  INNER JOIN jabatan j ON j.id_jabatan = ja.id_jabatan_atasan
                  INNER JOIN (
                      SELECT LOWER(nama_jabatan) AS nama_key, MIN(id_jabatan) AS id_kanonis
                      FROM jabatan GROUP BY LOWER(nama_jabatan)
                  ) c ON c.nama_key = LOWER(j.nama_jabatan)
                  SET ja.id_jabatan_atasan = c.id_kanonis
                  WHERE ja.id_jabatan_atasan <> c.id_kanonis`,
             );
             await connection.query(
                 `DELETE ja FROM jabatan_atasan ja
                  INNER JOIN jabatan j ON j.id_jabatan = ja.id_jabatan
                  INNER JOIN (
                      SELECT LOWER(nama_jabatan) AS nama_key, MIN(id_jabatan) AS id_kanonis
                      FROM jabatan GROUP BY LOWER(nama_jabatan)
                  ) c ON c.nama_key = LOWER(j.nama_jabatan)
                  WHERE ja.id_jabatan <> c.id_kanonis`,
             );
             await connection.query(
                 `DELETE ja FROM jabatan_atasan ja
                  INNER JOIN jabatan j ON j.id_jabatan = ja.id_jabatan_atasan
                  INNER JOIN (
                      SELECT LOWER(nama_jabatan) AS nama_key, MIN(id_jabatan) AS id_kanonis
                      FROM jabatan GROUP BY LOWER(nama_jabatan)
                  ) c ON c.nama_key = LOWER(j.nama_jabatan)
                  WHERE ja.id_jabatan_atasan <> c.id_kanonis`,
             );
        }
        await connection.query(
            `DELETE j FROM jabatan j
             INNER JOIN jabatan canonical
               ON LOWER(canonical.nama_jabatan) = LOWER(j.nama_jabatan)
              AND canonical.id_jabatan < j.id_jabatan`,
        );

        if (await indexExists(connection, "jabatan", "uq_jabatan_unit")) {
            await connection.query("ALTER TABLE jabatan DROP INDEX uq_jabatan_unit");
        }
        await connection.query("ALTER TABLE jabatan DROP COLUMN id_unit");
        if (!(await indexExists(connection, "jabatan", "uq_jabatan_nama"))) {
            await connection.query("ALTER TABLE jabatan ADD UNIQUE KEY uq_jabatan_nama (nama_jabatan)");
        }
    }

    if (await tableExists(connection, "unit_kerja") && !(await exists(connection, "unit_kerja", "id_induk"))) {
        await connection.query("ALTER TABLE unit_kerja ADD COLUMN id_induk INT UNSIGNED NULL");
    }
    if (await tableExists(connection, "unit_kerja")) {
        const [[unitConstraint]] = await connection.execute(
            `SELECT COUNT(*) AS total FROM information_schema.TABLE_CONSTRAINTS
             WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'unit_kerja'
               AND CONSTRAINT_NAME = 'fk_unit_induk'`,
        );
        if (!Number(unitConstraint.total)) {
            await connection.query(
                "ALTER TABLE unit_kerja ADD CONSTRAINT fk_unit_induk FOREIGN KEY (id_induk) REFERENCES unit_kerja (id_unit)",
            );
        }
        if (!(await exists(connection, "unit_kerja", "aktif"))) {
            await connection.query("ALTER TABLE unit_kerja ADD COLUMN aktif BOOLEAN NOT NULL DEFAULT TRUE");
        }
    }

    if (await tableExists(connection, "jabatan")) {
        if (!(await exists(connection, "jabatan", "untuk_jenis"))) {
            await connection.query(
                "ALTER TABLE jabatan ADD COLUMN untuk_jenis ENUM('dosen','tendik') NOT NULL DEFAULT 'tendik'",
            );
        }
        if (!(await exists(connection, "jabatan", "aktif"))) {
            await connection.query("ALTER TABLE jabatan ADD COLUMN aktif BOOLEAN NOT NULL DEFAULT TRUE");
        }
        if (await exists(connection, "jabatan", "id_jabatan_atasan")) {
            const [constraints] = await connection.execute(
                `SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'jabatan'
                   AND COLUMN_NAME = 'id_jabatan_atasan' AND REFERENCED_TABLE_NAME IS NOT NULL`,
            );
            for (const { CONSTRAINT_NAME: name } of constraints) {
                await connection.query(`ALTER TABLE jabatan DROP FOREIGN KEY \`${name}\``);
            }
            await connection.query("ALTER TABLE jabatan DROP COLUMN id_jabatan_atasan");
        }
    }

    if (await tableExists(connection, "tupoksi") && !(await exists(connection, "tupoksi", "aktif"))) {
        await connection.query("ALTER TABLE tupoksi ADD COLUMN aktif BOOLEAN NOT NULL DEFAULT TRUE");
    }

    const userColumns = [
        ["status_akun", "ENUM('aktif','nonaktif') NOT NULL DEFAULT 'aktif'"],
        ["gagal_login", "TINYINT UNSIGNED NOT NULL DEFAULT 0"],
        ["terkunci_sampai", "DATETIME NULL"],
        ["wajib_ganti_password", "BOOLEAN NOT NULL DEFAULT TRUE"],
    ];
    if (await tableExists(connection, "pengguna")) {
        for (const [column, definition] of userColumns) {
            if (!(await exists(connection, "pengguna", column))) {
                await connection.query(`ALTER TABLE pengguna ADD COLUMN \`${column}\` ${definition}`);
            }
        }
    }
}

async function initializeDatabase() {
    const databaseName = process.env.DB_NAME;
    if (!databaseName || !/^[a-zA-Z0-9_]+$/.test(databaseName)) {
        throw new Error("DB_NAME tidak valid. Gunakan hanya huruf, angka, dan underscore.");
    }

    const adminConnection = await mysql.createConnection(config);
    await adminConnection.query(
        `CREATE DATABASE IF NOT EXISTS \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    await adminConnection.end();

    const connection = await db.getConnection();
    try {
        await migrateLegacySchema(connection);
        const statements = require("./schema");
        for (const statement of statements) {
            await connection.query(statement);
        }
        await require("./seed").seedDatabase(connection);
        await require("./triggers").installTriggers(connection);
    } finally {
        connection.release();
    }
}

module.exports = db;
module.exports.initializeDatabase = initializeDatabase;
