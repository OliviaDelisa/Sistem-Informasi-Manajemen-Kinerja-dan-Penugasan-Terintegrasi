
const express = require("express");
const cors = require("cors");
const db = require("./config/database");

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.send("Backend Sistem Informasi Manajemen Kinerja Berhasil Berjalan!");
});

app.listen(PORT, async () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);

    try {
        const connection = await db.getConnection();
        console.log("Database MySQL berhasil terhubung!");
        connection.release();
    } catch (error) {
        console.error("Koneksi database gagal:", error.message);
    }
});
