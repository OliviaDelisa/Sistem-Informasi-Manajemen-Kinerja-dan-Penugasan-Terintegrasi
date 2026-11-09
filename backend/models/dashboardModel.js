const db = require("../config/database");

async function getSummary() {
    const [[users]] = await db.execute("SELECT COUNT(*) AS total FROM pengguna");
    const [[units]] = await db.execute("SELECT COUNT(*) AS total FROM unit_kerja");
    const [[roles]] = await db.execute("SELECT COUNT(*) AS total FROM `role`");
    const [[positions]] = await db.execute("SELECT COUNT(*) AS total FROM jabatan");
    const [roleRows] = await db.execute(
        "SELECT id_role, nama_role, COUNT(p.id_pengguna) AS total FROM `role` r LEFT JOIN pengguna p ON p.id_role = r.id_role GROUP BY r.id_role, r.nama_role ORDER BY r.id_role",
    );

    return {
        totalUsers: Number(users.total),
        totalUnits: Number(units.total),
        totalRoles: Number(roles.total),
        totalPositions: Number(positions.total),
        usersByRole: roleRows.map((row) => ({ roleId: row.id_role, roleName: row.nama_role, total: Number(row.total) })),
    };
}

module.exports = { getSummary };
