function accountTrigger(event) {
    const operation = event === "INSERT" ? "INSERT" : "UPDATE";
    const trigger = `trg_pengguna_b${event === "INSERT" ? "i" : "u"}`;
    return {
        drop: `DROP TRIGGER IF EXISTS ${trigger}`,
        create: `CREATE TRIGGER ${trigger} BEFORE ${operation} ON pengguna FOR EACH ROW
        BEGIN
            DECLARE v_jenis VARCHAR(10) DEFAULT NULL;
            DECLARE v_aktif_jabatan BOOLEAN DEFAULT FALSE;
            DECLARE v_aktif_unit BOOLEAN DEFAULT FALSE;
            DECLARE v_status_atasan VARCHAR(10) DEFAULT NULL;
            DECLARE v_jabatan_atasan INT UNSIGNED DEFAULT NULL;
            DECLARE v_unit_atasan INT UNSIGNED DEFAULT NULL;
            DECLARE v_unit_sama BOOLEAN DEFAULT FALSE;
            DECLARE v_cursor INT UNSIGNED DEFAULT NULL;
            DECLARE v_depth INT UNSIGNED DEFAULT 0;

            SET v_jenis = (SELECT untuk_jenis FROM jabatan WHERE id_jabatan = NEW.id_jabatan);
            SET v_aktif_jabatan = COALESCE(
                (SELECT aktif FROM jabatan WHERE id_jabatan = NEW.id_jabatan), FALSE
            );
            SET v_aktif_unit = COALESCE(
                (SELECT aktif FROM unit_kerja WHERE id_unit = NEW.id_unit), FALSE
            );

            IF v_jenis IS NULL OR v_jenis <> NEW.jenis_pengguna THEN
                SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Jenis pengguna tidak sesuai dengan jabatan';
            END IF;
            IF NOT v_aktif_jabatan OR NOT v_aktif_unit THEN
                SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Jabatan atau Unit kerja sudah tidak aktif';
            END IF;
            IF NEW.status_akun <> 'aktif' AND EXISTS (
                SELECT 1 FROM pengguna
                WHERE id_atasan = NEW.id_pengguna AND status_akun = 'aktif'
            ) THEN
                SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Pindahkan bawahan dulu';
            END IF;
            IF NEW.id_atasan IS NOT NULL THEN
                SET v_status_atasan = (
                    SELECT status_akun FROM pengguna WHERE id_pengguna = NEW.id_atasan
                );
                SET v_jabatan_atasan = (
                    SELECT id_jabatan FROM pengguna WHERE id_pengguna = NEW.id_atasan
                );
                SET v_unit_atasan = (
                    SELECT id_unit FROM pengguna WHERE id_pengguna = NEW.id_atasan
                );

                IF v_status_atasan IS NULL THEN
                    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Akun atasan tidak ditemukan';
                END IF;
                IF v_status_atasan <> 'aktif' THEN
                    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Akun atasan sudah tidak aktif';
                END IF;
                IF NOT EXISTS (
                    SELECT 1 FROM jabatan_atasan
                    WHERE id_jabatan = NEW.id_jabatan
                      AND id_jabatan_atasan = v_jabatan_atasan
                ) THEN
                    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Jabatan atasan tidak sesuai aturan hierarki jabatan';
                END IF;
                SET v_unit_sama = COALESCE((
                    SELECT wajib_unit_sama FROM jabatan_atasan
                    WHERE id_jabatan = NEW.id_jabatan
                      AND id_jabatan_atasan = v_jabatan_atasan
                ), FALSE);
                IF v_unit_sama AND v_unit_atasan <> NEW.id_unit THEN
                    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Atasan harus berada di unit kerja yang sama';
                END IF;

                SET v_cursor = NEW.id_atasan;
                WHILE v_cursor IS NOT NULL DO
                    IF v_cursor = NEW.id_pengguna AND NEW.id_pengguna <> 0 THEN
                        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Atasan membentuk lingkaran';
                    END IF;
                    SET v_cursor = (
                        SELECT id_atasan FROM pengguna WHERE id_pengguna = v_cursor
                    );
                    SET v_depth = v_depth + 1;
                    IF v_depth > 100 THEN
                        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Rantai atasan terlalu panjang atau membentuk lingkaran';
                    END IF;
                END WHILE;
            END IF;
        END`,
    };
}

