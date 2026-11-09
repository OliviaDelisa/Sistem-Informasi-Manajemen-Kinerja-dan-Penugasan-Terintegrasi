-- Migrasi struktur organisasi SIM-KP v3.4.
-- Buat backup database sebelum menjalankan. Target: database kinerja_fti.
-- Skrip ini ditujukan untuk dijalankan satu kali pada skema v3 lama.
USE kinerja_fti;

SET @ddl = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'unit_kerja' AND COLUMN_NAME = 'id_induk') > 0,
  'SELECT 1', 'ALTER TABLE unit_kerja ADD COLUMN id_induk INT UNSIGNED NULL'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(
  (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
   WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'unit_kerja'
     AND CONSTRAINT_NAME = 'fk_unit_induk') > 0,
  'SELECT 1',
  'ALTER TABLE unit_kerja ADD CONSTRAINT fk_unit_induk FOREIGN KEY (id_induk) REFERENCES unit_kerja (id_unit)'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'unit_kerja' AND COLUMN_NAME = 'aktif') > 0,
  'SELECT 1', 'ALTER TABLE unit_kerja ADD COLUMN aktif BOOLEAN NOT NULL DEFAULT TRUE'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'jabatan' AND COLUMN_NAME = 'untuk_jenis') > 0,
  'SELECT 1', 'ALTER TABLE jabatan ADD COLUMN untuk_jenis ENUM(''dosen'',''tendik'') NOT NULL DEFAULT ''tendik'''
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'jabatan' AND COLUMN_NAME = 'aktif') > 0,
  'SELECT 1', 'ALTER TABLE jabatan ADD COLUMN aktif BOOLEAN NOT NULL DEFAULT TRUE'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tupoksi' AND COLUMN_NAME = 'aktif') > 0,
  'SELECT 1', 'ALTER TABLE tupoksi ADD COLUMN aktif BOOLEAN NOT NULL DEFAULT TRUE'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pengguna' AND COLUMN_NAME = 'wajib_ganti_password') > 0,
  'SELECT 1', 'ALTER TABLE pengguna ADD COLUMN wajib_ganti_password BOOLEAN NOT NULL DEFAULT TRUE'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS jabatan_atasan (
  id_jabatan INT UNSIGNED NOT NULL,
  id_jabatan_atasan INT UNSIGNED NOT NULL,
  wajib_unit_sama BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (id_jabatan, id_jabatan_atasan),
  CONSTRAINT fk_jabatan_atasan_anak FOREIGN KEY (id_jabatan)
    REFERENCES jabatan (id_jabatan) ON DELETE CASCADE,
  CONSTRAINT fk_jabatan_atasan_induk FOREIGN KEY (id_jabatan_atasan)
    REFERENCES jabatan (id_jabatan) ON DELETE CASCADE,
  CONSTRAINT ck_jabatan_bukan_atasan_diri CHECK (id_jabatan <> id_jabatan_atasan)
) ENGINE=InnoDB;

-- Jika hierarki pernah disimpan langsung pada jabatan, pindahkan ke tabel relasi.
SET @has_old_parent = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'jabatan'
    AND COLUMN_NAME = 'id_jabatan_atasan'
);
SET @ddl = IF(@has_old_parent = 0, 'SELECT 1',
  'INSERT IGNORE INTO jabatan_atasan (id_jabatan, id_jabatan_atasan, wajib_unit_sama) SELECT id_jabatan, id_jabatan_atasan, FALSE FROM jabatan WHERE id_jabatan_atasan IS NOT NULL AND id_jabatan <> id_jabatan_atasan');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @old_parent_fk = (
  SELECT CONSTRAINT_NAME
  FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'jabatan'
    AND COLUMN_NAME = 'id_jabatan_atasan' AND REFERENCED_TABLE_NAME = 'jabatan'
  LIMIT 1
);
SET @ddl = IF(@old_parent_fk IS NULL, 'SELECT 1',
  CONCAT('ALTER TABLE jabatan DROP FOREIGN KEY `', @old_parent_fk, '`'));
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @ddl = IF(@has_old_parent = 0, 'SELECT 1',
  'ALTER TABLE jabatan DROP COLUMN id_jabatan_atasan');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Gabungkan jabatan lintas unit dengan nama sama sebelum menghapus relasi lama.
