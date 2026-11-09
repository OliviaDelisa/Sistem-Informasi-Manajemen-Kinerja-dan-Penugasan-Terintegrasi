module.exports = [
    `CREATE TABLE IF NOT EXISTS unit_kerja (
        id_unit INT UNSIGNED NOT NULL AUTO_INCREMENT,
        nama_unit VARCHAR(100) NOT NULL,
        id_induk INT UNSIGNED NULL,
        aktif BOOLEAN NOT NULL DEFAULT TRUE,
        PRIMARY KEY (id_unit),
        UNIQUE KEY uq_unit_nama (nama_unit),
        CONSTRAINT fk_unit_induk FOREIGN KEY (id_induk) REFERENCES unit_kerja (id_unit)
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS \`role\` (
        id_role INT UNSIGNED NOT NULL AUTO_INCREMENT,
        nama_role VARCHAR(50) NOT NULL,
        PRIMARY KEY (id_role),
        UNIQUE KEY uq_role_nama (nama_role)
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS jabatan (
        id_jabatan INT UNSIGNED NOT NULL AUTO_INCREMENT,
        nama_jabatan VARCHAR(100) NOT NULL,
        untuk_jenis ENUM('dosen','tendik') NOT NULL,
        aktif BOOLEAN NOT NULL DEFAULT TRUE,
        PRIMARY KEY (id_jabatan),
        UNIQUE KEY uq_jabatan_nama (nama_jabatan),
        CONSTRAINT ck_jabatan_jenis CHECK (untuk_jenis IN ('dosen','tendik'))
    ) ENGINE=InnoDB`,
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
    `CREATE TABLE IF NOT EXISTS tupoksi (
        id_tupoksi INT UNSIGNED NOT NULL AUTO_INCREMENT,
        id_jabatan INT UNSIGNED NOT NULL,
        uraian_tupoksi TEXT NOT NULL,
        aktif BOOLEAN NOT NULL DEFAULT TRUE,
        PRIMARY KEY (id_tupoksi),
        CONSTRAINT fk_tupoksi_jabatan FOREIGN KEY (id_jabatan)
            REFERENCES jabatan (id_jabatan) ON DELETE CASCADE
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS pengguna (
        id_pengguna INT UNSIGNED NOT NULL AUTO_INCREMENT,
        nama VARCHAR(100) NOT NULL,
        jenis_pengguna ENUM('dosen','tendik') NOT NULL,
        nidn VARCHAR(10) NULL,
        username VARCHAR(100) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        wajib_ganti_password BOOLEAN NOT NULL DEFAULT TRUE,
        status_akun ENUM('aktif','nonaktif') NOT NULL DEFAULT 'aktif',
        gagal_login TINYINT UNSIGNED NOT NULL DEFAULT 0,
        terkunci_sampai DATETIME NULL,
        id_unit INT UNSIGNED NOT NULL,
        id_jabatan INT UNSIGNED NOT NULL,
        id_atasan INT UNSIGNED NULL,
        id_role INT UNSIGNED NOT NULL,
        PRIMARY KEY (id_pengguna),
        UNIQUE KEY uq_pengguna_username (username),
        UNIQUE KEY uq_pengguna_nidn (nidn),
        CONSTRAINT fk_pengguna_unit FOREIGN KEY (id_unit) REFERENCES unit_kerja (id_unit),
        CONSTRAINT fk_pengguna_jabatan FOREIGN KEY (id_jabatan) REFERENCES jabatan (id_jabatan),
        CONSTRAINT fk_pengguna_atasan FOREIGN KEY (id_atasan) REFERENCES pengguna (id_pengguna),
        CONSTRAINT fk_pengguna_role FOREIGN KEY (id_role) REFERENCES \`role\` (id_role),
        CONSTRAINT ck_nidn_dosen CHECK (jenis_pengguna = 'dosen' OR nidn IS NULL)
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS aturan_penugasan (
        id_aturan INT UNSIGNED NOT NULL AUTO_INCREMENT,
        id_role_pemberi INT UNSIGNED NOT NULL,
        id_role_penerima INT UNSIGNED NOT NULL,
        jenis_penugasan ENUM('tugas','kepanitiaan') NOT NULL,
        boleh_delegasi BOOLEAN NOT NULL DEFAULT FALSE,
        PRIMARY KEY (id_aturan),
        UNIQUE KEY uq_aturan (id_role_pemberi, id_role_penerima, jenis_penugasan),
        CONSTRAINT fk_aturan_pemberi FOREIGN KEY (id_role_pemberi) REFERENCES \`role\` (id_role),
        CONSTRAINT fk_aturan_penerima FOREIGN KEY (id_role_penerima) REFERENCES \`role\` (id_role)
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS kepanitiaan (
        id_kepanitiaan INT UNSIGNED NOT NULL AUTO_INCREMENT,
        nama_kegiatan VARCHAR(200) NOT NULL,
        periode_mulai DATE NOT NULL,
        periode_selesai DATE NOT NULL,
        dasar_penugasan VARCHAR(200) NULL,
        id_pembuat INT UNSIGNED NOT NULL,
        PRIMARY KEY (id_kepanitiaan),
        CONSTRAINT fk_kepanitiaan_pembuat FOREIGN KEY (id_pembuat) REFERENCES pengguna (id_pengguna),
        CONSTRAINT ck_kepanitiaan_periode CHECK (periode_selesai >= periode_mulai)
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS anggota_kepanitiaan (
        id_anggota INT UNSIGNED NOT NULL AUTO_INCREMENT,
        id_kepanitiaan INT UNSIGNED NOT NULL,
        id_pengguna INT UNSIGNED NOT NULL,
        peran VARCHAR(100) NOT NULL,
        status_respons ENUM('menunggu','diterima','ditolak') NOT NULL DEFAULT 'menunggu',
        alasan_penolakan TEXT NULL,
        tgl_respons DATETIME NULL,
        PRIMARY KEY (id_anggota),
        UNIQUE KEY uq_anggota (id_kepanitiaan, id_pengguna),
        CONSTRAINT fk_anggota_kepanitiaan FOREIGN KEY (id_kepanitiaan)
            REFERENCES kepanitiaan (id_kepanitiaan) ON DELETE CASCADE,
        CONSTRAINT fk_anggota_pengguna FOREIGN KEY (id_pengguna) REFERENCES pengguna (id_pengguna),
        CONSTRAINT ck_anggota_tolak CHECK (status_respons <> 'ditolak' OR alasan_penolakan IS NOT NULL),
        CONSTRAINT ck_anggota_tgl CHECK ((status_respons = 'menunggu') = (tgl_respons IS NULL))
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS penugasan (
        id_penugasan INT UNSIGNED NOT NULL AUTO_INCREMENT,
        id_pemberi INT UNSIGNED NOT NULL,
        id_penerima INT UNSIGNED NOT NULL,
        id_penugasan_asal INT UNSIGNED NULL,
        deskripsi TEXT NOT NULL,
        prioritas ENUM('rendah','sedang','tinggi') NOT NULL DEFAULT 'sedang',
        tenggat DATE NULL,
        status ENUM('menunggu','diterima','ditolak','didelegasikan','selesai','dibatalkan')
            NOT NULL DEFAULT 'menunggu',
        alasan_delegasi TEXT NULL,
        alasan_penolakan TEXT NULL,
        tgl_respons DATETIME NULL,
        tgl_penugasan DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        tgl_selesai DATETIME NULL,
        alasan_pembatalan TEXT NULL,
        tgl_pembatalan DATETIME NULL,
        PRIMARY KEY (id_penugasan),
        UNIQUE KEY uq_penugasan_penerima (id_penugasan, id_penerima),
        KEY idx_penugasan_penerima_status (id_penerima, status),
        CONSTRAINT fk_penugasan_pemberi FOREIGN KEY (id_pemberi) REFERENCES pengguna (id_pengguna),
        CONSTRAINT fk_penugasan_penerima FOREIGN KEY (id_penerima) REFERENCES pengguna (id_pengguna),
        CONSTRAINT fk_penugasan_delegasi FOREIGN KEY (id_penugasan_asal, id_pemberi)
            REFERENCES penugasan (id_penugasan, id_penerima),
        CONSTRAINT ck_penugasan_tolak CHECK (status <> 'ditolak' OR alasan_penolakan IS NOT NULL),
        CONSTRAINT ck_penugasan_batal CHECK (status <> 'dibatalkan'
            OR (alasan_pembatalan IS NOT NULL AND tgl_pembatalan IS NOT NULL)),
        CONSTRAINT ck_penugasan_selesai CHECK (status <> 'selesai' OR tgl_selesai IS NOT NULL)
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS logbook (
        id_logbook INT UNSIGNED NOT NULL AUTO_INCREMENT,
        id_pengguna INT UNSIGNED NOT NULL,
        id_tupoksi INT UNSIGNED NULL,
        id_penugasan INT UNSIGNED NULL,
        id_kepanitiaan INT UNSIGNED NULL,
        tgl_kegiatan DATE NOT NULL,
        kategori VARCHAR(50) NOT NULL,
        uraian TEXT NOT NULL,
        target TEXT NULL,
        hasil TEXT NULL,
        periode CHAR(7) GENERATED ALWAYS AS
            (CONCAT(YEAR(tgl_kegiatan), '-', LPAD(MONTH(tgl_kegiatan), 2, '0'))) STORED,
        status ENUM('draf','diajukan','perlu_revisi','direview','divalidasi','dikembalikan')
            NOT NULL DEFAULT 'draf',
        tgl_pengajuan DATETIME NULL,
        PRIMARY KEY (id_logbook),
        KEY idx_logbook_pengguna_periode (id_pengguna, periode),
        KEY idx_logbook_status (status),
        CONSTRAINT fk_logbook_pengguna FOREIGN KEY (id_pengguna) REFERENCES pengguna (id_pengguna),
        CONSTRAINT fk_logbook_tupoksi FOREIGN KEY (id_tupoksi) REFERENCES tupoksi (id_tupoksi),
        CONSTRAINT fk_logbook_penugasan FOREIGN KEY (id_penugasan, id_pengguna)
            REFERENCES penugasan (id_penugasan, id_penerima),
        CONSTRAINT fk_logbook_anggota FOREIGN KEY (id_kepanitiaan, id_pengguna)
            REFERENCES anggota_kepanitiaan (id_kepanitiaan, id_pengguna),
        CONSTRAINT ck_logbook_ajukan CHECK (status = 'draf' OR tgl_pengajuan IS NOT NULL)
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS bukti_logbook (
        id_bukti INT UNSIGNED NOT NULL AUTO_INCREMENT,
        id_logbook INT UNSIGNED NOT NULL,
        nama_berkas VARCHAR(255) NOT NULL,
        jenis_berkas VARCHAR(50) NOT NULL,
        lokasi_berkas VARCHAR(500) NOT NULL,
        tgl_unggah DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        keterangan VARCHAR(255) NULL,
        PRIMARY KEY (id_bukti),
        CONSTRAINT fk_bukti_logbook FOREIGN KEY (id_logbook)
            REFERENCES logbook (id_logbook) ON DELETE CASCADE
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS review_logbook (
        id_review INT UNSIGNED NOT NULL AUTO_INCREMENT,
        id_logbook INT UNSIGNED NOT NULL,
        id_peninjau INT UNSIGNED NOT NULL,
        komentar TEXT NULL,
        catatan_revisi TEXT NULL,
        status_review ENUM('disetujui','revisi') NOT NULL,
        waktu DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id_review),
        CONSTRAINT fk_review_logbook FOREIGN KEY (id_logbook) REFERENCES logbook (id_logbook),
        CONSTRAINT fk_review_peninjau FOREIGN KEY (id_peninjau) REFERENCES pengguna (id_pengguna),
        CONSTRAINT ck_review_revisi CHECK (status_review <> 'revisi' OR catatan_revisi IS NOT NULL)
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS validasi_logbook (
        id_validasi INT UNSIGNED NOT NULL AUTO_INCREMENT,
        id_logbook INT UNSIGNED NOT NULL,
        id_validator INT UNSIGNED NOT NULL,
        keputusan ENUM('divalidasi','dikembalikan') NOT NULL,
        alasan_pengembalian TEXT NULL,
        waktu_validasi DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id_validasi),
        CONSTRAINT fk_validasi_logbook FOREIGN KEY (id_logbook) REFERENCES logbook (id_logbook),
        CONSTRAINT fk_validasi_validator FOREIGN KEY (id_validator) REFERENCES pengguna (id_pengguna),
        CONSTRAINT ck_validasi_kembali CHECK (keputusan <> 'dikembalikan' OR alasan_pengembalian IS NOT NULL)
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS impor_presensi (
        id_impor INT UNSIGNED NOT NULL AUTO_INCREMENT,
        id_pengimpor INT UNSIGNED NOT NULL,
        nama_berkas VARCHAR(255) NOT NULL,
        periode CHAR(7) NOT NULL,
        baris_berhasil INT UNSIGNED NOT NULL DEFAULT 0,
        baris_gagal INT UNSIGNED NOT NULL DEFAULT 0,
        hasil_validasi TEXT NULL,
        waktu_impor DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id_impor),
        CONSTRAINT fk_impor_pengimpor FOREIGN KEY (id_pengimpor) REFERENCES pengguna (id_pengguna)
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS presensi (
        id_presensi INT UNSIGNED NOT NULL AUTO_INCREMENT,
        id_pengguna INT UNSIGNED NOT NULL,
        id_impor INT UNSIGNED NULL,
        tgl_presensi DATE NOT NULL,
        jam_masuk TIME NULL,
        jam_mulai_istirahat TIME NULL,
        jam_selesai_istirahat TIME NULL,
        jam_keluar TIME NULL,
        status_presensi ENUM('hadir','terlambat','izin','sakit','cuti','alpa') NOT NULL,
        PRIMARY KEY (id_presensi),
        UNIQUE KEY uq_presensi_harian (id_pengguna, tgl_presensi),
        CONSTRAINT fk_presensi_pengguna FOREIGN KEY (id_pengguna) REFERENCES pengguna (id_pengguna),
        CONSTRAINT fk_presensi_impor FOREIGN KEY (id_impor) REFERENCES impor_presensi (id_impor) ON DELETE SET NULL,
        CONSTRAINT ck_presensi_urutan CHECK (
            (jam_masuk IS NULL OR jam_mulai_istirahat IS NULL OR jam_mulai_istirahat >= jam_masuk)
            AND (jam_mulai_istirahat IS NULL OR jam_selesai_istirahat IS NULL OR jam_selesai_istirahat >= jam_mulai_istirahat)
            AND (jam_selesai_istirahat IS NULL OR jam_keluar IS NULL OR jam_keluar >= jam_selesai_istirahat)
            AND (jam_masuk IS NULL OR jam_keluar IS NULL OR jam_keluar >= jam_masuk)),
        CONSTRAINT ck_presensi_hadir CHECK (status_presensi NOT IN ('hadir','terlambat') OR jam_masuk IS NOT NULL)
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS audit_trail (
        id_aktivitas INT UNSIGNED NOT NULL AUTO_INCREMENT,
        id_pengguna INT UNSIGNED NULL,
        jenis_aktivitas VARCHAR(50) NOT NULL,
        objek_diubah VARCHAR(50) NULL,
        id_objek INT UNSIGNED NULL,
        data_sebelum JSON NULL,
        data_sesudah JSON NULL,
        keterangan TEXT NULL,
        waktu DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id_aktivitas),
        KEY idx_audit_objek (objek_diubah, id_objek),
        CONSTRAINT fk_audit_pengguna FOREIGN KEY (id_pengguna) REFERENCES pengguna (id_pengguna)
    ) ENGINE=InnoDB`,
];