const definitions = [
    {
        drop: "DROP TRIGGER IF EXISTS trg_unit_bi",
        create: `CREATE TRIGGER trg_unit_bi BEFORE INSERT ON unit_kerja FOR EACH ROW
        BEGIN
            IF NEW.id_induk IS NOT NULL AND NOT EXISTS (
                SELECT 1 FROM unit_kerja WHERE id_unit = NEW.id_induk AND aktif = TRUE
            ) THEN
                SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Unit induk tidak aktif';
            END IF;
        END`,
    },
    {
        drop: "DROP TRIGGER IF EXISTS trg_unit_bu",
        create: `CREATE TRIGGER trg_unit_bu BEFORE UPDATE ON unit_kerja FOR EACH ROW
        BEGIN
            DECLARE v_parent INT UNSIGNED DEFAULT NULL;
            DECLARE v_cursor INT UNSIGNED DEFAULT NULL;
            DECLARE v_parent_active BOOLEAN DEFAULT FALSE;
            DECLARE v_depth INT UNSIGNED DEFAULT 0;
            IF NEW.id_induk IS NOT NULL THEN
                SET v_parent = NEW.id_induk;
                SET v_parent_active = COALESCE(
                    (SELECT aktif FROM unit_kerja WHERE id_unit = v_parent), FALSE
                );
                IF NOT v_parent_active THEN
                    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Unit induk tidak aktif';
                END IF;
                WHILE v_parent IS NOT NULL DO
                    IF v_parent = NEW.id_unit THEN
                        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Unit kerja membentuk lingkaran';
                    END IF;
                    SET v_cursor = (SELECT id_induk FROM unit_kerja WHERE id_unit = v_parent);
                    SET v_parent = v_cursor;
                    SET v_depth = v_depth + 1;
                    IF v_depth > 100 THEN
                        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Hierarki unit kerja terlalu panjang';
                    END IF;
                END WHILE;
            END IF;
            IF OLD.aktif = TRUE AND NEW.aktif = FALSE
               AND (
                   EXISTS (SELECT 1 FROM pengguna WHERE id_unit = OLD.id_unit AND status_akun = 'aktif')
                   OR EXISTS (SELECT 1 FROM unit_kerja WHERE id_induk = OLD.id_unit AND aktif = TRUE)
               ) THEN
                SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Pindahkan akunnya dulu';
            END IF;
        END`,
    },
    {
        drop: "DROP TRIGGER IF EXISTS trg_jabatan_bu",
        create: `CREATE TRIGGER trg_jabatan_bu BEFORE UPDATE ON jabatan FOR EACH ROW
        BEGIN
            IF OLD.aktif = TRUE AND NEW.aktif = FALSE
               AND EXISTS (SELECT 1 FROM pengguna WHERE id_jabatan = OLD.id_jabatan AND status_akun = 'aktif') THEN
                SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Pindahkan akunnya dulu';
            END IF;
            IF EXISTS (
                SELECT 1 FROM pengguna
                WHERE id_jabatan = OLD.id_jabatan AND status_akun = 'aktif'
                  AND jenis_pengguna <> NEW.untuk_jenis
            ) THEN
                SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Jenis pengguna tidak sesuai dengan jabatan';
            END IF;
        END`,
    },
    {
        drop: "DROP TRIGGER IF EXISTS trg_jabatan_atasan_bi",
        create: `CREATE TRIGGER trg_jabatan_atasan_bi BEFORE INSERT ON jabatan_atasan FOR EACH ROW
        BEGIN
            IF NEW.id_jabatan = NEW.id_jabatan_atasan THEN
                SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Jabatan tidak dapat menjadi atasannya sendiri';
            END IF;
            IF NOT EXISTS (SELECT 1 FROM jabatan WHERE id_jabatan = NEW.id_jabatan AND aktif = TRUE)
               OR NOT EXISTS (SELECT 1 FROM jabatan WHERE id_jabatan = NEW.id_jabatan_atasan AND aktif = TRUE) THEN
                SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Jabatan atau Unit kerja sudah tidak aktif';
            END IF;
        END`,
    },
    {
        drop: "DROP TRIGGER IF EXISTS trg_jabatan_atasan_bu",
        create: `CREATE TRIGGER trg_jabatan_atasan_bu BEFORE UPDATE ON jabatan_atasan FOR EACH ROW
        BEGIN
            IF NEW.id_jabatan = NEW.id_jabatan_atasan THEN
                SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Jabatan tidak dapat menjadi atasannya sendiri';
            END IF;
            IF NOT EXISTS (SELECT 1 FROM jabatan WHERE id_jabatan = NEW.id_jabatan AND aktif = TRUE)
               OR NOT EXISTS (SELECT 1 FROM jabatan WHERE id_jabatan = NEW.id_jabatan_atasan AND aktif = TRUE) THEN
                SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Jabatan atau Unit kerja sudah tidak aktif';
            END IF;
            IF (
                OLD.id_jabatan <> NEW.id_jabatan OR
                OLD.id_jabatan_atasan <> NEW.id_jabatan_atasan OR
                OLD.wajib_unit_sama <> NEW.wajib_unit_sama
            ) AND EXISTS (
                SELECT 1 FROM pengguna child
                INNER JOIN pengguna parent ON parent.id_pengguna = child.id_atasan
                WHERE child.status_akun = 'aktif' AND parent.status_akun = 'aktif'
                  AND child.id_jabatan = OLD.id_jabatan
                  AND parent.id_jabatan = OLD.id_jabatan_atasan
                  AND (NEW.id_jabatan <> OLD.id_jabatan
                       OR NEW.id_jabatan_atasan <> OLD.id_jabatan_atasan
                       OR (NEW.wajib_unit_sama = TRUE AND child.id_unit <> parent.id_unit))
            ) THEN
                SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Pindahkan akunnya dulu';
            END IF;
        END`,
    },
    {
        drop: "DROP TRIGGER IF EXISTS trg_jabatan_atasan_bd",
        create: `CREATE TRIGGER trg_jabatan_atasan_bd BEFORE DELETE ON jabatan_atasan FOR EACH ROW
        BEGIN
            IF EXISTS (
                SELECT 1 FROM pengguna child
                INNER JOIN pengguna parent ON parent.id_pengguna = child.id_atasan
                WHERE child.status_akun = 'aktif' AND parent.status_akun = 'aktif'
                  AND child.id_jabatan = OLD.id_jabatan
                  AND parent.id_jabatan = OLD.id_jabatan_atasan
            ) THEN
                SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Pindahkan akunnya dulu';
            END IF;
        END`,
    },
    {
        drop: "DROP TRIGGER IF EXISTS trg_tupoksi_bi",
        create: `CREATE TRIGGER trg_tupoksi_bi BEFORE INSERT ON tupoksi FOR EACH ROW
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM jabatan WHERE id_jabatan = NEW.id_jabatan AND aktif = TRUE) THEN
                SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Jabatan atau Unit kerja sudah tidak aktif';
            END IF;
        END`,
    },
    {
        drop: "DROP TRIGGER IF EXISTS trg_tupoksi_bu",
        create: `CREATE TRIGGER trg_tupoksi_bu BEFORE UPDATE ON tupoksi FOR EACH ROW
        BEGIN
            IF NEW.aktif = TRUE AND NOT EXISTS (
                SELECT 1 FROM jabatan WHERE id_jabatan = NEW.id_jabatan AND aktif = TRUE
            ) THEN
                SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Jabatan atau Unit kerja sudah tidak aktif';
            END IF;
        END`,
    },
    {
        drop: "DROP TRIGGER IF EXISTS trg_logbook_bi",
        create: `CREATE TRIGGER trg_logbook_bi BEFORE INSERT ON logbook FOR EACH ROW
        BEGIN
            IF NEW.id_tupoksi IS NOT NULL AND NOT EXISTS (
                SELECT 1 FROM tupoksi t INNER JOIN jabatan j ON j.id_jabatan = t.id_jabatan
                WHERE t.id_tupoksi = NEW.id_tupoksi AND t.aktif = TRUE AND j.aktif = TRUE
            ) THEN
                SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Tupoksi sudah tidak aktif';
            END IF;
        END`,
    },
    {
        drop: "DROP TRIGGER IF EXISTS trg_logbook_bu",
        create: `CREATE TRIGGER trg_logbook_bu BEFORE UPDATE ON logbook FOR EACH ROW
        BEGIN
            IF NEW.id_tupoksi IS NOT NULL AND NOT EXISTS (
                SELECT 1 FROM tupoksi t INNER JOIN jabatan j ON j.id_jabatan = t.id_jabatan
                WHERE t.id_tupoksi = NEW.id_tupoksi AND t.aktif = TRUE AND j.aktif = TRUE
            ) THEN
                SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Tupoksi sudah tidak aktif';
            END IF;
        END`,
    },
    accountTrigger("INSERT"),
    accountTrigger("UPDATE"),
];

async function installTriggers(connection) {
    for (const { drop, create } of definitions) {
        await connection.query(drop);
        await connection.query(create);
    }
}

module.exports = { installTriggers, definitions };