CREATE TEMPORARY TABLE _jabatan_merge AS
SELECT id_jabatan AS id_lama,
       MIN(id_jabatan) OVER (PARTITION BY LOWER(nama_jabatan)) AS id_baru
FROM jabatan;

UPDATE pengguna p
JOIN _jabatan_merge m ON m.id_lama = p.id_jabatan
SET p.id_jabatan = m.id_baru
WHERE m.id_lama <> m.id_baru;

UPDATE tupoksi t
JOIN _jabatan_merge m ON m.id_lama = t.id_jabatan
SET t.id_jabatan = m.id_baru
WHERE m.id_lama <> m.id_baru;

UPDATE IGNORE jabatan_atasan ja
JOIN _jabatan_merge m ON m.id_lama = ja.id_jabatan
SET ja.id_jabatan = m.id_baru
WHERE m.id_lama <> m.id_baru;
UPDATE IGNORE jabatan_atasan ja
JOIN _jabatan_merge m ON m.id_lama = ja.id_jabatan_atasan
SET ja.id_jabatan_atasan = m.id_baru
WHERE m.id_lama <> m.id_baru;
DELETE ja FROM jabatan_atasan ja
JOIN _jabatan_merge m ON m.id_lama = ja.id_jabatan
WHERE m.id_lama <> m.id_baru;
DELETE ja FROM jabatan_atasan ja
JOIN _jabatan_merge m ON m.id_lama = ja.id_jabatan_atasan
WHERE m.id_lama <> m.id_baru;

DELETE j FROM jabatan j
JOIN _jabatan_merge m ON m.id_lama = j.id_jabatan
WHERE m.id_lama <> m.id_baru;

DROP TEMPORARY TABLE _jabatan_merge;

-- Lepaskan jabatan dari unit; unit penugasan disimpan pada akun pengguna.
SET @fk_jabatan_unit = (
  SELECT CONSTRAINT_NAME
  FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'jabatan'
    AND COLUMN_NAME = 'id_unit' AND REFERENCED_TABLE_NAME = 'unit_kerja'
  LIMIT 1
);
SET @ddl = IF(@fk_jabatan_unit IS NULL, 'SELECT 1',
  CONCAT('ALTER TABLE jabatan DROP FOREIGN KEY `', @fk_jabatan_unit, '`'));
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_jabatan_unit = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'jabatan' AND COLUMN_NAME = 'id_unit'
);
SET @ddl = IF(@has_jabatan_unit = 0, 'SELECT 1', 'ALTER TABLE jabatan DROP COLUMN id_unit');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_uq_jabatan_unit = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'jabatan' AND INDEX_NAME = 'uq_jabatan_unit'
);
SET @ddl = IF(@has_uq_jabatan_unit = 0, 'SELECT 1',
  'ALTER TABLE jabatan DROP INDEX uq_jabatan_unit');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_uq_jabatan_nama = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'jabatan' AND INDEX_NAME = 'uq_jabatan_nama'
);
SET @ddl = IF(@has_uq_jabatan_nama > 0, 'SELECT 1',
  'ALTER TABLE jabatan ADD UNIQUE KEY uq_jabatan_nama (nama_jabatan)');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS jabatan_atasan (
  id_jabatan INT UNSIGNED NOT NULL,
  id_jabatan_atasan INT UNSIGNED NOT NULL,
  wajib_unit_sama BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (id_jabatan, id_jabatan_atasan),
  CONSTRAINT fk_jabatan_atasan_anak FOREIGN KEY (id_jabatan)
    REFERENCES jabatan (id_jabatan) ON DELETE CASCADE,
  CONSTRAINT fk_jabatan_atasan_induk FOREIGN KEY (id_jabatan_atasan)
    REFERENCES jabatan (id_jabatan) ON DELETE CASCADE,
  CONSTRAINT ck_jabatan_bukan_atasan_diri CHECK (id_jabatan <> id_jabatan_atasan)
) ENGINE=InnoDB;

