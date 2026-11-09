
const express = require("express");
const cors = require("cors");
const db = require("./config/database");
const authRoutes = require("./routes/authRoutes");
const managementRoutes = require("./routes/managementRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/management", managementRoutes);

app.get("/", (req, res) => {
    res.send("Backend Sistem Informasi Manajemen Kinerja Berhasil Berjalan!");
});

async function startServer() {
    try {
        await db.initializeDatabase();
        app.listen(PORT, () => {
            console.log(`Server berjalan di http://localhost:${PORT}`);
            console.log("Database MySQL dan tabel berhasil disiapkan.");
        });
    } catch (error) {
        console.error("Backend gagal dijalankan:", error.message);
        process.exitCode = 1;
    }
}

startServer();