-- Pindahkan aturan atasan lama bila pernah ditambahkan langsung di tabel jabatan.
SET @has_old_parent = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'jabatan'
    AND COLUMN_NAME = 'id_jabatan_atasan'
);
SET @ddl = IF(@has_old_parent = 0, 'SELECT 1',
  'INSERT IGNORE INTO jabatan_atasan (id_jabatan, id_jabatan_atasan, wajib_unit_sama) SELECT id_jabatan, id_jabatan_atasan, FALSE FROM jabatan WHERE id_jabatan_atasan IS NOT NULL');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @old_parent_fk = (
  SELECT CONSTRAINT_NAME
  FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'jabatan'
    AND COLUMN_NAME = 'id_jabatan_atasan' AND REFERENCED_TABLE_NAME = 'jabatan'
  LIMIT 1
);
SET @ddl = IF(@old_parent_fk IS NULL, 'SELECT 1',
  CONCAT('ALTER TABLE jabatan DROP FOREIGN KEY `', @old_parent_fk, '`'));
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = IF(@has_old_parent = 0, 'SELECT 1',
  'ALTER TABLE jabatan DROP COLUMN id_jabatan_atasan');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Bentuk unit awal; unit lama dan akun yang sudah ada tetap dipertahankan.
UPDATE unit_kerja
SET nama_unit = 'Fakultas Teknologi Informasi'
WHERE nama_unit = 'Dekanat FTI'
  AND NOT EXISTS (
    SELECT 1 FROM (SELECT id_unit FROM unit_kerja WHERE nama_unit = 'Fakultas Teknologi Informasi') existing
  );

INSERT IGNORE INTO unit_kerja (nama_unit, id_induk, aktif)
VALUES ('Fakultas Teknologi Informasi', NULL, TRUE);

SET @id_fakultas = (SELECT id_unit FROM unit_kerja WHERE nama_unit = 'Fakultas Teknologi Informasi' LIMIT 1);
SET @id_fakultas_lama = (SELECT id_unit FROM unit_kerja WHERE nama_unit = 'Dekanat FTI' LIMIT 1);
UPDATE pengguna SET id_unit = @id_fakultas
WHERE @id_fakultas_lama IS NOT NULL AND id_unit = @id_fakultas_lama;
UPDATE unit_kerja SET id_induk = @id_fakultas
WHERE @id_fakultas_lama IS NOT NULL
  AND id_induk = @id_fakultas_lama AND id_unit <> @id_fakultas;
UPDATE unit_kerja SET id_induk = NULL
WHERE id_unit = @id_fakultas AND @id_fakultas_lama IS NOT NULL;
DELETE FROM unit_kerja
WHERE @id_fakultas_lama IS NOT NULL
  AND id_unit = @id_fakultas_lama AND id_unit <> @id_fakultas;

INSERT IGNORE INTO unit_kerja (nama_unit, id_induk, aktif)
VALUES
  ('Kantor FTI', @id_fakultas, TRUE),
  ('Departemen Sistem Informasi', @id_fakultas, TRUE),
  ('Departemen Teknik Komputer', @id_fakultas, TRUE),
  ('Departemen Informatika', @id_fakultas, TRUE);
UPDATE unit_kerja
SET id_induk = @id_fakultas
WHERE nama_unit IN (
  'Kantor FTI',
  'Departemen Sistem Informasi',
  'Departemen Teknik Komputer',
  'Departemen Informatika'
);

-- Bersihkan tiga nama jabatan lama sambil mempertahankan akun dan tupoksinya.
INSERT IGNORE INTO jabatan (nama_jabatan, untuk_jenis, aktif)
VALUES
  ('Dekan', 'dosen', TRUE),
  ('Wakil Dekan I', 'dosen', TRUE),
  ('Wakil Dekan II', 'dosen', TRUE),
  ('Kepala Departemen', 'dosen', TRUE),
  ('Dosen', 'dosen', TRUE),
  ('Kepala Kantor', 'tendik', TRUE),
  ('Kasi Keuangan dan Aset', 'tendik', TRUE),
  ('Kasi Administrasi dan Umum', 'tendik', TRUE),
  ('Staf Keuangan dan Aset', 'tendik', TRUE),
  ('Staf Administrasi dan Umum', 'tendik', TRUE),
  ('Staf SDM', 'tendik', TRUE);

UPDATE jabatan SET untuk_jenis = 'dosen'
WHERE nama_jabatan IN ('Dekan', 'Wakil Dekan I', 'Wakil Dekan II', 'Kepala Departemen', 'Dosen');
UPDATE jabatan SET untuk_jenis = 'tendik'
WHERE nama_jabatan IN (
  'Kepala Kantor', 'Kasi Keuangan dan Aset', 'Kasi Administrasi dan Umum',
  'Staf Keuangan dan Aset', 'Staf Administrasi dan Umum', 'Staf SDM'
);

UPDATE pengguna p
JOIN jabatan old_job ON old_job.id_jabatan = p.id_jabatan
JOIN jabatan new_job ON new_job.nama_jabatan = CASE old_job.nama_jabatan
  WHEN 'Superadmin' THEN 'Staf SDM'
  WHEN 'Kasi' THEN 'Kasi Keuangan dan Aset'
  WHEN 'Tendik' THEN 'Staf Keuangan dan Aset'
  ELSE old_job.nama_jabatan
END
SET p.id_jabatan = new_job.id_jabatan;

UPDATE tupoksi t
JOIN jabatan old_job ON old_job.id_jabatan = t.id_jabatan
JOIN jabatan new_job ON new_job.nama_jabatan = CASE old_job.nama_jabatan
  WHEN 'Superadmin' THEN 'Staf SDM'
  WHEN 'Kasi' THEN 'Kasi Keuangan dan Aset'
  WHEN 'Tendik' THEN 'Staf Keuangan dan Aset'
  ELSE old_job.nama_jabatan
END
SET t.id_jabatan = new_job.id_jabatan;

UPDATE IGNORE jabatan_atasan ja
JOIN jabatan old_job ON old_job.id_jabatan = ja.id_jabatan
JOIN jabatan new_job ON new_job.nama_jabatan = CASE old_job.nama_jabatan
  WHEN 'Superadmin' THEN 'Staf SDM'
  WHEN 'Kasi' THEN 'Kasi Keuangan dan Aset'
  WHEN 'Tendik' THEN 'Staf Keuangan dan Aset'
  ELSE old_job.nama_jabatan
END
SET ja.id_jabatan = new_job.id_jabatan;

UPDATE IGNORE jabatan_atasan ja
JOIN jabatan old_job ON old_job.id_jabatan = ja.id_jabatan_atasan
JOIN jabatan new_job ON new_job.nama_jabatan = CASE old_job.nama_jabatan
  WHEN 'Superadmin' THEN 'Staf SDM'
  WHEN 'Kasi' THEN 'Kasi Keuangan dan Aset'
  WHEN 'Tendik' THEN 'Staf Keuangan dan Aset'
  ELSE old_job.nama_jabatan
END
SET ja.id_jabatan_atasan = new_job.id_jabatan;

DELETE ja FROM jabatan_atasan ja
LEFT JOIN jabatan child ON child.id_jabatan = ja.id_jabatan
LEFT JOIN jabatan parent ON parent.id_jabatan = ja.id_jabatan_atasan
WHERE child.id_jabatan IS NULL OR parent.id_jabatan IS NULL OR ja.id_jabatan = ja.id_jabatan_atasan
   OR child.nama_jabatan IN ('Superadmin', 'Kasi', 'Tendik')
   OR parent.nama_jabatan IN ('Superadmin', 'Kasi', 'Tendik');

DELETE old_job FROM jabatan old_job
WHERE old_job.nama_jabatan IN ('Superadmin', 'Kasi', 'Tendik')
  AND NOT EXISTS (SELECT 1 FROM pengguna p WHERE p.id_jabatan = old_job.id_jabatan)
  AND NOT EXISTS (SELECT 1 FROM tupoksi t WHERE t.id_jabatan = old_job.id_jabatan);

UPDATE pengguna p
JOIN jabatan j ON j.id_jabatan = p.id_jabatan
SET p.jenis_pengguna = j.untuk_jenis,
    p.nidn = CASE WHEN j.untuk_jenis = 'dosen' THEN p.nidn ELSE NULL END;

UPDATE pengguna p
JOIN jabatan j ON j.id_jabatan = p.id_jabatan
JOIN unit_kerja u ON u.nama_unit = 'Fakultas Teknologi Informasi'
SET p.id_unit = u.id_unit
WHERE j.nama_jabatan IN ('Dekan', 'Wakil Dekan I', 'Wakil Dekan II');

UPDATE pengguna p
JOIN jabatan j ON j.id_jabatan = p.id_jabatan
JOIN unit_kerja u ON u.nama_unit = 'Kantor FTI'
SET p.id_unit = u.id_unit
WHERE j.nama_jabatan IN (
  'Kepala Kantor', 'Kasi Keuangan dan Aset', 'Kasi Administrasi dan Umum',
  'Staf Keuangan dan Aset', 'Staf Administrasi dan Umum', 'Staf SDM'
);

INSERT INTO jabatan_atasan (id_jabatan, id_jabatan_atasan, wajib_unit_sama)
SELECT child.id_jabatan, parent.id_jabatan, rules.wajib_unit_sama
FROM (
  SELECT 'Wakil Dekan I' AS child_name, 'Dekan' AS parent_name, FALSE AS wajib_unit_sama
  UNION ALL SELECT 'Wakil Dekan II', 'Dekan', FALSE
  UNION ALL SELECT 'Kepala Departemen', 'Wakil Dekan I', FALSE
  UNION ALL SELECT 'Kepala Departemen', 'Wakil Dekan II', FALSE
  UNION ALL SELECT 'Dosen', 'Kepala Departemen', TRUE
  UNION ALL SELECT 'Kepala Kantor', 'Wakil Dekan I', FALSE
  UNION ALL SELECT 'Kepala Kantor', 'Wakil Dekan II', FALSE
  UNION ALL SELECT 'Kasi Keuangan dan Aset', 'Kepala Kantor', FALSE
  UNION ALL SELECT 'Kasi Administrasi dan Umum', 'Kepala Kantor', FALSE
  UNION ALL SELECT 'Staf Keuangan dan Aset', 'Kasi Keuangan dan Aset', FALSE
  UNION ALL SELECT 'Staf Administrasi dan Umum', 'Kasi Administrasi dan Umum', FALSE
) rules
JOIN jabatan child ON child.nama_jabatan = rules.child_name
JOIN jabatan parent ON parent.nama_jabatan = rules.parent_name
ON DUPLICATE KEY UPDATE wajib_unit_sama = VALUES(wajib_unit_sama);

UPDATE pengguna child
LEFT JOIN pengguna parent ON parent.id_pengguna = child.id_atasan
LEFT JOIN jabatan_atasan allowed
  ON allowed.id_jabatan = child.id_jabatan
 AND allowed.id_jabatan_atasan = parent.id_jabatan
SET child.id_atasan = NULL
WHERE child.id_atasan IS NOT NULL
  AND (parent.id_pengguna IS NULL OR parent.status_akun <> 'aktif'
       OR allowed.id_jabatan IS NULL
       OR (allowed.wajib_unit_sama = TRUE AND child.id_unit <> parent.id_unit));

INSERT INTO jabatan_atasan (id_jabatan, id_jabatan_atasan, wajib_unit_sama)
SELECT child.id_jabatan, parent.id_jabatan, rules.wajib_unit_sama
FROM (
  SELECT 'Wakil Dekan I' AS child_name, 'Dekan' AS parent_name, FALSE AS wajib_unit_sama
  UNION ALL SELECT 'Wakil Dekan II', 'Dekan', FALSE
  UNION ALL SELECT 'Kepala Departemen', 'Wakil Dekan I', FALSE
  UNION ALL SELECT 'Kepala Departemen', 'Wakil Dekan II', FALSE
  UNION ALL SELECT 'Dosen', 'Kepala Departemen', TRUE
  UNION ALL SELECT 'Kepala Kantor', 'Wakil Dekan I', FALSE
  UNION ALL SELECT 'Kepala Kantor', 'Wakil Dekan II', FALSE
  UNION ALL SELECT 'Kasi Keuangan dan Aset', 'Kepala Kantor', FALSE
  UNION ALL SELECT 'Kasi Administrasi dan Umum', 'Kepala Kantor', FALSE
  UNION ALL SELECT 'Staf Keuangan dan Aset', 'Kasi Keuangan dan Aset', FALSE
  UNION ALL SELECT 'Staf Administrasi dan Umum', 'Kasi Administrasi dan Umum', FALSE
) rules
JOIN jabatan child ON child.nama_jabatan = rules.child_name
JOIN jabatan parent ON parent.nama_jabatan = rules.parent_name
ON DUPLICATE KEY UPDATE wajib_unit_sama = VALUES(wajib_unit_sama);

DELETE t FROM tupoksi t
LEFT JOIN logbook l ON l.id_tupoksi = t.id_tupoksi
WHERE LOWER(TRIM(t.uraian_tupoksi)) = 'tes' AND l.id_logbook IS NULL;
UPDATE tupoksi SET aktif = FALSE WHERE LOWER(TRIM(uraian_tupoksi)) = 'tes';

UPDATE unit_kerja u
SET u.aktif = FALSE
WHERE LOWER(u.nama_unit) NOT IN (
  'fakultas teknologi informasi', 'kantor fti',
  'departemen sistem informasi', 'departemen teknik komputer', 'departemen informatika'
)
AND NOT EXISTS (SELECT 1 FROM pengguna p WHERE p.id_unit = u.id_unit AND p.status_akun = 'aktif');

UPDATE jabatan j
SET j.aktif = FALSE
WHERE LOWER(j.nama_jabatan) NOT IN (
  'dekan', 'wakil dekan i', 'wakil dekan ii', 'kepala departemen', 'dosen',
  'kepala kantor', 'kasi keuangan dan aset', 'kasi administrasi dan umum',
  'staf keuangan dan aset', 'staf administrasi dan umum', 'staf sdm'
)
AND NOT EXISTS (SELECT 1 FROM pengguna p WHERE p.id_jabatan = j.id_jabatan AND p.status_akun = 'aktif');

-- Periksa data sebelum menjalankan migrasi_v3_5_konsistensi.sql.
SELECT id_unit, nama_unit, id_induk, aktif FROM unit_kerja ORDER BY id_induk, nama_unit;
SELECT id_jabatan, nama_jabatan, untuk_jenis, aktif FROM jabatan ORDER BY nama_jabatan;
SELECT id_jabatan, id_jabatan_atasan, wajib_unit_sama FROM jabatan_atasan ORDER BY id_jabatan;
